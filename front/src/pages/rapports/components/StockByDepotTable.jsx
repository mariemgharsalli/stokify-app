import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Warehouse } from "lucide-react";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import { useChartTheme } from "../../../hooks/useChartTheme";
import { DEPOT_COLORS, formatMoney } from "../rapportUtils";
import ChartCard from "./ChartCard";

export default function StockByDepotTable({ items = [], loading }) {
  useChartTheme();
  const [sortBy, setSortBy] = useState({ key: "valeur", dir: "desc" });
  const [depotFilter, setDepotFilter] = useState("");

  function toggleSort(key) {
    setSortBy((s) =>
      s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }
    );
  }

  const depotOptions = useMemo(
    () =>
      items.map((d) => ({
        value: String(d.depot),
        label: String(d.depot),
      })),
    [items]
  );

  const rowsByValue = useMemo(() => {
    return [...items]
      .map((d) => ({
        depot: d.depot,
        valeur: Number(d.valeur || 0),
        quantite: Number(d.quantite || 0),
      }))
      .sort((a, b) => b.valeur - a.valeur);
  }, [items]);

  const rows = useMemo(() => {
    const scoped = depotFilter
      ? rowsByValue.filter((d) => String(d.depot) === depotFilter)
      : [...rowsByValue];
    scoped.sort((a, b) => {
      const av = a[sortBy.key] ?? 0;
      const bv = b[sortBy.key] ?? 0;
      if (sortBy.key === "depot") {
        return sortBy.dir === "desc"
          ? String(bv).localeCompare(String(av), "fr")
          : String(av).localeCompare(String(bv), "fr");
      }
      return sortBy.dir === "desc" ? bv - av : av - bv;
    });
    return scoped;
  }, [rowsByValue, sortBy, depotFilter]);

  const totalAll = rowsByValue.reduce((s, d) => s + d.valeur, 0);
  const total = rows.reduce((s, d) => s + d.valeur, 0);
  const top = rowsByValue[0];
  const topPct = totalAll > 0 && top ? ((top.valeur / totalAll) * 100).toFixed(0) : null;
  const insight =
    top && topPct != null
      ? `Top dépôt : ${top.depot} — ${topPct}% de la valeur totale`
      : "Aucune donnée de stock";

  const SortTh = ({ label, sortKey, align = "left" }) => {
    const active = sortBy.key === sortKey;
    return (
      <th
        className={`cursor-pointer select-none px-3 py-2 text-[10px] font-semibold uppercase tracking-wider ${
          align === "right" ? "text-right" : "text-left"
        }`}
        style={{ color: active ? "var(--accent-primary)" : "var(--text-muted)" }}
        onClick={() => toggleSort(sortKey)}
      >
        {label}
        {active ? (sortBy.dir === "desc" ? " ↓" : " ↑") : ""}
      </th>
    );
  };

  return (
    <ChartCard
      loading={loading}
      loadingHeight="h-40"
      icon={Warehouse}
      title="Valeur du stock par dépôt"
      subtitle={insight}
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <SearchableSelect
            value={depotFilter}
            onChange={setDepotFilter}
            options={depotOptions}
            placeholder="Tous les dépôts"
            clearLabel="Tous les dépôts"
            searchPlaceholder="Rechercher un dépôt…"
            aria-label="Filtrer le tableau par dépôt"
            className="min-w-[180px] sm:min-w-[200px]"
          />
          <div className="text-right">
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {depotFilter ? "Total filtré" : "Total global"}
            </p>
            <p className="text-lg font-bold" style={{ color: "var(--accent-primary)" }}>
              {formatMoney(total)}
            </p>
          </div>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border-default)" }}>
              <SortTh label="Dépôt" sortKey="depot" />
              <SortTh label="Quantité" sortKey="quantite" align="right" />
              <SortTh label="Valeur" sortKey="valeur" align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => {
              const pct = total > 0 ? (d.valeur / total) * 100 : 0;
              const color = DEPOT_COLORS[i % DEPOT_COLORS.length];
              return (
                <motion.tr
                  key={d.depot}
                  className="border-t transition-shadow hover:bg-[var(--bg-hover)] hover:shadow-[0_0_0_1px_var(--accent-primary)]"
                  style={{ borderColor: "var(--border-default)" }}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      {d.depot}
                    </span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full"
                        style={{ background: "var(--bg-hover)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: `${color}22`, color }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: "var(--text-secondary)" }}>
                    {d.quantite ? d.quantite.toLocaleString("fr-FR") : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold" style={{ color }}>
                    {formatMoney(d.valeur)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
