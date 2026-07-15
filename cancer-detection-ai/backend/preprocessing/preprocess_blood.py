"""
Blood Cancer (Acute Lymphoblastic Leukaemia - ALL) preprocessing pipeline.

Loads blood smear microscopy images from a directory structure:
    data_dir/
    ├── all/   (cancerous)
    └── hem/   (healthy/normal)

Pipeline:
    1. Resize to 224x224
    2. Convert BGR -> RGB (OpenCV loads BGR by default)
    3. Apply CLAHE on the L channel in LAB color space
    4. Normalize pixel values to [0, 1]
    5. Data augmentation (random flips, rotation, zoom, brightness)

Author: Geeky Blinders (AIML Sem 7)
"""

import os
from pathlib import Path
from typing import Tuple

import cv2
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt


# Class labels — fixed ordering for ALL binary classification
CLASS_NAMES = ["all", "hem"]   # 0 = ALL (cancer), 1 = HEM (normal)
IMG_SIZE = 224
BATCH_SIZE = 32
SEED = 42


# ----------------------------------------------------------------------------
# 1. Image preprocessing functions
# ----------------------------------------------------------------------------

def apply_clahe(rgb_image: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) on the
    L (lightness) channel after converting RGB to LAB color space.

    This enhances contrast in dark regions of the blood smear while
    preserving color information, helping the model pick up subtle
    morphological differences in white blood cells.

    Args:
        rgb_image: RGB image as a numpy array of shape (H, W, 3), uint8.

    Returns:
        RGB image with CLAHE applied, same shape and dtype.
    """
    # Convert RGB -> LAB
    lab = cv2.cvtColor(rgb_image, cv2.COLOR_RGB2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    # Apply CLAHE to L channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel_clahe = clahe.apply(l_channel)

    # Merge back and convert LAB -> RGB
    lab_clahe = cv2.merge((l_channel_clahe, a_channel, b_channel))
    rgb_clahe = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2RGB)
    return rgb_clahe


def preprocess_single_image(image_path: str) -> np.ndarray:
    """
    Load and preprocess a single image file from disk.

    Pipeline:
        1. Load (BGR via OpenCV)
        2. Resize to 224x224
        3. Convert BGR -> RGB
        4. Apply CLAHE
        5. Normalize pixel values to [0, 1] as float32

    Args:
        image_path: Path to the image file.

    Returns:
        Preprocessed image as numpy array of shape (224, 224, 3), dtype float32.
    """
    # 1. Load image in BGR
    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise FileNotFoundError(f"Could not load image: {image_path}")

    # 2. Resize
    img_bgr = cv2.resize(img_bgr, (IMG_SIZE, IMG_SIZE))

    # 3. BGR -> RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # 4. CLAHE on L channel
    img_rgb = apply_clahe(img_rgb)

    # 5. Normalize to [0, 1]
    img_rgb = img_rgb.astype(np.float32) / 255.0
    return img_rgb


def load_images_from_directory(data_dir: str) -> Tuple[np.ndarray, np.ndarray]:
    """
    Walk a directory with subfolders per class, load and preprocess all images.

    Expected directory layout:
        data_dir/
        ├── all/  (class 0)
        └── hem/  (class 1)

    Args:
        data_dir: Root directory containing one subfolder per class.

    Returns:
        Tuple of (images, labels):
            images: numpy array of shape (N, 224, 224, 3), dtype float32.
            labels: numpy array of shape (N,), dtype int32 with class indices.
    """
    images = []
    labels = []

    for class_idx, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(data_dir, class_name)
        if not os.path.isdir(class_dir):
            print(f"[WARN] Class directory not found, skipping: {class_dir}")
            continue

        files = [
            f for f in os.listdir(class_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".tif"))
        ]
        print(f"  Loading {len(files)} images from '{class_name}' (class {class_idx})...")

        for fname in files:
            img_path = os.path.join(class_dir, fname)
            try:
                img = preprocess_single_image(img_path)
                images.append(img)
                labels.append(class_idx)
            except Exception as exc:
                print(f"    [WARN] Skipping {img_path}: {exc}")

    images = np.array(images, dtype=np.float32)
    labels = np.array(labels, dtype=np.int32)
    print(f"[INFO] Loaded {len(images)} images total. Shape: {images.shape}")
    return images, labels


# ----------------------------------------------------------------------------
# 2. tf.data augmentation layer
# ----------------------------------------------------------------------------

def get_augmentation_layer() -> tf.keras.Sequential:
    """
    Build a Keras Sequential model that applies on-GPU data augmentation.

    Includes:
        - Random horizontal flip
        - Random vertical flip
        - Random rotation (factor=0.2 -> ±36°)
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
    ], name="blood_augmentation")


