/** Design tokens — Module IA, aligned on the app light/dark CSS variables. */
export const IA = {
  bg: "var(--bg-app)",
  bgElevated: "var(--bg-input)",
  bgCard: "var(--bg-card)",
  bgCardEnd: "var(--bg-card-hover)",
  accent: "var(--accent-primary)",
  accentDim: "var(--accent-soft)",
  violet: "var(--accent-primary)",
  red: "var(--accent-danger)",
  yellow: "var(--accent-warning)",
  accentDanger: "var(--accent-danger)",
  accentWarning: "var(--accent-warning)",
  orange: "var(--accent-warning)",
  blue: "var(--accent-info)",
  text: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  muted: "var(--text-muted)",
  border: "var(--border-default)",
  borderStrong: "color-mix(in srgb, var(--accent-primary) 42%, var(--border-default))",
  onAccent: "var(--text-inverse)",
  fill: "var(--bg-hover)",
  panel: "color-mix(in srgb, var(--text-primary) 4%, var(--bg-card))",
  track: "color-mix(in srgb, var(--text-primary) 10%, transparent)",
  fontTitle: "'Syne', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', 'Space Mono', monospace",
  radius: 18,
  radiusSm: 12,
};

export function surfaceStyle(extra = {}) {
  return {
    background: IA.bgCard,
    border: `1px solid ${IA.border}`,
    borderRadius: IA.radius,
    ...extra,
  };
}

export function controlStyle(extra = {}) {
  return {
    background: IA.bgElevated,
    border: `1px solid ${IA.border}`,
    borderRadius: IA.radiusSm,
    ...extra,
  };
}

export const TAB_ITEMS = [
  { id: "overview", label: "Vue d'ensemble", storyLabel: "Vue d'ensemble", icon: "LayoutDashboard", color: "var(--accent-primary)" },
  { id: "prevision", label: "Prévision", storyLabel: "Ce qui va se vendre", icon: "TrendingUp", color: "var(--accent-success)" },
  { id: "anomalies", label: "Anomalies", storyLabel: "Ce qui sort de l'ordinaire", icon: "ShieldAlert", color: "var(--accent-danger)" },
  { id: "peremption", label: "Péremption", storyLabel: "Lots à surveiller", icon: "Hourglass", color: "var(--accent-warning)" },
  { id: "optimisation", label: "Optimisation", storyLabel: "Comment mieux s'organiser", icon: "SlidersHorizontal", color: "var(--accent-primary)" },
  { id: "chargement", label: "Chargement", storyLabel: "Chargement", icon: "Truck", color: "var(--accent-info)" },
  { id: "emplacement", label: "Emplacement", storyLabel: "Emplacement", icon: "Warehouse", color: "#8b5cf6" },
  { id: "insights", label: "Insights", storyLabel: "Recommandations du moment", icon: "Sparkles", color: "var(--accent-info)" },
];

export function tabMeta(id) {
  return TAB_ITEMS.find((tab) => tab.id === id) || TAB_ITEMS[0];
}

export const EMBEDDED_MODULE_TABS = new Set([
  "prevision",
  "anomalies",
  "peremption",
  "chargement",
  "emplacement",
]);

export const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export const FADE_UP = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

export const FILTER_EXIT = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32 } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.22 } },
};

