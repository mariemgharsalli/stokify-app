import anomaly_ml
from anomaly_ml import model_status, run_anomalies


def _run(rows, tmp_path, monkeypatch):
    monkeypatch.setattr(anomaly_ml, "MODELS_DIR", tmp_path)
    return run_anomalies({"societeId": 4242, "mouvements": rows, "retrain": True})


def test_clean_batch_alert_rate_under_two_percent(clean_movements, tmp_path, monkeypatch):
    out = _run(clean_movements, tmp_path, monkeypatch)
    alerts = [a for a in out["anomalies"] if a.get("statut") == "ALERTE"]
    rate = len(alerts) / len(clean_movements)
    assert rate < 0.02
    status = model_status(4242)
    assert status["decisionRegime"] == "cold_start"
    assert status["labels"]["pos"] == 0


def test_injected_outliers_are_detected(injected_movements, tmp_path, monkeypatch):
    out = _run(injected_movements, tmp_path, monkeypatch)
    alerts = [a for a in out["anomalies"] if a.get("statut") == "ALERTE"]
    caught = {int(a["mouvementId"]) for a in alerts}
    expected = {11, 81, 161, 301}
    assert len(caught & expected) >= 3
    sample = next(a for a in alerts if int(a["mouvementId"]) in expected)
    meta = sample["mlMeta"]
    assert meta["regime"] == "cold_start"
    assert "ecart_robuste" in meta["rules"]
    assert "contributions" in meta
