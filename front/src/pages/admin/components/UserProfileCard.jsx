import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle,
  LogIn,
  Pencil,
  Shield,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { primaryButtonStyle } from "../../../utils/brandStyles";
import CopyableEmail from "./CopyableEmail";

const ROLE_CONFIG = {
  SUPER_ADMIN: { label: "Super Admin", color: "#E24B4A", bg: "rgba(226,75,74,0.1)" },
  ADMIN: { label: "Administrateur", color: "#7F77DD", bg: "rgba(127,119,221,0.1)" },
  RESPONSABLE: { label: "Responsable", color: "#BA7517", bg: "rgba(186,117,23,0.1)" },
  MAGASINIER: { label: "Magasinier", color: "#378ADD", bg: "rgba(55,138,221,0.1)" },
  COMPTABLE: { label: "Comptable", color: "#BA7517", bg: "rgba(186,117,23,0.1)" },
  CLIENT: { label: "Client", color: "#1D9E75", bg: "rgba(29,158,117,0.1)" },
};

export default function UserProfileCard({ user, onUpdate, onToggleActive, onDelete, assignableRoles }) {
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: user.nom ?? "",
    prenom: user.prenom ?? "",
    email: user.email ?? "",
    role: user.role ?? "",
  });

  useEffect(() => {
    setForm({
      nom: user.nom ?? "",
      prenom: user.prenom ?? "",
      email: user.email ?? "",
      role: user.role ?? "",
    });
    setEditMode(false);
    setConfirmDelete(false);
  }, [user.id, user.nom, user.prenom, user.email, user.role]);

  const hue = (user.nom?.charCodeAt(0) ?? 65) * 137 % 360;
  const roleConf = ROLE_CONFIG[user.role] ?? {
    label: user.role,
    color: "#378ADD",
    bg: "rgba(55,138,221,0.1)",
  };

  const roles = assignableRoles?.length
    ? assignableRoles
    : Object.keys(ROLE_CONFIG);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(form);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          background: "var(--color-background-secondary)",
          borderColor: "var(--color-border-tertiary)",
        }}
      >
        <div
          className="relative h-20"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 55%, 25%), hsl(${(hue + 60) % 360}, 50%, 20%))`,
          }}
        >
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.15)",
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            {editMode ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            {editMode ? "Annuler" : "Modifier"}
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="relative -mt-8 mb-3">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 text-2xl font-bold text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 30) % 360}, 55%, 30%))`,
                borderColor: "var(--color-background-secondary)",
              }}
            >
              {(user.prenom?.[0] ?? user.nom?.[0] ?? "U").toUpperCase()}
            </div>
          </div>

          {editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.prenom}
                  onChange={(e) => setForm((p) => ({ ...p, prenom: e.target.value }))}
                  placeholder="Prénom"
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-background-primary)",
                    border: "1px solid var(--color-border-tertiary)",
                    color: "var(--color-text-primary)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#378ADD"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--color-border-tertiary)"; }}
                />
                <input
                  value={form.nom}
                  onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Nom"
                  className="rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-background-primary)",
                    border: "1px solid var(--color-border-tertiary)",
                    color: "var(--color-text-primary)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "#378ADD"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--color-border-tertiary)"; }}
                />
              </div>
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
                type="email"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--color-background-primary)",
                  border: "1px solid var(--color-border-tertiary)",
                  color: "var(--color-text-primary)",
                }}
                onFocus={(e) => { e.target.style.borderColor = "#378ADD"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--color-border-tertiary)"; }}
              />
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--color-background-primary)",
                  border: "1px solid var(--color-border-tertiary)",
                  color: "var(--color-text-primary)",
                }}
              >
                {roles.map((k) => (
                  <option key={k} value={k}>
                    {ROLE_CONFIG[k]?.label ?? k}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-xl py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #378ADD, #2563a8)" }}
              >
                {saving ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                {user.prenom} {user.nom}
              </h2>
              <div className="mb-3">
                <CopyableEmail
                  email={user.email}
                  className="text-sm text-[var(--color-text-secondary)]"
                />
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: roleConf.bg,
                  color: roleConf.color,
                  border: `1px solid ${roleConf.color}33`,
                }}
              >
                <Shield className="h-3 w-3" />
                {roleConf.label}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: "Société",
            value: user.societe?.nom ?? "—",
            icon: Building2,
            color: "#378ADD",
          },
          {
            label: "Statut",
            value: user.actif !== false ? "Actif" : "Inactif",
            icon: user.actif !== false ? CheckCircle : XCircle,
            color: user.actif !== false ? "#1D9E75" : "#E24B4A",
          },
          {
            label: "Créé le",
            value: user.createdAt
              ? new Date(user.createdAt).toLocaleDateString("fr-FR")
              : "—",
            icon: Calendar,
            color: "#BA7517",
          },
          {
            label: "Connexions",
            value: user.loginCount ?? "—",
            icon: LogIn,
            color: "#7F77DD",
          },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border p-3"
              style={{
                background: "var(--color-background-secondary)",
                borderColor: "var(--color-border-tertiary)",
                animation: `fadeUp 0.3s ease ${i * 50}ms both`,
              }}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                <span
                  className="text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {s.label}
                </span>
              </div>
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className="space-y-3 rounded-2xl border p-4"
        style={{
          background: "rgba(226,75,74,0.04)",
          borderColor: "rgba(226,75,74,0.15)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#E24B4A" }}>
          Zone dangereuse
        </p>

        {confirmDelete ? (
          <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: "rgba(226,75,74,0.3)" }}>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Supprimer définitivement <strong>{user.prenom} {user.nom}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border py-2 text-xs font-medium"
                style={{
                  borderColor: "var(--color-border-tertiary)",
                  color: "var(--color-text-secondary)",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="stokify-btn-action flex-1 rounded-xl py-2 text-xs font-medium text-white disabled:opacity-60"
                style={primaryButtonStyle}
              >
                {deleting ? "Suppression…" : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onToggleActive(user)}
              className="flex-1 rounded-xl border py-2 text-xs font-medium"
              style={{
                borderColor: "rgba(226,75,74,0.3)",
                color: "#E24B4A",
              }}
            >
              {user.actif !== false ? "Désactiver le compte" : "Réactiver le compte"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border px-3 py-2"
              style={{
                borderColor: "rgba(226,75,74,0.3)",
                color: "#E24B4A",
              }}
              aria-label="Supprimer le compte"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
