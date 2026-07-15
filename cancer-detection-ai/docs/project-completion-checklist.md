# Project Completion Checklist

This checklist converts the remaining project work into concrete commands and artifact targets.

## Current State

- Blood EfficientNetV2B0 training is wired in code.
- Uterine EfficientNetV2B1 training is wired in code.
- Frontend model-metrics chart is already implemented and consumes `/api/model-info`.
- Blood metrics already exist at `backend/results/blood_metrics.json`.
- Uterine metrics, model-comparison JSON, and YOLO artifacts are still missing.

## Finish the Core Image Models

- [ ] Train the blood model and save `backend/models/efficientnetv2b0_blood_cancer.h5`.
  - Command: `cd cancer-detection-ai/backend && python training/train_blood_cancer.py`
- [ ] Save the blood metrics bundle in `backend/results/blood_metrics.json`.
  - Expected outputs: `blood_training_curves.png`, `blood_roc_curve.png`, `blood_confusion_matrix.png`.
- [ ] Train the uterine model and save `backend/models/efficientnetv2b1_uterine_cancer.h5`.
  - Command: `cd cancer-detection-ai/backend && python training/train_uterine_cancer.py`
- [ ] Save `backend/results/uterine_metrics.json`.
  - Expected outputs: `uterine_training_curves.png`, `uterine_roc_curve.png`, `uterine_confusion_matrix.png`.
- [ ] Generate `backend/results/model_comparison.json`.
  - This is what powers the frontend model-comparison cards/chart.

## Finish the YOLO Comparison Track

- [ ] Train the blood YOLO classifier and save `backend/models/yolo11n_blood_cancer.pt`.
  - Expected outputs: `yolo_blood_metrics.json`, `yolo_blood_training_curves.png`, `yolo_blood_confusion_matrix.png`, `yolo_blood_results.csv`.
- [ ] Train the uterine YOLO classifier and save `backend/models/yolo11n_uterine_cancer.pt`.
  - Expected outputs: `yolo_uterine_metrics.json`, `yolo_uterine_training_curves.png`, `yolo_uterine_confusion_matrix.png`.

## Finish the Explainability Outputs

- [ ] Run the explanation generator after the trained `.h5` models exist.
  - Command: `cd cancer-detection-ai/backend && python explainability/generate_explanations.py`
  - Expected outputs: `backend/results/gradcam/`, `backend/results/shap/`, and `explainability_summary.png`.

## Validate the Web App

- [ ] Build the frontend.
  - Command: `cd cancer-detection-ai/frontend && npm run build`
- [ ] Verify `/api/health`, `/api/model-info`, and `/api/predict` with the backend running.
- [ ] Open the Home, Detect, Dashboard, Health Hub, Device Sync, and About pages and confirm the model cards render.

## Final Report Checklist

- [ ] Capture screenshots of the home page, detection flow, dashboard, health hub, and model comparison cards.
- [ ] Record the final metrics for both image models and both YOLO variants.
- [ ] Add one short section in the report explaining that the project uses EfficientNetV2B0 for blood and EfficientNetV2B1 for uterine screening.
- [ ] Include the note that the app runs in demo mode until trained model files are placed in `backend/models/`.
