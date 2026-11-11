import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ClipboardList,
  FileDown,
  FileSpreadsheet,
  Printer,
  Target,
  Warehouse,
} from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import { GlassAside } from "../../components/ui/GlassPageHeader";
import api, { downloadAuthenticatedCsv, getAxiosErrorMessage } from "../../services/api";
import { exportInventairePdf } from "../../utils/inventaireReports";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useClientBranding } from "../../hooks/useClientBranding";
import { useAnimatedNumber } from "../superadmin/components/SocieteKpiCard";
import SaisieTable from "./components/SaisieTable";
import DonutChart from "./components/DonutChart";
import EcartBarChart from "./components/EcartBarChart";
import {
  STATUS_MAP,
  computeRecap,
  formatDate,
  formatTnd,
  INV_THEME,
  printFicheInventaire,
} from "./inventaireUtils";

function Ring({ pct, size = 120, accent }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${accent}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums" style={{ color: accent }}>
          {pct}%
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/50">
          progression
        </span>
      </div>
    </div>
  );
}

function InventaireTimeline({ inv }) {
  const reduceMotion = useReducedMotion();
  const events = useMemo(() => {
    const list = [{ at: inv.date, label: `Créé — ${inv.reference}` }];
    if (inv.statut === "VALIDE") list.push({ at: inv.date, label: "Validé" });
    if (inv.statut === "ANNULE") list.push({ at: inv.date, label: "Annulé" });
    return list;
  }, [inv]);

  return (
    <ul className="space-y-2.5">
      {events.map((e, i) => (
        <motion.li
          key={i}
          className="flex items-start gap-2.5 rounded-xl border px-3 py-2"
          style={{
            borderColor: "var(--border-default)",
            background: "color-mix(in srgb, var(--bg-input) 80%, transparent)",
          }}
          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.3 }}
        >
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full"
            style={{ background: INV_THEME.accent, boxShadow: `0 0 8px ${INV_THEME.accent}` }}
          />
          <div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {formatDate(e.at)}
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {e.label}
            </p>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

function MetricChip({ label, value, color, delay = 0 }) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(value, 900);
  return (
    <motion.div
      className="rounded-xl border px-3 py-1.5"
      style={{
        borderColor: `${color}33`,
        background: `${color}12`,
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-sky-200/45">{label}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color }}>
        {Math.round(animated)}
      </p>
    </motion.div>
  );
}

export default function InventaireDetailPage() {
  const { id } = useParams();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const canWrite = hasPermission(user?.role, "stock:write");

  const { data: inv, isLoading, isError, error } = useQuery({
    queryKey: ["inventaire", id, societeScope],
    queryFn: () => api.get(`inventaires/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const lignes = inv?.lignes ?? [];
  const recap = useMemo(() => computeRecap(lignes), [lignes]);
  const topEcarts = useMemo(
    () =>
      [...lignes]
        .filter((l) => l.ecart != null && Math.abs(Number(l.ecart)) >= 1e-9)
        .sort((a, b) => Math.abs(Number(b.ecart)) - Math.abs(Number(a.ecart))),
    [lignes]
  );
  const readOnly = inv?.statut !== "EN_COURS";
  const cfg = STATUS_MAP[inv?.statut] || STATUS_MAP.BROUILLON;
  const accent = cfg.dot || INV_THEME.accent;

  if (isLoading) {
    return (
      <PageShell title="Inventaire" icon={ClipboardList} badge="Contrôle">
        <div className="space-y-4">
          <div className="h-44 animate-pulse rounded-2xl bg-white/5" />
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (isError || !inv) {
    return (
      <PageShell title="Inventaire" icon={ClipboardList} badge="Contrôle">
        <p className="text-red-400">{getAxiosErrorMessage(error) || "Inventaire introuvable"}</p>
        <Link to="/inventaires" className="mt-4 inline-block text-sm text-sky-400">
          Retour à la liste
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={inv.reference}
      subtitle={`${inv.depot?.libelle || "Dépôt"} · ${formatDate(inv.date)}`}
      icon={ClipboardList}
      badge={cfg.label}
      aside={
        <GlassAside
          icon={Target}
          label="Précision"
          value={
            <>
              <span className="tabular-nums text-emerald-300">{recap.precisionPct}%</span>
              {" conforme"}
            </>
          }
        />
      }
      actions={
        <Link
          to="/inventaires"
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Liste
        </Link>
      }
    >
      {/* Cockpit banner */}
      <motion.section
        className="relative overflow-hidden rounded-2xl border"
        style={{
          borderColor: "rgba(55,138,221,0.25)",
          background:
            "linear-gradient(135deg, rgba(17,34,66,0.95) 0%, rgba(12,28,48,0.92) 100%)",
          boxShadow: "0 16px 40px -16px rgba(6,13,26,0.55)",
        }}
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 70% at 0% 50%, rgba(55,138,221,0.25), transparent 55%), radial-gradient(ellipse 40% 50% at 100% 0%, rgba(6,182,212,0.15), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[140px_1fr_auto] lg:items-center">
          <Ring pct={recap.progressionPct} accent={accent} />

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.label}
              </span>
              {readOnly || !canWrite ? (
                <span className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] text-sky-200/50">
                  Lecture seule
                </span>
              ) : (
                <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                  Saisie ouverte
                </span>
              )}
            </div>

            <div>
              <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                {inv.depot?.libelle || "Dépôt"}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-sky-100/60">
                <Warehouse className="h-3.5 w-3.5 text-cyan-300" />
                <span className="font-mono text-cyan-200/80">{inv.depot?.code}</span>
                <span>·</span>
                <span>{formatDate(inv.date)}</span>
                <span>·</span>
                <span className="font-mono text-white/80">{inv.reference}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <MetricChip label="Articles" value={recap.total} color="#7dd3fc" delay={0.05} />
              <MetricChip label="Saisis" value={recap.saisis} color="#67e8f9" delay={0.1} />
              <MetricChip label="Conformes" value={recap.conformes} color="#6ee7b7" delay={0.15} />
              <MetricChip label="Écarts" value={recap.ecarts} color="#fbbf24" delay={0.2} />
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:items-stretch">
            <ActionBtn
              icon={Printer}
              label="Imprimer"
              onClick={() => printFicheInventaire(inv, { masquerTheorique: Boolean(inv?.modeAveugle) })}
              color={INV_THEME.accent}
            />
            <ActionBtn
              icon={FileDown}
              label="PDF"
              onClick={() => exportInventairePdf(inv, clientBranding)}
              color={INV_THEME.cyan}
            />
            <ActionBtn
              icon={FileSpreadsheet}
              label="Excel"
              onClick={() =>
                downloadAuthenticatedCsv(`inventaires/${inv.id}/export`, `${inv.reference}.csv`)
              }
              color={INV_THEME.success}
            />
          </div>
        </div>
      </motion.section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <motion.div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-default)",
            boxShadow: "var(--shadow-card)",
          }}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle, var(--border-default))" }}
          >
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Lignes d&apos;articles
              </h3>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Théorique vs réel · {recap.total} lignes
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums"
              style={{ background: `${accent}18`, color: accent }}
            >
              {formatTnd(recap.valeurEcart)}
            </span>
          </div>
          <div className="p-3 sm:p-4">
            <SaisieTable
              lignes={lignes}
              readOnly={readOnly}
              modeAveugle={Boolean(inv?.modeAveugle)}
              inventaireStatut={inv?.statut || "EN_COURS"}
              onChange={() => {}}
            />
          </div>
        </motion.div>

        <aside className="space-y-4">
          <SidePanel title="Répartition" delay={0.1}>
            <DonutChart
              conformes={recap.conformes}
              manquants={recap.ecartsNeg}
              surplus={recap.ecartsPos}
            />
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-center text-[10px]">
              <MiniStat label="Manquants" value={recap.ecartsNeg} color={INV_THEME.danger} />
              <MiniStat label="Surplus" value={recap.ecartsPos} color={INV_THEME.amber} />
            </div>
          </SidePanel>

          <SidePanel title="Top écarts" delay={0.14}>
            <EcartBarChart items={topEcarts} />
          </SidePanel>

          <SidePanel title="Historique" delay={0.18}>
            <InventaireTimeline inv={inv} />
          </SidePanel>
        </aside>
      </div>
    </PageShell>
  );
}

function ActionBtn({ icon: Icon, label, onClick, color }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-white"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(135deg, ${color}dd, ${color}99)`,
        boxShadow: `0 6px 16px -6px ${color}66`,
      }}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03, filter: "brightness(1.08)" }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.button>
  );
}

function SidePanel({ title, children, delay = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        boxShadow: "var(--shadow-card)",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <h3
        className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div
      className="rounded-lg border px-2 py-1.5"
      style={{ borderColor: `${color}33`, background: `${color}12` }}
    >
      <p className="font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p style={{ color: "var(--text-muted)" }}>{label}</p>
    </div>
  );
}
