"""Contrats phase 3 : santé, prévision, chargement, slotting, anomalies, péremption."""
import math

import numpy as np
from fastapi.testclient import TestClient

import anomaly_ml
import main
from anomaly_ml import run_anomalies
from expiry.serve import reset_cache, run as run_expiry
from forecast_ml import run_forecast
from load_ml import run_load_optimization
from slotting_ml import run_slotting

CLE_IA_TEST = "cle-de-test-32-caracteres-minimum"


def _mois(n, debut="2024-01"):
    annee, mois = [int(x) for x in debut.split("-")]
    cles = []
    for _ in range(n):
        cles.append(f"{annee:04d}-{mois:02d}")
        mois += 1
        if mois > 12:
            mois = 1
            annee += 1
    return cles


def _historique(valeurs, debut="2024-01"):
    return [
        {"mois": cle, "quantite": float(valeur)}
        for cle, valeur in zip(_mois(len(valeurs), debut), valeurs)
    ]


def _fini(valeur):
    return isinstance(valeur, (int, float)) and math.isfinite(float(valeur))


def _valeurs_prevision(sortie):
    for ligne in sortie["predictions"]:
        for cle in ("valeur", "p50", "p10", "p90", "lower", "upper", "min", "max"):
            if ligne.get(cle) is not None:
                yield ligne[cle]
    for cle in ("recommendedStock", "reorderPoint"):
        if sortie.get(cle) is not None:
            yield sortie[cle]
    modeles = (sortie.get("comparaison") or {}).get("models") or []
    for modele in modeles:
        for valeur in modele.get("preds") or []:
            if valeur is not None:
                yield valeur


def _structure_prevision(sortie):
    # Arrange déjà fait par l'appelant.
    assert isinstance(sortie.get("predictions"), list)
    assert len(sortie["predictions"]) >= 1
    assert sortie.get("mode") or sortie.get("modele")
    for valeur in _valeurs_prevision(sortie):
        assert _fini(valeur)
        assert float(valeur) >= 0


def _mouvement(i, quantite):
    return {
        "mouvementId": i + 1,
        "articleId": 1,
        "depotId": 1,
        "quantite": float(quantite),
        "type": "SORTIE",
        "moyenneHabituelle": 20.0,
        "frequence": 0.4,
        "ecartVsMoyenne": 0.0,
        "date": "2026-06-01T10:00:00+00:00",
    }


def test_sante_repond_200(monkeypatch):
    # Arrange
    monkeypatch.setattr(main, "AI_KEY", CLE_IA_TEST)
    client = TestClient(main.app)

    # Act
    reponse = client.get("/health")

    # Assert
    assert reponse.status_code == 200
    assert reponse.json()["status"] == "ok"


def test_route_protegee_sans_cle_repond_401(monkeypatch):
    # Arrange
    monkeypatch.setattr(main, "AI_KEY", CLE_IA_TEST)
    client = TestClient(main.app)

    # Act
    reponse = client.get("/anomalies/status")

    # Assert
    assert reponse.status_code == 401


def test_mauvaise_cle_repond_401(monkeypatch):
    # Arrange
    monkeypatch.setattr(main, "AI_KEY", CLE_IA_TEST)
    client = TestClient(main.app)

    # Act
    reponse = client.get("/anomalies/status", headers={"X-AI-Key": "mauvaise-cle-de-test"})

    # Assert
    assert reponse.status_code == 401


def test_prevision_trois_mois_sans_nan_ni_negatif(short_history):
    # Arrange
    payload = {"article_id": 3, "historique": short_history, "horizon": 3}

    # Act
    sortie = run_forecast(payload)

    # Assert
    _structure_prevision(sortie)
    assert sortie["mode"] == "moyenne_ponderee_historique_court"
    assert len(sortie["predictions"]) == 3


def test_prevision_saisonniere_24_mois_sans_nan_ni_negatif(rng):
    # Arrange
    t = np.arange(24, dtype=float)
    serie = 30 + 8 * np.sin(2 * np.pi * t / 12) + rng.normal(0, 0.4, 24)
    payload = {"article_id": 24, "historique": _historique(serie), "horizon": 3}

    # Act
    sortie = run_forecast(payload)

    # Assert
    _structure_prevision(sortie)
    assert len(sortie["historique"]) == 24
    assert len(sortie["predictions"]) == 3


def test_prevision_serie_vide_sans_nan_ni_negatif():
    # Arrange
    payload = {"article_id": 1, "historique": [], "horizon": 3}

    # Act
    sortie = run_forecast(payload)

    # Assert
    _structure_prevision(sortie)
    assert all(ligne["valeur"] == 0 for ligne in sortie["predictions"])


def test_prevision_serie_de_zeros_sans_nan_ni_negatif():
    # Arrange
    payload = {"article_id": 2, "historique": _historique([0.0] * 24), "horizon": 3}

    # Act
    sortie = run_forecast(payload)

    # Assert
    _structure_prevision(sortie)
    assert all(ligne["valeur"] == 0 for ligne in sortie["predictions"])


