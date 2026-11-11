const { getSocieteWhere } = require("../../utils/societeScope");
const prisma = require("../../config/database");
const svc = require("./coutStockage.service");
const { generateCoutStockageExcel } = require("../../utils/excelHelper");
const { activityFromReq } = require("../../services/activityLogger");

async function list(req, res, next) {
  try {
    const result = await svc.listCoutStockage({
      societeId: req.user.societeId,
      articleId: req.query.articleId,
      depotId: req.query.depotId,
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await svc.getCoutStockage(req.params.id, req.user.societeId);
    if (!row) return res.status(404).json({ message: "Introuvable" });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    const row = await svc.createCoutStockage(req.body, req.user.societeId);
    await activityFromReq(req, { action: "CREATE", module: "couts", entity: "CoutStockage", entityId: row.id, entityLabel: `Coût stockage #${row.id}` });
    return res.status(201).json(row);
  } catch (e) {
    return next(e);
  }
}

async function update(req, res, next) {
  try {
    const row = await svc.updateCoutStockage(req.params.id, req.body, req.user.societeId);
    await activityFromReq(req, { action: "UPDATE", module: "couts", entity: "CoutStockage", entityId: row.id, entityLabel: `Coût stockage #${row.id}`, details: { valeurs: req.body } });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function remove(req, res, next) {
  try {
    await svc.deleteCoutStockage(req.params.id, req.user.societeId);
    return res.status(204).send();
  } catch (e) {
    return next(e);
  }
}

async function saveDepotMensuel(req, res, next) {
  try {
    const { depotId, periode, ...couts } = req.body;
    if (!depotId || !periode) return res.status(400).json({ message: "depotId et periode requis" });
    const row = await svc.saveCoutDepotMensuel(req.user.societeId, depotId, periode, couts);
    await activityFromReq(req, { action: "UPDATE", module: "couts", entity: "CoutDepotMensuel", entityLabel: `Coûts dépôt ${depotId} — ${periode}`, details: { depotId, periode, valeurs: couts } });
    return res.json(row);
  } catch (e) {
    return next(e);
  }
}

async function listDepotMensuel(req, res, next) {
  try {
    const items = await svc.listCoutDepotMensuel(req.user.societeId, {
      depotId: req.query.depotId,
      periode: req.query.periode,
    });
    return res.json({ items });
  } catch (e) {
    return next(e);
  }
}

async function deadStock(req, res, next) {
  try {
    const result = await svc.getDeadStock(req.user.societeId, {
      depotId: req.query.depotId,
      joursSeuilSansMouvement: req.query.jours ?? req.query.joursSeuil,
      tauxPossession: req.query.tauxPossession,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function tauxRotation(req, res, next) {
  try {
    const result = await svc.getTauxRotation(req.user.societeId, {
      depotId: req.query.depotId,
      periode: req.query.periode,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

async function totalPeriode(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const { dateDebut, dateFin, depotId } = req.query;
    if (!dateDebut || !dateFin) {
      return res.status(400).json({ message: "dateDebut et dateFin requis" });
    }
    const data = await svc.calcTotalPeriode({
      societeId,
      depotId: depotId ? Number(depotId) : undefined,
      dateDebut,
      dateFin,
    });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function kpiRentabilite(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const data = await svc.getKpiRentabiliteArticle({
      societeId,
      depotId: req.query.depotId ? Number(req.query.depotId) : undefined,
      articleId: req.query.articleId ? Number(req.query.articleId) : undefined,
    });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function profitability(req, res, next) {
  try {
    const { societeId } = getSocieteWhere(req.user);
    const depotId = req.query.depotId;
    if (!depotId) return res.status(400).json({ message: "depotId requis" });
    const data = await svc.calculateArticleProfitability(
      req.params.articleId,
      depotId,
      societeId
    );
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function listCoutEntries(req, res, next) {
  try {
    const { depotId, periode } = req.query;
    const data = await svc.getCoutEntries(depotId, periode, req.user.societeId);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function createCoutEntry(req, res, next) {
  try {
    const entry = await svc.createCoutEntry({
      ...req.body,
      societeId: req.user.societeId,
      createdBy: req.user.id,
    });
    await activityFromReq(req, {
      action: "CREATE",
      module: "couts",
      entity: "CoutEntry",
      entityId: entry.id,
      entityLabel: entry.nom,
    });
    return res.status(201).json(entry);
  } catch (e) {
    return next(e);
  }
}

async function updateCoutEntry(req, res, next) {
  try {
    const entry = await svc.updateCoutEntry(req.params.id, req.body, req.user.societeId);
    await activityFromReq(req, {
      action: "UPDATE",
      module: "couts",
      entity: "CoutEntry",
      entityId: entry.id,
      entityLabel: entry.nom,
      details: { valeurs: req.body },
    });
    return res.json(entry);
  } catch (e) {
    return next(e);
  }
}

async function removeCoutEntry(req, res, next) {
  try {
    await svc.deleteCoutEntry(req.params.id, req.user.societeId);
    return res.json({ success: true });
  } catch (e) {
    return next(e);
  }
}

async function totalCoutEntries(req, res, next) {
  try {
    const { depotId, periode } = req.query;
    if (!depotId || !periode) {
      return res.status(400).json({ message: "depotId et periode requis" });
    }
    const data = await svc.getTotalCoutEntries(depotId, periode, req.user.societeId);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function getCoutEntriesGrouped(req, res, next) {
  try {
    const { depotId, periode } = req.query;
    if (!depotId || !periode) {
      return res.status(400).json({ message: "depotId et periode requis" });
    }
    const data = await svc.getCoutEntriesGroupedByCategorie(depotId, periode, req.user.societeId);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function imputation(req, res, next) {
  try {
    const data = await svc.getImputation(req.user.societeId, {
      depotId: req.query.depotId,
      periode: req.query.periode,
      months: req.query.months,
    });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function getParametres(req, res, next) {
  try {
    const data = await svc.getParametres(req.user.societeId);
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function updateParametres(req, res, next) {
  try {
    const data = await svc.updateParametres(req.user.societeId, {
      tauxPossessionAnnuel: req.body?.tauxPossessionAnnuel,
    });
    await activityFromReq(req, {
      action: "UPDATE",
      module: "couts",
      entity: "ParametresCout",
      entityLabel: "Taux de possession",
      details: { tauxPossessionAnnuel: data.tauxPossessionAnnuel },
    });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

async function exportExcel(req, res, next) {
  try {
    const periode = req.query.periode || new Date().toISOString().slice(0, 7);
    const depotId = req.query.depotId;

    const [entries, unitCostsResult, deadStock, societe, depots] = await Promise.all([
      svc.getCoutEntries(depotId, periode, req.user.societeId),
      svc.listCoutStockage({
        societeId: req.user.societeId,
        depotId,
        limit: 5000,
        page: 1,
      }),
      svc.getDeadStock(req.user.societeId, { depotId, joursSeuilSansMouvement: 90 }),
      prisma.societe.findUnique({ where: { id: Number(req.user.societeId) } }),
      prisma.depot.findMany({
        where: { societeId: Number(req.user.societeId) },
        select: { id: true, code: true, libelle: true },
      }),
    ]);

    const depotMap = new Map(depots.map((d) => [d.id, d]));
    const enrichedEntries = entries.map((e) => ({
      ...e,
      depot: depotMap.get(e.depotId) || { code: String(e.depotId || "—") },
    }));

    let depotLabel = "Tous";
    if (depotId) {
      const d = depotMap.get(Number(depotId));
      depotLabel = d ? `${d.code} — ${d.libelle}` : String(depotId);
    }

    const buf = await generateCoutStockageExcel({
      societe,
      periodeLabel: periode,
      depotLabel,
      entries: enrichedEntries,
      unitCosts: unitCostsResult?.items || [],
      deadStock,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-couts-stockage-${periode}.xlsx"`
    );
    return res.send(Buffer.from(buf));
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  saveDepotMensuel,
  listDepotMensuel,
  totalPeriode,
  kpiRentabilite,
  deadStock,
  tauxRotation,
  profitability,
  listCoutEntries,
  createCoutEntry,
  updateCoutEntry,
  removeCoutEntry,
  totalCoutEntries,
  getCoutEntriesGrouped,
  exportExcel,
  imputation,
  getParametres,
  updateParametres,
};
