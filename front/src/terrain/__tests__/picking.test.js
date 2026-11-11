import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../../store/authStore";
import {
  classerScan,
  construireLigne,
  construireMission,
  empreinteVente,
  entreeComplete,
  filtrerVentes,
  appliquerQuantiteLot,
  incrementer,
  ligneComplete,
  lireLotsConsumed,
  missionComplete,
  missionTerminee,
  quantiteFaite,
  resteAllocation,
} from "../lib/picking";
import { purgerPick, subscribePickAuthReset, usePickStore, ventesFraiches } from "../store/pickStore";

const maintenant = new Date("2026-10-25T12:00:00");

function ligne(partiel = {}) {
  return {
    id: 1,
    quantite: 2,
    strategieAppliquee: "FEFO",
    lotsConsumed: null,
    article: { code: "VIS", codeBarres: "300", libelle: "Vis", unite: "UN", modeTracage: "AUCUN" },
    ...partiel,
  };
}

describe("préparation — lotsConsumed", () => {
  it("accepte null, un tableau vide et un JSON invalide", () => {
    expect(lireLotsConsumed(null)).toMatchObject({ rows: [], invalid: false, empty: true });
    expect(lireLotsConsumed("[]")).toMatchObject({ rows: [], empty: true, invalid: false });
    expect(lireLotsConsumed("{")).toMatchObject({ rows: [], invalid: true });
    expect(lireLotsConsumed("pas du json")).toMatchObject({ invalid: true });
    expect(() => construireLigne(ligne({ lotsConsumed: "{" }))).not.toThrow();
  });

  it("construit une entrée par lot, par série, ou une quantité", () => {
    const lot = construireLigne(ligne({
      modeTracage: undefined,
      article: { code: "A", libelle: "Loté", modeTracage: "LOT" },
      lotsConsumed: JSON.stringify([
        { lotId: 4, lotNumero: "L-4", quantite: 1.5, dateExpiration: "2026-11-01" },
        { lotId: 5, lotNumero: "L-5", quantite: 0.5, dateExpiration: "2026-12-01" },
      ]),
    }));
    expect(lot.entries.map((entry) => entry.lotNumero)).toEqual(["L-4", "L-5"]);
    expect(lot.allocationAbsente).toBe(false);

    const serie = construireLigne(ligne({
      article: { code: "S", libelle: "Série", modeTracage: "SERIE" },
      lotsConsumed: JSON.stringify([
        { numeroSerieId: 8, numero: "SN-1", lotId: null },
        { numeroSerieId: 9, numero: "SN-2", lotId: 3 },
      ]),
    }));
    expect(serie.entries.map((entry) => [entry.kind, entry.numero, entry.quantite])).toEqual([
      ["serie", "SN-1", 1],
      ["serie", "SN-2", 1],
    ]);

    const mixte = construireLigne(ligne({
      article: { code: "M", libelle: "Mixte", modeTracage: "LOT_SERIE" },
      lotsConsumed: JSON.stringify([
        { lotId: 7, lotNumero: "L-7", quantite: 2, dateExpiration: "2026-10-20", numerosSerie: ["A", "B"] },
      ]),
    }));
    expect(mixte.entries[0]).toMatchObject({ kind: "lot", lotId: 7, quantite: 2, numerosSerie: ["A", "B"] });

    const sans = construireLigne(ligne());
    expect(sans.entries).toEqual([expect.objectContaining({ kind: "quantite", quantite: 2, allocationAbsente: false })]);

    const absente = construireLigne(ligne({
      article: { code: "A", libelle: "Loté", modeTracage: "LOT" },
      lotsConsumed: null,
    }));
    expect(absente.allocationAbsente).toBe(true);
    expect(absente.entries[0].kind).toBe("quantite");
  });
});

