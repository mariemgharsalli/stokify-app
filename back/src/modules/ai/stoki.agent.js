const Groq = require("groq-sdk");
const { getEffectivePermissions } = require("../../middleware/rbac");
const { classifyDomain, OUT_OF_DOMAIN_REPLY } = require("./stoki.guard");
const { stokiAgentPrompt, stokiFinalNudge, normalizeChatLang } = require("./stoki.prompts");
const {
  toOpenAiTools,
  executeTool,
  suggestToolsFromText,
  offlineToolForMessage,
  extractSearchQuery,
  publicTrace,
} = require("./stoki.tools");

const GROQ_TIMEOUT_MS = Math.max(1000, Number(process.env.GROQ_TIMEOUT_MS) || 15000);

// maxRetries 0 : un seul repli applicatif (modèle suivant, 500 ms), pas ceux du SDK.
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: GROQ_TIMEOUT_MS,
  maxRetries: 0,
});

const GROQ_MODELS = [
  ...(process.env.GROQ_CHAT_MODEL ? [process.env.GROQ_CHAT_MODEL.trim()] : []),
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const MAX_ROUNDS = 3;
const MAX_TOOLS_PER_ROUND = 3;
const GLOBAL_TIMEOUT_MS = 28000;
const HISTORY_LIMIT = 10;

const DOMAIN_SUGGESTIONS = [
  "Quels articles sont en rupture ?",
  "Quels lots expirent bientôt ?",
  "C'est quoi FEFO ?",
  "Quels produits se vendent le plus ?",
];

function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

function clip(text, max = 2000) {
  return String(text || "").trim().slice(0, max);
}

function trimHistory(history) {
  return (history || [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-HISTORY_LIMIT)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: clip(m.content, 1200),
    }));
}

function extractText(msg) {
  if (!msg) return null;
  const content = String(msg.content || "").trim();
  if (content) return content;
  const reasoning = String(msg.reasoning || "").trim();
  if (!reasoning) return null;
  const parts = reasoning.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || reasoning.slice(-1200);
}

