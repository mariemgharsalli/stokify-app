const { parse } = require("csv-parse/sync");
const ExcelJS = require("exceljs");
const prisma = require("../../config/database");
const { getSocieteWhere, requireActiveSocieteId, stripSocieteFromBody } = require("../../utils/societeScope");
const { normalizeCode, createWithAutoCode, resolveAutoCode } = require("../../utils/codeUtils");
const { parseArticleTracage } = require("../../validation/article.schema");
const { assertDepotOperable, assertEmplacementOperable } = require("../../utils/warehouseOps");
const { evaluateCompatibility } = require("../../utils/emplacementCompatibility");

function normalizeCsvHeader(value) {
  return String(value ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function normalizeImportRow(raw) {
  const row = {};
  for (const [key, value] of Object.entries(raw || {})) {
    row[normalizeCsvHeader(key)] = value == null ? "" : String(value).trim();
  }
  return {
    code: row.code || row.reference || "",
    designation: row.designation || row.libelle || row.label || "",
    famille: row.famille || row.family || "",
    sousFamille: row.sous_famille || row.sousfamille || "",
    marque: row.marque || row.brand || "",
    fournisseur: row.fournisseur || row.supplier || "",
    prixUnitaire: row.prix_unitaire || row.prix_achat || row.prixachat || "",
    prixCatalogue: row.prix_catalogue || row.prix_vente || row.prixvente || "",
    stockMin: row.stock_min || row.stockmin || "",
    stock: row.stock || row.quantite || row.quantity || "",
    depot: row.depot || row.entrepot || "",
    emplacement: row.emplacement || row.location || "",
  };
}

function createImportTracker() {
  return {
    fournisseurs: new Set(),
    marques: new Set(),
    familles: new Set(),
    sousFamilles: new Set(),
    emplacements: new Set(),
  };
}

function serializeEntitesCreees(tracker) {
  if (!tracker) {
    return {
      fournisseurs: [],
      marques: [],
      familles: [],
      sousFamilles: [],
      emplacements: [],
    };
  }
  return {
    fournisseurs: [...tracker.fournisseurs],
    marques: [...tracker.marques],
    familles: [...tracker.familles],
    sousFamilles: [...tracker.sousFamilles],
    emplacements: [...tracker.emplacements],
  };
}

function slugCodeFromLabel(label, fallback = "REF") {
  const base = String(label || fallback)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return (base || fallback).slice(0, 20);
}

async function findOrCreateFamille(label, societeId, tracker) {
  const key = String(label || "").trim();
  if (!key) {
    const err = new Error("Famille manquante");
    err.status = 400;
    throw err;
  }
  const existing = await prisma.famille.findFirst({
    where: {
      societeId: Number(societeId),
      OR: [{ nom: key }, { code: key }],
    },
  });
  if (existing) return existing;

  const codeBase = slugCodeFromLabel(key, "FAM");
  let code = codeBase;
  let suffix = 1;
  while (await prisma.famille.findFirst({ where: { societeId: Number(societeId), code } })) {
    suffix += 1;
    code = `${codeBase.slice(0, 16)}_${suffix}`;
  }
  const created = await prisma.famille.create({
    data: { code, nom: key, societeId: Number(societeId) },
  });
  tracker?.familles?.add(key);
  return created;
}

async function findOrCreateSousFamille(label, familleId, societeId, tracker) {
  const key = String(label || "").trim();
  if (!key) {
    const err = new Error("Sous-famille manquante");
    err.status = 400;
    throw err;
  }
  const existing = await prisma.sousFamille.findFirst({
    where: {
      societeId: Number(societeId),
      familleId: Number(familleId),
      OR: [{ nom: key }, { code: key }],
    },
  });
  if (existing) return existing;

  const codeBase = slugCodeFromLabel(key, "SF");
  let code = codeBase;
  let suffix = 1;
  while (await prisma.sousFamille.findFirst({ where: { societeId: Number(societeId), code } })) {
    suffix += 1;
    code = `${codeBase.slice(0, 16)}_${suffix}`;
  }
  const created = await prisma.sousFamille.create({
    data: {
      code,
      nom: key,
      societeId: Number(societeId),
      familleId: Number(familleId),
    },
  });
  tracker?.sousFamilles?.add(key);
  return created;
}

async function findOrCreateMarque(label, societeId, tracker) {
  const key = String(label || "").trim();
  if (!key) return null;
  const existing = await prisma.marque.findFirst({
    where: {
      societeId: Number(societeId),
      OR: [{ nom: key }, { code: key }],
    },
  });
  if (existing) return existing;

  const codeBase = slugCodeFromLabel(key, "MAR");
  let code = codeBase;
  let suffix = 1;
  while (await prisma.marque.findFirst({ where: { societeId: Number(societeId), code } })) {
    suffix += 1;
    code = `${codeBase.slice(0, 16)}_${suffix}`;
  }
  const created = await prisma.marque.create({
    data: { code, nom: key, societeId: Number(societeId) },
  });
  tracker?.marques?.add(key);
  return created;
}

async function findOrCreateFournisseur(label, societeId, tracker) {
  const key = String(label || "").trim();
  if (!key) {
    const err = new Error("Fournisseur manquant");
    err.status = 400;
    throw err;
  }
  const existing = await prisma.fournisseur.findFirst({
    where: {
      societeId: Number(societeId),
      OR: [{ nom: key }, { code: key }],
    },
  });
  if (existing) return existing;

  const codeBase = slugCodeFromLabel(key, "FOU");
  let code = codeBase;
  let suffix = 1;
  while (await prisma.fournisseur.findFirst({ where: { societeId: Number(societeId), code } })) {
    suffix += 1;
    code = `${codeBase.slice(0, 16)}_${suffix}`;
  }
  const created = await prisma.fournisseur.create({
    data: { code, nom: key, societeId: Number(societeId) },
  });
  tracker?.fournisseurs?.add(key);
  return created;
}

async function findOrCreateEmplacement(label, depotLabel, societeId, tracker) {
  const key = String(label || "").trim();
  if (!key) {
    const err = new Error("Emplacement manquant");
    err.status = 400;
    throw err;
  }

  const existing = await prisma.emplacement.findFirst({
    where: {
      OR: [{ code: key }, { libelle: key }],
      depot: { societeId: Number(societeId) },
    },
    include: { depot: true },
  });
  if (existing) return existing;

  let depot;
  const depotKey = String(depotLabel || "").trim();
  if (depotKey) {
    depot = await prisma.depot.findFirst({
      where: {
        societeId: Number(societeId),
        OR: [{ libelle: depotKey }, { code: depotKey }],
      },
    });
    if (!depot) {
      const err = new Error(
        `Dépôt introuvable : « ${depotKey} » (les dépôts ne sont pas créés automatiquement)`
      );
      err.status = 400;
      throw err;
    }
  } else {
    const depots = await prisma.depot.findMany({ where: { societeId: Number(societeId) } });
    if (depots.length === 1) {
      depot = depots[0];
    } else if (depots.length === 0) {
      const err = new Error("Aucun dépôt configuré pour cette société — créez-en un avant d'importer");
      err.status = 400;
      throw err;
    } else {
      const err = new Error(
        `Emplacement « ${key} » : précisez une colonne 'depot' (plusieurs dépôts existent : ${depots.map((d) => d.libelle || d.code).join(", ")})`
      );
      err.status = 400;
      throw err;
    }
  }

  const codeBase = slugCodeFromLabel(key, "EMP");
  let code = codeBase;
  let suffix = 1;
  while (await prisma.emplacement.findFirst({ where: { code, depotId: depot.id } })) {
    suffix += 1;
    code = `${codeBase.slice(0, 16)}_${suffix}`;
  }

  const created = await prisma.emplacement.create({
    data: { code, libelle: key, depotId: depot.id },
    include: { depot: true },
  });
  tracker?.emplacements?.add(key);
  return created;
}

function parseImportNumber(value, fieldName, { required = false, min = 0 } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    if (required) {
      const err = new Error(`${fieldName} manquant`);
      err.status = 400;
      throw err;
    }
    return null;
  }
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < min) {
    const err = new Error(`${fieldName} invalide : « ${value} »`);
    err.status = 400;
    throw err;
  }
  return n;
}

function isXlsxBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function formatExcelCellValue(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (value.result != null) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join("").trim();
    if (value instanceof Date) return value.toLocaleDateString("fr-FR");
    if (value.text != null) return String(value.text).trim();
  }
  return String(value).trim();
}

function parseCsvRecords(buffer) {
  try {
    return parse(buffer, {
      columns: (headers) => headers.map(normalizeCsvHeader),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
      relax_quotes: true,
    });
  } catch (error) {
    const err = new Error(`Fichier CSV invalide : ${error.message}`);
    err.status = 400;
    throw err;
  }
}

async function parseXlsxRecords(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (error) {
    const err = new Error(`Fichier Excel invalide : ${error.message}`);
    err.status = 400;
    throw err;
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    const err = new Error("Le fichier Excel ne contient aucune feuille");
    err.status = 400;
    throw err;
  }

  const records = [];
  let headers = null;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      headers = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = normalizeCsvHeader(cell.value);
      });
      return;
    }
    if (!headers) return;

    const raw = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (!header) return;
      raw[header] = formatExcelCellValue(cell.value);
    });
    records.push(raw);
  });

  if (!headers || headers.every((h) => !h)) {
    const err = new Error("Le fichier Excel ne contient pas d'en-têtes valides");
    err.status = 400;
    throw err;
  }

  if (records.length === 0) {
    const err = new Error("Le fichier Excel ne contient aucune ligne de données");
    err.status = 400;
    throw err;
  }

  return records;
}

async function importArticlesFromFile(buffer, societeId) {
  const sid = requireActiveSocieteId(societeId);
  let records;
  if (isXlsxBuffer(buffer)) {
    records = await parseXlsxRecords(buffer);
  } else {
    records = parseCsvRecords(buffer);
    if (!Array.isArray(records) || records.length === 0) {
      const err = new Error("Le fichier CSV ne contient aucune ligne de données");
      err.status = 400;
      throw err;
    }
  }

  let success = 0;
  const errors = [];
  const tracker = createImportTracker();

  for (let i = 0; i < records.length; i += 1) {
    const line = i + 2;
    try {
      const row = normalizeImportRow(records[i]);
      if (!row.code && !row.designation && !row.famille) {
        continue;
      }
      if (!row.code) {
        throw new Error("Code article manquant");
      }
      if (!row.designation) {
        throw new Error("Désignation manquante");
      }

      const duplicate = await prisma.article.findFirst({
        where: { societeId: sid, code: row.code },
      });
      if (duplicate) {
        throw new Error(`Code article déjà existant : « ${row.code} »`);
      }

      const famille = await findOrCreateFamille(row.famille, sid, tracker);
      const sousFamille = await findOrCreateSousFamille(row.sousFamille, famille.id, sid, tracker);
      const fournisseur = await findOrCreateFournisseur(row.fournisseur, sid, tracker);
      const marque = row.marque ? await findOrCreateMarque(row.marque, sid, tracker) : null;
      const emplacement = await findOrCreateEmplacement(row.emplacement, row.depot, sid, tracker);

      const prixAchat = parseImportNumber(row.prixUnitaire, "Prix unitaire") ?? 0;
      const prixVente = parseImportNumber(row.prixCatalogue, "Prix catalogue") ?? 0;
      const stockMin = parseImportNumber(row.stockMin, "Stock minimum");
      const quantiteInitiale = parseImportNumber(row.stock, "Stock") ?? 0;

      if (prixAchat > 0 && prixVente > 0 && prixVente < prixAchat) {
        throw new Error("Prix catalogue doit être ≥ prix unitaire");
      }

      await createArticle(
        {
          code: row.code,
          libelle: row.designation,
          familleId: famille.id,
          sousFamilleId: sousFamille.id,
          fournisseurId: fournisseur.id,
          depotId: emplacement.depotId,
          emplacementId: emplacement.id,
          marqueId: marque?.id ?? null,
          prixAchat,
          prixVente,
          stockMin,
          quantiteInitiale,
          unite: "UN",
        },
        sid
      );
      success += 1;
    } catch (error) {
      errors.push({
        line,
        message: error.message || "Erreur inconnue",
      });
    }
  }

  return { success, failed: errors.length, errors, entitesCreees: serializeEntitesCreees(tracker) };
}

