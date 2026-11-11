const cron = require("node-cron");
const prisma = require("../config/database");
const { createSmtpTransporter, getSmtpFrom } = require("../utils/smtp");

let scheduled = false;

function addDays(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + Number(days));
  return x;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsHtml(lots, { urgent = false } = {}) {
  const rowBg = urgent ? "#fff1f2" : "#ffffff";
  const dlcColor = urgent ? "#dc2626" : "#0f172a";
  const lines = lots
    .map(
      (l) => `<tr style="background:${rowBg};">
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(l.article?.libelle || "")}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(l.numero || "")}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(l.depot?.libelle || l.depot?.code || "")}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;color:${dlcColor};font-weight:${urgent ? "700" : "400"};">${l.dateExpiration ? new Date(l.dateExpiration).toLocaleDateString("fr-FR") : "—"}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;">${Number(l.quantiteRestante || 0).toLocaleString("fr-FR")}</td>
</tr>`
    )
    .join("");
  const headerBg = urgent ? "#991b1b" : "#0f172a";
  return `<table style="border-collapse:collapse;width:100%;max-width:720px;font-size:13px;">
<thead><tr style="background:${headerBg};color:#f8fafc;">
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Article</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Lot N°</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">Dépôt</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:left;">DLC</th>
  <th style="padding:8px;border:1px solid #e2e8f0;text-align:right;">Qté restante</th>
</tr></thead>
<tbody>${lines}</tbody>
</table>`;
}

async function fetchLotsForTier({ now, maxDays, excludeAlerte }) {
  const until = addDays(now, maxDays);
  return prisma.lot.findMany({
    where: {
      statut: "ACTIF",
      quantiteRestante: { gt: 0 },
      dateExpiration: { not: null, gte: now, lte: until },
      OR: [{ derniereAlerteEnvoyee: null }, { derniereAlerteEnvoyee: { not: excludeAlerte } }],
    },
    include: {
      article: {
        select: {
          libelle: true,
          code: true,
          societeId: true,
          societe: { select: { id: true, nom: true } },
        },
      },
      depot: { select: { libelle: true, code: true } },
    },
    orderBy: [{ dateExpiration: "asc" }, { id: "asc" }],
  });
}

function groupBySociete(lots) {
  const bySoc = new Map();
  for (const l of lots) {
    const sid = l.article?.societeId;
    if (!sid) continue;
    if (!bySoc.has(sid)) bySoc.set(sid, []);
    bySoc.get(sid).push(l);
  }
  return bySoc;
}

async function sendTierEmails({ transporter, from, tier, lots }) {
  const bySoc = groupBySociete(lots);
  const isJ7 = tier === "J7";
  const subjectPrefix = isJ7 ? "🔴 Alerte URGENTE DLC J-7" : "⚠️ Alerte DLC J-30";
  const introColor = isJ7 ? "#991b1b" : "#0f172a";
  const introText = isJ7
    ? "Des lots expirent dans <strong style=\"color:#dc2626;\">moins de 7 jours</strong>. Action immédiate requise."
    : "Des lots expirent dans les <strong>30 prochains jours</strong>.";

  for (const [societeId, items] of bySoc.entries()) {
    const users = await prisma.utilisateur.findMany({
      where: {
        societeId,
        actif: true,
        role: { in: ["MAGASINIER", "RESPONSABLE"] },
      },
      select: { email: true },
    });
    const emails = [...new Set(users.map((u) => u.email).filter(Boolean))];
    if (!emails.length) continue;

    const count = items.length;
    const subject = `${subjectPrefix} — ${count} lot(s)`;
    const html = `
<div style="font-family:system-ui,sans-serif;color:${introColor};${isJ7 ? "border-left:4px solid #dc2626;padding-left:12px;" : ""}">
  <p>Bonjour,</p>
  <p>La société <strong>${escapeHtml(items[0]?.article?.societe?.nom || "")}</strong> : ${introText}</p>
  <p><strong>${count}</strong> lot(s) concerné(s) :</p>
  ${rowsHtml(items, { urgent: isJ7 })}
  <p style="margin-top:16px;font-size:12px;color:#64748b;">Message automatique Stokify — palier ${tier}.</p>
</div>`;

    try {
      await transporter.sendMail({ from, to: emails.join(", "), subject, html });
      await prisma.lot.updateMany({
        where: { id: { in: items.map((l) => l.id) } },
        data: { derniereAlerteEnvoyee: tier },
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[dlcAlertJob] envoi ${tier} société`, societeId, e?.message || e);
    }
  }
}

async function runDlcAlertOnce() {
  const transporter = createSmtpTransporter();
  if (!transporter) {
    // eslint-disable-next-line no-console
    console.warn("[dlcAlertJob] SMTP non configuré (SMTP_USER / SMTP_PASS) — email ignorée.");
    return;
  }

  const now = new Date();
  const from = getSmtpFrom();

  const lotsJ30 = await fetchLotsForTier({ now, maxDays: 30, excludeAlerte: "J30" });
  if (lotsJ30.length) {
    await sendTierEmails({ transporter, from, tier: "J30", lots: lotsJ30 });
  }

  const lotsJ7 = await fetchLotsForTier({ now, maxDays: 7, excludeAlerte: "J7" });
  if (lotsJ7.length) {
    await sendTierEmails({ transporter, from, tier: "J7", lots: lotsJ7 });
  }
}

module.exports = function dlcAlertJob() {
  if (scheduled) return;
  if (process.env.DISABLE_DLC_ALERT === "1" || process.env.NODE_ENV === "test") return;
  scheduled = true;
  cron.schedule(
    "0 8 * * *",
    () => {
      runDlcAlertOnce().catch((e) =>
        // eslint-disable-next-line no-console
        console.error("[dlcAlertJob]", e)
      );
    },
    { timezone: process.env.TZ || "Europe/Paris" }
  );
};

module.exports.runDlcAlertOnce = runDlcAlertOnce;
