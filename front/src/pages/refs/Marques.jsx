import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  Hash,
  Package,
  Plus,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import {
  getDuplicateCodeMessage,
  isDuplicateCodeError,
} from "../../components/forms/SuggestedCodeInput";
import PageShell from "../../components/ui/PageShell";
import ConfirmModal from "../../components/ui/ConfirmModal";
import DynamicKpiCard, { DynamicKpiGrid } from "../../components/ui/DynamicKpiCard";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useCountUp } from "../../hooks/useCountUp";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import BackToProductsButton from "./components/BackToProductsButton";
import RefsAlertKpiCard from "./components/RefsAlertKpiCard";
import RefsFilterBoard from "./components/RefsFilterBoard";
import MarqueCreateModal from "./components/MarqueCreateModal";
import RefsTablePagination from "./components/RefsTablePagination";
import MarqueImagePicker from "./components/MarqueImagePicker";
import {
  getArticleCount,
  resolveMarqueImageUrl,
} from "./components/refsUtils";
import {
  canDeleteMarquePermanent,
  parseRefsStatut,
  REFS_STATUT_FILTER_OPTIONS,
} from "./refsStatusUi";
import {
  MarquesActionsBar,
  MarquesArticlesBadge,
  MarquesAvatarWrap,
  MarquesCodeChip,
  MarquesColHead,
  MarquesColHeadActions,
  MarquesIconBtn,
  MarquesStatutPill,
  MarquesTableShell,
  MarquesTableStyles,
} from "./components/marquesTableUi";

async function uploadMarqueImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  const res = await api.post("marques/upload-image", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data?.url || null;
}

function resetImageState(setFile, setPreview, revoke) {
  if (revoke) URL.revokeObjectURL(revoke);
  setFile(null);
  setPreview("");
}

function brandHue(nom) {
  return ((nom?.charCodeAt(0) ?? 65) * 137) % 360;
}

function BrandAvatar({ marque, size = 48 }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = marque?.imageUrl ? resolveMarqueImageUrl(marque.imageUrl) : "";
  const showImage = imageUrl && !imgError;
  const hue = brandHue(marque?.nom);

  if (showImage) {
    return (
      <img
        src={imageUrl}
        alt={marque.nom}
        className="h-12 w-12 flex-shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 30) % 360}, 55%, 30%))`,
      }}
    >
      {(marque?.nom || "?")[0].toUpperCase()}
    </div>
  );
}

