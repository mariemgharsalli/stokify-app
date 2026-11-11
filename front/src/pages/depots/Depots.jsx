import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Grid3X3,
  LayoutGrid,
  List,
  Loader2,
  Map,
  MapPin,
  Package,
  Plus,
  Search,
  Warehouse,
} from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { primaryButtonStyle } from "../../utils/brandStyles";
import {
  isDuplicateCodeError,
  getDuplicateCodeMessage,
} from "../../components/forms/SuggestedCodeInput";
import MetricCard from "./components/MetricCard";
import DepotFormModal from "./components/DepotFormModal";
import EmplacementFormModal from "./components/EmplacementFormModal";
import DepotDrawer from "./components/DepotDrawer";
import DepotsCardsView from "./components/DepotsCardsView";
import DepotsListView from "./components/DepotsListView";
import DepotsMapView from "./components/DepotsMapView";
import DepotsPagination from "./components/DepotsPagination";
import WarehouseMap2D from "./components/WarehouseMap2D";
import GlassPageHeader from "../../components/ui/GlassPageHeader";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { useClientBranding } from "../../hooks/useClientBranding";
import { parseDepotStatut, DEPOT_STATUT_FILTER_OPTIONS, applyDepotStatutFilter } from "./depotStatusUi";
import { DEPOTS_CSS } from "./depotsTheme";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const VIEW_KEY = "stokify-depots-view";

function formatErr(err) {
  const d = err.response?.data;
  if (d?.details?.articles?.length) {
    const list = d.details.articles
      .slice(0, 5)
      .map((a) => `${a.libelle || a.code} (${a.quantite})`)
      .join(", ");
    return `${d.message || "Conflit"} : ${list}`;
  }
  return d?.message || getAxiosErrorMessage(err);
}

