const path = require("path");
const fs = require("fs");

const LOGO_PATH = path.join(__dirname, "../../public/email/logo-stokify.png");

const ROLE_LABELS = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  RESPONSABLE: "Responsable",
  MAGASINIER: "Magasinier",
  COMPTABLE: "Comptable",
  CLIENT: "Client",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleLabel(role) {
  return ROLE_LABELS[String(role || "").toUpperCase()] || escapeHtml(role);
}

function getPublicLogoUrl() {
  const explicit = String(process.env.EMAIL_LOGO_URL || "").trim();
  if (explicit) return explicit;

  const apiBase = String(process.env.PUBLIC_API_URL || "").trim().replace(/\/$/, "");
  if (apiBase && !/localhost|127\.0\.0\.1/i.test(apiBase)) {
    return `${apiBase}/email/logo-stokify.png`;
  }

  const frontBase = String(process.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  if (frontBase && !/localhost|127\.0\.0\.1/i.test(frontBase)) {
    return `${frontBase}/logos/logo-stokify.png`;
  }

  return null;
}

/** Logo HTML — toujours visible (Gmail bloque souvent cid: et localhost). */
function renderHtmlBrandLogo() {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;border-collapse:collapse;">
  <tr>
    <td style="padding-right:14px;vertical-align:middle;">
      <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td style="width:56px;height:56px;border-radius:16px;background:#4f46e5;text-align:center;vertical-align:middle;">
            <table role="presentation" cellspacing="3" cellpadding="0" style="margin:0 auto;border-collapse:collapse;">
              <tr valign="bottom">
                <td style="width:8px;height:12px;background:rgba(255,255,255,0.75);border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="width:8px;height:18px;background:rgba(255,255,255,0.9);border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="width:8px;height:24px;background:#ffffff;border-radius:3px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
    <td style="vertical-align:middle;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:36px;font-weight:800;line-height:1;letter-spacing:-0.04em;white-space:nowrap;">
      <span style="color:#ffffff;">Stok</span><span style="color:#c4b5fd;">ify</span>
    </td>
  </tr>
</table>`;
}

function renderLogoBlock() {
  const publicLogoUrl = getPublicLogoUrl();
  if (publicLogoUrl) {
    return `<img src="${escapeHtml(publicLogoUrl)}" alt="Stokify" width="200" style="display:block;margin:0 auto;max-width:200px;width:200px;height:auto;border:0;outline:none;text-decoration:none;" />`;
  }
  return renderHtmlBrandLogo();
}

function buildUserInviteEmailHtml({
  prenom,
  nom,
  email,
  motDePasse,
  role,
  societeNom,
  loginUrl,
  forceChange,
}) {
  const fullName = escapeHtml([prenom, nom].filter(Boolean).join(" ") || email);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(motDePasse);
  const safeSociete = escapeHtml(societeNom || "votre organisation");
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeRole = roleLabel(role);
  const logoBlock = renderLogoBlock();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation Stokify</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 34px 26px 34px;background:linear-gradient(135deg,#0d1124 0%,#1e1b4b 52%,#312e81 100%);text-align:center;">
                    <div style="margin-bottom:18px;">${logoBlock}</div>
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.62);">Invitation officielle</p>
                    <h1 style="margin:0 0 10px;font-size:30px;line-height:1.15;font-weight:800;color:#ffffff;">Bienvenue, ${fullName}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                      Votre espace Stokify est prêt. Gérez le stock, les achats et les ventes en toute simplicité.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 34px 10px 34px;background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px;">
                      <tr>
                        <td style="padding:14px 16px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Organisation</p>
                          <p style="margin:0;font-size:16px;font-weight:700;color:#0f172a;">${safeSociete}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Vos identifiants</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;width:38%;font-size:13px;color:#64748b;">Adresse e-mail</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#0f172a;">${safeEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Mot de passe temporaire</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:16px;font-weight:700;letter-spacing:0.04em;color:#7c3aed;">${safePassword}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;font-size:13px;color:#64748b;">Rôle attribué</td>
                        <td style="padding:16px 18px;background:#ffffff;">
                          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:13px;font-weight:700;">${safeRole}</span>
                        </td>
                      </tr>
                    </table>
                    ${
                      forceChange
                        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                      <tr>
                        <td style="padding:14px 16px;border-radius:14px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;line-height:1.6;">
                          <strong>Sécurité :</strong> vous devrez définir un nouveau mot de passe lors de votre première connexion.
                        </td>
                      </tr>
                    </table>`
                        : ""
                    }
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
                      <tr>
                        <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 55%,#a855f7 100%);">
                          <a href="${safeLoginUrl}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Accéder à mon espace Stokify</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
                      <span style="word-break:break-all;color:#64748b;">${safeLoginUrl}</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 34px 28px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">
                      Cet e-mail a été envoyé par <strong style="color:#4338ca;">Stokify</strong>.
                      Ne communiquez jamais votre mot de passe à un tiers.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0 8px;text-align:center;font-size:11px;line-height:1.6;color:#94a3b8;">
              © ${new Date().getFullYear()} Stokify · Gestion de stock intelligente
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getUserInviteMailOptions({ user, motDePasse, societe, forceChangeOnFirstLogin, loginUrl, from }) {
  return {
    from,
    to: user.email,
    subject: `Stokify — Bienvenue ${[user.prenom, user.nom].filter(Boolean).join(" ") || user.email}`,
    html: buildUserInviteEmailHtml({
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      motDePasse,
      role: user.role,
      societeNom: societe?.nom,
      loginUrl,
      forceChange: forceChangeOnFirstLogin,
    }),
    attachments: [],
  };
}

function buildPasswordResetEmailHtml({ prenom, nom, email, resetUrl, societeNom }) {
  const fullName = escapeHtml([prenom, nom].filter(Boolean).join(" ") || email);
  const safeResetUrl = escapeHtml(resetUrl);
  const safeSociete = escapeHtml(societeNom || "votre organisation");
  const logoBlock = renderLogoBlock();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Réinitialisation Stokify</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 34px 26px 34px;background:linear-gradient(135deg,#0d1124 0%,#1e1b4b 52%,#312e81 100%);text-align:center;">
                    <div style="margin-bottom:18px;">${logoBlock}</div>
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.62);">Réinitialisation</p>
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;">Mot de passe oublié ?</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                      Bonjour ${fullName}, nous avons reçu une demande de réinitialisation pour votre compte Stokify.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 34px 10px 34px;background:#ffffff;">
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">
                      Organisation : <strong style="color:#0f172a;">${safeSociete}</strong>
                    </p>
                    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#475569;">
                      Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans <strong>1 heure</strong>.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 8px 0;">
                      <tr>
                        <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 55%,#a855f7 100%);">
                          <a href="${safeResetUrl}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Réinitialiser mon mot de passe</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
                      <span style="word-break:break-all;color:#64748b;">${safeResetUrl}</span>
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;">
                      <tr>
                        <td style="padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
                          Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez cet e-mail. Votre mot de passe actuel restera inchangé.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 34px 28px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">
                      Cet e-mail a été envoyé par <strong style="color:#4338ca;">Stokify</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getPasswordResetMailOptions({ user, resetUrl, from, societe }) {
  return {
    from,
    to: user.email,
    subject: "Stokify — Réinitialisation de votre mot de passe",
    html: buildPasswordResetEmailHtml({
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      resetUrl,
      societeNom: societe?.nom,
    }),
    attachments: [],
  };
}

function buildNouvelleInscriptionEmailHtml({
  prenom,
  nom,
  email,
  role,
  societeNom,
  adminUrl,
  isClient,
}) {
  const fullName = escapeHtml([prenom, nom].filter(Boolean).join(" ") || email);
  const safeEmail = escapeHtml(email);
  const safeSociete = escapeHtml(societeNom || "votre organisation");
  const safeRole = roleLabel(role);
  const safeAdminUrl = escapeHtml(adminUrl || "#");
  const logoBlock = renderLogoBlock();
  const actionHint = isClient
    ? "Rattachez ce compte à une fiche client pour l&apos;activer."
    : "Approuvez ou rejetez cette demande depuis la gestion des utilisateurs.";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouvelle inscription Stokify</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 34px 26px 34px;background:linear-gradient(135deg,#0d1124 0%,#1e1b4b 52%,#312e81 100%);text-align:center;">
                    <div style="margin-bottom:18px;">${logoBlock}</div>
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.62);">Validation requise</p>
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;">Nouvelle inscription</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                      Un compte attend votre validation pour <strong style="color:#fff;">${safeSociete}</strong>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 34px 10px 34px;background:#ffffff;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;width:38%;font-size:13px;color:#64748b;">Nom</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#0f172a;">${fullName}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">E-mail</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#0f172a;">${safeEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;font-size:13px;color:#64748b;">Rôle demandé</td>
                        <td style="padding:16px 18px;background:#ffffff;">
                          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:13px;font-weight:700;">${safeRole}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#475569;">${actionHint}</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
                      <tr>
                        <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 55%,#a855f7 100%);">
                          <a href="${safeAdminUrl}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Ouvrir la gestion des utilisateurs</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 34px 28px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">
                      Cet e-mail a été envoyé par <strong style="color:#4338ca;">Stokify</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getNouvelleInscriptionMailOptions({ user, societe, admin, adminUrl, from }) {
  const isClient = String(user.role || "").toUpperCase() === "CLIENT";
  return {
    from,
    to: admin.email,
    subject: `Stokify — Nouvelle inscription à valider (${roleLabel(user.role)})`,
    html: buildNouvelleInscriptionEmailHtml({
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      role: user.role,
      societeNom: societe?.nom,
      adminUrl,
      isClient,
    }),
    attachments: [],
  };
}

function buildCompteActiveEmailHtml({ prenom, nom, email, role, societeNom, loginUrl }) {
  const fullName = escapeHtml([prenom, nom].filter(Boolean).join(" ") || email);
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeSociete = escapeHtml(societeNom || "votre organisation");
  const safeRole = roleLabel(role);
  const logoBlock = renderLogoBlock();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Compte activé Stokify</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 34px 26px 34px;background:linear-gradient(135deg,#0d1124 0%,#064e3b 52%,#059669 100%);text-align:center;">
                    <div style="margin-bottom:18px;">${logoBlock}</div>
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.62);">Compte activé</p>
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;">Bienvenue, ${fullName}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                      Votre compte Stokify pour <strong style="color:#fff;">${safeSociete}</strong> est maintenant actif.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 34px 10px 34px;background:#ffffff;">
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">
                      Rôle : <strong style="color:#0f172a;">${safeRole}</strong>. Vous pouvez vous connecter avec l&apos;adresse <strong>${escapeHtml(email)}</strong> et le mot de passe choisi à l&apos;inscription.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px 0;">
                      <tr>
                        <td align="center" style="border-radius:14px;background:linear-gradient(135deg,#059669 0%,#10b981 55%,#34d399 100%);">
                          <a href="${safeLoginUrl}" style="display:inline-block;padding:15px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Se connecter</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center;">
                      Si le bouton ne fonctionne pas, copiez ce lien :<br />
                      <span style="word-break:break-all;color:#64748b;">${safeLoginUrl}</span>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 34px 28px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">
                      Cet e-mail a été envoyé par <strong style="color:#059669;">Stokify</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getCompteActiveMailOptions({ user, societe, loginUrl, from }) {
  return {
    from,
    to: user.email,
    subject: "Stokify — Votre compte a été activé",
    html: buildCompteActiveEmailHtml({
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      role: user.role,
      societeNom: societe?.nom,
      loginUrl,
    }),
    attachments: [],
  };
}

function buildCompteRejeteEmailHtml({ prenom, nom, societeNom }) {
  const fullName = escapeHtml([prenom, nom].filter(Boolean).join(" ") || "utilisateur");
  const safeSociete = escapeHtml(societeNom || "l'organisation");
  const logoBlock = renderLogoBlock();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inscription refusée Stokify</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 34px 26px 34px;background:linear-gradient(135deg,#0d1124 0%,#7f1d1d 52%,#dc2626 100%);text-align:center;">
                    <div style="margin-bottom:18px;">${logoBlock}</div>
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;">Inscription non validée</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                      Bonjour ${fullName}, votre demande pour ${safeSociete} n&apos;a pas été acceptée.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 34px;background:#ffffff;">
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">
                      Pour plus d&apos;informations, contactez l&apos;administrateur de la société.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getCompteRejeteMailOptions({ user, societe, from }) {
  return {
    from,
    to: user.email,
    subject: "Stokify — Votre inscription n'a pas été validée",
    html: buildCompteRejeteEmailHtml({
      prenom: user.prenom,
      nom: user.nom,
      societeNom: societe?.nom,
    }),
    attachments: [],
  };
}

function buildTentativeSuspecteEmailHtml({
  prenom,
  nom,
  email,
  role,
  societeNom,
  ip,
  userAgent,
  dateHeure,
  hasPhoto,
}) {
  const fullName = escapeHtml([prenom, nom].filter(Boolean).join(" ") || email);
  const safeEmail = escapeHtml(email);
  const safeSociete = escapeHtml(societeNom || "votre organisation");
  const safeRole = roleLabel(role);
  const safeIp = escapeHtml(ip || "Inconnue");
  const safeUa = escapeHtml(userAgent || "Inconnu");
  const safeDate = escapeHtml(dateHeure || new Date().toLocaleString("fr-FR"));
  const logoBlock = renderLogoBlock();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tentative suspecte Stokify</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ff;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="border-radius:24px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.12);background:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:28px 34px 26px 34px;background:linear-gradient(135deg,#0d1124 0%,#7f1d1d 52%,#dc2626 100%);text-align:center;">
                    <div style="margin-bottom:18px;">${logoBlock}</div>
                    <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.62);">Alerte sécurité</p>
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.15;font-weight:800;color:#ffffff;">3 tentatives échouées</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.82);">
                      Le compte <strong style="color:#fff;">${fullName}</strong> a été temporairement verrouillé (15 minutes).
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 34px 10px 34px;background:#ffffff;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Compte ciblé</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;margin-bottom:18px;">
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;width:38%;font-size:13px;color:#64748b;">Nom</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#0f172a;">${fullName}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">E-mail</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:700;color:#0f172a;">${safeEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Rôle</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;">
                          <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:13px;font-weight:700;">${safeRole}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;font-size:13px;color:#64748b;">Société</td>
                        <td style="padding:16px 18px;background:#ffffff;font-size:15px;font-weight:700;color:#0f172a;">${safeSociete}</td>
                      </tr>
                    </table>
                    <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Métadonnées de la tentative</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;width:38%;font-size:13px;color:#64748b;">Adresse IP</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-family:Consolas,Monaco,monospace;font-size:14px;font-weight:700;color:#0f172a;">${safeIp}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">Navigateur</td>
                        <td style="padding:16px 18px;background:#ffffff;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:1.5;color:#0f172a;word-break:break-word;">${safeUa}</td>
                      </tr>
                      <tr>
                        <td style="padding:16px 18px;background:#fafafa;font-size:13px;color:#64748b;">Date / heure</td>
                        <td style="padding:16px 18px;background:#ffffff;font-size:15px;font-weight:700;color:#0f172a;">${safeDate}</td>
                      </tr>
                    </table>
                    ${
                      hasPhoto
                        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                      <tr>
                        <td style="padding:14px 16px;border-radius:14px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412;font-size:13px;line-height:1.6;">
                          <strong>Photo jointe :</strong> une capture caméra optionnelle est attachée à cet e-mail (fichier <em>tentative-connexion.jpg</em>).
                        </td>
                      </tr>
                    </table>`
                        : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
                      <tr>
                        <td style="padding:14px 16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6;">
                          Aucune photo n&apos;a été fournie pour cette tentative (accès caméra refusé ou indisponible).
                        </td>
                      </tr>
                    </table>`
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 34px 28px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;text-align:center;">
                      Cet e-mail a été envoyé automatiquement par <strong style="color:#dc2626;">Stokify</strong> suite à un verrouillage de sécurité.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 8px 0 8px;text-align:center;font-size:11px;line-height:1.6;color:#94a3b8;">
              © ${new Date().getFullYear()} Stokify · Alerte sécurité
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getTentativeSuspecteMailOptions({
  user,
  ip,
  userAgent,
  dateHeure,
  photoBase64,
  from,
  societe,
}) {
  const displayName = [user?.prenom, user?.nom].filter(Boolean).join(" ") || user?.email || "utilisateur";
  const attachments = [];
  let hasPhoto = false;

  if (photoBase64 && typeof photoBase64 === "string") {
    try {
      const content = photoBase64.includes(",")
        ? photoBase64.split(",").pop()
        : photoBase64;
      if (content) {
        attachments.push({
          filename: "tentative-connexion.jpg",
          content,
          encoding: "base64",
          contentType: "image/jpeg",
        });
        hasPhoto = true;
      }
    } catch {
      // Photo optionnelle — ignorer silencieusement
    }
  }

  return {
    from,
    subject: `⚠ 3 tentatives de connexion échouées — ${displayName}`,
    html: buildTentativeSuspecteEmailHtml({
      prenom: user?.prenom,
      nom: user?.nom,
      email: user?.email,
      role: user?.role,
      societeNom: societe?.nom || user?.societe?.nom,
      ip,
      userAgent,
      dateHeure,
      hasPhoto,
    }),
    attachments,
  };
}

module.exports = {
  buildUserInviteEmailHtml,
  getUserInviteMailOptions,
  buildPasswordResetEmailHtml,
  getPasswordResetMailOptions,
  getNouvelleInscriptionMailOptions,
  getCompteActiveMailOptions,
  getCompteRejeteMailOptions,
  getTentativeSuspecteMailOptions,
  getPublicLogoUrl,
  renderHtmlBrandLogo,
};
