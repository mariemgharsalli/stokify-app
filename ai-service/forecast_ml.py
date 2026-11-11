"""
Prévision demande — Holt-Winters professionnel + N-BEATS (numpy) + hybride.

Couches :
  1. Holt-Winters (AIC : add/mul, damping, saison auto)
  2. N-BEATS interprétable (blocs tendance / saison / générique) entraîné
     sur la série cible + les pairs de la famille (apprentissage global)
  3. Hybride : HW + résidu neural rétréci sur holdout
  4. Champion walk-forward (MAPE) + stock au quantile P90
"""
from __future__ import annotations

import math
import os
import threading
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
except Exception:  # pragma: no cover
    ExponentialSmoothing = None

MOIS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

Z80 = 1.28155156554
Z90 = 1.28155156554
Z95 = 1.95996398454

# LRU multi-sociétés : une seule entrée globale écrasait le réseau de l'autre société.
_NB_CACHE: "OrderedDict[str, dict]" = OrderedDict()
_NB_LOCK = threading.Lock()
_NB_MAX = int(os.getenv("AI_NBEATS_CACHE", "16"))
_CACHE_TTL_S = 3600.0


def _nb_get(key):
    with _NB_LOCK:
        v = _NB_CACHE.get(key)
        if v and time.time() < v["expires"]:
            _NB_CACHE.move_to_end(key)
            return v
        _NB_CACHE.pop(key, None)
        return None


def _nb_put(key, net, meta, ttl):
    with _NB_LOCK:
        _NB_CACHE[key] = {"net": net, "meta": meta, "expires": time.time() + ttl}
        _NB_CACHE.move_to_end(key)
        while len(_NB_CACHE) > _NB_MAX:
            _NB_CACHE.popitem(last=False)


def _f(v: Any, default: float = 0.0) -> float:
    try:
        x = float(v)
        if np.isnan(x) or np.isinf(x):
            return default
        return x
    except (TypeError, ValueError):
        return default


def _series_from_hist(historique: Optional[Sequence[dict]]) -> Tuple[np.ndarray, List[str]]:
    vals: List[float] = []
    keys: List[str] = []
    for h in historique or []:
        q = h.get("quantite", h.get("valeur", 0))
        vals.append(_f(q, 0.0))
        keys.append(str(h.get("mois", h.get("periode", ""))))
    return np.asarray(vals, dtype=float), keys


def _next_month_keys(last_key: Optional[str], n: int = 3) -> List[str]:
    if last_key and "-" in str(last_key):
        try:
            y, m = [int(x) for x in str(last_key).split("-")[:2]]
            keys = []
            for _ in range(n):
                m += 1
                if m > 12:
                    m = 1
                    y += 1
                keys.append(f"{y:04d}-{m:02d}")
            return keys
        except (ValueError, TypeError):
            pass
    return [f"M+{i + 1}" for i in range(n)]


def _mape(actual: Sequence[float], pred: Sequence[float]) -> Optional[float]:
    errs = []
    for a, p in zip(actual, pred):
        aa = abs(float(a))
        if aa > 1e-9:
            errs.append(abs(float(a) - float(p)) / aa)
    if not errs:
        return None
    return float(np.mean(errs) * 100.0)


def _smape(actual: Sequence[float], pred: Sequence[float]) -> Optional[float]:
    terms = []
    for a, p in zip(actual, pred):
        denom = abs(float(a)) + abs(float(p))
        if denom > 1e-9:
            terms.append(2.0 * abs(float(a) - float(p)) / denom)
    if not terms:
        return None
    return float(np.mean(terms) * 100.0)


def _naive_scale(y: np.ndarray, season: int = 12) -> Optional[float]:
    series = np.asarray(y, dtype=float)
    if len(series) >= 2 * season:
        diff = np.abs(series[season:] - series[:-season])
    elif len(series) >= 2:
        diff = np.abs(np.diff(series))
    else:
        return None
    scale = float(np.mean(diff)) if diff.size else 0.0
    return scale if scale > 1e-9 else None


def _confidence_label(mase: Optional[float]) -> str:
    if mase is None:
        return "insuffisant"
    if mase < 0.8:
        return "fiable"
    if mase < 1.0:
        return "moyen"
    return "faible"


def _walk_forward(y: np.ndarray, predict_one) -> dict:
    """Résidus un pas. MASE contre le naïf saisonnier, ou le naïf simple si < 2 saisons."""
    series = np.asarray(y, dtype=float)
    n = len(series)
    season = 12
    if n >= 2 * season:
        start = n - min(12, n - 2 * season)
    else:
        start = 8 if n >= 16 else max(4, n // 2)
    actual, pred = [], []
    for t in range(start, n):
        try:
            hat = np.asarray(predict_one(series[:t]), dtype=float).reshape(-1)
            if hat.size == 0 or not np.isfinite(hat[0]):
                continue
            actual.append(float(series[t]))
            pred.append(float(hat[0]))
        except Exception:
            continue
    resid = np.asarray(actual, dtype=float) - np.asarray(pred, dtype=float) if actual else np.asarray([])
    scale = _naive_scale(series)
    mae = float(np.mean(np.abs(resid))) if resid.size else None
    mase = (mae / scale) if (mae is not None and scale) else None
    return {
        "mape": _mape(actual, pred),
        "smape": _smape(actual, pred),
        "mase": None if mase is None else float(mase),
        "absResid": np.abs(resid) if resid.size else np.asarray([]),
    }


def _rmse(actual: Sequence[float], pred: Sequence[float]) -> float:
    a = np.asarray(actual, dtype=float)
    p = np.asarray(pred, dtype=float)
    n = min(len(a), len(p))
    if n == 0:
        return 0.0
    return float(np.sqrt(np.mean((a[:n] - p[:n]) ** 2)))


def _clamp(v: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, v)))


def _has_seasonality(y: np.ndarray, period: int = 12) -> bool:
    n = len(y)
    if n < period * 2:
        return False
    a = y[:-period]
    b = y[period:]
    if np.std(a) < 1e-9 or np.std(b) < 1e-9:
        return False
    acf = float(np.corrcoef(a, b)[0, 1])
    return bool(np.isfinite(acf) and acf >= 0.22)


# ---------------------------------------------------------------------------
# Holt-Winters (statsmodels + numpy)
# ---------------------------------------------------------------------------

def _hw_numpy(
    y: np.ndarray,
    horizon: int,
    seasonal_periods: Optional[int],
    alpha: float,
    beta: float,
    gamma: float,
    phi: float = 0.92,
) -> Tuple[np.ndarray, np.ndarray, Dict[str, np.ndarray]]:
    n = len(y)
    use_seasonal = bool(seasonal_periods and n >= int(seasonal_periods) * 2)
    level_tr = np.zeros(n)
    trend_tr = np.zeros(n)
    season_tr = np.zeros(n)
    fitted = np.zeros(n)

    if use_seasonal:
        m = int(seasonal_periods)
        level = float(np.mean(y[:m]))
        trend = float((np.mean(y[m : 2 * m]) - np.mean(y[:m])) / m) if n >= 2 * m else 0.0
        seasons = [float(y[i] - level) for i in range(m)]
        for t in range(n):
            s = seasons[t % m]
            fitted[t] = level + trend + s
            last_level = level
            level = alpha * (y[t] - s) + (1 - alpha) * (level + phi * trend)
            trend = beta * (level - last_level) + (1 - beta) * phi * trend
            seasons[t % m] = gamma * (y[t] - level) + (1 - gamma) * s
            level_tr[t] = level
            trend_tr[t] = trend
            season_tr[t] = seasons[t % m]
        preds = []
        for h in range(1, horizon + 1):
            damp = sum(phi ** k for k in range(1, h + 1))
            preds.append(max(0.0, float(level + damp * trend + seasons[(n + h - 1) % m])))
        comps = {"level": level_tr, "trend": trend_tr, "seasonal": season_tr}
        return fitted, np.asarray(preds, dtype=float), comps

    level = float(y[0])
    trend = float(y[1] - y[0]) if n > 1 else 0.0
    fitted[0] = level
    level_tr[0] = level
    trend_tr[0] = trend
    for t in range(1, n):
        last_level = level
        level = alpha * y[t] + (1 - alpha) * (level + phi * trend)
        trend = beta * (level - last_level) + (1 - beta) * phi * trend
        fitted[t] = level + trend
        level_tr[t] = level
        trend_tr[t] = trend
    preds = []
    for h in range(1, horizon + 1):
        damp = sum(phi ** k for k in range(1, h + 1))
        preds.append(max(0.0, float(level + damp * trend)))
    comps = {"level": level_tr, "trend": trend_tr, "seasonal": season_tr}
    return fitted, np.asarray(preds, dtype=float), comps


