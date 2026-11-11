import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calculator, FileDown, Loader2, Wallet } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useClientBranding } from "../../hooks/useClientBranding";
import { hasPermission } from "../../security/permissions";
import ComptabiliteKpiCards from "./components/ComptabiliteKpiCards";
import ComptabiliteCharts from "./components/ComptabiliteCharts";
import ComptabiliteImpayes from "./components/ComptabiliteImpayes";
import ComptabiliteTopLists from "./components/ComptabiliteTopLists";
import { buildDashboardParams, PERIODE_OPTIONS } from "./comptabiliteUtils";
import { exportComptabilitePdf } from "../../utils/comptabilitePdf";

const btnOnGlass =
  "inline-flex items-center gap-1.5 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

export default function Comptabilite() {
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const canRead = hasPermission(user?.role, "ventes:read") || hasPermission(user?.role, "achats:read");

  const [periode, setPeriode] = useState("mois");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [exporting, setExporting] = useState(false);

  const params = useMemo(
    () => buildDashboardParams(periode, dateDebut, dateFin),
    [periode, dateDebut, dateFin]
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["accounting-dashboard", societeScope, params],
    queryFn: () => api.get("accounting/dashboard", { params }).then((r) => r.data),
    enabled: canRead,
  });

  const stats = data || {};

  async function exportPDF() {
    if (!data) return;
    setExporting(true);
    try {
      await exportComptabilitePdf({
        data,
        periodeLabel: PERIODE_OPTIONS.find((p) => p.val === periode)?.label || periode,
        clientBranding,
      });
    } finally {
      setExporting(false);
    }
  }

  if (!canRead) {
    return (
      <PageShell
        title="Comptabilité"
        subtitle="Vue synthétique des flux achats, ventes, impayés et rentabilité"
        icon={Calculator}
        badge="Finance"
      >
        <p className="text-sm text-slate-400">Accès refusé.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Comptabilité"
      subtitle="Vue synthétique des flux achats, ventes, impayés et rentabilité"
      icon={Calculator}
      badge="Finance"
      actions={
        <>
          <Link to="/reglements" className={btnOnGlass}>
            <Wallet className="h-4 w-4" aria-hidden />
            Page Règlements
          </Link>
          <button
            type="button"
            onClick={exportPDF}
            disabled={!data || exporting}
            className={btnOnGlass}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden />
            )}
            Export PDF
          </button>
        </>
      }
    >
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-up { animation: fadeUp 0.4s ease both; }
      `}</style>

      <div
        className="animate-fade-up flex flex-wrap items-center gap-2 rounded-2xl border px-4 py-3"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <span className="text-xs font-medium text-[var(--text-muted)]">Période :</span>
        {PERIODE_OPTIONS.map((p) => {
          const active = periode === p.val;
          return (
            <button
              key={p.val}
              type="button"
              onClick={() => setPeriode(p.val)}
              className="rounded-full border px-3.5 py-1 text-xs font-medium transition-all duration-150"
              style={{
                borderColor: active ? "rgba(55,138,221,0.5)" : "var(--border-default)",
                background: active ? "rgba(55,138,221,0.14)" : "transparent",
                color: active ? "#60a5fa" : "var(--text-muted)",
              }}
            >
              {p.label}
            </button>
          );
        })}
        {periode === "custom" && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2.5 py-1">
            <span className="text-[11px] text-[var(--text-muted)]">Du</span>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="border-0 bg-transparent text-xs text-[var(--text-primary)] outline-none"
            />
            <span className="text-[11px] text-[var(--text-muted)]">au</span>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="border-0 bg-transparent text-xs text-[var(--text-primary)] outline-none"
            />
          </div>
        )}
      </div>

      {isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {getAxiosErrorMessage(error)}
          <button type="button" onClick={() => refetch()} className="ml-2 underline">
            Réessayer
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
          <div className="h-52 animate-pulse rounded-xl bg-white/5" />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl bg-white/5" />
            <div className="h-64 animate-pulse rounded-xl bg-white/5" />
          </div>
        </div>
      ) : (
        <>
          <ComptabiliteKpiCards stats={stats} />
          <ComptabiliteCharts chartData={stats.chartData} stats={stats} />
          <ComptabiliteImpayes
            impayesAchats={stats.impayesAchats}
            impayesVentes={stats.impayesVentes}
          />
          <ComptabiliteTopLists topClients={stats.topClients} topFournisseurs={stats.topFournisseurs} />

          <footer className="flex flex-wrap items-center gap-4 border-t border-[var(--border-default)] pt-4 text-xs text-[var(--text-muted)]">
            <Link to="/achats" className="hover:text-sky-300">
              Voir les achats →
            </Link>
            <Link to="/ventes" className="hover:text-sky-300">
              Voir les ventes →
            </Link>
            <Link to="/rapports" className="hover:text-sky-300">
              Rapports détaillés →
            </Link>
          </footer>
        </>
      )}
    </PageShell>
  );
}
