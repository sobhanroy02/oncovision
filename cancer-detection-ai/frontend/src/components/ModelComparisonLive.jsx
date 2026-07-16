/* Live 4-model comparison: accuracy, precision, sensitivity, specificity, F1, AUC-ROC.
   Fetches /api/model-info on mount and on a polling interval so the numbers
   reflect the live backend. Recharts visualisations: grouped bar (all metrics)
   + radar (per-model profile) + per-metric leaderboard cards. */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Crown,
  Gauge,
  Radio,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getModelInfo } from '../services/api';
import { DEMO_MODEL_SNAPSHOT } from '../constants/modelSnapshot';
import './ModelComparisonLive.css';

const METRIC_KEYS = ['accuracy', 'precision', 'sensitivity', 'specificity', 'f1_score', 'auc_roc'];
const METRIC_LABELS = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  sensitivity: 'Sensitivity',
  specificity: 'Specificity',
  f1_score: 'F1 Score',
  auc_roc: 'AUC-ROC',
};
const METRIC_HINTS = {
  accuracy: 'Overall correct predictions',
  precision: 'Of predicted cancers, how many are real',
  sensitivity: 'True positive rate',
  specificity: 'True negative rate',
  f1_score: 'Harmonic mean of precision and sensitivity',
  auc_roc: 'Area under the ROC curve',
};

const MODEL_COLORS = ['#1A3C6E', '#0D7377', '#2563EB', '#14B8A6', '#7C3AED', '#DB2777'];

function formatPercent(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return `${(v * 100).toFixed(1)}%`;
  return v;
}

function shortName(fullName) {
  if (!fullName) return 'Model';
  return fullName.replace(/\s*\(.*?\)\s*/g, '').trim();
}

