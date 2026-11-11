import { describe, expect, it } from "vitest";
import {
  corpsAjout,
  corpsComptage,
  ecrireMasque,
  grouperParEmplacement,
  ligneNouvelle,
  lireMasque,
  quantiteComptage,
  vueLigne,
} from "../lib/inventory";

const ligne = {
  id: 1,
  articleId: 4,
  emplacementId: null,
  qteReelle: null,
  recomptageDemande: false,
  qteTheorique: 10,
  ecart: 2,
  valeurEcart: 5,
};

describe("inventaire — règles", () => {
  it("n'envoie que la quantité réelle", () => {
    const patch = corpsComptage(3);
    expect(Object.keys(patch)).toEqual(["qteReelle"]);
    expect(patch.qteReelle).toBe(3);
    const ajout = corpsAjout({ articleId: 4, qteReelle: 1, emplacementId: 8, lotId: 2, qteTheorique: 9, valide: true });
    expect(Object.keys(ajout).sort()).toEqual(["articleId", "emplacementId", "lotId", "qteReelle"]);
    expect(Object.hasOwn(ajout, "qteTheorique")).toBe(false);
  });

  it("refuse une valeur négative et marque zéro", () => {
    expect(quantiteComptage("-1").reason).toBe("negatif");
    expect(quantiteComptage("0")).toMatchObject({ ok: true, zero: true, quantite: 0 });
    expect(quantiteComptage("1.5", true).reason).toBe("entier");
    expect(quantiteComptage("2", true)).toMatchObject({ ok: true, quantite: 2 });
  });

  it("groupe le stock sans emplacement", () => {
    const groupes = grouperParEmplacement([
      { id: 1, emplacementId: 8, emplacement: { id: 8, code: "A-01" } },
      { id: 2, emplacementId: null },
    ]);
    expect(groupes.map((groupe) => groupe.id)).toEqual([8, null]);
  });

  it("masque la théorique en aveugle et selon le réglage local", () => {
    expect(Object.hasOwn(vueLigne(ligne, { aveugle: true }), "qteTheorique")).toBe(false);
    expect(Object.hasOwn(vueLigne(ligne, { aveugle: true }), "ecart")).toBe(false);
    expect(Object.hasOwn(vueLigne(ligne, { aveugle: true }), "valeurEcart")).toBe(false);
    ecrireMasque(true);
    expect(lireMasque()).toBe(true);
    expect(Object.hasOwn(vueLigne(ligne, { masquer: lireMasque() }), "qteTheorique")).toBe(false);
    ecrireMasque(false);
    expect(Object.hasOwn(vueLigne(ligne, { masquer: lireMasque() }), "qteTheorique")).toBe(true);
  });

  it("reconnaît une ligne créée après une réponse perdue", () => {
    const neuve = ligneNouvelle([1], [{ id: 2, articleId: 4, lotId: null, emplacementId: 8 }], { articleId: 4, lotId: null, emplacementId: 8 });
    expect(neuve.id).toBe(2);
    expect(ligneNouvelle([1, 2], [{ id: 2, articleId: 4, emplacementId: 8 }], { articleId: 4, emplacementId: 8 })).toBeNull();
  });
});
