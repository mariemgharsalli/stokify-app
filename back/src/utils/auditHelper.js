const prisma = require("../config/database");
const { logActivity, sanitizeBody } = require("../services/activityLogger");

const ENTITY_MODULE_MAP = {
  Article: "articles",
  Achat: "achats",
  Vente: "ventes",
  Mouvement: "mouvements",
  Lot: "lots",
  NumeroSerie: "series",
  Inventaire: "inventaire",
  Depot: "depots",
  Emplacement: "depots",
  Famille: "refs",
  SousFamille: "refs",
  Marque: "refs",
  Groupe: "refs",
  Client: "clients",
  Fournisseur: "clients",
  CoutStockage: "couts",
  CoutEntry: "couts",
  Auth: "auth",
  Utilisateur: "admin",
  Facture: "factures",
  Reglement: "reglements",
};

function resolveModule(entite, module) {
  if (module) {
    const m = String(module).toLowerCase();
    if (m === "auth") return "auth";
    return m;
  }
  return ENTITY_MODULE_MAP[entite] || "general";
}

function mapAction(action) {
  const a = String(action || "").toUpperCase();
  if (a === "LOGIN_FAIL") return "LOGIN";
  if (a === "IMPORT") return "CREATE";
  return a;
}

/**
 * Enregistre une entrée d'audit (compatible avec l'ancien schéma module/ancienneValeur).
 * Écrit aussi dans ActivityLog pour le journal d'activité utilisateur.
 */
async function createAudit(opts) {
  const {
    userId,
    action,
    entite,
    entiteId,
    description,
    ip,
    societeId,
    module,
    ancienneValeur,
    nouvelleValeur,
    req,
  } = opts;
  if (!userId) return;

  const mappedAction = mapAction(action);
  const mappedModule = resolveModule(entite, module);
  const isError = String(action).toUpperCase() === "LOGIN_FAIL";

  try {
    await prisma.audit.create({
      data: {
        utilisateurId: Number(userId),
        action: String(action),
        module: module || entite || "GENERAL",
        entite: entite || null,
        entiteId: entiteId != null ? String(entiteId) : null,
        description: description || null,
        ip: ip || null,
        societeId: societeId != null ? Number(societeId) : null,
        ancienneValeur: ancienneValeur || null,
        nouvelleValeur: nouvelleValeur || null,
      },
    });
  } catch (e) {
    console.warn("[audit]", e?.message || e);
  }

  await logActivity({
    userId,
    action: mappedAction,
    module: mappedModule,
    entity: entite || null,
    entityId: entiteId != null ? Number(entiteId) : null,
    entityLabel: description || null,
    details:
      ancienneValeur || nouvelleValeur
        ? { ancienneValeur, nouvelleValeur }
        : req?.body
          ? { body: sanitizeBody(req.body) }
          : null,
    status: isError ? "ERROR" : "SUCCESS",
    errorMsg: isError ? description : null,
    societeId,
    req: req || (ip ? { ip, headers: {} } : undefined),
  });
}

function auditFromReq(req, data) {
  return createAudit({
    userId: req.user?.id,
    societeId: req.user?.societeId,
    ip: req.ip || req.headers?.["x-forwarded-for"] || null,
    req,
    ...data,
  });
}

module.exports = { createAudit, auditFromReq };
