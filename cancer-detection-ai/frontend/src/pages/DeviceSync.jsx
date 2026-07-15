import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { analyzeBiomarkers } from '../services/api';
import { saveVitalsRecord } from '../services/healthStore';
import './DeviceSync.css';

const PROFILE_PRESETS = {
  HEALTHY: {
    name: 'Normal Baseline (Healthy Profile)',
    data: {
      deviceName: 'GeekyBlinder_MedRing v3',
      source: 'device',
      temperature: 36.6,
      pulse: 72,
      spo2: 98,
      systolic: 115,
      diastolic: 75,
      glucose: 90,
      hemoglobin: 14.2,
      wbc: 6.5,
      platelets: 280,
      cea: 1.1,
      ca_125: 12.0,
      psa: 0.8
    }
  },
  LEUKEMIA: {
    name: 'Hematological Stress (ALL/Leukemia Suspect)',
    data: {
      deviceName: 'GeekyBlinder_MedRing v3',
      source: 'device',
      temperature: 37.9,
      pulse: 102,
      spo2: 93,
      systolic: 105,
      diastolic: 65,
      glucose: 98,
      hemoglobin: 8.2,
      wbc: 29.4,
      platelets: 58,
      cea: 1.3,
      ca_125: 15.0,
      psa: 1.0
    }
  },
  SOLID_TUMOR: {
    name: 'Elevated Tumor Antigens (Solid Tumor Risk)',
    data: {
      deviceName: 'GeekyBlinder_MedRing v3',
      source: 'device',
      temperature: 37.1,
      pulse: 84,
      spo2: 96,
      systolic: 138,
      diastolic: 88,
      glucose: 115,
      hemoglobin: 12.4,
      wbc: 9.1,
      platelets: 220,
      cea: 14.8,
      ca_125: 115.2,
      psa: 9.4
    }
  }
};

