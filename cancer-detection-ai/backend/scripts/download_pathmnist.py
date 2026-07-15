from pathlib import Path
from medmnist import PathMNIST
from PIL import Image
import csv

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / "data" / "raw" / "pathmnist"
OUT.mkdir(parents=True, exist_ok=True)

PATHMNIST_TUMOR_LABEL = 7

for split in ["train", "val", "test"]:
    print(f"[INFO] Loading PathMNIST split='{split}' (this may download files)...")
    ds = PathMNIST(split=split, download=True, size=224)
    images = ds.images  # uint8
    labels = ds.labels.squeeze().astype(int)

    split_dir = OUT / split
    split_dir.mkdir(parents=True, exist_ok=True)

    manifest = []
    for i, img in enumerate(images):
        label = "tumor" if labels[i] == PATHMNIST_TUMOR_LABEL else "normal"
        class_dir = split_dir / label
        class_dir.mkdir(parents=True, exist_ok=True)
        fname = f"{split}_{i:05d}.png"
        Image.fromarray(img).save(class_dir / fname)
        manifest.append((f"{label}/{fname}", label))

    with open(split_dir / "manifest.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["filename", "label"])
        writer.writerows(manifest)

    print(f"[INFO] Saved {len(images)} images to {split_dir}")

print("[INFO] PathMNIST download and export complete.")
