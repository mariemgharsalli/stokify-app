import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Package, AlertTriangle, CheckCircle } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import api from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { primaryButtonStyle } from "../../utils/brandStyles";
import { computeStatut, fmtDate } from "../../utils/lotStatut";

const STATUT_CFG = {
  ACTIF: { label: "Actif", cls: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
  EXPIRE: { label: "Expiré", cls: "bg-red-500/20 border-red-500/30 text-red-300" },
  EPUISE: { label: "Épuisé", cls: "bg-slate-500/20 border-slate-500/30 text-slate-400" },
};

export default function LotScanPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const canRead = hasPermission(user?.role, "stock:read");

  const { data: lot, isLoading, error } = useQuery({
    queryKey: ["lot-scan", id],
    queryFn: () => api.get(`lots/${id}`).then((r) => r.data),
    enabled: canRead && !!id,
  });

  if (!canRead) {
    return (
      <PageShell title="Scan lot">
        <p className="text-sm text-slate-400">Accès refusé.</p>
      </PageShell>
    );
  }

  const statut = computeStatut(lot);
  const cfg = STATUT_CFG[statut] || STATUT_CFG.ACTIF;
  const pct =
    lot && Number(lot.quantiteInitiale) > 0
      ? Math.round((Number(lot.quantiteRestante) / Number(lot.quantiteInitiale)) * 100)
      : 0;

  return (
    <PageShell title="Scan terrain" subtitle="Détail lot scanné">
      <div className="mx-auto max-w-lg space-y-6 px-2 py-4">
        <Link
          to="/lots"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux lots
        </Link>

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="h-12 w-12 animate-spin text-accent-400" />
            <p className="text-lg text-slate-400">Chargement du lot…</p>
          </div>
        ) : error || !lot ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-14 w-14 text-red-400" />
            <p className="text-xl font-semibold text-red-200">Lot introuvable</p>
            <p className="mt-2 text-sm text-red-300/80">Vérifiez le QR code ou votre accès société.</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-navy-900 p-6 text-center shadow-2xl">
              <Package className="mx-auto mb-3 h-12 w-12 text-accent-400" />
              <p className="font-mono text-xs uppercase tracking-widest text-slate-500">Numéro de lot</p>
              <h1 className="mt-1 break-all font-mono text-3xl font-bold text-white sm:text-4xl">{lot.numero}</h1>
              <p className="mt-3 text-lg text-slate-300">{lot.article?.libelle}</p>
              <p className="font-mono text-sm text-slate-500">{lot.article?.code}</p>
              <div className="mt-4">
                <span className={`inline-flex rounded-full border px-4 py-1.5 text-sm font-semibold ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-navy-900 p-5 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Qté restante</p>
                <p className="mt-1 text-4xl font-bold text-emerald-300">
                  {Number(lot.quantiteRestante).toLocaleString("fr-FR")}
                </p>
                <p className="mt-1 text-xs text-slate-500">sur {Number(lot.quantiteInitiale).toLocaleString("fr-FR")}</p>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-navy-900 p-5 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Dépôt</p>
                <p className="mt-2 text-2xl font-bold text-violet-300">{lot.depot?.code || "—"}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{lot.depot?.libelle}</p>
              </div>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${pct <= 10 ? "bg-red-500" : pct <= 30 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-navy-900 p-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Fabrication</p>
                <p className="mt-1 font-medium text-slate-200">{fmtDate(lot.dateFabrication)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500">DLC</p>
                <p className="mt-1 font-medium text-slate-200">{fmtDate(lot.dateExpiration)}</p>
              </div>
            </div>

            <Link
              to="/lots"
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={primaryButtonStyle}
            >
              <CheckCircle className="h-6 w-6" />
              Voir tous les lots
            </Link>
          </>
        )}
      </div>
    </PageShell>
  );
}
