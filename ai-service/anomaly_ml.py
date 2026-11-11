"""
Anomalies stock — ensemble non supervisé + deep learning + calibrateur supervisé persisté.

Couches :
  1. IsolationForest (isolation spatiale)
  2. Local Outlier Factor (densité locale)
  3. Autoencodeur profond (MLP numpy, goulot 4)
  4. Autoencodeur de séquence 14j (reconstruction temporelle)
  5. Calibrateur supervisé (GradientBoosting + MLP) entraîné sur
     le feedback métier (confirmé vs marqué normal) et persisté disque
  6. Vote pondéré + accord des détecteurs
"""
from __future__ import annotations

import math
import pickle
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, IsolationForest
from sklearn.neighbors import LocalOutlierFactor

FEATURE_COLS = [
    "quantite",
    "moyenneHabituelle",
    "frequence",
    "ecartVsMoyenne",
    "ratio",
    "log_q",
    "abs_z",
    "heure",
    "jourSemaine",
    "is_sortie",
    "is_entree",
    "is_weekend",
]

SEQ_LEN = 14
MODELS_DIR = Path(__file__).resolve().parent / "models" / "anomalies"
SORTIE_TYPES = {"SORTIE", "VENTE", "LIVRAISON", "TRANSFERT_SORTIE"}
ENTREE_TYPES = {"ENTREE", "ACHAT", "RECEPTION", "TRANSFERT_ENTREE", "RETOUR"}


def _f(v: Any, default: float = 0.0) -> float:
    try:
        x = float(v)
        if np.isnan(x) or np.isinf(x):
            return default
        return x
    except (TypeError, ValueError):
        return default


def _clamp(v: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, v)))


def _parse_dt(row: dict) -> Optional[datetime]:
    raw = row.get("date") or row.get("createdAt")
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    s = str(raw).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _model_path(societe_id: Any) -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    key = "global" if societe_id in (None, "", 0, "0") else f"s{int(societe_id)}"
    return MODELS_DIR / f"{key}.pkl"


# ---------------------------------------------------------------------------
# Dense + autoencodeurs numpy (même famille que N-BEATS)
# ---------------------------------------------------------------------------

class _Dense:
    __slots__ = ("W", "b", "mW", "vW", "mb", "vb", "x", "gW", "gb")

    def __init__(self, din: int, dout: int, rng: np.random.Generator):
        self.W = rng.normal(0.0, math.sqrt(2.0 / max(din, 1)), (din, dout)).astype(np.float64)
        self.b = np.zeros(dout, dtype=np.float64)
        self.mW = np.zeros_like(self.W)
        self.vW = np.zeros_like(self.W)
        self.mb = np.zeros_like(self.b)
        self.vb = np.zeros_like(self.b)

    def forward(self, x: np.ndarray) -> np.ndarray:
        self.x = x
        return x @ self.W + self.b

    def backward(self, g: np.ndarray) -> np.ndarray:
        self.gW = self.x.T @ g
        self.gb = g.sum(axis=0)
        return g @ self.W.T

    def adam(self, lr: float, t: int, b1: float = 0.9, b2: float = 0.999, eps: float = 1e-8) -> None:
        self.mW = b1 * self.mW + (1 - b1) * self.gW
        self.vW = b2 * self.vW + (1 - b2) * (self.gW ** 2)
        self.mb = b1 * self.mb + (1 - b1) * self.gb
        self.vb = b2 * self.vb + (1 - b2) * (self.gb ** 2)
        mw = self.mW / (1 - b1 ** t)
        vw = self.vW / (1 - b2 ** t)
        mb = self.mb / (1 - b1 ** t)
        vb = self.vb / (1 - b2 ** t)
        self.W -= lr * mw / (np.sqrt(vw) + eps)
        self.b -= lr * mb / (np.sqrt(vb) + eps)

    def snapshot(self) -> dict:
        return {"W": self.W.copy(), "b": self.b.copy()}

    def load(self, snap: dict) -> None:
        self.W = np.asarray(snap["W"], dtype=np.float64)
        self.b = np.asarray(snap["b"], dtype=np.float64)


def _relu(z: np.ndarray) -> np.ndarray:
    return np.maximum(z, 0.0)


def _relu_grad(z: np.ndarray, g: np.ndarray) -> np.ndarray:
    return g * (z > 0)


class DeepAutoencoder:
    """MLP  n → 16 → 8 → 4 → 8 → 16 → n  (reconstruction MSE)."""

    def __init__(self, n_in: int, seed: int = 11):
        rng = np.random.default_rng(seed)
        self.n_in = n_in
        self.e1 = _Dense(n_in, 16, rng)
        self.e2 = _Dense(16, 8, rng)
        self.bn = _Dense(8, 4, rng)
        self.d1 = _Dense(4, 8, rng)
        self.d2 = _Dense(8, 16, rng)
        self.d3 = _Dense(16, n_in, rng)
        self.cache: Dict[str, np.ndarray] = {}

    def layers(self) -> List[_Dense]:
        return [self.e1, self.e2, self.bn, self.d1, self.d2, self.d3]

    def forward(self, x: np.ndarray) -> np.ndarray:
        z1 = self.e1.forward(x)
        a1 = _relu(z1)
        z2 = self.e2.forward(a1)
        a2 = _relu(z2)
        z3 = self.bn.forward(a2)
        a3 = _relu(z3)
        z4 = self.d1.forward(a3)
        a4 = _relu(z4)
        z5 = self.d2.forward(a4)
        a5 = _relu(z5)
        y = self.d3.forward(a5)
        self.cache = {"z1": z1, "z2": z2, "z3": z3, "z4": z4, "z5": z5}
        return y

    def backward(self, g_y: np.ndarray) -> None:
        g = self.d3.backward(g_y)
        g = self.d2.backward(_relu_grad(self.cache["z5"], g))
        g = self.d1.backward(_relu_grad(self.cache["z4"], g))
        g = self.bn.backward(_relu_grad(self.cache["z3"], g))
        g = self.e2.backward(_relu_grad(self.cache["z2"], g))
        self.e1.backward(_relu_grad(self.cache["z1"], g))

    def reconstruct_error(self, x: np.ndarray) -> np.ndarray:
        y = self.forward(x)
        return np.mean((y - x) ** 2, axis=1)

    def snapshot(self) -> dict:
        return {"n_in": self.n_in, "layers": [ly.snapshot() for ly in self.layers()]}

    def load(self, snap: dict) -> None:
        for ly, s in zip(self.layers(), snap.get("layers") or []):
            ly.load(s)


