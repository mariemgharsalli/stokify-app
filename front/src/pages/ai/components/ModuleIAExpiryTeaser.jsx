import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hourglass } from "lucide-react";
import { FADE_UP, IA, surfaceStyle } from "../moduleIaTheme";
import { MiniSpark } from "./ModuleIAHud";

function money(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} TND`;
}

function qty(n) {
  return `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} u.`;
}

export default function ModuleIAExpiryTeaser({ data, onOpen }) {
  const reduceMotion = useReducedMotion();
  const kpis = data?.kpis || {};
  const top = (data?.top || [])[0];
  const briefing = data?.briefing;
  const color =
    kpis.lotsPerdus > 0 || kpis.lotsCritique > 0 ? IA.red : kpis.lotsARisque > 0 ? IA.yellow : IA.accent;
  if (!data) return null;
  return (
    <motion.button
      type="button"
      variants={FADE_UP}
      onClick={onOpen}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className="relative w-full overflow-hidden p-5 text-left"
      style={surfaceStyle()}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full opacity-40"
        style={{ background: `radial-gradient(circle, ${color}33, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p
            className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color }}
          >
            <Hourglass size={12} /> Péremption · runway DLC
            {kpis.lotsARisque > 0 ? (
              <span className="ai-hero-live-dot h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            ) : null}
          </p>
          <h3 className="text-lg font-extrabold" style={{ fontFamily: IA.fontTitle }}>
            {briefing?.headline ||
              (kpis.lotsARisque
                ? `${kpis.lotsARisque} lot(s) à risque · ${money(kpis.valeurPredite)}`
                : "Aucun gaspillage DLC anticipé")}
          </h3>
          <p className="mt-1 max-w-xl text-[13px]" style={{ color: IA.textSecondary }}>
            {briefing?.summary ||
              (top
                ? `${top.articleLibelle || top.numero} — ~${qty(top.qtePrediteDlc)} prévues invendues à la DLC.`
                : "Complète FEFO : il dit quel lot sortir, ce score dit s’il restera.")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {(data?.spark || []).some((v) => v > 0) ? (
            <MiniSpark values={data.spark} color={color} width={110} height={32} />
          ) : null}
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: IA.accentDim, color: IA.accent }}
          >
            Ouvrir le studio <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
