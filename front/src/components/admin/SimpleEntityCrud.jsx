import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import PageShell from "../ui/PageShell";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";

function formatErr(err) {
  return getAxiosErrorMessage(err, "Erreur");
}

/**
 * Liste + formulaire CRUD minimal (pattern Stokify existant).
 * @param {string} path — segment API sans slash (ex: "fournisseurs")
 */
export default function SimpleEntityCrud({
  title,
  subtitle,
  path,
  queryKey,
  permissionRead = "stock:read",
  permissionWrite = "stock:write",
  columns,
  formFields,
  initialForm,
  toPayload = (form) => form,
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, permissionWrite);
  const canRead = hasPermission(user?.role, permissionRead);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey || path, search],
    queryFn: () => api.get(path, { params: { search: search || undefined, limit: 100 } }).then((r) => r.data),
    enabled: canRead,
  });

  const items = data?.items ?? data ?? [];

  const saveMutation = useMutation({
    mutationFn: (payload) => (editing ? api.patch(`${path}/${editing.id}`, payload) : api.post(path, payload)),
    onSuccess: () => {
      setError("");
      setSuccess(editing ? "Mis à jour." : "Créé.");
      setTimeout(() => setSuccess(""), 2500);
      setEditing(null);
      setForm(initialForm);
      qc.invalidateQueries({ queryKey: [queryKey || path] });
    },
    onError: (e) => setError(formatErr(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`${path}/${id}`),
    onSuccess: () => {
      setSuccess("Supprimé.");
      setTimeout(() => setSuccess(""), 2500);
      qc.invalidateQueries({ queryKey: [queryKey || path] });
    },
    onError: (e) => setError(formatErr(e)),
  });

  if (!canRead) {
    return (
      <PageShell title={title} subtitle={subtitle}>
        <p className="text-slate-400 text-sm">Accès refusé.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      actions={
        canWrite && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(initialForm);
              setError("");
            }}
            className="text-xs px-3 py-2 rounded-lg border border-white/15 text-slate-200 hover:bg-white/5"
          >
            Nouveau
          </button>
        )
      }
    >
      <div className="space-y-6">
        <input
          className="w-full max-w-md px-4 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {error && <p className="text-sm text-[var(--danger-text)]">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        {canWrite && (
          <div className="glass rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-white font-medium text-sm">{editing ? "Modifier" : "Créer"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formFields.map((f) => (
                <div key={f.name}>
                  <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                  <input
                    className="w-full px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                    type={f.type || "text"}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(toPayload(form))}
                className={`${PRIMARY_BTN_CLASSES} rounded-xl disabled:opacity-50`}
                style={primaryButtonStyle}
              >
                {saveMutation.isPending ? "…" : "Enregistrer"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm(initialForm);
                  }}
                  className="px-4 py-2 rounded-xl border border-white/15 text-slate-300 text-sm"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm text-left text-slate-300">
            <thead className="bg-navy-900/50 text-xs uppercase text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3">
                    {c.label}
                  </th>
                ))}
                {canWrite && <th className="px-4 py-3 w-32">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-500">
                    Chargement…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-500">
                    Aucune ligne
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                    {canWrite && (
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          className="text-accent-400 text-xs"
                          onClick={() => {
                            setEditing(row);
                            const next = { ...initialForm };
                            formFields.forEach((f) => {
                              const v = row[f.name];
                              next[f.name] = v != null && v !== "" ? String(v) : "";
                            });
                            setForm(next);
                          }}
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          className="text-slate-500 text-xs"
                          onClick={() => {
                            if (window.confirm("Supprimer ?")) deleteMutation.mutate(row.id);
                          }}
                        >
                          Suppr.
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
