import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  FolderPlus,
  FolderTree,
  GitBranch,
  Package,
  X,
} from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import {
  getDuplicateCodeMessage,
  isDuplicateCodeError,
} from "../../components/forms/SuggestedCodeInput";
import PageShell from "../../components/ui/PageShell";
import ConfirmModal from "../../components/ui/ConfirmModal";
import CoutKpiCard from "../stock/components/CoutKpiCard";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import BackToProductsButton from "./components/BackToProductsButton";
import RefsAlertKpiCard from "./components/RefsAlertKpiCard";
import RefsFilterBoard from "./components/RefsFilterBoard";
import FamilyTreeTable from "./components/FamilyTreeTable";
import { FamilleCreateForm, SousFamilleCreateForm } from "./components/FamilleCreateForms";
import {
  getArticleCount,
} from "./components/refsUtils";
import {
  canDeleteFamillePermanent,
  canDeleteSousFamillePermanent,
  parseRefsStatut,
  REFS_STATUT_FILTER_OPTIONS,
} from "./refsStatusUi";

export default function Familles() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const canWrite = hasPermission(user?.role, "stock:write");
  const canRead = hasPermission(user?.role, "stock:read");

  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showFamDrawer, setShowFamDrawer] = useState(false);
  const [showSfDrawer, setShowSfDrawer] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const [createFamNom, setCreateFamNom] = useState("");
  const [createFamDescription, setCreateFamDescription] = useState("");
  const [createSfNom, setCreateSfNom] = useState("");
  const [createSfFamilleId, setCreateSfFamilleId] = useState("");

  const [editingFamilleId, setEditingFamilleId] = useState(null);
  const [editingSousFamilleId, setEditingSousFamilleId] = useState(null);
  const [famEditForm, setFamEditForm] = useState({ code: "", nom: "", description: "" });
  const [sfEditForm, setSfEditForm] = useState({ code: "", nom: "", familleId: "" });
  const [originalFamNom, setOriginalFamNom] = useState("");
  const [originalSfNom, setOriginalSfNom] = useState("");
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");

  const { data: familles = [], isLoading } = useQuery({
    queryKey: ["familles", societeScope],
    queryFn: () =>
      api
        .get("familles", { params: { limit: 100 } })
        .then((r) => (Array.isArray(r.data) ? r.data : r.data?.items ?? [])),
    enabled: canRead,
  });

  const { data: sous = [] } = useQuery({
    queryKey: ["sous-familles", societeScope],
    queryFn: () =>
      api
        .get("familles/sous-familles", { params: { limit: 100 } })
        .then((r) => (Array.isArray(r.data) ? r.data : r.data?.items ?? [])),
    enabled: canRead,
  });

  const existingFamilleCodes = useMemo(
    () => familles.map((f) => f.code).filter(Boolean),
    [familles]
  );
  const existingSfCodes = useMemo(() => sous.map((s) => s.code).filter(Boolean), [sous]);
  const existingFamilleNoms = useMemo(
    () => familles.map((f) => f.nom.trim().toLowerCase()),
    [familles]
  );
  const existingSfNoms = useMemo(
    () => sous.map((s) => s.nom.trim().toLowerCase()),
    [sous]
  );

  const sousByFamille = useMemo(() => {
    const map = new Map();
    for (const sf of sous) {
      const fid = sf.familleId ?? sf.famille?.id;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid).push(sf);
    }
    return map;
  }, [sous]);

  const filteredFamilles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = familles;
    const sf = String(statutFilter ?? "").trim().toUpperCase();
    if (sf === "ACTIF" || sf === "INACTIF") {
      list = list.filter((f) => parseRefsStatut(f) === sf);
    }
    if (!q) return list;
    return list.filter((f) => {
      const matchFam =
        f.code?.toLowerCase().includes(q) ||
        f.nom?.toLowerCase().includes(q) ||
        (f.description || "").toLowerCase().includes(q);
      const children = sousByFamille.get(f.id) || [];
      const matchSf = children.some(
        (s) => s.code?.toLowerCase().includes(q) || s.nom?.toLowerCase().includes(q)
      );
      return matchFam || matchSf;
    });
  }, [familles, search, sousByFamille, statutFilter]);

  const totalFiltered = filteredFamilles.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const paginatedFamilles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredFamilles.slice(start, start + pageSize);
  }, [filteredFamilles, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statutFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const totalSfFiltered = useMemo(
    () => filteredFamilles.reduce((acc, f) => acc + (sousByFamille.get(f.id)?.length || 0), 0),
    [filteredFamilles, sousByFamille]
  );

  const totalArticles = useMemo(
    () => familles.reduce((s, f) => s + getArticleCount(f), 0),
    [familles]
  );

  const closeFamDrawer = useCallback(() => {
    setShowFamDrawer(false);
    setCreateFamNom("");
    setCreateFamDescription("");
    setCodeError("");
  }, []);

  const closeSfDrawer = useCallback(() => {
    setShowSfDrawer(false);
    setCreateSfNom("");
    setCreateSfFamilleId("");
    setCodeError("");
  }, []);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const createFam = useMutation({
    mutationFn: ({ nom, description, code }) =>
      api.post("familles", {
        code,
        nom: nom.trim(),
        description: description.trim() || null,
      }),
    onSuccess: () => {
      closeFamDrawer();
      qc.invalidateQueries({ queryKey: ["familles"] });
    },
    onError: (e) => {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
        setError("");
      } else {
        setCodeError("");
        setError(getAxiosErrorMessage(e));
      }
    },
  });

  const createSf = useMutation({
    mutationFn: ({ nom, familleId, code }) =>
      api.post("familles/sous-familles", {
        code,
        nom: nom.trim(),
        familleId: Number(familleId),
      }),
    onSuccess: () => {
      closeSfDrawer();
      qc.invalidateQueries({ queryKey: ["sous-familles"] });
    },
    onError: (e) => {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
        setError("");
      } else {
        setCodeError("");
        setError(getAxiosErrorMessage(e));
      }
    },
  });

  const updateFam = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`familles/${id}`, payload),
    onSuccess: () => {
      setEditingFamilleId(null);
      setFamEditForm({ code: "", nom: "", description: "" });
      setOriginalFamNom("");
      qc.invalidateQueries({ queryKey: ["familles"] });
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const deleteFam = useMutation({
    mutationFn: (id) => api.delete(`familles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familles"] });
      qc.invalidateQueries({ queryKey: ["sous-familles"] });
      setConfirm(null);
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const updateSf = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`familles/sous-familles/${id}`, payload),
    onSuccess: () => {
      setEditingSousFamilleId(null);
      setSfEditForm({ code: "", nom: "", familleId: "" });
      setOriginalSfNom("");
      qc.invalidateQueries({ queryKey: ["sous-familles"] });
      qc.invalidateQueries({ queryKey: ["familles"] });
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const deleteSf = useMutation({
    mutationFn: (id) => api.delete(`familles/sous-familles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sous-familles"] });
      setConfirm(null);
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const setStatutFamMutation = useMutation({
    mutationFn: ({ id, statut }) => api.patch(`familles/${id}/statut`, { statut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["familles"] });
      setConfirm(null);
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const setStatutSfMutation = useMutation({
    mutationFn: ({ id, statut }) => api.patch(`familles/sous-familles/${id}/statut`, { statut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sous-familles"] });
      setConfirm(null);
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  function handleToggleFamilleStatut(f) {
    const next = parseRefsStatut(f) === "ACTIF" ? "INACTIF" : "ACTIF";
    if (next === "INACTIF") {
      setConfirm({
        type: "toggle-fam",
        item: f,
        nextStatut: "INACTIF",
        title: "Désactiver cette famille ?",
        message:
          "Cette famille ne sera plus proposée pour de nouveaux articles. Les articles existants restent inchangés.",
        confirmLabel: "Désactiver",
      });
    } else {
      setConfirm({
        type: "toggle-fam",
        item: f,
        nextStatut: "ACTIF",
        title: "Réactiver cette famille ?",
        message: "Cette famille sera à nouveau proposée lors de la création ou modification d'articles.",
        confirmLabel: "Réactiver",
      });
    }
  }

  function handleToggleSfStatut(s) {
    const next = parseRefsStatut(s) === "ACTIF" ? "INACTIF" : "ACTIF";
    if (next === "INACTIF") {
      setConfirm({
        type: "toggle-sf",
        item: s,
        nextStatut: "INACTIF",
        title: "Désactiver cette sous-famille ?",
        message:
          "Cette sous-famille ne sera plus proposée pour de nouveaux articles. Les articles existants restent inchangés.",
        confirmLabel: "Désactiver",
      });
    } else {
      setConfirm({
        type: "toggle-sf",
        item: s,
        nextStatut: "ACTIF",
        title: "Réactiver cette sous-famille ?",
        message: "Cette sous-famille sera à nouveau proposée lors de la création ou modification d'articles.",
        confirmLabel: "Réactiver",
      });
    }
  }

  function handleDeleteFamPermanent(f) {
    setConfirm({
      type: "delete-fam",
      item: f,
      title: "Supprimer définitivement cette famille ?",
      message: `« ${f.nom} » sera supprimée de façon irréversible (uniquement si inactive et sans article rattaché).`,
      confirmLabel: "Supprimer définitivement",
    });
  }

  function handleDeleteSfPermanent(s) {
    setConfirm({
      type: "delete-sf",
      item: s,
      title: "Supprimer définitivement cette sous-famille ?",
      message: `« ${s.nom} » sera supprimée de façon irréversible (uniquement si inactive et sans article rattaché).`,
      confirmLabel: "Supprimer définitivement",
    });
  }

  function startEditFamille(f) {
    setEditingFamilleId(f.id);
    setFamEditForm({
      code: f.code ?? "",
      nom: f.nom ?? "",
      description: f.description ?? "",
    });
    setOriginalFamNom(f.nom ?? "");
    setError("");
  }

  function startEditSousFamille(s) {
    setEditingSousFamilleId(s.id);
    setSfEditForm({
      code: s.code ?? "",
      nom: s.nom ?? "",
      familleId: s.familleId != null ? String(s.familleId) : "",
    });
    setOriginalSfNom(s.nom ?? "");
    setError("");
  }

  function cancelEditFamille() {
    setEditingFamilleId(null);
    setFamEditForm({ code: "", nom: "", description: "" });
    setOriginalFamNom("");
  }

  function cancelEditSousFamille() {
    setEditingSousFamilleId(null);
    setSfEditForm({ code: "", nom: "", familleId: "" });
    setOriginalSfNom("");
  }

  if (!canRead) {
    return (
      <PageShell
        title="Familles & sous-familles"
        subtitle="Référentiel produit"
        actions={<BackToProductsButton onClick={() => navigate("/articles")} />}
      >
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Accès refusé.
        </p>
      </PageShell>
    );
  }

  const backButton = <BackToProductsButton onClick={() => navigate("/articles")} />;

  const isEmpty = !isLoading && filteredFamilles.length === 0;

  return (
    <PageShell
      title="Familles & sous-familles"
      subtitle="Arborescence catalogue — catégories et branches"
      actions={backButton}
    >
      <div className="space-y-5">
        {canRead && !canWrite && (
          <p className="text-xs text-[var(--text-muted)]">
            Votre rôle est en lecture seule. Les actions Modifier/Supprimer nécessitent la
            permission <span className="text-[var(--text-secondary)]">stock:write</span>.
          </p>
        )}

        <RefsFilterBoard
          theme="famille"
          title="Recherche & filtres familles"
          subtitle="Filtrez familles et sous-familles par nom, code ou statut"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher famille ou sous-famille…"
          statutFilter={statutFilter}
          onStatutChange={setStatutFilter}
          statutOptions={REFS_STATUT_FILTER_OPTIONS}
          actions={
            canWrite ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCreateFamNom("");
                    setCreateFamDescription("");
                    setShowFamDrawer(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, #34d399, #059669)",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.4)",
                  }}
                >
                  <FolderPlus className="h-4 w-4" />
                  Nouvelle famille
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateSfNom("");
                    setCreateSfFamilleId("");
                    setShowSfDrawer(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, #06b6d4, #0ea5e9)",
                    boxShadow: "0 4px 14px rgba(14,165,233,0.35)",
                  }}
                >
                  <GitBranch className="h-4 w-4" />
                  Nouvelle sous-famille
                </button>
              </>
            ) : null
          }
        />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <CoutKpiCard
            delayIndex={0}
            title="Familles"
            value={familles.length}
            subtitle="Catégories principales du catalogue"
            icon={FolderTree}
            accentColor="#10b981"
            barPct={100}
          />
          <CoutKpiCard
            delayIndex={1}
            title="Sous-familles"
            value={sous.length}
            subtitle={
              familles.length
                ? `~${Math.round(sous.length / familles.length)} sous-famille(s) par famille`
                : "Aucune famille créée"
            }
            icon={GitBranch}
            accentColor="#06b6d4"
            barPct={
              familles.length
                ? Math.min(100, (sous.length / (familles.length * 3)) * 100)
                : 0
            }
          />
          <RefsAlertKpiCard
            delayIndex={2}
            title="Articles liés"
            value={totalArticles}
            subtitle="Articles rattachés aux familles"
            icon={Package}
            pulse={totalArticles > 0}
          />
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--color-border-tertiary)",
              background: "var(--color-background-secondary)",
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b px-4 py-3"
                style={{
                  borderColor: "var(--color-border-tertiary)",
                  animation: "refsPulse 1.5s ease infinite",
                }}
              >
                <div
                  className="h-7 w-7 rounded-lg"
                  style={{ background: "var(--color-border-tertiary)" }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-3 w-1/3 rounded-full"
                    style={{ background: "var(--color-border-tertiary)" }}
                  />
                  <div
                    className="h-2 w-1/5 rounded-full"
                    style={{ background: "var(--color-border-tertiary)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(55,138,221,0.08)",
                border: "1px solid rgba(55,138,221,0.15)",
              }}
            >
              <FolderTree className="h-8 w-8" style={{ color: "#378ADD", opacity: 0.5 }} />
            </div>
            <div className="text-center">
              <p
                className="mb-1 text-base font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {search ? "Aucun résultat" : "Aucune famille"}
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                {search
                  ? `Aucun élément ne correspond à « ${search} »`
                  : "Créez votre première famille pour commencer"}
              </p>
            </div>
            {canWrite && !search && (
              <button
                type="button"
                onClick={() => setShowFamDrawer(true)}
                className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ background: "linear-gradient(135deg, #378ADD, #2563a8)" }}
              >
                <FolderPlus className="h-4 w-4" />
                Créer une famille
              </button>
            )}
          </div>
        ) : (
          <div className="animate-fadeUp">
            <FamilyTreeTable
              familles={paginatedFamilles}
              totalCount={totalFiltered}
              totalSfCount={totalSfFiltered}
              page={page}
              pages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              sousByFamille={sousByFamille}
              canWrite={canWrite}
              onToggleStatutFamille={handleToggleFamilleStatut}
              onToggleStatutSousFamille={handleToggleSfStatut}
              onEditFamille={startEditFamille}
              onEditSousFamille={startEditSousFamille}
              onDeleteFamille={handleDeleteFamPermanent}
              onDeleteSousFamille={handleDeleteSfPermanent}
              canDeleteFamille={canDeleteFamillePermanent}
              canDeleteSousFamille={canDeleteSousFamillePermanent}
              editingFamilleId={editingFamilleId}
              famEditForm={famEditForm}
              onFamEditFormChange={setFamEditForm}
              onSaveFamille={(f) =>
                updateFam.mutate({
                  id: f.id,
                  payload: {
                    code: famEditForm.code.trim(),
                    nom: famEditForm.nom.trim(),
                    description: famEditForm.description.trim() || null,
                  },
                })
              }
              onCancelEditFamille={cancelEditFamille}
              updateFamPending={updateFam.isPending}
              editingSousFamilleId={editingSousFamilleId}
              sfEditForm={sfEditForm}
              onSfEditFormChange={setSfEditForm}
              onSaveSousFamille={(s) =>
                updateSf.mutate({
                  id: s.id,
                  payload: {
                    code: sfEditForm.code.trim(),
                    nom: sfEditForm.nom.trim(),
                    familleId: Number(sfEditForm.familleId || s.familleId),
                  },
                })
              }
              onCancelEditSousFamille={cancelEditSousFamille}
              updateSfPending={updateSf.isPending}
            />
          </div>
        )}
      </div>

      {/* Famille create modal */}
      {showFamDrawer && canWrite && (
        <div
          className="modal-overlay-backdrop fixed inset-0 z-40 flex items-center justify-center p-4"
          onClick={closeFamDrawer}
          role="presentation"
        >
          <div
            className="modal-overlay-dialog w-full max-w-md rounded-2xl border shadow-2xl"
            style={{
              background: "var(--bg-card, var(--color-background-primary))",
              borderColor: "var(--border-default, var(--color-border-tertiary))",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="famille-modal-title"
          >
            <div
              className="flex items-center justify-between border-b p-5"
              style={{ borderColor: "var(--border-default, var(--color-border-tertiary))" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "rgba(55,138,221,0.12)" }}
                >
                  <FolderPlus className="h-5 w-5" style={{ color: "#378ADD" }} />
                </div>
                <div>
                  <h2
                    id="famille-modal-title"
                    className="text-base font-semibold"
                    style={{ color: "var(--text-primary, var(--color-text-primary))" }}
                  >
                    Nouvelle famille
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted, var(--color-text-tertiary))" }}>
                    Catégorie principale du catalogue
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeFamDrawer}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-muted, var(--color-text-tertiary))" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {error && (
                <div
                  className="mb-4 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    background: "rgba(226,75,74,0.08)",
                    borderColor: "rgba(226,75,74,0.25)",
                    color: "#E24B4A",
                  }}
                >
                  {error}
                </div>
              )}

              <FamilleCreateForm
                bare
                nom={createFamNom}
                description={createFamDescription}
                onNomChange={setCreateFamNom}
                onDescriptionChange={setCreateFamDescription}
                existingCodes={existingFamilleCodes}
                existingNoms={existingFamilleNoms}
                codeError={codeError}
                onClearCodeError={() => setCodeError("")}
                isPending={createFam.isPending}
                onCancel={closeFamDrawer}
                onSubmit={({ code }) =>
                  createFam.mutate({
                    nom: createFamNom,
                    description: createFamDescription,
                    code,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Sous-famille create modal */}
      {showSfDrawer && canWrite && (
        <div
          className="modal-overlay-backdrop fixed inset-0 z-40 flex items-center justify-center p-4"
          onClick={closeSfDrawer}
          role="presentation"
        >
          <div
            className="modal-overlay-dialog w-full max-w-md rounded-2xl border shadow-2xl"
            style={{
              background: "var(--bg-card, var(--color-background-primary))",
              borderColor: "var(--border-default, var(--color-border-tertiary))",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sf-modal-title"
          >
            <div
              className="flex items-center justify-between border-b p-5"
              style={{ borderColor: "var(--border-default, var(--color-border-tertiary))" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: "rgba(29,158,117,0.12)" }}
                >
                  <GitBranch className="h-5 w-5" style={{ color: "#1D9E75" }} />
                </div>
                <div>
                  <h2
                    id="sf-modal-title"
                    className="text-base font-semibold"
                    style={{ color: "var(--text-primary, var(--color-text-primary))" }}
                  >
                    Nouvelle sous-famille
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted, var(--color-text-tertiary))" }}>
                    Sous-catégorie rattachée à une famille
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeSfDrawer}
                className="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-muted, var(--color-text-tertiary))" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {error && (
                <div
                  className="mb-4 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    background: "rgba(226,75,74,0.08)",
                    borderColor: "rgba(226,75,74,0.25)",
                    color: "#E24B4A",
                  }}
                >
                  {error}
                </div>
              )}

              <SousFamilleCreateForm
                bare
                activeFamillesOnly
                nom={createSfNom}
                familleId={createSfFamilleId}
                onNomChange={setCreateSfNom}
                onFamilleIdChange={setCreateSfFamilleId}
                existingCodes={existingSfCodes}
                existingNoms={existingSfNoms}
                codeError={codeError}
                onClearCodeError={() => setCodeError("")}
                familles={familles}
                isPending={createSf.isPending}
                onCancel={closeSfDrawer}
                onSubmit={({ code }) =>
                  createSf.mutate({
                    nom: createSfNom,
                    familleId: createSfFamilleId,
                    code,
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={String(confirm.type).startsWith("delete") ? "danger" : "primary"}
          loading={
            setStatutFamMutation.isPending ||
            setStatutSfMutation.isPending ||
            deleteFam.isPending ||
            deleteSf.isPending
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.type === "delete-fam") {
              deleteFam.mutate(confirm.item.id);
            } else if (confirm.type === "delete-sf") {
              deleteSf.mutate(confirm.item.id);
            } else if (confirm.type === "toggle-fam") {
              setStatutFamMutation.mutate({ id: confirm.item.id, statut: confirm.nextStatut });
            } else if (confirm.type === "toggle-sf") {
              setStatutSfMutation.mutate({ id: confirm.item.id, statut: confirm.nextStatut });
            }
          }}
        />
      )}
    </PageShell>
  );
}
