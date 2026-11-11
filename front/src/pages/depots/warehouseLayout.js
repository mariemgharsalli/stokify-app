/** Moteur de plan d'entrepôt — aligné sur back/src/utils/warehouseLayout.js */

export const DEFAULT_EMPLACEMENT_CAP = 100;
export const MAX_LAYOUT_BAY = 48;
export const MAX_LAYOUT_DIM = 48;

export function emplacementCapaciteUnits(e) {
  const slots = Number(e?.capaciteSlots);
  if (Number.isFinite(slots) && slots > 0) return slots;
  const n = Number(e?.niveaux);
  if (Number.isFinite(n) && n > 0) return n;
  if (Number.isFinite(Number(e?.capaciteUnites)) && Number(e.capaciteUnites) > 0) {
    return Number(e.capaciteUnites);
  }
  return DEFAULT_EMPLACEMENT_CAP;
}

function isReasonableBay(bay) {
  return Number.isFinite(bay) && bay >= 1 && bay <= MAX_LAYOUT_BAY;
}

export function parseLocationCode(code) {
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

function buildParsedLayout(items) {
  const allees = [...new Set(items.map((e) => e.allee).filter(Boolean))].sort();
  const byId = new Map();
  const cells = [];
  allees.forEach((allee, i) => {
    const rackCol = i * 2;
    items
      .filter((e) => e.allee === allee)
      .forEach((e) => {
        const row = 1 + Math.max(0, (Number(e.bay) || 1) - 1);
        const cell = { id: e.id, col: rackCol, row, allee, bay: e.bay };
        cells.push(cell);
        byId.set(e.id, cell);
      });
  });
  const maxRow = Math.max(1, ...cells.map((c) => c.row));
  const cols = Math.max(1, allees.length * 2 - 1);
  const aisles = [];
  for (let i = 0; i < allees.length - 1; i += 1) {
    aisles.push({ col: i * 2 + 1, fromRow: 1, toRow: maxRow });
  }
  return { mode: "parsed", cols, rows: maxRow + 1, dock: { row: 0, cols }, aisles, allees, byId, cells };
}

function buildGridLayout(items) {
  const n = items.length || 1;
  const rackCols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const aisleEvery = 4;
  const extraAisles = Math.floor((rackCols - 1) / aisleEvery);
  const cols = rackCols + extraAisles;
  const byId = new Map();
  const cells = [];
  items.forEach((e, idx) => {
    const rack = idx % rackCols;
    const extra = Math.floor(rack / aisleEvery);
    const cell = {
      id: e.id,
      col: rack + extra,
      row: 1 + Math.floor(idx / rackCols),
      allee: null,
      bay: rack + 1,
    };
    cells.push(cell);
    byId.set(e.id, cell);
  });
  const aisles = [];
  for (let rack = aisleEvery - 1; rack < rackCols - 1; rack += aisleEvery) {
    const extraBefore = Math.floor(rack / aisleEvery);
    aisles.push({ col: rack + extraBefore + 1, fromRow: 1, toRow: 1 + Math.ceil(n / rackCols) });
  }
  return {
    mode: "grid",
    cols: Math.max(1, cols),
    rows: 1 + Math.ceil(n / rackCols),
    dock: { row: 0, cols: Math.max(1, cols) },
    aisles,
    allees: [],
    byId,
    cells,
  };
}

export function buildClientLayout(emplacements = []) {
  const items = emplacements.map((e) => {
    const parsed = parseLocationCode(e.code);
    return {
      ...e,
      allee: e.allee || parsed.allee,
      bay: isReasonableBay(Number(e.bay ?? parsed.bay)) ? Number(e.bay ?? parsed.bay) : parsed.bay,
      capaciteUnites: emplacementCapaciteUnits(e),
    };
  });
  const withCoord = items.filter((e) => e.allee && isReasonableBay(Number(e.bay)));
  const useParsed = items.length >= 2 && withCoord.length === items.length;
  let raw = useParsed ? buildParsedLayout(items) : buildGridLayout(items);
  if (raw.cols > MAX_LAYOUT_DIM || raw.rows > MAX_LAYOUT_DIM) {
    raw = buildGridLayout(items);
  }
  return {
    ...raw,
    cols: Math.min(MAX_LAYOUT_DIM, raw.cols),
    rows: Math.min(MAX_LAYOUT_DIM, raw.rows),
  };
}

export function isSaneLayoutCoord(col, row, count = 1) {
  const max = Math.min(MAX_LAYOUT_DIM, Math.max(12, count + 4));
  return (
    Number.isFinite(Number(col)) &&
    Number.isFinite(Number(row)) &&
    Number(col) >= 0 &&
    Number(row) >= 0 &&
    Number(col) < max &&
    Number(row) < max
  );
}
