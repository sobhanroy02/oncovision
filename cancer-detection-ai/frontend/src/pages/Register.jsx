import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, ShieldCheck, UserPlus, Stethoscope } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import './Auth.css';

const BASE_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  age: '',
  gender: '',
  bloodGroup: '',
  medicalHistory: '',
  profilePhoto: '',
  hospitalName: '',
  medicalRegistrationNumber: '',
  specialization: '',
  experience: '',
};

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read profile photo.'));
    reader.readAsDataURL(file);
  });
}

function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [role, setRole] = useState(searchParams.get('role') === 'doctor' ? 'doctor' : 'patient');
  const [form, setForm] = useState(BASE_FORM);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => (role === 'doctor' ? 'Doctor registration' : 'Patient registration'), [role]);

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setForm((current) => ({ ...current, profilePhoto: dataUrl }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const user = register({ role, ...form });
      navigate(user.role === 'doctor' ? '/doctor' : '/dashboard');
    } catch (registerError) {
      setError(registerError.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="container auth-shell">
        <section className="card auth-visual">
          <div className="auth-visual-inner">
            <span className="auth-eyebrow"><ShieldCheck size={16} /> Role-aware onboarding</span>
            <h1 className="auth-visual-title">Register for {role === 'doctor' ? 'doctor' : 'patient'} access.</h1>
            <p className="auth-visual-copy">
              Create a secure profile to unlock personalized dashboards, AI prediction history, medical reports,
              and explainability views.
            </p>

            <div className="auth-feature-grid">
              <div className="auth-feature-card">
                <UserPlus size={18} />
                <h3>Patient workflow</h3>
                <p>Daily vitals, upload history, report downloads, and AI screening remain in one place.</p>
              </div>
              <div className="auth-feature-card">
                <Stethoscope size={18} />
                <h3>Doctor workflow</h3>
                <p>Review queue, approvals, analytics, and case notes are ready from the first login.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="card auth-form-panel">
          <div className="card auth-form-panel">
            <div>
              <span className="section-kicker">Registration</span>
              <h2>{title}</h2>
              <p className="text-muted">Fill the role-specific details and start using the platform.</p>
            </div>

            <div className="auth-role-switch">
              <button className={`auth-chip ${role === 'patient' ? 'active' : ''}`} onClick={() => setRole('patient')} type="button">Patient / User</button>
              <button className={`auth-chip ${role === 'doctor' ? 'active' : ''}`} onClick={() => setRole('doctor')} type="button">Doctor</button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label>{role === 'doctor' ? 'Doctor Name' : 'Full Name'}</label>
                <input className="auth-input" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
              </div>

              <div className="auth-row">
                <div className="auth-field">
                  <label>Email</label>
                  <input className="auth-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </div>
                <div className="auth-field">
                  <label>Phone</label>
                  <input className="auth-input" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
                </div>
              </div>

              {role === 'patient' ? (
                <>
                  <div className="auth-row">
                    <div className="auth-field">
                      <label>Age</label>
                      <input className="auth-input" type="number" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} required />
                    </div>
                    <div className="auth-field">
                      <label>Gender</label>
                      <select className="auth-select" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} required>
                        <option value="">Select gender</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="auth-row">
                    <div className="auth-field">
                      <label>Blood Group</label>
                      <input className="auth-input" value={form.bloodGroup} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })} placeholder="O+, A-, B+..." required />
                    </div>
                    <div className="auth-field">
                      <label>Profile Photo</label>
                      <input className="auth-input" type="file" accept="image/*" onChange={handlePhoto} />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label>Medical History (optional)</label>
                    <textarea className="auth-textarea" value={form.medicalHistory} onChange={(event) => setForm({ ...form, medicalHistory: event.target.value })} placeholder="Allergies, previous screenings, chronic conditions..." />
                  </div>
                </>
              ) : (
                <>
                  <div className="auth-row">
                    <div className="auth-field">
                      <label>Hospital Name</label>
                      <input className="auth-input" value={form.hospitalName} onChange={(event) => setForm({ ...form, hospitalName: event.target.value })} required />
                    </div>
                    <div className="auth-field">
                      <label>Medical Registration Number</label>
                      <input className="auth-input" value={form.medicalRegistrationNumber} onChange={(event) => setForm({ ...form, medicalRegistrationNumber: event.target.value })} required />
                    </div>
                  </div>

                  <div className="auth-row">
                    <div className="auth-field">
                      <label>Specialization</label>
                      <input className="auth-input" value={form.specialization} onChange={(event) => setForm({ ...form, specialization: event.target.value })} required />
                    </div>
                    <div className="auth-field">
                      <label>Experience</label>
                      <input className="auth-input" value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} placeholder="10 years" required />
                    </div>
                  </div>

                  <div className="auth-field">
                    <label>Profile Photo</label>
                    <input className="auth-input" type="file" accept="image/*" onChange={handlePhoto} />
                  </div>
                </>
              )}

              <div className="auth-row">
                <div className="auth-field">
                  <label>Password</label>
                  <input className="auth-input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </div>
                <div className="auth-field">
                  <label>Confirm Password</label>
                  <input className="auth-input" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required />
                </div>
              </div>

              <div className="auth-helper-row">
                <label className="auth-remember">
                  <input type="checkbox" required />
                  <span>I accept the privacy policy</span>
                </label>
                <Link className="auth-secondary-link" to="/login?role=patient">Already have an account?</Link>
              </div>

              {error && <p className="error-msg">{error}</p>}

              <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
                <Upload size={18} />
                {loading ? 'Creating account...' : 'Register'}
              </button>

              <div className="auth-inline-row">
                <Link className="btn btn-outline" to="/auth">Back to chooser</Link>
                <Link className="btn btn-secondary" to={`/login?role=${role}`}>Sign in instead</Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Register;
