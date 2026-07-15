/**
 * About page — project overview, the two cancer types, model architecture
 * cards, performance metrics, tech stack, and team info.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getModelInfo } from '../services/api';
import ModelMetrics from '../components/ModelMetrics';
import ErrorBanner from '../components/ErrorBanner';
import './About.css';

function About() {
  const [modelInfo, setModelInfo] = useState([]);
  const [error, setError] = useState('');

  const fetchInfo = useCallback(() => {
    setError('');
    getModelInfo()
      .then((d) => setModelInfo(d.models || []))
      .catch((e) => {
        setError(e.message || 'Could not load model metrics');
        setModelInfo([]);
      });
  }, []);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  return (
    <div className="page about-page">
      <div className="container page-shell">
        <header className="page-header card about-hero">
          <div className="page-header-row">
            <div>
              <div className="page-breadcrumb">Platform / About</div>
              <h1 className="page-title">About This Project</h1>
              <p className="page-subtitle">
                An end-to-end AI screening tool for two common cancers, built with state-of-the-art deep learning and explainable AI techniques.
              </p>
            </div>
            <div className="page-meta-row">
              <span className="page-meta-chip">Research demo</span>
              <span className="page-meta-chip">Clinical AI</span>
              <span className="page-meta-chip">Full stack</span>
            </div>
          </div>
        </header>

        <section className="about-section">
          <h2>Project Overview</h2>
          <p>
            This system uses two state-of-the-art deep learning architectures
            to classify medical images as cancerous or normal. Both models are
            built on top of ImageNet-pretrained backbones and fine-tuned on
            domain-specific medical imaging datasets. The system also provides
            visual explanations (Grad-CAM heatmaps and SHAP attributions) for
            every prediction, so clinicians can understand which image regions
            drove the model's decision.
          </p>
        </section>

        <section className="about-section">
          <h2>Cancer Types Covered</h2>
          <div className="grid grid-2">
            <div className="card">
              <h3>🩸 Acute Lymphoblastic Leukaemia (ALL)</h3>
              <p>
                ALL is a cancer of the blood and bone marrow — the most common
                childhood cancer. Early detection from peripheral blood smears
                significantly improves survival rates. Our EfficientNetV2B0 model
                classifies individual white blood cells as cancerous (lymphoblast)
                or normal (healthy).
              </p>
              <p className="text-muted">
                <strong>Dataset:</strong> C-NMC 2019 (microscopy images of blood
                smears).
              </p>
            </div>
            <div className="card">
              <h3>🔬 Uterine / Endometrial Cancer</h3>
              <p>
                Uterine cancer is the most common gynaecological malignancy in
                developed countries. Histopathological examination of tissue
                biopsies is the gold standard for diagnosis. Our EfficientNetV2B1 model
                model classifies colorectal-tissue-style patches (PathMNIST) as
                tumor or normal.
              </p>
              <p className="text-muted">
                <strong>Dataset:</strong> PathMNIST from the medmnist library
                (28×28 and 224×224 histopathology patches).
              </p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>Model Architectures</h2>
          <div className="grid grid-2">
            <div className="card">
              <h3>EfficientNetV2B0 — Blood Cancer</h3>
              <p>
                Deep residual network with 50 layers, pretrained on ImageNet.
                We replace the classification head with a custom block:
                GlobalAvgPool → Dense(256) → Dropout(0.5) → BatchNorm →
                Dense(2, softmax).
              </p>
              <p className="text-muted">Two-phase training: frozen base →
                fine-tune last 30 layers.</p>
            </div>
            <div className="card">
              <h3>EfficientNetV2B1 — Uterine Cancer</h3>
              <p>
                EfficientNetV2 backbone tuned for histopathology patches with
                the same custom head. The modern backbone keeps the training
                pipeline aligned with the rest of the project.
              </p>
              <p className="text-muted">Two-phase training: frozen base →
                fine-tune last 20 layers.</p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>Performance Metrics</h2>
          {error && (
            <ErrorBanner
              title="Could not load metrics"
              message={error}
              onRetry={fetchInfo}
            />
          )}
          <ModelMetrics models={modelInfo} />
        </section>

        <section className="about-section">
          <h2>Tech Stack</h2>
          <div className="tech-grid">
            {[
              ['Python 3.10+',   'Core language'],
              ['TensorFlow 2.x',  'Deep learning framework'],
              ['Keras',           'Model building & training'],
              ['OpenCV',          'Image preprocessing & CLAHE'],
              ['scikit-learn',    'Metrics & data splitting'],
              ['SHAP',            'Feature attribution'],
              ['Grad-CAM',        'Visual explanations'],
              ['Flask',           'REST API backend'],
              ['React 18',        'Frontend framework'],
              ['React Router',    'Client-side routing'],
              ['Recharts',        'Performance charts'],
              ['Axios',           'HTTP client'],
            ].map(([name, desc]) => (
              <div key={name} className="tech-pill">
                <strong>{name}</strong>
                <span className="text-muted">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>Team — Geeky Blinders</h2>
          <p>
            Sem 7 Project I, AIML Department. Built as a full-stack
            educational demonstration of deep learning in medical imaging.
          </p>
          <p className="disclaimer mt-3">
            <strong>Disclaimer:</strong> This system is for research and
            educational purposes only. It is <u>not a substitute</u> for
            professional medical diagnosis. Always consult a qualified
            medical professional.
          </p>
        </section>
      </div>
    </div>
  );
}

export default About;