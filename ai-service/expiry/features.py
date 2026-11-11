"""Une seule définition des variables : entraînement et service partagent ces formules."""
from __future__ import annotations

import numpy as np

from .simulator import SEQ_LEN

BASE_NAMES = ["jours_restants", "duree_vie", "age", "pct_vie", "q_restante", "q_initiale", "pct_consomme",
              "q_devant", "prix", "valeur", "vitesse_7", "vitesse_28", "vitesse_30", "tendance", "cv_demande",
              "jours_sans_vente", "strat_fefo", "strat_fifo", "strat_std", "dow_sin", "dow_cos"]
ENG_NAMES = ["base_frac", "ratio_v30", "ratio_v7", "ratio_v28", "log_q", "couverture_j"]
ALL_NAMES = BASE_NAMES + ENG_NAMES


def engineer(X, names=BASE_NAMES):
    g = lambda k: X[:, names.index(k)]
    q, j, qd = g("q_restante"), g("jours_restants"), g("q_devant")
    v30, v7, v28 = g("vitesse_30"), g("vitesse_7"), g("vitesse_28")
    base_qty = np.maximum(0.0, q - v30 * j)                    # formule physique actuelle
    base_frac = np.clip(base_qty / np.maximum(q, 1e-6), 0, 1)
    ratio = lambda v: np.clip((v * j + qd) / np.maximum(q, 1e-6), 0, 20)
    F = np.column_stack([X, base_frac, ratio(v30), ratio(v7), ratio(v28), np.log1p(q), q / (v30 + 1e-3)])
    return F, base_frac


def lot_to_row(lot: dict) -> tuple[list[float], np.ndarray]:
    """Payload Node -> (21 variables de base, séquence 28 j). Mêmes formules que le simulateur."""
    s = np.asarray(lot.get("ventes_28j") or [], float)
    s = np.pad(s[-SEQ_LEN:], (max(0, SEQ_LEN - len(s)), 0))
    j = float(lot.get("jours_restants") or 0)
    q = float(lot.get("quantite_restante") or 0)
    q0 = max(float(lot.get("quantite_initiale") or q), q, 1e-6)
    age = float(lot.get("age") or 0)
    shelf = float(lot.get("duree_vie") or (age + j) or 1)
    strat = str(lot.get("strategie_sortie") or "FIFO").upper()
    v30 = float(lot["ventes_30j"]) / 30 if lot.get("ventes_30j") is not None else float(s.mean())
    dow = int(lot.get("dow") or 0)
    row = [j, shelf, age, age / shelf, q, q0, 1 - q / q0, float(lot.get("q_devant") or 0),
           float(lot.get("prix_unitaire") or 0), q * float(lot.get("prix_unitaire") or 0),
           float(s[-7:].mean()), float(s.mean()), v30, float(s[-7:].mean() - s[:7].mean()),
           float(s.std() / (s.mean() + 1e-6)),
           float(len(s) - 1 - np.nonzero(s)[0].max()) if s.any() else float(SEQ_LEN),
           float(strat == "FEFO"), float(strat == "FIFO"), float(strat == "STANDARD"),
           float(np.sin(2 * np.pi * dow / 7)), float(np.cos(2 * np.pi * dow / 7))]
    return row, s