class SequenceAutoencoder:
    """Autoencodeur 14 → 8 → 3 → 8 → 14 sur la fenêtre quotidienne."""

    def __init__(self, lookback: int = SEQ_LEN, seed: int = 19):
        rng = np.random.default_rng(seed)
        self.lookback = lookback
        self.e1 = _Dense(lookback, 8, rng)
        self.bn = _Dense(8, 3, rng)
        self.d1 = _Dense(3, 8, rng)
        self.d2 = _Dense(8, lookback, rng)
        self.cache: Dict[str, np.ndarray] = {}

    def layers(self) -> List[_Dense]:
        return [self.e1, self.bn, self.d1, self.d2]

    def forward(self, x: np.ndarray) -> np.ndarray:
        z1 = self.e1.forward(x)
        a1 = _relu(z1)
        z2 = self.bn.forward(a1)
        a2 = _relu(z2)
        z3 = self.d1.forward(a2)
        a3 = _relu(z3)
        y = self.d2.forward(a3)
        self.cache = {"z1": z1, "z2": z2, "z3": z3}
        return y

    def backward(self, g_y: np.ndarray) -> None:
        g = self.d2.backward(g_y)
        g = self.d1.backward(_relu_grad(self.cache["z3"], g))
        g = self.bn.backward(_relu_grad(self.cache["z2"], g))
        self.e1.backward(_relu_grad(self.cache["z1"], g))

    def reconstruct_error(self, x: np.ndarray) -> np.ndarray:
        y = self.forward(x)
        return np.mean((y - x) ** 2, axis=1)

    def snapshot(self) -> dict:
        return {"lookback": self.lookback, "layers": [ly.snapshot() for ly in self.layers()]}

    def load(self, snap: dict) -> None:
        for ly, s in zip(self.layers(), snap.get("layers") or []):
            ly.load(s)


class SupervisedMlp:
    """Classifieur  n → 16 → 8 → 1  (sigmoïde, BCE)."""

    def __init__(self, n_in: int, seed: int = 23):
        rng = np.random.default_rng(seed)
        self.n_in = n_in
        self.d1 = _Dense(n_in, 16, rng)
        self.d2 = _Dense(16, 8, rng)
        self.out = _Dense(8, 1, rng)
        self.cache: Dict[str, np.ndarray] = {}

    def layers(self) -> List[_Dense]:
        return [self.d1, self.d2, self.out]

    def forward(self, x: np.ndarray) -> np.ndarray:
        z1 = self.d1.forward(x)
        a1 = _relu(z1)
        z2 = self.d2.forward(a1)
        a2 = _relu(z2)
        logits = self.out.forward(a2)
        p = 1.0 / (1.0 + np.exp(-np.clip(logits, -20, 20)))
        self.cache = {"z1": z1, "z2": z2, "p": p}
        return p.reshape(-1)

    def backward(self, y: np.ndarray) -> None:
        p = self.cache["p"]
        g = (p - y.reshape(-1, 1)) / max(len(y), 1)
        g = self.out.backward(g)
        g = self.d2.backward(_relu_grad(self.cache["z2"], g))
        self.d1.backward(_relu_grad(self.cache["z1"], g))

    def snapshot(self) -> dict:
        return {"n_in": self.n_in, "layers": [ly.snapshot() for ly in self.layers()]}

    def load(self, snap: dict) -> None:
        for ly, s in zip(self.layers(), snap.get("layers") or []):
            ly.load(s)


def _train_ae(net: Any, X: np.ndarray, max_epochs: int = 36, lr: float = 0.012) -> Dict[str, Any]:
    n = int(X.shape[0])
    meta = {"epochs": 0, "finalLoss": None, "lossCurve": [], "trained": False, "n": n}
    if n < 6:
        return meta
    best = float("inf")
    wait = 0
    curve: List[float] = []
    ran = 0
    for epoch in range(1, max_epochs + 1):
        pred = net.forward(X)
        err = pred - X
        loss = float(np.mean(err ** 2))
        g = (2.0 / max(err.size, 1)) * err
        net.backward(g)
        for ly in net.layers():
            ly.adam(lr, epoch)
        curve.append(round(loss, 6))
        ran = epoch
        if loss + 1e-8 < best:
            best = loss
            wait = 0
        else:
            wait += 1
            if wait >= 10:
                break
        if epoch == 18:
            lr *= 0.5
    meta.update({
        "epochs": ran,
        "finalLoss": round(best, 6),
        "lossCurve": curve[-24:],
        "trained": True,
    })
    return meta


def _train_mlp_clf(net: SupervisedMlp, X: np.ndarray, y: np.ndarray, max_epochs: int = 48) -> Dict[str, Any]:
    n = int(X.shape[0])
    meta = {"epochs": 0, "trained": False, "n": n, "lossCurve": []}
    if n < 8 or len(np.unique(y)) < 2:
        return meta
    lr = 0.02
    curve: List[float] = []
    ran = 0
    for epoch in range(1, max_epochs + 1):
        p = net.forward(X)
        p = np.clip(p, 1e-6, 1 - 1e-6)
        loss = float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
        net.backward(y)
        for ly in net.layers():
            ly.adam(lr, epoch)
        curve.append(round(loss, 5))
        ran = epoch
        if epoch == 24:
            lr *= 0.5
    meta.update({"epochs": ran, "trained": True, "lossCurve": curve[-20:], "finalLoss": curve[-1] if curve else None})
    return meta


# ---------------------------------------------------------------------------
# Features
# ---------------------------------------------------------------------------

