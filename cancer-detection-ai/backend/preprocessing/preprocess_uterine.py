"""
Uterine / Endometrial Cancer preprocessing pipeline using PathMNIST
(histopathology images from the medmnist library).

Pipeline:
    1. Download PathMNIST (lightweight source resolution) via medmnist
    2. Resize images to 224x224 for the model pipeline
    3. Normalize pixel values to [0, 1]
    4. Apply data augmentation (random flips, rotation, zoom, brightness)
    5. Wrap in tf.data.Dataset pipelines for train/val/test
    6. Save a sample visualization grid

Author: Geeky Blinders (AIML Sem 7)
"""

import os
from pathlib import Path
from typing import Tuple

import numpy as np
import tensorflow as tf
import matplotlib.pyplot as plt

# medmnist is an optional dependency — handle import gracefully
try:
    from medmnist import PathMNIST
    MEDMNIST_AVAILABLE = True
except ImportError:
    MEDMNIST_AVAILABLE = False
    print("[WARN] medmnist is not installed. Run: pip install medmnist")


# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

# PathMNIST has 9 tissue-type classes. We collapse to a binary task:
#   - 0: "normal"   (tissue types: ADI, BACK, DEB, LYM, MUC, MUS, NORM, STR)
#   - 1: "tumor"    (TUM)
PATHMNIST_TUMOR_LABEL = 7   # index 7 in PathMNIST is TUM (tumor epithelium)
CLASS_NAMES = ["tumor", "normal"]
IMG_SIZE = 224
BATCH_SIZE = 32
SEED = 42


# ----------------------------------------------------------------------------
# 1. Load PathMNIST
# ----------------------------------------------------------------------------

def load_pathmnist_binary(split: str = "train", max_samples: int = 0) -> Tuple[np.ndarray, np.ndarray]:
    """
    Download/load PathMNIST for a given split and convert to a binary
    tumor-vs-normal task.

    Args:
        split: One of 'train', 'val', 'test'.

    Returns:
        Tuple of (images, labels):
            images: numpy array (N, 224, 224, 3), uint8 in [0, 255].
            labels: numpy array (N,), int32 with binary labels (0=tumor, 1=normal).
    """
    if not MEDMNIST_AVAILABLE:
        raise ImportError("medmnist is required. Install with: pip install medmnist")

    print(f"[INFO] Loading PathMNIST split='{split}', size=28 ...")
    dataset = PathMNIST(split=split, download=True, size=28)

    # PathMNIST.imgs is lightweight source resolution; resize locally to 224x224
    images = dataset.imgs  # uint8
    raw_labels = dataset.labels.squeeze().astype(np.int32)

    if max_samples and max_samples > 0 and len(images) > max_samples:
        images = images[:max_samples]
        raw_labels = raw_labels[:max_samples]

    # Convert to binary: tumor (label 7) -> 0, everything else -> 1
    binary_labels = np.where(raw_labels == PATHMNIST_TUMOR_LABEL, 0, 1)

    print(f"[INFO] Loaded {len(images)} images. Tumor: {(binary_labels == 0).sum()}, "
          f"Normal: {(binary_labels == 1).sum()}")
    return images, binary_labels


# ----------------------------------------------------------------------------
# 2. Preprocessing helpers
# ----------------------------------------------------------------------------

def normalize_images(images_uint8: np.ndarray) -> np.ndarray:
    """
    Normalize uint8 [0, 255] images to float32 [0, 1].

    Args:
        images_uint8: numpy array (N, H, W, 3), uint8.

    Returns:
        numpy array (N, H, W, 3), float32, in [0, 1].
    """
    return images_uint8.astype(np.float32) / 255.0


def resize_images(images_uint8: np.ndarray, target_size: int = IMG_SIZE) -> np.ndarray:
    """Resize a batch of uint8 images to the target square resolution."""
    resized = [tf.image.resize(img, (target_size, target_size), method="bilinear").numpy()
               for img in images_uint8]
    return np.asarray(resized, dtype=np.uint8)


# ----------------------------------------------------------------------------
# 3. tf.data augmentation layer
# ----------------------------------------------------------------------------

def get_augmentation_layer() -> tf.keras.Sequential:
    """
    Build a Keras Sequential model that applies on-GPU data augmentation
    suitable for histopathology images.

    Includes:
        - Random horizontal flip
        - Random vertical flip
        - Random rotation (factor=0.2)
        - Random zoom (factor=0.15)
        - Random brightness (factor=0.1)

    Returns:
        A tf.keras.Sequential augmentation model.
    """
    return tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical", seed=SEED),
        tf.keras.layers.RandomRotation(0.2, seed=SEED),
        tf.keras.layers.RandomZoom(0.15, seed=SEED),
        tf.keras.layers.RandomBrightness(0.1, seed=SEED),
    ], name="uterine_augmentation")


