/**
 * Displays model performance metrics using recharts bar charts.
 * Pass an array of model objects (from /api/model-info).
 */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import './ModelMetrics.css';

const METRIC_KEYS = ['accuracy', 'sensitivity', 'specificity', 'f1_score', 'auc_roc'];
const METRIC_LABELS = {
  accuracy:    'Accuracy',
  sensitivity: 'Sensitivity',
  specificity: 'Specificity',
  f1_score:    'F1 Score',
  auc_roc:     'AUC-ROC',
};

function formatPercent(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return (v * 100).toFixed(1) + '%';
  return v;
}

function ModelMetrics({ models }) {
  if (!models || models.length === 0) {
    return (
      <div className="model-metrics card">
        <p className="text-muted text-center">
          Model performance metrics are not yet available.
          Train the models to see results here.
        </p>
      </div>
    );
  }

  // Data for the grouped bar chart
  const chartData = METRIC_KEYS.map((key) => {
    const row = { metric: METRIC_LABELS[key] };
    models.forEach((m) => {
      const v = m.metrics?.[key];
      row[m.name] = v !== null && v !== undefined ? +(v * 100).toFixed(2) : 0;
    });
    return row;
  });

  return (
    <div className="model-metrics">
      {/* Numeric cards */}
      <div className="grid grid-2 mb-3">
        {models.map((m, i) => (
          <div key={i} className="card model-card">
            <h3 className="model-name">{m.name}</h3>
            <p className="text-muted model-arch">{m.architecture}</p>
            <div className="metric-grid">
              {METRIC_KEYS.map((k) => (
                <div key={k} className="metric-item">
                  <div className="metric-num">{formatPercent(m.metrics?.[k])}</div>
                  <div className="metric-name">{METRIC_LABELS[k]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Comparison chart */}
      <div className="card">
        <h3>Performance Comparison</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="metric" />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v) => `${v}%`} />
            <Legend />
            <Bar dataKey={models[0]?.name} fill="#1A3C6E" radius={[4, 4, 0, 0]} />
            {models[1] && (
              <Bar dataKey={models[1].name} fill="#0D7377" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ModelMetrics;