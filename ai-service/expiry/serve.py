"""Inférence Expiry Waste : ensemble, GBM seul, ou heuristique étiquetée."""
from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from pathlib import Path

import joblib
import numpy as np

from . import models as M
from .explain import explain_batch
from .features import BASE_NAMES, engineer, lot_to_row
from .models import ensemble_predict
from .train import models_dir

log = logging.getLogger("stokify.expiry")

KIND = "ml_expiry_waste"
VERSION = "2.0.0"

_LOCK = threading.Lock()
_STATE = None
_JOB_LOCK = threading.Lock()
_JOB = {
    "id": None,
    "status": "idle",
    "verdict": None,
    "error": None,
    "startedAt": None,
    "finishedAt": None,
}


def reset_cache():
    global _STATE
    with _LOCK:
        _STATE = None


def _has_new_contract(lot: dict) -> bool:
    return any(lot.get(k) is not None for k in ("ventes_28j", "quantite_restante", "duree_vie", "q_devant"))


def _num(value, default=0.0):
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def heuristic_item(lot: dict) -> dict:
    q = _num(lot.get("quantite_restante") if lot.get("quantite_restante") is not None else lot.get("quantite_restante_asof"))
    q = max(0.0, q)
    if lot.get("ventes_30j") is not None:
        v = max(0.0, _num(lot.get("ventes_30j")) / 30.0)
    else:
        v = max(0.0, _num(lot.get("vitesse_moyenne_journaliere")))
    if lot.get("jours_restants") is not None:
        j = max(0.0, _num(lot.get("jours_restants")))
    else:
        j = max(0.0, _num(lot.get("jours_restants_avant_expiration")))
    prix = max(0.0, _num(lot.get("prix_unitaire")))
    q_pred = max(0.0, q - v * j)
    proba = min(1.0, q_pred / max(q, 1e-6))
    cover = round(q / v, 2) if v > 1e-6 else None
    return {
        "lot_id": lot.get("lot_id") if lot.get("lot_id") is not None else lot.get("lotId"),
        "qte_predite_dlc": round(q_pred, 2),
        "proba_waste": round(proba, 4),
        "valeur_predite": round(q_pred * prix, 2),
        "y_hat_waste": 1 if q_pred > 1e-6 else 0,
        "cover_days": cover,
        "qte_p10": round(q_pred, 2),
        "qte_p50": round(q_pred, 2),
        "qte_p90": round(q_pred, 2),
        "valeur_p90": round(q_pred * prix, 2),
        "drivers": [],
        "mode_lot": "heuristic",
    }


def _empty_model(mode="heuristic"):
    return {
        "trainedAt": None,
        "mode": mode,
        "data": {"synthetic": 0, "real": 0, "realDataSufficient": False},
        "metrics": {},
    }


def _read_card(directory: Path):
    path = directory / "model_card.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _load_unlocked():
    global _STATE
    directory = models_dir()
    gbm_path = directory / "gbm_v2.joblib"
    card = _read_card(directory)
    if not gbm_path.exists():
        _STATE = {"mode": "heuristic", "card": card, "gbm": None}
        return _STATE
    bundle = joblib.load(gbm_path)
    net = None
    mode = "gbm"
    pt = directory / "net_v2.pt"
    if bundle.get("has_net") and M.HAS_TORCH and pt.exists():
        try:
            net = M.ExpiryNet(int(len(bundle["mu"])))
            try:
                state = __import__("torch").load(pt, map_location="cpu", weights_only=True)
            except TypeError:
                state = __import__("torch").load(pt, map_location="cpu")
            net.load_state_dict(state)
            net.eval()
            mode = "ensemble"
        except Exception:
            log.warning("réseau expiry illisible, repli GBM")
            net = None
            mode = "gbm"
    _STATE = {**bundle, "net": net, "mode": mode, "card": card}
    return _STATE


def current():
    with _LOCK:
        if _STATE is None:
            return _load_unlocked()
        return _STATE


def reload():
    with _LOCK:
        return _load_unlocked()


def _public_model(state):
    card = state.get("card") or {}
    mode = state.get("mode") or "heuristic"
    data = card.get("data") or {"synthetic": 0, "real": 0, "realDataSufficient": False}
    metrics = card.get("metrics") or {}
    summary = {
        "trainedAt": card.get("trainedAt"),
        "mode": mode,
        "data": {
            "synthetic": int(data.get("synthetic") or 0),
            "real": int(data.get("real") or 0),
            "realDataSufficient": bool(data.get("realDataSufficient")),
        },
        "metrics": {
            "auc": metrics.get("auc"),
            "brier": metrics.get("brier"),
            "improvementPct": metrics.get("improvementPct"),
            "maeQty": metrics.get("maeQty"),
            "maeBaseline": metrics.get("maeBaseline"),
            "coverage": metrics.get("coverage"),
            "ece": metrics.get("ece"),
        },
    }
    if card:
        summary["curve"] = card.get("curve") or []
        summary["reliability"] = card.get("reliability") or []
        summary["importance"] = card.get("importance") or []
        summary["holdout"] = card.get("holdout")
        summary["champion"] = card.get("champion")
        summary["valLoss"] = card.get("valLoss")
        summary["version"] = card.get("version") or VERSION
    return summary


