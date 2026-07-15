export const DEMO_MODEL_SNAPSHOT = {
  models: [
    {
      name: 'EfficientNetV2B0 (Blood Cancer)',
      cancer_type: 'blood',
      architecture: 'EfficientNetV2B0',
      metrics: {
        accuracy: 0.94,
        sensitivity: 0.93,
        specificity: 0.95,
        precision: 0.92,
        f1_score: 0.92,
        auc_roc: 0.96,
      },
    },
    {
      name: 'EfficientNetV2B1 (Uterine Cancer)',
      cancer_type: 'uterine',
      architecture: 'EfficientNetV2B1',
      metrics: {
        accuracy: 0.91,
        sensitivity: 0.9,
        specificity: 0.92,
        precision: 0.9,
        f1_score: 0.9,
        auc_roc: 0.94,
      },
    },
  ],
};