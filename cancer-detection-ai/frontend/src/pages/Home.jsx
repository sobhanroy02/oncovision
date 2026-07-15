import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CircleCheckBig,
  Gauge,
  Stethoscope,
  TimerReset,
  WandSparkles,
} from 'lucide-react';
import { getModelInfo } from '../services/api';
import ModelMetrics from '../components/ModelMetrics';
import { DEMO_MODEL_SNAPSHOT } from '../constants/modelSnapshot';
import './Home.css';

const TRUST_METRICS = [
  ['94%', 'Accuracy'],
  ['2', 'Cancer models'],
  ['4', 'Explainability layers'],
  ['24/7', 'Clinical access'],
];

const FEATURE_CHIPS = [
  'Clinical triage',
  'Radiology review',
  'Doctor sign-off',
  'Explainability',
  'Report archive',
  'Patient follow-up',
];

const WHY_CARDS = [
  {
    icon: Gauge,
    title: 'High Accuracy',
    text: 'Purpose-built cancer screening models with clear confidence signals and clinical-grade presentation.',
  },
  {
    icon: WandSparkles,
    title: 'Explainable AI',
    text: 'Grad-CAM, SHAP, and visual model interpretation are integrated into every review workflow.',
  },
  {
    icon: TimerReset,
    title: 'Fast Detection',
    text: 'Rapid inference flow for image uploads, helping users move from scan to result without friction.',
  },
  {
    icon: Stethoscope,
    title: 'Clinical Support',
    text: 'A structured patient and doctor experience designed around review, follow-up, and monitoring.',
  },
];

const HOW_STEPS = [
  ['1', 'Upload Image', 'Scan or drop a medical image to start the workflow.'],
  ['2', 'AI Analysis', 'The model evaluates the image and generates a prediction.'],
  ['3', 'Explainability', 'Heatmaps and attribution overlays show why it decided.'],
  ['4', 'Diagnosis Report', 'A summary report captures confidence, risk, and notes.'],
  ['5', 'Doctor Review', 'Clinical review completes the loop for safe follow-up.'],
];

const FEATURE_STORIES = [
  {
    eyebrow: 'Patient workflow',
    title: 'A focused screening journey for patients',
    text: 'Patients can screen, review history, and return to care actions without getting lost in clutter or fragmented screens.',
    points: ['Upload blood smear and histopathology scans', 'Review saved prediction history', 'Open Health Hub for vitals tracking'],
    visual: 'Patient workflow preview',
    reverse: false,
  },
  {
    eyebrow: 'Doctor workflow',
    title: 'A review environment built for clinical teams',
    text: 'Doctors get a review queue, analytics view, and action-oriented workspace instead of a generic dashboard layout.',
    points: ['Approve or reject AI findings', 'Inspect explainability overlays', 'Track confidence and case trends'],
    visual: 'Clinical review console',
    reverse: true,
  },
];

