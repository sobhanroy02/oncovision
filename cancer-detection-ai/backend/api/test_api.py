"""
Test script for the Flask REST API.

Sends a series of requests to each endpoint and prints the responses.
Useful for verifying that the API is working after changes.

Usage:
    cd backend
    python api/test_api.py

The script assumes the Flask server is running on http://localhost:5000.
Start it in a separate terminal with:
    cd backend
    python api/app.py
"""

import io
import sys
from pathlib import Path

import numpy as np
import cv2

try:
    import requests
except ImportError:
    print("[ERROR] The 'requests' library is required for this test script.")
    print("        Install it with: pip install requests")
    sys.exit(1)


BASE_URL = "http://localhost:5000"


def make_fake_image_bytes(size: tuple = (224, 224)) -> bytes:
    """
    Create a small in-memory PNG to use as the uploaded image.

    Args:
        size: (width, height) of the fake image.

    Returns:
        Raw PNG bytes.
    """
    img = np.random.randint(0, 255, (size[1], size[0], 3), dtype=np.uint8)
    success, buf = cv2.imencode(".png", cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    if not success:
        raise RuntimeError("Failed to encode fake image.")
    return buf.tobytes()


def print_section(title: str) -> None:
    """Pretty-print a section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_health() -> dict:
    """GET /api/health"""
    print_section("GET /api/health")
    try:
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        print(f"Status: {r.status_code}")
        print(f"Body:   {r.json()}")
        return r.json()
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return {}


def test_model_info() -> dict:
    """GET /api/model-info"""
    print_section("GET /api/model-info")
    try:
        r = requests.get(f"{BASE_URL}/api/model-info", timeout=10)
        print(f"Status: {r.status_code}")
        data = r.json()
        if "models" in data:
            for m in data["models"]:
                print(f"  - {m.get('name')}: accuracy={m.get('metrics', {}).get('accuracy')}")
        else:
            print(f"Body: {data}")
        return data
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return {}


def test_sample_images() -> dict:
    """GET /api/sample-images"""
    print_section("GET /api/sample-images")
    try:
        r = requests.get(f"{BASE_URL}/api/sample-images", timeout=10)
        print(f"Status: {r.status_code}")
        data = r.json()
        if "samples" in data:
            for ctype, items in data["samples"].items():
                print(f"  - {ctype}: {len(items)} sample(s)")
                for item in items:
                    print(f"      {item['filename']} ({item['label']})")
        else:
            print(f"Body: {data}")
        return data
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return {}


def test_predict_blood() -> dict:
    """POST /api/predict with cancer_type=blood"""
    print_section("POST /api/predict (cancer_type=blood)")
    fake_bytes = make_fake_image_bytes()

    try:
        files = {"image": ("test.png", io.BytesIO(fake_bytes), "image/png")}
        data = {"cancer_type": "blood"}
        r = requests.post(f"{BASE_URL}/api/predict", files=files, data=data, timeout=60)
        print(f"Status: {r.status_code}")
        body = r.json()
        print(f"  prediction:        {body.get('prediction')}")
        print(f"  confidence:        {body.get('confidence')}%")
        print(f"  cancer_type:       {body.get('cancer_type')}")
        print(f"  risk_level:        {body.get('risk_level')}")
        print(f"  class_probs:       {body.get('class_probabilities')}")
        print(f"  gradcam_image:     {len(body.get('gradcam_image', ''))} chars (base64)")
        print(f"  mock:              {body.get('mock')}")
        return body
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return {}


def test_predict_uterine() -> dict:
    """POST /api/predict with cancer_type=uterine"""
    print_section("POST /api/predict (cancer_type=uterine)")
    fake_bytes = make_fake_image_bytes()

    try:
        files = {"image": ("test.png", io.BytesIO(fake_bytes), "image/png")}
        data = {"cancer_type": "uterine"}
        r = requests.post(f"{BASE_URL}/api/predict", files=files, data=data, timeout=60)
        print(f"Status: {r.status_code}")
        body = r.json()
        print(f"  prediction:        {body.get('prediction')}")
        print(f"  confidence:        {body.get('confidence')}%")
        print(f"  cancer_type:       {body.get('cancer_type')}")
        print(f"  risk_level:        {body.get('risk_level')}")
        print(f"  class_probs:       {body.get('class_probabilities')}")
        print(f"  gradcam_image:     {len(body.get('gradcam_image', ''))} chars (base64)")
        print(f"  mock:              {body.get('mock')}")
        return body
    except Exception as exc:
        print(f"[ERROR] {exc}")
        return {}


def test_predict_invalid_cancer_type() -> None:
    """POST /api/predict with bad cancer_type — should return 400."""
    print_section("POST /api/predict (INVALID cancer_type — should 400)")
    fake_bytes = make_fake_image_bytes()
    try:
        files = {"image": ("test.png", io.BytesIO(fake_bytes), "image/png")}
        data = {"cancer_type": "brain"}
        r = requests.post(f"{BASE_URL}/api/predict", files=files, data=data, timeout=10)
        print(f"Status: {r.status_code} (expected 400)")
        print(f"Body:   {r.json()}")
    except Exception as exc:
        print(f"[ERROR] {exc}")


def test_predict_missing_image() -> None:
    """POST /api/predict with no image — should return 400."""
    print_section("POST /api/predict (MISSING image — should 400)")
    try:
        data = {"cancer_type": "blood"}
        r = requests.post(f"{BASE_URL}/api/predict", data=data, timeout=10)
        print(f"Status: {r.status_code} (expected 400)")
        print(f"Body:   {r.json()}")
    except Exception as exc:
        print(f"[ERROR] {exc}")


def main() -> None:
    """Run all tests in sequence."""
    print("\n" + "#" * 60)
    print("#  Flask API test suite")
    print("#  Base URL: " + BASE_URL)
    print("#" * 60)

    # First confirm the server is reachable
    try:
        r = requests.get(BASE_URL, timeout=5)
        print(f"\n[OK] Server reachable at {BASE_URL} (status {r.status_code})")
    except Exception as exc:
        print(f"\n[ERROR] Could not reach {BASE_URL}: {exc}")
        print("        Start the server first: cd backend && python api/app.py")
        sys.exit(1)

    test_health()
    test_model_info()
    test_sample_images()
    test_predict_blood()
    test_predict_uterine()
    test_predict_invalid_cancer_type()
    test_predict_missing_image()

    print("\n" + "=" * 60)
    print("  All tests done.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()