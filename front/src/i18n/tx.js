import { PHRASES } from "./phrases";
import { APP_UI_PHRASES } from "./appUiLocales";
import { useLangStore } from "../store/langStore";

const ATTRS = ["title", "placeholder", "aria-label", "aria-placeholder", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "SVG"]);
const SRC = "_stokifyI18nSrc";
const APPLIED = "_stokifyI18nOut";

function lookup(core, lang) {
  if (!core || lang === "fr") return null;
  const hit = PHRASES[core] || APP_UI_PHRASES[core];
  if (hit?.[lang]) return hit[lang];

  if (core.endsWith(" *")) {
    const inner = lookup(core.slice(0, -2).trim(), lang);
    if (inner) return `${inner} *`;
  }
  if (core.endsWith("…") || core.endsWith("...")) {
    const stripped = core.replace(/[.…]+$/, "").trim();
    const inner = lookup(stripped, lang);
    if (inner) return `${inner}…`;
  }
  if (core.endsWith(" :") || core.endsWith(":")) {
    const stripped = core.replace(/\s*:$/, "").trim();
    const inner = lookup(stripped, lang);
    if (inner) return `${inner} :`;
  }
  if (core.endsWith(" ?")) {
    const stripped = core.slice(0, -2).trim();
    const inner = lookup(stripped, lang);
    if (inner) return `${inner} ?`;
  }
  return null;
}

export function translatePhrase(raw, lang) {
  if (raw == null || lang === "fr") return raw;
  const src = String(raw);
  const core = src.trim();
  if (!core) return src;
  if (/^[\d\s.,:%/+-]+$/.test(core)) return src;
  if (core.includes("@") && /[.]/.test(core)) return src;

  const translated = lookup(core, lang);
  const leading = src.match(/^\s*/)[0];
  const trailing = src.match(/\s*$/)[0];
  if (translated != null) return leading + translated + trailing;

  for (const sep of [" — ", " · ", " | "]) {
    if (!core.includes(sep)) continue;
    const parts = core.split(sep);
    const next = parts.map((part) => lookup(part.trim(), lang) || part.trim());
    if (next.some((part, i) => part !== parts[i].trim())) {
      return leading + next.join(sep) + trailing;
    }
  }
  return src;
}

function shouldSkip(el) {
  if (!el || el.nodeType !== 1) return false;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable) return true;
  if (el.closest?.("[data-no-i18n]")) return true;
  if (el.closest?.("[contenteditable='true']")) return true;
  if (el.closest?.("input, textarea")) return true;
  return false;
}

function syncAndTranslate(current, bag, lang) {
  const value = current ?? "";
  if (bag.src == null) bag.src = value;
  if (bag.out != null && value !== bag.out) bag.src = value;
  const next = lang === "fr" ? bag.src : translatePhrase(bag.src, lang);
  bag.out = next;
  return next;
}

function applyTextNode(node, lang) {
  const parent = node.parentElement;
  if (!parent || shouldSkip(parent)) return;
  const bag = { src: node[SRC], out: node[APPLIED] };
  const next = syncAndTranslate(node.nodeValue, bag, lang);
  node[SRC] = bag.src;
  node[APPLIED] = bag.out;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function applyAttrs(el, lang) {
  if (!el?.getAttribute || shouldSkip(el)) return;
  for (const attr of ATTRS) {
    if (!el.hasAttribute(attr)) continue;
    const srcKey = `${SRC}_${attr}`;
    const outKey = `${APPLIED}_${attr}`;
    const bag = { src: el[srcKey], out: el[outKey] };
    const next = syncAndTranslate(el.getAttribute(attr), bag, lang);
    el[srcKey] = bag.src;
    el[outKey] = bag.out;
    if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
  }
}

export function applyDomI18n(root, lang) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p || shouldSkip(p)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const texts = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const node of texts) applyTextNode(node, lang);

  if (root.querySelectorAll) {
    root.querySelectorAll("[title], [placeholder], [aria-label], [aria-placeholder], [alt]").forEach((el) => {
      applyAttrs(el, lang);
    });
    if (root.nodeType === 1) applyAttrs(root, lang);
  }
}

let started = false;

/** One observer for the whole app (nested language providers share the lang store). */
export function startDomI18n() {
  if (started || typeof document === "undefined" || !document.body) return () => {};
  started = true;

  let mo;
  const run = () => {
    const lang = useLangStore.getState().lang;
    mo?.disconnect();
    try {
      applyDomI18n(document.body, lang);
    } finally {
      mo?.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRS,
      });
    }
  };

  mo = new MutationObserver(run);
  run();
  const unsub = useLangStore.subscribe(run);
  return () => {
    unsub();
    mo.disconnect();
    started = false;
  };
}
