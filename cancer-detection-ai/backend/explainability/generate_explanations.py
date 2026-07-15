"""
Generate Grad-CAM and SHAP explanations for both cancer detection models.

Loads:
    - backend/models/efficientnetv2b0_blood_cancer.h5
    - backend/models/efficientnetv2b1_uterine_cancer.h5

For each model:
    - Selects 10 test images (5 positive, 5 negative)
    - Generates Grad-CAM heatmaps
    - Generates SHAP values
    - Saves outputs to results/gradcam/ and results/shap/

Finally builds a 2xN summary grid at results/explainability_summary.png.

Author: Geeky Blinders (AIML Sem 7)
"""

import os
import sys
from pathlib import Path

import cv2
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf

try:
    import shap
except ImportError:
    shap = None

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from explainability.gradcam import (  # noqa: E402
    GradCAM,
    resolve_last_conv_layer_name,
)
from explainability.shap_explainer import CancerSHAPExplainer, SHAP_AVAILABLE  # noqa: E402


MODELS_DIR = BACKEND_DIR / "models"
RESULTS_DIR = BACKEND_DIR / "results"
GRADCAM_DIR = RESULTS_DIR / "gradcam"
SHAP_DIR = RESULTS_DIR / "shap"
SAMPLES_DIR = BACKEND_DIR.parent / "data" / "samples"
BLOOD_SPLIT_CSV = BACKEND_DIR.parent / "data" / "splits" / "blood_split.csv"

N_PER_CLASS = 5  # 5 positive + 5 negative = 10 per cancer type


# ----------------------------------------------------------------------------
# Load models
# ----------------------------------------------------------------------------

def load_models() -> dict:
    """
    Load the trained blood and uterine cancer models.

    Returns:
        Dict with keys 'blood' and 'uterine', each a Keras model.
        If a model file is missing, returns None for that key.
    """
    models = {}

    blood_path = MODELS_DIR / "efficientnetv2b0_blood_cancer.h5"
    if not blood_path.exists():
        blood_path = MODELS_DIR / "resnet50_blood_cancer.h5"
    if blood_path.exists():
        print(f"[INFO] Loading blood model: {blood_path}")
        models["blood"] = tf.keras.models.load_model(str(blood_path))
    else:
        print(f"[WARN] Blood model not found at {blood_path}")

    uterine_path = MODELS_DIR / "efficientnetv2b1_uterine_cancer.h5"
    if not uterine_path.exists():
        uterine_path = MODELS_DIR / "densenet121_uterine_cancer.h5"
    if uterine_path.exists():
        print(f"[INFO] Loading uterine model: {uterine_path}")
        models["uterine"] = tf.keras.models.load_model(str(uterine_path))
    else:
        print(f"[WARN] Uterine model not found at {uterine_path}")

    return models


# ----------------------------------------------------------------------------
# Sample selection
# ----------------------------------------------------------------------------

def select_blood_samples() -> dict:
    """
    Select 5 positive and 5 negative blood test images from the saved split.

    Returns:
        Dict with 'positive' and 'negative' keys, each a list of (path, label) tuples.
    """
    if not BLOOD_SPLIT_CSV.exists():
        print(f"[WARN] Blood split CSV not found: {BLOOD_SPLIT_CSV}")
        return {"positive": [], "negative": []}

    import pandas as pd
    df = pd.read_csv(BLOOD_SPLIT_CSV)
    test_df = df[df["split"] == "test"]

    # 0 = all (cancer / positive), 1 = hem (normal / negative)
    pos_df = test_df[test_df["label"] == 0].head(N_PER_CLASS)
    neg_df = test_df[test_df["label"] == 1].head(N_PER_CLASS)

    return {
        "positive": list(zip(pos_df["filepath"].tolist(), pos_df["label"].tolist())),
        "negative": list(zip(neg_df["filepath"].tolist(), neg_df["label"].tolist())),
    }


