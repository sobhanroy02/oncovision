"""
Uterine / Endometrial Cancer training script using YOLOv11-cls (Ultralytics)
on the PathMNIST histopathology dataset.

Same training strategy as train_yolo_blood.py:
    - YOLO-format dataset assembled from PathMNIST
    - Fine-tune yolo11n-cls for N epochs
    - Save best checkpoint, metrics JSON, training curves, confusion matrix
    - Output metrics in the canonical format for 3-way comparison

Outputs:
    - backend/models/yolo11n_uterine_cancer.pt
    - backend/results/yolo_uterine_metrics.json
    - backend/results/yolo_uterine_training_curves.png
    - backend/results/yolo_uterine_confusion_matrix.png

Author: Geeky Blinders (AIML Sem 7)
"""

import json
import os
import shutil
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from preprocessing.preprocess_uterine import (  # noqa: E402
    CLASS_NAMES,
    PATHMNIST_TUMOR_LABEL,
)


# Configuration
MODELS_DIR = BACKEND_DIR / "models"
RESULTS_DIR = BACKEND_DIR / "results"
YOLO_DATA_DIR = BACKEND_DIR.parent / "data" / "yolo_uterine"
MODEL_FILENAME = "yolo11n_uterine_cancer.pt"

FAST_DEV_MODE = os.getenv("FAST_DEV_MODE", "0") == "1"
EPOCHS = int(os.getenv("YOLO_UTERINE_EPOCHS", "2" if FAST_DEV_MODE else "25"))
IMG_SIZE_YOLO = 224
BATCH_SIZE = 32
SEED = 42
MAX_TRAIN_SAMPLES = int(os.getenv("YOLO_UTERINE_MAX_TRAIN_SAMPLES", "2000" if FAST_DEV_MODE else "0"))
MAX_VAL_SAMPLES = int(os.getenv("YOLO_UTERINE_MAX_VAL_SAMPLES", "500" if FAST_DEV_MODE else "0"))


def build_yolo_dataset_from_pathmnist(yolo_dir: Path) -> None:
    """
    Load PathMNIST splits and write YOLO-format train/val folders.

    YOLO expects:
        yolo_dir/train/<class_name>/*.png
        yolo_dir/val/<class_name>/*.png
    """
    from medmnist import PathMNIST
    from PIL import Image

    if yolo_dir.exists():
        shutil.rmtree(yolo_dir)
    for split in ["train", "val"]:
        for cls in CLASS_NAMES:
            (yolo_dir / split / cls).mkdir(parents=True, exist_ok=True)

    print("[INFO] Loading PathMNIST (this downloads ~3 GB on first run)...")
    for split in ["train", "val"]:
        ds = PathMNIST(split=split, download=True, size=28)
        images = ds.imgs                  # (N, 28, 28, 3) uint8
        labels = ds.labels.squeeze().astype(np.int32)
        binary = np.where(labels == PATHMNIST_TUMOR_LABEL, 0, 1)  # 0=tumor, 1=normal
        if split == "train" and MAX_TRAIN_SAMPLES > 0:
            images = images[:MAX_TRAIN_SAMPLES]
            binary = binary[:MAX_TRAIN_SAMPLES]
        if split == "val" and MAX_VAL_SAMPLES > 0:
            images = images[:MAX_VAL_SAMPLES]
            binary = binary[:MAX_VAL_SAMPLES]
        print(f"  {split}: {len(images)} images — tumor={int((binary == 0).sum())}, "
              f"normal={int((binary == 1).sum())}")
        for i, (img, lab) in enumerate(zip(images, binary)):
            cls = CLASS_NAMES[lab]
            out = yolo_dir / split / cls / f"{split}_{i:06d}.png"
            Image.fromarray(img).save(out)


def train_yolo():
    """Fine-tune YOLOv11n-cls on the uterine dataset."""
    from ultralytics import YOLO

    print("\n" + "=" * 60)
    print("[STEP 1] Building YOLO-format dataset from PathMNIST...")
    print("=" * 60)
    build_yolo_dataset_from_pathmnist(YOLO_DATA_DIR)

    print("\n" + "=" * 60)
    print("[STEP 2] Loading YOLOv11n-cls...")
    print("=" * 60)
    model = YOLO("yolo11n-cls.pt")

    print("\n" + "=" * 60)
    print(f"[STEP 3] Training for {EPOCHS} epochs...")
    print("=" * 60)
    results = model.train(
        data=str(YOLO_DATA_DIR),
        epochs=EPOCHS,
        imgsz=IMG_SIZE_YOLO,
        batch=BATCH_SIZE,
        project=str(RESULTS_DIR / "yolo_runs"),
        name="uterine",
        seed=SEED,
        patience=7,
        save=True,
        plots=True,
        verbose=True,
    )

    best_ckpt = Path(results.save_dir) / "weights" / "best.pt"
    final_dst = MODELS_DIR / MODEL_FILENAME
    if best_ckpt.exists():
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(best_ckpt, final_dst)
        print(f"[INFO] Best model saved to {final_dst}")
    else:
        print(f"[WARN] Could not find {best_ckpt}")
        return None, None

    return model, str(final_dst)