def _rows_from_mouvements(mouvements) -> List[dict]:
    """Features ligne à ligne. time.sleep(0) rend le GIL pour que /health reste instantané."""
    rows: List[dict] = []
    for i, m in enumerate(mouvements or []):
        rows.append(_row_features(m))
        if i and i % 20 == 0:
            time.sleep(0)
    return rows


def _row_features(m: dict) -> dict:
    q = _f(m.get("quantite"))
    moy = _f(m.get("moyenneHabituelle") or m.get("moyenne"))
    freq = _f(m.get("frequence"))
    z = _f(m.get("ecartVsMoyenne") or (q - moy if moy else 0))
    ratio = (q / moy) if moy > 1e-9 else (2.0 if q > 0 else 0.0)
    dt = _parse_dt(m)
    heure = float(dt.hour) if dt else 12.0
    wd = float(dt.weekday()) if dt else 2.0
    t = str(m.get("type") or "").upper()
    return {
        **m,
        "quantite": q,
        "moyenneHabituelle": moy,
        "frequence": freq,
        "ecartVsMoyenne": z,
        "ratio": ratio,
        "log_q": math.log1p(abs(q)),
        "abs_z": abs(z),
        "heure": heure,
        "jourSemaine": wd,
        "is_sortie": 1.0 if t in SORTIE_TYPES or "SORTIE" in t else 0.0,
        "is_entree": 1.0 if t in ENTREE_TYPES or "ENTREE" in t else 0.0,
        "is_weekend": 1.0 if wd >= 5 else 0.0,
    }


def _matrix(rows: Sequence[dict]) -> np.ndarray:
    return np.asarray([[_f(r.get(c)) for c in FEATURE_COLS] for r in rows], dtype=np.float64)


def _seq_matrix(rows: Sequence[dict]) -> np.ndarray:
    out = []
    for r in rows:
        w = r.get("window") or r.get("historique") or []
        if isinstance(w, dict):
            w = w.get("quantites") or []
        vals = [_f(x) for x in (w if isinstance(w, (list, tuple)) else [])][:SEQ_LEN]
        if len(vals) < SEQ_LEN:
            vals = [0.0] * (SEQ_LEN - len(vals)) + vals
        out.append(vals)
    return np.asarray(out, dtype=np.float64)


def _standardize(X: np.ndarray, mean: Optional[np.ndarray] = None, std: Optional[np.ndarray] = None):
    if mean is None:
        mean = np.mean(X, axis=0)
    if std is None:
        std = np.std(X, axis=0)
    std = np.where(std < 1e-9, 1.0, std)
    return (X - mean) / std, mean, std


def _to_severity(raw: np.ndarray, invert: bool = True) -> np.ndarray:
    """Map scores to 0–100 (higher = more anomalous)."""
    x = np.asarray(raw, dtype=float)
    if invert:
        x = -x
    mn, mx = float(np.min(x)), float(np.max(x))
    span = (mx - mn) or 1.0
    return np.clip((x - mn) / span * 100.0, 1.0, 100.0)


def _raison(row: dict, score: float, votes: dict) -> str:
    q = _f(row.get("quantite"))
    moy = _f(row.get("moyenneHabituelle"))
    z = _f(row.get("ecartVsMoyenne"))
    usable = {k: v for k, v in (votes or {}).items() if v is not None}
    top = max(usable, key=usable.get) if usable else "ensemble"
    if moy > 0 and q > 0:
        ratio = q / moy
        if ratio >= 2:
            return f"Pic {ratio:.0f}× la moyenne — signal {top}"
        if ratio <= 0.25:
            return f"Creux {ratio:.1f}× la moyenne — signal {top}"
    if abs(z) >= 2:
        return f"Écart {z:.1f}σ vs profil 90j — {top}"
    if score >= 80:
        return f"Reconstruction / isolation fortement atypique ({top})"
    return f"Comportement inhabituel (ensemble {top})"


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _empty_bundle() -> dict:
    return {
        "version": 1,
        "societeId": None,
        "fittedAt": None,
        "nTrain": 0,
        "mean": None,
        "std": None,
        "seqMean": None,
        "seqStd": None,
        "iforest": None,
        "lof": None,
        "ae": None,
        "aeMeta": {},
        "seqAe": None,
        "seqMeta": {},
        "gbc": None,
        "mlp": None,
        "mlpMeta": {},
        "supervised": {
            "trained": False,
            "nPos": 0,
            "nNeg": 0,
            "auc": None,
            "lastTrain": None,
        },
        "scoreDist": {},
        "decision": {
            "regime": "cold_start",
            "threshold": 0.99,
            "precisionAtK": None,
            "confirmationRate": None,
            "expectedAlertRate": 0.01,
            "labels": {"pos": 0, "neg": 0},
        },
    }


def load_bundle(societe_id: Any) -> dict:
    path = _model_path(societe_id)
    if not path.exists():
        b = _empty_bundle()
        b["societeId"] = societe_id
        return b
    try:
        with path.open("rb") as f:
            data = pickle.load(f)
        if not isinstance(data, dict):
            return _empty_bundle()
        data.setdefault("supervised", {})
        return data
    except Exception:
        b = _empty_bundle()
        b["societeId"] = societe_id
        return b


def save_bundle(bundle: dict, societe_id: Any) -> str:
    path = _model_path(societe_id)
    bundle["societeId"] = societe_id
    bundle["fittedAt"] = datetime.now(timezone.utc).isoformat()
    payload = dict(bundle)
    if isinstance(payload.get("ae"), DeepAutoencoder):
        payload["ae"] = payload["ae"].snapshot()
        payload["aeClass"] = "DeepAutoencoder"
    if isinstance(payload.get("seqAe"), SequenceAutoencoder):
        payload["seqAe"] = payload["seqAe"].snapshot()
        payload["seqClass"] = "SequenceAutoencoder"
    if isinstance(payload.get("mlp"), SupervisedMlp):
        payload["mlp"] = payload["mlp"].snapshot()
        payload["mlpClass"] = "SupervisedMlp"
    with path.open("wb") as f:
        pickle.dump(payload, f, protocol=4)
    return str(path)