def _hw_numpy_search(y: np.ndarray, horizon: int, seasonal: bool) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
    m = 12 if seasonal else None
    best_sse = float("inf")
    best = None
    for alpha in (0.3, 0.5):
        for beta in (0.1, 0.25):
            for gamma in (0.1, 0.3) if seasonal else (0.0,):
                for phi in (0.9, 0.98):
                    try:
                        fitted, preds, comps = _hw_numpy(y, horizon, m, alpha, beta, gamma, phi)
                        sse = float(np.sum((y - fitted) ** 2))
                        if sse < best_sse:
                            best_sse = sse
                            best = (fitted, preds, comps, alpha, beta, gamma, phi)
                    except Exception:
                        continue
    if best is None:
        fitted, preds, comps = _hw_numpy(y, horizon, m, 0.4, 0.2, 0.2, 0.92)
        return fitted, preds, {
            "spec": {"trend": "add", "seasonal": "add" if seasonal else None, "damped": True, "engine": "numpy"},
            "components": comps,
        }
    fitted, preds, comps, a, b, g, p = best
    return fitted, preds, {
        "spec": {
            "trend": "add",
            "seasonal": "add" if seasonal else None,
            "damped": True,
            "alpha": a,
            "beta": b,
            "gamma": g if seasonal else None,
            "phi": p,
            "engine": "numpy",
            "sse": round(best_sse, 3),
        },
        "components": comps,
    }


def _fit_holt_winters(y: np.ndarray, horizon: int) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any], np.ndarray]:
    n = len(y)
    seasonal = _has_seasonality(y) and n >= 18
    configs: List[Dict[str, Any]] = [
        {"trend": "add", "damped_trend": True, "seasonal": None},
    ]
    if seasonal:
        configs.append({"trend": "add", "damped_trend": True, "seasonal": "add", "seasonal_periods": 12})
        if n >= 24 and float(np.min(y)) > 1e-6:
            configs.append({"trend": "add", "damped_trend": True, "seasonal": "mul", "seasonal_periods": 12})

    best = None
    best_aic = float("inf")
    if ExponentialSmoothing is not None:
        for cfg in configs:
            if cfg.get("seasonal") and n < 18:
                continue
            try:
                kwargs = {"initialization_method": "heuristic", **cfg}
                model = ExponentialSmoothing(y, **kwargs).fit(optimized=True)
                aic = float(getattr(model, "aic", np.inf) or np.inf)
                if not np.isfinite(aic):
                    aic = float(np.sum(np.asarray(model.resid, dtype=float) ** 2))
                if aic < best_aic:
                    fitted = np.asarray(model.fittedvalues, dtype=float)
                    preds = np.asarray(model.forecast(horizon), dtype=float)
                    comps = {
                        "level": np.asarray(getattr(model, "level", np.zeros(n)), dtype=float),
                        "trend": np.asarray(getattr(model, "trend", np.zeros(n)), dtype=float)
                        if getattr(model, "trend", None) is not None
                        else np.zeros(n),
                        "seasonal": np.asarray(getattr(model, "season", np.zeros(n)), dtype=float)
                        if getattr(model, "season", None) is not None
                        else np.zeros(n),
                    }
                    spec = {
                        "trend": cfg.get("trend"),
                        "seasonal": cfg.get("seasonal"),
                        "damped": bool(cfg.get("damped_trend")),
                        "engine": "statsmodels",
                        "aic": round(aic, 2),
                    }
                    best = (fitted, np.maximum(preds, 0.0), spec, comps)
                    best_aic = aic
            except Exception:
                continue

    if best is None:
        fitted, preds, meta = _hw_numpy_search(y, horizon, seasonal)
        resid = y[: len(fitted)] - fitted[: len(y)]
        return fitted, np.maximum(preds, 0.0), meta, resid

    fitted, preds, spec, comps = best
    resid = y[: len(fitted)] - fitted[: len(y)]
    return fitted, preds, {"spec": spec, "components": comps}, resid


# ---------------------------------------------------------------------------
# N-BEATS (numpy, 3 blocs résiduels)
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


def _poly_basis(length: int, degree: int) -> np.ndarray:
    t = np.linspace(0.0, 1.0, length)
    return np.stack([t ** k for k in range(degree + 1)], axis=1)


def _fourier_basis(length: int, harmonics: int, period: int) -> np.ndarray:
    t = np.arange(length, dtype=np.float64)
    cols = []
    for k in range(1, harmonics + 1):
        cols.append(np.sin(2 * np.pi * k * t / period))
        cols.append(np.cos(2 * np.pi * k * t / period))
    return np.stack(cols, axis=1)


