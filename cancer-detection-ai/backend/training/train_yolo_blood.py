"""
Blood Cancer (ALL) training script using YOLOv11-cls (Ultralytics).

YOLOv11-cls is the latest classification-focused variant of the YOLO family.
It uses an efficient backbone (C2PSA + attention) and is pretrained on
ImageNet, making it an excellent transfer-learning target for medical
imaging — frequently matching or exceeding heavier CNNs at a fraction of
the parameters.

We convert the C-NMC 2019 blood-smear directory layout into the format
YOLOv11 expects:
    data/yolo_blood/
    ├── train/
    │   ├── all/   (cancerous lymphoblasts)
    │   └── hem/   (normal)
    └── val/
        ├── all/
        └── hem/

Then we fine-tune yolo11n-cls (nano — fast) for N epochs, save the best
checkpoint, and write a metrics JSON in the SAME shape that the existing
ResNet50 / DenseNet121 scripts use so the 3-way comparison is trivial.

Outputs:
    - backend/models/yolo11n_blood_cancer.pt
    - backend/results/yolo_blood_metrics.json
    - backend/results/yolo_blood_training_curves.png
    - backend/results/yolo_blood_confusion_matrix.png
    - backend/results/yolo_blood_results.csv       (per-epoch)

Author: Geeky Blinders (AIML Sem 7)
"""

import csv
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

from preprocessing.preprocess_blood import (  # noqa: E402
    CLASS_NAMES,
    IMG_SIZE,
    create_split,
)


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

DATA_DIR = BACKEND_DIR.parent / "data" / "raw" / "blood"
YOLO_DATA_DIR = BACKEND_DIR.parent / "data" / "yolo_blood"
MODELS_DIR = BACKEND_DIR / "models"
RESULTS_DIR = BACKEND_DIR / "results"
MODEL_FILENAME = "yolo11n_blood_cancer.pt"

EPOCHS = 30
IMG_SIZE_YOLO = 224     # YOLOv11 default
BATCH_SIZE = 32
SEED = 42
TRAIN_RATIO = 0.85      # YOLOv11 wants its own train/val split (no test)
FAST_DEV_MODE = os.getenv("FAST_DEV_MODE", "0") == "1"
EPOCHS = int(os.getenv("YOLO_BLOOD_EPOCHS", "2" if FAST_DEV_MODE else "30"))
MAX_IMAGES_PER_CLASS = int(os.getenv("YOLO_BLOOD_MAX_IMAGES_PER_CLASS", "200" if FAST_DEV_MODE else "0"))


# ----------------------------------------------------------------------------
# Step 1: convert C-NMC layout to YOLO train/val layout
# ----------------------------------------------------------------------------

def build_yolo_dataset(data_dir: Path, yolo_dir: Path, train_ratio: float = 0.85) -> None:
    """
    Copy / symlink images from data/raw/blood/{all,hem}/ into a YOLO-style
    layout under data/yolo_blood/{train,val}/{class}/.

    Uses a stratified split so the class balance is preserved.
    """
    from sklearn.model_selection import train_test_split

    if yolo_dir.exists():
        print(f"[INFO] Removing existing YOLO dataset dir: {yolo_dir}")
        shutil.rmtree(yolo_dir)

    for split in ["train", "val"]:
        for cls in CLASS_NAMES:
            (yolo_dir / split / cls).mkdir(parents=True, exist_ok=True)

    rng_seed = SEED
    for cls in CLASS_NAMES:
        cls_dir = data_dir / cls
        if not cls_dir.exists():
            print(f"[WARN] {cls_dir} not found — skipping {cls}")
            continue
        files = sorted(p for p in cls_dir.iterdir()
                       if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".tif"})
        if MAX_IMAGES_PER_CLASS > 0:
            files = files[:MAX_IMAGES_PER_CLASS]
        train_f, val_f = train_test_split(files, train_size=train_ratio, random_state=rng_seed)
        for src in train_f:
            shutil.copy2(src, yolo_dir / "train" / cls / src.name)
        for src in val_f:
            shutil.copy2(src, yolo_dir / "val" / cls / src.name)
        print(f"  {cls}: {len(train_f)} train, {len(val_f)} val")


