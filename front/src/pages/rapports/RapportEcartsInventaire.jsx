import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import KpiCard from "../../components/ui/KpiCard";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useClientBranding } from "../../hooks/useClientBranding";
import { useToast } from "../../hooks/useToast";
import { formatDate, formatTnd } from "../inventaires/inventaireUtils";
import { exportEcartsInventairePdf } from "../../utils/inventaireReports";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";

const CARD = {
  background: "var(--color-background-primary, var(--bg-card))",
  border: "0.5px solid var(--color-border-tertiary, var(--border-default))",
  borderRadius: 12,
};

function fmtQty(v) {
  if (v == null) return "—";
  return Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

function ecartColor(ecart) {
  if (ecart == null || Math.abs(ecart) < 1e-9) return "var(--text-muted)";
  return ecart > 0 ? "#1D9E75" : "#E24B4A";
}

export default function RapportEcartsInventaire() {
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const toast = useToast();
  const [inventaireId, setInventaireId] = useState("");
  const [exportLoading, setExportLoading] = useState(false);

  const { data: invListData, isLoading: loadingList } = useQuery({
    queryKey: ["inventaires-valides", societeScope],
    queryFn: () =>
      api.get("inventaires", { params: { statut: "VALIDE", limit: 200 } }).then((r) => r.data),
  });

  const inventaires = invListData?.items ?? invListData ?? [];

  const { data: rapport, isLoading } = useQuery({
    queryKey: ["ecarts-rapport", societeScope, inventaireId],
    queryFn: () => api.get(`inventaires/${inventaireId}/ecarts-rapport`).then((r) => r.data),
    enabled: !!inventaireId,
  });

  const items = rapport?.items ?? [];
  const summary = rapport?.summary ?? {};
  const inv = rapport?.inventaire;

  const chartData = useMemo(() => {
    return (rapport?.top10 ?? []).map((l) => ({
      name: (l.article?.code || l.article?.libelle || "?").slice(0, 12),
      ecart: Math.abs(l.ecart || 0),
      sign: (l.ecart || 0) >= 0 ? 1 : -1,
      raw: l.ecart,
    }));
  }, [rapport?.top10]);

  async function handleExportPdf() {
    if (!rapport) return;
    setExportLoading(true);
    try {
      await exportEcartsInventairePdf(rapport, clientBranding);
      toast.success("PDF téléchargé");
    } catch {
      toast.error("Erreur export PDF");
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <PageShell
      title="Écarts inventaire"
      subtitle="Comparaison stock théorique vs stock réel compté — inventaires validés uniquement."
      actions={
        <>
          <Link
            to="/rapports"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-muted)", border: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}
          >
            <ArrowLeft size={16} /> Retour
          </Link>
          <button
            type="button"
            disabled={exportLoading || !rapport}
            onClick={handleExportPdf}
            className={`${PRIMARY_BTN_CLASSES} disabled:opacity-50`}
            style={primaryButtonStyle}
          >
            <FileText size={15} /> Export PDF
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div
          className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
          style={{ borderLeft: "3px solid var(--accent-primary)" }}
        >
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Inventaire validé
          </label>
          <div className="max-w-md">
            <SearchableSelect
              value={inventaireId}
              onChange={setInventaireId}
              options={inventaires.map((inv) => ({
                value: String(inv.id),
                label: `${inv.reference} — ${inv.depot?.code ?? ""} (${formatDate(inv.date)})`,
              }))}
              placeholder={loadingList ? "Chargement…" : "Sélectionner un inventaire"}
              clearLabel="—"
            />
          </div>
          {inv && (
            <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)" }}>
              Réf. {inv.reference} · Dépôt {inv.depot?.libelle} · Date {formatDate(inv.date)} · Responsable : {inv.responsable}
            </p>
          )}
        </div>

        {!inventaireId ? (
          <div className="py-16 text-center">
            <ClipboardList size={48} className="mx-auto mb-3 opacity-40" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Sélectionnez un inventaire validé pour afficher le rapport</p>
          </div>
        ) : isLoading ? (
          <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Total écarts positifs"
                value={summary.totalEcartsPositifs ?? 0}
                formatValue={(v) => fmtQty(v)}
                subtitle="Surplus compté"
                icon={TrendingUp}
                accentColor="#1D9E75"
                delayIndex={0}
              />
              <KpiCard
                title="Total écarts négatifs"
                value={Math.abs(summary.totalEcartsNegatifs ?? 0)}
                formatValue={(v) => fmtQty(-Math.abs(Number(v)))}
                subtitle="Manquants"
                icon={TrendingDown}
                accentColor="#E24B4A"
                delayIndex={1}
              />
              <KpiCard
                title="Valeur totale écart"
                value={summary.valeurTotaleEcart ?? 0}
                isCurrency
                icon={ClipboardList}
                accentColor="#7F77DD"
                delayIndex={2}
              />
              <KpiCard
                title="Taux de fiabilité stock"
                value={summary.tauxFiabilite ?? 0}
                formatValue={(v) => `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`}
                subtitle="Articles sans écart"
                icon={ShieldCheck}
                accentColor="#378ADD"
                delayIndex={3}
              />
            </div>

            {chartData.length > 0 && (
              <div className="rounded-xl p-4" style={{ ...CARD, borderLeft: "3px solid #BA7517" }}>
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Top 10 — plus grands écarts (|écart|)
                </p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, var(--border-default))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-card)",
                          border: "0.5px solid var(--color-border-tertiary, var(--border-default))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(_, __, props) => [fmtQty(props.payload.raw), "Écart"]}
                      />
                      <Bar dataKey="ecart" radius={[0, 4, 4, 0]} animationDuration={800}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={entry.sign >= 0 ? "#1D9E75" : "#E24B4A"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl" style={{ ...CARD, borderLeft: "3px solid #378ADD" }}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}>
                    {["Article", "Stock théorique", "Stock réel compté", "Écart", "% écart", "Valeur écart"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => {
                    const color = ecartColor(row.ecart);
                    return (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-[var(--bg-hover)]"
                        style={{
                          borderBottom: "0.5px solid var(--color-border-tertiary, var(--border-default))",
                          animation: `fadeUp 0.35s ease ${i * 25}ms both`,
                        }}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium" style={{ color: "var(--text-primary)" }}>{row.article?.libelle}</p>
                          <p className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{row.article?.code}</p>
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtQty(row.qteTheorique)}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtQty(row.qteReelle)}</td>
                        <td className="px-4 py-3 tabular-nums font-semibold" style={{ color }}>{fmtQty(row.ecart)}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color }}>
                          {row.pctEcart != null ? `${Number(row.pctEcart).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%` : "—"}
                        </td>
                        <td className="px-4 py-3 tabular-nums" style={{ color }}>{formatTnd(row.valeurEcart)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
