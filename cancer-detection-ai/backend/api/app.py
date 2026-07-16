"""
Flask REST API for the AI Cancer Detection System.

Endpoints:
    GET  /api/health          -> Health check + model status
    POST /api/predict         -> Upload an image + get a prediction
    GET  /api/model-info      -> Performance metrics for both models
    GET  /api/sample-images   -> List of available sample test images

The CORS middleware is enabled so the React frontend (port 3000) can
freely call this API (port 5000).

Author: Geeky Blinders (AIML Sem 7)
"""

import json
import os
import sys
import traceback
import threading
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

# Make sibling modules importable
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from api.inference import CancerDetector  # noqa: E402
from api.sample_manager import (  # noqa: E402
    SAMPLES_DIR as _SAMPLES_DIR,
    ALLOWED_EXTS as _ALLOWED_EXTS,
    list_samples as _list_samples,
)
from api.biomarker_analyser import analyze_health_profile  # noqa: E402



# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------

APP_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = APP_ROOT.parent
RESULTS_DIR = BACKEND_DIR / "results"
DATA_DIR = BACKEND_DIR.parent / "data"
SAMPLES_DIR = _SAMPLES_DIR  # use the path from sample_manager
MODEL_COMPARISON_PATH = RESULTS_DIR / "model_comparison.json"

ALLOWED_IMAGE_EXTS = _ALLOWED_EXTS
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
CORS(app)  # Allow the React frontend at localhost:3000 to call this API

detector = CancerDetector()
model_load_status = {
    "blood_loaded": False,
    "uterine_loaded": False,
    "yolo_blood_loaded": False,
    "yolo_uterine_loaded": False,
    "mock_mode": True,
    "loading": True,
    "error": None,
}


def _load_models_in_background() -> None:
    """Load the detector models without blocking server startup."""
    global model_load_status
    try:
        print("[INFO] Starting background model initialization...")
        status = detector.load_models()
        model_load_status = {**status, "loading": False, "error": None}
        print(f"[INFO] Model load status: {status}")
    except Exception as exc:
        model_load_status = {
            "blood_loaded": False,
            "uterine_loaded": False,
            "yolo_blood_loaded": False,
            "yolo_uterine_loaded": False,
            "mock_mode": True,
            "loading": False,
            "error": str(exc),
        }
        print(f"[ERROR] Background model initialization failed: {exc}")
        traceback.print_exc()


print("[INFO] Starting Flask app — launching model initialization in background...")
threading.Thread(target=_load_models_in_background, daemon=True).start()


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def _is_allowed_image(filename: str) -> bool:
    """Check if the filename has an allowed image extension."""
    return Path(filename).suffix.lower() in ALLOWED_IMAGE_EXTS


