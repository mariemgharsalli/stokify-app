"""
Slotting ML — GMM (classes A/B/C latentes) + HGB (demande 90 j) + affinité de co-picking.

Ce n'est pas un ABC à seuils fixes : les classes viennent des posterior
GaussianMixture sur (rotation, cube-velocity, dollar-velocity, récence).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np

try:
    from sklearn.mixture import GaussianMixture
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.metrics import silhouette_score
except Exception:  # pragma: no cover
    GaussianMixture = None  # type: ignore
    StandardScaler = None  # type: ignore
    HistGradientBoostingRegressor = None  # type: ignore
    silhouette_score = None  # type: ignore

MOIS_ZONE = {
    "A": "Zone picking (près du quai)",
    "B": "Zone mixte",
    "C": "Zone réserve (fond)",
}


def _as_float(v: Any, default: float = 0.0) -> float:
    try:
        x = float(v)
        if np.isnan(x) or np.isinf(x):
            return default
        return x
    except (TypeError, ValueError):
        return default


def _build_article_matrix(articles: List[dict]) -> Tuple[np.ndarray, List[int]]:
    ids: List[int] = []
    rows: List[List[float]] = []
    for a in articles:
        aid = int(a.get("articleId") or 0)
        rot30 = max(0.0, _as_float(a.get("rotation30")))
        rot90 = max(0.0, _as_float(a.get("rotation90")))
        volume = max(0.0, _as_float(a.get("volume")))
        prix = max(0.0, _as_float(a.get("prixVente")))
        days = a.get("daysSinceLastMove")
        recency = 1.0 / (1.0 + _as_float(days, 90.0) / 30.0)
        # 1 rotation, 2 cube-velocity, 3 dollar-velocity, 4 rot90, 5 recency
        rows.append(
            [
                np.log1p(rot30),
                np.log1p(rot30 * max(volume, 0.01)),
                np.log1p(rot30 * max(prix, 0.01)),
                np.log1p(rot90),
                recency,
            ]
        )
        ids.append(aid)
    return np.asarray(rows, dtype=float), ids


def _percentile_abc(velocity: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """ABC classique 20 / 30 / 50 % des SKU, triés par vélocité."""
    n = len(velocity)
    labels = np.full(n, 2, dtype=int)  # C
    proba = np.zeros((n, 3), dtype=float)
    if n == 0:
        return labels, proba
    order = np.argsort(-velocity)
    n_a = max(1, int(round(n * 0.20))) if n >= 5 else (1 if n >= 2 else n)
    n_b = max(0, int(round(n * 0.30))) if n >= 5 else (1 if n >= 3 else 0)
    for rank, idx in enumerate(order):
        if rank < n_a:
            labels[idx] = 0
            proba[idx] = [0.72, 0.20, 0.08]
        elif rank < n_a + n_b:
            labels[idx] = 1
            proba[idx] = [0.18, 0.64, 0.18]
        else:
            labels[idx] = 2
            proba[idx] = [0.08, 0.22, 0.70]
    return labels, proba


def _silhouette_proxy(X: np.ndarray, labels: np.ndarray) -> Optional[float]:
    """Silhouette moyenne (sklearn si dispo, sinon proxy euclidien)."""
    n = X.shape[0]
    if n < 8:
        return None
    uniq = np.unique(labels)
    if len(uniq) < 2:
        return None
    std = X.std(axis=0)
    std = np.where(std < 1e-9, 1.0, std)
    Xs = (X - X.mean(axis=0)) / std
    if silhouette_score is not None:
        try:
            return float(max(-1.0, min(1.0, silhouette_score(Xs, labels))))
        except Exception:
            pass
    scores: List[float] = []
    for i in range(n):
        same = Xs[labels == labels[i]]
        if len(same) < 2:
            continue
        a = float(np.mean(np.linalg.norm(same - Xs[i], axis=1)))
        b = float("inf")
        for k in uniq:
            if k == labels[i]:
                continue
            other = Xs[labels == k]
            if len(other) == 0:
                continue
            b = min(b, float(np.mean(np.linalg.norm(other - Xs[i], axis=1))))
        if not np.isfinite(b):
            continue
        scores.append((b - a) / max(a, b, 1e-9))
    if not scores:
        return None
    return float(max(-1.0, min(1.0, float(np.mean(scores)))))


def _posterior_entropy(posterior: Dict[str, float]) -> float:
    """Entropie normalisée 0–1 (0 = certitude totale sur une classe)."""
    vals = np.array(
        [max(1e-9, float(posterior.get(k, 0.0))) for k in ("A", "B", "C")],
        dtype=float,
    )
    vals = vals / vals.sum()
    return float(-np.sum(vals * np.log(vals)) / np.log(3.0))


def _fit_gmm(X: np.ndarray) -> Tuple[np.ndarray, np.ndarray, str, Optional[float]]:
    """Retourne labels 0/1/2 (pas encore A/B/C), proba (n,3), modele, bic."""
    n = X.shape[0]
    velocity = X[:, 0]
    if GaussianMixture is None or StandardScaler is None or n < 8:
        labels, proba = _percentile_abc(velocity)
        return labels, proba, "percentile_abc", None

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    cov = "full" if n >= 24 else "diag"
    try:
        gmm = GaussianMixture(
            n_components=3,
            covariance_type=cov,
            random_state=42,
            n_init=4,
            max_iter=180,
            reg_covar=1e-4,
        )
        gmm.fit(Xs)
        raw_labels = gmm.predict(Xs)
        raw_proba = gmm.predict_proba(Xs)
        bic = float(gmm.bic(Xs))
        # Map cluster → 0=A, 1=B, 2=C by mean velocity (col 0)
        means = []
        for k in range(3):
            mask = raw_labels == k
            means.append(float(np.mean(X[mask, 0])) if np.any(mask) else -1e9)
        order = np.argsort(-np.asarray(means))  # high velocity first
        remap = {int(order[0]): 0, int(order[1]): 1, int(order[2]): 2}
        labels = np.array([remap[int(k)] for k in raw_labels], dtype=int)
        proba = np.zeros_like(raw_proba)
        for src, dst in remap.items():
            proba[:, dst] = raw_proba[:, src]
        return labels, proba, "gmm_3class", bic
    except Exception:
        labels, proba = _percentile_abc(velocity)
        return labels, proba, "percentile_abc", None


def _predict_demand(articles: List[dict], ids: List[int], target_id: int) -> Dict[str, Any]:
    """HGB : rotation30 + volume/poids/prix → rotation90, LOO sur l'article cible."""
    empty = {"used": False, "predicted90": None, "r2": None}
    if HistGradientBoostingRegressor is None or len(articles) < 8:
        return empty
    by_id = {int(a.get("articleId") or 0): a for a in articles}
    X_all = []
    y_all = []
    id_all = []
    for aid in ids:
        a = by_id.get(aid)
        if not a:
            continue
        X_all.append(
            [
                np.log1p(max(0.0, _as_float(a.get("rotation30")))),
                max(0.0, _as_float(a.get("volume"))),
                max(0.0, _as_float(a.get("poids"))),
                max(0.0, _as_float(a.get("prixVente"))),
                1.0 if a.get("fragile") else 0.0,
            ]
        )
        y_all.append(max(0.0, _as_float(a.get("rotation90"))))
        id_all.append(aid)
    X_all = np.asarray(X_all, dtype=float)
    y_all = np.asarray(y_all, dtype=float)
    if len(y_all) < 8:
        return empty
    mask = np.array([i != target_id for i in id_all])
    if int(mask.sum()) < 6:
        return empty
    try:
        model = HistGradientBoostingRegressor(
            max_depth=3,
            max_iter=80,
            learning_rate=0.08,
            min_samples_leaf=2,
            random_state=42,
        )
        model.fit(X_all[mask], y_all[mask])
        r2 = float(model.score(X_all[mask], y_all[mask]))
        if r2 < 0.05:
            return {**empty, "r2": round(r2, 3)}
        t_idx = next((i for i, aid in enumerate(id_all) if aid == target_id), None)
        if t_idx is None:
            return {**empty, "r2": round(r2, 3)}
        pred = float(max(0.0, model.predict(X_all[t_idx : t_idx + 1])[0]))
        return {"used": True, "predicted90": round(pred, 2), "r2": round(r2, 3)}
    except Exception:
        return empty


