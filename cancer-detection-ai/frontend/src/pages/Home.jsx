/**
 * Home / Landing page.
 * Hero, two large cancer-type cards, model performance.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getModelInfo } from '../services/api';
import ModelMetrics from '../components/ModelMetrics';
import ErrorBanner from '../components/ErrorBanner';
import { DEMO_MODEL_SNAPSHOT } from '../constants/modelSnapshot';
import './Home.css';

function Home() {
  const [modelInfo, setModelInfo] = useState(DEMO_MODEL_SNAPSHOT.models);
  const [error, setError] = useState('');

  const fetchInfo = useCallback(() => {
    setError('');
    getModelInfo()
      .then((d) => setModelInfo(d.models || []))
      .catch((e) => {
        setError(e.message || 'Could not load model metrics');
        setModelInfo(DEMO_MODEL_SNAPSHOT.models);
      });
  }, []);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  const bloodAcc    = modelInfo?.[0]?.metrics?.accuracy;
  const uterineAcc  = modelInfo?.[1]?.metrics?.accuracy;

  return (
    <div>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-inner">
          <h1 className="hero-title">AI Cancer Detection System</h1>
          <p className="hero-subtitle">
            Early detection of Leukaemia and Uterine Cancer using Deep Learning
            and Explainable AI.
          </p>
          <div className="hero-buttons">
            <Link to="/detect" className="btn btn-primary">Try the Detector</Link>
          </div>
        </div>
      </section>

      <div className="container">
        {/* CANCER-TYPE CARDS */}
        <section className="section">
          <h2 className="section-title">Choose a Detection Type</h2>
          <div className="grid grid-2">
            <Link to="/detect?type=blood" className="cancer-card card blood-card">
              <div className="cancer-icon">🩸</div>
              <h3>Blood Cancer Detection</h3>
              <p>
                Acute Lymphoblastic Leukaemia (ALL) screening from blood smear
                microscopy images using <strong>ResNet50</strong>.
              </p>
              <span className="badge badge-info">
                Model accuracy: {bloodAcc !== null && bloodAcc !== undefined
                  ? (bloodAcc * 100).toFixed(1) + '%' : '— (training pending)'}
              </span>
            </Link>

            <Link to="/detect?type=uterine" className="cancer-card card uterine-card">
              <div className="cancer-icon">🔬</div>
              <h3>Uterine Cancer Detection</h3>
              <p>
                Endometrial cancer screening from histopathology images using
                <strong> DenseNet121</strong>.
              </p>
              <span className="badge badge-info">
                Model accuracy: {uterineAcc !== null && uterineAcc !== undefined
                  ? (uterineAcc * 100).toFixed(1) + '%' : '— (training pending)'}
              </span>
            </Link>
          </div>
        </section>

        {/* DASHBOARD PREVIEW */}
        <section className="section">
          <div className="card dashboard-preview">
            <div>
              <span className="section-kicker">New feature</span>
              <h2 className="section-title section-title-left">Daily Health Report</h2>
              <p className="text-muted dashboard-preview-copy">
                Review recent screenings, see today’s risk summary, and keep a
                lightweight analysis history right in the browser. It is a simple
                patient-style dashboard built on top of the existing prediction flow.
              </p>
            </div>
            <div className="dashboard-preview-actions">
              <Link to="/dashboard" className="btn btn-primary">Open Daily Report</Link>
              <Link to="/detect" className="btn btn-outline">Run a Screening</Link>
            </div>
          </div>
        </section>

        {/* HEALTH SYSTEM */}
        <section className="section">
          <h2 className="section-title">Health System & Project Modules</h2>
          <div className="grid grid-4">
            <Link to="/health-hub" className="cancer-card card blood-card">
              <div className="cancer-icon">📡</div>
              <h3>Health Hub</h3>
              <p>
                Enter daily vitals, blood markers, and symptom signals manually to generate a local triage report.
              </p>
              <span className="badge badge-info">Manual Triage Report</span>
            </Link>
            <Link to="/device-sync" className="cancer-card card uterine-card">
              <div className="cancer-icon">⌁</div>
              <h3>Virtual IoT Sync</h3>
              <p>
                Simulate a connected medical biosensor scanning vitals, blood counts, and tumor antigens over BLE.
              </p>
              <span className="badge badge-info">IoT Hardware Simulator</span>
            </Link>
            <Link to="/ai-assistant" className="cancer-card card blood-card">
              <div className="cancer-icon">🩺</div>
              <h3>AI Assistant</h3>
              <p>
                Chat with BlinderCare AI (OncoBot) to ask diagnostic questions and explain tumor antigen indicators.
              </p>
              <span className="badge badge-info">Clinical Chatbot</span>
            </Link>
            <Link to="/dashboard" className="cancer-card card uterine-card">
              <div className="cancer-icon">📝</div>
              <h3>Combined Dashboard</h3>
              <p>
                Review today's vitals, screening history, SHAP explainability trends, and clinician action plans.
              </p>
              <span className="badge badge-info">Daily Report Center</span>
            </Link>
          </div>
        </section>

        {/* MODEL PERFORMANCE */}
        <section className="section">
          <h2 className="section-title">Model Performance</h2>
          {error && (
            <ErrorBanner
              title="Could not load metrics"
              message={error}
              onRetry={fetchInfo}
            />
          )}
          <ModelMetrics models={modelInfo} />
        </section>
      </div>
    </div>
  );
}

export default Home;