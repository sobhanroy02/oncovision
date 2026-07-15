"""
Full-pipeline test for the cancer detection system.

Iterates through every sample image in data/samples/, runs it through
the complete inference pipeline (preprocess -> model -> Grad-CAM),
prints the prediction + confidence + risk level, and saves the
Grad-CAM visualization to backend/results/sample_predictions/.

This is the highest-level integration test — it exercises:
    - sample_manager.list_samples()
    - CancerDetector.preprocess_image()
    - CancerDetector.predict()  (or the mock fallback)
    - Grad-CAM generation
    - File output

Usage:
    cd cancer-detection-ai/backend
    python tests/test_full_pipeline.py

Outputs:
    backend/results/sample_predictions/
        <cancer_type>_<label>_<n>_prediction.png    (side-by-side: original + Grad-CAM)
        pipeline_summary.json                       (machine-readable summary)
"""

import base64
import json
import sys
from datetime import datetime
from pathlib import Path

import cv2
import matplotlib.pyplot as plt
import numpy as np

# Make sibling modules importable regardless of cwd
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from api.inference import CancerDetector  # noqa: E402
from api.sample_manager import list_samples  # noqa: E402


RESULTS_DIR = BACKEND_DIR / "results"
OUTPUT_DIR = RESULTS_DIR / "sample_predictions"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_visualization(image_array: np.ndarray, gradcam_b64: str,
                       out_path: Path, title: str) -> None:
    """Save a side-by-side original + Grad-CAM visualization."""
    if gradcam_b64:
        gradcam_bytes = base64.b64decode(gradcam_b64)
        gradcam_arr = np.frombuffer(gradcam_bytes, dtype=np.uint8)
        gradcam_img = cv2.imdecode(gradcam_arr, cv2.IMREAD_COLOR)
        gradcam_img = cv2.cvtColor(gradcam_img, cv2.COLOR_BGR2RGB)
    else:
        gradcam_img = np.zeros_like((np.clip(image_array, 0, 1) * 255).astype(np.uint8))

    fig, axes = plt.subplots(1, 2, figsize=(10, 5))
    axes[0].imshow(np.clip(image_array, 0, 1))
    axes[0].set_title("Original", fontsize=11)
    axes[0].axis("off")

    axes[1].imshow(gradcam_img)
    axes[1].set_title("Grad-CAM", fontsize=11)
    axes[1].axis("off")

    plt.suptitle(title, fontsize=12, fontweight="bold")
    plt.tight_layout()
    plt.savefig(str(out_path), dpi=100, bbox_inches="tight")
    plt.close()


def main() -> int:
    """Run the full pipeline test and return exit code."""
    print("=" * 70)
    print(" FULL PIPELINE TEST")
    print(f" Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # ------------------------------------------------------------------
    # 1. Initialize detector
    # ------------------------------------------------------------------
    print("\n[1] Initializing CancerDetector...")
    detector = CancerDetector()
    status = detector.load_models()
    print(f"    Blood model loaded:   {status['blood_loaded']}")
    print(f"    Uterine model loaded: {status['uterine_loaded']}")
    if not status["blood_loaded"] and not status["uterine_loaded"]:
        print("    [INFO] Running in mock mode (no trained models found).")

    # ------------------------------------------------------------------
    # 2. List sample images
    # ------------------------------------------------------------------
    print("\n[2] Loading sample images from data/samples/...")
    manifest = list_samples()
    samples = manifest.get("samples", {})
    blood_samples = samples.get("blood", [])
    uterine_samples = samples.get("uterine", [])

    if not blood_samples and not uterine_samples:
        print("[ERROR] No sample images found.")
        print(f"        Run: py backend/scripts/generate_sample_images.py")
        return 1

    print(f"    Blood:   {len(blood_samples)} sample(s)")
    print(f"    Uterine: {len(uterine_samples)} sample(s)")

    # ------------------------------------------------------------------
    # 3. Run prediction on every sample
    # ------------------------------------------------------------------
    print("\n[3] Running prediction on each sample...")
    summary = []

    for ctype, sample_list in [("blood", blood_samples), ("uterine", uterine_samples)]:
        print(f"\n  --- {ctype.upper()} samples ---")
        for s in sample_list:
            filename = s["filename"]
            label = s["label"]
            print(f"  -> {filename} (expected: {label})", end=" ... ")

            # Read the sample image bytes
            sample_path = BACKEND_DIR.parent / "data" / "samples" / filename
            with open(sample_path, "rb") as f:
                image_bytes = f.read()

            # Predict
            try:
                result = detector.predict(image_bytes, ctype)
            except Exception as exc:
                print(f"FAILED: {exc}")
                summary.append({
                    "filename": filename,
                    "cancer_type": ctype,
                    "expected_label": label,
                    "error": str(exc),
                })
                continue

            # Print one-line summary
            print(
                f"pred={result['prediction']:20s} | "
                f"conf={result['confidence']:5.1f}% | "
                f"risk={result['risk_level']:6s} | "
                f"mock={result['mock']}"
            )

            # Save Grad-CAM visualization
            # Re-load the preprocessed image for plotting
            img_batch = detector.preprocess_image(image_bytes, ctype)
            img_for_plot = img_batch[0]
            out_path = OUTPUT_DIR / f"{ctype}_{label}_{filename.replace('.jpg', '')}_prediction.png"
            save_visualization(
                img_for_plot,
                result.get("gradcam_image", ""),
                out_path,
                title=f"{ctype.upper()} {label.upper()} — "
                      f"{result['prediction']} ({result['confidence']:.1f}%)",
            )

            summary.append({
                "filename": filename,
                "cancer_type": ctype,
                "expected_label": label,
                "prediction": result["prediction"],
                "confidence": result["confidence"],
                "risk_level": result["risk_level"],
                "class_probabilities": result["class_probabilities"],
                "gradcam_saved_to": str(out_path),
                "mock": result["mock"],
            })

    # ------------------------------------------------------------------
    # 4. Save JSON summary
    # ------------------------------------------------------------------
    summary_path = OUTPUT_DIR / "pipeline_summary.json"
    with open(summary_path, "w") as f:
        json.dump({
            "run_timestamp": datetime.now().isoformat(),
            "total_samples": len(summary),
            "models_loaded": {
                "blood": detector.blood_model is not None,
                "uterine": detector.uterine_model is not None,
            },
            "results": summary,
        }, f, indent=2)

    print("\n" + "=" * 70)
    print(f" PIPELINE COMPLETE")
    print(f"   Samples processed: {len(summary)}")
    print(f"   Grad-CAM saved to: {OUTPUT_DIR}")
    print(f"   Summary JSON:      {summary_path}")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())