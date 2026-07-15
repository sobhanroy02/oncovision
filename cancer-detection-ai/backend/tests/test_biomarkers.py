"""
Test suite for the Multi-Parameter Health & Cancer Risk Assessment Model.
Verifies correct risk assignments and score deductions for healthy, leukemia,
and elevated solid tumor antigen profiles.

Author: Geeky Blinders (AIML Sem 7)
"""

import sys
from pathlib import Path

# Add backend directory to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from api.biomarker_analyser import analyze_health_profile

def test_healthy_profile():
    payload = {
        "temperature": 36.6,
        "pulse": 72,
        "spo2": 98,
        "systolic": 115,
        "diastolic": 75,
        "glucose": 90,
        "hemoglobin": 14.2,
        "wbc": 6.5,
        "platelets": 280,
        "cea": 1.1,
        "ca_125": 12.0,
        "psa": 0.8
    }
    res = analyze_health_profile(payload)
    assert res["status"] == "Success"
    assert res["health_score"] == 100
    assert res["verdict"] == "Stable"
    assert res["risk_analysis"]["leukemia"]["risk"] == "Low"
    assert res["risk_analysis"]["solid_tumor"]["risk"] == "Low"
    print("[PASS] Healthy Profile Test")

def test_leukemia_profile():
    payload = {
        "temperature": 37.8,
        "pulse": 98,
        "spo2": 93,
        "systolic": 105,
        "diastolic": 65,
        "glucose": 98,
        "hemoglobin": 8.2,
        "wbc": 29.4,
        "platelets": 58,
        "cea": 1.3,
        "ca_125": 15.0,
        "psa": 1.0
    }
    res = analyze_health_profile(payload)
    assert res["status"] == "Success"
    assert res["health_score"] < 50
    assert res["verdict"] == "Critical"
    assert res["risk_analysis"]["leukemia"]["risk"] == "High"
    assert "leukocytosis" in res["risk_analysis"]["leukemia"]["notes"].lower()
    print("[PASS] Leukemia Profile Test")

def test_solid_tumor_profile():
    payload = {
        "temperature": 37.1,
        "pulse": 84,
        "spo2": 96,
        "systolic": 138,
        "diastolic": 88,
        "glucose": 115,
        "hemoglobin": 12.4,
        "wbc": 9.1,
        "platelets": 220,
        "cea": 14.8,
        "ca_125": 115.2,
        "psa": 9.4
    }
    res = analyze_health_profile(payload)
    assert res["status"] == "Success"
    assert res["health_score"] < 60
    assert res["risk_analysis"]["solid_tumor"]["risk"] == "High"
    assert "gynecological" in res["risk_analysis"]["solid_tumor"]["notes"].lower()
    print("[PASS] Solid Tumor Profile Test")

if __name__ == "__main__":
    print("Running Biomarker Analyser Test Suite...")
    test_healthy_profile()
    test_leukemia_profile()
    test_solid_tumor_profile()
    print("All biomarker test suites PASSED.")