class _NBeatsBlock:
    def __init__(self, lookback: int, horizon: int, hidden: int, kind: str, rng: np.random.Generator):
        self.kind = kind
        self.lookback = lookback
        self.horizon = horizon
        if kind == "trend":
            self.B_b = _poly_basis(lookback, 2)
            self.B_f = _poly_basis(horizon, 2)
        elif kind == "seasonal":
            self.B_b = _fourier_basis(lookback, 3, 12)
            self.B_f = _fourier_basis(horizon, 3, 12)
        else:
            self.B_b = np.eye(lookback)
            self.B_f = np.eye(horizon)
        theta_b = self.B_b.shape[1]
        theta_f = self.B_f.shape[1]
        self.d1 = _Dense(lookback, hidden, rng)
        self.d2 = _Dense(hidden, hidden, rng)
        self.d3 = _Dense(hidden, hidden, rng)
        self.dth = _Dense(hidden, theta_b + theta_f, rng)
        self.theta_b_n = theta_b
        self.cache: Dict[str, np.ndarray] = {}

    def layers(self) -> List[_Dense]:
        return [self.d1, self.d2, self.d3, self.dth]

    def forward(self, x: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        z1 = self.d1.forward(x)
        a1 = np.maximum(z1, 0)
        z2 = self.d2.forward(a1)
        a2 = np.maximum(z2, 0)
        z3 = self.d3.forward(a2)
        a3 = np.maximum(z3, 0)
        theta = self.dth.forward(a3)
        tb, tf = theta[:, : self.theta_b_n], theta[:, self.theta_b_n :]
        backcast = tb @ self.B_b.T
        forecast = tf @ self.B_f.T
        self.cache = {"z1": z1, "z2": z2, "z3": z3, "tb": tb, "tf": tf}
        return backcast, forecast

    def backward(self, g_b: np.ndarray, g_f: np.ndarray) -> np.ndarray:
        g_tb = g_b @ self.B_b
        g_tf = g_f @ self.B_f
        g_theta = np.concatenate([g_tb, g_tf], axis=1)
        g_a3 = self.dth.backward(g_theta)
        g_z3 = g_a3 * (self.cache["z3"] > 0)
        g_a2 = self.d3.backward(g_z3)
        g_z2 = g_a2 * (self.cache["z2"] > 0)
        g_a1 = self.d2.backward(g_z2)
        g_z1 = g_a1 * (self.cache["z1"] > 0)
        return self.d1.backward(g_z1)


class NBeatsNet:
    def __init__(self, lookback: int, horizon: int, hidden: int = 28, seed: int = 7):
        rng = np.random.default_rng(seed)
        self.lookback = lookback
        self.horizon = horizon
        self.blocks = [
            _NBeatsBlock(lookback, horizon, hidden, "trend", rng),
            _NBeatsBlock(lookback, horizon, hidden, "seasonal", rng),
            _NBeatsBlock(lookback, horizon, hidden, "generic", rng),
        ]
        self.hidden = hidden

    def forward(self, x: np.ndarray) -> np.ndarray:
        residual = x
        y = np.zeros((x.shape[0], self.horizon), dtype=np.float64)
        self._xs = []
        self._bs = []
        for block in self.blocks:
            self._xs.append(residual)
            b, f = block.forward(residual)
            self._bs.append(b)
            residual = residual - b
            y = y + f
        return y

    def backward(self, g_y: np.ndarray) -> None:
        g_res = np.zeros((g_y.shape[0], self.lookback), dtype=np.float64)
        for block, x, b in zip(reversed(self.blocks), reversed(self._xs), reversed(self._bs)):
            g_f = g_y
            g_b = -g_res
            g_x = block.backward(g_b, g_f)
            g_res = g_x + g_res
            _ = x, b

    def adam(self, lr: float, t: int) -> None:
        for block in self.blocks:
            for layer in block.layers():
                layer.adam(lr, t)


def _extract_windows(series_list: List[np.ndarray], lookback: int, horizon: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs: List[np.ndarray] = []
    ys: List[np.ndarray] = []
    scales: List[float] = []
    for s in series_list:
        y = np.asarray(s, dtype=float)
        if len(y) < lookback + horizon:
            continue
        for i in range(0, len(y) - lookback - horizon + 1):
            w = y[i : i + lookback]
            t = y[i + lookback : i + lookback + horizon]
            scale = float(np.mean(np.abs(w))) if np.mean(np.abs(w)) > 1e-6 else 1.0
            xs.append(w / scale)
            ys.append(t / scale)
            scales.append(scale)
    if not xs:
        return np.zeros((0, lookback)), np.zeros((0, horizon)), np.zeros(0)
    return np.vstack(xs), np.vstack(ys), np.asarray(scales, dtype=float)


def _train_nbeats(
    series_list: List[np.ndarray],
    lookback: int,
    horizon: int,
    seed: int,
    max_epochs: int = 40,
) -> Tuple[Optional[NBeatsNet], Dict[str, Any]]:
    X, Y, _ = _extract_windows(series_list, lookback, horizon)
    n_win = int(X.shape[0])
    meta: Dict[str, Any] = {
        "windows": n_win,
        "lookback": lookback,
        "horizon": horizon,
        "hidden": 28,
        "blocks": ["trend", "seasonal", "generic"],
        "epochs": 0,
        "finalLoss": None,
        "lossCurve": [],
        "trained": False,
    }
    if n_win < 6:
        return None, meta

    net = NBeatsNet(lookback, horizon, hidden=28, seed=seed)
    lr = 0.012
    best_loss = float("inf")
    wait = 0
    curve: List[float] = []
    epochs_ran = 0
    for epoch in range(1, max_epochs + 1):
        pred = net.forward(X)
        err = pred - Y
        loss = float(np.mean(err ** 2))
        g = (2.0 / max(err.size, 1)) * err
        net.backward(g)
        net.adam(lr, epoch)
        curve.append(round(loss, 5))
        epochs_ran = epoch
        if loss + 1e-7 < best_loss:
            best_loss = loss
            wait = 0
        else:
            wait += 1
            if wait >= 14:
                break
        if epoch == 25:
            lr = 0.006
        if epoch == 45:
            lr = 0.003

    meta.update({
        "epochs": epochs_ran,
        "finalLoss": round(best_loss, 5),
        "lossCurve": curve[-24:],
        "trained": True,
    })
    return net, meta


def _nbeats_forecast(net: NBeatsNet, series: np.ndarray, lookback: int, horizon: int) -> np.ndarray:
    if len(series) < lookback:
        pad = np.full(lookback - len(series), float(series[0]) if len(series) else 0.0)
        window = np.concatenate([pad, series])
    else:
        window = series[-lookback:]
    scale = float(np.mean(np.abs(window))) if np.mean(np.abs(window)) > 1e-6 else 1.0
    x = (window / scale).reshape(1, -1)
    y = net.forward(x)[0] * scale
    return np.maximum(y[:horizon], 0.0)


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def _weighted_average(series: np.ndarray, mois_keys: List[str], horizon: int, article_id: Any) -> dict:
    n = len(series)
    if n == 0:
        preds = [0.0] * horizon
        avg = 0.0
    else:
        weights = np.arange(1, n + 1, dtype=float)
        avg = float(np.dot(series, weights) / weights.sum())
        preds = [avg] * horizon
    last_key = mois_keys[-1] if mois_keys else None
    pred_keys = _next_month_keys(last_key, horizon)
    mean_pred = float(np.mean(preds)) if preds else 0.0
    return _pack_result(
        article_id=article_id,
        series=series,
        mois_keys=mois_keys,
        pred_keys=pred_keys,
        champion_preds=np.asarray(preds, dtype=float),
        hw_preds=np.asarray(preds, dtype=float),
        nb_preds=None,
        hybrid_preds=np.asarray(preds, dtype=float),
        champion="moyenne_ponderee",
        mapes={"hw": None, "nbeats": None, "hybrid": None},
        rmse=0.0,
        std=max(0.15 * avg, 0.01),
        tendance="stable",
        variation_pct=0.0,
        pic=None,
        hw_meta={"spec": {"engine": "weighted"}, "components": {}},
        neural=None,
        pipeline=[
            {"id": "hw", "label": "Holt-Winters", "status": "skip", "detail": "Historique < 4 points"},
            {"id": "nbeats", "label": "N-BEATS", "status": "skip", "detail": "Pas assez de fenêtres"},
            {"id": "hybrid", "label": "Hybride", "status": "skip", "detail": "Baseline moyenne pondérée"},
            {"id": "champion", "label": "Champion", "status": "ok", "detail": "Historique court : moyenne pondérée, métriques non calculées"},
            {"id": "quantile", "label": "Intervalle", "status": "skip", "detail": "Moins de 4 résidus walk-forward"},
        ],
        story=[
            "Historique trop court pour Holt-Winters saisonnier ou N-BEATS.",
            f"Moyenne pondérée sur {max(n, 1)} point(s) — ajoutez des ventes confirmées.",
        ],
        peers_n=0,
        windows=0,
        modele="moyenne_ponderee",
        mode="moyenne_ponderee_historique_court",
        recommended_override=int(round(mean_pred)),
        reorder_override=int(round((preds[0] if preds else 0) * 0.4)),
        confidence=None,
        confidence_label="insuffisant",
        explication=(
            "Historique insuffisant pour un modèle saisonnier ou un réseau N-BEATS : "
            f"prévision basée sur une moyenne pondérée des {max(n, 1)} point(s) disponible(s)."
        ),
    )


def _detect_seasonal_peak(series: np.ndarray, mois_keys: List[str]) -> Optional[dict]:
    if len(series) < 12:
        return None
    by_month: Dict[int, List[float]] = {}
    for i, val in enumerate(series):
        key = mois_keys[i] if i < len(mois_keys) else ""
        try:
            m = int(str(key).split("-")[1]) if "-" in str(key) else (i % 12) + 1
        except (ValueError, IndexError):
            m = (i % 12) + 1
        by_month.setdefault(m, []).append(float(val))
    if len(by_month) < 4:
        return None
    avgs = {m: float(np.mean(vals)) for m, vals in by_month.items()}
    overall = float(np.mean(list(avgs.values())))
    if overall <= 0:
        return None
    peak_m = max(avgs, key=avgs.get)
    amplitude = (avgs[peak_m] - overall) / overall * 100
    if amplitude < 15:
        return None
    return {"mois": MOIS_FR[peak_m - 1], "amplitude": round(amplitude, 1)}


def _trend_of(series: np.ndarray, preds: np.ndarray) -> Tuple[str, float]:
    tail = series[-3:] if len(series) >= 3 else series
    if len(tail) >= 2 and abs(tail[0]) > 1e-9:
        variation_pct = float(((tail[-1] - tail[0]) / abs(tail[0])) * 100)
    elif len(preds) >= 2 and abs(preds[0]) > 1e-9:
        variation_pct = float(((preds[-1] - preds[0]) / abs(preds[0])) * 100)
    else:
        variation_pct = 0.0
    if variation_pct > 5:
        return "hausse", variation_pct
    if variation_pct < -5:
        return "baisse", variation_pct
    return "stable", variation_pct


def _build_explication(
    tendance: str,
    variation_pct: float,
    pic: Optional[dict],
    champion: str,
    mape: float,
    peers_n: int,
) -> str:
    var = abs(round(variation_pct, 1))
    model_fr = {
        "hybrid": "hybride Holt-Winters + N-BEATS",
        "nbeats": "N-BEATS (blocs tendance / saison / générique)",
        "hw": "Holt-Winters professionnel",
        "holt_winters": "Holt-Winters professionnel",
        "croston": "Croston TSB (demande intermittente)",
        "moyenne_ponderee": "moyenne pondérée",
    }.get(champion, champion)
    peer_bit = f" Réseau entraîné avec {peers_n} série(s) de la famille." if peers_n else ""
    mape_bit = f" MAPE holdout {mape:.0f}%." if mape is not None else ""
    if champion == "moyenne_ponderee":
        return (
            "Historique insuffisant pour un modèle saisonnier : prévision basée sur une moyenne pondérée "
            "des points disponibles."
        )
    if tendance == "hausse" and pic:
        return (
            f"Modèle {model_fr} : hausse de {var}% sur 3 mois, pic saisonnier attendu en {pic['mois']}."
            f"{mape_bit}{peer_bit} Stock calé sur le quantile P90 (service 90%)."
        )
    if tendance == "baisse" and pic:
        return (
            f"Modèle {model_fr} : baisse de {var}% malgré un pic habituel en {pic['mois']}."
            f"{mape_bit}{peer_bit} Point de réappro abaissé via P90 du 1er mois."
        )
    if tendance == "hausse":
        return (
            f"Modèle {model_fr} : tendance haussière de {var}%.{mape_bit}{peer_bit} "
            "Augmentez le stock recommandé (P90)."
        )
    if tendance == "baisse":
        return (
            f"Modèle {model_fr} : tendance baissière de {var}%.{mape_bit}{peer_bit} "
            "Le point de réapprovisionnement peut être abaissé."
        )
    if pic:
        return (
            f"Demande stable selon {model_fr}, pic saisonnier en {pic['mois']} "
            f"(+{pic['amplitude']}%).{mape_bit}{peer_bit}"
        )
    return f"Demande stable selon {model_fr}.{mape_bit}{peer_bit} Couverture P90 sur l'horizon."


def _pack_result(
    *,
    article_id: Any,
    series: np.ndarray,
    mois_keys: List[str],
    pred_keys: List[str],
    champion_preds: np.ndarray,
    hw_preds: np.ndarray,
    nb_preds: Optional[np.ndarray],
    hybrid_preds: np.ndarray,
    champion: str,
    mapes: Dict[str, Optional[float]],
    rmse: float,
    std: float,
    tendance: str,
    variation_pct: float,
    pic: Optional[dict],
    hw_meta: Dict[str, Any],
    neural: Optional[dict],
    pipeline: List[dict],
    story: List[str],
    peers_n: int,
    windows: int,
    modele: str,
    mode: str,
    recommended_override: Optional[int] = None,
    reorder_override: Optional[int] = None,
    confidence: Optional[int] = None,
    confidence_label: Optional[str] = None,
    smape: Optional[float] = None,
    mase: Optional[float] = None,
    abs_resid: Optional[np.ndarray] = None,
    explication: Optional[str] = None,
    croston_preds: Optional[np.ndarray] = None,
) -> dict:
    horizon = len(champion_preds)
    p50 = np.maximum(np.asarray(champion_preds, dtype=float)[:horizon], 0.0)
    resid = np.asarray([] if abs_resid is None else abs_resid, dtype=float)
    resid = resid[np.isfinite(resid)]
    q80 = float(np.quantile(resid, 0.8)) if resid.size >= 4 else None
    lowers: List[Optional[float]] = []
    uppers: List[Optional[float]] = []
    predictions = []
    for i in range(horizon):
        if q80 is None:
            lo = hi = None
        else:
            half = q80 * math.sqrt(i + 1)
            lo = max(0.0, float(p50[i]) - half)
            hi = float(p50[i]) + half
        lowers.append(lo)
        uppers.append(hi)
        predictions.append({
            "mois": pred_keys[i] if i < len(pred_keys) else f"M+{i + 1}",
            "valeur": round(float(p50[i]), 2),
            "min": None if lo is None else round(lo, 2),
            "max": None if hi is None else round(hi, 2),
            "p10": None if lo is None else round(lo, 2),
            "p50": round(float(p50[i]), 2),
            "p90": None if hi is None else round(hi, 2),
            "lower": None if lo is None else round(lo, 2),
            "upper": None if hi is None else round(hi, 2),
        })

    if recommended_override is not None:
        recommended = recommended_override
    elif q80 is not None:
        recommended = int(round(float(np.sum([u for u in uppers if u is not None]))))
    else:
        recommended = int(round(float(np.sum(p50))))
    if reorder_override is not None:
        reorder = reorder_override
    elif uppers and uppers[0] is not None:
        reorder = int(round(float(uppers[0]) * 0.6))
    else:
        reorder = int(round(float(p50[0]) * 0.6)) if len(p50) else 0

    champ_mape = mapes.get("hybrid") if champion == "hybrid" else mapes.get(champion)
    if champ_mape is None:
        champ_mape = mapes.get("hw")
    label = confidence_label or _confidence_label(mase)
    conf = None if label == "insuffisant" else confidence
    skill = None if mase is None else round(1.0 - float(mase), 3)

    comps = hw_meta.get("components") or {}
    n_hist = len(series)
    take = min(12, n_hist)
    decomp_months = mois_keys[-take:] if mois_keys else []

    def _tail(arr: Any) -> List[float]:
        a = np.asarray(arr, dtype=float) if arr is not None and len(np.asarray(arr)) else np.zeros(n_hist)
        if len(a) < n_hist:
            a = np.pad(a, (n_hist - len(a), 0))
        return [round(float(x), 2) for x in a[-take:]]

    def _rlist(arr: Optional[np.ndarray]) -> List[Optional[float]]:
        if arr is None:
            return [None] * horizon
        return [round(float(x), 2) for x in np.asarray(arr, dtype=float)[:horizon]]

    nb_list = _rlist(nb_preds)
    hw_list = _rlist(hw_preds)
    hy_list = _rlist(hybrid_preds)
    cr_list = [round(float(x), 2) for x in croston_preds[:horizon]] if croston_preds is not None else None
    neural_boost = []
    if nb_preds is not None:
        neural_boost = [round(float(nb_preds[i] - hw_preds[i]), 2) for i in range(horizon)]

    models = [
        {"id": "hw", "label": "Holt-Winters", "mape": _round_or_none(mapes.get("hw")), "preds": hw_list, "selected": champion in ("hw", "holt_winters")},
        {"id": "nbeats", "label": "N-BEATS", "mape": _round_or_none(mapes.get("nbeats")), "preds": nb_list, "selected": champion == "nbeats"},
        {"id": "hybrid", "label": "Hybride", "mape": _round_or_none(mapes.get("hybrid")), "preds": hy_list, "selected": champion == "hybrid"},
    ]
    if cr_list is not None:
        models.append({
            "id": "croston",
            "label": "Croston TSB",
            "mape": _round_or_none(mapes.get("croston")),
            "preds": cr_list,
            "selected": champion == "croston",
        })

    spec = hw_meta.get("spec") or {}
    mape_pen = 0.0 if champ_mape is None else min(18.0, float(champ_mape) / 4.0)
    quality = {
        "mape": None if champ_mape is None else round(float(champ_mape), 1),
        "smape": None if smape is None else round(float(smape), 1),
        "mase": None if mase is None else round(float(mase), 3),
        "skill": skill,
        "rmse": round(float(rmse), 2),
        "maturity": int(round(_clamp(
            28
            + min(22, n_hist)
            + (12 if neural and neural.get("trained") else 0)
            + min(10, peers_n)
            + (8 if spec.get("seasonal") else 0)
            - mape_pen,
            35,
            94,
        ))),
        "windows": windows,
        "peers": peers_n,
        "points": n_hist,
        "seasonal": bool(spec.get("seasonal")),
    }

    return {
        "article_id": article_id,
        "predictions": predictions,
        "historique": [
            {"mois": mois_keys[i] if i < len(mois_keys) else f"M{i}", "valeur": round(float(series[i]), 2)}
            for i in range(len(series))
        ],
        "tendance": tendance,
        "variationPct": round(float(variation_pct), 1),
        "picSaisonnier": pic,
        "recommendedStock": recommended,
        "reorderPoint": reorder,
        "confidence": conf,
        "confidenceLabel": label,
        "smape": None if smape is None else round(float(smape), 2),
        "mase": None if mase is None else round(float(mase), 3),
        "skill": skill,
        "lower": [None if x is None else round(float(x), 2) for x in lowers],
        "upper": [None if x is None else round(float(x), 2) for x in uppers],
        "minHistory": 4,
        "explication": explication or _build_explication(
            tendance, variation_pct, pic, champion,
            None if champ_mape is None else float(champ_mape),
            peers_n,
        ),
        "modele": modele,
        "mode": mode,
        "champion": champion,
        "comparaison": {"champion": champion, "models": models},
        "scenarios": {
            "p10": [None if x is None else round(float(x), 2) for x in lowers],
            "p50": [round(float(x), 2) for x in p50],
            "p90": [None if x is None else round(float(x), 2) for x in uppers],
            "lower": [None if x is None else round(float(x), 2) for x in lowers],
            "upper": [None if x is None else round(float(x), 2) for x in uppers],
            "serviceLevel": 0.8 if q80 is not None else None,
            "mois": pred_keys[:horizon],
        },
        "decomposition": {
            "mois": decomp_months,
            "level": _tail(comps.get("level")),
            "trend": _tail(comps.get("trend")),
            "seasonal": _tail(comps.get("seasonal")),
            "residual": _tail(hw_meta.get("residual")),
            "neuralBoost": neural_boost,
        },
        "hwSpec": spec,
        "neural": neural,
        "pipeline": pipeline,
        "story": story,
        "quality": quality,
        "methodology": (
            "Holt-Winters (sélection AIC, tendance amortie, saison add/mul) + N-BEATS numpy "
            "(blocs tendance / Fourier / générique, apprentissage global famille) + hybride à résidu rétréci. "
            "Stock = somme des P90 sur l'horizon (taux de service 90%)."
        ),
        "methodologyLabel": "HW AIC + N-BEATS global + P90",
    }


def _round_or_none(v: Optional[float]) -> Optional[float]:
    if v is None:
        return None
    return round(float(v), 1)


def _holdout_n(n: int, horizon: int) -> int:
    return int(min(horizon, max(1, math.ceil(n * 0.2))))


def _pad3(arr: Optional[np.ndarray]) -> Optional[np.ndarray]:
    if arr is None:
        return None
    a = list(np.asarray(arr, dtype=float))
    while len(a) < 3:
        a.append(a[-1] if a else 0.0)
    return np.asarray(a[:3], dtype=float)


def _is_intermittent(y: np.ndarray) -> bool:
    if len(y) < 6:
        return False
    zeros = float(np.mean(y <= 1e-9))
    hits = int(np.sum(y > 1e-9))
    return zeros >= 0.4 and hits >= 3


def _croston_tsb(y: np.ndarray, horizon: int, alpha: float = 0.15, beta: float = 0.15) -> Tuple[np.ndarray, np.ndarray]:
    n = len(y)
    fitted = np.zeros(n)
    z = float(y[y > 0][0]) if np.any(y > 0) else 1.0
    p = 0.2
    for t, val in enumerate(y):
        if val > 1e-9:
            z = alpha * float(val) + (1 - alpha) * z
            p = beta * 1.0 + (1 - beta) * p
        else:
            p = (1 - beta) * p
        fitted[t] = max(0.0, z * p)
    level = max(0.0, z * p)
    return fitted, np.full(horizon, level, dtype=float)


def _fingerprint(series_list: List[np.ndarray], lookback: int, horizon: int) -> str:
    parts = [f"lb{lookback}h{horizon}"]
    for s in series_list:
        if s is None or len(s) == 0:
            parts.append("0")
            continue
        parts.append(f"{len(s)}:{round(float(np.sum(s)), 1)}:{round(float(s[-1]), 2)}")
    return "|".join(parts)


def _lookback_of(series_list: List[np.ndarray]) -> int:
    nmax = max((len(s) for s in series_list if s is not None), default=0)
    if nmax >= 16:
        return 12
    return max(6, min(12, nmax - 3 if nmax > 4 else 6))


def _get_or_train_nbeats(
    series_list: List[np.ndarray],
    lookback: int,
    horizon: int,
    seed: int,
) -> Tuple[Optional[NBeatsNet], Dict[str, Any]]:
    key = _fingerprint(series_list, lookback, horizon)
    cached = _nb_get(key)
    if cached and cached.get("net") is not None:
        meta = dict(cached.get("meta") or {})
        meta["cached"] = True
        return cached["net"], meta
    try:
        net, meta = _train_nbeats(series_list, lookback, horizon, seed=seed)
    except Exception:
        net, meta = None, {
            "windows": 0,
            "lookback": lookback,
            "horizon": horizon,
            "hidden": 28,
            "blocks": ["trend", "seasonal", "generic"],
            "epochs": 0,
            "finalLoss": None,
            "lossCurve": [],
            "trained": False,
        }
    meta = dict(meta or {})
    meta["cached"] = False
    if net is not None:
        _nb_put(key, net, meta, _CACHE_TTL_S)
    return net, meta


def _forecast_from_series(
    y: np.ndarray,
    mois_keys: List[str],
    article_id: Any,
    net: Optional[NBeatsNet],
    neural_meta: Dict[str, Any],
    lookback: int,
    peers_n: int,
    horizon: int = 3,
    extra: Optional[dict] = None,
) -> dict:
    extra = extra or {}
    ui_horizon = 3
    fit_horizon = max(horizon, ui_horizon)
    y = np.nan_to_num(np.asarray(y, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    if len(y) < 4:
        out = _weighted_average(y, mois_keys, ui_horizon, article_id)
        if extra.get("familleId") is not None:
            out["familleId"] = extra.get("familleId")
        if extra.get("stockActuel") is not None:
            out["stockActuel"] = extra.get("stockActuel")
        return out

    _hw_fitted, hw_full, hw_meta, hw_resid = _fit_holt_winters(y, fit_horizon)
    hw_meta["residual"] = np.asarray(hw_resid, dtype=float)
    hw_preds = np.maximum(np.asarray(hw_full[:ui_horizon], dtype=float), 0.0)

    meta = dict(neural_meta or {})
    meta["peers"] = peers_n
    nb_preds = None
    if net is not None:
        try:
            nb_preds = _nbeats_forecast(net, y, lookback, ui_horizon)
        except Exception:
            nb_preds = None
            meta["trained"] = False

    hold = _holdout_n(len(y), ui_horizon)
    train, test = y[:-hold], y[-hold:]
    mape_hw = mape_nb = mape_hy = None
    mape_cr = None
    hw_h = None
    try:
        _, hw_h, _, _ = _fit_holt_winters(train, hold)
        mape_hw = _mape(test, hw_h[:hold])
    except Exception:
        mape_hw = None

    nb_h = None
    nbeats_reason = None
    if net is None:
        nbeats_reason = (meta or {}).get("detail") or "Série trop courte pour lookback + horizon + 6"
        mape_nb = None
    elif len(train) >= lookback:
        try:
            nb_h = _nbeats_forecast(net, train, lookback, hold)
            mape_nb = _mape(test, nb_h[:hold])
        except Exception:
            mape_nb = None
            nbeats_reason = "Prévision N-BEATS indisponible"
    else:
        mape_nb = None
        nbeats_reason = "Fenêtre d'apprentissage plus courte que le lookback"

    phi_best = 0.55
    if nb_preds is not None and hw_h is not None and nb_h is not None:
        try:
            best_m = 1e9
            for phi in (0.35, 0.55, 0.75, 1.0):
                hy = np.maximum(hw_h[:hold] + phi * (nb_h[:hold] - hw_h[:hold]), 0.0)
                m = _mape(test, hy)
                if m is not None and m < best_m:
                    best_m = m
                    phi_best = phi
            mape_hy = None if best_m >= 1e8 else float(best_m)
        except Exception:
            mape_hy = mape_hw
    else:
        mape_hy = mape_hw

    if nb_preds is not None:
        hybrid_preds = np.maximum(hw_preds + phi_best * (nb_preds - hw_preds), 0.0)
    else:
        hybrid_preds = hw_preds.copy()

    intermittent = _is_intermittent(y)
    croston_preds = None
    if intermittent:
        try:
            _, croston_preds = _croston_tsb(y, ui_horizon)
            _, cr_h = _croston_tsb(train, hold)
            mape_cr = _mape(test, cr_h[:hold])
        except Exception:
            croston_preds = None
            mape_cr = None

    def _hw_one(train_y):
        _, full, _, _ = _fit_holt_winters(np.asarray(train_y, dtype=float), 1)
        return np.asarray(full[:1], dtype=float)

    wf = {"hw": _walk_forward(y, _hw_one)}
    if net is not None:
        def _nb_one(train_y, _net=net):
            return _nbeats_forecast(_net, np.asarray(train_y, dtype=float), lookback, 1)

        wf["nbeats"] = _walk_forward(y, _nb_one)

        def _hy_one(train_y, _phi=phi_best):
            h = np.asarray(_hw_one(train_y), dtype=float).reshape(-1)
            b = np.asarray(_nb_one(train_y), dtype=float).reshape(-1)
            n = min(len(h), len(b))
            return np.maximum(h[:n] + _phi * (b[:n] - h[:n]), 0.0)

        wf["hybrid"] = _walk_forward(y, _hy_one)
    if croston_preds is not None:
        def _cr_one(train_y):
            _, pred = _croston_tsb(np.asarray(train_y, dtype=float), 1)
            return pred[:1]

        wf["croston"] = _walk_forward(y, _cr_one)

    for name, row in wf.items():
        if name == "hw" and mape_hw is None:
            mape_hw = row.get("mape")
        if name == "nbeats" and mape_nb is None:
            mape_nb = row.get("mape")
        if name == "hybrid" and mape_hy is None:
            mape_hy = row.get("mape")
        if name == "croston" and mape_cr is None:
            mape_cr = row.get("mape")

    candidates = [("hw", hw_preds)]
    if nb_preds is not None and "nbeats" in wf:
        candidates.append(("nbeats", nb_preds))
    candidates.append(("hybrid", hybrid_preds))
    if croston_preds is not None and "croston" in wf:
        candidates.append(("croston", croston_preds))

    def _rank(item):
        name = item[0]
        row = wf.get(name) or {}
        mase_v = row.get("mase")
        mape_v = row.get("mape")
        return (
            mase_v if mase_v is not None else 99.0,
            mape_v if mape_v is not None else 99.0,
            0 if name == "hybrid" else 1 if name == "nbeats" else 2,
        )

    champion, champ_preds = min(candidates, key=_rank)
    champ_row = wf.get(champion) or {}
    champ_mape = {"hw": mape_hw, "nbeats": mape_nb, "hybrid": mape_hy, "croston": mape_cr}.get(champion)

    modele_map = {
        "hw": "holt_winters",
        "nbeats": "nbeats",
        "hybrid": "hybrid_nbeats_hw",
        "croston": "croston_tsb",
    }
    modele = modele_map.get(champion, "holt_winters")
    spec = hw_meta.get("spec") or {}
    saison_txt = spec.get("seasonal") or "aucune"
    engine = spec.get("engine") or "numpy"
    aic_txt = f" · AIC {spec['aic']}" if spec.get("aic") is not None else ""
    cache_hit = bool(meta.get("cached"))

    pipeline = [
        {
            "id": "hw",
            "label": "Holt-Winters",
            "status": "ok",
            "detail": f"{engine} · tendance {spec.get('trend') or 'add'} amortie · saison {saison_txt}{aic_txt}",
        },
        {
            "id": "nbeats",
            "label": "N-BEATS",
            "status": "ok" if meta.get("trained") else "skip",
            "detail": (
                f"{'cache hit · ' if cache_hit else ''}{meta.get('windows', 0)} fenêtres · "
                f"{meta.get('epochs', 0)} époques · {peers_n} pairs"
                if meta.get("trained")
                else (nbeats_reason or "Pas assez de fenêtres (lookback + horizon + 6)")
            ),
        },
        {
            "id": "hybrid",
            "label": "Hybride",
            "status": "ok" if nb_preds is not None else "fallback",
            "detail": f"HW + {phi_best:.0%} résidu neural" if nb_preds is not None else "HW seul (réseau inactif)",
        },
        {
            "id": "sparse",
            "label": "Croston TSB",
            "status": "ok" if croston_preds is not None else "skip",
            "detail": "Demande intermittente (zéros ≥ 40%)" if croston_preds is not None else "Série dense — non requis",
        },
        {
            "id": "champion",
            "label": "Champion",
            "status": "ok",
            "detail": (
                f"{ {'hw': 'Holt-Winters', 'nbeats': 'N-BEATS', 'hybrid': 'Hybride', 'croston': 'Croston TSB'}.get(champion, champion) }"
                + (f" · MASE {champ_row.get('mase'):.2f}" if champ_row.get("mase") is not None else " · MASE indisponible")
            ),
        },
        {
            "id": "quantile",
            "label": "Stock P90",
            "status": "ok",
            "detail": "Taux de service 90% · somme P90 horizon",
        },
    ]

    story = []
    if spec.get("seasonal"):
        story.append(f"Holt-Winters {spec.get('trend')}/{spec.get('seasonal')} amorti capte niveau, tendance et saison{aic_txt}.")
    else:
        story.append(f"Holt-Winters tendance amortie (pas de saison nette sur {len(y)} mois){aic_txt}.")
    if meta.get("trained"):
        story.append(
            f"N-BEATS global 3 blocs appris sur {meta.get('windows', 0)} fenêtres "
            f"({peers_n} pairs){' · cache' if cache_hit else ''} · loss {meta.get('finalLoss')}."
        )
    else:
        story.append("N-BEATS non entraîné : historique trop court pour des fenêtres lookback/horizon.")
    if croston_preds is not None:
        story.append("Série intermittente : Croston TSB a été mis en lice contre HW / N-BEATS.")
    story.append(
        f"Champion { {'hw': 'Holt-Winters', 'nbeats': 'N-BEATS', 'hybrid': 'hybride', 'croston': 'Croston TSB'}.get(champion) } "
        + (
            f"(MAPE holdout {champ_mape:.0f}%)."
            if champ_mape is not None
            else "(MAPE non calculé)."
        )
    )
    story.append("Stock recommandé = somme des quantiles P90 — pas une règle ×1.15.")

    std = float(np.std(hw_resid)) if len(hw_resid) > 1 else float(np.std(y) * 0.25 or 1.0)
    tendance, variation_pct = _trend_of(y, champ_preds)
    pic = _detect_seasonal_peak(y, mois_keys)
    pred_keys = _next_month_keys(mois_keys[-1] if mois_keys else None, ui_horizon)
    rmse = _rmse(test, champ_preds[: len(test)]) if len(test) else 0.0
    mapes = {"hw": mape_hw, "nbeats": mape_nb, "hybrid": mape_hy, "croston": mape_cr}

    out = _pack_result(
        article_id=article_id,
        series=y,
        mois_keys=mois_keys,
        pred_keys=pred_keys,
        champion_preds=_pad3(champ_preds),
        hw_preds=_pad3(hw_preds),
        nb_preds=_pad3(nb_preds),
        hybrid_preds=_pad3(hybrid_preds),
        champion=champion,
        mapes=mapes,
        rmse=rmse,
        std=std,
        smape=champ_row.get("smape"),
        mase=champ_row.get("mase"),
        abs_resid=champ_row.get("absResid"),
        confidence_label=_confidence_label(champ_row.get("mase")),
        tendance=tendance,
        variation_pct=variation_pct,
        pic=pic,
        hw_meta=hw_meta,
        neural=meta,
        pipeline=pipeline,
        story=story,
        peers_n=peers_n,
        windows=int(meta.get("windows") or 0),
        modele=modele,
        mode="ai",
        croston_preds=_pad3(croston_preds),
    )
    if extra.get("familleId") is not None:
        out["familleId"] = extra.get("familleId")
    if extra.get("stockActuel") is not None:
        out["stockActuel"] = extra.get("stockActuel")
    if extra.get("articleCode"):
        out["articleCode"] = extra.get("articleCode")
    if extra.get("articleLibelle"):
        out["articleLibelle"] = extra.get("articleLibelle")
    out["_y"] = [float(v) for v in y]
    out["_keys"] = list(mois_keys)
    for model in (out.get("comparaison") or {}).get("models") or []:
        if model.get("id") == "nbeats" and not (meta.get("trained")):
            model["status"] = "skip"
            model["detail"] = nbeats_reason or "Série trop courte pour lookback + horizon + 6"
        elif model.get("id") == "nbeats":
            model["status"] = "ok"
    return out



def _strip_private(result: dict) -> dict:
    out = dict(result)
    out.pop("_y", None)
    out.pop("_keys", None)
    return out


def _scale_predictions(result: dict, factors: List[float]) -> dict:
    preds = result.get("predictions") or []
    for i, row in enumerate(preds):
        f = float(factors[i]) if i < len(factors) else 1.0
        for k in ("valeur", "min", "max", "p10", "p50", "p90", "lower", "upper"):
            if row.get(k) is not None:
                row[k] = round(max(0.0, float(row[k]) * f), 2)
    sc = result.get("scenarios") or {}
    for band in ("p10", "p50", "p90", "lower", "upper"):
        arr = sc.get(band) or []
        sc[band] = [
            None if v is None else round(max(0.0, float(v) * float(factors[i] if i < len(factors) else 1.0)), 2)
            for i, v in enumerate(arr)
        ]
    result["scenarios"] = sc
    for model in (result.get("comparaison") or {}).get("models") or []:
        raw = model.get("preds") or []
        model["preds"] = [
            None if v is None else round(max(0.0, float(v) * float(factors[i] if i < len(factors) else 1.0)), 2)
            for i, v in enumerate(raw)
        ]
    p90_sum = sum(float((result.get("predictions") or [{}])[i].get("p90") or 0) for i in range(min(3, len(preds))))
    p90_0 = float((preds[0] or {}).get("p90") or 0) if preds else 0
    result["recommendedStock"] = int(round(p90_sum))
    result["reorderPoint"] = int(round(p90_0 * 0.6))
    return result


def _hw_only(y: np.ndarray, horizon: int) -> np.ndarray:
    if len(y) < 4:
        avg = float(np.mean(y)) if len(y) else 0.0
        return np.full(horizon, max(0.0, avg))
    try:
        _, preds, _, _ = _fit_holt_winters(y, horizon)
        a = list(np.maximum(np.asarray(preds, dtype=float), 0.0))
        while len(a) < horizon:
            a.append(a[-1] if a else 0.0)
        return np.asarray(a[:horizon], dtype=float)
    except Exception:
        avg = float(np.mean(y[-3:])) if len(y) else 0.0
        return np.full(horizon, max(0.0, avg))


def _align_sum(series_list: List[np.ndarray]) -> np.ndarray:
    if not series_list:
        return np.zeros(0)
    n = min(len(s) for s in series_list)
    if n <= 0:
        return np.zeros(0)
    return np.sum(np.stack([s[-n:] for s in series_list], axis=0), axis=0)


def _reconcile_hierarchical(results: List[dict], horizon: int = 3) -> Tuple[List[dict], bool]:
    usable = [r for r in results if r.get("_y") and r.get("predictions")]
    if len(usable) < 2:
        return results, False
    groups: Dict[Any, List[dict]] = {}
    for r in usable:
        groups.setdefault(r.get("familleId") if r.get("familleId") is not None else "_all", []).append(r)

    for fam, members in groups.items():
        if len(members) < 2:
            continue
        fam_y = _align_sum([np.asarray(m["_y"], dtype=float) for m in members])
        fam_f = _hw_only(fam_y, horizon)
        sums = []
        for h in range(horizon):
            s = sum(float((m.get("predictions") or [{}])[h].get("p50") or (m.get("predictions") or [{}])[h].get("valeur") or 0) for m in members)
            sums.append(s)
        factors = []
        for h in range(horizon):
            f = float(fam_f[h]) / sums[h] if sums[h] > 1e-6 else 1.0
            factors.append(float(_clamp(f, 0.55, 1.8)))
        for m in members:
            _scale_predictions(m, factors)

    catalog_y = _align_sum([np.asarray(r["_y"], dtype=float) for r in usable])
    catalog_f = _hw_only(catalog_y, horizon)
    sums = []
    for h in range(horizon):
        s = sum(float((r.get("predictions") or [{}])[h].get("p50") or (r.get("predictions") or [{}])[h].get("valeur") or 0) for r in usable)
        sums.append(s)
    factors = []
    for h in range(horizon):
        f = float(catalog_f[h]) / sums[h] if sums[h] > 1e-6 else 1.0
        factors.append(float(_clamp(f, 0.6, 1.7)))
    if any(abs(f - 1.0) > 0.02 for f in factors):
        for r in usable:
            _scale_predictions(r, factors)
        return results, True
    return results, True


def _build_portfolio(results: List[dict], neural_meta: Optional[dict], reconciled: bool) -> dict:
    n = len(results)
    mois = []
    p10 = [0.0, 0.0, 0.0]
    p50 = [0.0, 0.0, 0.0]
    p90 = [0.0, 0.0, 0.0]
    heatmap = []
    ranking = []
    champions: Dict[str, int] = {}
    stock_total = 0.0
    for r in results:
        preds = r.get("predictions") or []
        if preds and not mois:
            mois = [p.get("mois") for p in preds[:3]]
        for i in range(3):
            row = preds[i] if i < len(preds) else {}
            p10[i] += float(row.get("p10") or row.get("min") or 0)
            p50[i] += float(row.get("p50") or row.get("valeur") or 0)
            p90[i] += float(row.get("p90") or row.get("max") or 0)
        models = {(m.get("id")): m for m in ((r.get("comparaison") or {}).get("models") or [])}
        heatmap.append({
            "articleId": r.get("article_id") or r.get("articleId"),
            "code": r.get("articleCode") or str(r.get("article_id")),
            "libelle": r.get("articleLibelle") or "",
            "champion": r.get("champion"),
            "hw": (models.get("hw") or {}).get("mape"),
            "nbeats": (models.get("nbeats") or {}).get("mape"),
            "hybrid": (models.get("hybrid") or {}).get("mape"),
            "croston": (models.get("croston") or {}).get("mape"),
        })
        ch = str(r.get("champion") or "hw")
        champions[ch] = champions.get(ch, 0) + 1
        stock = float(r.get("stockActuel") or 0)
        stock_total += stock
        reco = float(r.get("recommendedStock") or 0)
        gap = reco - stock
        if gap >= 8:
            risk = "rupture"
        elif gap <= -8:
            risk = "surplus"
        else:
            risk = "ok"
        ranking.append({
            "articleId": r.get("article_id") or r.get("articleId"),
            "code": r.get("articleCode") or "",
            "libelle": r.get("articleLibelle") or "",
            "stockActuel": round(stock, 2),
            "p90": round(reco, 2),
            "p50": round(sum(float((preds[i].get("p50") if i < len(preds) else 0) or 0) for i in range(3)), 2),
            "gap": round(gap, 2),
            "risk": risk,
            "champion": ch,
            "confidence": r.get("confidence"),
        })
    ranking.sort(key=lambda x: x["gap"], reverse=True)
    total_p90 = float(sum(p90))
    top = ranking[0] if ranking else None
    share = 0.0
    if top and total_p90 > 1e-6:
        share = round(100.0 * float(top["p90"]) / total_p90, 1)
    rupture_n = sum(1 for x in ranking if x["risk"] == "rupture")
    meta = neural_meta or {}
    story = [
        f"{n} article(s) · 1 N-BEATS global{' (cache)' if meta.get('cached') else ''} · {meta.get('windows', 0)} fenêtres.",
        "Réconciliation hiérarchique famille → catalogue." if reconciled else "Pas de réconciliation (moins de 2 séries).",
        f"{rupture_n} SKU sous P90 · concentration {share}% sur {top['code'] if top else '—'}.",
        "File de réappro triée par gap (P90 − stock actuel).",
    ]
    return {
        "n": n,
        "mois": mois,
        "p10": [round(x, 2) for x in p10],
        "p50": [round(x, 2) for x in p50],
        "p90": [round(x, 2) for x in p90],
        "totalP50": round(sum(p50), 2),
        "totalP90": round(total_p90, 2),
        "stockActuel": round(stock_total, 2),
        "gapP90": round(total_p90 - stock_total, 2),
        "serviceLevel": 0.9,
        "concentration": {"topCode": top["code"] if top else None, "sharePct": share},
        "champions": champions,
        "heatmap": heatmap,
        "ranking": ranking,
        "reconciled": reconciled,
        "neural": {
            "trained": bool(meta.get("trained")),
            "cached": bool(meta.get("cached")),
            "windows": meta.get("windows"),
            "epochs": meta.get("epochs"),
            "peers": meta.get("peers"),
            "finalLoss": meta.get("finalLoss"),
            "blocks": meta.get("blocks") or ["trend", "seasonal", "generic"],
            "lookback": meta.get("lookback"),
            "lossCurve": meta.get("lossCurve") or [],
        },
        "pipeline": [
            {"id": "pool", "label": "Catalogue", "status": "ok", "detail": f"{n} SKU en batch"},
            {"id": "nbeats", "label": "N-BEATS global", "status": "ok" if meta.get("trained") else "skip", "detail": f"{'cache · ' if meta.get('cached') else ''}{meta.get('windows') or 0} fenêtres"},
            {"id": "hw", "label": "HW local", "status": "ok", "detail": "Un Holt-Winters par article"},
            {"id": "reconcile", "label": "Hiérarchie", "status": "ok" if reconciled else "skip", "detail": "Famille → catalogue" if reconciled else "Non applicable"},
            {"id": "portfolio", "label": "Portefeuille P90", "status": "ok", "detail": f"Total {int(round(total_p90))} u. · {rupture_n} rupture(s)"},
        ],
        "story": story,
        "methodology": "Un N-BEATS global + HW local + Croston si intermittent, puis réconciliation top-down famille/catalogue. Stock = P90.",
        "methodologyLabel": "Batch N-BEATS + MinT-lite + P90",
    }


def run_forecast(payload: dict) -> dict:
    article_id = payload.get("article_id") or payload.get("articleId")
    horizon = max(1, min(int(payload.get("horizon") or 3), 12))
    y, mois_keys = _series_from_hist(payload.get("historique"))
    peers_raw = payload.get("peers") or []
    peer_series: List[np.ndarray] = []
    for p in peers_raw:
        s, _ = _series_from_hist(p.get("historique") if isinstance(p, dict) else None)
        if len(s) >= 8:
            peer_series.append(np.nan_to_num(s, nan=0.0, posinf=0.0, neginf=0.0))

    y = np.nan_to_num(np.asarray(y, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
    features = payload.get("features") or {}
    extra = {
        "familleId": features.get("familleId"),
        "stockActuel": features.get("stockActuel"),
        "articleCode": payload.get("articleCode") or features.get("code"),
        "articleLibelle": payload.get("articleLibelle") or features.get("libelle"),
    }
    if len(y) < 4:
        return _strip_private(_weighted_average(y, mois_keys, 3, article_id))

    train_pool = [y] + peer_series
    lookback = _lookback_of(train_pool)
    lookback = min(lookback, max(4, len(y) - 2))
    seed = int(article_id or 7) % 10_000
    need = lookback + 3 + 6
    eligible = [s for s in train_pool if len(s) >= need]
    if not eligible:
        net, neural_meta = None, {
            "trained": False,
            "windows": 0,
            "cached": False,
            "status": "skip",
            "detail": f"Historique {len(y)} < lookback + horizon + 6 ({need})",
        }
    else:
        net, neural_meta = _get_or_train_nbeats(eligible, lookback, 3, seed=seed)
    neural_meta["peers"] = len(peer_series)
    out = _forecast_from_series(
        y, mois_keys, article_id, net, neural_meta, lookback, len(peer_series), horizon, extra
    )
    return _strip_private(out)


def run_forecast_batch(payload: dict) -> dict:
    raw_items = payload.get("items") or []
    extra_peers = payload.get("peers") or []
    horizon = max(1, min(int(payload.get("horizon") or 3), 12))
    parsed: List[dict] = []
    pool: List[np.ndarray] = []

    for it in raw_items:
        y, keys = _series_from_hist(it.get("historique"))
        y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
        parsed.append({"raw": it, "y": y, "keys": keys})
        if len(y) >= 8:
            pool.append(y)
    for p in extra_peers:
        s, _ = _series_from_hist(p.get("historique") if isinstance(p, dict) else None)
        s = np.nan_to_num(s, nan=0.0, posinf=0.0, neginf=0.0)
        if len(s) >= 8:
            pool.append(s)

    lookback = _lookback_of(pool) if pool else 12
    net, neural_meta = _get_or_train_nbeats(pool, lookback, 3, seed=42) if pool else (None, {"trained": False, "windows": 0, "cached": False})
    neural_meta["peers"] = max(0, len(pool) - len(raw_items))

    results: List[dict] = []
    for row in parsed:
        it = row["raw"]
        extra = {
            "familleId": it.get("familleId") or (it.get("features") or {}).get("familleId"),
            "stockActuel": it.get("stockActuel"),
            "articleCode": it.get("code") or it.get("articleCode"),
            "articleLibelle": it.get("libelle") or it.get("articleLibelle"),
        }
        aid = it.get("article_id") or it.get("articleId")
        out = _forecast_from_series(
            row["y"], row["keys"], aid, net, neural_meta, lookback, max(0, len(pool) - 1), horizon, extra
        )
        results.append(out)

    results, reconciled = _reconcile_hierarchical(results, horizon=3)
    for r in results:
        r["pipeline"] = list(r.get("pipeline") or []) + [
            {
                "id": "reconcile",
                "label": "Hiérarchie",
                "status": "ok" if reconciled else "skip",
                "detail": "Recalé famille → catalogue" if reconciled else "Non applicable",
            }
        ]
        if reconciled:
            r["story"] = list(r.get("story") or []) + ["Prévision recalé pour coller au total famille / catalogue."]
    portfolio = _build_portfolio(results, neural_meta, reconciled)
    return {
        "items": [_strip_private(r) for r in results],
        "portfolio": portfolio,
        "neural": portfolio.get("neural"),
        "reconciled": reconciled,
        "mode": "ai",
        "modele": "hybrid_nbeats_hw_batch",
    }
