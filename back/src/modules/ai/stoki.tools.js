const { hasPermission } = require("../../middleware/rbac");
const { getStock, getStockAlerts } = require("../stock/stock.service");
const { listLotsExpiringSoon } = require("../lots/lots.service");
const { getExpiryWasteRisk } = require("../stock/expiryWaste.service");
const { getTopArticles } = require("../accounting/accounting.service");
const { getStatsAchats, getAchatsEnRetard, listAchats } = require("../achats/achats.service");
const { exportMouvements } = require("../mouvements/mouvements.service");
const { listAnomalies } = require("../stock/anomalies.service");
const { getForecast, getForecastMulti, aggregateMonthlySales } = require("../stock/forecast.service");
const { listInventairesEnriched } = require("../inventaires/inventaires.service");
const { listClients } = require("../clients/clients.service");
const { listFournisseurs } = require("../fournisseurs/fournisseurs.service");
const { getDashboard } = require("../ia/ia.service");
const { getRotationReport, getDeadStockReport } = require("../rapports/rapports.service");
const { lookupHelp } = require("./stoki.help");

const MAX_ROWS = 15;
const TOOL_TIMEOUT_MS = 9000;
const TOOL_TIMEOUTS = {
  get_ia_pulse: 12000,
  explain_rupture_risk: 14000,
  get_forecast: 12000,
  get_expiry_waste_risk: 12000,
};

const TOOL_DEFS = [
  {
    name: "get_stock_alerts",
    permission: "stock:read",
    label: "Alertes stock",
    description:
      "Ruptures (qty ≤ 0) et stocks critiques (qty ≤ seuil). Pour « ce qui manque », « quantité nulle », « sous seuil ». Pas pour le risque futur (utiliser explain_rupture_risk).",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["rupture", "critique", "all"],
          description: "rupture | critique | all (défaut all)",
        },
      },
    },
  },
  {
    name: "search_article_stock",
    permission: "stock:read",
    label: "Recherche article",
    description:
      "Localise un article par code ou libellé : dépôts, emplacements, quantités. Pour « où est ART-001 », « stock de vis M8 ».",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Code ou libellé (obligatoire)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_lots_expiring",
    permission: "stock:read",
    label: "Lots DLC",
    description: "Lots actifs dont la DLC arrive (FEFO). Défaut 30 jours.",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Horizon en jours (1-90, défaut 30)" },
      },
    },
  },
  {
    name: "get_expiry_waste_risk",
    permission: "stock:read",
    altPermissions: ["ai:read"],
    label: "Risque péremption",
    description:
      "Runway DLC : quantité et valeur encore en stock à la date d'expiration, horizon J-3/7/14, playbook FEFO/promo. Pour « gaspillage », « lots qui vont périmer », « valeur perdue ». Complète FEFO, ne le remplace pas.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_top_sales",
    permission: "accounting:read",
    altPermissions: ["ventes:read"],
    label: "Top ventes",
    description: "Articles les plus vendus (CA HT) sur une période. Défaut année en cours, top 10.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Top N (max 15)" },
        days: { type: "integer", description: "Fenêtre en jours (défaut depuis le 1er janvier)" },
      },
    },
  },
  {
    name: "get_purchases_overview",
    permission: "achats:read",
    label: "Achats",
    description: "Synthèse achats (totaux, retards, top fournisseurs) et dernières commandes.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_movements_summary",
    permission: "mouvements:read",
    label: "Mouvements",
    description:
      "Agrégation des mouvements récents par dépôt. Pour « quel dépôt a le plus de mouvements ».",
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Période (défaut 30, max 90)" },
      },
    },
  },
  {
    name: "list_anomalies",
    permission: "stock:read",
    label: "Anomalies",
    description: "Anomalies de stock / mouvements non résolues (scores IA ou règles locales).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_forecast",
    permission: "stock:read",
    label: "Prévision",
    description:
      "Prévision de vente d'UN article déjà identifié (articleId numérique). Sinon search_article_stock d'abord, ou explain_rupture_risk pour un risque global.",
    parameters: {
      type: "object",
      properties: {
        articleId: { type: "integer", description: "ID interne article" },
      },
      required: ["articleId"],
    },
  },
  {
    name: "explain_rupture_risk",
    permission: "stock:read",
    label: "Risque rupture",
    description:
      "Combine alertes stock + seuils + prévisions IA pour expliquer QUI risque une rupture et POURQUOI. À utiliser pour « bientôt », « risque », « pourquoi critique ».",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_inventories",
    permission: "stock:read",
    label: "Inventaires",
    description: "Inventaires récents (statut, dépôt, écarts).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_partners",
    permission: "ventes:read",
    label: "Partenaires",
    description: "Liste courte clients et/ou fournisseurs. kind=clients|fournisseurs|all.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["clients", "fournisseurs", "all"] },
        query: { type: "string" },
      },
    },
  },
  {
    name: "get_ia_pulse",
    permission: "ai:read",
    label: "Hub IA",
    description: "Indicateurs du hub IA Stokify (anomalies, prévisions, pulse) — résumé borné.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_rotation_overview",
    permission: "rapports:read",
    label: "Rotation",
    description: "Rotation et dead stock (aperçu borné).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_stokify_help",
    permission: "ai:read",
    label: "Aide Stokify",
    description: "Pédagogie WMS : FIFO, FEFO, inventaire, réception, navigation modules.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Sujet : fifo, fefo, inventaire, reception..." },
      },
    },
  },
];