def test_prevision_intermittente_croston_sans_nan_ni_negatif():
    # Arrange — plus de 40 % de zéros et au moins 3 demandes positives.
    valeurs = []
    for demande in (10, 8, 12, 9, 7, 11):
        valeurs.extend([demande, 0, 0])
    payload = {"article_id": 8, "historique": _historique(valeurs), "horizon": 3}

    # Act
    sortie = run_forecast(payload)

    # Assert
    _structure_prevision(sortie)
    etapes = {etape["id"]: etape["status"] for etape in sortie.get("pipeline") or []}
    assert etapes.get("sparse") == "ok"
    modeles = {m["id"] for m in (sortie.get("comparaison") or {}).get("models") or []}
    assert "croston" in modeles


def test_chargement_respecte_capacite_et_couvre_chaque_article():
    # Arrange
    articles = []
    for i in range(1, 5):
        articles.append({
            "articleId": i,
            "code": f"SKU{i}",
            "libelle": f"Article {i}",
            "quantite": 3,
            "poidsUnitaire": 4,
            "volumeUnitaire": 0.3,
            "prixVente": 15 + i,
            "destination": "Tunis" if i < 3 else "Sfax",
        })
    payload = {
        "articles": articles,
        "vehicule": {"nom": "Camion", "capacitePoids": 20, "capaciteVolume": 1.5},
    }

    # Act
    sortie = run_load_optimization(payload)

    # Assert
    charges = sortie["articlesCharges"]
    rejetes = sortie["articlesNonCharges"]
    poids = sum(r["quantiteChargee"] * r["poidsUnitaire"] for r in charges)
    volume = sum(r["quantiteChargee"] * r["volumeUnitaire"] for r in charges)
    assert poids <= 20 + 1e-6
    assert volume <= 1.5 + 1e-6
    ids_charges = [r["articleId"] for r in charges]
    assert len(ids_charges) == len(set(ids_charges))
    couverts = set(ids_charges) | {r["articleId"] for r in rejetes}
    assert couverts == {1, 2, 3, 4}


def test_slotting_attribue_classe_et_zone_a_chaque_article():
    # Arrange
    articles = [
        {
            "articleId": i,
            "code": f"A{i}",
            "rotation30": float(i * i),
            "rotation90": float(i * i * 2),
            "volume": 0.02,
            "poidsUnitaire": 0.4,
            "prixVente": 8 + i,
        }
        for i in range(1, 13)
    ]
    candidats = [
        {"emplacementId": 1, "code": "P1", "distanceQuai": 8, "occupationRatio": 0.1, "zoneKey": "A"},
        {"emplacementId": 2, "code": "M1", "distanceQuai": 45, "occupationRatio": 0.2, "zoneKey": "B"},
        {"emplacementId": 3, "code": "R1", "distanceQuai": 88, "occupationRatio": 0.15, "zoneKey": "C"},
    ]

    # Act
    sorties = [
        run_slotting({"articleId": article["articleId"], "articles": articles, "candidates": candidats})
        for article in articles
    ]

    # Assert
    for sortie in sorties:
        assert sortie["abcClass"] in {"A", "B", "C"}
        assert sortie["scored"]
        assert sortie["scored"][0]["zoneKey"] in {"A", "B", "C"}
    recensement = sorties[0]["census"]
    assert recensement["A"] + recensement["B"] + recensement["C"] == recensement["n"] == 12


def test_anomalie_injectee_est_detectee(injected_movements, tmp_path, monkeypatch):
    # Arrange
    monkeypatch.setattr(anomaly_ml, "MODELS_DIR", tmp_path)

    # Act
    sortie = run_anomalies({"societeId": 4242, "mouvements": injected_movements, "retrain": True})

    # Assert
    alertes = {int(a["mouvementId"]) for a in sortie["anomalies"] if a.get("statut") == "ALERTE"}
    assert len(alertes & {11, 81, 161, 301}) >= 3


def test_petit_jeu_danomalies_ne_plante_pas(tmp_path, monkeypatch):
    # Arrange
    monkeypatch.setattr(anomaly_ml, "MODELS_DIR", tmp_path)
    trois = [_mouvement(i, 12) for i in range(3)]

    # Act
    vide = run_anomalies({"societeId": 9, "mouvements": [], "retrain": True})
    court = run_anomalies({"societeId": 9, "mouvements": trois, "retrain": True})

    # Assert
    assert vide["anomalies"] == []
    assert isinstance(court["anomalies"], list)


def test_peremption_heuristique_sans_nan(tmp_path, monkeypatch):
    # Arrange — le package expiry est présent ; pas de xfail.
    monkeypatch.setenv("EXPIRY_MODELS_DIR", str(tmp_path))
    reset_cache()
    lot = {
        "lot_id": 4,
        "quantite_restante_asof": 12,
        "vitesse_moyenne_journaliere": 1,
        "jours_restants_avant_expiration": 5,
        "prix_unitaire": 3,
    }

    # Act
    sortie = run_expiry({"lots": [lot]})

    # Assert
    assert sortie["mode"] == "heuristic"
    item = sortie["items"][0]
    for cle in ("qte_predite_dlc", "valeur_predite", "proba_waste", "qte_p10", "qte_p50", "qte_p90"):
        assert _fini(item[cle])
        assert float(item[cle]) >= 0
