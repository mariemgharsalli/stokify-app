/**
 * Source unique d'occupation et de plan d'entrepôt (KPI, 2D, 3D, slotting).
 *
 * Capacité d'un emplacement :
 *   capaciteSlots > 0  →  niveaux > 0  →  100
 *
 * Codes reconnus : A-01, A-01-02, A01, A01-3, R1-E3, ZONE-A-12
 * Fallback : grille compacte + allée tous les 4 rayons + quai en rangée 0.
 */

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const DEFAULT_EMPLACEMENT_CAP = 100;
/** Au-delà, un numéro dans le code n'est plus une baie (évite un plan 1×6282 qui fige le navigateur). */
const MAX_LAYOUT_BAY = 48;
const MAX_LAYOUT_DIM = 48;

function isReasonableBay(bay) {
  return Number.isFinite(bay) && bay >= 1 && bay <= MAX_LAYOUT_BAY;
}

function emplacementCapaciteUnits(e) {
  const slots = Number(e?.capaciteSlots);
  if (Number.isFinite(slots) && slots > 0) return slots;
  const n = Number(e?.niveaux);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_EMPLACEMENT_CAP;
}

function heatFromRate(pct, qty) {
  if (!qty || Number(qty) <= 0) return "empty";
  if (pct > 80) return "critical";
  if (pct >= 50) return "warning";
  return "normal";
}

function parseLocationCode(code) {
  const raw = String(code || "").trim().toUpperCase();
  if (!raw) return { allee: null, bay: null, niveau: null, mode: "grid" };

  const parsed = (allee, bay, niveau = null) => {
    if (!isReasonableBay(bay)) return { allee: null, bay: null, niveau: null, mode: "grid" };
    if (niveau != null && (!Number.isFinite(niveau) || niveau < 0 || niveau > 30)) {
      return { allee: null, bay: null, niveau: null, mode: "grid" };
    }
    return { allee, bay, niveau, mode: "parsed" };
  };

  let m = raw.match(/^ZONE[-_]?([A-Z])[-_]?(\d{1,4})$/);
  if (m) return parsed(m[1], Number(m[2]));

  m = raw.match(/^R(\d{1,3})[-_]?E(\d{1,4})$/);
  if (m) return parsed(`R${m[1]}`, Number(m[2]));

  m = raw.match(/^([A-Z]{1,4})[-_](\d{1,2})(?:[-_](\d{1,2}))?$/);
  if (m) return parsed(m[1], Number(m[2]), m[3] != null ? Number(m[3]) : null);

  m = raw.match(/^([A-Z]{1,2})(\d{1,2})(?:[-_](\d{1,2}))?$/);
  if (m) return parsed(m[1], Number(m[2]), m[3] != null ? Number(m[3]) : null);

  return { allee: null, bay: null, niveau: null, mode: "grid" };
}

function zoneOf(emplacement, parsed) {
  const cat = String(emplacement?.categorie || "").trim().toUpperCase();
  if (cat && cat !== "AUTRE") return cat;
  if (parsed?.allee) return `ALLÉE ${parsed.allee}`;
  return "GÉNÉRAL";
}

function stockQtyFromRows(stocks) {
  return (stocks || []).reduce((s, x) => s + Number(x.quantite || 0), 0);
}

function mapEmplacementOccupancy(e) {
  const stocks = e.stocks || [];
  const stockActuel = stockQtyFromRows(stocks);
  const nbArticles = new Set(
    stocks.filter((x) => Number(x.quantite) > 0).map((x) => x.articleId)
  ).size;
  const capaciteUnites = emplacementCapaciteUnits(e);
  const remplissagePct =
    capaciteUnites > 0 ? Math.min(100, round1((stockActuel / capaciteUnites) * 100)) : 0;
  const parsed = parseLocationCode(e.code);
  const topArticles = stocks
    .filter((x) => Number(x.quantite) > 0 && x.article)
    .reduce((acc, x) => {
      const id = x.articleId;
      if (!acc[id]) {
        acc[id] = { libelle: x.article.libelle, code: x.article.code, quantite: 0 };
      }
      acc[id].quantite += Number(x.quantite || 0);
      return acc;
    }, {});
  const topArticlesList = Object.values(topArticles)
    .sort((a, b) => b.quantite - a.quantite)
    .slice(0, 3);

  return {
    id: e.id,
    code: e.code,
    libelle: e.libelle,
    categorie: e.categorie,
    barcode: e.barcode,
    niveaux: e.niveaux,
    capaciteSlots: e.capaciteSlots ?? null,
    zoneDangereuse: Boolean(e.zoneDangereuse),
    categorieAutorisee: e.categorieAutorisee || null,
    distanceQuai: e.distanceQuai != null ? Number(e.distanceQuai) : 50,
    depotId: e.depotId,
    stockActuel: round1(stockActuel),
    nbArticles,
    capaciteUnites,
    remplissagePct,
    heat: heatFromRate(remplissagePct, stockActuel),
    allee: parsed.allee,
    bay: parsed.bay,
    niveauCode: parsed.niveau,
    zone: zoneOf(e, parsed),
    topArticles: topArticlesList,
    statut: e.statut ?? "ACTIF",
    stocks: stocks.map((s) => ({
      id: s.id,
      quantite: s.quantite,
      articleId: s.articleId,
      article: s.article
        ? {
            id: s.article.id,
            code: s.article.code,
            libelle: s.article.libelle,
            familleId: s.article.familleId ?? null,
            poids: s.article.poids ?? null,
            volume: s.article.volume ?? null,
          }
        : null,
    })),
  };
}

