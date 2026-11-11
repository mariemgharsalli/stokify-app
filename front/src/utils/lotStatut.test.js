import { describe, expect, it } from "vitest";
import { computeStatut, expiryBand, fmtDate } from "./lotStatut";

const jour = 86400000;

describe("lotStatut", () => {
  it("distingue actif, expiré, épuisé et expiration proche", () => {
    const maintenant = new Date();
    expect(computeStatut({ quantiteRestante: 4, dateExpiration: new Date(maintenant.getTime() + 40 * jour) })).toBe("ACTIF");
    expect(computeStatut({ quantiteRestante: 4, dateExpiration: new Date(maintenant.getTime() - 2 * jour) })).toBe("EXPIRE");
    expect(computeStatut({ quantiteRestante: 0, dateExpiration: new Date(maintenant.getTime() + 10 * jour) })).toBe("EPUISE");
    expect(
      expiryBand(
        { quantiteRestante: 4, dateExpiration: new Date(maintenant.getTime() + 10 * jour), statut: "ACTIF" },
        maintenant
      )
    ).toBe("PROCHE");
    expect(
      expiryBand(
        { quantiteRestante: 4, dateExpiration: new Date(maintenant.getTime() + 40 * jour), statut: "ACTIF" },
        maintenant
      )
    ).toBe("ACTIF");
  });

  it("formate une date illisible comme un tiret", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("pas-une-date")).toBe("—");
  });
});
