function isDbUnreachable(err) {
  const code = err?.code || err?.meta?.code;
  if (
    code === "P1001" ||
    code === "P1000" ||
    code === "P1002" ||
    code === "P1008" ||
    code === "P1017" ||
    code === "P2024"
  ) {
    return true;
  }
  const msg = String(err?.message || "");
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("connect ETIMEDOUT") ||
    msg.includes("Timed out fetching a new connection") ||
    msg.includes("Server has closed the connection")
  );
}

function errorHandler(err, req, res, next) {
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "code";
    return res.status(409).json({
      error: "DUPLICATE_CODE",
      message: `Ce ${field} existe déjà. Merci d'en choisir un autre.`,
      field,
    });
  }

  const status = err.status || 500;
  const isDevelopment = process.env.NODE_ENV === "development";

  if (status >= 500) {
    console.error("[errorHandler]", err);
  }

  if (isDbUnreachable(err)) {
    return res.status(503).json({
      message:
        "MySQL n'est pas démarré ou n'écoute pas sur 127.0.0.1:3306. Démarrez MySQL (XAMPP, Laragon, ou service MySQL80), créez la base « stokify » si besoin, puis exécutez dans le dossier back : npx prisma migrate deploy && npx prisma db seed",
      code: "DB_UNAVAILABLE",
    });
  }

  const safeMessage =
    status >= 500 && !isDevelopment ? "Erreur interne du serveur" : err.message || "Erreur interne";

  if (err.code === "P1000") {
    return res.status(500).json({ message: "Configuration MySQL invalide. Vérifiez DATABASE_URL dans .env." });
  }
  if (err.code === "P1001") {
    return res.status(503).json({
      message:
        "Base de données indisponible. Démarrez MySQL sur le port 3306, puis relancez le backend.",
      code: "DB_UNAVAILABLE",
    });
  }
  if (err.code === "P2021") {
    return res.status(500).json({
      message:
        "Tables absentes ou schema desynchronise. Dans le dossier back, executez : npx prisma migrate deploy",
    });
  }
  /** Colonne manquante (ex. migration non appliquée). */
  if (err.code === "P2022") {
    if (!isDevelopment) {
      return res.status(500).json({ message: "Erreur interne du serveur" });
    }
    return res.status(500).json({
      message:
        "Schema Prisma plus recent que la base MySQL (colonne absente). Dans le dossier back: npx prisma migrate deploy — ou verifier les migrations societe_coords, fournisseur_location, utilisateur_note_desactivation, deadStockSeuil, etc.",
      code: err.code,
      ...(err.meta ? { prismaMeta: err.meta } : {}),
    });
  }

  return res.status(status).json({
    message: safeMessage,
    ...(err.code ? { code: err.code } : {}),
    ...(err.details ? { details: err.details } : {}),
    ...(err.minutesRestantes != null ? { minutesRestantes: err.minutesRestantes } : {}),
    ...(isDevelopment ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
