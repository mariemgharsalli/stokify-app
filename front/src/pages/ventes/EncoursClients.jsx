import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  IconAlertTriangle,
  IconCash,
  IconClockHour4,
  IconFilter,
  IconLoader2,
  IconMail,
  IconSearch,
  IconShieldExclamation,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import { formatDate, hashColor, initials, num3 } from "../../utils/commerceUi";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle, STOKIFY_BLUE } from "../../utils/brandStyles";

const SUCCESS = "var(--accent-success)";
const WARNING = "var(--accent-warning)";
const DANGER = "var(--accent-danger)";
const PURPLE = "var(--accent-primary)";

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
  visible: { transition: { staggerChildren: 0.045 } },
};

const rowFade = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

function statutMeta(jours) {
  const j = Number(jours) || 0;
  if (j > 90) return { color: "var(--accent-danger)", label: `${j} j. de retard`, tone: "critique", bucket: "90p" };
  if (j > 60) return { color: "var(--accent-danger)", label: `${j} j. de retard`, tone: "critique", bucket: "61_90" };
  if (j > 30) return { color: "var(--accent-warning)", label: `${j} j. de retard`, tone: "retard", bucket: "31_60" };
  if (j > 0) return { color: "var(--accent-success)", label: `${j} j. de retard`, tone: "ok", bucket: "0_30" };
  return { color: "var(--accent-success)", label: "À jour", tone: "ok", bucket: "0_30" };
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

function KpiTile({ icon: Icon, label, value, hint, accent, index, reduceMotion, pulse, isCurrency }) {
  const animated = useAnimatedNumber(value, 1100);
  const display = isCurrency
    ? `${Number(animated).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`
    : Math.round(animated).toLocaleString("fr-FR");

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`group relative overflow-hidden rounded-2xl border bg-[var(--bg-card)] p-4 ${
        pulse ? "encours-kpi-pulse" : "border-[var(--border-default)]"
      }`}
      style={pulse ? { "--kpi-accent": accent, borderColor: `${accent}55` } : undefined}
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
        style={{ background: `linear-gradient(135deg, ${accent}0f 0%, transparent 55%)` }}
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
              background: `linear-gradient(145deg, ${accent}18, transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}28`,
            }}
          >
            <Icon size={20} stroke={1.75} />
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
          style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.18 + index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

