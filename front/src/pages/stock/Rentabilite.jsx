import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  IconCoin,
  IconDownload,
  IconLoader2,
  IconStar,
  IconTrendingDown,
  IconTrendingUp,
  IconCalculator,
} from "@tabler/icons-react";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToastStore } from "../../store/toastStore";
import { exportCsvFromRows } from "../../utils/exportHelpers";
import RentabiliteCharts, { marginColor, AnimatedNumber } from "./RentabiliteCharts";
import CoutKpiCard from "./components/CoutKpiCard";
import { CoutTableRowSkeleton } from "./components/CoutSkeleton";
import { Coins, Receipt } from "lucide-react";
import "./coutStockage.css";

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export default function Rentabilite() {
  const societeScope = useSocieteQueryScope();
  const toast = useToastStore();
  const navigate = useNavigate();
  const [periode, setPeriode] = useState("6m");
  const [familleId, setFamilleId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [seuilMarge, setSeuilMarge] = useState("");

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100 } }).then((r) => r.data),
  });
  const { data: famillesData } = useQuery({
    queryKey: ["familles", societeScope],
    queryFn: () => api.get("familles").then((r) => r.data),
  });

  const depots = depotsData?.items ?? depotsData ?? [];
  const familles = famillesData?.items ?? famillesData ?? [];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["rentabilite", societeScope, periode, familleId, depotId, seuilMarge],
    queryFn: () =>
      api
        .get("valuation/rentabilite", {
          params: {
            periode,
            ...(familleId ? { familleId } : {}),
            ...(depotId ? { depotId } : {}),
            ...(seuilMarge ? { seuilMargeMin: seuilMarge } : {}),
          },
        })
        .then((r) => r.data),
  });

  const items = data?.items || [];
  const kpis = data?.kpis || {};

  const exportCsv = () => {
    if (!items.length) return toast.error("Aucune donnée à exporter");
    exportCsvFromRows(
      items.map((r) => ({
        Article: r.article?.libelle,
        Code: r.article?.code,
        "Qté vendue": r.qteVendue,
        CMP: r.cmp,
        "Prix vente moy.": r.prixVenteMoyen,
        "Marge brute": r.margeBrute,
        "Coût stockage": r.coutStockage,
        "Marge nette": r.margeNette,
        "Taux marge %": r.tauxMarge,
      })),
      `rentabilite-${periode}.csv`
    );
    toast.success("Export CSV téléchargé");
  };

  const maxMarge = useMemo(() => Math.max(...items.map((r) => Math.abs(r.margeNette)), 1), [items]);

  return (
    <PageShell
      title="Rentabilité article"
      subtitle="Analyse marge brute et nette par article"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          className="cout-export-btn"
        >
          <IconDownload size={16} stroke={1.75} />
          Exporter CSV
        </button>
      }
    >
      <div className="cout-page">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CoutKpiCard delayIndex={0} title="Marge brute totale" value={kpis.margeBruteTotal || 0} isCurrency icon={Receipt} accentColor="#378ADD" gradientTo="#5BA3F5" />
        <CoutKpiCard delayIndex={1} title="Marge nette totale" value={kpis.margeNetteTotal || 0} isCurrency icon={Coins} accentColor="#1D9E75" gradientTo="#2BC492" />
        <CoutKpiCard
          delayIndex={2}
          title="Article + rentable"
          value={kpis.articlePlusRentable?.slice(0, 18) || "—"}
          isTextValue
          icon={IconStar}
          accentColor="#7F77DD"
          gradientTo="#A89EF0"
        />
        <CoutKpiCard delayIndex={3} title="Articles en perte" value={kpis.articlesEnPerte ?? 0} icon={IconTrendingDown} accentColor="#E24B4A" gradientTo="#F06B6A" pulse={(kpis.articlesEnPerte ?? 0) > 0} />
      </div>

      <div className="cout-chart-card mb-4 flex flex-wrap gap-3 cout-fade-up">
        <select
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: "0.5px solid var(--color-border-secondary, var(--border-default))",
            background: "var(--color-background-primary, var(--bg-input))",
            color: "var(--text-primary)",
          }}
        >
          <option value="3m">3 mois</option>
          <option value="6m">6 mois</option>
          <option value="1y">1 an</option>
        </select>
        <div className="w-44">
          <SearchableSelect
            value={familleId}
            onChange={setFamilleId}
            options={familles.map((f) => ({ value: String(f.id), label: f.nom || f.code }))}
            placeholder="Famille"
            clearLabel="Toutes"
          />
        </div>
        <div className="w-56">
          <SearchableSelect
            value={depotId}
            onChange={setDepotId}
            options={depots.map((d) => ({
              value: String(d.id),
              label: d.libelle || d.nom ? `${d.code} — ${d.libelle || d.nom}` : d.code,
            }))}
            placeholder="Dépôt"
            clearLabel="Tous"
          />
        </div>
        <input
          type="number"
          placeholder="Seuil marge min %"
          value={seuilMarge}
          onChange={(e) => setSeuilMarge(e.target.value)}
          className="w-36 rounded-lg px-3 py-2 text-sm"
          style={{
            border: "0.5px solid var(--color-border-secondary, var(--border-default))",
            background: "var(--color-background-primary, var(--bg-input))",
            color: "var(--text-primary)",
          }}
        />
      </div>

      <div className="mb-6 cout-fade-up" style={{ animationDelay: "80ms" }}>
        <RentabiliteCharts
          items={items}
          evolutionMensuelle={data?.evolutionMensuelle || []}
          onArticleClick={(id) => id && navigate(`/articles/${id}`)}
        />
      </div>

      <div className="cout-table-panel overflow-hidden cout-fade-up" style={{ animationDelay: "120ms" }}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CoutTableRowSkeleton key={i} columns={9} delayIndex={i} />)
        ) : isError ? (
          <p className="p-6" style={{ color: "#E24B4A" }}>
            {getAxiosErrorMessage(error)}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="cout-table-header grid min-w-[1000px] grid-cols-[2fr_repeat(7,1fr)_120px] gap-2 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              {["Article", "Qté vendue", "CMP", "PV moy.", "Marge brute", "Coût stock.", "Marge nette", "Taux %", "Indicateur"].map(
                (h) => (
                  <span key={h} className={h !== "Article" && h !== "Indicateur" ? "text-right" : ""}>
                    {h}
                  </span>
                )
              )}
            </div>
            {items.length === 0 ? (
              <p className="py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                Aucune donnée
              </p>
            ) : (
              items.map((row, i) => (
                <div
                  key={row.article?.id}
                  className="cout-data-row cout-row-enter group grid min-w-[1000px] grid-cols-[2fr_repeat(7,1fr)_120px] items-center gap-2 border-b border-[var(--border-default)] px-3 py-3 even:bg-[var(--bg-input)]"
                  style={{
                    animationDelay: `${i * 45}ms`,
                    "--row-accent": marginColor(row.tauxMarge),
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {row.article?.libelle}
                    </p>
                    <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {row.article?.code}
                    </p>
                  </div>
                  <span className="text-right font-mono text-xs">{fmt(row.qteVendue)}</span>
                  <span className="text-right font-mono text-xs" style={{ color: "#378ADD" }}>
                    {fmt(row.cmp)}
                  </span>
                  <span className="text-right font-mono text-xs" style={{ color: "#1D9E75" }}>
                    {fmt(row.prixVenteMoyen)}
                  </span>
                  <span className="text-right font-mono text-xs">{fmt(row.margeBrute)}</span>
                  <span className="text-right font-mono text-xs" style={{ color: "#BA7517" }}>
                    {fmt(row.coutStockage)}
                  </span>
                  <span
                    className="text-right font-mono text-xs font-semibold"
                    style={{ color: row.margeNette >= 0 ? "#1D9E75" : "#E24B4A" }}
                  >
                    {fmt(row.margeNette)}
                  </span>
                  <span className="text-right">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: `${marginColor(row.tauxMarge)}20`,
                        color: marginColor(row.tauxMarge),
                        border: `0.5px solid ${marginColor(row.tauxMarge)}40`,
                      }}
                    >
                      {Number(row.tauxMarge || 0).toFixed(1)}%
                    </span>
                  </span>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--color-background-secondary, var(--bg-card))" }}>
                    <div
                      className="cout-kpi-bar h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (Math.abs(row.margeNette) / maxMarge) * 100)}%`,
                        background: `linear-gradient(90deg, ${marginColor(row.tauxMarge)}aa, ${marginColor(row.tauxMarge)})`,
                        boxShadow: `0 0 10px ${marginColor(row.tauxMarge)}55`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      </div>
    </PageShell>
  );
}
