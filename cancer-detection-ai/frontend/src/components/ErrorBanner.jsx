/**
 * Reusable error banner with a friendly message.
 * Used by pages that load data from the API.
 */
import React from 'react';
import './ErrorBanner.css';

function ErrorBanner({ title = 'Something went wrong', message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner-icon">⚠</div>
      <div className="error-banner-body">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="error-banner-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorBanner;
