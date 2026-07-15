/**
 * Health Hub page.
 * Collects daily hardware-style vitals, analyzes them, and stores a local
 * monitoring history alongside the cancer detection workflow.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  analyzeVitals,
  clearVitalsHistory,
  loadVitalsHistory,
  saveVitalsRecord,
  vitalsFieldMeta,
} from '../services/healthStore';
import './HealthHub.css';

const FIELD_ORDER = [
  'temperature',
  'pulse',
  'spo2',
  'systolic',
  'diastolic',
  'hemoglobin',
  'wbc',
  'platelets',
  'glucose',
];

const INITIAL_STATE = {
  deviceName: 'Ward Monitor A',
  source: 'manual',
  temperature: '',
  pulse: '',
  spo2: '',
  systolic: '',
  diastolic: '',
  hemoglobin: '',
  wbc: '',
  platelets: '',
  glucose: '',
};

const SAMPLE_PAYLOAD = {
  deviceName: 'IoT Health Patch',
  source: 'device',
  temperature: 37.2,
  pulse: 88,
  spo2: 96,
  systolic: 128,
  diastolic: 84,
  hemoglobin: 11.2,
  wbc: 12.4,
  platelets: 145,
  glucose: 162,
};

/* Safe status → pill variant mapping */
function pillVariant(status) {
  if (!status) return 'safe';
  const s = status.toLowerCase();
  if (s === 'stable') return 'safe';
  if (s === 'critical') return 'alert';
  return 'warn';
}