# ----------------------------------------------------------------------------
# Step 2: train
# ----------------------------------------------------------------------------

def train_yolo():
    """Fine-tune YOLOv11n-cls on the blood cancer dataset."""
    from ultralytics import YOLO

    print("\n" + "=" * 60)
    print("[STEP 1] Building YOLO-format dataset from C-NMC layout...")
    print("=" * 60)
    build_yolo_dataset(DATA_DIR, YOLO_DATA_DIR, train_ratio=TRAIN_RATIO)

    print("\n" + "=" * 60)
    print("[STEP 2] Loading YOLOv11n-cls pretrained on ImageNet...")
    print("=" * 60)
    model = YOLO("yolo11n-cls.pt")  # auto-downloads ~5 MB

    print("\n" + "=" * 60)
    print(f"[STEP 3] Training for {EPOCHS} epochs (img={IMG_SIZE_YOLO}, batch={BATCH_SIZE})...")
    print("=" * 60)

    results = model.train(
        data=str(YOLO_DATA_DIR),
        epochs=EPOCHS,
        imgsz=IMG_SIZE_YOLO,
        batch=BATCH_SIZE,
        project=str(RESULTS_DIR / "yolo_runs"),
        name="blood",
        seed=SEED,
        patience=7,            # early stopping
        save=True,
        plots=True,
        verbose=True,
    )

    # Best checkpoint is at: results.save_dir / 'weights' / 'best.pt'
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


# ----------------------------------------------------------------------------
# Step 3: evaluate on the val split
# ----------------------------------------------------------------------------

def evaluate_yolo(model, yolo_data_dir: Path) -> dict:
    """Run model.val() and return a metrics dict in the canonical format."""
    print("\n" + "=" * 60)
    print("[STEP 4] Evaluating on the val split...")
    print("=" * 60)

    metrics = model.val(
        data=str(yolo_data_dir),
        imgsz=IMG_SIZE_YOLO,
        batch=BATCH_SIZE,
        plots=True,
        save_json=True,
        verbose=True,
    )

    # Try to extract test-image paths + predictions to compute sklearn metrics
    val_root = yolo_data_dir / "val"
    y_true, y_pred, y_prob = [], [], []
    if val_root.exists():
        # Walk val/<class>/<file> and predict each
        for class_idx, cls in enumerate(CLASS_NAMES):
            cls_dir = val_root / cls
            if not cls_dir.exists():
                continue
            for img_path in sorted(cls_dir.iterdir()):
                if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".bmp", ".tif"}:
                    continue
                pred = model.predict(str(img_path), imgsz=IMG_SIZE_YOLO, verbose=False)[0]
                probs = pred.probs.data.cpu().numpy()
                pred_class = int(np.argmax(probs))
                y_true.append(class_idx)
                y_pred.append(pred_class)
                y_prob.append(float(probs[1]))  # prob of "hem" (normal/negative class)

    if not y_true:
        print("[WARN] No validation images found — using Ultralytics' top-1 accuracy")
        top1 = float(getattr(metrics, "top1", 0.0)) / 100.0
        return {
            "accuracy":    top1,
            "sensitivity": None,
            "specificity": None,
            "precision":   None,
            "f1_score":    None,
            "auc_roc":     None,
        }

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    y_prob = np.array(y_prob)

    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    sens = recall_score(y_true, y_pred, pos_label=0, zero_division=0)  # recall of "all" (cancer)
    spec = recall_score(y_true, y_pred, pos_label=1, zero_division=0)  # recall of "hem" (normal)
    try:
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        auc = float("nan")

    return {
        "accuracy":    float(acc),
        "sensitivity": float(sens),
        "specificity": float(spec),
        "precision":   float(prec),
        "f1_score":    float(f1),
        "auc_roc":     float(auc),
    }


