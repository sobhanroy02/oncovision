"""
Grad-CAM (Gradient-weighted Class Activation Mapping) implementation.

Generates visual explanations for CNN predictions by computing the gradient
of the predicted class score with respect to the last convolutional layer's
feature map, then pooling the gradients to get per-channel importance weights.

Reference: Selvaraju et al., "Grad-CAM: Visual Explanations from Deep Networks
via Gradient-based Localization", ICCV 2017.

Author: Geeky Blinders (AIML Sem 7)
"""

import os
from pathlib import Path

import cv2
import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf


class GradCAM:
    """
    Grad-CAM explainer for a Keras classification model.

    Attributes:
        model: A compiled Keras model.
        last_conv_layer_name: Name of the last 4D convolutional layer in the
            model (e.g. "conv5_block3_out" for ResNet50).
    """

    def __init__(self, model, last_conv_layer_name: str):
        """
        Initialize the Grad-CAM explainer.

        Args:
            model: A Keras model.
            last_conv_layer_name: Name of the target conv layer.
        """
        self.model = model
        self.last_conv_layer_name = last_conv_layer_name

        # Build a sub-model that outputs both the conv feature map
        # and the final predictions.
        try:
            self.conv_layer = self.model.get_layer(self.last_conv_layer_name)
        except ValueError as exc:
            raise ValueError(
                f"Layer '{self.last_conv_layer_name}' not found in model. "
                f"Available layers include: "
                f"{[l.name for l in self.model.layers[-10:]]}"
            ) from exc

        self.grad_model = tf.keras.models.Model(
            inputs=self.model.input,
            outputs=[self.conv_layer.output, self.model.output],
        )
        print(f"[INFO] Grad-CAM initialized on layer: {self.last_conv_layer_name}")

    def compute_heatmap(self, image_array: np.ndarray, class_index: int = None) -> np.ndarray:
        """
        Compute the Grad-CAM heatmap for a single image.

        Args:
            image_array: Preprocessed image of shape (H, W, 3) or (1, H, W, 3),
                float32 in [0, 1] (or any range — internally normalized via
                gradient flow).
            class_index: Target class index. If None, uses the predicted class.

        Returns:
            Heatmap as a numpy array of shape (H, W) normalized to [0, 1].
        """
        if image_array.ndim == 3:
            image_array = np.expand_dims(image_array, axis=0)

        with tf.GradientTape() as tape:
            inputs = tf.cast(image_array, tf.float32)
            conv_outputs, predictions = self.grad_model(inputs, training=False)

            if class_index is None:
                class_index = int(tf.argmax(predictions[0]).numpy())
            else:
                class_index = int(class_index)

            class_score = predictions[:, class_index]

        grads = tape.gradient(class_score, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.maximum(heatmap, 0) / (tf.reduce_max(heatmap) + 1e-8)
        return heatmap.numpy()

    @staticmethod
    def overlay_heatmap(heatmap: np.ndarray, original_image: np.ndarray,
                        alpha: float = 0.4) -> np.ndarray:
        """
        Overlay the heatmap on the original image using the JET colormap.

        Args:
            heatmap: Grayscale heatmap of shape (H, W) with values in [0, 1].
            original_image: RGB image of shape (H, W, 3), uint8 in [0, 255]
                (or float32 in [0, 1] — both are handled).
            alpha: Blend factor for the heatmap (0 = original, 1 = pure heatmap).

        Returns:
            Overlaid image as a numpy array (H, W, 3), uint8.
        """
        heatmap = np.float32(heatmap)
        if heatmap.max() > 1.0:
            heatmap = heatmap / 255.0
        heatmap = np.clip(heatmap, 0, 1)

        h, w = original_image.shape[:2]
        heatmap_resized = cv2.resize(heatmap, (w, h))

        heatmap_uint8 = np.uint8(255 * heatmap_resized)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        if original_image.dtype != np.uint8:
            if original_image.max() <= 1.0:
                original_uint8 = np.uint8(255 * original_image)
            else:
                original_uint8 = np.uint8(np.clip(original_image, 0, 255))
        else:
            original_uint8 = original_image

        overlaid = cv2.addWeighted(
            original_uint8, 1 - alpha,
            heatmap_colored, alpha,
            0,
        )
        return overlaid

    def save_visualization(self, image_path: str, output_path: str,
                           class_index: int = None) -> dict:
        """
        Load an image, compute Grad-CAM, overlay, and save to disk.

        Args:
            image_path: Path to the input image file.
            output_path: Where to save the overlaid PNG.
            class_index: Target class. If None, uses the predicted class.

        Returns:
            Dict with keys: 'class_index', 'confidence', 'output_path'.
        """
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            raise FileNotFoundError(f"Could not load image: {image_path}")
        img_bgr = cv2.resize(img_bgr, (224, 224))
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

        preds = self.model.predict(np.expand_dims(img_rgb, axis=0), verbose=0)
        pred_class = int(np.argmax(preds[0]))
        confidence = float(np.max(preds[0])) * 100.0
        target_class = class_index if class_index is not None else pred_class

        heatmap = self.compute_heatmap(img_rgb, class_index=target_class)
        overlaid = GradCAM.overlay_heatmap(heatmap, img_rgb, alpha=0.4)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        plt.figure(figsize=(8, 4))
        plt.subplot(1, 2, 1)
        plt.imshow(np.clip(img_rgb, 0, 1))
        plt.title(f"Original (predicted class {pred_class})", fontsize=10)
        plt.axis("off")
        plt.subplot(1, 2, 2)
        plt.imshow(overlaid)
        plt.title(f"Grad-CAM (conf: {confidence:.1f}%)", fontsize=10)
        plt.axis("off")
        plt.tight_layout()
        plt.savefig(output_path, dpi=100, bbox_inches="tight")
        plt.close()

        return {
            "class_index": target_class,
            "confidence": confidence,
            "output_path": output_path,
        }


def resolve_last_conv_layer_name(model) -> str:
    """Resolve a Grad-CAM-friendly last convolutional layer for common backbones."""
    layer_names = {layer.name for layer in model.layers}
    model_name = getattr(model, "name", "").lower()

    candidates = []
    if "efficientnetv2" in model_name:
        candidates.extend(["top_conv", "block6h_project_conv", "block6i_project_conv"])
    if "resnet50" in model_name:
        candidates.append("conv5_block3_out")
    if "densenet121" in model_name:
        candidates.append("conv5_block16_concat")

    candidates.extend(["top_conv", "conv5_block3_out", "conv5_block16_concat"])

    for candidate in candidates:
        if candidate in layer_names:
            return candidate

    for layer in reversed(model.layers):
        if isinstance(layer, (tf.keras.layers.Conv2D, tf.keras.layers.SeparableConv2D, tf.keras.layers.DepthwiseConv2D)):
            return layer.name

    raise ValueError("Could not resolve a convolutional layer for Grad-CAM.")

# Conveniences for known models
RESNET50_LAST_CONV = "conv5_block3_out"
DENSENET121_LAST_CONV = "conv5_block16_concat"
