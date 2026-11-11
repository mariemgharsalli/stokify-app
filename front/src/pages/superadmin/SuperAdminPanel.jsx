import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import {
  getDuplicateCodeMessage,
  isDuplicateCodeError,
} from "../../components/forms/SuggestedCodeInput";
import { useAuthStore } from "../../store/authStore";
import StockPagination from "../../components/stock/StockPagination";
import ConfirmToggleSocieteModal from "./components/ConfirmToggleSocieteModal";
import SocieteDetailModal from "./components/SocieteDetailModal";
import SocieteDrawer from "./components/SocieteDrawer";
import SocieteHeader from "./components/SocieteHeader";
import SocieteList, {
  useFilteredCompanies,
  useFilterCounts,
} from "./components/SocieteList";
import SocieteToolbar from "./components/SocieteToolbar";
import { SOCIETES_ANIMATIONS } from "./components/societesTheme";

const PAGE_SIZE_OPTIONS = [6, 10, 12, 24, 50];
const DEFAULT_PAGE_SIZE = 10;

function formatApiError(err) {
  if (!err.response) {
    if (err.message === "Network Error") {
      return "Serveur injoignable (verifiez que le backend tourne sur le port 5000).";
    }
    return err.message || "Erreur reseau";
  }
  const status = err.response.status;
  const d = err.response.data;
  if (typeof d === "string") return `${status}: ${d.slice(0, 200)}`;
  if (d?.message) return String(d.message);
  if (Array.isArray(d?.errors)) {
    const parts = d.errors.map((e) =>
      typeof e === "string" ? e : e.msg || e.message || JSON.stringify(e)
    );
    return parts.filter(Boolean).join(" — ") || `Erreur ${status}`;
  }
  return `Erreur HTTP ${status}`;
}

function SocietesToast({ toast }) {
  if (!toast) return null;
  const styles =
    toast.type === "error"
      ? { border: "var(--danger-border)", background: "var(--danger-bg)", color: "var(--danger-text)" }
      : toast.type === "warning"
        ? { border: "var(--warning-border)", background: "var(--warning-bg)", color: "var(--warning-text)" }
        : { border: "var(--success-border)", background: "var(--success-bg)", color: "var(--success-text)" };

  return (
    <div
      className="fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl animate-[societesToastIn_.2s_ease]"
      style={styles}
    >
      {toast.message}
    </div>
  );
}

const EMPTY_FORM = {
  nom: "",
  email: "",
  actifRegistration: true,
  adresse: "",
  ville: "",
};

