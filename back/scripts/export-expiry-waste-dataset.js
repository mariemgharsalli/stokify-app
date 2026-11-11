/**
 * Export lecture seule — dataset Expiry Waste Risk pour Google Colab.
 *
 * Usage (depuis back/) :
 *   node scripts/export-expiry-waste-dataset.js
 *
 * Sorties :
 *   scripts/exports/expiry_waste_risk.csv
 *   scripts/exports/expiry_waste_risk_quality_report.json
 *
 * INTERDIT : INSERT / UPDATE / DELETE / UPSERT / migrate / entraînement ML.
 * Aucun effet de bord MySQL. Prisma : findMany / count uniquement.
 */
"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const prisma = require("../src/config/database");

const EPS = 1e-6;
const HORIZONS = [30, 14, 7];
const VENTE_STATUTS_CONFIRMES = ["CONFIRME", "VALIDE", "LIVRE"];
const MVT_STATUT_VALIDE = "VALIDE";
const CSV_COLUMNS = [
  "lot_id",
  "numero",
  "article_id",
  "article_code",
  "depot_id",
  "famille_id",
  "as_of_date",
  "horizon_jours",
  "date_fabrication",
  "date_expiration",
  "quantite_initiale",
  "quantite_restante_asof",
  "pourcentage_consomme",
  "age_du_lot",
  "duree_vie_jours",
  "jours_restants_avant_expiration",
  "pct_vie_ecoulee",
  "ventes_7j",
  "ventes_30j",
  "vitesse_moyenne_journaliere",
  "ventes_lot_asof",
  "ventes_lot_fiable",
  "nombre_de_mouvements",
  "nombre_sorties_vente_lot",
  "prix_unitaire",
  "prix_vente",
  "valeur_stock",
  "strategie_sortie",
  "mode_tracage",
  "qte_predite_dlc_heuristique",
  "ratio_couverture",
  "observation_fermee",
  "y_waste",
  "y_qty",
  "y_valeur",
  "split_role",
  "source",
];

const OUT_DIR = path.join(__dirname, "exports");
const CSV_PATH = path.join(OUT_DIR, "expiry_waste_risk.csv");
const REPORT_PATH = path.join(OUT_DIR, "expiry_waste_risk_quality_report.json");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function utcDayMs(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

function addUtcDays(dayMs, days) {
  return dayMs + Number(days) * 86400000;
}

function isoDay(dayMs) {
  return new Date(dayMs).toISOString().slice(0, 10);
}

function daysBetween(fromMs, toMs) {
  return Math.round((toMs - fromMs) / 86400000);
}

function ceilDaysUntil(fromMs, toMs) {
  return Math.ceil((toMs - fromMs) / 86400000);
}

function parseJsonArray(raw) {
  if (raw == null || raw === "") {
    return { ok: false, invalid: false, warning: false, arr: [] };
  }
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return { ok: true, invalid: false, warning: false, arr: v };
    if (v && typeof v === "object" && v.warning) {
      return { ok: false, invalid: false, warning: true, arr: [] };
    }
    return { ok: false, invalid: true, warning: false, arr: [] };
  } catch {
    return { ok: false, invalid: true, warning: false, arr: [] };
  }
}

