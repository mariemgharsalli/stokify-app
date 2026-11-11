"""GBM résiduel + CQR, et réseau GRU (import torch protégé)."""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor

try:
    import torch
    import torch.nn as nn
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    HAS_TORCH = False

KW = dict(max_depth=5, learning_rate=0.05, max_iter=400, l2_regularization=1.0, random_state=0, early_stopping=True)


class ExpiryGBM:
    """Apprend r = fraction_perdue − base_frac (correction de la formule physique)."""

    def fit(self, F, base, wf, q, w_real=None, cal_idx=None, tr_idx=None, alpha=0.2):
        r = wf - base
        sw = np.sqrt(np.maximum(q, 1e-6)) * (1.0 if w_real is None else w_real)
        self.mean = HistGradientBoostingRegressor(loss="squared_error", **KW).fit(
            F[tr_idx], r[tr_idx], sample_weight=sw[tr_idx]
        )
        self.lo = HistGradientBoostingRegressor(loss="quantile", quantile=alpha / 2, **KW).fit(F[tr_idx], r[tr_idx])
        self.hi = HistGradientBoostingRegressor(loss="quantile", quantile=1 - alpha / 2, **KW).fit(F[tr_idx], r[tr_idx])
        self.clf = HistGradientBoostingClassifier(
            max_depth=6, learning_rate=0.06, max_iter=300, random_state=0
        ).fit(F[tr_idx], (wf[tr_idx] > 0.05).astype(int))
        # CQR : élargissement conforme sur l'échantillon de calibration
        E = np.maximum(self.lo.predict(F[cal_idx]) - r[cal_idx], r[cal_idx] - self.hi.predict(F[cal_idx]))
        k = int(np.ceil((len(cal_idx) + 1) * (1 - alpha)))
        self.Q = float(np.sort(E)[min(k, len(E)) - 1])
        self.alpha = float(alpha)
        return self

    def predict(self, F, base):
        frac = np.clip(base + self.mean.predict(F), 0, 1)
        lo = np.clip(base + self.lo.predict(F) - self.Q, 0, 1)
        hi = np.clip(base + self.hi.predict(F) + self.Q, 0, 1)
        return frac, np.minimum(lo, frac), np.maximum(hi, frac), self.clf.predict_proba(F)[:, 1]


def ensemble_predict(gbm, net, mu, sd, iso, F, base, seq):
    """Fraction, bornes P10/P90 (CQR une seule fois) et probabilité calibrée."""
    sd_safe = np.where(np.asarray(sd) < 1e-6, 1.0, sd)
    Fs = (np.asarray(F, float) - np.asarray(mu, float)) / sd_safe
    base = np.asarray(base, float)
    r_mean = gbm.mean.predict(Fs)
    r_lo = gbm.lo.predict(Fs)
    r_hi = gbm.hi.predict(Fs)
    p_g = gbm.clf.predict_proba(Fs)[:, 1]
    frac = np.clip(base + r_mean, 0, 1)
    lo = base + r_lo
    hi = base + r_hi
    if net is not None and HAS_TORCH:
        xt = torch.as_tensor(Fs, dtype=torch.float32)
        st = torch.as_tensor(np.log1p(np.maximum(np.asarray(seq, float), 0.0)), dtype=torch.float32)
        bt = torch.as_tensor(base, dtype=torch.float32)
        net.eval()
        with torch.no_grad():
            q, logit = net(xt, st, bt)
            q = q.clamp(0, 1).cpu().numpy()
            logit_np = logit.detach().cpu().numpy()
        p_n = 1.0 / (1.0 + np.exp(-np.clip(logit_np, -30, 30)))
        frac = 0.5 * frac + 0.5 * q[:, 1]
        lo = 0.5 * lo + 0.5 * q[:, 0]
        hi = 0.5 * hi + 0.5 * q[:, 2]
        p = 0.5 * p_g + 0.5 * p_n
    else:
        p = p_g
    Q = float(getattr(gbm, "Q", 0.0) or 0.0)
    lo = np.clip(lo - Q, 0, 1)
    hi = np.clip(hi + Q, 0, 1)
    lo = np.minimum(lo, frac)
    hi = np.maximum(hi, frac)
    if iso is not None:
        p = np.clip(np.asarray(iso.predict(p), float), 0, 1)
    else:
        p = np.clip(p, 0, 1)
    return frac, lo, hi, p