export default function Marques() {
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
  const [showDrawer, setShowDrawer] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [createNom, setCreateNom] = useState("");
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImagePreview, setCreateImagePreview] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ code: "", nom: "", imageUrl: "" });
  const [originalEditNom, setOriginalEditNom] = useState("");
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [editImageCleared, setEditImageCleared] = useState(false);
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");

  const { data: marques = [], isLoading } = useQuery({
    queryKey: ["marques", societeScope],
    queryFn: () =>
      api
        .get("marques", { params: { limit: 100 } })
        .then((r) => (Array.isArray(r.data) ? r.data : r.data?.items ?? [])),
    enabled: canRead,
  });

  const existingCodes = useMemo(() => marques.map((m) => m.code).filter(Boolean), [marques]);
  const existingNoms = useMemo(
    () => marques.map((m) => m.nom.trim().toLowerCase()),
    [marques]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = marques;
    const sf = String(statutFilter ?? "").trim().toUpperCase();
    if (sf === "ACTIF" || sf === "INACTIF") {
      list = list.filter((m) => parseRefsStatut(m) === sf);
    }
    if (!q) return list;
    return list.filter(
      (m) =>
        m.nom?.toLowerCase().includes(q) || m.code?.toLowerCase().includes(q)
    );
  }, [marques, search, statutFilter]);

  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statutFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const activeCount = marques.filter((m) => parseRefsStatut(m) === "ACTIF").length;
  const animatedActiveCount = useCountUp(activeCount);

  const closeDrawer = useCallback(() => {
    setShowDrawer(false);
    setCreateNom("");
    setCodeError("");
    resetImageState(setCreateImageFile, setCreateImagePreview, createImagePreview);
  }, [createImagePreview]);

  useEffect(() => {
    return () => {
      if (createImagePreview) URL.revokeObjectURL(createImagePreview);
      if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    };
  }, [createImagePreview, editImagePreview]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const createMutation = useMutation({
    mutationFn: async ({ nom, code, imageFile }) => {
      let imageUrl = null;
      if (imageFile) imageUrl = await uploadMarqueImage(imageFile);
      return api.post("marques", { code, nom: nom.trim(), imageUrl });
    },
    onSuccess: () => {
      closeDrawer();
      qc.invalidateQueries({ queryKey: ["marques"] });
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload, imageFile, imageCleared }) => {
      let imageUrl = payload.imageUrl;
      if (imageFile) {
        imageUrl = await uploadMarqueImage(imageFile);
      } else if (imageCleared) {
        imageUrl = null;
      }
      return api.patch(`marques/${id}`, { ...payload, imageUrl });
    },
    onSuccess: () => {
      setEditingId(null);
      setEditForm({ code: "", nom: "", imageUrl: "" });
      setOriginalEditNom("");
      resetImageState(setEditImageFile, setEditImagePreview, editImagePreview);
      setEditImageCleared(false);
      qc.invalidateQueries({ queryKey: ["marques"] });
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`marques/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marques"] });
      setConfirm(null);
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const setStatutMutation = useMutation({
    mutationFn: ({ id, statut }) => api.patch(`marques/${id}/statut`, { statut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marques"] });
      setConfirm(null);
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  function handleToggleStatut(m) {
    const next = parseRefsStatut(m) === "ACTIF" ? "INACTIF" : "ACTIF";
    if (next === "INACTIF") {
      setConfirm({
        type: "toggle",
        item: m,
        nextStatut: "INACTIF",
        title: "Désactiver cette marque ?",
        message:
          "Cette marque ne sera plus proposée pour de nouveaux articles. Les articles existants qui y sont déjà rattachés restent inchangés.",
        confirmLabel: "Désactiver",
      });
    } else {
      setConfirm({
        type: "toggle",
        item: m,
        nextStatut: "ACTIF",
        title: "Réactiver cette marque ?",
        message: "Cette marque sera à nouveau proposée lors de la création ou modification d'articles.",
        confirmLabel: "Réactiver",
      });
    }
  }

  function handleDeletePermanent(m) {
    setConfirm({
      type: "delete",
      item: m,
      title: "Supprimer définitivement cette marque ?",
      message: `« ${m.nom} » sera supprimée de façon irréversible. Uniquement possible pour une marque inactive sans article rattaché.`,
      confirmLabel: "Supprimer définitivement",
    });
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditForm({
      code: row.code ?? "",
      nom: row.nom ?? "",
      imageUrl: row.imageUrl ?? "",
    });
    setOriginalEditNom(row.nom ?? "");
    resetImageState(setEditImageFile, setEditImagePreview, editImagePreview);
    setEditImageCleared(false);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ code: "", nom: "", imageUrl: "" });
    setOriginalEditNom("");
    resetImageState(setEditImageFile, setEditImagePreview, editImagePreview);
    setEditImageCleared(false);
  }

  function pickCreateImage(file) {
    if (!file) return;
    if (createImagePreview) URL.revokeObjectURL(createImagePreview);
    setCreateImageFile(file);
    setCreateImagePreview(URL.createObjectURL(file));
  }

  function pickEditImage(file) {
    if (!file) return;
    if (editImagePreview) URL.revokeObjectURL(editImagePreview);
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
    setEditImageCleared(false);
  }

  function clearCreateImage() {
    resetImageState(setCreateImageFile, setCreateImagePreview, createImagePreview);
  }

  function clearEditImage() {
    resetImageState(setEditImageFile, setEditImagePreview, editImagePreview);
    setEditImageCleared(true);
    setEditForm((prev) => ({ ...prev, imageUrl: "" }));
  }

  const usedCount = marques.filter((m) => getArticleCount(m) > 0).length;
  const unusedCount = marques.filter((m) => getArticleCount(m) === 0).length;

  const editPreviewSrc =
    editImagePreview ||
    (editForm.imageUrl ? resolveMarqueImageUrl(editForm.imageUrl) : "");

  if (!canRead) {
    return (
      <PageShell
        title="Marques"
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

  function renderRowActions(m) {
    const statut = parseRefsStatut(m);
    const isEditing = editingId === m.id;
    const canDelete = canDeleteMarquePermanent(m);

    if (isEditing) {
      return (
        <MarquesActionsBar>
          <MarquesIconBtn
            variant="save"
            title="Enregistrer"
            disabled={updateMutation.isPending || !editForm.code.trim() || !editForm.nom.trim()}
            onClick={() =>
              updateMutation.mutate({
                id: m.id,
                payload: {
                  code: editForm.code.trim(),
                  nom: editForm.nom.trim(),
                  imageUrl: editForm.imageUrl || null,
                },
                imageFile: editImageFile,
                imageCleared: editImageCleared,
              })
            }
          />
          <MarquesIconBtn variant="cancel" title="Annuler" onClick={cancelEdit} />
        </MarquesActionsBar>
      );
    }

    if (!canWrite) return null;

    return (
      <MarquesActionsBar>
        <MarquesIconBtn variant="edit" title="Modifier" onClick={() => startEdit(m)} />
        <MarquesIconBtn
          variant={statut === "INACTIF" ? "activate" : "deactivate"}
          title={statut === "INACTIF" ? "Réactiver" : "Désactiver"}
          onClick={() => handleToggleStatut(m)}
        />
        {canDelete && (
          <MarquesIconBtn
            variant="delete"
            title="Supprimer définitivement"
            onClick={() => handleDeletePermanent(m)}
          />
        )}
      </MarquesActionsBar>
    );
  }

  return (
    <PageShell
      title="Marques"
      subtitle={
        <>
          <span className="font-medium tabular-nums" style={{ color: "#1D9E75" }}>
            {animatedActiveCount}
          </span>{" "}
          active{activeCount !== 1 ? "s" : ""} · {marques.length} enregistrée{marques.length !== 1 ? "s" : ""}
        </>
      }
      actions={backButton}
    >
      <MarquesTableStyles />
      <div className="space-y-5">
        {canRead && !canWrite && (
          <p className="text-xs text-[var(--text-muted)]">
            Votre rôle est en lecture seule. Les actions Modifier/Supprimer nécessitent la
            permission <span className="text-[var(--text-secondary)]">stock:write</span>.
          </p>
        )}

        <RefsFilterBoard
          theme="marque"
          title="Recherche & filtres marques"
          subtitle="Filtrez par nom, code ou statut"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Rechercher par nom ou code…"
          statutFilter={statutFilter}
          onStatutChange={setStatutFilter}
          statutOptions={REFS_STATUT_FILTER_OPTIONS}
          actions={
            canWrite ? (
              <button
                type="button"
                onClick={() => {
                  setCreateNom("");
                  clearCreateImage();
                  setShowDrawer(true);
                }}
                className={PRIMARY_BTN_CLASSES}
                style={{
                  ...primaryButtonStyle,
                  background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                  boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Nouvelle marque
              </button>
            ) : null
          }
        />

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
        >
        <DynamicKpiGrid>
          <DynamicKpiCard
            delayIndex={0}
            title="Total marques"
            value={marques.length}
            subtitle="Référentiel produit complet"
            icon={Tag}
            accentColor="#378ADD"
            barPct={100}
          />
          <DynamicKpiCard
            delayIndex={1}
            title="Marques utilisées"
            value={usedCount}
            subtitle={
              marques.length
                ? `${Math.round((usedCount / marques.length) * 100)}% liées à des articles`
                : "Aucune marque enregistrée"
            }
            icon={CheckCircle}
            accentColor="#1D9E75"
            barPct={marques.length ? (usedCount / marques.length) * 100 : 0}
          />
          <RefsAlertKpiCard
            delayIndex={2}
            title="Non utilisées"
            value={unusedCount}
            subtitle="Marques sans article associé"
            icon={AlertCircle}
            pulse={unusedCount > 0}
          />
        </DynamicKpiGrid>
        </motion.div>

        {/* Table */}
        {isLoading ? (
          <div
            className="overflow-hidden rounded-2xl border animate-fadeUp"
            style={{
              borderColor: "var(--color-border-tertiary)",
              background: "var(--color-background-secondary)",
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b px-5 py-4"
                style={{
                  borderColor: "var(--color-border-tertiary)",
                  animation: `fadeUp 0.3s ease ${i * 60}ms both`,
                }}
              >
                <div className="h-10 w-10 rounded-xl" style={{ background: "var(--color-border-tertiary)", animation: "refsPulse 1.5s ease infinite" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded-full" style={{ background: "var(--color-border-tertiary)", animation: "refsPulse 1.5s ease infinite" }} />
                  <div className="h-2.5 w-1/5 rounded-full" style={{ background: "var(--color-border-tertiary)", animation: "refsPulse 1.5s ease infinite" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "rgba(55,138,221,0.08)",
                border: "1px solid rgba(55,138,221,0.15)",
              }}
            >
              <Tag className="h-8 w-8" style={{ color: "#378ADD", opacity: 0.5 }} />
            </div>
            <div className="text-center">
              <p
                className="mb-1 text-base font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                {search ? "Aucun résultat" : "Aucune marque"}
              </p>
              <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                {search
                  ? `Aucune marque ne correspond à « ${search} »`
                  : "Créez votre première marque pour commencer"}
              </p>
            </div>
            {canWrite && !search && (
              <button
                type="button"
                onClick={() => setShowDrawer(true)}
                className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
                style={{ background: "linear-gradient(135deg, #378ADD, #2563a8)" }}
              >
                <Plus className="h-4 w-4" />
                Créer une marque
              </button>
            )}
          </div>
        ) : (
          <MarquesTableShell resultCount={totalFiltered}>
            <div className="max-h-[min(70vh,640px)] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="marques-pro-thead">
                <tr>
                  <MarquesColHead icon={Tag} label="Marque" tone="info" />
                  <MarquesColHead icon={Hash} label="Code" tone="accent" />
                  <MarquesColHead icon={Package} label="Articles" tone="success" />
                  <MarquesColHead icon={Zap} label="Statut" tone="warning" />
                  {canWrite && <MarquesColHeadActions />}
                </tr>
              </thead>
              <tbody>
                {paginatedFiltered.map((m, i) => {
                  const articleCount = getArticleCount(m);
                  const isEditing = editingId === m.id;
                  const statut = parseRefsStatut(m);

                  return (
                    <tr
                      key={m.id}
                      className={`marques-pro-row group ${statut === "INACTIF" ? "is-inactive" : ""}`}
                      style={{
                        animation: `marquesRowIn 0.4s ease ${Math.min(i * 55, 550)}ms both`,
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3.5">
                          <MarquesAvatarWrap>
                            <BrandAvatar marque={m} size={44} />
                          </MarquesAvatarWrap>
                          <div className="min-w-0">
                            {isEditing ? (
                              <>
                                <input
                                  className="mb-2 w-full max-w-[240px] rounded-xl px-3 py-2 text-sm font-semibold outline-none transition-shadow"
                                  style={{
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--accent-info)",
                                    color: "var(--text-primary)",
                                    boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent-info) 15%, transparent)",
                                  }}
                                  value={editForm.nom}
                                  onChange={(e) => setEditForm((p) => ({ ...p, nom: e.target.value }))}
                                  autoFocus
                                />
                                <MarqueImagePicker
                                  nom={editForm.nom}
                                  code={editForm.code}
                                  previewSrc={editPreviewSrc}
                                  onPickFile={pickEditImage}
                                  onClear={clearEditImage}
                                  compact
                                />
                              </>
                            ) : (
                              <>
                                <span
                                  className="block truncate text-sm font-semibold tracking-tight"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {m.nom}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  <Sparkles size={10} style={{ color: "var(--accent-primary)" }} />
                                  Référentiel produit
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <input
                            className="w-32 rounded-xl px-3 py-2 font-mono text-xs font-bold outline-none"
                            style={{
                              background: "var(--bg-input)",
                              border: "1px solid var(--info-border)",
                              color: "var(--info-text)",
                            }}
                            value={editForm.code}
                            onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))}
                          />
                        ) : (
                          <MarquesCodeChip code={m.code} />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <MarquesArticlesBadge count={articleCount} />
                      </td>
                      <td className="px-5 py-4">
                        <MarquesStatutPill row={m} />
                      </td>
                      {canWrite && (
                        <td className="px-5 py-4 text-right">
                          {renderRowActions(m)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <RefsTablePagination
              page={page}
              pages={totalPages}
              total={totalFiltered}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              entityLabel="marque"
              selectAriaLabel="Marques par page"
            />
          </MarquesTableShell>
        )}
      </div>

      <MarqueCreateModal
        open={showDrawer && canWrite}
        onClose={closeDrawer}
        error={error}
        createNom={createNom}
        onCreateNomChange={setCreateNom}
        existingCodes={existingCodes}
        existingNoms={existingNoms}
        codeError={codeError}
        onClearCodeError={() => setCodeError("")}
        createImagePreview={createImagePreview}
        onPickImage={pickCreateImage}
        onClearImage={clearCreateImage}
        isPending={createMutation.isPending}
        onSubmit={({ code }) =>
          createMutation.mutate({ nom: createNom, code, imageFile: createImageFile })
        }
      />

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          variant={confirm.type === "delete" ? "danger" : "primary"}
          loading={setStatutMutation.isPending || deleteMutation.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.type === "delete") {
              deleteMutation.mutate(confirm.item.id);
            } else {
              setStatutMutation.mutate({ id: confirm.item.id, statut: confirm.nextStatut });
            }
          }}
        />
      )}
    </PageShell>
  );
}
