"use strict";

/**
 * Isolation de la suite Jest.
 * Aucun secret, SMTP, Groq ni base MySQL du projet n'est lu ici.
 * DATABASE_URL pointe vers un port fermé : Prisma ne s'y connecte que si un
 * test oublie de mocker le client, et l'échec est immédiat.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "cle-de-test-jwt-stokify-32chars";
process.env.JWT_EXPIRES_IN = "1h";
process.env.DATABASE_URL =
  "mysql://stokify_test:stokify_test@127.0.0.1:9/stokify_tests_isoles";
process.env.DISABLE_RELANCES = "1";
process.env.DISABLE_DLC_ALERT = "1";
process.env.DISABLE_EXPIRY_CRON = "1";
process.env.DISABLE_STOCK_ALERTS = "1";
process.env.DISABLE_ANOMALIES_CRON = "1";

delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.GROQ_API_KEY;
delete process.env.AI_SERVICE_URL;
