/**
 * Premium top navigation bar with centered search, backend status,
 * account menu, and responsive mobile navigation.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { BellRing, ChevronDown, LogOut, Menu, Search, ShieldCheck, Stethoscope, UserRound, UserRoundPlus, LayoutDashboard } from 'lucide-react';
import { checkHealth } from '../services/api';
import { useAuth } from './AuthContext';
import './Navbar.css';

function Navbar() {
  const [backendOnline, setBackendOnline] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const profileRef = useRef(null);

  const routeLabel = useMemo(() => {
    const pathname = window.location.pathname;
    const routes = {
      '/': 'Home',
      '/auth': 'Auth',
      '/login': 'Login',
      '/register': 'Register',
      '/detect': 'AI Detection',
      '/dashboard': 'Patient Dashboard',
      '/doctor': 'Doctor Dashboard',
      '/health-hub': 'Health Hub',
      '/device-sync': 'Device Sync',
      '/ai-assistant': 'AI Assistant',
      '/about': 'About',
    };

    return routes[pathname] || 'Clinical Workspace';
  }, []);

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      <div className="container nav-inner">
        <div className="nav-brand-block">
          <Link to="/" className="nav-brand">
            <span className="logo-dot" />
            <span>Geeky Blinders <span className="text-secondary">Health AI</span></span>
          </Link>
          <span className="nav-breadcrumb">{routeLabel}</span>
        </div>

        <div className="nav-search-wrap" role="search">
          <Search size={16} />
          <input
            className="nav-search"
            type="search"
            placeholder="Search patients, reports, models..."
            aria-label="Search"
          />
          <kbd className="nav-search-kbd">Ctrl K</kbd>
        </div>

        <div className="nav-actions">
          <button className="nav-icon-btn" type="button" aria-label="Notifications">
            <BellRing size={18} />
            <span className="nav-notification-dot" />
          </button>

          <button
            className="nav-toggle"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <Menu size={20} />
          </button>

          <div className="nav-profile" ref={profileRef}>
            <button
              type="button"
              className="nav-profile-trigger"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="nav-avatar">{user?.fullName ? user.fullName.split(' ').map((part) => part[0]).slice(0, 2).join('') : 'GB'}</span>
              <span className="nav-profile-copy">
                <strong>{user?.fullName || 'Guest user'}</strong>
                <span>{isAuthenticated ? 'Clinical session' : 'Public access'}</span>
              </span>
              <ChevronDown size={16} />
            </button>

            {profileOpen && (
              <div className="nav-profile-menu">
                {isAuthenticated ? (
                  <>
                    <Link to={user?.role === 'doctor' ? '/doctor' : '/dashboard'} onClick={() => setProfileOpen(false)}>Open dashboard</Link>
                    <Link to="/ai-assistant" onClick={() => setProfileOpen(false)}>AI assistant</Link>
                    <button type="button" onClick={logout} className="nav-profile-logout">
                      <LogOut size={16} /> Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login?role=patient" onClick={() => setProfileOpen(false)}>Sign in</Link>
                    <Link to="/register?role=patient" onClick={() => setProfileOpen(false)}>Register</Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" end className="nav-link" onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/auth" className="nav-link nav-link-highlight" onClick={() => setMenuOpen(false)}><UserRoundPlus size={16} /> Auth</NavLink>
          <NavLink to="/dashboard" className="nav-link" onClick={() => setMenuOpen(false)}><LayoutDashboard size={16} /> Patient Dashboard</NavLink>
          <NavLink to="/doctor" className="nav-link" onClick={() => setMenuOpen(false)}><ShieldCheck size={16} /> Doctor Dashboard</NavLink>
          <NavLink to="/detect" className="nav-link" onClick={() => setMenuOpen(false)}><Stethoscope size={16} /> Detect</NavLink>
          <NavLink to="/health-hub" className="nav-link" onClick={() => setMenuOpen(false)}>Health Hub</NavLink>
          <NavLink to="/device-sync" className="nav-link" onClick={() => setMenuOpen(false)}>Device Sync</NavLink>
          <NavLink to="/ai-assistant" className="nav-link" onClick={() => setMenuOpen(false)}>AI Assistant</NavLink>
          <NavLink to="/about" className="nav-link" onClick={() => setMenuOpen(false)}>About</NavLink>

          <div className="nav-status" title={backendOnline === null ? 'Checking...' : backendOnline ? 'Backend connected' : 'Backend offline'}>
            <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
            <span className="status-text">{backendOnline === null ? 'Checking' : backendOnline ? 'Online' : 'Offline'}</span>
          </div>

          {isAuthenticated ? (
            <div className="nav-session-chip">
              <UserRound size={14} />
              <span>{user?.fullName || 'Signed in'}</span>
              <button className="nav-logout-btn" type="button" onClick={logout} title="Logout">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div className="nav-auth-actions">
              <Link to="/login?role=patient" className="btn btn-outline nav-ghost-btn">Sign In</Link>
              <Link to="/register?role=patient" className="btn btn-primary nav-ghost-btn">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;