function ModelComparisonLive() {
  const [models, setModels] = useState(DEMO_MODEL_SNAPSHOT.models);
  const [metricDescriptions, setMetricDescriptions] = useState(
    DEMO_MODEL_SNAPSHOT.metric_descriptions || {},
  );
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [source, setSource] = useState('snapshot'); // 'live' | 'snapshot'

  const fetchModels = async () => {
    setLoading(true);
    try {
      const data = await getModelInfo();
      if (data?.models?.length) {
        setModels(data.models);
        if (data.metric_descriptions) {
          setMetricDescriptions(data.metric_descriptions);
        }
        setSource('live');
        setLastUpdated(new Date());
      }
    } catch (_err) {
      // Backend offline → keep the snapshot so the UI still renders
      setSource('snapshot');
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    // Live polling — refresh every 30s so the comparison stays current
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, []);

  // Grouped bar chart: x-axis = metric, one bar per model
  const groupedData = useMemo(() => {
    return METRIC_KEYS.map((key) => {
      const row = { metric: METRIC_LABELS[key] };
      models.forEach((m, idx) => {
        const v = m.metrics?.[key];
        row[`m${idx}`] = v !== null && v !== undefined ? +(v * 100).toFixed(2) : 0;
      });
      return row;
    });
  }, [models]);

  // Radar chart data: one series per model
  const radarData = useMemo(() => {
    return METRIC_KEYS.map((key) => {
      const row = { metric: METRIC_LABELS[key] };
      models.forEach((m) => {
        const v = m.metrics?.[key];
        row[m.name] = v !== null && v !== undefined ? +(v * 100).toFixed(2) : 0;
      });
      return row;
    });
  }, [models]);

  // Per-metric leaderboard: which model wins on each metric
  const leaderboard = useMemo(() => {
    return METRIC_KEYS.map((key) => {
      let winner = null;
      let bestVal = -Infinity;
      const standings = models.map((m) => {
        const v = m.metrics?.[key];
        if (v !== null && v !== undefined && v > bestVal) {
          bestVal = v;
          winner = m.name;
        }
        return { name: m.name, value: v };
      });
      return {
        key,
        label: METRIC_LABELS[key],
        hint: metricDescriptions?.[key] || METRIC_HINTS[key],
        winner,
        winnerValue: bestVal === -Infinity ? null : bestVal,
        standings: standings.sort((a, b) => (b.value ?? -1) - (a.value ?? -1)),
      };
    });
  }, [models, metricDescriptions]);

  // Best overall model by average score across all metrics
  const bestOverall = useMemo(() => {
    if (!models.length) return null;
    const ranked = models.map((m) => {
      const vals = METRIC_KEYS.map((k) => m.metrics?.[k]).filter((v) => typeof v === 'number');
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
      return { model: m, avg };
    }).sort((a, b) => b.avg - a.avg);
    return ranked[0] || null;
  }, [models]);

  if (!models.length) {
    return (
      <div className="card model-comparison-card">
        <p className="empty-state">No model metrics available yet. Train the models to populate this view.</p>
      </div>
    );
  }

  return (
    <section className="card model-comparison-card" id="model-comparison">
      <div className="panel-head">
        <div>
          <span className="section-kicker">Live comparison</span>
          <h2>4-Model performance benchmark</h2>
          <p className="text-muted">
            Accuracy, precision, sensitivity, specificity, F1 and AUC-ROC for every
            trained model — updated live from the backend.
          </p>
        </div>
        <div className="model-comparison-controls">
          <span className={`live-indicator ${source === 'live' ? 'is-live' : 'is-snapshot'}`}>
            <Radio size={12} />
            {source === 'live' ? 'Live' : 'Snapshot'}
          </span>
          <button
            type="button"
            className="btn btn-outline model-refresh-btn"
            onClick={fetchModels}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'is-spinning' : ''} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {bestOverall && (
        <motion.div
          className="model-winner-banner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="model-winner-icon"><Trophy size={20} /></div>
          <div className="model-winner-text">
            <span className="section-kicker">Top performer</span>
            <strong>{bestOverall.model.name}</strong>
            <span>
              {formatPercent(bestOverall.avg)} average across {METRIC_KEYS.length} metrics
              {bestOverall.model.framework ? ` · ${bestOverall.model.framework}` : ''}
            </span>
          </div>
          <div className="model-winner-stats">
            <span><Target size={12} /> Accuracy {formatPercent(bestOverall.model.metrics?.accuracy)}</span>
            <span><Sparkles size={12} /> Precision {formatPercent(bestOverall.model.metrics?.precision)}</span>
            <span><Activity size={12} /> F1 {formatPercent(bestOverall.model.metrics?.f1_score)}</span>
          </div>
        </motion.div>
      )}

      <div className="model-comparison-grid">
        <div className="chart-box model-chart-box">
          <div className="model-chart-head">
            <h3><BarChart3 size={16} /> Grouped bar — all metrics</h3>
            <span className="text-muted">Higher is better</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={groupedData} margin={{ top: 16, right: 20, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
              <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v, name) => [`${v}%`, name]}
                contentStyle={{ borderRadius: 12, border: '1px solid #cbd5e1' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {models.map((m, idx) => (
                <Bar
                  key={m.name}
                  dataKey={`m${idx}`}
                  name={shortName(m.name)}
                  fill={MODEL_COLORS[idx % MODEL_COLORS.length]}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box model-chart-box">
          <div className="model-chart-head">
            <h3><Gauge size={16} /> Radar — per-model profile</h3>
            <span className="text-muted">All six metrics on one chart</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} outerRadius={110}>
              <PolarGrid stroke="rgba(148,163,184,0.4)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {models.map((m, idx) => (
                <Radar
                  key={m.name}
                  name={shortName(m.name)}
                  dataKey={m.name}
                  stroke={MODEL_COLORS[idx % MODEL_COLORS.length]}
                  fill={MODEL_COLORS[idx % MODEL_COLORS.length]}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="model-leaderboard">
        <div className="model-leaderboard-head">
          <h3><Crown size={16} /> Per-metric leaderboard</h3>
          <span className="text-muted">Top model on each evaluation metric</span>
        </div>
        <div className="model-leaderboard-grid">
          {leaderboard.map((row) => (
            <motion.article
              key={row.key}
              className="model-leader-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="model-leader-head">
                <strong>{row.label}</strong>
                <span className="text-muted">{row.hint}</span>
              </div>
              <div className="model-leader-winner">
                <Crown size={14} />
                <span>{row.winner ? shortName(row.winner) : 'No data'}</span>
                <span className="model-leader-score">{formatPercent(row.winnerValue)}</span>
              </div>
              <ul className="model-leader-list">
                {row.standings.map((entry, idx) => (
                  <li
                    key={entry.name}
                    className={idx === 0 ? 'is-leader' : ''}
                  >
                    <span className="model-leader-rank">#{idx + 1}</span>
                    <span className="model-leader-name">{shortName(entry.name)}</span>
                    <span className="model-leader-value">
                      <span
                        className="model-leader-bar"
                        style={{
                          width: `${entry.value !== null && entry.value !== undefined ? entry.value * 100 : 0}%`,
                          background: MODEL_COLORS[models.findIndex((m) => m.name === entry.name) % MODEL_COLORS.length],
                        }}
                      />
                      <span className="model-leader-pct">{formatPercent(entry.value)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </motion.article>
          ))}
        </div>
      </div>

      <div className="model-foot-meta">
        <span><TrendingUp size={12} /> {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Awaiting first sync'}</span>
        <span>Polling every 30s · {models.length} models tracked</span>
      </div>
    </section>
  );
}

export default ModelComparisonLive;
