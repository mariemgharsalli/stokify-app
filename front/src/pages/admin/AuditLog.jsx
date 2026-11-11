import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import KpiCard from "../../components/ui/KpiCard";
import SearchableSelect from "../../components/ui/SearchableSelect";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { exportCsvFromRows } from "../../utils/exportHelpers";

const DS = {
  blue: "#378ADD",
  teal: "#1D9E75",
  amber: "#BA7517",
  red: "#E24B4A",
  violet: "#7F77DD",
};

const ACTION_ICONS = {
  CREATE_USER: { icon: UserPlus, color: DS.teal },
  CREATE: { icon: Plus, color: DS.teal },
  UPDATE_ROLE: { icon: UserCog, color: DS.violet },
  UPDATE_PERMISSIONS: { icon: KeyRound, color: DS.violet },
  RESET_PERMISSIONS: { icon: KeyRound, color: DS.amber },
  USER_DEACTIVATE: { icon: UserMinus, color: DS.red },
  USER_ACTIVATE: { icon: UserPlus, color: DS.teal },
  UPDATE_STATUS: { icon: UserMinus, color: DS.red },
  SOCIETE_DEACTIVATE: { icon: ShieldAlert, color: DS.red },
  SOCIETE_ACTIVATE: { icon: Shield, color: DS.teal },
  PASSWORD_CHANGE: { icon: KeyRound, color: DS.amber },
  PASSWORD_RESET_REQUEST: { icon: KeyRound, color: DS.amber },
  RESET_PASSWORD: { icon: KeyRound, color: DS.amber },
  UPDATE: { icon: Pencil, color: DS.blue },
  DELETE: { icon: Trash2, color: DS.red },
  LOGIN_FAIL: { icon: Lock, color: DS.red },
  LOGIN: { icon: LogIn, color: DS.violet },
  LOGOUT: { icon: LogOut, color: DS.violet },
  ERROR: { icon: Shield, color: DS.red },
};

const SENSITIVE_PATTERNS = [
  "UPDATE_ROLE",
  "USER_DEACTIVATE",
  "UPDATE_STATUS",
  "LOGIN_FAIL",
  "SOCIETE_DEACTIVATE",
  "UPDATE_PERMISSIONS",
];

function resolveIcon(action) {
  const a = String(action || "").toUpperCase();
  const exact = ACTION_ICONS[a];
  if (exact) return exact;
  const key = Object.keys(ACTION_ICONS).find((k) => a.includes(k));
  return ACTION_ICONS[key] || { icon: Shield, color: "#94a3b8" };
}

function isSensitive(action) {
  const a = String(action || "").toUpperCase();
  return SENSITIVE_PATTERNS.some((p) => a.includes(p));
}

function initials(u) {
  return `${u?.prenom?.[0] || ""}${u?.nom?.[0] || ""}`.toUpperCase() || "?";
}