function AgingBar({ buckets, total, reduceMotion }) {
  if (!total) return null;
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
          background: `linear-gradient(90deg, transparent, ${SUCCESS}88, ${WARNING}88, ${DANGER}88, transparent)`,
        }}
        aria-hidden
      />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Répartition du risque</p>
          <p className="text-[11px] text-[var(--text-muted)]">Encours ventilé par ancienneté des créances</p>
        </div>
        <p className="text-xs tabular-nums text-[var(--text-secondary)]">
          Total <span className="font-semibold text-[var(--text-primary)]">{num3(total)}</span>
        </p>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--bg-hover)]">
        {buckets.map((b, i) => {
          const pct = total > 0 ? (b.amount / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <motion.div
              key={b.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ background: b.color }}
              initial={reduceMotion ? { width: `${pct}%` } : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.85, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              title={`${b.label}: ${num3(b.amount)}`}
            />
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b, i) => {
          const pct = total > 0 ? Math.round((b.amount / total) * 100) : 0;
          return (
            <motion.div
              key={b.key}
              custom={i}
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="flex items-center gap-2.5 rounded-xl bg-[var(--bg-hover)]/60 px-3 py-2"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">{b.label}</p>
                <p className="truncate text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                  {num3(b.amount)}
                  <span className="ml-1.5 text-[10px] font-medium text-[var(--text-muted)]">{pct}%</span>
                </p>
              </div>
              <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{b.count}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

function ClientRow({ row, maxEncours, index, reduceMotion, onRelancer, relancing, onOpen }) {
  const meta = statutMeta(row.joursRetardMax);
  const encours = Number(row.encours) || 0;
  const barPct = maxEncours > 0 ? (encours / maxEncours) * 100 : 0;
  const plafond = Number(row.plafondCredit) || 0;
  const usagePct = plafond > 0 ? Math.min(100, (encours / plafond) * 100) : null;
  const avatarBg = hashColor(row.client?.nom || row.clientId);

  return (
    <motion.tr
      variants={rowFade}
      layout
      className="group border-b border-[var(--border-default)] transition-colors duration-150 hover:bg-[var(--bg-hover)]/70"
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white shadow-sm"
            style={{ background: `linear-gradient(145deg, ${avatarBg}, ${avatarBg}cc)` }}
          >
            {initials(row.client?.nom)}
            {meta.tone === "critique" ? (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--bg-card)]"
                style={{
                  background: DANGER,
                  animation: reduceMotion ? undefined : "encoursPulseDot 1.6s ease-in-out infinite",
                }}
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              className="truncate text-left text-sm font-semibold text-[var(--text-link)] hover:underline"
              onClick={() => onOpen(row.clientId)}
            >
              {row.client?.nom || "—"}
            </button>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {row.client?.code ? (
                <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{row.client.code}</span>
              ) : null}
              {row.depassement ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${DANGER}18`, color: DANGER }}
                >
                  <IconAlertTriangle size={11} />
                  Plafond
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <div className="min-w-[140px]">
          <p className="text-right font-display text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {num3(encours)}
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${meta.color}99, ${meta.color})` }}
              initial={reduceMotion ? { width: `${barPct}%` } : { width: 0 }}
              animate={{ width: `${Math.max(barPct, 3)}%` }}
              transition={{ duration: 0.7, delay: 0.12 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {usagePct != null ? (
            <p className="mt-1 text-right text-[10px] text-[var(--text-muted)]">
              {Math.round(usagePct)}% du plafond
            </p>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-3.5 text-right">
        <span
          className="inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold tabular-nums"
          style={{ background: `${STOKIFY_BLUE}14`, color: STOKIFY_BLUE }}
        >
          {row.nbFacturesImpayees || 0}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <IconClockHour4 size={14} className="shrink-0 opacity-60" />
          <span className="tabular-nums">{formatDate(row.plusAncienneFacture)}</span>
        </div>
      </td>

      <td className="px-4 py-3.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: `${meta.color}16`, color: meta.color }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: meta.color,
              animation:
                meta.tone === "critique" && !reduceMotion
                  ? "encoursPulseDot 1.4s ease-in-out infinite"
                  : undefined,
            }}
          />
          {meta.label}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <motion.button
          type="button"
          disabled={relancing}
          onClick={() => onRelancer(row.clientId)}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:brightness-110 disabled:opacity-50"
          style={{
            borderColor: `${meta.color}50`,
            color: meta.color,
            background: `${meta.color}0a`,
          }}
        >
          {relancing ? <IconLoader2 size={14} className="animate-spin" /> : <IconMail size={14} />}
          Relancer
        </motion.button>
      </td>
    </motion.tr>
  );
}

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "ok", label: "À jour" },
  { key: "retard", label: "En retard" },
  { key: "critique", label: "Critiques" },
  { key: "depassement", label: "Plafond" },
];

export default function EncoursClients() {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [relancingId, setRelancingId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["clients-encours", societeScope],
    queryFn: () => api.get("clients/encours").then((r) => r.data),
  });

  const relancerMutation = useMutation({
    mutationFn: (clientId) => api.post(`clients/${clientId}/relancer`),
    onMutate: (clientId) => setRelancingId(clientId),
    onSuccess: (res) => {
      toast.success(`Relance envoyée à ${res.data.email}`);
      qc.invalidateQueries({ queryKey: ["clients-encours"] });
      qc.invalidateQueries({ queryKey: ["factures-relances"] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
    onSettled: () => setRelancingId(null),
  });

  const relancerTousMutation = useMutation({
    mutationFn: async () => {
      const list = data?.items || [];
      for (const row of list) {
        await api.post(`clients/${row.clientId}/relancer`);
      }
    },
    onSuccess: () => {
      toast.success("Relances envoyées à tous les clients concernés");
      qc.invalidateQueries({ queryKey: ["clients-encours"] });
      qc.invalidateQueries({ queryKey: ["factures-relances"] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const items = data?.items || [];

  const stats = useMemo(() => {
    let total = 0;
    let critiques = 0;
    let retards = 0;
    let depassements = 0;
    let ok = 0;
    const amounts = { b0: 0, b31: 0, b61: 0, b90: 0 };
    const counts = { b0: 0, b31: 0, b61: 0, b90: 0 };

    for (const row of items) {
      const enc = Number(row.encours) || 0;
      const j = Number(row.joursRetardMax) || 0;
      total += enc;
      if (row.depassement) depassements += 1;
      if (j > 90) {
        critiques += 1;
        amounts.b90 += enc;
        counts.b90 += 1;
      } else if (j > 60) {
        critiques += 1;
        amounts.b61 += enc;
        counts.b61 += 1;
      } else if (j > 30) {
        retards += 1;
        amounts.b31 += enc;
        counts.b31 += 1;
      } else {
        ok += 1;
        amounts.b0 += enc;
        counts.b0 += 1;
      }
    }

    return {
      total,
      clients: items.length,
      critiques,
      retards,
      depassements,
      ok,
      buckets: [
        { key: "0_30", label: "0 – 30 jours", amount: amounts.b0, count: counts.b0, color: "var(--accent-success)" },
        { key: "31_60", label: "31 – 60 jours", amount: amounts.b31, count: counts.b31, color: "var(--accent-warning)" },
        { key: "61_90", label: "61 – 90 jours", amount: amounts.b61, count: counts.b61, color: "var(--accent-danger)" },
        { key: "90p", label: "+ 90 jours", amount: amounts.b90, count: counts.b90, color: "var(--accent-danger)" },
      ],
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      const meta = statutMeta(row.joursRetardMax);
      if (filter === "ok" && meta.tone !== "ok") return false;
      if (filter === "retard" && meta.tone !== "retard") return false;
      if (filter === "critique" && meta.tone !== "critique") return false;
      if (filter === "depassement" && !row.depassement) return false;
      if (!q) return true;
      const nom = String(row.client?.nom || "").toLowerCase();
      const code = String(row.client?.code || "").toLowerCase();
      return nom.includes(q) || code.includes(q);
    });
  }, [items, search, filter]);

  const maxEncours = useMemo(
    () => (filtered.length ? Math.max(...filtered.map((r) => Number(r.encours) || 0)) : 0),
    [filtered]
  );

  const filterCounts = useMemo(
    () => ({
      all: items.length,
      ok: stats.ok,
      retard: stats.retards,
      critique: stats.critiques,
      depassement: stats.depassements,
    }),
    [items.length, stats]
  );

  return (
    <PageShell
      title="Encours clients"
      subtitle="Suivi dynamique des créances, risque de retard et relances de paiement"
      actions={
        items.length > 0 ? (
          <motion.button
            type="button"
            disabled={relancerTousMutation.isPending}
            onClick={() => relancerTousMutation.mutate()}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className={PRIMARY_BTN_CLASSES}
            style={primaryButtonStyle}
          >
            {relancerTousMutation.isPending ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconMail size={16} />
            )}
            Relancer tous
          </motion.button>
        ) : null
      }
    >
      <style>{`
        @keyframes encoursShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes encoursPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.85); }
        }
        @keyframes encoursKpiPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent);
          }
          50% {
            box-shadow: 0 0 22px 2px color-mix(in srgb, var(--kpi-accent) 28%, transparent);
          }
        }
        .encours-skeleton {
          background: linear-gradient(
            90deg,
            var(--bg-hover) 25%,
            color-mix(in srgb, var(--bg-card) 60%, var(--bg-hover)) 50%,
            var(--bg-hover) 75%
          );
          background-size: 200% 100%;
          animation: encoursShimmer 1.4s ease-in-out infinite;
        }
        .encours-kpi-pulse {
          animation: encoursKpiPulse 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .encours-skeleton,
          .encours-kpi-pulse {
            animation: none !important;
          }
        }
      `}</style>

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            index={0}
            reduceMotion={reduceMotion}
            icon={IconCash}
            label="Créances totales"
            value={stats.total}
            isCurrency
            hint="TND"
            accent={PURPLE}
          />
          <KpiTile
            index={1}
            reduceMotion={reduceMotion}
            icon={IconUsers}
            label="Clients concernés"
            value={stats.clients}
            hint="avec solde"
            accent={STOKIFY_BLUE}
          />
          <KpiTile
            index={2}
            reduceMotion={reduceMotion}
            icon={IconShieldExclamation}
            label="Critiques"
            value={stats.critiques}
            hint="> 60 / +90 j"
            accent={DANGER}
            pulse={stats.critiques > 0}
          />
          <KpiTile
            index={3}
            reduceMotion={reduceMotion}
            icon={IconAlertTriangle}
            label="Plafonds dépassés"
            value={stats.depassements}
            hint="crédit"
            accent={WARNING}
            pulse={stats.depassements > 0}
          />
        </div>

        {!isLoading && items.length > 0 ? (
          <AgingBar buckets={stats.buckets} total={stats.total} reduceMotion={reduceMotion} />
        ) : null}

        <motion.section
          custom={5}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${PURPLE}66, ${STOKIFY_BLUE}66, transparent)`,
            }}
            aria-hidden
          />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: `${PURPLE}18`, color: PURPLE }}
              >
                <IconFilter size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Filtrer le portefeuille</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {filtered.length} client{filtered.length !== 1 ? "s" : ""} affiché
                  {filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="relative w-full max-w-sm">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un client…"
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] py-2 pl-9 pr-9 text-sm text-[var(--text-primary)] outline-none transition focus:border-[color-mix(in_srgb,#7F77DD_55%,transparent)] focus:ring-2 focus:ring-[rgba(127,119,221,0.2)]"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  aria-label="Effacer la recherche"
                >
                  <IconX size={14} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count = filterCounts[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                    active
                      ? "text-white shadow-sm"
                      : "border border-[var(--border-default)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                  style={
                    active ? { background: `linear-gradient(135deg, ${PURPLE}, ${STOKIFY_BLUE})` } : undefined
                  }
                >
                  {f.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      active ? "bg-white/20" : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.section>

        <motion.div
          custom={6}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
        >
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="encours-skeleton h-14 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="relative overflow-hidden px-6 py-20 text-center">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background:
                    "radial-gradient(ellipse 50% 60% at 50% 40%, rgba(127,119,221,0.12), transparent)",
                }}
                aria-hidden
              />
              <motion.div
                initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative"
              >
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: `${SUCCESS}14`, color: SUCCESS }}
                >
                  <IconUsers size={32} stroke={1.5} />
                </div>
                <p className="font-display text-lg font-semibold text-[var(--text-primary)]">
                  Portefeuille à jour
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
                  Aucun client avec encours impayé pour le moment.
                </p>
              </motion.div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-[var(--text-secondary)]">
              Aucun résultat pour ces filtres.
              <button
                type="button"
                className="mx-auto mt-3 block text-xs font-semibold hover:underline"
                style={{ color: PURPLE }}
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Réinitialiser
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] bg-[var(--bg-app)]/80 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 text-right font-medium">Encours</th>
                    <th className="px-4 py-3 text-right font-medium">Factures</th>
                    <th className="px-4 py-3 font-medium">Plus ancienne</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={listStagger}
                  initial={reduceMotion ? false : "hidden"}
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {filtered.map((row, i) => (
                      <ClientRow
                        key={row.clientId}
                        row={row}
                        index={i}
                        maxEncours={maxEncours}
                        reduceMotion={reduceMotion}
                        relancing={relancingId === row.clientId}
                        onRelancer={(id) => relancerMutation.mutate(id)}
                        onOpen={(id) => navigate(`/ventes?clientId=${id}`)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </PageShell>
  );
}