function buildParsedLayout(mapped) {
  const allees = [...new Set(mapped.map((e) => e.allee).filter(Boolean))].sort();
  const maxBay = Math.max(1, ...mapped.map((e) => Number(e.bay) || 1));
  const dockRow = 0;
  const cells = [];
  const byKey = new Map();

  allees.forEach((allee, i) => {
    const rackCol = i * 2;
    mapped
      .filter((e) => e.allee === allee)
      .forEach((e) => {
        const row = dockRow + 1 + Math.max(0, (Number(e.bay) || 1) - 1);
        const cell = {
          id: e.id,
          kind: "slot",
          col: rackCol,
          row,
          allee,
          bay: e.bay,
        };
        cells.push(cell);
        byKey.set(e.id, cell);
      });
  });

  const maxRow = Math.max(dockRow + 1, ...cells.map((c) => c.row));
  const cols = Math.max(1, allees.length * 2 - 1);
  const aisles = [];
  for (let i = 0; i < allees.length - 1; i += 1) {
    aisles.push({ col: i * 2 + 1, fromRow: 1, toRow: maxRow });
  }

  return {
    mode: "parsed",
    cols,
    rows: maxRow + 1,
    dock: { row: dockRow, cols },
    aisles,
    allees,
    cells,
    byId: byKey,
  };
}

function buildGridLayout(mapped) {
  const n = mapped.length || 1;
  const rackCols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const aisleEvery = 4;
  const colForIndex = (idx) => {
    const rack = idx % rackCols;
    const extraAisles = Math.floor(rack / aisleEvery);
    return rack + extraAisles;
  };
  const maxRackCol = rackCols - 1;
  const extraAisles = Math.floor(maxRackCol / aisleEvery);
  const cols = rackCols + extraAisles;
  const rowsOfRacks = Math.ceil(n / rackCols) || 1;
  const dockRow = 0;
  const cells = [];
  const byKey = new Map();

  mapped.forEach((e, idx) => {
    const rack = idx % rackCols;
    const row = dockRow + 1 + Math.floor(idx / rackCols);
    const col = colForIndex(idx);
    const cell = { id: e.id, kind: "slot", col, row, allee: null, bay: rack + 1 };
    cells.push(cell);
    byKey.set(e.id, cell);
  });

  const aisles = [];
  for (let rack = aisleEvery - 1; rack < rackCols - 1; rack += aisleEvery) {
    const extraBefore = Math.floor(rack / aisleEvery);
    aisles.push({
      col: rack + extraBefore + 1,
      fromRow: 1,
      toRow: dockRow + rowsOfRacks,
    });
  }

  return {
    mode: "grid",
    cols: Math.max(1, cols),
    rows: dockRow + 1 + rowsOfRacks,
    dock: { row: dockRow, cols: Math.max(1, cols) },
    aisles,
    allees: [],
    cells,
    byId: byKey,
  };
}

function heatmapFromMapped(mapped) {
  const counts = { empty: 0, normal: 0, warning: 0, critical: 0 };
  mapped.forEach((e) => {
    counts[e.heat] = (counts[e.heat] || 0) + 1;
  });
  const avg =
    mapped.length > 0
      ? round1(mapped.reduce((s, e) => s + Number(e.remplissagePct || 0), 0) / mapped.length)
      : 0;
  return { ...counts, avg, total: mapped.length };
}

function buildWarehouseLayout(emplacements) {
  const mapped = (emplacements || []).map((e) =>
    e.capaciteUnites != null ? e : mapEmplacementOccupancy(e)
  );
  const withCoord = mapped.filter((e) => e.allee && isReasonableBay(Number(e.bay)));
  const useParsed = mapped.length >= 2 && withCoord.length === mapped.length;
  let raw = useParsed ? buildParsedLayout(mapped) : buildGridLayout(mapped);
  if (raw.cols > MAX_LAYOUT_DIM || raw.rows > MAX_LAYOUT_DIM) {
    raw = buildGridLayout(mapped);
  }
  const zones = [...new Set(mapped.map((e) => e.zone).filter(Boolean))];

  return {
    mode: raw.mode,
    cols: Math.min(MAX_LAYOUT_DIM, raw.cols),
    rows: Math.min(MAX_LAYOUT_DIM, raw.rows),
    dock: raw.dock,
    aisles: raw.aisles,
    allees: raw.allees,
    zones,
    heatmap: heatmapFromMapped(mapped),
    cells: raw.cells,
    byId: raw.byId,
  };
}

function attachLayoutToEmplacement(e, layout) {
  const cell = layout?.byId?.get(e.id);
  return {
    ...e,
    layoutCol: cell?.col ?? null,
    layoutRow: cell?.row ?? null,
    layoutKind: cell?.kind || "slot",
  };
}

function computePhysicalOccupancy(stocks) {
  let poids = 0;
  let volume = 0;
  for (const s of stocks || []) {
    const q = Number(s.quantite || 0);
    const art = s.article || {};
    poids += q * Number(art.poids || 0);
    volume += q * Number(art.volume || 0);
  }
  return { poids: round2(poids), volume: round2(volume) };
}

function pctOrNull(used, cap) {
  const c = Number(cap);
  if (!Number.isFinite(c) || c <= 0) return null;
  return Math.min(999, round1((Number(used) / c) * 100));
}

module.exports = {
  DEFAULT_EMPLACEMENT_CAP,
  MAX_LAYOUT_BAY,
  MAX_LAYOUT_DIM,
  round1,
  round2,
  emplacementCapaciteUnits,
  heatFromRate,
  parseLocationCode,
  mapEmplacementOccupancy,
  buildWarehouseLayout,
  attachLayoutToEmplacement,
  computePhysicalOccupancy,
  pctOrNull,
};