function HealthHub() {
  const [form, setForm] = useState(INITIAL_STATE);
  const [analysis, setAnalysis] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  // Use vitals history (NOT screening history)
  const [vitalsHistory, setVitalsHistory] = useState([]);

  // Load vitals history on mount
  useEffect(() => {
    setVitalsHistory(loadVitalsHistory());
  }, []);

  const fieldMeta = useMemo(() => vitalsFieldMeta(), []);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSampleLoad() {
    setForm((current) => ({ ...current, ...SAMPLE_PAYLOAD }));
    setError('');
  }

  // Clear only vitals data — do NOT touch screening history
  function handleClearAll() {
    clearVitalsHistory();
    setVitalsHistory([]);
    setAnalysis(null);
    setSavedAt(null);
    setForm(INITIAL_STATE);
  }

  function handleAnalyze(event) {
    event.preventDefault();
    setError('');

    const result = analyzeVitals(form);
    setAnalysis(result);

    saveVitalsRecord({
      ...form,
      analysis: result,
      source: form.source,
      deviceName: form.deviceName,
    });

    // Refresh history from storage so it stays in sync
    setVitalsHistory(loadVitalsHistory());
    setSavedAt(new Date().toLocaleString());
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setForm((current) => ({ ...current, ...parsed }));
      setError('');
    } catch (_err) {
      setError('Upload a valid JSON payload exported by the hardware device.');
    }
    // Reset file input so the same file can be re-uploaded
    event.target.value = '';
  }

  return (
    <div className="page health-hub-page">
      <div className="container">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="hub-hero card">
          <div>
            <span className="section-kicker">Hardware sync</span>
            <h1 className="page-title">Health Hub</h1>
            <p className="page-subtitle hub-subtitle">
              Feed in daily vitals from a bedside monitor or wearable device and generate a
              structured health report next to the cancer detection results.
            </p>
          </div>
          <div className="hub-hero-actions">
            <button className="btn btn-secondary" onClick={handleSampleLoad}>
              Load Sample Device Data
            </button>
            <button className="btn btn-outline" onClick={handleClearAll}>
              Clear Saved Data
            </button>
          </div>
        </section>

        {/* ── Input form + spotlight ────────────────────────────────── */}
        <section className="grid grid-2 hub-grid">
          <form className="card hub-panel" onSubmit={handleAnalyze}>
            <div className="panel-head hub-panel-head">
              <div>
                <h2>Daily vitals intake</h2>
                <p className="text-muted">
                  Enter values manually or upload a JSON reading from a device.
                </p>
              </div>
              <label className="upload-chip">
                Upload JSON
                <input type="file" accept="application/json" onChange={handleUpload} />
              </label>
            </div>

            <div className="grid grid-2 form-grid">
              <label className="field full-width">
                <span>Device name</span>
                <input
                  value={form.deviceName}
                  onChange={(e) => updateField('deviceName', e.target.value)}
                  placeholder="Wearable / monitor name"
                />
              </label>
              <label className="field full-width">
                <span>Source</span>
                <select
                  value={form.source}
                  onChange={(e) => updateField('source', e.target.value)}
                >
                  <option value="manual">Manual entry</option>
                  <option value="device">Hardware device</option>
                  <option value="lab">Lab system</option>
                </select>
              </label>

              {FIELD_ORDER.map((key) => {
                const meta = fieldMeta[key];
                if (!meta) return null;
                return (
                  <label key={key} className="field">
                    <span>{meta.label}</span>
                    <input
                      type="number"
                      step="any"
                      value={form[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      placeholder={key === 'spo2' ? '95' : 'Enter value'}
                    />
                  </label>
                );
              })}
            </div>

            {error && <p className="error-msg mt-2">{error}</p>}

            <div className="action-row mt-3">
              <button className="btn btn-primary" type="submit">
                Generate Health Report
              </button>
              <Link className="btn btn-outline" to="/dashboard">
                Open Combined Report
              </Link>
            </div>
          </form>

          {/* What this system adds */}
          <aside className="card hub-panel spotlight-panel">
            <div className="panel-head">
              <div>
                <h2>What this system adds</h2>
                <p className="text-muted">
                  A patient-facing flow that blends daily monitoring with cancer screening.
                </p>
              </div>
            </div>

            <div className="spotlight-grid">
              {[
                ['Device sync', 'Import JSON readings from a health device or wearable.'],
                [
                  'Daily report',
                  'Score vitals and show a clear Stable / Needs Review / Critical label.',
                ],
                [
                  'Cancer-aware notes',
                  'Highlight blood markers that may deserve a closer medical review.',
                ],
                [
                  'Local privacy',
                  'Your saved history stays in the browser unless you clear it.',
                ],
              ].map(([title, description]) => (
                <div key={title} className="spotlight-card">
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              ))}
            </div>

            {/* Quick reference ranges */}
            <div className="reference-box">
              <h3 className="reference-title">Normal ranges (reference)</h3>
              <ul className="reference-list">
                <li><span>Temperature</span><strong>36.1 – 37.5 °C</strong></li>
                <li><span>Pulse</span><strong>60 – 100 bpm</strong></li>
                <li><span>SpO2</span><strong>95 – 100 %</strong></li>
                <li><span>Systolic BP</span><strong>90 – 120 mmHg</strong></li>
                <li><span>Diastolic BP</span><strong>60 – 80 mmHg</strong></li>
                <li><span>Hemoglobin</span><strong>12 – 17.5 g/dL</strong></li>
                <li><span>WBC</span><strong>4 – 11 ×10⁹/L</strong></li>
                <li><span>Platelets</span><strong>150 – 450 ×10⁹/L</strong></li>
                <li><span>Glucose</span><strong>70 – 140 mg/dL</strong></li>
              </ul>
            </div>
          </aside>
        </section>

        {/* ── Report + History ─────────────────────────────────────── */}
        <section className="grid grid-2 hub-bottom-grid">
          {/* Generated report panel */}
          <div className="card hub-panel report-panel">
            <div className="panel-head">
              <div>
                <h2>Generated report</h2>
                <p className="text-muted">Fresh analysis after the latest intake.</p>
              </div>
              {analysis && (
                <span className={`report-pill report-pill-${pillVariant(analysis.status)}`}>
                  {analysis.status}
                </span>
              )}
            </div>

            {!analysis ? (
              <p className="empty-state">Submit a reading to generate the report.</p>
            ) : (
              <div className="report-content">
                <div className="score-ring">
                  <strong>{analysis.score}</strong>
                  <span>Health Score</span>
                </div>
                <div>
                  <h3>Interpretation</h3>
                  <p>
                    {analysis.status === 'Stable'
                      ? 'The reading is broadly within the expected range.'
                      : 'One or more readings deserve attention and follow-up.'}
                  </p>
                  <h3 className="mt-3">Cancer-aware observations</h3>
                  {analysis.cancerAwareSignals.length === 0 ? (
                    <p className="text-muted">
                      No strong cancer-related signal patterns were triggered from this reading.
                    </p>
                  ) : (
                    <ul className="report-list">
                      {analysis.cancerAwareSignals.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {analysis && (
              <div className="report-footer">
                <div>
                  <span className="muted-label">Top flags</span>
                  <ul className="report-list compact">
                    {analysis.topFlags.length > 0 ? (
                      analysis.topFlags.map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No abnormal readings detected.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <span className="muted-label">Recommendations</span>
                  <ul className="report-list compact">
                    {analysis.recommendations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {savedAt && <p className="saved-note">Saved locally at {savedAt}.</p>}
          </div>

          {/* Latest device log — uses vitals history only */}
          <div className="card hub-panel history-panel">
            <div className="panel-head">
              <div>
                <h2>Latest device log</h2>
                <p className="text-muted">Recent readings from the local history.</p>
              </div>
              {vitalsHistory.length > 0 && (
                <span className="history-count">{vitalsHistory.length} record{vitalsHistory.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            <div className="history-list">
              {vitalsHistory.length === 0 ? (
                <p className="empty-state">No saved health readings yet.</p>
              ) : (
                vitalsHistory.map((entry) => {
                  // Guard against records with missing analysis
                  const status = entry?.analysis?.status ?? 'Unknown';
                  const score = entry?.analysis?.score ?? '—';
                  const device = entry?.deviceName ?? 'Unknown device';
                  const time = entry?.createdAt
                    ? new Date(entry.createdAt).toLocaleString()
                    : '—';

                  return (
                    <article key={entry.id} className="history-item">
                      <div className="history-item-info">
                        <strong>{device}</strong>
                        <p>{time}</p>
                        <p className="history-source">{entry.source || 'manual'}</p>
                      </div>
                      <div className="history-score">
                        <span
                          className={`history-status history-status-${pillVariant(status)}`}
                        >
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
