const prisma = require("../../config/database");
const { requireActiveSocieteId } = require("../../utils/societeScope");

function compteNonRattache() {
  const err = new Error(
    "Votre compte n'est pas encore rattaché à une fiche client. Contactez l'administrateur."
  );
  err.status = 409;
  err.code = "COMPTE_NON_RATTACHE";
  return err;
}

function displayNom(user) {
  return [user?.prenom, user?.nom].filter(Boolean).join(" ").trim();
}

/**
 * Trouve une fiche Client existante (email, puis code legacy CLI-U{id})
 * ou en crée une. Relie Utilisateur.clientId.
 *
 * Ne pas appeler pour un compte EN_ATTENTE_RATTACHEMENT : le rattachement
 * reste une action admin (fiche métier existante).
 */
async function ensureClientLinked(user) {
  const societeId = requireActiveSocieteId(user.societeId);
  const userId = Number(user.id);
  const email = String(user.email || "")
    .trim()
    .toLowerCase() || null;
  const nom = displayNom(user) || email || `Client ${userId}`;
  const legacyCode = `CLI-U${userId}`;

  return prisma.$transaction(async (tx) => {
    const fresh = await tx.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clientId: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        societeId: true,
      },
    });
    if (!fresh) throw compteNonRattache();

    if (fresh.clientId != null) {
      const linked = await tx.client.findFirst({
        where: { id: Number(fresh.clientId), societeId },
      });
      if (linked) return linked;
    }

    const emailKey = String(fresh.email || email || "")
      .trim()
      .toLowerCase() || null;

    let client = null;
    if (emailKey) {
      client = await tx.client.findFirst({
        where: { societeId, email: emailKey },
        orderBy: { id: "asc" },
      });
    }
    if (!client) {
      client = await tx.client.findFirst({
        where: { societeId, code: legacyCode },
      });
    }
    if (!client) {
      try {
        client = await tx.client.create({
          data: {
            code: legacyCode,
            nom: displayNom(fresh) || nom,
            email: emailKey,
            telephone: fresh.telephone || user.telephone || null,
            contact: displayNom(fresh) || nom,
            societeId,
            actif: true,
          },
        });
      } catch (e) {
        if (e.code === "P2002") {
          client =
            (emailKey
              ? await tx.client.findFirst({
                  where: { societeId, email: emailKey },
                  orderBy: { id: "asc" },
                })
              : null) ||
            (await tx.client.findFirst({
              where: { societeId, code: legacyCode },
            }));
        }
        if (!client) throw e;
      }
    }

    if (fresh.clientId !== client.id) {
      await tx.utilisateur.update({
        where: { id: userId },
        data: { clientId: client.id },
      });
    }
    return client;
  });
}

/**
 * Relie un Utilisateur (role CLIENT) à sa fiche Client métier via clientId.
 * Répare les comptes ACTIF orphelins (fiche CLI-U… déjà créée, ou même email).
 */
async function resolveClientForUser(user) {
  if (!user || user.role !== "CLIENT") {
    const err = new Error("Accès réservé aux clients");
    err.status = 403;
    throw err;
  }

  if (user.statutCompte === "EN_ATTENTE_RATTACHEMENT") {
    throw compteNonRattache();
  }

  const societeId = requireActiveSocieteId(user.societeId);
  const client = await ensureClientLinked(user);
  return { client, societeId };
}

function requireClientRole(user) {
  if (!user || user.role !== "CLIENT") {
    const err = new Error("Accès réservé aux clients");
    err.status = 403;
    throw err;
  }
}

module.exports = { resolveClientForUser, requireClientRole, ensureClientLinked };
