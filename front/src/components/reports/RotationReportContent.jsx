import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, FileSpreadsheet, FileText, LayoutGrid, List, TrendingDown, TrendingUp } from "lucide-react";
import api from "../../services/api";
import SearchableSelect from "../ui/SearchableSelect";
import CoutKpiCard from "../../pages/stock/components/CoutKpiCard";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useClientBranding } from "../../hooks/useClientBranding";
import { useToast } from "../../hooks/useToast";
import { exportRotationPdf } from "../../utils/stockReports";
import { exportRotationExcel } from "../../utils/exportHelpers";
import RotationReportCards from "./RotationReportCards";
import RotationReportTable from "./RotationReportTable";

const CARD = {
  background: "var(--color-background-primary, var(--bg-card))",
  border: "0.5px solid var(--color-border-tertiary, var(--border-default))",
  borderRadius: 12,
};

const PERIODS = [
  { id: "30", label: "30j" },
  { id: "60", label: "60j" },
  { id: "90", label: "90j" },
  { id: "custom", label: "Personnalisé" },
];

function periodeLabel(days, customDays) {
  if (days === "custom") return `${customDays} derniers jours`;
  return `${days} derniers jours`;
}

export default function RotationReportContent({ embedded = false }) {
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const toast = useToast();
  const [viewMode, setViewMode] = useState("cards");
  const [period, setPeriod] = useState("30");
  const [customDays, setCustomDays] = useState("45");
  const [depotId, setDepotId] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const days = period === "custom" ? Math.max(1, Math.min(365, Number(customDays) || 30)) : Number(period);

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100 } }).then((r) => r.data),
  });
  const depots = depotsData?.items ?? depotsData ?? [];

  const { data: report, isLoading } = useQuery({
    queryKey: ["rapports-rotation", societeScope, depotId, days],
    queryFn: () =>
      api
        .get("rapports/rotation", { params: { days, ...(depotId ? { depotId } : {}) } })
        .then((r) => r.data),
  });

  const depotLabel = useMemo(() => {
    if (!depotId) return "Tous les dépôts";
    const d = depots.find((x) => String(x.id) === String(depotId));
    return d ? `${d.code} — ${d.libelle}` : "—";
  }, [depotId, depots]);

  const items = report?.items ?? [];
  const summary = report?.summary ?? {};
  const showDepot = !depotId;

  async function handleExportPdf() {
    if (!report) return;
    setExportLoading(true);
    try {
      await exportRotationPdf({
        report,
        depotLabel,
        periodeLabel: periodeLabel(period, days),
        clientBranding,
      });
      toast.success("PDF téléchargé");
    } catch {
      toast.error("Erreur export PDF");
    } finally {
      setExportLoading(false);
    }
  }

  async function handleExportExcel() {
    setExportLoading(true);
    try {
      await exportRotationExcel(api, {
        days,
        ...(depotId ? { depotId } : {}),
      });
      toast.success("Excel téléchargé");
    } catch {
      toast.error("Erreur export Excel");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div
      className="space-y-6"
      style={embedded ? undefined : { animation: "fadeUp 0.4s ease both" }}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={exportLoading || !items.length}
          onClick={handleExportPdf}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ border: "0.5px solid var(--color-border-secondary, var(--border-default))", color: "var(--text-muted)" }}
        >
          <FileText size={15} /> PDF
        </button>
        <button
          type="button"
          disabled={exportLoading || !items.length}
          onClick={handleExportExcel}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ border: "0.5px solid var(--color-border-secondary, var(--border-default))", color: "var(--text-muted)" }}
        >
          <FileSpreadsheet size={15} /> Excel
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl p-4" style={CARD}>
        <div className="w-full sm:w-64">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Dépôt
          </label>
          <SearchableSelect
            value={depotId}
            onChange={setDepotId}
            options={depots.map((d) => ({
              value: String(d.id),
              label: d.libelle || d.nom ? `${d.code} — ${d.libelle || d.nom}` : d.code,
            }))}
            placeholder="Tous dépôts"
            clearLabel="Tous"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Période
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className="transition-colors duration-150"
                style={{
                  fontSize: 12,
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: period === p.id ? "0.5px solid #1D9E75" : "0.5px solid transparent",
                  background: period === p.id ? "rgba(29,158,117,0.2)" : "var(--color-background-secondary, var(--bg-card))",
                  color: period === p.id ? "#1D9E75" : "var(--text-muted)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {period === "custom" && (
          <div className="w-24">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Jours
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                border: "0.5px solid var(--color-border-secondary, var(--border-default))",
                background: "var(--color-background-primary, var(--bg-input))",
                color: "var(--text-primary)",
              }}
            />
          </div>
        )}
        <div className="ml-auto">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Affichage
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-default)] p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-label="Vue cartes"
              className={`rounded-md px-2.5 py-1.5 text-xs ${viewMode === "cards" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)]"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-label="Vue tableau"
              className={`rounded-md px-2.5 py-1.5 text-xs ${viewMode === "table" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)]"}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CoutKpiCard
          delayIndex={0}
          title="Rotation moyenne globale"
          value={summary.rotationMoyenne ?? 0}
          formatValue={(v) => `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
          icon={Activity}
          accentColor="#1D9E75"
          gradientTo="#2BC492"
        />
        <CoutKpiCard
          delayIndex={1}
          title="Articles forte rotation"
          value={summary.articlesForteRotation ?? 0}
          subtitle="Taux > 50%"
          icon={TrendingUp}
          accentColor="#378ADD"
          gradientTo="#5BA3F5"
        />
        <CoutKpiCard
          delayIndex={2}
          title="Articles faible rotation"
          value={summary.articlesFaibleRotation ?? 0}
          subtitle="Taux < 10% — attention requise"
          icon={TrendingDown}
          accentColor="#E24B4A"
          gradientTo="#F06B6A"
        />
      </div>

      {viewMode === "cards" ? (
        <RotationReportCards items={items} isLoading={isLoading} showDepot={showDepot} />
      ) : (
        <RotationReportTable items={items} isLoading={isLoading} showDepot={showDepot} />
      )}
    </div>
  );
}
