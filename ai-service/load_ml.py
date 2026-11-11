"""
Chargement ML — identité distincte du slotting GMM.

  1. HAC Ward (AgglomerativeClustering) → 3 couches cargo (fond / milieu / haut)
  2. HGBRegressor → classement d'utilité de packing (priorité de chargement)
  3. Portefeuille de 5 politiques + HGBClassifier (sélection d'algo)
  4. Tournée GPS (plus proche voisin + 2-opt) + recherche locale + LIFO

Le slotting ABC reste un mélange gaussien (classes A/B/C latentes).
Ici on empile : dendrogramme hiérarchique + utilité supervisée, pas un GMM.
"""
from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

try:
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
    from sklearn.metrics import silhouette_score, r2_score
    from sklearn.model_selection import cross_val_score, KFold
except Exception:  # pragma: no cover
    AgglomerativeClustering = None  # type: ignore
    StandardScaler = None  # type: ignore
    HistGradientBoostingClassifier = None  # type: ignore
    HistGradientBoostingRegressor = None  # type: ignore
    silhouette_score = None  # type: ignore
    r2_score = None  # type: ignore
    cross_val_score = None  # type: ignore
    KFold = None  # type: ignore

FEATURE_META = (
    ("density", "Densité"),
    ("volume", "Volume"),
    ("weight", "Poids"),
    ("fragile", "Fragile"),
    ("lifo", "LIFO dest."),
    ("value", "Valeur"),
    ("layer", "Couche HAC"),
    ("affinity", "Affinité"),
)

LAYERS = ("BOTTOM", "MID", "TOP")
LAYER_FR = {"BOTTOM": "Fond (cabine)", "MID": "Milieu", "TOP": "Haut / porte"}
POLICIES = ("density", "value", "dest_lifo", "hac_layer", "hgb_rank")
POLICY_FR = {
    "density": "Densité (kg/m³)",
    "value": "Valeur / volume",
    "dest_lifo": "LIFO destinations",
    "hac_layer": "Couches HAC",
    "hgb_rank": "Utilité HGB",
}


def _f(v: Any, default: float = 0.0) -> float:
    try:
        x = float(v)
        if np.isnan(x) or np.isinf(x):
            return default
        return x
    except (TypeError, ValueError):
        return default


def _qty(v: Any) -> int:
    return max(0, int(round(_f(v, 0.0))))


def _normalize_skus(raw: List[dict]) -> List[dict]:
    merged: Dict[Tuple[int, str], dict] = {}
    for a in raw or []:
        aid = int(a.get("articleId") or 0)
        dest = str(a.get("destination") or "").strip() or "—"
        key = (aid, dest)
        q = _qty(a.get("quantite"))
        if q <= 0:
            continue
        if key not in merged:
            merged[key] = {
                "articleId": aid,
                "code": a.get("code") or "",
                "libelle": a.get("libelle") or "",
                "quantite": 0,
                "poidsUnitaire": max(0.0, _f(a.get("poidsUnitaire"))),
                "volumeUnitaire": max(0.0, _f(a.get("volumeUnitaire"))),
                "destination": dest,
                "fragile": bool(a.get("fragile")),
                "dangereux": bool(a.get("dangereuxChimique") or a.get("dangereux")),
                "prixVente": max(0.0, _f(a.get("prixVente"))),
                "imageUrl": a.get("imageUrl") or None,
                "destLat": None,
                "destLng": None,
                "affStrength": 0.0,
            }
        merged[key]["quantite"] += q
        lat, lng = a.get("destLat"), a.get("destLng")
        if lat is not None and lng is not None:
            try:
                merged[key]["destLat"] = _f(lat)
                merged[key]["destLng"] = _f(lng)
            except Exception:
                pass
    return list(merged.values())


def _density(sku: dict) -> float:
    vol = sku["volumeUnitaire"]
    w = sku["poidsUnitaire"]
    if vol <= 1e-9:
        return w
    return w / vol


def _bay_dims(cap_v: float) -> Tuple[float, float, float]:
    """Soute approximée L×W×H (ratio camion 5 × 2.2 × 2) à volume égal."""
    v = max(float(cap_v), 1e-3)
    k = (v / (5.0 * 2.2 * 2.0)) ** (1.0 / 3.0)
    return 5.0 * k, 2.2 * k, 2.0 * k


def _unit_box(s: dict) -> Tuple[float, float, float]:
    vol = max(s["volumeUnitaire"], 1e-6)
    side = vol ** (1.0 / 3.0)
    if s.get("fragile"):
        h = side * 0.7
        foot = (vol / max(h, 1e-6)) ** 0.5
        return foot, foot, h
    if _density(s) >= 350:
        return side, side, side
    h = side * 1.12
    foot = (vol / max(h, 1e-6)) ** 0.5
    return foot, foot, h


def _restack_3d(rows: List[dict], cap_v: float) -> Tuple[List[dict], float, dict]:
    """Ré-empile les lignes chargées en soute 3D (étagères HAC) + centre de gravité."""
    L, W, H = _bay_dims(cap_v)
    band_h = H / 3.0
    z0 = {"BOTTOM": 0.0, "MID": band_h, "TOP": 2.0 * band_h}
    layer_rank = {"BOTTOM": 0, "MID": 1, "TOP": 2}
    cursors = {"BOTTOM": 0.02 * L, "MID": 0.02 * L, "TOP": 0.02 * L}
    out = []
    mass = 0.0
    mass_x = 0.0
    ordered = sorted(
        rows,
        key=lambda r: (
            layer_rank.get(r.get("layer") or "MID", 1),
            -(int(r.get("unloadOrder") or 0)),
        ),
    )
    for row in ordered:
        layer = row.get("layer") if row.get("layer") in z0 else "MID"
        qty = max(1, int(row.get("quantiteChargee") or 1))
        ul, uw, uh = _unit_box(row)
        vol = max(row["volumeUnitaire"] * qty, 1e-6)
        h = min(band_h * 0.92, max(uh, vol ** (1.0 / 3.0)))
        foot = (vol / max(h, 1e-6)) ** 0.5
        l = min(L * 0.4, max(ul, foot))
        w = min(W * 0.88, max(uw, vol / max(l * h, 1e-6)))
        x0 = cursors[layer]
        if x0 + l > L * 0.98:
            l = max(0.06 * L, L * 0.98 - x0)
            if l < 0.05 * L:
                x0 = 0.02 * L
                l = min(L * 0.28, foot)
        y0 = max(0.0, (W - w) / 2.0)
        m = float(row["poidsUnitaire"]) * qty
        mass += m
        mass_x += m * (x0 + l / 2.0)
        cursors[layer] = x0 + l + 0.012 * L
        out.append(
            {
                **row,
                "x": round(x0 / L, 3),
                "y": round(y0 / W, 3),
                "z": round(z0[layer] / H, 3),
                "dx": round(l / L, 3),
                "dy": round(w / W, 3),
                "dz": round(h / H, 3),
            }
        )
    cog_door = float(mass_x / mass / L) if mass else 0.5
    cog_door = max(0.05, min(0.95, cog_door))
    cab_frac = float(max(0.0, min(1.0, 1.0 - cog_door)))
    bay = {
        "length": round(L, 2),
        "width": round(W, 2),
        "height": round(H, 2),
        "cogDoor": round(cog_door, 3),
        "cogCab": round(cab_frac, 3),
    }
    return out, cab_frac, bay


