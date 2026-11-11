from slotting_ml import run_slotting


def _article(i):
    return {
        "id": i,
        "code": f"A{i}",
        "rotation30": float(i),
        "rotation90": float(i * 2),
        "volumeUnitaire": 0.01,
        "poidsUnitaire": 0.2,
        "prixVente": 10,
    }


def test_fallback_reason_under_eight_articles():
    articles = [_article(i) for i in range(1, 5)]
    candidates = [
        {"id": 1, "code": "E1", "distanceQuai": 2, "capacite": 10, "zone": "PICK"},
        {"id": 2, "code": "E2", "distanceQuai": 20, "capacite": 10, "zone": "RESERVE"},
    ]
    out = run_slotting({
        "articleId": 1,
        "articles": articles,
        "candidates": candidates,
    })
    assert out["fallbackReason"] == "Moins de 8 articles : classes ABC par percentiles"
