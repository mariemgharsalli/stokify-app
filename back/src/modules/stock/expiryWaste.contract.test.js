const { localExpiryWaste } = require("./aiLocal.fallback");
const { journalSnapshots } = require("./expiryWaste.service");

const ITEM_FIELDS = [
  "lot_id",
  "qte_predite_dlc",
  "proba_waste",
  "valeur_predite",
  "y_hat_waste",
  "cover_days",
  "qte_p10",
  "qte_p50",
  "qte_p90",
  "valeur_p90",
  "drivers",
  "mode_lot",
];

describe("expiry waste contract", () => {
  test("le repli local et une réponse FastAPI exposent les mêmes champs d'item", () => {
    const local = localExpiryWaste([
      {
        lot_id: 3,
        quantite_restante_asof: 12,
        vitesse_moyenne_journaliere: 0.4,
        jours_restants_avant_expiration: 5,
        prix_unitaire: 8,
      },
    ]);
    const remote = {
      kind: "ml_expiry_waste",
      version: "2.0.0",
      mode: "ensemble",
      model: { mode: "ensemble", data: { synthetic: 60000, real: 0, realDataSufficient: false } },
      items: [
        {
          lot_id: 3,
          qte_predite_dlc: 10,
          proba_waste: 0.8,
          valeur_predite: 80,
          y_hat_waste: 1,
          cover_days: 30,
          qte_p10: 4,
          qte_p50: 10,
          qte_p90: 12,
          valeur_p90: 96,
          drivers: [{ key: "couverture", label: "Couverture (vitesse × jours)", impact: 0.2 }],
          mode_lot: "ensemble",
        },
      ],
    };
    expect(local.kind).toBe("heuristic_expiry_waste");
    expect(local.mode).toBe("local");
    expect(local.model.mode).toBe("heuristic");
    expect(Object.keys(local.items[0]).sort()).toEqual(ITEM_FIELDS.slice().sort());
    expect(Object.keys(remote.items[0]).sort()).toEqual(Object.keys(local.items[0]).sort());
    expect(local.items[0].qte_p10).toBeLessThanOrEqual(local.items[0].qte_p50);
    expect(local.items[0].qte_p50).toBeLessThanOrEqual(local.items[0].qte_p90);
  });

  test("un journal en échec ne propage pas l'erreur", async () => {
    const out = await journalSnapshots(
      1,
      [{ lotId: 7, quantiteRestante: 4, joursRestants: 3, features: { quantite_restante: 4, ventes_28j: [] } }],
      {
        version: "2.0.0",
        items: [{ lot_id: 7, proba_waste: 0.4, qte_predite_dlc: 1.2, qte_p10: 0.4, qte_p50: 1.2, qte_p90: 2 }],
      },
      async () => {
        const error = new Error("table ExpiryPrediction absente");
        error.code = "P2021";
        throw error;
      }
    );
    expect(out).toEqual({ ok: false, n: 0 });
  });
});
