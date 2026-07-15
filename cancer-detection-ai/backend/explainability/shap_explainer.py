"""
SHAP (SHapley Additive exPlanations) explainer for the cancer detection models.

Uses shap.GradientExplainer to compute Shapley-style values for image inputs,
providing pixel-level attribution maps that quantify each input feature's
contribution to the model's prediction.

Reference: Lundberg & Lee, "A Unified Approach to Interpreting Model Predictions", NeurIPS 2017.

Author: Geeky Blinders (AIML Sem 7)
"""

import os
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

# shap is an optional dependency — handle import gracefully
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("[WARN] shap is not installed. Run: pip install shap")


class CancerSHAPExplainer:
    """
    SHAP explainer wrapper for a Keras cancer detection model.

    Attributes:
        model: A compiled Keras model.
        background_data: Numpy array of shape (B, H, W, 3) used as the
            background distribution for DeepExplainer (B is typically 10-50).
    """

    def __init__(self, model, background_data: np.ndarray):
        """
        Initialize the SHAP explainer.

        Args:
            model: A compiled Keras model.
            background_data: Reference images for the explainer.
        """
        if not SHAP_AVAILABLE:
            raise ImportError("shap is required. Install with: pip install shap")

        self.model = model
        self.background_data = background_data
        print(f"[INFO] Initializing SHAP GradientExplainer with "
              f"{len(background_data)} background images...")
        self.explainer = shap.GradientExplainer(model, background_data)
        print("[INFO] SHAP explainer ready.")

    def compute_shap_values(self, images: np.ndarray) -> np.ndarray:
        """
        Compute SHAP values for a batch of images.

        Args:
            images: Numpy array of shape (N, H, W, 3), float32 in [0, 1].

        Returns:
            SHAP values array. For binary classification this is typically
            shape (N, H, W, 3) — one per class.
        """
        print(f"[INFO] Computing SHAP values for {len(images)} images...")
        shap_values = self.explainer.shap_values(images)
        print(f"[INFO] Done. SHAP values shape: "
              f"{np.array(shap_values).shape if isinstance(shap_values, list) else shap_values.shape}")
        return shap_values

    def save_summary_plot(self, images: np.ndarray, output_path: str,
                          class_index: int = 1) -> None:
        """
        Save a SHAP image plot showing the attribution maps for the given
        images and a target class.

        Args:
            images: Numpy array of shape (N, H, W, 3), float32 in [0, 1].
            output_path: Where to save the PNG.
            class_index: Class to visualize. Defaults to 1.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        shap_values = self.compute_shap_values(images)

        # shap.image_plot returns a Figure — save it directly
        plt.figure(figsize=(12, 4 * len(images)))
        shap.image_plot(shap_values, images, show=False)
        plt.savefig(output_path, dpi=100, bbox_inches="tight")
        plt.close()
        print(f"[INFO] Saved SHAP summary plot to {output_path}")

    def save_attribution_overlay(self, image: np.ndarray, shap_value: np.ndarray,
                                 output_path: str, class_index: int = 1) -> None:
        """
        Save a single-image attribution overlay.

        Args:
            image: Single image of shape (H, W, 3), float32 in [0, 1].
            shap_value: SHAP value for that image, shape (H, W, 3).
            output_path: Where to save the PNG.
            class_index: Class label for the title.
        """
        import cv2

        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Reduce SHAP values across channels to get a 2D attribution map
        attribution = np.abs(shap_value).sum(axis=-1)
        if attribution.max() > 0:
            attribution = attribution / attribution.max()

        # Heatmap via JET colormap
        heatmap_uint8 = np.uint8(255 * attribution)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        # Original image
        original = np.clip(image, 0, 1)
        original_uint8 = np.uint8(255 * original)

        # Overlay
        overlaid = cv2.addWeighted(original_uint8, 0.6, heatmap_colored, 0.4, 0)

        # Save side-by-side
        plt.figure(figsize=(8, 4))
        plt.subplot(1, 2, 1)
        plt.imshow(original)
        plt.title("Original", fontsize=10)
        plt.axis("off")
        plt.subplot(1, 2, 2)
        plt.imshow(overlaid)
        plt.title(f"SHAP Attribution (class {class_index})", fontsize=10)
        plt.axis("off")
        plt.tight_layout()
        plt.savefig(output_path, dpi=100, bbox_inches="tight")
        plt.close()
        print(f"[INFO] Saved SHAP overlay to {output_path}")