describe("préparation — scan", () => {
  const mission = construireMission({
    id: 5,
    statut: "CONFIRME",
    reference: "VTE-1",
    lignes: [
      ligne({
        id: 1,
        quantite: 2,
        article: { code: "VIS", codeBarres: "300", libelle: "Vis", modeTracage: "LOT" },
        lotsConsumed: JSON.stringify([{ lotId: 4, lotNumero: "L-4", quantite: 2, dateExpiration: "2026-11-01" }]),
      }),
      ligne({
        id: 2,
        quantite: 1,
        article: { code: "ECROU", codeBarres: "301", libelle: "Écrou", modeTracage: "SERIE" },
        lotsConsumed: JSON.stringify([{ numeroSerieId: 9, numero: "SN-2", lotId: null }]),
      }),
    ],
  });

  it("reconnaît le lot par son identifiant de QR et par son numéro", () => {
    expect(classerScan(mission, 1, "http://192.168.1.109:5173/stock/lots/scan/4", {}, maintenant).type).toBe("ok");
    expect(classerScan(mission, 1, "L-4", {}, maintenant).type).toBe("ok");
    expect(classerScan(mission, 2, "SN-2", {}, maintenant)).toMatchObject({ type: "ok", ligneId: 2 });
  });

  it("bloque un lot hors allocation et un lot périmé", () => {
    expect(classerScan(mission, 1, "http://192.168.1.109:5173/stock/lots/scan/99", {}, maintenant).type).toBe("bloque-lot");
    expect(classerScan(mission, 1, "L-INCONNU", {}, maintenant).type).toBe("bloque-lot");
    const perime = construireMission({
      id: 6,
      statut: "CONFIRME",
      lignes: [ligne({
        article: { code: "VIS", libelle: "Vis", modeTracage: "LOT" },
        lotsConsumed: JSON.stringify([{ lotId: 4, lotNumero: "L-4", quantite: 1, dateExpiration: "2026-10-24" }]),
      })],
    });
    expect(classerScan(perime, 1, "L-4", {}, maintenant).type).toBe("bloque-expire");
  });

  it("borne la quantité, puis complète la ligne et la mission", () => {
    const entry = mission.lignes[0].entries[0];
    let etat = { count: 0, series: [] };
    etat = incrementer(entry, etat);
    expect(quantiteFaite(entry, etat)).toBe(1);
    expect(classerScan(mission, 1, "L-4", { 1: { [entry.id]: etat } }, maintenant).type).toBe("ok");
    etat = incrementer(entry, etat);
    expect(quantiteFaite(entry, etat)).toBe(2);
    expect(entreeComplete(entry, etat)).toBe(true);
    expect(classerScan(mission, 1, "L-4", { 1: { [entry.id]: etat } }, maintenant).type).toBe("complet");
    etat = incrementer(entry, etat);
    expect(quantiteFaite(entry, etat)).toBe(2);

    const partiel = { 1: { [entry.id]: { count: 2, series: [] } } };
    expect(ligneComplete(mission.lignes[0], partiel)).toBe(true);
    expect(missionComplete(mission, partiel)).toBe(false);
    const serie = mission.lignes[1].entries[0];
    const plein = {
      ...partiel,
      2: { [serie.id]: incrementer(serie, { count: 0, series: [] }) },
    };
    expect(missionComplete(mission, plein)).toBe(true);
  });

  it("compte chaque numéro de série d'un lot, une seule fois", () => {
    const mixte = construireMission({
      id: 7,
      statut: "CONFIRME",
      lignes: [ligne({
        quantite: 2,
        article: { code: "M", libelle: "Mixte", modeTracage: "LOT_SERIE" },
        lotsConsumed: JSON.stringify([{ lotId: 7, lotNumero: "L-7", quantite: 2, dateExpiration: "2026-12-01", numerosSerie: ["A", "B"] }]),
      })],
    });
    const verdict = classerScan(mixte, 1, "A", {}, maintenant);
    expect(verdict).toMatchObject({ type: "ok", serie: "A" });
    const entry = mixte.lignes[0].entries[0];
    const etat = incrementer(entry, { count: 0, series: [] }, verdict.serie);
    expect(quantiteFaite(entry, etat)).toBe(1);
    expect(classerScan(mixte, 1, "A", { 1: { [entry.id]: etat } }, maintenant).type).toBe("deja");
    expect(classerScan(mixte, 1, "L-7", { 1: { [entry.id]: etat } }, maintenant).type).toBe("ok");
  });

  it("borne la quantité d'un lot au reste de son allocation", () => {
    const entry = mission.lignes[0].entries[0];
    expect(resteAllocation(entry, { count: 1, series: [] })).toBe(1);
    expect(appliquerQuantiteLot(entry, { count: 1, series: [] }, 1).ok).toBe(true);
    expect(appliquerQuantiteLot(entry, { count: 1, series: [] }, 2).ok).toBe(false);
    const bloquees = { 1: { motif: "perime" } };
    expect(missionTerminee(mission, {}, bloquees)).toBe(false);
    expect(missionTerminee({ lignes: [mission.lignes[0]] }, {}, bloquees)).toBe(true);
  });

  it("propose la ligne qui porte l'article", () => {
    expect(classerScan(mission, 1, "ECROU", {}, maintenant)).toMatchObject({ type: "autre-ligne", ligneId: 2 });
  });

  it("filtre par dépôt en gardant les ventes sans dépôt", () => {
    const items = [
      { id: 1, depotId: 4, reference: "A", client: { nom: "Nord" }, dateVente: "2026-10-02" },
      { id: 2, depotId: 9, reference: "B", client: { nom: "Sud" }, dateVente: "2026-10-01" },
      { id: 3, depotId: null, reference: "C", client: { nom: "Nord" }, dateVente: "2026-10-03" },
    ];
    expect(filtrerVentes(items, { scope: "depot", depotId: 4 }).map((vente) => vente.id)).toEqual([1, 3]);
    expect(filtrerVentes(items, { scope: "tous" })).toHaveLength(3);
    expect(filtrerVentes(items, { scope: "tous", recherche: "nord" })).toHaveLength(2);
  });
});

