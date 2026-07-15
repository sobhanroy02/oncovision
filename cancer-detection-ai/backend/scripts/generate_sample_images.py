"""
Generate synthetic sample medical images for the cancer detection demo.

Since real C-NMC / PathMNIST images require dataset download, this script
creates 6 realistic-looking synthetic images that:
    - Have the correct file naming convention for the app
    - Match the expected 224x224 RGB shape
    - Have plausible color / texture patterns (round cell-like blobs for
      blood, patchy texture for histopathology)
    - Work as test inputs for the inference pipeline

Usage:
    python scripts/generate_sample_images.py

Outputs:
    data/samples/
    ├── blood_cancer_positive_1.jpg
    ├── blood_cancer_positive_2.jpg
    ├── blood_cancer_negative_1.jpg
    ├── uterine_cancer_positive_1.jpg
    ├── uterine_cancer_positive_2.jpg
    └── uterine_cancer_negative_1.jpg
"""

import os
import sys
from pathlib import Path

import cv2
import numpy as np


# Sample image specs
SAMPLES = [
    # (filename, cancer_type, label, generator_func)
    ("blood_cancer_positive_1.jpg",   "blood",   "positive", "generate_blood_positive"),
    ("blood_cancer_positive_2.jpg",   "blood",   "positive", "generate_blood_positive"),
    ("blood_cancer_negative_1.jpg",   "blood",   "negative", "generate_blood_negative"),
    ("uterine_cancer_positive_1.jpg", "uterine", "positive", "generate_uterine_positive"),
    ("uterine_cancer_positive_2.jpg", "uterine", "positive", "generate_uterine_positive"),
    ("uterine_cancer_negative_1.jpg", "uterine", "negative", "generate_uterine_negative"),
]


def _add_gaussian_blob(img, center, sigma, color, alpha=0.7):
    """Add a smooth Gaussian-colored blob to the image (used for cells)."""
    h, w = img.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    cy, cx = center
    r2 = (yy - cy) ** 2 + (xx - cx) ** 2
    blob = np.exp(-r2 / (2 * sigma * sigma))
    blob = blob[..., None]
    for c in range(3):
        img[..., c] = (1 - alpha * blob[..., 0]) * img[..., c] + alpha * blob[..., 0] * color[c]
    return img


def generate_blood_positive(size: tuple = (224, 224)) -> np.ndarray:
    """
    Synthetic image resembling a blood smear with cancerous lymphoblasts.
    - Pale pinkish background (plasma/stain)
    - A few large, dark purple cell-like blobs (lymphoblasts)
    """
    img = np.zeros((size[1], size[0], 3), dtype=np.float32)
    # Pinkish plasma background with a slight noise texture
    img[:] = (210, 200, 215)
    img += np.random.normal(0, 12, img.shape)
    img = np.clip(img, 0, 255).astype(np.float32)

    # 4-5 large dark purple lymphoblasts
    rng = np.random.default_rng()
    for _ in range(rng.integers(4, 6)):
        cy = int(rng.integers(40, size[1] - 40))
        cx = int(rng.integers(40, size[0] - 40))
        _add_gaussian_blob(img, (cy, cx), sigma=22, color=(85, 50, 130), alpha=0.85)
        # Nucleus (darker inner)
        _add_gaussian_blob(img, (cy, cx), sigma=10, color=(40, 20, 70), alpha=0.7)

    return np.clip(img, 0, 255).astype(np.uint8)


def generate_blood_negative(size: tuple = (224, 224)) -> np.ndarray:
    """
    Synthetic image resembling a normal blood smear.
    - Pinkish background
    - Small light cells (mature RBCs / WBCs)
    - No large dark lymphoblasts
    """
    img = np.zeros((size[1], size[0], 3), dtype=np.float32)
    img[:] = (220, 200, 210)
    img += np.random.normal(0, 8, img.shape)
    img = np.clip(img, 0, 255).astype(np.float32)

    rng = np.random.default_rng()
    # Many small pale RBCs
    for _ in range(rng.integers(20, 30)):
        cy = int(rng.integers(10, size[1] - 10))
        cx = int(rng.integers(10, size[0] - 10))
        _add_gaussian_blob(img, (cy, cx), sigma=8, color=(180, 150, 160), alpha=0.5)

    return np.clip(img, 0, 255).astype(np.uint8)


def generate_uterine_positive(size: tuple = (224, 224)) -> np.ndarray:
    """
    Synthetic histopathology image of tumor tissue.
    - Pink/purple H&E-like palette
    - Dense, irregular cellular pattern (high nucleus density)
    """
    h, w = size[1], size[0]
    img = np.zeros((h, w, 3), dtype=np.float32)
    # Pink H&E background
    img[:] = (200, 180, 190)
    # Add dense, dark purple nuclei (tumor)
    rng = np.random.default_rng()
    n_nuclei = 250
    ys = rng.integers(0, h, n_nuclei)
    xs = rng.integers(0, w, n_nuclei)
    for y, x in zip(ys, xs):
        cv2.circle(img, (int(x), int(y)), 3, (60, 30, 90), -1)
    # Light texture noise
    img += np.random.normal(0, 8, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


def generate_uterine_negative(size: tuple = (224, 224)) -> np.ndarray:
    """
    Synthetic histopathology image of normal tissue.
    - Lighter pink H&E palette
    - Sparse, well-spaced nuclei
    """
    h, w = size[1], size[0]
    img = np.zeros((h, w, 3), dtype=np.float32)
    # Lighter pink background
    img[:] = (225, 210, 215)
    # Few, evenly-spaced nuclei
    rng = np.random.default_rng()
    n_nuclei = 50
    ys = rng.integers(0, h, n_nuclei)
    xs = rng.integers(0, w, n_nuclei)
    for y, x in zip(ys, xs):
        cv2.circle(img, (int(x), int(y)), 2, (90, 50, 110), -1)
    img += np.random.normal(0, 6, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)


GENERATORS = {
    "generate_blood_positive":   generate_blood_positive,
    "generate_blood_negative":   generate_blood_negative,
    "generate_uterine_positive": generate_uterine_positive,
    "generate_uterine_negative": generate_uterine_negative,
}


def main() -> None:
    """Generate all 6 sample images and save them to data/samples/."""
    # Resolve output dir relative to this file
    here = Path(__file__).resolve()
    project_root = here.parents[2]  # cancer-detection-ai/
    samples_dir = project_root / "data" / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] Output directory: {samples_dir}")

    for filename, ctype, label, gen_name in SAMPLES:
        out_path = samples_dir / filename
        gen_func = GENERATORS[gen_name]
        # Use a stable seed per file so re-runs are identical
        seed = abs(hash(filename)) % (2 ** 32)
        np.random.seed(seed)
        img = gen_func()
        success = cv2.imwrite(str(out_path), img)
        if success:
            size_kb = out_path.stat().st_size / 1024
            print(f"  [OK] {filename:40s} ({ctype:7s} {label:8s})  {size_kb:.1f} KB")
        else:
            print(f"  [ERR] Failed to write {out_path}")

    print(f"\n[INFO] Done. {len(SAMPLES)} sample images written to {samples_dir}")


if __name__ == "__main__":
    main()