def _revive(bundle: dict) -> dict:
    n_in = len(FEATURE_COLS)
    if isinstance(bundle.get("ae"), dict):
        ae = DeepAutoencoder(int(bundle["ae"].get("n_in") or n_in))
        ae.load(bundle["ae"])
        bundle["ae"] = ae
    if isinstance(bundle.get("seqAe"), dict):
        seq = SequenceAutoencoder(int(bundle["seqAe"].get("lookback") or SEQ_LEN))
        seq.load(bundle["seqAe"])
        bundle["seqAe"] = seq
    if isinstance(bundle.get("mlp"), dict):
        mlp = SupervisedMlp(int(bundle["mlp"].get("n_in") or n_in))
        mlp.load(bundle["mlp"])
        bundle["mlp"] = mlp
    return bundle


def model_status(societe_id: Any = None) -> dict:
    path = _model_path(societe_id)
    b = load_bundle(societe_id)
    sup = b.get("supervised") or {}
    return {
        "path": str(path),
        "persisted": path.exists(),
        "fittedAt": b.get("fittedAt"),
        "nTrain": b.get("nTrain") or 0,
        "unsupervised": {
            "isolationForest": b.get("iforest") is not None,
            "lof": b.get("lof") is not None,
            "autoencoder": b.get("ae") is not None,
            "sequenceAe": b.get("seqAe") is not None,
            "aeMeta": b.get("aeMeta") or {},
            "seqMeta": b.get("seqMeta") or {},
        },
        "supervised": {
            "trained": bool(sup.get("trained")),
            "nPos": sup.get("nPos") or 0,
            "nNeg": sup.get("nNeg") or 0,
            "auc": sup.get("auc"),
            "lastTrain": sup.get("lastTrain"),
            "gbc": b.get("gbc") is not None,
            "mlp": b.get("mlp") is not None,
            "mlpMeta": b.get("mlpMeta") or {},
        },
        "decisionRegime": (b.get("decision") or {}).get("regime") or "cold_start",
        "threshold": (b.get("decision") or {}).get("threshold"),
        "labels": (b.get("decision") or {}).get("labels") or {
            "pos": sup.get("nPos") or 0,
            "neg": sup.get("nNeg") or 0,
        },
        "expectedAlertRate": (b.get("decision") or {}).get("expectedAlertRate"),
        "precisionAtK": (b.get("decision") or {}).get("precisionAtK"),
        "confirmationRate": (b.get("decision") or {}).get("confirmationRate"),
        "cron": {
            "detect": "0 3,15 * * *",
            "retrain": "20 3 * * *",
        },
    }


# ---------------------------------------------------------------------------
# Train + score
# ---------------------------------------------------------------------------

