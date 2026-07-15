"""
Dataset info utility — prints class distributions and plots class-balance
bar charts for both the blood (C-NMC) and uterine (PathMNIST) datasets.

Usage:
    python dataset_info.py

Outputs:
    - Prints class counts to stdout
    - Saves a side-by-side bar chart to backend/results/class_distribution.png

Author: Geeky Blinders (AIML Sem 7)
"""

import os
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt

# Use absolute paths derived from this file's location
BACKEND_DIR = Path(__file__).resolve().parents[1]
RESULTS_DIR = BACKEND_DIR / "results"
DATA_DIR = BACKEND_DIR.parent / "data"


def _resolve_blood_class_dir(class_name: str) -> Path:
    """Return the first blood class directory that exists."""
    candidates = [
        DATA_DIR / "raw" / "blood" / "train" / class_name,
        DATA_DIR / "raw" / "blood" / class_name,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _print_blood_distribution() -> dict:
    """
    Scan data/raw/blood/all/ and data/raw/blood/hem/ and count files.

    Returns:
        Dict of class -> count. Returns empty dict if the data is missing.
    """
    print("\n" + "=" * 60)
    print("BLOOD CANCER (Acute Lymphoblastic Leukaemia) — C-NMC 2019")
    print("=" * 60)

    counts = {}
    for class_name in ["all", "hem"]:
        class_dir = _resolve_blood_class_dir(class_name)
        if not class_dir.exists():
            print(f"  [WARN] Directory not found: {class_dir}")
            print(f"         -> Skipping {class_name} class")
            counts[class_name] = 0
            continue

        if class_dir.parent.name == "train":
            print(f"  Using expected Kaggle layout: data/raw/blood/train/{class_name}")
        else:
            print(f"  Using simplified local layout: {class_dir}")

        n = len([
            f for f in os.listdir(class_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".tif"))
        ])
        counts[class_name] = n
        print(f"  Class '{class_name}': {n} images")

    total = sum(counts.values())
    if total > 0:
        print(f"  TOTAL: {total} images")
        for cls, n in counts.items():
            print(f"    {cls}: {100.0 * n / total:.1f}%")
    else:
        print("  [INFO] No data found at data/raw/blood/. "
              "Download C-NMC 2019 from Kaggle to populate this directory.")

    return counts


def _print_uterine_distribution() -> dict:
    """
    Try to load PathMNIST (already-downloaded) and report class distribution
    collapsed into the binary tumor-vs-normal task.

    Returns:
        Dict of class -> count, or empty dict if medmnist/data is unavailable.
    """
    print("\n" + "=" * 60)
    print("UTERINE / ENDOMETRIAL CANCER — PathMNIST")
    print("=" * 60)

    counts = {"tumor": 0, "normal": 0}

    try:
        from medmnist import PathMNIST
    except ImportError:
        print("  [WARN] medmnist not installed. Run: pip install medmnist")
        return {}

    PATHMNIST_TUMOR_LABEL = 7  # TUM class index in PathMNIST

    for split_name in ["train", "val", "test"]:
        try:
            ds = PathMNIST(split=split_name, download=False, size=28)
        except Exception as exc:
            print(f"  [WARN] Could not load split '{split_name}': {exc}")
            continue

        labels = ds.labels.squeeze().astype(np.int32)
        n_tumor = int(np.sum(labels == PATHMNIST_TUMOR_LABEL))
        n_normal = int(len(labels) - n_tumor)
        counts["tumor"] += n_tumor
        counts["normal"] += n_normal
        print(f"  Split '{split_name}': tumor={n_tumor}, normal={n_normal}")

    total = sum(counts.values())
    if total > 0:
        print(f"  TOTAL: {total} images")
        for cls, n in counts.items():
            print(f"    {cls}: {100.0 * n / total:.1f}%")
    else:
        print("  [INFO] PathMNIST not yet downloaded. "
              "Run preprocess_uterine.py once to download.")

    return counts


def _plot_distributions(blood_counts: dict, uterine_counts: dict, output_path: Path) -> None:
    """
    Save a 1x2 bar chart comparing class distributions for both datasets.

    Args:
        blood_counts: Dict mapping class name -> count.
        uterine_counts: Dict mapping class name -> count.
        output_path: Where to save the PNG.
    """
    os.makedirs(output_path.parent, exist_ok=True)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))

    # Blood
    if blood_counts and sum(blood_counts.values()) > 0:
        axes[0].bar(blood_counts.keys(), blood_counts.values(),
                    color=["#E74C3C", "#27AE60"])
        axes[0].set_title("Blood Cancer (C-NMC 2019)\nClass Distribution",
                          fontsize=12, fontweight="bold")
        axes[0].set_ylabel("Number of images")
        for i, (cls, n) in enumerate(blood_counts.items()):
            axes[0].text(i, n, str(n), ha="center", va="bottom", fontweight="bold")
    else:
        axes[0].text(0.5, 0.5, "Data not available\n(Run training pipeline to populate)",
                     ha="center", va="center", transform=axes[0].transAxes, fontsize=11)
        axes[0].set_title("Blood Cancer (C-NMC 2019)\nClass Distribution",
                          fontsize=12, fontweight="bold")

    # Uterine
    if uterine_counts and sum(uterine_counts.values()) > 0:
        axes[1].bar(uterine_counts.keys(), uterine_counts.values(),
                    color=["#E74C3C", "#27AE60"])
        axes[1].set_title("Uterine Cancer (PathMNIST)\nClass Distribution",
                          fontsize=12, fontweight="bold")
        axes[1].set_ylabel("Number of images")
        for i, (cls, n) in enumerate(uterine_counts.items()):
            axes[1].text(i, n, str(n), ha="center", va="bottom", fontweight="bold")
    else:
        axes[1].text(0.5, 0.5, "Data not available\n(Run training pipeline to populate)",
                     ha="center", va="center", transform=axes[1].transAxes, fontsize=11)
        axes[1].set_title("Uterine Cancer (PathMNIST)\nClass Distribution",
                          fontsize=12, fontweight="bold")

    plt.suptitle("Dataset Class Distribution", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(output_path, dpi=100, bbox_inches="tight")
    plt.close()
    print(f"\n[INFO] Class distribution plot saved to: {output_path}")


def main() -> None:
    """Entry point: print distributions and save plot."""
    print("\n" + "#" * 60)
    print("#  Cancer Detection AI — Dataset Information")
    print("#" * 60)

    blood_counts = _print_blood_distribution()
    uterine_counts = _print_uterine_distribution()

    output_path = RESULTS_DIR / "class_distribution.png"
    _plot_distributions(blood_counts, uterine_counts, output_path)

    print("\n[INFO] Done.")


if __name__ == "__main__":
    main()