const importArticlesFromCsv = importArticlesFromFile;

const VALID_STRATEGIES = new Set(["FIFO", "FEFO", "STANDARD"]);

function normalizeStrategieSortie(value, fallback = "FIFO") {
  const s = String(value ?? fallback).trim().toUpperCase();
  return VALID_STRATEGIES.has(s) ? s : fallback;
}

async function loadTracageMeta(articleIds) {
  const ids = [...new Set((articleIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return new Map();
  const [lotsActifs, seriesDispo, lotsTotal, seriesTotal] = await Promise.all([
    prisma.lot.groupBy({
      by: ["articleId"],
      where: { articleId: { in: ids }, statut: "ACTIF", quantiteRestante: { gt: 0 } },
      _count: { _all: true },
    }),
    prisma.numeroSerie.groupBy({
      by: ["articleId"],
      where: { articleId: { in: ids }, statut: "DISPONIBLE" },
      _count: { _all: true },
    }),
    prisma.lot.groupBy({
      by: ["articleId"],
      where: { articleId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.numeroSerie.groupBy({
      by: ["articleId"],
      where: { articleId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const map = new Map();
  const bump = (rows, key) => {
    for (const row of rows) {
      const prev = map.get(row.articleId) || {
        lotsActifs: 0,
        seriesDispo: 0,
        lotsTotal: 0,
        seriesTotal: 0,
      };
      prev[key] = row._count?._all ?? 0;
      map.set(row.articleId, prev);
    }
  };
  bump(lotsActifs, "lotsActifs");
  bump(seriesDispo, "seriesDispo");
  bump(lotsTotal, "lotsTotal");
  bump(seriesTotal, "seriesTotal");
  return map;
}

function withTracageMeta(article, meta) {
  if (!article) return article;
  const m = meta || {};
  const lotsActifs = Number(m.lotsActifs || 0);
  const seriesDispo = Number(m.seriesDispo || 0);
  const lotsTotal = Number(m.lotsTotal || 0);
  const seriesTotal = Number(m.seriesTotal || 0);
  return {
    ...article,
    tracageLocked: lotsActifs > 0 || seriesDispo > 0,
    tracageHasHistory: lotsTotal > 0 || seriesTotal > 0,
    lotsActifsCount: lotsActifs,
    seriesDispoCount: seriesDispo,
  };
}

function parseOptionalNonNegativeFloat(val, fieldName) {
  if (val == null || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error(`${fieldName} doit etre un nombre >= 0`);
    err.status = 400;
    throw err;
  }
  return n;
}

function normalizeImageUrl(v) {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim().replace(/\\/g, "/");
  if (s.length > 2048) return null;
  const stripApi = (pathname) => String(pathname || "").replace(/^\/api(?=\/uploads\/)/i, "");
  try {
    const u = new URL(s);
    const p = stripApi(u.pathname || "");
    if (p.startsWith("/uploads/")) {
      return p + (u.search || "") + (u.hash || "");
    }
    return s;
  } catch {
    let t = stripApi(s.startsWith("/") ? s : s.startsWith("uploads/") ? `/${s}` : s);
    if (t.startsWith("/uploads/")) return t;
    return s;
  }
}

async function resolveGroupeId(data, societeId) {
  if (data.groupeId == null || data.groupeId === "") return null;
  const gid = Number(data.groupeId);
  if (!Number.isInteger(gid)) return null;
  const g = await prisma.groupe.findFirst({ where: { id: gid, societeId: Number(societeId) } });
  if (!g) {
    const err = new Error("Groupe introuvable");
    err.status = 404;
    throw err;
  }
  return g.id;
}

async function assertDepotAndEmplacement({ depotId, emplacementId, societeId }) {
  const depot = await assertDepotOperable(prisma, { id: depotId, societeId });
  const emplacement = await assertEmplacementOperable(prisma, {
    id: emplacementId,
    depotId: depot.id,
    societeId,
  });
  return { depot, emplacement };
}

function normalizeRelations(article) {
  if (!article) return article;
  const firstStock = Array.isArray(article.stocks) && article.stocks.length > 0 ? article.stocks[0] : null;
  return {
    ...article,
    famille: article.famille ?? null,
    sousFamille: article.sousFamille ?? article.sous_famille ?? null,
    familleNom: article.famille?.nom ?? null,
    sousFamilleNom: article.sousFamille?.nom ?? article.sous_famille?.nom ?? null,
    // Compatibilite pour consumers utilisant une convention snake_case.
    sous_famille: article.sousFamille ?? null,
    famille_id: article.familleId ?? null,
    sous_famille_id: article.sousFamilleId ?? null,
    depot: firstStock?.depot ?? null,
    depotId: firstStock?.depotId ?? null,
    emplacement: firstStock?.emplacement ?? null,
    emplacementId: firstStock?.emplacementId ?? null,
    totalStock: Array.isArray(article.stocks)
      ? article.stocks.reduce((sum, s) => sum + (Number(s.quantite) || 0), 0)
      : 0,
    fournisseurNom: article.fournisseur
      ? [article.fournisseur.code, article.fournisseur.nom].filter(Boolean).join(" — ") ||
        article.fournisseur.nom ||
        null
      : null,
  };
}

async function generateArticleCode(societeId) {
  const sid = requireActiveSocieteId(societeId);

  const lastArticle = await prisma.article.findFirst({
    where: { societeId: sid, code: { startsWith: "ART-" } },
    orderBy: { id: "desc" },
  });

  let nextNum = 1;
  if (lastArticle) {
    const match = lastArticle.code.match(/ART-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  let code = `ART-${String(nextNum).padStart(3, "0")}`;

  while (await prisma.article.findFirst({ where: { societeId: sid, code } })) {
    nextNum++;
    code = `ART-${String(nextNum).padStart(3, "0")}`;
  }

  return code;
}

async function listArticles({ user, search, page = 1, limit = 25, statut }) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    ...getSocieteWhere(user),
    ...(search
      ? {
          OR: [
            { libelle: { contains: search } },
            { code: { contains: search } },
            { codeBarres: { contains: search } },
          ],
        }
      : {}),
    ...(statut ? { statut: String(statut).trim() } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { id: "desc" },
      include: {
        famille: { select: { id: true, code: true, nom: true } },
        sousFamille: { select: { id: true, code: true, nom: true } },
        marque: { select: { id: true, code: true, nom: true } },
        groupe: { select: { id: true, code: true, nom: true } },
        fournisseur: { select: { id: true, code: true, nom: true } },
        stocks: {
          include: {
            depot: { select: { id: true, code: true, libelle: true } },
            emplacement: { select: { id: true, code: true, libelle: true } },
          },
        },
      },
    }),
    prisma.article.count({ where }),
  ]);

  const tracageById = await loadTracageMeta(items.map((a) => a.id));

  return {
    items: items.map((a) => withTracageMeta(normalizeRelations(a), tracageById.get(a.id))),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
}

function stockLivrableFromRows(stocks) {
  const byDepot = new Map();
  for (const s of stocks || []) {
    const did = Number(s.depotId);
    if (!Number.isFinite(did)) continue;
    const libre = Math.max(0, (Number(s.quantite) || 0) - (Number(s.qteReservee) || 0));
    byDepot.set(did, (byDepot.get(did) || 0) + libre);
  }
  let max = 0;
  for (const q of byDepot.values()) {
    if (q > max) max = q;
  }
  return max;
}

/** Catalogue client : champs publics + stock livrable (max sur un seul dépôt). */
async function listArticlesCatalogueClient({
  user,
  search,
  page = 1,
  limit = 25,
  statut,
  familleId,
  prixMin,
  prixMax,
  enStock,
  sort,
}) {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 25));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    ...getSocieteWhere(user),
    actif: true,
    ...(search
      ? {
          OR: [
            { libelle: { contains: search } },
            { code: { contains: search } },
            { codeBarres: { contains: search } },
          ],
        }
      : {}),
    ...(statut ? { statut: String(statut).trim() } : { statut: "ACTIF" }),
    ...(familleId ? { familleId: Number(familleId) } : {}),
    ...((prixMin != null && prixMin !== "") || (prixMax != null && prixMax !== "")
      ? {
          prixVente: {
            ...(prixMin != null && prixMin !== "" ? { gte: Number(prixMin) } : {}),
            ...(prixMax != null && prixMax !== "" ? { lte: Number(prixMax) } : {}),
          },
        }
      : {}),
  };

  const orderBy =
    String(sort || "") === "prix_asc"
      ? { prixVente: "asc" }
      : String(sort || "") === "prix_desc"
        ? { prixVente: "desc" }
        : String(sort || "") === "nom"
          ? { libelle: "asc" }
          : { id: "desc" };

  const [rows, totalAll] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy,
      select: {
        id: true,
        code: true,
        libelle: true,
        description: true,
        imageUrl: true,
        unite: true,
        prixVente: true,
        tauxTva: true,
        actif: true,
        statut: true,
        familleId: true,
        famille: { select: { id: true, nom: true } },
        sousFamille: { select: { nom: true } },
        marque: { select: { nom: true } },
        stocks: { select: { quantite: true, qteReservee: true, depotId: true } },
      },
    }),
    prisma.article.count({ where }),
  ]);

  let mapped = rows.map(({ stocks, ...article }) => ({
    ...article,
    stockDisponible: stockLivrableFromRows(stocks),
  }));

  if (enStock === true || enStock === "1" || enStock === "true") {
    mapped = mapped.filter((a) => a.stockDisponible > 0);
  } else if (enStock === false || enStock === "0" || enStock === "false") {
    mapped = mapped.filter((a) => a.stockDisponible <= 0);
  }

  const total = enStock === undefined || enStock === "" || enStock == null ? totalAll : mapped.length;
  const items = mapped.slice(skip, skip + limitNum);

  return {
    items,
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
    limit: limitNum,
  };
}

async function listArticlesSimilaires(articleId, societeId, { limit = 8 } = {}) {
  const sid = requireActiveSocieteId(societeId);
  const base = await prisma.article.findFirst({
    where: { id: Number(articleId), societeId: sid },
    select: { id: true, familleId: true, marqueId: true },
  });
  if (!base) return { items: [] };

  const rows = await prisma.article.findMany({
    where: {
      societeId: sid,
      actif: true,
      statut: "ACTIF",
      id: { not: base.id },
      OR: [
        ...(base.familleId ? [{ familleId: base.familleId }] : []),
        ...(base.marqueId ? [{ marqueId: base.marqueId }] : []),
      ],
    },
    take: Math.min(20, Math.max(1, Number(limit) || 8)),
    orderBy: { id: "desc" },
    select: {
      id: true,
      code: true,
      libelle: true,
      imageUrl: true,
      prixVente: true,
      tauxTva: true,
      unite: true,
      famille: { select: { nom: true } },
      stocks: { select: { quantite: true, qteReservee: true, depotId: true } },
    },
  });

  return {
    items: rows.map(({ stocks, ...a }) => ({
      ...a,
      stockDisponible: stockLivrableFromRows(stocks),
    })),
  };
}

async function getArticle(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const article = await prisma.article.findFirst({
    where: { id: Number(id), societeId: sid },
    include: {
      famille: true,
      sousFamille: true,
      marque: true,
      groupe: true,
      fournisseur: { select: { id: true, code: true, nom: true } },
      stocks: {
        orderBy: { id: "asc" },
        include: {
          depot: { select: { id: true, code: true, libelle: true } },
          emplacement: { select: { id: true, code: true, libelle: true } },
        },
      },
    },
  });
  if (!article) return null;
  const normalized = normalizeRelations(article);
  const tracageById = await loadTracageMeta([article.id]);
  return withTracageMeta(
    {
      ...normalized,
      stockDisponible: stockLivrableFromRows(article.stocks),
    },
    tracageById.get(article.id)
  );
}

async function createArticle(data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  const familleId = Number(clean.familleId);
  const sousFamilleId = Number(clean.sousFamilleId);
  const fournisseurId = Number(clean.fournisseurId);
  const depotId = Number(clean.depotId);
  const emplacementId = Number(clean.emplacementId);
  if (!Number.isInteger(familleId) || !Number.isInteger(sousFamilleId) || !Number.isInteger(fournisseurId)) {
    const err = new Error("Famille, sous-famille et fournisseur sont obligatoires");
    err.status = 400;
    throw err;
  }
  if (!Number.isInteger(depotId) || !Number.isInteger(emplacementId)) {
    const err = new Error("Depot et emplacement sont obligatoires");
    err.status = 400;
    throw err;
  }
  const [famille, sousFamille, fournisseur] = await Promise.all([
    prisma.famille.findFirst({ where: { id: familleId, societeId: sid } }),
    prisma.sousFamille.findFirst({ where: { id: sousFamilleId, societeId: sid } }),
    prisma.fournisseur.findFirst({ where: { id: fournisseurId, societeId: sid } }),
  ]);
  if (!famille) {
    const err = new Error("Famille introuvable");
    err.status = 404;
    throw err;
  }
  if (!sousFamille) {
    const err = new Error("Sous-famille introuvable");
    err.status = 404;
    throw err;
  }
  if (sousFamille.familleId !== famille.id) {
    const err = new Error("La sous-famille selectionnee ne correspond pas a la famille");
    err.status = 400;
    throw err;
  }
  if (!fournisseur) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }
  const { depot, emplacement } = await assertDepotAndEmplacement({
    depotId,
    emplacementId,
    societeId: sid,
  });
  const compat = evaluateCompatibility({
    article: { dangereuxChimique: Boolean(clean.dangereuxChimique) },
    emplacement,
  });
  if (!compat.ok) {
    const err = new Error(compat.message);
    err.status = 409;
    throw err;
  }
  const groupeId = await resolveGroupeId(clean, sid);
  const poids = parseOptionalNonNegativeFloat(clean.poids, "Poids");
  const volume = parseOptionalNonNegativeFloat(clean.volume, "Volume");
  const tracage = parseArticleTracage(clean);
  const quantiteInitiale =
    clean.quantiteInitiale != null && clean.quantiteInitiale !== ""
      ? Math.max(0, Number(clean.quantiteInitiale) || 0)
      : 0;
  const userId = clean.userId != null && clean.userId !== "" ? Number(clean.userId) : null;

  const persistArticle = async ({ code }) => {
    const articleCode = normalizeCode(code);
    const created = await prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: {
          code: articleCode,
          codeBarres: clean.codeBarres ? String(clean.codeBarres).trim() : null,
          libelle: String(clean.libelle).trim(),
          description: clean.description || null,
          imageUrl: normalizeImageUrl(clean.imageUrl),
          unite: String(clean.unite || "UN").trim(),
          prixAchat: Number(clean.prixAchat) || 0,
          prixVente: Number(clean.prixVente) || 0,
          tauxTva: clean.tauxTva != null ? Number(clean.tauxTva) : 19,
          stockMin: clean.stockMin != null ? Number(clean.stockMin) : null,
          stockMax: clean.stockMax != null ? Number(clean.stockMax) : null,
          seuilAlerte: clean.seuilAlerte != null && clean.seuilAlerte !== "" ? Number(clean.seuilAlerte) : null,
          modeTracage: tracage.modeTracage,
          tracageAuto: tracage.tracageAuto,
          modeGestion: tracage.modeGestion,
          strategieSortie: tracage.strategieSortie || normalizeStrategieSortie(clean.strategieSortie),
          actif: clean.actif !== false,
          statut: "ACTIF",
          societeId: sid,
          familleId: famille.id,
          sousFamilleId: sousFamille.id,
          marqueId: clean.marqueId ? Number(clean.marqueId) : null,
          groupeId,
          fournisseurId: fournisseur.id,
          temperatureMin: clean.temperatureMin != null && clean.temperatureMin !== "" ? Number(clean.temperatureMin) : null,
          temperatureMax: clean.temperatureMax != null && clean.temperatureMax !== "" ? Number(clean.temperatureMax) : null,
          fragile: Boolean(clean.fragile),
          dangereuxChimique: Boolean(clean.dangereuxChimique),
          poids,
          volume,
        },
      });

      await tx.stock.create({
        data: {
          articleId: article.id,
          depotId: depot.id,
          emplacementId: emplacement.id,
          quantite: quantiteInitiale,
          dateLastMvt: new Date(),
        },
      });

      if (quantiteInitiale > 0 && userId) {
        const { insertMouvement, MOUVEMENT_TYPES } = require("../mouvements/mouvements.service");
        await insertMouvement(tx, {
          reference: `INIT-${article.code}-${article.id}`,
          type: MOUVEMENT_TYPES.ENTREE_AJUSTEMENT,
          articleId: article.id,
          depotId: depot.id,
          quantite: quantiteInitiale,
          utilisateurId: userId,
          commentaire: "Stock initial à la création de l'article",
        });
      }

      return article;
    });
    return getArticle(created.id, sid);
  };

  const { isAuto, code: resolvedCode } = await resolveAutoCode(sid, clean.code, generateArticleCode);
  if (isAuto) {
    return createWithAutoCode(
      sid,
      { code: resolvedCode || undefined },
      generateArticleCode,
      persistArticle
    );
  }
  return persistArticle({ code: resolvedCode });
}

