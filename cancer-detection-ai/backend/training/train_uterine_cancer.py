"""
Uterine / Endometrial Cancer training script using EfficientNetV2B1 pretrained
on ImageNet, trained on the PathMNIST dataset (medmnist).

Two-phase training strategy:
    Phase 1: Freeze the base model and train only the classification head.
    Phase 2: Unfreeze the last 20 layers and fine-tune with a lower LR.

Outputs:
    - backend/models/efficientnetv2b1_uterine_cancer.h5
    - backend/results/uterine_training_curves.png
    - backend/results/uterine_roc_curve.png
    - backend/results/uterine_confusion_matrix.png
    - backend/results/uterine_metrics.json
    - backend/results/model_comparison.json   (combines both models' metrics)

Author: Geeky Blinders (AIML Sem 7)
"""

import json
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import tensorflow as tf
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras.applications import EfficientNetV2B1
from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as efficientnetv2_preprocess_input
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.layers import BatchNormalization, Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam

# Make the preprocessing module importable
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from preprocessing.preprocess_uterine import (  # noqa: E402
    CLASS_NAMES,
    IMG_SIZE,
    create_tf_dataset,
    load_all_splits,
)


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

MODELS_DIR = BACKEND_DIR / "models"
RESULTS_DIR = BACKEND_DIR / "results"
MODEL_FILENAME = "efficientnetv2b1_uterine_cancer.h5"
SEED = 42

PHASE1_EPOCHS = 10
PHASE2_EPOCHS = 40
PHASE1_LR = 1e-3
PHASE2_LR = 1e-5
FINE_TUNE_LAYERS = 20
BATCH_SIZE = 32
FAST_DEV_MODE = os.getenv("FAST_DEV_MODE", "0") == "1"
MAX_TRAIN_SAMPLES = int(os.getenv("MAX_TRAIN_SAMPLES", "4000" if FAST_DEV_MODE else "0"))
MAX_VAL_SAMPLES = int(os.getenv("MAX_VAL_SAMPLES", "1000" if FAST_DEV_MODE else "0"))
MAX_TEST_SAMPLES = int(os.getenv("MAX_TEST_SAMPLES", "1000" if FAST_DEV_MODE else "0"))
PHASE1_EPOCHS = int(os.getenv("UTERINE_PHASE1_EPOCHS", "2" if FAST_DEV_MODE else "10"))
PHASE2_EPOCHS = int(os.getenv("UTERINE_PHASE2_EPOCHS", "3" if FAST_DEV_MODE else "40"))


# ----------------------------------------------------------------------------
# Model builder
# ----------------------------------------------------------------------------

def build_efficientnetv2b1_binary(input_shape=(IMG_SIZE, IMG_SIZE, 3), num_classes: int = 2) -> Model:
    """
    Build an EfficientNetV2B1-based binary classifier with a custom classification head.

    Architecture:
        EfficientNetV2B1 (ImageNet, frozen initially)
            -> GlobalAveragePooling2D
            -> Dense(256, relu)
            -> Dropout(0.5)
            -> BatchNormalization
            -> Dense(num_classes, softmax)

    Args:
        input_shape: Input image shape.
        num_classes: Number of output classes.

    Returns:
        A compiled Keras Model.
    """
    print("[INFO] Building EfficientNetV2B1 with custom classification head...")
    base_model = EfficientNetV2B1(
        weights="imagenet",
        include_top=False,
        input_shape=input_shape,
    )
    base_model.trainable = False  # freeze base for Phase 1

    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(256, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(1e-4))(x)
    x = Dropout(0.5)(x)
    x = BatchNormalization()(x)
    output = Dense(num_classes, activation="softmax")(x)

    model = Model(inputs=base_model.input, outputs=output, name="EfficientNetV2B1_UterineCancer")
    print(f"[INFO] Total layers: {len(model.layers)}, "
          f"Trainable: {sum(1 for l in model.layers if l.trainable)}")
    return model