export function hashColor(str) {
  const palette = [IA.accent, IA.blue, IA.red, IA.yellow, "#8b5cf6", "#f97316"];
  let hash = 0;
  for (let i = 0; i < String(str).length; i++) {
    hash = String(str).charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export function initials(name) {
  const words = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function formatRelativeTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function toneColor(tone) {
  if (tone === "red") return IA.red;
  if (tone === "yellow") return IA.yellow;
  if (tone === "violet") return IA.violet;
  if (tone === "blue") return IA.blue;
  return IA.accent;
}

export function formatClock(date = new Date()) {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Six cerveaux du Radar IA — ids alignés sur commandCenter.stack */
export const BRAINS = [
  {
    id: "forecast",
    tab: "prevision",
    name: "Forecast",
    title: "Prévision",
    role: "Anticipe la demande et calibre le stock de sécurité (P90).",
    explain: "Holt-Winters + N-BEATS + hybride. Le champion est choisi par MAPE walk-forward.",
  },
  {
    id: "anomalies",
    tab: "anomalies",
    name: "Anomalies",
    title: "Détection",
    role: "Repère les mouvements et niveaux de stock inhabituels.",
    explain: "Ensemble IsolationForest + LOF + autoencodeur, plus les alertes de seuil.",
  },
  {
    id: "expiry",
    tab: "peremption",
    name: "Expiry",
    title: "Péremption",
    role: "Runway DLC : estime la quantité et la valeur encore en stock le jour de l’expiration.",
    explain: "Heuristique persistée (.pkl) : restant − vitesse × jours, horizon 21 j et playbook FEFO. Complète FEFO, ne le remplace pas.",
  },
  {
    id: "slotting",
    tab: "emplacement",
    name: "Slotting",
    title: "Emplacements",
    role: "Classe les articles A/B/C et propose le slot près du quai.",
    explain: "Mélange gaussien (GMM) sur rotation, cube-velocity et récence — suggestion, pas un move auto.",
  },
  {
    id: "load",
    tab: "chargement",
    name: "Loading",
    title: "Chargement",
    role: "Empile la soute : dense au fond, LIFO à la porte, tournée GPS.",
    explain: "HAC + HGB + Pareto. Le plan 3D est une aide au chargement, pas un WMS qui déplace le stock.",
  },
  {
    id: "llm",
    tab: "insights",
    name: "LLM",
    title: "Assistant",
    role: "STOKI (magasin) et STELLA (client B2B) — copilotes avec voix, brief live et données réelles.",
    explain: "Groq GPT-OSS — questions générales + données magasin / commandes en temps réel.",
  },
];

export const JOURNEY = [
  { id: "stock", label: "Stock", hint: "Données magasin" },
  { id: "analyse", label: "Analyse IA", hint: "6 cerveaux" },
  { id: "reco", label: "Recommandation", hint: "Signal clair" },
  { id: "decision", label: "Décision", hint: "Ledger IA" },
  { id: "action", label: "Action", hint: "Exécution métier" },
];

/**
 * Wording honnête autour d’Appliquer — la logique API ne change pas.
 * apply n’exécute jamais un mouvement / achat / transfert stock.
 */
export const APPLY_COPY = {
  reapprovisionner: {
    problem: "Stock insuffisant par rapport au seuil d’alerte",
    analysis: "Le moteur compare quantité disponible et seuil, puis estime un besoin.",
    recommendation: "Planifier un réapprovisionnement",
    impact: "Ajuste uniquement le seuil d’alerte. Aucun bon d’achat n’est créé.",
    actionHint: "Enregistre la décision dans le ledger IA.",
    done: "Plan enregistré — seuil d’alerte mis à jour. Aucun achat lancé.",
  },
  reduire: {
    problem: "Surstock par rapport au seuil (plus de 3×)",
    analysis: "La quantité dépasse largement le seuil : risque d’immobilisation.",
    recommendation: "Alléger le seuil et surveiller la rotation",
    impact: "Abaisse le seuil d’alerte. Aucune sortie de stock n’est exécutée.",
    actionHint: "Enregistre la décision anti-surstock dans le ledger.",
    done: "Seuil d’alerte abaissé. Aucune sortie n’a été effectuée.",
  },
  transferer: {
    problem: "Déséquilibre entre dépôts (surplus vs déficit)",
    analysis: "Un dépôt a du surplus, un autre est sous seuil sur le même article.",
    recommendation: "Transférer le surplus vers le dépôt en déficit",
    impact: "Journalise un plan. Le mouvement stock reste à faire par le magasinier.",
    actionHint: "N’exécute pas le transfert — plan uniquement.",
    done: "Plan de transfert journalisé. Exécution magasinier encore requise.",
  },
  surveiller: {
    problem: "Niveau proche du seuil, sans rupture nette",
    analysis: "Le stock n’est ni critique ni en surstock franc.",
    recommendation: "Placer l’article en veille IA (14 jours)",
    impact: "Marque une surveillance. Aucun mouvement, aucun seuil modifié.",
    actionHint: "Ajoute une décision de veille au ledger.",
    done: "Article placé en surveillance IA (14 jours). Aucun mouvement.",
  },
};
