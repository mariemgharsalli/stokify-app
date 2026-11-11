import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ChevronDown,
  X,
} from "lucide-react";
import api from "../../../services/api";
import { ACTION_CONFIG, MODULE_CONFIG } from "./activityConfig";

function ActivitySkeleton() {
  return (
    <div className="relative space-y-3 pl-10">
      <div
        className="absolute bottom-0 left-4 top-0 w-px"
        style={{ background: "var(--color-border-tertiary)" }}
      />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-xl border"
          style={{
            background: "var(--color-background-secondary)",
            borderColor: "var(--color-border-tertiary)",
            animation: `pulse 1.5s ease ${i * 100}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function UserActivityLog({ userId }) {
  const [filters, setFilters] = useState({
    module: "",
    action: "",
    from: "",
    to: "",
  });
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const queryParams = useMemo(
    () => ({
      ...(filters.module ? { module: filters.module } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      page,
      limit: 20,
    }),
    [filters, page]
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["user-activity", userId, queryParams],
    queryFn: () =>
      api.get(`users/${userId}/activity`, { params: queryParams }).then((r) => r.data),
    enabled: Boolean(userId),
    placeholderData: (prev) => prev,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const grouped = logs.reduce((acc, log) => {
    const date = new Date(log.createdAt).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {});

  const hasFilters = filters.module || filters.action || filters.from || filters.to;

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-3 rounded-2xl border p-4"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
        }}
      >
        <select
          value={filters.module}
          onChange={(e) => {
            setFilters((f) => ({ ...f, module: e.target.value }));
            setPage(1);
          }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-background-primary)",
            border: "1px solid var(--color-border-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          <option value="">Tous les modules</option>
          {Object.entries(MODULE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={filters.action}
          onChange={(e) => {
            setFilters((f) => ({ ...f, action: e.target.value }));
            setPage(1);
          }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-background-primary)",
            border: "1px solid var(--color-border-tertiary)",
            color: "var(--color-text-primary)",
          }}
        >
          <option value="">Toutes les actions</option>
          {Object.entries(ACTION_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filters.from}
          onChange={(e) => {
            setFilters((f) => ({ ...f, from: e.target.value }));
            setPage(1);
          }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-background-primary)",
            border: "1px solid var(--color-border-tertiary)",
            color: "var(--color-text-primary)",
          }}
        />
        <span className="flex items-center text-xs" style={{ color: "var(--color-text-tertiary)" }}>
          →
        </span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => {
            setFilters((f) => ({ ...f, to: e.target.value }));
            setPage(1);
          }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--color-background-primary)",
            border: "1px solid var(--color-border-tertiary)",
            color: "var(--color-text-primary)",
          }}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters({ module: "", action: "", from: "", to: "" });
              setPage(1);
            }}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm"
            style={{ color: "#E24B4A" }}
          >
            <X className="h-3.5 w-3.5" /> Réinitialiser
          </button>
        )}

        <span
          className="ml-auto flex items-center text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {isFetching && !isLoading ? "Actualisation… · " : ""}
          {total} action{total !== 1 ? "s" : ""} trouvée{total !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <ActivitySkeleton />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "rgba(55,138,221,0.08)" }}
          >
            <Activity className="h-7 w-7" style={{ color: "#378ADD", opacity: 0.4 }} />
          </div>
          <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
            Aucune activité trouvée
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayLogs]) => (
            <div key={date}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: "var(--color-border-tertiary)" }} />
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-medium capitalize"
                  style={{
                    background: "var(--color-background-secondary)",
                    borderColor: "var(--color-border-tertiary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {date}
                </span>
                <div className="h-px flex-1" style={{ background: "var(--color-border-tertiary)" }} />
              </div>

              <div className="relative space-y-1 pl-10">
                <div
                  className="absolute bottom-0 left-4 top-0 w-px"
                  style={{ background: "var(--color-border-tertiary)" }}
                />

                {dayLogs.map((log, i) => {
                  const actionConf = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.CREATE;
                  const moduleConf = MODULE_CONFIG[log.module] ?? {
                    label: log.module,
                    color: "#378ADD",
                  };
                  const Icon = actionConf.icon;
                  const isExpanded = expandedId === log.id;
                  const isError = log.status === "ERROR";
                  const hasDetails =
                    log.details &&
                    typeof log.details === "object" &&
                    Object.keys(log.details).length > 0;

                  return (
                    <div
                      key={log.id}
                      className="relative"
                      style={{ animation: `fadeUp 0.3s ease ${i * 30}ms both` }}
                    >
                      <div
                        className="absolute -left-6 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{
                          background: isError ? "rgba(226,75,74,0.2)" : actionConf.bg,
                          border: "2px solid var(--color-background-primary)",
                        }}
                      >
                        <Icon
                          className="h-2.5 w-2.5"
                          style={{ color: isError ? "#E24B4A" : actionConf.color }}
                        />
                      </div>

                      <div
                        className="rounded-xl border transition-all duration-150"
                        style={{
                          background: isExpanded
                            ? "var(--color-background-secondary)"
                            : "var(--color-background-primary)",
                          borderColor: isError
                            ? "rgba(226,75,74,0.2)"
                            : "var(--color-border-tertiary)",
                          borderLeft: `2px solid ${isError ? "#E24B4A" : actionConf.color}`,
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex cursor-pointer items-center gap-3 px-4 py-3"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedId(isExpanded ? null : log.id);
                            }
                          }}
                        >
                          <span
                            className="flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: actionConf.bg, color: actionConf.color }}
                          >
                            {actionConf.label}
                          </span>

                          <span
                            className="flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              background: `${moduleConf.color}12`,
                              color: moduleConf.color,
                            }}
                          >
                            {moduleConf.label}
                          </span>

                          <span
                            className="flex-1 truncate text-sm"
                            style={{
                              color: isError ? "#E24B4A" : "var(--color-text-primary)",
                            }}
                          >
                            {log.entityLabel ?? `${actionConf.label} — ${moduleConf.label}`}
                          </span>

                          <span
                            className="flex-shrink-0 text-[10px]"
                            style={{ color: "var(--color-text-tertiary)" }}
                          >
                            {new Date(log.createdAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {(hasDetails || log.errorMsg || log.ipAddress) && (
                            <ChevronDown
                              className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
                              style={{
                                color: "var(--color-text-tertiary)",
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          )}
                        </div>

                        {isExpanded && (hasDetails || log.errorMsg || log.ipAddress) && (
                          <div
                            className="border-t px-4 py-3"
                            style={{ borderColor: "var(--color-border-tertiary)" }}
                          >
                            {log.errorMsg && (
                              <div
                                className="mb-2 rounded-lg px-3 py-2 text-xs"
                                style={{
                                  background: "rgba(226,75,74,0.08)",
                                  color: "#E24B4A",
                                }}
                              >
                                Erreur : {log.errorMsg}
                              </div>
                            )}

                            <div className="space-y-1.5">
                              {hasDetails &&
                                Object.entries(log.details).map(([k, v]) => (
                                  <div key={k} className="flex items-start gap-3 text-xs">
                                    <span
                                      className="w-24 flex-shrink-0 font-medium"
                                      style={{ color: "var(--color-text-tertiary)" }}
                                    >
                                      {k}
                                    </span>
                                    <span
                                      className="break-all font-mono text-[10px]"
                                      style={{ color: "var(--color-text-secondary)" }}
                                    >
                                      {typeof v === "object"
                                        ? JSON.stringify(v, null, 2)
                                        : String(v)}
                                    </span>
                                  </div>
                                ))}
                              {log.ipAddress && (
                                <div className="flex items-center gap-3 text-xs">
                                  <span
                                    className="w-24 flex-shrink-0 font-medium"
                                    style={{ color: "var(--color-text-tertiary)" }}
                                  >
                                    IP
                                  </span>
                                  <span
                                    className="font-mono text-[10px]"
                                    style={{ color: "var(--color-text-secondary)" }}
                                  >
                                    {log.ipAddress}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
            Page {page} / {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
              style={{
                borderColor: "var(--color-border-tertiary)",
                color: "var(--color-text-secondary)",
              }}
            >
              ← Précédent
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40"
              style={{
                borderColor: "var(--color-border-tertiary)",
                color: "var(--color-text-secondary)",
              }}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