function Home() {
  const [modelInfo, setModelInfo] = useState(DEMO_MODEL_SNAPSHOT.models);
  const [usingLocalSnapshot, setUsingLocalSnapshot] = useState(true);

  const fetchInfo = useCallback(() => {
    getModelInfo()
      .then((data) => {
        setModelInfo(data.models || []);
        setUsingLocalSnapshot(false);
      })
      .catch(() => {
        setModelInfo(DEMO_MODEL_SNAPSHOT.models);
        setUsingLocalSnapshot(true);
      });
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  return (
    <div className="home-page">
      <section className="hero hero-premium">
        <div className="hero-shell">
          <div className="container hero-grid">
            <motion.div
              className="hero-copy"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <span className="section-kicker hero-badge">Clinical AI Screening</span>
              <h1 className="hero-title">A clinical AI platform for cancer screening, explanation, and doctor review.</h1>
              <p className="hero-subtitle">
                Designed for hospital teams and patients who need a structured workflow from image intake to report review.
                The platform combines fast inference, explainable AI, and clinician-ready dashboards in one focused experience.
              </p>

              <div className="hero-buttons">
                <Link to="/auth" className="btn btn-primary">Begin Screening <ArrowRight size={16} /></Link>
                <Link to="/dashboard" className="btn btn-outline">Open Clinical Dashboard</Link>
              </div>

              <div className="hero-trust-row">
                {TRUST_METRICS.map(([value, label]) => (
                  <div key={label} className="trust-pill">
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              <div className="hero-chip-row">
                {FEATURE_CHIPS.map((chip) => (
                  <span key={chip} className="hero-chip">{chip}</span>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="hero-visual"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
            >
              <div className="hero-visual-orb hero-visual-orb-a" />
              <div className="hero-visual-orb hero-visual-orb-b" />

              <div className="hero-visual-canvas">
                <div className="hero-preview-card hero-preview-main">
                  <div className="preview-topbar">
                    <span>Clinical case preview</span>
                    <b>Queued</b>
                  </div>
                  <div className="preview-image">
                    <div className="preview-crosshair" />
                    <div className="preview-heatmap" />
                    <div className="preview-scanline" />
                  </div>
                  <div className="preview-footer">
                    <span>Radiology overlay</span>
                    <strong>Area under review</strong>
                  </div>
                </div>

                <motion.div className="floating-widget widget-confidence" animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                  <span>Confidence</span>
                  <strong>94%</strong>
                  <small>Reviewed in clinic</small>
                </motion.div>

                <motion.div className="floating-widget widget-risk" animate={{ y: [0, 8, 0] }} transition={{ duration: 4.5, repeat: Infinity }}>
                  <span>Triage</span>
                  <strong>Routine</strong>
                  <small>Doctor review scheduled</small>
                </motion.div>

                <motion.div className="floating-widget widget-model" animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity }}>
                  <span>Latest case</span>
                  <strong>Blood screening</strong>
                  <small>Stable assessment</small>
                </motion.div>

                <motion.div className="floating-widget widget-chart" animate={{ y: [0, 6, 0] }} transition={{ duration: 4.2, repeat: Infinity }}>
                  <span>Review load</span>
                  <div className="mini-bars" aria-hidden="true">
                    {[68, 82, 91, 74].map((height, index) => (
                      <i key={index} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </motion.div>

                <div className="floating-widget widget-heatmap">
                  <span>Case notes</span>
                  <div className="heatmap-strip">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="container landing-sections">
        <section className="section section-soft">
          <div className="section-head">
            <div>
              <span className="section-kicker">Why hospitals use it</span>
              <h2 className="section-title section-title-left">Built to match a real clinical workflow</h2>
            </div>
            <p className="section-copy">
              The interface uses a calm hierarchy, clear status cues, and explainable outputs so the experience feels trustworthy and complete.
            </p>
          </div>

          <div className="feature-icon-grid">
            {WHY_CARDS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="feature-icon-card">
                  <Icon size={20} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Care flow</span>
              <h2 className="section-title section-title-left">A simple flow from intake to clinical review</h2>
            </div>
          </div>

          <div className="timeline-flow">
            {HOW_STEPS.map(([step, label, text], index) => (
              <React.Fragment key={label}>
                <div className="timeline-step">
                  <span className="timeline-bubble">{step}</span>
                  <h3>{label}</h3>
                  <p>{text}</p>
                </div>
                {index < HOW_STEPS.length - 1 && <div className="timeline-arrow">↓</div>}
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Clinical modules</span>
              <h2 className="section-title section-title-left">Patient and doctor workflows separated cleanly</h2>
            </div>
          </div>

          <div className="story-stack">
            {FEATURE_STORIES.map((story) => (
              <div key={story.title} className={`story-row ${story.reverse ? 'reverse' : ''}`}>
                <div className="story-visual">
                  <div className="story-visual-inner">
                    <span>{story.visual}</span>
                    <div className="story-mini-grid">
                      <div>
                        <strong>94%</strong>
                        <small>AI confidence</small>
                      </div>
                      <div>
                        <strong>06</strong>
                        <small>Open reviews</small>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="story-copy">
                  <span className="section-kicker">{story.eyebrow}</span>
                  <h3>{story.title}</h3>
                  <p>{story.text}</p>
                  <ul>
                    {story.points.map((point) => (
                      <li key={point}><CircleCheckBig size={16} /> {point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Operational view</span>
              <h2 className="section-title section-title-left">Live system signals and case performance</h2>
            </div>
            <p className="section-copy">
              A cleaner view of case readiness, trend tracking, and backend status without crowding the page with large boxes.
            </p>
          </div>

          <div className="analytics-preview">
            <div className="analytics-rings">
              <div className="ring-card ring-primary">
                <strong>94%</strong>
                <span>Accuracy</span>
              </div>
              <div className="ring-card ring-secondary">
                <strong>6</strong>
                <span>Pending reviews</span>
              </div>
              <div className="ring-card ring-accent">
                <strong>12</strong>
                <span>Today&apos;s screenings</span>
              </div>
            </div>

            <div className="analytics-chart-panel">
              <div className="analytics-panel-head">
                <h3>Prediction trends</h3>
                <span>Last 7 days</span>
              </div>
              <div className="trend-bars" aria-hidden="true">
                {[18, 28, 34, 26, 48, 58, 44].map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>

            <div className="analytics-side-stack">
              <div className="analytics-side-card">
                <span>Case mix</span>
                <strong>Blood and uterine</strong>
                <p>Two screening tracks are surfaced with separate clinical review paths.</p>
              </div>
              <div className="analytics-side-card">
                <span>Recent activity</span>
                <strong>23 events</strong>
                <p>Uploads, reports, and reviews stay visible instead of hidden in empty space.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Model performance</span>
              <h2 className="section-title section-title-left">Bundled clinical performance snapshot</h2>
            </div>
          </div>

          {usingLocalSnapshot && (
            <p className="text-muted text-center model-fallback-note">
              Showing the bundled model snapshot while the backend model metrics load.
            </p>
          )}
          <ModelMetrics models={modelInfo} />
        </section>
      </div>
    </div>
  );
}

export default Home;
