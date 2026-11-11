import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Package,
  Search,
  ClipboardList,
  Loader2,
  X,
  Clock,
  FileDown,
  FileText,
  Printer,
  Download,
  LayoutGrid,
  List,
} from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import { GlassAside } from "../../components/ui/GlassPageHeader";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Modal, { btnPrimary, btnSecondary } from "../../components/ui/Modal";
import LotCard, { LotCardSkeleton } from "../../components/stock/LotCard";
import LotDetailModal from "../../components/stock/LotDetailModal";
import LotFormModal from "../../components/stock/LotFormModal";
import LotKpiCards from "./components/LotKpiCards";
import LotTable from "./components/LotTable";
import StockPagination from "../../components/stock/StockPagination";
import api, { getAxiosErrorMessage } from "../../services/api";
import { downloadLotsExpiringExport, downloadLotTraceabilitePdf } from "../../utils/stockReports";
import { buildScanUrl, isLoopbackOrigin, lotScanPath } from "../../utils/qrPayload";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import {
  PRIMARY_BTN_CLASSES,
  primaryButtonStyle,
  primaryOptionHighlightStyle,
  primaryOptionSelectedStyle,
  STOKIFY_BLUE_RGB,
} from "../../utils/brandStyles";
import { STATUT_CFG, computeStatut, daysLeft, fmtDate } from "./lotsUi";

const LOTS_VIEW_KEY = "lots-view-mode";

const INPUT_CN =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-500";

function asItems(d) {
  if (Array.isArray(d)) return d;
  return d?.items || [];
}