function getToolCalls(msg) {
  if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length) return msg.tool_calls;
  if (msg?.function_call?.name) {
    return [{ id: "legacy_0", type: "function", function: msg.function_call }];
  }
  return [];
}

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function uniqueArticles(list) {
  const seen = new Set();
  const out = [];
  for (const a of list || []) {
    if (!a?.id || seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
    if (out.length >= 4) break;
  }
  return out;
}

function buildSuggestions(trace) {
  const names = new Set((trace || []).filter((t) => t.status === "ok" && t.rows > 0).map((t) => t.name || t.tool));
  const s = [];
  if (names.has("get_stock_alerts") || names.has("explain_rupture_risk")) {
    s.push("Explique-moi cette rupture");
    s.push("Quels articles similaires sont disponibles ?");
  }
  if (names.has("list_anomalies")) s.push("Analyse cette anomalie");
  if (names.has("get_lots_expiring") || names.has("get_expiry_waste_risk")) {
    s.push("Priorise les sorties FEFO");
    s.push("Quelle valeur va périmer ?");
  }
  if (names.has("get_top_sales")) s.push("Ces best-sellers sont-ils en stock ?");
  if (names.has("get_movements_summary")) s.push("Quelles sorties sur ce dépôt ?");
  if (names.has("get_forecast")) s.push("Ce niveau de stock est-il suffisant ?");
  if (!s.length) {
    s.push("Quels articles sont en rupture ?", "C'est quoi FEFO ?", "Quels produits se vendent le plus ?");
  }
  return [...new Set(s)].slice(0, 4);
}

function statutGroq(err) {
  const status = Number(err?.status || err?.statusCode || 0);
  return Number.isFinite(status) ? status : 0;
}

function erreurGroqRejouable(err) {
  const status = statutGroq(err);
  if (status === 429 || status >= 500) return true;
  const nom = String(err?.name || "");
  if (nom === "APIConnectionTimeoutError" || nom === "APIConnectionError") return true;
  const msg = String(err?.message || "").toLowerCase();
  return /timeout|timed out|aborted|econnreset|etimedout/.test(msg);
}

function attendre(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appelerGroq(model, payload, extra) {
  return groq.chat.completions.create(
    { model, ...payload, ...extra },
    { timeout: GROQ_TIMEOUT_MS, maxRetries: 0 }
  );
}

async function groqChat({ messages, tools, toolChoice, maxTokens = 900, temperature = 0.3 }) {
  if (!hasGroqKey()) return null;
  const payload = {
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (tools?.length) {
    payload.tools = tools;
    payload.tool_choice = toolChoice || "auto";
  }

  let dejaReessaie = false;
  for (let i = 0; i < GROQ_MODELS.length; i += 1) {
    const model = GROQ_MODELS[i];
    const suivant = i + 1 < GROQ_MODELS.length;
    try {
      return await appelerGroq(model, payload, { reasoning_effort: "low" });
    } catch (err) {
      // Statut seulement : le message Groq peut faire écho à la requête.
      // eslint-disable-next-line no-console
      console.error(`[StokiAgent] Groq ${model}: HTTP ${statutGroq(err) || err?.name || "erreur"}`);
      if (erreurGroqRejouable(err)) {
        if (dejaReessaie || !suivant) break;
        dejaReessaie = true;
        await attendre(500);
        continue;
      }
      try {
        return await appelerGroq(model, payload, {});
      } catch (err2) {
        // eslint-disable-next-line no-console
        console.error(`[StokiAgent] Groq ${model}: HTTP ${statutGroq(err2) || err2?.name || "erreur"}`);
        if (erreurGroqRejouable(err2)) {
          if (dejaReessaie || !suivant) break;
          dejaReessaie = true;
          await attendre(500);
        }
      }
    }
  }
  return null;
}

const OFFLINE_BANNER = "Réponse automatique (assistant LLM indisponible)";

function ligneArticle(it, lang) {
  const en = normalizeChatLang(lang) === "en";
  const code = it.code || it.article || it.libelle || "?";
  const lib = it.libelle && it.libelle !== code ? ` · ${it.libelle}` : "";
  const extra = [
    it.statut,
    it.quantite != null ? `${en ? "qty" : "qté"} ${it.quantite}` : null,
    it.qteVendue != null ? `${en ? "sold" : "vendu"} ${it.qteVendue}` : null,
    it.score != null ? `score ${it.score}` : null,
    it.jours != null ? `${it.jours} ${en ? "d" : "j"}` : null,
    it.depot || null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `- ${code}${lib}${extra ? ` — ${extra}` : ""}`;
}

function offlineCopy(lang) {
  if (normalizeChatLang(lang) === "en") {
    return {
      banner: "Automatic reply (LLM assistant unavailable)",
      unread: "Warehouse data is not readable right now. No figure is invented.",
      empty: "Nothing to report in this scope.",
      alerts: (data, n) =>
        `**${data.nbRuptures ?? 0}** stockout(s), **${data.nbCritiques ?? 0}** critical line(s) across ${data.totalAlertes ?? n} alert(s).`,
      topSales: "Best-selling items in the current period:",
      pulse: (pulse, kpis) =>
        `AI pulse: **${pulse.score ?? "—"}** (${pulse.band || "n/a"}). Forecasts ${kpis.previsions ?? "—"}, anomalies ${kpis.anomalies ?? "—"}.`,
    };
  }
  return {
    banner: OFFLINE_BANNER,
    unread: "Les données magasin ne sont pas lisibles pour le moment. Aucun chiffre n'est inventé.",
    empty: "Aucun élément à signaler sur ce périmètre.",
    alerts: (data, n) =>
      `**${data.nbRuptures ?? 0}** rupture(s), **${data.nbCritiques ?? 0}** critique(s) sur ${data.totalAlertes ?? n} alerte(s).`,
    topSales: "Articles les plus vendus sur la période en cours :",
    pulse: (pulse, kpis) =>
      `Pouls IA : **${pulse.score ?? "—"}** (${pulse.band || "n/d"}). Prévisions ${kpis.previsions ?? "—"}, anomalies ${kpis.anomalies ?? "—"}.`,
  };
}

function formaterReponseOffline(toolName, executed, lang) {
  const copy = offlineCopy(lang);
  let data = {};
  try {
    data = JSON.parse(executed?.jsonForLlm || "{}");
  } catch {
    data = {};
  }
  const lines = [`**${copy.banner}**`, ""];
  if (!executed || executed.status !== "ok") {
    lines.push(copy.unread);
    return lines.join("\n");
  }
  const cap = toolName === "get_stock_alerts" || toolName === "explain_rupture_risk" ? 12 : 5;
  const items = Array.isArray(data.items) ? data.items.slice(0, cap) : [];
  if (toolName === "get_stock_alerts") {
    lines.push(copy.alerts(data, items.length));
  } else if (toolName === "get_stokify_help") {
    const bits = items.map((i) => (i.titre ? `**${i.titre}**\n${i.texte || ""}`.trim() : "")).filter(Boolean);
    if (bits.length) lines.push(bits.join("\n\n"));
  } else if (toolName === "get_expiry_waste_risk") {
    const k = data.kpis || {};
    lines.push(
      data.briefing ||
        `Lots à risque : **${k.lotsARisque ?? items.length}**. Valeur prédite : ${k.valeurPredite ?? "—"}.`
    );
  } else if (toolName === "list_anomalies") {
    lines.push(`**${items.length}** anomalie(s) ouverte(s) remontée(s).`);
  } else if (toolName === "get_forecast") {
    if (data.error === "articleId_required" || !data.code) {
      lines.push("Indiquez un code article pour calculer une prévision. Aucun chiffre n'est inventé.");
    } else {
      lines.push(
        `**${data.code}** ${data.libelle || ""} — stock ${data.stockActuel ?? "—"}, réappro ${data.reorderPoint ?? "—"}, confiance ${data.confidence ?? "—"} %.`
      );
    }
  } else if (toolName === "get_top_sales") {
    lines.push(copy.topSales);
  } else if (toolName !== "explain_rupture_risk") {
    const pulse = data.pulse || {};
    const kpis = data.kpis || {};
    lines.push(copy.pulse(pulse, kpis));
  }
  for (const it of items) {
    if (toolName === "get_stokify_help") continue;
    if (it.code || it.libelle || it.article) lines.push(ligneArticle(it, lang));
  }
  if (!items.length && toolName !== "get_forecast" && toolName !== "get_ia_pulse" && toolName !== "get_stokify_help") {
    lines.push(copy.empty);
  }
  return lines.join("\n");
}

async function deterministicAnswer(message, user, lang) {
  const domain = classifyDomain(message);
  if (!domain.inDomain) {
    return {
      reply: `${OUT_OF_DOMAIN_REPLY}\n\n_${OFFLINE_BANNER}_`,
      mode: "offline-tools",
      articlesSuggeres: [],
      suggestions: DOMAIN_SUGGESTIONS,
      trace: [{ tool: "domain_guard", label: "Garde domaine", status: "blocked", rows: 0, ms: 0 }],
    };
  }
  try {
    const perms = await getEffectivePermissions(user);
    const picked = offlineToolForMessage(message);
    const executed = await executeTool(picked.name, picked.args || {}, { user, perms });
    return {
      reply: formaterReponseOffline(picked.name, executed, lang),
      mode: "offline-tools",
      articlesSuggeres: uniqueArticles(executed.articles),
      suggestions: buildSuggestions([executed]),
      trace: publicTrace([executed]),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[StokiAgent] repli offline:", err?.message || "erreur");
    return {
      reply: `**${OFFLINE_BANNER}**\n\nJe n'ai pas pu lire les données magasin pour le moment.`,
      mode: "offline-tools",
      articlesSuggeres: [],
      suggestions: DOMAIN_SUGGESTIONS,
      trace: [{ tool: "offline", label: "Repli outils", status: "error", rows: 0, ms: 0 }],
    };
  }
}

async function runTools(calls, ctx) {
  const slice = (calls || []).slice(0, MAX_TOOLS_PER_ROUND);
  const results = [];
  for (const call of slice) {
    const name = call.function?.name || call.name;
    const args = parseArgs(call.function?.arguments || call.arguments);
    args._userMessage = ctx.userMessage;
    const executed = await executeTool(name, args, ctx);
    results.push({
      call,
      executed,
    });
  }
  return results;
}

function emptyDataReply() {
  return "Je n'ai pas trouvé cette information dans les données disponibles de Stokify. Précisez un code article, un dépôt, ou une autre question magasin.";
}

function fallbackFromTrace(trace, pedagogical) {
  if (pedagogical) {
    const help = trace.find((t) => t.name === "get_stokify_help" && t.status === "ok");
    if (help) {
      try {
        const data = JSON.parse(help.jsonForLlm);
        const bits = (data.items || []).map((i) => `**${i.titre}**\n${i.texte}`);
        if (bits.length) return bits.join("\n\n");
      } catch {
        /* ignore */
      }
    }
  }
  const useful = (trace || []).filter((t) => t.status === "ok" && t.rows > 0);
  if (!useful.length) return emptyDataReply();
  const lines = useful.map((t) => `- ${t.label} : ${t.rows} résultat(s) (live, ${t.ms} ms)`);
  return `Voici ce que les outils Stokify ont remonté :\n\n${lines.join("\n")}\n\nJe n'invente pas le détail : ouvrez le module correspondant, ou reformulez (un code article aide).`;
}

async function runStokiAgent({ message, conversationHistory, user, lang = "fr" }) {
  const text = clip(message);
  const domain = classifyDomain(text);
  const uiLang = normalizeChatLang(lang);

  if (!domain.inDomain) {
    return {
      reply: OUT_OF_DOMAIN_REPLY,
      articlesSuggeres: [],
      suggestions: DOMAIN_SUGGESTIONS,
      trace: [{ tool: "domain_guard", label: "Garde domaine", status: "blocked", rows: 0, ms: 0 }],
    };
  }

  if (!hasGroqKey()) {
    return deterministicAnswer(text, user, uiLang);
  }

  try {
    const perms = await getEffectivePermissions(user);
    const started = Date.now();
    const tools = toOpenAiTools();
    const messages = [
      { role: "system", content: stokiAgentPrompt(user, uiLang) },
      ...trimHistory(conversationHistory),
      { role: "user", content: text },
    ];

    const trace = [];
    const collectedArticles = [];
    const ctx = { user, perms, userMessage: text };

    const remaining = () => GLOBAL_TIMEOUT_MS - (Date.now() - started);
    let llmVu = false;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      if (remaining() < 1500) break;

      const completion = await groqChat({
        messages,
        tools,
        maxTokens: round === 0 ? 700 : 900,
      });
      if (!completion) {
        if (!llmVu) return deterministicAnswer(text, user, uiLang);
        break;
      }
      llmVu = true;

      const msg = completion?.choices?.[0]?.message;
      const calls = getToolCalls(msg);

      if (round === 0 && !calls.length) {
        let guessed = suggestToolsFromText(text);
        if (domain.pedagogical && !guessed.includes("get_stokify_help")) {
          guessed = ["get_stokify_help", ...guessed].slice(0, 3);
        }
        if (guessed.length) {
          const fakeCalls = guessed.map((name, i) => ({
            id: `fallback_${i}`,
            type: "function",
            function: {
              name,
              arguments: JSON.stringify(
                name === "search_article_stock"
                  ? { query: extractSearchQuery(text) }
                  : name === "get_stokify_help"
                    ? { topic: text }
                    : {}
              ),
            },
          }));
          const executed = await runTools(fakeCalls, ctx);
          for (const { executed: result } of executed) {
            trace.push(result);
            collectedArticles.push(...(result.articles || []));
          }
          messages.push({
            role: "system",
            content: `Résultats d'outils Stokify (live, bornés):\n${executed
              .map(({ executed: r }) => `${r.label} [${r.status}, ${r.rows} lignes]: ${r.jsonForLlm}`)
              .join("\n\n")}`,
          });
          break;
        }
        const content = extractText(msg);
        if (content) {
          return {
            reply: content,
            articlesSuggeres: uniqueArticles(collectedArticles),
            suggestions: buildSuggestions(trace),
            trace: publicTrace(trace),
          };
        }
        break;
      }

      if (!calls.length) {
        const content = extractText(msg);
        if (content) {
          return {
            reply: content,
            articlesSuggeres: uniqueArticles(collectedArticles),
            suggestions: buildSuggestions(trace),
            trace: publicTrace(trace),
          };
        }
        break;
      }

      messages.push({
        role: "assistant",
        content: msg?.content || "",
        tool_calls: msg?.tool_calls || calls,
      });

      const executed = await runTools(calls, ctx);
      for (const { call, executed: result } of executed) {
        trace.push(result);
        collectedArticles.push(...(result.articles || []));
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function?.name || call.name,
          content: result.jsonForLlm,
        });
      }
    }

    if (remaining() > 1200 && hasGroqKey()) {
      messages.push({ role: "system", content: stokiFinalNudge() });
      const final = await groqChat({ messages, tools: undefined, maxTokens: 750, temperature: 0.28 });
      const reply = extractText(final?.choices?.[0]?.message);
      if (reply) {
        return {
          reply,
          articlesSuggeres: uniqueArticles(collectedArticles),
          suggestions: buildSuggestions(trace),
          trace: publicTrace(trace),
        };
      }
    }

    return {
      reply: fallbackFromTrace(trace, domain.pedagogical),
      articlesSuggeres: uniqueArticles(collectedArticles),
      suggestions: buildSuggestions(trace),
      trace: publicTrace(trace),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[StokiAgent]", err?.message || "erreur");
    return deterministicAnswer(text, user, uiLang);
  }
}

module.exports = { runStokiAgent };