async function updateArticle(id, data, societeId) {
  const clean = stripSocieteFromBody(data);
  const sid = requireActiveSocieteId(societeId);
  const existing = await getArticle(id, sid);
  if (!existing) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const stEdit = String(existing.statut ?? "").trim().toUpperCase();
  if (stEdit !== "ACTIF") {
    const err = new Error(
      stEdit === "BLOQUE"
        ? "Article bloqué : modification interdite. Débloquez l'article pour le modifier."
        : "Article archivé : modification interdite. Les fiches archivées sont en lecture seule."
    );
    err.status = 409;
    throw err;
  }
  const familleId = Number(clean.familleId);
  const sousFamilleId = Number(clean.sousFamilleId);
  const fournisseurId = Number(clean.fournisseurId);
  const depotId = Number(clean.depotId);
  const emplacementId = Number(clean.emplacementId);
  if (!Number.isInteger(familleId) || !Number.isInteger(sousFamilleId) || !Number.isInteger(fournisseurId)) {
    const err = new Error("Famille, sous-famille et fournisseur sont obligatoires");
    err.status = 400;
    throw err;
  }
  if (!Number.isInteger(depotId) || !Number.isInteger(emplacementId)) {
    const err = new Error("Depot et emplacement sont obligatoires");
    err.status = 400;
    throw err;
  }
  const [famille, sousFamille, fournisseur] = await Promise.all([
    prisma.famille.findFirst({ where: { id: familleId, societeId: sid } }),
    prisma.sousFamille.findFirst({ where: { id: sousFamilleId, societeId: sid } }),
    prisma.fournisseur.findFirst({ where: { id: fournisseurId, societeId: sid } }),
  ]);
  if (!famille) {
    const err = new Error("Famille introuvable");
    err.status = 404;
    throw err;
  }
  if (!sousFamille) {
    const err = new Error("Sous-famille introuvable");
    err.status = 404;
    throw err;
  }
  if (sousFamille.familleId !== famille.id) {
    const err = new Error("La sous-famille selectionnee ne correspond pas a la famille");
    err.status = 400;
    throw err;
  }
  if (!fournisseur) {
    const err = new Error("Fournisseur introuvable");
    err.status = 404;
    throw err;
  }
  const { depot, emplacement } = await assertDepotAndEmplacement({
    depotId,
    emplacementId,
    societeId: sid,
  });
  const compatUpdate = evaluateCompatibility({
    article: {
      dangereuxChimique:
        clean.dangereuxChimique !== undefined
          ? Boolean(clean.dangereuxChimique)
          : Boolean(existing.dangereuxChimique),
    },
    emplacement,
  });
  if (!compatUpdate.ok) {
    const err = new Error(compatUpdate.message);
    err.status = 409;
    throw err;
  }
  const groupeIdForUpdate = clean.groupeId !== undefined ? await resolveGroupeId(clean, sid) : undefined;
  const poids =
    clean.poids !== undefined ? parseOptionalNonNegativeFloat(clean.poids, "Poids") : undefined;
  const volume =
    clean.volume !== undefined ? parseOptionalNonNegativeFloat(clean.volume, "Volume") : undefined;
  const tracage =
    clean.modeTracage != null || clean.tracageAuto != null || clean.strategieSortie != null
      ? parseArticleTracage({
          modeTracage: clean.modeTracage ?? existing.modeTracage,
          tracageAuto: clean.tracageAuto ?? existing.tracageAuto,
          strategieSortie: clean.strategieSortie ?? existing.strategieSortie,
        })
      : null;
  if (tracage && tracage.modeTracage !== String(existing.modeTracage || "AUCUN").toUpperCase()) {
    const metaMap = await loadTracageMeta([existing.id]);
    const meta = metaMap.get(existing.id);
    if (meta && (meta.lotsActifs > 0 || meta.seriesDispo > 0)) {
      const err = new Error(
        "Impossible de modifier la traçabilité : des lots ou numéros de série actifs existent encore"
      );
      err.status = 409;
      throw err;
    }
  }
  try {
    const updated = await prisma.article.update({
      where: { id: existing.id },
      data: {
        ...(clean.code != null ? { code: normalizeCode(clean.code) } : {}),
        ...(clean.codeBarres !== undefined
          ? { codeBarres: clean.codeBarres ? String(clean.codeBarres).trim() : null }
          : {}),
        ...(clean.libelle != null ? { libelle: String(clean.libelle).trim() } : {}),
        ...(clean.description !== undefined ? { description: clean.description || null } : {}),
        ...(clean.imageUrl !== undefined ? { imageUrl: normalizeImageUrl(clean.imageUrl) } : {}),
        ...(clean.unite != null ? { unite: String(clean.unite).trim() } : {}),
        ...(clean.prixAchat != null ? { prixAchat: Number(clean.prixAchat) } : {}),
        ...(clean.prixVente != null ? { prixVente: Number(clean.prixVente) } : {}),
        ...(clean.tauxTva != null ? { tauxTva: Number(clean.tauxTva) } : {}),
        ...(clean.stockMin !== undefined ? { stockMin: clean.stockMin != null ? Number(clean.stockMin) : null } : {}),
        ...(clean.stockMax !== undefined ? { stockMax: clean.stockMax != null ? Number(clean.stockMax) : null } : {}),
        ...(clean.seuilAlerte !== undefined
          ? { seuilAlerte: clean.seuilAlerte != null && clean.seuilAlerte !== "" ? Number(clean.seuilAlerte) : null }
          : {}),
        ...(tracage
          ? {
              modeTracage: tracage.modeTracage,
              tracageAuto: tracage.tracageAuto,
              modeGestion: tracage.modeGestion,
              strategieSortie: tracage.strategieSortie,
            }
          : {
              ...(clean.modeGestion != null ? { modeGestion: clean.modeGestion } : {}),
              ...(clean.strategieSortie != null
                ? { strategieSortie: normalizeStrategieSortie(clean.strategieSortie) }
                : {}),
            }),
        ...(clean.actif !== undefined ? { actif: Boolean(clean.actif) } : {}),
        familleId: famille.id,
        sousFamilleId: sousFamille.id,
        ...(clean.marqueId !== undefined ? { marqueId: clean.marqueId ? Number(clean.marqueId) : null } : {}),
        ...(clean.groupeId !== undefined ? { groupeId: groupeIdForUpdate } : {}),
        fournisseurId: fournisseur.id,
        ...(clean.temperatureMin !== undefined
          ? { temperatureMin: clean.temperatureMin != null && clean.temperatureMin !== "" ? Number(clean.temperatureMin) : null }
          : {}),
        ...(clean.temperatureMax !== undefined
          ? { temperatureMax: clean.temperatureMax != null && clean.temperatureMax !== "" ? Number(clean.temperatureMax) : null }
          : {}),
        ...(clean.fragile !== undefined ? { fragile: Boolean(clean.fragile) } : {}),
        ...(clean.dangereuxChimique !== undefined ? { dangereuxChimique: Boolean(clean.dangereuxChimique) } : {}),
        ...(poids !== undefined ? { poids } : {}),
        ...(volume !== undefined ? { volume } : {}),
      },
    });
    await prisma.stock.upsert({
      where: {
        articleId_depotId_emplacementId: {
          articleId: updated.id,
          depotId: depot.id,
          emplacementId: emplacement.id,
        },
      },
      update: {},
      create: {
        articleId: updated.id,
        depotId: depot.id,
        emplacementId: emplacement.id,
        quantite: 0,
      },
    });
    return getArticle(updated.id, sid);
  } catch (error) {
    throw error;
  }
}

