import { describe, expect, it } from "vitest";
import { formatDate, num3 } from "./commerceUi";
import { formatMoneyTnd } from "./formatMoneyTnd";
import { computeRecap, ligneEcart } from "../pages/inventaires/inventaireUtils";

describe("formatage monétaire, dates et totaux", () => {
  it("formate le dinar, la date et les totaux, y compris 0, négatif et null", () => {
    const zero = formatMoneyTnd(0);
    const nul = formatMoneyTnd(null);
    const negatif = formatMoneyTnd(-2.5);
    const dix = formatMoneyTnd(10);

    expect(nul).toBe(zero);
    expect(zero).toMatch(/0[,.]000/);
    expect(dix).toMatch(/10[,.]000/);
    expect(dix).toMatch(/DT|TND/);
    expect(negatif).toMatch(/-/);
    expect(negatif).toMatch(/2[,.]500/);

    expect(num3(0)).toBe(num3(null));
    expect(num3(0)).toMatch(/0[,.]000 TND/);
    expect(num3(-1)).toMatch(/-/);

    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("pas-une-date")).toBe("—");
    expect(formatDate("2026-10-12T12:00:00")).toMatch(/12/);
    expect(formatDate("2026-10-12T12:00:00")).toMatch(/2026/);

    expect(ligneEcart(5, null)).toBeNull();
    expect(ligneEcart(5, 0)).toBe(-5);
    expect(ligneEcart(0, 0)).toBe(0);

    const vide = computeRecap([]);
    expect(vide.total).toBe(0);
    expect(vide.valeurEcart).toBe(0);
    expect(vide.progressionPct).toBe(0);

    const recap = computeRecap([
      { qteTheorique: 5, qteReelle: null, valeurEcart: 99 },
      { qteTheorique: 5, qteReelle: 0, valeurEcart: -12.5 },
      { qteTheorique: 2, qteReelle: 2, valeurEcart: 0 },
    ]);
    expect(recap.saisis).toBe(2);
    expect(recap.ecartsNeg).toBe(1);
    expect(recap.conformes).toBe(1);
    expect(recap.valeurEcart).toBe(-12.5);
  });
});
