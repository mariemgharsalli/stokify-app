const cron = require("node-cron");
const prisma = require("../config/database");
const { createSmtpTransporter, getSmtpFrom } = require("../utils/smtp");

let scheduled = false;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsHtml(lignes, dateCommande, totalTTC) {
  const rows = (lignes || [])
    .map(
      (l) => `<tr>
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(l.article?.code || "")}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(l.article?.libelle || "")}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${Number(l.quantite || 0)}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${Number(l.totalHT || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3 })}</td>
</tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;width:100%;max-width:720px;font-size:13px;margin-top:12px;">
<thead><tr style="background:#0f172a;color:#f8fafc;">
  <th style="padding:8px;border:1px solid #e2e8f0;">Code</th>
  <th style="padding:8px;border:1px solid #e2e8f0;">Article</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Qté</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Total HT</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin-top:8px;">Date commande : <strong>${escapeHtml(dateCommande ? new Date(dateCommande).toLocaleDateString("fr-FR") : "—")}</strong></p>
<p>Total TTC : <strong>${Number(totalTTC || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND</strong></p>`;
}

async function runRelanceFournisseurOnce() {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn("[relanceFournisseurJob] SMTP non configuré — emails ignorées.");
    return;
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 7);

  const achats = await prisma.achat.findMany({
    where: {
      statut: "COMMANDE",
      dateCommande: { lt: cutoff },
    },
    include: {
      fournisseur: { select: { nom: true, email: true } },
      societe: { select: { nom: true } },
      lignes: { include: { article: { select: { code: true, libelle: true } } } },
    },
  });

  const from = getSmtpFrom();

  for (const a of achats) {
    const to = a.fournisseur?.email;
    if (!to) continue;

    const subject = `Relance commande #${a.reference} — ${a.societe?.nom || ""}`;
    const html = `
<div style="font-family:system-ui,sans-serif;color:#0f172a;">
  <p>Bonjour ${escapeHtml(a.fournisseur?.nom || "")},</p>
  <p>Nous nous permettons de relancer concernant la commande <strong>${escapeHtml(a.reference)}</strong>
  (${escapeHtml(a.societe?.nom || "")}).</p>
  ${rowsHtml(a.lignes, a.dateCommande, a.totalTTC)}
  <p style="margin-top:16px;">Merci de confirmer la date de livraison prévue.</p>
  <p style="margin-top:16px;font-size:12px;color:#64748b;">Message automatique Stokify.</p>
</div>`;

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[relanceFournisseurJob] achat", a.id, e?.message || e);
    }
  }
}

module.exports = function relanceFournisseurJob() {
  if (scheduled) return;
  if (process.env.DISABLE_RELANCES === "1" || process.env.NODE_ENV === "test") return;
  scheduled = true;
  cron.schedule(
    "0 9 * * 1",
    () => {
      runRelanceFournisseurOnce().catch((e) => console.error("[relanceFournisseurJob]", e));
    },
    { timezone: process.env.TZ || "Europe/Paris" }
  );
};
