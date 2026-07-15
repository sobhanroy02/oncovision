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
    <div className="page detect-page">
      <div className="container page-shell">
        <header className="page-header detect-hero card">
          <div className="page-header-row">
            <div>
              <div className="page-breadcrumb">Patient Portal / AI Detection</div>
              <h1 className="page-title">Upload Image for Analysis</h1>
              <p className="page-subtitle">
                Drop a scan, choose the cancer type, and review an explainable clinical result with a workflow designed for hospital use.
              </p>
            </div>
            <div className="page-meta-row">
              <span className="page-meta-chip">Secure upload</span>
              <span className="page-meta-chip">Explainable AI</span>
              <span className="page-meta-chip">Local history</span>
            </div>
          </div>

          <div className="detect-hero-actions">
            <a className="btn btn-secondary" href="/dashboard">Open Dashboard</a>
            <a className="btn btn-outline" href="/health-hub">View Health Hub</a>
          </div>
        </header>

        <section className="report-strip card">
          <div>
            <span className="section-kicker">Workflow status</span>
            <h3 className="report-strip-title">Daily monitoring is on</h3>
            <p className="report-strip-copy">
              Every analysis is saved locally so you can review recent screenings, track risk levels, and revisit today’s health summary in the dashboard.
            </p>
          </div>
          <a className="btn btn-secondary" href="/dashboard">Open Dashboard</a>
        </section>

        <section className="type-selector-card card">
          <div className="type-selector-head">
            <div>
              <span className="section-kicker">Cancer type</span>
              <h2>Choose the analysis track</h2>
            </div>
          </div>
          <div className="type-selector">
            <button
              className={`type-btn ${cancerType === 'blood' ? 'active blood' : ''}`}
              onClick={() => setCancerType('blood')}
            >🩸 Blood Cancer (ALL)</button>
            <button
              className={`type-btn ${cancerType === 'uterine' ? 'active uterine' : ''}`}
              onClick={() => setCancerType('uterine')}
            >🔬 Uterine Cancer</button>
          </div>
        </section>

        <section className="upload-layout grid grid-2">
          <div className="upload-section card">
            <div className="panel-head">
              <div>
                <span className="section-kicker">Upload workspace</span>
                <h2>Drop, preview, and run detection</h2>
                <p className="text-muted">Use your own image or load one of the bundled samples to preview the full workflow.</p>
              </div>
            </div>

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
                      <div className="sample-empty">No sample images available yet.</div>
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

          <aside className="card upload-info-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">What happens next</span>
                <h2>Prediction flow</h2>
              </div>
            </div>

            <div className="upload-steps">
              <div><strong>1.</strong><span>Upload or load a scan.</span></div>
              <div><strong>2.</strong><span>Run the model inference.</span></div>
              <div><strong>3.</strong><span>Review the explanation and report.</span></div>
            </div>

            <div className="upload-hint-box">
              <strong>Supported formats</strong>
              <p>JPG, PNG, TIFF, BMP up to 10 MB.</p>
            </div>

            <div className="upload-hint-box upload-hint-box-soft">
              <strong>Saved locally</strong>
              <p>Successful screenings appear in the patient dashboard timeline and reports view.</p>
            </div>
          </aside>
        </section>

        <section ref={resultsRef} className="results-section mt-4">
          {loading && <LoadingSpinner message="AI is analyzing your image..." />}
          {!loading && result && <ResultCard result={result} originalPreview={previewUrl} />}
        </section>
      </div>
    </div>
  );
}

export default Detect;