# ----------------------------------------------------------------------------
# 3. tf.data.Dataset pipeline
# ----------------------------------------------------------------------------

def create_tf_dataset(
    images: np.ndarray,
    labels: np.ndarray,
    training: bool = True,
    batch_size: int = BATCH_SIZE,
    preprocess_fn=None,
) -> tf.data.Dataset:
    """
    Wrap numpy arrays in a performant tf.data.Dataset pipeline.

    Args:
        images: numpy array (N, 224, 224, 3), float32, in [0,1].
        labels: numpy array (N,), int32.
        training: If True, applies augmentation, shuffling, and no-repeat.
        batch_size: Batch size.

    Returns:
        A tf.data.Dataset yielding (image_batch, label_batch) tuples.
    """
    dataset = tf.data.Dataset.from_tensor_slices((images, labels))

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


def create_tf_dataset_from_paths(
    paths: np.ndarray,
    labels: np.ndarray,
    training: bool = True,
    batch_size: int = BATCH_SIZE,
    preprocess_fn=None,
) -> tf.data.Dataset:
    """Build a tf.data.Dataset that loads and preprocesses images from file paths lazily."""
    path_ds = tf.data.Dataset.from_tensor_slices((paths, labels))

    if training:
        shuffle_size = min(len(paths), 1024)
        path_ds = path_ds.shuffle(buffer_size=shuffle_size, seed=SEED, reshuffle_each_iteration=True)

    def load_image(path, label):
        def _load(path_value):
            path_str = path_value.decode("utf-8") if isinstance(path_value, bytes) else str(path_value)
            return preprocess_single_image(path_str).astype(np.float32)

        image = tf.numpy_function(_load, [path], tf.float32)
        image.set_shape((IMG_SIZE, IMG_SIZE, 3))
        return image, label

    path_ds = path_ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)

    if training:
        augment = get_augmentation_layer()
        path_ds = path_ds.map(
            lambda x, y: (augment(x, training=True), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )

    if preprocess_fn is not None:
        path_ds = path_ds.map(
            lambda x, y: (preprocess_fn(x), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )

    path_ds = path_ds.batch(batch_size)
    path_ds = path_ds.prefetch(tf.data.AUTOTUNE)
    return path_ds


# ----------------------------------------------------------------------------
# 4. Train / val / test split
# ----------------------------------------------------------------------------

def create_split(
    data_dir: str,
    split: Tuple[float, float, float] = (0.70, 0.15, 0.15),
    output_csv: str = None,
) -> dict:
    """
    Split the dataset into train/val/test with stratified class ratios.

    The split information (file paths + labels + split assignment) is saved
    to a CSV for full reproducibility.

    Args:
        data_dir: Root directory with class subfolders.
        split: Tuple of (train, val, test) ratios. Must sum to 1.0.
        output_csv: Where to save the split manifest. If None, defaults to
                    data/splits/blood_split.csv (relative to project root).

    Returns:
        Dict with keys 'train', 'val', 'test', each a tuple
        (image_paths, labels, class_names).
    """
    assert abs(sum(split) - 1.0) < 1e-6, f"Split ratios must sum to 1.0, got {sum(split)}"

    # Collect all (path, label) pairs
    all_paths = []
    all_labels = []
    for class_idx, class_name in enumerate(CLASS_NAMES):
        class_dir = os.path.join(data_dir, class_name)
        if not os.path.isdir(class_dir):
            continue
        for fname in os.listdir(class_dir):
            if fname.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".tif")):
                all_paths.append(os.path.join(class_dir, fname))
                all_labels.append(class_idx)

    all_paths = np.array(all_paths)
    all_labels = np.array(all_labels)

    # First split: train vs (val + test)
    train_p, rest_p, train_l, rest_l = train_test_split(
        all_paths, all_labels,
        test_size=(split[1] + split[2]),
        stratify=all_labels,
        random_state=SEED,
    )

    # Second split: val vs test
    val_ratio_of_rest = split[1] / (split[1] + split[2])
    val_p, test_p, val_l, test_l = train_test_split(
        rest_p, rest_l,
        test_size=(1 - val_ratio_of_rest),
        stratify=rest_l,
        random_state=SEED,
    )

    print(f"[INFO] Split sizes -> train: {len(train_p)}, val: {len(val_p)}, test: {len(test_p)}")

    # Save split manifest
    if output_csv is None:
        # default: data/splits/blood_split.csv relative to project root
        project_root = Path(__file__).resolve().parents[2]
        output_csv = project_root / "data" / "splits" / "blood_split.csv"

    os.makedirs(os.path.dirname(output_csv), exist_ok=True)
    rows = []
    for p, l in zip(train_p, train_l):
        rows.append({"filepath": p, "label": l, "split": "train"})
    for p, l in zip(val_p, val_l):
        rows.append({"filepath": p, "label": l, "split": "val"})
    for p, l in zip(test_p, test_l):
        rows.append({"filepath": p, "label": l, "split": "test"})
    pd.DataFrame(rows).to_csv(output_csv, index=False)
    print(f"[INFO] Split manifest saved to: {output_csv}")

    return {
        "train": (list(train_p), list(train_l), CLASS_NAMES),
        "val":   (list(val_p),   list(val_l),   CLASS_NAMES),
        "test":  (list(test_p),  list(test_l),  CLASS_NAMES),
    }


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
                     backend/results/sample_blood_images.png.
    """
    if output_path is None:
        results_dir = Path(__file__).resolve().parents[1] / "results"
        output_path = results_dir / "sample_blood_images.png"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Take one batch
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
        img = batch_images[i]
        # Clip to valid range for display
        img = np.clip(img, 0, 1)
        axes[i].imshow(img)
        axes[i].set_title(f"Class: {CLASS_NAMES[batch_labels[i]]}", fontsize=10)
        axes[i].axis("off")

    # Hide unused axes
    for j in range(i + 1, len(axes)):
        axes[j].axis("off")

    plt.suptitle("Sample Blood Smear Images (CLAHE-preprocessed + augmented)",
                 fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved sample visualization to: {output_path}")


# ----------------------------------------------------------------------------
# 6. Main entry point (for testing the pipeline)
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    """
    Quick sanity check:
        python preprocess_blood.py
    Requires a directory at data/raw/blood/ with subfolders all/ and hem/.
    """
    project_root = Path(__file__).resolve().parents[2]
    data_dir = project_root / "data" / "raw" / "blood"

    if not data_dir.exists():
        print(f"[ERROR] Data directory not found: {data_dir}")
        print("Please download the C-NMC 2019 dataset and place it under data/raw/blood/.")
    else:
        print(f"[INFO] Loading from {data_dir}...")
        images, labels = load_images_from_directory(str(data_dir))
        print(f"[INFO] Class distribution: {np.bincount(labels)}")

        ds = create_tf_dataset(images, labels, training=True)
        visualize_samples(ds, n=9)