describe("préparation — progression locale", () => {
  beforeEach(() => {
    purgerPick();
    useAuthStore.setState({ token: null, user: null, activeSocieteId: null });
  });

  it("survit à un rechargement, expire après 24 h et disparaît au logout", () => {
    usePickStore.getState().bind("1:7");
    usePickStore.getState().enregistrer("5", {
      fingerprint: "abc",
      scan: true,
      lignes: { 1: { qte: { count: 1, series: [] } } },
      complete: true,
    });
    usePickStore.setState({ sessionKey: null, ventes: {} });
    usePickStore.getState().bind("1:7");
    expect(usePickStore.getState().ventes["5"].complete).toBe(true);
    expect(usePickStore.getState().ventes["5"].lignes["1"].qte.count).toBe(1);

    const vieux = Date.now() - 25 * 60 * 60 * 1000;
    expect(ventesFraiches({ 5: { updatedAt: vieux, lignes: {} } })["5"]).toBeUndefined();

    const unsub = subscribePickAuthReset();
    useAuthStore.setState({ token: "jeton", user: { id: 7, role: "MAGASINIER", societeId: 1 }, activeSocieteId: null });
    useAuthStore.getState().logout();
    expect(localStorage.getItem("stokify-terrain-pick:1:7")).toBeNull();
    expect(usePickStore.getState().ventes).toEqual({});
    unsub();
  });

  it("garde une anomalie locale dans la préparation", () => {
    usePickStore.getState().bind("1:7");
    usePickStore.getState().enregistrer("5", {
      fingerprint: "a",
      anomalie: { ligneId: 9, motif: "perime", detail: "lot L-1" },
      bloquee: { ligneId: 9, motif: "perime" },
    });
    expect(usePickStore.getState().ventes["5"].bloquees["9"].motif).toBe("perime");
    expect(usePickStore.getState().ventes["5"].anomalies).toHaveLength(1);
    usePickStore.getState().enregistrer("5", { fingerprint: "a", scan: true });
    expect(usePickStore.getState().ventes["5"].anomalies).toHaveLength(1);
  });

  it("oublie la session précédente", () => {
    usePickStore.getState().bind("1:7");
    usePickStore.getState().enregistrer("5", { fingerprint: empreinteVente({ id: 5, lignes: [] }), scan: true });
    usePickStore.getState().bind("1:8");
    expect(localStorage.getItem("stokify-terrain-pick:1:7")).toBeNull();
    expect(usePickStore.getState().ventes["5"]).toBeUndefined();
  });
});