function csvEscape(value) {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isLegacyNumero(numero) {
  return String(numero || "").startsWith("STOCK-LEGACY-");
}

function venteRefFromComment(commentaire) {
  const m = String(commentaire || "").match(/Vente\s+(\S+)/i);
  return m ? m[1] : null;
}

function inventaireRefFromComment(commentaire) {
  const m = String(commentaire || "").match(/Inventaire\s+(\S+)/i);
  return m ? m[1] : null;
}

function eventBeforeAsOf(eventDayMs, asOfDayMs) {
  return eventDayMs != null && eventDayMs < asOfDayMs;
}

function eventOnOrBeforeDlc(eventDayMs, dlcDayMs) {
  return eventDayMs != null && eventDayMs <= dlcDayMs;
}

async function loadAll() {
  const [
    lots,
    articles,
    ventes,
    mouvements,
    achats,
    inventaires,
    lignesInventaire,
    couches,
    historiqueCMP,
    stocks,
  ] = await Promise.all([
    prisma.lot.findMany({
      select: {
        id: true,
        numero: true,
        articleId: true,
        depotId: true,
        dateFabrication: true,
        dateExpiration: true,
        quantiteInitiale: true,
        quantiteRestante: true,
        statut: true,
        achatId: true,
      },
    }),
    prisma.article.findMany({
      select: {
        id: true,
        code: true,
        familleId: true,
        strategieSortie: true,
        modeTracage: true,
        prixAchat: true,
        prixVente: true,
        societeId: true,
      },
    }),
    prisma.vente.findMany({
      select: {
        id: true,
        reference: true,
        statut: true,
        typeVente: true,
        dateVente: true,
        confirmedAt: true,
        depotId: true,
        societeId: true,
        lignes: {
          select: {
            id: true,
            articleId: true,
            quantite: true,
            lotsConsumed: true,
          },
        },
      },
    }),
    prisma.mouvement.findMany({
      select: {
        id: true,
        type: true,
        statut: true,
        createdAt: true,
        quantite: true,
        lotId: true,
        lotsDetail: true,
        depotId: true,
        depotDestId: true,
        articleId: true,
        commentaire: true,
      },
    }),
    prisma.achat.findMany({
      select: { id: true, dateReception: true, dateCommande: true },
    }),
    prisma.inventaire.findMany({
      select: { id: true, reference: true, date: true, statut: true, depotId: true },
    }),
    prisma.ligneInventaire.findMany({
      select: {
        id: true,
        inventaireId: true,
        articleId: true,
        lotId: true,
        ecart: true,
        lotsAjustes: true,
      },
    }),
    prisma.couchesFifo.findMany({
      select: {
        lotId: true,
        articleId: true,
        depotId: true,
        prixUnitaire: true,
        dateEntree: true,
      },
    }),
    prisma.historiqueCMP.findMany({
      select: {
        articleId: true,
        depotId: true,
        nouveauCMP: true,
        dateCalcul: true,
      },
    }),
    prisma.stock.findMany({
      select: { articleId: true, depotId: true, quantite: true },
    }),
  ]);

  return {
    lots,
    articles,
    ventes,
    mouvements,
    achats,
    inventaires,
    lignesInventaire,
    couches,
    historiqueCMP,
    stocks,
  };
}

function buildLookups(data) {
  const articleById = new Map(data.articles.map((a) => [a.id, a]));
  const achatById = new Map(data.achats.map((a) => [a.id, a]));
  const venteByRef = new Map(data.ventes.map((v) => [v.reference, v]));
  const venteById = new Map(data.ventes.map((v) => [v.id, v]));
  const inventaireByRef = new Map(data.inventaires.map((i) => [i.reference, i]));
  const inventaireById = new Map(data.inventaires.map((i) => [i.id, i]));
  return {
    articleById,
    achatById,
    venteByRef,
    venteById,
    inventaireByRef,
    inventaireById,
  };
}

function pushEvent(eventsByLot, qc, event) {
  const lotId = Number(event.lotId);
  if (!Number.isFinite(lotId) || lotId <= 0) {
    qc.evenements_sans_lot += 1;
    if (qc.evenements_sans_lot_detail.length < 40) {
      qc.evenements_sans_lot_detail.push({
        kind: event.kind,
        source: event.source,
        sourceId: event.sourceId,
        ts: event.ts,
      });
    }
    return;
  }
  if (!eventsByLot.has(lotId)) eventsByLot.set(lotId, []);
  eventsByLot.get(lotId).push(event);
}

function buildEventLedger(data, lookups, qc) {
  const eventsByLot = new Map();
  const coveredSale = new Set();
  const coveredInv = new Set();
  const mvtValides = data.mouvements.filter(
    (m) => String(m.statut || "").toUpperCase() === MVT_STATUT_VALIDE
  );

  for (const m of mvtValides) {
    const ts = m.createdAt;
    const dayMs = utcDayMs(ts);
    const parsed = parseJsonArray(m.lotsDetail);
    if (m.lotsDetail && parsed.invalid) {
      qc.json_invalides += 1;
      qc.json_invalides_detail.push({ source: "Mouvement.lotsDetail", id: m.id });
    }

    if (m.type === "ENTREE_ACHAT") {
      if (m.lotId) {
        pushEvent(eventsByLot, qc, {
          lotId: m.lotId,
          ts,
          dayMs,
          delta: Number(m.quantite) || 0,
          kind: "IN_ACHAT",
          source: "mouvement",
          sourceId: m.id,
        });
      } else {
        qc.evenements_sans_lot += 1;
        qc.evenements_sans_lot_detail.push({
          kind: "IN_ACHAT",
          source: "mouvement",
          sourceId: m.id,
        });
      }
      continue;
    }

    if (m.type === "TRANSFERT") {
      if (parsed.ok && parsed.arr.length) {
        for (const item of parsed.arr) {
          const qty = Number(item.quantite) || 0;
          if (item.lotId) {
            pushEvent(eventsByLot, qc, {
              lotId: item.lotId,
              ts,
              dayMs,
              delta: -qty,
              kind: "OUT_TRANSFERT",
              source: "mouvement.lotsDetail",
              sourceId: m.id,
            });
          }
          if (item.destLotId) {
            pushEvent(eventsByLot, qc, {
              lotId: item.destLotId,
              ts,
              dayMs,
              delta: qty,
              kind: "IN_TRANSFERT",
              source: "mouvement.lotsDetail",
              sourceId: m.id,
            });
          }
        }
      } else {
        qc.evenements_sans_lot += 1;
        qc.evenements_sans_lot_detail.push({
          kind: "TRANSFERT_NON_IMPUTABLE",
          source: "mouvement",
          sourceId: m.id,
        });
      }
      continue;
    }

    if (m.type === "TRANSFERT_EMPLACEMENT") {
      if (m.depotDestId && Number(m.depotDestId) !== Number(m.depotId) && parsed.ok && parsed.arr.length) {
        for (const item of parsed.arr) {
          const qty = Number(item.quantite) || 0;
          if (item.lotId) {
            pushEvent(eventsByLot, qc, {
              lotId: item.lotId,
              ts,
              dayMs,
              delta: -qty,
              kind: "OUT_TRANSFERT",
              source: "mouvement.lotsDetail",
              sourceId: m.id,
            });
          }
          if (item.destLotId) {
            pushEvent(eventsByLot, qc, {
              lotId: item.destLotId,
              ts,
              dayMs,
              delta: qty,
              kind: "IN_TRANSFERT",
              source: "mouvement.lotsDetail",
              sourceId: m.id,
            });
          }
        }
      }
      continue;
    }

    if (m.type === "SORTIE_RETOUR_FOURNISSEUR") {
      if (parsed.ok && parsed.arr.length) {
        for (const item of parsed.arr) {
          if (!item.lotId) continue;
          pushEvent(eventsByLot, qc, {
            lotId: item.lotId,
            ts,
            dayMs,
            delta: -(Number(item.quantite) || 0),
            kind: "OUT_RETOUR_FOURN",
            source: "mouvement.lotsDetail",
            sourceId: m.id,
          });
        }
      } else if (m.lotId) {
        qc.fallback_lotId += 1;
        pushEvent(eventsByLot, qc, {
          lotId: m.lotId,
          ts,
          dayMs,
          delta: -(Number(m.quantite) || 0),
          kind: "OUT_RETOUR_FOURN",
          source: "mouvement.lotId",
          sourceId: m.id,
        });
      } else {
        qc.evenements_sans_lot += 1;
      }
      continue;
    }

    if (m.type === "SORTIE_VENTE") {
      const venteRef = venteRefFromComment(m.commentaire);
      const vente = venteRef ? lookups.venteByRef.get(venteRef) : null;
      if (parsed.ok && parsed.arr.length) {
        for (const item of parsed.arr) {
          if (!item.lotId) continue;
          pushEvent(eventsByLot, qc, {
            lotId: item.lotId,
            ts,
            dayMs,
            delta: -(Number(item.quantite) || 0),
            kind: "OUT_VENTE",
            source: "mouvement.lotsDetail",
            sourceId: m.id,
            venteId: vente?.id || null,
          });
          if (vente?.id) coveredSale.add(`${vente.id}:${item.lotId}`);
        }
      } else if (vente) {
        /* lotsConsumed traité plus bas ; on mémorise le mouvement pour le fallback lotId */
        m._matchedVenteId = vente.id;
        m._needsSaleFallback = true;
      } else if (m.lotId) {
        qc.fallback_lotId += 1;
        pushEvent(eventsByLot, qc, {
          lotId: m.lotId,
          ts,
          dayMs,
          delta: -(Number(m.quantite) || 0),
          kind: "OUT_VENTE",
          source: "mouvement.lotId",
          sourceId: m.id,
        });
      } else {
        qc.evenements_sans_lot += 1;
      }
      continue;
    }

    if (m.type === "SORTIE_AUTRE" || m.type === "SORTIE_PERTE" || m.type === "SORTIE_CASSE") {
      const invRef = inventaireRefFromComment(m.commentaire);
      if (invRef) {
        m._inventaireRef = invRef;
        m._isInventaire = true;
        continue;
      }
      if (parsed.ok && parsed.arr.length) {
        for (const item of parsed.arr) {
          if (!item.lotId) continue;
          pushEvent(eventsByLot, qc, {
            lotId: item.lotId,
            ts,
            dayMs,
            delta: -(Number(item.quantite) || 0),
            kind: m.type === "SORTIE_PERTE" ? "OUT_PERTE" : "OUT_INV",
            source: "mouvement.lotsDetail",
            sourceId: m.id,
          });
        }
      } else if (m.lotId) {
        qc.fallback_lotId += 1;
        pushEvent(eventsByLot, qc, {
          lotId: m.lotId,
          ts,
          dayMs,
          delta: -(Number(m.quantite) || 0),
          kind: m.type === "SORTIE_PERTE" ? "OUT_PERTE" : "OUT_AJUST",
          source: "mouvement.lotId",
          sourceId: m.id,
        });
      } else {
        qc.evenements_sans_lot += 1;
        qc.evenements_sans_lot_detail.push({
          kind: m.type,
          source: "mouvement",
          sourceId: m.id,
        });
      }
      continue;
    }

    if (m.type === "SORTIE_AJUSTEMENT") {
      if (m.lotId) {
        pushEvent(eventsByLot, qc, {
          lotId: m.lotId,
          ts,
          dayMs,
          delta: -(Number(m.quantite) || 0),
          kind: "OUT_RAPPEL",
          source: "mouvement.lotId",
          sourceId: m.id,
        });
      } else {
        qc.evenements_sans_lot += 1;
      }
      continue;
    }

    if (m.type === "ENTREE_AJUSTEMENT") {
      const invRef = inventaireRefFromComment(m.commentaire);
      if (invRef) {
        m._inventaireRef = invRef;
        m._isInventaire = true;
        continue;
      }
      if (m.lotId && !isLegacyNumero((data.lots.find((l) => l.id === m.lotId) || {}).numero)) {
        pushEvent(eventsByLot, qc, {
          lotId: m.lotId,
          ts,
          dayMs,
          delta: Number(m.quantite) || 0,
          kind: "IN_AJUST",
          source: "mouvement.lotId",
          sourceId: m.id,
        });
      } else {
        qc.evenements_sans_lot += 1;
      }
      continue;
    }

    if (m.type === "ENTREE_RETOUR_CLIENT") {
      m._isRetourClientMvt = true;
    }
  }

  for (const v of data.ventes) {
    const statutOk = VENTE_STATUTS_CONFIRMES.includes(String(v.statut || "").toUpperCase());
    if (!statutOk) continue;
    const isAvoir = String(v.typeVente || "").toUpperCase() === "AVOIR";
    const ts = v.dateVente || v.confirmedAt;
    const dayMs = utcDayMs(ts);
    for (const ligne of v.lignes || []) {
      const parsed = parseJsonArray(ligne.lotsConsumed);
      if (ligne.lotsConsumed && parsed.invalid) {
        qc.json_invalides += 1;
        qc.json_invalides_detail.push({ source: "LigneVente.lotsConsumed", id: ligne.id });
      }
      if (!parsed.ok || !parsed.arr.length) {
        if (isAvoir) {
          qc.evenements_sans_lot += 1;
          qc.qc_avoir_sans_lotsConsumed += 1;
        }
        continue;
      }
      for (const item of parsed.arr) {
        if (!item.lotId) continue;
        const key = `${v.id}:${item.lotId}`;
        const qty = Number(item.quantite) || 0;
        if (isAvoir) {
          pushEvent(eventsByLot, qc, {
            lotId: item.lotId,
            ts,
            dayMs,
            delta: Math.abs(qty),
            kind: "IN_RETOUR_CLIENT",
            source: "ligneVente.lotsConsumed",
            sourceId: ligne.id,
            venteId: v.id,
          });
          if (!qc._avoirFlagged) qc._avoirFlagged = new Set();
          if (!qc._avoirFlagged.has(v.id)) {
            qc._avoirFlagged.add(v.id);
            qc.qc_avoir_non_prorate += 1;
          }
        } else {
          if (coveredSale.has(key)) continue;
          pushEvent(eventsByLot, qc, {
            lotId: item.lotId,
            ts,
            dayMs,
            delta: -Math.abs(qty),
            kind: "OUT_VENTE",
            source: "ligneVente.lotsConsumed",
            sourceId: ligne.id,
            venteId: v.id,
          });
          coveredSale.add(key);
        }
      }
    }
  }

  for (const m of mvtValides) {
    if (m.type !== "SORTIE_VENTE" || !m._needsSaleFallback) continue;
    const venteId = m._matchedVenteId;
    const already = [...coveredSale].some((k) => k.startsWith(`${venteId}:`));
    if (already) continue;
    if (m.lotId) {
      qc.fallback_lotId += 1;
      pushEvent(eventsByLot, qc, {
        lotId: m.lotId,
        ts: m.createdAt,
        dayMs: utcDayMs(m.createdAt),
        delta: -(Number(m.quantite) || 0),
        kind: "OUT_VENTE",
        source: "mouvement.lotId",
        sourceId: m.id,
        venteId,
      });
    } else {
      qc.evenements_sans_lot += 1;
    }
  }

  for (const ligne of data.lignesInventaire) {
    const inv = lookups.inventaireById.get(ligne.inventaireId);
    if (!inv || String(inv.statut || "").toUpperCase() !== "VALIDE") continue;
    const parsed = parseJsonArray(ligne.lotsAjustes);
    if (ligne.lotsAjustes && parsed.invalid) {
      qc.json_invalides += 1;
      qc.json_invalides_detail.push({ source: "LigneInventaire.lotsAjustes", id: ligne.id });
    }
    if (parsed.warning) continue;
    if (!parsed.ok || !parsed.arr.length) {
      if (Number(ligne.ecart) < 0) {
        qc.evenements_sans_lot += 1;
      }
      continue;
    }
    const ts = inv.date;
    const dayMs = utcDayMs(ts);
    for (const item of parsed.arr) {
      if (!item.lotId) continue;
      const qty = Number(item.quantite) || 0;
      const key = `${inv.id}:${item.lotId}`;
      if (coveredInv.has(key)) continue;
      const delta = Number(ligne.ecart) > 0 ? Math.abs(qty) : -Math.abs(qty);
      pushEvent(eventsByLot, qc, {
        lotId: item.lotId,
        ts,
        dayMs,
        delta,
        kind: Number(ligne.ecart) > 0 ? "IN_AJUST" : "OUT_INV",
        source: "ligneInventaire.lotsAjustes",
        sourceId: ligne.id,
      });
      coveredInv.add(key);
    }
  }

  for (const m of mvtValides) {
    if (!m._isInventaire) continue;
    const inv = m._inventaireRef ? lookups.inventaireByRef.get(m._inventaireRef) : null;
    if (inv && [...coveredInv].some((k) => k.startsWith(`${inv.id}:`))) continue;
    if (m.lotId) {
      const lot = data.lots.find((l) => l.id === m.lotId);
      if (lot && isLegacyNumero(lot.numero) && m.type === "ENTREE_AJUSTEMENT") {
        qc.evenements_sans_lot += 1;
        continue;
      }
      qc.fallback_lotId += 1;
      const sign = m.type === "ENTREE_AJUSTEMENT" ? 1 : -1;
      pushEvent(eventsByLot, qc, {
        lotId: m.lotId,
        ts: m.createdAt,
        dayMs: utcDayMs(m.createdAt),
        delta: sign * (Number(m.quantite) || 0),
        kind: sign > 0 ? "IN_AJUST" : "OUT_INV",
        source: "mouvement.lotId",
        sourceId: m.id,
      });
    } else {
      qc.evenements_sans_lot += 1;
      qc.evenements_sans_lot_detail.push({
        kind: "INVENTAIRE_SANS_LOT",
        source: "mouvement",
        sourceId: m.id,
      });
    }
  }

  for (const list of eventsByLot.values()) {
    list.sort((a, b) => {
      const ta = new Date(a.ts).getTime();
      const tb = new Date(b.ts).getTime();
      return ta - tb;
    });
  }

  return eventsByLot;
}

function dateNaissance(lot, events, achatById) {
  if (lot.dateFabrication) {
    const d = utcDayMs(lot.dateFabrication);
    if (d != null) return d;
  }
  const firstIn = (events || []).find((e) => e.delta > 0 && e.dayMs != null);
  if (firstIn) return firstIn.dayMs;
  if (lot.achatId && achatById.has(lot.achatId)) {
    const a = achatById.get(lot.achatId);
    const d = utcDayMs(a.dateReception || a.dateCommande);
    if (d != null) return d;
  }
  return null;
}

function quantityAt(lot, events, predicate, tracker, opts = {}) {
  const all = events || [];
  const used = [];
  let inflow = 0;
  let outflow = 0;
  for (const e of all) {
    if (!predicate(e)) continue;
    used.push(e);
    if (tracker) {
      tracker.used.push(e);
      if (e.dayMs != null && (tracker.maxDayMs == null || e.dayMs > tracker.maxDayMs)) {
        tracker.maxDayMs = e.dayMs;
      }
    }
    const d = Number(e.delta) || 0;
    if (d > 0) inflow += d;
    else outflow += d;
  }
  const futureInflows = all.some((e) => Number(e.delta) > 0 && !predicate(e));
  let opening = inflow;
  let usedInitiale = false;
  let usedRestanteProxy = false;

  if (inflow <= EPS && used.length === 0 && opts.allowRestanteProxy && !futureInflows) {
    usedRestanteProxy = true;
    const qr = Number(lot.quantiteRestante) || 0;
    const qi = Number(lot.quantiteInitiale) || qr;
    return { q: qr, qi, usedInitiale: false, usedRestanteProxy, used };
  }

  if (inflow <= EPS && !futureInflows) {
    opening = Number(lot.quantiteInitiale) || 0;
    usedInitiale = true;
  }

  return {
    q: opening + outflow,
    qi: opening,
    usedInitiale,
    usedRestanteProxy,
    used,
  };
}

function ventesArticleWindow(ventes, articleId, asOfDayMs, windowDays) {
  const start = addUtcDays(asOfDayMs, -windowDays);
  let qty = 0;
  let maxDayMs = null;
  for (const v of ventes) {
    if (!VENTE_STATUTS_CONFIRMES.includes(String(v.statut || "").toUpperCase())) continue;
    if (String(v.typeVente || "").toUpperCase() === "AVOIR") continue;
    const day = utcDayMs(v.dateVente);
    if (day == null) continue;
    if (day < start || day >= asOfDayMs) continue;
    if (maxDayMs == null || day > maxDayMs) maxDayMs = day;
    for (const l of v.lignes || []) {
      if (Number(l.articleId) !== Number(articleId)) continue;
      qty += Number(l.quantite) || 0;
    }
  }
  return { qty: round2(qty), maxDayMs };
}

function prixUnitaireAt(lot, article, couches, historiqueCMP, asOfDayMs, tracker) {
  const couchesLot = couches
    .filter((c) => c.lotId === lot.id && utcDayMs(c.dateEntree) != null && utcDayMs(c.dateEntree) < asOfDayMs)
    .sort((a, b) => new Date(a.dateEntree) - new Date(b.dateEntree));
  if (couchesLot.length) {
    const c = couchesLot[couchesLot.length - 1];
    if (tracker) {
      const d = utcDayMs(c.dateEntree);
      if (d != null) tracker.maxDayMs = Math.max(tracker.maxDayMs || 0, d);
    }
    return Number(c.prixUnitaire) || 0;
  }
  const couchesArt = couches
    .filter(
      (c) =>
        c.articleId === lot.articleId &&
        c.depotId === lot.depotId &&
        utcDayMs(c.dateEntree) != null &&
        utcDayMs(c.dateEntree) < asOfDayMs
    )
    .sort((a, b) => new Date(a.dateEntree) - new Date(b.dateEntree));
  if (couchesArt.length) {
    const c = couchesArt[couchesArt.length - 1];
    if (tracker) {
      const d = utcDayMs(c.dateEntree);
      if (d != null) tracker.maxDayMs = Math.max(tracker.maxDayMs || 0, d);
    }
    return Number(c.prixUnitaire) || 0;
  }
  const cmps = historiqueCMP
    .filter(
      (h) =>
        h.articleId === lot.articleId &&
        h.depotId === lot.depotId &&
        utcDayMs(h.dateCalcul) != null &&
        utcDayMs(h.dateCalcul) < asOfDayMs
    )
    .sort((a, b) => new Date(a.dateCalcul) - new Date(b.dateCalcul));
  if (cmps.length) {
    const h = cmps[cmps.length - 1];
    if (tracker) {
      const d = utcDayMs(h.dateCalcul);
      if (d != null) tracker.maxDayMs = Math.max(tracker.maxDayMs || 0, d);
    }
    return Number(h.nouveauCMP) || 0;
  }
  return Number(article?.prixAchat) || 0;
}

function stockIncoherenceMap(stocks, lots) {
  const stockMap = new Map();
  for (const s of stocks) {
    const k = `${s.articleId}:${s.depotId}`;
    stockMap.set(k, (stockMap.get(k) || 0) + Number(s.quantite || 0));
  }
  const lotMap = new Map();
  for (const l of lots) {
    const k = `${l.articleId}:${l.depotId}`;
    lotMap.set(k, (lotMap.get(k) || 0) + Number(l.quantiteRestante || 0));
  }
  const bad = [];
  const keys = new Set([...stockMap.keys(), ...lotMap.keys()]);
  for (const k of keys) {
    const a = stockMap.get(k) || 0;
    const b = lotMap.get(k) || 0;
    if (Math.abs(a - b) > 0.001) bad.push({ key: k, stock: a, lots: b });
  }
  return bad;
}

function emptyQc() {
  return {
    json_invalides: 0,
    json_invalides_detail: [],
    evenements_sans_lot: 0,
    evenements_sans_lot_detail: [],
    fallback_lotId: 0,
    lots_legacy: 0,
    lots_sans_article: 0,
    lots_sans_dlc: 0,
    dlc_avant_entree: 0,
    quantite_negative: 0,
    quantite_negative_detail: [],
    lignes_exclues: 0,
    lignes_exclues_detail: [],
    qc_avoir_non_prorate: 0,
    qc_avoir_sans_lotsConsumed: 0,
    qc_initiale_fallback: 0,
    qc_y_proxy_restante: 0,
    leakage_blocked: false,
    leakage_detail: [],
    incoherences_stock: [],
  };
}

function buildRows(data, lookups, eventsByLot, todayMs, qc) {
  const rows = [];
  const leakageAsOfMs = todayMs;

  for (const lot of data.lots) {
    if (isLegacyNumero(lot.numero)) {
      qc.lots_legacy += 1;
      continue;
    }
    const article = lookups.articleById.get(lot.articleId);
    if (!article) {
      qc.lots_sans_article += 1;
      qc.lignes_exclues += 1;
      qc.lignes_exclues_detail.push({ lot_id: lot.id, reason: "lot_sans_article" });
      continue;
    }
    if (!lot.dateExpiration) {
      qc.lots_sans_dlc += 1;
      continue;
    }
    if (String(lot.statut || "").toUpperCase() === "DESACTIVE") continue;

    const dlcMs = utcDayMs(lot.dateExpiration);
    if (dlcMs == null) {
      qc.lignes_exclues += 1;
      qc.lignes_exclues_detail.push({ lot_id: lot.id, reason: "date_expiration_invalide" });
      continue;
    }

    const events = eventsByLot.get(lot.id) || [];
    const naissanceMs = dateNaissance(lot, events, lookups.achatById);
    if (naissanceMs == null) {
      qc.lignes_exclues += 1;
      qc.lignes_exclues_detail.push({ lot_id: lot.id, reason: "date_naissance_inconnue" });
      continue;
    }
    if (dlcMs <= naissanceMs) {
      qc.dlc_avant_entree += 1;
      qc.lignes_exclues += 1;
      qc.lignes_exclues_detail.push({ lot_id: lot.id, reason: "dlc_avant_entree" });
      continue;
    }

    const closed = dlcMs < todayMs;
    const yAt = quantityAt(
      lot,
      events,
      (e) => eventOnOrBeforeDlc(e.dayMs, dlcMs),
      null,
      { allowRestanteProxy: true }
    );
    const yQtyRaw = yAt.q;
    const ySource = yAt.usedRestanteProxy
      ? "proxy_quantite_restante"
      : yAt.usedInitiale && !yAt.used.length
        ? "ouverture_initiale"
        : "reconstructed";
    if (yAt.usedRestanteProxy) qc.qc_y_proxy_restante += 1;
    if (closed && yQtyRaw < -EPS) {
      qc.quantite_negative += 1;
      qc.quantite_negative_detail.push({
        lot_id: lot.id,
        field: "y_qty",
        value: yQtyRaw,
        y_source: ySource,
      });
    }

    for (const horizon of HORIZONS) {
      const asOfMs = addUtcDays(dlcMs, -horizon);
      if (asOfMs >= dlcMs) continue;
      if (asOfMs < naissanceMs) continue;
      if (asOfMs > leakageAsOfMs) continue;

      const tracker = { used: [], maxDayMs: null };
      const at = quantityAt(lot, events, (e) => eventBeforeAsOf(e.dayMs, asOfMs), tracker);
      const q = at.q;
      const qi = at.qi;
      if (at.usedInitiale) qc.qc_initiale_fallback += 1;
      const eventsBefore = at.used;

      if (q < -EPS) {
        qc.quantite_negative += 1;
        qc.quantite_negative_detail.push({
          lot_id: lot.id,
          as_of_date: isoDay(asOfMs),
          field: "quantite_restante_asof",
          value: q,
        });
        qc.lignes_exclues += 1;
        qc.lignes_exclues_detail.push({
          lot_id: lot.id,
          as_of: isoDay(asOfMs),
          reason: "q_asof_negative",
          value: q,
        });
        continue;
      }

      const asOfCutoff = asOfMs;
      const leakEvents = tracker.used.filter((e) => !eventBeforeAsOf(e.dayMs, asOfCutoff));
      if (leakEvents.length) {
        qc.leakage_blocked = true;
        qc.leakage_detail.push({
          lot_id: lot.id,
          as_of: isoDay(asOfMs),
          events: leakEvents.map((e) => ({ kind: e.kind, ts: e.ts, source: e.source })),
        });
      }
      if (tracker.maxDayMs != null && tracker.maxDayMs >= asOfMs) {
        qc.leakage_blocked = true;
        qc.leakage_detail.push({
          lot_id: lot.id,
          as_of: isoDay(asOfMs),
          leak: "events_lot",
          max_event_day: isoDay(tracker.maxDayMs),
        });
      }

      const v7 = ventesArticleWindow(data.ventes, lot.articleId, asOfMs, 7);
      const v30 = ventesArticleWindow(data.ventes, lot.articleId, asOfMs, 30);
      if (v7.maxDayMs != null && v7.maxDayMs >= asOfMs) {
        qc.leakage_blocked = true;
        qc.leakage_detail.push({ lot_id: lot.id, as_of: isoDay(asOfMs), leak: "ventes_7j" });
      }
      if (v30.maxDayMs != null && v30.maxDayMs >= asOfMs) {
        qc.leakage_blocked = true;
        qc.leakage_detail.push({ lot_id: lot.id, as_of: isoDay(asOfMs), leak: "ventes_30j" });
      }

      const prixTracker = { maxDayMs: null };
      const prix = prixUnitaireAt(lot, article, data.couches, data.historiqueCMP, asOfMs, prixTracker);
      if (prixTracker.maxDayMs != null && prixTracker.maxDayMs >= asOfMs) {
        qc.leakage_blocked = true;
        qc.leakage_detail.push({ lot_id: lot.id, as_of: isoDay(asOfMs), leak: "prix_unitaire" });
      }

      const ventesLot = round2(
        (events || [])
          .filter((e) => e.kind === "OUT_VENTE" && eventBeforeAsOf(e.dayMs, asOfMs))
          .reduce((s, e) => s + Math.abs(Number(e.delta) || 0), 0)
      );
      if (ventesLot > qi + EPS && qi > EPS) {
        qc.lignes_exclues_detail.push({
          lot_id: lot.id,
          as_of: isoDay(asOfMs),
          reason: "ventes_lot_gt_initiale",
          ventes_lot_asof: ventesLot,
          quantite_initiale: qi,
        });
      }

      const nMvt = eventsBefore.length;
      const nSortiesVente = eventsBefore.filter((e) => e.kind === "OUT_VENTE").length;
      const joursRestants = ceilDaysUntil(asOfMs, dlcMs);
      if (joursRestants <= 0) {
        qc.lignes_exclues += 1;
        qc.lignes_exclues_detail.push({
          lot_id: lot.id,
          as_of: isoDay(asOfMs),
          reason: "jours_restants_non_positifs",
        });
        continue;
      }
      const age = daysBetween(naissanceMs, asOfMs);
      const duree = daysBetween(naissanceMs, dlcMs);
      const pctVie = duree > 0 ? age / duree : 0;
      const pctConso = qi > EPS ? Math.min(1, Math.max(0, (qi - q) / qi)) : 0;
      const vitesse = v30.qty / 30;
      const qPred = Math.max(0, q - vitesse * joursRestants);
      const ratio = q / Math.max(vitesse * joursRestants, EPS);
      const modeTracage = String(article.modeTracage || "AUCUN").toUpperCase();
      const ventesLotFiable = modeTracage === "LOT" && nSortiesVente > 0 ? 1 : 0;

      let yWaste = "";
      let yQty = "";
      let yValeur = "";
      let splitRole = "score";
      if (closed) {
        if (yQtyRaw < -EPS) {
          qc.lignes_exclues += 1;
          qc.lignes_exclues_detail.push({
            lot_id: lot.id,
            as_of: isoDay(asOfMs),
            reason: "y_qty_negative",
            value: yQtyRaw,
            y_source: ySource,
          });
          continue;
        }
        const yq = yQtyRaw;
        yWaste = yq > EPS ? 1 : 0;
        yQty = round2(yq);
        yValeur = round2(yq * prix);
        splitRole = "train";
      }

      rows.push({
        lot_id: lot.id,
        numero: lot.numero,
        article_id: lot.articleId,
        article_code: article.code,
        depot_id: lot.depotId,
        famille_id: article.familleId == null ? "" : article.familleId,
        as_of_date: isoDay(asOfMs),
        horizon_jours: horizon,
        date_fabrication: isoDay(naissanceMs),
        date_expiration: isoDay(dlcMs),
        quantite_initiale: round2(qi),
        quantite_restante_asof: round2(q),
        pourcentage_consomme: round2(pctConso),
        age_du_lot: age,
        duree_vie_jours: duree,
        jours_restants_avant_expiration: joursRestants,
        pct_vie_ecoulee: round2(pctVie),
        ventes_7j: v7.qty,
        ventes_30j: v30.qty,
        vitesse_moyenne_journaliere: round2(vitesse),
        ventes_lot_asof: ventesLot,
        ventes_lot_fiable: ventesLotFiable,
        nombre_de_mouvements: nMvt,
        nombre_sorties_vente_lot: nSortiesVente,
        prix_unitaire: round2(prix),
        prix_vente: round2(Number(article.prixVente) || 0),
        valeur_stock: round2(q * prix),
        strategie_sortie: article.strategieSortie || "",
        mode_tracage: modeTracage,
        qte_predite_dlc_heuristique: round2(qPred),
        ratio_couverture: round2(ratio),
        observation_fermee: closed ? 1 : 0,
        y_waste: yWaste,
        y_qty: yQty,
        y_valeur: yValeur,
        split_role: splitRole,
        source: "real_data",
      });
    }
  }

  return rows;
}

function assertNoDuplicates(rows) {
  const seen = new Set();
  const dups = [];
  for (const r of rows) {
    const k = `${r.lot_id}|${r.as_of_date}`;
    if (seen.has(k)) dups.push(k);
    seen.add(k);
  }
  return dups;
}

function writeCsv(rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvEscape(r[c])).join(","));
  }
  fs.writeFileSync(CSV_PATH, `${lines.join("\n")}\n`, "utf8");
}

