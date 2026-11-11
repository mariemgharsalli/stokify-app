import { useLandingLang } from "../../../landing/LandingLangContext";

export function resolveExpiryMode(payload) {
  const mode = payload?.model?.mode || payload?.mode;
  if (mode === "ensemble" || mode === "gbm") return mode;
  return "heuristic";
}

const COLORS = {
  ensemble: "var(--accent-success)",
  gbm: "var(--accent-info)",
  heuristic: "var(--accent-warning)",
};

const LABELS = {
  ensemble: "IA Ensemble (GBM + Deep Learning)",
  gbm: "IA GBM",
  heuristic: "Heuristique (secours)",
};

export function expiryModeStyle(mode) {
  const color = COLORS[mode] || COLORS.heuristic;
  return {
    background: `color-mix(in srgb, ${color} 18%, transparent)`,
    color,
    borderColor: `color-mix(in srgb, ${color} 48%, transparent)`,
    letterSpacing: "0.02em",
    textTransform: "none",
  };
}

export function expiryModeLabel(mode) {
  return LABELS[mode] || LABELS.heuristic;
}

export function expiryModeTitle(payload, tx) {
  const model = payload?.model || {};
  const data = model.data || {};
  const when = model.trainedAt ? new Date(model.trainedAt).toLocaleString() : tx("Pas encore entraîné");
  const synthetic = Number(data.synthetic) || 0;
  const real = Number(data.real) || 0;
  return [
    `${tx("Version")} ${payload?.version || model.version || "2.0.0"}`,
    when,
    `${synthetic} ${tx("lots simulés")} · ${real} ${tx("lots réels")}`,
  ].join(" · ");
}

export default function ModeBadge({ payload }) {
  const { tx } = useLandingLang();
  const mode = resolveExpiryMode(payload);
  return (
    <span title={expiryModeTitle(payload, tx)} style={expiryModeStyle(mode)} className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold">
      {tx(expiryModeLabel(mode))}
    </span>
  );
}
