import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Building2, Plus, Search, Users } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useAuthPersistHydrated } from "../../hooks/useAuthPersistHydrated";
import { useToast } from "../../hooks/useToast";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import GlassPageHeader from "../../components/ui/GlassPageHeader";
import StockPagination from "../../components/stock/StockPagination";
import UserMetricCards from "./components/UserMetricCards";
import UserTableRow from "./components/UserTableRow";
import UserProfileDrawer from "./components/UserProfileDrawer";
import UserCreateWizard from "./components/UserCreateWizard";
import PendingUsersPanel from "./components/PendingUsersPanel";
import { FILTER_PILLS, roleLabel } from "./adminTheme";

const ROLES_FOR_ADMIN = ["ADMIN", "RESPONSABLE", "MAGASINIER", "COMPTABLE", "CLIENT"];
const ROLES_FOR_SUPER = ["SUPER_ADMIN", ...ROLES_FOR_ADMIN];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function matchFilter(u, filter) {
  if (filter === "ALL") return true;
  if (filter === "ACTIVE") return Boolean(u.actif);
  if (filter === "INACTIVE") return !u.actif;
  if (filter === "ADMIN") return ["ADMIN", "SUPER_ADMIN"].includes(u.role);
  return u.role === filter;
}

function formatApiError(err) {
  if (!err?.response) return err?.message || "Erreur reseau";
  const data = err.response.data;
  if (typeof data === "string") return data;
  if (data?.message) return String(data.message);
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((e) => e?.msg || e?.message || String(e)).join(" — ");
  }
  return `Erreur HTTP ${err.response.status}`;
}

function Toast({ toast }) {
  if (!toast) return null;
  const classes =
    toast.type === "error"
      ? "border-red-400/40 bg-red-500/15 text-red-200"
      : toast.type === "warning"
        ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
        : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  return (
    <div className={`fixed bottom-6 right-6 z-[80] px-4 py-2 rounded-xl border text-sm font-medium shadow-2xl animate-[toastIn_.2s_ease] ${classes}`}>
      {toast.message}
    </div>
  );
}

