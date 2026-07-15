/**
 * Detect page — upload an image, pick a cancer type, run inference,
 * show the result.
 *
 * Supports:
 *   - Drag-and-drop or click-to-browse upload
 *   - "Use sample image" dropdown (fetches /api/sample-images)
 *   - "Analyze Image" button (POSTs to /api/predict)
 *   - Result display with original + Grad-CAM side-by-side
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import ResultCard from '../components/ResultCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { API_URL, predictCancer, getSampleImages, ApiError } from '../services/api';
import { saveScreeningRecord } from '../services/reportStore';
import './Detect.css';

function Detect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cancerType, setCancerType] = useState(
    (searchParams.get('type') || 'blood').toLowerCase()
  );
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [samples, setSamples] = useState({ blood: [], uterine: [] });
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);

  const resultsRef = useRef(null);

  // Keep URL in sync with selection
  useEffect(() => {
    setSearchParams({ type: cancerType });
  }, [cancerType, setSearchParams]);

  // Fetch samples once
  useEffect(() => {
    getSampleImages()
      .then((d) => setSamples(d.samples || { blood: [], uterine: [] }))
      .catch(() => setSamples({ blood: [], uterine: [] }));
  }, []);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  function handleFile(file) {
    setFile(file);
    setResult(null);
    setError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleClear() {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResult(null);
  }

  async function pickSample(sample) {
    try {
      setError('');
      setLoading(true);
      setSampleMenuOpen(false);

      const url = `${API_URL}${sample.url}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download sample image');
      const blob = await response.blob();
      const fetchedFile = new File([blob], sample.filename, { type: blob.type });
      handleFile(fetchedFile);
    } catch (e) {
      setError('Failed to load sample image: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!file) { setError('Please select an image first.'); return; }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await predictCancer(file, cancerType);
      setResult(data);
      saveScreeningRecord({
        cancerType,
        prediction: data.prediction,
        confidence: data.confidence,
        riskLevel: data.risk_level,
        mock: data.mock,
        fileName: file.name,
        classProbabilities: data.class_probabilities,
      });
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (e) {
      let msg;
      if (e instanceof ApiError) {
        msg = e.message;
      } else if (e?.response?.data?.error) {
        msg = e.response.data.error;
      } else if (e?.message) {
        msg = e.message;
      } else {
        msg = 'Unknown error';
      }
      setError('Prediction failed: ' + msg);
    } finally {
      setLoading(false);
    }
  }

  const currentSamples = samples[cancerType] || [];

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Upload Image for Analysis</h1>
        <p className="page-subtitle">
          Upload a medical image or pick a sample — our AI will classify it
          and explain its decision.
        </p>

        <div className="report-strip card mb-3">
          <div>
            <h3 className="report-strip-title">Daily health report is on</h3>
            <p className="report-strip-copy">
              Every analysis is saved locally so you can review recent screenings,
              track risk levels, and revisit today’s health summary in the dashboard.
            </p>
          </div>
          <a className="btn btn-secondary" href="/dashboard">Open Dashboard</a>
        </div>

        {/* Cancer-type selector */}
        <div className="type-selector">
          <button
            className={`type-btn ${cancerType === 'blood'   ? 'active blood'   : ''}`}
            onClick={() => setCancerType('blood')}
          >🩸 Blood Cancer (ALL)</button>
          <button
            className={`type-btn ${cancerType === 'uterine' ? 'active uterine' : ''}`}
            onClick={() => setCancerType('uterine')}
          >🔬 Uterine Cancer</button>
        </div>

        {/* Uploader + actions */}
        <div className="upload-section card mt-3">
          <ImageUploader
            onFileSelected={handleFile}
            previewUrl={previewUrl}
            onClear={handleClear}
          />

          {error && <p className="error-msg mt-2">{error}</p>}

          <div className="action-row mt-3">
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={!file || loading}
            >
              {loading ? 'Analyzing...' : 'Analyze Image'}
            </button>

            <div className="sample-dropdown">
              <button
                className="btn btn-outline"
                onClick={() => setSampleMenuOpen((o) => !o)}
                disabled={loading}
              >
                Use Sample Image ▾
              </button>
              {sampleMenuOpen && (
                <div className="sample-menu">
                  {currentSamples.length === 0 ? (
                    <div className="sample-empty">
                      No sample images available yet.
                    </div>
                  ) : (
                    currentSamples.map((s) => (
                      <button
                        key={s.filename}
                        className="sample-item"
                        onClick={() => pickSample(s)}
                      >
                        <span className="sample-name">{s.filename}</span>
                        <span className="sample-label">({s.label})</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="results-section mt-4">
          {loading && <LoadingSpinner message="AI is analyzing your image..." />}
          {!loading && result && <ResultCard result={result} originalPreview={previewUrl} />}
        </div>
      </div>
    </div>
  );
}

export default Detect;