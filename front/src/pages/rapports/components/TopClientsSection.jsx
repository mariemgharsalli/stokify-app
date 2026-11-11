import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crown, ShoppingBag, Users } from "lucide-react";
import { formatMoney } from "../rapportUtils";
import ChartCard from "./ChartCard";

const ACCENT = "#378ADD";
const CYAN = "#0EA5E9";
const SUCCESS = "#1D9E75";
const WARNING = "#BA7517";
const EASE = [0.22, 1, 0.36, 1];
const RANK_GLOW = [ACCENT, CYAN, SUCCESS];

function initials(nom) {
  const p = String(nom || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2);
  return p.map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

function avatarTone(nom) {
  const palette = [ACCENT, CYAN, SUCCESS, WARNING, "#0F6E56", "#E24B4A"];
  let h = 0;
  for (let i = 0; i < String(nom).length; i += 1) h = String(nom).charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

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
      {rank === 0 ? <Crown className="h-3.5 w-3.5" /> : rank + 1}
      {isPodium && !reduceMotion ? (
        <motion.span
          className="absolute inset-0 rounded-xl"
          style={{ border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
          animate={{ scale: [1, 1.22], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: rank * 0.15 }}
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

function PayBadge({ rate }) {
  const good = Number(rate) >= 80;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
      style={{
        background: good ? "var(--success-bg)" : "var(--warning-bg, rgba(186,117,23,0.15))",
        color: good ? "var(--success-text)" : "var(--warning-text, #BA7517)",
        boxShadow: good
          ? "0 0 0 1px color-mix(in srgb, var(--success-text) 25%, transparent)"
          : "0 0 0 1px color-mix(in srgb, #BA7517 25%, transparent)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: good ? "var(--success-text)" : WARNING,
          boxShadow: good ? "0 0 6px var(--success-text)" : `0 0 6px ${WARNING}`,
        }}
      />
      {Number(rate || 0).toFixed(0)}%
    </span>
  );
}

export default function TopClientsSection({ clients, loading }) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState(null);
  const [sortBy, setSortBy] = useState({ key: "totalTTC", dir: "desc" });

  const rowsByCa = useMemo(() => {
    const list = [...(clients || [])].map((c) => ({
      ...c,
      totalTTC: Number(c.totalTTC || 0),
      nbVentes: Number(c.nbVentes || 0),
      tauxPaiement: Number(c.tauxPaiement || 0),
    }));
    list.sort((a, b) => b.totalTTC - a.totalTTC);
    const max = Math.max(...list.map((r) => r.totalTTC), 1);
    return list.map((r) => ({ ...r, pctBar: (r.totalTTC / max) * 100 }));
  }, [clients]);

  const displayRows = useMemo(() => {
    const copy = [...rowsByCa];
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
  }, [rowsByCa, sortBy]);

  const totalCa = rowsByCa.reduce((s, r) => s + r.totalTTC, 0);
  const top = rowsByCa[0];
  const topShare = totalCa > 0 && top ? (top.totalTTC / totalCa) * 100 : 0;

  function toggleSort(key) {
    setSortBy((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }
    );
  }

  const SortTh = ({ label, sortKey, align = "left" }) => {
    const active = sortBy.key === sortKey;
    return (
      <th
        className={`cursor-pointer select-none px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
          align === "right" ? "text-right" : "text-left"
        }`}
        style={{ color: active ? ACCENT : "var(--text-muted)" }}
        onClick={() => toggleSort(sortKey)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="text-[9px] opacity-70">
            {active ? (sortBy.dir === "desc" ? "↓" : "↑") : "↕"}
          </span>
        </span>
      </th>
    );
  };

  return (
    <ChartCard
      loading={loading}
      loadingHeight="h-64"
      icon={Users}
      title="Top clients"
      subtitle={
        top
          ? `Leader : ${top.nom} — ${topShare.toFixed(0)}% du CA période`
          : "Performance commerciale par client"
      }
      filters={
        top ? (
          <div
            className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5"
            style={{
              borderColor: `color-mix(in srgb, ${ACCENT} 35%, var(--border-default))`,
              background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
            }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ background: `linear-gradient(145deg, ${ACCENT}, ${CYAN})` }}
            >
              {initials(top.nom)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {top.nom}
              </p>
              <p className="text-[10px] tabular-nums" style={{ color: ACCENT }}>
                {formatMoney(top.totalTTC)}
              </p>
            </div>
          </div>
        ) : null
      }
    >
      {!displayRows.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ShoppingBag className="mb-2 h-8 w-8" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucune vente sur la période.
          </p>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-2xl border"
          style={{
            borderColor: "var(--border-default)",
            background:
              "radial-gradient(ellipse 50% 80% at 100% 0%, color-mix(in srgb, #0EA5E9 10%, transparent), transparent 55%)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr style={{ background: "color-mix(in srgb, var(--bg-hover) 80%, transparent)" }}>
                  <th
                    className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Rang
                  </th>
                  <SortTh label="Client" sortKey="nom" />
                  <SortTh label="CA TTC" sortKey="totalTTC" align="right" />
                  <SortTh label="Cmd." sortKey="nbVentes" align="right" />
                  <SortTh label="Paiement" sortKey="tauxPaiement" align="right" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {displayRows.map((c, i) => {
                    const color = avatarTone(c.nom);
                    const accent = RANK_GLOW[Math.min(i, 2)] || ACCENT;
                    const share = totalCa > 0 ? (c.totalTTC / totalCa) * 100 : 0;
                    const isHot = hovered === c.clientId;

                    return (
                      <motion.tr
                        key={c.clientId ?? `${c.nom}-${i}`}
                        layout
                        initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, x: 8 }}
                        transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.35, ease: EASE }}
                        onMouseEnter={() => setHovered(c.clientId)}
                        onMouseLeave={() => setHovered(null)}
                        className="border-t transition-colors"
                        style={{
                          borderColor: "var(--border-default)",
                          background: isHot
                            ? `color-mix(in srgb, ${accent} 8%, transparent)`
                            : "transparent",
                          boxShadow: isHot ? `inset 3px 0 0 ${accent}` : undefined,
                        }}
                      >
                        <td className="px-3 py-3">
                          <RankBadge rank={i} reduceMotion={reduceMotion} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <motion.span
                              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                              style={{
                                background: `linear-gradient(145deg, ${color}, color-mix(in srgb, ${color} 65%, #0B1F3A))`,
                                boxShadow: `0 8px 18px -10px ${color}`,
                              }}
                              whileHover={reduceMotion ? undefined : { scale: 1.06, y: -2 }}
                            >
                              {initials(c.nom)}
                              {i === 0 ? (
                                <span
                                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                                  style={{
                                    background: `linear-gradient(135deg, ${ACCENT}, ${CYAN})`,
                                    boxShadow: `0 0 8px ${ACCENT}`,
                                  }}
                                >
                                  <Crown className="h-2.5 w-2.5" />
                                </span>
                              ) : null}
                            </motion.span>
                            <div className="min-w-0">
                              <p
                                className="truncate font-semibold tracking-tight"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {c.nom}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {c.nbVentes > 5 ? (
                                  <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                    style={{
                                      background: `color-mix(in srgb, ${ACCENT} 16%, transparent)`,
                                      color: ACCENT,
                                    }}
                                  >
                                    Fidèle
                                  </span>
                                ) : null}
                                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                  {share.toFixed(1)}% du CA
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p
                            className="font-mono text-sm font-bold tabular-nums"
                            style={{ color: i < 3 ? SUCCESS : "var(--text-primary)" }}
                          >
                            {formatMoney(c.totalTTC)}
                          </p>
                          <div className="mt-1.5 ml-auto w-28 max-w-full">
                            <AnimatedBar pct={c.pctBar} delay={0.05 + i * 0.04} color={accent} />
                          </div>
                        </td>
                        <td
                          className="px-3 py-3 text-right tabular-nums font-semibold"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {c.nbVentes}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <PayBadge rate={c.tauxPaiement} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
