import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Box,
  Hourglass,
  LayoutGrid,
  MessageSquare,
  Radar,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { BRAINS, FADE_UP, IA, surfaceStyle, toneColor } from "../moduleIaTheme";

const ICONS = {
  forecast: TrendingUp,
  anomalies: ShieldAlert,
  expiry: Hourglass,
  slotting: LayoutGrid,
  load: Box,
  llm: MessageSquare,
};

const STATUS_META = {
  live: { label: "Live", color: IA.accent },
  fallback: { label: "Local", color: IA.yellow },
  offline: { label: "Off", color: IA.red },
};

function pickStack(stack, id) {
  return (stack || []).find((s) => s.id === id) || null;
}

function buildBrainViews({ commandCenter, kpis, prevision, anomalies, optimisation, insights, meta, expiryWaste }) {
  const stack = commandCenter?.stack || [];
  const coverage = commandCenter?.coverage || {};
  const products = prevision?.produits || [];
  const topProduct = products[0];
  const avgConf = Number(kpis?.confianceMoyenne ?? meta?.confianceMoyenne ?? 0);
  const anomalyCount = (anomalies || []).length;
  const highAnomalies = (anomalies || []).filter((a) => a.severite === "elevee").length;
  const groq = meta?.groqConfigured !== false && pickStack(stack, "llm")?.status !== "offline";

  return BRAINS.map((brain) => {
    const item = pickStack(stack, brain.id);
    const status = item?.status || (commandCenter?.runtime === "deep" ? "live" : "fallback");
    const statusMeta = STATUS_META[status] || STATUS_META.fallback;

    if (brain.id === "forecast") {
      return {
        ...brain,
        status,
        statusMeta,
        model: item?.model || "N-BEATS + Holt-Winters",
        kpi: `${products.length || kpis?.previsions || 0} SKU`,
        confidence: avgConf || null,
        result: topProduct
          ? `${topProduct.nom || topProduct.libelle || "Article"} · tendance ${topProduct.tendance || "stable"}`
          : `${kpis?.previsions || 0} article(s) modélisé(s)`,
        reco:
          avgConf && avgConf < 55
            ? "Plusieurs prévisions peu fiables — enrichir l’historique de ventes."
            : "S’appuyer sur le stock P90 pour le réappro, pas sur la moyenne seule.",
      };
    }

    if (brain.id === "anomalies") {
      return {
        ...brain,
        status,
        statusMeta,
        model: item?.model || "IF + LOF + autoencodeur",
        kpi: `${anomalyCount} signal(s)`,
        confidence: null,
        result:
          anomalyCount === 0
            ? "Aucun signal ouvert sur la fenêtre."
            : `${highAnomalies} critique(s) · ${anomalyCount - highAnomalies} autre(s)`,
        reco:
          anomalyCount === 0
            ? "Maintenir la veille. Le cron tourne 03:00 / 15:00."
            : "Traiter d’abord les scores élevés, puis confirmer ou marquer normal.",
      };
    }

    if (brain.id === "expiry") {
      const ek = expiryWaste?.kpis || {};
      const top = (expiryWaste?.top || [])[0];
      const atRisk = Number(ek.lotsARisque || commandCenter?.coverage?.expiryAtRisk || 0);
      const valeur = Math.round(Number(ek.valeurPredite || commandCenter?.coverage?.expiryValue || 0));
      return {
        ...brain,
        status,
        statusMeta,
        model: item?.model || "Runway DLC v1.1",
        kpi: atRisk ? `${atRisk} lot(s)` : "0 lot",
        confidence: null,
        result: top
          ? `${top.articleLibelle || top.numero} · ${Math.round(top.qtePrediteDlc || 0)} u. / ${Math.round(top.valeurPredite || 0)} TND`
          : atRisk
            ? `${valeur} TND de valeur prévue à la DLC`
            : "Aucun lot DLC restant à risque sur le stock vivant.",
        reco: atRisk
          ? "Prioriser FEFO / promo. L’IA n’écrit pas le stock."
          : "Maintenir FEFO. Le score se recalcule à chaque ouverture.",
      };
    }

    if (brain.id === "slotting") {
      const transfers = (optimisation?.recommandations || []).filter(
        (r) => r.type === "transferer" && !r.applied
      ).length;
      return {
        ...brain,
        status,
        statusMeta,
        model: item?.model || "GMM 3 classes",
        kpi: `${coverage.depots ?? "—"} dépôt(s)`,
        confidence: null,
        result: item?.metric || "ABC près du quai",
        reco:
          transfers > 0
            ? `${transfers} plan(s) de transfert suggéré(s) — à journaliser, pas à exécuter ici.`
            : "Ouvrir l’audit emplacements pour les SKU classe A mal slotés.",
      };
    }

    if (brain.id === "load") {
      return {
        ...brain,
        status,
        statusMeta,
        model: item?.model || "HAC + HGB Pareto",
        kpi: item?.metric || "3D LIFO",
        confidence: null,
        result: "Plan de soute + tournée GPS disponibles dans le studio chargement.",
        reco: "Lancer une optimisation sur les livraisons du jour avant le quai.",
      };
    }

    const insightN = (insights || []).length;
    return {
      ...brain,
      status: groq ? "live" : item?.status || "offline",
      statusMeta: groq ? STATUS_META.live : STATUS_META[item?.status] || STATUS_META.offline,
      model: item?.model || (groq ? "Groq · STOKI / STELLA" : "Non configuré"),
      kpi: `${insightN} insight(s)`,
      confidence: null,
      result: groq
        ? "Assistant magasin (STOKI) et conseillère B2B (STELLA) opérationnels."
        : "Clé Groq absente — réponses d’intent locales uniquement.",
      reco: groq
        ? "Poser une question stock à STOKI, ou ouvrir les insights pour le briefing."
        : "Configurer GROQ_API_KEY pour activer le LLM. Les intents restent disponibles.",
      openChat: true,
    };
  });
}

