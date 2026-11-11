"""Fixtures communes : graines fixes, séries et mouvements synthétiques."""
import random

import numpy as np
import pytest

CLE_IA_TEST = "cle-de-test-32-caracteres-minimum"


@pytest.fixture(autouse=True)
def graine_aleatoire():
    """Chaque test repart de la même graine (numpy et random)."""
    np.random.seed(7)
    random.seed(7)


@pytest.fixture
def cle_ia():
    return CLE_IA_TEST


@pytest.fixture
def rng():
    return np.random.default_rng(7)


@pytest.fixture
def seasonal_series():
    rng = np.random.default_rng(7)
    t = np.arange(36, dtype=float)
    y = 40 + 12 * np.sin(2 * np.pi * t / 12) + 0.2 * t + rng.normal(0, 1.5, 36)
    return y


@pytest.fixture
def short_history():
    return [
        {"mois": "2026-01", "quantite": 4},
        {"mois": "2026-02", "quantite": 6},
        {"mois": "2026-03", "quantite": 5},
    ]


def mouvement(i, quantite, article_id=1, hour=10):
    return {
        "mouvementId": i + 1,
        "articleId": article_id,
        "depotId": 1,
        "quantite": float(quantite),
        "type": "SORTIE",
        "moyenneHabituelle": 20.0,
        "frequence": 0.4,
        "ecartVsMoyenne": 0.0,
        "date": f"2026-06-01T{int(hour):02d}:00:00+00:00",
    }


@pytest.fixture
def clean_movements(rng):
    qty = rng.normal(20.0, 1.5, 400)
    return [mouvement(i, max(1.0, float(q))) for i, q in enumerate(qty)]


@pytest.fixture
def injected_movements(rng):
    qty = rng.normal(20.0, 1.5, 400)
    rows = [mouvement(i, max(1.0, float(q))) for i, q in enumerate(qty)]
    for k, idx in enumerate((10, 80, 160, 300)):
        rows[idx] = mouvement(idx, 400.0 + 50 * k)
    return rows
