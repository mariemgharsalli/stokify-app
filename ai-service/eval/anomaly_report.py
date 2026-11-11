"""Précision / rappel sur anomalies injectées, taux d'alertes sur données propres."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import anomaly_ml
from anomaly_ml import run_anomalies

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "reports" / "anomaly_eval.json"


def _rows(qty, hour=10):
    rows = []
    for i, q in enumerate(qty):
        rows.append({
            "mouvementId": i + 1,
            "articleId": 1,
            "depotId": 1,
            "quantite": float(max(1.0, q)),
            "type": "SORTIE",
            "moyenneHabituelle": 20.0,
            "frequence": 0.4,
            "ecartVsMoyenne": 0.0,
            "date": f"2026-06-01T{hour:02d}:00:00+00:00",
        })
    return rows


def main():
    rng = np.random.default_rng(7)
    clean_qty = rng.normal(20.0, 1.5, 400)
    clean = _rows(clean_qty)
    injected_qty = clean_qty.copy()
    idx = [10, 80, 160, 300]
    for k, i in enumerate(idx):
        injected_qty[i] = 400 + 50 * k
    injected = _rows(injected_qty)
    models = ROOT / "reports" / "anomaly_models"
    models.mkdir(parents=True, exist_ok=True)
    anomaly_ml.MODELS_DIR = models

    clean_out = run_anomalies({"societeId": 1, "mouvements": clean, "retrain": True})
    inj_out = run_anomalies({"societeId": 2, "mouvements": injected, "retrain": True})
    clean_alerts = [a for a in clean_out["anomalies"] if a.get("statut") == "ALERTE"]
    inj_alerts = {int(a["mouvementId"]) for a in inj_out["anomalies"] if a.get("statut") == "ALERTE"}
    expected = {i + 1 for i in idx}
    tp = len(inj_alerts & expected)
    fp = len(inj_alerts - expected)
    fn = len(expected - inj_alerts)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    report = {
        "cleanAlertRate": round(len(clean_alerts) / 400, 4),
        "cleanAlerts": len(clean_alerts),
        "injectedDetected": tp,
        "injectedTotal": 4,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
