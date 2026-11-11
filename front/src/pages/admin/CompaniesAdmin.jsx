import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import GlassPageHeader from "../../components/ui/GlassPageHeader";
import AnimatedSwitch from "../superadmin/components/AnimatedSwitch";
import ConfirmToggleSocieteModal from "../superadmin/components/ConfirmToggleSocieteModal";
import SocieteStatusBadge from "../superadmin/components/SocieteStatusBadge";
import { SOCIETES_ANIMATIONS } from "../superadmin/components/societesTheme";
import SocieteKpiCard from "../superadmin/components/SocieteKpiCard";
import { Building2, Globe2, Package, Users } from "lucide-react";
import ChampSeuilValidation from "./ChampSeuilValidation";

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

export default function CompaniesAdmin() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", nom: "", email: "", actif: true });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [listError, setListError] = useState("");
  const [edits, setEdits] = useState({});
  const [confirmToggle, setConfirmToggle] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadTargetId, setUploadTargetId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const logoInputRef = useRef(null);

  const {
    data: companies = [],
    isLoading,
    isError,
    error: queryErr,
  } = useQuery({
    queryKey: ["companies-admin"],
    queryFn: () => api.get("companies").then((r) => r.data),
  });

  useEffect(() => {
    if (isError && queryErr) setListError(formatApiError(queryErr));
    else setListError("");
  }, [isError, queryErr]);

  useEffect(() => {
    const next = {};
    companies.forEach((c) => {
      next[c.id] = {
        nom: c.nom,
        email: c.email || "",
        deadStockSeuil: c.deadStockSeuil ?? 50000,
        joursRelanceClient: c.joursRelanceClient ?? 30,
      };
    });
    setEdits(next);
  }, [companies]);

  const createCompany = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("code", form.code.trim());
      fd.append("nom", form.nom.trim());
      if (form.email.trim()) fd.append("email", form.email.trim());
      fd.append("actif", form.actif ? "true" : "false");
      if (logoFile) fd.append("logo", logoFile);
      return api.post("companies", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setError("");
      setLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setForm({ code: "", nom: "", email: "", actif: true });
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
    },
    onError: (err) => setError(formatApiError(err)),
  });

  const updateCompany = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`companies/${id}`, payload),
    onSuccess: () => {
      setError("");
      setSuccess("Societe mise a jour.");
      setTimeout(() => setSuccess(""), 4000);
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
      qc.invalidateQueries({ queryKey: ["companies", "sidebar-super-admin"] });
    },
    onError: (err) => {
      setSuccess("");
      setError(formatApiError(err));
    },
  });

  const toggleActifMutation = useMutation({
    mutationFn: ({ id, actif, nom, email }) =>
      api.patch(`companies/${id}`, { nom, email: email || "", actif }),
    onSuccess: (_, { actif }) => {
      setError("");
      setSuccess(actif ? "Société réactivée." : "Société désactivée — accès bloqué.");
      setTimeout(() => setSuccess(""), 4000);
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
      qc.invalidateQueries({ queryKey: ["companies", "sidebar-super-admin"] });
    },
    onError: (err) => setError(formatApiError(err)),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: ({ id, file }) => {
      const fd = new FormData();
      fd.append("logo", file);
      return api.patch(`companies/${id}/logo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
      qc.invalidateQueries({ queryKey: ["public-companies"] });
    },
    onError: (err) => setError(formatApiError(err)),
  });

  const activeCount = companies.filter((c) => c.actif !== false).length;
  const totalUsers = companies.reduce((n, c) => n + (c._count?.utilisateurs ?? 0), 0);
  const totalArticles = companies.reduce((n, c) => n + (c._count?.articles ?? 0), 0);
  const totalDepots = companies.reduce((n, c) => n + (c._count?.depots ?? 0), 0);

  function requestToggle(c) {
    setConfirmToggle({ societe: c, nextActif: c.actif === false });
  }

  function confirmToggle() {
    if (!confirmToggle) return;
    const { societe, nextActif } = confirmToggle;
    toggleActifMutation.mutate(
      {
        id: Number(societe.id),
        actif: nextActif,
        nom: societe.nom,
        email: societe.email || "",
      },
      { onSettled: () => setConfirmToggle(null) }
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <style>{SOCIETES_ANIMATIONS}</style>

      <GlassPageHeader
        className="mb-6"
        title="Sociétés"
        subtitle="Gérez les sociétés — désactivation réversible, aucune suppression définitive"
        icon={Building2}
        badge="Multi-tenant"
        badgeIcon={Globe2}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={`${PRIMARY_BTN_CLASSES} page-hero__create px-4 py-2.5`}
            style={primaryButtonStyle}
          >
            <span className="text-lg leading-none">+</span>
            Nouvelle société
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SocieteKpiCard delayIndex={0} title="Sociétés" value={companies.length} icon={Building2} accentColor="#378ADD" subtitle="Tenants enregistrés" barPct={100} />
        <SocieteKpiCard delayIndex={1} title="Actives" value={activeCount} icon={Globe2} accentColor="#1D9E75" subtitle={`${companies.length ? Math.round((activeCount / companies.length) * 100) : 0}% avec accès`} barPct={companies.length ? (activeCount / companies.length) * 100 : 0} pulse={activeCount > 0 && activeCount < companies.length} />
        <SocieteKpiCard delayIndex={2} title="Utilisateurs" value={totalUsers} icon={Users} accentColor="#0EA5E9" subtitle="Sur tous les tenants" barPct={Math.min(100, totalUsers * 5)} />
        <SocieteKpiCard delayIndex={3} title="Articles" value={totalArticles} icon={Package} accentColor="#E24B4A" subtitle={`${totalDepots} dépôts au total`} barPct={totalArticles > 0 ? 72 : 8} />
      </div>

      {showForm && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6 space-y-4">
          <p className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-accent-600/30 text-accent-400 flex items-center justify-center text-xs">+</span>
            Nouvelle société
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-accent-500 transition-colors" placeholder="Code (min. 3)" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            <input className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-accent-500 transition-colors" placeholder="Nom (min. 2)" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            <input className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-accent-500 transition-colors" placeholder="Email (optionnel)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer w-fit">
            <AnimatedSwitch checked={form.actif} onChange={(v) => setForm((f) => ({ ...f, actif: v }))} />
            <span className="text-sm text-white/60">Société active à la création</span>
          </label>
          {error && <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button type="button" disabled={createCompany.isPending || form.code.trim().length < 3 || form.nom.trim().length < 2} onClick={() => { setError(""); createCompany.mutate(); }} className="px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-40" style={primaryButtonStyle}>
              {createCompany.isPending ? "Ajout..." : "Créer la société"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm">Annuler</button>
          </div>
        </div>
      )}

      {listError && <p className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{listError}</p>}
      {success && <p className="text-emerald-400 text-sm mb-4 bg-emerald-400/10 border border-emerald-400/20 rounded-xl px-3 py-2">{success}</p>}

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-white/40 text-sm">Chargement...</div>
        ) : companies.length === 0 ? (
          <div className="py-16 text-center text-white/40 text-sm">Aucune société enregistrée</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                {["Code", "Nom", "Email", "Statut", "Users", "Articles", "Dépôts", "Relance", "Seuil", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3.5 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-white/5 transition-colors duration-200 hover:bg-white/[0.04] last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{c.code}</td>
                  <td className="px-4 py-3 text-white/90">{c.nom}</td>
                  <td className="px-4 py-3 text-white/60">{c.email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AnimatedSwitch checked={c.actif !== false} disabled={toggleActifMutation.isPending} onChange={() => requestToggle(c)} id={`co-toggle-${c.id}`} />
                      <SocieteStatusBadge actif={c.actif} />
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c._count?.utilisateurs ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums">{c._count?.articles ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums">{c._count?.depots ?? 0}</td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80"
                      value={(edits[c.id]?.joursRelanceClient ?? c.joursRelanceClient ?? 30)}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [c.id]: {
                            ...(prev[c.id] || { nom: c.nom, email: c.email || "", deadStockSeuil: c.deadStockSeuil ?? 50000 }),
                            joursRelanceClient: Number(e.target.value),
                          },
                        }))
                      }
                    >
                      <option value={15}>15 j</option>
                      <option value={30}>30 j</option>
                      <option value={60}>60 j</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <ChampSeuilValidation societeId={c.id} valeur={c.seuilValidationMouvement} />
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" disabled={updateCompany.isPending} onClick={() => {
                      const row = edits[c.id] || {
                        nom: c.nom,
                        email: c.email || "",
                        deadStockSeuil: c.deadStockSeuil ?? 50000,
                        joursRelanceClient: c.joursRelanceClient ?? 30,
                      };
                      updateCompany.mutate({
                        id: Number(c.id),
                        payload: {
                          nom: String(row.nom).trim(),
                          email: String(row.email).trim(),
                          deadStockSeuil: row.deadStockSeuil,
                          joursRelanceClient: Number(row.joursRelanceClient) || 30,
                        },
                      });
                    }} className="text-xs text-accent-400 hover:underline">Enregistrer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmToggleSocieteModal
        company={confirmToggle?.societe}
        nextActif={confirmToggle?.nextActif}
        onClose={() => setConfirmToggle(null)}
        loading={toggleActifMutation.isPending}
        onConfirm={confirmToggle}
      />
    </div>
  );
}
