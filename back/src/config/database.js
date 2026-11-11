const { PrismaClient } = require("@prisma/client");

/**
 * Évite le hang Prisma par défaut (~10s) et le pool saturé quand
 * le dashboard IA lance beaucoup de requêtes en parallèle.
 */
function withPoolParams(url) {
  if (!url) return url;
  const extras = [];
  if (!/[?&]connection_limit=/.test(url)) extras.push("connection_limit=12");
  if (!/[?&]pool_timeout=/.test(url)) extras.push("pool_timeout=8");
  if (!/[?&]connect_timeout=/.test(url)) extras.push("connect_timeout=5");
  if (!extras.length) return url;
  return url + (url.includes("?") ? "&" : "?") + extras.join("&");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: withPoolParams(process.env.DATABASE_URL) },
  },
});

module.exports = prisma;
