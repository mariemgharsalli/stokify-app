"""Facteurs par lot : occlusion par groupes de variables."""
from __future__ import annotations

import numpy as np

from .features import ALL_NAMES

GROUPS = [
    ("couverture", "Couverture (vitesse × jours)",
     ["ratio_v30", "ratio_v7", "ratio_v28", "couverture_j", "base_frac", "vitesse_7", "vitesse_28", "vitesse_30"]),
    ("devant", "Stock devant (FEFO/FIFO)", ["q_devant"]),
    ("tendance", "Tendance de la demande", ["tendance", "cv_demande", "jours_sans_vente"]),
    ("saison", "Saisonnalité hebdo", ["dow_sin", "dow_cos"]),
    ("prix", "Prix et valeur", ["prix", "valeur"]),
    ("age", "Âge du lot", ["age", "pct_vie", "pct_consomme", "duree_vie"]),
    ("strategie", "Stratégie de sortie", ["strat_fefo", "strat_fifo", "strat_std"]),
]


def explain_batch(predict_p, F, base, medians, names=None):
    """Top 3 impacts signés (points de probabilité). + augmente le risque."""
    names = list(names or ALL_NAMES)
    F = np.asarray(F, float)
    base = np.asarray(base, float)
    med = np.asarray(medians, float)
    p0 = np.asarray(predict_p(F, base), float)
    scored = []
    for key, label, cols in GROUPS:
        idx = [names.index(c) for c in cols if c in names]
        if not idx:
            continue
        occ = F.copy()
        for j in idx:
            occ[:, j] = med[j]
        base_occ = base.copy()
        if "base_frac" in cols and "base_frac" in names:
            base_occ = np.full(base.shape, float(med[names.index("base_frac")]))
        p1 = np.asarray(predict_p(occ, base_occ), float)
        scored.append((key, label, p0 - p1))
    out = []
    n = len(p0)
    for i in range(n):
        ranked = sorted(scored, key=lambda t: abs(float(t[2][i])), reverse=True)[:3]
        out.append([
            {"key": key, "label": label, "impact": float(np.round(float(delta[i]), 4))}
            for key, label, delta in ranked
        ])
    return out
