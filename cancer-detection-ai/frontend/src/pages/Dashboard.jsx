import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BellRing,
  Brain,
  Clock3,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Microscope,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
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
import PortalShell from '../components/PortalShell';
import { getHealthStatus, getModelInfo } from '../services/api';
import { clearScreeningHistory, loadScreeningHistory } from '../services/reportStore';
import { getLatestVitalsRecord, loadVitalsHistory } from '../services/healthStore';
import { DEMO_MODEL_SNAPSHOT } from '../constants/modelSnapshot';
import { useAuth } from '../components/AuthContext';
import './Dashboard.css';

const sidebarLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { to: '/detect', label: 'Cancer Detection', icon: <Microscope size={16} /> },
  { to: '/dashboard#history', label: 'Prediction History', icon: <Clock3 size={16} /> },
  { to: '/dashboard#reports', label: 'Medical Reports', icon: <FileText size={16} /> },
  { to: '/dashboard#explainability', label: 'Explainability', icon: <Brain size={16} /> },
  { to: '/device-sync', label: 'Appointments', icon: <HeartPulse size={16} /> },
  { to: '/ai-assistant', label: 'Notifications', icon: <BellRing size={16} /> },
  { to: '/dashboard#profile', label: 'Profile', icon: <ShieldCheck size={16} /> },
];

const RISK_COLORS = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#22C55E',
  Unknown: '#64748B',
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

