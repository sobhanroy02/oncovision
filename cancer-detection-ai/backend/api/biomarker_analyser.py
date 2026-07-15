"""
Biomarker and Vitals Analyser for the AI Cancer Detection System.
Calculates a General Health Score, screens for Hematological/Leukemia risk,
screens solid tumor biomarkers (CEA, CA-125, PSA), simulates SHAP explainability,
and generates clinical recommendations.

Author: Geeky Blinders (AIML Sem 7)
"""

from typing import Dict, Any, List

def analyze_health_profile(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes vitals, blood markers, and tumor antigens to evaluate health status
    and cancer risk levels.

    Args:
        data: Dict containing:
            - temperature (C)
            - pulse (bpm)
            - spo2 (%)
            - systolic (mmHg)
            - diastolic (mmHg)
            - glucose (mg/dL)
            - hemoglobin (g/dL)
            - wbc (x10^9/L)
            - platelets (x10^9/L)
            - cea (ng/mL)
            - ca_125 (U/mL)
            - psa (ng/mL)

    Returns:
        Dict containing health score, risk assessments, SHAP contributions, and recommendations.
    """
    # Safe float parsing helper
    def parse_float(val) -> float:
        if val is None or val == "":
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    # Parse parameters
    temp = parse_float(data.get("temperature"))
    pulse = parse_float(data.get("pulse"))
    spo2 = parse_float(data.get("spo2"))
    systolic = parse_float(data.get("systolic"))
    diastolic = parse_float(data.get("diastolic"))
    glucose = parse_float(data.get("glucose"))
    hb = parse_float(data.get("hemoglobin"))
    wbc = parse_float(data.get("wbc"))
    plt = parse_float(data.get("platelets"))
    cea = parse_float(data.get("cea"))
    ca125 = parse_float(data.get("ca_125"))
    psa = parse_float(data.get("psa"))

    score_deductions = {}
    flags = []
    vitals_flags = []

    # 1. Temperature Analysis
    if temp is not None:
        if temp >= 37.8:
            score_deductions["Temperature"] = 15
            vitals_flags.append(f"Fever detected ({temp}°C)")
        elif temp < 35.5:
            score_deductions["Temperature"] = 10
            vitals_flags.append(f"Hypothermia alert ({temp}°C)")

    # 2. Pulse Analysis
    if pulse is not None:
        if pulse > 100:
            score_deductions["Heart Rate"] = 12
            vitals_flags.append(f"Tachycardia detected ({int(pulse)} bpm)")
        elif pulse < 55:
            score_deductions["Heart Rate"] = 8
            vitals_flags.append(f"Bradycardia alert ({int(pulse)} bpm)")

    # 3. SpO2 Analysis
    if spo2 is not None:
        if spo2 < 92:
            score_deductions["Oxygen Saturation (SpO2)"] = 25
            vitals_flags.append(f"Severe hypoxemia ({int(spo2)}%)")
        elif spo2 < 95:
            score_deductions["Oxygen Saturation (SpO2)"] = 15
            vitals_flags.append(f"Mild hypoxemia ({int(spo2)}%)")

    # 4. Blood Pressure Analysis
    if systolic is not None and diastolic is not None:
        if systolic > 140 or diastolic > 90:
            score_deductions["Blood Pressure"] = 12
            vitals_flags.append(f"Hypertension alert ({int(systolic)}/{int(diastolic)} mmHg)")
        elif systolic < 90 or diastolic < 60:
            score_deductions["Blood Pressure"] = 10
            vitals_flags.append(f"Hypotension alert ({int(systolic)}/{int(diastolic)} mmHg)")

    # 5. Glucose Analysis
    if glucose is not None:
        if glucose > 180:
            score_deductions["Blood Sugar (Glucose)"] = 18
            vitals_flags.append(f"Severe hyperglycemia ({int(glucose)} mg/dL)")
        elif glucose > 140:
            score_deductions["Blood Sugar (Glucose)"] = 10
            vitals_flags.append(f"Mild hyperglycemia ({int(glucose)} mg/dL)")
        elif glucose < 60:
            score_deductions["Blood Sugar (Glucose)"] = 12
            vitals_flags.append(f"Hypoglycemia alert ({int(glucose)} mg/dL)")

    # 6. Complete Blood Count (Leukemia screening markers)
    leukemia_risk = "Low"
    leukemia_conf = 10.0
    leukemia_notes = "Complete blood count markers are within normal limits."
    cbc_deductions = 0

    if hb is not None and hb < 11.5:
        score_deductions["Hemoglobin"] = 15
        cbc_deductions += 15
        flags.append(f"Anemia flagged (Hemoglobin: {hb} g/dL)")
    
    if wbc is not None:
        if wbc > 18.0:
            score_deductions["White Blood Cells (WBC)"] = 25
            cbc_deductions += 25
            flags.append(f"Leukocytosis detected (WBC: {wbc} x10^9/L)")
        elif wbc > 11.0:
            score_deductions["White Blood Cells (WBC)"] = 12
            cbc_deductions += 12
            flags.append(f"Elevated WBC (WBC: {wbc} x10^9/L)")
        elif wbc < 3.5:
            score_deductions["White Blood Cells (WBC)"] = 15
            cbc_deductions += 15
            flags.append(f"Leukopenia detected (WBC: {wbc} x10^9/L)")

    if plt is not None:
        if plt < 100.0:
            score_deductions["Platelets"] = 20
            cbc_deductions += 20
            flags.append(f"Thrombocytopenia detected (Platelets: {plt} x10^9/L)")
        elif plt < 145.0:
            score_deductions["Platelets"] = 10
            cbc_deductions += 10
            flags.append(f"Borderline low platelets (Platelets: {plt} x10^9/L)")

    # Compute Leukemia Screening Risk Level
    # If severe WBC elevation AND severe anemia/thrombocytopenia -> High Risk
    if wbc is not None and hb is not None and plt is not None:
        if wbc > 20.0 and hb < 10.0 and plt < 100.0:
            leukemia_risk = "High"
            leukemia_conf = min(95.0, 60.0 + (wbc - 20) + (10 - hb) * 3 + (100 - plt) * 0.2)
            leukemia_notes = "Severe leukocytosis accompanied by moderate-to-severe anemia and thrombocytopenia. This multi-factor CBC profile is highly indicative of hematological stress, requiring urgent diagnostic review for Leukemia."
        elif (wbc > 14.0 or wbc < 3.5) and (hb < 11.0 or plt < 130.0):
            leukemia_risk = "Medium"
            leukemia_conf = 65.0
            leukemia_notes = "Moderately abnormal white blood cell levels paired with mild anemia or borderline low platelets. Clinical follow-up with a CBC rerun is recommended."
        elif wbc > 11.0 or hb < 11.5 or plt < 145.0:
            leukemia_risk = "Borderline"
            leukemia_conf = 45.0
            leukemia_notes = "Slight deviation in blood count parameters. May be related to a minor infection or temporary stress. Monitor and repeat in 1-2 weeks."
    
    # 7. Tumor Biomarkers screening
    solid_tumor_risk = "Low"
    solid_tumor_conf = 10.0
    solid_tumor_pathway = None
    solid_tumor_notes = "All tested cancer-specific tumor biomarkers (CEA, CA-125, PSA) are within normal baseline ranges."

    cea_elevated = cea is not None and cea > 2.5
    ca125_elevated = ca125 is not None and ca125 > 35.0
    psa_elevated = psa is not None and psa > 4.0

    solid_tumor_contributions = []

    if cea_elevated:
        # CEA elevated: colon/lung indicator
        impact = 15 if cea <= 5.0 else 30
        score_deductions["Carcinoembryonic Antigen (CEA)"] = impact
        flags.append(f"Elevated CEA marker: {cea} ng/mL (Normal < 2.5)")
        solid_tumor_contributions.append(("CEA", cea, "GI / Lung Pathway"))

    if ca125_elevated:
        # CA-125 elevated: ovarian/uterine indicator
        impact = 18 if ca125 <= 50.0 else 35
        score_deductions["Cancer Antigen 125 (CA-125)"] = impact
        flags.append(f"Elevated CA-125 marker: {ca125} U/mL (Normal < 35)")
        solid_tumor_contributions.append(("CA-125", ca125, "Gynecological / Uterine Pathway"))

    if psa_elevated:
        # PSA elevated: prostate indicator
        impact = 15 if psa <= 10.0 else 32
        score_deductions["Prostate-Specific Antigen (PSA)"] = impact
        flags.append(f"Elevated PSA marker: {psa} ng/mL (Normal < 4.0)")
        solid_tumor_contributions.append(("PSA", psa, "Prostate Pathway"))

    if solid_tumor_contributions:
        # Select highest risk marker
        max_severity = 0.0
        details = []
        for marker, val, path in solid_tumor_contributions:
            if marker == "CEA":
                risk_conf = 50.0 + min(40.0, (val - 2.5) * 4)
                max_severity = max(max_severity, risk_conf)
                details.append(f"CEA ({val} ng/mL - {path})")
            elif marker == "CA-125":
                risk_conf = 50.0 + min(45.0, (val - 35.0) * 0.5)
                max_severity = max(max_severity, risk_conf)
                details.append(f"CA-125 ({val} U/mL - {path})")
            elif marker == "PSA":
                risk_conf = 55.0 + min(40.0, (val - 4.0) * 3)
                max_severity = max(max_severity, risk_conf)
                details.append(f"PSA ({val} ng/mL - {path})")

        solid_tumor_conf = round(max_severity, 1)
        if solid_tumor_conf >= 75.0:
            solid_tumor_risk = "High"
            solid_tumor_notes = f"Significant elevation detected in specific tumor antigen: {', '.join(details)}. This indicates a heightened clinical index for potential oncological activity. Further radiological or cytological examination is highly recommended."
        else:
            solid_tumor_risk = "Medium"
            solid_tumor_notes = f"Moderate elevation in tumor antigen: {', '.join(details)}. Mild elevations can occur due to benign inflammatory conditions, but should be tracked via follow-up screenings."

    # 8. Calculate Health Score
    total_deductions = sum(score_deductions.values())
    health_score = max(0, 100 - total_deductions)

    # 9. General Verdict & Status
    if health_score >= 85:
        verdict = "Stable"
    elif health_score >= 60:
        verdict = "Needs Review"
    else:
        verdict = "Critical"

    # 10. Explainability Feature Attribution (Simulated SHAP/Feature Importances)
    shap_contributions = []
    if total_deductions > 0:
        for feature, val in score_deductions.items():
            percentage = round((val / total_deductions) * 100, 1)
            shap_contributions.append({
                "feature": feature,
                "impact": percentage,
                "points": val,
                "direction": "increased_risk"
            })
    else:
        # If perfect health, all parameters contribute 0% risk impact
        shap_contributions = [
            {"feature": "Vitals baseline", "impact": 0.0, "points": 0, "direction": "neutral"}
        ]
    
    # Sort SHAP contributions by impact descending
    shap_contributions.sort(key=lambda x: x["impact"], reverse=True)

    # 11. Recommendations Generator
    recommendations = []
    if verdict == "Stable":
        recommendations.append("Continue routine daily vitals monitoring.")
        recommendations.append("Maintain standard hydration and balanced diet.")
        recommendations.append("Repeat biomarker screens as per standard annual wellness checks.")
    else:
        if leukemia_risk in ("High", "Medium"):
            recommendations.append("Schedule a consultation with a hematologist-oncologist immediately.")
            recommendations.append("Obtain a prescription for a full Peripheral Blood Smear (PBS) microscopy test.")
        if solid_tumor_risk in ("High", "Medium"):
            recommendations.append("Consult a primary physician regarding elevated oncological serum markers.")
            recommendations.append("Correlate findings with follow-up radiological scans (e.g. Ultrasound, CT, or MRI) of relevant pathways.")
        
        # Vitals specific suggestions
        if temp is not None and temp >= 37.8:
            recommendations.append("Monitor body temperature closely and manage fever with rest and antipyretics under physician guide.")
        if spo2 is not None and spo2 < 95:
            recommendations.append("Measure oxygen saturation at rest and seek immediate care if SpO2 drops below 92%.")
        if systolic is not None and (systolic > 140 or diastolic > 90):
            recommendations.append("Limit sodium intake and consult a physician for cardiovascular blood pressure management.")
        if glucose is not None and glucose > 140:
            recommendations.append("Consult an endocrinologist regarding potential glucose intolerance or glycemic index control.")

        # General backup
        recommendations.append("Provide a printout of this IoT phased health report to your healthcare provider.")

    return {
        "status": "Success",
        "health_score": int(health_score),
        "verdict": verdict,
        "vitals_verdict": {
            "status": "Optimal" if not vitals_flags else "Sub-optimal",
            "flags": vitals_flags
        },
        "risk_analysis": {
            "leukemia": {
                "risk": leukemia_risk,
                "confidence": round(leukemia_conf, 1),
                "notes": leukemia_notes
            },
            "solid_tumor": {
                "risk": solid_tumor_risk,
                "confidence": round(solid_tumor_conf, 1),
                "notes": solid_tumor_notes
            }
        },
        "feature_contributions": shap_contributions,
        "all_flags": flags + vitals_flags,
        "clinical_recommendations": recommendations,
        "normalized_inputs": {
            "temperature": temp,
            "pulse": pulse,
            "spo2": spo2,
            "systolic": systolic,
            "diastolic": diastolic,
            "glucose": glucose,
            "hemoglobin": hb,
            "wbc": wbc,
            "platelets": plt,
            "cea": cea,
            "ca_125": ca125,
            "psa": psa
        }
    }