function toOpenAiTools() {
  return TOOL_DEFS.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: "object", properties: {} },
    },
  }));
}

function toolMeta(name) {
  return TOOL_DEFS.find((t) => t.name === name) || { name, label: name, permission: "ai:read" };
}

function canUse(perms, def) {
  if (!def.permission) return true;
  if (hasPermission(perms, def.permission)) return true;
  return (def.altPermissions || []).some((p) => hasPermission(perms, p));
}

function clipJson(value, max = 4500) {
  const s = JSON.stringify(value);
  if (s.length <= max) return s;
  return JSON.stringify({ truncated: true, preview: s.slice(0, max - 40) });
}

function articleCard(a) {
  if (!a?.id) return null;
  return {
    id: a.id,
    code: a.code,
    libelle: a.libelle,
    imageUrl: a.imageUrl || null,
    prixAchat: a.prixAchat ?? null,
    unite: a.unite || null,
  };
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`timeout:${label}`);
        err.code = "TOOL_TIMEOUT";
        reject(err);
      }, ms);
    }),
  ]);
}

function deny(permission) {
  return {
    ok: false,
    error: "permission_denied",
    permission,
    message: `Permission insuffisante (${permission}). Je ne peux pas accéder à cette donnée.`,
  };
}

async function execGetStockAlerts(user, args) {
  const kind = String(args.kind || "all").toLowerCase();
  const raw = await getStockAlerts(user);
  const ruptures = raw.filter((x) => x.statut === "RUPTURE").slice(0, MAX_ROWS);
  const critiques = raw.filter((x) => x.statut === "CRITIQUE").slice(0, MAX_ROWS);
  let items = raw;
  if (kind === "rupture") items = ruptures;
  else if (kind === "critique") items = critiques;
  else items = [...ruptures, ...critiques].slice(0, MAX_ROWS);

  const compact = items.map((x) => ({
    articleId: x.articleId,
    code: x.code,
    libelle: x.libelle,
    quantite: x.quantite,
    seuil: x.seuil,
    statut: x.statut,
    depot: x.depot ? `${x.depot.code} — ${x.depot.libelle}` : null,
  }));

  return {
    data: {
      source: "live",
      kind,
      totalAlertes: raw.length,
      nbRuptures: raw.filter((x) => x.statut === "RUPTURE").length,
      nbCritiques: raw.filter((x) => x.statut === "CRITIQUE").length,
      items: compact,
    },
    rows: compact.length,
    articles: items.map((x) =>
      articleCard({
        id: x.articleId,
        code: x.code,
        libelle: x.libelle,
        imageUrl: x.imageUrl,
        prixAchat: x.prixAchat,
        unite: x.unite,
      })
    ),
  };
}

