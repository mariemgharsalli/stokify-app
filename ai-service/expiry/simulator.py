"""Simulateur de cycles de vie de lots (données d'entraînement synthétiques réalistes)."""
from __future__ import annotations
import numpy as np

SEQ_LEN = 28
STRATS = ["FIFO", "FEFO", "STANDARD"]

# Facteur de stock initial. Défaut testé : environ 38 % de lots avec perte > 5 %.
Q0_LO = 0.08
Q0_HI = 0.6


def _demand_series(rng, days, base, weekly_amp, trend, intermittent, promo_prob):
    t = np.arange(days)
    dow = (t % 7)
    weekly = 1 + weekly_amp * np.sin(2 * np.pi * dow / 7 + rng.uniform(0, 6.28))
    lam = np.maximum(base * weekly * (1 + trend * t / max(days, 1)), 0.0)
    promo = (rng.random(days) < promo_prob) * rng.uniform(1.5, 3.0, days)
    lam = lam * np.where(promo > 0, promo, 1.0)
    if intermittent:
        lam = lam * (rng.random(days) < rng.uniform(0.25, 0.6))
    k = rng.uniform(2.0, 12.0)  # sur-dispersion (binomiale négative)
    p = k / (k + np.maximum(lam, 1e-9))
    return rng.negative_binomial(k, p).astype(float)


def simulate_lot(rng):
    shelf = int(rng.choice([4, 7, 14, 30, 60, 90, 180, 365], p=[.08, .14, .18, .22, .16, .10, .07, .05]))
    base = float(np.exp(rng.normal(1.2, 1.1)))             # ventes/jour de l'article
    q0 = float(max(5, np.round(np.exp(rng.normal(np.log(base * shelf * rng.uniform(Q0_LO, Q0_HI)), 0.4)))))
    strat = str(rng.choice(STRATS, p=[.35, .45, .20]))
    price = float(np.exp(rng.normal(3.0, 0.9)))
    ahead_ratio = float(rng.choice([0, 0, rng.uniform(0.1, 1.2)]))  # stock plus ancien sortant avant
    q_ahead = q0 * ahead_ratio if strat != "STANDARD" else 0.0
    hist_days = 120
    total = hist_days + shelf
    series = _demand_series(rng, total, base, rng.uniform(0, .6), rng.uniform(-.5, .8),
                            rng.random() < .3, rng.uniform(0, .06))
    j = int(rng.integers(1, shelf + 1))        # jours restants au moment du snapshot
    age = shelf - j
    start = hist_days
    past = series[start:start + age] if age > 0 else np.array([])
    consumed = min(q0, float(past.sum()) * (1.0 if strat == "STANDARD" else 0.9))
    q_now = max(q0 - consumed, 0.0)
    hist = series[max(0, start + age - SEQ_LEN):start + age]
    hist = np.pad(hist, (SEQ_LEN - len(hist), 0))
    future = series[start + age:start + shelf]
    demand_future = float(future.sum())
    # vérité terrain : la file FEFO/FIFO sert d'abord le stock "devant" ce lot
    avail_for_lot = max(demand_future - q_ahead, 0.0) if strat != "STANDARD" else demand_future * 0.8
    sold = min(q_now, avail_for_lot)
    waste = max(q_now - sold, 0.0)
    w_frac = waste / q_now if q_now > 0 else 0.0
    v30 = float(series[start + age - 30:start + age].sum())
    feats = dict(
        jours_restants=j, duree_vie=shelf, age=age, pct_vie=age / shelf,
        q_restante=q_now, q_initiale=q0, pct_consomme=1 - q_now / q0, q_devant=q_ahead,
        prix=price, valeur=q_now * price, vitesse_7=float(hist[-7:].mean()), vitesse_28=float(hist.mean()),
        vitesse_30=v30 / 30, tendance=float(hist[-7:].mean() - hist[:7].mean()),
        cv_demande=float(hist.std() / (hist.mean() + 1e-6)),
        jours_sans_vente=float(len(hist) - 1 - np.nonzero(hist)[0].max()) if hist.any() else float(SEQ_LEN),
        strat_fefo=float(strat == "FEFO"), strat_fifo=float(strat == "FIFO"), strat_std=float(strat == "STANDARD"),
        dow_sin=float(np.sin(2 * np.pi * ((start + age) % 7) / 7)),
        dow_cos=float(np.cos(2 * np.pi * ((start + age) % 7) / 7)),
    )
    h_qty = max(0.0, q_now - feats["vitesse_30"] * j)   # heuristique actuelle (pour comparaison)
    return feats, hist, w_frac, waste, h_qty


def build_dataset(n, seed=7):
    rng = np.random.default_rng(seed)
    rows, seqs, wf, wq, hq = [], [], [], [], []
    while len(rows) < n:
        f, h, w, q, hh = simulate_lot(rng)
        if f["q_restante"] <= 0:
            continue
        rows.append(f); seqs.append(h); wf.append(w); wq.append(q); hq.append(hh)
    names = list(rows[0].keys())
    X = np.array([[r[k] for k in names] for r in rows], float)
    return names, X, np.array(seqs), np.array(wf), np.array(wq), np.array(hq)


def estimate_prevalence(n=2000, seed=11):
    """Part des lots gardés dont la fraction perdue dépasse 5 %."""
    rng = np.random.default_rng(seed)
    hit = 0
    kept = 0
    guard = 0
    while kept < n and guard < n * 30:
        guard += 1
        feats, _, wfrac, _, _ = simulate_lot(rng)
        if feats["q_restante"] <= 0:
            continue
        kept += 1
        if wfrac > 0.05:
            hit += 1
    return hit / max(kept, 1)


def _set_q0_scale(scale):
    global Q0_LO, Q0_HI
    lo = 0.08 * float(scale)
    hi = min(0.6 * float(scale), 3.0)
    if lo >= hi:
        lo = hi * 0.4
    Q0_LO, Q0_HI = lo, hi


def calibrate_prevalence(target=0.30, n=2000, seed=11):
    """Bissection du facteur de stock initial pour viser `target` (bande 25–40 %)."""
    global Q0_LO, Q0_HI
    saved = (Q0_LO, Q0_HI)
    left, right = 0.15, 2.5
    best_scale, best_gap = 1.0, 1e9
    for _ in range(14):
        mid = (left + right) / 2.0
        _set_q0_scale(mid)
        prev = estimate_prevalence(n=n, seed=seed)
        if abs(prev - target) < best_gap:
            best_gap, best_scale = abs(prev - target), mid
        if prev > target:
            right = mid
        else:
            left = mid
    _set_q0_scale(best_scale)
    prev = estimate_prevalence(n=n, seed=seed)
    if not (0.25 <= prev <= 0.40):
        Q0_LO, Q0_HI = saved
        raise RuntimeError(f"prévalence {prev:.3f} hors de [0.25, 0.40]")
    return float(prev)
