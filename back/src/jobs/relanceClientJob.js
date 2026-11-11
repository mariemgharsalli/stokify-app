const cron = require("node-cron");
const prisma = require("../config/database");
const { createSmtpTransporter, getSmtpFrom } = require("../utils/smtp");

let scheduled = false;

const STATUTS_CONFIRMES = ["CONFIRME", "VALIDE", "LIVRE", "FACTUREE"];
const ALLOWED_JOURS = [15, 30, 60];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableHtml(rows) {
  const body = rows
    .map(
      (r) => `<tr>
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(r.reference)}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;">${r.dateStr}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${r.ttc}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${r.regle}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${r.reste}</td>
</tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;max-width:760px;font-size:13px;">
<thead><tr style="background:#0f172a;color:#f8fafc;">
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Facture</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Date</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Total TTC</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Déjà réglé</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Restant dû</th>
</tr></thead>
<tbody>${body}</tbody>
</table>`;
}

function resolveJours(societeJours) {
  const envRaw = Number(process.env.RELANCE_CLIENT_JOURS);
  if (ALLOWED_JOURS.includes(envRaw)) return envRaw;
  const s = Number(societeJours);
  if (ALLOWED_JOURS.includes(s)) return s;
  return 30;
}

async function runRelanceClientOnce() {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn("[relanceClientJob] SMTP non configuré — emails ignorées.");
    return;
  }

  const now = new Date();

  const ventes = await prisma.vente.findMany({
    where: {
      statut: { in: STATUTS_CONFIRMES },
      typeVente: { not: "AVOIR" },
    },
    include: {
      client: { select: { id: true, email: true, nom: true } },
      societe: { select: { nom: true, joursRelanceClient: true } },
      reglements: { where: { statut: { in: ["VALIDE", "EN_ATTENTE"] } } },
    },
  });

  const overdue = [];
  for (const v of ventes) {
    const jours = resolveJours(v.societe?.joursRelanceClient);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - jours);

    const regle = (v.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
    const reste = Number(v.totalTTC) - regle;
    if (reste < 0.02) continue;

    const lastReg =
      v.reglements && v.reglements.length > 0
        ? new Date(Math.max(...v.reglements.map((r) => new Date(r.datePayment).getTime())))
        : null;

    const baseline = lastReg || (v.confirmedAt ? new Date(v.confirmedAt) : new Date(v.dateVente));
    if (baseline >= cutoff) continue;

    const already = await prisma.relanceClient.findFirst({
      where: { venteId: v.id, type: "AUTO", sentAt: { gte: cutoff } },
    });
    if (already) continue;

    overdue.push({ vente: v, regle, reste, jours });
  }

  const byEmail = new Map();
  for (const { vente: v, regle, reste, jours } of overdue) {
    const email = v.client?.email;
    if (!email) continue;
    if (!byEmail.has(email)) {
      byEmail.set(email, {
        clientId: v.client.id,
        clientNom: v.client?.nom,
        societe: v.societe,
        jours,
        rows: [],
        ventes: [],
      });
    }
    byEmail.get(email).rows.push({
      reference: v.reference,
      dateStr: new Date(v.dateVente).toLocaleDateString("fr-FR"),
      ttc: `${Number(v.totalTTC).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND`,
      regle: `${Number(regle).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND`,
      reste: `${Number(reste).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND`,
    });
    byEmail.get(email).ventes.push(v);
  }

  const from = getSmtpFrom();

  for (const [to, pack] of byEmail.entries()) {
    const subject = `Rappel de paiement — ${pack.societe?.nom || ""}`;
    const html = `
<div style="font-family:system-ui,sans-serif;color:#0f172a;">
  <p>Bonjour ${escapeHtml(pack.clientNom || "")},</p>
  <p>Des factures présentent encore un solde impayé depuis plus de ${pack.jours} jours. Merci de vérifier le détail ci-dessous.</p>
  ${tableHtml(pack.rows)}
  <p style="margin-top:16px;">Merci de régulariser votre situation.</p>
  <p style="margin-top:16px;font-size:12px;color:#64748b;">Message automatique Stokify.</p>
</div>`;

    try {
      await transporter.sendMail({ from, to, subject, html });
      for (const v of pack.ventes) {
        await prisma.relanceClient.create({
          data: { clientId: pack.clientId, venteId: v.id, type: "AUTO", email: to },
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[relanceClientJob] client email", to, e?.message || e);
    }
  }
}

module.exports = function relanceClientJob() {
  if (scheduled) return;
  if (process.env.DISABLE_RELANCES === "1" || process.env.NODE_ENV === "test") return;
  scheduled = true;
  cron.schedule(
    "30 9 * * 1",
    () => {
      runRelanceClientOnce().catch((e) => console.error("[relanceClientJob]", e));
    },
    { timezone: process.env.TZ || "Europe/Paris" }
  );
};

module.exports.runRelanceClientOnce = runRelanceClientOnce;
