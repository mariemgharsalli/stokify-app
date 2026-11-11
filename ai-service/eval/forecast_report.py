"""Walk-forward MAPE / sMAPE / MASE par article (>= 18 mois)."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from forecast_ml import _fit_holt_winters, _mape, _nbeats_forecast, _smape, _train_nbeats, _walk_forward

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "sales_monthly.json"
OUT_JSON = ROOT / "reports" / "forecast_eval.json"
OUT_MD = ROOT / "reports" / "forecast_eval.md"


def _series_by_article(rows):
    grouped = {}
    for row in rows:
        grouped.setdefault(int(row["articleId"]), []).append(row)
    series = {}
    for aid, items in grouped.items():
        items = sorted(items, key=lambda r: r["mois"])
        if len(items) < 18:
            continue
        series[aid] = np.asarray([float(r["quantite"]) for r in items], dtype=float)
    return series


def _metrics(y, predict):
    wf = _walk_forward(y, predict)
    return {
        "mape": None if wf["mape"] is None else round(float(wf["mape"]), 2),
        "smape": None if wf["smape"] is None else round(float(wf["smape"]), 2),
        "mase": None if wf["mase"] is None else round(float(wf["mase"]), 3),
    }


def _seasonal_naive(train):
    train = np.asarray(train, dtype=float)
    if len(train) >= 12:
        return np.asarray([train[-12]])
    return np.asarray([train[-1]])


def main():
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    series = _series_by_article(payload.get("rows") or [])
    per_article = []
    champions = []
    for aid, y in sorted(series.items()):
        def hw_one(train, _y=y):
            _, full, _, _ = _fit_holt_winters(np.asarray(train, dtype=float), 1)
            return full[:1]

        row = {"articleId": aid, "months": int(len(y)), "models": {}}
        row["models"]["naive"] = _metrics(y, _seasonal_naive)
        row["models"]["holt_winters"] = _metrics(y, hw_one)
        lookback, horizon = 12, 3
        if len(y) >= lookback + horizon + 6:
            net, _meta = _train_nbeats([y], lookback, horizon, seed=aid % 10000, max_epochs=20)

            def nb_one(train, _net=net):
                return _nbeats_forecast(_net, np.asarray(train, dtype=float), lookback, 1)

            row["models"]["nbeats"] = _metrics(y, nb_one)

            def hy_one(train, _net=net):
                h = np.asarray(hw_one(train), dtype=float).reshape(-1)
                b = np.asarray(nb_one(train), dtype=float).reshape(-1)
                n = min(len(h), len(b))
                return np.maximum(0.5 * h[:n] + 0.5 * b[:n], 0.0)

            row["models"]["hybrid"] = _metrics(y, hy_one)
        else:
            row["models"]["nbeats"] = {"mape": None, "smape": None, "mase": None, "status": "skip"}
            row["models"]["hybrid"] = {"mape": None, "smape": None, "mase": None, "status": "skip"}
        best = None
        best_mase = 1e9
        for name, met in row["models"].items():
            mase = met.get("mase")
            if mase is None:
                continue
            if mase < best_mase:
                best_mase = mase
                best = name
        row["champion"] = best
        if best:
            champions.append(best)
        per_article.append(row)

    names = ["naive", "holt_winters", "nbeats", "hybrid"]
    averages = {}
    for name in names:
        vals = [r["models"][name]["mase"] for r in per_article if r["models"].get(name, {}).get("mase") is not None]
        averages[name] = None if not vals else round(float(np.mean(vals)), 3)
    freq = Counter(champions)
    most = freq.most_common(1)[0][0] if freq else None
    report = {
        "articles": len(per_article),
        "averageMase": averages,
        "championFrequency": dict(freq),
        "mostFrequentChampion": most,
        "rows": per_article,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# Évaluation prévision",
        "",
        f"Lignes exportées : **{len(payload.get('rows') or [])}**. Articles retenus (18 mois ou plus) : **{len(per_article)}**.",
        "",
        "| Modèle | MASE moyen |",
        "|---|---|",
    ]
    for name in names:
        val = "—" if averages[name] is None else f"{averages[name]:.3f}"
        lines.append(f"| {name} | {val} |")
    lines += [
        "",
        f"Champion le plus fréquent : **{most or 'aucun'}**.",
        "",
        "| Article | Mois | Naïf | Holt-Winters | N-BEATS | Hybride | Champion |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in per_article:
        def cell(name):
            mase = row["models"].get(name, {}).get("mase")
            return "—" if mase is None else f"{mase:.3f}"
        lines.append(
            f"| {row['articleId']} | {row['months']} | {cell('naive')} | {cell('holt_winters')} | {cell('nbeats')} | {cell('hybrid')} | {row['champion'] or '—'} |"
        )
    if not per_article:
        lines.append("| — | — | — | — | — | — | historique insuffisant |")
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(OUT_MD.read_text(encoding="utf-8"))


if __name__ == "__main__":
    main()
