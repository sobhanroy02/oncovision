/**
 * Health Hub page.
 * Stores and reviews daily vitals and blood-marker snapshots as a private
 * local health log alongside the cancer detection workflow.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analyzeVitals,
  clearVitalsHistory,
  loadVitalsHistory,
  saveVitalsRecord,
} from '../services/healthStore';
import './HealthHub.css';

const SAMPLE_PRESETS = {
  stable: {
    deviceName: 'Ward Monitor A',
    source: 'device',
    temperature: 36.7,
    pulse: 74,
    spo2: 98,
    systolic: 118,
    diastolic: 76,
    hemoglobin: 13.8,
    wbc: 7.2,
    platelets: 264,
    glucose: 94,
  },
  review: {
    deviceName: 'IoT Health Patch',
    source: 'device',
    temperature: 37.4,
    pulse: 92,
    spo2: 95,
    systolic: 132,
    diastolic: 86,
    hemoglobin: 11.6,
    wbc: 11.8,
    platelets: 146,
    glucose: 152,
  },
  critical: {
    deviceName: 'Rapid Triage Belt',
    source: 'device',
    temperature: 38.2,
    pulse: 108,
    spo2: 91,
    systolic: 146,
    diastolic: 94,
    hemoglobin: 8.9,
    wbc: 28.6,
    platelets: 64,
    glucose: 186,
  },
};

const REFERENCE_RANGES = [
  ['Temperature', '36.1 - 37.5 C'],
  ['Pulse', '60 - 100 bpm'],
  ['SpO2', '95 - 100 %'],
  ['Systolic BP', '90 - 120 mmHg'],
  ['Diastolic BP', '60 - 80 mmHg'],
  ['Hemoglobin', '12 - 17.5 g/dL'],
  ['WBC', '4 - 11 x10^9/L'],
  ['Platelets', '150 - 450 x10^9/L'],
  ['Glucose', '70 - 140 mg/dL'],
];

function pillVariant(status) {
  if (!status) return 'safe';
  const normalized = status.toLowerCase();
  if (normalized === 'stable') return 'safe';
  if (normalized === 'critical') return 'alert';
  return 'warn';
}

function getAnalysisLabel(status) {
  if (!status) return 'No data';
  if (status === 'Critical') return 'Critical';
  if (status === 'Stable') return 'Stable';
  return 'Needs review';
}

function formatWhen(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function HealthHub() {
  const [vitalsHistory, setVitalsHistory] = useState([]);

  useEffect(() => {
    setVitalsHistory(loadVitalsHistory());
  }, []);

  function refreshHistory() {
    setVitalsHistory(loadVitalsHistory());
  }

  function handleLoadSample(kind = 'stable') {
    const sample = SAMPLE_PRESETS[kind] || SAMPLE_PRESETS.stable;
    const analysis = analyzeVitals(sample);

    saveVitalsRecord({
      ...sample,
      analysis,
      source: sample.source,
      deviceName: sample.deviceName,
    });
    refreshHistory();
  }

  function handleClearAll() {
    clearVitalsHistory();
    setVitalsHistory([]);
  }

  const latestRecord = vitalsHistory[0] || null;
  const latestAnalysis = latestRecord?.analysis || null;
  const latestScore = Number.isFinite(latestAnalysis?.score) ? latestAnalysis.score : null;

  const totals = useMemo(() => {
    const scores = vitalsHistory
      .map((entry) => Number(entry?.analysis?.score))
      .filter((value) => Number.isFinite(value));

    return {
      total: vitalsHistory.length,
      stable: vitalsHistory.filter((entry) => entry?.analysis?.status === 'Stable').length,
      review: vitalsHistory.filter((entry) => entry?.analysis?.status === 'Needs Review').length,
      critical: vitalsHistory.filter((entry) => entry?.analysis?.status === 'Critical').length,
      averageScore: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
    };
  }, [vitalsHistory]);

  const latestDeviceName = latestRecord?.deviceName || 'No device data yet';

  return (
    <div className="page health-hub-page">
      <div className="container page-shell">
        <section className="hub-hero card">
          <div className="page-header-row">
            <div className="hub-hero-copy">
              <div className="page-breadcrumb">Patient Portal / Health Hub</div>
              <h1 className="page-title">Health Hub</h1>
              <p className="page-subtitle hub-subtitle">
                Store daily vitals, review the latest health assessment, and keep the full parameter history private in your browser.
              </p>
            </div>

            <div className="page-meta-row">
              <span className="page-meta-chip">Daily monitoring</span>
              <span className="page-meta-chip">Private history</span>
              <span className="page-meta-chip">Hardware sync</span>
            </div>
          </div>

          <div className="hub-hero-actions">
            <button className="btn btn-secondary" onClick={() => handleLoadSample('stable')}>Add Stable Record</button>
            <button className="btn btn-outline" onClick={() => handleLoadSample('review')}>Add Review Record</button>
            <button className="btn btn-outline" onClick={() => handleLoadSample('critical')}>Add Critical Record</button>
            <button className="btn btn-outline" onClick={handleClearAll}>Clear Data</button>
          </div>
        </section>

        <section className="dashboard-summary grid grid-4 health-summary-grid">
          <div className="card stat-card">
            <span className="stat-label">Saved readings</span>
            <strong className="stat-value">{totals.total}</strong>
            <span className="stat-note">Stored locally in this browser</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Stable logs</span>
            <strong className="stat-value stat-success">{totals.stable}</strong>
            <span className="stat-note">Readings within range</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Needs review</span>
            <strong className="stat-value">{totals.review}</strong>
            <span className="stat-note">Readings outside normal limits</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Critical logs</span>
            <strong className="stat-value stat-danger">{totals.critical}</strong>
            <span className="stat-note">Needs prompt follow-up</span>
          </div>
        </section>

        <section className="grid grid-2 hub-grid">
          <div className="card hub-panel spotlight-panel">
            <div className="panel-head">
              <div>
                <h2>Health record overview</h2>
                <p className="text-muted">
                  A clean storage view for sample or hardware-style vitals with no intake form.
                </p>
              </div>
            </div>

            <div className="spotlight-grid compact-grid">
              {[
                ['Daily vitals checking', 'Review temperature, pulse, oxygen, pressure, and glucose trends.'],
                ['Assessment storage', 'Keep the latest assessment and history saved in the browser.'],
                ['Parameter history', 'Store every daily reading so changes are easy to compare later.'],
                ['Privacy first', 'Nothing leaves the browser unless you choose to export it elsewhere.'],
              ].map(([title, description]) => (
                <div key={title} className="spotlight-card">
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              ))}
            </div>

            <div className="sample-launcher">
              <div>
                <h3 className="sample-launcher-title">Sample readings</h3>
                <p className="text-muted sample-launcher-copy">
                  Use sample data to simulate a device upload and populate the local log.
                </p>
              </div>

              <div className="sample-launcher-actions">
                <button className="btn btn-secondary" onClick={() => handleLoadSample('stable')}>
                  Load Stable Sample
                </button>
                <button className="btn btn-outline" onClick={() => handleLoadSample('review')}>
                  Load Review Sample
                </button>
                <button className="btn btn-outline" onClick={() => handleLoadSample('critical')}>
                  Load Critical Sample
                </button>
              </div>
            </div>

            <div className="hub-cta-row">
              <Link className="btn btn-outline" to="/device-sync">
                Open Device Sync
              </Link>
              <button className="btn btn-secondary" onClick={() => handleLoadSample('stable')}>
                Add One Sample Reading
              </button>
            </div>
          </div>

          <aside className="card hub-panel reference-panel">
            <div className="panel-head">
              <div>
                <h2>Normal ranges</h2>
                <p className="text-muted">Reference ranges for the tracked health parameters.</p>
              </div>
            </div>

            <div className="reference-box">
              <ul className="reference-list">
                {REFERENCE_RANGES.map(([name, range]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <strong>{range}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>

        <section className="grid grid-2 hub-bottom-grid">
          <div className="card hub-panel report-panel">
            <div className="panel-head">
              <div>
                <h2>Latest assessment</h2>
                <p className="text-muted">Latest health status from the most recent saved reading.</p>
              </div>
              {latestAnalysis && (
                <span className={`report-pill report-pill-${pillVariant(latestAnalysis.status)}`}>
                  {getAnalysisLabel(latestAnalysis.status)}
                </span>
              )}
            </div>

            {!latestAnalysis ? (
              <p className="empty-state">Save or load a reading to see the latest assessment.</p>
            ) : (
              <div className="report-content">
                <div className="score-ring">
                  <strong>{latestScore ?? '—'}</strong>
                  <span>Health Score</span>
                </div>
                <div>
                  <h3>{latestDeviceName}</h3>
                  <p className="text-muted latest-meta">Latest reading from {formatWhen(latestRecord?.createdAt)}</p>
                  <p>
                    {latestAnalysis.status === 'Stable'
                      ? 'The reading is broadly within the expected range.'
                      : 'One or more readings deserve attention and follow-up.'}
                  </p>
                  <h3 className="mt-3">Cancer-aware observations</h3>
                  {latestAnalysis.cancerAwareSignals.length === 0 ? (
                    <p className="text-muted">
                      No strong cancer-related signal patterns were triggered from this reading.
                    </p>
                  ) : (
                    <ul className="report-list">
                      {latestAnalysis.cancerAwareSignals.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {latestAnalysis && (
              <div className="report-footer">
                <div>
                  <span className="muted-label">Top flags</span>
                  <ul className="report-list compact">
                    {latestAnalysis.topFlags.length > 0 ? (
                      latestAnalysis.topFlags.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No abnormal readings detected.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <span className="muted-label">Recommendations</span>
                  <ul className="report-list compact">
                    {latestAnalysis.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="card hub-panel history-panel">
            <div className="panel-head">
              <div>
                <h2>Latest device log</h2>
                <p className="text-muted">Recent readings from the local history.</p>
              </div>
              {vitalsHistory.length > 0 && (
                <span className="history-count">
                  {vitalsHistory.length} record{vitalsHistory.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="history-summary-row">
              <div className="history-summary-chip">
                <span>Stable</span>
                <strong>{totals.stable}</strong>
              </div>
              <div className="history-summary-chip">
                <span>Needs review</span>
                <strong>{totals.review}</strong>
              </div>
              <div className="history-summary-chip">
                <span>Critical</span>
                <strong>{totals.critical}</strong>
              </div>
            </div>

            <div className="history-list">
              {vitalsHistory.length === 0 ? (
                <p className="empty-state">No saved health readings yet.</p>
              ) : (
                vitalsHistory.map((entry) => {
                  const status = entry?.analysis?.status ?? 'Unknown';
                  const score = entry?.analysis?.score ?? '—';
                  const device = entry?.deviceName ?? 'Unknown device';
                  const time = entry?.createdAt ? new Date(entry.createdAt).toLocaleString() : '—';

                  return (
                    <article key={entry.id} className="history-item">
                      <div className="history-item-info">
                        <strong>{device}</strong>
                        <p>{time}</p>
                        <p className="history-source">{entry.source || 'manual'}</p>
                        <p className="history-source">Assessment: {getAnalysisLabel(status)}</p>
                      </div>
                      <div className="history-score">
                        <span className={`history-status history-status-${pillVariant(status)}`}>
                          {status}
                        </span>
                        <strong>{score}</strong>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HealthHub;
