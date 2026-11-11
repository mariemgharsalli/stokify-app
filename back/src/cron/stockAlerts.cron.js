const cron = require("node-cron");
const prisma = require("../config/database");
const { createSmtpTransporter, getSmtpFrom } = require("../utils/smtp");
const { syncAlerteStockAfterQtyChange } = require("../utils/stockAlertUtils");

let scheduled = false;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendRuptureEmail(rupture, emails, societe) {
  const transporter = createSmtpTransporter();
  if (!transporter || !emails.length) return false;

  const article = rupture.article;
  const depot = rupture.depot;
  const lastMvt = await prisma.mouvement.findFirst({
    where: { articleId: rupture.articleId, depotId: rupture.depotId, statut: "VALIDE" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const frontUrl = process.env.FRONT_URL || "http://localhost:5173";
  const link = `${frontUrl}/stock?articleId=${rupture.articleId}&depotId=${rupture.depotId}`;
  const subject = `⚠ Rupture de stock — ${article?.libelle || article?.code} — ${depot?.libelle || depot?.code}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;">
<p><strong>Rupture de stock détectée</strong></p>
<ul>
  <li><strong>Article :</strong> ${escapeHtml(article?.code || "")} — ${escapeHtml(article?.libelle || "")}</li>
  <li><strong>Dépôt :</strong> ${escapeHtml(depot?.libelle || depot?.code || "")}</li>
  <li><strong>Quantité restante :</strong> ${Number(rupture.quantite || 0).toLocaleString("fr-FR")}</li>
  <li><strong>Dernier mouvement :</strong> ${lastMvt?.createdAt ? new Date(lastMvt.createdAt).toLocaleString("fr-FR") : "—"}</li>
</ul>
<p><a href="${escapeHtml(link)}">Voir le stock de cet article</a></p>
</div>`;

  const from = getSmtpFrom(societe);
  await transporter.sendMail({ from, to: emails.join(", "), subject, html });
  return true;
}

async function runStockAlerts() {
  const stocks = await prisma.stock.findMany({
    include: { article: true, depot: true },
  });

  const byKey = new Map();
  for (const s of stocks) {
    const key = `${s.articleId}:${s.depotId}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        articleId: s.articleId,
        depotId: s.depotId,
        quantite: Number(s.quantite) || 0,
        article: s.article,
        depot: s.depot,
      });
    } else {
      prev.quantite += Number(s.quantite) || 0;
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const row of byKey.values()) {
    const societeId = row.article?.societeId;
    if (!societeId) continue;

    const hadRecentRupture = await prisma.alerteStock.findFirst({
      where: {
        articleId: row.articleId,
        depotId: row.depotId,
        type: "RUPTURE",
        resolue: false,
        createdAt: { gte: since },
      },
      select: { id: true },
    });

    await syncAlerteStockAfterQtyChange(prisma, {
      societeId,
      articleId: row.articleId,
      depotId: row.depotId,
    });

    if (Number(row.quantite) > 0 || hadRecentRupture) continue;

    const created = await prisma.alerteStock.findFirst({
      where: {
        articleId: row.articleId,
        depotId: row.depotId,
        type: "RUPTURE",
        resolue: false,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (!created) continue;

    const responsables = await prisma.utilisateur.findMany({
      where: {
        societeId,
        actif: true,
        role: { in: ["RESPONSABLE", "ADMIN", "SUPER_ADMIN"] },
      },
      select: { email: true },
    });
    const emails = responsables.map((u) => u.email).filter(Boolean);
    const societe = await prisma.societe.findUnique({ where: { id: societeId } });

    try {
      await sendRuptureEmail(row, emails, societe);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[stockAlerts]", e?.message || e);
    }
  }
}

function startStockAlertsCron() {
  if (scheduled || process.env.DISABLE_STOCK_ALERTS === "1") return;
  scheduled = true;
  cron.schedule("0 * * * *", () => {
    runStockAlerts().catch((e) => {
      // eslint-disable-next-line no-console
      console.warn("[stockAlerts.cron]", e?.message || e);
    });
  });
  // eslint-disable-next-line no-console
  console.log("[stockAlerts.cron] planifié (toutes les heures)");
}

module.exports = startStockAlertsCron;
