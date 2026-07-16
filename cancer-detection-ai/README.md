# 🔬 AI-Powered Cancer Detection & Diagnosis System

> An end-to-end deep learning system for early detection of **Acute Lymphoblastic Leukaemia (ALL)** and **Uterine (Endometrial) Cancer** using medical imaging, with explainable AI (Grad-CAM + SHAP) and a full-stack web interface.

**Team:** Geeky Blinders — Semester 7 Project I, AIML Department

---

## 🎯 Project Overview

This system uses two state-of-the-art deep learning architectures to classify medical images as cancerous or normal:

| Cancer Type | Modality | Model | Dataset |
|---|---|---|---|
| **Acute Lymphoblastic Leukaemia (ALL)** | Blood smear microscopy | EfficientNetV2B0 (ImageNet pretrained) | C-NMC 2019 |
| **Uterine / Endometrial Cancer** | Histopathology | EfficientNetV2B1 (ImageNet pretrained) | PathMNIST (medmnist) |

The system provides:
- ✅ Image classification with confidence scores
- ✅ Visual explanations via **Grad-CAM** heatmaps
- ✅ Feature attribution via **SHAP**
- ✅ Risk-level classification (High / Medium / Low)
- ✅ REST API + responsive React web interface
- ✅ Daily health report dashboard with local screening history
- ✅ Health Hub for daily vitals and blood-marker analysis
- ✅ Device Sync page for hardware-style JSON uploads
- ✅ 6 synthetic sample images for instant demo (no dataset required)

---

## 🖼️ Screenshots

> Add your own screenshots after running the app. Drop them in `docs/screenshots/` and they'll be linked below.

- **Home page** — Hero, cancer-type cards, how-it-works steps
- **Detect page** — Type selector, drag-and-drop upload, sample dropdown
- **Results** — Big prediction badge, confidence bar, Grad-CAM overlay, probability chart
- **About** — Project overview, tech stack, team

---

## 📁 Project Structure

```
cancer-detection-ai/
├── backend/
│   ├── api/                 # Flask REST API + inference engine
│   │   ├── app.py           # Flask endpoints
│   │   ├── inference.py     # CancerDetector class
│   │   ├── sample_manager.py# Sample image listing/encoding
│   │   └── test_api.py      # API integration tests
│   ├── explainability/      # Grad-CAM and SHAP
│   │   ├── gradcam.py
│   │   ├── shap_explainer.py
│   │   └── generate_explanations.py
│   ├── models/              # Trained .h5 files (not in git)
│   ├── preprocessing/       # Image preprocessing pipelines
│   │   ├── preprocess_blood.py
│   │   ├── preprocess_uterine.py
│   │   └── dataset_info.py
│   ├── results/             # Plots, metrics, Grad-CAM outputs
│   ├── scripts/             # Utility scripts
│   │   └── generate_sample_images.py
│   ├── tests/               # Full-pipeline tests
│   │   └── test_full_pipeline.py
│   └── training/            # Model training scripts
│       ├── train_blood_cancer.py
│       └── train_uterine_cancer.py
├── frontend/                # React 18 + React Router + Recharts
│   ├── public/              # index.html, manifest, favicon
│   └── src/
│       ├── components/      # Navbar, ImageUploader, ResultCard, etc.
│       ├── pages/           # Home, Detect, Dashboard, HealthHub, DeviceSync, About, HowItWorks
│       ├── services/        # api.js, reportStore.js, healthStore.js
│       ├── App.jsx          # Router setup
│       ├── index.js         # Entry point
│       └── index.css        # Global styles + CSS variables
├── data/
│   ├── samples/             # 6 sample test images (in git)
│   ├── raw/                 # Raw datasets (NOT in git)
│   └── splits/              # Train/val/test splits (NOT in git)
├── notebooks/               # Jupyter notebooks for analysis
├── requirements.txt
├── run.sh                   # Linux/macOS one-command startup
├── run.bat                  # Windows one-command startup
├── .env.example             # Frontend env template
├── .gitignore
└── README.md
```

## Roadmap

