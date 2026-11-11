import { describe, expect, it } from "vitest";
import {
  articleSerie,
  classerLignesStock,
  comparerSnapshot,
  corpsTransfert,
  interDepotInterdit,
  memeEmplacement,
  quantiteTransfert,
} from "../lib/transfer";

describe("transfert — règles", () => {
  it("borne la quantité et exige un entier pour une série", () => {
    expect(quantiteTransfert("2", 5, false)).toEqual({ ok: true, quantite: 2 });
    expect(quantiteTransfert("9", 5, false).reason).toBe("plafond");
    expect(quantiteTransfert("1.5", 5, true).reason).toBe("entier");
    expect(quantiteTransfert("2", 5, true)).toEqual({ ok: true, quantite: 2 });
    expect(quantiteTransfert("0", 5, false).reason).toBe("quantite");
  });

  it("refuse le même emplacement et le stock sans emplacement", () => {
    expect(memeEmplacement(4, "4")).toBe(true);
    expect(memeEmplacement(4, 5)).toBe(false);
    const { deplacables, immobiles } = classerLignesStock([
      { id: 1, emplacementId: 4, quantite: 2 },
      { id: 2, emplacementId: null, quantite: 6 },
    ]);
    expect(deplacables.map((ligne) => ligne.id)).toEqual([1]);
    expect(immobiles.map((ligne) => ligne.id)).toEqual([2]);
  });

  it("envoie le corps exact, sans valeur", () => {
    const body = corpsTransfert({
      articleId: "7",
      depotOrigineId: 1,
      emplacementOrigineId: 2,
      depotDestId: 3,
      emplacementDestId: 4,
      quantite: 2,
      valeur: 999,
    });
    expect(body).toEqual({
      articleId: 7,
      depotOrigineId: 1,
      emplacementOrigineId: 2,
      depotDestId: 3,
      emplacementDestId: 4,
      quantite: 2,
    });
    expect(Object.hasOwn(body, "valeur")).toBe(false);
  });

  it("interdit le transfert inter-dépôts des articles en série", () => {
    const serie = { modeTracage: "SERIE" };
    const lotSerie = { modeTracage: "LOT_SERIE" };
    const lot = { modeTracage: "LOT" };
    expect(interDepotInterdit(serie, 1, 2)).toBe(true);
    expect(interDepotInterdit(lotSerie, 1, 2)).toBe(true);
    expect(interDepotInterdit(serie, 1, 1)).toBe(false);
    expect(interDepotInterdit(lot, 1, 2)).toBe(false);
    expect(articleSerie(serie)).toBe(true);
    expect(articleSerie(lot)).toBe(false);
  });

  it("compare les deux emplacements", () => {
    expect(comparerSnapshot(8, 6, 1, 3, 2)).toBe("applique");
    expect(comparerSnapshot(8, 8, 1, 1, 2)).toBe("inchange");
    expect(comparerSnapshot(8, 6, 1, 1, 2)).toBe("incertain");
    expect(comparerSnapshot(8, 7, 1, 2, 2)).toBe("incertain");
  });
});
