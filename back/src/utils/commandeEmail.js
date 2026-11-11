const { createSmtpTransporter, getSmtpFrom } = require("./smtp");

const STATUT_LABELS = {
  EN_ATTENTE: "En attente de confirmation",
  CONFIRMEE: "Confirmée",
  EN_PREPARATION: "En préparation",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

function buildCommandeStatusEmailHtml({
  clientNom,
  reference,
  statut,
  montantTTC,
  adresseLivraison,
  modePaiement,
  societeNom,
}) {
  const label = STATUT_LABELS[statut] || statut;
  const accent = statut === "ANNULEE" ? "#b91c1c" : "#0c5460";
  return `<!DOCTYPE html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f7f8;padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(12,84,96,.08)">
    <tr><td style="background:linear-gradient(135deg,#0c5460,#148a96);padding:28px 32px;color:#fff">
      <div style="font-size:12px;opacity:.85;letter-spacing:.08em;text-transform:uppercase">${societeNom || "Stokify"}</div>
      <h1 style="margin:8px 0 0;font-size:22px">Commande ${reference}</h1>
    </td></tr>
    <tr><td style="padding:28px 32px;color:#1a2b32">
      <p style="margin:0 0 12px">Bonjour ${clientNom || ""},</p>
      <p style="margin:0 0 20px">Votre commande est passée au statut :</p>
      <div style="display:inline-block;padding:10px 16px;border-radius:999px;background:${accent}18;color:${accent};font-weight:700;font-size:14px">${label}</div>
      <table width="100%" style="margin-top:24px;font-size:14px;color:#445">
        <tr><td style="padding:6px 0">Montant TTC</td><td style="text-align:right;font-weight:700">${Number(montantTTC || 0).toFixed(3)} TND</td></tr>
        ${modePaiement ? `<tr><td style="padding:6px 0">Paiement</td><td style="text-align:right">${modePaiement}</td></tr>` : ""}
        ${adresseLivraison ? `<tr><td style="padding:6px 0;vertical-align:top">Livraison</td><td style="text-align:right;white-space:pre-line">${adresseLivraison}</td></tr>` : ""}
      </table>
      <p style="margin:28px 0 0;font-size:13px;color:#789">Merci pour votre confiance.</p>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Envoie un email de statut commande (non bloquant — swallow errors).
 */
async function sendCommandeStatusEmail(commande, societe) {
  try {
    const to = commande?.client?.email;
    if (!to) return { sent: false, reason: "no_email" };
    const transporter = createSmtpTransporter();
    if (!transporter) return { sent: false, reason: "no_smtp" };

    const from = getSmtpFrom(societe);
    await transporter.sendMail({
      from,
      to,
      subject: `Stokify — Commande ${commande.reference} · ${STATUT_LABELS[commande.statut] || commande.statut}`,
      html: buildCommandeStatusEmailHtml({
        clientNom: commande.client?.nom,
        reference: commande.reference,
        statut: commande.statut,
        montantTTC: commande.montantTTC,
        adresseLivraison: commande.adresseLivraison,
        modePaiement: commande.modePaiement,
        societeNom: societe?.nom,
      }),
    });
    return { sent: true };
  } catch (e) {
    console.warn("[commandeEmail]", e.message || e);
    return { sent: false, reason: e.message };
  }
}

module.exports = {
  STATUT_LABELS,
  buildCommandeStatusEmailHtml,
  sendCommandeStatusEmail,
};