const STATUTS_ARTICLE = new Set(["ACTIF", "ARCHIVE", "BLOQUE"]);

/** Transitions métier alignées avec le cahier des charges. */
const ALLOWED_TRANSITIONS = {
  ACTIF: ["BLOQUE", "ARCHIVE"],
  BLOQUE: ["ACTIF", "ARCHIVE"],
  ARCHIVE: ["ACTIF"],
};

async function setStatutArticle(id, societeId, newStatut) {
  const s = String(newStatut ?? "").trim().toUpperCase();
  if (!STATUTS_ARTICLE.has(s)) {
    const err = new Error("Statut invalide (ACTIF, ARCHIVE ou BLOQUE)");
    err.status = 400;
    throw err;
  }
  const sidStat = requireActiveSocieteId(societeId);
  const existing = await prisma.article.findFirst({
    where: { id: Number(id), societeId: sidStat },
  });
  if (!existing) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const current = String(existing.statut ?? "").trim().toUpperCase();
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(s)) {
    const messages = {
      "ARCHIVE->BLOQUE": "Un article archivé ne peut pas être bloqué.",
      "ARCHIVE->ARCHIVE": "Transition interdite : ARCHIVE → ARCHIVE",
    };
    const key = `${current}->${s}`;
    const err = new Error(
      messages[key] || `Transition interdite : ${current} → ${s}`
    );
    err.status = 409;
    throw err;
  }
  const updated = await prisma.article.update({
    where: { id: existing.id },
    data: { statut: s },
  });
  return getArticle(updated.id, sidStat);
}