def _haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    lat1, lon1 = np.radians(a[0]), np.radians(a[1])
    lat2, lon2 = np.radians(b[0]), np.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return float(6371.0 * 2 * np.arcsin(np.sqrt(max(0.0, h))))


def _tour_km(points: List[Tuple[float, float]], order: List[int]) -> float:
    if len(order) < 2:
        return 0.0
    return float(
        sum(_haversine_km(points[order[i]], points[order[i + 1]]) for i in range(len(order) - 1))
    )


def _nn_tsp(points: List[Tuple[float, float]], start_xy: Optional[Tuple[float, float]] = None) -> List[int]:
    n = len(points)
    if n <= 1:
        return list(range(n))
    remaining = set(range(n))
    if start_xy is not None:
        start = min(remaining, key=lambda i: _haversine_km(start_xy, points[i]))
    else:
        start = 0
    order = [start]
    remaining.remove(start)
    while remaining:
        last = order[-1]
        nxt = min(remaining, key=lambda i: _haversine_km(points[last], points[i]))
        order.append(nxt)
        remaining.remove(nxt)
    # 2-opt léger
    if n <= 12:
        best = order
        best_len = _tour_km(points, best)
        improved = True
        while improved:
            improved = False
            for i in range(1, n - 1):
                for j in range(i + 1, n):
                    cand = best[:i] + best[i : j + 1][::-1] + best[j + 1 :]
                    leng = _tour_km(points, cand)
                    if leng + 1e-6 < best_len:
                        best, best_len, improved = cand, leng, True
        order = best
    if 6 <= n <= 9:
        order = _three_opt(points, order)
    return order


def _three_opt(points: List[Tuple[float, float]], order: List[int]) -> List[int]:
    n = len(order)
    best = list(order)
    best_len = _tour_km(points, best)
    improved = True
    rounds = 0
    while improved and rounds < 3:
        improved = False
        rounds += 1
        for i in range(0, n - 4):
            for j in range(i + 2, n - 2):
                for k in range(j + 2, n):
                    a, b, c = best[: i + 1], best[i + 1 : j + 1], best[j + 1 : k + 1]
                    rest = best[k + 1 :]
                    for cand in (a + b[::-1] + c + rest, a + c + b + rest, a + c[::-1] + b + rest):
                        if len(cand) != n:
                            continue
                        leng = _tour_km(points, cand)
                        if leng + 1e-6 < best_len:
                            best, best_len, improved = cand, leng, True
    return best


def _dest_plan(
    skus: List[dict], depot: Optional[dict] = None
) -> Tuple[Dict[str, int], str, Optional[float], Dict[str, dict]]:
    buckets: Dict[str, dict] = {}
    for s in skus:
        d = s["destination"]
        if d not in buckets:
            buckets[d] = {"lats": [], "lngs": []}
        if s.get("destLat") is not None and s.get("destLng") is not None:
            buckets[d]["lats"].append(float(s["destLat"]))
            buckets[d]["lngs"].append(float(s["destLng"]))
    names = list(buckets.keys())
    geo = []
    for n in names:
        b = buckets[n]
        if b["lats"] and b["lngs"]:
            geo.append((float(np.mean(b["lats"])), float(np.mean(b["lngs"]))))
        else:
            geo.append(None)
    meta = {
        n: {
            "lat": geo[i][0] if geo[i] else None,
            "lng": geo[i][1] if geo[i] else None,
        }
        for i, n in enumerate(names)
    }
    usable = [i for i, g in enumerate(geo) if g is not None]
    if len(usable) >= 2:
        start_xy = None
        if depot and depot.get("latitude") is not None and depot.get("longitude") is not None:
            start_xy = (_f(depot.get("latitude")), _f(depot.get("longitude")))
        pts = [geo[i] for i in usable]  # type: ignore
        order_u = _nn_tsp(pts, start_xy)  # type: ignore
        dest_ix: Dict[str, int] = {}
        for rank, ui in enumerate(order_u):
            dest_ix[names[usable[ui]]] = rank
        rest = sorted(n for n in names if n not in dest_ix)
        for k, n in enumerate(rest):
            dest_ix[n] = len(order_u) + k
        km = _tour_km(pts, order_u)  # type: ignore
        if start_xy is not None:
            km += _haversine_km(start_xy, pts[order_u[0]])  # type: ignore
        return dest_ix, "geo_nn", round(km, 1), meta
    dest_ix = {d: i for i, d in enumerate(sorted(names))}
    return dest_ix, "alpha", None, meta


def _dest_index(skus: List[dict], depot: Optional[dict] = None) -> Dict[str, int]:
    return _dest_plan(skus, depot)[0]


def _affinity_strength(cooccurrence: List[dict]) -> Dict[int, float]:
    m: Dict[int, float] = {}
    for row in cooccurrence or []:
        a, b = int(row.get("a") or 0), int(row.get("b") or 0)
        c = _f(row.get("count"), 1.0)
        if a and b and a != b:
            m[a] = m.get(a, 0.0) + c
            m[b] = m.get(b, 0.0) + c
    return m


def _sku_matrix(skus: List[dict], dest_ix: Dict[str, int]) -> np.ndarray:
    n_dest = max(1, len(dest_ix))
    rows = []
    for s in skus:
        dens = _density(s)
        recency_dest = dest_ix.get(s["destination"], 0) / n_dest
        rows.append(
            [
                np.log1p(dens),
                np.log1p(s["volumeUnitaire"] * s["quantite"]),
                np.log1p(s["poidsUnitaire"] * s["quantite"]),
                1.0 if s["fragile"] else 0.0,
                recency_dest,
                np.log1p(s["prixVente"] * s["quantite"]),
            ]
        )
    return np.asarray(rows, dtype=float) if rows else np.zeros((0, 6))


