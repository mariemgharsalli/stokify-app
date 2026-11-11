import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Package, Trophy } from "lucide-react";
import ArticleAvatar from "../../../components/ui/ArticleAvatar";
import { formatMoney } from "../rapportUtils";
import ChartCard from "./ChartCard";

const ACCENT = "#378ADD";
const CYAN = "#0EA5E9";
const SUCCESS = "#1D9E75";
const EASE = [0.22, 1, 0.36, 1];
const RANK_GLOW = [ACCENT, CYAN, SUCCESS];

function RankBadge({ rank, reduceMotion }) {
  const isPodium = rank < 3;
  const color = RANK_GLOW[rank] || "var(--text-muted)";
  return (
    <motion.span
      className="relative flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold"
      style={{
        background: isPodium
          ? `linear-gradient(145deg, color-mix(in srgb, ${color} 28%, transparent), color-mix(in srgb, ${color} 8%, transparent))`
          : "var(--bg-hover)",
        color: isPodium ? color : "var(--text-muted)",
        boxShadow: isPodium
          ? `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent), 0 0 16px -6px ${color}`
          : "inset 0 0 0 1px var(--border-default)",
      }}
      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
    >
      {rank + 1}
      {isPodium && !reduceMotion ? (
        <motion.span
          className="absolute inset-0 rounded-xl"
          style={{ border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
          animate={{ scale: [1, 1.2], opacity: [0.45, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: rank * 0.2 }}
          aria-hidden
        />
      ) : null}
    </motion.span>
  );
}

function AnimatedBar({ pct, delay = 0, color = ACCENT }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-hover)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${color}, ${CYAN})`,
          boxShadow: `0 0 10px -2px ${color}`,
        }}
        initial={reduceMotion ? false : { width: 0 }}
        whileInView={{ width: `${Math.min(100, pct)}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.75, ease: EASE, delay }}
      />
    </div>
  );
}

