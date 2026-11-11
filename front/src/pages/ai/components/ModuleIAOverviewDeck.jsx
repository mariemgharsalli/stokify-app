import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  ArrowRight,
  Box,
  Hourglass,
  LayoutGrid,
  Lightbulb,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Truck,
  Warehouse,
} from "lucide-react";
import { useLandingLang } from "../../landing/LandingLangContext";
import { BRAINS, FADE_UP, IA, STAGGER, surfaceStyle, tabMeta } from "../moduleIaTheme";
import { HudFrame, Kicker } from "./ModuleIAHud";

const DETAIL_CYAN = "#0EA5E9";

const SEV = { elevee: IA.red, moyenne: IA.yellow, faible: IA.muted };
const TYPE_COLOR = {
  opportunite: DETAIL_CYAN,
  risque: IA.red,
  tendance: IA.blue,
};

function OpenChip({ label, color = IA.accent }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
    >
      {label} <ArrowRight size={12} />
    </span>
  );
}

function ForecastPane({ prevision, kpis, onNavigate, t }) {
  const reduceMotion = useReducedMotion();
  const chart = (prevision?.data || []).slice(-18).map((row, i) => ({
    ...row,
    i,
    y: Number(row.prevision ?? row.reel) || 0,
  }));
  const top = (prevision?.produits || []).slice(0, 3);
  const conf = Number(kpis?.confianceMoyenne) || 0;
  const color = tabMeta("prevision").color;

  return (
    <HudFrame
      as={motion.button}
      type="button"
      color={color}
      onClick={() => onNavigate?.("prevision")}
      variants={FADE_UP}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="ia-pane h-full w-full p-5 text-left"
      style={{
        ...surfaceStyle({
          background: `radial-gradient(ellipse 80% 70% at 0% 0%, color-mix(in srgb, var(--accent-success) 16%, transparent), transparent 55%), ${IA.bgCard}`,
        }),
        "--pane": "#0EA5E9",
      }}
    >
      <span className="ia-pane__sheen" aria-hidden />
      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Kicker color={color} icon={TrendingUp} live>
              {t.aiStoryForecastTitle}
            </Kicker>
            <h3 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: IA.fontTitle }}>
              {t.aiKpiForecast}
            </h3>
            <p className="mt-0.5 text-[12px]" style={{ color: IA.textSecondary }}>
              {t.aiKpiForecastHint}
              {conf ? ` · ${conf}%` : ""}
            </p>
          </div>
          <OpenChip label={t.aiOpenDetail} color={color} />
        </div>

        <div className="ia-pane__chart">
          {chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ovForecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="y" stroke="#0EA5E9" strokeWidth={2.2} fill="url(#ovForecastFill)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-[12px]" style={{ color: IA.muted }}>
              Pas encore de série prévisionnelle.
            </div>
          )}
        </div>

        <ul className="ia-rank">
          {top.length === 0 ? (
            <li className="text-[12px]" style={{ color: IA.muted }}>
              Ouvrir le module pour lancer une prévision.
            </li>
          ) : (
            top.map((p, i) => {
              const trend = Number(p.tendance) || 0;
              const tone = trend > 0 ? IA.accent : trend < 0 ? IA.red : IA.muted;
              return (
                <li key={p.id || `${p.nom}-${i}`} className="ia-rank__item">
                  <span className="ia-rank__n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="ia-rank__name">{p.nom || p.libelle}</span>
                  <span className="ia-rank__val" style={{ color: tone }}>
                    {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.round(p.prevision4sem || 0)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </HudFrame>
  );
}

const SEV_LABEL = { elevee: "Élevée", moyenne: "Moyenne", faible: "Faible" };
const RECO_LABEL = {
  reapprovisionner: "Réappro",
  transferer: "Transfert",
  reduire: "Réduire",
  surveiller: "Veille",
};

const ENGINE_ICONS = {
  forecast: TrendingUp,
  anomalies: ShieldAlert,
  expiry: Hourglass,
  slotting: LayoutGrid,
  load: Truck,
  llm: MessageSquare,
};

function buildQueue({ anomalies = [], expiryWaste, optimisation }) {
  const items = [];

  for (const anomaly of anomalies) {
    const severity = anomaly.severite === "elevee" ? 92 : anomaly.severite === "moyenne" ? 64 : 38;
    items.push({
      id: `a-${anomaly.id ?? anomaly.titre}`,
      tab: "anomalies",
      kind: "Anomalie",
      title: anomaly.produit || anomaly.titre || "Signal",
      meta: anomaly.depot || anomaly.titre || "Stock",
      tag: SEV_LABEL[anomaly.severite] || "Signal",
      score: severity + Math.min(8, Number(anomaly.score) || 0) / 10,
      color: SEV[anomaly.severite] || IA.muted,
    });
  }

  for (const lot of (expiryWaste?.top || []).slice(0, 4)) {
    const critical = lot.band === "critique" || lot.priorite === "haute" || Number(lot.joursRestants) <= 7;
    items.push({
      id: `e-${lot.lotId || lot.numero || lot.articleLibelle}`,
      tab: "peremption",
      kind: "Péremption",
      title: lot.articleLibelle || lot.numero || "Lot",
      meta: lot.depotLibelle
        ? `${lot.depotLibelle} · ${Math.round(Number(lot.qtePrediteDlc) || 0)} u. à la DLC`
        : `${Math.round(Number(lot.qtePrediteDlc) || 0)} u. prévues invendues`,
      tag: critical ? "DLC" : "FEFO",
      score: critical ? 86 : 58,
      color: tabMeta("peremption").color,
    });
  }

  for (const reco of (optimisation?.recommandations || []).filter((row) => !row.applied).slice(0, 6)) {
    const urgent = reco.priorite === "urgent" ? 88 : reco.priorite === "normal" ? 52 : 28;
    items.push({
      id: `r-${reco.fingerprint || reco.id}`,
      tab: "optimisation",
      kind: "Décision",
      title: reco.produit || reco.titre || "Action",
      meta: reco.depotNom || reco.titre || "Plan à journaliser",
      tag: RECO_LABEL[reco.type] || "Veille",
      score: urgent,
      color: tabMeta("optimisation").color,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, 6);
}

function PriorityPane({ items, onNavigate, t }) {
  const reduceMotion = useReducedMotion();
  const color = IA.accent;

  return (
    <HudFrame
      color={color}
      variants={FADE_UP}
      className="ia-pane h-full w-full p-5 text-left"
      style={{
        ...surfaceStyle({
          background: `radial-gradient(ellipse 80% 50% at 100% 0%, color-mix(in srgb, var(--accent-primary) 12%, transparent), transparent 55%), ${IA.bgCard}`,
        }),
        "--pane": color,
      }}
    >
      <div className="relative z-[1] flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Kicker color={color} icon={Sparkles} live={items.length > 0}>
              File du jour
            </Kicker>
            <h3 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: IA.fontTitle }}>
              {items.length ? "Ce qui demande une décision" : "Rien d’urgent"}
            </h3>
            <p className="mt-0.5 text-[12px]" style={{ color: IA.textSecondary }}>
              Anomalies, lots à DLC et plans de stock, classés par urgence.
            </p>
          </div>
        </div>

        <ul className="ia-queue">
          {items.length === 0 ? (
            <li className="ia-queue__empty">Le magasin est calme sur cette période.</li>
          ) : (
            items.map((item, index) => (
              <motion.li key={item.id} whileHover={reduceMotion ? undefined : { x: 2 }}>
                <button type="button" className="ia-queue__item" onClick={() => onNavigate?.(item.tab)}>
                  <span className="ia-queue__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="ia-queue__body">
                    <span className="ia-queue__kind" style={{ color: item.color }}>
                      {item.kind}
                    </span>
                    <span className="ia-queue__title">{item.title}</span>
                    <span className="ia-queue__meta">{item.meta}</span>
                  </span>
                  <span className="ia-queue__tag" style={{ color: item.color }}>
                    {item.tag}
                  </span>
                </button>
              </motion.li>
            ))
          )}
        </ul>
        <p className="mt-auto pt-3 text-[11px]" style={{ color: IA.muted }}>
          {t.aiOpenDetail} ouvre le module. Aucun mouvement n’est lancé ici.
        </p>
      </div>
    </HudFrame>
  );
}

function DepotHeat({ heat = [], onNavigate }) {
  const max = Math.max(...heat.map((row) => Number(row.score) || 0), 1);
  return (
    <HudFrame color={IA.blue} variants={FADE_UP} className="ia-pane p-5" style={surfaceStyle()}>
      <div className="relative z-[1]">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <Kicker color={IA.blue} icon={Warehouse}>
              Pression dépôts
            </Kicker>
            <h3 className="text-base font-extrabold" style={{ fontFamily: IA.fontTitle }}>
              Où le stock se tend
            </h3>
          </div>
          <button type="button" className="ia-text-link" onClick={() => onNavigate?.("optimisation")}>
            Équilibrer <ArrowRight size={12} />
          </button>
        </div>
        <ul className="ia-heat">
          {heat.map((row) => {
            const width = Math.max(6, ((Number(row.score) || 0) / max) * 100);
            const hot = (row.rupture || 0) > 0;
            return (
              <li key={row.depotId || row.depot}>
                <span className="ia-heat__name">{row.depot}</span>
                <span className="ia-heat__track">
                  <b style={{ width: `${width}%`, background: hot ? IA.red : IA.blue }} />
                </span>
                <span className="ia-heat__meta">
                  {row.rupture ? `${row.rupture} rupture` : row.critique ? `${row.critique} critique` : "stable"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </HudFrame>
  );
}

function EngineStrip({ commandCenter, onNavigate }) {
  const stack = commandCenter?.stack || [];
  const engines = BRAINS.map((brain) => {
    const live = stack.find((item) => item.id === brain.id);
    return {
      ...brain,
      metric: live?.metric || brain.title,
      model: live?.model || "",
      status: live?.status || "fallback",
    };
  });

  return (
    <motion.div variants={FADE_UP} className="ia-engines">
      <div className="ia-engines__head">
        <div>
          <Kicker color={IA.accent} icon={Box}>
            Atelier
          </Kicker>
          <h3 className="text-base font-extrabold" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
            Six moteurs, un magasin
          </h3>
        </div>
        <p>Chaque moteur reste une aide. L’exécution stock reste au magasinier.</p>
      </div>
      <div className="ia-engines__grid">
        {engines.map((engine) => {
          const Icon = ENGINE_ICONS[engine.id] || Sparkles;
          const color = tabMeta(engine.tab).color;
          const statusLabel = engine.status === "live" ? "Live" : engine.status === "offline" ? "Off" : "Local";
          return (
            <button
              key={engine.id}
              type="button"
              className="ia-engine"
              style={{ "--engine": color }}
              onClick={() => onNavigate?.(engine.tab)}
            >
              <span className="ia-engine__icon">
                <Icon size={16} />
              </span>
              <span className="ia-engine__copy">
                <span className="ia-engine__title">{engine.title}</span>
                <span className="ia-engine__model">{engine.model}</span>
              </span>
              <span className="ia-engine__foot">
                <span>{engine.metric}</span>
                <em data-status={engine.status}>{statusLabel}</em>
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

function InsightsPane({ insights = [], onNavigate, t }) {
  const reduceMotion = useReducedMotion();
  const rows = insights.slice(0, 3);
  const color = tabMeta("insights").color;

  return (
    <motion.div variants={FADE_UP} className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3 mb-0 flex items-end justify-between">
        <div>
          <Kicker color={color} icon={Sparkles}>
            {t.aiStoryInsightsTitle}
          </Kicker>
          <h3 className="text-base font-extrabold" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
            Les pistes les plus utiles en ce moment
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onNavigate?.("insights")}
          className="inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: IA.accent }}
        >
          {t.aiOpenDetail} <ArrowRight size={12} />
        </button>
      </div>
      {rows.length === 0 ? (
        <HudFrame
          color={DETAIL_CYAN}
          className="sm:col-span-3 p-6 text-center"
          style={surfaceStyle()}
        >
          <p className="text-[13px]" style={{ color: IA.muted }}>
            Pas encore de recommandation sur cette période. L’IA alimente cette zone dès qu’un signal est clair.
          </p>
        </HudFrame>
      ) : (
        rows.map((ins, i) => {
          const color = TYPE_COLOR[ins.type] || DETAIL_CYAN;
          return (
            <HudFrame
              as={motion.button}
              type="button"
              key={ins.id || ins.titre || i}
              color={color}
              onClick={() => onNavigate?.(ins.cta?.tab || "insights")}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              className="ia-note p-4 text-left"
              style={surfaceStyle()}
            >
              <span className="ia-note__index" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative z-[1] pr-8">
                <span
                  className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase"
                  style={{ background: `${color}22`, color }}
                >
                  {ins.type || "ops"}
                </span>
                <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-snug" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
                  {ins.titre}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed" style={{ color: IA.textSecondary }}>
                  {ins.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold" style={{ color }}>
                  <Lightbulb size={12} /> {ins.cta?.label || "Explorer"}
                </div>
              </div>
            </HudFrame>
          );
        })
      )}
    </motion.div>
  );
}

export default function ModuleIAOverviewDeck({
  kpis,
  prevision,
  anomalies,
  optimisation,
  insights,
  expiryWaste,
  commandCenter,
  onNavigate,
}) {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const queue = useMemo(
    () => buildQueue({ anomalies, expiryWaste, optimisation }),
    [anomalies, expiryWaste, optimisation]
  );
  const heat = (commandCenter?.heat || []).filter((row) => (row.positions || row.rupture || row.critique) > 0).slice(0, 5);
  const liveCount = queue.length;

  return (
    <motion.section
      className="space-y-4"
      variants={STAGGER}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      <motion.header variants={FADE_UP} className="ia-stage-head">
        <div>
          <Kicker color={IA.accent} icon={Sparkles} live>
            Lecture
          </Kicker>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ fontFamily: IA.fontTitle, color: IA.text }}>
            Le magasin, en une lecture
          </h2>
          <p className="mt-1 max-w-xl text-[12px]" style={{ color: IA.textSecondary }}>
            La demande à gauche, les décisions à droite. Un clic ouvre le module — rien n’est exécuté ici.
          </p>
        </div>
        <div className="ia-stage-count">
          <strong>{liveCount}</strong>
          <span>{liveCount > 1 ? "décisions à voir" : "décision à voir"}</span>
        </div>
      </motion.header>

      <div className="ia-bento">
        <div className="ia-bento__forecast min-h-[320px]">
          <ForecastPane prevision={prevision} kpis={kpis} onNavigate={onNavigate} t={t} />
        </div>
        <div className="ia-bento__queue">
          <PriorityPane items={queue} onNavigate={onNavigate} t={t} />
        </div>
        {heat.length ? (
          <div className="ia-bento__depots">
            <DepotHeat heat={heat} onNavigate={onNavigate} />
          </div>
        ) : null}
        <div className="ia-bento__engines">
          <EngineStrip commandCenter={commandCenter} onNavigate={onNavigate} />
        </div>
        <div className="ia-bento__insights">
          <InsightsPane insights={insights} onNavigate={onNavigate} t={t} />
        </div>
      </div>
    </motion.section>
  );
}
