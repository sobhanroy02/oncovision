/**
 * Animated loading spinner with "Analyzing..." text.
 * Used during the API call to /api/predict.
 */
import React from 'react';
import './LoadingSpinner.css';

function LoadingSpinner({ message = 'Analyzing...' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner">
        <div /><div /><div /><div />
      </div>
      <p className="spinner-msg">{message}</p>
    </div>
  );
}

export default LoadingSpinner;