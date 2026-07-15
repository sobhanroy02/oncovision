/**
 * Daily health report dashboard.
 * Summarizes local screening history, recent risk levels, and backend/model
 * status so the website feels more like a complete patient-facing portal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { getHealthStatus, getModelInfo } from '../services/api';
import { clearScreeningHistory, loadScreeningHistory } from '../services/reportStore';
import { getLatestVitalsRecord, loadVitalsHistory } from '../services/healthStore';
import { DEMO_MODEL_SNAPSHOT } from '../constants/modelSnapshot';
import './Dashboard.css';

const RISK_COLORS = {
  High: '#E74C3C',
  Medium: '#F39C12',
  Low: '#27AE60',
  Unknown: '#6B7280',
};

const LABEL_MAPPING = {
  temperature: 'Temp (°C)',
  pulse: 'Pulse (bpm)',
  spo2: 'SpO2 (%)',
  systolic: 'BP Systolic',
  diastolic: 'BP Diastolic',
  glucose: 'Glucose (mg/dL)',
  hemoglobin: 'Hb (g/dL)',
  wbc: 'WBC (10^9/L)',
  platelets: 'Platelets (10^9/L)',
  cea: 'CEA (ng/mL)',
  ca_125: 'CA-125 (U/mL)',
  psa: 'PSA (ng/mL)'
};

const isAbnormal = (key, val) => {
  if (val === null || val === undefined) return false;
  const num = Number(val);
  switch (key) {
    case 'temperature': return num >= 37.8 || num < 35.5;
    case 'pulse': return num > 100 || num < 55;
    case 'spo2': return num < 95;
    case 'systolic': return num > 140 || num < 90;
    case 'diastolic': return num > 90 || num < 60;
    case 'glucose': return num > 140 || num < 60;
    case 'hemoglobin': return num < 11.5;
    case 'wbc': return num > 11.0 || num < 3.5;
    case 'platelets': return num < 145.0;
    case 'cea': return num > 2.5;
    case 'ca_125': return num > 35.0;
    case 'psa': return num > 4.0;
    default: return false;
  }
};


function formatWhen(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sameDay(left, right) {
  return left.toDateString() === right.toDateString();
}

function Dashboard() {
  const [history, setHistory] = useState([]);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [health, setHealth] = useState(null);
  const [modelInfo, setModelInfo] = useState(DEMO_MODEL_SNAPSHOT.models);

  useEffect(() => {
    setHistory(loadScreeningHistory());
    setVitalsHistory(loadVitalsHistory());

    let mounted = true;

    Promise.allSettled([getHealthStatus(), getModelInfo()]).then(([healthResult, modelResult]) => {
      if (!mounted) return;

      if (healthResult.status === 'fulfilled') {
        setHealth(healthResult.value);
      }

      if (modelResult.status === 'fulfilled') {
        setModelInfo(modelResult.value.models?.length ? modelResult.value.models : DEMO_MODEL_SNAPSHOT.models);
      } else {
        setModelInfo(DEMO_MODEL_SNAPSHOT.models);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const referenceDate = useMemo(() => new Date(), []);

  const todayRecords = useMemo(() => (
    history.filter((entry) => sameDay(new Date(entry.createdAt), referenceDate))
  ), [history, referenceDate]);

  const recentRecords = useMemo(() => history.slice(0, 6), [history]);
  const latestVitals = useMemo(() => getLatestVitalsRecord() || vitalsHistory[0] || null, [vitalsHistory]);

  const summary = useMemo(() => {
    const highRisk = todayRecords.filter((entry) => entry.riskLevel === 'High').length;
    const mediumRisk = todayRecords.filter((entry) => entry.riskLevel === 'Medium').length;
    const lowRisk = todayRecords.filter((entry) => entry.riskLevel === 'Low').length;
    const validConfidence = todayRecords
      .map((entry) => entry.confidence)
      .filter((value) => Number.isFinite(value));
    const avgConfidence = validConfidence.length
      ? validConfidence.reduce((acc, value) => acc + value, 0) / validConfidence.length
      : null;

    return {
      screenings: todayRecords.length,
      highRisk,
      mediumRisk,
      lowRisk,
      avgConfidence,
      lastScreening: todayRecords[0] || history[0] || null,
    };
  }, [history, todayRecords]);

  const confidenceTrend = useMemo(() => (
    recentRecords.slice().reverse().map((entry, index) => ({
      name: `#${index + 1}`,
      confidence: Number.isFinite(entry.confidence) ? entry.confidence : 0,
    }))
  ), [recentRecords]);

  const riskBreakdown = useMemo(() => ([
    { name: 'High', value: summary.highRisk },
    { name: 'Medium', value: summary.mediumRisk },
    { name: 'Low', value: summary.lowRisk },
  ].filter((item) => item.value > 0)), [summary.highRisk, summary.mediumRisk, summary.lowRisk]);

  const dailyBars = useMemo(() => {
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(referenceDate);
      date.setDate(referenceDate.getDate() - offset);
      const items = history.filter((entry) => sameDay(new Date(entry.createdAt), date));
      days.push({
        day: date.toLocaleDateString([], { weekday: 'short' }),
        screenings: items.length,
      });
    }
    return days;
  }, [history, referenceDate]);

  const recommendations = useMemo(() => {
    const notes = [];

    if (summary.screenings === 0) {
      notes.push('Run your first screening to generate a daily report.');
    }

    if (summary.highRisk > 0) {
      notes.push('A high-risk result was recorded today. Review it with a qualified clinician as soon as possible.');
    } else if (summary.mediumRisk > 0) {
      notes.push('One or more medium-risk findings were recorded. Consider a follow-up screening or medical review.');
    } else if (summary.screenings > 0) {
      notes.push('Today’s screenings are low risk. Keep monitoring and follow routine checkups.');
    }

    if (summary.avgConfidence !== null && summary.avgConfidence < 70) {
      notes.push('Average confidence is moderate. Re-test with a cleaner sample if image quality was poor.');
    }

    if (health?.mock_mode) {
      notes.push('The backend is still in demo mode, so predictions may be mock until trained models are connected.');
    }

    if (latestVitals?.analysis?.status && latestVitals.analysis.status !== 'Stable') {
      notes.push(`Latest device reading is ${latestVitals.analysis.status.toLowerCase()}; review the vitals panel for detail.`);
    }

    notes.push('Have questions about your reports? Ask BlinderCare AI assistant (OncoBot) for instant clinical explanations.');

    return notes;
  }, [health?.mock_mode, latestVitals, summary.avgConfidence, summary.highRisk, summary.mediumRisk, summary.screenings]);

  function handleClearHistory() {
    clearScreeningHistory();
    setHistory([]);
  }

  return (
    <div className="page dashboard-page">
      <div className="container">
        <section className="dashboard-hero card">
          <div className="dashboard-hero-copy">
            <span className="section-kicker light">Daily health report</span>
            <h1 className="page-title dashboard-title">Screening history and risk summary</h1>
            <p className="page-subtitle dashboard-subtitle">
              This dashboard keeps a local log of your analyses, summarizes today’s risk levels,
              and pairs the report with backend and model status.
            </p>
          </div>
          <div className="dashboard-hero-actions">
            <Link to="/detect" className="btn btn-primary">Run New Screening</Link>
            <button className="btn btn-outline dashboard-clear-btn" onClick={handleClearHistory}>
              Clear Local History
            </button>
          </div>
        </section>

        <section className="dashboard-summary grid grid-4">
          <div className="card stat-card">
            <span className="stat-label">Screenings today</span>
            <strong className="stat-value">{summary.screenings}</strong>
            <span className="stat-note">Saved locally in this browser</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">High-risk flags</span>
            <strong className="stat-value stat-danger">{summary.highRisk}</strong>
            <span className="stat-note">Needs priority review</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Average confidence</span>
            <strong className="stat-value">{summary.avgConfidence === null ? '—' : `${summary.avgConfidence.toFixed(1)}%`}</strong>
            <span className="stat-note">Across today’s analyses</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Backend status</span>
            <strong className="stat-value">{health?.status === 'ok' ? 'Online' : 'Offline'}</strong>
            <span className="stat-note">{health?.mock_mode ? 'Demo inference active' : 'Trained models active'}</span>
          </div>
        </section>

        <section className="card dashboard-panel mt-3">
          <div className="panel-head">
            <div>
              <h2>Latest vitals snapshot</h2>
              <p className="text-muted">The newest reading synced from the hardware device or Health Hub.</p>
            </div>
            <Link to="/health-hub" className="btn btn-outline">Open Health Hub</Link>
          </div>

          {!latestVitals ? (
            <p className="empty-state">No vitals data captured yet.</p>
          ) : (
            <div className="vitals-snapshot">
              <div className="vitals-score-box">
                <strong>{latestVitals.analysis?.score ?? '—'}</strong>
                <span>{latestVitals.analysis?.status || 'Unknown'}</span>
              </div>
              <div className="vitals-snapshot-list">
                {Object.entries(latestVitals.raw || {})
                  .filter(([key]) => LABEL_MAPPING[key]) // only show known mapped fields
                  .map(([key, value]) => (
                    <div 
                      key={key} 
                      className={`vitals-snapshot-item ${isAbnormal(key, value) ? 'abnormal' : ''}`}
                      title={isAbnormal(key, value) ? 'Value outside standard clinical range' : 'Value normal'}
                    >
                      <span>{LABEL_MAPPING[key]}</span>
                      <strong>{value ?? '—'}</strong>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-layout">
          <div className="dashboard-main">
            <div className="card dashboard-panel">
              <div className="panel-head">
                <div>
                  <h2>Today’s report</h2>
                  <p className="text-muted">A concise view of the analyses captured in this session.</p>
                </div>
                <span className={`report-pill ${summary.highRisk > 0 ? 'report-pill-alert' : 'report-pill-safe'}`}>
                  {summary.highRisk > 0 ? 'Needs review' : 'Stable'}
                </span>
              </div>

              <div className="dashboard-chart-grid">
                <div className="chart-box">
                  <h3>Confidence trend</h3>
                  {confidenceTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={confidenceTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} unit="%" />
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Line type="monotone" dataKey="confidence" stroke="#1A3C6E" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="empty-state">Run a screening to populate the report.</p>
                  )}
                </div>

                <div className="chart-box">
                  <h3>Risk split</h3>
                  {riskBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={riskBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={86}
                          paddingAngle={5}
                        >
                          {riskBreakdown.map((entry) => (
                            <Cell key={entry.name} fill={RISK_COLORS[entry.name] || RISK_COLORS.Unknown} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="empty-state">No risk data yet.</p>
                  )}
                </div>
              </div>

              <div className="chart-box">
                <h3>Last 7 days screenings</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="screenings" fill="#0D7377" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card dashboard-panel">
              <div className="panel-head">
                <div>
                  <h2>Recent screenings</h2>
                  <p className="text-muted">The latest saved predictions from this browser.</p>
                </div>
              </div>

              {recentRecords.length === 0 ? (
                <p className="empty-state">No saved screenings yet.</p>
              ) : (
                <div className="recent-list">
                  {recentRecords.map((entry) => (
                    <article key={entry.id} className="recent-item">
                      <div>
                        <div className="recent-title-row">
                          <h3>{entry.fileName}</h3>
                          <span className={`risk-tag risk-${entry.riskLevel?.toLowerCase() || 'unknown'}`}>
                            {entry.riskLevel || 'Unknown'}
                          </span>
                        </div>
                        <p className="recent-meta">
                          {entry.cancerType} • {entry.prediction} • {formatWhen(entry.createdAt)}
                        </p>
                      </div>
                      <div className="recent-stats">
                        <strong>{Number.isFinite(entry.confidence) ? `${entry.confidence}%` : '—'}</strong>
                        <span>{entry.mock ? 'Demo mode' : 'Live model'}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="dashboard-sidebar">
            <div className="card dashboard-panel">
              <h2>Recommendations</h2>
              {recommendations.length === 0 ? (
                <p className="empty-state">Run a screening to get daily guidance.</p>
              ) : (
                <ul className="recommendation-list">
                  {recommendations.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </div>

            <div className="card dashboard-panel">
              <h2>Model snapshot</h2>
              {modelInfo.length === 0 ? (
                <p className="empty-state">Model metrics are unavailable right now.</p>
              ) : (
                <div className="model-snapshot-list">
                  {modelInfo.map((model) => (
                    <div key={model.name} className="model-snapshot-item">
                      <strong>{model.name}</strong>
                      <span>{model.architecture}</span>
                      <span>
                        Accuracy: {model.metrics?.accuracy === null || model.metrics?.accuracy === undefined
                          ? '—'
                          : `${(model.metrics.accuracy * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card dashboard-panel dashboard-note">
              <h2>Privacy note</h2>
              <p>
                This report stays in your browser only. Clearing local history removes the saved
                screening log from this device.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;