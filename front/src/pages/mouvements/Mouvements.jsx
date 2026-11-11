import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowRight,
  Activity,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Search,
  FileDown,
  RotateCcw,
  ShoppingCart,
  AlertTriangle,
  PackageX,
  MapPin,
  Filter,
  Eye,
} from "lucide-react";
import CapacityBar from "../depots/components/CapacityBar";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import FilterChips from "../../components/commerce/FilterChips";
import api, { getAxiosErrorMessage } from "../../services/api";
import { invaliderApresMouvement } from "../../services/mouvements";
import { downloadMouvementsExport } from "../../utils/stockReports";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import MouvementDetailSheet, { MouvementStatutBadge } from "./MouvementDetailSheet";
import { effetStockApplique, messageCreationMouvement } from "./validationMouvement";

const SUCCESS = "var(--accent-success)";
const DANGER = "var(--accent-danger)";
const PRIMARY = "var(--accent-primary)";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const listStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const rowFade = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

const TYPES = [
  "ENTREE_ACHAT",
  "ENTREE_RETOUR_CLIENT",
  "ENTREE_AJUSTEMENT",
  "SORTIE_VENTE",
  "SORTIE_PERTE",
  "SORTIE_CASSE",
  "SORTIE_AUTRE",
  "TRANSFERT",
  "TRANSFERT_EMPLACEMENT",
];

const TYPE_CONFIG = {
  ENTREE_ACHAT: { label: "Achat", group: "ENTREE" },
  ENTREE_RETOUR_CLIENT: { label: "Retour client", group: "ENTREE" },
  ENTREE_AJUSTEMENT: { label: "Ajustement +", group: "ENTREE" },
  SORTIE_VENTE: { label: "Vente", group: "SORTIE" },
  SORTIE_PERTE: { label: "Perte", group: "SORTIE" },
  SORTIE_CASSE: { label: "Casse", group: "SORTIE" },
  SORTIE_AUTRE: { label: "Sortie autre", group: "SORTIE" },
  TRANSFERT: { label: "Transfert dépôt", group: "TRANSFERT" },
  TRANSFERT_EMPLACEMENT: { label: "Transf. emplacement", group: "TRANSFERT" },
};

const GROUP_CHIPS = [
  { id: "", label: "Tous", accent: PRIMARY },
  { id: "ENTREE", label: "Entrées", accent: SUCCESS },
  { id: "SORTIE", label: "Sorties", accent: DANGER },
  { id: "TRANSFERT", label: "Transferts", accent: "var(--accent-info, #378ADD)" },
];

const INPUT_CN =
  "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--border-focus)] focus:outline-none";

const DEFAULT_MVT_FORM = {
  operation: "ENTREE",
  typeEntree: "ENTREE_AJUSTEMENT",
  typeSortie: "SORTIE_AUTRE",
  articleId: "",
  quantite: "",
  depotId: "",
  depotOrigineId: "",
  depotDestId: "",
  emplacementOrigineId: "",
  emplacementDestId: "",
  commentaire: "",
};

const TYPE_BADGE_ICONS = {
  ENTREE_ACHAT: ArrowDownLeft,
  ENTREE_RETOUR_CLIENT: RotateCcw,
  ENTREE_AJUSTEMENT: Plus,
  SORTIE_VENTE: ShoppingCart,
  SORTIE_PERTE: AlertTriangle,
  SORTIE_CASSE: PackageX,
  SORTIE_AUTRE: ArrowUpRight,
  TRANSFERT: ArrowLeftRight,
  TRANSFERT_EMPLACEMENT: MapPin,
};

const GROUP_THEME = {
  ENTREE: { accent: SUCCESS, bg: "color-mix(in srgb, var(--accent-success) 14%, transparent)", text: SUCCESS },
  SORTIE: { accent: DANGER, bg: "color-mix(in srgb, var(--accent-danger) 14%, transparent)", text: DANGER },
  TRANSFERT: {
    accent: "var(--accent-info, #378ADD)",
    bg: "color-mix(in srgb, var(--accent-info, #378ADD) 14%, transparent)",
    text: "var(--accent-info, #378ADD)",
  },
};

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  return [];
}

function asStockLines(data) {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

function FormSection({ title, children, className = "" }) {
  return (
    <section
      className={`space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-hover)]/40 p-4 ${className}`}
    >
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h4>
      {children}
    </section>
  );
}

function formatDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function useAnimatedNumber(target, duration = 1100) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(Number(target) || 0);
      return undefined;
    }
    const end = Number(target) || 0;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);

  return value;
}