See [docs/final-year-roadmap.md](docs/final-year-roadmap.md) for the full phase-wise final-year plan.
For the exact remaining commands and artifact targets, see [docs/project-completion-checklist.md](docs/project-completion-checklist.md).

---

## 🚀 Quick Start (No Training Required)

The app works out of the box in **mock mode** — it returns realistic-looking predictions and Grad-CAM heatmaps for the 6 bundled sample images. You can demo the entire UI/UX without training a model.

### Prerequisites

- **Python 3.8+**
- **Node.js 16+ and npm**
- **Git**

### One-Command Startup

#### Linux / macOS
```bash
chmod +x run.sh
./run.sh
```

#### Windows
```cmd
run.bat
```

This script will:
1. Install Python dependencies if missing
2. Generate 6 sample images in `data/samples/` (if missing)
3. Start the Flask backend on `http://localhost:5000`
4. Install npm dependencies if missing, then start React on `http://localhost:3000`

### Manual Startup (two terminals)

**Terminal 1 — Backend:**
```bash
cd cancer-detection-ai
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python backend/scripts/generate_sample_images.py   # one-time, creates samples
cd backend
python api/app.py
```

**Terminal 2 — Frontend:**
```bash
cd cancer-detection-ai/frontend
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

---

## 📊 Dataset Download (for real training)

### Blood Cancer — C-NMC 2019

1. Go to [C-NMC 2019 on Kaggle](https://www.kaggle.com/datasets/abelrv/c-nmc-2019)
2. Download and unzip into `data/raw/blood/` with this structure:
   ```
   data/raw/blood/
   ├── train/
   │   ├── all/      # Cancerous (lymphoblasts)
   │   └── hem/      # Normal (healthy)
   └── test/
   ```
3. Run preprocessing to generate the train/val/test split:
   ```bash
   cd backend
   python preprocessing/preprocess_blood.py
   ```

### Uterine Cancer — PathMNIST (medmnist)

PathMNIST is **auto-downloaded** by `medmnist` on the first run of the preprocessing script (~3 GB):

```bash
cd backend
python preprocessing/preprocess_uterine.py
```

The data is cached in your `~/.medmnist/` folder.

### Verify datasets

```bash
cd backend
python preprocessing/dataset_info.py
```

This prints class counts and saves `backend/results/class_distribution.png`.

---

## 🏋️ Training the Models

> ⚠️ **Training is much faster on Google Colab (free GPU).**
> Upload the `backend/` folder to Colab, run the training scripts, then download the resulting `.h5` files back into `backend/models/`.

### Blood Cancer Model (EfficientNetV2B0)

```bash
cd backend
python training/train_blood_cancer.py
```

| Phase | Epochs | Learning rate | Notes |
|---|---|---|---|
| 1 (frozen base) | 10 | 1e-3 | EarlyStopping(patience=3) |
| 2 (fine-tune)  | 40 | 1e-5 | Unfreeze last 30 layers, ReduceLROnPlateau, EarlyStopping(patience=7) |

**Approximate time:**
- **GPU (Colab T4):** ~30-45 minutes
- **CPU:** 6-12 hours

**Outputs:**
- `backend/models/efficientnetv2b0_blood_cancer.h5`
- `backend/results/blood_metrics.json`
- `backend/results/blood_training_curves.png`
- `backend/results/blood_roc_curve.png`
- `backend/results/blood_confusion_matrix.png`

### Uterine Cancer Model (EfficientNetV2B1)

```bash
cd backend
python training/train_uterine_cancer.py
```

| Phase | Epochs | Learning rate | Notes |
|---|---|---|---|
| 1 (frozen base) | 10 | 1e-3 | EarlyStopping(patience=3) |
| 2 (fine-tune)  | 40 | 1e-5 | Unfreeze last 20 layers, ReduceLROnPlateau, EarlyStopping(patience=7) |

**Approximate time:** GPU ~45-60 min, CPU 8-14 hrs.

**Outputs:**
- `backend/models/efficientnetv2b1_uterine_cancer.h5`
- `backend/results/uterine_metrics.json`
- `backend/results/uterine_training_curves.png`
- `backend/results/uterine_roc_curve.png`
- `backend/results/uterine_confusion_matrix.png`
- `backend/results/model_comparison.json` ← **consumed by the frontend**

### Generating Grad-CAM + SHAP Explanations

After training:

```bash
cd backend
python explainability/generate_explanations.py
```

Outputs to `backend/results/gradcam/` and `backend/results/shap/`, plus `explainability_summary.png`.

---

## 🧪 API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Health check + model status |
| `/api/predict` | POST | Image upload + prediction (multipart/form-data) |
| `/api/model-info` | GET | Model performance metrics for both models |
| `/api/sample-images` | GET | List of available sample images |
| `/api/sample-image/<type>/<filename>` | GET | Serve a specific sample image file |

### Predict Example (curl)

```bash
curl -X POST http://localhost:5000/api/predict \
  -F "image=@data/samples/blood_cancer_positive_1.jpg" \
  -F "cancer_type=blood"
