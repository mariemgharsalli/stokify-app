import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { primaryButtonStyle, primarySelectionStyle } from "../../utils/brandStyles";

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
}

export default function Reglements() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const role = user?.role;
  const canVente = hasPermission(role, "ventes:read");
  const canAchat = hasPermission(role, "achats:read");
  const canPay = hasPermission(role, "reglements:write");

  const [tab, setTab] = useState("vente");
  const [venteId, setVenteId] = useState("");
  const [achatId, setAchatId] = useState("");
  const [form, setForm] = useState({
    montant: "",
    mode: "VIREMENT",
    reference: "",
    datePayment: "",
  });
  const [error, setError] = useState("");

  const { data: ventesData } = useQuery({
    queryKey: ["ventes", "reglements-picker", societeScope],
    queryFn: () => api.get("ventes", { params: { limit: 100 } }).then((r) => r.data),
    enabled: canVente,
  });

  const { data: achatsData } = useQuery({
    queryKey: ["achats", "reglements-picker", societeScope],
    queryFn: () => api.get("achats", { params: { limit: 100 } }).then((r) => r.data),
    enabled: canAchat,
  });

  const { data: regsVente = [] } = useQuery({
    queryKey: ["reglements-vente", societeScope, venteId],
    queryFn: () => api.get(`reglements/ventes/${venteId}`).then((r) => r.data),
    enabled: canVente && Boolean(venteId),
  });

  const { data: regsAchat = [] } = useQuery({
    queryKey: ["reglements-achat", societeScope, achatId],
    queryFn: () => api.get(`reglements/achats/${achatId}`).then((r) => r.data),
    enabled: canAchat && Boolean(achatId),
  });

  const ventes = ventesData?.items ?? [];
  const achats = achatsData?.items ?? [];

  const createVente = useMutation({
    mutationFn: () =>
      api.post(`reglements/ventes/${venteId}`, {
        montant: Number(String(form.montant).replace(",", ".")),
        mode: form.mode,
        reference: form.reference.trim() || null,
        datePayment: form.datePayment ? new Date(form.datePayment).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements-vente", societeScope, venteId] });
      qc.invalidateQueries({ queryKey: ["ventes"] });
      setForm((f) => ({ ...f, montant: "", reference: "" }));
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const createAchat = useMutation({
    mutationFn: () =>
      api.post(`reglements/achats/${achatId}`, {
        montant: Number(String(form.montant).replace(",", ".")),
        mode: form.mode,
        reference: form.reference.trim() || null,
        datePayment: form.datePayment ? new Date(form.datePayment).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements-achat", societeScope, achatId] });
      qc.invalidateQueries({ queryKey: ["achats"] });
      setForm((f) => ({ ...f, montant: "", reference: "" }));
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const delVente = useMutation({
    mutationFn: (id) => api.delete(`reglements/vente-reglements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements-vente", societeScope, venteId] });
      qc.invalidateQueries({ queryKey: ["ventes"] });
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  const delAchat = useMutation({
    mutationFn: (id) => api.delete(`reglements/achat-reglements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reglements-achat", societeScope, achatId] });
      qc.invalidateQueries({ queryKey: ["achats"] });
    },
    onError: (e) => setError(getAxiosErrorMessage(e)),
  });

  if (!canVente && !canAchat) {
    return (
      <PageShell title="Règlements" subtitle="">
        <p className="text-slate-400 text-sm">Accès refusé.</p>
      </PageShell>
    );
  }

  const selectedVente = ventes.find((v) => String(v.id) === String(venteId));
  const selectedAchat = achats.find((a) => String(a.id) === String(achatId));

  return (
    <PageShell
      title="Règlements"
      subtitle="Paiements liés aux ventes et aux achats (montant reglé / statut synchronisés)."
    >
      {error && <p className="text-sm mb-4 text-[var(--danger-text)]">{error}</p>}

      <div className="flex gap-2 mb-6">
        {canVente && (
          <button
            type="button"
            onClick={() => setTab("vente")}
            className={`px-4 py-2 rounded-xl text-sm ${
              tab === "vente"
                ? "text-white"
                : "bg-white/5 text-slate-400 border border-white/10"
            }`}
            style={tab === "vente" ? primarySelectionStyle : undefined}
          >
            Ventes
          </button>
        )}
        {canAchat && (
          <button
            type="button"
            onClick={() => setTab("achat")}
            className={`px-4 py-2 rounded-xl text-sm ${
              tab === "achat"
                ? "text-white"
                : "bg-white/5 text-slate-400 border border-white/10"
            }`}
            style={tab === "achat" ? primarySelectionStyle : undefined}
          >
            Achats
          </button>
        )}
      </div>

      {tab === "vente" && canVente && (
        <div className="space-y-4">
          <select
            className="w-full max-w-md px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
            value={venteId}
            onChange={(e) => {
              setVenteId(e.target.value);
              setError("");
            }}
          >
            <option value="">Choisir une vente…</option>
            {ventes.map((v) => (
              <option key={v.id} value={v.id}>
                #{v.id} · {v.client?.nom ?? "Client"} · TTC {formatMoney(v.totalTTC)} ·{" "}
                {v.statutPaiement ?? "—"}
              </option>
            ))}
          </select>
          {selectedVente && (
            <p className="text-slate-500 text-xs">
              Total TTC {formatMoney(selectedVente.totalTTC)} — réglé{" "}
              {formatMoney(selectedVente.montantRegle)} — {selectedVente.statutPaiement}
            </p>
          )}
          {canPay && venteId && (
            <div className="glass rounded-2xl border border-white/10 p-4 grid md:grid-cols-4 gap-3">
              <input
                type="number"
                placeholder="Montant"
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                value={form.montant}
                onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
              />
              <select
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              >
                <option value="VIREMENT">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="CARTE">Carte</option>
                <option value="ESPECES">Espèces</option>
              </select>
              <input
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                placeholder="Référence"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                value={form.datePayment}
                onChange={(e) => setForm((f) => ({ ...f, datePayment: e.target.value }))}
              />
              <button
                type="button"
                disabled={createVente.isPending || !form.montant}
                onClick={() => {
                  setError("");
                  createVente.mutate();
                }}
                className="md:col-span-4 px-4 py-2 rounded-xl text-white text-sm w-fit hover:brightness-110"
                style={primaryButtonStyle}
              >
                Enregistrer le règlement
              </button>
            </div>
          )}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="min-w-full text-sm text-slate-300">
              <thead className="bg-navy-900/50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-left">Réf.</th>
                  {canPay && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {regsVente.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-2">{r.datePayment ? new Date(r.datePayment).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(r.montant)}</td>
                    <td className="px-4 py-2">{r.mode}</td>
                    <td className="px-4 py-2">{r.reference ?? "—"}</td>
                    {canPay && (
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="text-accent-400 text-xs"
                          onClick={() => delVente.mutate(r.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {venteId && regsVente.length === 0 && (
              <p className="p-4 text-slate-500 text-sm">Aucun règlement.</p>
            )}
          </div>
        </div>
      )}

      {tab === "achat" && canAchat && (
        <div className="space-y-4">
          <select
            className="w-full max-w-md px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
            value={achatId}
            onChange={(e) => {
              setAchatId(e.target.value);
              setError("");
            }}
          >
            <option value="">Choisir un achat…</option>
            {achats.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} · {a.fournisseur?.nom ?? "Fourn."} · TTC {formatMoney(a.totalTTC)} ·{" "}
                {a.statutPaiement ?? "—"}
              </option>
            ))}
          </select>
          {selectedAchat && (
            <p className="text-slate-500 text-xs">
              Total TTC {formatMoney(selectedAchat.totalTTC)} — réglé{" "}
              {formatMoney(selectedAchat.montantRegle)} — {selectedAchat.statutPaiement}
            </p>
          )}
          {canPay && achatId && (
            <div className="glass rounded-2xl border border-white/10 p-4 grid md:grid-cols-4 gap-3">
              <input
                type="number"
                placeholder="Montant"
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                value={form.montant}
                onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
              />
              <select
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                value={form.mode}
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}
              >
                <option value="VIREMENT">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="CARTE">Carte</option>
                <option value="ESPECES">Espèces</option>
              </select>
              <input
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                placeholder="Référence"
                value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="px-3 py-2 rounded-xl bg-navy-900/80 border border-white/10 text-white text-sm"
                value={form.datePayment}
                onChange={(e) => setForm((f) => ({ ...f, datePayment: e.target.value }))}
              />
              <button
                type="button"
                disabled={createAchat.isPending || !form.montant}
                onClick={() => {
                  setError("");
                  createAchat.mutate();
                }}
                className="md:col-span-4 px-4 py-2 rounded-xl text-white text-sm w-fit hover:brightness-110"
                style={primaryButtonStyle}
              >
                Enregistrer le règlement
              </button>
            </div>
          )}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="min-w-full text-sm text-slate-300">
              <thead className="bg-navy-900/50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-left">Réf.</th>
                  {canPay && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {regsAchat.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-2">{r.datePayment ? new Date(r.datePayment).toLocaleString("fr-FR") : "—"}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(r.montant)}</td>
                    <td className="px-4 py-2">{r.mode}</td>
                    <td className="px-4 py-2">{r.reference ?? "—"}</td>
                    {canPay && (
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="text-accent-400 text-xs"
                          onClick={() => delAchat.mutate(r.id)}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {achatId && regsAchat.length === 0 && (
              <p className="p-4 text-slate-500 text-sm">Aucun règlement.</p>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