# ----------------------------------------------------------------------------
# 4. tf.data.Dataset pipeline
# ----------------------------------------------------------------------------

def create_tf_dataset(
    images: np.ndarray,
    labels: np.ndarray,
    training: bool = True,
    batch_size: int = BATCH_SIZE,
    preprocess_fn=None,
) -> tf.data.Dataset:
    """
    Build a tf.data.Dataset from numpy arrays.

    Args:
        images: numpy array (N, 224, 224, 3), float32, in [0,1].
        labels: numpy array (N,), int32.
        training: If True, applies augmentation and shuffling.
        batch_size: Batch size.

    Returns:
        A tf.data.Dataset yielding (image_batch, label_batch).
    """
    dataset = tf.data.Dataset.from_tensor_slices((images, labels))

    dataset = dataset.map(
        lambda x, y: (tf.image.resize(x, (IMG_SIZE, IMG_SIZE)), y),
        num_parallel_calls=tf.data.AUTOTUNE,
    )

    if training:
        dataset = dataset.shuffle(buffer_size=len(images), seed=SEED, reshuffle_each_iteration=True)
        augment = get_augmentation_layer()
        dataset = dataset.map(
            lambda x, y: (augment(x, training=True), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )

    if preprocess_fn is not None:
        dataset = dataset.map(
            lambda x, y: (preprocess_fn(x), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )

    dataset = dataset.batch(batch_size)
    dataset = dataset.prefetch(tf.data.AUTOTUNE)
    return dataset


def load_all_splits(max_train_samples: int = 0, max_val_samples: int = 0, max_test_samples: int = 0) -> dict:
    """
    Convenience function: load train/val/test splits at once.

    Returns:
        Dict with keys 'train', 'val', 'test', each a tuple
        (images_float32, labels_int32).
    """
    splits = {}
    for split_name in ["train", "val", "test"]:
        if split_name == "train":
            limit = max_train_samples
        elif split_name == "val":
            limit = max_val_samples
        else:
            limit = max_test_samples
        imgs, lbls = load_pathmnist_binary(split_name, max_samples=limit)
        imgs = normalize_images(imgs)
        splits[split_name] = (imgs, lbls)
    return splits


# ----------------------------------------------------------------------------
# 5. Sample visualization
# ----------------------------------------------------------------------------

def visualize_samples(dataset: tf.data.Dataset, n: int = 9, output_path: str = None) -> None:
    """
    Save a 3x3 grid of sample images from a tf.data dataset.

    Args:
        dataset: A tf.data.Dataset yielding (image, label) batches.
        n: Number of images to display (default 9 -> 3x3 grid).
        output_path: Where to save the PNG. If None, defaults to
                     backend/results/sample_uterine_images.png.
    """
    if output_path is None:
        results_dir = Path(__file__).resolve().parents[1] / "results"
        output_path = results_dir / "sample_uterine_images.png"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    for batch_images, batch_labels in dataset.take(1):
        break

    batch_images = batch_images.numpy()
    batch_labels = batch_labels.numpy()

    rows = int(np.ceil(np.sqrt(n)))
    fig, axes = plt.subplots(rows, rows, figsize=(10, 10))
    axes = np.array(axes).flatten()

    for i in range(n):
        if i >= len(batch_images):
            break
        img = np.clip(batch_images[i], 0, 1)
        axes[i].imshow(img)
        axes[i].set_title(f"Class: {CLASS_NAMES[batch_labels[i]]}", fontsize=10)
        axes[i].axis("off")

    for j in range(i + 1, len(axes)):
        axes[j].axis("off")

    plt.suptitle("Sample Uterine Histopathology Images (PathMNIST + augmented)",
                 fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved sample visualization to: {output_path}")


# ----------------------------------------------------------------------------
# 6. Main entry point
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    """
    Quick sanity check:
        python preprocess_uterine.py

    Downloads PathMNIST (~3 GB on first run), preprocesses, and saves
    a sample visualization to backend/results/sample_uterine_images.png.
    """
    if not MEDMNIST_AVAILABLE:
        print("[ERROR] medmnist is not installed. Install with: pip install medmnist")
        raise SystemExit(1)

    print("[INFO] Downloading and preprocessing PathMNIST (source size=28, resized to 224)...")
    splits = load_all_splits()

    train_imgs, train_lbls = splits["train"]
    print(f"[INFO] Train set: {train_imgs.shape}, labels: {np.bincount(train_lbls)}")

    train_ds = create_tf_dataset(train_imgs, train_lbls, training=True)
    visualize_samples(train_ds, n=9)