describe("préparation — architecture", () => {
  it("n'appelle aucun chemin de sortie de stock ni de changement de statut", () => {
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
    const lotFifo = `${"sortie"}-${"fifo"}-${"fefo"}`;
    const apercu = `${"preview"}-${"pick"}`;
    const confirmer = `/${"confirmer"}`;
    const livrer = `/${"livrer"}`;
    const reception = `/${"reception"}`;
    const lignes = `/${"lignes"}/`;
    const achats = `${"achats"}/`;
    const bascule = `${"toggle"}-${"actif"}`;
    const ligneStock = `${"stock"}/${"lines"}`;
    const statutLigne = `/${"statut"}`;
    const transfertsV1 = `${"mouvements"}/${"transferts"}`;
    const entree = `${"mouvements"}/${"entree"}`;
    const sortie = `${"mouvements"}/${"sortie"}`;
    const valider = `/${"valider"}`;
    const rejeter = `/${"rejeter"}`;
    const annuler = `/${"cancel"}`;
    const dupliquer = `/${"duplicate"}`;
    const recomptage = `/${"recomptage"}`;
    const autoSave = `/${"auto"}-${"save"}`;
    const exportExcel = `${"export"}-${"excel"}`;
    const exportPdf = `${"export"}-${"pdf"}`;
    const theorie = `${"qteTheorique"}:`;
    const appelPatch = `.${"patch"}(`;
    const appelDelete = `.${"delete"}(`;
    const appelPut = `.${"put"}(`;
    const dossierInventaire = `${"inven"}${"taires"}`;
    const creationInventaire = new RegExp(`post\\(\\s*[${"`"}'"]${dossierInventaire}[${"`"}'"]`);
    const exportNu = `/${"export"}`;
    const interdits = [];
    for (const fichier of fichiers) {
      const source = fs.readFileSync(fichier, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      if (source.includes(bascule) || source.includes(transfertsV1) || source.includes(entree) || source.includes(sortie) || source.includes(valider) || source.includes(rejeter) || source.includes(annuler) || source.includes(dupliquer) || source.includes(recomptage) || source.includes(autoSave) || source.includes(exportExcel) || source.includes(exportPdf)) {
        interdits.push(fichier);
      }
      if (source.includes(appelPatch) && (source.includes(ligneStock) || source.includes(theorie))) interdits.push(fichier);
      if (source.includes(appelDelete) && (source.includes(ligneStock) || source.includes(dossierInventaire))) interdits.push(fichier);
      if (source.includes(appelPut) && source.includes(dossierInventaire)) interdits.push(fichier);
      if (creationInventaire.test(source)) interdits.push(fichier);
      if (source.includes(exportNu)) interdits.push(fichier);
      const textes = source.match(/[`'"][^`'"]*[`'"]/g) || [];
      for (const texte of textes) {
        if (texte.includes(lotFifo) || texte.includes(apercu) || texte.includes(confirmer) || texte.includes(livrer)) {
          interdits.push(texte);
        }
        if (texte.includes(ligneStock) && texte.includes(statutLigne)) interdits.push(texte);
        if (texte.includes(achats) && texte.includes(reception) && !texte.includes(lignes)) interdits.push(texte);
      }
    }
    expect(interdits).toEqual([]);
  });
});