def select_uterine_samples(models, n: int = N_PER_CLASS) -> dict:
    """
    Select 5 positive and 5 negative uterine test images from PathMNIST.

    Returns:
        Dict with 'positive' and 'negative' keys, each a list of (image_array, label) tuples.
    """
    if "uterine" not in models:
        return {"positive": [], "negative": []}

    from medmnist import PathMNIST
    print("[INFO] Loading PathMNIST test split to select samples...")
    ds = PathMNIST(split="test", download=False, size=28)
    images = ds.imgs.astype(np.float32) / 255.0
    labels = ds.labels.squeeze().astype(np.int32)

    # Binary: 0 = tumor (label 7), 1 = normal (everything else)
    binary_labels = np.where(labels == 7, 0, 1)

    pos_idx = np.where(binary_labels == 0)[0][:n]
    neg_idx = np.where(binary_labels == 1)[0][:n]

    selected_indices = np.concatenate([pos_idx, neg_idx])
    selected_images = tf.image.resize(images[selected_indices], (224, 224)).numpy()
    selected_labels = binary_labels[selected_indices]

    return {
        "positive": [(selected_images[i], int(selected_labels[i])) for i in range(len(pos_idx))],
        "negative": [(selected_images[len(pos_idx) + i], int(selected_labels[len(pos_idx) + i])) for i in range(len(neg_idx))],
    }


# ----------------------------------------------------------------------------
# Preprocessing helpers
# ----------------------------------------------------------------------------

def preprocess_blood_image(image_path: str) -> np.ndarray:
    """Load + CLAHE + normalize a single blood image."""
    from preprocessing.preprocess_blood import preprocess_single_image
    return preprocess_single_image(image_path)


def prepare_for_model(image: np.ndarray) -> np.ndarray:
    """Match the EfficientNetV2 preprocessing used during training."""
    from tensorflow.keras.applications.efficientnet_v2 import preprocess_input as efficientnetv2_preprocess_input
    return efficientnetv2_preprocess_input(np.array(image, dtype=np.float32) * 255.0)


# ----------------------------------------------------------------------------
# Generate Grad-CAM
# ----------------------------------------------------------------------------

def generate_gradcam_for_samples(model, samples: list, model_name: str,
                                 last_conv_layer: str, save_dir: Path) -> list:
    """
    Generate Grad-CAM for a list of (image_array, label) tuples.

    Args:
        model: Keras model.
        samples: List of (image_array, label).
        model_name: 'blood' or 'uterine' (used in filenames).
        last_conv_layer: Name of the last conv layer in the model.
        save_dir: Directory to save Grad-CAM PNGs.

    Returns:
        List of dicts: {output_path, class_index, confidence}.
    """
    os.makedirs(save_dir, exist_ok=True)
    gradcam = GradCAM(model, last_conv_layer)

    results = []
    for i, (img, label) in enumerate(samples):
        # Predict
        model_input = np.expand_dims(prepare_for_model(img), axis=0)
        preds = model.predict(model_input, verbose=0)
        pred_class = int(np.argmax(preds[0]))
        confidence = float(np.max(preds[0])) * 100.0

        # Heatmap
        heatmap = gradcam.compute_heatmap(prepare_for_model(img), class_index=pred_class)
        overlaid = GradCAM.overlay_heatmap(heatmap, img, alpha=0.4)

        # Save
        output_path = save_dir / f"{model_name}_gradcam_{i:02d}_class{pred_class}.png"
        plt.figure(figsize=(6, 3))
        plt.subplot(1, 2, 1)
        plt.imshow(np.clip(img, 0, 1))
        plt.title(f"Original (true={label})", fontsize=9)
        plt.axis("off")
        plt.subplot(1, 2, 2)
        plt.imshow(overlaid)
        plt.title(f"Grad-CAM (pred={pred_class}, {confidence:.1f}%)", fontsize=9)
        plt.axis("off")
        plt.tight_layout()
        plt.savefig(str(output_path), dpi=80, bbox_inches="tight")
        plt.close()

        results.append({
            "output_path": str(output_path),
            "class_index": pred_class,
            "true_label": int(label),
            "confidence": confidence,
        })
        print(f"  [Grad-CAM] {model_name} #{i}: pred={pred_class}, conf={confidence:.1f}%")

    return results


