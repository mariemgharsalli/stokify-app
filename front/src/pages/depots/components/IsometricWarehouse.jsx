import { useMemo } from "react";
import { Box, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Warehouse3DScene from "../../../components/ui/Warehouse3DScene";
import { DEPOT_ACCENT, DEPOT_CYAN } from "../depotsTheme";

function vividBar(pct) {
  if (pct < 50) return "var(--commerce-success)";
  if (pct <= 80) return "var(--commerce-warning)";
  return "var(--commerce-danger)";
}

export function IsometricLegend({ cells }) {
  const occupied = cells.filter((c) => c.stockInfo.qty > 0).length;
  const critical = cells.filter((c) => c.rate > 80).length;
  const attention = cells.filter((c) => c.rate >= 50 && c.rate <= 80).length;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border p-3.5"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, #378ADD 8%, var(--bg-card)) 0%, var(--bg-card) 55%, color-mix(in srgb, #0EA5E9 6%, var(--bg-card)) 100%)",
        borderColor: "color-mix(in srgb, #378ADD 22%, var(--border-default))",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <Sparkles size={12} style={{ color: DEPOT_CYAN }} />
        Légende 3D
      </span>

      <div className="flex items-end gap-1.5">
        {[20, 40, 60, 80, 100].map((pct, i) => (
          <div
            key={pct}
            className="flex flex-col items-center gap-0.5 animate-fadeUp"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className="rounded-t-md shadow-sm"
              style={{
                width: 14,
                height: Math.max(6, pct * 0.34),
                background: vividBar(pct),
                boxShadow: `0 4px 10px color-mix(in srgb, ${vividBar(pct)} 35%, transparent)`,
              }}
            />
            <span className="text-[8px] tabular-nums text-[var(--text-muted)]">{pct}%</span>
          </div>
        ))}
        <span className="ml-1 text-[10px] text-[var(--text-secondary)]">Volume intérieur = occupation</span>
      </div>

      {[
        { color: "var(--commerce-success)", label: "< 50% — Normal" },
        { color: "var(--commerce-warning)", label: "50–80% — Attention" },
        { color: "var(--commerce-danger)", label: "> 80% — Critique" },
        { color: "#0B1F3A", label: "Quai" },
        { color: "#EAB308", label: "Allée" },
        { color: "var(--bg-input)", label: "Vide", border: true },
      ].map((l) => (
        <span
          key={l.label}
          className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
        >
          <span
            className="h-3.5 w-3.5 rounded-md shadow-sm"
            style={{
              background: l.color,
              border: l.border ? "1px solid var(--border-default)" : "none",
            }}
          />
          {l.label}
        </span>
      ))}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
          {occupied}/{cells.length} occupés
        </span>
        {attention > 0 && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--warning-bg)", color: "var(--accent-warning)" }}
          >
            {attention} attention
          </span>
        )}
        {critical > 0 && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "var(--danger-bg, var(--warning-bg))", color: "var(--commerce-danger)" }}
          >
            {critical} critiques
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function IsometricWarehouse({
  cells,
  highlightId,
  selected,
  hoveredId,
  setSelected,
  setHovered,
  scale,
  onZoomChange,
  sceneHeight = 800,
  layoutHints = null,
}) {
  const reduceMotion = useReducedMotion();

  const emplacements = useMemo(
    () =>
      cells.map(({ em, row, col, rate, stockInfo }) => ({
        id: em.id,
        code: em.code,
        libelle: em.libelle,
        col,
        row,
        occupationRatio: rate,
        stockQty: stockInfo.qty,
        zoneDangereuse: em.zoneDangereuse,
      })),
    [cells]
  );

  const highlightedIds = useMemo(() => (highlightId ? [highlightId] : []), [highlightId]);

  const stats = useMemo(() => {
    const occupied = cells.filter((c) => c.stockInfo.qty > 0).length;
    const avg =
      cells.length > 0
        ? cells.reduce((s, c) => s + (Number(c.rate) || 0), 0) / cells.length
        : 0;
    return { occupied, avg: Math.round(avg), total: cells.length };
  }, [cells]);

  if (!cells.length) {
    return (
      <p className="py-12 text-center text-sm text-[var(--text-muted)]">
        Aucun emplacement à afficher
      </p>
    );
  }

  return (
    <div className="relative z-[1] space-y-3">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border px-4 py-3.5"
        style={{
          borderColor: "color-mix(in srgb, #378ADD 25%, var(--border-default))",
          background:
            "linear-gradient(135deg, color-mix(in srgb, #0B1F3A 88%, #378ADD), #0B1F3A)",
          boxShadow: "0 14px 32px -18px rgba(11, 31, 58, 0.5)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15"
            style={{
              background: `linear-gradient(145deg, ${DEPOT_ACCENT}, ${DEPOT_CYAN})`,
              color: "#fff",
            }}
          >
            <Box size={18} />
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Jumeau 3D — cages de capacité</h3>
            <p className="text-xs text-white/55">
              Cage = volume max · remplissage intérieur = occupation réelle
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] tabular-nums text-white/85">
            {stats.occupied}/{stats.total} actifs
          </span>
          <span
            className="rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums text-white"
            style={{ background: "rgba(14,165,233,0.28)" }}
          >
            Occup. moy. {stats.avg}%
          </span>
        </div>
      </motion.div>

      <Warehouse3DScene
        emplacements={emplacements}
        highlightedIds={highlightedIds}
        selectedId={selected?.id ?? null}
        hoveredId={hoveredId}
        zoom={scale}
        onZoomChange={onZoomChange}
        autoRotateDefault
        sceneHeight={sceneHeight}
        layoutHints={layoutHints}
        onSelect={(empl) => {
          const match = cells.find((c) => c.em.id === empl.id)?.em;
          if (!match) return;
          setSelected((s) => (s?.id === match.id ? null : match));
        }}
        onHover={(empl) => {
          if (!empl) {
            setHovered(null);
            return;
          }
          const match = cells.find((c) => c.em.id === empl.id)?.em;
          setHovered(match ?? null);
        }}
        renderTooltip={(empl) => {
          const cell = cells.find((c) => c.em.id === empl.id);
          if (!cell) return null;
          const { stockInfo, rate } = cell;
          const barColor = vividBar(rate);
          return (
            <>
              <p className="font-mono text-xs font-semibold text-white">{empl.code}</p>
              {empl.libelle && (
                <p className="mt-0.5 text-[11px] text-sky-100/70">{empl.libelle}</p>
              )}
              <p className="mt-1 text-[11px] text-sky-100/80">
                {stockInfo.qty > 0
                  ? `${stockInfo.qty.toLocaleString("fr-FR")} unités · ${rate.toFixed(0)}%`
                  : "Emplacement vide"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, rate)}%`, background: barColor }}
                />
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