def _affinity_map(cooccurrence: List[dict], target_id: int) -> Dict[int, int]:
    out: Dict[int, int] = {}
    for row in cooccurrence or []:
        a = int(row.get("a") or 0)
        b = int(row.get("b") or 0)
        c = int(row.get("count") or 0)
        if c <= 0:
            continue
        if a == target_id and b != target_id:
            out[b] = out.get(b, 0) + c
        elif b == target_id and a != target_id:
            out[a] = out.get(a, 0) + c
    return out


def _slot_affinity(
    candidate: dict,
    occupants: List[dict],
    aff: Dict[int, int],
    max_aff: float,
) -> float:
    if max_aff <= 0:
        return 0.0
    dist = _as_float(candidate.get("distanceQuai"), 50.0)
    total = 0.0
    for occ in occupants:
        od = _as_float(occ.get("distanceQuai"), 50.0)
        if abs(od - dist) > 14:
            continue
        oid = int(occ.get("articleId") or 0)
        total += aff.get(oid, 0)
    return float(min(1.0, total / max_aff))


def _reasons(
    abc: str,
    zone_key: str,
    proximity: float,
    capacity: float,
    affinity: float,
    gmm_mode: str,
) -> List[str]:
    reasons: List[str] = []
    if gmm_mode.startswith("gmm"):
        reasons.append(f"Classe {abc} issue du GMM (mélange gaussien 3 composantes)")
    else:
        reasons.append(f"Classe {abc} par percentiles ABC (historique insuffisant pour GMM)")
    if zone_key == abc:
        reasons.append(f"Zone {zone_key} alignée avec la classe {abc}")
    else:
        reasons.append(f"Compromis zone {zone_key} / classe {abc} (posteriors GMM)")
    if proximity >= 0.75:
        reasons.append("Distance au quai proche de la vélocité prédite")
    if affinity >= 0.35:
        reasons.append("Voisins fréquemment co-pickés (affinité ventes)")
    if capacity >= 0.7:
        reasons.append("Capacité résiduelle confortable")
    elif capacity <= 0.25:
        reasons.append("Occupation élevée — à surveiller")
    return reasons[:4]