function DeviceSync() {
  const [isOn, setIsOn] = useState(true);
  const [bleStatus, setBleStatus] = useState('disconnected'); // disconnected, pairing, paired
  const [scanState, setScanState] = useState('idle'); // idle, vitals, cbc, markers, completed
  const [scanProgress, setScanProgress] = useState(0);
  const [activeProfile, setActiveProfile] = useState('HEALTHY');
  
  const [deviceData, setDeviceData] = useState(PROFILE_PRESETS.HEALTHY.data);
  const [payloadText, setPayloadText] = useState(JSON.stringify(PROFILE_PRESETS.HEALTHY.data, null, 2));
  
  const [logs, setLogs] = useState([
    '[SYSTEM] Wearable Bio-Scanner v3.1 successfully initialized.',
    '[SYSTEM] Ready for BLE pairing.'
  ]);

  const [syncResult, setSyncResult] = useState(null);
  const [phasingActive, setPhasingActive] = useState(false);
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  const consoleEndRef = useRef(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  const handleProfileChange = (key) => {
    setActiveProfile(key);
    const selected = PROFILE_PRESETS[key].data;
    setDeviceData(selected);
    setPayloadText(JSON.stringify(selected, null, 2));
    setSyncResult(null);
    setScanState('idle');
    setScanProgress(0);
    addLog(`Preset profile updated to: ${PROFILE_PRESETS[key].name}`);
  };

  const handlePowerToggle = () => {
    setIsOn(prev => !prev);
    if (isOn) {
      setBleStatus('disconnected');
      setScanState('idle');
      setScanProgress(0);
      setSyncResult(null);
    } else {
      setLogs([
        '[SYSTEM] Powering on Wearable Bio-Scanner...',
        '[SYSTEM] Running self-test: OK.',
        '[SYSTEM] Bluetooth advertising initialized.'
      ]);
    }
  };

  const handleBlePairing = () => {
    if (!isOn || bleStatus === 'paired') return;
    
    setBleStatus('pairing');
    addLog('Scanning for host gateway device...');
    
    setTimeout(() => {
      setBleStatus('paired');
      addLog('BLE connection established with: GeekyBlinders_LocalServer.');
    }, 1500);
  };

  const handleInitiateScan = () => {
    if (!isOn || bleStatus !== 'paired' || scanState !== 'idle') return;

    setScanState('vitals');
    setScanProgress(5);
    addLog('Initiating Patient Health Scan...');

    // Progress Simulation
    let progress = 5;
    const interval = setInterval(() => {
      progress += 5;
      setScanProgress(progress);

      if (progress === 25) {
        setScanState('vitals');
        addLog('PPG Optical Sensors activated. Reading blood oxygen (SpO2) and pulse...');
      } else if (progress === 45) {
        addLog(`Sensor output: HR=${deviceData.pulse}bpm, SpO2=${deviceData.spo2}%, Temp=${deviceData.temperature}°C.`);
      } else if (progress === 55) {
        setScanState('cbc');
        addLog('Acquiring electrochemical microfluidics data... Analyzing leukocyte/thrombocyte concentrations.');
      } else if (progress === 75) {
        addLog(`CBC output: Hemoglobin=${deviceData.hemoglobin}g/dL, WBC=${deviceData.wbc}k/uL, Platelets=${deviceData.platelets}k/uL.`);
      } else if (progress === 85) {
        setScanState('markers');
        addLog('Scanning micro-antigens on Bio-Chip. Quantifying CEA, CA-125, PSA.');
      } else if (progress >= 100) {
        clearInterval(interval);
        setScanState('completed');
        setScanProgress(100);
        addLog('Multi-parameter health scan completed. Diagnostic payload generated.');
      }
    }, 150);
  };

  const handlePhaseData = async () => {
    if (!isOn || scanState !== 'completed' || phasingActive) return;

    setError('');
    setPhasingActive(true);
    addLog('Phasing telemetry payload to cloud servers...');

    try {
      // Parse payload text in case user edited it manually
      const parsedData = JSON.parse(payloadText);
      
      const result = await analyzeBiomarkers(parsedData);
      
      // Save it locally under vitals history
      saveVitalsRecord({
        ...parsedData,
        analysis: result,
        source: 'device',
        deviceName: parsedData.deviceName || 'GeekyBlinder_MedRing v3'
      });

      setTimeout(() => {
        setSyncResult(result);
        setPhasingActive(false);
        setLastSyncedAt(new Date().toLocaleString());
        addLog('Cloud sync successful. Diagnostic report computed by AI risk models.');
      }, 1200);

    } catch (err) {
      setError(err.message || 'Data phasing request failed.');
      setPhasingActive(false);
      addLog(`[ERROR] Data phasing failed: ${err.message}`);
    }
  };

  const handleManualPayloadEdit = (txt) => {
    setPayloadText(txt);
    try {
      const parsed = JSON.parse(txt);
      setDeviceData(parsed);
      setError('');
    } catch (_) {
      // Don't throw, let them correct JSON
    }
  };

  return (
    <div className="page iot-sync-page">
      <div className="container">
        
        {/* HERO SECTION */}
        <section className="iot-hero card">
          <div>
            <span className="section-kicker">Multi-Parameter Hardware Sync</span>
            <h1 className="page-title">Virtual IoT Device Portal</h1>
            <p className="page-subtitle iot-subtitle">
              Simulate patient telemetry streams including vital signs, complete blood count parameters, and oncological tumor markers phased directly from a hardware wearable into the AI model registry.
            </p>
          </div>
          <div className="hero-links">
            <Link className="btn btn-outline" to="/dashboard">Combined Dashboard</Link>
            <Link className="btn btn-secondary" to="/ai-assistant">Chat with OncoBot</Link>
          </div>
        </section>

        {/* WORKSPACE: SIMULATOR & TELEMETRY */}
        <section className="grid grid-2 workspace-grid">
          
          {/* HARDWARE SIMULATOR CHASSIS */}
          <div className="iot-chassis">
            <div className="chassis-inner">
              
              {/* DEVICE HEADER */}
              <div className="device-header-bar">
                <div className="device-leds">
                  <span className={`led led-power ${isOn ? 'on' : ''}`}></span>
                  <span className={`led led-ble ${bleStatus === 'paired' ? 'on' : bleStatus === 'pairing' ? 'blink' : ''}`}></span>
                </div>
                <div className="device-version">GB-MED MONITOR v3.1</div>
                <div className="device-battery">🔋 98%</div>
              </div>

              {/* LCD SCREEN MONITOR */}
              <div className={`device-lcd-screen ${!isOn ? 'blackout' : ''}`}>
                {!isOn ? (
                  <div className="screen-off-state">
                    <h3>SYSTEM POWER OFF</h3>
                    <p>Press the red POWER button to boot the terminal.</p>
                  </div>
                ) : (
                  <div className="screen-on-layout">
                    
                    {/* TOP DISPLAY STRIP */}
                    <div className="screen-telemetry-header">
                      <span className="status-label">STATUS: {scanState.toUpperCase()}</span>
                      <span className="status-ble-tag">
                        {bleStatus === 'paired' ? '📡 BLE: CONNECTED' : bleStatus === 'pairing' ? '⏳ BLE: PAIRING...' : '❌ BLE: DISCONNECTED'}
                      </span>
                    </div>

                    {/* ECG/PPG PULSE WAVE ANIMATION */}
                    <div className="screen-graph-area">
                      {scanState !== 'idle' && scanState !== 'completed' ? (
                        <div className="wave-active">
                          <svg viewBox="0 0 300 60" className="ecg-svg">
                            <path 
                              className="ecg-path" 
                              d="M 0 30 L 30 30 L 40 10 L 50 50 L 60 30 L 100 30 L 110 5 L 120 55 L 130 30 L 180 30 L 190 10 L 200 50 L 210 30 L 250 30 L 260 5 L 270 55 L 280 30 L 300 30"
                            />
                          </svg>
                          <span className="wave-caption">Reading Vitals Bio-Chip Telemetry...</span>
                        </div>
                      ) : (
                        <div className="wave-idle">
                          <svg viewBox="0 0 300 60" className="ecg-svg idle">
                            <line x1="0" y1="30" x2="300" y2="30" stroke="#00ffff" strokeWidth="2" opacity="0.3" />
                          </svg>
                          <span className="wave-caption">ECG/PPG Telemetry Standby</span>
                        </div>
                      )}
                    </div>

                    {/* LIVE PARAMETER GRID */}
                    <div className="screen-parameters-grid">
                      <div className="param-box">
                        <span className="lbl">TEMP</span>
                        <strong className="val">{deviceData.temperature}°C</strong>
                      </div>
                      <div className="param-box">
                        <span className="lbl">HR</span>
                        <strong className="val">{deviceData.pulse}</strong>
                      </div>
                      <div className="param-box">
                        <span className="lbl">SPO2</span>
                        <strong className="val">{deviceData.spo2}%</strong>
                      </div>
                      <div className="param-box">
                        <span className="lbl">WBC</span>
                        <strong className="val">{deviceData.wbc}</strong>
                      </div>
                      <div className="param-box">
                        <span className="lbl">HB</span>
                        <strong className="val">{deviceData.hemoglobin}</strong>
                      </div>
                      <div className="param-box">
                        <span className="lbl">PLT</span>
                        <strong className="val">{deviceData.platelets}</strong>
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    {scanState !== 'idle' && (
                      <div className="screen-progress">
                        <div className="prog-bar" style={{ width: `${scanProgress}%` }}></div>
                        <span className="prog-percent">{scanProgress}%</span>
                      </div>
                    )}

                    {/* TERMINAL CONSOLE LOG */}
                    <div className="screen-terminal-console">
                      <div className="console-wrapper">
                        {logs.map((log, idx) => (
                          <div key={idx} className="log-line">{log}</div>
                        ))}
                        <div ref={consoleEndRef} />
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* HARDWARE BUTTONS CONSOLE */}
              <div className="device-buttons-panel">
                <button className="hw-btn hw-btn-power" onClick={handlePowerToggle}>
                  POWER
                </button>
                
                <button 
                  className={`hw-btn hw-btn-pair ${bleStatus === 'paired' ? 'active' : ''}`}
                  onClick={handleBlePairing}
                  disabled={!isOn || bleStatus !== 'disconnected'}
                >
                  {bleStatus === 'disconnected' ? 'BLE PAIR' : bleStatus === 'pairing' ? 'PAIRING...' : 'PAIRED'}
                </button>

                <button 
                  className={`hw-btn hw-btn-scan ${scanState !== 'idle' ? 'active' : ''}`}
                  onClick={handleInitiateScan}
                  disabled={!isOn || bleStatus !== 'paired' || scanState !== 'idle'}
                >
                  START SCAN
                </button>

                <button 
                  className={`hw-btn hw-btn-sync ${scanState === 'completed' && !phasingActive ? 'ready' : ''}`}
                  onClick={handlePhaseData}
                  disabled={!isOn || scanState !== 'completed' || phasingActive}
                >
                  {phasingActive ? 'PHASING...' : 'SYNC DATA'}
                </button>
              </div>

            </div>
          </div>

          {/* TELEMETRY JSON DATA & CONFIGURE PRESET */}
          <div className="card configure-panel">
            <div className="panel-header-row">
              <div>
                <h2>Telemetry Profile Configuration</h2>
                <p className="text-muted">Configure the hardware bio-sensor variables or load preset profiles.</p>
              </div>
            </div>

            <div className="preset-selector-row">
              <label>Select Simulated Profile:</label>
              <select 
                className="profile-select"
                value={activeProfile}
                onChange={(e) => handleProfileChange(e.target.value)}
                disabled={scanState !== 'idle' || phasingActive}
              >
                <option value="HEALTHY">Profile A: Normal Baseline (Healthy)</option>
                <option value="LEUKEMIA">Profile B: Hematological stress (ALL/Leukemia)</option>
                <option value="SOLID_TUMOR">Profile C: Elevated Antigens (Solid Tumor)</option>
              </select>
            </div>

            <div className="json-editor-area">
              <label>JSON Data Package (Simulated BLE Payload):</label>
              <textarea 
                className="json-textarea"
                value={payloadText}
                onChange={(e) => handleManualPayloadEdit(e.target.value)}
                disabled={scanState !== 'idle' || phasingActive}
                spellCheck="false"
              />
            </div>
            
            {error && <p className="error-banner">{error}</p>}
            
            <div className="hardware-info-chip mt-2">
              <h4>🎯 Academic Project Integration</h4>
              <p>
                In a physical medical device setup, this JSON package is generated by an ESP32 micro-controller reading analog heart-rate (MAX30102) and temperature sensors, coupled with an on-chip laboratory microfluidics analyzer. The data is transmitted over UART/Bluetooth.
              </p>
            </div>
          </div>

        </section>

        {/* WORKSPACE: MULTI-PARAMETER AI ANALYSIS REPORT */}
        {phasingActive && (
          <div className="phasing-loading-box card mt-3">
            <div className="loading-spinner-ring"></div>
            <h3>Demultiplexing Signals & Running AI Classification models...</h3>
            <p className="text-muted">Analyzing CBC levels, vital variables, and tumor antigen indices.</p>
          </div>
        )}

        {syncResult && !phasingActive && (
          <section className="card analysis-report-card mt-3">
            
            {/* REPORT TITLE HEADER */}
            <div className="report-header">
              <div>
                <span className="report-title-kicker">Computed at {lastSyncedAt}</span>
                <h2>AI Multi-Parameter Clinical Report</h2>
                <p className="text-muted">Expert classification based on IoT telemetry and oncology biomarkers.</p>
              </div>
              <div className="report-badge-container">
                <span className={`verdict-badge verdict-${syncResult.verdict.toLowerCase().replace(' ', '-')}`}>
                  Verdict: {syncResult.verdict}
                </span>
              </div>
            </div>

            <div className="grid grid-3 report-metrics-summary mt-3">
              
              {/* CIRCULAR HEALTH SCORE GAUGE */}
              <div className="gauge-score-box">
                <div className="circular-progress">
                  <svg viewBox="0 0 100 100" className="radial-svg">
                    <circle cx="50" cy="50" r="40" className="radial-bg-circle" />
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      className={`radial-fill-circle score-${syncResult.verdict.toLowerCase().replace(' ', '-')}`}
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 - (251.2 * syncResult.health_score) / 100}
                    />
                  </svg>
                  <div className="gauge-text">
                    <strong>{syncResult.health_score}</strong>
                    <span>Health Index</span>
                  </div>
                </div>
              </div>

              {/* RISK DIAGNOSTICS: LEUKEMIA SCREENING */}
              <div className="risk-panel-box">
                <div className="risk-header-row">
                  <h3>🩸 Hematological (Leukemia) Screen</h3>
                  <span className={`risk-pill risk-${syncResult.risk_analysis.leukemia.risk.toLowerCase()}`}>
                    {syncResult.risk_analysis.leukemia.risk} Risk
                  </span>
                </div>
                <div className="risk-confidence mt-1">
                  Confidence Index: <strong>{syncResult.risk_analysis.leukemia.confidence}%</strong>
                </div>
                <p className="risk-description mt-1">
                  {syncResult.risk_analysis.leukemia.notes}
                </p>
              </div>

              {/* RISK DIAGNOSTICS: SOLID TUMOR SCREENING */}
              <div className="risk-panel-box">
                <div className="risk-header-row">
                  <h3>🔬 Epithelial Biomarker Screen</h3>
                  <span className={`risk-pill risk-${syncResult.risk_analysis.solid_tumor.risk.toLowerCase()}`}>
                    {syncResult.risk_analysis.solid_tumor.risk} Risk
                  </span>
                </div>
                <div className="risk-confidence mt-1">
                  Confidence Index: <strong>{syncResult.risk_analysis.solid_tumor.confidence}%</strong>
                </div>
                <p className="risk-description mt-1">
                  {syncResult.risk_analysis.solid_tumor.notes}
                </p>
              </div>

            </div>

            {/* SECONDARY ROW: SHAP EXPLAINABILITY & CLINICAL ACTIONS */}
            <div className="grid grid-2 report-detailed-analysis mt-3">
              
              {/* SHAP PANEL */}
              <div className="shap-card-panel">
                <h3>🧠 SHAP Risk Feature Attribution</h3>
                <p className="text-muted text-sm mb-2">
                  This chart shows which vital variables and blood parameters contributed most to the health score deduction.
                </p>
                <div className="shap-bars-list">
                  {syncResult.feature_contributions.map((item, idx) => (
                    <div key={idx} className="shap-bar-item">
                      <div className="shap-bar-label">
                        <span>{item.feature}</span>
                        <strong>+{item.points} pts impact</strong>
                      </div>
                      <div className="shap-bar-track">
                        <div 
                          className={`shap-bar-fill fill-${syncResult.verdict.toLowerCase().replace(' ', '-')}`} 
                          style={{ width: `${item.impact}%` }}
                        ></div>
                      </div>
                      <span className="shap-bar-pct">{item.impact}% weight</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CLINICAL ACTIONS CARD */}
              <div className="clinical-actions-panel">
                <h3>📋 Recommendation Action Plan</h3>
                <p className="text-muted text-sm mb-2">
                  AI-generated preventive recommendations matching standard clinical guidelines.
                </p>
                <ul className="actions-list">
                  {syncResult.clinical_recommendations.map((rec, idx) => (
                    <li key={idx} className="action-item-bullet">{rec}</li>
                  ))}
                </ul>
              </div>

            </div>

          </section>
        )}

      </div>
    </div>
  );
}

export default DeviceSync;