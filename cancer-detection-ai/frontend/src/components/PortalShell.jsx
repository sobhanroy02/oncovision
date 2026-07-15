import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import './PortalShell.css';

function PortalShell({
  eyebrow,
  title,
  subtitle,
  actions,
  summaryCards = [],
  sidebarTitle,
  sidebarLinks = [],
  sidebarNote,
  children,
  aside,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="portal-shell-wrap">
      <div className="container portal-shell-grid">
        <aside className="portal-sidebar card">
          <div className="portal-sidebar-head">
            <div>
              {eyebrow && <span className="section-kicker">{eyebrow}</span>}
              <h2>{sidebarTitle || title}</h2>
              {sidebarNote && <p className="text-muted">{sidebarNote}</p>}
            </div>

            <button
              type="button"
              className="portal-menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          <div className={`portal-sidebar-body ${menuOpen ? 'open' : ''}`}>
            <nav className="portal-nav">
              {sidebarLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="portal-nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="portal-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {aside}
          </div>
        </aside>

        <main className="portal-main">
          <motion.section
            className="portal-hero card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="portal-hero-copy">
              {eyebrow && <span className="section-kicker light">{eyebrow}</span>}
              <h1 className="page-title">{title}</h1>
              <p className="page-subtitle portal-subtitle">{subtitle}</p>
            </div>
            <div className="portal-hero-actions">
              {actions}
            </div>
          </motion.section>

          {summaryCards.length > 0 && (
            <section className="portal-summary-grid">
              {summaryCards.map((card) => (
                <motion.article
                  key={card.label}
                  className="card portal-stat-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <span className="stat-label">{card.label}</span>
                  <strong className="stat-value">{card.value}</strong>
                  <span className="stat-note">{card.note}</span>
                </motion.article>
              ))}
            </section>
          )}

          <div className="portal-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default PortalShell;
