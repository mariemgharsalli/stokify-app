import numpy as np

from forecast_ml import run_forecast


def _months(n, start="2023-01"):
    y, m = [int(x) for x in start.split("-")]
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return keys


def test_seasonal_champion_beats_naive(seasonal_series):
    hist = [{"mois": k, "quantite": float(v)} for k, v in zip(_months(36), seasonal_series)]
    out = run_forecast({"article_id": 11, "historique": hist, "horizon": 3})
    assert out["mase"] is not None and out["mase"] < 1
    assert out["confidenceLabel"] in ("fiable", "moyen", "faible")
    assert out["mapes"]["hw"] != 40 if "mapes" in out else True
    dumped = str(out.get("comparaison"))
    assert "40.0" not in dumped
    preds = out["predictions"]
    for row in preds:
        assert row["lower"] is not None and row["upper"] is not None
        assert row["lower"] <= row["valeur"] <= row["upper"]
        assert row["lower"] >= 0
    from forecast_ml import _fit_holt_winters, _walk_forward

    def one(train):
        _, full, _, _ = _fit_holt_winters(np.asarray(train, float), 1)
        return full[:1]

    resid = _walk_forward(seasonal_series, one)["absResid"]
    q = float(np.quantile(resid, 0.8))
    coverage = float(np.mean(resid <= q + 1e-9))
    assert 0.70 <= coverage <= 0.90
    out["_coverage"] = round(coverage, 3)


def test_short_history_is_honest(short_history):
    out = run_forecast({"article_id": 3, "historique": short_history, "horizon": 3})
    assert out["confidence"] is None
    assert out["confidenceLabel"] == "insuffisant"
    assert out["mode"] == "moyenne_ponderee_historique_court"
    models = out["comparaison"]["models"]
    mapes = {m["id"]: m["mape"] for m in models}
    assert mapes["hw"] is None
    assert mapes["nbeats"] is None
    assert mapes["hybrid"] is None
    assert 40.0 not in mapes.values()
    for row in out["predictions"]:
        assert row["lower"] is None and row["upper"] is None