```

Response:
```json
{
  "prediction": "Cancer Detected",
  "confidence": 87.34,
  "cancer_type": "blood",
  "class_probabilities": {"cancerous": 0.8734, "normal": 0.1266},
  "risk_level": "High",
  "gradcam_image": "iVBORw0KGgo... (base64 PNG)",
  "mock": false
}
```

### Full-Pipeline Test

Run the integrated test that exercises the entire pipeline on all 6 sample images:

```bash
cd backend
python tests/test_full_pipeline.py
```

Saves per-sample Grad-CAM visualizations to `backend/results/sample_predictions/` and a JSON summary.

---

## 🌐 Frontend Configuration

Create `frontend/.env` (or copy from `.env.example`):

```bash
# Default for local development
REACT_APP_API_URL=http://localhost:5000

# For production deployment
# REACT_APP_API_URL=https://your-api-domain.com
```

If the frontend is deployed on Vercel (or any static host), you must set
`REACT_APP_API_URL` in the hosting environment variables. Otherwise prediction
calls like `/api/predict` cannot reach the Flask backend and will fail.

The Navbar shows a live **green/red status dot** indicating whether the backend is reachable. It polls `/api/health` every 15 seconds.

---

## ⚠️ Limitations & Disclaimer

**This is an AI screening tool for research and educational purposes only.** It is **NOT a substitute for professional medical diagnosis**. Limitations include:

- Models are trained on a limited subset of public datasets (C-NMC 2019 + PathMNIST).
- The system has not been validated on real hospital data or in clinical trials.
- 6 sample images are **synthetically generated** for demo purposes only — they are not from real patients.
- Predictions may be biased by the source dataset's demographics and imaging equipment.
- The Grad-CAM heatmaps highlight image regions that influenced the model, not necessarily clinically relevant features.

**Always consult a qualified medical professional for any clinical decisions.**

---

## 🔮 Future Scope

- **More cancer types:** Skin (dermatology), lung (X-ray), breast (mammography)
- **Multimodal fusion:** Combine EfficientNetV2B0 + EfficientNetV2B1 features for a joint prediction
- **Vision Transformer (ViT):** Comparative study vs EfficientNetV2 baselines
- **Active learning loop:** Allow clinicians to label uncertain cases and retrain
- **HIPAA-compliant deployment:** On-premise, encrypted model serving
- **DICOM support:** Direct ingestion of medical-imaging-standard files
- **Mobile app:** Native iOS / Android client for bedside screening
- **Ablation study:** Quantify contribution of CLAHE, stain normalization, etc.

---

## 🛠️ Tech Stack

**Backend:** Python · TensorFlow 2.x · Keras · OpenCV · scikit-learn · SHAP · Flask · flask-cors · medmnist

**Frontend:** React 18 · React Router 6 · Axios · Recharts · Framer Motion

**DevOps:** Git · Google Colab (training) · Local dev (inference)

---

## 👥 Team — Geeky Blinders

Semester 7, AIML Department
Project I — AI-Powered Cancer Detection & Diagnosis System

---

## 📜 License

This project is licensed for educational use. Not for clinical deployment.
