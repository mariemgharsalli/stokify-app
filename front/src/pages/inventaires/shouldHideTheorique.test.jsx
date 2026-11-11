import { describe, expect, it } from "vitest";
import { shouldHideTheorique } from "./components/SaisieTable";

describe("inventaire en aveugle", () => {
  it("masque la quantité théorique tant que la ligne n'est pas validée", () => {
    const ligne = { valide: false, qteTheorique: 10 };

    expect(shouldHideTheorique(ligne, true, "EN_COURS")).toBe(true);
    expect(shouldHideTheorique({ ...ligne, valide: true }, true, "EN_COURS")).toBe(false);
    expect(shouldHideTheorique(ligne, true, "VALIDE")).toBe(false);
    expect(shouldHideTheorique(ligne, false, "EN_COURS")).toBe(false);
  });
});
