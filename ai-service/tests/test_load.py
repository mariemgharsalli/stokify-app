from load_ml import run_load_optimization


def test_weight_volume_and_lifo():
    articles = []
    for i, dest in enumerate(("A", "B", "C")):
        articles.append({
            "articleId": i + 1,
            "code": dest,
            "libelle": dest,
            "quantite": 4,
            "poidsUnitaire": 3,
            "volumeUnitaire": 0.2,
            "prixVente": 10,
            "destination": dest,
        })
    out = run_load_optimization({
        "articles": articles,
        "vehicule": {"nom": "Camion", "capacitePoids": 20, "capaciteVolume": 2},
    })
    c = out["constraints"]
    assert c["weightOk"] is True
    assert c["volumeOk"] is True
    assert c["utilizationWeightPct"] <= 100
    assert c["utilizationVolumePct"] <= 100
    loaded_w = sum(r["quantiteChargee"] * r["poidsUnitaire"] for r in out["articlesCharges"])
    loaded_v = sum(r["quantiteChargee"] * r["volumeUnitaire"] for r in out["articlesCharges"])
    assert loaded_w <= 20 + 1e-6
    assert loaded_v <= 2 + 1e-6
    by_dest = {}
    for row in out["articlesCharges"]:
        by_dest[row["destination"]] = row["unloadOrder"]
    # A est la première destination : elle se décharge avant C.
    if "A" in by_dest and "C" in by_dest:
        assert by_dest["A"] < by_dest["C"]
