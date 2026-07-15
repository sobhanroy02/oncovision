const STORAGE_KEY = 'geeky-blinders.health-readings.v1';
const MAX_RECORDS = 180;

const HEALTH_RANGES = {
  temperature: { min: 36.1, max: 37.5, label: 'Temperature (°C)' },
  pulse: { min: 60, max: 100, label: 'Pulse (bpm)' },
  spo2: { min: 95, max: 100, label: 'SpO2 (%)' },
  systolic: { min: 90, max: 120, label: 'Systolic BP' },
  diastolic: { min: 60, max: 80, label: 'Diastolic BP' },
  hemoglobin: { min: 12, max: 17.5, label: 'Hemoglobin (g/dL)' },
  wbc: { min: 4, max: 11, label: 'WBC (x10^9/L)' },
  platelets: { min: 150, max: 450, label: 'Platelets (x10^9/L)' },
  glucose: { min: 70, max: 140, label: 'Glucose (mg/dL)' },
};

function hasStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

function readHistory() {
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

function writeHistory(history) {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function makeId(prefix = 'reading') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function severityFor(name, value) {
  const range = HEALTH_RANGES[name];
  if (!range || value === null) return null;

  if (value >= range.min && value <= range.max) {
    return { level: 'normal', label: range.label, note: 'Within target range', points: 0 };
  }

  const mid = (range.min + range.max) / 2;
  const distance = Math.abs(value - mid);
  const span = Math.max(range.max - range.min, 1);
  const ratio = distance / span;

  if (ratio >= 0.8) {
    return { level: 'critical', label: range.label, note: 'Strong deviation from normal', points: 30 };
  }
  if (ratio >= 0.4) {
    return { level: 'warning', label: range.label, note: 'Moderate deviation from normal', points: 18 };
  }
  return { level: 'mild', label: range.label, note: 'Slight deviation from normal', points: 8 };
}

export function analyzeVitals(input) {
  const normalized = {
    temperature: parseNumber(input.temperature),
    pulse: parseNumber(input.pulse),
    spo2: parseNumber(input.spo2),
    systolic: parseNumber(input.systolic),
    diastolic: parseNumber(input.diastolic),
    hemoglobin: parseNumber(input.hemoglobin),
    wbc: parseNumber(input.wbc),
    platelets: parseNumber(input.platelets),
    glucose: parseNumber(input.glucose),
  };

  const signals = [];
  let points = 0;

  Object.entries(normalized).forEach(([name, value]) => {
    const verdict = severityFor(name, value);
    if (!verdict) return;
    if (verdict.points > 0) {
      points += verdict.points;
      signals.push({ field: name, ...verdict, value });
    }
  });

  const cancerAwareSignals = [];
  if (normalized.hemoglobin !== null && normalized.hemoglobin < 11.5) {
    cancerAwareSignals.push('Low hemoglobin can be seen with fatigue, anemia, or blood-related conditions.');
    points += 15;
  }
  if (normalized.wbc !== null && normalized.wbc > 11) {
    cancerAwareSignals.push('Elevated WBC may reflect infection, inflammation, or hematologic stress.');
    points += 12;
  }
  if (normalized.platelets !== null && normalized.platelets < 140) {
    cancerAwareSignals.push('Low platelet count may need follow-up if persistent.');
    points += 10;
  }

  const score = Math.max(0, 100 - points);
  let status = 'Stable';
  if (score < 40 || signals.some((signal) => signal.level === 'critical')) status = 'Critical';
  else if (score < 60 || signals.length >= 4) status = 'High Attention';
  else if (score < 80 || signals.length >= 2) status = 'Needs Review';

  const topFlags = signals
    .map((signal) => `${signal.label}: ${signal.note}`)
    .slice(0, 4);

  const recommendations = [];
  if (score >= 80) recommendations.push('Continue routine monitoring and maintain healthy habits.');
  if (normalized.spo2 !== null && normalized.spo2 < 95) recommendations.push('Keep an eye on oxygen saturation and seek care if low readings persist.');
  if (normalized.temperature !== null && normalized.temperature >= 37.5) recommendations.push('A raised temperature can point to infection or inflammation.');
  if (normalized.glucose !== null && normalized.glucose > 140) recommendations.push('Repeat glucose under proper fasting/non-fasting conditions or consult a clinician.');
  if (recommendations.length === 0) recommendations.push('Share this report with a healthcare professional for context-aware interpretation.');

  return {
    score,
    status,
    signals,
    topFlags,
    recommendations,
    cancerAwareSignals,
    normalized,
    hasActionableFlags: signals.length > 0 || cancerAwareSignals.length > 0,
  };
}

export function loadVitalsHistory() {
  return readHistory();
}

export function saveVitalsRecord(record) {
  if (!record) return null;

  const analysis = record.analysis || analyzeVitals(record);
  const entry = {
    id: record.id || makeId(),
    createdAt: record.createdAt || new Date().toISOString(),
    source: record.source || 'manual',
    deviceName: record.deviceName || 'Hardware device',
    raw: {
      temperature: parseNumber(record.temperature),
      pulse: parseNumber(record.pulse),
      spo2: parseNumber(record.spo2),
      systolic: parseNumber(record.systolic),
      diastolic: parseNumber(record.diastolic),
      hemoglobin: parseNumber(record.hemoglobin),
      wbc: parseNumber(record.wbc),
      platelets: parseNumber(record.platelets),
      glucose: parseNumber(record.glucose),
      cea: parseNumber(record.cea),
      ca_125: parseNumber(record.ca_125),
      psa: parseNumber(record.psa),
    },
    analysis,
  };

  const history = [entry, ...readHistory().filter((item) => item.id !== entry.id)].slice(0, MAX_RECORDS);
  writeHistory(history);
  return entry;
}

export function clearVitalsHistory() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getLatestVitalsRecord() {
  return readHistory()[0] || null;
}

export function vitalsFieldMeta() {
  return HEALTH_RANGES;
}