async function execSearchArticle(user, args) {
  const query = String(args.query || "").trim();
  if (!query) {
    return { data: { error: "query_required", message: "Indiquez un code ou un libellé." }, rows: 0, articles: [] };
  }
  const res = await getStock({ user, search: query, page: 1, limit: 12 });
  const items = (res.items || []).map((s) => ({
    articleId: s.article?.id,
    code: s.article?.code,
    libelle: s.article?.libelle,
    quantite: Number(s.quantite),
    unite: s.article?.unite,
    seuil: s.article?.seuilAlerte ?? s.article?.stockMin,
    famille: s.article?.famille?.nom || null,
    depot: s.depot ? `${s.depot.code} — ${s.depot.libelle}` : null,
    emplacement: s.emplacement ? `${s.emplacement.code}` : null,
  }));
  return {
    data: { source: "live", query, total: res.total, items },
    rows: items.length,
    articles: (res.items || []).map((s) => articleCard(s.article)),
  };
}

async function execLots(user, args) {
  const days = Math.min(90, Math.max(1, Number(args.days) || 30));
  const res = await listLotsExpiringSoon(user, { days, limit: MAX_ROWS });
  const items = (res.items || []).map((l) => ({
    articleId: l.article?.id,
    code: l.article?.code,
    libelle: l.article?.libelle,
    lot: l.numero,
    reste: Number(l.quantiteRestante),
    dlc: l.dateExpiration ? new Date(l.dateExpiration).toISOString().slice(0, 10) : null,
    depot: l.depot ? `${l.depot.code} — ${l.depot.libelle}` : null,
  }));
  return {
    data: { source: "live", days: res.days, total: res.total, strategie_recommandee: "FEFO", items },
    rows: items.length,
    articles: (res.items || []).map((l) => articleCard(l.article)),
  };
}

async function execExpiryWaste(user) {
  const res = await getExpiryWasteRisk(user.societeId);
  const items = (res.items || []).slice(0, MAX_ROWS).map((x) => ({
    lot: x.numero,
    article: x.articleLibelle || x.articleCode,
    depot: x.depotLibelle || x.depotCode,
    dlc: x.dateExpiration,
    jours: x.joursRestants,
    restant: x.quantiteRestante,
    qtePrediteDlc: x.qtePrediteDlc,
    valeurPredite: x.valeurPredite,
    proba: x.probaWaste,
    bande: x.band,
    horizon: x.horizon,
    priorite: x.priorite,
    fefo: x.fefoActif,
    couvertureJours: x.joursCouverture,
    playbook: x.playbook?.label || null,
    action: x.action,
  }));
  return {
    data: {
      source: "heuristic_pkl_or_local",
      interpretation: "IA_heuristique_pas_sklearn_supervise",
      kind: res.kind,
      mode: res.mode,
      version: res.version,
      briefing: res.briefing,
      kpis: res.kpis,
      playbook: (res.playbook || []).slice(0, 5),
      items,
    },
    rows: items.length,
    articles: (res.items || []).slice(0, MAX_ROWS).map((x) =>
      articleCard({
        id: x.articleId,
        code: x.articleCode,
        libelle: x.articleLibelle,
        imageUrl: x.imageUrl,
        prixAchat: x.prixUnitaire,
      })
    ),
  };
}

async function execTopSales(user, args) {
  const limit = Math.min(15, Math.max(3, Number(args.limit) || 10));
  const days = Number(args.days);
  const now = new Date();
  let dateDebut;
  if (Number.isFinite(days) && days > 0) {
    dateDebut = new Date(now.getTime() - Math.min(365, days) * 86400000).toISOString().slice(0, 10);
  } else {
    dateDebut = `${now.getFullYear()}-01-01`;
  }
  const dateFin = now.toISOString().slice(0, 10);
  const rows = await getTopArticles(user, { dateDebut, dateFin, limit });
  const items = (rows || []).map((x) => ({
    articleId: x.articleId,
    libelle: x.libelle,
    imageUrl: x.imageUrl || null,
    prixAchat: x.prixAchat ?? null,
    qteVendue: x.qteVendue,
    caHT: x.chiffreAffairesHT,
    partCaPct: x.partDuCA,
    stockActuel: x.stockActuel,
  }));
  return {
    data: { source: "live", periode: { dateDebut, dateFin }, items },
    rows: items.length,
    articles: items.map((x) =>
      articleCard({
        id: x.articleId,
        libelle: x.libelle,
        imageUrl: x.imageUrl,
        prixAchat: x.prixAchat,
      })
    ),
  };
}

