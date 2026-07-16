import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText, FlaskConical, Hospital, Radar, Search, ShieldCheck, Users } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PortalShell from '../components/PortalShell';
import { useAuth } from '../components/AuthContext';
import { loadScreeningHistory } from '../services/reportStore';
import { loadVitalsHistory } from '../services/healthStore';
import './DoctorDashboard.css';

const sidebarLinks = [
  { to: '/doctor', label: 'Overview', icon: <Hospital size={16} /> },
  { to: '/dashboard', label: 'Patients', icon: <Users size={16} /> },
  { to: '/detect', label: 'AI Reports', icon: <Radar size={16} /> },
  { to: '/health-hub', label: 'Review Queue', icon: <FileText size={16} /> },
  { to: '/doctor#analytics', label: 'Analytics', icon: <BarChart size={16} /> },
  { to: '/device-sync', label: 'Research', icon: <FlaskConical size={16} /> },
  { to: '/ai-assistant', label: 'Assistant', icon: <ShieldCheck size={16} /> },
];

const COLORS = ['#EF4444', '#F59E0B', '#22C55E'];

function DoctorDashboard() {
  const { user } = useAuth();
  const screenings = useMemo(() => loadScreeningHistory(), []);
  const vitals = useMemo(() => loadVitalsHistory(), []);
  const [reviewedIds, setReviewedIds] = useState([]);

  // Filter sidebar links to hide patient-only items
  const filteredSidebarLinks = useMemo(() => {
    return sidebarLinks.filter((link) => link.label !== 'Patients');
  }, []);

  const metrics = {
    records: screenings.length,
    vitals: vitals.length,
    reviewed: reviewedIds.length,
    accuracy: screenings.length ? (screenings.filter((item) => item.riskLevel !== 'Unknown').length / screenings.length) * 100 : 0,
  };

  const cards = [
    { label: 'Today’s Schedule', value: Math.max(6, screenings.filter((item) => new Date(item.createdAt).toDateString() === new Date().toDateString()).length), note: 'Cases queued for review' },
    { label: 'Critical Alerts', value: screenings.filter((item) => item.riskLevel === 'High').length, note: 'Escalation recommended' },
    { label: 'Pending Reviews', value: Math.max(0, screenings.length - reviewedIds.length), note: 'Awaiting doctor decision' },
    { label: 'Average Confidence', value: `${metrics.accuracy.toFixed(1)}%`, note: 'Across reviewed cases' },
  ];

  const riskBreakdown = [
    { name: 'High', value: screenings.filter((item) => item.riskLevel === 'High').length },
    { name: 'Medium', value: screenings.filter((item) => item.riskLevel === 'Medium').length },
    { name: 'Low', value: screenings.filter((item) => item.riskLevel === 'Low').length },
  ].filter((item) => item.value > 0);

  const monthlyBars = useMemo(() => {
    const items = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setMonth(date.getMonth() - offset);
      const count = screenings.filter((entry) => {
        const entryDate = new Date(entry.createdAt);
        return entryDate.getMonth() === date.getMonth() && entryDate.getFullYear() === date.getFullYear();
      }).length;
      items.push({ month: date.toLocaleDateString([], { month: 'short' }), cases: count });
    }
    return items;
  }, [screenings]);

  const patientRows = screenings.slice(0, 8).map((entry, index) => ({
    id: entry.id || `${entry.createdAt}-${index}`,
    name: entry.patientName || `Patient ${index + 1}`,
    age: entry.age || '—',
    gender: entry.gender || '—',
    cancerType: entry.cancerType,
    prediction: entry.prediction,
    riskLevel: entry.riskLevel,
    reviewed: reviewedIds.includes(entry.id || `${entry.createdAt}-${index}`),
  }));

  return (
    <PortalShell
      eyebrow="Doctor portal"
      title={`Good Morning Doctor${user?.fullName ? `, ${user.fullName}` : ''}`}
      subtitle="Review patient cases, inspect explainability, and manage AI-assisted decisions from a hospital-grade clinical workspace."
      sidebarTitle="Doctor Dashboard"
      sidebarNote="Review queue, analytics, and research tools live here."
      sidebarLinks={filteredSidebarLinks}
      summaryCards={cards}
      actions={(
        <>
          <Link className="btn btn-secondary" to="/detect">Open AI Reports</Link>
          <Link className="btn btn-outline" to="/register?role=doctor">Invite Doctor</Link>
        </>
      )}
      aside={(
        <div className="portal-sidebar-aside">
          <div className="insight-card">
            <span className="stat-label">Compliance</span>
            <strong className="stat-value text-success">Approved</strong>
            <p className="text-muted">Session secured for clinical review workflows.</p>
          </div>
        </div>
      )}
    >
      <section className="doctor-hero card">
        <div>
          <div className="page-breadcrumb">Hospital Workspace / Clinical Review</div>
          <h2>Hospital Name</h2>
          <p className="text-muted">Today's schedule, critical alerts, and review workload in one place.</p>
        </div>
        <div className="page-meta-row">
          <span className="page-meta-chip">Today’s schedule</span>
          <span className="page-meta-chip">Critical alerts</span>
          <span className="page-meta-chip">Pending reviews</span>
        </div>
      </section>
      {/* HIGH PRIORITY CASES SECTION */}
      <section className="doctor-priority-cases">
        <motion.div className="card doctor-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>High Priority Cases</h2>
              <p className="text-muted">Cases requiring immediate clinical attention.</p>
            </div>
            {screenings.filter((item) => item.riskLevel === 'High').length > 0 && (
              <div className="priority-badge">{screenings.filter((item) => item.riskLevel === 'High').length} Critical</div>
            )}
          </div>

          <div className="priority-cases-grid">
            {screenings.filter((item) => item.riskLevel === 'High').length === 0 ? (
              <p className="empty-state">No critical cases at this moment. All cases are stable.</p>
            ) : (
              screenings
                .filter((item) => item.riskLevel === 'High')
                .slice(0, 4)
                .map((item, index) => (
                  <motion.div
                    key={item.id || `${item.createdAt}-${index}`}
                    className="priority-case-card"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="case-header">
                      <span className="case-id">Case #{index + 1}</span>
                      <span className="risk-pill risk-high">High Risk</span>
                    </div>
                    <div className="case-details">
                      <p><strong>Patient:</strong> {item.patientName || 'Patient'}</p>
                      <p><strong>Age:</strong> {item.age || '—'}</p>
                      <p><strong>Cancer Type:</strong> {item.cancerType}</p>
                      <p><strong>Prediction:</strong> {item.prediction}</p>
                      <p><strong>Confidence:</strong> {Number.isFinite(item.confidence) ? `${item.confidence}%` : '—'}</p>
                    </div>
                    <button className="mini-btn" onClick={() => setReviewedIds((ids) => [...new Set([...ids, item.id || `${item.createdAt}-${index}`])])}>
                      <CheckCircle2 size={14} /> Review Now
                    </button>
                  </motion.div>
                ))
            )}
          </div>
        </motion.div>
      </section>
      <section className="doctor-top-grid">
        <motion.div className="card doctor-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Patients and AI diagnoses</h2>
              <p className="text-muted">Search, approve, reject, and annotate cases from the table below.</p>
            </div>
            <div className="doctor-search-chip"><Search size={16} /> Global search ready</div>
          </div>

          <div className="doctor-table-wrap">
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Cancer Type</th>
                  <th>Prediction</th>
                  <th>Risk</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patientRows.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <p className="empty-state">No cases available yet. Run a detection to populate review items.</p>
                    </td>
                  </tr>
                ) : patientRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.age}</td>
                    <td>{row.gender}</td>
                    <td>{row.cancerType}</td>
                    <td>{row.prediction}</td>
                    <td><span className={`risk-pill risk-${String(row.riskLevel || 'low').toLowerCase()}`}>{row.riskLevel}</span></td>
                    <td>{row.reviewed ? 'Reviewed' : 'Pending'}</td>
                    <td className="doctor-actions-cell">
                      <button className="mini-btn" onClick={() => setReviewedIds((items) => [...new Set([...items, row.id])])}>
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button className="mini-btn mini-btn-outline">Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div className="card doctor-panel" id="analytics" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="panel-head">
            <div>
              <h2>Doctor analytics</h2>
              <p className="text-muted">Clinical volume, risk distribution, and case trends.</p>
            </div>
          </div>

          <div className="doctor-mini-metrics">
            <div className="mini-metric"><strong>{metrics.records}</strong><span>Total diagnoses</span></div>
            <div className="mini-metric"><strong>{metrics.vitals}</strong><span>Vitals records</span></div>
            <div className="mini-metric"><strong>{metrics.reviewed}</strong><span>Reviewed today</span></div>
            <div className="mini-metric"><strong>{metrics.accuracy.toFixed(1)}%</strong><span>Coverage</span></div>
          </div>

          <div className="doctor-chart-grid">
            <div className="chart-box">
              <h3>Case volume</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="cases" radius={[10, 10, 0, 0]} fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-box">
              <h3>Risk distribution</h3>
              {riskBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={riskBreakdown} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={5}>
                      {riskBreakdown.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="empty-state">No risk data yet.</p>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    </PortalShell>
  );
}

export default DoctorDashboard;
