const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

/**
 * Guide d'utilisation Swagger UI (PFE / soutenance) :
 *
 * 1. Ouvrir http://localhost:5000/api-docs
 * 2. POST /auth/login — saisir email + motDePasse, exécuter → copier le token JWT de la réponse.
 * 3. Cliquer sur « Authorize » (cadenas en haut à droite), coller : Bearer {token}, confirmer.
 * 4. Les routes protégées envoient automatiquement le JWT.
 * 5. Super Admin : ajouter l'en-tête x-societe-id (ID société) sur les routes métier multi-sociétés.
 *
 * Export spec brute : GET http://localhost:5000/api-docs.json
 */

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Stokify API",
    version: "1.0.0",
    description:
      "Système Intelligent de Gestion de Stock Multi-Dépôts et Multi-Sociétés — Documentation API complète",
  },
  servers: [{ url: "http://localhost:5000/api", description: "Serveur de développement" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Token JWT obtenu via POST /auth/login — coller dans le champ 'Value' sous la forme: Bearer {token}",
      },
    },
    parameters: {
      SocieteHeader: {
        in: "header",
        name: "x-societe-id",
        schema: { type: "integer" },
        description: "ID société (requis pour Super Admin sur les routes métier)",
      },
    },
    responses: {
      Unauthorized: {
        description: "Token JWT manquant ou invalide",
        content: { "application/json": { example: { message: "Non autorisé" } } },
      },
      Forbidden: {
        description: "Permissions insuffisantes",
        content: { "application/json": { example: { message: "Accès refusé" } } },
      },
      NotFound: {
        description: "Ressource introuvable",
        content: { "application/json": { example: { message: "Ressource introuvable" } } },
      },
      ValidationError: {
        description: "Erreur de validation (HTTP 422)",
        content: {
          "application/json": {
            example: {
              success: false,
              message: "Données invalides",
              errors: [{ field: "code", message: "Code requis" }],
            },
          },
        },
      },
      ServerError: {
        description: "Erreur serveur",
        content: { "application/json": { example: { message: "Erreur interne du serveur" } } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  swaggerDefinition,
  apis: [path.join(__dirname, "../modules/**/*.routes.js").replace(/\\/g, "/")],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: "Stokify API Docs",
      customCss: ".swagger-ui .topbar { background: linear-gradient(135deg, #1a1d27, #2d3561); }",
    })
  );
  app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));
}

module.exports = { setupSwagger, swaggerSpec };
