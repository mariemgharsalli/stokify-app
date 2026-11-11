import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowUpRight, IconPackage, IconShoppingCart } from "@tabler/icons-react";
import { motion } from "framer-motion";
import { getArticleRealImageUrl } from "../../utils/articleImage";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";

export const EASE = [0.16, 1, 0.3, 1];
export const ORANGE_GRAD = "linear-gradient(135deg, #f97316, #fb923c)";
export const MAX_MESSAGES = 20;

export function formatInline(text) {
  const parts = String(text || "").split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} className="italic opacity-90">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function ChatMarkdown({ content }) {
  return String(content || "")
    .split("\n")
    .map((line, j) => {
      const bullet = line.match(/^\s*(?:[-•▸]|–)\s+(.*)$/);
      const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (bullet) {
        return (
          <div key={j} className={`flex gap-1.5 leading-relaxed ${j > 0 ? "mt-1" : ""}`}>
            <span className="mt-px shrink-0 text-[0.65rem] text-[#f97316]">▸</span>
            <p className="min-w-0">{formatInline(bullet[1])}</p>
          </div>
        );
      }
      if (numbered) {
        return (
          <div key={j} className={`flex gap-1.5 leading-relaxed ${j > 0 ? "mt-1" : ""}`}>
            <span className="w-3.5 shrink-0 text-[0.65rem] font-semibold text-[#f97316]">{numbered[1]}.</span>
            <p className="min-w-0">{formatInline(numbered[2])}</p>
          </div>
        );
      }
      return (
        <p key={j} className={j > 0 ? "mt-1" : ""}>
          {formatInline(line)}
        </p>
      );
    });
}

export function useTypedText(text, enabled, reduce) {
  const [shown, setShown] = useState(() => (enabled && !reduce ? "" : text));

  useEffect(() => {
    if (!enabled || reduce) {
      setShown(text);
      return undefined;
    }
    const tokens = String(text || "").split(/(\s+)/);
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(tokens.slice(0, i).join(""));
      if (i >= tokens.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text, enabled, reduce]);

  return shown;
}

export function RevealedMarkdown({ content, reveal, reduce }) {
  const shown = useTypedText(content, reveal, reduce);
  return <ChatMarkdown content={shown} />;
}

export function SuggestionChips({ items, onPick, reduce, label = "Pistes" }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1.5">
      {label ? (
        <p className="px-1 text-[10px] font-medium tracking-wide text-[var(--color-text-tertiary,var(--text-muted))]">
          {label}
        </p>
      ) : null}
      {items.map((text, i) => (
        <motion.button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-colors"
          style={{
            borderColor: "rgba(249, 115, 22, 0.22)",
            background: "color-mix(in srgb, #f97316 7%, var(--color-background-secondary, var(--bg-input)))",
            color: "var(--color-text-primary, var(--text-primary))",
          }}
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25, ease: EASE }}
          whileHover={reduce ? undefined : { y: -2 }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f97316]" />
          {text}
        </motion.button>
      ))}
    </div>
  );
}

export function FollowUpChips({ items, onPick, reduce }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((text, i) => (
        <motion.button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors hover:border-[#f97316] hover:text-[#f97316]"
          style={{
            borderColor: "rgba(249, 115, 22, 0.28)",
            color: "var(--color-text-secondary, var(--text-secondary))",
            background: "transparent",
          }}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i, duration: 0.2 }}
        >
          {text}
        </motion.button>
      ))}
    </div>
  );
}

export function StatusChip({ status }) {
  if (!status?.label) return null;
  const tone =
    status.tone === "alert"
      ? { bg: "rgba(226, 75, 74, 0.22)", dot: "#f87171" }
      : status.tone === "warn"
        ? { bg: "rgba(251, 191, 36, 0.22)", dot: "#fbbf24" }
        : { bg: "rgba(34, 197, 94, 0.22)", dot: "#4ade80" };
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[9px] font-medium text-white"
      style={{ background: tone.bg }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone.dot }} />
      {status.label}
    </span>
  );
}

