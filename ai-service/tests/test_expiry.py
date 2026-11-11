"""Expiry Waste Risk v2 — jeux petits, graines fixes."""
from __future__ import annotations

import numpy as np
from sklearn.metrics import roc_auc_score

from expiry.features import BASE_NAMES, engineer, lot_to_row
from expiry.models import ExpiryGBM
from expiry.serve import reset_cache, run
from expiry.simulator import Q0_HI, Q0_LO, build_dataset, calibrate_prevalence, simulate_lot


def _dow(sin_v, cos_v):
    best, day = 1e9, 0
    for d in range(7):
        err = abs(np.sin(2 * np.pi * d / 7) - sin_v) + abs(np.cos(2 * np.pi * d / 7) - cos_v)
        if err < best:
            best, day = err, d
    return day


def _lot_from_sim(feats, hist):
    if feats["strat_fefo"] >= 0.5:
        strat = "FEFO"
    elif feats["strat_fifo"] >= 0.5:
        strat = "FIFO"
    else:
        strat = "STANDARD"
    return {
        "jours_restants": feats["jours_restants"],
        "duree_vie": feats["duree_vie"],
        "age": feats["age"],
        "quantite_restante": feats["q_restante"],
        "quantite_initiale": feats["q_initiale"],
        "q_devant": feats["q_devant"],
        "prix_unitaire": feats["prix"],
        "strategie_sortie": strat,
        "ventes_28j": np.asarray(hist, float).tolist(),
        "ventes_30j": feats["vitesse_30"] * 30.0,
        "dow": _dow(feats["dow_sin"], feats["dow_cos"]),
    }


def test_simulator_deterministic():
    a = build_dataset(30, seed=7)
    b = build_dataset(30, seed=7)
    assert a[0] == BASE_NAMES
    assert np.allclose(a[1], b[1])
    assert np.allclose(a[3], b[3])


def test_lot_to_row_matches_simulator():
    rng = np.random.default_rng(7)
    checked = 0
    while checked < 12:
        feats, hist, _, _, _ = simulate_lot(rng)
        if feats["q_restante"] <= 0:
            continue
        row, seq = lot_to_row(_lot_from_sim(feats, hist))
        expected = [feats[name] for name in BASE_NAMES]
        assert np.allclose(row, expected, rtol=1e-5, atol=1e-5)
        assert np.allclose(seq, hist)
        checked += 1


def test_calibrate_prevalence_band():
    import expiry.simulator as sim
    saved = (sim.Q0_LO, sim.Q0_HI)
    try:
        prev = calibrate_prevalence(target=0.30, n=800, seed=11)
        assert 0.25 <= prev <= 0.40
    finally:
        sim.Q0_LO, sim.Q0_HI = saved
    assert (Q0_LO, Q0_HI) == (0.08, 0.6) or saved == (sim.Q0_LO, sim.Q0_HI)


def test_gbm_beats_baseline_and_cqr():
    names, X, _seqs, wf, wq, hq = build_dataset(6000, seed=7)
    F, base = engineer(X, names)
    idx = np.arange(len(wf))
    rng = np.random.default_rng(11)
    rng.shuffle(idx)
    n = len(idx)
    tr = idx[: int(0.75 * n)]
    cal = idx[int(0.75 * n): int(0.875 * n)]
    te = idx[int(0.875 * n):]
    q = X[:, names.index("q_restante")]
    gbm = ExpiryGBM().fit(F, base, wf, q, tr_idx=tr, cal_idx=cal)
    frac, lo, hi, p = gbm.predict(F[te], base[te])
    y = (wf[te] > 0.05).astype(int)
    auc = roc_auc_score(y, p)
    mae = float(np.mean(np.abs(frac * q[te] - wq[te])))
    mae_b = float(np.mean(np.abs(hq[te] - wq[te])))
    cover = float(np.mean((wf[te] >= lo) & (wf[te] <= hi)))
    assert auc >= 0.90
    assert mae <= mae_b * 0.80
    assert 0.70 <= cover <= 0.92
    assert np.all(lo <= frac + 1e-8)
    assert np.all(frac <= hi + 1e-8)


def test_serve_heuristic_without_artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv("EXPIRY_MODELS_DIR", str(tmp_path))
    reset_cache()
    out = run({
        "lots": [{
            "lot_id": 1,
            "quantite_restante_asof": 10,
            "vitesse_moyenne_journaliere": 1,
            "jours_restants_avant_expiration": 4,
            "prix_unitaire": 2,
        }]
    })
    assert out["mode"] == "heuristic"
    item = out["items"][0]
    assert item["mode_lot"] == "heuristic"
    assert item["qte_predite_dlc"] == 6.0
    for key in ("proba_waste", "valeur_predite", "y_hat_waste", "cover_days", "qte_p10", "qte_p50", "qte_p90"):
        assert key in item


def test_old_contract_still_scores(tmp_path, monkeypatch):
    monkeypatch.setenv("EXPIRY_MODELS_DIR", str(tmp_path))
    reset_cache()
    out = run({
        "lots": [{
            "lot_id": 9,
            "quantite_restante_asof": 8,
            "vitesse_moyenne_journaliere": 0.5,
            "jours_restants_avant_expiration": 3,
            "prix_unitaire": 4,
        }]
    })
    item = out["items"][0]
    assert item["lot_id"] == 9
    assert item["qte_predite_dlc"] == 6.5
    assert item["y_hat_waste"] in (0, 1)
    assert item["valeur_predite"] == 26.0


def test_quantiles_do_not_cross(tmp_path, monkeypatch):
    monkeypatch.setenv("EXPIRY_MODELS_DIR", str(tmp_path))
    from expiry.train import train
    train(synthetic_n=2500, epochs=0, seed=3, enforce_acceptance=False)
    reset_cache()
    names, X, seqs, wf, _wq, _hq = build_dataset(8, seed=4)
    lots = []
    for i in range(8):
        feats = {name: float(X[i, j]) for j, name in enumerate(names)}
        lots.append({"lot_id": i + 1, **_lot_from_sim(feats, seqs[i])})
    out = run({"lots": lots})
    assert out["mode"] == "gbm"
    for item in out["items"]:
        assert item["qte_p10"] <= item["qte_p50"] + 1e-6
        assert item["qte_p50"] <= item["qte_p90"] + 1e-6
        assert abs(item["qte_p50"] - item["qte_predite_dlc"]) < 1e-6


def test_torch_absent_falls_back_to_gbm(tmp_path, monkeypatch):
    monkeypatch.setenv("EXPIRY_MODELS_DIR", str(tmp_path))
    import expiry.models as models
    monkeypatch.setattr(models, "HAS_TORCH", False)
    from expiry.train import train
    card = train(synthetic_n=1200, epochs=3, seed=5, enforce_acceptance=False)
    assert card["mode"] == "gbm"
    reset_cache()
    out = run({
        "lots": [{
            "lot_id": 2,
            "quantite_restante": 20,
            "quantite_initiale": 40,
            "jours_restants": 10,
            "duree_vie": 30,
            "age": 20,
            "prix_unitaire": 3,
            "strategie_sortie": "FEFO",
            "q_devant": 4,
            "ventes_28j": [1.0] * 28,
            "ventes_30j": 30,
            "dow": 2,
        }]
    })
    assert out["mode"] == "gbm"
    assert out["items"][0]["mode_lot"] == "gbm"
    assert out["model"]["data"]["realDataSufficient"] is False
