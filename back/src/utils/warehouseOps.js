const { emplacementCapaciteUnits, round2 } = require("./warehouseLayout");

function isActifStatut(row) {
  return String(row?.statut ?? "ACTIF").trim().toUpperCase() !== "INACTIF";
}

function throwDepotInactif(depot) {
  const err = new Error(
    `Le dépôt « ${depot?.libelle || depot?.code || depot?.id} » est inactif. Réactivez-le avant toute opération.`
  );
  err.status = 409;
  err.code = "DEPOT_INACTIF";
  throw err;
}

function throwEmplacementInactif(em) {
  const err = new Error(
    `L'emplacement « ${em?.code || em?.libelle || em?.id} » est inactif. Réactivez-le avant toute opération.`
  );
  err.status = 409;
  err.code = "EMPLACEMENT_INACTIF";
  throw err;
}

async function getDepotOrThrow(db, { id, societeId }) {
  const depot = await db.depot.findFirst({
    where: { id: Number(id), societeId: Number(societeId) },
  });
  if (!depot) {
    const err = new Error("Depot introuvable");
    err.status = 404;
    throw err;
  }
  return depot;
}

async function assertDepotOperable(db, { id, societeId }) {
  const depot = await getDepotOrThrow(db, { id, societeId });
  if (!isActifStatut(depot)) throwDepotInactif(depot);
  return depot;
}

async function assertEmplacementOperable(db, { id, depotId, societeId }) {
  const em = await db.emplacement.findFirst({
    where: {
      id: Number(id),
      ...(depotId != null ? { depotId: Number(depotId) } : {}),
    },
    include: { depot: true },
  });
  if (!em || Number(em.depot?.societeId) !== Number(societeId)) {
    const err = new Error("Emplacement introuvable");
    err.status = 404;
    throw err;
  }
  if (!isActifStatut(em.depot)) throwDepotInactif(em.depot);
  if (!isActifStatut(em)) throwEmplacementInactif(em);
  return em;
}

/**
 * Résout un dépôt opérable. Sans id : premier dépôt ACTIF de la société.
 */
async function resolveOperableDepot(db, societeId, depotId) {
  const sid = Number(societeId);
  if (depotId != null && depotId !== "") {
    return assertDepotOperable(db, { id: depotId, societeId: sid });
  }
  const first = await db.depot.findFirst({
    where: { societeId: sid, statut: { not: "INACTIF" } },
    orderBy: { id: "asc" },
  });
  if (!first) {
    const err = new Error("Aucun dépôt actif configuré pour cette société");
    err.status = 400;
    err.code = "NO_ACTIVE_DEPOT";
    throw err;
  }
  return first;
}

async function assertInboundCapacity(db, { societeId, articleId, depotId, emplacementId, deltaQty }) {
  const q = Number(deltaQty);
  if (!Number.isFinite(q) || q <= 0) return;

  const article = await db.article.findFirst({
    where: { id: Number(articleId), societeId: Number(societeId) },
    select: { id: true, poids: true, volume: true, libelle: true, code: true },
  });
  if (!article) return;

  if (emplacementId) {
    const em = await db.emplacement.findFirst({
      where: { id: Number(emplacementId), depotId: Number(depotId) },
      include: {
        stocks: { where: { quantite: { gt: 0 } }, select: { quantite: true } },
      },
    });
    if (em) {
      const cap = emplacementCapaciteUnits(em);
      const used = (em.stocks || []).reduce((s, x) => s + Number(x.quantite || 0), 0);
      if (used + q > cap + 1e-9) {
        const err = new Error(
          `Capacité de l'emplacement ${em.code} dépassée : ${round2(used + q)} / ${cap} unités`
        );
        err.status = 409;
        err.code = "EMPLACEMENT_CAPACITE";
        throw err;
      }
    }
  }

  const depot = await db.depot.findFirst({
    where: { id: Number(depotId), societeId: Number(societeId) },
    select: { id: true, code: true, capacitePoids: true, capaciteVolume: true },
  });
  if (!depot) return;

  const stocks = await db.stock.findMany({
    where: { depotId: Number(depotId), quantite: { gt: 0 } },
    select: {
      quantite: true,
      article: { select: { poids: true, volume: true } },
    },
  });

  let poids = 0;
  let volume = 0;
  for (const s of stocks) {
    const qq = Number(s.quantite || 0);
    poids += qq * Number(s.article?.poids || 0);
    volume += qq * Number(s.article?.volume || 0);
  }
  poids += q * Number(article.poids || 0);
  volume += q * Number(article.volume || 0);

  const capPoids = Number(depot.capacitePoids);
  if (Number.isFinite(capPoids) && capPoids > 0 && poids > capPoids + 1e-6) {
    const err = new Error(
      `Capacité poids du dépôt dépassée : ${round2(poids)} / ${capPoids} kg`
    );
    err.status = 409;
    err.code = "DEPOT_CAPACITE_POIDS";
    throw err;
  }

  const capVol = Number(depot.capaciteVolume);
  if (Number.isFinite(capVol) && capVol > 0 && volume > capVol + 1e-6) {
    const err = new Error(
      `Capacité volume du dépôt dépassée : ${round2(volume)} / ${capVol} m³`
    );
    err.status = 409;
    err.code = "DEPOT_CAPACITE_VOLUME";
    throw err;
  }
}

module.exports = {
  isActifStatut,
  throwDepotInactif,
  throwEmplacementInactif,
  getDepotOrThrow,
  assertDepotOperable,
  assertEmplacementOperable,
  resolveOperableDepot,
  assertInboundCapacity,
};