if HAS_TORCH:

    class ExpiryNet(nn.Module):
        """GRU sur 28 j de ventes + MLP sur variables statiques. Tête 1 : quantiles résiduels P10/P50/P90.
        Tête 2 : logit P(perte > 5 %). Apprentissage résiduel sur base_frac."""

        def __init__(self, n_static, seq_len=28, hidden=48, q_levels=(0.1, 0.5, 0.9), dropout=0.15):
            super().__init__()
            self.q_levels = q_levels
            self.gru = nn.GRU(input_size=1, hidden_size=hidden, batch_first=True)
            self.static = nn.Sequential(
                nn.Linear(n_static, 96), nn.GELU(), nn.LayerNorm(96),
                nn.Dropout(dropout), nn.Linear(96, 64), nn.GELU(),
            )
            self.trunk = nn.Sequential(nn.Linear(hidden + 64, 96), nn.GELU(), nn.Dropout(dropout))
            self.head_q = nn.Linear(96, len(q_levels))
            self.head_p = nn.Linear(96, 1)

        def forward(self, x_static, x_seq, base_frac):
            _, h = self.gru(x_seq.unsqueeze(-1))
            z = self.trunk(torch.cat([self.static(x_static), h[-1]], dim=1))
            q = base_frac.unsqueeze(1) + self.head_q(z)      # résiduel
            q, _ = torch.sort(q, dim=1)                       # pas de croisement de quantiles
            return q, self.head_p(z).squeeze(1)

    def pinball(pred, y, levels, w):
        diff = y.unsqueeze(1) - pred
        lv = torch.tensor(levels, dtype=pred.dtype).unsqueeze(0)
        l = torch.maximum(lv * diff, (lv - 1) * diff).mean(1)
        return (l * w).sum() / w.sum()

    def _t(a):
        return torch.as_tensor(np.asarray(a, dtype=np.float32))

    def train_net(tr, va, epochs=40, lr=2e-3, bs=512, patience=6, seed=7):
        """tr / va : dict numpy {Xs, S, base, y, cls, w}. Xs standardisé, S = log1p(séquence)."""
        torch.manual_seed(seed)
        torch.set_num_threads(2)
        net = ExpiryNet(tr["Xs"].shape[1], seq_len=tr["S"].shape[1])
        opt = torch.optim.AdamW(net.parameters(), lr=lr, weight_decay=1e-4)
        steps = max(1, epochs * int(np.ceil(len(tr["y"]) / bs)))
        sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps)
        bce = nn.BCEWithLogitsLoss(reduction="none")
        keys = ("Xs", "S", "base", "y", "cls", "w")
        dl = torch.utils.data.DataLoader(
            torch.utils.data.TensorDataset(*[_t(tr[k]) for k in keys]),
            batch_size=bs, shuffle=True,
        )
        V = [_t(va[k]) for k in keys]

        def loss_fn(xs, s, b, y, c, w):
            q, logit = net(xs, s, b)
            return pinball(q, y, net.q_levels, w) + 0.5 * (bce(logit, c) * w).sum() / w.sum()

        best, bad, curve = 1e9, 0, []
        state = {k: v.detach().clone() for k, v in net.state_dict().items()}
        for ep in range(epochs):
            net.train()
            run = 0.0
            for batch in dl:
                opt.zero_grad()
                l = loss_fn(*batch)
                l.backward()
                nn.utils.clip_grad_norm_(net.parameters(), 1.0)
                opt.step()
                sched.step()
                run += float(l.detach()) * len(batch[3])
            net.eval()
            with torch.no_grad():
                vl = float(loss_fn(*V))
            curve.append({"epoch": ep + 1, "train": run / max(len(tr["y"]), 1), "val": vl})
            if np.isfinite(vl) and vl < best - 1e-4:
                best, bad = vl, 0
                state = {k: v.detach().clone() for k, v in net.state_dict().items()}
            else:
                bad += 1
                if bad >= patience:
                    break
        net.load_state_dict(state)
        net.eval()
        return net, curve
