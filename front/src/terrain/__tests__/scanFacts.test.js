import { describe, expect, it } from "vitest";
import { depotLines, formatQty, levelFor, qtyOf, reservedOf } from "../lib/scanFacts";

describe("scanFacts", () => {
  const stocks = [
    { id: 1, depotId: 2, quantite: 10, qteReservee: 4, statut: "ACTIF", emplacement: { code: "A-01" } },
    { id: 2, depotId: 9, quantite: 3, statut: "ACTIF" },
    { id: 3, depotId: 2, quantite: 5, statut: "ARCHIVE" },
  ];

  it("ne garde que le dépôt courant, hors archive", () => {
    const rows = depotLines(stocks, 2);
    expect(rows.map((row) => row.id)).toEqual([1]);
    expect(qtyOf(rows)).toBe(10);
    expect(reservedOf(rows)).toBe(4);
  });

  it("qualifie la rupture et le seuil", () => {
    expect(levelFor(0, { stockMin: 2 })).toBe("out");
    expect(levelFor(2, { seuilAlerte: 4 })).toBe("low");
    expect(levelFor(8, { stockMin: 2 })).toBe("ok");
  });

  it("formate les quantités en français", () => {
    expect(formatQty(12.5)).toBe("12,5");
    expect(formatQty(null)).toBe("—");
  });
});