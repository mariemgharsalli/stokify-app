/**
 * Migration one-off : rattache les Utilisateur aux fiches Client créées
 * par l'ancien auto-match (code CLI-U…).
 *
 * Depuis le dossier back/ :
 *   node src/scripts/migrateLegacyClientAccounts.js
 *
 * Ne supprime ni ne fusionne aucune fiche — écrit un rapport JSON des
 * doublons potentiels dans back/tmp-migration-report.json.
 */
const fs = require("fs");
const path = require("path");
const prisma = require("../config/database");

function emailDomain(email) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  const at = e.lastIndexOf("@");
  return at >= 0 ? e.slice(at + 1) : "";
}

function normalizeNom(nom) {
  return String(nom || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

async function main() {
  const legacyClients = await prisma.client.findMany({
    where: { code: { startsWith: "CLI-U" } },
    orderBy: { id: "asc" },
  });

  const linked = [];
  const unmatched = [];

  for (const client of legacyClients) {
    const email = String(client.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      unmatched.push({
        clientId: client.id,
        code: client.code,
        reason: "EMAIL_MANQUANT",
      });
      continue;
    }

    const utilisateur = await prisma.utilisateur.findFirst({
      where: {
        email,
        societeId: client.societeId,
        role: "CLIENT",
      },
    });

    if (!utilisateur) {
      unmatched.push({
        clientId: client.id,
        code: client.code,
        email,
        reason: "UTILISATEUR_INTROUVABLE",
      });
      continue;
    }

    if (utilisateur.clientId != null && utilisateur.clientId !== client.id) {
      unmatched.push({
        clientId: client.id,
        code: client.code,
        email,
        utilisateurId: utilisateur.id,
        reason: "DEJA_RATTACHE_A_AUTRE_CLIENT",
        existingClientId: utilisateur.clientId,
      });
      continue;
    }

    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        clientId: client.id,
        statutCompte: "ACTIF",
      },
    });

    linked.push({
      clientId: client.id,
      code: client.code,
      utilisateurId: utilisateur.id,
      email,
    });
  }

  const allClients = await prisma.client.findMany({
    select: { id: true, code: true, nom: true, email: true, societeId: true },
    orderBy: { id: "asc" },
  });

  const byNom = new Map();
  const byDomain = new Map();

  for (const c of allClients) {
    const nomKey = `${c.societeId}|${normalizeNom(c.nom)}`;
    if (normalizeNom(c.nom)) {
      if (!byNom.has(nomKey)) byNom.set(nomKey, []);
      byNom.get(nomKey).push(c);
    }
    const domain = emailDomain(c.email);
    if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com"].includes(domain)) {
      const domKey = `${c.societeId}|${domain}`;
      if (!byDomain.has(domKey)) byDomain.set(domKey, []);
      byDomain.get(domKey).push(c);
    }
  }

  const doublonsNom = [...byNom.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({
      type: "NOM_ENTREPRISE",
      societeId: group[0].societeId,
      nom: group[0].nom,
      clients: group.map((c) => ({ id: c.id, code: c.code, email: c.email })),
    }));

  const doublonsDomaine = [...byDomain.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({
      type: "DOMAINE_EMAIL",
      societeId: group[0].societeId,
      domaine: emailDomain(group[0].email),
      clients: group.map((c) => ({ id: c.id, code: c.code, nom: c.nom, email: c.email })),
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      legacyClientsFound: legacyClients.length,
      linked: linked.length,
      unmatched: unmatched.length,
      potentialDuplicatesByName: doublonsNom.length,
      potentialDuplicatesByDomain: doublonsDomaine.length,
    },
    linked,
    unmatched,
    potentialDuplicates: [...doublonsNom, ...doublonsDomaine],
    note: "Aucune fusion automatique. Relisez potentialDuplicates et fusionnez manuellement si besoin.",
  };

  const reportPath = path.join(__dirname, "../../tmp-migration-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Rapport écrit : ${reportPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