export function ToolTrace({ trace, reduce, t }) {
  const blocked = (trace || []).find((item) => item.tool === "domain_guard" && item.status === "blocked");
  const items = (trace || []).filter((item) => item.tool && item.tool !== "domain_guard" && item.status !== "blocked");
  if (!items.length && !blocked) return null;
  const sourcesLabel = t?.chatSources;
  const outLabel = t?.chatOutOfScope || "Hors périmètre magasin";
  const denied = t?.chatDenied || "accès";
  const down = t?.chatDown || "indispo";
  return (
    <div className="mt-2 flex min-w-0 flex-col gap-1">
      {items.length ? (
        <p className="px-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary,var(--text-muted))]">
          {sourcesLabel || "Sources"}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
      {blocked ? (
        <motion.span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
          style={{
            border: "1px solid rgba(249, 115, 22, 0.22)",
            color: "var(--color-text-tertiary, var(--text-muted))",
            background: "rgba(249, 115, 22, 0.05)",
          }}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {outLabel}
        </motion.span>
      ) : null}
      {items.map((item, i) => (
        <motion.span
          key={`${item.tool}-${i}`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
          style={{
            border: "1px solid rgba(249, 115, 22, 0.28)",
            color: item.status === "ok" ? "#fb923c" : "var(--color-text-tertiary, var(--text-muted))",
            background: "rgba(249, 115, 22, 0.06)",
          }}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: item.status === "ok" ? "#22c55e" : item.status === "denied" ? "#fbbf24" : "#f87171" }}
          />
          {item.label || item.tool}
          {item.status === "ok" && item.rows != null ? ` · ${item.rows}` : ""}
          {item.status === "denied" ? ` · ${denied}` : ""}
          {item.status === "timeout" || item.status === "error" ? ` · ${down}` : ""}
        </motion.span>
      ))}
      </div>
    </div>
  );
}

export const STOKI_LOADING_KEYS = [
  "stokiLoad0",
  "stokiLoad1",
  "stokiLoad2",
  "stokiLoad3",
  "stokiLoad4",
  "stokiLoad5",
];

export const STOKI_LOADING_LABELS = [
  "Analyse de la question…",
  "Sélection des outils métier…",
  "Analyse du stock…",
  "Consultation des prévisions…",
  "Vérification des anomalies…",
  "Consultation des données live…",
];

export function TypingDots({ reduce, label }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        className="flex items-center gap-1 rounded-2xl rounded-tl-sm border px-4 py-3"
        style={{
          background: "var(--color-background-secondary, var(--bg-input))",
          borderColor: "rgba(249, 115, 22, 0.15)",
        }}
      >
        {[0, 1, 2].map((j) => (
          <motion.span
            key={j}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#fb923c" }}
            animate={reduce ? undefined : { opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: j * 0.15 }}
          />
        ))}
      </div>
      {label ? (
        <p className="px-1 text-[9px] italic text-[var(--color-text-tertiary,var(--text-muted))]">{label}</p>
      ) : null}
    </div>
  );
}

function ArticleThumb({ article }) {
  const [failed, setFailed] = useState(false);
  const src = getArticleRealImageUrl(article);
  const frame = {
    background: "var(--color-background-secondary, var(--bg-input))",
    boxShadow: "inset 0 0 0 1px rgba(249,115,22,0.12)",
  };
  if (!src || failed) {
    return (
      <span
        className="flex h-[3.85rem] w-[3.85rem] shrink-0 items-center justify-center rounded-[0.85rem] text-[#f97316]"
        style={frame}
        aria-hidden
      >
        <IconPackage size={22} stroke={1.6} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={article.libelle || ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-[3.85rem] w-[3.85rem] shrink-0 rounded-[0.85rem] object-cover"
      style={frame}
    />
  );
}

export function ArticleCards({ articles, reduce, onClose, priceKey = "prixAchat", action = "open" }) {
  if (!articles?.length) return null;
  const ActionIcon = action === "cart" ? IconShoppingCart : IconArrowUpRight;

  return (
    <div className="mt-2.5 flex w-full flex-col gap-2">
      {articles.map((article, idx) => (
        <motion.div
          key={article.id}
          initial={reduce ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.06 * idx, duration: 0.32, ease: EASE }}
        >
          <Link
            to={`/articles/${article.id}`}
            onClick={onClose}
            className="group flex w-full items-center gap-3 rounded-[1.05rem] p-2 no-underline transition-[transform,border-color,box-shadow] duration-200"
            style={{
              background: "var(--color-background-primary, var(--bg-card))",
              border: "1px solid rgba(249, 115, 22, 0.14)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            }}
          >
            <ArticleThumb article={article} />
            <div className="min-w-0 flex-1">
              <span
                className="block truncate text-[0.72rem] font-bold uppercase leading-snug tracking-[0.04em]"
                style={{
                  color: "var(--color-text-primary, var(--text-primary))",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                {article.libelle}
              </span>
              <span className="mt-1 block text-[0.78rem] font-semibold tracking-wide text-[#f97316]">
                {formatMoneyTnd(article[priceKey])}
              </span>
            </div>
            <span
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105"
              style={{
                background: "radial-gradient(circle at 35% 30%, #fb923c 0%, #f97316 55%, #ea580c 100%)",
                boxShadow: "0 0 0 4px rgba(249,115,22,0.12), 0 0 18px rgba(249,115,22,0.35)",
              }}
              aria-hidden
            >
              <ActionIcon size={17} stroke={2.2} className="text-[var(--color-background-primary,#161927)]" />
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