def _percentile_layers(X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    n = X.shape[0]
    labels = np.zeros(n, dtype=int)
    if not n:
        return labels, np.zeros((0, 3))
    dens = X[:, 0]
    order = np.argsort(-dens)
    n_bot = max(1, int(round(n * 0.34)))
    n_mid = max(0, int(round(n * 0.33)))
    for rank, idx in enumerate(order):
        if rank < n_bot:
            labels[idx] = 0
        elif rank < n_bot + n_mid:
            labels[idx] = 1
        else:
            labels[idx] = 2
    proba = np.full((n, 3), 0.12)
    for i, lab in enumerate(labels):
        proba[i, lab] = 0.76
    return labels, proba


def _soft_from_centroids(Xs: np.ndarray, labels: np.ndarray, n_layers: int = 3) -> np.ndarray:
    d = Xs.shape[1]
    cents = np.zeros((n_layers, d))
    for k in range(n_layers):
        mask = labels == k
        cents[k] = Xs[mask].mean(axis=0) if np.any(mask) else Xs.mean(axis=0)
    dist = np.linalg.norm(Xs[:, None, :] - cents[None, :, :], axis=2)
    inv = 1.0 / np.maximum(dist, 1e-6)
    return inv / inv.sum(axis=1, keepdims=True)


def _fit_hac(X: np.ndarray) -> Tuple[np.ndarray, np.ndarray, str, Dict[str, Any]]:
    """Couches cargo par HAC Ward — k choisi par silhouette (biais léger k=3)."""
    n = X.shape[0]
    empty_meta: Dict[str, Any] = {"k": 3, "kScan": [], "leaves": []}
    if AgglomerativeClustering is None or StandardScaler is None or n < 5:
        labels, proba = _percentile_layers(X)
        empty_meta["leaves"] = _hac_leaves(X, labels)
        return labels, proba, "percentile_layers", empty_meta

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    k_max = int(min(4, max(2, n - 1)))
    k_scan = []
    best: Optional[Tuple[float, int, np.ndarray]] = None
    try:
        for k in range(2, k_max + 1):
            hac = AgglomerativeClustering(n_clusters=k, linkage="ward")
            raw = hac.fit_predict(Xs)
            sil = None
            if silhouette_score is not None and n >= 6 and len(np.unique(raw)) >= 2:
                try:
                    sil = float(silhouette_score(Xs, raw))
                except Exception:
                    sil = None
            k_scan.append({"k": k, "silhouette": round(sil, 3) if sil is not None else None})
            score = (sil if sil is not None else 0.0) + (0.035 if k == 3 else 0.0)
            if best is None or score > best[0]:
                best = (score, k, raw)
        if best is None:
            labels, proba = _percentile_layers(X)
            empty_meta["kScan"] = k_scan
            empty_meta["leaves"] = _hac_leaves(X, labels)
            return labels, proba, "percentile_layers", empty_meta
        _, k_star, raw = best
        means = []
        for c in range(k_star):
            mask = raw == c
            means.append(float(np.mean(X[mask, 0])) if np.any(mask) else -1e9)
        order = np.argsort(-np.asarray(means))
        labels = np.zeros(n, dtype=int)
        if k_star == 2:
            dense, light = int(order[0]), int(order[1])
            light_ix = np.where(raw == light)[0]
            labels[raw == dense] = 0
            if len(light_ix) <= 1:
                labels[raw == light] = 2
            else:
                vols = X[light_ix, 1]
                mid_cut = np.median(vols)
                for j, idx in enumerate(light_ix):
                    labels[idx] = 1 if vols[j] >= mid_cut else 2
        else:
            remap = {int(order[i]): min(i, 2) for i in range(len(order))}
            labels = np.array([remap[int(c)] for c in raw], dtype=int)
        proba = _soft_from_centroids(Xs, labels, 3)
        meta = {
            "k": int(k_star),
            "kScan": k_scan,
            "leaves": _hac_leaves(X, labels),
        }
        return labels, proba, f"hac_ward_{k_star}", meta
    except Exception:
        labels, proba = _percentile_layers(X)
        empty_meta["kScan"] = k_scan
        empty_meta["leaves"] = _hac_leaves(X, labels)
        return labels, proba, "percentile_layers", empty_meta


def _hac_leaves(X: np.ndarray, labels: np.ndarray) -> List[dict]:
    leaves = []
    for i, lid in enumerate(LAYERS):
        mask = labels == i
        dens = float(np.mean(np.expm1(X[mask, 0]))) if np.any(mask) and X.shape[1] else 0.0
        leaves.append({"id": lid, "n": int(np.sum(mask)), "meanDensity": round(dens, 2)})
    return leaves


def _nz(a: np.ndarray) -> np.ndarray:
    lo, hi = float(np.min(a)), float(np.max(a))
    if hi - lo < 1e-9:
        return np.zeros_like(a, dtype=float)
    return (a - lo) / (hi - lo)


def _sku_features(skus: List[dict], labels: np.ndarray, dest_ix: Dict[str, int]) -> np.ndarray:
    n_dest = max(1, len(dest_ix))
    rows = []
    for i, s in enumerate(skus):
        rows.append(
            [
                np.log1p(_density(s)),
                np.log1p(s["volumeUnitaire"] * s["quantite"]),
                np.log1p(s["poidsUnitaire"] * s["quantite"]),
                1.0 if s["fragile"] else 0.0,
                dest_ix.get(s["destination"], 0) / n_dest,
                np.log1p(s["prixVente"] * s["quantite"]),
                float(labels[i]) / 2.0 if i < len(labels) else 0.5,
                _f(s.get("affStrength")),
            ]
        )
    return np.asarray(rows, dtype=float) if rows else np.zeros((0, 8))


def _fit_utility_ranker(
    skus: List[dict],
    labels: np.ndarray,
    dest_ix: Dict[str, int],
    cap_w: float,
    cap_v: float,
) -> Tuple[np.ndarray, Optional[float], str, List[dict], str]:
    """HGBRegressor : utilité de packing, R² hors-fold + importance des features."""
    n = len(skus)
    empty_imp: List[dict] = []
    if n == 0:
        return np.zeros(0), None, "skip", empty_imp, "none"

    n_dest = max(1, len(dest_ix))
    dens_v = np.array([_density(s) for s in skus], dtype=float)
    val_v = np.array([s["prixVente"] / max(s["volumeUnitaire"], 1e-6) for s in skus], dtype=float)
    dest_v = np.array([dest_ix.get(s["destination"], 0) / n_dest for s in skus], dtype=float)
    frag_v = np.array([0.22 if s["fragile"] else 1.0 for s in skus], dtype=float)
    formula = 0.34 * _nz(dens_v) + 0.26 * _nz(val_v) + 0.24 * dest_v + 0.16 * frag_v

    inclusion = np.zeros(n, dtype=float)
    trials = 0
    rng = np.random.RandomState(7)
    teacher_policies = ("density", "value", "dest_lifo", "hac_layer")
    for _ in range(8):
        sw = cap_w * float(0.68 + 0.45 * rng.rand())
        sv = cap_v * float(0.68 + 0.45 * rng.rand())
        for p in teacher_policies:
            order = _order_ids(skus, p, labels, dest_ix)
            loaded, _, _, _ = _pack(skus, order, sw, sv)
            loaded_map = {x["skuIndex"]: x["quantiteChargee"] for x in loaded}
            for i in range(n):
                inclusion[i] += loaded_map.get(i, 0) / max(1, skus[i]["quantite"])
            trials += 1
    y = 0.55 * (inclusion / max(1, trials)) + 0.45 * formula

    Xf = _sku_features(skus, labels, dest_ix)
    if HistGradientBoostingRegressor is None or n < 5:
        return np.clip(y, 0.0, 1.0), None, "formula", empty_imp, "none"

    def _make_reg() -> Any:
        return HistGradientBoostingRegressor(
            max_depth=3,
            max_iter=55,
            learning_rate=0.08,
            min_samples_leaf=max(2, n // 8),
            random_state=42,
        )

    def _r2(yt: np.ndarray, yp: np.ndarray) -> float:
        if r2_score is not None:
            try:
                return float(max(-1.0, min(1.0, r2_score(yt, yp))))
            except Exception:
                pass
        ss_res = float(np.sum((yt - yp) ** 2))
        ss_tot = float(np.sum((yt - np.mean(yt)) ** 2))
        return float(max(-1.0, min(1.0, 1.0 - ss_res / max(ss_tot, 1e-12))))

    try:
        oof = np.full(n, np.nan)
        r2_kind = "in_sample"
        if KFold is not None and n >= 8:
            n_splits = min(5, n)
            kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
            for tr, te in kf.split(Xf):
                if len(tr) < 4 or len(te) < 1:
                    continue
                fold = _make_reg()
                fold.fit(Xf[tr], y[tr])
                oof[te] = fold.predict(Xf[te])
            mask = np.isfinite(oof)
            if int(np.sum(mask)) >= 4:
                r2_kind = "oof"

        reg = _make_reg()
        reg.fit(Xf, y)
        pred = np.clip(reg.predict(Xf), 0.0, 1.0)
        if r2_kind == "oof":
            mask = np.isfinite(oof)
            r2 = _r2(y[mask], np.clip(oof[mask], 0.0, 1.0))
        else:
            r2 = _r2(y, pred)

        importances: List[dict] = []
        rng_p = np.random.RandomState(11)
        base = _r2(y, pred)
        raw_imp = []
        for j in range(Xf.shape[1]):
            Xp = Xf.copy()
            rng_p.shuffle(Xp[:, j])
            drop = max(0.0, base - _r2(y, np.clip(reg.predict(Xp), 0.0, 1.0)))
            raw_imp.append(drop)
        tot = float(sum(raw_imp)) or 1.0
        for (fid, flabel), wgt in zip(FEATURE_META, raw_imp):
            importances.append(
                {"id": fid, "label": flabel, "weight": round(float(wgt / tot), 3)}
            )
        importances.sort(key=lambda d: d["weight"], reverse=True)
        return pred, float(r2), "ok", importances, r2_kind
    except Exception:
        return np.clip(y, 0.0, 1.0), None, "formula", empty_imp, "none"


def _silhouette(X: np.ndarray, labels: np.ndarray) -> Optional[float]:
    n = X.shape[0]
    if n < 8 or len(np.unique(labels)) < 2 or silhouette_score is None:
        return None
    try:
        std = X.std(axis=0)
        std = np.where(std < 1e-9, 1.0, std)
        Xs = (X - X.mean(axis=0)) / std
        return float(max(-1.0, min(1.0, silhouette_score(Xs, labels))))
    except Exception:
        return None


def _order_ids(
    skus: List[dict],
    policy: str,
    labels: np.ndarray,
    dest_ix: Dict[str, int],
    utilities: Optional[np.ndarray] = None,
) -> List[int]:
    scored = []
    for i, s in enumerate(skus):
        dens = _density(s)
        value = s["prixVente"] * max(1, s["quantite"])
        vol = max(s["volumeUnitaire"] * s["quantite"], 1e-6)
        dest_lifo = dest_ix.get(s["destination"], 0)  # high = last stop = load first
        layer = int(labels[i]) if i < len(labels) else 1
        aff = _f(s.get("affStrength"))
        util = float(utilities[i]) if utilities is not None and i < len(utilities) else dens
        if policy == "density":
            key = (0 if s["fragile"] else 1, dens, dest_lifo)
        elif policy == "value":
            key = (value / vol, dens)
        elif policy == "dest_lifo":
            key = (dest_lifo, aff, 0 if s["fragile"] else 1, dens)
        elif policy == "hgb_rank":
            key = (util, dest_lifo, aff, dens)
        else:  # hac_layer : BOTTOM (0) first
            key = (-layer, dest_lifo, aff, dens)
        scored.append((key, i))
    scored.sort(key=lambda t: t[0], reverse=True)
    return [i for _, i in scored]


def _pack(skus: List[dict], order: List[int], cap_w: float, cap_v: float) -> Tuple[List[dict], List[dict], float, float]:
    loaded: List[dict] = []
    rejected: List[dict] = []
    w = 0.0
    v = 0.0
    for i in order:
        s = skus[i]
        pw, pv = s["poidsUnitaire"], s["volumeUnitaire"]
        left = int(s["quantite"])
        can = left
        if pw > 1e-9:
            can = min(can, int(np.floor((cap_w - w) / pw + 1e-9)))
        if pv > 1e-9:
            can = min(can, int(np.floor((cap_v - v) / pv + 1e-9)))
        can = max(0, can)
        if can > 0:
            loaded.append({**s, "quantiteChargee": can, "skuIndex": i})
            w += can * pw
            v += can * pv
        leftover = left - can
        if leftover > 0:
            rejected.append({**s, "quantiteNonChargee": leftover, "skuIndex": i})
    return loaded, rejected, w, v


def _pack_lookahead(
    skus: List[dict],
    order: List[int],
    cap_w: float,
    cap_v: float,
    beam: int = 3,
) -> Tuple[List[dict], List[dict], float, float]:
    """Packing à fenêtre : parmi les 3 prochains SKU, on prend celui qui rapporte le plus."""
    remaining = list(order)
    loaded: List[dict] = []
    leftover: Dict[int, int] = {}
    w = 0.0
    v = 0.0
    while remaining:
        window = remaining[: min(beam, len(remaining))]
        best_idx = window[0]
        best_gain = -1e18
        best_can = 0
        for idx in window:
            s = skus[idx]
            pw, pv = s["poidsUnitaire"], s["volumeUnitaire"]
            left = int(s["quantite"])
            can = left
            if pw > 1e-9:
                can = min(can, int(np.floor((cap_w - w) / pw + 1e-9)))
            if pv > 1e-9:
                can = min(can, int(np.floor((cap_v - v) / pv + 1e-9)))
            can = max(0, can)
            if can <= 0:
                gain = -1.0
            else:
                gain = (s["prixVente"] * can) / max(pv * can, 1e-6) + 0.12 * _density(s)
            if gain > best_gain:
                best_gain, best_idx, best_can = gain, idx, can
        remaining.remove(best_idx)
        s = skus[best_idx]
        if best_can <= 0:
            leftover[best_idx] = leftover.get(best_idx, 0) + int(s["quantite"])
            continue
        loaded.append({**s, "quantiteChargee": best_can, "skuIndex": best_idx})
        w += best_can * s["poidsUnitaire"]
        v += best_can * s["volumeUnitaire"]
        rest = int(s["quantite"]) - best_can
        if rest > 0:
            leftover[best_idx] = leftover.get(best_idx, 0) + rest
    rejected = [
        {**skus[i], "quantiteNonChargee": q, "skuIndex": i}
        for i, q in leftover.items()
        if q > 0
    ]
    return loaded, rejected, w, v


def _line_totals(loaded: List[dict]) -> Tuple[float, float]:
    w = sum(x["quantiteChargee"] * x["poidsUnitaire"] for x in loaded)
    v = sum(x["quantiteChargee"] * x["volumeUnitaire"] for x in loaded)
    return w, v


def _improve_pack(
    loaded: List[dict],
    rejected: List[dict],
    cap_w: float,
    cap_v: float,
    labels: np.ndarray,
) -> Tuple[List[dict], List[dict], float, float, int]:
    """Échange borné : sortir la ligne la moins rentable pour charger du rejeté plus dense en valeur."""
    loaded = [dict(x) for x in loaded]
    rejected = [dict(x) for x in rejected]
    swaps = 0
    if not loaded or not rejected:
        w, v = _line_totals(loaded)
        return loaded, rejected, w, v, 0

    def vd(row: dict) -> float:
        return row["prixVente"] / max(row["volumeUnitaire"], 1e-6)

    for _ in range(6):
        w, v = _line_totals(loaded)
        base = _composite(loaded, rejected, w, v, cap_w, cap_v, labels)["score"]
        worst_i = min(range(len(loaded)), key=lambda i: vd(loaded[i]))
        best_j = max(range(len(rejected)), key=lambda j: vd(rejected[j]))
        L, R = loaded[worst_i], rejected[best_j]
        if vd(R) <= vd(L) * 1.05:
            break
        room_w = cap_w - w + L["quantiteChargee"] * L["poidsUnitaire"]
        room_v = cap_v - v + L["quantiteChargee"] * L["volumeUnitaire"]
        add = int(R["quantiteNonChargee"])
        if R["poidsUnitaire"] > 1e-9:
            add = min(add, int(np.floor(room_w / R["poidsUnitaire"] + 1e-9)))
        if R["volumeUnitaire"] > 1e-9:
            add = min(add, int(np.floor(room_v / R["volumeUnitaire"] + 1e-9)))
        if add <= 0:
            break
        new_loaded = [dict(x) for i, x in enumerate(loaded) if i != worst_i]
        found = next((x for x in new_loaded if x.get("skuIndex") == R.get("skuIndex")), None)
        if found:
            found["quantiteChargee"] += add
        else:
            new_loaded.append({**R, "quantiteChargee": add})
        leftover_r = int(R["quantiteNonChargee"]) - add
        new_rej = [dict(x) for j, x in enumerate(rejected) if j != best_j]
        if leftover_r > 0:
            new_rej.append({**R, "quantiteNonChargee": leftover_r})
        new_rej.append({**L, "quantiteNonChargee": L["quantiteChargee"]})
        nw, nv = _line_totals(new_loaded)
        if nw > cap_w + 1e-6 or nv > cap_v + 1e-6:
            break
        score = _composite(new_loaded, new_rej, nw, nv, cap_w, cap_v, labels)["score"]
        if score > base + 1e-4:
            loaded, rejected, swaps = new_loaded, new_rej, swaps + 1
        else:
            break
    w, v = _line_totals(loaded)
    return loaded, rejected, w, v, swaps


def _dest_cohesion(loaded: List[dict]) -> float:
    if len(loaded) <= 1:
        return 1.0
    seq = [x["destination"] for x in loaded]
    switches = sum(1 for a, b in zip(seq, seq[1:]) if a != b)
    return float(max(0.0, 1.0 - switches / max(1, len(seq) - 1)))


def _stability(loaded: List[dict], labels: np.ndarray) -> float:
    if not loaded:
        return 1.0
    layers = [int(labels[x["skuIndex"]]) if x.get("skuIndex") is not None else 1 for x in loaded]
    inversions = 0
    pairs = 0
    for i in range(len(layers)):
        for j in range(i + 1, len(layers)):
            pairs += 1
            if layers[i] > layers[j]:
                inversions += 1
    if pairs == 0:
        return 1.0
    return float(1.0 - inversions / pairs)


def _balance(loaded: List[dict]) -> float:
    if not loaded:
        return 1.0
    weights = [x["quantiteChargee"] * x["poidsUnitaire"] for x in loaded]
    total = sum(weights) or 1.0
    mid = max(1, len(weights) // 2)
    rear = sum(weights[:mid]) / total
    return float(max(0.0, 1.0 - abs(0.5 - rear) * 2.0))


def _composite(loaded, rejected, w, v, cap_w, cap_v, labels) -> Dict[str, float]:
    n_units = sum(x["quantiteChargee"] for x in loaded) + sum(x.get("quantiteNonChargee", 0) for x in rejected)
    loaded_u = sum(x["quantiteChargee"] for x in loaded)
    fill_w = min(1.0, w / cap_w) if cap_w else 0.0
    fill_v = min(1.0, v / cap_v) if cap_v else 0.0
    fill = 0.5 * fill_w + 0.5 * fill_v
    complete = loaded_u / max(1, n_units)
    cohesion = _dest_cohesion(loaded)
    stab = _stability(loaded, labels)
    bal = _balance(loaded)
    fragile_late = 1.0
    if loaded:
        frag_pos = [i for i, x in enumerate(loaded) if x["fragile"]]
        if frag_pos:
            # fragile should be late in the load (near door / top)
            fragile_late = float(np.mean([(i + 1) / len(loaded) for i in frag_pos]))
    score = (
        0.38 * fill
        + 0.22 * complete
        + 0.16 * cohesion
        + 0.12 * stab
        + 0.08 * bal
        + 0.04 * fragile_late
    )
    return {
        "score": float(score),
        "fill": float(fill),
        "complete": float(complete),
        "cohesion": float(cohesion),
        "stability": float(stab),
        "balance": float(bal),
        "fragileLate": float(fragile_late),
        "fillWeight": float(fill_w),
        "fillVolume": float(fill_v),
    }


def _instance_features(skus: List[dict], cap_w: float, cap_v: float, dest_ix: Dict[str, int]) -> np.ndarray:
    n = len(skus)
    units = sum(s["quantite"] for s in skus)
    tw = sum(s["poidsUnitaire"] * s["quantite"] for s in skus)
    tv = sum(s["volumeUnitaire"] * s["quantite"] for s in skus)
    frag = sum(s["quantite"] for s in skus if s["fragile"]) / max(1, units)
    dens = np.array([_density(s) for s in skus], dtype=float) if skus else np.array([0.0])
    dests = [s["destination"] for s in skus for _ in range(s["quantite"])]
    counts = np.array(list(Counter(dests).values()), dtype=float) if dests else np.array([1.0])
    p = counts / counts.sum()
    entropy = float(-np.sum(p * np.log(p + 1e-12)) / np.log(max(2, len(p))))
    return np.array(
        [
            n,
            units,
            len(dest_ix),
            frag,
            float(np.log1p(np.mean(dens))),
            min(3.0, tw / max(cap_w, 1e-6)),
            min(3.0, tv / max(cap_v, 1e-6)),
            entropy,
        ],
        dtype=float,
    )


def _fit_policy_selector(
    skus: List[dict],
    labels: np.ndarray,
    dest_ix: Dict[str, int],
    cap_w: float,
    cap_v: float,
    utilities: Optional[np.ndarray] = None,
) -> Tuple[Optional[Any], Optional[float], str]:
    if HistGradientBoostingClassifier is None or len(skus) < 3:
        return None, None, "skip"
    rng = np.random.RandomState(42)
    X_rows = []
    y_rows = []
    for _ in range(20):
        sw = cap_w * float(0.72 + 0.5 * rng.rand())
        sv = cap_v * float(0.72 + 0.5 * rng.rand())
        keep = [i for i in range(len(skus)) if rng.rand() > 0.12]
        if len(keep) < 2:
            keep = list(range(len(skus)))
        sub = [skus[i] for i in keep]
        sub_lab = labels[keep]
        sub_u = utilities[keep] if utilities is not None else None
        sub_dest = _dest_index(sub)
        best_p, best_s = POLICIES[0], -1.0
        for p in POLICIES:
            order = _order_ids(sub, p, sub_lab, sub_dest, sub_u)
            loaded, rejected, w, v = _pack(sub, order, sw, sv)
            met = _composite(loaded, rejected, w, v, sw, sv, sub_lab)
            if met["score"] > best_s:
                best_s, best_p = met["score"], p
        X_rows.append(_instance_features(sub, sw, sv, sub_dest))
        y_rows.append(POLICIES.index(best_p))
    X = np.vstack(X_rows)
    y = np.asarray(y_rows, dtype=int)
    if len(np.unique(y)) < 2:
        return None, None, "skip"
    try:
        clf = HistGradientBoostingClassifier(
            max_depth=3,
            max_iter=40,
            learning_rate=0.1,
            min_samples_leaf=max(2, len(X) // 8),
            random_state=42,
        )
        acc = None
        y_counts = Counter(y.tolist())
        if (
            cross_val_score is not None
            and len(X) >= 9
            and len(y_counts) >= 2
            and min(y_counts.values()) >= 3
        ):
            try:
                acc = float(np.mean(cross_val_score(clf, X, y, cv=3)))
            except Exception:
                acc = None
        clf.fit(X, y)
        if acc is None:
            pred = clf.predict(X)
            acc = float(np.mean(pred == y))
        return clf, acc, "ok"
    except Exception:
        return None, None, "skip"


def _sequence_loaded(loaded: List[dict], labels: np.ndarray, dest_ix: Dict[str, int]) -> List[dict]:
    """Fond camion d'abord (couche dense + dernière destination), porte en dernier."""

    def key(x):
        layer = int(labels[x["skuIndex"]]) if x.get("skuIndex") is not None else 1
        dest = dest_ix.get(x["destination"], 0)
        dens = _density(x)
        frag = 0 if x["fragile"] else 1
        return (layer, -dest, -frag, -dens)

    ordered = sorted(loaded, key=key)
    n = len(ordered)
    out = []
    for i, x in enumerate(ordered):
        layer = LAYERS[int(labels[x["skuIndex"]])] if x.get("skuIndex") is not None else "MID"
        row = {
            **x,
            "layer": layer,
            "layerLabel": LAYER_FR[layer],
            "loadOrder": i + 1,
            "unloadOrder": n - i,
            "doorProximity": int(round(100 * (i / max(1, n - 1)))) if n > 1 else 100,
        }
        row.pop("skuIndex", None)
        out.append(row)
    return out


def _guard_load(charges: List[dict], dest_ix: Dict[str, int], cap_w: float, cap_v: float):
    """Aucun dépassement poids/volume, et LIFO : la dernière destination est chargée en premier."""
    kept: List[dict] = []
    w = 0.0
    v = 0.0
    for row in charges:
        pw = float(row.get("poidsUnitaire") or 0)
        pv = float(row.get("volumeUnitaire") or 0)
        qty = int(row.get("quantiteChargee") or 0)
        can = qty
        if pw > 1e-9 and cap_w >= 0:
            can = min(can, int(np.floor((cap_w - w) / pw + 1e-9)))
        if pv > 1e-9 and cap_v >= 0:
            can = min(can, int(np.floor((cap_v - v) / pv + 1e-9)))
        can = max(0, can)
        if can <= 0:
            continue
        nxt = dict(row)
        nxt["quantiteChargee"] = can
        w += can * pw
        v += can * pv
        kept.append(nxt)
    kept.sort(key=lambda r: int(dest_ix.get(r.get("destination") or "", 0)), reverse=True)
    n = len(kept)
    for i, row in enumerate(kept):
        row["loadOrder"] = i + 1
        row["unloadOrder"] = n - i
    constraints = {
        "weightOk": bool(cap_w <= 0 or w <= cap_w + 1e-6),
        "volumeOk": bool(cap_v <= 0 or v <= cap_v + 1e-6),
        "utilizationWeightPct": round((w / cap_w) * 100, 1) if cap_w else 0.0,
        "utilizationVolumePct": round((v / cap_v) * 100, 1) if cap_v else 0.0,
    }
    return kept, w, v, constraints


def run_load_optimization(payload: dict) -> dict:
    articles = _normalize_skus(payload.get("articles") or [])
    veh = payload.get("vehicule") or {}
    cap_w = max(0.0, _f(veh.get("capacitePoids")))
    cap_v = max(0.0, _f(veh.get("capaciteVolume")))
    nom = veh.get("nom") or "Véhicule"

    if not articles or (cap_w <= 0 and cap_v <= 0):
        return {
            "vehicule": nom,
            "poidsUtilise": 0,
            "poidsCapacite": cap_w,
            "pctPoids": 0,
            "volumeUtilise": 0,
            "volumeCapacite": cap_v,
            "pctVolume": 0,
            "articlesCharges": [],
            "articlesNonCharges": [],
            "chargementComplet": True,
            "constraints": {
                "weightOk": True,
                "volumeOk": True,
                "utilizationWeightPct": 0.0,
                "utilizationVolumePct": 0.0,
            },
            "modele": "hac_hgb_rank_tsp",
            "methodology": "Aucune ligne à charger.",
            "methodologyLabel": "Aucune ligne à charger.",
        }

    dest_ix, geo_mode, tour_km, dest_meta = _dest_plan(articles, payload.get("depot"))
    aff = _affinity_strength(payload.get("cooccurrence") or [])
    for s in articles:
        s["affStrength"] = float(aff.get(s["articleId"], 0.0))
    X = _sku_matrix(articles, dest_ix)
    labels, proba, hac_mode, hac_meta = _fit_hac(X)
    sil = _silhouette(X, labels)
    utilities, hgb_r2, rank_status, feature_importance, r2_kind = _fit_utility_ranker(
        articles, labels, dest_ix, cap_w, cap_v
    )
    census = {
        "BOTTOM": int(np.sum(labels == 0)),
        "MID": int(np.sum(labels == 1)),
        "TOP": int(np.sum(labels == 2)),
        "n": int(len(labels)),
    }

    plans = {}
    for policy in POLICIES:
        order = _order_ids(articles, policy, labels, dest_ix, utilities)
        loaded, rejected, w, v = _pack(articles, order, cap_w, cap_v)
        loaded, rejected, w, v, n_swaps = _improve_pack(loaded, rejected, cap_w, cap_v, labels)
        met = _composite(loaded, rejected, w, v, cap_w, cap_v, labels)
        plans[policy] = {
            "loaded": loaded,
            "rejected": rejected,
            "w": w,
            "v": v,
            "metrics": met,
            "swaps": n_swaps,
        }

    clf, acc, hgb_status = _fit_policy_selector(articles, labels, dest_ix, cap_w, cap_v, utilities)
    feat = _instance_features(articles, cap_w, cap_v, dest_ix).reshape(1, -1)
    predicted = None
    posterior_policy = {p: 0.0 for p in POLICIES}
    if clf is not None:
        try:
            predicted = POLICIES[int(clf.predict(feat)[0])]
            if hasattr(clf, "predict_proba"):
                pr = clf.predict_proba(feat)[0]
                classes = list(clf.classes_)
                for idx, p_i in enumerate(pr):
                    name = POLICIES[int(classes[idx])] if int(classes[idx]) < len(POLICIES) else None
                    if name:
                        posterior_policy[name] = round(float(p_i), 3)
        except Exception:
            predicted = None
            hgb_status = "fallback"

    best_policy = max(plans, key=lambda p: plans[p]["metrics"]["score"])
    winner = plans[best_policy]
    beam_used = False
    try:
        order_w = _order_ids(articles, best_policy, labels, dest_ix, utilities)
        bl, br, bw, bv = _pack_lookahead(articles, order_w, cap_w, cap_v, 3)
        bl, br, bw, bv, ns = _improve_pack(bl, br, cap_w, cap_v, labels)
        met_b = _composite(bl, br, bw, bv, cap_w, cap_v, labels)
        if met_b["score"] > winner["metrics"]["score"] + 1e-4:
            winner = {
                "loaded": bl,
                "rejected": br,
                "w": bw,
                "v": bv,
                "metrics": met_b,
                "swaps": ns,
            }
            beam_used = True
    except Exception:
        beam_used = False
    sequenced = _sequence_loaded(winner["loaded"], labels, dest_ix)
    w, v = winner["w"], winner["v"]
    met = winner["metrics"]
    axle_w = [x["quantiteChargee"] * x["poidsUnitaire"] for x in sequenced]
    axle_tot = sum(axle_w) or 1.0
    axle_mid = max(1, len(axle_w) // 2)
    rear_frac = sum(axle_w[:axle_mid]) / axle_tot
    met["balance"] = float(max(0.0, 1.0 - abs(0.5 - rear_frac) * 2.0))
    axle = {
        "rearPct": int(round(rear_frac * 100)),
        "frontPct": int(round((1.0 - rear_frac) * 100)),
        "balance": int(round(met["balance"] * 100)),
    }

    sku_ix = {(s["articleId"], s["destination"]): i for i, s in enumerate(articles)}
    charges = []
    for row in sequenced:
        ix = sku_ix.get((row["articleId"], row["destination"]))
        util = float(utilities[ix]) if ix is not None and ix < len(utilities) else None
        layer_p = None
        if ix is not None and ix < len(proba) and ix < len(labels):
            layer_p = float(proba[ix, int(labels[ix])])
        charges.append(
            {
                "articleId": row["articleId"],
                "code": row["code"],
                "libelle": row["libelle"],
                "quantiteChargee": row["quantiteChargee"],
                "destination": row["destination"],
                "fragile": row["fragile"],
                "dangereux": row.get("dangereux"),
                "imageUrl": row.get("imageUrl"),
                "layer": row["layer"],
                "layerLabel": row["layerLabel"],
                "layerP": round(layer_p, 3) if layer_p is not None else None,
                "utilityScore": round(util, 3) if util is not None else None,
                "loadOrder": row["loadOrder"],
                "unloadOrder": row["unloadOrder"],
                "doorProximity": row["doorProximity"],
                "poidsUnitaire": row["poidsUnitaire"],
                "volumeUnitaire": row["volumeUnitaire"],
            }
        )
    stack3d = False
    bay = None
    try:
        charges, cab_frac, bay = _restack_3d(charges, cap_v)
        stack3d = True
        met["balance"] = float(max(0.0, 1.0 - abs(0.5 - cab_frac) * 2.0))
        axle = {
            "rearPct": int(round(cab_frac * 100)),
            "frontPct": int(round((1.0 - cab_frac) * 100)),
            "balance": int(round(met["balance"] * 100)),
            "cog": bay.get("cogDoor"),
        }
    except Exception:
        stack3d = False
        bay = None
    rejected_out = [
        {
            "articleId": r["articleId"],
            "code": r["code"],
            "libelle": r["libelle"],
            "quantiteNonChargee": r["quantiteNonChargee"],
            "destination": r.get("destination"),
            "reason": "Capacité poids/volume atteinte — reporté par le portefeuille ML",
        }
        for r in winner["rejected"]
    ]

    hac_ok = hac_mode.startswith("hac")
    rank_ok = rank_status == "ok"
    hgb_ok = hgb_status == "ok"
    pipeline = [
        {
            "id": "hac",
            "label": "Couches HAC",
            "status": "ok" if hac_ok else "fallback",
            "detail": (
                f"Ward k={hac_meta.get('k', 3)} · {census['n']} SKU · {census['BOTTOM']} fond · {census['MID']} milieu · {census['TOP']} haut"
                + (f" · sil {sil:.2f}" if sil is not None else "")
            ),
        },
        {
            "id": "rank",
            "label": "Utilité HGB",
            "status": "ok" if rank_ok else "fallback",
            "detail": (
                f"Classement packing · R² {hgb_r2:.2f} · {'OOF' if r2_kind == 'oof' else 'échantillon'}"
                if rank_ok and hgb_r2 is not None
                else "Score d'utilité heuristique (échantillon trop petit)"
            ),
        },
        {
            "id": "hgb",
            "label": "Sélection HGB",
            "status": "ok" if hgb_ok else "skip",
            "detail": (
                f"Politique prédite : {POLICY_FR.get(predicted or '', predicted)} · acc. synth. {acc:.0%}"
                if hgb_ok and predicted
                else "Échantillon trop homogène — tournoi des 5 politiques seul"
            ),
        },
        {
            "id": "portfolio",
            "label": "Portefeuille",
            "status": "ok",
            "detail": f"Gagnant {POLICY_FR[best_policy]} · score {met['score']:.2f}",
        },
        {
            "id": "sequence",
            "label": "Tournée LIFO",
            "status": "ok" if geo_mode == "geo_nn" else ("ok" if dest_ix else "skip"),
            "detail": (
                f"GPS plus-proche-voisin + 2-opt/3-opt · {tour_km} km · {len(dest_ix)} stops"
                if geo_mode == "geo_nn"
                else f"{len(dest_ix)} destination(s) (sans GPS) · cohésion {met['cohesion']:.0%}"
            ),
        },
        {
            "id": "search",
            "label": "Recherche locale",
            "status": "ok" if winner.get("swaps") or beam_used else "skip",
            "detail": (
                (
                    f"{winner.get('swaps', 0)} échange(s)"
                    if winner.get("swaps")
                    else "Plan localement stable"
                )
                + (" · lookahead ×3" if beam_used else "")
                + (" · soute 3D" if stack3d else "")
            ),
        },
    ]

    story = [
        f"HAC Ward (k={hac_meta.get('k', 3)}) : {census['n']} SKU → {census['BOTTOM']} fond · {census['MID']} milieu · {census['TOP']} haut.",
        f"Politique retenue : {POLICY_FR[best_policy]} (score {met['score']:.2f}).",
    ]
    if rank_ok and hgb_r2 is not None:
        kind = "hors-fold" if r2_kind == "oof" else "in-sample"
        story.append(f"Classement d'utilité HGB (R² {hgb_r2:.2f}, {kind}) — priorité packing, pas classes ABC.")
    if beam_used:
        story.append("Lookahead ×3 : le packing à fenêtre a battu le greedy de la politique gagnante.")
    if stack3d and bay:
        story.append(
            f"Soute 3D {bay['length']}×{bay['width']}×{bay['height']} m · CoG porte {bay['cogDoor']:.0%} (cabine {bay['cogCab']:.0%})."
        )
    if predicted:
        match = "alignée" if predicted == best_policy else "différente du tournoi"
        story.append(f"Le sélecteur HGB prévoyait {POLICY_FR.get(predicted, predicted)} ({match}).")
    story.append(
        f"Remplissage {met['fill']:.0%} · équilibre essieux {met['balance']:.0%} · "
        f"cohésion destinations {met['cohesion']:.0%}."
    )
    if geo_mode == "geo_nn" and tour_km is not None:
        story.append(f"Tournée GPS (plus proche voisin + 2-opt) : {tour_km} km.")
    if winner.get("swaps"):
        story.append(f"Recherche locale : {winner['swaps']} échange(s) ont amélioré le plan.")
    if any(s.get("affStrength") for s in articles):
        story.append("Affinité de co-chargement (mêmes ventes) intégrée au tri LIFO / couches.")
    if rejected_out:
        story.append(
            f"{sum(r['quantiteNonChargee'] for r in rejected_out)} unité(s) reportée(s) — 2e tournée conseillée."
        )
    else:
        story.append("Chargement complet : toutes les unités tiennent dans le véhicule.")

    maturity = 0.0
    maturity += 28.0 if hac_ok else 14.0
    maturity += 14.0 if rank_ok else 6.0
    maturity += 12.0 if hgb_ok else 5.0
    maturity += 14.0 * met["fill"]
    maturity += 10.0 * met["cohesion"]
    maturity += 8.0 * met["stability"]
    maturity += 8.0 * ((sil + 1) / 2 if sil is not None else 0.45)
    maturity += 6.0 if geo_mode == "geo_nn" else 2.0
    maturity += 4.0 if winner.get("swaps") else 1.0
    maturity += 3.0 if beam_used else 0.0
    maturity += 2.0 if r2_kind == "oof" else 0.0
    maturity += 4.0 if stack3d else 0.0
    maturity = int(max(58, min(96, round(maturity))))

    radar = {
        "fill": int(round(met["fill"] * 100)),
        "balance": int(round(met["balance"] * 100)),
        "cohesion": int(round(met["cohesion"] * 100)),
        "stability": int(round(met["stability"] * 100)),
    }

    pareto = set()
    for p in POLICIES:
        mp = plans[p]["metrics"]
        dominated = False
        for q in POLICIES:
            if q == p:
                continue
            mq = plans[q]["metrics"]
            ge = (
                mq["fill"] >= mp["fill"] - 1e-9
                and mq["cohesion"] >= mp["cohesion"] - 1e-9
                and mq["stability"] >= mp["stability"] - 1e-9
            )
            gt = (
                mq["fill"] > mp["fill"] + 1e-9
                or mq["cohesion"] > mp["cohesion"] + 1e-9
                or mq["stability"] > mp["stability"] + 1e-9
            )
            if ge and gt:
                dominated = True
                break
        if not dominated:
            pareto.add(p)

    policy_board = [
        {
            "id": p,
            "label": POLICY_FR[p],
            "score": round(plans[p]["metrics"]["score"], 3),
            "fill": round(plans[p]["metrics"]["fill"], 3),
            "cohesion": round(plans[p]["metrics"]["cohesion"], 3),
            "stability": round(plans[p]["metrics"]["stability"], 3),
            "winner": p == best_policy,
            "predicted": p == predicted,
            "pareto": p in pareto,
        }
        for p in POLICIES
    ]

    charges, w, v, constraints = _guard_load(charges, dest_ix, cap_w, cap_v)

    stops = []
    prev_xy = None
    depot = payload.get("depot") or {}
    if geo_mode == "geo_nn" and depot.get("latitude") is not None:
        prev_xy = (_f(depot.get("latitude")), _f(depot.get("longitude")))
    for dest, idx in sorted(dest_ix.items(), key=lambda kv: kv[1]):
        qty = sum(x["quantiteChargee"] for x in charges if x["destination"] == dest)
        if qty <= 0:
            continue
        meta = dest_meta.get(dest) or {}
        km_from = None
        if prev_xy and meta.get("lat") is not None:
            km_from = round(_haversine_km(prev_xy, (meta["lat"], meta["lng"])), 1)
            prev_xy = (meta["lat"], meta["lng"])
        stops.append(
            {
                "destination": dest,
                "stopIndex": idx + 1,
                "unloadOrder": idx + 1,
                "quantite": qty,
                "lat": meta.get("lat"),
                "lng": meta.get("lng"),
                "kmFromPrev": km_from,
            }
        )

    cargo_bay = {"BOTTOM": [], "MID": [], "TOP": []}
    for row in charges:
        cargo_bay.get(row["layer"], cargo_bay["MID"]).append(
            {
                "code": row["code"],
                "qty": row["quantiteChargee"],
                "destination": row["destination"],
                "fragile": row["fragile"],
            }
        )

    confidence = int(round(100 * (0.45 * met["score"] + 0.25 * (acc or 0.55) + 0.30 * met["fill"])))
    confidence = max(48, min(94, confidence))

    rank_ix = np.argsort(-utilities)[: min(8, len(utilities))]
    utility_rank = [
        {
            "rank": int(r + 1),
            "code": articles[int(i)]["code"],
            "libelle": articles[int(i)]["libelle"],
            "score": round(float(utilities[int(i)]), 3),
            "layer": LAYERS[int(labels[int(i)])] if int(i) < len(labels) else "MID",
            "destination": articles[int(i)]["destination"],
        }
        for r, i in enumerate(rank_ix)
    ]

    return {
        "vehicule": nom,
        "poidsUtilise": round(w, 2),
        "poidsCapacite": cap_w,
        "pctPoids": round((w / cap_w) * 100, 1) if cap_w else 0,
        "volumeUtilise": round(v, 3),
        "volumeCapacite": cap_v,
        "pctVolume": round((v / cap_v) * 100, 1) if cap_v else 0,
        "articlesCharges": charges,
        "articlesNonCharges": rejected_out,
        "chargementComplet": len(rejected_out) == 0,
        "constraints": constraints,
        "modele": "hac_hgb_rank_tsp" if hac_ok else "percentile_hgb_rank",
        "hacMode": hac_mode,
        "hacLinkage": "ward" if hac_ok else None,
        "hacK": hac_meta.get("k"),
        "kScan": hac_meta.get("kScan") or [],
        "dendrogram": hac_meta.get("leaves") or [],
        "rankMode": rank_status,
        "hgbR2": round(hgb_r2, 3) if hgb_r2 is not None else None,
        "r2Kind": r2_kind,
        "featureImportance": feature_importance,
        "beamUsed": beam_used,
        "stack3d": stack3d,
        "bay": bay,
        "placements": [
            {
                "code": r["code"],
                "qty": r["quantiteChargee"],
                "layer": r["layer"],
                "destination": r["destination"],
                "fragile": r["fragile"],
                "x": r.get("x"),
                "z": r.get("z"),
                "dx": r.get("dx"),
                "dz": r.get("dz"),
            }
            for r in charges
            if r.get("dx") is not None
        ],
        "utilityRank": utility_rank,
        "policy": best_policy,
        "policyLabel": POLICY_FR[best_policy],
        "predictedPolicy": predicted,
        "policyBoard": policy_board,
        "policyPosterior": posterior_policy,
        "hgbAccuracy": round(acc, 3) if acc is not None else None,
        "census": census,
        "layers": [
            {"id": "BOTTOM", "label": LAYER_FR["BOTTOM"], "n": census["BOTTOM"]},
            {"id": "MID", "label": LAYER_FR["MID"], "n": census["MID"]},
            {"id": "TOP", "label": LAYER_FR["TOP"], "n": census["TOP"]},
        ],
        "stops": stops,
        "cargoBay": cargo_bay,
        "axle": axle,
        "geoMode": geo_mode,
        "tourKm": tour_km,
        "radar": radar,
        "quality": {
            "score": round(met["score"], 3),
            "fill": round(met["fill"], 3),
            "cohesion": round(met["cohesion"], 3),
            "stability": round(met["stability"], 3),
            "balance": round(met["balance"], 3),
            "silhouette": round(sil, 3) if sil is not None else None,
            "maturity": maturity,
            "sampleSize": census["n"],
            "geo": geo_mode == "geo_nn",
            "swaps": int(winner.get("swaps") or 0),
            "hgbR2": round(hgb_r2, 3) if hgb_r2 is not None else None,
            "r2Kind": r2_kind,
            "hacK": hac_meta.get("k"),
            "beam": beam_used,
            "stack3d": stack3d,
        },
        "pipeline": pipeline,
        "story": story,
        "confidence": confidence,
        "methodology": (
            "HAC Ward (k silhouette) + HGB utilité (R² hors-fold) + Pareto + lookahead "
            "+ soute 3D (CoG) + tournée GPS (NN + 2-opt/3-opt) + LIFO"
            if hac_ok
            else "Couches percentiles + utilité heuristique + portefeuille + LIFO destinations"
        ),
        "methodologyLabel": (
            "HAC + HGB OOF + soute 3D + Pareto GPS"
            if hac_ok
            else "Couches percentiles + utilité + LIFO"
        ),
    }
