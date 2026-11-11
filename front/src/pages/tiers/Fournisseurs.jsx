import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import LocationPicker from "../../components/ui/LocationPicker";
import FormFieldError, { inputErrorStyle } from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { fournisseurSchema } from "../../validation";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import TierStatusBadge from "./components/TierStatusBadge";
import TierViewToolbar, { sortTiers } from "./components/TierViewToolbar";
import TierTableView, { TierTableEmpty } from "./components/TierTableView";
import TierKpiStrip from "./components/TierKpiStrip";
import StockPagination from "../../components/stock/StockPagination";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import ConfirmToggleTierModal from "./components/ConfirmToggleTierModal";
import FournisseurDetailModal from "./components/FournisseurDetailModal";
import TierGridCard, { TierGridSkeleton } from "./components/TierGridCard";
import TierFormModalShell from "./components/TierFormModalShell";
import { Truck } from "lucide-react";
import SuggestedCodeInput, {
  isDuplicateCodeError,
  getDuplicateCodeMessage,
  normalizeCodeClient,
} from "../../components/forms/SuggestedCodeInput";
import { TIERS_KEYFRAMES, getTierEmptyMessage, nextActifValue, statutToApiParam } from "./components/tiersUtils";

// ——— Thème via variables CSS globales (index.css) —————————
const PAYMENT_OPTIONS = [
  { val: 0, label: "Comptant" },
  { val: 15, label: "15 jours" },
  { val: 30, label: "30 jours" },
  { val: 45, label: "45 jours" },
  { val: 60, label: "60 jours" },
  { val: 90, label: "90 jours" },
];

const avatarColors = [
  ["#378ADD", "#0EA5E9"],
  ["#0ea5e9", "#378ADD"],
  ["#10b981", "#0ea5e9"],
  ["#f59e0b", "#ef4444"],
  ["#ec4899", "#0EA5E9"],
  ["#14b8a6", "#378ADD"],
];