function DeactivateConfirmModal({ lot, onClose, onConfirm, loading }) {
  const { data: warnings, isLoading: warningsLoading } = useQuery({
    queryKey: ["lot-deactivate-warnings", lot?.id],
    queryFn: () => api.get(`lots/${lot.id}/deactivate-warnings`).then((r) => r.data),
    enabled: !!lot?.id,
  });

  const qty = Number(lot?.quantiteRestante) || 0;
  const showStockWarn = qty > 0;
  const draftDocs = warnings?.draftDocuments || [];
  const showDraftWarn = draftDocs.length > 0;

  return (
    <Modal
      title={`Désactiver le lot ${lot?.numero || ""}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={loading}>
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`${btnPrimary} !bg-red-600 hover:!bg-red-500`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                …
              </>
            ) : (
              "Confirmer la désactivation"
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Ce lot sera archivé et n&apos;apparaîtra plus dans les sélections actives, mais son historique reste
          consultable.
        </p>

        {showStockWarn && (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: "#EF9F2740", background: "#EF9F2712", color: "#BA7517" }}
          >
            ⚠ Ce lot contient encore {qty} unité(s) en stock. La désactivation reste réversible, mais vérifiez que
            ce n&apos;est pas une erreur avant de continuer.
          </div>
        )}

        {warningsLoading ? (
          <div className="h-10 animate-pulse rounded-lg bg-[var(--bg-hover)]" />
        ) : showDraftWarn ? (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: "#EF9F2740", background: "#EF9F2712", color: "#BA7517" }}
          >
            ⚠ Ce lot est référencé par {draftDocs.length} document(s) en brouillon
            {draftDocs.length <= 3
              ? ` (${draftDocs.map((d) => `${d.type === "VENTE" ? "Vente" : "Achat"} ${d.reference}`).join(", ")})`
              : ""}
            . La désactivation n&apos;est pas bloquée, mais ces documents pourraient être impactés à la confirmation.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function DlcBadge({ dateExpiration }) {
  const days = daysLeft(dateExpiration);
  if (days === null) return <span className="text-[11px] text-slate-500">Pas de DLC</span>;
  if (days < 0) return <span className="text-[11px] font-semibold text-red-400">Expiré il y a {Math.abs(days)}j</span>;
  if (days === 0) return <span className="text-[11px] font-semibold text-red-400">Expire aujourd&apos;hui</span>;
  if (days <= 7)
    return (
      <span className="inline-flex animate-pulse rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300">
        ⚠ {days}j restants
      </span>
    );
  if (days <= 30)
    return (
      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
        ⏱ {days}j
      </span>
    );
  return <span className="text-[11px] text-slate-400">{fmtDate(dateExpiration)}</span>;
}

function QrCodeModal({ lot, onClose }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [scanUrl, setScanUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const payload = await buildScanUrl(lotScanPath(lot.id));
        if (cancelled) return;
        setScanUrl(payload);
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(payload, {
          width: 320,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setQrUrl(url);
      } catch {
        if (!cancelled) setError("Impossible de générer le QR code.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lot.id]);

  function downloadQr() {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `qrcode-lot-${lot.numero}.png`;
    a.click();
  }

  function printLabel() {
    const w = window.open("", "_blank", "width=400,height=520");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head><title>Étiquette ${lot.numero}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px;margin:0}
      img{width:200px;height:200px} .num{font-size:18px;font-weight:bold;font-family:monospace;margin-top:12px}
      .code{font-size:14px;color:#555;margin-top:4px}</style></head><body>
      <img src="${qrUrl}" alt="QR"/>
      <div class="num">${lot.numero}</div>
      <div class="code">${lot.article?.code || ""}</div>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">QR Code — {lot.numero}</h2>
            <p className="text-xs text-slate-400">{lot.article?.code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
          {loading ? (
            <Loader2 className="h-16 w-16 animate-spin text-accent-400" />
          ) : error ? (
            <p className="text-sm text-red-300">{error}</p>
          ) : (
            <img src={qrUrl} alt={`QR ${lot.numero}`} className="rounded-xl border border-white/10 bg-white p-2" />
          )}
          <p className="text-center text-[10px] text-slate-500">
            Scannez avec l&apos;appareil photo (même Wi-Fi que le PC)
          </p>
          {scanUrl ? (
            <p className="max-w-full truncate text-center font-mono text-[9px] text-slate-500" title={scanUrl}>
              {scanUrl}
            </p>
          ) : null}
          {scanUrl && isLoopbackOrigin(scanUrl) ? (
            <p className="text-center text-[11px] text-amber-400">
              Lien localhost : inaccessible depuis le téléphone. Redémarrez le front puis régénérez le QR.
            </p>
          ) : null}
          <div className="flex w-full gap-2">
            <button
              type="button"
              disabled={!qrUrl}
              onClick={downloadQr}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Télécharger QR
            </button>
            <button
              type="button"
              disabled={!qrUrl}
              onClick={printLabel}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs text-white disabled:opacity-40 hover:brightness-110`}
              style={primaryButtonStyle}
            >
              <Printer className="h-4 w-4" />
              Imprimer étiquette
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceabiliteModal({ lot, onClose }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["lot-mouvements", lot.id],
    queryFn: () => api.get(`lots/${lot.id}/mouvements`).then((r) => r.data),
  });
  const mvts = data?.items || [];

  const TYPE_CFG = {
    ENTREE_ACHAT: { label: "Achat", badge: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
    ENTREE_RETOUR_CLIENT: { label: "Retour client", badge: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
    ENTREE_AJUSTEMENT: { label: "Ajustement +", badge: "bg-violet-500/20 border-violet-500/30 text-violet-300" },
    SORTIE_VENTE: { label: "Vente", badge: "bg-red-500/20 border-red-500/30 text-red-300" },
    SORTIE_PERTE: { label: "Perte", badge: "bg-red-500/20 border-red-500/30 text-red-300" },
    SORTIE_CASSE: { label: "Casse", badge: "bg-red-500/20 border-red-500/30 text-red-300" },
    SORTIE_AUTRE: { label: "Sortie autre", badge: "bg-red-500/20 border-red-500/30 text-red-300" },
    TRANSFERT: { label: "Transfert", badge: "bg-blue-500/20 border-blue-500/30 text-blue-300" },
  };
  function TypeBadge({ type }) {
    const cfg = TYPE_CFG[type];
    if (!cfg) {
      return (
        <span className="inline-flex rounded-full border border-slate-500/30 bg-slate-500/20 px-2 py-0.5 text-[11px] text-slate-300">
          {type}
        </span>
      );
    }
    return (
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.badge}`}>
        {cfg.label}
      </span>
    );
  }

  function fmtWhen(v) {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Lot</p>
            <h2 className="text-lg font-semibold text-white">{lot.numero}</h2>
            <p className="text-xs text-slate-400">
              {lot.article?.libelle} · {lot.depot?.libelle || lot.depot?.code}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Rapport traçabilité PDF"
              disabled={downloadingPdf}
              onClick={async () => {
                setDownloadingPdf(true);
                try {
                  await downloadLotTraceabilitePdf(api, lot.id, lot.numero);
                } catch (e) {
                  /* eslint-disable no-alert */
                  alert(getAxiosErrorMessage(e));
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              className="rounded-lg p-1.5 text-emerald-400 hover:bg-white/5 disabled:opacity-50"
            >
              {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-4 grid shrink-0 grid-cols-3 gap-2">
          {[
            { label: "Qté initiale", value: lot.quantiteInitiale, cls: "text-violet-300" },
            { label: "Qté restante", value: lot.quantiteRestante, cls: "text-emerald-300" },
            {
              label: "Consommé",
              value: (Number(lot.quantiteInitiale) - Number(lot.quantiteRestante)).toFixed(0),
              cls: "text-amber-300",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 shrink-0 text-[10px] font-medium uppercase tracking-widest text-slate-500">
          Mouvements · {mvts.length} ligne{mvts.length !== 1 ? "s" : ""}
        </p>

        <div className="mb-3 shrink-0">
          <button
            type="button"
            disabled={downloadingPdf}
            onClick={async () => {
              setDownloadingPdf(true);
              try {
                await downloadLotTraceabilitePdf(api, lot.id, lot.numero);
              } catch (e) {
                alert(getAxiosErrorMessage(e));
              } finally {
                setDownloadingPdf(false);
              }
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Rapport traçabilité PDF
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-white/10" />
              ))}
            </div>
          ) : mvts.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-400">Aucun mouvement pour ce lot</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-right">Qté</th>
                  <th className="px-2 py-2">Dépôt</th>
                  <th className="px-2 py-2">Utilisateur</th>
                </tr>
              </thead>
              <tbody>
                {mvts.map((m) => (
                  <tr key={m.id} className="border-b border-white/5">
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-400">{fmtWhen(m.createdAt)}</td>
                    <td className="px-2 py-2">
                      <TypeBadge type={m.type} />
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-200">
                      {Number(m.quantite || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-400">
                      {m.depot?.code ?? "—"}
                      {m.depotDest ? ` ? ${m.depotDest.code}` : ""}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-400">
                      {[m.utilisateur?.prenom, m.utilisateur?.nom].filter(Boolean).join(" ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Lots() {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const canRead = hasPermission(user?.role, "stock:read");
  const canWrite = hasPermission(user?.role, "stock:write");

  const [articleFilterId, setArticleFilterId] = useState("");
  const [depotFilterId, setDepotFilterId] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState(null);
  const [expiringDays, setExpiringDays] = useState(30);
  const [showExpiring, setShowExpiring] = useState(false);
  const [exportingLots, setExportingLots] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const v = localStorage.getItem(LOTS_VIEW_KEY);
      return v === "table" || v === "cards" ? v : "cards";
    } catch {
      return "cards";
    }
  });

  function setViewModePersist(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem(LOTS_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  const pushToast = useToastStore((s) => s.pushToast);
  const showToast = (msg, type = "success") => {
    const variant = type === "error" ? "error" : type === "warning" ? "warning" : "success";
    pushToast(msg, variant, { persistent: false });
  };

  async function exportExpiring(format) {
    setExportingLots(format);
    try {
      await downloadLotsExpiringExport(
        api,
        { days: 30, ...(depotFilterId ? { depotId: depotFilterId } : {}) },
        format
      );
    } catch (e) {
      showToast(getAxiosErrorMessage(e), "error");
    } finally {
      setExportingLots(false);
    }
  }

  const { data: lotsData, isLoading } = useQuery({
    queryKey: ["lots", societeScope, { articleFilterId, depotFilterId, statutFilter, page, pageSize }],
    queryFn: () =>
      api
        .get("lots", {
          params: {
            limit: pageSize,
            page,
            ...(articleFilterId ? { articleId: articleFilterId } : {}),
            ...(depotFilterId ? { depotId: depotFilterId } : {}),
            ...(statutFilter ? { statut: statutFilter } : {}),
          },
        })
        .then((r) => r.data),
    enabled: canRead,
  });

  const { data: expiringData } = useQuery({
    queryKey: ["lots-expiring", societeScope, expiringDays],
    queryFn: () => api.get("lots/expiring-soon", { params: { days: expiringDays, limit: 50 } }).then((r) => r.data),
    enabled: canRead && showExpiring,
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles", "lots", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots", "lots", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: alertData } = useQuery({
    queryKey: ["lots-alert", societeScope],
    queryFn: () => api.get("lots/expiring-soon", { params: { days: 30, limit: 1 } }).then((r) => r.data),
    enabled: canRead,
  });

  const lots = asItems(lotsData);
  const articles = asItems(articlesData);
  const depots = asItems(depotsData);
  const expiring = asItems(expiringData);
  const total = lotsData?.total ?? 0;
  const totalPages = Math.max(
    1,
    Number(lotsData?.pages) || Math.ceil(total / pageSize) || 1
  );
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);
  const alertCount = alertData?.total || 0;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [articleFilterId, depotFilterId, statutFilter, pageSize, search]);

  const filtered = lots.filter((l) => {
    const q = search.toLowerCase();
    return (
      !q ||
      l.numero?.toLowerCase().includes(q) ||
      l.article?.libelle?.toLowerCase().includes(q) ||
      l.article?.code?.toLowerCase().includes(q)
    );
  });

  const stats = useMemo(
    () => ({
      total,
      actifs: filtered.filter((l) => computeStatut(l) === "ACTIF").length,
      expiring: alertCount,
      epuises: filtered.filter((l) => computeStatut(l) === "EPUISE").length,
    }),
    [filtered, total, alertCount]
  );

  /** Lot ACTIF avec DLC la plus proche, par article (badge Priorité FEFO). */
  const fefoPriorityIds = useMemo(() => {
    const bestByArticle = new Map();
    for (const lot of filtered) {
      if (computeStatut(lot) !== "ACTIF" || !lot.dateExpiration) continue;
      const aid = lot.articleId ?? lot.article?.id;
      if (aid == null) continue;
      const exp = new Date(lot.dateExpiration).getTime();
      if (Number.isNaN(exp)) continue;
      const prev = bestByArticle.get(aid);
      if (!prev || exp < prev.exp) {
        bestByArticle.set(aid, { id: lot.id, exp });
      }
    }
    return new Set([...bestByArticle.values()].map((x) => x.id));
  }, [filtered]);

  const deactivateMut = useMutation({
    mutationFn: (id) => api.delete(`lots/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.invalidateQueries({ queryKey: ["lots-alert"] });
      qc.invalidateQueries({ queryKey: ["lots-expiring"] });
      showToast("Lot désactivé", "warning");
      setModal(null);
    },
    onError: (e) => showToast(getAxiosErrorMessage(e), "error"),
  });

  const reactivateMut = useMutation({
    mutationFn: (id) => api.patch(`lots/${id}`, { statut: "ACTIF" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.invalidateQueries({ queryKey: ["lots-alert"] });
      qc.invalidateQueries({ queryKey: ["lots-expiring"] });
      showToast("Lot réactivé");
    },
    onError: (e) => showToast(getAxiosErrorMessage(e), "error"),
  });

  function openDeactivateModal(lot) {
    setModal({ type: "deactivate", lot });
  }

  function resetFilters() {
    setSearch("");
    setArticleFilterId("");
    setDepotFilterId("");
    setStatutFilter("");
    setPage(1);
  }

  if (!canRead) {
    return (
      <PageShell title="Lots" subtitle="">
        <p className="text-sm text-slate-400">Accès refusé.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Lots"
      subtitle={`Traçabilité FIFO / FEFO · ${total} lot${total !== 1 ? "s" : ""}`}
      icon={Package}
      badge="Traçabilité"
      aside={
        <GlassAside
          icon={Clock}
          label="Alertes DLC"
          value={
            <>
              <span className="tabular-nums text-amber-300">{alertCount}</span>
              {alertCount !== 1 ? " lots à surveiller" : " lot à surveiller"}
            </>
          }
          iconColor="#fbbf24"
          iconBg="rgba(217,119,6,0.22)"
          iconBorder="rgba(251,191,36,0.35)"
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <motion.button
            type="button"
            onClick={() => setShowExpiring((x) => !x)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium ${
              showExpiring
                ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                : "border-sky-400/25 bg-white/5 text-sky-50"
            }`}
            whileHover={reduceMotion ? undefined : { y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            <Clock className="h-4 w-4" />
            Expirations
            {alertCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {alertCount}
              </span>
            )}
          </motion.button>
          {canWrite && (
            <motion.button
              type="button"
              onClick={() => setModal({ type: "create" })}
              className={PRIMARY_BTN_CLASSES}
              style={primaryButtonStyle}
              whileHover={reduceMotion ? undefined : { y: -2, scale: 1.03 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Plus className="h-4 w-4" />
              Nouveau lot
            </motion.button>
          )}
        </div>
      }
    >
      <div className="space-y-6 text-slate-200">
        <LotKpiCards stats={stats} />

        <AnimatePresence>
          {showExpiring ? (
            <motion.div
              key="expiring-panel"
              className="overflow-hidden rounded-2xl border border-amber-500/30 p-4"
              style={{
                background:
                  "linear-gradient(145deg, rgba(217,119,6,0.12) 0%, var(--bg-card) 55%)",
                boxShadow: "0 12px 32px -16px rgba(217,119,6,0.35)",
              }}
              initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.3 }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-200">
                  Lots expirant dans les {expiringDays} prochains jours
                </p>
                <select
                  value={expiringDays}
                  onChange={(e) => setExpiringDays(Number(e.target.value))}
                  className="rounded-lg border border-amber-500/25 bg-[var(--bg-input)] px-2 py-1 text-xs text-slate-200"
                >
                  {[7, 15, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} jours
                    </option>
                  ))}
                </select>
              </div>
              {expiring.length === 0 ? (
                <p className="text-center text-xs text-slate-400">Aucun lot à risque sur cette période</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {expiring.map((lot, i) => (
                    <motion.button
                      key={lot.id}
                      type="button"
                      onClick={() => setModal({ type: "trace", lot })}
                      className="rounded-xl border border-amber-500/25 bg-[var(--bg-card)] p-3 text-left"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      whileHover={reduceMotion ? undefined : { y: -3, borderColor: "rgba(251,191,36,0.5)" }}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-white">{lot.numero}</span>
                        <DlcBadge dateExpiration={lot.dateExpiration} />
                      </div>
                      <p className="truncate text-[11px] text-slate-400">{lot.article?.libelle}</p>
                      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                        <span>{lot.depot?.code}</span>
                        <span className="font-mono font-semibold text-amber-300">
                          Qté {Number(lot.quantiteRestante).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="rounded-2xl border border-white/10 bg-navy-900 p-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportExpiring("csv")}
              disabled={exportingLots}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {exportingLots === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => exportExpiring("excel")}
              disabled={exportingLots}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {exportingLots === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Export Excel
            </button>
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher numéro, article..."
                className={`${INPUT_CN} pl-9`}
              />
            </div>
            <div className="w-full sm:w-44">
              <SearchableSelect
                value={articleFilterId}
                onChange={(v) => {
                  setArticleFilterId(v);
                  setPage(1);
                }}
                options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))}
                placeholder="Tous articles"
                clearLabel="Tous"
              />
            </div>
            <div className="w-full sm:w-36">
              <SearchableSelect
                value={depotFilterId}
                onChange={(v) => {
                  setDepotFilterId(v);
                  setPage(1);
                }}
                options={depots.map((d) => ({ value: String(d.id), label: d.code }))}
                placeholder="Tous dépôts"
                clearLabel="Tous"
              />
            </div>
            {["", "ACTIF", "EXPIRE", "EPUISE", "DESACTIVE"].map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => {
                  setStatutFilter(s);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  statutFilter === s
                    ? ""
                    : "border-white/10 text-slate-400 hover:text-slate-200"
                }`}
                style={
                  statutFilter === s
                    ? {
                        borderColor: `rgba(${STOKIFY_BLUE_RGB}, 0.5)`,
                        ...primaryOptionHighlightStyle,
                        ...primaryOptionSelectedStyle,
                      }
                    : undefined
                }
              >
                {s || "Tous"}
                {s ? ` · ${STATUT_CFG[s]?.label}` : ""}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
              <button
                type="button"
                title="Vue cartes"
                onClick={() => setViewModePersist("cards")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "cards" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Vue tableau"
                onClick={() => setViewModePersist("table")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "table" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "cards" ? (
          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <LotCardSkeleton key={i} index={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <motion.div
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-4 py-16 text-center"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, #378ADD 10%, var(--bg-card)), var(--bg-card))",
                  borderColor: "rgba(55,138,221,0.28)",
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
              >
                <motion.div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{
                    background: "linear-gradient(145deg, rgba(55,138,221,0.4), rgba(6,182,212,0.22))",
                    color: "#7dd3fc",
                    border: "1px solid rgba(96,165,250,0.4)",
                    boxShadow: "0 12px 28px -12px rgba(55,138,221,0.55)",
                  }}
                  animate={
                    reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, -3, 3, 0] }
                  }
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Package className="h-8 w-8" />
                </motion.div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Aucun lot trouvé
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {search || articleFilterId || depotFilterId || statutFilter
                    ? "Aucun résultat pour ces filtres"
                    : "Créez votre premier lot"}
                </p>
                {(search || articleFilterId || depotFilterId || statutFilter) && (
                  <motion.button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-400/25 px-4 py-2 text-xs font-medium text-sky-100"
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                  >
                    Réinitialiser les filtres
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((lot, index) => (
                  <LotCard
                    key={lot.id}
                    lot={lot}
                    index={index}
                    isFefoPriority={fefoPriorityIds.has(lot.id)}
                    canWrite={canWrite}
                    deactivatePending={deactivateMut.isPending || reactivateMut.isPending}
                    onViewDetail={(l) => setModal({ type: "detail", lot: l })}
                    onQrCode={(l) => setModal({ type: "qr", lot: l })}
                    onExportPdf={async (l) => {
                      try {
                        await downloadLotTraceabilitePdf(api, l.id, l.numero);
                      } catch (e) {
                        showToast(getAxiosErrorMessage(e), "error");
                      }
                    }}
                    onEdit={(l) => setModal({ type: "edit", lot: l })}
                    onDesactiver={openDeactivateModal}
                    onReactivate={(l) => reactivateMut.mutate(l.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <LotTable
              lots={filtered}
              isLoading={isLoading}
              fefoPriorityIds={fefoPriorityIds}
              canWrite={canWrite}
              deactivatePending={deactivateMut.isPending || reactivateMut.isPending}
              onViewDetail={(l) => setModal({ type: "detail", lot: l })}
              onQrCode={(l) => setModal({ type: "qr", lot: l })}
              onTrace={(l) => setModal({ type: "trace", lot: l })}
              onEdit={(l) => setModal({ type: "edit", lot: l })}
              onDesactiver={openDeactivateModal}
              onReactivate={(l) => reactivateMut.mutate(l.id)}
              empty={
                <>
                  <Package className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">Aucun lot trouvé</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {search ? "Essayez un autre terme" : "Créez votre premier lot"}
                  </p>
                  {(search || articleFilterId || depotFilterId || statutFilter) && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    >
                      Réinitialiser les filtres
                    </button>
                  )}
                </>
              }
            />
          </motion.div>
        )}

        {!showExpiring && total > 0 ? (
          <StockPagination
            page={safePage}
            totalPages={totalPages}
            totalResults={total}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="lot(s)"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </div>

      {(modal?.type === "create" || modal?.type === "edit") && (
        <LotFormModal
          lot={modal.lot}
          articles={articles}
          depots={depots}
          onClose={() => setModal(null)}
          onSaved={() => showToast(modal.type === "create" ? "Lot créé" : "Lot mis à jour")}
        />
      )}
      {modal?.type === "detail" && (
        <LotDetailModal
          lot={modal.lot}
          isFefoPriority={fefoPriorityIds.has(modal.lot?.id)}
          canWrite={canWrite}
          onClose={() => setModal(null)}
          onQrCode={(l) => setModal({ type: "qr", lot: l })}
          onTrace={(l) => setModal({ type: "trace", lot: l })}
          onEdit={(l) => setModal({ type: "edit", lot: l })}
          onDesactiver={(l) => {
            setModal(null);
            openDeactivateModal(l);
          }}
          onReactivate={(l) => {
            reactivateMut.mutate(l.id);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "deactivate" && (
        <DeactivateConfirmModal
          lot={modal.lot}
          loading={deactivateMut.isPending}
          onClose={() => setModal(null)}
          onConfirm={() => deactivateMut.mutate(modal.lot.id)}
        />
      )}
      {modal?.type === "trace" && <TraceabiliteModal lot={modal.lot} onClose={() => setModal(null)} />}
      {modal?.type === "qr" && <QrCodeModal lot={modal.lot} onClose={() => setModal(null)} />}
    </PageShell>
  );
}