async function assertArticleActif(id, societeId) {
  const sid = requireActiveSocieteId(societeId);
  const article = await prisma.article.findFirst({
    where: { id: Number(id), societeId: sid },
    select: { id: true, statut: true, libelle: true },
  });
  if (!article) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }
  const st = String(article.statut ?? "").trim().toUpperCase();
  if (st !== "ACTIF") {
    const labels = { BLOQUE: "bloqué", ARCHIVE: "archivé" };
    const err = new Error(
      `L'article "${article.libelle}" est ${labels[st] ?? st} et ne peut pas être utilisé dans cette opération.`
    );
    err.status = 409;
    throw err;
  }
  return article;
}

async function deleteArticle(id, societeId, callerRole) {
  const existing = await getArticle(id, societeId);
  if (!existing) {
    const err = new Error("Article introuvable");
    err.status = 404;
    throw err;
  }

  const statut = String(existing.statut ?? "").trim().toUpperCase();

  if (statut === "BLOQUE") {
    const err = new Error(
      "Impossible de supprimer un article bloqué. Débloquez-le ou archivez-le d'abord."
    );
    err.status = 409;
    throw err;
  }

  if (statut === "ACTIF") {
    const err = new Error(
      "Impossible de supprimer un article actif. Archivez-le d'abord."
    );
    err.status = 409;
    throw err;
  }

  const role = String(callerRole ?? "").trim();
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    const err = new Error(
      "Seul un administrateur peut supprimer définitivement un article."
    );
    err.status = 403;
    throw err;
  }

  const articleId = Number(existing.id);

  const stocks = await prisma.stock.findMany({
    where: { articleId },
    select: { quantite: true },
  });
  const totalStock = stocks.reduce((sum, s) => sum + (Number(s.quantite) || 0), 0);
  if (totalStock > 0) {
    const err = new Error(
      `Stock restant : ${totalStock} unité(s). Soldez le stock avant de supprimer.`
    );
    err.status = 409;
    throw err;
  }

  const [
    achatCount,
    venteCount,
    mvtCount,
    lotCount,
    valorisationCount,
    inventaireLigneCount,
    numeroSerieCount,
    coutStockageCount,
  ] = await Promise.all([
    prisma.ligneAchat.count({ where: { articleId } }),
    prisma.ligneVente.count({ where: { articleId } }),
    prisma.mouvement.count({ where: { articleId } }),
    prisma.lot.count({ where: { articleId } }),
    prisma.valorisation.count({ where: { articleId } }),
    prisma.ligneInventaire.count({ where: { articleId } }),
    prisma.numeroSerie.count({ where: { articleId } }),
    prisma.coutStockage.count({ where: { articleId } }),
  ]);

  const blockers = [];
  if (achatCount > 0) blockers.push(`${achatCount} ligne(s) d’achat`);
  if (venteCount > 0)
    blockers.push(
      `${venteCount} ligne(s) de vente ou de commande client (inclut une commande créée depuis le catalogue web)`
    );
  if (mvtCount > 0) blockers.push(`mouvements de stock (${mvtCount})`);
  if (lotCount > 0) blockers.push(`lots (${lotCount})`);
  if (valorisationCount > 0) blockers.push(`valorisations (${valorisationCount})`);
  if (inventaireLigneCount > 0) blockers.push(`lignes d'inventaire (${inventaireLigneCount})`);
  if (numeroSerieCount > 0) blockers.push(`numéros de série (${numeroSerieCount})`);
  if (coutStockageCount > 0) blockers.push(`coûts de stockage (${coutStockageCount})`);

  if (blockers.length > 0) {
    const err = new Error(
      "Suppression impossible : " +
        blockers.join(", ") +
        ". Ces liens sont conservés pour la traçabilité."
    );
    err.status = 409;
    throw err;
  }

  try {
    await prisma.$transaction([
      prisma.stock.deleteMany({ where: { articleId } }),
      prisma.article.delete({ where: { id: articleId } }),
    ]);
  } catch (e) {
    if (e.code === "P2003") {
      const err = new Error(
        "Suppression impossible : la base refuse encore une contrainte (données liées non détectées). " +
          "Vérifiez commandes clients, inventaires ou lots pour cet article."
      );
      err.status = 409;
      throw err;
    }
    throw e;
  }

  return { deleted: true, id: articleId };
}