function KpiTile({ icon: Icon, label, value, hint, accent, index, reduceMotion, pulse }) {
  const animated = useAnimatedNumber(value, 1100);
  const display = Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "mvt-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={pulse ? { "--kpi-accent": accent, borderColor: `color-mix(in srgb, ${accent} 35%, var(--border-default))` } : undefined}
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 10%, transparent) 0%, transparent 55%)` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 16%, transparent), transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 24%, transparent)`,
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
          </div>
          {hint ? (
            <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {hint}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-bold tabular-nums tracking-tight" style={{ color: accent }}>
          {display}
        </p>
        <motion.div
          className="mt-2.5 h-px origin-left"
          style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 45%, transparent), transparent)` }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function FlowBar({ stats, reduceMotion }) {
  const total = Math.max(1, stats.entrees + stats.sorties + stats.transferts);
  const segments = [
    { key: "e", label: "Entrées", value: stats.entrees, color: SUCCESS },
    { key: "s", label: "Sorties", value: stats.sorties, color: DANGER },
    { key: "t", label: "Transferts", value: stats.transferts, color: "var(--accent-info, #378ADD)" },
  ];

  return (
    <motion.section
      custom={4}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${SUCCESS}88, ${DANGER}88, var(--accent-info, #378ADD)88, transparent)`,
        }}
        aria-hidden
      />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Flux de la page</p>
          <p className="text-[11px] text-[var(--text-muted)]">Répartition entrées / sorties / transferts</p>
        </div>
        <p className="text-xs tabular-nums text-[var(--text-secondary)]">
          {stats.entrees + stats.sorties + stats.transferts} mouvement(s)
        </p>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        {segments.map((s, i) => {
          const pct = (s.value / total) * 100;
          if (pct <= 0) return null;
          return (
            <motion.div
              key={s.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ background: s.color }}
              initial={reduceMotion ? { width: `${pct}%` } : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.85, delay: 0.12 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              title={`${s.label}: ${s.value}`}
            />
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-[var(--text-primary)]">{s.value}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type];
  const Icon = TYPE_BADGE_ICONS[type] || Activity;
  const theme = GROUP_THEME[cfg?.group] || GROUP_THEME.TRANSFERT;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
      style={{
        background: theme.bg,
        borderColor: `color-mix(in srgb, ${theme.accent} 35%, transparent)`,
        color: theme.text,
      }}
    >
      <Icon size={12} strokeWidth={2} style={{ color: theme.accent }} />
      {cfg?.label ?? type}
    </span>
  );
}

function SoftBadge({ children, icon: Icon, title }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
      title={title}
    >
      {Icon ? <Icon size={10} strokeWidth={2} className="text-[var(--text-muted)]" /> : null}
      {children}
    </span>
  );
}

function parseLotsDetail(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function LotsTraceabilite({ lotsDetail, lot, reduceMotion }) {
  const lots = parseLotsDetail(lotsDetail);
  const [open, setOpen] = useState(false);

  if (lots.length > 1) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] transition hover:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] hover:text-[var(--text-primary)]"
          aria-expanded={open}
        >
          {lots.length} lots
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="text-[var(--text-muted)]"
          >
            ▼
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="lots-detail"
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ul className="mt-1.5 space-y-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-hover)]/60 px-2.5 py-1.5">
                {lots.map((l, i) => (
                  <li
                    key={l.lotId ?? `${l.lotNumero}-${i}`}
                    className="flex items-center justify-between gap-3 text-[10px] text-[var(--text-secondary)]"
                  >
                    <span className="font-mono font-medium text-[var(--text-primary)]">
                      {l.lotNumero || `Lot #${l.lotId}`}
                    </span>
                    <span className="tabular-nums text-[var(--text-muted)]">
                      {(Number(l.quantite) || 0).toLocaleString("fr-FR", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  const single = lots[0]?.lotNumero || lot?.numero;
  if (!single) return null;
  return (
    <p className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]" title="Lot">
      Lot {single}
    </p>
  );
}

function initials(u) {
  if (!u) return "?";
  const parts = [u.prenom, u.nom].filter(Boolean);
  if (parts.length === 0) return (u.email?.[0] ?? "?").toUpperCase();
  return parts
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashColor(s = "") {
  const colors = ["#378ADD", "#7F77DD", "#1D9E75", "#BA7517", "#E24B4A", "#0F6E56"];
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = s.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function Pagination({ page, pages, onPageChange }) {
  const nums = useMemo(() => {
    const out = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p += 1) out.push(p);
    return out;
  }, [page, pages]);

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
        aria-label="Page précédente"
      >
        <ChevronLeft size={16} />
      </button>
      {nums.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
            p === page
              ? "text-white shadow-md"
              : "border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          }`}
          style={p === page ? { background: "var(--accent-primary)" } : undefined}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
        aria-label="Page suivante"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export function MouvementModal({
  open,
  onClose,
  articles,
  depots,
  onSuccess,
  initialValues = null,
  restrictToOperation = null,
}) {
  const qc = useQueryClient();
  const societeScope = useSocieteQueryScope();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_MVT_FORM });

  useEffect(() => {
    if (!open) return;
    const forcedOp = restrictToOperation || initialValues?.operation || null;
    if (initialValues) {
      setForm({
        ...DEFAULT_MVT_FORM,
        operation: forcedOp || "TRANSFERT_EMPLACEMENT",
        articleId: initialValues.articleId != null ? String(initialValues.articleId) : "",
        depotOrigineId: initialValues.depotOrigineId != null ? String(initialValues.depotOrigineId) : "",
        emplacementOrigineId:
          initialValues.emplacementOrigineId != null ? String(initialValues.emplacementOrigineId) : "",
        depotDestId: initialValues.depotDestId != null ? String(initialValues.depotDestId) : "",
        emplacementDestId:
          initialValues.emplacementDestId != null ? String(initialValues.emplacementDestId) : "",
        quantite: initialValues.quantite != null ? String(initialValues.quantite) : "",
        commentaire: initialValues.commentaire || "",
      });
    } else if (restrictToOperation) {
      setForm({ ...DEFAULT_MVT_FORM, operation: restrictToOperation });
    } else {
      setForm({ ...DEFAULT_MVT_FORM });
    }
    setError("");
  }, [open, initialValues, restrictToOperation]);

  const { data: emplOrigineRaw } = useQuery({
    queryKey: ["emplacements-mvt-origine", societeScope, form.depotOrigineId],
    queryFn: () => api.get("emplacements", { params: { depotId: form.depotOrigineId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open && Boolean(form.depotOrigineId),
  });

  const { data: emplDestRaw } = useQuery({
    queryKey: ["emplacements-mvt-dest", societeScope, form.depotDestId],
    queryFn: () => api.get("emplacements", { params: { depotId: form.depotDestId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open && Boolean(form.depotDestId),
  });

  const emplacementsOrigine = asItems(emplOrigineRaw);
  const emplacementsDest = asItems(emplDestRaw);

  const {
    data: stockDisponibleSource,
    isFetching: stockSourceFetching,
    isLoading: stockSourceLoading,
  } = useQuery({
    queryKey: [
      "stock-dispo-empl-mvt",
      societeScope,
      form.articleId,
      form.depotOrigineId,
      form.emplacementOrigineId,
    ],
    queryFn: async () => {
      const r = await api.get("stock", {
        params: {
          articleId: form.articleId,
          depotId: form.depotOrigineId,
          emplacementId: form.emplacementOrigineId,
          limit: 10,
        },
      });
      const lines = asStockLines(r.data);
      const sum = lines.reduce((s, l) => s + (Number(l.quantite) || 0), 0);
      return Number.isFinite(sum) ? sum : 0;
    },
    enabled:
      open &&
      form.operation === "TRANSFERT_EMPLACEMENT" &&
      Boolean(form.articleId && form.depotOrigineId && form.emplacementOrigineId),
  });

  const { data: compatibilityResult, isFetching: compatFetching } = useQuery({
    queryKey: ["empl-compat-mvt", societeScope, form.articleId, form.emplacementDestId],
    queryFn: () =>
      api
        .get("stock/emplacement-compatibility", {
          params: { articleId: form.articleId, emplacementId: form.emplacementDestId },
        })
        .then((r) => r.data),
    enabled:
      open &&
      form.operation === "TRANSFERT_EMPLACEMENT" &&
      Boolean(form.articleId && form.emplacementDestId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const base = {
        articleId: Number(form.articleId),
        quantite: Number(form.quantite),
        commentaire: form.commentaire.trim() || undefined,
      };
      if (form.operation === "ENTREE") {
        return api.post("mouvements/entrees", {
          ...base,
          type: form.typeEntree,
          depotId: form.depotId ? Number(form.depotId) : undefined,
        });
      }
      if (form.operation === "SORTIE") {
        return api.post("mouvements/sorties", {
          ...base,
          type: form.typeSortie,
          depotId: form.depotId ? Number(form.depotId) : undefined,
        });
      }
      if (form.operation === "TRANSFERT_EMPLACEMENT") {
        return api.post("mouvements/transfert-emplacement", {
          ...base,
          depotOrigineId: Number(form.depotOrigineId),
          emplacementOrigineId: Number(form.emplacementOrigineId),
          depotDestId: Number(form.depotDestId),
          emplacementDestId: Number(form.emplacementDestId),
        });
      }
      return api.post("mouvements/transferts", {
        ...base,
        depotOrigineId: Number(form.depotOrigineId),
        depotDestId: Number(form.depotDestId),
      });
    },
    onSuccess: (response) => {
      invaliderApresMouvement(qc);
      onSuccess(response?.data);
      onClose();
      setForm({ ...DEFAULT_MVT_FORM });
      setError("");
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  if (!open) return null;

  const articleOptions = articles.map((a) => ({
    value: String(a.id),
    label: `${a.code} — ${a.libelle ?? a.designation ?? ""}`,
  }));
  const depotOptions = depots.map((d) => ({
    value: String(d.id),
    label: `${d.code} — ${d.libelle ?? d.nom ?? ""}`,
  }));

  function emplacementOptionsForDepot(depotId, excludeId) {
    const list = String(depotId) === String(form.depotOrigineId) ? emplacementsOrigine : emplacementsDest;
    return list.map((e) => ({
      value: String(e.id),
      label: `${e.code} — ${e.libelle ?? ""}`,
      disabled: excludeId != null && String(e.id) === String(excludeId),
    }));
  }

  function depotLabel(depotId) {
    const d = depots.find((dep) => String(dep.id) === String(depotId));
    if (!d) return null;
    return d.code || d.libelle || d.nom || null;
  }

  const originEmplacementCode = emplacementsOrigine.find(
    (e) => String(e.id) === form.emplacementOrigineId
  )?.code;
  const destEmplacementCode = emplacementsDest.find((e) => String(e.id) === form.emplacementDestId)?.code;
  const originDepotNom = depotLabel(form.depotOrigineId);
  const destDepotNom = depotLabel(form.depotDestId);
  const depotChange =
    form.depotOrigineId &&
    form.depotDestId &&
    String(form.depotOrigineId) !== String(form.depotDestId);

  const qtyNum = Number(form.quantite) || 0;
  const isEmplTransfer = form.operation === "TRANSFERT_EMPLACEMENT";
  const stockSourceQueryEnabled =
    isEmplTransfer &&
    Boolean(form.articleId && form.depotOrigineId && form.emplacementOrigineId);
  const stockSourcePending =
    stockSourceQueryEnabled && (stockSourceFetching || stockSourceLoading);
  const stockSourceLoaded = stockSourceQueryEnabled && !stockSourcePending;
  const dispoNum =
    stockSourceLoaded && typeof stockDisponibleSource === "number" && Number.isFinite(stockDisponibleSource)
      ? stockDisponibleSource
      : null;
  const usagePct =
    dispoNum != null && dispoNum > 0 ? Math.min(100, (qtyNum / dispoNum) * 100) : 0;
  const qtyOver =
    dispoNum != null && Number.isFinite(dispoNum) && qtyNum > 0 && qtyNum > dispoNum;
  const quantiteValide =
    qtyNum > 0 &&
    (dispoNum == null || qtyNum <= dispoNum) &&
    compatibilityResult?.ok !== false;

  const compatRequired =
    isEmplTransfer && Boolean(form.articleId && form.emplacementDestId);
  const compatPending = compatRequired && compatFetching && !compatibilityResult;
  const compatOk = !compatRequired || compatibilityResult?.ok === true;

  let emplSubmitLabel = "Enregistrer";
  let emplSubmitDisabled = createMutation.isPending;

  if (isEmplTransfer) {
    if (stockSourcePending) {
      emplSubmitLabel = "Chargement du stock…";
      emplSubmitDisabled = true;
    } else if (compatPending) {
      emplSubmitLabel = "Vérification…";
      emplSubmitDisabled = true;
    } else if (compatRequired && compatibilityResult && !compatibilityResult.ok) {
      emplSubmitLabel = "Emplacement incompatible";
      emplSubmitDisabled = true;
    } else if (qtyOver) {
      emplSubmitLabel = "Quantité insuffisante";
      emplSubmitDisabled = true;
    } else if (stockSourceLoaded && qtyNum <= 0) {
      emplSubmitDisabled = true;
    } else if (
      !form.depotOrigineId ||
      !form.emplacementOrigineId ||
      !form.depotDestId ||
      !form.emplacementDestId
    ) {
      emplSubmitDisabled = true;
    }
  }

  const submitLabel = isEmplTransfer ? emplSubmitLabel : "Enregistrer";
  const submitDisabled =
    createMutation.isPending || (isEmplTransfer ? emplSubmitDisabled : false);

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.articleId) return setError("Article requis.");
    if (!(Number(form.quantite) > 0)) return setError("Quantité > 0 requise.");
    if (form.operation === "TRANSFERT") {
      if (!form.depotOrigineId || !form.depotDestId) return setError("Dépôts source et destination requis.");
      if (String(form.depotOrigineId) === String(form.depotDestId)) {
        return setError("Les dépôts doivent être différents.");
      }
    }
    if (form.operation === "TRANSFERT_EMPLACEMENT") {
      if (!form.depotOrigineId || !form.emplacementOrigineId) {
        return setError("Dépôt et emplacement source requis.");
      }
      if (!form.depotDestId || !form.emplacementDestId) {
        return setError("Dépôt et emplacement destination requis.");
      }
      if (String(form.emplacementOrigineId) === String(form.emplacementDestId)) {
        return setError("Les emplacements doivent être différents.");
      }
      if (compatibilityResult && !compatibilityResult.ok) {
        return setError(compatibilityResult.message);
      }
      if (dispoNum != null && qtyNum > dispoNum) {
        return setError(`Stock insuffisant (disponible : ${dispoNum.toLocaleString("fr-FR")}).`);
      }
    }
    createMutation.mutate();
  }

  const operations = [
    { op: "ENTREE", label: "Entrée", Icon: ArrowDownLeft },
    { op: "SORTIE", label: "Sortie", Icon: ArrowUpRight },
    { op: "TRANSFERT", label: "Transfert dépôt", Icon: ArrowLeftRight },
    { op: "TRANSFERT_EMPLACEMENT", label: "Transf. empl.", Icon: MapPin },
  ];

  const opStyles = {
    ENTREE: {
      active: {
        background: "var(--success-bg)",
        border: "1px solid var(--success-border)",
        iconColor: "var(--accent-success)",
        textColor: "var(--success-text)",
      },
    },
    SORTIE: {
      active: {
        background: "var(--danger-bg)",
        border: "1px solid var(--danger-border)",
        iconColor: "var(--accent-danger)",
        textColor: "var(--danger-text)",
      },
    },
    TRANSFERT: {
      active: {
        background: "var(--info-bg)",
        border: "1px solid var(--info-border)",
        iconColor: "var(--accent-info)",
        textColor: "var(--info-text)",
      },
    },
    TRANSFERT_EMPLACEMENT: {
      active: {
        background: "var(--accent-soft)",
        border: "1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent)",
        iconColor: "var(--accent-primary)",
        textColor: "var(--text-link)",
      },
    },
  };

  const labelCn = "mb-1.5 block text-xs font-medium text-[var(--text-muted)]";
  const isRestricted = Boolean(restrictToOperation);
  const modalTitle =
    restrictToOperation === "TRANSFERT_EMPLACEMENT"
      ? "Confirmer le transfert d'emplacement"
      : "Nouveau mouvement";
  const modalSubtitle =
    restrictToOperation === "TRANSFERT_EMPLACEMENT"
      ? "Déplacement suggéré par l'optimisation IA"
      : "Entrée, sortie, transfert dépôt ou transfert entre emplacements";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      <div
        className="modal-overlay-backdrop absolute inset-0"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="modal-overlay-dialog relative my-2 flex w-full max-w-xl flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-modal)] shadow-[var(--shadow-modal)]"
        style={{ maxHeight: "min(90vh, 720px)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mvt-modal-title"
      >
        <div className="shrink-0 border-b border-[var(--border-default)] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="mvt-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
                {modalTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{modalSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!isRestricted ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {operations.map(({ op, label, Icon }) => {
                const isActive = form.operation === op;
                const st = opStyles[op].active;
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, operation: op }))}
                    className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-xs font-semibold transition-all duration-200"
                    style={
                      isActive
                        ? {
                            background: st.background,
                            border: st.border,
                            color: st.textColor,
                            transform: "scale(1.02)",
                          }
                        : {
                            background: "transparent",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-muted)",
                            transform: "scale(1)",
                          }
                    }
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: isActive ? st.iconColor : "var(--text-muted)" }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <form id="mvt-modal-form" onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {form.operation !== "TRANSFERT_EMPLACEMENT" ? (
              <>
                <div>
                  <label className={labelCn}>Article *</label>
                  <SearchableSelect
                    value={form.articleId}
                    onChange={(v) => setForm((f) => ({ ...f, articleId: v }))}
                    options={articleOptions}
                    placeholder="Choisir un article"
                    allowClear={false}
                  />
                </div>

                <div>
                  <label className={labelCn}>Quantité *</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={form.quantite}
                    onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                    className={INPUT_CN}
                    placeholder="0.000"
                  />
                </div>

                {form.operation === "ENTREE" && (
                  <div>
                    <label className={labelCn}>Type d&apos;entrée</label>
                    <SearchableSelect
                      value={form.typeEntree}
                      onChange={(v) => setForm((f) => ({ ...f, typeEntree: v }))}
                      options={["ENTREE_AJUSTEMENT", "ENTREE_ACHAT", "ENTREE_RETOUR_CLIENT"].map((t) => ({
                        value: t,
                        label: TYPE_CONFIG[t]?.label ?? t,
                      }))}
                      placeholder="Type"
                      allowClear={false}
                    />
                  </div>
                )}

                {form.operation === "SORTIE" && (
                  <div>
                    <label className={labelCn}>Type de sortie</label>
                    <SearchableSelect
                      value={form.typeSortie}
                      onChange={(v) => setForm((f) => ({ ...f, typeSortie: v }))}
                      options={["SORTIE_VENTE", "SORTIE_PERTE", "SORTIE_CASSE", "SORTIE_AUTRE"].map((t) => ({
                        value: t,
                        label: TYPE_CONFIG[t]?.label ?? t,
                      }))}
                      placeholder="Type"
                      allowClear={false}
                    />
                  </div>
                )}

                {form.operation === "TRANSFERT" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCn}>Dépôt source *</label>
                      <SearchableSelect
                        value={form.depotOrigineId}
                        onChange={(v) => setForm((f) => ({ ...f, depotOrigineId: v }))}
                        options={depotOptions}
                        placeholder="Source"
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className={labelCn}>Dépôt destination *</label>
                      <SearchableSelect
                        value={form.depotDestId}
                        onChange={(v) => setForm((f) => ({ ...f, depotDestId: v }))}
                        options={depotOptions.filter((d) => d.value !== form.depotOrigineId)}
                        placeholder="Destination"
                        allowClear={false}
                      />
                    </div>
                  </div>
                )}

                {(form.operation === "ENTREE" || form.operation === "SORTIE") && (
                  <div>
                    <label className={labelCn}>Dépôt</label>
                    <SearchableSelect
                      value={form.depotId}
                      onChange={(v) => setForm((f) => ({ ...f, depotId: v }))}
                      options={depotOptions}
                      placeholder="Choisir un dépôt"
                      clearLabel="Aucun"
                    />
                  </div>
                )}

                <div>
                  <label className={labelCn}>Commentaire</label>
                  <input
                    type="text"
                    value={form.commentaire}
                    onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                    className={INPUT_CN}
                    placeholder="Optionnel"
                  />
                </div>
              </>
            ) : (
              <>
                <FormSection title="Article & quantité">
                  <div>
                    <label className={labelCn}>Article *</label>
                    <SearchableSelect
                      value={form.articleId}
                      onChange={(v) => setForm((f) => ({ ...f, articleId: v }))}
                      options={articleOptions}
                      placeholder="Choisir un article"
                      allowClear={false}
                    />
                  </div>

                  <div>
                    <label className={labelCn}>Quantité *</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={form.quantite}
                      onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                      className={INPUT_CN}
                      placeholder="0.000"
                    />
                  </div>

                  {stockSourceQueryEnabled ? (
                    <div className={qtyOver ? "animate-shake" : ""}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[var(--text-muted)]">
                          Stock disponible à la source
                        </span>
                        <span className="tabular-nums text-[var(--text-secondary)]">
                          {stockSourcePending ? (
                            <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              …
                            </span>
                          ) : (
                            <>
                              {qtyNum > 0 ? `${qtyNum.toLocaleString("fr-FR")} / ` : ""}
                              {(dispoNum ?? 0).toLocaleString("fr-FR")}
                            </>
                          )}
                        </span>
                      </div>
                      {stockSourcePending ? (
                        <div
                          className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]"
                          aria-hidden="true"
                        >
                          <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--border-default)]" />
                        </div>
                      ) : (
                        <CapacityBar theme value={usagePct} height={10} />
                      )}
                      {qtyOver && (
                        <p className="mt-1 text-xs text-[var(--danger-text)]">
                          Quantité supérieure au stock disponible
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Sélectionnez l&apos;emplacement source pour afficher le stock disponible.
                    </p>
                  )}
                </FormSection>

                <FormSection title="Déplacement">
                  <div className="relative flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-[140px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Source</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {originDepotNom || "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--accent-primary)]">
                        {originEmplacementCode || "—"}
                      </p>
                    </div>

                    <div className="relative flex flex-1 flex-col items-center justify-center gap-2 px-2 py-2">
                      {depotChange && (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            color: "var(--warning-text)",
                            background: "var(--warning-bg)",
                            borderColor: "var(--warning-border)",
                            animation: "popIn 0.2s ease both",
                          }}
                        >
                          ⚠ Changement de dépôt
                        </span>
                      )}
                      <div className="relative h-px w-full overflow-visible bg-[var(--border-default)]">
                        <span
                          className="absolute -top-2 h-4 w-4 rounded-sm"
                          style={{
                            left: 0,
                            background: "var(--accent-primary)",
                            animation: quantiteValide ? "transferSlide 1.6s ease-in-out infinite" : "none",
                            opacity: quantiteValide ? 1 : 0.25,
                          }}
                        />
                      </div>
                    </div>

                    <div className="min-w-[140px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Destination</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {destDepotNom || "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--accent-primary)]">
                        {destEmplacementCode || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-[var(--border-default)] pt-4">
                    <div>
                      <label className={labelCn}>Dépôt source *</label>
                      <SearchableSelect
                        value={form.depotOrigineId}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, depotOrigineId: v, emplacementOrigineId: "" }))
                        }
                        options={depotOptions}
                        placeholder="Dépôt"
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className={labelCn}>Emplacement source *</label>
                      <SearchableSelect
                        value={form.emplacementOrigineId}
                        onChange={(v) => setForm((f) => ({ ...f, emplacementOrigineId: v }))}
                        options={emplacementOptionsForDepot(form.depotOrigineId, form.emplacementDestId)}
                        placeholder="Emplacement"
                        allowClear={false}
                        disabled={!form.depotOrigineId}
                      />
                    </div>
                    <div>
                      <label className={labelCn}>Dépôt destination *</label>
                      <SearchableSelect
                        value={form.depotDestId}
                        onChange={(v) => setForm((f) => ({ ...f, depotDestId: v, emplacementDestId: "" }))}
                        options={depotOptions}
                        placeholder="Dépôt"
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className={labelCn}>Emplacement destination *</label>
                      <SearchableSelect
                        value={form.emplacementDestId}
                        onChange={(v) => setForm((f) => ({ ...f, emplacementDestId: v }))}
                        options={emplacementOptionsForDepot(form.depotDestId, form.emplacementOrigineId)}
                        placeholder="Emplacement"
                        allowClear={false}
                        disabled={!form.depotDestId}
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Vérifications">
                  {compatRequired ? (
                    compatPending ? (
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Vérification de compatibilité…
                      </div>
                    ) : compatibilityResult ? (
                      <div
                        className={`rounded-lg px-3 py-2 text-xs font-medium ${
                          compatibilityResult.ok
                            ? "border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]"
                            : "border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]"
                        }`}
                        style={{ animation: "popIn 0.2s ease both" }}
                      >
                        {compatibilityResult.ok ? "✓ Compatible" : `✗ ${compatibilityResult.message}`}
                      </div>
                    ) : null
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Choisissez l&apos;emplacement destination pour vérifier la compatibilité.
                    </p>
                  )}

                  <div>
                    <label className={labelCn}>Commentaire</label>
                    <input
                      type="text"
                      value={form.commentaire}
                      onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                      className={INPUT_CN}
                      placeholder="Optionnel"
                    />
                  </div>
                </FormSection>
              </>
            )}

            {error && (
              <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
                {error}
              </p>
            )}
          </div>

          <div className="shrink-0 flex justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--bg-modal)] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-sm font-semibold text-[var(--text-inverse)] disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: "var(--accent-primary)" }}
            >
              {createMutation.isPending && (
                <span
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-inverse) 25%, transparent), transparent)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer-slide 1.1s linear infinite",
                  }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitLabel}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Mouvements() {
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const canRead = hasPermission(user?.role, "mouvements:read");
  const canWrite = hasPermission(user?.role, "mouvements:write");

  const [typeFilter, setTypeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [articleId, setArticleId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [searchParams] = useSearchParams();

  const limit = 25;

  useEffect(() => {
    const a = searchParams.get("articleId");
    const d = searchParams.get("depotId");
    if (a) setArticleId(a);
    if (d) setDepotId(d);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const params = useMemo(() => {
    const typeExact = typeFilter;
    const group = !typeExact && groupFilter ? groupFilter : undefined;
    return {
      page,
      limit,
      ...(typeExact ? { type: typeExact } : {}),
      ...(group ? { group } : {}),
      ...(articleId ? { articleId } : {}),
      ...(depotId ? { depotId } : {}),
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: `${dateTo}T23:59:59.999Z` } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };
  }, [page, limit, typeFilter, groupFilter, articleId, depotId, dateFrom, dateTo, debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ["mouvements", societeScope, params],
    queryFn: () => api.get("mouvements", { params }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles", "mouvements", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
    enabled: canRead || canWrite,
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots", "mouvements", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 300 } }).then((r) => r.data),
    enabled: canRead || canWrite,
  });

  const { data: depotsActifsData } = useQuery({
    queryKey: ["depots", "mouvements-actifs", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 300, statut: "ACTIF" } }).then((r) => r.data),
    enabled: canWrite,
  });

  const items = asItems(data);

  useEffect(() => {
    if (!detail?.id) return;
    const frais = items.find((ligne) => ligne.id === detail.id);
    if (!frais) return;
    if (frais.statut !== detail.statut || frais.commentaire !== detail.commentaire) {
      setDetail(frais);
    }
  }, [items, detail]);
  const articles = asItems(articlesData);
  const depots = asItems(depotsData);
  const depotsActifs = asItems(depotsActifsData);
  const total = data?.total ?? 0;
  const pages = Math.max(1, data?.pages ?? 1);

  const pageStats = useMemo(() => {
    const entrees = items.filter((m) => TYPE_CONFIG[m.type]?.group === "ENTREE").length;
    const sorties = items.filter((m) => TYPE_CONFIG[m.type]?.group === "SORTIE").length;
    const transferts = items.filter((m) => TYPE_CONFIG[m.type]?.group === "TRANSFERT").length;
    return { entrees, sorties, transferts };
  }, [items]);

  const filterChips = useMemo(() => {
    const chips = [];
    if (articleId) {
      const art = articles.find((a) => String(a.id) === articleId);
      chips.push({
        key: "article",
        label: `Article : ${art ? art.code : articleId}`,
        onRemove: () => {
          setArticleId("");
          setPage(1);
        },
      });
    }
    if (depotId) {
      const dep = depots.find((d) => String(d.id) === depotId);
      chips.push({
        key: "depot",
        label: `Dépôt : ${dep ? dep.code : depotId}`,
        onRemove: () => {
          setDepotId("");
          setPage(1);
        },
      });
    }
    if (typeFilter) {
      chips.push({
        key: "type",
        label: `Type : ${TYPE_CONFIG[typeFilter]?.label ?? typeFilter}`,
        onRemove: () => {
          setTypeFilter("");
          setPage(1);
        },
      });
    } else if (groupFilter) {
      const g = GROUP_CHIPS.find((c) => c.id === groupFilter);
      chips.push({
        key: "group",
        label: g?.label ?? groupFilter,
        onRemove: () => {
          setGroupFilter("");
          setPage(1);
        },
      });
    }
    if (dateFrom || dateTo) {
      chips.push({
        key: "dates",
        label: `Du ${dateFrom || "…"} au ${dateTo || "…"}`,
        onRemove: () => {
          setDateFrom("");
          setDateTo("");
          setPage(1);
        },
      });
    }
    if (debouncedSearch) {
      chips.push({
        key: "search",
        label: `Recherche : ${debouncedSearch}`,
        onRemove: () => {
          setSearchInput("");
          setDebouncedSearch("");
          setPage(1);
        },
      });
    }
    return chips;
  }, [articleId, depotId, typeFilter, groupFilter, dateFrom, dateTo, debouncedSearch, articles, depots]);

  function resetFilters() {
    setTypeFilter("");
    setGroupFilter("");
    setArticleId("");
    setDepotId("");
    setDateFrom("");
    setDateTo("");
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  }

  async function runExport(format) {
    const typeExact = typeFilter;
    const group = !typeExact && groupFilter ? groupFilter : undefined;
    const exportParams = {
      ...(typeExact ? { type: typeExact } : {}),
      ...(group ? { group } : {}),
      ...(articleId ? { articleId } : {}),
      ...(depotId ? { depotId } : {}),
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: `${dateTo}T23:59:59.999Z` } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };
    setExporting(format);
    setExportError("");
    try {
      await downloadMouvementsExport(api, exportParams, format);
    } catch (e) {
      setExportError(getAxiosErrorMessage(e));
    } finally {
      setExporting(null);
    }
  }

  if (!canRead) {
    return (
      <PageShell title="Mouvements de stock" subtitle="">
        <p className="text-sm text-[var(--text-muted)]">Accès refusé.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Mouvements de stock"
      subtitle="Pilotage dynamique des entrées, sorties et transferts entre dépôts"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {canRead ? (
            <>
              <button
                type="button"
                onClick={() => runExport("csv")}
                disabled={exporting != null}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                CSV
              </button>
              <button
                type="button"
                onClick={() => runExport("excel")}
                disabled={exporting != null}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Excel
              </button>
              <button
                type="button"
                onClick={() => runExport("pdf")}
                disabled={exporting != null}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                PDF
              </button>
            </>
          ) : null}
          {canWrite ? (
            <button type="button" onClick={() => setModalOpen(true)} className={PRIMARY_BTN_CLASSES} style={primaryButtonStyle}>
              <Plus size={16} />
              Nouveau mouvement
            </button>
          ) : null}
        </div>
      }
    >
      <style>{`
        @keyframes mvtKpiPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
          50% { box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent); }
        }
        @keyframes mvtShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .mvt-kpi-pulse { animation: mvtKpiPulse 2.4s ease-in-out infinite; }
        .mvt-skeleton {
          background: linear-gradient(90deg, var(--bg-hover) 25%, color-mix(in srgb, var(--bg-card) 60%, var(--bg-hover)) 50%, var(--bg-hover) 75%);
          background-size: 200% 100%;
          animation: mvtShimmer 1.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .mvt-kpi-pulse, .mvt-skeleton { animation: none !important; }
        }
      `}</style>

      <div className="space-y-5">
        <AnimatePresence>
          {toast ? (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              className="rounded-xl border px-4 py-2.5 text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--accent-success) 35%, transparent)",
                background: "color-mix(in srgb, var(--accent-success) 10%, var(--bg-card))",
                color: SUCCESS,
              }}
            >
              {toast}
            </motion.p>
          ) : null}
        </AnimatePresence>
        {exportError ? (
          <p
            className="rounded-xl border px-4 py-2.5 text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--accent-danger) 35%, transparent)",
              background: "color-mix(in srgb, var(--accent-danger) 10%, var(--bg-card))",
              color: DANGER,
            }}
          >
            {exportError}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            index={0}
            reduceMotion={reduceMotion}
            icon={Activity}
            label="Total mouvements"
            value={total}
            hint="enregistrés"
            accent={PRIMARY}
          />
          <KpiTile
            index={1}
            reduceMotion={reduceMotion}
            icon={ArrowDownLeft}
            label="Entrées"
            value={pageStats.entrees}
            hint="page"
            accent={SUCCESS}
            pulse={pageStats.entrees > 0}
          />
          <KpiTile
            index={2}
            reduceMotion={reduceMotion}
            icon={ArrowUpRight}
            label="Sorties"
            value={pageStats.sorties}
            hint="page"
            accent={DANGER}
            pulse={pageStats.sorties > 0}
          />
          <KpiTile
            index={3}
            reduceMotion={reduceMotion}
            icon={ArrowLeftRight}
            label="Transferts"
            value={pageStats.transferts}
            hint="page"
            accent="var(--accent-info, #378ADD)"
          />
        </div>

        {!isLoading && items.length > 0 ? <FlowBar stats={pageStats} reduceMotion={reduceMotion} /> : null}

        <div className="sticky top-2 z-20 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/95 shadow-sm backdrop-blur-md">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="inline-flex items-center gap-2">
              <Filter size={16} className="text-[var(--accent-primary)]" />
              Filtres avancés
              {filterChips.length > 0 ? (
                <span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  {filterChips.length}
                </span>
              ) : null}
            </span>
            <motion.span
              animate={{ rotate: filtersOpen ? 180 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              className="text-[var(--text-muted)]"
            >
              ▼
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                key="filters"
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-t border-[var(--border-default)]"
              >
                <div className="space-y-4 px-4 pb-4 pt-3">
                  <div className="flex flex-wrap gap-2">
                    {GROUP_CHIPS.map((g) => {
                      const active = groupFilter === g.id && !typeFilter;
                      return (
                        <button
                          key={g.id || "all"}
                          type="button"
                          onClick={() => {
                            setGroupFilter(g.id);
                            setTypeFilter("");
                            setPage(1);
                          }}
                          className="relative overflow-hidden rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
                          style={
                            active
                              ? { background: g.accent, color: "#fff" }
                              : {
                                  background: "var(--bg-hover)",
                                  color: "var(--text-secondary)",
                                }
                          }
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Rechercher par commentaire, article…"
                      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <SearchableSelect
                      value={typeFilter}
                      onChange={(v) => {
                        setTypeFilter(v);
                        setGroupFilter("");
                        setPage(1);
                      }}
                      options={TYPES.map((t) => ({ value: t, label: TYPE_CONFIG[t]?.label ?? t }))}
                      placeholder="Type exact"
                      clearLabel="Tous types"
                    />
                    <SearchableSelect
                      value={articleId}
                      onChange={(v) => {
                        setArticleId(v);
                        setPage(1);
                      }}
                      options={articles.map((a) => ({
                        value: String(a.id),
                        label: `${a.code} — ${a.libelle ?? a.designation ?? ""}`,
                      }))}
                      placeholder="Article"
                      clearLabel="Tous"
                    />
                    <SearchableSelect
                      value={depotId}
                      onChange={(v) => {
                        setDepotId(v);
                        setPage(1);
                      }}
                      options={depots.map((d) => ({
                        value: String(d.id),
                        label: `${d.code} — ${d.libelle ?? d.nom ?? ""}`,
                      }))}
                      placeholder="Dépôt"
                      clearLabel="Tous"
                    />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setPage(1);
                      }}
                      className={INPUT_CN}
                      aria-label="Date début"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setPage(1);
                      }}
                      className={INPUT_CN}
                      aria-label="Date fin"
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips chips={filterChips} onClearAll={resetFilters} />
            <p className="text-sm text-[var(--text-muted)]">
              Page {page} / {pages} — {total.toLocaleString("fr-FR")} mouvement{total !== 1 ? "s" : ""}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mvt-skeleton h-[72px] rounded-2xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-16 text-center"
            >
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "color-mix(in srgb, var(--accent-primary) 12%, transparent)", color: PRIMARY }}
              >
                <ClipboardList size={28} strokeWidth={1.5} />
              </div>
              <p className="font-display text-lg font-semibold text-[var(--text-primary)]">Aucun mouvement trouvé</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Modifiez les filtres ou créez un nouveau mouvement</p>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className={`mt-4 ${PRIMARY_BTN_CLASSES}`}
                  style={primaryButtonStyle}
                >
                  <Plus size={16} />
                  Nouveau mouvement
                </button>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              variants={listStagger}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="space-y-2.5"
            >
              {items.map((m) => {
                const cfg = TYPE_CONFIG[m.type];
                const isEntree = cfg?.group === "ENTREE";
                const isSortie = cfg?.group === "SORTIE";
                const group = cfg?.group || "TRANSFERT";
                const theme = GROUP_THEME[group] || GROUP_THEME.TRANSFERT;
                const stockApplique = effetStockApplique(m.statut);
                const sign = stockApplique ? (isEntree ? "+" : isSortie ? "−" : "⇄") : "";
                const userName =
                  [m.utilisateur?.prenom, m.utilisateur?.nom].filter(Boolean).join(" ") ||
                  m.utilisateur?.email ||
                  "—";
                const userKey = m.utilisateur?.nom || m.utilisateur?.email || "";

                return (
                  <motion.article
                    key={m.id}
                    variants={rowFade}
                    whileHover={reduceMotion ? undefined : { y: -2, x: 2 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3.5 transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ borderLeft: `3px solid ${theme.accent}` }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        background: `linear-gradient(135deg, color-mix(in srgb, ${theme.accent} 7%, transparent) 0%, transparent 50%)`,
                      }}
                      aria-hidden
                    />
                    <div className="relative grid gap-3 lg:grid-cols-[140px_minmax(120px,auto)_1fr_minmax(120px,auto)_110px_minmax(100px,auto)_auto] lg:items-center">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Date</p>
                        <p className="mt-0.5 text-xs tabular-nums text-[var(--text-secondary)]">
                          {formatDateTime(m.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TypeBadge type={m.type} />
                        <MouvementStatutBadge statut={m.statut} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {m.article?.libelle ?? "—"}
                        </p>
                        <p className="font-mono text-[10px] text-[var(--text-muted)]">{m.article?.code}</p>
                      </div>
                      <div>
                        {m.depotDest ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                            <span className="font-medium" style={{ color: "var(--accent-info, #378ADD)" }}>
                              {m.depot?.code ?? "—"}
                            </span>
                            {stockApplique ? (
                              <motion.span
                                animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
                                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <ArrowRight size={12} style={{ color: PRIMARY }} />
                              </motion.span>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">vers</span>
                            )}
                            <span className="font-medium" style={{ color: "var(--accent-info, #378ADD)" }}>
                              {m.depotDest.code}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">{m.depot?.code ?? "—"}</span>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {m.emplacement ? (
                            <SoftBadge
                              icon={MapPin}
                              title={m.emplacement.libelle || m.emplacement.code}
                            >
                              {m.emplacementDest ? "Orig. " : ""}
                              {m.emplacement.code}
                            </SoftBadge>
                          ) : null}
                          {m.emplacementDest ? (
                            <SoftBadge
                              icon={MapPin}
                              title={m.emplacementDest.libelle || m.emplacementDest.code}
                            >
                              Dest. {m.emplacementDest.code}
                            </SoftBadge>
                          ) : null}
                        </div>
                        <LotsTraceabilite
                          lotsDetail={m.lotsDetail}
                          lot={m.lot}
                          reduceMotion={reduceMotion}
                        />
                      </div>
                      <div className="lg:text-right">
                        <span
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums"
                          style={
                            stockApplique
                              ? { background: theme.bg, color: theme.text }
                              : { background: "var(--bg-hover)", color: "var(--text-secondary)" }
                          }
                        >
                          {sign}
                          {Number(m.quantite || 0).toLocaleString("fr-FR", {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: hashColor(userKey) }}
                        >
                          {initials(m.utilisateur)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs text-[var(--text-secondary)]">{userName}</p>
                          {m.commentaire ? (
                            <p className="truncate text-[10px] text-[var(--text-muted)]" title={m.commentaire}>
                              {m.commentaire}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDetail(m)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:border-[color-mix(in_srgb,var(--accent-primary)_45%,var(--border-default))] hover:text-[var(--text-primary)]"
                          aria-label={`Détail du mouvement ${m.reference || m.article?.libelle || ""}`.trim()}
                        >
                          <Eye size={14} strokeWidth={2} />
                          Détail
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          )}

          <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-3">
            {pages > 1 ? <Pagination page={page} pages={pages} onPageChange={setPage} /> : null}
            <p className="text-[11px] text-[var(--text-muted)]">
              Page {page} sur {pages} — {total.toLocaleString("fr-FR")} mouvement{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <MouvementDetailSheet
        mouvement={detail}
        onClose={() => setDetail(null)}
        onToast={(message) => {
          setToast(message);
          setTimeout(() => setToast(""), 3500);
        }}
      />

      <MouvementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        articles={articles}
        depots={depotsActifs.length ? depotsActifs : depots}
        onSuccess={(row) => {
          setToast(messageCreationMouvement(row));
          setTimeout(() => setToast(""), 3500);
        }}
      />
    </PageShell>
  );
}