function Avatar({ nom, size = 40 }) {
  const initials = (nom || "?").slice(0, 2).toUpperCase();
  const [from, to] = avatarColors[(nom?.charCodeAt(0) || 0) % avatarColors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: `linear-gradient(135deg,${from},${to})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 600,
        color: "white",
        flexShrink: 0,
        boxShadow: `0 3px 10px ${from}40`,
      }}
    >
      {initials}
    </div>
  );
}

/** API: delaiPayment — affichage formulaire: delaiPaiement */
function mapApiToForm(f) {
  if (!f) return null;
  const lat = f.latitude != null ? Number(f.latitude) : null;
  const lng = f.longitude != null ? Number(f.longitude) : null;
  const hasLatLng = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  return {
    code: f.code ?? "",
    nom: f.nom ?? "",
    adresse: f.adresse ?? "",
    telephone: f.telephone ?? "",
    email: f.email ?? "",
    contact: f.contact ?? "",
    tauxRemise: f.tauxRemise ?? 0,
    delaiPaiement: f.delaiPayment ?? f.delaiPaiement ?? 30,
    noteCredit: f.noteCredit ?? 0,
    location: hasLatLng
      ? {
          adresse: f.adresse ?? "",
          ville: f.ville ?? "",
          pays: f.pays ?? "",
          latitude: lat,
          longitude: lng,
        }
      : null,
  };
}

function toSavePayload(form) {
  const loc = form.location;
  return {
    code: normalizeCodeClient(form.code),
    nom: form.nom.trim(),
    adresse: (loc?.adresse || form.adresse || "").trim() || null,
    telephone: form.telephone.trim() || null,
    email: form.email.trim() || null,
    contact: form.contact.trim() || null,
    tauxRemise: Number(form.tauxRemise),
    delaiPayment: Number(form.delaiPaiement),
    noteCredit: Number(form.noteCredit),
    ville: loc?.ville?.trim() || null,
    pays: loc?.pays?.trim() || null,
    latitude: loc != null && loc.latitude != null && loc.latitude !== "" ? Number(loc.latitude) : null,
    longitude: loc != null && loc.longitude != null && loc.longitude !== "" ? Number(loc.longitude) : null,
  };
}

// ─── MODAL FORM ───────────────────────────────────────────────
const EMPTY = {
  code: "",
  nom: "",
  adresse: "",
  telephone: "",
  email: "",
  contact: "",
  tauxRemise: 0,
  delaiPaiement: 30,
  noteCredit: 0,
  location: null,
};

function FournisseurHistoriqueTab({
  statsF,
  historiqueData,
  loadHisto,
  achatPage,
  setAchatPage,
  achatDateDebut,
  setAchatDateDebut,
  achatDateFin,
  setAchatDateFin,
}) {
  return (
    <div style={{ animation: "fournSlideUp .2s ease" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: "CA cette année",
            val: `${Number(statsF?.totalAnnee || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
            color: "#10b981",
          },
          {
            label: "CA ce mois",
            val: `${Number(statsF?.totalMois || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
            color: "#378ADD",
          },
          { label: "Commandes totales", val: statsF?.nbCommandes ?? "-", color: "#f59e0b" },
          {
            label: "Non réglé",
            val: `${Number(statsF?.montantNonRegle || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
            color: "#ef4444",
          },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: "var(--color-background-secondary)",
              borderRadius: 8,
              padding: "10px 12px",
              border: "0.5px solid var(--color-border-tertiary)",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>{k.label}</p>
            <p style={{ fontSize: 15, fontWeight: 500, color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>

      {statsF?.evolutionAchats?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Évolution achats 6 mois
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
            {statsF.evolutionAchats.map((m, i) => {
              const maxVal = Math.max(...statsF.evolutionAchats.map((x) => x.total), 1);
              const h = Math.max(4, (m.total / maxVal) * 56);
              const isLast = i === statsF.evolutionAchats.length - 1;
              return (
                <div
                  key={m.mois}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: h,
                      borderRadius: "3px 3px 0 0",
                      background: isLast ? "rgba(55,138,221,0.8)" : "rgba(55,138,221,0.35)",
                      transition: "height .4s ease",
                    }}
                  />
                  <span style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>{m.mois.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {statsF?.topArticles?.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 11,
              color: "var(--color-text-secondary)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Top articles commandés
          </p>
          {statsF.topArticles.map((a) => (
            <div
              key={a.code}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "5px 0",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--color-text-primary)" }}>{a.libelle}</span>
              <span style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                {a.totalQte} u — {Number(a.totalHT).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 3 }}>Du</label>
          <input
            type="date"
            value={achatDateDebut}
            onChange={(e) => {
              setAchatDateDebut(e.target.value);
              setAchatPage(1);
            }}
            style={{
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--color-text-primary)",
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 3 }}>Au</label>
          <input
            type="date"
            value={achatDateFin}
            onChange={(e) => {
              setAchatDateFin(e.target.value);
              setAchatPage(1);
            }}
            style={{
              background: "var(--color-background-secondary)",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              color: "var(--color-text-primary)",
            }}
          />
        </div>
        {(achatDateDebut || achatDateFin) && (
          <button
            type="button"
            onClick={() => {
              setAchatDateDebut("");
              setAchatDateFin("");
              setAchatPage(1);
            }}
            style={{
              alignSelf: "flex-end",
              padding: "5px 10px",
              background: "transparent",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
              color: "var(--color-text-secondary)",
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div
        style={{
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr
              style={{
                background: "var(--color-background-secondary)",
                borderBottom: "0.5px solid var(--color-border-tertiary)",
              }}
            >
              {["Réf.", "Date", "Statut", "Total TTC", "Paiement"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 10px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadHisto ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: "20px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12 }}
                >
                  Chargement…
                </td>
              </tr>
            ) : (historiqueData?.items || []).length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: "20px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 12 }}
                >
                  Aucun achat
                </td>
              </tr>
            ) : (
              (historiqueData?.items || []).map((a) => {
                const STATUT_COLOR = {
                  BROUILLON: "#64748b",
                  COMMANDE: "#3b82f6",
                  RECU: "#10b981",
                  RECEPTIONNE: "#10b981",
                  ANNULE: "#ef4444",
                };
                const PAIE_COLOR = { NON_REGLE: "#ef4444", PARTIEL: "#f59e0b", REGLE: "#10b981" };
                return (
                  <tr key={a.id} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <td
                      style={{
                        padding: "7px 10px",
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {a.reference || `#${a.id}`}
                    </td>
                    <td style={{ padding: "7px 10px", color: "var(--color-text-secondary)", fontSize: 11 }}>
                      {a.dateCommande ? new Date(a.dateCommande).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 20,
                          color: STATUT_COLOR[a.statut] || "#64748b",
                          background: `${STATUT_COLOR[a.statut] || "#64748b"}18`,
                          border: `0.5px solid ${STATUT_COLOR[a.statut] || "#64748b"}40`,
                        }}
                      >
                        {a.statut}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "7px 10px",
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {Number(a.totalTTC || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 20,
                          color: PAIE_COLOR[a.statutPaiement] || "#64748b",
                          background: `${PAIE_COLOR[a.statutPaiement] || "#64748b"}18`,
                          border: `0.5px solid ${PAIE_COLOR[a.statutPaiement] || "#64748b"}40`,
                        }}
                      >
                        {a.statutPaiement || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(historiqueData?.pages || 1) > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
          }}
        >
          <button
            type="button"
            disabled={achatPage <= 1}
            onClick={() => setAchatPage((p) => p - 1)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              background: "transparent",
              cursor: "pointer",
              border: "0.5px solid var(--color-border-secondary)",
              color: "var(--color-text-secondary)",
              opacity: achatPage <= 1 ? 0.4 : 1,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {achatPage} / {historiqueData?.pages || 1}
          </span>
          <button
            type="button"
            disabled={achatPage >= (historiqueData?.pages || 1)}
            onClick={() => setAchatPage((p) => p + 1)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              background: "transparent",
              cursor: "pointer",
              border: "0.5px solid var(--color-border-secondary)",
              color: "var(--color-text-secondary)",
              opacity: achatPage >= (historiqueData?.pages || 1) ? 0.4 : 1,
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function FournisseurModal({ fournisseur, onClose, onSaved }) {
  const isEdit = !!fournisseur?.id;
  const [form, setForm] = useState(() =>
    fournisseur ? { ...EMPTY, ...mapApiToForm(fournisseur) } : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [codeFading, setCodeFading] = useState(false);
  const [codePulsing, setCodePulsing] = useState(false);
  const [tab, setTab] = useState("info");
  const [achatPage, setAchatPage] = useState(1);
  const [achatDateDebut, setAchatDateDebut] = useState("");
  const [achatDateFin, setAchatDateFin] = useState("");

  const values = useMemo(
    () => ({
      code: form.code,
      nom: form.nom,
      email: form.email,
      telephone: form.telephone,
      adresse: form.adresse,
      ville: form.location?.ville || "",
      pays: form.location?.pays || "",
    }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError, clearErrors, applyApiErrors } = useFormValidation(
    fournisseurSchema,
    values
  );

  useEffect(() => {
    setForm(fournisseur ? { ...EMPTY, ...mapApiToForm(fournisseur) } : { ...EMPTY });
    setTab("info");
    setError(null);
    setCodeError("");
    setAchatPage(1);
    setAchatDateDebut("");
    setAchatDateFin("");
    clearErrors();
  }, [fournisseur]);

  const fetchNextCode = useCallback(async () => {
    setCodeFading(true);
    try {
      const { data } = await api.get("fournisseurs/next-code");
      if (data?.code) {
        setTimeout(() => {
          setForm((f) => ({ ...f, code: data.code }));
          setCodeFading(false);
        }, 75);
      } else {
        setCodeFading(false);
      }
    } catch {
      setCodeFading(false);
    }
  }, []);

  const regenerateCode = useCallback(async () => {
    await fetchNextCode();
  }, [fetchNextCode]);

  useEffect(() => {
    if (isEdit) return;
    fetchNextCode();
  }, [isEdit, fetchNextCode]);

  const { data: statsF } = useQuery({
    queryKey: ["fournisseur-stats", fournisseur?.id],
    queryFn: () => api.get(`fournisseurs/${fournisseur.id}/stats`).then((r) => r.data),
    enabled: Boolean(fournisseur?.id) && isEdit,
    staleTime: 60000,
  });

  const { data: historiqueData, isLoading: loadHisto } = useQuery({
    queryKey: ["fournisseur-histo", fournisseur?.id, achatPage, achatDateDebut, achatDateFin],
    queryFn: () =>
      api
        .get(`fournisseurs/${fournisseur.id}/historique-achats`, {
          params: {
            page: achatPage,
            limit: 10,
            ...(achatDateDebut ? { dateDebut: achatDateDebut } : {}),
            ...(achatDateFin ? { dateFin: achatDateFin } : {}),
          },
        })
        .then((r) => r.data),
    enabled: Boolean(fournisseur?.id) && isEdit && tab === "historique",
    staleTime: 30000,
  });

  const valid = isValid;

  const up = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    clearError(k);
  };

  const save = async () => {
    if (!validate()) {
      setTab("info");
      setError("Corrigez les champs obligatoires");
      return;
    }
    setSaving(true);
    setError(null);
    setCodeError("");
    try {
      const payload = toSavePayload(form);
      if (isEdit) {
        await api.patch(`fournisseurs/${fournisseur.id}`, payload);
      } else {
        await api.post("fournisseurs", payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
      } else {
        applyApiErrors(e.response?.data);
        const msg =
          e.response?.data?.message ||
          (Array.isArray(e.response?.data?.errors) &&
            (e.response.data.errors[0]?.message || e.response.data.errors[0]?.msg)) ||
          e.message ||
          "Erreur lors de la sauvegarde";
        setError(String(msg));
      }
    } finally {
      setSaving(false);
    }
  };

  const formTabs = [
    { id: "info", label: "Informations" },
    { id: "commercial", label: "Commercial" },
    { id: "localisation", label: "Localisation" },
    ...(isEdit ? [{ id: "historique", label: "Historique" }] : []),
  ];

  return (
    <TierFormModalShell
      variant="fournisseur"
      slideKey="fournSlideUp"
      title={isEdit ? `Modifier — ${fournisseur.nom}` : "Nouveau fournisseur"}
      subtitle={isEdit ? fournisseur.code : "Coordonnées, conditions et localisation"}
      avatar={isEdit ? <Avatar nom={fournisseur.nom} size={40} /> : null}
      onClose={onClose}
      tabs={formTabs}
      activeTab={tab}
      onTabChange={setTab}
      footer={
        <>
          {tab !== "info" ? (
            <button
              type="button"
              className="tier-form-btn-ghost"
              style={{ marginRight: "auto" }}
              onClick={() => {
                if (tab === "historique") setTab("localisation");
                else if (tab === "localisation") setTab("commercial");
                else setTab("info");
              }}
            >
              ← Retour
            </button>
          ) : (
            <span style={{ marginRight: "auto" }} />
          )}
          <button type="button" className="tier-form-btn-ghost" onClick={onClose}>
            Annuler
          </button>
          {tab === "info" && (
            <button
              type="button"
              className="tier-form-btn-primary"
              onClick={() => valid && setTab("commercial")}
              disabled={!valid}
            >
              Suivant →
            </button>
          )}
          {tab === "commercial" && (
            <button type="button" className="tier-form-btn-primary" onClick={() => setTab("localisation")}>
              Suivant →
            </button>
          )}
          {(tab === "localisation" || tab === "historique") && (
            <button type="button" className="tier-form-btn-primary" onClick={save} disabled={saving || !isValid}>
              {saving && (
                <div
                  style={{
                    width: 12,
                    height: 12,
                    border: "2px solid rgba(255,255,255,.4)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "fournSpin .6s linear infinite",
                  }}
                />
              )}
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer le fournisseur"}
            </button>
          )}
        </>
      }
    >
        {/* TAB 1 — Informations */}
        {tab === "info" && (
          <div style={{ animation: "fournSlideUp .2s ease" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <label className="f-label">Code *</label>
                <SuggestedCodeInput
                  value={form.code}
                  locked={isEdit}
                  codeError={codeError}
                  onClearError={() => setCodeError("")}
                  onRegenerate={!isEdit ? regenerateCode : undefined}
                  onChange={(v) => {
                    setCodeError("");
                    up("code", v);
                    setCodePulsing(true);
                    setTimeout(() => setCodePulsing(false), 600);
                  }}
                  placeholder="FRS-001"
                  maxLength={10}
                  className={codePulsing ? "animate-[pulseAccent_0.6s_ease]" : ""}
                  inputClassName={`w-full rounded-lg border px-3 py-2 font-mono text-sm transition-opacity duration-150 ${
                    codeFading ? "opacity-30" : "opacity-100"
                  }`}
                />
                <FormFieldError message={!codeError ? errors.code : null} />
                <p className="mt-1 text-[11px] text-[var(--text-secondary,#94a3b8)]">
                  {isEdit ? "Code existant (lecture seule)" : "Suggestion auto — modifiable avant enregistrement"}
                </p>
              </div>
              <div>
                <label className="f-label">Raison sociale *</label>
                <input
                  value={form.nom}
                  onChange={(e) => up("nom", e.target.value)}
                  onBlur={() => validateField("nom")}
                  placeholder="Nom du fournisseur"
                  style={errors.nom ? inputErrorStyle : undefined}
                />
                <FormFieldError message={errors.nom} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="f-label">Adresse</label>
              <input
                value={form.adresse}
                onChange={(e) => up("adresse", e.target.value)}
                placeholder="Adresse complète"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <label className="f-label">Téléphone</label>
                <input
                  value={form.telephone}
                  onChange={(e) => up("telephone", e.target.value)}
                  placeholder="+216 XX XXX XXX"
                />
              </div>
              <div>
                <label className="f-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => up("email", e.target.value)}
                  onBlur={() => validateField("email")}
                  placeholder="contact@fournisseur.com"
                  style={errors.email ? inputErrorStyle : undefined}
                />
                <FormFieldError message={errors.email} />
              </div>
            </div>

            <div>
              <label className="f-label">Personne de contact</label>
              <input
                value={form.contact}
                onChange={(e) => up("contact", e.target.value)}
                placeholder="Nom du responsable commercial"
              />
            </div>
          </div>
        )}

        {/* TAB 2 — Commercial */}
        {tab === "commercial" && (
          <div style={{ animation: "fournSlideUp .2s ease" }}>
            <div style={{ marginBottom: 16 }}>
              <label className="f-label">
                Taux de remise commerciale
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    fontWeight: 400,
                  }}
                >
                  — appliqué automatiquement sur les achats
                </span>
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.tauxRemise}
                  onChange={(e) => up("tauxRemise", Number(e.target.value))}
                  style={{ flex: 1, accentColor: "#378ADD" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 70 }}>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={form.tauxRemise}
                    onChange={(e) => up("tauxRemise", Number(e.target.value))}
                    style={{
                      width: 56,
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: 15,
                      color:
                        Number(form.tauxRemise) > 0 ? "#10b981" : "var(--color-text-secondary)",
                    }}
                  />
                  <span style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>%</span>
                </div>
              </div>
              {Number(form.tauxRemise) > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    background: "rgba(16,185,129,.08)",
                    border: "0.5px solid rgba(16,185,129,.2)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#10b981",
                  }}
                >
                  ✓ Une remise de {form.tauxRemise}% sera appliquée sur chaque ligne d&apos;achat
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="f-label">
                Délai de paiement
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    fontWeight: 400,
                  }}
                >
                  — calcule automatiquement les échéances
                </span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => up("delaiPaiement", opt.val)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "0.5px solid",
                      transition: "all .15s",
                      borderColor:
                        Number(form.delaiPaiement) === opt.val
                          ? "rgba(55,138,221,.5)"
                          : "var(--color-border-secondary)",
                      background:
                        Number(form.delaiPaiement) === opt.val
                          ? "rgba(55,138,221,.1)"
                          : "transparent",
                      color:
                        Number(form.delaiPaiement) === opt.val ? "#378ADD" : "var(--color-text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {Number(form.delaiPaiement) > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "rgba(55,138,221,.06)",
                    border: "0.5px solid rgba(55,138,221,.2)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Les factures de ce fournisseur seront dues à{" "}
                  <strong style={{ color: "var(--color-text-primary)" }}>J+{form.delaiPaiement}</strong> de la date de
                  réception
                </div>
              )}
            </div>

            <div>
              <label className="f-label">
                Plafond de crédit (TND)
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    fontWeight: 400,
                  }}
                >
                  — alerte si les achats en cours dépassent ce montant
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={form.noteCredit}
                  onChange={(e) => up("noteCredit", e.target.value)}
                  placeholder="0 = pas de limite"
                  style={{ paddingRight: 52 }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    fontWeight: 500,
                    pointerEvents: "none",
                  }}
                >
                  TND
                </span>
              </div>
              {Number(form.noteCredit) > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    background: "rgba(245,158,11,.08)",
                    border: "0.5px solid rgba(245,158,11,.2)",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#f59e0b",
                  }}
                >
                  ⚠ Alerte si les achats impayés dépassent{" "}
                  <strong>{Number(form.noteCredit).toLocaleString("fr-TN")}</strong> TND
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3 — Localisation */}
        {tab === "localisation" && (
          <div style={{ animation: "fournSlideUp .2s ease" }}>
            <div style={{ marginBottom: 12 }}>
              <label className="f-label">
                Adresse du siège
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>
                  — pour les bons de commande et livraisons
                </span>
              </label>
              <LocationPicker
                value={form.location}
                onChange={(loc) => {
                  setForm((p) => ({
                    ...p,
                    location: loc,
                    adresse: loc?.adresse || p.adresse,
                  }));
                }}
              />
            </div>

            {!form.location && (
              <div style={{ marginTop: 12 }}>
                <label className="f-label">Ou saisissez l&apos;adresse manuellement</label>
                <input
                  value={form.adresse}
                  onChange={(e) => up("adresse", e.target.value)}
                  placeholder="Rue, ville, code postal..."
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "rgba(55,138,221,.06)",
                border: "0.5px solid rgba(55,138,221,.2)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-text-secondary)",
                display: "flex",
                gap: 8,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#378ADD"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                La localisation permet de calculer les distances, optimiser les tournées de livraison et générer des bons
                de commande avec l&apos;adresse exacte.
              </span>
            </div>
          </div>
        )}

        {tab === "historique" && isEdit && (
          <FournisseurHistoriqueTab
            statsF={statsF}
            historiqueData={historiqueData}
            loadHisto={loadHisto}
            achatPage={achatPage}
            setAchatPage={setAchatPage}
            achatDateDebut={achatDateDebut}
            setAchatDateDebut={setAchatDateDebut}
            achatDateFin={achatDateFin}
            setAchatDateFin={setAchatDateFin}
          />
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(239,68,68,.08)",
              border: "0.5px solid rgba(239,68,68,.3)",
              color: "#ef4444",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
    </TierFormModalShell>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function Fournisseurs() {
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, "achats:write");

  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("actifs");
  const [viewMode, setViewMode] = useState("grid");
  const [sortKey, setSortKey] = useState("nom");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [modal, setModal] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statutFilter]);

  const fetchList = useCallback(() => {
    setLoading(true);
    api
      .get("fournisseurs", {
        params: {
          page,
          limit: pageSize,
          statut: statutToApiParam(statutFilter),
          ...(search ? { search } : {}),
        },
      })
      .then((r) => {
        const data = r.data;
        const raw = data?.items ?? data?.fournisseurs ?? data;
        setFournisseurs(Array.isArray(raw) ? raw : []);
        setTotal(Number(data?.total) || 0);
        setPages(Math.max(1, Number(data?.pages) || 1));
        setLoading(false);
      })
      .catch(() => {
        setFournisseurs([]);
        setTotal(0);
        setPages(1);
        setLoading(false);
        showToast("Impossible de charger les fournisseurs", "error");
      });
  }, [page, pageSize, search, statutFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const sorted = sortTiers(fournisseurs, sortKey, sortDir);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const handleToggleActif = async (f, nextActif) => {
    const prev = fournisseurs;
    setFournisseurs((list) => list.map((row) => (row.id === f.id ? { ...row, actif: nextActif } : row)));
    try {
      const { data } = await api.patch(`fournisseurs/${f.id}`, { nom: f.nom, actif: nextActif });
      setFournisseurs((list) => list.map((row) => (row.id === f.id ? { ...row, ...data } : row)));
      showToast(nextActif ? `${f.nom} réactivé` : `${f.nom} désactivé`, nextActif ? "success" : "warning");
      setConfirmToggle(null);
    } catch (e) {
      setFournisseurs(prev);
      const msg =
        e.response?.data?.message ||
        (Array.isArray(e.response?.data?.errors) && e.response.data.errors[0]?.msg) ||
        "Impossible de modifier le statut";
      showToast(msg, "error");
      setConfirmToggle(null);
      throw e;
    }
  };

  function applyTierUpdate(updated) {
    if (!updated?.id) return;
    setFournisseurs((list) => list.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
  }

  const headerBtn = canWrite ? (
    <button
      type="button"
      onClick={() => setModal({ type: "create" })}
      className={PRIMARY_BTN_CLASSES}
      style={primaryButtonStyle}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Nouveau fournisseur
    </button>
  ) : null;

  const pageActifs = sorted.filter((f) => f.actif !== false).length;
  const pageInactifs = sorted.filter((f) => f.actif === false).length;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <PageShell
      title="Fournisseurs"
      subtitle="Référentiel fournisseurs — lié aux achats, conditions commerciales et délais de paiement."
      actions={headerBtn}
    >
      <div className="tiers-page fournisseurs-page max-w-[1200px]">
        <style>{`
        ${TIERS_KEYFRAMES}
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .icon-btn {
          width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid transparent; background: none;
          transition: all .15s ease;
        }
        .icon-btn:hover { filter: brightness(1.15); }
      `}</style>

        {/* Toast */}
        {toast && (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 300,
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              animation: "toastIn .2s ease",
              background:
                toast.type === "success"
                  ? "rgba(16,185,129,.12)"
                  : toast.type === "warning"
                    ? "rgba(245,158,11,.12)"
                    : "rgba(239,68,68,.12)",
              border: `0.5px solid ${
                toast.type === "success"
                  ? "rgba(16,185,129,.45)"
                  : toast.type === "warning"
                    ? "rgba(245,158,11,.45)"
                    : "rgba(239,68,68,.45)"
              }`,
              color:
                toast.type === "success" ? "#10b981" : toast.type === "warning" ? "#f59e0b" : "#ef4444",
              boxShadow: "0 4px 16px rgba(0,0,0,.2)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {toast.type === "success" ? "✓" : toast.type === "warning" ? "○" : "✕"}
            {toast.msg}
          </div>
        )}

        <TierKpiStrip actifs={pageActifs} total={total} inactifs={pageInactifs} />

        <TierViewToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          statutFilter={statutFilter}
          onStatutFilterChange={setStatutFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {loading && viewMode === "grid" ? (
          <TierGridSkeleton count={6} />
        ) : sorted.length === 0 && !loading ? (
          (() => {
            const empty = getTierEmptyMessage({ statutFilter, searchInput, entityLabel: "fournisseur" });
            return (
              <TierTableEmpty
                title={empty.title}
                subtitle={empty.subtitle}
                icon={Truck}
                createLabel={canWrite ? "Nouveau fournisseur" : undefined}
                onCreate={canWrite ? () => setModal({ type: "create" }) : undefined}
              />
            );
          })()
        ) : viewMode === "table" ? (
          <>
          <TierTableView
            items={sorted}
            loading={loading}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onView={(f) => setDetailId(f.id)}
            onEdit={(f) => setModal({ type: "edit", fournisseur: f })}
            onToggle={(f) => setConfirmToggle({ tier: f, nextActif: nextActifValue(f.actif) })}
            canWrite={canWrite}
          />
          {!loading && (
          <StockPagination
            className="mt-4"
            page={page}
            totalPages={pages}
            totalResults={total}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="fournisseur(s)"
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 25, 50]}
          />
          )}
          </>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((f, idx) => {
              const badges = [];
              if (Number(f.tauxRemise) > 0) {
                badges.push({
                  label: `Remise ${f.tauxRemise}%`,
                  style: { background: "rgba(16,185,129,.12)", color: "#10b981", borderColor: "rgba(16,185,129,.3)" },
                });
              }
              if (Number(f.delaiPayment) > 0) {
                badges.push({
                  label: `Délai ${f.delaiPayment} j`,
                  style: { background: "rgba(55,138,221,.12)", color: "#378ADD", borderColor: "rgba(55,138,221,.3)" },
                });
              }
              if (Number(f.noteCredit) > 0) {
                badges.push({
                  label: `Plafond ${Number(f.noteCredit).toLocaleString("fr-TN")} TND`,
                  style: { background: "rgba(245,158,11,.12)", color: "#f59e0b", borderColor: "rgba(245,158,11,.3)" },
                });
              }
              return (
                <TierGridCard
                  key={f.id}
                  tier={f}
                  index={idx}
                  badges={badges}
                  canWrite={canWrite}
                  onView={(item) => setDetailId(item.id)}
                  onEdit={(item) => setModal({ type: "edit", fournisseur: item })}
                  onToggle={(item) => setConfirmToggle({ tier: item, nextActif: nextActifValue(item.actif) })}
                />
              );
            })}
          </div>
          <StockPagination
            className="mt-4"
            page={page}
            totalPages={pages}
            totalResults={total}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="fournisseur(s)"
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 25, 50]}
          />
          </>
        )}

        {/* Modals */}
        {modal?.type === "create" && (
          <FournisseurModal
            key="create"
            onClose={() => setModal(null)}
            onSaved={() => {
              showToast("Fournisseur créé avec succès");
              fetchList();
            }}
          />
        )}
        {modal?.type === "edit" && (
          <FournisseurModal
            key={modal.fournisseur.id}
            fournisseur={modal.fournisseur}
            onClose={() => setModal(null)}
            onSaved={() => {
              showToast("Fournisseur mis à jour");
              fetchList();
            }}
          />
        )}
        <ConfirmToggleTierModal
          tier={confirmToggle?.tier}
          tierType="fournisseur"
          nextActif={confirmToggle?.nextActif}
          onClose={() => setConfirmToggle(null)}
          onConfirm={handleToggleActif}
        />

        <FournisseurDetailModal
          fournisseurId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(f) => setModal({ type: "edit", fournisseur: f })}
          onTierUpdated={applyTierUpdate}
        />
      </div>
    </PageShell>
  );
}
