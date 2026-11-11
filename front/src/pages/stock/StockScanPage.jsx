import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Package, AlertTriangle, MapPin } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import api from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { primaryButtonStyle } from "../../utils/brandStyles";

export default function StockScanPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const canRead = hasPermission(user?.role, "stock:read");

  const { data: line, isLoading, error } = useQuery({
    queryKey: ["stock-scan", id],
    queryFn: () => api.get(`stock/lines/${id}`).then((r) => r.data),
    enabled: canRead && !!id,
  });

  if (!canRead) {
    return (
      <PageShell title="Scan stock">
        <p className="text-sm text-slate-400">Accès refusé.</p>
      </PageShell>
    );
  }

  const qty = Number(line?.quantite || 0);
  const unite = line?.article?.unite || "UN";
  const qtyColor = qty <= 0 ? "text-red-300" : "text-emerald-300";

  return (
    <PageShell title="Scan terrain" subtitle="Détail de la ligne de stock scannée">
      <div className="mx-auto max-w-lg space-y-6 px-2 py-4">
        <Link
          to="/stock"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au stock
        </Link>

        {isLoading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="h-12 w-12 animate-spin text-accent-400" />
            <p className="text-lg text-slate-400">Chargement de la ligne…</p>
          </div>
        ) : error || !line ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-14 w-14 text-red-400" />
            <p className="text-xl font-semibold text-red-200">Ligne introuvable</p>
            <p className="mt-2 text-sm text-red-300/80">Vérifiez le QR code ou votre accès société.</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-white/10 bg-navy-900 p-6 text-center shadow-2xl">
              {line.article?.imageUrl ? (
                <img
                  src={line.article.imageUrl}
                  alt=""
                  className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <Package className="mx-auto mb-3 h-12 w-12 text-accent-400" />
              )}
              <p className="font-mono text-xs uppercase tracking-widest text-slate-500">Code article</p>
              <h1 className="mt-1 break-all font-mono text-3xl font-bold text-white sm:text-4xl">
                {line.article?.code}
              </h1>
              <p className="mt-3 text-lg text-slate-300">{line.article?.libelle}</p>
              {line.article?.famille?.nom && (
                <p className="mt-1 text-sm text-slate-500">{line.article.famille.nom}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-navy-900 p-5 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Quantité</p>
                <p className={`mt-1 text-4xl font-bold ${qtyColor}`}>{qty.toLocaleString("fr-FR")}</p>
                <p className="mt-1 text-xs text-slate-500">{unite}</p>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-navy-900 p-5 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Dépôt</p>
                <p className="mt-2 text-2xl font-bold text-violet-300">{line.depot?.code || "—"}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{line.depot?.libelle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-900 p-4">
              <MapPin className="h-5 w-5 shrink-0 text-sky-400" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Emplacement</p>
                <p className="truncate font-medium text-slate-200">
                  {line.emplacement?.code || "Non défini"}
                  {line.emplacement?.libelle ? ` · ${line.emplacement.libelle}` : ""}
                </p>
              </div>
            </div>

            <Link
              to={`/stock?articleId=${line.articleId}&depotId=${line.depotId}`}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={primaryButtonStyle}
            >
              Voir dans le stock
            </Link>
          </>
        )}
      </div>
    </PageShell>
  );
}