def limit_split(images, labels, max_samples: int, seed: int = SEED):
    """Return a balanced downsampled subset if max_samples is positive."""
    if not max_samples or max_samples <= 0 or len(images) <= max_samples:
        return images, labels

    rng = np.random.default_rng(seed)
    selected_indices = []
    classes = np.unique(labels)
    per_class = max(1, max_samples // len(classes))

    for cls in classes:
        cls_indices = np.where(labels == cls)[0]
        take = min(len(cls_indices), per_class)
        if take > 0:
            selected_indices.extend(rng.choice(cls_indices, size=take, replace=False).tolist())

    if len(selected_indices) < max_samples:
        remaining = np.setdiff1d(np.arange(len(labels)), np.array(selected_indices, dtype=np.int32), assume_unique=False)
        extra_needed = min(len(remaining), max_samples - len(selected_indices))
        if extra_needed > 0:
            selected_indices.extend(rng.choice(remaining, size=extra_needed, replace=False).tolist())

    selected_indices = np.array(sorted(set(selected_indices)), dtype=np.int32)
    return images[selected_indices], labels[selected_indices]


def apply_preprocessing(images: np.ndarray) -> np.ndarray:
    """Apply EfficientNetV2 preprocessing expected by the ImageNet backbone."""
    images = tf.cast(images, tf.float32) * 255.0
    return efficientnetv2_preprocess_input(images)


def compute_class_weights(labels: np.ndarray) -> dict:
    """Balance the binary classes during training."""
    classes = np.unique(labels)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=labels)
    return {int(cls): float(weight) for cls, weight in zip(classes, weights)}


# ----------------------------------------------------------------------------
# Plotting helpers
# ----------------------------------------------------------------------------