function ConfirmModal({ title, message, onClose, onConfirm, loading, danger, confirmLabel = "Confirmer" }) {
  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{
          background: "var(--color-background-primary, var(--bg-card))",
          borderColor: "var(--color-border-tertiary, var(--border-default))",
        }}
      >
        <h3 className="text-lg font-medium text-[var(--color-text-primary,var(--text-primary))]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary,var(--text-secondary))]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm text-[var(--color-text-secondary,var(--text-secondary))]"
            style={{ borderColor: "var(--color-border-secondary, var(--border-default))" }}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              danger ? "bg-red-600 hover:bg-red-500" : ""
            }`}
            style={danger ? undefined : { background: "#378ADD" }}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-52 animate-pulse rounded-2xl"
          style={{
            animationDelay: `${i * 100}ms`,
            background: "var(--color-background-secondary, var(--bg-app))",
          }}
        />
      ))}
    </div>
  );
}

function Plan2DTab({ depots, planDepotId, onDepotChange, societeScope, clientBranding }) {
  const depot = depots.find((d) => String(d.id) === String(planDepotId));

  const depotOptions = useMemo(
    () =>
      depots.map((d) => ({
        value: String(d.id),
        label: `${d.code} — ${d.libelle}`,
      })),
    [depots]
  );

  const { data: layoutData, isLoading: layoutLoading } = useQuery({
    queryKey: ["depot-layout", planDepotId, societeScope],
    queryFn: () => api.get(`depots/${planDepotId}/layout`).then((r) => r.data),
    enabled: !!planDepotId,
  });

  const emplacements =
    layoutData?.emplacements?.length
      ? layoutData.emplacements
      : Array.isArray(depot?.emplacements)
        ? depot.emplacements
        : [];
  const stocks = emplacements.flatMap((e) =>
    (e.stocks || []).map((s) => ({ ...s, emplacementId: e.id }))
  );

  if (!depots.length) {
    return <p className="text-center text-slate-500 py-12">Aucun dépôt disponible</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] max-w-md flex-1">
          <label
            htmlFor="plan-depot-select"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary,var(--text-secondary))]"
          >
            Dépôt
          </label>
          <SearchableSelect
            id="plan-depot-select"
            aria-label="Rechercher et choisir un dépôt"
            value={planDepotId ? String(planDepotId) : ""}
            onChange={onDepotChange}
            options={depotOptions}
            placeholder="Rechercher un dépôt…"
            searchPlaceholder="Code ou libellé du dépôt…"
            allowClear={false}
            className="w-full [&_button]:rounded-xl [&_button]:border-[var(--border-default)] [&_button]:bg-[var(--bg-card)] [&_button]:py-2.5 [&_button]:text-[var(--text-primary)]"
          />
        </div>
        {depot && (
          <button
            type="button"
            onClick={() => window.open(`/depots/${depot.id}/plan`, "_blank")}
            className="mb-0.5 text-xs font-medium transition-colors"
            style={{ color: "#378ADD" }}
          >
            Ouvrir en pleine page →
          </button>
        )}
      </div>
      {layoutLoading && !layoutData && !emplacements.length ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-text-tertiary,var(--text-muted))]" />
        </div>
      ) : !emplacements.length ? (
        <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-12 text-center text-sm text-[var(--text-secondary)]">
          Ce dépôt n&apos;a pas encore d&apos;emplacement. Créez-en un pour voir le plan, l&apos;occupation et la vue 3D.
        </p>
      ) : (
        <WarehouseMap2D
          emplacements={Array.isArray(emplacements) ? emplacements : []}
          stocks={stocks}
          depot={depot}
          depotCapacite={depot?.capacite}
          layout={layoutData?.layout}
          clientBranding={clientBranding}
        />
      )}
    </div>
  );
}

export default function Depots() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const expandDepotCode = searchParams.get("depot") || "";
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const canWrite = hasPermission(user?.role, "stock:write");

  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || "cards");
  const [toast, setToast] = useState(null);
  const [depotModal, setDepotModal] = useState(null);
  const [depotCodeError, setDepotCodeError] = useState("");
  const [empModal, setEmpModal] = useState(null);
  const [drawerDepot, setDrawerDepot] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [planDepotId, setPlanDepotId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["depots-enriched", societeScope, search],
    queryFn: () =>
      api
        .get("depots", {
          params: {
            enriched: 1,
            search: search.trim() || undefined,
            _t: Date.now(),
          },
        })
        .then((r) => r.data),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const depots = data?.items || [];
  const global = data?.global || {};

  useEffect(() => {
    if (!expandDepotCode || isLoading || !depots.length) return;
    const target = depots.find((d) => d.code === expandDepotCode);
    if (!target) return;
    requestAnimationFrame(() => {
      document.getElementById(`depot-card-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [expandDepotCode, depots, isLoading]);

  const filteredDepots = useMemo(() => {
    const byStatut = applyDepotStatutFilter(depots, statutFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byStatut;
    return byStatut.filter(
      (d) =>
        d.code?.toLowerCase().includes(q) ||
        d.libelle?.toLowerCase().includes(q) ||
        d.ville?.toLowerCase().includes(q) ||
        (d.emplacements || []).some(
          (e) => e.code?.toLowerCase().includes(q) || e.libelle?.toLowerCase().includes(q)
        )
    );
  }, [depots, search, statutFilter]);

  const totalFiltered = filteredDepots.length;
  const pages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const paginatedDepots = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDepots.slice(start, start + pageSize);
  }, [filteredDepots, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statutFilter, view, pageSize]);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  useEffect(() => {
    if (view === "plan" && !planDepotId && filteredDepots.length) {
      setPlanDepotId(String(filteredDepots[0].id));
    }
  }, [view, planDepotId, filteredDepots]);

  const saveDepotMutation = useMutation({
    mutationFn: (payload) =>
      depotModal?.depot?.id
        ? api.patch(`depots/${depotModal.depot.id}`, payload)
        : api.post("depots", payload),
    onSuccess: () => {
      setDepotCodeError("");
      showToast(depotModal?.depot ? "Dépôt mis à jour" : "Dépôt créé");
      setDepotModal(null);
      qc.invalidateQueries({ queryKey: ["depots-enriched"] });
    },
    onError: (e) => {
      if (isDuplicateCodeError(e)) setDepotCodeError(getDuplicateCodeMessage(e));
      showToast(formatErr(e), "error");
    },
  });

  const deleteDepotMutation = useMutation({
    mutationFn: (id) => api.delete(`depots/${id}`),
    onSuccess: () => {
      showToast("Dépôt supprimé définitivement", "warning");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["depots-enriched"] });
    },
    onError: (e) => showToast(formatErr(e), "error"),
  });

  const setStatutDepotMutation = useMutation({
    mutationFn: ({ id, statut }) => api.patch(`depots/${id}/statut`, { statut }),
    onSuccess: (_, { statut }) => {
      showToast(statut === "INACTIF" ? "Dépôt désactivé" : "Dépôt réactivé");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["depots-enriched"] });
    },
    onError: (e) => showToast(formatErr(e), "error"),
  });

  const setStatutEmpMutation = useMutation({
    mutationFn: ({ id, statut }) => api.patch(`emplacements/${id}/statut`, { statut }),
    onSuccess: (_, { statut }) => {
      showToast(statut === "INACTIF" ? "Emplacement désactivé" : "Emplacement réactivé");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["depots-enriched"] });
    },
    onError: (e) => showToast(formatErr(e), "error"),
  });

  const saveEmpMutation = useMutation({
    mutationFn: (payload) =>
      empModal?.emplacement?.id
        ? api.patch(`emplacements/${empModal.emplacement.id}`, payload)
        : api.post("emplacements", payload),
    onSuccess: async (created) => {
      const wasEdit = Boolean(empModal?.emplacement?.id);
      showToast(wasEdit ? "Emplacement mis à jour" : "Emplacement créé");
      setEmpModal(null);
      if (created?.depotId && created?.id && !wasEdit) {
        qc.setQueryData(["depots-enriched", societeScope, search], (old) => {
          if (!old?.items) return old;
          const mapped = {
            id: created.id,
            code: created.code,
            libelle: created.libelle,
            categorie: created.categorie,
            barcode: created.barcode,
            niveaux: created.niveaux,
            depotId: created.depotId,
            stockActuel: 0,
            nbArticles: 0,
            capaciteUnites: created.capaciteSlots > 0
              ? Number(created.capaciteSlots)
              : created.niveaux > 0
                ? Number(created.niveaux)
                : 100,
            remplissagePct: 0,
            zoneDangereuse: Boolean(created.zoneDangereuse),
            categorieAutorisee: created.categorieAutorisee || null,
            distanceQuai: created.distanceQuai ?? 50,
            capaciteSlots: created.capaciteSlots ?? null,
            topArticles: [],
            statut: created.statut ?? "ACTIF",
          };
          const items = old.items.map((d) => {
            if (d.id !== Number(created.depotId)) return d;
            const emplacements = [...(d.emplacements || []), mapped];
            return {
              ...d,
              emplacements,
              stockSummary: {
                ...d.stockSummary,
                nbEmplacements: emplacements.length,
              },
            };
          });
          return {
            ...old,
            items,
            global: {
              ...old.global,
              nbEmplacements: (old.global?.nbEmplacements || 0) + 1,
            },
          };
        });
      }
      await qc.invalidateQueries({ queryKey: ["depots-enriched"] });
      await qc.refetchQueries({ queryKey: ["depots-enriched"] });
    },
    onError: (e) => showToast(formatErr(e), "error"),
  });

  const deleteEmpMutation = useMutation({
    mutationFn: (id) => api.delete(`emplacements/${id}`),
    onSuccess: () => {
      showToast("Emplacement supprimé définitivement", "warning");
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ["depots-enriched"] });
    },
    onError: (e) => showToast(formatErr(e), "error"),
  });

  const nbDepotsActifs = useMemo(
    () => depots.filter((d) => parseDepotStatut(d) !== "INACTIF").length,
    [depots]
  );

  const handlers = {
    onOpenDrawer: setDrawerDepot,
    onEditDepot: (d) => setDepotModal({ depot: d }),
    onToggleStatutDepot: (d) => {
      const next = parseDepotStatut(d) === "ACTIF" ? "INACTIF" : "ACTIF";
      if (next === "INACTIF") {
        setConfirm({
          type: "toggle-depot",
          item: d,
          nextStatut: "INACTIF",
          title: "Désactiver ce dépôt ?",
          message:
            "Ce dépôt ne sera plus proposé pour de nouvelles opérations (achats, ventes, transferts), mais son historique reste consultable. Vous pourrez le réactiver à tout moment.",
          danger: false,
          confirmLabel: "Désactiver",
        });
      } else {
        setConfirm({
          type: "toggle-depot",
          item: d,
          nextStatut: "ACTIF",
          title: "Réactiver ce dépôt ?",
          message: "Ce dépôt sera à nouveau proposé pour les nouvelles opérations.",
          danger: false,
          confirmLabel: "Réactiver",
        });
      }
    },
    onDeleteDepot: (d) =>
      setConfirm({
        type: "delete-depot",
        item: d,
        title: "Supprimer définitivement ce dépôt ?",
        message: `« ${d.libelle} » sera supprimé de façon irréversible. Cette action n'est possible que pour un dépôt inactif, vide et sans emplacement.`,
        danger: true,
        confirmLabel: "Supprimer définitivement",
      }),
    onAddEmplacement: (d) => setEmpModal({ defaultDepotId: d.id, depot: d }),
    onEditEmplacement: (e, d) => setEmpModal({ emplacement: e, defaultDepotId: d.id, depot: d }),
    onToggleStatutEmplacement: (e, d) => {
      const next = parseDepotStatut(e) === "ACTIF" ? "INACTIF" : "ACTIF";
      if (next === "INACTIF") {
        setConfirm({
          type: "toggle-emp",
          item: e,
          depot: d,
          nextStatut: "INACTIF",
          title: "Désactiver cet emplacement ?",
          message:
            "Cet emplacement ne sera plus proposé pour de nouvelles opérations, mais son historique reste consultable. Vous pourrez le réactiver à tout moment.",
          danger: false,
          confirmLabel: "Désactiver",
        });
      } else {
        setConfirm({
          type: "toggle-emp",
          item: e,
          depot: d,
          nextStatut: "ACTIF",
          title: "Réactiver cet emplacement ?",
          message: "Cet emplacement sera à nouveau proposé pour les nouvelles opérations.",
          danger: false,
          confirmLabel: "Réactiver",
        });
      }
    },
    onDeleteEmplacement: (e, d) =>
      setConfirm({
        type: "delete-emp",
        item: e,
        depot: d,
        title: "Supprimer définitivement cet emplacement ?",
        message: `« ${e.libelle} » (${e.code}) sera supprimé de façon irréversible.`,
        danger: true,
        confirmLabel: "Supprimer définitivement",
      }),
  };

  const avgCapacity = global.capaciteUtiliseePct ?? 0;
  const capacityPillColor = avgCapacity > 80 ? "#E24B4A" : avgCapacity > 50 ? "#EF9F27" : "#1D9E75";
  const reduceMotion = useReducedMotion();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <style>{DEPOTS_CSS}</style>

      <div className="mb-6">
        <GlassPageHeader
          title="Dépôts & Emplacements"
          subtitle="Visualisation 2D interactive · Gestion des emplacements et capacités"
          icon={Warehouse}
          badge="Logistique"
          actions={
            canWrite ? (
              <>
                <button
                  type="button"
                  onClick={() => setEmpModal({})}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/25 bg-white/5 px-4 py-2.5 text-sm font-medium text-sky-50 transition hover:bg-white/10"
                >
                  <MapPin className="h-4 w-4" /> Nouvel emplacement
                </button>
                <button
                  type="button"
                  onClick={() => setDepotModal({})}
                  className="stokify-btn-action flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white"
                  style={primaryButtonStyle}
                >
                  <Plus className="h-4 w-4" /> Nouveau dépôt
                </button>
              </>
            ) : null
          }
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          {
            label: `${nbDepotsActifs} dépôts actifs`,
            bg: "rgba(55,138,221,0.12)",
            color: "#378ADD",
          },
          {
            label: `${global.nbEmplacements ?? 0} emplacements`,
            bg: "rgba(29,158,117,0.12)",
            color: "#1D9E75",
          },
          {
            label: `${avgCapacity.toFixed(0)}% capacité utilisée (moyenne)`,
            bg: `${capacityPillColor}18`,
            color: capacityPillColor,
          },
        ].map((pill, i) => (
          <motion.span
            key={pill.label}
            className="depot-pill"
            style={{ background: pill.bg, color: pill.color }}
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            {pill.label}
          </motion.span>
        ))}
      </div>

      <div className="mx-auto max-w-[1100px] space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Warehouse} label="Total dépôts" value={global.nbDepots ?? 0} accentIndex={0} index={0} />
          <MetricCard icon={LayoutGrid} label="Total emplacements" value={global.nbEmplacements ?? 0} accentIndex={1} index={1} />
          <MetricCard
            icon={Package}
            label="Capacité utilisée"
            value={global.capaciteUtiliseePct ?? 0}
            suffix="%"
            ringPct={global.capaciteUtiliseePct ?? 0}
            accentIndex={2}
            index={2}
          />
          <MetricCard icon={Grid3X3} label="Articles stockés" value={global.nbArticlesDistinct ?? 0} accentIndex={3} index={3} />
        </div>

        <div className="depot-toolbar">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[#378ADD] focus:ring-2 focus:ring-[rgba(55,138,221,0.2)]"
                placeholder="Rechercher un dépôt ou emplacement…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition hover:border-[#378ADD]/40 hover:text-[#378ADD]"
              >
                <Map size={14} /> Voir sur la carte
              </button>
              <div className="depot-view-toggle">
                {[
                  { id: "cards", icon: LayoutGrid, label: "Cards" },
                  { id: "list", icon: List, label: "Par dépôt" },
                  { id: "plan", icon: Grid3X3, label: "Plan 2D" },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    className={view === id ? "is-active" : ""}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            className="flex w-fit flex-wrap gap-1.5 rounded-xl bg-[var(--bg-hover)] p-1"
            role="group"
            aria-label="Filtrer par statut"
          >
            {DEPOT_STATUT_FILTER_OPTIONS.map(({ value, label, color, activeBg }) => {
              const active = statutFilter === value;
              return (
                <button
                  key={value || "all"}
                  type="button"
                  onClick={() => setStatutFilter(value)}
                  className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all duration-150"
                  style={{
                    background: active ? activeBg : "transparent",
                    color: active ? color : "var(--text-secondary)",
                    border: active ? `1px solid ${color}40` : "1px solid transparent",
                    boxShadow: active ? `0 0 0 1px ${color}20` : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <SkeletonCards />
        ) : isError ? (
          <p className="text-center text-red-400">Impossible de charger les dépôts.</p>
        ) : filteredDepots.length === 0 ? (
          <motion.div
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center"
            style={{
              borderColor: "rgba(55,138,221,0.35)",
              background: "linear-gradient(165deg, rgba(55,138,221,0.06), var(--bg-card))",
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Warehouse className="mb-4 h-16 w-16 text-[#378ADD]/50" strokeWidth={1} />
            <p className="text-lg font-medium text-[var(--text-primary)]">Aucun dépôt configuré</p>
            <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
              {search || statutFilter
                ? "Aucun résultat pour ces critères."
                : "Créez votre premier entrepôt pour organiser le stock."}
            </p>
            {canWrite && !search && !statutFilter && (
              <button
                type="button"
                onClick={() => setDepotModal({})}
                className="stokify-btn-action mt-6 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
                style={primaryButtonStyle}
              >
                Créer votre premier dépôt
              </button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {view === "list" ? (
              <motion.div
                key="list"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="space-y-4"
              >
                <DepotsListView depots={paginatedDepots} search={search} canWrite={canWrite} {...handlers} />
                <DepotsPagination
                  page={page}
                  pages={pages}
                  total={totalFiltered}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </motion.div>
            ) : view === "plan" ? (
              <motion.div
                key="plan"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <Plan2DTab
                  depots={filteredDepots}
                  planDepotId={planDepotId}
                  onDepotChange={setPlanDepotId}
                  societeScope={societeScope}
                  clientBranding={clientBranding}
                />
              </motion.div>
            ) : (
              <motion.div
                key="cards"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="space-y-4"
              >
                <DepotsCardsView
                  depots={paginatedDepots}
                  search={search}
                  canWrite={canWrite}
                  expandDepotCode={expandDepotCode}
                  {...handlers}
                />
                <DepotsPagination
                  page={page}
                  pages={pages}
                  total={totalFiltered}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[300] rounded-lg border px-4 py-3 text-sm font-medium shadow-xl"
          style={{
            animation: "depotFadeUp .2s ease",
            background: toast.type === "error" ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)",
            borderColor: toast.type === "error" ? "rgba(239,68,68,.4)" : "rgba(16,185,129,.4)",
            color: toast.type === "error" ? "#f87171" : "#34d399",
          }}
        >
          {toast.msg}
        </div>
      )}

      {depotModal && (
        <DepotFormModal
          depot={depotModal.depot}
          onClose={() => {
            setDepotCodeError("");
            setDepotModal(null);
          }}
          onSave={(p) => saveDepotMutation.mutate(p)}
          saving={saveDepotMutation.isPending}
          onToast={showToast}
          codeError={depotCodeError}
          onClearCodeError={() => setDepotCodeError("")}
        />
      )}

      {empModal && (
        <EmplacementFormModal
          emplacement={empModal.emplacement}
          depots={depots}
          defaultDepotId={empModal.defaultDepotId}
          onClose={() => setEmpModal(null)}
          onSave={(p) => saveEmpMutation.mutate(p)}
          saving={saveEmpMutation.isPending}
        />
      )}

      {drawerDepot && (
        <DepotDrawer
          depot={drawerDepot}
          onClose={() => setDrawerDepot(null)}
          onEdit={(d) => {
            setDrawerDepot(null);
            setDepotModal({ depot: d });
          }}
          onViewStock={() => navigate("/stock")}
        />
      )}

      {mapOpen && (
        <DepotsMapView
          depots={filteredDepots}
          onClose={() => setMapOpen(false)}
          onEditDepot={(d) => {
            setMapOpen(false);
            setDepotModal({ depot: d });
          }}
          onFocusDepot={(code) => {
            setMapOpen(false);
            setSearchParams(code ? { depot: code } : {});
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          confirmLabel={confirm.confirmLabel}
          loading={
            deleteDepotMutation.isPending ||
            deleteEmpMutation.isPending ||
            setStatutDepotMutation.isPending ||
            setStatutEmpMutation.isPending
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.type === "toggle-depot") {
              setStatutDepotMutation.mutate({ id: confirm.item.id, statut: confirm.nextStatut });
            } else if (confirm.type === "toggle-emp") {
              setStatutEmpMutation.mutate({ id: confirm.item.id, statut: confirm.nextStatut });
            } else if (confirm.type === "delete-depot") {
              deleteDepotMutation.mutate(confirm.item.id);
            } else if (confirm.type === "delete-emp") {
              deleteEmpMutation.mutate(confirm.item.id);
            }
          }}
        />
      )}
    </div>
  );
}
