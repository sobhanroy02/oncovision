/**
 * Global loading overlay.
 * Wrap any async operation with <GlobalLoading show={loading}> ... </GlobalLoading>
 * to dim the page and show a centered spinner.
 */
import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import './GlobalLoading.css';

function GlobalLoading({ show, message = 'Loading...', children }) {
  if (!show) return children;
  return (
    <div className="global-loading-wrap">
      <div className="global-loading-overlay">
        <LoadingSpinner message={message} />
      </div>
      <div className="global-loading-content">{children}</div>
    </div>
  );
}

export default GlobalLoading;