def _fit_unsupervised(X: np.ndarray, S: np.ndarray) -> Tuple[dict, dict]:
    """contamination='auto' : le seuil du papier, pas un plancher de 5 % d'alertes."""
    n = int(X.shape[0])
    result: dict = {
        "iforest": None,
        "lof": None,
        "ae": None,
        "aeMeta": {},
        "seqAe": None,
        "seqMeta": {},
        "nTrain": n,
        "contamination": "auto",
        "scoreDist": {},
    }
    if n >= 5:
        result["iforest"] = IsolationForest(
            n_estimators=200,
            contamination="auto",
            random_state=42,
            n_jobs=1,
        )
        result["iforest"].fit(X)
    if n >= 12:
        lof = LocalOutlierFactor(
            n_neighbors=min(20, max(5, n // 8)),
            contamination="auto",
            novelty=True,
        )
        lof.fit(X)
        result["lof"] = lof
    if n >= 8:
        ae = DeepAutoencoder(X.shape[1])
        result["aeMeta"] = _train_ae(ae, X)
        result["ae"] = ae
    seq_ok = int(np.sum(np.any(np.abs(S) > 1e-9, axis=1)))
    if seq_ok >= 8:
        seq = SequenceAutoencoder(S.shape[1])
        result["seqMeta"] = _train_ae(seq, S, max_epochs=28, lr=0.015)
        result["seqAe"] = seq
    result["scoreDist"] = _reference_distributions(result, X, S)
    return result, {"contamination": "auto"}


def _auc(y: np.ndarray, p: np.ndarray) -> Optional[float]:
    order = np.argsort(-p)
    ys = y[order]
    pos = float(ys.sum())
    neg = float(len(ys) - pos)
    if pos < 1 or neg < 1:
        return None
    # rang 1 = score le plus élevé → AUC = 1 si tous les positifs sont en tête
    ranks = np.arange(1, len(ys) + 1)
    sum_pos = float(ranks[ys == 1].sum())
    u = sum_pos - pos * (pos + 1) / 2.0
    return round(1.0 - u / (pos * neg), 3)


def _fit_supervised(X: np.ndarray, labels: np.ndarray) -> dict:
    mask = np.isfinite(labels)
    y = labels[mask].astype(int)
    Xs = X[mask]
    n_pos = int((y == 1).sum())
    n_neg = int((y == 0).sum())
    out = {
        "gbc": None,
        "mlp": None,
        "mlpMeta": {},
        "supervised": {
            "trained": False,
            "nPos": n_pos,
            "nNeg": n_neg,
            "auc": None,
            "lastTrain": datetime.now(timezone.utc).isoformat(),
        },
    }
    if n_pos < 3 or n_neg < 3 or len(y) < 8:
        return out
    gbc = GradientBoostingClassifier(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.08,
        random_state=42,
    )
    gbc.fit(Xs, y)
    p = gbc.predict_proba(Xs)[:, 1]
    mlp = SupervisedMlp(Xs.shape[1])
    mlp_meta = _train_mlp_clf(mlp, Xs, y.astype(float))
    p_mlp = mlp.forward(Xs) if mlp_meta.get("trained") else p
    blend = 0.55 * p + 0.45 * p_mlp
    out["gbc"] = gbc
    out["mlp"] = mlp if mlp_meta.get("trained") else None
    out["mlpMeta"] = mlp_meta
    out["supervised"] = {
        "trained": True,
        "nPos": n_pos,
        "nNeg": n_neg,
        "auc": _auc(y.astype(float), blend),
        "lastTrain": datetime.now(timezone.utc).isoformat(),
    }
    return out


def _ecdf(sorted_ref: np.ndarray, values: np.ndarray) -> np.ndarray:
    """Fonction de répartition empirique de la distribution d'entraînement (pas du lot courant)."""
    ref = np.asarray(sorted_ref, dtype=float)
    x = np.asarray(values, dtype=float)
    if ref.size == 0:
        return np.full(x.shape, np.nan)
    return np.searchsorted(ref, x, side="right") / float(ref.size)


def _reference_distributions(bundle: dict, X: np.ndarray, S: np.ndarray) -> dict:
    dist: dict = {}
    if bundle.get("iforest") is not None:
        dist["if"] = np.sort(-bundle["iforest"].decision_function(X))
    if bundle.get("lof") is not None:
        try:
            dist["lof"] = np.sort(-bundle["lof"].decision_function(X))
        except Exception:
            pass
    if isinstance(bundle.get("ae"), DeepAutoencoder) and (bundle.get("aeMeta") or {}).get("trained"):
        dist["ae"] = np.sort(bundle["ae"].reconstruct_error(X))
    if isinstance(bundle.get("seqAe"), SequenceAutoencoder) and (bundle.get("seqMeta") or {}).get("trained"):
        dist["seq"] = np.sort(bundle["seqAe"].reconstruct_error(S))
    if bundle.get("gbc") is not None and (bundle.get("supervised") or {}).get("trained"):
        p = bundle["gbc"].predict_proba(X)[:, 1]
        if isinstance(bundle.get("mlp"), SupervisedMlp):
            p = 0.55 * p + 0.45 * bundle["mlp"].forward(X)
        dist["sup"] = np.sort(p)
    return dist


def _detector_percentiles(bundle: dict, X: np.ndarray, S: np.ndarray) -> Dict[str, np.ndarray]:
    n = X.shape[0]
    dist = bundle.get("scoreDist") or {}
    out: Dict[str, np.ndarray] = {}
    if bundle.get("iforest") is not None and dist.get("if") is not None:
        out["if"] = _ecdf(dist["if"], -bundle["iforest"].decision_function(X))
    if bundle.get("lof") is not None and dist.get("lof") is not None:
        try:
            out["lof"] = _ecdf(dist["lof"], -bundle["lof"].decision_function(X))
        except Exception:
            pass
    if isinstance(bundle.get("ae"), DeepAutoencoder) and dist.get("ae") is not None:
        out["ae"] = _ecdf(dist["ae"], bundle["ae"].reconstruct_error(X))
    if isinstance(bundle.get("seqAe"), SequenceAutoencoder) and dist.get("seq") is not None:
        out["seq"] = _ecdf(dist["seq"], bundle["seqAe"].reconstruct_error(S))
    if bundle.get("gbc") is not None and (bundle.get("supervised") or {}).get("trained") and dist.get("sup") is not None:
        p = bundle["gbc"].predict_proba(X)[:, 1]
        if isinstance(bundle.get("mlp"), SupervisedMlp):
            p = 0.55 * p + 0.45 * bundle["mlp"].forward(X)
        out["sup"] = _ecdf(dist["sup"], p)
    for key, arr in list(out.items()):
        if arr.shape != (n,):
            out.pop(key, None)
    return out


_ENS_W = {"if": 0.34, "lof": 0.22, "ae": 0.28, "seq": 0.16, "sup": 0.0}


def _ensemble_percentiles(parts: Dict[str, np.ndarray], supervised: bool) -> np.ndarray:
    weights = dict(_ENS_W)
    if supervised:
        weights = {"if": 0.26, "lof": 0.16, "ae": 0.20, "seq": 0.12, "sup": 0.26}
    n = 0
    for arr in parts.values():
        n = len(arr)
        break
    if n == 0:
        return np.zeros(0)
    acc = np.zeros(n)
    tot = 0.0
    for key, wk in weights.items():
        arr = parts.get(key)
        if arr is None or wk <= 0:
            continue
        acc += wk * arr
        tot += wk
    if tot <= 0:
        return np.full(n, 0.5)
    return acc / tot


def _fbeta(y: np.ndarray, pred: np.ndarray, beta: float = 0.5) -> float:
    tp = float(np.sum((pred == 1) & (y == 1)))
    fp = float(np.sum((pred == 1) & (y == 0)))
    fn = float(np.sum((pred == 0) & (y == 1)))
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    b2 = beta * beta
    if prec + rec <= 0:
        return 0.0
    return (1 + b2) * prec * rec / (b2 * prec + rec)


def _label_counts(labels: Optional[np.ndarray], supervised: Optional[dict]) -> Tuple[int, int]:
    sup = supervised or {}
    pos = int(sup.get("nPos") or 0)
    neg = int(sup.get("nNeg") or 0)
    if labels is not None and np.size(labels):
        finite = labels[np.isfinite(labels)]
        if finite.size:
            pos = max(pos, int(np.sum(finite == 1)))
            neg = max(neg, int(np.sum(finite == 0)))
    return pos, neg


def _cold_start(pos: int, neg: int) -> bool:
    return (pos + neg) < 20 or pos < 5 or neg < 5


def _calibrate_decision(ens: np.ndarray, labels: np.ndarray, supervised: Optional[dict]) -> dict:
    pos, neg = _label_counts(labels, supervised)
    base = {
        "labels": {"pos": pos, "neg": neg},
        "confirmationRate": round(pos / (pos + neg), 3) if (pos + neg) else None,
    }
    if _cold_start(pos, neg) or ens.size == 0:
        thr = float(np.quantile(ens, 0.99)) if ens.size else 0.99
        base.update({
            "regime": "cold_start",
            "threshold": thr,
            "precisionAtK": None,
            "expectedAlertRate": 0.01,
        })
        return base
    mask = np.isfinite(labels)
    y = labels[mask].astype(int)
    s = ens[mask]
    rng = np.random.default_rng(0)
    idx = np.arange(len(y))
    rng.shuffle(idx)
    cut = max(1, int(round(len(idx) * 0.7)))
    val = idx[cut:] if len(idx) - cut >= 4 else idx
    yv, sv = y[val], s[val]
    best_t, best_f = 0.5, -1.0
    grid = np.unique(np.concatenate([sv, np.linspace(0.5, 0.99, 20)]))
    for t in grid:
        f = _fbeta(yv, (sv >= t).astype(int), 0.5)
        if f > best_f + 1e-12:
            best_f, best_t = f, float(t)
    k = max(1, int(np.sum(yv == 1)))
    top = np.argsort(-sv)[:k]
    prec_k = float(np.mean(yv[top] == 1)) if len(top) else None
    base.update({
        "regime": "supervised",
        "threshold": best_t,
        "precisionAtK": round(prec_k, 3) if prec_k is not None else None,
        "expectedAlertRate": round(float(np.mean(sv >= best_t)), 4),
    })
    return base


def _explain_rules(rows: Sequence[dict]) -> Tuple[np.ndarray, List[List[str]]]:
    """Règles explicables : écart robuste, stock négatif, heure hors profil de l'article."""
    n = len(rows)
    fired: List[List[str]] = [[] for _ in range(n)]
    by_art: Dict[Any, List[int]] = {}
    for i, row in enumerate(rows):
        by_art.setdefault(row.get("articleId"), []).append(i)
        stock = row.get("stockApres")
        if stock is None:
            stock = row.get("stockResultant")
        if stock is not None and _f(stock) < 0:
            fired[i].append("stock_negatif")
        avant = row.get("stockAvant")
        typ = str(row.get("type") or "").upper()
        if avant is not None and ("SORTIE" in typ) and _f(row.get("quantite")) > _f(avant):
            fired[i].append("stock_negatif")
    for ids in by_art.values():
        qs = np.asarray([_f(rows[i].get("quantite")) for i in ids], dtype=float)
        med = float(np.median(qs)) if qs.size else 0.0
        mad = float(np.median(np.abs(qs - med))) if qs.size else 0.0
        scale = 1.4826 * mad
        if scale > 1e-9:
            for i, q in zip(ids, qs):
                if abs(float(q) - med) / scale >= 3.5 and "ecart_robuste" not in fired[i]:
                    fired[i].append("ecart_robuste")
        if len(ids) < 8:
            continue
        hours = np.asarray([_f(rows[i].get("heure"), 12.0) for i in ids], dtype=float)
        lo, hi = np.quantile(hours, [0.10, 0.90])
        if float(hi - lo) <= 1e-6:
            continue
        for i, h in zip(ids, hours):
            if h < lo or h > hi:
                fired[i].append("hors_horaires")
    any_rule = np.asarray([len(names) > 0 for names in fired], dtype=bool)
    return any_rule, fired


def _score_detectors(bundle: dict, X: np.ndarray, S: np.ndarray) -> Tuple[Dict[str, np.ndarray], Dict[str, np.ndarray]]:
    """Percentiles 0–100 de la distribution d'entraînement. Un détecteur absent reste hors de l'ensemble."""
    n = X.shape[0]
    parts = _detector_percentiles(bundle, X, S)
    scores: Dict[str, np.ndarray] = {}
    flags: Dict[str, np.ndarray] = {}
    for key in ("if", "lof", "ae", "seq", "sup"):
        if key not in parts:
            scores[key] = np.full(n, np.nan)
            flags[key] = np.zeros(n, dtype=bool)
            continue
        scores[key] = np.clip(parts[key] * 100.0, 0.0, 100.0)
        flags[key] = parts[key] >= 0.99
    return scores, flags


def _ensemble(scores: Dict[str, np.ndarray], flags: Dict[str, np.ndarray], supervised: bool) -> np.ndarray:
    parts = {}
    for key, arr in scores.items():
        if arr is None or not np.isfinite(arr).any():
            continue
        parts[key] = np.nan_to_num(arr, nan=0.0) / 100.0
    return _ensemble_percentiles(parts, supervised) * 100.0


def _studio(bundle: dict, scores: Dict[str, np.ndarray], flags: Dict[str, np.ndarray], n: int, mode: str) -> dict:
    sup = bundle.get("supervised") or {}
    ae_meta = bundle.get("aeMeta") or {}
    seq_meta = bundle.get("seqMeta") or {}
    mlp_meta = bundle.get("mlpMeta") or {}
    persisted = bool(bundle.get("fittedAt"))
    supervised = bool(sup.get("trained"))
    votes_mean = {
        k: round(float(np.nanmean(v)), 1) if getattr(v, "size", 0) and np.isfinite(v).any() else 0.0
        for k, v in scores.items()
    }
    n_flag = {
        k: int(flags[k].sum()) for k in flags
    }
    maturity = 38
    if bundle.get("iforest") is not None:
        maturity += 12
    if ae_meta.get("trained"):
        maturity += 16
    if seq_meta.get("trained"):
        maturity += 10
    if supervised:
        maturity += 18
        if (sup.get("nPos") or 0) + (sup.get("nNeg") or 0) >= 24:
            maturity += 6
    maturity = int(_clamp(maturity, 20, 96))

    pipeline = [
        {
            "id": "feat",
            "label": "Features 12D + fenêtre 14j",
            "status": "ok",
            "detail": f"{n} mouvements · z-score, ratio, heure, type",
        },
        {
            "id": "if",
            "label": "IsolationForest",
            "status": "ok" if bundle.get("iforest") is not None else "skip",
            "detail": f"{n_flag.get('if', 0)} isolés · 200 arbres",
        },
        {
            "id": "lof",
            "label": "LOF densité",
            "status": "ok" if bundle.get("lof") is not None else "skip",
            "detail": f"{n_flag.get('lof', 0)} outliers locaux",
        },
        {
            "id": "ae",
            "label": "Autoencodeur DL",
            "status": "ok" if ae_meta.get("trained") else "fallback",
            "detail": (
                f"goulot 4 · {ae_meta.get('epochs', 0)} époques · loss {ae_meta.get('finalLoss')}"
                if ae_meta.get("trained")
                else "historique trop court pour le DL"
            ),
        },
        {
            "id": "seq",
            "label": "AE séquence 14j",
            "status": "ok" if seq_meta.get("trained") else "skip",
            "detail": (
                f"{seq_meta.get('epochs', 0)} époques · {n_flag.get('seq', 0)} ruptures de rythme"
                if seq_meta.get("trained")
                else "fenêtres quotidiennes insuffisantes"
            ),
        },
        {
            "id": "sup",
            "label": "Calibrateur supervisé",
            "status": "ok" if supervised else "skip",
            "detail": (
                f"GBC+MLP persisté · {sup.get('nPos', 0)} confirmés / {sup.get('nNeg', 0)} normaux"
                + (f" · AUC {sup.get('auc')}" if sup.get("auc") is not None else "")
            ) if supervised else "en attente du feedback métier (confirmer / marquer normal)",
        },
    ]
    return {
        "modele": "hybrid_if_lof_ae_seq_supervised" if supervised else "unsupervised_if_lof_ae",
        "mode": mode,
        "persisted": persisted,
        "fittedAt": bundle.get("fittedAt"),
        "nTrain": bundle.get("nTrain") or n,
        "pipeline": pipeline,
        "neural": {
            "trained": bool(ae_meta.get("trained")),
            "epochs": ae_meta.get("epochs") or 0,
            "finalLoss": ae_meta.get("finalLoss"),
            "lossCurve": ae_meta.get("lossCurve") or [],
            "bottleneck": 4,
            "hidden": [16, 8, 4, 8, 16],
            "architecture": "autoencoder",
        },
        "sequence": {
            "trained": bool(seq_meta.get("trained")),
            "lookback": SEQ_LEN,
            "epochs": seq_meta.get("epochs") or 0,
            "lossCurve": seq_meta.get("lossCurve") or [],
        },
        "supervised": {
            **sup,
            "gbc": bundle.get("gbc") is not None,
            "mlp": bundle.get("mlp") is not None,
            "mlpMeta": mlp_meta,
        },
        "unsupervised": {
            "isolationForest": bundle.get("iforest") is not None,
            "lof": bundle.get("lof") is not None,
            "autoencoder": bundle.get("ae") is not None,
            "sequenceAe": bundle.get("seqAe") is not None,
        },
        "votes": votes_mean,
        "flags": n_flag,
        "quality": {
            "maturity": maturity,
            "n": n,
            "agreement": round(
                float(np.mean(sum(flags[k].astype(float) for k in flags))) if n else 0.0,
                2,
            ),
        },
        "cron": {"detect": "03:00 & 15:00", "retrain": "03:20"},
        "story": _story(supervised, ae_meta, seq_meta, sup, n),
    }


def _story(supervised: bool, ae_meta: dict, seq_meta: dict, sup: dict, n: int) -> List[str]:
    lines = [
        f"{n} mouvements scorés par IsolationForest, LOF et autoencodeur profond.",
    ]
    if ae_meta.get("trained"):
        lines.append(
            f"L'autoencodeur (goulot 4) a convergé en {ae_meta.get('epochs')} époques — une forte erreur de reconstruction = atypique."
        )
    if seq_meta.get("trained"):
        lines.append("L'AE séquence 14 jours repère les ruptures de rythme article/dépôt.")
    if supervised:
        lines.append(
            f"Calibrateur supervisé persisté : {sup.get('nPos', 0)} confirmés vs {sup.get('nNeg', 0)} faux positifs métier."
        )
    else:
        lines.append("Confirmez ou marquez normal pour entraîner le calibrateur supervisé (persisté sur disque).")
    lines.append("Cron : détection 03:00 / 15:00 · réentraînement 03:20.")
    return lines


def _labels_from_payload(mouvements: Sequence[dict], labels: Optional[Sequence[dict]], n: int) -> np.ndarray:
    arr = np.full(n, np.nan)
    by_id = {}
    for lab in labels or []:
        mid = lab.get("mouvementId") or lab.get("id")
        if mid is None:
            continue
        y = lab.get("label")
        if y is None:
            fb = str(lab.get("feedback") or "").upper()
            if fb in ("CONFIRME", "ANOMALIE", "1", "TRUE"):
                y = 1
            elif fb in ("NORMAL", "RESOLU", "0", "FALSE"):
                y = 0
        if y is None:
            continue
        by_id[int(mid)] = int(y)
    for i, m in enumerate(mouvements):
        mid = m.get("mouvementId") or m.get("id")
        if mid is None:
            continue
        try:
            key = int(mid)
        except (TypeError, ValueError):
            continue
        if key in by_id:
            arr[i] = by_id[key]
        elif m.get("label") is not None:
            arr[i] = int(m["label"])
    return arr


def train_models(payload: dict) -> dict:
    mouvements = payload.get("mouvements") or []
    if len(mouvements) < 8:
        return {
            "ok": False,
            "reason": "historique insuffisant",
            "status": model_status(payload.get("societeId")),
        }
    rows = _rows_from_mouvements(mouvements)
    X_raw = _matrix(rows)
    S_raw = _seq_matrix(rows)
    X, mean, std = _standardize(X_raw)
    S, seq_mean, seq_std = _standardize(S_raw)
    uns, _meta = _fit_unsupervised(X, S)
    labels = _labels_from_payload(mouvements, payload.get("labels"), len(rows))
    sup = _fit_supervised(X, labels)
    bundle = _empty_bundle()
    bundle.update(uns)
    bundle.update(sup)
    bundle["scoreDist"] = _reference_distributions(bundle, X, S)
    parts = _detector_percentiles(bundle, X, S)
    ens_train = _ensemble_percentiles(parts, bool((bundle.get("supervised") or {}).get("trained")))
    bundle["decision"] = _calibrate_decision(ens_train, labels, bundle.get("supervised"))
    bundle["mean"] = mean
    bundle["std"] = std
    bundle["seqMean"] = seq_mean
    bundle["seqStd"] = seq_std
    path = save_bundle(bundle, payload.get("societeId"))
    return {
        "ok": True,
        "path": path,
        "nTrain": uns["nTrain"],
        "supervised": bundle["supervised"],
        "aeMeta": bundle.get("aeMeta") or {},
        "seqMeta": bundle.get("seqMeta") or {},
        "status": model_status(payload.get("societeId")),
    }


def run_anomalies(payload: dict) -> dict:
    t0 = time.time()
    mouvements = payload.get("mouvements") or []
    societe_id = payload.get("societeId")
    if len(mouvements) < 5:
        empty = _empty_bundle()
        z = np.zeros(0)
        fb = {k: z.astype(bool) for k in ("if", "lof", "ae", "seq", "sup")}
        sc = {k: z for k in fb}
        return {
            "anomalies": [],
            "mode": "ai",
            "modele": "unsupervised_dl",
            "studio": _studio(empty, sc, fb, 0, "ai"),
            "persisted": False,
        }

    rows = _rows_from_mouvements(mouvements)
    X_raw = _matrix(rows)
    S_raw = _seq_matrix(rows)

    bundle = _revive(load_bundle(societe_id))
    persist_after = False
    if bundle.get("iforest") is None or payload.get("retrain"):
        X, mean, std = _standardize(X_raw)
        S, seq_mean, seq_std = _standardize(S_raw)
        uns, _ = _fit_unsupervised(X, S)
        bundle.update(uns)
        bundle["mean"] = mean
        bundle["std"] = std
        bundle["seqMean"] = seq_mean
        bundle["seqStd"] = seq_std
        labels = _labels_from_payload(mouvements, payload.get("labels"), len(rows))
        if np.isfinite(labels).sum() >= 8:
            bundle.update(_fit_supervised(X, labels))
            bundle["scoreDist"] = _reference_distributions(bundle, X, S)
        parts = _detector_percentiles(bundle, X, S)
        ens_train = _ensemble_percentiles(parts, bool((bundle.get("supervised") or {}).get("trained")))
        bundle["decision"] = _calibrate_decision(ens_train, labels, bundle.get("supervised"))
        persist_after = True
    else:
        mean = np.asarray(bundle.get("mean"))
        std = np.asarray(bundle.get("std"))
        X, _, _ = _standardize(X_raw, mean, std)
        seq_mean = np.asarray(bundle.get("seqMean")) if bundle.get("seqMean") is not None else None
        seq_std = np.asarray(bundle.get("seqStd")) if bundle.get("seqStd") is not None else None
        S, _, _ = _standardize(S_raw, seq_mean, seq_std)
        labels = _labels_from_payload(mouvements, payload.get("labels"), len(rows))
        if not bundle.get("scoreDist"):
            bundle["scoreDist"] = _reference_distributions(bundle, X, S)
            persist_after = True

    scores, flags = _score_detectors(bundle, X, S)
    supervised = bool((bundle.get("supervised") or {}).get("trained"))
    ens = _ensemble(scores, flags, supervised)
    decision = bundle.get("decision") or _calibrate_decision(ens / 100.0, labels, bundle.get("supervised"))
    regime = decision.get("regime") or "cold_start"
    threshold = float(decision.get("threshold") or 99.0)
    if threshold <= 1.0:
        threshold *= 100.0
    any_rule, rule_names = _explain_rules(rows)
    agreement = (
        flags["if"].astype(int)
        + flags["lof"].astype(int)
        + flags["ae"].astype(int)
        + flags["seq"].astype(int)
        + flags["sup"].astype(int)
    )
    if regime == "cold_start":
        alert_mask = (ens >= threshold) & any_rule
        watch_mask = ((ens >= threshold) | any_rule) & ~alert_mask
        cap = max(3, int(math.ceil(len(rows) * 0.01)))
    else:
        alert_mask = ens >= threshold
        watch_mask = np.zeros(len(rows), dtype=bool)
        cap = len(rows)
    order = np.argsort(-ens)
    selected = []
    alerts_kept = 0
    for i in order:
        i = int(i)
        if alert_mask[i] and alerts_kept < cap:
            selected.append((i, "ALERTE"))
            alerts_kept += 1
        elif alert_mask[i] or watch_mask[i]:
            selected.append((i, "SURVEILLANCE"))

    anomalies = []
    for i, statut in selected:
        row = rows[i]
        def _vote(key: str):
            v = float(scores[key][i])
            return None if not math.isfinite(v) else round(v, 1)

        votes = {k: _vote(k) for k in ("if", "lof", "ae", "seq", "sup")}
        contributions = {
            k: None if votes[k] is None else round(votes[k] / 100.0, 4)
            for k in votes
        }
        score = int(round(float(ens[i])))
        recon = None
        if isinstance(bundle.get("ae"), DeepAutoencoder) and (bundle.get("aeMeta") or {}).get("trained"):
            recon = round(float(bundle["ae"].reconstruct_error(X[i : i + 1])[0]), 5)
        seq_recon = None
        if isinstance(bundle.get("seqAe"), SequenceAutoencoder) and (bundle.get("seqMeta") or {}).get("trained"):
            seq_recon = round(float(bundle["seqAe"].reconstruct_error(S[i : i + 1])[0]), 5)
        anomalies.append({
            "mouvementId": row.get("mouvementId") or row.get("id"),
            "articleId": row.get("articleId"),
            "depotId": row.get("depotId"),
            "quantite": row.get("quantite"),
            "moyenneHabituelle": row.get("moyenneHabituelle"),
            "score": score,
            "raison": _raison(row, score, votes),
            "date": row.get("date") or row.get("createdAt"),
            "modele": "hybrid_dl" if supervised else "unsupervised_dl",
            "votes": votes,
            "agreement": int(agreement[i]),
            "reconstruction": recon,
            "sequenceRecon": seq_recon,
            "detectors": [k for k in ("if", "lof", "ae", "seq", "sup") if flags[k][i]],
            "statut": statut,
            "mlMeta": {
                "contributions": contributions,
                "rules": rule_names[i],
                "regime": regime,
            },
        })

    if persist_after:
        try:
            save_bundle(bundle, societe_id)
        except Exception:
            pass

    studio = _studio(bundle, scores, flags, len(rows), "ai")
    studio["elapsedMs"] = int((time.time() - t0) * 1000)
    return {
        "anomalies": anomalies,
        "mode": "ai",
        "modele": studio["modele"],
        "studio": studio,
        "persisted": bool(bundle.get("fittedAt")),
    }