async function execPurchases(user) {
  const [stats, retard, recent] = await Promise.all([
    getStatsAchats(user, {}),
    getAchatsEnRetard(user).catch(() => []),
    listAchats(user, { page: 1, limit: 6 }),
  ]);
  const late = (Array.isArray(retard) ? retard : retard?.items || []).slice(0, 8);
  return {
    data: {
      source: "live",
      totaux: {
        moisTTC: stats.totalMois,
        anneeTTC: stats.totalAnnee,
        nbCommandes: stats.nbCommandes,
        nbEnRetard: stats.nbEnRetard,
        nbBrouillons: stats.nbBrouillons,
        montantNonRegle: stats.montantNonRegle,
      },
      topFournisseurs: (stats.topFournisseurs || []).slice(0, 5),
      enRetard: late.map((a) => ({
        reference: a.reference,
        fournisseur: a.fournisseur?.nom,
        statut: a.statut,
        dateLivraisonPrevue: a.dateLivraisonPrevue,
      })),
      recentes: (recent.items || []).map((a) => ({
        reference: a.reference,
        fournisseur: a.fournisseur?.nom,
        totalTTC: a.totalTTC,
        statut: a.statut,
      })),
    },
    rows: (recent.items || []).length,
    articles: [],
  };
}

async function execMovements(user, args) {
  const days = Math.min(90, Math.max(7, Number(args.days) || 30));
  const dateFrom = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await exportMouvements(user, { dateFrom, limitExport: 1500 });
  const byDepot = new Map();
  const byType = new Map();
  for (const m of rows || []) {
    const depotKey = m.depot?.code || m.depot?.libelle || "?";
    const cur = byDepot.get(depotKey) || { depot: depotKey, libelle: m.depot?.libelle, nb: 0 };
    cur.nb += 1;
    byDepot.set(depotKey, cur);
    const t = m.type || "AUTRE";
    byType.set(t, (byType.get(t) || 0) + 1);
  }
  const depots = [...byDepot.values()].sort((a, b) => b.nb - a.nb).slice(0, 8);
  return {
    data: {
      source: "live",
      periodeJours: days,
      echantillon: (rows || []).length,
      depotLePlusActif: depots[0] || null,
      parDepot: depots,
      parType: [...byType.entries()].map(([type, nb]) => ({ type, nb })).slice(0, 10),
    },
    rows: depots.length,
    articles: [],
  };
}

async function execAnomalies(user) {
  const res = await listAnomalies(user.societeId, { statut: "NON_RESOLU", skipStudio: true });
  const items = (res.items || []).slice(0, MAX_ROWS).map((a) => ({
    id: a.id,
    articleId: a.article?.id || a.articleId,
    code: a.article?.code,
    libelle: a.article?.libelle,
    imageUrl: a.article?.imageUrl || null,
    score: a.score,
    statut: a.statut,
    raison: a.raison || a.motif || a.message,
    depot: a.depot ? `${a.depot.code}` : null,
    source: a.source || "anomalie",
  }));
  return {
    data: {
      source: "live",
      interpretation: "IA_ou_regles_locales",
      kpis: res.kpis || null,
      items,
    },
    rows: items.length,
    articles: items.map((a) =>
      articleCard({ id: a.articleId, code: a.code, libelle: a.libelle, imageUrl: a.imageUrl })
    ),
  };
}

async function execForecast(user, args) {
  const articleId = Number(args.articleId);
  if (!articleId) {
    return { data: { error: "articleId_required" }, rows: 0, articles: [] };
  }
  try {
    const fc = await getForecast(articleId, user.societeId);
    const hist = (fc.historique || fc.historiqueMensuel || []).slice(-6);
    return {
      data: {
        source: "ia_ou_fallback_local",
        interpretation: "IA",
        articleId: fc.articleId,
        code: fc.articleCode,
        libelle: fc.articleLibelle,
        stockActuel: fc.stockActuel,
        recommendedStock: fc.recommendedStock,
        reorderPoint: fc.reorderPoint,
        confidence: fc.confidence,
        historiqueRecent: hist,
      },
      rows: 1,
      articles: [
        articleCard({
          id: fc.articleId,
          code: fc.articleCode,
          libelle: fc.articleLibelle,
          imageUrl: fc.imageUrl,
          prixAchat: fc.prixAchat,
        }),
      ],
    };
  } catch (err) {
    if (err.status === 404) {
      return {
        data: {
          source: "live",
          message: "Je n'ai pas trouvé cette information dans les données disponibles de Stokify.",
          articleId,
        },
        rows: 0,
        articles: [],
      };
    }
    throw err;
  }
}