def _explication(
    abc: str,
    posterior: Dict[str, float],
    rot30: float,
    demand: Dict[str, Any],
    neighbors: List[dict],
    best: Optional[dict],
    current_code: Optional[str],
    modele: str,
) -> str:
    pa, pb, pc = posterior.get("A", 0), posterior.get("B", 0), posterior.get("C", 0)
    gmm = (
        f"Le GMM place cet article en classe {abc} "
        f"(P(A)={pa:.0%} · P(B)={pb:.0%} · P(C)={pc:.0%})"
        if modele.startswith("gmm")
        else f"Classement percentile ABC → classe {abc} (échantillon trop petit pour un GMM stable)"
    )
    dem = ""
    if demand.get("used") and demand.get("predicted90") is not None:
        dem = (
            f" Le modèle de demande (HistGradientBoosting, R²={demand.get('r2')}) "
            f"estime {demand['predicted90']} mouvements / 90 j "
            f"(observé 30 j : {int(rot30)})."
        )
    aff = ""
    if neighbors:
        names = ", ".join(
            str(n.get("code") or n.get("articleId")) for n in neighbors[:3]
        )
        aff = f" Affinité de picking avec {names}."
    if not best:
        return f"{gmm}{dem} Aucun emplacement compatible disponible."
    already = current_code and str(current_code).upper() == str(best.get("code") or "").upper()
    if already:
        return (
            f"{gmm}{dem}{aff} L'article est déjà sur {best.get('code')} "
            f"({MOIS_ZONE.get(best.get('zoneKey') or '', 'zone')}). Position optimale selon le slotting ML."
        )
    from_txt = f" Depuis {current_code} →" if current_code else ""
    return (
        f"{gmm}{dem}{aff}{from_txt} emplacement recommandé {best.get('code')} "
        f"(d={int(_as_float(best.get('distanceQuai')))}/100, {MOIS_ZONE.get(best.get('zoneKey') or '', 'zone')})."
    )


