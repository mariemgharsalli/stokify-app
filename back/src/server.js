require("dotenv").config();

const jwtSecret = process.env.JWT_SECRET || "";
if (process.env.NODE_ENV === "production" && (jwtSecret.length < 32 || /^your|change|secret/i.test(jwtSecret))) {
  // eslint-disable-next-line no-console
  console.error("JWT_SECRET faible ou placeholder : démarrage refusé en production.");
  process.exit(1);
}

const app = require("./app");
const prisma = require("./config/database");

const START_PORT = Number(process.env.PORT || 5000);

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // eslint-disable-next-line no-console
    console.log("[Stokify] Connexion MySQL OK");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      "\n[Stokify] ERREUR — MySQL inaccessible (login et API renverront 503).\n" +
        "  1. Démarrez MySQL (XAMPP « Start MySQL », Laragon, ou services Windows « MySQL80 »).\n" +
        "  2. phpMyAdmin : créez la base « stokify » si elle n'existe pas.\n" +
        "  3. Dans back/ : npx prisma migrate deploy\n" +
        "  4. Dans back/ : npx prisma db seed\n" +
        "  5. Vérifiez DATABASE_URL dans back/.env (ex. mysql://root@127.0.0.1:3306/stokify)\n" +
        `  Détail : ${e?.message?.split("\n")[0] || e}\n`
    );
  }
}

/** Aide diagnostic : un 404 sur une route /api/* récemment ajoutée = process Node démarré avant le déploiement du code (redémarrer le backend). */
function logDevRouteHints() {
  const stack = app?._router?.stack || [];
  const hasGroupes = stack.some((layer) => layer.regexp && String(layer.regexp).includes("groupes"));
  const hasArticles = stack.some((layer) => layer.regexp && String(layer.regexp).includes("articles"));
  if (!hasGroupes) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Stokify] ATTENTION: la route /api/groupes ne semble pas enregistrée. Vérifiez que vous lancez bien ce projet (dossier back/) et que app.js est à jour."
    );
  }
  if (!hasArticles) {
    // eslint-disable-next-line no-console
    console.warn(
      "[Stokify] ATTENTION: la route /api/articles ne semble pas enregistrée (import CSV, CRUD produits). Redémarrez le backend."
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    "[Stokify] Développement : npm run dev (nodemon, rechargement auto). " +
      "Production / manuel : npm start (= node src/server.js) — redémarrage obligatoire après toute modification de routes ou controllers."
  );
}
logDevRouteHints();

if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 16) {
  // eslint-disable-next-line no-console
  console.error(
    "[Stokify] ERREUR: JWT_SECRET absent ou trop court dans .env. Les connexions echoueront apres la verification du mot de passe. Copiez .env.example vers .env et definissez JWT_SECRET (32 caracteres ou plus)."
  );
}
if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error("[Stokify] ERREUR: DATABASE_URL manquant dans .env.");
}

const HOST = process.env.HOST || "0.0.0.0";

function startServer(port) {
  const server = app.listen(port, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Stokify backend listening on ${HOST}:${port}`);
    // eslint-disable-next-line no-console
    console.log(`API: http://127.0.0.1:${port}/api  (GET /api pour verifier les modules)`);
    try {
      const { frontendLanOrigin, listLanIpv4 } = require("./utils/lanOrigin");
      const lan = frontendLanOrigin();
      const ips = listLanIpv4();
      if (ips.length) {
        // eslint-disable-next-line no-console
        console.log(`QR téléphone (même Wi-Fi) : ${lan}/stock  · IP PC : ${ips.join(", ")}`);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line no-console
    console.log(`Swagger UI: http://127.0.0.1:${port}/api-docs`);
    if (port !== START_PORT) {
      // eslint-disable-next-line no-console
      console.warn(
        `=> Le front Vite pointe par defaut vers le port ${START_PORT}. Si les requetes /api echouent, dans front/.env ajoutez:\n   VITE_API_BASE_URL=http://localhost:${port}/api\n   ou VITE_PROXY_TARGET=http://127.0.0.1:${port}`
      );
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      if (process.env.NODE_ENV === "production") {
        // eslint-disable-next-line no-console
        console.error(`Port ${port} déjà utilisé. Arrêt du processus.`);
        process.exit(1);
      }
      // eslint-disable-next-line no-console
      console.warn(`Port ${port} already in use, trying ${port + 1}...`);
      startServer(port + 1);
      return;
    }
    throw error;
  });
}

try {
  require("./config/seedUploads").seedUploadsOnce();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error("[Stokify] Copie initiale des uploads non effectuée :", error?.message || error);
}

checkDatabase().finally(() => startServer(START_PORT));