async function execRuptureRisk(user) {
  const raw = await getStockAlerts(user);
  const ranked = [...raw].sort((a, b) => {
    if (a.statut === "RUPTURE" && b.statut !== "RUPTURE") return -1;
    if (b.statut === "RUPTURE" && a.statut !== "RUPTURE") return 1;
    const ra = a.seuil > 0 ? a.quantite / a.seuil : 0;
    const rb = b.seuil > 0 ? b.quantite / b.seuil : 0;
    return ra - rb;
  });
  const unique = [];
  const seen = new Set();
  for (const row of ranked) {
    if (seen.has(row.articleId)) continue;
    seen.add(row.articleId);
    unique.push(row);
    if (unique.length >= 6) break;
  }

  if (!unique.length) {
    return {
      data: {
        source: "live",
        items: [],
        message: "Aucune alerte rupture/critique. Pas de risque immédiat détecté via les seuils.",
      },
      rows: 0,
      articles: [],
    };
  }

  let forecasts = [];
  const histById = new Map();
  try {
    const multi = await getForecastMulti(
      unique.map((x) => x.articleId),
      user.societeId
    );
    forecasts = multi.items || multi || [];
    if (!Array.isArray(forecasts)) forecasts = [];
  } catch {
    forecasts = [];
  }

  await Promise.all(
    unique.map(async (a) => {
      try {
        const hist = await aggregateMonthlySales(a.articleId, user.societeId, 12);
        histById.set(Number(a.articleId), (hist || []).slice(-6));
      } catch {
        histById.set(Number(a.articleId), []);
      }
    })
  );

  const byId = new Map(forecasts.map((f) => [Number(f.articleId || f.article_id), f]));
  const items = unique.map((a) => {
    const fc = byId.get(Number(a.articleId));
    const rec = fc ? Number(fc.recommendedStock ?? fc.reorderPoint ?? 0) : null;
    const conf = fc ? Number(fc.confidence ?? 0) : null;
    const hist = Array.isArray(fc?.historique)
      ? fc.historique.slice(-6)
      : histById.get(Number(a.articleId)) || [];
    let pourquoi = `Stock live ${a.quantite} vs seuil ${a.seuil} (${a.statut}).`;
    if (hist.length) {
      const last = hist[hist.length - 1];
      pourquoi += ` Historique ventes (dernier mois ${last.mois || "n/a"}): ${last.quantite ?? "n/a"}.`;
    }
    if (fc) {
      pourquoi += ` Interprétation IA : stock recommandé ${rec}, confiance ${Math.round((conf || 0) * 100) / 100}.`;
      if (rec != null && a.quantite < rec) {
        pourquoi += " Le stock actuel est sous le niveau recommandé par la prévision.";
      }
    } else {
      pourquoi += " Prévision IA indisponible pour cette référence — jugement basé sur le seuil live uniquement.";
    }
    return {
      articleId: a.articleId,
      code: a.code,
      libelle: a.libelle,
      imageUrl: a.imageUrl || null,
      prixAchat: a.prixAchat ?? null,
      unite: a.unite || null,
      statut: a.statut,
      quantite: a.quantite,
      seuil: a.seuil,
      depot: a.depot ? `${a.depot.code} — ${a.depot.libelle}` : null,
      recommendedStock: rec,
      confidence: conf,
      historiqueVentes: hist,
      pourquoi,
    };
  });

  return {
    data: {
      source: "live+ia",
      methode: "alertes_stock + getForecastMulti (max 6)",
      items,
    },
    rows: items.length,
    articles: items.map((x) =>
      articleCard({
        id: x.articleId,
        code: x.code,
        libelle: x.libelle,
        imageUrl: x.imageUrl,
        prixAchat: x.prixAchat,
        unite: x.unite,
      })
    ),
  };
}