export default function TopArticlesTable({ stockRows = [], loading }) {
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState({ key: "valeur", dir: "desc" });
  const [hovered, setHovered] = useState(null);
  const perPage = 8;

  function toggleSort(key) {
    setSortBy((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }
    );
    setPage(0);
  }

  const rowsByValue = useMemo(() => {
    const list = (stockRows || []).map((s) => ({
      code: s.article?.code,
      libelle: s.article?.libelle || s.article?.code,
      qte: Number(s.quantite || 0),
      cmp: Number(s.article?.prixAchat || 0),
      valeur: Number(s.valeurStock || s.quantite * (s.article?.prixAchat || 0) || 0),
      depot: s.depot?.code || "—",
      articleRef: s.article,
    }));
    list.sort((a, b) => (b.valeur || 0) - (a.valeur || 0));
    const max = Math.max(...list.map((r) => r.valeur), 1);
    return list.map((r) => ({ ...r, pctBar: (r.valeur / max) * 100 }));
  }, [stockRows]);

  const displayRows = useMemo(() => {
    const copy = [...rowsByValue];
    copy.sort((a, b) => {
      const dir = sortBy.dir === "desc" ? -1 : 1;
      const av = a[sortBy.key];
      const bv = b[sortBy.key];
      if (typeof av === "string" || typeof bv === "string") {
        return dir * String(av ?? "").localeCompare(String(bv ?? ""), "fr");
      }
      return dir * ((av ?? 0) - (bv ?? 0));
    });
    return copy;
  }, [rowsByValue, sortBy]);

  const totalVal = rowsByValue.reduce((s, r) => s + r.valeur, 0);
  const pageRows = displayRows.slice(page * perPage, (page + 1) * perPage);
  const pages = Math.ceil(displayRows.length / perPage) || 1;
  const topArticle = rowsByValue[0];
  const topPct = totalVal > 0 && topArticle ? (topArticle.valeur / totalVal) * 100 : 0;

  const SortTh = ({ label, sortKey, align = "left" }) => {
    const active = sortBy.key === sortKey;
    return (
      <th
        className={`cursor-pointer select-none px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
          align === "right" ? "text-right" : "text-left"
        }`}
        style={{ color: active ? ACCENT : "var(--text-muted)" }}
        onClick={() => toggleSort(sortKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <motion.span
            animate={{ opacity: active ? 1 : 0.35, y: active && sortBy.dir === "asc" ? -1 : 1 }}
            className="text-[9px]"
          >
            {active ? (sortBy.dir === "desc" ? "↓" : "↑") : "↕"}
          </motion.span>
        </span>
      </th>
    );
  };

  return (
    <ChartCard
      loading={loading}
      loadingHeight="h-64"
      icon={Trophy}
      title="Top articles par valeur de stock"
      subtitle={
        topArticle
          ? `Leader : ${topArticle.libelle} — ${topPct.toFixed(0)}% de la valeur totale`
          : "Classement par valeur de stock"
      }
      filters={
        topArticle ? (
          <div
            className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
            style={{
              borderColor: `color-mix(in srgb, ${ACCENT} 35%, var(--border-default))`,
              background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
            }}
          >
            <ArticleAvatar article={topArticle.articleRef} size={28} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {topArticle.libelle}
              </p>
              <p className="text-[10px] tabular-nums" style={{ color: ACCENT }}>
                {formatMoney(topArticle.valeur)}
              </p>
            </div>
          </div>
        ) : null
      }
    >
      {!rowsByValue.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="mb-2 h-8 w-8" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune ligne de stock à classer.
          </p>
        </div>
      ) : (
        <>
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{
              borderColor: "var(--border-default)",
              background:
                "radial-gradient(ellipse 50% 80% at 0% 0%, color-mix(in srgb, #378ADD 10%, transparent), transparent 55%)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr style={{ background: "color-mix(in srgb, var(--bg-hover) 80%, transparent)" }}>
                    <th
                      className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.12em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Rang
                    </th>
                    <SortTh label="Article" sortKey="libelle" />
                    <SortTh label="Qté" sortKey="qte" align="right" />
                    <SortTh label="CMP" sortKey="cmp" align="right" />
                    <SortTh label="Valeur" sortKey="valeur" align="right" />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {pageRows.map((r, i) => {
                      const rank = page * perPage + i;
                      const sharePct = totalVal > 0 ? (r.valeur / totalVal) * 100 : 0;
                      const rowKey = `${r.code}-${r.depot}-${rank}`;
                      const accent = RANK_GLOW[Math.min(rank, 2)] || ACCENT;
                      const isHot = hovered === rowKey;

                      return (
                        <motion.tr
                          key={rowKey}
                          layout
                          initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                          transition={{ delay: Math.min(i * 0.045, 0.35), duration: 0.35, ease: EASE }}
                          onMouseEnter={() => setHovered(rowKey)}
                          onMouseLeave={() => setHovered(null)}
                          className="group border-t transition-colors"
                          style={{
                            borderColor: "var(--border-default)",
                            background: isHot
                              ? `color-mix(in srgb, ${accent} 8%, transparent)`
                              : "transparent",
                            boxShadow: isHot ? `inset 3px 0 0 ${accent}` : undefined,
                          }}
                        >
                          <td className="px-3 py-3">
                            <RankBadge rank={rank} reduceMotion={reduceMotion} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <motion.div
                                whileHover={reduceMotion ? undefined : { scale: 1.06 }}
                                className="relative"
                              >
                                <ArticleAvatar article={r.articleRef} size={40} />
                                {rank < 3 ? (
                                  <span
                                    className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--bg-card)]"
                                    style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                                    aria-hidden
                                  />
                                ) : null}
                              </motion.div>
                              <div className="min-w-0">
                                <p
                                  className="truncate font-semibold tracking-tight"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {r.libelle}
                                </p>
                                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  <span className="font-mono">{r.code}</span>
                                  <span className="mx-1 opacity-40">·</span>
                                  {r.depot}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            className="px-3 py-3 text-right tabular-nums"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {r.qte.toLocaleString("fr-FR")}
                          </td>
                          <td
                            className="px-3 py-3 text-right font-mono text-[12px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {formatMoney(r.cmp)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <p
                              className="font-mono text-sm font-bold tabular-nums"
                              style={{ color: rank < 3 ? SUCCESS : "var(--text-primary)" }}
                            >
                              {formatMoney(r.valeur)}
                            </p>
                            <div className="mt-1.5 ml-auto w-28 max-w-full">
                              <AnimatedBar pct={r.pctBar} delay={0.05 + i * 0.04} color={accent} />
                            </div>
                            <p className="mt-0.5 text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                              {sharePct.toFixed(1)}% du stock
                            </p>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Page {page + 1} / {pages} · {displayRows.length} articles
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium disabled:opacity-35"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Préc.
                </button>
                <button
                  type="button"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-35"
                  style={{
                    borderColor: "transparent",
                    background: `linear-gradient(135deg, ${ACCENT}, ${CYAN})`,
                  }}
                >
                  Suiv. <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </ChartCard>
  );
}