def _studio_pack(
    labels,
    proba,
    gmm_mode,
    bic,
    demand,
    neighbors,
    weights,
    abc,
    posterior,
    rot30,
    best,
    current_code,
    X=None,
):
    census = {
        "A": int(np.sum(labels == 0)),
        "B": int(np.sum(labels == 1)),
        "C": int(np.sum(labels == 2)),
        "n": int(len(labels)),
    }
    sep = float(np.mean(np.max(proba, axis=1))) if proba is not None and getattr(proba, "size", 0) else 0.0
    sil = _silhouette_proxy(X, labels) if X is not None and getattr(X, "size", 0) else None
    entropy = _posterior_entropy(posterior)
    certainty = float(max(0.0, min(1.0, 1.0 - entropy)))
    gmm_ok = str(gmm_mode).startswith("gmm")
    w_prox, w_zone, w_cap, w_aff = weights
    pipeline = [
        {
            "id": "gmm",
            "label": "Mélange gaussien",
            "status": "ok" if gmm_ok else "fallback",
            "detail": (
                f"{census['n']} SKU · BIC {bic:.0f}"
                + (f" · sil {sil:.2f}" if sil is not None else "")
                if bic is not None
                else f"{census['n']} SKU · percentiles 20/30/50"
            ),
        },
        {
            "id": "hgb",
            "label": "Demande HGB",
            "status": "ok" if demand.get("used") else "skip",
            "detail": (
                f"R² {demand.get('r2')} · {demand.get('predicted90')} mvt / 90 j"
                if demand.get("used")
                else "Pas assez de signal — rotation observée conservée"
            ),
        },
        {
            "id": "affinity",
            "label": "Co-picking",
            "status": "ok" if neighbors else "skip",
            "detail": (
                f"{len(neighbors)} voisin(s) fréquent(s) dans les ventes"
                if neighbors
                else "Aucune paire de co-achat sur 90 j"
            ),
        },
    ]
    pa = posterior.get(abc, 0)
    story = [
        f"Catalogue : {census['n']} SKU → {census['A']} A · {census['B']} B · {census['C']} C.",
        f"Cet article est classe {abc} (P={pa:.0%} · certitude {certainty:.0%}) avec {int(rot30)} mvt / 30 j.",
    ]
    if sil is not None:
        story.append(f"Silhouette des clusters : {sil:.2f} (qualité de séparation GMM).")
    if demand.get("used"):
        story.append(
            f"Le HGB projette {demand.get('predicted90')} mouvements / 90 j (R² {demand.get('r2')})."
        )
    if neighbors:
        names = ", ".join(str(n.get("code") or n.get("articleId")) for n in neighbors[:3])
        story.append(f"Souvent pické avec {names}.")
    if best:
        dest = f"{best.get('code')} (d={int(_as_float(best.get('distanceQuai')))}/100)"
        story.append(
            f"Recommandation : {current_code} → {dest}."
            if current_code
            else f"Emplacement cible : {dest}."
        )
        bd = best.get("scoreBreakdown") or {}
        if bd:
            story.append(
                f"Radar 1er choix — distance {bd.get('proximity', 0)} · "
                f"zone {bd.get('zoneAlignment', 0)} · "
                f"capacité {bd.get('capacity', 0)} · "
                f"affinité {bd.get('affinity', 0)}."
            )

    maturity = 0.0
    maturity += 42.0 if gmm_ok else 24.0
    maturity += 18.0 * sep
    maturity += 14.0 * ((sil + 1) / 2 if sil is not None else 0.45)
    maturity += 14.0 if demand.get("used") else 5.0
    maturity += 12.0 if neighbors else 4.0
    maturity = int(max(55, min(96, round(maturity))))

    radar = None
    if best and best.get("scoreBreakdown"):
        bd = best["scoreBreakdown"]
        radar = {
            "proximity": int(bd.get("proximity") or 0),
            "zone": int(bd.get("zoneAlignment") or 0),
            "capacity": int(bd.get("capacity") or 0),
            "affinity": int(bd.get("affinity") or 0),
        }

    return {
        "census": census,
        "quality": {
            "separation": round(sep, 3),
            "silhouette": round(sil, 3) if sil is not None else None,
            "certainty": round(certainty, 3),
            "entropy": round(entropy, 3),
            "sampleSize": census["n"],
            "affinityNeighbors": len(neighbors or []),
            "maturity": maturity,
        },
        "pipeline": pipeline,
        "story": story,
        "radar": radar,
        "weights": {
            "proximity": int(round(w_prox * 100)),
            "zone": int(round(w_zone * 100)),
            "capacity": int(round(w_cap * 100)),
            "affinity": int(round(w_aff * 100)),
        },
    }