function summarizeRows(rows) {
  const lotIds = new Set(rows.map((r) => r.lot_id));
  const closedLotIds = new Set(rows.filter((r) => r.observation_fermee === 1).map((r) => r.lot_id));
  const openLotIds = new Set(rows.filter((r) => r.observation_fermee === 0).map((r) => r.lot_id));
  const yByLot = new Map();
  for (const r of rows) {
    if (r.split_role !== "train") continue;
    if (!yByLot.has(r.lot_id)) yByLot.set(r.lot_id, r.y_waste);
  }
  let y0 = 0;
  let y1 = 0;
  for (const v of yByLot.values()) {
    if (Number(v) === 1) y1 += 1;
    else y0 += 1;
  }
  return { lotIds, closedLotIds, openLotIds, y0, y1 };
}

function buildReport({ data, lotsAvecDlc, rows, qc, dups, summary }) {
  const insufficient = summary.closedLotIds.size < 100 || summary.y0 < 30 || summary.y1 < 30;
  return {
    generated_at: new Date().toISOString(),
    real_data: true,
    simulation: false,
    insufficient_for_supervised_sklearn: insufficient,
    lots_analyses: data.lots.length,
    lots_avec_dlc: lotsAvecDlc.length,
    snapshots_generes: rows.length,
    lignes_finales: rows.length,
    lots_distincts_csv: summary.lotIds.size,
    lots_fermes: summary.closedLotIds.size,
    lots_ouverts: summary.openLotIds.size,
    y_waste_0: summary.y0,
    y_waste_1: summary.y1,
    y_waste_unit: "lots_distincts",
    lignes_exclues: qc.lignes_exclues,
    lignes_exclues_detail: qc.lignes_exclues_detail.slice(0, 50),
    quantite_negative_detectee: qc.quantite_negative,
    quantite_negative_detail: qc.quantite_negative_detail,
    json_invalides: qc.json_invalides,
    json_invalides_detail: qc.json_invalides_detail.slice(0, 20),
    lots_legacy: qc.lots_legacy,
    lots_sans_article: qc.lots_sans_article,
    lots_sans_dlc: qc.lots_sans_dlc,
    dlc_avant_entree: qc.dlc_avant_entree,
    incoherences_stock: qc.incoherences_stock.length,
    incoherences_stock_detail: qc.incoherences_stock.slice(0, 20),
    evenements_sans_lot: qc.evenements_sans_lot,
    evenements_sans_lot_detail: qc.evenements_sans_lot_detail.slice(0, 30),
    fallback_lotId_utilise: qc.fallback_lotId,
    qc_avoir_non_prorate: qc.qc_avoir_non_prorate,
    qc_avoir_sans_lotsConsumed: qc.qc_avoir_sans_lotsConsumed,
    qc_initiale_fallback: qc.qc_initiale_fallback,
    qc_y_proxy_restante: qc.qc_y_proxy_restante,
    leakage_detected: Boolean(qc.leakage_blocked),
    leakage_detail: qc.leakage_detail.slice(0, 20),
    doublons: dups.length,
    csv_path: CSV_PATH,
    csv_columns: CSV_COLUMNS,
    source: "real_data",
  };
}