async function listArticlesForExport({ user, search, statut, ids }) {
  const idList = ids
    ? String(ids)
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    : null;

  const where = {
    ...getSocieteWhere(user),
    ...(search
      ? {
          OR: [
            { libelle: { contains: search } },
            { code: { contains: search } },
            { codeBarres: { contains: search } },
          ],
        }
      : {}),
    ...(statut ? { statut: String(statut).trim() } : {}),
    ...(idList?.length ? { id: { in: idList } } : {}),
  };

  const items = await prisma.article.findMany({
    where,
    take: 50000,
    orderBy: { code: "asc" },
    include: {
      famille: { select: { id: true, code: true, nom: true } },
      sousFamille: { select: { id: true, code: true, nom: true } },
      marque: { select: { id: true, code: true, nom: true } },
      fournisseur: { select: { id: true, code: true, nom: true } },
      stocks: {
        include: {
          depot: { select: { id: true, code: true, libelle: true } },
          emplacement: { select: { id: true, code: true, libelle: true } },
        },
      },
    },
  });

  return items.map(normalizeRelations);
}

module.exports = {
  listArticles,
  listArticlesCatalogueClient,
  listArticlesSimilaires,
  listArticlesForExport,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  setStatutArticle,
  assertArticleActif,
  generateArticleCode,
  importArticlesFromFile,
  importArticlesFromCsv,
};
