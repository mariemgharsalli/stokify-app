import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../../services/api";
import { ACTION_CONFIG, MODULE_CONFIG } from "./activityConfig";

export default function UserStats({ userId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-stats", userId],
    queryFn: () =>
      api.get(`users/${userId}/activity`, { params: { limit: 1000 } }).then((r) => r.data),
    enabled: Boolean(userId),
  });

  const logs = data?.logs ?? [];

  const byModule = useMemo(
    () =>
      Object.entries(
        logs.reduce((acc, l) => {
          acc[l.module] = (acc[l.module] ?? 0) + 1;
          return acc;
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [logs]
  );

  const byAction = useMemo(
    () =>
      Object.entries(
        logs.reduce((acc, l) => {
          acc[l.action] = (acc[l.action] ?? 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1]),
    [logs]
  );

  const byHour = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        count: logs.filter((l) => new Date(l.createdAt).getHours() === h).length,
      })),
    [logs]
  );

  const last7 = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        return {
          date: dateStr,
          count: logs.filter((l) => {
            const ld = new Date(l.createdAt);
            return ld.toDateString() === d.toDateString();
          }).length,
        };
      }),
    [logs]
  );

  const maxHour = Math.max(...byHour.map((h) => h.count), 1);
  const max7 = Math.max(...last7.map((d) => d.count), 1);
  const total = logs.length || 1;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl border"
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

  if (logs.length === 0) {
    return (
      <div
        className="rounded-2xl border p-10 text-center text-sm"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
          color: "var(--color-text-tertiary)",
        }}
      >
        Pas assez de données pour afficher des statistiques.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div
        className="rounded-2xl border p-5"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
        }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Modules les plus utilisés
        </h3>
        <div className="space-y-3">
          {byModule.map(([mod, count]) => {
            const conf = MODULE_CONFIG[mod] ?? { label: mod, color: "#378ADD" };
            return (
              <div key={mod}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {conf.label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: conf.color }}>
                    {count}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: "var(--color-background-primary)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(count / total) * 100}%`,
                      background: conf.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
        }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Répartition des actions
        </h3>
        <div className="space-y-3">
          {byAction.map(([action, count]) => {
            const conf = ACTION_CONFIG[action] ?? {
              label: action,
              color: "#378ADD",
              bg: "transparent",
              icon: ACTION_CONFIG.CREATE.icon,
            };
            const Icon = conf.icon;
            return (
              <div key={action} className="flex items-center gap-3">
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: conf.bg }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: conf.color }} />
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex justify-between">
                    <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {conf.label}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                      {count}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--color-background-primary)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / total) * 100}%`,
                        background: conf.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
        }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Activité des 7 derniers jours
        </h3>
        <div className="flex h-24 items-end gap-2">
          {last7.map((d, i) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span
                className="text-[9px]"
                style={{ color: "#378ADD", opacity: d.count > 0 ? 1 : 0 }}
              >
                {d.count}
              </span>
              <div
                className="w-full rounded-t-lg transition-all duration-700"
                style={{
                  height: `${Math.max(4, (d.count / max7) * 80)}px`,
                  background:
                    d.count > 0
                      ? "linear-gradient(to top, #378ADD, #7F77DD)"
                      : "var(--color-background-primary)",
                  animation: `fadeUp 0.4s ease ${i * 60}ms both`,
                }}
              />
              <span className="text-[9px]" style={{ color: "var(--color-text-tertiary)" }}>
                {d.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
        }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Heures d&apos;activité
        </h3>
        <div className="flex h-16 items-end gap-0.5">
          {byHour.map((h, i) => (
            <div
              key={h.hour}
              className="flex flex-1 flex-col items-center"
              title={`${h.hour}h : ${h.count} actions`}
            >
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: `${Math.max(2, (h.count / maxHour) * 56)}px`,
                  background:
                    h.count > 0
                      ? `rgba(55,138,221,${0.3 + (h.count / maxHour) * 0.7})`
                      : "var(--color-background-primary)",
                  animation: `fadeUp 0.3s ease ${i * 20}ms both`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between">
          {["0h", "6h", "12h", "18h", "23h"].map((h) => (
            <span key={h} className="text-[9px]" style={{ color: "var(--color-text-tertiary)" }}>
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
