import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  achatComplet,
  ajouterSerie,
  bilanLignes,
  boundQuantite,
  buildReceptionBody,
  chargerAchatsAReceptionner,
  fefoSansDate,
  filtrerAchats,
  interpreterScan,
  motifToutRecevoir,
  peutToutRecevoir,
  preparerListe,
  recevoirLignesEnSequence,
  resoudreEmplacement,
  resteLigne,
  seriesValides,
} from "../lib/reception";

function ligne(partiel) {
  return {
    id: 1,
    quantite: 10,
    quantiteRecue: 4,
    article: { id: 3, code: "VIS", codeBarres: "300123", libelle: "Vis", modeTracage: "AUCUN", tracageAuto: false, strategieSortie: "FIFO" },
    ...partiel,
  };
}

describe("réception — logique pure", () => {
  it("calcule le reste et borne la quantité, avec un entier pour les séries", () => {
    expect(resteLigne(ligne())).toBe(6);
    expect(resteLigne(ligne({ quantiteRecue: 10 }))).toBe(0);
    expect(boundQuantite(9, 6)).toBe(6);
    expect(boundQuantite("2,5", 6)).toBe(2.5);
    expect(boundQuantite(2.8, 6, { entier: true })).toBe(2);
    expect(boundQuantite(0, 6)).toBe(0);
  });

  it("exige un lot manuel et exactement N séries uniques", () => {
    const lot = ligne({ article: { modeTracage: "LOT", tracageAuto: false, strategieSortie: "FEFO" } });
    expect(buildReceptionBody({ article: lot.article, reste: 6, quantiteRecue: 2 }).ok).toBe(false);
    const construit = buildReceptionBody({
      article: lot.article,
      reste: 6,
      quantiteRecue: 2,
      numeroLot: " L-1 ",
      dateExpiration: "2026-12-01",
      emplacementId: 8,
    });
    expect(construit.body).toEqual({ quantiteRecue: 2, numeroLot: "L-1", dateExpiration: "2026-12-01", emplacementId: 8 });
    expect(fefoSansDate(lot.article, "")).toBe(true);
    expect(fefoSansDate(lot.article, "2026-12-01")).toBe(false);

    const serie = ligne({ article: { modeTracage: "SERIE", tracageAuto: false } });
    expect(buildReceptionBody({ article: serie.article, reste: 6, quantiteRecue: 2.5 }).reason).toBe("entier");
    expect(seriesValides(["A", "A"], 2).reason).toBe("doublon");
    expect(seriesValides(["A", " "], 2).reason).toBe("vide");
    expect(ajouterSerie(["A"], "a", 2).reason).toBe("doublon");
    const corps = buildReceptionBody({
      article: serie.article,
      reste: 6,
      quantiteRecue: 2,
      numerosSerie: [" S1 ", "S2"],
    });
    expect(corps.body).toEqual({ quantiteRecue: 2, numerosSerie: ["S1", "S2"] });
  });

  it("masque tout réceptionner dès qu'une ligne restante exige une saisie", () => {
    const auto = { lignes: [ligne({ article: { modeTracage: "LOT", tracageAuto: true } })] };
    const manuel = { lignes: [ligne({ article: { modeTracage: "LOT_SERIE", tracageAuto: false } })] };
    const solde = { lignes: [ligne({ quantiteRecue: 10 })] };
    expect(peutToutRecevoir(auto)).toBe(true);
    expect(motifToutRecevoir(manuel)).toBe("manuel");
    expect(motifToutRecevoir(solde)).toBe("vide");
    expect(achatComplet(solde)).toBe(true);
  });

  it("compare le code au bon de commande et refuse un emplacement d'un autre dépôt", () => {
    const lignes = [ligne(), ligne({ id: 2, quantiteRecue: 10, article: { code: "FINI", codeBarres: "" } })];
    expect(interpreterScan(lignes, "vis").type).toBe("ouvrir");
    expect(interpreterScan(lignes, "ZZZ").type).toBe("hors");
    expect(interpreterScan(lignes, "FINI").type).toBe("complet");
    const liste = [{ id: 8, code: "A-01", barcode: "B1", depotId: 9 }];
    expect(resoudreEmplacement(liste, "A-01", 4).reason).toBe("autre");
    expect(resoudreEmplacement(liste, "INCONNU", 4).reason).toBe("inconnu");
    expect(resoudreEmplacement([{ id: 3, code: "B-02", depotId: 4 }], "B-02", 4).emplacement.id).toBe(3);
  });

  it("trie les retards et retire les achats déjà complets", () => {
    const items = preparerListe([
      { id: 2, depotId: 4, dateLivraisonPrevue: "2026-11-01", reference: "B", fournisseur: { nom: "Sud" }, lignes: [ligne({ quantiteRecue: 0 })] },
      { id: 1, depotId: 9, dateLivraisonPrevue: "2026-10-01", reference: "A", fournisseur: { nom: "Nord" }, lignes: [ligne({ quantiteRecue: 0 })] },
      { id: 3, depotId: 4, reference: "C", lignes: [ligne({ quantiteRecue: 10 })] },
    ]);
    expect(items.map((achat) => achat.id)).toEqual([1, 2]);
    expect(filtrerAchats(items, { scope: "depot", depotId: 4 })).toHaveLength(1);
    expect(filtrerAchats([{ id: 8, depotId: null }], { scope: "depot", depotId: 4 })).toHaveLength(1);
    expect(filtrerAchats(items, { scope: "tous", recherche: "nord" })).toHaveLength(1);
  });

  it("arrête la séquence au premier échec et recharge l'achat", async () => {
    const frais = {
      id: 5,
      statut: "BROUILLON",
      lignes: [
        ligne({ id: 11, quantite: 2, quantiteRecue: 0, article: { modeTracage: "AUCUN", tracageAuto: false } }),
        ligne({ id: 12, quantite: 1, quantiteRecue: 0, article: { modeTracage: "LOT", tracageAuto: true } }),
        ligne({ id: 13, quantite: 1, quantiteRecue: 0, article: { modeTracage: "AUCUN", tracageAuto: false } }),
      ],
    };
    const apres = {
      ...frais,
      statut: "COMMANDE",
      lignes: frais.lignes.map((item) => (item.id === 11 ? { ...item, quantiteRecue: 2 } : item)),
    };
    const ordre = [];
    const client = {
      get: vi.fn()
        .mockResolvedValueOnce({ data: frais })
        .mockResolvedValueOnce({ data: apres }),
      post: vi.fn(async (url) => {
        ordre.push(`debut ${url}`);
        await Promise.resolve();
        ordre.push(`fin ${url}`);
        if (String(url).includes("/12/")) {
          throw Object.assign(new Error("down"), { response: { status: 500, data: { message: "Erreur interne" } } });
        }
        return { data: { statut: "COMMANDE" } };
      }),
    };

    await expect(recevoirLignesEnSequence(client, 5)).rejects.toMatchObject({
      classe: "verifier",
      etat: apres,
    });
    expect(client.post).toHaveBeenCalledTimes(2);
    expect(client.post.mock.calls[0][1]).toEqual({ quantiteRecue: 2 });
    expect(client.post.mock.calls[1][0]).toBe("achats/5/lignes/12/reception");
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(ordre.indexOf("fin achats/5/lignes/11/reception")).toBeLessThan(ordre.indexOf("debut achats/5/lignes/12/reception"));
    expect(bilanLignes(apres)).toEqual({ recues: 1, restantes: 2 });
  });

  it("pagine les deux statuts avant de fusionner", async () => {
    const client = {
      get: vi.fn(async (_url, config) => {
        const { statut, page } = config.params;
        if (page === 1) {
          return { data: { items: [{ id: statut === "BROUILLON" ? 1 : 2, lignes: [ligne({ quantiteRecue: 0 })] }], pages: 2 } };
        }
        return { data: { items: [{ id: statut === "BROUILLON" ? 3 : 4, lignes: [ligne({ quantiteRecue: 10 })] }], pages: 2 } };
      }),
    };
    const items = await chargerAchatsAReceptionner(client);
    expect(items.map((achat) => achat.id).sort()).toEqual([1, 2]);
  });
});

describe("réception — architecture", () => {
  it("n'appelle ni la réception globale ni la confirmation d'achat", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const fichiers = [];
    const pile = [root];
    while (pile.length) {
      const courant = pile.pop();
      for (const nom of fs.readdirSync(courant)) {
        const cible = path.join(courant, nom);
        if (fs.statSync(cible).isDirectory()) pile.push(cible);
        else if (/\.(js|jsx)$/.test(nom)) fichiers.push(cible);
      }
    }
    const interdits = [];
    for (const fichier of fichiers) {
      const source = fs.readFileSync(fichier, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      const textes = source.match(/[`'"][^`'"]*[`'"]/g) || [];
      for (const texte of textes) {
        if (!texte.includes("achats/")) continue;
        const confirmer = `/${"confirmer"}`;
        const reception = `/${"reception"}`;
        const lignes = `/${"lignes"}/`;
        if (texte.includes(confirmer)) interdits.push(texte);
        if (texte.includes(reception) && !texte.includes(lignes)) interdits.push(texte);
      }
    }
    expect(interdits).toEqual([]);
  });
});
