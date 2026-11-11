import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useLandingLang } from "../../../landing/LandingLangContext";
import { IA, surfaceStyle } from "../../moduleIaTheme";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n) {
  return n == null ? "—" : n.toFixed(3);
}

function MetricTable({ metrics, tx }) {
  const rows = [
    ["AUC", num(metrics.auc), null, true],
    ["Brier", num(metrics.brier), num(metrics.brierBaseline), false],
    ["MAE quantité", num(metrics.maeQty), num(metrics.maeBaseline), false],
    ["Couverture P10–P90", num(metrics.coverage), null, true],
    ["ECE", num(metrics.ece), null, false],
  ];
  return (
    <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${IA.border}` }}>
      {rows.map(([label, model, base, higherBetter]) => {
        const better = model != null && base != null ? (higherBetter ? model > base : model < base) : null;
        return (
          <div
            key={label}
            className="grid grid-cols-[1fr_auto] items-baseline gap-4 px-4 py-3"
            style={{ borderBottom: `1px solid ${IA.border}`, background: IA.panel }}
          >
            <span className="text-[13px] font-medium" style={{ color: IA.textSecondary }}>{label}</span>
            <span className="text-right">
              <span className="font-mono text-[18px] font-semibold leading-none" style={{ color: IA.text }}>{fmt(model)}</span>
              {base != null ? (
                <span className="mt-1 block font-mono text-[12px]" style={{ color: IA.muted }}>
                  {tx("Formule")} {fmt(base)}
                  <span style={{ color: better ? "var(--accent-success)" : "var(--accent-danger)" }}> {better ? "↑" : "↓"}</span>
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChartLegend({ items }) {
  return (
    <div className="mb-2 flex flex-wrap gap-3">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: IA.textSecondary }}>
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function ModelCardDrawer({ open, onClose, card }) {
  const { tx } = useLandingLang();
  const reduce = useReducedMotion();
  const model = card?.model || card || {};
  const metrics = model.metrics || {};
  const data = model.data || {};
  const real = Number(data.real) || 0;
  const synthetic = Number(data.synthetic) || 0;
  const enough = Boolean(data.realDataSufficient) && real >= 30;
  const reliability = (model.reliability || [])
    .filter((row) => row && row.pred != null && row.obs != null)
    .map((row) => ({ pred: row.pred, obs: row.obs }));
  const diagonal = [{ pred: 0, obs: 0 }, { pred: 1, obs: 1 }];
  const importance = (model.importance || []).map((row) => ({
    name: row.name,
    importance: Number(row.importance) || 0,
  }));
  const tick = { fill: "var(--text-secondary)", fontSize: 12 };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={tx("Fermer")}
            className="fixed inset-0 z-[100]"
            style={{ background: "color-mix(in srgb, var(--text-primary) 45%, transparent)" }}
            onClick={onClose}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="expiry-model-card-title"
            className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-xl flex-col"
            style={{
              ...surfaceStyle({ borderRadius: 0 }),
              boxShadow: "-20px 0 48px color-mix(in srgb, var(--text-primary) 22%, transparent)",
            }}
            initial={reduce ? false : { x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 48, opacity: 0 }}
          >
            <header
              className="flex items-start justify-between gap-4 px-6 py-5"
              style={{ borderBottom: `1px solid ${IA.border}`, background: IA.bgCard }}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: IA.muted }}>Model Card</p>
                <h2 id="expiry-model-card-title" className="mt-1 text-2xl font-bold leading-tight" style={{ color: IA.text, fontFamily: IA.fontTitle }}>
                  {tx("Carte du modèle")}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold"
                style={{ color: IA.text, border: `1px solid ${IA.border}`, background: IA.fill }}
              >
                {tx("Fermer")}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-[15px] leading-relaxed" style={{ color: IA.text }}>
                {enough
                  ? tx("Affiné sur les lots réels observés à la DLC")
                  : tx("Modèle pré-entraîné sur simulation, affiné au fil de vos lots réels")}
              </p>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-[13px]" style={{ color: IA.textSecondary }}>
                  <span>{tx("Données réelles")} {real} / 30</span>
                  <span>{synthetic.toLocaleString("fr-FR")} {tx("lots simulés")}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full" style={{ background: IA.track }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${real > 0 ? Math.max(6, Math.min(100, (real / 30) * 100)) : 0}%`, background: "var(--accent-primary)" }}
                  />
                </div>
              </div>

              <div className="mt-6">
                <MetricTable metrics={metrics} tx={tx} />
                {num(metrics.improvementPct) != null ? (
                  <p className="mt-3 text-[15px] font-semibold" style={{ color: "var(--accent-success)" }}>
                    ↑ {Math.round(metrics.improvementPct)} % {tx("contre la formule physique")}
                  </p>
                ) : null}
              </div>

              {(model.curve || []).length > 1 ? (
                <section className="mt-8">
                  <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: IA.textSecondary }}>{tx("Perte train / validation")}</h3>
                  <ChartLegend items={[
                    { label: tx("Entraînement"), color: "var(--accent-info)" },
                    { label: tx("Validation"), color: "var(--accent-warning)" },
                  ]} />
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={model.curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={IA.border} strokeDasharray="3 3" />
                        <XAxis dataKey="epoch" tick={tick} />
                        <YAxis tick={tick} width={40} />
                        <Tooltip />
                        <Line type="monotone" dataKey="train" name={tx("Entraînement")} stroke="var(--accent-info)" strokeWidth={2} dot={false} isAnimationActive={!reduce} />
                        <Line type="monotone" dataKey="val" name={tx("Validation")} stroke="var(--accent-warning)" strokeWidth={2} dot={false} isAnimationActive={!reduce} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : null}

              {reliability.length ? (
                <section className="mt-8">
                  <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: IA.textSecondary }}>{tx("Fiabilité")}</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={IA.border} />
                        <XAxis dataKey="pred" type="number" domain={[0, 1]} tick={tick} />
                        <YAxis dataKey="obs" type="number" domain={[0, 1]} tick={tick} width={36} />
                        <ZAxis range={[80, 80]} />
                        <Tooltip />
                        <Scatter data={diagonal} line={{ stroke: "var(--text-muted)" }} fill="transparent" isAnimationActive={false} />
                        <Scatter data={reliability} fill="var(--accent-primary)" isAnimationActive={!reduce} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : null}

              {importance.length ? (
                <section className="mt-8 pb-4">
                  <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: IA.textSecondary }}>{tx("Importance des variables")}</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={importance} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                        <XAxis type="number" tick={tick} />
                        <YAxis type="category" dataKey="name" width={110} tick={tick} />
                        <Tooltip />
                        <Bar dataKey="importance" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} isAnimationActive={!reduce} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