def _load_model_comparison() -> dict:
    """Load the model_comparison.json file with graceful fallback."""
    if MODEL_COMPARISON_PATH.exists():
        try:
            with open(MODEL_COMPARISON_PATH, "r") as f:
                return json.load(f)
        except Exception as exc:
            print(f"[WARN] Failed to read {MODEL_COMPARISON_PATH}: {exc}")
    # Fallback: report unknown metrics
    return {
        "models": [
            {
                "name": "EfficientNetV2B0 (Blood Cancer)",
                "cancer_type": "blood",
                "architecture": "EfficientNetV2B0",
                "framework": "Keras / TensorFlow",
                "metrics": {"accuracy": None, "sensitivity": None,
                            "specificity": None, "precision": None,
                            "f1_score": None, "auc_roc": None},
            },
            {
                "name": "EfficientNetV2B1 (Uterine Cancer)",
                "cancer_type": "uterine",
                "architecture": "EfficientNetV2B1",
                "framework": "Keras / TensorFlow",
                "metrics": {"accuracy": None, "sensitivity": None,
                            "specificity": None, "precision": None,
                            "f1_score": None, "auc_roc": None},
            },
            {
                "name": "YOLOv11-cls (Blood Cancer)",
                "cancer_type": "blood",
                "architecture": "YOLOv11n-cls",
                "framework": "Ultralytics / PyTorch",
                "metrics": {"accuracy": None, "sensitivity": None,
                            "specificity": None, "precision": None,
                            "f1_score": None, "auc_roc": None},
            },
            {
                "name": "YOLOv11-cls (Uterine Cancer)",
                "cancer_type": "uterine",
                "architecture": "YOLOv11n-cls",
                "framework": "Ultralytics / PyTorch",
                "metrics": {"accuracy": None, "sensitivity": None,
                            "specificity": None, "precision": None,
                            "f1_score": None, "auc_roc": None},
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
        "_note": "model_comparison.json not yet generated — run the training scripts.",
    }


# ----------------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint used by the frontend connection indicator."""
    return jsonify({
        "status": "ok",
        "models_loaded": not model_load_status.get("loading", False) and not model_load_status.get("mock_mode", True),
        "blood_model_loaded": model_load_status.get("blood_loaded", False),
        "uterine_model_loaded": model_load_status.get("uterine_loaded", False),
        "mock_mode": model_load_status.get("mock_mode", True),
        "loading": model_load_status.get("loading", False),
        "error": model_load_status.get("error"),
    })


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Run prediction on an uploaded image.

    Expects multipart/form-data with:
        - image: the image file
        - cancer_type: 'blood' or 'uterine'
    """
    try:
        # Validate inputs
        if "image" not in request.files:
            return jsonify({"error": "No image file provided. "
                                     "Expected field name 'image'."}), 400

        image_file = request.files["image"]
        if image_file.filename == "":
            return jsonify({"error": "Empty filename."}), 400
        if not _is_allowed_image(image_file.filename):
            return jsonify({
                "error": f"Unsupported file type. Allowed: {sorted(ALLOWED_IMAGE_EXTS)}",
            }), 400

        cancer_type = request.form.get("cancer_type", "").strip().lower()
        if cancer_type not in ("blood", "uterine"):
            return jsonify({
                "error": "Invalid cancer_type. Expected 'blood' or 'uterine'.",
            }), 400

        # Read image bytes
        image_bytes = image_file.read()
        if len(image_bytes) == 0:
            return jsonify({"error": "Image file is empty."}), 400
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            return jsonify({"error": "Image exceeds 10 MB size limit."}), 413

        # Run prediction
        result = detector.predict(image_bytes, cancer_type)
        return jsonify(result), 200

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        print(f"[ERROR] /api/predict failed: {exc}")
        traceback.print_exc()
        return jsonify({"error": "Internal server error during prediction.",
                        "details": str(exc)}), 500


@app.route("/api/model-info", methods=["GET"])
def model_info():
    """Return the saved model performance metrics for both models."""
    return jsonify(_load_model_comparison()), 200


@app.route("/api/sample-images", methods=["GET"])
def sample_images():
    """
    Return a list of sample images available for testing, grouped by
    cancer type. Delegates to api.sample_manager.
    """
    return jsonify(_list_samples()), 200


@app.route("/api/sample-image/<cancer_type>/<filename>", methods=["GET"])
def sample_image(cancer_type: str, filename: str):
    """
    Serve a specific sample image file. Used by the React frontend
    when the user picks a sample.
    """
    if cancer_type not in ("blood", "uterine"):
        return jsonify({"error": "Invalid cancer_type."}), 400
    if not _is_allowed_image(filename):
        return jsonify({"error": "Invalid file type."}), 400

    img_path = SAMPLES_DIR / filename
    if not img_path.exists() or not img_path.is_file():
        return jsonify({"error": "Sample image not found."}), 404

    return send_file(str(img_path), mimetype="image/jpeg")


@app.route("/", methods=["GET"])
def index():
    """A simple index page so the API has a friendly root."""
    return jsonify({
        "name": "AI Cancer Detection API",
        "version": "1.0.0",
        "endpoints": [
            "/api/health",
            "/api/predict",
            "/api/model-info",
            "/api/sample-images",
            "/api/analyze-biomarkers",
            "/api/chat",
        ],
    }), 200


@app.route("/api/analyze-biomarkers", methods=["POST"])
def analyze_biomarkers_route():
    """
    Endpoint for multi-parameter health & cancer risk analysis.
    Expects vital parameters and blood biomarkers synced from the simulated IoT device.
    """
    try:
        data = request.get_json() or {}
        analysis_result = analyze_health_profile(data)
        return jsonify(analysis_result), 200
    except Exception as exc:
        print(f"[ERROR] /api/analyze-biomarkers failed: {exc}")
        return jsonify({"error": "Failed to run biomarker analysis.", "details": str(exc)}), 500


def get_chatbot_reply(msg: str) -> str:
    msg_lower = msg.lower()
    
    # 1. Leukemia / Blood Cancer
    if any(k in msg_lower for k in ["leukemia", "leukaemia", "blood cancer", "all", "lymphoblastic"]):
        return (
            "### 🩸 Leukemia Screening & Detection\n\n"
            "Our system detects **Acute Lymphoblastic Leukemia (ALL)**, a fast-growing cancer of the white blood cells. We use two complementary approaches:\n\n"
            "1. **Imaging Model (EfficientNetV2B0):** Classifies blood smear microscopy images to detect abnormal lymphoblasts (cancer cells) with high accuracy, overlaying a **Grad-CAM heatmap** to show visual focus points.\n"
            "2. **IoT Blood Panel Screening:** Analyzes key Complete Blood Count (CBC) markers:\n"
            "   - **White Blood Cell (WBC) Count:** High levels (>11.0, and especially >20.0 x10^9/L) indicate infection or hematologic stress like Leukemia.\n"
            "   - **Hemoglobin (Hb):** Low levels (<11.5 g/dL) indicate anemia, common in Leukemia patients.\n"
            "   - **Platelets:** Low levels (<140 x10^9/L) indicate thrombocytopenia, indicating bone marrow suppression.\n\n"
            "*Note: A definitive Leukemia diagnosis always requires a physician's review of a peripheral blood smear and a bone marrow biopsy.*"
        )
        
    # 2. Uterine Cancer
    if any(k in msg_lower for k in ["uterine", "endometrial", "histopathology", "uterine cancer"]):
        return (
            "### 🔬 Uterine (Endometrial) Cancer screening\n\n"
            "Uterine cancer is screened in this system using **histopathology tissue slide imaging**:\n\n"
            "- **Imaging Model (EfficientNetV2B1):** Analyzes tissue cell patterns to classify biopsies as normal or cancerous.\n"
            "- **Biomarker Screening (CA-125):** The system integrates **Cancer Antigen 125 (CA-125)**, a glycoprotein biomarker. Elevated levels (>35 U/mL) can occur in uterine and ovarian cancers, but can also be caused by benign conditions like endometriosis or pelvic inflammation.\n\n"
            "If histopathology or biomarkers flag potential anomalies, standard clinical diagnostic protocols include transvaginal ultrasound and endometrial biopsy."
        )

    # 3. Tumor Markers
    if any(k in msg_lower for k in ["tumor marker", "biomarker", "antigen", "cea", "ca-125", "ca125", "psa"]):
        return (
            "### 🧪 Cancer Biomarkers & Tumor Antigens\n\n"
            "Tumor markers are substances (often proteins) produced by cancer cells or by the body in response to cancer. Our system screens three key biomarkers:\n\n"
            "1. **CEA (Carcinoembryonic Antigen):**\n"
            "   - **Normal Range:** < 2.5 ng/mL\n"
            "   - **Indication:** Elevated levels are commonly monitored for colorectal, lung, breast, or pancreatic cancers.\n"
            "2. **CA-125 (Cancer Antigen 125):**\n"
            "   - **Normal Range:** < 35 U/mL\n"
            "   - **Indication:** Elevated in ovarian and uterine cancers, as well as benign inflammatory pelvic conditions.\n"
            "3. **PSA (Prostate-Specific Antigen):**\n"
            "   - **Normal Range:** < 4.0 ng/mL\n"
            "   - **Indication:** Screening marker for prostate cancer and benign prostatic hyperplasia (BPH).\n\n"
            "**Important:** Elevated markers do *not* automatically mean cancer is present. They serve as secondary screening flags to guide clinicians."
        )

    # 4. CBC / Vitals
    if any(k in msg_lower for k in ["cbc", "wbc", "platelets", "platelet", "hemoglobin", "vitals", "pulse", "spo2", "blood pressure", "temp", "glucose"]):
        return (
            "### 📊 Vitals & Complete Blood Count (CBC) Ranges\n\n"
            "Monitoring vitals and blood parameters provides a baseline for daily health assessment:\n\n"
            "- **Temperature:** Normal range: **36.1°C – 37.5°C**. Elevated values point to fever or potential infection-induced inflammation.\n"
            "- **SpO2 (Oxygen Saturation):** Normal: **95% – 100%**. Values below 95% indicate mild hypoxemia, which could affect overall tissue healing.\n"
            "- **Heart Rate:** Normal: **60 – 100 bpm**. Under-performing or over-performing heart rates indicate physiological stress.\n"
            "- **Blood Pressure:** Normal: **90/60 to 120/80 mmHg**.\n"
            "- **WBC (White Blood Cells):** Normal: **4.0 – 11.0 x10^9/L**.\n"
            "- **Hemoglobin:** Normal: **12.0 – 17.5 g/dL**.\n"
            "- **Platelets:** Normal: **150 – 450 x10^9/L**.\n"
            "- **Glucose:** Normal: **70 – 140 mg/dL** (fasting/non-fasting range).\n\n"
            "Daily logs that persistently drift outside these zones should be evaluated by a healthcare professional."
        )

    # 5. Explainability / Grad-CAM / SHAP
    if any(k in msg_lower for k in ["grad-cam", "gradcam", "shap", "explain", "interpret", "heatmap", "feature"]):
        return (
            "### 🧠 Explainable AI (XAI) in Medical Diagnostics\n\n"
            "To make AI predictions trustworthy for doctors, this project implements two explainability methods:\n\n"
            "1. **Grad-CAM (Gradient-Weighted Class Activation Mapping):**\n"
            "   - Used on **medical images** (blood smears and histopathology slides).\n"
            "   - Generates a **visual heat map** overlaying the image, highlighting the exact cellular patterns and structures that influenced the CNN model's decision.\n"
            "2. **SHAP (SHapley Additive exPlanations) & Feature Contribution:**\n"
            "   - Used on **numerical reports** synced from the simulated IoT hardware device.\n"
            "   - Calculates how much each individual parameter (like SpO2, WBC count, or CEA level) pushed the general health score up or down, showing you a transparent percentage contribution chart."
        )

    # 6. IoT Hardware Integration
    if any(k in msg_lower for k in ["iot", "hardware", "wearable", "device", "sync", "simulate", "sensor"]):
        return (
            "### 📡 IoT Hardware Sync System\n\n"
            "This project features a **simulated IoT Health Device Integration** designed to demonstrate clinical data acquisition:\n\n"
            "- **Device Simulation:** Simulates a wearable health patch or bedside biosensor that pairs via Bluetooth (BLE) to scan patient vitals (temperature, pulse, SpO2, blood pressure) and microfluidic blood biomarkers.\n"
            "- **Phasing Data:** Telemetry is transmitted in a standard JSON format to the backend REST API.\n"
            "- **Diagnostic Loop:** Once received, the backend runs the multi-parameter risk engine to generate an immediate, explainable risk assessment report, matching standard clinical triage workflows."
        )

    # 7. Cancer Prevention & Guidelines
    if any(k in msg_lower for k in ["prevent", "guidelines", "reduce risk", "diet", "lifestyle", "health tips"]):
        return (
            "### 🍏 Cancer Prevention & Health Guidelines\n\n"
            "While early screening is vital, maintaining healthy habits can reduce the risk of cancer:\n\n"
            "1. **Avoid Tobacco:** Tobacco use is linked to multiple cancers, including lung, throat, and kidney cancers.\n"
            "2. **Healthy Diet:** Focus on fiber-rich whole grains, fresh vegetables, and fruits. Limit processed meats and excessive sugar.\n"
            "3. **Physical Activity:** Aim for at least 150 minutes of moderate aerobic exercise per week.\n"
            "4. **Sun Protection:** Use sunscreen (SPF 30+) and avoid peak midday UV rays to prevent melanoma.\n"
            "5. **Regular Screening:** Routine CBC blood tests, Pap smears, colonoscopies, or mammograms detect precancerous changes early when treatment is most effective.\n\n"
            "*Consult with your general physician to set up a personalized screening schedule based on family medical history.*"
        )

    # Default general greeting response
    return (
        "Hello! I am **BlinderCare AI**, your clinical assistant for this project.\n\n"
        "I can answer your questions about:\n"
        "- 🩸 **Leukemia screening** and the blood microscopy CNN (EfficientNetV2B0)\n"
        "- 🔬 **Uterine Cancer histopathology** and the classification CNN (EfficientNetV2B1)\n"
        "- 🧪 **Tumor biomarkers** (CEA, CA-125, PSA) and Complete Blood Count (CBC) ranges\n"
        "- 🧠 **Explainable AI** features (Grad-CAM overlays and SHAP feature impacts)\n"
        "- 📡 **IoT Hardware simulation** and daily sync data streams\n\n"
        "Feel free to ask a question (e.g., *'How does CEA work?'* or *'What is Grad-CAM?'*)."
    )


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    AI Health Assistant Chatbot endpoint.
    Expects JSON: { "message": str, "history": list }
    Returns JSON: { "reply": str }
    """
    try:
        data = request.get_json() or {}
        user_msg = data.get("message", "").strip()
        
        if not user_msg:
            return jsonify({"error": "Message is required."}), 400
            
        reply = get_chatbot_reply(user_msg)
        return jsonify({"reply": reply}), 200
    except Exception as exc:
        print(f"[ERROR] Chatbot error: {exc}")
        return jsonify({"error": "Failed to generate chatbot reply."}), 500



# ----------------------------------------------------------------------------
# Error handlers
# ----------------------------------------------------------------------------

@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def method_not_allowed(_e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(413)
def payload_too_large(_e):
    return jsonify({"error": "Upload exceeds the 10 MB limit."}), 413


@app.errorhandler(500)
def server_error(_e):
    return jsonify({"error": "Internal server error."}), 500


@app.errorhandler(Exception)
def handle_unhandled_exception(exc):
    """
    Last-resort handler for any uncaught exception.

    Logs the full traceback server-side, returns a generic 500 JSON to
    the client (never leaks internal details). This guarantees the
    frontend always gets a valid JSON response.
    """
    print(f"[ERROR] Unhandled exception: {exc}")
    traceback.print_exc()
    return jsonify({
        "error": "An unexpected error occurred. Please try again.",
        "type": type(exc).__name__,
    }), 500


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print(" AI Cancer Detection API")
    print(" Listening on http://localhost:5000")
    print("=" * 60)
    print(" Endpoints:")
    print("   GET  /api/health")
    print("   POST /api/predict")
    print("   GET  /api/model-info")
    print("   GET  /api/sample-images")
    print("=" * 60 + "\n")
    app.run(debug=False, use_reloader=False, port=5000, host="0.0.0.0")