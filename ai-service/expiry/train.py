"""Entraînement : simulation, affinage réel, CQR, champion / challenger."""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import roc_auc_score

from . import models as M
from .features import ALL_NAMES, BASE_NAMES, engineer, lot_to_row
from .models import ExpiryGBM, ensemble_predict
from .simulator import build_dataset

log = logging.getLogger("stokify.expiry")

VERSION = "2.0.0"


class AcceptanceError(RuntimeError):
    def __init__(self, card):
        super().__init__("critères d'acceptation non atteints")
        self.card = card


def models_dir() -> Path:
    env = os.getenv("EXPIRY_MODELS_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[1] / "models" / "expiry"


def _atomic_bytes(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _atomic_text(path: Path, text: str):
    _atomic_bytes(path, text.encode("utf-8"))


def _atomic_joblib(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    joblib.dump(obj, tmp)
    os.replace(tmp, path)


def _portion(indexes, seed):
    rng = np.random.default_rng(seed)
    ix = np.asarray(indexes, int).copy()
    rng.shuffle(ix)
    n = len(ix)
    if n == 0:
        empty = np.array([], int)
        return empty, empty, empty
    n_tr = int(round(0.65 * n))
    n_cal = int(round(0.15 * n))
    if n >= 3:
        n_tr = min(max(n_tr, 1), n - 2)
        n_cal = min(max(n_cal, 1), n - n_tr - 1)
    return ix[:n_tr], ix[n_tr:n_tr + n_cal], ix[n_tr + n_cal:]


def _append_real(names, X, seqs, wf, wq, hq, real_rows):
    source = np.zeros(len(wf), dtype=np.int8)
    if not real_rows:
        return X, seqs, wf, wq, hq, source
    rows, ss, wfs, wqs, hqs = [], [], [], [], []
    for raw in real_rows:
        if not isinstance(raw, dict):
            continue
        feat = raw.get("features") if isinstance(raw.get("features"), dict) else raw
        feat = {k: v for k, v in feat.items() if not str(k).startswith("_") and k != "lot_id"}
        q = float(raw.get("qteRestante") or feat.get("quantite_restante") or 0)
        obs = raw.get("observedWasteQty")
        if obs is None or q <= 0:
            continue
        obs = float(np.clip(float(obs), 0, q))
        try:
            base_row, seq = lot_to_row(feat)
        except Exception:
            continue
        v30 = base_row[BASE_NAMES.index("vitesse_30")]
        j = base_row[BASE_NAMES.index("jours_restants")]
        rows.append(base_row)
        ss.append(seq)
        wfs.append(obs / q)
        wqs.append(obs)
        hqs.append(max(0.0, q - v30 * max(j, 0.0)))
    if not rows:
        return X, seqs, wf, wq, hq, source
    X = np.vstack([X, np.asarray(rows, float)])
    seqs = np.vstack([seqs, np.asarray(ss, float)])
    wf = np.concatenate([wf, np.asarray(wfs, float)])
    wq = np.concatenate([wq, np.asarray(wqs, float)])
    hq = np.concatenate([hq, np.asarray(hqs, float)])
    source = np.concatenate([source, np.ones(len(rows), dtype=np.int8)])
    return X, seqs, wf, wq, hq, source


def _reliability(p, y, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    rows = []
    ece = 0.0
    n = max(len(p), 1)
    for i in range(bins):
        if i == bins - 1:
            m = (p >= edges[i]) & (p <= edges[i + 1])
        else:
            m = (p >= edges[i]) & (p < edges[i + 1])
        count = int(m.sum())
        if count == 0:
            rows.append({"bin": i, "pred": None, "obs": None, "n": 0})
            continue
        conf = float(p[m].mean())
        acc = float(y[m].mean())
        ece += (count / n) * abs(acc - conf)
        rows.append({"bin": i, "pred": conf, "obs": acc, "n": count})
    return float(ece), rows


def _pinball_np(pred, y, level):
    diff = y - pred
    return float(np.mean(np.maximum(level * diff, (level - 1) * diff)))


def _metrics(frac, lo, hi, p, wf, wq, hq, q):
    y = (wf > 0.05).astype(int)
    p = np.clip(p, 0, 1)
    if len(np.unique(y)) < 2:
        auc = float("nan")
    else:
        auc = float(roc_auc_score(y, p))
    brier = float(np.mean((p - y) ** 2))
    p_base = np.clip(hq / np.maximum(q, 1e-6), 0, 1)
    brier_base = float(np.mean((p_base - y) ** 2))
    mae = float(np.mean(np.abs(frac * q - wq)))
    mae_base = float(np.mean(np.abs(hq - wq)))
    improve = float((mae_base - mae) / mae_base * 100) if mae_base > 1e-9 else 0.0
    brier_improve = float((brier_base - brier) / brier_base) if brier_base > 1e-9 else 0.0
    cover = float(np.mean((wf >= lo) & (wf <= hi)))
    ece, curve = _reliability(p, y, 10)
    return {
        "auc": auc,
        "brier": brier,
        "brierBaseline": brier_base,
        "brierImprovement": brier_improve,
        "maeQty": mae,
        "maeBaseline": mae_base,
        "improvementPct": improve,
        "coverage": cover,
        "ece": ece,
        "reliability": curve,
    }


def _importance(predict_p, F, base, seq, y, names):
    rng = np.random.default_rng(0)
    n = len(y)
    take = np.arange(n)
    if n > 3000:
        take = rng.choice(n, 3000, replace=False)
    y_s = y[take]
    if len(np.unique(y_s)) < 2:
        return []
    p0 = np.asarray(predict_p(F[take], base[take], seq[take]), float)
    base_auc = float(roc_auc_score(y_s, np.clip(p0, 0, 1)))
    rows = []
    for j, name in enumerate(names):
        Fp = F[take].copy()
        col = Fp[:, j].copy()
        rng.shuffle(col)
        Fp[:, j] = col
        bp = base[take].copy()
        if name == "base_frac":
            bp = col.copy()
        pp = np.clip(np.asarray(predict_p(Fp, bp, seq[take]), float), 0, 1)
        try:
            auc_j = float(roc_auc_score(y_s, pp))
        except ValueError:
            continue
        rows.append({"name": name, "importance": float(base_auc - auc_j)})
    rows.sort(key=lambda r: r["importance"], reverse=True)
    return rows[:10]


def _acceptance(m):
    reasons = []
    if not np.isfinite(m["auc"]) or m["auc"] < 0.93:
        reasons.append(f"AUC {m['auc']:.3f} < 0.93")
    if m["brier"] > 0.12 or m["brierImprovement"] < 0.30:
        reasons.append(
            f"Brier {m['brier']:.3f} (gain {m['brierImprovement'] * 100:.1f} %, exigé ≤ 0.12 et ≥ 30 %)"
        )
    if m["improvementPct"] < 25:
        reasons.append(f"MAE quantité +{m['improvementPct']:.1f} % < 25 %")
    if not (0.72 <= m["coverage"] <= 0.90):
        reasons.append(f"couverture {m['coverage']:.3f} hors [0.72, 0.90]")
    if m["ece"] > 0.05:
        reasons.append(f"ECE {m['ece']:.3f} > 0.05")
    return {"ok": not reasons, "reasons": reasons}


def _pack_net(Fs, seqs, base, wf, sw, idx):
    return {
        "Xs": Fs[idx].astype(np.float32),
        "S": np.log1p(np.maximum(seqs[idx], 0)).astype(np.float32),
        "base": base[idx].astype(np.float32),
        "y": wf[idx].astype(np.float32),
        "cls": (wf[idx] > 0.05).astype(np.float32),
        "w": np.maximum(sw[idx], 1e-6).astype(np.float32),
    }


def _read_card(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def train(real_rows=None, synthetic_n=60000, epochs=40, seed=7, enforce_acceptance=True):
    names, X, seqs, wf, wq, hq = build_dataset(int(synthetic_n), seed=seed)
    if names != BASE_NAMES:
        raise RuntimeError("décalage des variables simulateur / features")
    n_syn = int(len(wf))
    X, seqs, wf, wq, hq, source = _append_real(names, X, seqs, wf, wq, hq, real_rows or [])
    n_real = int((source == 1).sum())
    F, base = engineer(X, BASE_NAMES)
    q = X[:, BASE_NAMES.index("q_restante")]
    w_real = np.where(source == 1, 5.0, 1.0)

    real_ix = np.where(source == 1)[0]
    syn_ix = np.where(source == 0)[0]
    rng = np.random.default_rng(seed)
    rng.shuffle(real_ix)
    hold_n = int(round(0.30 * len(real_ix)))
    hold = real_ix[:hold_n]
    real_pool = real_ix[hold_n:]
    tr_s, cal_s, te_s = _portion(syn_ix, seed)
    tr_r, cal_r, te_r = _portion(real_pool, seed + 1)
    tr = np.concatenate([tr_s, tr_r])
    cal = np.concatenate([cal_s, cal_r])
    te = np.concatenate([te_s, te_r])
    if len(tr) < 20 or len(cal) < 10 or len(te_s) < 10:
        raise RuntimeError("jeu trop petit pour le découpage train / calibration / test")

    mu = F[tr].mean(0)
    sd = F[tr].std(0)
    sd = np.where(sd < 1e-6, 1.0, sd)
    Fs = (F - mu) / sd
    medians = np.median(F[tr], axis=0)
    sw = np.sqrt(np.maximum(q, 1e-6)) * w_real

    gbm = ExpiryGBM().fit(Fs, base, wf, q, w_real=w_real, cal_idx=cal, tr_idx=tr)

    net = None
    curve = []
    mode = "gbm"
    if M.HAS_TORCH and epochs > 0 and len(tr) >= 64:
        cut = max(32, int(len(tr) * 0.88))
        tr_net, va_net = tr[:cut], tr[cut:]
        if len(va_net) >= 16:
            try:
                net, curve = M.train_net(
                    _pack_net(Fs, seqs, base, wf, sw, tr_net),
                    _pack_net(Fs, seqs, base, wf, sw, va_net),
                    epochs=int(epochs),
                    seed=seed,
                )
                mode = "ensemble"
            except Exception:
                log.exception("réseau expiry ignoré, poursuite en GBM")
                net = None
                curve = []
                mode = "gbm"

    def predict_raw(idx):
        return ensemble_predict(gbm, net, mu, sd, None, F[idx], base[idx], seqs[idx])

    _, _, _, p_cal = predict_raw(cal)
    y_cal = (wf[cal] > 0.05).astype(float)
    iso = None
    if len(y_cal) >= 10 and len(np.unique(y_cal)) >= 2:
        iso = IsotonicRegression(out_of_bounds="clip").fit(p_cal, y_cal)

    def predict_p(Fm, bm, sm):
        _, _, _, p = ensemble_predict(gbm, net, mu, sd, iso, Fm, bm, sm)
        return p

    frac, lo, hi, p = ensemble_predict(gbm, net, mu, sd, iso, F[te_s], base[te_s], seqs[te_s])
    metrics = _metrics(frac, lo, hi, p, wf[te_s], wq[te_s], hq[te_s], q[te_s])
    y_te = (wf[te_s] > 0.05).astype(int)
    metrics["importance"] = _importance(predict_p, F[te_s], base[te_s], seqs[te_s], y_te, ALL_NAMES)

    holdout = None
    if len(hold) >= 8 and len(np.unique((wf[hold] > 0.05).astype(int))) >= 1:
        fh, lh, hh, ph = ensemble_predict(gbm, net, mu, sd, iso, F[hold], base[hold], seqs[hold])
        hold_m = _metrics(fh, lh, hh, ph, wf[hold], wq[hold], hq[hold], q[hold])
        holdout = {k: hold_m[k] for k in (
            "auc", "brier", "maeQty", "maeBaseline", "improvementPct", "coverage", "ece"
        )}

    frac_c, lo_c, hi_c, p_c = ensemble_predict(gbm, net, mu, sd, iso, F[cal], base[cal], seqs[cal])
    val_loss = (
        _pinball_np(lo_c, wf[cal], 0.1)
        + _pinball_np(frac_c, wf[cal], 0.5)
        + _pinball_np(hi_c, wf[cal], 0.9)
        + float(np.mean((p_c - (wf[cal] > 0.05).astype(float)) ** 2))
    )

    verdict = _acceptance(metrics)
    card = {
        "version": VERSION,
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "data": {
            "synthetic": n_syn,
            "real": n_real,
            "realHoldout": int(len(hold)),
            "realDataSufficient": bool(n_real >= 30),
        },
        "metrics": {k: metrics[k] for k in (
            "auc", "brier", "brierBaseline", "brierImprovement", "maeQty", "maeBaseline",
            "improvementPct", "coverage", "ece",
        )},
        "reliability": metrics["reliability"],
        "importance": metrics["importance"],
        "curve": curve,
        "holdout": holdout,
        "valLoss": float(val_loss),
        "acceptance": verdict,
        "champion": False,
        "challengerReason": None,
    }

    bundle = {
        "gbm": gbm,
        "iso": iso,
        "mu": mu,
        "sd": sd,
        "medians": medians,
        "names": ALL_NAMES,
        "has_net": net is not None,
        "version": VERSION,
    }
    dest = models_dir()
    dest.mkdir(parents=True, exist_ok=True)
    prod_card = _read_card(dest / "model_card.json") if (dest / "gbm_v2.joblib").exists() else None
    old_loss = None if not prod_card else prod_card.get("valLoss")
    worse = old_loss is not None and float(val_loss) > float(old_loss) * 1.02
    promote = (bool(verdict["ok"]) or not enforce_acceptance) and not worse

    if worse:
        card["challengerReason"] = (
            f"perte validation {val_loss:.4f} > {float(old_loss):.4f} + 2 %"
        )
        log.info("challenger conservé : %s", card["challengerReason"])
    if not verdict["ok"]:
        card["challengerReason"] = "; ".join(verdict["reasons"])
        log.info("critères non atteints : %s", card["challengerReason"])

    if promote:
        card["champion"] = True
        _atomic_joblib(dest / "gbm_v2.joblib", bundle)
        scaler = {
            "mu": mu.tolist(),
            "sd": sd.tolist(),
            "medians": medians.tolist(),
            "names": ALL_NAMES,
            "version": VERSION,
        }
        _atomic_text(dest / "scaler_v2.json", json.dumps(scaler))
        net_path = dest / "net_v2.pt"
        if net is not None and M.HAS_TORCH:
            import torch
            tmp = net_path.with_suffix(".pt.tmp")
            torch.save(net.state_dict(), tmp)
            os.replace(tmp, net_path)
        elif net_path.exists():
            net_path.unlink()
        _atomic_text(dest / "model_card.json", json.dumps(card, default=_jsonable))
    else:
        _atomic_joblib(dest / "challenger_gbm.joblib", bundle)
        _atomic_text(dest / "challenger_card.json", json.dumps(card, default=_jsonable))
        if net is not None and M.HAS_TORCH:
            import torch
            tmp = dest / "challenger_net.pt.tmp"
            torch.save(net.state_dict(), tmp)
            os.replace(tmp, dest / "challenger_net.pt")

    if enforce_acceptance and not verdict["ok"]:
        raise AcceptanceError(card)
    return card


def _jsonable(obj):
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    raise TypeError(type(obj))


def print_table(card):
    m = card.get("metrics") or {}
    rows = [
        ("AUC", m.get("auc")),
        ("Brier", m.get("brier")),
        ("Brier baseline", m.get("brierBaseline")),
        ("MAE qté", m.get("maeQty")),
        ("MAE baseline", m.get("maeBaseline")),
        ("improvementPct", m.get("improvementPct")),
        ("couverture", m.get("coverage")),
        ("ECE", m.get("ece")),
    ]
    print(f"mode={card.get('mode')} synthetic={card.get('data', {}).get('synthetic')} real={card.get('data', {}).get('real')}")
    for label, val in rows:
        if isinstance(val, float):
            print(f"{label:16} {val:.4f}")
        else:
            print(f"{label:16} {val}")
    ok = (card.get("acceptance") or {}).get("ok")
    print("acceptance     ", "OK" if ok else "KO")
    for reason in (card.get("acceptance") or {}).get("reasons") or []:
        print(" -", reason)
    if card.get("challengerReason"):
        print("verdict        ", card["challengerReason"])
    elif card.get("champion"):
        print("verdict         champion")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Entraîne le modèle Expiry Waste Risk v2")
    parser.add_argument("--synthetic", type=int, default=60000)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        card = train(synthetic_n=args.synthetic, epochs=args.epochs, seed=args.seed, enforce_acceptance=True)
    except AcceptanceError as exc:
        print_table(exc.card)
        return 1
    print_table(card)
    return 0


if __name__ == "__main__":
    sys.exit(main())
