import { Building2, Trophy } from "lucide-react";
import { formatTnd } from "../comptabiliteUtils";

function TopList({ title, subtitle, items, valueKey, barColor, valueColor, rankColors }) {
  const max = items[0]?.[valueKey] || 1;

  return (
    <div className="animate-fade-up rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:px-[18px] md:py-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
        {title}
      </div>
      <p className="mb-3.5 text-[11px] text-[var(--text-muted)]">{subtitle}</p>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--text-muted)]">Aucune donnée sur la période.</p>
      ) : (
        items.map((item, i) => {
          const val = Number(item[valueKey] || 0);
          const pct = max > 0 ? (val / max) * 100 : 0;
          const rankStyle = rankColors?.[i] || { bg: "rgba(55,138,221,0.1)", color: "#378ADD" };
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 py-1.5 ${
                i < items.length - 1 ? "border-b border-[var(--border-default)]" : ""
              }`}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                style={{ background: rankStyle.bg, color: rankStyle.color }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-[var(--text-primary)]">{item.nom}</div>
                <div className="mt-1 h-1 overflow-hidden rounded-sm bg-[var(--border-default)]">
                  <div
                    className="h-full rounded-sm transition-[width] duration-1000"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: valueColor }}>
                {formatTnd(val)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function ComptabiliteTopLists({ topClients = [], topFournisseurs = [] }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <TopList
        title={
          <>
            <Trophy className="h-4 w-4 text-[#EF9F27]" aria-hidden />
            Top 5 clients — CA
          </>
        }
        subtitle="Classement par chiffre d'affaires"
        items={topClients}
        valueKey="ca"
        barColor="#7F77DD"
        valueColor="#7F77DD"
        rankColors={[
          { bg: "rgba(239,159,39,0.15)", color: "#EF9F27" },
          { bg: "rgba(136,135,128,0.12)", color: "#888780" },
          { bg: "rgba(127,119,221,0.12)", color: "#7F77DD" },
        ]}
      />
      <TopList
        title={
          <>
            <Building2 className="h-4 w-4 text-[#378ADD]" aria-hidden />
            Top 5 fournisseurs — Achats
          </>
        }
        subtitle="Classement par volume d'achats"
        items={topFournisseurs}
        valueKey="total"
        barColor="#378ADD"
        valueColor="#378ADD"
      />
    </div>
  );
}
