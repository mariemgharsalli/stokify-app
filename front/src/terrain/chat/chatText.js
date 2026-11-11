const TERRAIN_LINK = /\/terrain\/(?:reception\/\d+|scan\/lot\/\d+|scan\/stock\/\d+|preparation\/\d+)/;

export function stripMarkup(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "");
}

export function replyLines(value) {
  return stripMarkup(value).split("\n");
}

export function retryAfterSeconds(headers, now = Date.now()) {
  const bag = headers || {};
  const read = (name) => {
    if (typeof bag.get === "function") return bag.get(name);
    return bag[name] ?? bag[name.toLowerCase()];
  };
  const retry = Number(read("retry-after"));
  if (Number.isFinite(retry) && retry >= 0) return Math.ceil(retry);
  const reset = Number(read("ratelimit-reset"));
  if (!Number.isFinite(reset)) return 60;
  if (reset > 1e9) return Math.max(0, Math.ceil(reset - now / 1000));
  return Math.max(0, Math.ceil(reset));
}

export function splitReply(line) {
  return String(line).split(/(\*\*[^*]+\*\*|\/terrain\/(?:reception\/\d+|scan\/lot\/\d+|scan\/stock\/\d+|preparation\/\d+))/g);
}

export function isTerrainLink(part) {
  return TERRAIN_LINK.test(part);
}

export function contextChipKey(pathname) {
  const path = String(pathname || "");
  if (path.includes("/preparation")) return "prepare";
  if (path.includes("/inventaire")) return "gap";
  if (path.includes("/scan")) return "place";
  return "lots";
}

export function articleLink(article) {
  if (article?.lotId) return { to: `/terrain/scan/lot/${article.lotId}` };
  if (article?.stockLineId) return { to: `/terrain/scan/stock/${article.stockLineId}` };
  if (article?.achatId) return { to: `/terrain/reception/${article.achatId}` };
  if (article?.code) return { to: "/terrain/scan", state: { code: String(article.code) } };
  return null;
}