def plot_training_curves(history, output_path: Path) -> None:
    """Plot training/validation loss and accuracy curves."""
    os.makedirs(output_path.parent, exist_ok=True)
    hist = history.history

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].plot(hist["loss"], label="Train Loss", linewidth=2)
    axes[0].plot(hist["val_loss"], label="Val Loss", linewidth=2)
    axes[0].set_title("EfficientNetV2B1 Uterine Cancer — Loss", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss")
    axes[0].legend()
    axes[0].grid(alpha=0.3)

    axes[1].plot(hist["accuracy"], label="Train Accuracy", linewidth=2)
    axes[1].plot(hist["val_accuracy"], label="Val Accuracy", linewidth=2)
    axes[1].set_title("EfficientNetV2B1 Uterine Cancer — Accuracy", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Accuracy")
    axes[1].legend()
    axes[1].grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved training curves to {output_path}")


def plot_roc_curve(y_true, y_prob, output_path: Path) -> None:
    """Plot ROC curve and save to disk."""
    os.makedirs(output_path.parent, exist_ok=True)
    fpr, tpr, _ = roc_curve(y_true, y_prob[:, 1])
    auc = roc_auc_score(y_true, y_prob[:, 1])

    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, color="#0D7377", linewidth=2, label=f"EfficientNetV2B1 (AUC = {auc:.3f})")
    plt.plot([0, 1], [0, 1], "k--", linewidth=1, alpha=0.5, label="Random")
    plt.fill_between(fpr, tpr, alpha=0.2, color="#0D7377")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curve — Uterine Cancer (EfficientNetV2B1)", fontsize=12, fontweight="bold")
    plt.legend(loc="lower right")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved ROC curve to {output_path}")


def plot_confusion_matrix(y_true, y_pred, output_path: Path) -> None:
    """Plot confusion matrix heatmap and save to disk."""
    os.makedirs(output_path.parent, exist_ok=True)
    cm = confusion_matrix(y_true, y_pred)

    plt.figure(figsize=(7, 6))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Greens",
        xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
        cbar=False, linewidths=1, linecolor="black",
        annot_kws={"size": 16, "weight": "bold"},
    )
    plt.xlabel("Predicted Label", fontsize=11)
    plt.ylabel("True Label", fontsize=11)
    plt.title("Confusion Matrix — Uterine Cancer (EfficientNetV2B1)", fontsize=12, fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved confusion matrix to {output_path}")


# ----------------------------------------------------------------------------
# Evaluation
# ----------------------------------------------------------------------------

def compute_metrics(y_true, y_pred, y_prob) -> dict:
    """
    Compute binary classification metrics for the uterine cancer model.

    For our binary task:
        - Class 0 = "tumor"   (cancer / positive)
        - Class 1 = "normal"  (non-cancer / negative)
    Sensitivity (recall of positive class) and specificity (recall of negative)
    are reported accordingly.
    """
    acc = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    recall_neg = recall_score(y_true, y_pred, pos_label=0, zero_division=0)
    recall_pos = recall_score(y_true, y_pred, pos_label=1, zero_division=0)

    sensitivity = recall_pos
    specificity = recall_neg

    try:
        auc = roc_auc_score(y_true, y_prob[:, 1])
    except Exception:
        auc = float("nan")

    return {
        "accuracy": float(acc),
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
        "precision": float(precision),
        "f1_score": float(f1),
        "auc_roc": float(auc),
    }


# ----------------------------------------------------------------------------
# Model comparison
# ----------------------------------------------------------------------------

def create_model_comparison(blood_metrics: dict, uterine_metrics: dict,
                            output_path: Path) -> None:
    """
    Combine the blood and uterine model metrics into a single comparison
    JSON that the frontend can consume.

    Output structure:
        {
          "models": [
            {
              "name": "EfficientNetV2B0 (Blood Cancer)",
              "cancer_type": "blood",
              "architecture": "EfficientNetV2B0",
              "metrics": {...}
            },
            {
                            "name": "EfficientNetV2B1 (Uterine Cancer)",
                            "architecture": "EfficientNetV2B1",
              "metrics": {...}
            }
          ]
        }
    """
    comparison = {
        "models": [
            {
                "name": "EfficientNetV2B0 (Blood Cancer)",
                "cancer_type": "blood",
                "architecture": "EfficientNetV2B0",
                "metrics": blood_metrics,
            },
            {
                "name": "EfficientNetV2B1 (Uterine Cancer)",
                "cancer_type": "uterine",
                "architecture": "EfficientNetV2B1",
                "metrics": uterine_metrics,
            },
        ],
        "metric_descriptions": {
            "accuracy": "Overall correct predictions",
            "sensitivity": "True positive rate (cancer correctly identified)",
            "specificity": "True negative rate (normal correctly identified)",
            "precision": "Of predicted cancers, how many are real",
            "f1_score": "Harmonic mean of precision and sensitivity",
            "auc_roc": "Area under the ROC curve",
        },
    }
    with open(output_path, "w") as f:
        json.dump(comparison, f, indent=2)
    print(f"[INFO] Saved model comparison to {output_path}")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main() -> None:
    """End-to-end training pipeline for the uterine cancer model."""
    np.random.seed(SEED)
    tf.random.set_seed(SEED)

    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(RESULTS_DIR, exist_ok=True)

    # ------------------------------------------------------------------
    # 1. Load PathMNIST
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[STEP 1] Loading PathMNIST dataset (size=224)...")
    print("=" * 60)
    print("[INFO] This will download ~3 GB on first run.")

    try:
        splits = load_all_splits(
            max_train_samples=MAX_TRAIN_SAMPLES,
            max_val_samples=MAX_VAL_SAMPLES,
            max_test_samples=MAX_TEST_SAMPLES,
        )
    except Exception as exc:
        print(f"[ERROR] Failed to load PathMNIST: {exc}")
        print("Make sure medmnist is installed: pip install medmnist")
        return

    train_imgs, train_lbls = splits["train"]
    val_imgs, val_lbls = splits["val"]
    test_imgs, test_lbls = splits["test"]

    if FAST_DEV_MODE:
        print("[INFO] FAST_DEV_MODE=1 -> training on reduced balanced subsets.")
    train_imgs, train_lbls = limit_split(train_imgs, train_lbls, MAX_TRAIN_SAMPLES)
    val_imgs, val_lbls = limit_split(val_imgs, val_lbls, MAX_VAL_SAMPLES)
    test_imgs, test_lbls = limit_split(test_imgs, test_lbls, MAX_TEST_SAMPLES)

    print(f"[INFO] Shapes — train: {train_imgs.shape}, val: {val_imgs.shape}, test: {test_imgs.shape}")
    print(f"[INFO] Class distribution — train: {np.bincount(train_lbls)}, "
          f"test: {np.bincount(test_lbls)}")

    train_ds = create_tf_dataset(
        train_imgs,
        train_lbls,
        training=True,
        batch_size=BATCH_SIZE,
        preprocess_fn=apply_preprocessing,
    )
    val_ds = create_tf_dataset(
        val_imgs,
        val_lbls,
        training=False,
        batch_size=BATCH_SIZE,
        preprocess_fn=apply_preprocessing,
    )
    test_ds = create_tf_dataset(
        test_imgs,
        test_lbls,
        training=False,
        batch_size=BATCH_SIZE,
        preprocess_fn=apply_preprocessing,
    )
    class_weight = compute_class_weights(train_lbls)
    print(f"[INFO] Class weights: {class_weight}")

    # ------------------------------------------------------------------
    # 2. Build the model
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[STEP 2] Building EfficientNetV2B1 model...")
    print("=" * 60)
    model = build_efficientnetv2b1_binary()

    model.compile(
        optimizer=Adam(learning_rate=PHASE1_LR),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    # ------------------------------------------------------------------
    # 3. Phase 1: train with frozen base
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"[STEP 3] Phase 1 training ({PHASE1_EPOCHS} epochs, LR={PHASE1_LR})...")
    print("=" * 60)

    phase1_ckpt = str(MODELS_DIR / "efficientnetv2b1_uterine_phase1.h5")
    callbacks_p1 = [
        EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True, verbose=1),
        ModelCheckpoint(phase1_ckpt, monitor="val_loss", save_best_only=True, verbose=1),
    ]

    history1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE1_EPOCHS,
        callbacks=callbacks_p1,
        class_weight=class_weight,
        verbose=1,
    )

    # ------------------------------------------------------------------
    # 4. Phase 2: unfreeze last 20 layers and fine-tune
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print(f"[STEP 4] Phase 2 fine-tuning ({PHASE2_EPOCHS} epochs, LR={PHASE2_LR})...")
    print("=" * 60)

    base_model = None
    for layer in model.layers:
        if isinstance(layer, tf.keras.Model) and "efficientnetv2" in layer.name.lower():
            base_model = layer
            break

    if base_model is None:
        print("[WARN] Could not locate base EfficientNetV2 submodel — "
              "unfreezing last 20 layers of the full model.")
        for layer in model.layers[-FINE_TUNE_LAYERS:]:
            layer.trainable = True
    else:
        base_model.trainable = True
        for layer in base_model.layers[:-FINE_TUNE_LAYERS]:
            layer.trainable = False

    print(f"[INFO] Trainable layers after unfreeze: "
          f"{sum(1 for l in model.layers if l.trainable)} / {len(model.layers)}")

    model.compile(
        optimizer=Adam(learning_rate=PHASE2_LR),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    final_ckpt = str(MODELS_DIR / MODEL_FILENAME)
    callbacks_p2 = [
        EarlyStopping(monitor="val_loss", patience=7, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7, verbose=1),
        ModelCheckpoint(final_ckpt, monitor="val_loss", save_best_only=True, verbose=1),
    ]

    history2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=PHASE2_EPOCHS,
        callbacks=callbacks_p2,
        class_weight=class_weight,
        verbose=1,
    )

    # Merge histories for plotting
    full_history = {"loss": [], "val_loss": [], "accuracy": [], "val_accuracy": []}
    for h in [history1, history2]:
        for k in full_history:
            if k in h.history:
                full_history[k].extend(h.history[k])

    class _HistoryAdapter:
        def __init__(self, hist):
            self.history = hist
    plot_training_curves(_HistoryAdapter(full_history), RESULTS_DIR / "uterine_training_curves.png")

    # ------------------------------------------------------------------
    # 5. Evaluate on test set
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[STEP 5] Evaluating on test set...")
    print("=" * 60)

    y_prob = model.predict(test_ds, verbose=1)
    y_pred = np.argmax(y_prob, axis=1)
    y_true = test_lbls

    metrics = compute_metrics(y_true, y_pred, y_prob)
    print("\n[UTERINE CANCER METRICS — EfficientNetV2B1]")
    for k, v in metrics.items():
        print(f"  {k:15s}: {v:.4f}")

    with open(RESULTS_DIR / "uterine_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[INFO] Saved metrics to {RESULTS_DIR / 'uterine_metrics.json'}")

    plot_roc_curve(y_true, y_prob, RESULTS_DIR / "uterine_roc_curve.png")
    plot_confusion_matrix(y_true, y_pred, RESULTS_DIR / "uterine_confusion_matrix.png")

    # ------------------------------------------------------------------
    # 6. Build the combined model comparison file
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[STEP 6] Building model comparison JSON...")
    print("=" * 60)

    blood_metrics_path = RESULTS_DIR / "blood_metrics.json"
    if blood_metrics_path.exists():
        with open(blood_metrics_path, "r") as f:
            blood_metrics = json.load(f)
        print(f"[INFO] Loaded existing blood metrics: {blood_metrics_path}")
    else:
        print("[WARN] blood_metrics.json not found — "
              "using placeholder values for the comparison file.")
        blood_metrics = {
            "accuracy": None, "sensitivity": None, "specificity": None,
            "precision": None, "f1_score": None, "auc_roc": None,
        }

    create_model_comparison(
        blood_metrics, metrics,
        RESULTS_DIR / "model_comparison.json",
    )

    print("\n[INFO] Done. Best model saved to:", final_ckpt)


if __name__ == "__main__":
    main()