export default function AuditLog() {
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    userId: "",
    action: "",
    entite: "",
    from: "",
    to: "",
    search: "",
  });

  const { data: usersData } = useQuery({
    queryKey: ["users-audit", societeScope],
    queryFn: () => api.get("users", { params: { limit: 100 } }).then((r) => r.data),
  });
  const users = usersData?.items ?? usersData ?? [];

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["audit-log", societeScope, page, filters],
    queryFn: () =>
      api
        .get("users/audit-log", {
          params: {
            page,
            limit: 50,
            ...(filters.userId ? { userId: filters.userId } : {}),
            ...(filters.action ? { action: filters.action } : {}),
            ...(filters.entite ? { entite: filters.entite } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
            ...(filters.search ? { search: filters.search } : {}),
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const kpis = data?.kpis || {};

  const filterOptions = useMemo(
    () => ({
      actions: [
        "CREATE",
        "CREATE_USER",
        "UPDATE",
        "UPDATE_ROLE",
        "UPDATE_PERMISSIONS",
        "DELETE",
        "LOGIN",
        "LOGIN_FAIL",
        "USER_DEACTIVATE",
        "PASSWORD_CHANGE",
        "RAPPEL",
      ],
      entites: ["Article", "Lot", "Vente", "Achat", "Mouvement", "Auth", "Utilisateur", "Societe", "Lots"],
    }),
    []
  );

  const exportCsv = () => {
    if (!items.length) return toast.error("Aucune entrée à exporter");
    exportCsvFromRows(
      items.map((ev) => ({
        Date: new Date(ev.createdAt).toISOString(),
        Utilisateur: `${ev.utilisateur?.prenom || ""} ${ev.utilisateur?.nom || ""}`.trim(),
        Action: ev.action,
        Entité: ev.entite || ev.module,
        Description: ev.description || "",
        IP: ev.ip || "",
      })),
      "audit-log.csv"
    );
    toast.success("Export CSV téléchargé");
  };

  return (
    <PageShell
      title="Journal d'audit"
      subtitle="Historique des actions utilisateurs"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm transition-colors duration-200 hover:bg-white/5"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      }
    >
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard title="Actions aujourd'hui" value={kpis.actionsToday ?? 0} icon={Shield} accentColor={DS.blue} delayIndex={0} />
        <KpiCard title="Utilisateurs actifs" value={kpis.usersActive ?? 0} icon={LogIn} accentColor={DS.teal} delayIndex={1} />
        <KpiCard title="Actions critiques" value={kpis.criticalErrors ?? 0} icon={Trash2} accentColor={DS.red} delayIndex={2} pulse={kpis.criticalErrors > 0} />
        <KpiCard title="Connexions échouées" value={kpis.failedLogins ?? 0} icon={Lock} accentColor={DS.amber} delayIndex={3} />
      </div>

      <div className="glass mb-4 flex flex-wrap items-end gap-3 rounded-xl p-4">
        <div className="w-44">
          <SearchableSelect
            label="Utilisateur"
            value={filters.userId}
            onChange={(v) => {
              setFilters((f) => ({ ...f, userId: v }));
              setPage(1);
            }}
            options={users.map((u) => ({ value: String(u.id), label: `${u.prenom} ${u.nom}` }))}
            placeholder="Tous"
            clearLabel="Tous"
          />
        </div>
        <select
          value={filters.action}
          onChange={(e) => {
            setFilters((f) => ({ ...f, action: e.target.value }));
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        >
          <option value="">Type action</option>
          {filterOptions.actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filters.entite}
          onChange={(e) => {
            setFilters((f) => ({ ...f, entite: e.target.value }));
            setPage(1);
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        >
          <option value="">Entité</option>
          {filterOptions.entites.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
        <input
          placeholder="Recherche…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
      </div>

      <div className="glass rounded-xl p-5">
        {isLoading && !items.length ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : isError ? (
          <p className="text-[#E24B4A]">{getAxiosErrorMessage(error)}</p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.ul
              key={`page-${page}-${filters.action}-${filters.userId}-${filters.entite}`}
              className="space-y-0"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: isFetching && items.length ? 0.72 : 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {items.map((ev, i) => {
                const { icon: Icon, color } = resolveIcon(ev.action);
                const sensitive = isSensitive(ev.action);
                return (
                  <motion.li
                    key={ev.id}
                    className="group relative flex gap-4 rounded-lg px-2 py-3 transition-colors duration-200 last:pb-0 hover:bg-[color-mix(in_srgb,#378ADD_8%,transparent)]"
                    style={
                      sensitive
                        ? {
                            background: `color-mix(in srgb, ${DS.red} 6%, transparent)`,
                            boxShadow: `inset 3px 0 0 color-mix(in srgb, ${DS.red} 45%, transparent)`,
                          }
                        : undefined
                    }
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(i, 24) * 0.035, ease: "easeOut" }}
                  >
                    {i < items.length - 1 && (
                      <span className="absolute left-[27px] top-12 bottom-0 w-px bg-white/10" />
                    )}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${color}22`, color }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {new Date(ev.createdAt).toLocaleString("fr-FR")}
                        </span>
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{
                            background: `color-mix(in srgb, ${DS.violet} 28%, transparent)`,
                            color: "#ddd6fe",
                          }}
                        >
                          {initials(ev.utilisateur)}
                        </span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {ev.utilisateur?.prenom} {ev.utilisateur?.nom}
                        </span>
                        {sensitive && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                            style={{
                              color: DS.red,
                              background: `color-mix(in srgb, ${DS.red} 12%, transparent)`,
                            }}
                          >
                            sensible
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {ev.description || `${ev.action} — ${ev.module}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        {ev.entite || ev.module}
                        {ev.entiteId ? ` #${ev.entiteId}` : ""}
                        {ev.ip ? ` · ${ev.ip}` : ""}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
              {!items.length && (
                <li className="py-8 text-center text-[var(--text-muted)]">Aucune entrée</li>
              )}
            </motion.ul>
          </AnimatePresence>
        )}

        {data?.totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-white/10 px-3 py-1 text-sm transition-opacity duration-200 disabled:opacity-40"
            >
              Préc.
            </button>
            <span className="text-sm text-[var(--text-muted)]">
              {page} / {data.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 px-3 py-1 text-sm transition-opacity duration-200 disabled:opacity-40"
            >
              Suiv.
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
