import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import './Auth.css';

function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState(searchParams.get('role') === 'doctor' ? 'doctor' : 'patient');
  const [form, setForm] = useState({ email: '', password: '', rememberMe: true });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const description = useMemo(() => (
    role === 'doctor'
      ? 'Access review queues, patient management, analytics, and medical reports.'
      : 'Track screening history, upload scans, and review personal health analytics.'
  ), [role]);

  function handleSubmit(event) {
    event.preventDefault();
    try {
      const user = login({ role, email: form.email, password: form.password });
      navigate(user.role === 'doctor' ? '/doctor' : '/dashboard');
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    }
  }

  return (
    <div className="page auth-page">
      <div className="container auth-shell">
        <section className="card auth-visual">
          <div className="auth-visual-inner">
            <span className="auth-eyebrow"><ShieldCheck size={16} /> Secure clinical access</span>
            <h1 className="auth-visual-title">Sign in to your healthcare workspace.</h1>
            <p className="auth-visual-copy">{description}</p>

            <div className="auth-feature-grid">
              <div className="auth-feature-card">
                <Sparkles size={18} />
                <h3>Patient continuity</h3>
                <p>Reports, history, and vitals stay linked to the same account.</p>
              </div>
              <div className="auth-feature-card">
                <ShieldCheck size={18} />
                <h3>Role-aware access</h3>
                <p>Doctors and patients land in distinct dashboards with different tools.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="card auth-form-panel">
          <div className="card auth-form-panel">
            <div>
              <span className="section-kicker">Login</span>
              <h2>Welcome back</h2>
              <p className="text-muted">Use the role below to enter the correct portal.</p>
            </div>

            <div className="auth-role-switch">
              <button className={`auth-chip ${role === 'patient' ? 'active' : ''}`} onClick={() => setRole('patient')} type="button">Patient / User</button>
              <button className={`auth-chip ${role === 'doctor' ? 'active' : ''}`} onClick={() => setRole('doctor')} type="button">Doctor</button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label>Email</label>
                <input className="auth-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@hospital.com" required />
              </div>

              <div className="auth-field">
                <label>Password</label>
                <div className="auth-password-row">
                  <input className="auth-input" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter password" required />
                  <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-helper-row">
                <label className="auth-remember">
                  <input
                    type="checkbox"
                    checked={form.rememberMe}
                    onChange={(event) => setForm({ ...form, rememberMe: event.target.checked })}
                  />
                  <span>Remember me</span>
                </label>
                <Link className="auth-secondary-link" to="/register?role=patient">Create an account</Link>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <button className="btn btn-primary auth-submit" type="submit">
                <LogIn size={18} />
                Sign in to {role === 'doctor' ? 'Doctor Portal' : 'Patient Portal'}
              </button>

              <div className="auth-inline-row">
                <span className="text-muted">Forgot your password?</span>
                <a className="auth-secondary-link" href="mailto:support@geekyblinders.health">Reset via support</a>
              </div>

              <div className="auth-inline-row">
                <Link className="btn btn-outline" to="/auth">Back to account chooser</Link>
                <Link className="btn btn-secondary" to={`/register?role=${role}`}>Register now</Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
