import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <span className="section-kicker light">Hospital AI Platform</span>
          <h3>AI Cancer Detection and Diagnosis System</h3>
          <p>
            Built for patient screening, doctor review, explainability, and research-grade demonstrations.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/auth">Auth</Link>
          <Link to="/dashboard">Patient Dashboard</Link>
          <Link to="/doctor">Doctor Dashboard</Link>
          <Link to="/detect">AI Detection</Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;