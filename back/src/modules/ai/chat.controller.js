const { chatWithStockAssistant, chatWithClientAssistant, getStockBriefing, getClientBriefing } = require("./chat.service");

function extractGroqError(err) {
  const apiMsg =
    err?.error?.message ||
    err?.error?.error?.message ||
    (typeof err?.message === "string" ? err.message : "");

  if (/invalid.*api.?key|authentication|unauthorized/i.test(apiMsg)) {
    return "Clé API Groq invalide ou manquante.";
  }
  if (/rate.?limit|too many requests/i.test(apiMsg)) {
    return "Limite de requêtes Groq atteinte. Réessayez dans quelques instants.";
  }
  if (/model.*not found|invalid model|decommissioned/i.test(apiMsg)) {
    return "Modèle Groq indisponible. Contactez l'administrateur.";
  }
  return apiMsg || "Erreur du service IA";
}

async function postChat(req, res) {
  try {
    const { message, history = [], lang } = req.body;

    // eslint-disable-next-line no-console
    console.log(
      "[Chat] User:",
      req.user?.id,
      "Société:",
      req.user?.societeId,
      "Message:",
      message.slice(0, 50)
    );

    const { reply, articlesSuggeres, suggestions, trace, mode } = await chatWithStockAssistant(
      message.trim(),
      history,
      req.user?.id,
      req.user?.societeId,
      lang
    );

    return res.json({
      reply,
      articlesSuggeres: articlesSuggeres ?? [],
      suggestions: suggestions ?? [],
      trace: trace ?? [],
      ...(mode ? { mode } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Chat] Error:", err.message || err);

    if (err.message?.includes("GROQ_API_KEY")) {
      return res.status(503).json({ error: "Clé API Groq invalide ou manquante" });
    }
    if (err.message?.includes("Société active")) {
      return res.status(400).json({ error: err.message });
    }
    if (err.status || err.error) {
      return res.status(err.status || 502).json({
        error: extractGroqError(err),
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
    if (/prisma|database|P20/i.test(String(err.message || ""))) {
      return res.status(500).json({ error: "Erreur base de données" });
    }

    return res.status(500).json({
      error: "Erreur du service IA",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

async function postClientChat(req, res) {
  try {
    if (req.user?.role !== "CLIENT") {
      return res.status(403).json({ error: "Accès réservé aux clients" });
    }

    const { message, history = [], lang } = req.body;

    // eslint-disable-next-line no-console
    console.log(
      "[ClientChat] User:",
      req.user?.id,
      "Client:",
      req.user?.clientId,
      "Message:",
      message.slice(0, 50)
    );

    const { reply, articlesSuggeres, suggestions } = await chatWithClientAssistant(
      message.trim(),
      history,
      req.user,
      lang
    );
    return res.json({ reply, articlesSuggeres, suggestions: suggestions ?? [] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[ClientChat] Error:", err.message || err);

    if (err.code === "COMPTE_NON_RATTACHE" || err.status === 409) {
      return res.status(409).json({
        error:
          err.message ||
          "Votre compte n'est pas encore rattaché à une fiche client. Contactez l'administrateur.",
        code: "COMPTE_NON_RATTACHE",
      });
    }
    if (err.status === 403) {
      return res.status(403).json({ error: err.message || "Accès réservé aux clients" });
    }
    if (err.message?.includes("GROQ_API_KEY")) {
      return res.status(503).json({ error: "Assistant temporairement indisponible" });
    }
    if (err.status || err.error) {
      return res.status(err.status || 502).json({
        error: extractGroqError(err),
        detail: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
    if (/prisma|database|P20/i.test(String(err.message || ""))) {
      return res.status(500).json({ error: "Erreur base de données" });
    }

    return res.status(500).json({
      error: "Erreur du service IA",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
}

async function getStockChatBriefing(req, res) {
  try {
    const briefing = await getStockBriefing(req.user?.id, req.user?.societeId);
    return res.json(briefing);
  } catch (err) {
    if (err.message?.includes("Société active")) {
      return res.status(400).json({ error: err.message });
    }
    // eslint-disable-next-line no-console
    console.error("[Chat] briefing:", err.message || err);
    return res.status(500).json({ error: "Impossible de charger le brief assistant" });
  }
}

async function getClientChatBriefing(req, res) {
  try {
    if (req.user?.role !== "CLIENT") {
      return res.status(403).json({ error: "Accès réservé aux clients" });
    }
    const briefing = await getClientBriefing(req.user);
    return res.json(briefing);
  } catch (err) {
    if (err.code === "COMPTE_NON_RATTACHE" || err.status === 409) {
      return res.status(409).json({
        error: err.message || "Compte client non rattaché.",
        code: "COMPTE_NON_RATTACHE",
      });
    }
    // eslint-disable-next-line no-console
    console.error("[ClientChat] briefing:", err.message || err);
    return res.status(500).json({ error: "Impossible de charger le brief assistant" });
  }
}

module.exports = { postChat, postClientChat, getStockChatBriefing, getClientChatBriefing };