export default function SuperAdminPanel() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editingSociete, setEditingSociete] = useState(null);
  const [confirmToggleSociete, setConfirmToggleSociete] = useState(null);
  const [detailSociete, setDetailSociete] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [toast, setToast] = useState(null);

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [createLogoFile, setCreateLogoFile] = useState(null);
  const [createLogoPreviewUrl, setCreateLogoPreviewUrl] = useState(null);

  function pickCreateLogoFile(file) {
    setCreateLogoFile(file);
    setCreateLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  const [formError, setFormError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [listError, setListError] = useState("");
  const updateFromDrawerRef = useRef(false);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const {
    data: companies = [],
    isLoading: companiesLoading,
    isError: companiesQueryError,
    error: companiesErr,
  } = useQuery({
    queryKey: ["companies-admin"],
    queryFn: () => api.get("companies").then((r) => r.data),
    enabled: true,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-global"],
    queryFn: () =>
      api.get("users", { params: { limit: 500 } }).then((r) =>
        Array.isArray(r.data) ? r.data : r.data?.items ?? []
      ),
    enabled: isSuperAdmin,
  });

  const existingCodes = useMemo(
    () => companies.map((c) => c.code).filter(Boolean),
    [companies]
  );
  const existingNoms = useMemo(
    () => companies.map((c) => c.nom.trim().toLowerCase()),
    [companies]
  );

  const filteredCompanies = useFilteredCompanies(companies, search, filter);
  const filterCounts = useFilterCounts(companies);

  const totalResults = filteredCompanies.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalResults === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalResults);
  const pagedCompanies = useMemo(
    () => filteredCompanies.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredCompanies, safePage, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [search, filter, pageSize, viewMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const drawerOpen = showCreatePanel || Boolean(editingSociete);

  const resetForm = useCallback(() => {
    setFormError("");
    setCodeError("");
    setFormSuccess("");
    setLatitude("");
    setLongitude("");
    setForm(EMPTY_FORM);
    pickCreateLogoFile(null);
  }, []);

  const closeDrawer = useCallback(() => {
    setShowCreatePanel(false);
    setEditingSociete(null);
    resetForm();
  }, [resetForm]);

  const openCreatePanel = useCallback(() => {
    setEditingSociete(null);
    setShowCreatePanel(true);
    resetForm();
  }, [resetForm]);

  const openEditPanel = useCallback((s) => {
    setShowCreatePanel(false);
    setEditingSociete(s);
    setFormError("");
    setFormSuccess("");
    setForm({
      nom: s.nom || "",
      email: s.email || "",
      actifRegistration: Boolean(s.actif),
      adresse: s.adresse || "",
      ville: s.ville || "",
    });
    setLatitude(s.latitude != null ? String(s.latitude) : "");
    setLongitude(s.longitude != null ? String(s.longitude) : "");
    pickCreateLogoFile(null);
  }, []);

  useEffect(() => {
    if (companiesQueryError && companiesErr) setListError(formatApiError(companiesErr));
    else setListError("");
  }, [companiesQueryError, companiesErr]);

  useEffect(() => {
    return () => {
      if (createLogoPreviewUrl) URL.revokeObjectURL(createLogoPreviewUrl);
    };
  }, [createLogoPreviewUrl]);

  const buildLocationPayload = () => ({
    ...(form.adresse.trim() ? { adresse: form.adresse.trim() } : {}),
    ...(form.ville.trim() ? { ville: form.ville.trim() } : {}),
    ...(latitude && longitude
      ? {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        }
      : {}),
  });

  const createMutation = useMutation({
    mutationFn: async ({ code }) => {
      const created = await api.post("companies", {
        code,
        nom: form.nom.trim(),
        actif: form.actifRegistration,
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...buildLocationPayload(),
      });

      if (createLogoFile && created?.data?.id) {
        const fd = new FormData();
        fd.append("logo", createLogoFile);
        await api.patch(`companies/${created.data.id}/logo`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      return created;
    },
    onSuccess: () => {
      showToast("Société créée avec succès.");
      closeDrawer();
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
    },
    onError: (e) => {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
        setFormError("");
      } else {
        setCodeError("");
        setFormError(formatApiError(e));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`companies/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
      if (updateFromDrawerRef.current) {
        setFormError("");
        showToast("Société mise à jour.");
        closeDrawer();
        updateFromDrawerRef.current = false;
      }
    },
    onError: (e) => {
      updateFromDrawerRef.current = false;
      if (drawerOpen) {
        setFormSuccess("");
        setFormError(formatApiError(e));
      } else {
        showToast(formatApiError(e), "error");
      }
    },
  });

  const toggleActifMutation = useMutation({
    mutationFn: ({ id, actif, nom, email }) =>
      api.patch(`companies/${id}`, {
        nom,
        email: email || "",
        actif,
      }),
    onSuccess: (_, { actif }) => {
      showToast(
        actif ? "Société réactivée avec succès." : "Société désactivée — accès bloqué.",
        actif ? "success" : "warning"
      );
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
      qc.invalidateQueries({ queryKey: ["companies", "sidebar-super-admin"] });
    },
    onError: (e) => showToast(formatApiError(e), "error"),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: ({ id, code, file }) => {
      const fd = new FormData();
      fd.append("logo", file);
      fd.append("societeCode", code || "");
      return api.patch(`companies/${id}/logo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
      showToast("Logo mis à jour.");
    },
    onError: (e) => showToast(formatApiError(e), "error"),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(payload) {
    setFormError("");
    setCodeError("");
    setFormSuccess("");

    if (editingSociete) {
      updateFromDrawerRef.current = true;
      updateMutation.mutate({
        id: Number(editingSociete.id),
        payload: {
          nom: form.nom.trim(),
          email: form.email.trim(),
          actif: form.actifRegistration,
          ...buildLocationPayload(),
        },
      });
    } else {
      createMutation.mutate({ code: payload?.code });
    }
  }

  function requestToggleActif(societe) {
    const nextActif = societe.actif === false;
    setConfirmToggleSociete({ societe, nextActif });
  }

  function confirmToggleActif() {
    if (!confirmToggleSociete) return;
    const { societe, nextActif } = confirmToggleSociete;
    toggleActifMutation.mutate(
      {
        id: Number(societe.id),
        actif: nextActif,
        nom: societe.nom,
        email: societe.email || "",
      },
      { onSettled: () => setConfirmToggleSociete(null) }
    );
  }

  function handleSocieteAction(action, societe) {
    if (action === "view") {
      setDetailSociete(societe);
      return;
    }
    if (action === "edit") {
      openEditPanel(societe);
      return;
    }
    if (action === "deactivate" || action === "reactivate") {
      setConfirmToggleSociete({
        societe,
        nextActif: action === "reactivate",
      });
    }
  }

  function handleLogoUpload(societe, file) {
    uploadLogoMutation.mutate({
      id: Number(societe.id),
      code: societe.code,
      file,
    });
  }

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-6 p-6 lg:p-8">
      <style>{SOCIETES_ANIMATIONS}</style>
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(55,138,221,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 0%, rgba(6,182,212,0.08), transparent 50%)",
        }}
      />
      <SocietesToast toast={toast} />

      <SocieteHeader
        companies={companies}
        userCount={users.length}
        usersLoading={usersLoading}
      />

      <SocieteToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        filterCounts={filterCounts}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onCreate={openCreatePanel}
        totalCount={companies.length}
        filteredCount={filteredCompanies.length}
      />

      <SocieteList
        companies={companies}
        filteredCompanies={pagedCompanies}
        companiesLoading={companiesLoading}
        listError={listError}
        viewMode={viewMode}
        isSuperAdmin={isSuperAdmin}
        uploadLogoMutation={uploadLogoMutation}
        onAction={handleSocieteAction}
        onToggleActif={requestToggleActif}
        togglePending={toggleActifMutation.isPending}
        onCreate={openCreatePanel}
        onLogoUpload={handleLogoUpload}
      />

      {!companiesLoading && totalResults > 0 ? (
        <div className="mt-4">
          <StockPagination
            page={safePage}
            totalPages={totalPages}
            totalResults={totalResults}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="société(s)"
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      ) : null}

      {drawerOpen && (
        <SocieteDrawer
          editingSociete={editingSociete}
          form={form}
          setForm={setForm}
          existingCodes={existingCodes}
          existingNoms={existingNoms}
          codeError={codeError}
          onClearCodeError={() => setCodeError("")}
          latitude={latitude}
          setLatitude={setLatitude}
          longitude={longitude}
          setLongitude={setLongitude}
          createLogoFile={createLogoFile}
          pickCreateLogoFile={pickCreateLogoFile}
          createLogoPreviewUrl={createLogoPreviewUrl}
          formError={formError}
          formSuccess={formSuccess}
          isPending={isPending}
          onClose={closeDrawer}
          onSubmit={handleSubmit}
        />
      )}

      <ConfirmToggleSocieteModal
        company={confirmToggleSociete?.societe}
        nextActif={confirmToggleSociete?.nextActif}
        onClose={() => setConfirmToggleSociete(null)}
        loading={toggleActifMutation.isPending}
        onConfirm={confirmToggleActif}
      />

      <SocieteDetailModal
        societe={detailSociete}
        onClose={() => setDetailSociete(null)}
        onAction={handleSocieteAction}
      />
    </div>
  );
}