def evaluate_yolo(model) -> dict:
    """Predict on every val image and return canonical metrics."""
    print("\n" + "=" * 60)
    print("[STEP 4] Evaluating on the val split...")
    print("=" * 60)

    val_root = YOLO_DATA_DIR / "val"
    y_true, y_pred, y_prob = [], [], []
    for class_idx, cls in enumerate(CLASS_NAMES):
        cls_dir = val_root / cls
        if not cls_dir.exists():
            continue
        for img_path in sorted(cls_dir.iterdir()):
            if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".tif"}:
                continue
            pred = model.predict(str(img_path), imgsz=IMG_SIZE_YOLO, verbose=False)[0]
            probs = pred.probs.data.cpu().numpy()
            y_true.append(class_idx)
            y_pred.append(int(np.argmax(probs)))
            # prob of "normal" (class 1) for AUC
            y_prob.append(float(probs[1]))

    if not y_true:
        return {k: None for k in
                ["accuracy", "sensitivity", "specificity", "precision", "f1_score", "auc_roc"]}

    y_true = np.array(y_true); y_pred = np.array(y_pred); y_prob = np.array(y_prob)
    return {
        "accuracy":    float(accuracy_score(y_true, y_pred)),
        "sensitivity": float(recall_score(y_true, y_pred, pos_label=0, zero_division=0)),
        "specificity": float(recall_score(y_true, y_pred, pos_label=1, zero_division=0)),
        "precision":   float(precision_score(y_true, y_pred, zero_division=0)),
        "f1_score":    float(f1_score(y_true, y_pred, zero_division=0)),
        "auc_roc":     float(roc_auc_score(y_true, y_prob)) if len(set(y_true)) > 1 else float("nan"),
    }


def save_confusion_matrix(y_true, y_pred, output_path: Path) -> None:
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Oranges",
                xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
                cbar=False, linewidths=1, linecolor="black",
                annot_kws={"size": 16, "weight": "bold"})
    plt.xlabel("Predicted"); plt.ylabel("True")
    plt.title("YOLOv11 Uterine Cancer — Confusion Matrix", fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved confusion matrix to {output_path}")


def save_training_curves(yolo_run_dir: Path, output_path: Path) -> None:
    src = yolo_run_dir / "results.png"
    if src.exists():
        shutil.copy2(src, output_path)
        print(f"[INFO] Copied training curves to {output_path}")
        return
    print(f"[WARN] No results.png in {yolo_run_dir}")


def main() -> None:
    np.random.seed(SEED)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    model, saved_path = train_yolo()
    if model is None:
        return

    yolo_run_dir = Path(model.trainer.save_dir) if hasattr(model, "trainer") else \
                   (RESULTS_DIR / "yolo_runs" / "uterine")
    metrics = evaluate_yolo(model)
    print("\n[YOLOv11 UTERINE METRICS]")
    for k, v in metrics.items():
        print(f"  {k:15s}: {v}")

    with open(RESULTS_DIR / "yolo_uterine_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    save_training_curves(yolo_run_dir, RESULTS_DIR / "yolo_uterine_training_curves.png")

    val_root = YOLO_DATA_DIR / "val"
    if val_root.exists():
        y_true, y_pred = [], []
        for class_idx, cls in enumerate(CLASS_NAMES):
            cls_dir = val_root / cls
            if not cls_dir.exists():
                continue
            for img_path in sorted(cls_dir.iterdir()):
                if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".tif"}:
                    continue
                pred = model.predict(str(img_path), imgsz=IMG_SIZE_YOLO, verbose=False)[0]
                y_true.append(class_idx)
                y_pred.append(int(np.argmax(pred.probs.data.cpu().numpy())))
        if y_true:
            save_confusion_matrix(y_true, y_pred, RESULTS_DIR / "yolo_uterine_confusion_matrix.png")

    print(f"\n[INFO] Done. Model saved to: {saved_path}")


if __name__ == "__main__":
    main()