def run_slotting(payload: dict, *, _cls: Optional[dict] = None) -> dict:
    articles: List[dict] = list(payload.get("articles") or [])
    candidates: List[dict] = list(payload.get("candidates") or [])
    occupants: List[dict] = list(payload.get("occupants") or [])
    cooccurrence: List[dict] = list(payload.get("cooccurrence") or [])
    article_id = int(payload.get("articleId") or payload.get("article_id") or 0)
    current_id = payload.get("currentEmplacementId")
    current_code = payload.get("currentEmplacementCode")

    by_id = {int(a.get("articleId") or 0): a for a in articles}
    target = by_id.get(article_id) or {}
    rot30 = max(0.0, _as_float(target.get("rotation30")))

    if _cls is None:
        X, ids = _build_article_matrix(articles) if articles else (np.zeros((0, 5)), [])
        if X.shape[0] == 0:
            X = np.zeros((1, 5))
            ids = [article_id]
        labels, proba, gmm_mode, bic = _fit_gmm(X)
    else:
        X, ids = _cls["X"], _cls["ids"]
        labels, proba, gmm_mode, bic = _cls["labels"], _cls["proba"], _cls["gmm_mode"], _cls["bic"]
    class_letter = {0: "A", 1: "B", 2: "C"}
    idx = ids.index(article_id) if article_id in ids else 0
    abc = class_letter[int(labels[idx])]
    posterior = {
        "A": round(float(proba[idx, 0]), 3),
        "B": round(float(proba[idx, 1]), 3),
        "C": round(float(proba[idx, 2]), 3),
    }

    demand = _predict_demand(articles, ids, article_id)
    vel_raw = rot30
    if demand.get("used") and demand.get("predicted90") is not None:
        vel_raw = 0.45 * rot30 + 0.55 * (float(demand["predicted90"]) / 3.0)
    vel_all = np.array([max(0.0, _as_float(by_id.get(i, {}).get("rotation30"))) for i in ids], dtype=float)
    vmax = float(np.max(vel_all)) if len(vel_all) else 1.0
    velocity_norm = float(min(1.0, vel_raw / max(vmax, 1.0)))

    aff = _affinity_map(cooccurrence, article_id)
    max_aff = float(max(aff.values())) if aff else 0.0
    neighbor_ids = sorted(aff.items(), key=lambda kv: -kv[1])[:3]
    neighbors = []
    for nid, cnt in neighbor_ids:
        art = by_id.get(nid) or {}
        neighbors.append(
            {
                "articleId": nid,
                "code": art.get("code") or "",
                "libelle": art.get("libelle") or "",
                "count": int(cnt),
                "imageUrl": art.get("imageUrl") or None,
            }
        )

    has_aff = max_aff > 0
    w_prox, w_zone, w_cap, w_aff = (0.36, 0.22, 0.22, 0.20) if has_aff else (0.46, 0.27, 0.27, 0.0)

    scored: List[dict] = []
    for slot in candidates:
        dist = _as_float(slot.get("distanceQuai"), 50.0)
        dist_n = max(0.0, min(1.0, dist / 100.0))
        proximity = 1.0 - abs(dist_n - (1.0 - velocity_norm))
        raw_occ = _as_float(slot.get("occupationRatio"))
        occ = raw_occ / 100.0 if raw_occ > 1.0 else max(0.0, min(1.0, raw_occ))
        capacity = 1.0 - occ
        zone_key = str(slot.get("zoneKey") or "B")
        zone_fit = (
            posterior["A"] * (1.0 if zone_key == "A" else 0.28)
            + posterior["B"] * (1.0 if zone_key == "B" else 0.50)
            + posterior["C"] * (1.0 if zone_key == "C" else 0.28)
        )
        affinity = _slot_affinity(slot, occupants, aff, max_aff) if has_aff else 0.0
        score = proximity * w_prox + zone_fit * w_zone + capacity * w_cap + affinity * w_aff
        score_100 = int(round(max(0.0, min(1.0, score)) * 100))
        scored.append(
            {
                "emplacementId": int(slot.get("emplacementId") or 0),
                "code": slot.get("code") or "",
                "libelle": slot.get("libelle") or "",
                "distanceQuai": int(round(dist)),
                "occupationRatio": int(round(occ * 100)),
                "zoneKey": zone_key,
                "score": score_100,
                "affinityScore": int(round(affinity * 100)),
                "scoreBreakdown": {
                    "proximity": int(round(proximity * 100)),
                    "capacity": int(round(capacity * 100)),
                    "zoneAlignment": int(round(zone_fit * 100)),
                    "affinity": int(round(affinity * 100)),
                },
                "reasons": _reasons(abc, zone_key, proximity, capacity, affinity, gmm_mode),
            }
        )

    scored.sort(key=lambda s: (-s["score"], s["distanceQuai"]))
    best = scored[0] if scored else None

    gmm_conf = int(round(max(posterior.values()) * 100))
    hgb_conf = int(round(max(0.0, min(1.0, float(demand["r2"]))) * 100)) if demand.get("r2") is not None else 52
    aff_conf = 74 if neighbors else 50
    confidence = int(round(0.50 * gmm_conf + 0.30 * hgb_conf + 0.20 * aff_conf))
    confidence = max(40, min(94, confidence))

    rotation_label = {"A": "Fort", "B": "Moyen", "C": "Faible"}[abc]
    modele = "gmm_hgb_affinity" if gmm_mode.startswith("gmm") else "percentile_hgb_affinity"
    if not demand.get("used"):
        modele = "gmm_affinity" if gmm_mode.startswith("gmm") else "percentile_affinity"

    methodology = (
        "GMM 3 composantes (rotation × cube-velocity × dollar-velocity × récence) "
        "+ HistGradientBoosting (demande 90 j, LOO) "
        "+ affinité de co-picking sur ventes confirmées"
        if gmm_mode.startswith("gmm")
        else "Percentiles ABC 20/30/50 (échantillon < 5 SKU pour un GMM stable) "
        "+ affinité de co-picking"
    )

    studio = _studio_pack(
        labels,
        proba,
        gmm_mode,
        bic,
        demand,
        neighbors,
        (w_prox, w_zone, w_cap, w_aff),
        abc,
        posterior,
        rot30,
        best,
        current_code,
        X=X,
    )

    return {
        "articleId": article_id,
        "abcClass": abc,
        "rotationLabel": rotation_label,
        "rotationScore": int(round(rot30)),
        "velocityNorm": round(velocity_norm, 3),
        "idealDistance": int(round((1.0 - velocity_norm) * 100)),
        "posterior": posterior,
        "confidence": confidence,
        "modele": modele,
        "gmmMode": gmm_mode,
        "gmmBic": round(bic, 1) if bic is not None else None,
        "demand": demand,
        "affinityNeighbors": neighbors,
        "scored": scored,
        "methodology": methodology,
        "explication": _explication(
            abc, posterior, rot30, demand, neighbors, best, current_code, gmm_mode
        ),
        "currentEmplacementId": current_id,
        "fallbackReason": (
            "Moins de 8 articles : classes ABC par percentiles"
            if len(articles) < 8 or not str(gmm_mode).startswith("gmm")
            else None
        ),
        **studio,
    }


