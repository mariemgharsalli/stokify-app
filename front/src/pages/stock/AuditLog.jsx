import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useAuthStore } from "../../store/authStore";
import { useToast } from "../../hooks/useToast";
import { exportCsvFromRows } from "../../utils/exportHelpers";

const ACTION_COLORS = {
  CREATE: "#378ADD",
  STATUS_CHANGE: "#BA7517",
  DELETE: "#E24B4A",
  VALIDATE: "#1D9E75",
};

const ENTITY_TYPES = ["STOCK", "ARTICLE", "MOUVEMENT", "VENTE", "ACHAT"];

export default function StockAuditLog() {
  const societeScope = useSocieteQueryScope();
  const user = useAuthStore((s) => s.user);
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role);

  const { data: usersData } = useQuery({
    queryKey: ["users-audit-stock", societeScope],
    queryFn: () => api.get("users", { params: { limit: 100 } }).then((r) => r.data),
    enabled: isAdmin,
  });
  const users = usersData?.items ?? usersData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["stock-audit-logs", societeScope, page, entityType, userId, from, to],
    queryFn: () =>
      api
        .get("stock/audit-logs", {
          params: {
            page,
            limit: 50,
            ...(entityType ? { entityType } : {}),
            ...(userId ? { userId } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
          },
        })
        .then((r) => r.data),
    enabled: isAdmin,
  });

  const items = data?.items || [];
  const userOptions = useMemo(
    () => users.map((u) => ({ value: String(u.id), label: `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email })),
    [users]
  );

  function exportCsv() {
    if (!items.length) return toast.error("Aucune entrée à exporter");
    exportCsvFromRows(
      items.map((ev) => ({
        Date: new Date(ev.createdAt).toLocaleString("fr-FR"),
        Entité: ev.entityType,
        Action: ev.action,
        "Ancienne valeur": ev.oldValue || "",
        "Nouvelle valeur": ev.newValue || "",
        Utilisateur: `${ev.utilisateur?.prenom || ""} ${ev.utilisateur?.nom || ""}`.trim(),
      })),
      "audit-stock.csv"
    );
    toast.success("Export CSV téléchargé");
  }

  if (!isAdmin) {
    return (
      <PageShell title="Journal d'audit stock" subtitle="Accès réservé aux administrateurs">
        <p className="text-[var(--text-secondary)]">Vous n'avez pas les droits pour consulter cette page.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Journal d'audit stock"
      subtitle="Historique des changements de statut et suppressions"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm hover:bg-[var(--bg-hover)]"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">Type d'entité</label>
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
          >
            <option value="">Tous</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">Utilisateur</label>
          <SearchableSelect
            value={userId}
            onChange={(v) => {
              setUserId(v);
              setPage(1);
            }}
            options={userOptions}
            placeholder="Tous"
            clearLabel="Tous"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">Du</label>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">Au</label>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--border-default)] bg-[var(--bg-hover)] text-left text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Entité</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Ancienne valeur</th>
              <th className="px-4 py-3">Nouvelle valeur</th>
              <th className="px-4 py-3">Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Aucune entrée d'audit.
                </td>
              </tr>
            ) : (
              items.map((ev, i) => (
                <tr
                  key={ev.id}
                  className="border-b border-[var(--border-subtle)]"
                  style={{ animation: `fadeUp 0.35s ease ${i * 50}ms both` }}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                    {new Date(ev.createdAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">{ev.entityType}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        color: ACTION_COLORS[ev.action] || "#7F77DD",
                        background: `${ACTION_COLORS[ev.action] || "#7F77DD"}18`,
                      }}
                    >
                      {ev.action}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-[var(--text-muted)]">{ev.oldValue || "—"}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-xs text-[var(--text-muted)]">{ev.newValue || "—"}</td>
                  <td className="px-4 py-3">
                    {`${ev.utilisateur?.prenom || ""} ${ev.utilisateur?.nom || ""}`.trim() || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.pages > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="px-2 py-1.5 text-sm text-[var(--text-muted)]">
            Page {page} / {data.pages}
          </span>
          <button
            type="button"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      ) : null}
    </PageShell>
  );
}
