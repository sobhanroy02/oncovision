/**
 * Top navigation bar with active-link highlighting, a connection status
 * indicator (green/red dot based on /api/health), and a responsive
 * hamburger menu for mobile.
 */
import React, { useEffect, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { checkHealth } from '../services/api';
import './Navbar.css';

function Navbar() {
  const [backendOnline, setBackendOnline] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      const ok = await checkHealth();
      if (mounted) setBackendOnline(ok);
    }

    poll();
    const interval = setInterval(poll, 15000); // poll every 15s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="nav-brand">
          <span className="logo-dot" />
          <span>CancerDetect <span className="text-secondary">AI</span></span>
        </Link>

        <button
          className="nav-toggle"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle navigation"
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>

        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/"            end className="nav-link"
                   onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/detect"      className="nav-link"
                   onClick={() => setMenuOpen(false)}>Detect</NavLink>
          <NavLink to="/dashboard"   className="nav-link"
                   onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
          <NavLink to="/health-hub"  className="nav-link"
                   onClick={() => setMenuOpen(false)}>Health Hub</NavLink>
          <NavLink to="/device-sync" className="nav-link"
                   onClick={() => setMenuOpen(false)}>Device Sync</NavLink>
          <NavLink to="/ai-assistant" className="nav-link"
                   onClick={() => setMenuOpen(false)}>AI Assistant</NavLink>
          <NavLink to="/about"       className="nav-link"
                   onClick={() => setMenuOpen(false)}>About</NavLink>

          <div className="nav-status" title={
            backendOnline === null ? 'Checking...'
            : backendOnline        ? 'Backend connected'
                                   : 'Backend offline'
          }>
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            <span className="status-text">
              {backendOnline === null ? 'Checking'
               : backendOnline        ? 'Online'
                                      : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;