def _audit_rules(
    gmm_mode: str,
    pipeline: Optional[List[dict]],
    weights: Optional[dict],
) -> List[dict]:
    """Règles métier exposées à l'audit dépôt (GMM + HGB + affinité + zone)."""
    by_id = {str(s.get("id")): s for s in (pipeline or [])}
    gmm = by_id.get("gmm") or {}
    hgb = by_id.get("hgb") or {}
    aff = by_id.get("affinity") or {}
    w = weights or {}
    score_txt = (
        f"Score = {w.get('proximity', 36)}% distance + {w.get('zone', 22)}% zone "
        f"+ {w.get('capacity', 22)}% capacité + {w.get('affinity', 20)}% affinité"
        if w
        else "Score = distance × zone × capacité × affinité"
    )
    gmm_ok = str(gmm_mode).startswith("gmm")
    return [
        {
            "id": "gmm",
            "title": "Mélange gaussien 3 classes",
            "model": "GaussianMixture",
            "status": gmm.get("status") or ("ok" if gmm_ok else "fallback"),
            "rule": (
                "A/B/C latentes apprises sur rotation, cube-velocity, dollar-velocity "
                "et récence — pas des seuils 33/67."
            ),
            "detail": gmm.get("detail") or "",
        },
        {
            "id": "hgb",
            "title": "Demande 90 jours",
            "model": "HistGradientBoosting",
            "status": hgb.get("status") or "skip",
            "rule": (
                "Le HGB (leave-one-out) projette la rotation 90 j pour caler "
                "la distance cible au quai."
            ),
            "detail": hgb.get("detail") or "",
        },
        {
            "id": "affinity",
            "title": "Affinité de co-picking",
            "model": "co-occurrence",
            "status": aff.get("status") or "skip",
            "rule": (
                "Les SKU vendus ensemble sur 90 j gagnent du score s'ils occupent "
                "des emplacements voisins."
            ),
            "detail": aff.get("detail") or "",
        },
        {
            "id": "zone",
            "title": "Politique de zone",
            "model": "posterior × zone",
            "status": "ok",
            "rule": (
                "Classe A → picking (d≤33), B → mixte (34–66), C → réserve (≥67). "
                "Chimie incompatible et slots pleins exclus."
            ),
            "detail": score_txt,
        },
    ]


