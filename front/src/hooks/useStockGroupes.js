import { useMemo } from "react";

/** CMP affiché : prix d'achat HT (proxy CMP tant que la ligne n'expose pas le CMP dépôt). */
export function getLineCmp(row) {
  return Number(row?.article?.prixAchat) || 0;
}

export function getLineStockMin(row) {
  const seuil = row?.article?.seuilAlerte;
  if (seuil != null && seuil !== "") return Number(seuil);
  const v = row?.quantiteMin ?? row?.article?.stockMin;
  return v != null && v !== "" ? Number(v) : null;
}

export function getLineStockMax(row) {
  const v = row?.quantiteMax ?? row?.article?.stockMax;
  return v != null && v !== "" ? Number(v) : null;
}

export function stockLevelColor(qty, stockMin) {
  const q = Number(qty) || 0;
  const min = stockMin != null ? Number(stockMin) : null;
  if (q === 0) return "#E24B4A";
  if (min != null && q > 0 && q <= min) return "#EF9F27";
  return "#1D9E75";
}

export function computeStockStats(items, depots = [], lotsExpiring = 0) {
  const rows = items || [];
  const articleIds = new Set();
  const depotIds = new Set();
  let valeurTotale = 0;
  let enRupture = 0;
  let stockCritique = 0;

  for (const row of rows) {
    const aid = row.articleId ?? row.article?.id;
    if (aid) articleIds.add(aid);
    if (row.depotId) depotIds.add(row.depotId);

    const cmp = getLineCmp(row);
    const q = Number(row.quantite) || 0;
    valeurTotale += q * cmp;

    const min = getLineStockMin(row);
    if (q === 0) enRupture += 1;
    else if (min != null && q <= min) stockCritique += 1;
  }

  return {
    totalArticles: articleIds.size,
    totalDepots: depotIds.size || (depots?.length ?? 0),
    valeurTotale,
    enRupture,
    stockCritique,
    lotsExpirant: Number(lotsExpiring) || 0,
  };
}

export function groupStockByArticle(items) {
  const map = new Map();

  for (const row of items || []) {
    const aid = row.articleId ?? row.article?.id;
    if (!aid) continue;

    if (!map.has(aid)) {
      const art = row.article || {};
      map.set(aid, {
        articleId: aid,
        code: art.code || "—",
        libelle: art.libelle || "—",
        unite: art.unite || "",
        imageUrl: art.imageUrl || null,
        famille: art.famille?.nom || art.famille?.libelle || null,
        modeGestion: art.modeGestion || "STANDARD",
        modeTracage: art.modeTracage || "AUCUN",
        tracageAuto: Boolean(art.tracageAuto),
        stockMinimum: art.stockMin != null ? Number(art.stockMin) : null,
        stockMaximum: art.stockMax != null ? Number(art.stockMax) : null,
        cmp: getLineCmp(row),
        quantiteTotale: 0,
        nbDepots: new Set(),
        nbEmplacements: new Set(),
        lignes: [],
      });
    } else if (!map.get(aid).imageUrl && row.article?.imageUrl) {
      map.get(aid).imageUrl = row.article.imageUrl;
    }

    const g = map.get(aid);
    g.quantiteTotale += Number(row.quantite) || 0;
    if (row.depotId) g.nbDepots.add(row.depotId);
    if (row.emplacementId) g.nbEmplacements.add(row.emplacementId);
    g.lignes.push({
      ...row,
      cmp: getLineCmp(row),
      stockMin: getLineStockMin(row),
      stockMax: getLineStockMax(row),
      unite: row.article?.unite || g.unite,
      modeGestion: row.article?.modeGestion || g.modeGestion,
    });
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      nbDepots: g.nbDepots.size,
      nbEmplacements: g.nbEmplacements.size,
      lignes: g.lignes.sort((a, b) =>
        `${a.depot?.libelle || ""}`.localeCompare(`${b.depot?.libelle || ""}`, "fr")
      ),
    }))
    .sort((a, b) => a.code.localeCompare(b.code, "fr"));
}

export function groupStockByDepot(items, depots = []) {
  const depotMap = new Map(
    (depots || []).map((d) => [
      d.id,
      {
        id: d.id,
        code: d.code,
        libelle: d.libelle,
        ville: d.ville,
        capacite: d.capacite,
        qteMax: d.qteMax,
        nbArticles: new Set(),
        nbEmplacements: new Set(),
        quantiteTotale: 0,
        valeurCMP: 0,
        nbAlertes: 0,
      },
    ])
  );

  for (const row of items || []) {
    const did = row.depotId;
    if (!did) continue;

    if (!depotMap.has(did)) {
      depotMap.set(did, {
        id: did,
        code: row.depot?.code || "",
        libelle: row.depot?.libelle || `Dépôt #${did}`,
        ville: null,
        capacite: null,
        qteMax: null,
        nbArticles: new Set(),
        nbEmplacements: new Set(),
        quantiteTotale: 0,
        valeurCMP: 0,
        nbAlertes: 0,
      });
    }

    const d = depotMap.get(did);
    const q = Number(row.quantite) || 0;
    const cmp = getLineCmp(row);
    d.quantiteTotale += q;
    d.valeurCMP += q * cmp;
    if (row.articleId) d.nbArticles.add(row.articleId);
    if (row.emplacementId) d.nbEmplacements.add(row.emplacementId);

    const min = getLineStockMin(row);
    if (q === 0 || (min != null && q > 0 && q <= min)) d.nbAlertes += 1;
  }

  return [...depotMap.values()]
    .map((d) => {
      const cap = Number(d.capacite) || Number(d.qteMax) || 0;
      const tauxRemplissage =
        cap > 0 ? Math.min(100, (d.quantiteTotale / cap) * 100) : d.quantiteTotale > 0 ? 45 : 0;
      return {
        ...d,
        nbArticles: d.nbArticles.size,
        nbEmplacements: d.nbEmplacements.size,
        tauxRemplissage,
      };
    })
    .filter((d) => d.nbArticles > 0 || d.quantiteTotale > 0)
    .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
}

export function useStockGroupes(items) {
  return useMemo(() => groupStockByArticle(items), [items]);
}

export function useStockDepotSummaries(items, depots) {
  return useMemo(() => groupStockByDepot(items, depots), [items, depots]);
}

export function useStockStats(items, depots, lotsExpiring) {
  return useMemo(
    () => computeStockStats(items, depots, lotsExpiring),
    [items, depots, lotsExpiring]
  );
}