function writeReport(report) {
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const qc = emptyQc();
  const todayMs = utcDayMs(new Date());
  const data = await loadAll();
  const lookups = buildLookups(data);
  const eventsByLot = buildEventLedger(data, lookups, qc);
  qc.incoherences_stock = stockIncoherenceMap(data.stocks, data.lots);

  const lotsAvecDlc = data.lots.filter((l) => l.dateExpiration && !isLegacyNumero(l.numero));
  const rows = buildRows(data, lookups, eventsByLot, todayMs, qc);
  const dups = assertNoDuplicates(rows);
  const summary = summarizeRows(rows);
  const report = buildReport({ data, lotsAvecDlc, rows, qc, dups, summary });

  if (qc.leakage_blocked) {
    writeReport(report);
    const err = new Error(
      `Fuite temporelle détectée — CSV non écrit (${qc.leakage_detail.length} occurrence(s)). Voir le rapport.`
    );
    err.leakage = qc.leakage_detail;
    throw err;
  }

  if (dups.length) {
    writeReport(report);
    throw new Error(`Doublons (lot_id, as_of_date) : ${dups.join(", ")}`);
  }

  writeCsv(rows);
  writeReport(report);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    csv: CSV_PATH,
    report: REPORT_PATH,
    lignes: rows.length,
    lots_distincts: summary.lotIds.size,
    y_waste_0: summary.y0,
    y_waste_1: summary.y1,
    insufficient_for_supervised_sklearn: report.insufficient_for_supervised_sklearn,
  }, null, 2));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[export-expiry-waste-dataset] ÉCHEC:", err.message);
    if (err.leakage) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(err.leakage, null, 2));
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
