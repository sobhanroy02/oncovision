# Final-Year Project Roadmap

## Project Title
AI-Powered Cancer Detection and Daily Health Monitoring System

## Project Goal
Build a final-year system that combines medical image analysis with daily health parameters to support early cancer risk screening and reporting.

## Core Scope

- Blood cancer detection from blood-smear microscopy images.
- Uterine cancer detection from histopathology images.
- Daily health parameter intake from a manual form or hardware device.
- Combined analysis report with risk level, score, and recommendations.
- Dashboard pages for history, trends, and model overview.

## Datasets

- Blood cancer: C-NMC 2019 dataset.
- Uterine cancer: PathMNIST from MedMNIST.
- Daily health data: custom readings collected from the hardware device or manual entry.

## Important Design Note

Mammograms are mainly for breast cancer, not uterine cancer. If mammogram support is needed, it should be added as a separate breast-cancer module.

## Phase Plan

### Phase 1: System Definition

What to do:
- Fix the exact project scope.
- Keep the first version focused on blood cancer and uterine cancer.
- Decide which daily health parameters will be accepted.

How to do it:
- Use blood-smear images for the blood-cancer path.
- Use histopathology images for the uterine-cancer path.
- Use clinical-style vitals and blood markers such as temperature, pulse, SpO2, hemoglobin, WBC, platelets, and glucose.

Result:
- A clear and realistic final-year project scope.

### Phase 2: Data Collection and Setup

What to do:
- Download and organize the datasets.
- Prepare the folder structure.

How to do it:
- Store C-NMC 2019 under `data/raw/blood/`.
- Keep PathMNIST through the MedMNIST loader/cache.
- Store hardware or manual health readings in a separate local storage flow.

Result:
- A clean data pipeline that supports both imaging and daily monitoring.

### Phase 3: Image Preprocessing

What to do:
- Build preprocessing for both image datasets.

How to do it:
- Resize images to the model input size.
- Normalize pixel values.
- Apply blood-image contrast enhancement when needed.
- Save or stream data into the training pipeline.

Result:
- Model-ready image input for both cancer modules.

### Phase 4: Model Training

What to do:
- Train separate models for blood cancer and uterine cancer.

How to do it:
- Use EfficientNetV2B0 for blood cancer.
- Use EfficientNetV2B1 for uterine cancer.
- Fine-tune the last layers after initial frozen-base training.
- Apply class weighting, augmentation, early stopping, and learning-rate scheduling to improve validation accuracy without destabilizing the model.

Result:
- Two trained classifiers with performance metrics and a realistic validation target in the 85% to 95% range after retraining.

### Phase 5: Daily Health Report Engine

What to do:
- Combine image results with daily health parameters.

How to do it:
- Analyze the numeric health values.
- Flag abnormal parameters.
- Merge the health analysis with the cancer prediction results.
- Produce a single report with score, risk level, and recommendations.

Result:
- A daily report that looks clinically useful and easy to explain.

### Phase 6: Dashboard and Pages

What to do:
- Build the patient-facing website pages.

How to do it:
- Add Health Hub.
- Add Device Sync.
- Add Dashboard / Report History.
- Add Model Overview and How It Works pages.

Result:
- A complete website rather than a simple demo page.

### Phase 7: Validation and Presentation

What to do:
- Test the system and prepare final documentation.

How to do it:
- Measure accuracy, sensitivity, specificity, F1 score, and AUC.
- Verify the final checkpoints work correctly in inference before presentation.
- Show sample daily reports.
- Compare normal vs abnormal parameter cases.
- Include screenshots, charts, and explanation in the report.

Result:
- A strong final-year presentation with measurable technical output.

## Expected Final Output

- Blood cancer prediction with confidence and explanation.
- Uterine cancer prediction with confidence and explanation.
- Daily health report from hardware/manual input.
- Dashboard showing history, trends, and summaries.
- Clear documentation for your project report and presentation.

## Recommended Timeline

| Week | Work |
|---|---|
| 1 | Finalize scope and datasets |
| 2 | Preprocessing and data organization |
| 3 | Train blood-cancer model |
| 4 | Train uterine-cancer model |
| 5 | Build report engine and health rules |
| 6 | Build dashboard and extra pages |
| 7 | Test, validate, and document results |
| 8 | Prepare final report and presentation |