async function execInventories(user) {
  const res = await listInventairesEnriched({ user, page: 1, limit: 8 });
  const items = (res.items || []).map((inv) => ({
    reference: inv.reference,
    statut: inv.statut,
    depot: inv.depot ? `${inv.depot.code} — ${inv.depot.libelle}` : null,
    date: inv.createdAt || inv.dateInventaire,
    nbLignes: inv.lignes?.length ?? inv._count?.lignes,
    ecart: inv.ecartTotal ?? inv.summary?.ecart,
  }));
  return { data: { source: "live", total: res.total, items }, rows: items.length, articles: [] };
}

async function execPartners(user, args, perms) {
  const kind = String(args.kind || "all").toLowerCase();
  const query = args.query ? String(args.query).trim() : undefined;
  const out = {};
  if (kind === "clients" || kind === "all") {
    if (!hasPermission(perms, "ventes:read") && !hasPermission(perms, "clients:write")) {
      out.clients = deny("ventes:read");
    } else {
      const c = await listClients({ user, search: query, page: 1, limit: 8 });
      out.clients = {
        total: c.total,
        items: (c.items || []).map((x) => ({ code: x.code, nom: x.nom, nbVentes: x._count?.ventes })),
      };
    }
  }
  if (kind === "fournisseurs" || kind === "all") {
    if (!hasPermission(perms, "achats:read")) {
      out.fournisseurs = deny("achats:read");
    } else {
      const f = await listFournisseurs({ user, search: query, page: 1, limit: 8 });
      out.fournisseurs = {
        total: f.total,
        items: (f.items || []).map((x) => ({ code: x.code, nom: x.nom, nbAchats: x._count?.achats })),
      };
    }
  }
  return { data: { source: "live", ...out }, rows: 1, articles: [] };
}

async function execIaPulse(user) {
  try {
    const dash = await getDashboard(user.societeId, {});
    return {
      data: {
        source: "hub_ia",
        interpretation: "IA",
        kpis: dash.kpis
          ? {
              previsions: dash.kpis.previsions,
              anomalies: dash.kpis.anomalies,
              recommandations: dash.kpis.recommandations,
              confianceMoyenne: dash.kpis.confianceMoyenne,
              decisionsAppliquees: dash.kpis.decisionsAppliquees,
            }
          : null,
        pulse: {
          score: dash.meta?.pulseScore,
          band: dash.meta?.pulseBand,
          aiServiceOnline: dash.meta?.aiServiceOnline,
        },
      },
      rows: 1,
      articles: [],
    };
  } catch {
    const res = await listAnomalies(user.societeId, { statut: "NON_RESOLU", skipStudio: true });
    return {
      data: {
        source: "hub_ia_partiel",
        interpretation: "IA",
        message: "Pulse complet indisponible — aperçu anomalies live uniquement.",
        kpis: res.kpis || { anomalies: (res.items || []).length },
      },
      rows: 1,
      articles: [],
    };
  }
}

async function execRotation(user) {
  const [rot, dead] = await Promise.all([
    getRotationReport(user.societeId, { days: 30 }),
    getDeadStockReport(user.societeId, { seuil: 90 }),
  ]);
  const rotItems = (rot.items || rot.lignes || rot || []);
  const list = Array.isArray(rotItems) ? rotItems : [];
  const low = [...list].sort((a, b) => (Number(a.taux) || 0) - (Number(b.taux) || 0)).slice(0, 8);
  const deadItems = (dead.items || []).slice(0, 8);
  return {
    data: {
      source: "live",
      summary: rot.summary || null,
      rotationFaible: low.map((x) => ({
        code: x.article?.code || x.code,
        libelle: x.article?.libelle || x.libelle,
        tauxPct: x.taux,
        depot: x.depot?.libelle || x.depot,
      })),
      deadStock: deadItems.map((x) => ({
        code: x.article?.code || x.code,
        libelle: x.article?.libelle || x.libelle,
        jours: x.joursImmobilise || x.joursSansMouvement || x.jours,
      })),
    },
    rows: low.length + deadItems.length,
    articles: [],
  };
}

async function execHelp(_user, args = {}) {
  const topic = String(args.topic || args.query || "navigation");
  const items = lookupHelp(topic);
  return {
    data: { source: "aide_metier", items },
    rows: items.length,
    articles: [],
  };
}

