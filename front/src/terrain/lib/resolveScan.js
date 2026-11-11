import api from "../../services/api";
import { parseScannedCode } from "../../utils/qrPayload";

const EMPLACEMENTS_STALE_MS = 5 * 60 * 1000;
const ARTICLE_PAGE_CAP = 5;

function sameText(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function compactCode(value) {
  return String(value || "").replace(/[\s_-]/g, "").toLowerCase();
}

/** Égalité stricte, puis sans espaces/tirets, puis code-barres numérique (zéros de tête ignorés). */
function sameCode(left, right) {
  if (sameText(left, right)) return true;
  const compactLeft = compactCode(left);
  const compactRight = compactCode(right);
  if (compactLeft && compactLeft === compactRight) return true;
  const digitsLeft = String(left || "").replace(/\D/g, "");
  const digitsRight = String(right || "").replace(/\D/g, "");
  if (digitsLeft.length < 8 || digitsRight.length < 8) return false;
  return digitsLeft.replace(/^0+/, "") === digitsRight.replace(/^0+/, "");
}

function listFrom(data) {
  return Array.isArray(data) ? data : data?.items ?? [];
}

/**
 * GET articles?search= est un « contains » paginé (max 100) sur libellé, code et codeBarres.
 * On ne retient qu'une égalité exacte, insensible à la casse. Pas de route by-code côté API.
 */
async function searchArticles(query) {
  const needle = String(query || "").trim();
  if (!needle) return { article: null, suggestions: [] };

  let page = 1;
  let pages = 1;
  const suggestions = [];
  while (page <= pages && page <= ARTICLE_PAGE_CAP) {
    const { data } = await api.get("articles", {
      params: { search: needle, limit: 100, page },
    });
    const items = listFrom(data);
    pages = Number(data?.pages) || 1;
    const hit = items.find(
      (article) => sameCode(article?.code, needle) || (article?.codeBarres && sameCode(article.codeBarres, needle))
    );
    if (hit) return { article: hit, suggestions: [] };
    for (const article of items) {
      if (suggestions.length >= 6) break;
      suggestions.push(article);
    }
    if (items.length === 0) break;
    page += 1;
  }
  return { article: null, suggestions };
}

/**
 * Le « contains » de l'API rate un code-barres collé si la saisie a des espaces.
 * On retente alors la forme compacte, puis les chiffres seuls.
 */
async function findArticle(code) {
  const needle = String(code || "").trim();
  if (!needle) return { article: null, suggestions: [] };

  const primary = await searchArticles(needle);
  if (primary.article) return primary;

  const alternates = [];
  const compact = compactCode(needle);
  if (compact && compact !== needle.toLowerCase()) alternates.push(compact);
  const digits = needle.replace(/\D/g, "");
  if (digits.length >= 8 && !alternates.includes(digits)) alternates.push(digits);

  let suggestions = primary.suggestions;
  for (const alternate of alternates) {
    const next = await searchArticles(alternate);
    if (next.article) return next;
    for (const article of next.suggestions) {
      if (suggestions.length >= 6) break;
      if (!suggestions.some((row) => row.id === article.id)) suggestions.push(article);
    }
  }
  return { article: null, suggestions };
}

async function loadEmplacements(depotId, queryClient, sessionKey) {
  const queryKey = ["terrain", sessionKey, "ref", "emplacements", depotId];
  const queryFn = async () => {
    const { data } = await api.get("emplacements", { params: { depotId } });
    return listFrom(data);
  };
  if (!queryClient?.ensureQueryData) return queryFn();
  // revalidateIfStale : sur Query v5, staleTime seul ne relance pas ensureQueryData.
  return queryClient.ensureQueryData({
    queryKey,
    queryFn,
    staleTime: EMPLACEMENTS_STALE_MS,
    revalidateIfStale: true,
  });
}

function findEmplacement(list, code) {
  const byCode = list.find((row) => sameCode(row?.code, code));
  if (byCode) return byCode;
  return list.find((row) => row?.barcode && sameCode(row.barcode, code)) || null;
}

function lineMatchesEmplacement(line, emplacement) {
  if (!line || !emplacement) return false;
  if (line.emplacementId != null && Number(line.emplacementId) === Number(emplacement.id)) return true;
  return sameText(line.emplacement?.code, emplacement.code);
}

/**
 * Ancien QR texte « Code: … / Emplacement: … ».
 * L'emplacement du dépôt courant choisit la ligne de stock, pas seulement l'article.
 * GET stock accepte depotId + articleId + emplacementId.
 */
async function resolveStockText(parsed, depotId, queryClient, sessionKey) {
  const articleCode = String(parsed.articleCode || "").trim();
  if (!articleCode) return { kind: "unknown", parsed };

  const place = String(parsed.emplacement || "").trim();
  if (place && depotId) {
    const list = await loadEmplacements(depotId, queryClient, sessionKey);
    const emplacement = findEmplacement(Array.isArray(list) ? list : [], place);
    const article = (await findArticle(articleCode)).article;
    if (emplacement && article) {
      const { data } = await api.get("stock", {
        params: {
          depotId,
          articleId: article.id,
          emplacementId: emplacement.id,
          limit: 20,
        },
      });
      const line = listFrom(data).find((row) => lineMatchesEmplacement(row, emplacement));
      if (line) return { kind: "stock-line", data: line, parsed };
    }
    if (article) return { kind: "article", data: article, parsed };
    return { kind: "unknown", parsed };
  }

  const article = (await findArticle(articleCode)).article;
  if (article) return { kind: "article", data: article, parsed };
  return { kind: "unknown", parsed, suggestions: { articles: [], emplacements: [] } };
}

/**
 * Transforme une valeur scannée en objet métier.
 * kind ∈ "stock-line" | "lot" | "emplacement" | "article" | "unknown"
 */
export async function resolveScan(raw, { depotId, queryClient, sessionKey } = {}) {
  const parsed = parseScannedCode(raw);

  if (parsed.type === "stock") {
    const { data } = await api.get(`stock/lines/${parsed.id}`);
    return { kind: "stock-line", data, parsed };
  }
  if (parsed.type === "lot") {
    const { data } = await api.get(`lots/${parsed.id}`);
    return { kind: "lot", data, parsed };
  }
  if (parsed.type === "stock-text") {
    return resolveStockText(parsed, depotId, queryClient, sessionKey);
  }

  const code = String(parsed.value || "").replace(/[\u0000-\u001F]+/g, "").trim();
  if (!code) return { kind: "unknown", parsed, suggestions: { articles: [], emplacements: [] } };

  // 1) Emplacement du dépôt courant (code exact, insensible à la casse). GET emplacements exige depotId.
  let places = [];
  if (depotId) {
    const list = await loadEmplacements(depotId, queryClient, sessionKey);
    places = Array.isArray(list) ? list : [];
    const emp = findEmplacement(places, code);
    if (emp) return { kind: "emplacement", data: emp, parsed };
  }

  // 2) Article par code ou code-barres.
  const { article, suggestions } = await findArticle(code);
  if (article) return { kind: "article", data: article, parsed };

  const needle = code.toLowerCase();
  const emplacements = places
    .filter((row) => {
      const blob = `${row?.code || ""} ${row?.libelle || ""} ${row?.barcode || ""}`.toLowerCase();
      return blob.includes(needle);
    })
    .slice(0, 4);

  return { kind: "unknown", parsed, suggestions: { articles: suggestions, emplacements } };
}