def run_slotting_audit(payload: dict) -> dict:
    """Fit GMM once, score every placed article against eligible slots."""
    articles: List[dict] = list(payload.get("articles") or [])
    candidates: List[dict] = list(payload.get("candidates") or [])
    occupants: List[dict] = list(payload.get("occupants") or [])
    cooccurrence: List[dict] = list(payload.get("cooccurrence") or [])
    currents: List[dict] = list(payload.get("currents") or [])
    eligible_map = {
        int(row.get("articleId") or 0): [int(x) for x in (row.get("emplacementIds") or [])]
        for row in (payload.get("eligible") or [])
    }

    X, ids = _build_article_matrix(articles) if articles else (np.zeros((0, 5)), [])
    if X.shape[0] == 0:
        return {"modele": "gmm_hgb_affinity", "methodology": "", "items": []}
    labels, proba, gmm_mode, bic = _fit_gmm(X)
    cls = {"X": X, "ids": ids, "labels": labels, "proba": proba, "gmm_mode": gmm_mode, "bic": bic}

    items = []
    sample_meta = None
    for cur in currents:
        aid = int(cur.get("articleId") or 0)
        allowed = set(eligible_map.get(aid) or [c.get("emplacementId") for c in candidates])
        sub_candidates = [c for c in candidates if int(c.get("emplacementId") or 0) in allowed]
        result = run_slotting(
            {
                "articleId": aid,
                "articles": articles,
                "candidates": sub_candidates,
                "occupants": occupants,
                "cooccurrence": cooccurrence,
                "currentEmplacementId": cur.get("emplacementId"),
                "currentEmplacementCode": cur.get("code"),
            },
            _cls=cls,
        )
        if sample_meta is None:
            sample_meta = result
        scored = result.get("scored") or []
        if not scored:
            continue
        best = scored[0]
        current_eid = int(cur.get("emplacementId") or 0)
        current_match = next((s for s in scored if s["emplacementId"] == current_eid), None)
        top3 = {s["emplacementId"] for s in scored[:3]}
        if current_eid in top3:
            continue
        current_score = current_match["score"] if current_match else 0
        current_cand = next(
            (c for c in candidates if int(c.get("emplacementId") or 0) == current_eid),
            None,
        )
        current_dist = int(round(_as_float((current_cand or {}).get("distanceQuai"), 50.0)))
        current_zone_key = str((current_cand or {}).get("zoneKey") or "B")
        rec_zone_key = str(best.get("zoneKey") or "B")
        rec_bd = best.get("scoreBreakdown") or {}
        current_bd = (current_match or {}).get("scoreBreakdown")
        dem = result.get("demand") or {}
        items.append(
            {
                "articleId": aid,
                "abcClass": result["abcClass"],
                "rotationLabel": result["rotationLabel"],
                "rotationScore": result.get("rotationScore"),
                "posterior": result["posterior"],
                "currentEmplacementId": current_eid,
                "recommendedEmplacementId": best["emplacementId"],
                "currentScore": current_score,
                "recommendedScore": best["score"],
                "scoreGain": best["score"] - current_score,
                "currentDistance": current_dist,
                "recommendedDistance": best["distanceQuai"],
                "currentZoneKey": current_zone_key,
                "recommendedZoneKey": rec_zone_key,
                "mismatch": None if current_zone_key == rec_zone_key else f"{current_zone_key}→{rec_zone_key}",
                "confidence": result["confidence"],
                "reasons": (best.get("reasons") or [])[:4],
                "scoreBreakdown": rec_bd or None,
                "currentBreakdown": current_bd,
                "radar": {
                    "proximity": int(rec_bd.get("proximity") or 0),
                    "zone": int(rec_bd.get("zoneAlignment") or 0),
                    "capacity": int(rec_bd.get("capacity") or 0),
                    "affinity": int(rec_bd.get("affinity") or 0),
                }
                if rec_bd
                else None,
                "demand": {
                    "used": bool(dem.get("used")),
                    "predicted90": dem.get("predicted90"),
                    "r2": dem.get("r2"),
                },
                "affinityNeighbors": (result.get("affinityNeighbors") or [])[:2],
            }
        )

    items.sort(key=lambda x: -x["scoreGain"])
    zone_flows: Dict[str, int] = {}
    towards_dock = 0
    towards_reserve = 0
    for it in items:
        mk = it.get("mismatch")
        if mk:
            zone_flows[str(mk)] = zone_flows.get(str(mk), 0) + 1
        cd = it.get("currentDistance")
        rd = it.get("recommendedDistance")
        if cd is not None and rd is not None:
            if rd < cd:
                towards_dock += 1
            elif rd > cd:
                towards_reserve += 1

    studio = sample_meta or {}
    pipeline = studio.get("pipeline") or []
    return {
        "modele": studio.get("modele") or "gmm_hgb_affinity",
        "methodology": studio.get("methodology") or "",
        "census": studio.get("census"),
        "quality": studio.get("quality"),
        "pipeline": pipeline,
        "weights": studio.get("weights"),
        "gmmBic": studio.get("gmmBic"),
        "gmmMode": gmm_mode,
        "fallbackReason": (
            "Moins de 8 articles : classes ABC par percentiles"
            if len(articles) < 8 or not str(gmm_mode).startswith("gmm")
            else None
        ),
        "rules": _audit_rules(gmm_mode, pipeline, studio.get("weights")),
        "zoneFlows": {
            "byMismatch": zone_flows,
            "towardsDock": towards_dock,
            "towardsReserve": towards_reserve,
        },
        "placedCount": len(currents),
        "items": items,
    }
