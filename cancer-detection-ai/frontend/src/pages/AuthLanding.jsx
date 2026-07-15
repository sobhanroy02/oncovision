import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hospital, ShieldCheck, Stethoscope, Sparkles } from 'lucide-react';
import './Auth.css';

const ACCOUNT_TYPES = [
  {
    key: 'patient',
    label: 'Continue as Patient / User',
    description: 'Track screenings, upload scans, store reports, and review vitals.',
    icon: Hospital,
    accent: 'Patient portal',
  },
  {
    key: 'doctor',
    label: 'Continue as Doctor',
    description: 'Review cases, approve diagnostics, manage patients, and export reports.',
    icon: Stethoscope,
    accent: 'Doctor portal',
  },
];

function AuthLanding() {
  return (
    <div className="page auth-page">
      <div className="container auth-shell">
        <motion.section
          className="card auth-visual"
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="auth-visual-inner">
            <span className="auth-eyebrow"><ShieldCheck size={16} /> Hospital-grade AI platform</span>
            <h1 className="auth-visual-title">Choose the right clinical workspace for your role.</h1>
            <p className="auth-visual-copy">
              The platform supports patient monitoring, doctor review workflows, AI prediction, explainability,
              and report generation in a single premium healthcare experience.
            </p>

            <div className="auth-feature-grid">
              <div className="auth-feature-card">
                <Sparkles size={18} />
                <h3>Premium UX</h3>
                <p>Glass panels, clean typography, motion, and a hospital-ready color system.</p>
              </div>
              <div className="auth-feature-card">
                <ShieldCheck size={18} />
                <h3>Secure by design</h3>
                <p>Role-based flows, private history, and local fallback when the backend is unavailable.</p>
              </div>
            </div>

            <div className="grid grid-2">
              {ACCOUNT_TYPES.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="auth-feature-card">
                    <Icon size={20} />
                    <h3>{item.accent}</h3>
                    <p>{item.description}</p>
                    <Link className="btn btn-outline" to={`/register?role=${item.key}`}>
                      Start {item.key === 'patient' ? 'Patient' : 'Doctor'} Registration
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="card auth-form-panel"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <div className="auth-form-panel card">
            <div>
              <span className="section-kicker">Authentication</span>
              <h2>Pick an account type</h2>
              <p className="text-muted">Then continue to login or registration with the relevant workflow.</p>
            </div>

            <div className="auth-type-switch">
              {ACCOUNT_TYPES.map((item) => (
                <Link key={item.key} className="auth-chip" to={`/login?role=${item.key}`}>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="auth-helper-row">
              <Link className="auth-secondary-link" to="/login?role=patient">Login as Patient</Link>
              <Link className="auth-secondary-link" to="/login?role=doctor">Login as Doctor</Link>
            </div>

            <div className="auth-inline-row">
              <Link className="btn btn-primary" to="/login?role=patient">Open Login</Link>
              <Link className="btn btn-secondary" to="/register?role=patient">Create Account</Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default AuthLanding;
