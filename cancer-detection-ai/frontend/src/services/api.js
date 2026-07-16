/**
 * API client for the Flask backend.
 *
 * Endpoints:
 *   GET  /api/health
 *   POST /api/predict          (multipart/form-data)
 *   GET  /api/model-info
 *   GET  /api/sample-images
 *
 * Set REACT_APP_API_URL in .env to point at a different backend.
 */
import axios from 'axios';

const LOCAL_API_URL = 'http://localhost:5000';
const PRODUCTION_API_URL = 'https://oncovision-backend-iics.onrender.com';
const IS_BROWSER = typeof window !== 'undefined';
const DEFAULT_API_URL = IS_BROWSER && window.location.hostname === 'localhost'
  ? LOCAL_API_URL
  : PRODUCTION_API_URL;

function sanitizeApiUrl(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Reject accidental pasted text and malformed values.
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return null;
  return trimmed.replace(/\/+$/, '');
}

function resolveApiUrl() {
  const envUrl = sanitizeApiUrl(process.env.REACT_APP_API_URL);
  const windowUrl = sanitizeApiUrl(IS_BROWSER ? window.__API_URL__ : null);
  const defaultUrl = sanitizeApiUrl(DEFAULT_API_URL);
  return envUrl || windowUrl || defaultUrl || LOCAL_API_URL;
}

export const API_URL =
  resolveApiUrl();

const API_SETUP_MESSAGE =
  'Backend API is not configured for production. Set REACT_APP_API_URL in your Vercel project to your deployed backend URL, then redeploy.';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: {
    Accept: 'application/json',
  },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientApiError(err) {
  if (!err) return false;
  if (err.isNetworkError) return true;
  if (err.status === 429) return true;
  if (typeof err.status === 'number' && err.status >= 500) return true;
  if (/timed out|cannot reach the backend|network/i.test(String(err.message || ''))) return true;
  return false;
}

async function withRetry(requestFn, {
  retries = 2,
  baseDelayMs = 800,
  fallbackMessage = 'Request failed',
} = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (rawErr) {
      const normalized = rawErr instanceof ApiError ? rawErr : normalizeError(rawErr, fallbackMessage);
      lastErr = normalized;
      if (attempt === retries || !isTransientApiError(normalized)) {
        throw normalized;
      }
      const backoff = baseDelayMs * (attempt + 1);
      await sleep(backoff);
    }
  }
  throw lastErr || new ApiError(fallbackMessage);
}

/**
 * Custom error class so the UI can distinguish network vs server errors
 * and show a user-friendly message.
 */
export class ApiError extends Error {
  constructor(message, { status, code, isNetworkError } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;            // HTTP status, if any
    this.code = code;                // axios error code, if any
    this.isNetworkError = !!isNetworkError;
  }
}

/**
 * Normalize any error from axios into an ApiError with a friendly message.
 */
function normalizeError(err, fallbackMessage) {
  if (err.response) {
    const contentType = String(err.response.headers?.['content-type'] || '').toLowerCase();
    const gotHtmlResponse = contentType.includes('text/html');

    // In production, an HTML response usually means /api was routed to the SPA page,
    // not to the Flask backend.
    if (gotHtmlResponse && !API_URL) {
      return new ApiError(API_SETUP_MESSAGE, { status: err.response.status });
    }

    // Server responded with a non-2xx status
    const serverMsg =
      err.response.data?.error ||
      err.response.data?.message ||
      err.response.statusText ||
      fallbackMessage;
    return new ApiError(serverMsg, { status: err.response.status });
  }
  if (err.request) {
    // No response received (network down, server offline, CORS, timeout)
    const isTimeout = err.code === 'ECONNABORTED';
    const msg = isTimeout
      ? 'Request timed out. The server took too long to respond.'
      : !API_URL
        ? API_SETUP_MESSAGE
        : 'Cannot reach the backend. Make sure the Flask server is running on ' + API_URL;
    return new ApiError(msg, { code: err.code, isNetworkError: true });
  }
  // Something else (programming error, etc.)
  return new ApiError(err.message || fallbackMessage);
}

/**
 * Lightweight health-check used by the Navbar status indicator.
 * Returns true if the backend is reachable.
 * Never throws — always returns a boolean.
 */
export async function checkHealth() {
  try {
    const r = await apiClient.get('/api/health', { timeout: 5000 });
    return r.data && r.data.status === 'ok';
  } catch (_e) {
    return false;
  }
}

/**
 * Fetch the detailed backend health payload.
 * Returns the raw /api/health response when available.
 * @throws {ApiError}
 */
export async function getHealthStatus() {
  try {
    const r = await apiClient.get('/api/health', { timeout: 5000 });
    return r.data;
  } catch (err) {
    throw normalizeError(err, 'Failed to fetch backend health');
  }
}

/**
 * Send an image to the backend for prediction.
 *
 * @param {File} imageFile - The image file (from <input type="file">).
 * @param {string} cancerType - 'blood' or 'uterine'.
 * @returns {Promise<object>} The predict() response dict.
 * @throws {ApiError} If the request fails for any reason.
 */
export async function predictCancer(imageFile, cancerType) {
  if (!imageFile) {
    throw new ApiError('No image file provided.');
  }
  if (cancerType !== 'blood' && cancerType !== 'uterine') {
    throw new ApiError("cancerType must be 'blood' or 'uterine'.");
  }

  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('cancer_type', cancerType);

  return withRetry(async () => {
    const response = await apiClient.post('/api/predict', formData);
    return response.data;
  }, {
    retries: 2,
    baseDelayMs: 1000,
    fallbackMessage: 'Prediction request failed',
  });
}

/**
 * Fetch model performance metrics for both models.
 * @returns {Promise<{models: Array, metric_descriptions?: object}>}
 * @throws {ApiError}
 */
export async function getModelInfo() {
  try {
    const r = await apiClient.get('/api/model-info');
    return r.data;
  } catch (err) {
    throw normalizeError(err, 'Failed to fetch model info');
  }
}

/**
 * Fetch the list of available sample images.
 * @returns {Promise<{samples: {blood: Array, uterine: Array}, total_count: number}>}
 * @throws {ApiError}
 */
export async function getSampleImages() {
  return withRetry(async () => {
    const r = await apiClient.get('/api/sample-images');
    return r.data;
  }, {
    retries: 3,
    baseDelayMs: 900,
    fallbackMessage: 'Failed to fetch sample images',
  });
}

/**
 * Send simulated IoT device vital parameters & blood markers for analysis.
 * @param {object} payload - Vitals and biomarkers.
 * @returns {Promise<object>} The analyze-biomarkers response dict.
 * @throws {ApiError}
 */
export async function analyzeBiomarkers(payload) {
  try {
    const r = await apiClient.post('/api/analyze-biomarkers', payload);
    return r.data;
  } catch (err) {
    throw normalizeError(err, 'Failed to process biomarker report');
  }
}

/**
 * Send user query to the AI Medical Assistant Chatbot.
 * @param {string} message - User query text.
 * @returns {Promise<{reply: string}>} The chatbot response.
 * @throws {ApiError}
 */
export async function sendChatMessage(message) {
  try {
    const r = await apiClient.post('/api/chat', { message });
    return r.data;
  } catch (err) {
    throw normalizeError(err, 'Failed to connect to AI Assistant');
  }
}

export default apiClient;