function EditModal({ target, roles, loading, onClose, onSave }) {
  const [role, setRole] = useState(target.role);
  const [actif, setActif] = useState(Boolean(target.actif));
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await onSave({ role, actif });
      onClose();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl animate-[slideUp_.2s_ease] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Modifier utilisateur</h3>
            <p className="text-sm text-slate-400">{target.prenom} {target.nom} — {target.email}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-white/10 hover:bg-white/5">×</button>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Rôle</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100">
            {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>

        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 cursor-pointer">
          <span className="text-sm text-slate-200">Compte actif</span>
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white disabled:opacity-60">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetModal({ target, onClose, onDone }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState(null);
  const [resetEmail, setResetEmail] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const doReset = async () => {
    if (done && !window.confirm("Générer un nouveau mot de passe ? L'ancien mot de passe temporaire ne fonctionnera plus.")) {
      return;
    }
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await api.post(`users/${target.id}/reset-password`);
      setNewPassword(res.data?.newPassword || res.data?.password || null);
      setResetEmail(res.data?.email || target.email);
      setDone(true);
      onDone();
    } catch (err) {
      console.error("Reset error:", err.response?.data || err.message);
      setNewPassword(null);
      setResetEmail(null);
      setDone(true);
      setError(err.response?.data?.message || "Erreur lors de la réinitialisation");
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl animate-[slideUp_.2s_ease] space-y-4">
        <h3 className="text-lg font-semibold text-white">Réinitialiser le mot de passe</h3>
        <p className="text-sm text-slate-400">
          Un mot de passe temporaire sera généré pour <span className="text-slate-200">{target.prenom} {target.nom}</span>.
        </p>

        {done && error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {done && newPassword && (
          <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 space-y-2">
            <p className="text-xs uppercase tracking-wide text-sky-200">Nouveau mot de passe</p>
            <p className="font-mono text-sm text-white break-all">{newPassword}</p>
            {resetEmail && (
              <p className="text-xs text-sky-100/90">
                Connexion avec l&apos;e-mail : <span className="font-medium">{resetEmail}</span>
              </p>
            )}
            <p className="text-xs text-amber-200/90">
              Copiez ce mot de passe maintenant. Si vous regénérez, seul le dernier mot de passe sera valide.
            </p>
            <button
              type="button"
              onClick={copyPassword}
              className="text-xs rounded-lg border border-sky-400/40 px-2.5 py-1 text-sky-100 hover:bg-sky-500/10"
            >
              {copied ? "Copié" : "Copier le mot de passe"}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5">Fermer</button>
          <button type="button" disabled={loading} onClick={doReset} className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white disabled:opacity-60">
            {loading ? "Traitement..." : done ? "Regénérer" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ target, onClose, onDone }) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);
  const [error, setError] = useState(null);

  const doSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`users/${target.id}/send-invite`);
      setTempPassword(res.data?.temporaryPassword || null);
      setDone(true);
      onDone(res.data?.email || target.email);
    } catch (err) {
      setDone(true);
      setError(err.response?.data?.message || "Erreur lors de l'envoi de l'invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl animate-[slideUp_.2s_ease] space-y-4">
        <h3 className="text-lg font-semibold text-white">Envoyer l&apos;invitation</h3>
        <p className="text-sm text-slate-400">
          Un e-mail avec un mot de passe temporaire sera envoyé à{" "}
          <span className="text-slate-200">{target.email}</span>.
        </p>

        {done && error && (
          <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
        )}

        {done && tempPassword && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 space-y-1">
            <p className="text-xs uppercase tracking-wide text-emerald-200">Invitation envoyée</p>
            <p className="text-xs text-emerald-100/90">Mot de passe temporaire (au cas où) :</p>
            <p className="font-mono text-sm text-white break-all">{tempPassword}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5">Fermer</button>
          <button type="button" disabled={loading || (done && !error)} onClick={doSend} className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 text-white disabled:opacity-60">
            {loading ? "Envoi..." : done && !error ? "Envoyé" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeactivateModal({ target, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const reasons = [
    "Départ de l'entreprise",
    "Congé long terme",
    "Compte dupliqué",
    "Accès temporairement suspendu",
    "Autre",
  ];

  const confirm = async () => {
    setLoading(true);
    await onConfirm(reason);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-slate-950 p-5 shadow-2xl animate-[slideUp_.2s_ease] space-y-4">
        <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">Désactiver ce compte ?</h3>
          <p className="text-sm text-slate-400 mt-1">
            <span className="text-slate-200 font-medium">{target.prenom} {target.nom}</span> ne pourra plus se connecter.
            Son historique et ses données sont conservés. Vous pouvez réactiver ce compte à tout moment.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 space-y-2">
          {[
            "Historique des achats et ventes",
            "Mouvements de stock associés",
            "Données et rapports liés",
          ].map((item) => (
            <div key={item} className="text-xs text-slate-300 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {item}
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Motif (optionnel)</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setReason(reason === r ? "" : r)}
                className={`px-3 py-1 rounded-full text-xs border transition ${
                  reason === r
                    ? "border-amber-400/40 text-amber-300 bg-amber-500/10"
                    : "border-white/10 text-slate-300 hover:bg-white/5"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-xl border border-white/10 hover:bg-white/5">
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl bg-gradient-to-r from-amber-500 to-red-500 text-white disabled:opacity-60"
          >
            {loading ? "En cours..." : "Désactiver"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const persistReady = useAuthPersistHydrated();
  const currentUser = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const assignableRoles = isSuperAdmin ? ROLES_FOR_SUPER : ROLES_FOR_ADMIN;

  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [mainTab, setMainTab] = useState("users"); // users | pending
  const [pendingTabAutoOpened, setPendingTabAutoOpened] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [toastLocal, setToast] = useState(null);
  const showToast = (message, type = "success") => setToast({ message, type });
  const load = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  useEffect(() => {
    if (!toastLocal) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toastLocal]);

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  const usersQueryEnabled = isSuperAdmin ? persistReady && societeScope != null : true;
  const usersQuery = useQuery({
    queryKey: ["admin-users", societeScope],
    queryFn: () => api.get("users", { params: { limit: 100 } }).then((r) => (Array.isArray(r.data) ? r.data : r.data?.items ?? [])),
    enabled: usersQueryEnabled,
  });
  const users = Array.isArray(usersQuery.data)
    ? usersQuery.data.filter(
        (u) => !["EN_ATTENTE_VALIDATION", "EN_ATTENTE_RATTACHEMENT"].includes(u.statutCompte)
      )
    : [];

  const pendingQuery = useQuery({
    queryKey: ["admin-users-pending", societeScope],
    queryFn: () => api.get("users/pending").then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled: usersQueryEnabled,
  });
  const pendingUsers = Array.isArray(pendingQuery.data) ? pendingQuery.data : [];

  useEffect(() => {
    if (!pendingTabAutoOpened && pendingUsers.length > 0) {
      setMainTab("pending");
      setPendingTabAutoOpened(true);
    }
  }, [pendingUsers.length, pendingTabAutoOpened]);

  const approveMutation = useMutation({
    mutationFn: (id) => api.patch(`users/${id}/approve`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        data?.emailSent
          ? `${data.message || "Compte approuvé"} — e-mail d'activation envoyé.`
          : `${data?.message || "Compte approuvé"} (e-mail non envoyé : vérifiez SMTP).`
      );
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api.patch(`users/${id}/reject`).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-pending"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.warning(
        data?.emailSent
          ? `${data.message || "Compte rejeté"} — e-mail de refus envoyé.`
          : `${data?.message || "Compte rejeté"} (e-mail non envoyé : vérifiez SMTP).`
      );
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => api.patch(`users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, actif }) => api.patch(`users/${id}/status`, { actif }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const createUser = useMutation({
    mutationFn: (payload) => api.post("users", payload),
    onSuccess: (res, payload) => {
      setShowCreate(false);
      setCreateError("");
      setCreateFieldErrors([]);
      const data = res.data || {};
      if (payload?.sendInviteEmail) {
        if (data.inviteEmailSent) {
          showToast(`Utilisateur créé — invitation envoyée à ${data.email}.`, "success");
        } else {
          showToast(
            data.inviteEmailError || "Utilisateur créé, mais l'invitation n'a pas pu être envoyée.",
            "warning"
          );
        }
      } else {
        showToast("Utilisateur créé (sans envoi d'e-mail).", "success");
      }
      load();
    },
    onError: (err) => {
      const apiErrors = err.response?.data?.errors;
      if (Array.isArray(apiErrors) && apiErrors.length) {
        setCreateFieldErrors(apiErrors);
        setCreateError("");
      } else {
        setCreateFieldErrors([]);
        setCreateError(formatApiError(err));
      }
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchSearch = !q || `${u.prenom || ""} ${u.nom || ""}`.toLowerCase().includes(q) || String(u.email || "").toLowerCase().includes(q);
      return matchSearch && matchFilter(u, filter);
    });
  }, [users, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [search, filter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const sections = useMemo(() => {
    if (!isSuperAdmin) return [["Mon entreprise", pageRows]];
    const map = new Map();
    pageRows.forEach((u) => {
      const key = u?.societe?.nom?.trim() || "Sans société";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [pageRows, isSuperAdmin]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.actif).length,
      inactive: users.filter((u) => !u.actif).length,
      admins: users.filter((u) => ["ADMIN", "SUPER_ADMIN"].includes(u.role)).length,
    }),
    [users]
  );

  const filterCounts = useMemo(
    () => ({
      ALL: users.length,
      ACTIVE: users.filter((u) => u.actif).length,
      INACTIVE: users.filter((u) => !u.actif).length,
    }),
    [users]
  );

  const onAction = async (action, user) => {
    if (action === "view") {
      setProfileUser(user);
      return;
    }
    if (action === "access") {
      navigate(`/users/${user.id}`);
      return;
    }
    if (action === "edit") {
      setModal({ type: "edit", user });
      return;
    }
    if (action === "reset") {
      setModal({ type: "reset", user });
      return;
    }
    if (action === "invite") {
      setModal({ type: "invite", user });
      return;
    }
    if (action === "toggle") {
      try {
        const newActif = !user.actif;
        console.log("PATCH URL:", `users/${user.id}`, "body:", { actif: newActif });
        await api.patch(`users/${user.id}`, { actif: newActif });
        showToast(
          newActif ? "Compte réactivé avec succès" : "Compte désactivé avec succès",
          newActif ? "success" : "warning"
        );
        load();
      } catch (err) {
        console.error("Toggle error:", err.response?.data || err.message);
        showToast(err.response?.data?.message || "Erreur lors de la mise à jour", "error");
      }
      return;
    }
    if (action === "delete") {
      const confirmed = window.confirm(`Supprimer définitivement le compte de ${user.prenom} ${user.nom} ?`);
      if (!confirmed) return;
      try {
        await api.delete(`users/${user.id}`);
        showToast("Compte supprimé définitivement", "warning");
        load();
      } catch (err) {
        showToast(err.response?.data?.message || "Suppression impossible", "error");
      }
    }
  };

  const submitCreate = (payload) => {
    setCreateError("");
    setCreateFieldErrors([]);
    if (isSuperAdmin && societeScope == null) {
      setCreateError("Sélectionnez une société active avant de créer un compte.");
      return;
    }
    createUser.mutate(payload);
  };

  const actionBusyId =
    approveMutation.isPending
      ? approveMutation.variables
      : rejectMutation.isPending
        ? rejectMutation.variables
        : null;

  if (isSuperAdmin && !persistReady) {
    return <div className="p-6 text-sm text-slate-400">Chargement du profil...</div>;
  }

  return (
    <div className="min-h-full space-y-5 p-6">
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <Toast toast={toastLocal} />

      <GlassPageHeader
        title="Utilisateurs"
        subtitle="Comptes, rôles et contrôle d'accès par module"
        icon={Users}
        badge="Accès"
        actions={
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setCreateError("");
              setCreateFieldErrors([]);
            }}
            className={PRIMARY_BTN_CLASSES}
            style={primaryButtonStyle}
          >
            <Plus className="h-4 w-4" /> Nouvel utilisateur
          </button>
        }
      />

      <UserMetricCards stats={stats} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMainTab("users")}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={
            mainTab === "users"
              ? { background: "#378ADD", color: "#fff" }
              : { background: "var(--bg-hover)", color: "var(--text-secondary)" }
          }
        >
          Tous les utilisateurs
        </button>
        <button
          type="button"
          onClick={() => setMainTab("pending")}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={
            mainTab === "pending"
              ? { background: "#378ADD", color: "#fff" }
              : { background: "var(--bg-hover)", color: "var(--text-secondary)" }
          }
        >
          Comptes en attente
          {pendingUsers.length > 0 ? (
            <span
              className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
              style={{ background: "#E24B4A" }}
            >
              {pendingUsers.length}
            </span>
          ) : null}
        </button>
      </div>

      {mainTab === "pending" ? (
        <PendingUsersPanel
          users={pendingUsers}
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          errorMessage={formatApiError(pendingQuery.error)}
          actionBusyId={actionBusyId}
          approving={approveMutation.isPending}
          rejecting={rejectMutation.isPending}
          onApprove={(id) => approveMutation.mutate(id)}
          onReject={(id) => rejectMutation.mutate(id)}
        />
      ) : (
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="sticky top-2 z-20 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/95 p-4 shadow-sm backdrop-blur-md"
        >
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher nom, prénom ou email…"
                  className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[color-mix(in_srgb,var(--accent-primary)_55%,transparent)]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTER_PILLS.map((pill) => {
                  const count = filterCounts[pill.id] ?? 0;
                  const active = filter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setFilter(pill.id)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={
                        active
                          ? { background: "var(--accent-primary)", color: "#fff" }
                          : { background: "var(--bg-hover)", color: "var(--text-secondary)" }
                      }
                    >
                      {pill.label}
                      <span
                        className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
                        style={{
                          background: active ? "rgba(255,255,255,0.22)" : "var(--bg-card)",
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {usersQuery.isError ? (
              <p className="text-sm text-[var(--accent-danger)]">
                Impossible de charger. {formatApiError(usersQuery.error)}
              </p>
            ) : usersQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--bg-hover)]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] p-10 text-center">
                <p className="text-[var(--text-primary)]">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map(([title, rows]) => {
                  const activeInSection = rows.filter((u) => u.actif).length;
                  const societeCode = rows[0]?.societe?.code || "";
                  return (
                    <div key={title}>
                      <div
                        className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2.5"
                        style={{
                          borderLeft: "3px solid var(--accent-primary)",
                          background: "color-mix(in srgb, var(--accent-primary) 6%, var(--bg-card))",
                        }}
                      >
                        <Building2 className="h-4 w-4 text-[var(--accent-primary)]" />
                        <span className="font-medium text-[var(--text-primary)]">{title}</span>
                        {societeCode ? (
                          <span className="font-mono text-xs text-[var(--accent-primary)]">{societeCode}</span>
                        ) : null}
                        <span className="text-xs text-[var(--text-muted)]">
                          ● {activeInSection} actif / {rows.length} total
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {rows.map((u, idx) => (
                          <UserTableRow
                            key={u.id}
                            user={u}
                            index={(safePage - 1) * pageSize + idx}
                            isSelf={Number(u.id) === Number(currentUser?.id)}
                            openMenu={openMenu}
                            setOpenMenu={setOpenMenu}
                            currentUser={currentUser}
                            onAction={onAction}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                <StockPagination
                  page={safePage}
                  totalPages={totalPages}
                  totalResults={filtered.length}
                  pageSize={pageSize}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  unitLabel="utilisateur(s)"
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </motion.section>
      )}
      <UserCreateWizard open={showCreate} onClose={() => { setShowCreate(false); setCreateError(""); setCreateFieldErrors([]); }} roles={assignableRoles} onSubmit={submitCreate} loading={createUser.isPending} error={createError} fieldErrors={createFieldErrors} />
      <UserProfileDrawer user={profileUser} currentUser={currentUser} onClose={() => setProfileUser(null)} onEdit={(u) => { setProfileUser(null); setModal({ type: "edit", user: u }); }} onReset={(u) => { setProfileUser(null); setModal({ type: "reset", user: u }); }} onInvite={(u) => { setProfileUser(null); setModal({ type: "invite", user: u }); }} />

      {modal?.type === "edit" && (
        <EditModal
          target={modal.user}
          roles={assignableRoles.includes(modal.user.role) ? assignableRoles : [modal.user.role, ...assignableRoles]}
          loading={changeRole.isPending || changeStatus.isPending}
          onClose={() => setModal(null)}
          onSave={async ({ role, actif }) => {
            if (role !== modal.user.role) await changeRole.mutateAsync({ id: modal.user.id, role });
            if (Boolean(actif) !== Boolean(modal.user.actif)) await changeStatus.mutateAsync({ id: modal.user.id, actif });
            showToast("Utilisateur mis à jour.", "success");
          }}
        />
      )}
      {modal?.type === "reset" && (
        <ResetModal
          target={modal.user}
          onClose={() => setModal(null)}
          onDone={() => showToast("Mot de passe réinitialisé.", "success")}
        />
      )}
      {modal?.type === "invite" && (
        <InviteModal
          target={modal.user}
          onClose={() => setModal(null)}
          onDone={(email) => showToast(`Invitation envoyée à ${email}.`, "success")}
        />
      )}
      {modal?.type === "deactivate" && (
        <DeactivateModal
          target={modal.user}
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            try {
              await api.patch(`users/${modal.user.id}`, {
                actif: false,
                ...(reason ? { noteDesactivation: reason } : {}),
              });
              setModal(null);
              showToast(`${modal.user.prenom} ${modal.user.nom} — compte désactivé`, "warning");
              load();
            } catch (err) {
              showToast(formatApiError(err), "error");
            }
          }}
        />
      )}
    </div>
  );
}