# ----------------------------------------------------------------------------
# Generate SHAP
# ----------------------------------------------------------------------------

def generate_shap_for_samples(model, samples: list, background: np.ndarray,
                              model_name: str, save_dir: Path) -> None:
    """
    Generate SHAP values and save summary plot for a list of (image, label) tuples.

    Args:
        model: Keras model.
        samples: List of (image_array, label).
        background: Background data of shape (B, H, W, 3) for the DeepExplainer.
        model_name: 'blood' or 'uterine'.
        save_dir: Directory to save SHAP PNGs.
    """
    if not SHAP_AVAILABLE:
        print("[WARN] shap not available — skipping SHAP generation.")
        return

    os.makedirs(save_dir, exist_ok=True)

    # Stack the sample images
    sample_imgs = np.stack([img for img, _ in samples], axis=0)
    print(f"[INFO] Generating SHAP for {model_name} "
          f"({len(sample_imgs)} samples, background={background.shape})...")

    background = np.stack([prepare_for_model(img) for img in background], axis=0)
    explainer = CancerSHAPExplainer(model, background)
    try:
        shap_values = explainer.compute_shap_values(sample_imgs)
    except Exception as exc:
        print(f"[WARN] SHAP generation failed for {model_name}: {exc}")
        output_path = save_dir / f"{model_name}_shap_unavailable.png"
        plt.figure(figsize=(8, 2.5))
        plt.axis("off")
        plt.text(0.5, 0.5, f"SHAP unavailable for {model_name}\n{exc}",
                 ha="center", va="center", wrap=True, fontsize=10)
        plt.tight_layout()
        plt.savefig(output_path, dpi=120, bbox_inches="tight")
        plt.close()
        return

    # Save summary plot (image_plot)
    output_path = save_dir / f"{model_name}_shap_summary.png"
    plt.figure(figsize=(12, 4 * len(sample_imgs)))
    shap.image_plot(shap_values, sample_imgs, show=False)
    plt.savefig(str(output_path), dpi=80, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved SHAP summary to {output_path}")

    # Also save per-sample attribution overlays (channel-reduced)
    for i, (img, label) in enumerate(samples):
        # shap_values is a list of arrays (one per class); pick class 1
        if isinstance(shap_values, list):
            sv = shap_values[1][i] if len(shap_values) > 1 else shap_values[0][i]
        else:
            sv = shap_values[i]

        per_sample_path = save_dir / f"{model_name}_shap_{i:02d}_class1.png"
        explainer.save_attribution_overlay(img, sv, str(per_sample_path), class_index=1)


# ----------------------------------------------------------------------------
# Summary grid
# ----------------------------------------------------------------------------

def build_summary_grid(gradcam_results: dict, output_path: Path,
                       n_per_row: int = 4) -> None:
    """
    Build a 2xN grid showing Grad-CAM overlays for both cancer types.

    Args:
        gradcam_results: Dict with keys 'blood' and 'uterine', each a list of
            result dicts with 'output_path'.
        output_path: Where to save the grid.
        n_per_row: How many samples per row.
    """
    os.makedirs(output_path.parent, exist_ok=True)

    blood_paths = [r["output_path"] for r in gradcam_results.get("blood", [])]
    uterine_paths = [r["output_path"] for r in gradcam_results.get("uterine", [])]

    all_paths = blood_paths + uterine_paths
    if not all_paths:
        print("[WARN] No Grad-CAM results to summarize.")
        return

    n = len(all_paths)
    rows = int(np.ceil(n / n_per_row))
    fig, axes = plt.subplots(rows, n_per_row, figsize=(4 * n_per_row, 3 * rows))
    axes = np.array(axes).reshape(rows, n_per_row)

    for i, path in enumerate(all_paths):
        r, c = divmod(i, n_per_row)
        img = cv2.imread(path)
        if img is None:
            axes[r, c].set_title(f"Missing: {Path(path).name}", fontsize=8)
            axes[r, c].axis("off")
            continue
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        axes[r, c].imshow(img)
        # Mark blood vs uterine
        is_blood = i < len(blood_paths)
        label = "BLOOD" if is_blood else "UTERINE"
        axes[r, c].set_title(f"{label} #{i}", fontsize=9, fontweight="bold")
        axes[r, c].axis("off")

    # Hide unused axes
    for j in range(n, rows * n_per_row):
        r, c = divmod(j, n_per_row)
        axes[r, c].axis("off")

    plt.suptitle("Grad-CAM Explainability Summary", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(str(output_path), dpi=100, bbox_inches="tight")
    plt.close()
    print(f"[INFO] Saved explainability summary to {output_path}")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def main() -> None:
    """Generate Grad-CAM and SHAP explanations for both models."""
    os.makedirs(GRADCAM_DIR, exist_ok=True)
    os.makedirs(SHAP_DIR, exist_ok=True)

    print("\n" + "=" * 60)
    print("[STEP 1] Loading models...")
    print("=" * 60)
    models = load_models()

    if not models:
        print("[ERROR] No models found. Train the models first using the training scripts.")
        return

    shap_jobs = {}
    # ------------------------------------------------------------------
    # BLOOD CANCER
    # ------------------------------------------------------------------
    gradcam_results = {}

    if "blood" in models:
        print("\n" + "=" * 60)
        print("[STEP 2] Blood cancer: generating Grad-CAM + SHAP...")
        print("=" * 60)

        blood_samples_dict = select_blood_samples()
        blood_samples = blood_samples_dict["positive"] + blood_samples_dict["negative"]
        blood_samples = [(preprocess_blood_image(p), int(l)) for p, l in blood_samples]
        print(f"[INFO] Selected {len(blood_samples)} blood samples.")

        # Grad-CAM
        blood_gradcam = generate_gradcam_for_samples(
            models["blood"],
            blood_samples,
            "blood",
            resolve_last_conv_layer_name(models["blood"]),
            GRADCAM_DIR,
        )
        gradcam_results["blood"] = blood_gradcam
        shap_jobs["blood"] = (models["blood"], blood_samples)

    # ------------------------------------------------------------------
    # UTERINE CANCER
    # ------------------------------------------------------------------
    if "uterine" in models:
        print("\n" + "=" * 60)
        print("[STEP 3] Uterine cancer: generating Grad-CAM + SHAP...")
        print("=" * 60)

        uterine_samples_dict = select_uterine_samples(models)
        uterine_samples = uterine_samples_dict["positive"] + uterine_samples_dict["negative"]
        print(f"[INFO] Selected {len(uterine_samples)} uterine samples.")

        # Grad-CAM
        uterine_gradcam = generate_gradcam_for_samples(
            models["uterine"],
            uterine_samples,
            "uterine",
            resolve_last_conv_layer_name(models["uterine"]),
            GRADCAM_DIR,
        )
        gradcam_results["uterine"] = uterine_gradcam
        shap_jobs["uterine"] = (models["uterine"], uterine_samples)

    # ------------------------------------------------------------------
    # Summary grid
    # ------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("[STEP 4] Building explainability summary grid...")
    print("=" * 60)
    build_summary_grid(gradcam_results, RESULTS_DIR / "explainability_summary.png")

    for model_name, (model, samples) in shap_jobs.items():
        if not samples:
            continue
        background = np.stack([img for img, _ in samples[:10]], axis=0)
        generate_shap_for_samples(
            model,
            samples,
            background,
            model_name,
            SHAP_DIR,
        )

    print("\n[INFO] Done. Outputs in:")
    print(f"  Grad-CAM: {GRADCAM_DIR}")
    print(f"  SHAP:     {SHAP_DIR}")


if __name__ == "__main__":
    main()