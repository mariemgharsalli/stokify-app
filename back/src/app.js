const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { UPLOAD_ROOT } = require("./config/paths");
const prisma = require("./config/database");
const { auth } = require("./middleware/auth");
const { requireSociete } = require("./middleware/rbac");
const errorHandler = require("./middleware/errorHandler");
const { setupSwagger } = require("./config/swagger");

const CORS_ALLOWED_HEADERS = ["Content-Type", "Authorization", "x-societe-id"];

const app = express();

app.use(
  helmet({
    /** Permet aux images `/uploads/...` d’être affichées depuis le front (autre port / domaine). */
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
const defaultFrontendOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const extraOrigins = String(process.env.FRONTEND_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultFrontendOrigins, ...extraOrigins])];

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) app.set("trust proxy", 1); // requis par express-rate-limit derrière le proxy Railway

/** En dev, tout origine (autre port Vite, LAN) pour éviter les blocages CORS silencieux côté navigateur. */
app.use(
  cors(
    isProduction
      ? {
          origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            return callback(null, false);
          },
          allowedHeaders: CORS_ALLOWED_HEADERS,
        }
      : { origin: true, allowedHeaders: CORS_ALLOWED_HEADERS }
  )
);
app.use(express.json({ limit: "2mb" }));

/** Réponses JSON en UTF-8 (libellés français : é, è, à, …). */
app.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return origJson(body);
  };
  next();
});
app.use(morgan(isProduction ? "combined" : "dev"));
app.use("/email", express.static(path.join(__dirname, "../public/email")));
app.use("/uploads", express.static(UPLOAD_ROOT, { maxAge: isProduction ? "7d" : 0 }));
/** Articles uploadés avant l’alignement sur `public/uploads` (Multer utilisait `back/uploads/articles`). */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

setupSwagger(app);

const { frontendLanOrigin, listLanIpv4 } = require("./utils/lanOrigin");

app.get("/api/runtime/qr-origin", (req, res) => {
  const origin = frontendLanOrigin();
  return res.json({
    origin,
    ips: listLanIpv4(),
    hint: "Ouvrez Stokify depuis un téléphone sur le même Wi-Fi, pas via localhost.",
  });
});

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", service: "stokify-backend", database: "connected" });
  } catch (err) {
    const hint =
      err.code === "P1001"
        ? "MySQL injoignable : demarrez le service MySQL et verifiez DATABASE_URL dans .env."
        : "Verifiez DATABASE_URL et les migrations (npx prisma migrate deploy).";
    return res.status(503).json({
      status: "error",
      service: "stokify-backend",
      database: "disconnected",
      message: hint,
      ...(process.env.NODE_ENV !== "production" && err.code ? { code: err.code } : {}),
    });
  }
});

app.get("/api", (req, res) =>
  res.json({
    service: "stokify-backend",
    modules: [
      "auth",
      "companies",
      "articles",
      "depots",
      "emplacements",
      "stock",
      "alertes",
      "mouvements",
      "ventes",
      "achats",
      "accounting",
      "users",
      "familles",
      "clients",
      "fournisseurs",
      "lots",
      "reglements",
      "marques",
      "groupes",
      "familles/groupes",
      "numeros-serie",
      "cout-stockage",
      "inventaires",
      "valuation",
    ],
    hint: "Routes sous /api/* — JWT requis sauf auth et companies/public.",
  })
);

app.use("/api/auth", require("./modules/auth/auth.routes"));
app.use("/api/companies", require("./modules/companies/companies.routes"));
app.use("/api/articles", auth, requireSociete, require("./modules/articles/articles.routes"));
app.use("/api/depots", auth, requireSociete, require("./modules/depots/depots.routes"));
app.use("/api/emplacements", auth, requireSociete, require("./modules/emplacements/emplacements.routes"));
app.use("/api/stock", auth, requireSociete, require("./modules/stock/stock.routes"));
app.use("/api/alertes", auth, requireSociete, require("./modules/alertes/alertes.routes"));
app.use("/api/mouvements", auth, requireSociete, require("./modules/mouvements/mouvements.routes"));
app.use("/api/ventes", auth, requireSociete, require("./modules/ventes/ventes.routes"));
app.use("/api/factures", auth, requireSociete, require("./modules/factures/facture.routes"));
app.use("/api/achats", auth, requireSociete, require("./modules/achats/achats.routes"));
app.use("/api/accounting", auth, requireSociete, require("./modules/accounting/accounting.routes"));
app.use("/api/users", auth, require("./modules/users/users.routes"));
app.use("/api/familles", auth, requireSociete, require("./modules/familles/familles.routes"));
app.use("/api/clients", auth, requireSociete, require("./modules/clients/clients.routes"));
app.use("/api/fournisseurs", auth, requireSociete, require("./modules/fournisseurs/fournisseurs.routes"));
app.use("/api/lots", auth, requireSociete, require("./modules/lots/lots.routes"));
app.use("/api/reglements", auth, requireSociete, require("./modules/reglements/reglements.routes"));
app.use("/api/marques", auth, requireSociete, require("./modules/marques/marques.routes"));
const groupesRoutes = require("./modules/groupes/groupes.routes");
app.use("/api/groupes", auth, requireSociete, groupesRoutes);
app.use("/api/numeros-serie", auth, requireSociete, require("./modules/numeroserie/numeroserie.routes"));
app.use("/api/cout-stockage", auth, requireSociete, require("./modules/coutStockage/coutStockage.routes"));
app.use("/api/inventaires", auth, requireSociete, require("./modules/inventaires/inventaires.routes"));
app.use("/api/rapports", auth, requireSociete, require("./modules/rapports/rapports.routes"));
app.use("/api/valuation", auth, requireSociete, require("./modules/valuation/valuation.routes"));
app.use("/api/vehicules", auth, requireSociete, require("./modules/vehicules/vehicules.routes"));
app.use("/api/ai", auth, requireSociete, require("./modules/ai/chat.routes"));
app.use("/api/ia", auth, requireSociete, require("./modules/ia/ia.routes"));
app.use("/api/panier", auth, requireSociete, require("./modules/panier/panier.routes"));
app.use("/api/commandes-client", auth, requireSociete, require("./modules/commandesClient/commandesClient.routes"));
app.use("/api/demandes-client", auth, requireSociete, require("./modules/demandesClient/demandesClient.routes"));
app.use("/api/wishlist", auth, requireSociete, require("./modules/wishlist/wishlist.routes"));

if (process.env.DISABLE_RELANCES !== "1") {
  try {
    require("./jobs/dlcAlertJob")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[dlcAlertJob]", e?.message || e);
  }
  try {
    require("./jobs/relanceFournisseurJob")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[relanceFournisseurJob]", e?.message || e);
  }
  try {
    require("./jobs/relanceClientJob")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[relanceClientJob]", e?.message || e);
  }
  try {
    require("./cron/relances.cron")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[relances.cron]", e?.message || e);
  }
  try {
    require("./cron/stockAlerts.cron")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[stockAlerts.cron]", e?.message || e);
  }
  try {
    require("./cron/anomalies.cron")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[anomalies.cron]", e?.message || e);
  }
  try {
    require("./cron/expiry.cron")();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[expiry.cron]", e?.message || e);
  }
}

app.use(errorHandler);

module.exports = app;