const EXECUTORS = {
  get_stock_alerts: execGetStockAlerts,
  search_article_stock: execSearchArticle,
  get_lots_expiring: execLots,
  get_expiry_waste_risk: execExpiryWaste,
  get_top_sales: execTopSales,
  get_purchases_overview: execPurchases,
  get_movements_summary: execMovements,
  list_anomalies: execAnomalies,
  get_forecast: execForecast,
  explain_rupture_risk: execRuptureRisk,
  get_inventories: execInventories,
  get_partners: execPartners,
  get_ia_pulse: execIaPulse,
  get_rotation_overview: execRotation,
  get_stokify_help: execHelp,
};

function foldQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

const STOCKOUT_RE =
  /\balertes?\b|\bruptur|\bseuil\b|out of stock|stock-?out|ausverkauft|agotad|sin stock|\brottura\b|esaurit|نفاد|نافد|plus en stock|\bepuis|low stock|stock faible|sous seuil|nicht auf lager/;
const STOCKOUT_ONLY_RE =
  /out of stock|stock-?out|ausverkauft|agotad|sin stock|\bruptur|\brottura\b|esaurit|نفاد|نافد|plus en stock|\bepuis|nicht auf lager/;
const STOCKOUT_BROAD_RE = /seuil|critique|low stock|sous seuil|stock faible/;
const RISK_RE =
  /risque.{0,28}ruptur|ruptur.{0,28}(risque|bientot|prochain)|pourquoi.{0,20}critique|risk a stockout|stockout risk|riesgo.{0,20}ruptur/;
const SALES_RE =
  /top vente|plus vend|meilleures ventes|se vendent|sell the most|best sellers?|se venden|verkaufen|si vendono|مبيع/;
const EXPIRY_RE =
  /\bperem|\bdlc\b|\bdluo\b|\bexpir|\bcaduc|laufen bald ab|\bscad|\bmhd\b|صلاح|تنته/;
