import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
} from "lucide-react";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  danger: "#E24B4A",
};

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Fond clair et lisible selon l’intensité des mouvements */
function heatBackground(total, max) {
  if (!total || !max) return "var(--bg-input)";
  const t = Math.min(1, total / max);
  if (t < 0.25) return "color-mix(in srgb, #378ADD 12%, var(--bg-card))";
  if (t < 0.5) return "color-mix(in srgb, #378ADD 22%, var(--bg-card))";
  if (t < 0.75) return "color-mix(in srgb, #0EA5E9 28%, var(--bg-card))";
  return "color-mix(in srgb, #0EA5E9 38%, var(--bg-card))";
}

function typeMeta(type) {
  const t = String(type || "");
  if (t.includes("ENTREE")) {
    return { label: t, color: THEME.success, bg: "rgba(29,158,117,0.14)", Icon: ArrowDownLeft };
  }
  if (t === "TRANSFERT") {
    return { label: t, color: THEME.accent, bg: "rgba(55,138,221,0.14)", Icon: ArrowLeftRight };
  }
  return { label: t, color: THEME.danger, bg: "rgba(226,75,74,0.14)", Icon: ArrowUpRight };
}

function KpiPill({ label, value, color, Icon }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-xl border bg-[var(--bg-card)] px-3 py-2.5"
      style={{ borderColor: "var(--border-default)" }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}18`, color }}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="text-lg font-bold tabular-nums leading-tight text-[var(--text-primary)]">
          {Number(value || 0).toLocaleString("fr-FR")}
        </p>
      </div>
    </div>
  );
}

function DayDetailPanel({ date, open, onClose }) {
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const dayStr = date ? date.toISOString().slice(0, 10) : "";

  const { data, isLoading } = useQuery({
    queryKey: ["mouvements-day", societeScope, dayStr],
    queryFn: () =>
      api
        .get("mouvements", {
          params: { from: dayStr, to: dayStr, limit: 100 },
        })
        .then((r) => r.data),
    enabled: open && Boolean(dayStr),
  });

  const items = data?.items || data || [];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && date ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            role="presentation"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border-default)] bg-[var(--bg-modal)] shadow-2xl"
            aria-label={`Mouvements du ${date.toLocaleDateString("fr-FR")}`}
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] px-4 py-4">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Détail journée</p>
                <h3 className="mt-0.5 text-base font-semibold capitalize text-[var(--text-primary)]">
                  {date.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {isLoading
                    ? "Chargement…"
                    : `${items.length} mouvement${items.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--border-default)] p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--bg-hover)]" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-default)] px-4 py-12 text-center">
                  <Package className="mx-auto h-10 w-10 text-[var(--text-muted)] opacity-50" />
                  <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
                    Aucun mouvement ce jour
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((m, i) => {
                    const meta = typeMeta(m.type);
                    const Icon = meta.Icon;
                    return (
                      <motion.li
                        key={m.id}
                        className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3"
                        style={{ borderLeft: `3px solid ${meta.color}` }}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                              {m.article?.libelle || m.article?.code || "—"}
                            </p>
                            {m.article?.code ? (
                              <p className="font-mono text-xs text-[#378ADD]">{m.article.code}</p>
                            ) : null}
                          </div>
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            <Icon className="h-3 w-3" aria-hidden />
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          Qté{" "}
                          <strong className="tabular-nums text-[var(--text-primary)]">
                            {Number(m.quantite).toLocaleString("fr-FR")}
                          </strong>
                          {" · "}
                          {m.depot?.libelle || "—"}
                          {m.depotDest ? ` → ${m.depotDest.libelle}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {m.utilisateur
                            ? `${m.utilisateur.prenom || ""} ${m.utilisateur.nom || ""}`.trim()
                            : "—"}
                        </p>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default function StockCalendarView() {
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [slideDir, setSlideDir] = useState(0);
  const today = useMemo(() => new Date(), []);

  const month = monthKey(cursor);
  const { data: days = [], isLoading } = useQuery({
    queryKey: ["stock-calendar", societeScope, month],
    queryFn: () => api.get("stock/calendar", { params: { month } }).then((r) => r.data),
  });

  const dayMap = useMemo(() => {
    const m = new Map();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const maxTotal = useMemo(() => Math.max(0, ...days.map((d) => d.total || 0)), [days]);

  const monthStats = useMemo(() => {
    let entrees = 0;
    let sorties = 0;
    let total = 0;
    let activeDays = 0;
    for (const d of days) {
      entrees += Number(d.entrees) || 0;
      sorties += Number(d.sorties) || 0;
      total += Number(d.total) || 0;
      if ((d.total || 0) > 0) activeDays += 1;
    }
    return { entrees, sorties, total, activeDays };
  }, [days]);

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const mon = cursor.getMonth();
    const first = new Date(year, mon, 1);
    const lastDay = new Date(year, mon + 1, 0).getDate();
    let startPad = first.getDay() - 1;
    if (startPad < 0) startPad = 6;
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(year, mon, d);
      const key = `${year}-${String(mon + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ date: dt, stats: dayMap.get(key) || { entrees: 0, sorties: 0, total: 0 } });
    }
    return cells;
  }, [cursor, dayMap]);

  function prevMonth() {
    setSlideDir(-1);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }

  function nextMonth() {
    setSlideDir(1);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  function goToday() {
    setSlideDir(0);
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today);
  }

  const rows = [];
  for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));

  return (
    <motion.div
      className="space-y-4"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Navigation claire */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "color-mix(in srgb, #378ADD 16%, var(--bg-input))", color: THEME.accent }}
          >
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Calendrier des mouvements</p>
            <h3 className="text-base font-semibold capitalize text-[var(--text-primary)]">
              {cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[#378ADD] hover:bg-[var(--bg-hover)]"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg border border-[var(--border-default)] p-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg border border-[var(--border-default)] p-2 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPIs lisibles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiPill label="Entrées" value={monthStats.entrees} color={THEME.success} Icon={ArrowDownLeft} />
        <KpiPill label="Sorties" value={monthStats.sorties} color={THEME.danger} Icon={ArrowUpRight} />
        <KpiPill label="Mouvements" value={monthStats.total} color={THEME.accent} Icon={ArrowLeftRight} />
        <KpiPill label="Jours actifs" value={monthStats.activeDays} color={THEME.cyan} Icon={CalendarDays} />
      </div>

      {/* Grille */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-card)] sm:p-4">
        <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-[var(--text-secondary)]">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1.5">
              {w}
            </span>
          ))}
        </div>

        <AnimatePresence mode="wait" custom={slideDir}>
          <motion.div
            key={month}
            initial={reduceMotion ? false : { opacity: 0, x: slideDir * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: slideDir * -20 }}
            transition={{ duration: 0.22 }}
            className="space-y-1.5"
          >
            {isLoading ? (
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="min-h-[78px] animate-pulse rounded-xl bg-[var(--bg-hover)]" />
                ))}
              </div>
            ) : (
              rows.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7 gap-1.5">
                  {row.map((cell, ci) => {
                    if (!cell) return <div key={`e-${ri}-${ci}`} className="min-h-[78px]" />;

                    const isToday = sameDay(cell.date, today);
                    const isSelected = sameDay(cell.date, selectedDay);
                    const e = Number(cell.stats.entrees) || 0;
                    const s = Number(cell.stats.sorties) || 0;
                    const total = Number(cell.stats.total) || 0;

                    return (
                      <motion.button
                        key={cell.date.toISOString()}
                        type="button"
                        title={`${e} entrée(s), ${s} sortie(s) — cliquer pour le détail`}
                        onClick={() => setSelectedDay(cell.date)}
                        className="flex min-h-[78px] flex-col rounded-xl border p-2 text-left transition hover:border-[#378ADD]/60 hover:shadow-md"
                        style={{
                          background: heatBackground(total, maxTotal),
                          borderColor: isSelected
                            ? THEME.cyan
                            : isToday
                              ? THEME.accent
                              : "var(--border-default)",
                          borderWidth: isSelected || isToday ? 2 : 1,
                          boxShadow: isSelected
                            ? `0 0 0 3px color-mix(in srgb, ${THEME.cyan} 25%, transparent)`
                            : undefined,
                        }}
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-sm font-bold tabular-nums ${
                              isToday ? "text-white" : "text-[var(--text-primary)]"
                            }`}
                            style={
                              isToday
                                ? { background: THEME.accent }
                                : undefined
                            }
                          >
                            {cell.date.getDate()}
                          </span>
                          {total > 0 ? (
                            <span className="rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--text-primary)] shadow-sm">
                              {total}
                            </span>
                          ) : null}
                        </div>

                        {total > 0 ? (
                          <div className="mt-auto space-y-0.5 pt-1.5 text-[10px] font-medium leading-tight">
                            {e > 0 ? (
                              <p className="tabular-nums" style={{ color: THEME.success }}>
                                +{e} entr.
                              </p>
                            ) : null}
                            {s > 0 ? (
                              <p className="tabular-nums" style={{ color: THEME.danger }}>
                                −{s} sort.
                              </p>
                            ) : null}
                            {e === 0 && s === 0 ? (
                              <p className="text-[var(--text-muted)]">{total} mvt</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-auto pt-2 text-[10px] text-[var(--text-muted)] opacity-50">
                            —
                          </p>
                        )}
                      </motion.button>
                    );
                  })}
                  {row.length < 7
                    ? Array.from({ length: 7 - row.length }).map((_, i) => (
                        <div key={`p-${ri}-${i}`} className="min-h-[78px]" />
                      ))
                    : null}
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-3 text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap gap-4">
            <span>
              <strong style={{ color: THEME.success }}>+ Entrées</strong>
            </span>
            <span>
              <strong style={{ color: THEME.danger }}>− Sorties</strong>
            </span>
            <span>
              Badge <strong className="text-[var(--text-primary)]">N</strong> = total du jour
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Peu</span>
            <div className="flex overflow-hidden rounded border border-[var(--border-default)]">
              {[12, 22, 28, 38].map((p) => (
                <span
                  key={p}
                  className="h-3.5 w-5"
                  style={{ background: `color-mix(in srgb, #378ADD ${p}%, var(--bg-card))` }}
                />
              ))}
            </div>
            <span>Beaucoup</span>
          </div>
        </div>
      </div>

      <DayDetailPanel
        date={selectedDay}
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
      />
    </motion.div>
  );
}
