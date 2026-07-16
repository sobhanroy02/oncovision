const STORAGE_KEY = 'geeky-blinders.screening-history.v1';
const MAX_RECORDS = 120;

const SAMPLE_REPORT = {
  id: 'sample-screening-report',
  createdAt: '2026-07-16T09:15:00.000Z',
  cancerType: 'blood',
  prediction: 'No Cancer Detected',
  confidence: 91.37,
  riskLevel: 'Low',
  mock: false,
  fileName: 'blood_cancer_negative_1.jpg',
  sampleName: 'blood_cancer_negative_1.jpg',
  classProbabilities: {
    cancerous: 0.0863,
    normal: 0.9137,
  },
};

function hasStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

function readRawHistory() {
  if (!hasStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

function writeRawHistory(history) {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function makeRecordId() {
  return `screening_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadScreeningHistory() {
  const history = readRawHistory();
  return history.length > 0 ? history : [SAMPLE_REPORT];
}

export function saveScreeningRecord(record) {
  if (!record) return null;

  const entry = {
    id: record.id || makeRecordId(),
    createdAt: record.createdAt || new Date().toISOString(),
    cancerType: record.cancerType || 'unknown',
    prediction: record.prediction || 'Unknown',
    confidence: Number.isFinite(record.confidence) ? record.confidence : null,
    riskLevel: record.riskLevel || 'Unknown',
    mock: !!record.mock,
    fileName: record.fileName || record.sampleName || 'Uploaded image',
    sampleName: record.sampleName || null,
    classProbabilities: record.classProbabilities || null,
  };

  const history = [entry, ...readRawHistory().filter((item) => item.id !== entry.id)]
    .slice(0, MAX_RECORDS);
  writeRawHistory(history);
  return entry;
}

export function clearScreeningHistory() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}