const HELP_RE =
  /(c'est quoi|qu'est-ce|what is|was ist|que es|cos'e|ما هو).{0,40}\b(fefo|fifo)\b/;

/**
 * Un seul outil quand le LLM est indisponible.
 * Couvre les pistes FR/EN/ES/DE/IT/AR du panneau STOKI.
 */
function offlineToolForMessage(message) {
  const t = foldQuestion(message);
  if (HELP_RE.test(t)) {
    return { name: "get_stokify_help", args: { topic: String(message || "").slice(0, 200) } };
  }
  if (RISK_RE.test(t)) return { name: "explain_rupture_risk", args: {} };
  if (STOCKOUT_RE.test(t)) {
    const onlyOut = STOCKOUT_ONLY_RE.test(t) && !STOCKOUT_BROAD_RE.test(t);
    return { name: "get_stock_alerts", args: { kind: onlyOut ? "rupture" : "all" } };
  }
  if (EXPIRY_RE.test(t)) return { name: "get_expiry_waste_risk", args: {} };
  if (/\banomal/.test(t)) return { name: "list_anomalies", args: {} };
  if (/\bprevision\b|\bforecast\b|\bprevis|\bprognos/.test(t)) return { name: "get_forecast", args: {} };
  if (SALES_RE.test(t)) return { name: "get_top_sales", args: {} };
  return { name: "get_ia_pulse", args: {} };
}

/**
 * Fallback si Groq n'émet pas de tool_calls — heuristique légère, pas un FAQ.
 */
function suggestToolsFromText(text) {
  const t = foldQuestion(text);
  const routed = offlineToolForMessage(text);
  const names = routed.name === "get_ia_pulse" ? [] : [routed.name];
  const pedagogical = /c'est quoi|comment (fonctionne|faire|r[ée]ceptionner|utiliser)/.test(t);
  const risk = RISK_RE.test(t);
  if (risk) names.push("explain_rupture_risk");
  else if (STOCKOUT_RE.test(t) && !pedagogical) {
    names.push("get_stock_alerts");
  }
  const hasCode = /\b[A-Za-z]{1,8}[-_/]?\d{2,8}\b/.test(text || "");
  if (!pedagogical && (/o[uù] (est|trouver|se trouve)|localisation/.test(t) || hasCode)) {
    names.push("search_article_stock");
  }
  if (!pedagogical && !risk && (/\blots?\b|dlc|dluo|expir|pérem|perem|gaspill/.test(t) || (/\bfefo\b/.test(t) && /lot|dlc|expir/.test(t)))) {
    names.push("get_lots_expiring");
    if (/gaspill|risque|valeur|invenu|périm/.test(t)) names.push("get_expiry_waste_risk");
  }
  if (SALES_RE.test(t)) names.push("get_top_sales");
  if (/achat|fournisseur|r[ée]appro/.test(t) && !pedagogical && !/fifo|fefo/.test(t)) {
    names.push("get_purchases_overview");
  }
  if (/mouvement|d[ée]p[oô]t.{0,20}plus/.test(t) && !pedagogical) names.push("get_movements_summary");
  if (/anomal/.test(t) && !pedagogical) names.push("list_anomalies");
  if (/pr[ée]vision|forecast/.test(t) && !risk && !pedagogical) names.push("get_ia_pulse");
  if (/inventaire/.test(t) && !pedagogical) names.push("get_inventories");
  if (/client|fournisseur/.test(t) && /liste|qui|mes/.test(t) && !pedagogical) names.push("get_partners");
  if (/hub ia|pulse|recommandation ia/.test(t)) names.push("get_ia_pulse");
  if (/rotation|dead stock|sommeil|immobilis/.test(t)) names.push("get_rotation_overview");
  if (pedagogical || /fifo|fefo|aide/.test(t)) {
    names.push("get_stokify_help");
  }
  return [...new Set(names)].slice(0, 3);
}

function extractSearchQuery(text) {
  const code = String(text || "").match(/\b[A-Za-z]{1,8}[-_/]?\d{2,8}\b/);
  if (code) return code[0];
  return String(text || "").trim().slice(0, 80);
}

async function executeTool(name, rawArgs, { user, perms }) {
  const def = toolMeta(name);
  const started = Date.now();
  const args = rawArgs && typeof rawArgs === "object" ? { ...rawArgs } : {};
  delete args.societeId;
  delete args.societe_id;
  delete args.companyId;

  if (!EXECUTORS[name]) {
    return {
      name,
      label: def.label,
      status: "error",
      rows: 0,
      ms: Date.now() - started,
      jsonForLlm: JSON.stringify({ error: "unknown_tool", name }),
      articles: [],
    };
  }

  if (name === "get_partners") {
    const canPartners =
      hasPermission(perms, "ventes:read") ||
      hasPermission(perms, "achats:read") ||
      hasPermission(perms, "clients:write");
    if (!canPartners) {
      const payload = deny("ventes:read");
      return {
        name,
        label: def.label,
        status: "denied",
        rows: 0,
        ms: Date.now() - started,
        jsonForLlm: JSON.stringify(payload),
        articles: [],
      };
    }
  } else if (!canUse(perms, def)) {
    const payload = deny(def.permission);
    return {
      name,
      label: def.label,
      status: "denied",
      rows: 0,
      ms: Date.now() - started,
      jsonForLlm: JSON.stringify(payload),
      articles: [],
    };
  }

  if (name === "search_article_stock" && !args.query) {
    args.query = extractSearchQuery(args._userMessage || "");
  }
  if (name === "get_stokify_help" && !args.topic) {
    args.topic = args._userMessage || "navigation";
  }
  delete args._userMessage;

  try {
    const run = EXECUTORS[name](user, args, perms);
    const result = await withTimeout(run, TOOL_TIMEOUTS[name] || TOOL_TIMEOUT_MS, name);
    return {
      name,
      label: def.label,
      status: "ok",
      rows: result.rows || 0,
      ms: Date.now() - started,
      jsonForLlm: clipJson(result.data),
      articles: (result.articles || []).filter(Boolean),
    };
  } catch (err) {
    const status = err.code === "TOOL_TIMEOUT" ? "timeout" : "error";
    return {
      name,
      label: def.label,
      status,
      rows: 0,
      ms: Date.now() - started,
      jsonForLlm: JSON.stringify({
        error: status,
        message: "Donnée indisponible pour le moment. Je n'invente pas de chiffre.",
      }),
      articles: [],
    };
  }
}

function publicTrace(entries) {
  return (entries || []).map((e) => ({
    tool: e.name,
    label: e.label,
    status: e.status,
    rows: e.rows,
    ms: e.ms,
  }));
}

module.exports = {
  TOOL_DEFS,
  toOpenAiTools,
  executeTool,
  suggestToolsFromText,
  offlineToolForMessage,
  extractSearchQuery,
  publicTrace,
  toolMeta,
};