# ----------------------------------------------------------------------------
# Step 4: save plots and metrics
# ----------------------------------------------------------------------------

def save_training_curves(yolo_run_dir: Path, output_path: Path) -> None:
    """
    YOLO already produces a results.png in the run folder — copy it.
    Fallback: render a simple matplotlib chart from results.csv.
    """
    src = yolo_run_dir / "results.png"
    if src.exists():
        shutil.copy2(src, output_path)
        print(f"[INFO] Copied training curves to {output_path}")
        return

    csv_path = yolo_run_dir / "results.csv"
    if not csv_path.exists():
        print(f"[WARN] No results.csv or results.png in {yolo_run_dir}")
        return

    with open(csv_path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        if not rows:
            return
        keys = list(rows[0].keys())

    # Strip leading spaces from column names (YOLO quirk)
    epochs = [int(float(r[keys[0]])) for r in rows]
    # Loss curves
    train_loss = [float(r.get("      train/loss", r.get("train/loss", 0))) for r in rows]
    val_loss   = [float(r.get("        val/loss", r.get("val/loss", 0)))   for r in rows]
    train_acc  = [float(r.get("  metrics/accuracy_top1", r.get("train/accuracy", 0))) for r in rows]
    val_acc    = [float(r.get("  metrics/accuracy_top1", r.get("val/accuracy", 0)))   for r in rows]

    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].plot(epochs, train_loss, label="Train")
    axes[0].plot(epochs, val_loss,   label="Val")
    axes[0].set_title("YOLOv11 Blood — Loss")
    axes[0].set_xlabel("Epoch"); axes[0].set_ylabel("Loss")
    axes[0].legend(); axes[0].grid(alpha=0.3)

    axes[1].plot(epochs, train_acc, label="Train")
    axes[1].plot(epochs, val_acc,   label="Val")
    axes[1].set_title("YOLOv11 Blood — Accuracy")
    axes[1].set_xlabel("Epoch"); axes[1].set_ylabel("Accuracy")
    axes[1].legend(); axes[1].grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved custom training curves to {output_path}")


def save_confusion_matrix(y_true, y_pred, output_path: Path) -> None:
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Oranges",
        xticklabels=CLASS_NAMES, yticklabels=CLASS_NAMES,
        cbar=False, linewidths=1, linecolor="black",
        annot_kws={"size": 16, "weight": "bold"},
    )
    plt.xlabel("Predicted"); plt.ylabel("True")
    plt.title("YOLOv11 Blood Cancer — Confusion Matrix", fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved confusion matrix to {output_path}")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main() -> None:
    np.random.seed(SEED)

    if not DATA_DIR.exists():
        print(f"[ERROR] Data directory not found: {DATA_DIR}")
        print("        Download C-NMC 2019 and place it at data/raw/blood/{all,hem}/")
        return

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Train
    model, saved_path = train_yolo()
    if model is None:
        return

    # Find the actual run directory YOLOv11 used
    yolo_run_dir = Path(model.trainer.save_dir) if hasattr(model, "trainer") else \
                   (RESULTS_DIR / "yolo_runs" / "blood")

    # Evaluate
    metrics = evaluate_yolo(model, YOLO_DATA_DIR)
    print("\n[YOLOv11 BLOOD METRICS]")
    for k, v in metrics.items():
        print(f"  {k:15s}: {v}")

    # Save metrics JSON
    with open(RESULTS_DIR / "yolo_blood_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # Save training curves
    save_training_curves(yolo_run_dir, RESULTS_DIR / "yolo_blood_training_curves.png")

    # Save confusion matrix from the sklearn eval
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
            save_confusion_matrix(y_true, y_pred, RESULTS_DIR / "yolo_blood_confusion_matrix.png")

    print(f"\n[INFO] Done. Model saved to: {saved_path}")


if __name__ == "__main__":
    main()