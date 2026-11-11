const { getDashboard, applyRecommendation, getAiHealth } = require("./ia.service");

async function dashboard(req, res, next) {
  try {
    const societeId = req.user?.societeId;
    const data = await getDashboard(societeId, {
      dateFrom: req.query.dateFrom || req.query.from,
      dateTo: req.query.dateTo || req.query.to,
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function apply(req, res, next) {
  try {
    const societeId = req.user?.societeId;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentification requise" });
    }
    const result = await applyRecommendation(societeId, userId, req.body || {});
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function health(req, res, next) {
  try {
    const societeId = req.user?.societeId;
    const data = await getAiHealth(societeId);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { dashboard, apply, health };
