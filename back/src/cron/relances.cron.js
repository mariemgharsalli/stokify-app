const cron = require("node-cron");
const prisma = require("../config/database");
const { createSmtpTransporter, getSmtpFrom } = require("../utils/smtp");
const factureService = require("../modules/factures/facture.service");

let scheduled = false;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * 1) Persiste les RelanceClient via genererRelancesEnRetard (factures EMISE/PARTIEL
 *    avec dateEcheance dépassée).
 * 2) Envoie un email groupé par client pour les relances générées ce jour.
 */
async function runRelancesAuto() {
  const { items } = await factureService.genererRelancesEnRetard();
  if (!items.length) return { generated: 0, emailsSent: 0 };

  const byClient = new Map();
  for (const row of items) {
    const cid = row.clientId;
    if (!byClient.has(cid)) {
      byClient.set(cid, { rows: [], email: row.email });
    }
    byClient.get(cid).rows.push(row);
  }

  // Enrichir avec societe / client pour l'email
  let emailsSent = 0;
  for (const [clientId, pack] of byClient.entries()) {
    if (!pack.email) continue;
    const transporter = createSmtpTransporter();
    if (!transporter) continue;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { societe: true },
    });
    if (!client) continue;

    const rowsHtml = pack.rows
      .map(
        (r) =>
          `<tr><td style="padding:6px;border:1px solid #e2e8f0;">${escapeHtml(r.numero || "")}</td>
           <td style="padding:6px;border:1px solid #e2e8f0;text-align:right;">${Number(r.montantDu || 0).toFixed(3)} TND</td>
           <td style="padding:6px;border:1px solid #e2e8f0;text-align:right;">${r.joursRetard || 0} j</td></tr>`
      )
      .join("");

    const from = getSmtpFrom(client.societe);
    const subject = `Rappel de paiement — ${client.societe?.nom || ""}`;
    const html = `<div style="font-family:system-ui,sans-serif;">
      <p>Bonjour ${escapeHtml(client.nom || "")},</p>
      <p>Des factures restent impayées après échéance :</p>
      <table style="border-collapse:collapse;">
        <thead><tr><th>Facture</th><th>Montant dû</th><th>Retard</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p>Merci de régulariser votre situation.</p></div>`;

    try {
      await transporter.sendMail({ from, to: pack.email, subject, html });
      emailsSent += 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[relances.cron]", pack.email, e?.message || e);
    }
  }

  return { generated: items.length, emailsSent };
}

module.exports = function relancesCron() {
  if (scheduled) return;
  if (process.env.DISABLE_RELANCES === "1" || process.env.NODE_ENV === "test") return;
  scheduled = true;
  cron.schedule(
    "0 9 * * *",
    () => {
      runRelancesAuto().catch((e) => console.error("[relances.cron]", e));
    },
    { timezone: process.env.TZ || "Europe/Paris" }
  );
};

module.exports.runRelancesAuto = runRelancesAuto;
