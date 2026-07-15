/**
 * Result display card.
 * Shows the big prediction badge, animated confidence bar, risk level,
 * side-by-side original + Grad-CAM images, and a probability bar chart.
 */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import './ResultCard.css';

const RISK_STYLES = {
  High:   { color: '#E74C3C', bg: '#FEE2E2' },
  Medium: { color: '#F39C12', bg: '#FEF3C7' },
  Low:    { color: '#27AE60', bg: '#D1FAE5' },
};

function ResultCard({ result, originalPreview }) {
  if (!result) return null;

  const isCancer = result.prediction === 'Cancer Detected';
  const predictionColor = isCancer ? '#E74C3C' : '#27AE60';
  const riskStyle = RISK_STYLES[result.risk_level] || RISK_STYLES.Low;

  const probData = [
    { name: 'Cancerous', value: (result.class_probabilities.cancerous * 100).toFixed(1) },
    { name: 'Normal',    value: (result.class_probabilities.normal    * 100).toFixed(1) },
  ];

  return (
    <div className="result-card">
      {/* Big prediction badge */}
      <div className="prediction-badge" style={{ background: predictionColor }}>
        <span className="prediction-icon">{isCancer ? '⚠' : '✓'}</span>
        <span>{result.prediction}</span>
      </div>

      {result.mock && (
        <p className="mock-note">
          <em>Demo mode — trained models not yet connected. Predictions are mock.</em>
        </p>
      )}

      {/* Confidence + risk level */}
      <div className="confidence-row">
        <div className="confidence-block">
          <div className="confidence-label">Confidence</div>
          <div className="confidence-bar-wrap">
            <div
              className="confidence-bar"
              style={{
                width: `${result.confidence}%`,
                background: predictionColor,
              }}
            />
          </div>
          <div className="confidence-value">{result.confidence}%</div>
        </div>

        <div className="risk-badge" style={{ background: riskStyle.bg, color: riskStyle.color }}>
          <span className="risk-label">Risk Level</span>
          <span className="risk-value">{result.risk_level}</span>
        </div>
      </div>

      {/* Side-by-side images */}
      <div className="images-grid">
        <div className="image-block">
          <h4>Original</h4>
          {originalPreview
            ? <img src={originalPreview} alt="Original upload" />
            : <div className="img-placeholder">Image not available</div>}
        </div>
        <div className="image-block">
          <h4>
            Grad-CAM Heatmap
            <span className="legend">
              <span style={{ background: '#0000FF' }} />cold
              <span style={{ background: '#00FFFF' }} />
              <span style={{ background: '#FFFF00' }} />
              <span style={{ background: '#FF0000' }} />hot
            </span>
          </h4>
          {result.gradcam_image
            ? <img src={`data:image/png;base64,${result.gradcam_image}`} alt="Grad-CAM" />
            : <div className="img-placeholder">Grad-CAM not available</div>}
        </div>
      </div>

      {/* Probability bar chart */}
      <div className="prob-chart">
        <h4>Probability Breakdown</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={probData} layout="vertical" margin={{ left: 30, right: 30 }}>
            <XAxis type="number" domain={[0, 100]} unit="%" />
            <YAxis type="category" dataKey="name" width={100} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {probData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.name === 'Cancerous' ? '#E74C3C' : '#27AE60'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Disclaimer */}
      <p className="disclaimer">
        <strong>Disclaimer:</strong> This is an AI screening tool for research and
        educational purposes. It is <u>not a substitute</u> for professional
        medical diagnosis. Always consult a qualified medical professional.
      </p>
    </div>
  );
}

export default ResultCard;