"use strict";

const { localForecast, localExpiryWaste } = require("./aiLocal.fallback");
const { detectAnomaliesLocal } = require("./anomalies.service");

const FORECAST_FIELDS = [
  "predictions",
  "confidence",
  "confidenceLabel",
  "smape",
  "mase",
  "lower",
  "upper",
  "mode",
  "modele",
];

const ANOMALY_ITEM_FIELDS = ["mouvementId", "score", "raison", "statut", "mlMeta"];

const EXPIRY_ITEM_FIELDS = [
  "lot_id",
  "qte_predite_dlc",
  "proba_waste",
  "valeur_predite",
  "y_hat_waste",
  "qte_p10",
  "qte_p50",
  "qte_p90",
  "drivers",
  "mode_lot",
];

function hasKeys(obj, keys) {
  const present = new Set(Object.keys(obj));
  return keys.every((k) => present.has(k));
}

describe("contrat fallback IA", () => {
  test("prévision locale couvre le contrat", () => {
    const out = localForecast({
      articleId: 1,
      historique: [
        { mois: "2026-01", quantite: 2 },
        { mois: "2026-02", quantite: 3 },
      ],
    });
    expect(hasKeys(out, FORECAST_FIELDS)).toBe(true);
    expect(out.confidence).toBeNull();
    expect(out.confidenceLabel).toBe("insuffisant");
  });

  test("anomalie locale couvre le contrat", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      mouvementId: i + 1,
      articleId: 1,
      depotId: 1,
      quantite: i === 0 ? 80 : 2,
      moyenneHabituelle: 2,
      ecartVsMoyenne: i === 0 ? 6 : 0,
      date: "2026-06-01T10:00:00.000Z",
    }));
    const out = detectAnomaliesLocal(rows);
    expect(Array.isArray(out.anomalies)).toBe(true);
    expect(out.anomalies.length).toBeGreaterThan(0);
    expect(hasKeys(out.anomalies[0], ANOMALY_ITEM_FIELDS)).toBe(true);
  });

  test("péremption locale couvre le contrat", () => {
    const out = localExpiryWaste([
      { lot_id: 1, quantite_restante: 10, vitesse_moyenne_journaliere: 1, jours_restants: 4, prix_unitaire: 2 },
    ]);
    expect(hasKeys(out.items[0], EXPIRY_ITEM_FIELDS)).toBe(true);
  });
});
