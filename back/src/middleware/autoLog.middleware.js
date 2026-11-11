const { logActivity, sanitizeBody } = require("../services/activityLogger");

/**
 * Factory: wrap a controller method with automatic logging after success.
 */
function withLog({ action, module, entity, getLabel, getEntityId }) {
  return (originalFn) => async (req, res, next) => {
    const userId = req.user?.id;
    const societeId = req.user?.societeId ?? req.body?.societeId;

    try {
      const originalJson = res.json.bind(res);
      let responseData = null;

      res.json = (data) => {
        responseData = data;
        return originalJson(data);
      };

      await originalFn(req, res, next);

      if (res.statusCode < 400 && userId) {
        await logActivity({
          userId,
          action,
          module,
          entity,
          entityId: getEntityId?.(req, responseData),
          entityLabel: getLabel?.(req, responseData),
          details: {
            body: sanitizeBody(req.body),
            params: req.params,
          },
          societeId,
          req,
        });
      }
    } catch (err) {
      if (userId) {
        await logActivity({
          userId,
          action,
          module,
          entity,
          status: "ERROR",
          errorMsg: err.message,
          societeId,
          req,
        });
      }
      next(err);
    }
  };
}

module.exports = { withLog };