def run(payload: dict) -> dict:
    state = current()
    lots = list((payload or {}).get("lots") or [])
    mode = state.get("mode") or "heuristic"
    model = _public_model(state) if state.get("gbm") is not None else _empty_model("heuristic")
    if state.get("gbm") is None:
        mode = "heuristic"
    indexed = []
    rows, seqs = [], []
    order = []
    items = [None] * len(lots)
    for i, lot in enumerate(lots):
        lot = lot if isinstance(lot, dict) else {}
        if mode == "heuristic" or not _has_new_contract(lot):
            items[i] = heuristic_item(lot)
            continue
        row, seq = lot_to_row(lot)
        rows.append(row)
        seqs.append(seq)
        order.append(i)
        indexed.append(lot)
    if rows:
        X = np.asarray(rows, float)
        S = np.asarray(seqs, float)
        F, base = engineer(X, BASE_NAMES)
        frac, lo, hi, p = ensemble_predict(
            state["gbm"], state.get("net"), state["mu"], state["sd"], state.get("iso"), F, base, S
        )
        med = state["medians"]
        names = state.get("names")

        def predict_p(Fm, bm):
            _, _, _, pp = ensemble_predict(
                state["gbm"], state.get("net"), state["mu"], state["sd"], state.get("iso"), Fm, bm, S
            )
            return pp

        drivers = explain_batch(predict_p, F, base, med, names)
        q = X[:, BASE_NAMES.index("q_restante")]
        prix = X[:, BASE_NAMES.index("prix")]
        v30 = X[:, BASE_NAMES.index("vitesse_30")]
        q50 = frac * q
        q10 = np.minimum(lo * q, q50)
        q90 = np.maximum(hi * q, q50)
        for k, lot in enumerate(indexed):
            cover = round(float(q[k] / v30[k]), 2) if v30[k] > 1e-6 else None
            items[order[k]] = {
                "lot_id": lot.get("lot_id") if lot.get("lot_id") is not None else lot.get("lotId"),
                "qte_predite_dlc": round(float(q50[k]), 2),
                "proba_waste": round(float(p[k]), 4),
                "valeur_predite": round(float(q50[k] * prix[k]), 2),
                "y_hat_waste": 1 if float(p[k]) >= 0.5 else 0,
                "cover_days": cover,
                "qte_p10": round(float(q10[k]), 2),
                "qte_p50": round(float(q50[k]), 2),
                "qte_p90": round(float(q90[k]), 2),
                "valeur_p90": round(float(q90[k] * prix[k]), 2),
                "drivers": drivers[k],
                "mode_lot": mode,
            }
    return {
        "kind": KIND if mode != "heuristic" else "heuristic_expiry_waste",
        "version": VERSION,
        "mode": mode,
        "model": model,
        "items": items,
    }


def job_status():
    with _JOB_LOCK:
        return dict(_JOB)


def status_payload():
    state = current()
    model = _public_model(state) if state.get("gbm") is not None else _empty_model("heuristic")
    return {"job": job_status(), "model": model}


def enqueue_train(real_rows=None, synthetic=60000, epochs=40):
    global _JOB
    with _JOB_LOCK:
        if _JOB.get("status") == "running" and _JOB.get("id"):
            return _JOB["id"]
        job_id = uuid.uuid4().hex[:12]
        _JOB = {
            "id": job_id,
            "status": "running",
            "verdict": None,
            "error": None,
            "startedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "finishedAt": None,
        }

    def worker():
        global _JOB
        try:
            from .train import AcceptanceError, train
            try:
                card = train(
                    real_rows=real_rows,
                    synthetic_n=int(synthetic),
                    epochs=int(epochs),
                    enforce_acceptance=True,
                )
                verdict = "champion" if card.get("champion") else f"challenger: {card.get('challengerReason')}"
                error = None
            except AcceptanceError as exc:
                card = exc.card
                verdict = f"rejeté: {card.get('challengerReason')}"
                error = str(exc)
            reload()
            with _JOB_LOCK:
                _JOB["status"] = "error" if error else "done"
                _JOB["verdict"] = verdict
                _JOB["error"] = error
                _JOB["finishedAt"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
            log.info("expiry train job=%s verdict=%s", job_id, verdict)
        except Exception as exc:
            log.exception("expiry train en échec")
            with _JOB_LOCK:
                _JOB["status"] = "error"
                _JOB["error"] = exc.__class__.__name__
                _JOB["verdict"] = "erreur"
                _JOB["finishedAt"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()

    threading.Thread(target=worker, name=f"expiry-train-{job_id}", daemon=True).start()
    return job_id


def maybe_autostart():
    if os.getenv("PYTEST_CURRENT_TEST"):
        return
    if os.getenv("EXPIRY_AUTOTRAIN", "1") == "0":
        return
    if (models_dir() / "gbm_v2.joblib").exists():
        reload()
        return
    log.info("aucun artefact expiry : entraînement synthétique léger en arrière-plan")
    enqueue_train(None, synthetic=15000, epochs=15)