function Dashboard() {
  const { user } = useAuth();
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
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
      if (modelResult.status === 'fulfilled' && modelResult.value?.models?.length) {
        setModelInfo(modelResult.value.models);
      } else {
        setModelInfo(DEMO_MODEL_SNAPSHOT.models);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const latestVitals = getLatestVitalsRecord() || vitalsHistory[0] || null;
  const recentRecords = history.slice(0, 6);
  const todayRecords = useMemo(() => history.filter((entry) => new Date(entry.createdAt).toDateString() === new Date().toDateString()), [history]);

  const summary = useMemo(() => {
    const avgConfidence = todayRecords.length
      ? todayRecords.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / todayRecords.length
      : null;
    return {
      total: history.length,
      today: todayRecords.length,
      avgConfidence,
      highRisk: history.filter((item) => item.riskLevel === 'High').length,
    };
  }, [history, todayRecords]);

  const timeline = useMemo(() => {
    const rows = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      rows.push({
        day: date.toLocaleDateString([], { weekday: 'short' }),
        uploads: history.filter((entry) => new Date(entry.createdAt).toDateString() === date.toDateString()).length,
      });
    }
    return rows;
  }, [history]);

  const riskBreakdown = [
    { name: 'High', value: history.filter((item) => item.riskLevel === 'High').length },
    { name: 'Medium', value: history.filter((item) => item.riskLevel === 'Medium').length },
    { name: 'Low', value: history.filter((item) => item.riskLevel === 'Low').length },
  ].filter((item) => item.value > 0);

  const confidenceTrend = recentRecords.slice().reverse().map((entry, index) => ({
    name: `#${index + 1}`,
    confidence: Number.isFinite(entry.confidence) ? entry.confidence : 0,
  }));

  const recommendations = [
    summary.total === 0 ? 'Upload your first scan to activate the dashboard.' : null,
    summary.highRisk > 0 ? 'A high-risk record is present and should be reviewed by a doctor.' : null,
    latestVitals?.analysis?.status && latestVitals.analysis.status !== 'Stable' ? `Latest vitals reading is ${latestVitals.analysis.status.toLowerCase()}.` : null,
    'Use the AI assistant for quick clinical explanations and report summaries.',
  ].filter(Boolean);

  function handleClearHistory() {
    clearScreeningHistory();
    setHistory([]);
  }

  return (
    <PortalShell
      eyebrow="Patient workspace"
      title={`Welcome back${user?.fullName ? `, ${user.fullName}` : ''}`}
      subtitle="Track cancer screenings, review your latest diagnosis, and move between reports, explainability, and care follow-up from one secure dashboard."
      sidebarTitle="Patient Dashboard"
      sidebarNote="Your screenings, reports, and monitoring tools are grouped here."
      sidebarLinks={sidebarLinks}
      summaryCards={[
        { label: 'Total Predictions', value: summary.total, note: 'Saved locally in this browser' },
        { label: 'Last Diagnosis', value: history[0]?.prediction || '—', note: history[0]?.riskLevel || 'No analysis yet' },
        { label: 'Detection Accuracy', value: modelInfo?.[0]?.metrics?.accuracy ? `${(modelInfo[0].metrics.accuracy * 100).toFixed(1)}%` : '—', note: 'Model snapshot' },
        { label: 'Recent Upload', value: history[0] ? formatWhen(history[0].createdAt) : '—', note: 'Latest local record' },
      ]}
      actions={(
        <>
          <Link className="btn btn-primary" to="/detect"><ScanSearch size={16} /> Upload Image</Link>
          <button className="btn btn-outline" onClick={handleClearHistory}>Clear Local History</button>
        </>
      )}
    >
      <section className="dashboard-action-row">
        <motion.div className="card dashboard-panel hero-note" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div>
            <span className="section-kicker">Quick actions</span>
            <h2>Fast clinical workflows</h2>
            <p className="text-muted">Run a screening, open the Health Hub, and review the latest report trail.</p>
          </div>
          <div className="quick-action-grid">
            <Link className="quick-action-card" to="/detect">
              <Microscope size={20} />
              <span>Upload blood smear</span>
            </Link>
            <Link className="quick-action-card" to="/detect?type=uterine">
              <Sparkles size={20} />
              <span>Upload histopathology</span>
            </Link>
            <Link className="quick-action-card" to="/health-hub">
              <HeartPulse size={20} />
              <span>Open Health Hub</span>
            </Link>
            <Link className="quick-action-card" to="/ai-assistant">
              <BellRing size={20} />
              <span>Contact Doctor</span>
            </Link>
          </div>
        </motion.div>

        <motion.div className="card dashboard-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Recent activity timeline</h2>
              <p className="text-muted">Upload and review history across the last week.</p>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="uploads" radius={[10, 10, 0, 0]} fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </section>

      <section className="dashboard-dual-grid">
        <motion.div id="history" className="card dashboard-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Prediction history</h2>
              <p className="text-muted">Most recent cancer screening results from your browser history.</p>
            </div>
            <Link to="/detect" className="btn btn-outline">Run screening</Link>
          </div>

          <div className="report-list-grid">
            {history.length === 0 ? (
              <p className="empty-state">No saved screenings yet.</p>
            ) : history.slice(0, 5).map((entry, index) => (
              <article className="report-list-item" key={`${entry.createdAt}-${index}`}>
                <div>
                  <strong>{entry.cancerType}</strong>
                  <p>{entry.prediction} · {entry.riskLevel} risk</p>
                </div>
                <div>
                  <span>{formatWhen(entry.createdAt)}</span>
                  <strong>{Number.isFinite(entry.confidence) ? `${entry.confidence}%` : '—'}</strong>
                </div>
              </article>
            ))}
          </div>
        </motion.div>

        <motion.div id="reports" className="card dashboard-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Latest reports</h2>
              <p className="text-muted">Generate complete medical-style summaries from the latest analysis.</p>
            </div>
          </div>
          {history[0] ? (
            <div className="report-summary-card">
              <span className={`report-pill ${history[0].riskLevel === 'High' ? 'report-pill-alert' : 'report-pill-safe'}`}>
                {history[0].riskLevel}
              </span>
              <h3>{history[0].prediction}</h3>
              <p>{history[0].fileName || 'Uploaded scan'} · Confidence {Number.isFinite(history[0].confidence) ? `${history[0].confidence}%` : '—'}</p>
              <div className="report-actions-inline">
                <button className="btn btn-secondary">Download PDF</button>
                <button className="btn btn-outline">Print</button>
              </div>
            </div>
          ) : (
            <p className="empty-state">Run a screening to generate a report.</p>
          )}
        </motion.div>
      </section>

      <section id="explainability" className="dashboard-dual-grid">
        <motion.div className="card dashboard-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Explainability</h2>
              <p className="text-muted">Confidence trend, risk split, and model status in one view.</p>
            </div>
          </div>

          <div className="dashboard-chart-grid">
            <div className="chart-box">
              <h3>Confidence trend</h3>
              {confidenceTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={confidenceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Line type="monotone" dataKey="confidence" stroke="#1D4ED8" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="empty-state">Run a screening to populate trend data.</p>}
            </div>

            <div className="chart-box">
              <h3>Risk distribution</h3>
              {riskBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={riskBreakdown} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={4}>
                      {riskBreakdown.map((entry, index) => <Cell key={entry.name} fill={RISK_COLORS[entry.name] || ['#EF4444','#F59E0B','#22C55E'][index % 3]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="empty-state">Risk distribution will appear here after screening.</p>}
            </div>
          </div>
        </motion.div>

        <motion.div id="profile" className="card dashboard-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Profile and notifications</h2>
              <p className="text-muted">Account info, reminders, and backend status.</p>
            </div>
          </div>

          <div className="profile-mini-card">
            <strong>{user?.fullName || 'Patient profile'}</strong>
            <span>{user?.email || 'No account linked'}</span>
            <span>{user?.bloodGroup ? `Blood Group: ${user.bloodGroup}` : 'Medical record synced locally'}</span>
          </div>

          <ul className="notification-list">
            {recommendations.map((item) => <li key={item}>{item}</li>)}
          </ul>

          <div className="model-status-grid">
            {modelInfo.map((model) => (
              <div className="model-status-card" key={model.name}>
                <strong>{model.name}</strong>
                <span>{model.architecture}</span>
                <small>{model.metrics?.accuracy ? `Accuracy ${(model.metrics.accuracy * 100).toFixed(1)}%` : 'Metrics loaded from local snapshot'}</small>
              </div>
            ))}
          </div>

          <div className="backend-banner">
            <strong>Backend status:</strong>
            <span>{health?.status === 'ok' ? 'Online' : 'Offline'}</span>
            <small>{health?.mock_mode ? 'Model fallback available if needed' : 'Trained models active'}</small>
          </div>
        </motion.div>
      </section>
    </PortalShell>
  );
}

export default Dashboard;
