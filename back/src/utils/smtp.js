const nodemailer = require("nodemailer");

/** Gmail via SMTP_USER / SMTP_PASS in .env (espaces retirés du mot de passe d'application) */
function createSmtpTransporter() {
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function getSmtpFrom(societe) {
  const displayName = String(process.env.SMTP_FROM_NAME || "Stokify").trim() || "Stokify";
  const address = String(process.env.SMTP_FROM || societe?.email || process.env.SMTP_USER || "").trim();
  if (!address) return displayName;
  return `"${displayName}" <${address}>`;
}

module.exports = { createSmtpTransporter, getSmtpFrom };
