"""
Sample image manager for the cancer detection system.

Responsible for:
    - Listing all sample images in data/samples/
    - Grouping them by cancer_type and label (positive/negative)
    - Serving them to the frontend via the /api/sample-images endpoint
    - Encoding them as base64 (for direct embedding if needed)

Filename convention used by the app:
    blood_cancer_positive_N.jpg
    blood_cancer_negative_N.jpg
    uterine_cancer_positive_N.jpg
    uterine_cancer_negative_N.jpg

Author: Geeky Blinders (AIML Sem 7)
"""

import base64
import os
from pathlib import Path
from typing import List, Dict, Optional

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BACKEND_DIR.parent / "data"
SAMPLES_DIR = DATA_DIR / "samples"

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def _detect_cancer_type(filename: str) -> Optional[str]:
    """
    Detect cancer_type from the filename prefix.

    Returns 'blood' / 'uterine' / None.
    """
    name = filename.lower()
    if name.startswith("blood"):
        return "blood"
    if name.startswith("uterine"):
        return "uterine"
    return None


def _detect_label(filename: str) -> str:
    """
    Detect ground-truth label from the filename.

    Returns 'positive' / 'negative' / 'unknown'.
    """
    name = filename.lower()
    if "positive" in name:
        return "positive"
    if "negative" in name:
        return "negative"
    return "unknown"


def _build_url(cancer_type: str, filename: str) -> str:
    """Build the URL the frontend uses to fetch the image."""
    return f"/api/sample-image/{cancer_type}/{filename}"


def list_samples() -> Dict:
    """
    Scan data/samples/ and return a structured manifest of all images.

    Returns:
        Dict of the form:
            {
              "samples": {
                "blood":   [ {filename, url, size_bytes, cancer_type, label, ...}, ... ],
                "uterine": [ ... ]
              },
              "total_count": int,
              "_note": str  (only if directory is missing/empty)
            }
    """
    result: Dict = {
        "samples": {"blood": [], "uterine": []},
        "total_count": 0,
    }

    if not SAMPLES_DIR.exists():
        result["_note"] = (
            f"Sample directory does not exist: {SAMPLES_DIR}. "
            f"Run backend/scripts/generate_sample_images.py to create samples."
        )
        return result

    image_paths = sorted(
        p for p in SAMPLES_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in ALLOWED_EXTS
    )

    if not image_paths:
        result["_note"] = f"No sample images found in {SAMPLES_DIR}."
        return result

    for img_path in image_paths:
        ctype = _detect_cancer_type(img_path.name)
        if ctype is None:
            # Skip files that don't match the naming convention
            continue

        result["samples"][ctype].append({
            "filename": img_path.name,
            "url": _build_url(ctype, img_path.name),
            "size_bytes": img_path.stat().st_size,
            "cancer_type": ctype,
            "label": _detect_label(img_path.name),
        })

    result["total_count"] = sum(len(v) for v in result["samples"].values())
    return result


def get_sample_paths(cancer_type: Optional[str] = None) -> List[Path]:
    """
    Return a list of sample image Paths, optionally filtered by cancer_type.

    Args:
        cancer_type: 'blood' / 'uterine' / None (all).

    Returns:
        Sorted list of pathlib.Path objects.
    """
    if not SAMPLES_DIR.exists():
        return []

    all_paths = sorted(
        p for p in SAMPLES_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in ALLOWED_EXTS
    )
    if cancer_type is None:
        return all_paths
    return [p for p in all_paths if _detect_cancer_type(p.name) == cancer_type]


def image_to_base64(path: Path) -> str:
    """
    Read an image file and return its contents as a base64-encoded string.

    Useful for embedding samples directly in JSON responses if a
    frontend can't reach the static file server.
    """
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def samples_as_base64(cancer_type: Optional[str] = None) -> List[Dict]:
    """
    Return a list of sample image dicts, each augmented with the
    base64-encoded image data inline.

    Useful for offline frontend demos or when the /api/sample-image
    route can't be used.
    """
    out: List[Dict] = []
    for path in get_sample_paths(cancer_type):
        ctype = _detect_cancer_type(path.name)
        out.append({
            "filename": path.name,
            "cancer_type": ctype,
            "label": _detect_label(path.name),
            "size_bytes": path.stat().st_size,
            "url": _build_url(ctype, path.name) if ctype else None,
            "data_base64": image_to_base64(path),
        })
    return out


# ----------------------------------------------------------------------------
# Manual smoke test
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    """Run as a script to print the sample manifest."""
    import json
    manifest = list_samples()
    print(json.dumps(manifest, indent=2))