function BrainCard({ brain, selected, onSelect, reduceMotion }) {
  const Icon = ICONS[brain.id] || Radar;
  const color = brain.statusMeta.color;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(brain.id)}
      aria-pressed={selected}
      className="relative min-w-0 overflow-hidden px-3.5 py-3.5 text-left"
      style={{
        background: selected ? IA.accentDim : IA.panel,
        border: `1px solid ${selected ? IA.borderStrong : IA.border}`,
        borderRadius: 14,
      }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
    >
      {selected ? (
        <motion.span
          layoutId="radar-brain-accent"
          className="absolute inset-x-3 top-0 h-[2px] rounded-full"
          style={{ background: IA.accent }}
        />
      ) : null}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}18`, color }}
        >
          <Icon size={16} />
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase"
          style={{ background: `${color}18`, color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          {brain.statusMeta.label}
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: IA.muted }}>
        {brain.name}
      </p>
      <p className="mt-0.5 text-[13px] font-bold" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
        {brain.title}
      </p>
      <p className="mt-1 font-mono text-[10px] tabular-nums" style={{ color }}>
        {brain.kpi}
        {typeof brain.confidence === "number" ? ` · ${brain.confidence}% conf.` : ""}
      </p>
    </motion.button>
  );
}

export default function ModuleIARadar({
  commandCenter,
  kpis,
  prevision,
  anomalies,
  optimisation,
  insights,
  meta,
  expiryWaste,
  onNavigate,
}) {
  const reduceMotion = useReducedMotion();
  const brains = useMemo(
    () =>
      buildBrainViews({
        commandCenter,
        kpis,
        prevision,
        anomalies,
        optimisation,
        insights,
        meta,
        expiryWaste,
      }),
    [commandCenter, kpis, prevision, anomalies, optimisation, insights, meta, expiryWaste]
  );

  const defaultId =
    brains.find((b) => b.id === "expiry" && (expiryWaste?.kpis?.lotsARisque || 0) > 0)?.id ||
    brains.find((b) => b.id === "anomalies" && (anomalies || []).length)?.id ||
    "forecast";
  const [selectedId, setSelectedId] = useState(null);
  const selected = brains.find((b) => b.id === (selectedId || defaultId)) || brains[0];
  const color = selected?.statusMeta?.color || IA.accent;
  const pulseColor = toneColor(commandCenter?.pulse?.tone);

  if (!selected) return null;

  return (
    <motion.section variants={FADE_UP} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p
            className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: pulseColor }}
          >
            <Radar size={12} /> Radar IA · 6 cerveaux
          </p>
          <h3 className="text-base font-extrabold sm:text-lg" style={{ fontFamily: IA.fontTitle }}>
            Cockpit des modèles
          </h3>
        </div>
        <p className="max-w-md text-right text-[11px] leading-relaxed" style={{ color: IA.muted }}>
          Sélectionnez un cerveau : rôle, état, résultat, recommandation. Rien n’est exécuté tant que
          vous n’ouvrez pas le module.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {brains.map((brain) => (
          <BrainCard
            key={brain.id}
            brain={brain}
            selected={brain.id === selected.id}
            onSelect={setSelectedId}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>

      <div className="rounded-2xl p-4 sm:p-5" style={surfaceStyle({ background: IA.panel })}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: `${color}22`, color }}
              >
                {selected.name}
              </span>
              <span className="text-[11px]" style={{ color: IA.muted }}>
                {selected.model}
              </span>
            </div>
            <p className="text-sm font-semibold" style={{ color: IA.text }}>
              {selected.role}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: IA.textSecondary }}>
              {selected.explain}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
              >
                <dt className="text-[10px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
                  Résultat
                </dt>
                <dd className="mt-1 text-[12px] leading-snug" style={{ color: IA.text }}>
                  {selected.result}
                </dd>
              </div>
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
              >
                <dt className="text-[10px] font-bold uppercase tracking-wider" style={{ color: IA.muted }}>
                  Recommandation
                </dt>
                <dd className="mt-1 text-[12px] leading-snug" style={{ color: IA.text }}>
                  {selected.reco}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col justify-between gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-xl px-3 py-3"
                style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
              >
                <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                  Indicateur
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums" style={{ color }}>
                  {selected.kpi}
                </p>
              </div>
              <div
                className="rounded-xl px-3 py-3"
                style={{ background: IA.fill, border: `1px solid ${IA.border}` }}
              >
                <p className="text-[10px] font-bold uppercase" style={{ color: IA.muted }}>
                  Confiance
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums" style={{ color: IA.text }}>
                  {typeof selected.confidence === "number" ? `${selected.confidence}%` : "—"}
                </p>
                <p className="mt-0.5 text-[10px]" style={{ color: IA.muted }}>
                  {typeof selected.confidence === "number" ? "MAPE holdout" : "Non exposée ici"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <motion.button
                type="button"
                onClick={() => onNavigate?.(selected.tab)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
                style={{
                  background: IA.accentDim,
                  color: IA.accent,
                  border: `1px solid ${IA.borderStrong}`,
                }}
                whileHover={reduceMotion ? undefined : { y: -1 }}
              >
                Ouvrir le module
                <ArrowRight size={13} />
              </motion.button>
              {selected.openChat ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("stokify:open-stoki"))}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold"
                  style={{
                    background: IA.fill,
                    color: IA.textSecondary,
                    border: `1px solid ${IA.border}`,
                  }}
                >
                  <MessageSquare size={13} />
                  Parler à STOKI
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
