import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import UserProfileCard from "./components/UserProfileCard";
import UserAccessPanel, { derivePermissionsFromRole } from "./components/UserAccessPanel";

const ROLES_FOR_ADMIN = ["ADMIN", "RESPONSABLE", "MAGASINIER", "COMPTABLE", "CLIENT"];
const ROLES_FOR_SUPER = ["SUPER_ADMIN", ...ROLES_FOR_ADMIN];

function UserDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: "var(--color-background-secondary)",
            borderColor: "var(--color-border-tertiary)",
          }}
        >
          <div
            className="h-20"
            style={{ background: "var(--color-border-tertiary)", opacity: 0.3 }}
          />
          <div className="space-y-3 p-5">
            <div
              className="h-12 w-12 rounded-2xl"
              style={{ background: "var(--color-border-tertiary)", opacity: 0.3 }}
            />
            <div
              className="h-5 w-40 rounded-full"
              style={{ background: "var(--color-border-tertiary)", opacity: 0.3 }}
            />
            <div
              className="h-3 w-56 rounded-full"
              style={{ background: "var(--color-border-tertiary)", opacity: 0.2 }}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl border"
            style={{
              background: "var(--color-background-secondary)",
              borderColor: "var(--color-border-tertiary)",
              animation: `pulse 1.5s ease ${i * 100}ms infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function formatApiError(err) {
  if (!err?.response) return err?.message || "Erreur réseau";
  const data = err.response.data;
  if (typeof data === "string") return data;
  if (data?.message) return String(data.message);
  return `Erreur HTTP ${err.response.status}`;
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.pushToast);
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const assignableRoles = isSuperAdmin ? ROLES_FOR_SUPER : ROLES_FOR_ADMIN;
  const [rolePresetKey, setRolePresetKey] = useState(0);

  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.get(`users/${id}`).then((r) => r.data),
    enabled: Boolean(id),
  });

  const handleUpdate = async (form) => {
    const roleChanged = form.role !== user.role;
    await api.patch(`users/${id}`, form);
    if (roleChanged) {
      const preset = derivePermissionsFromRole(form.role);
      await api.patch(`users/${id}/permissions`, { permissions: preset });
      setRolePresetKey((k) => k + 1);
    }
    await qc.invalidateQueries({ queryKey: ["user", id] });
    await qc.invalidateQueries({ queryKey: ["admin-users"] });
    pushToast("Profil mis à jour avec succès", "success");
  };

  const handleSavePermissions = async (perms) => {
    await api.patch(`users/${id}/permissions`, { permissions: perms });
    await qc.invalidateQueries({ queryKey: ["user", id] });
    pushToast("Permissions enregistrées avec succès", "success");
  };

  const handleToggleActive = async () => {
    try {
      await api.patch(`users/${id}`, { actif: !user.actif });
      await qc.invalidateQueries({ queryKey: ["user", id] });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      pushToast(
        user.actif ? "Compte désactivé" : "Compte réactivé",
        user.actif ? "warning" : "success"
      );
    } catch (err) {
      pushToast(formatApiError(err), "error");
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`users/${id}`);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      pushToast("Compte supprimé définitivement", "warning");
      navigate("/admin");
    } catch (err) {
      pushToast(formatApiError(err), "error");
    }
  };

  return (
    <PageShell>
      <div className="space-y-6" style={{ animation: "fadeUp 0.4s ease" }}>
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </button>

        {isLoading ? (
          <UserDetailSkeleton />
        ) : isError ? (
          <div
            className="rounded-2xl border p-6 text-sm"
            style={{
              borderColor: "rgba(226,75,74,0.3)",
              color: "#E24B4A",
              background: "rgba(226,75,74,0.06)",
            }}
          >
            {formatApiError(error)}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <UserProfileCard
              user={user}
              onUpdate={handleUpdate}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              assignableRoles={assignableRoles}
            />
            <UserAccessPanel
              user={user}
              onSave={handleSavePermissions}
              rolePresetKey={rolePresetKey}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
