import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import LocationPicker from "../../components/ui/LocationPicker";
import FormFieldError, { inputErrorStyle } from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { clientSchema } from "../../validation";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import TierStatusBadge from "./components/TierStatusBadge";
import TierViewToolbar, { sortTiers } from "./components/TierViewToolbar";
import TierTableView, { TierTableEmpty } from "./components/TierTableView";
import TierKpiStrip from "./components/TierKpiStrip";
import StockPagination from "../../components/stock/StockPagination";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import ConfirmToggleTierModal from "./components/ConfirmToggleTierModal";
import ClientDetailModal from "./components/ClientDetailModal";
import TierGridCard, { TierGridSkeleton } from "./components/TierGridCard";
import TierFormModalShell from "./components/TierFormModalShell";
import { Users } from "lucide-react";
import SuggestedCodeInput, {
  isDuplicateCodeError,
  getDuplicateCodeMessage,
  normalizeCodeClient,
} from "../../components/forms/SuggestedCodeInput";
import { TIERS_KEYFRAMES, getEncoursPillStyle, getTierEmptyMessage, nextActifValue, statutToApiParam } from "./components/tiersUtils";

const MODE_PAIEMENT_OPTIONS = [
  { val: "ESPECES", label: "Espèces" },
  { val: "CHEQUE", label: "Chèque" },
  { val: "VIREMENT", label: "Virement" },
  { val: "TRAITE", label: "Traite" },
  { val: "MIXTE", label: "Mixte" },
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

function ClientHistoriqueTab({
  statsC,
  historiqueData,
  loadHisto,
  ventePage,
  setVentePage,
  venteDateDebut,
  setVenteDateDebut,
  venteDateFin,
  setVenteDateFin,
}) {
  return (
    <div style={{ animation: "clientSlideUp .2s ease" }}>
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
            val: `${Number(statsC?.caAnnee || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
            color: "#10b981",
          },
          {
            label: "CA ce mois",
            val: `${Number(statsC?.caMois || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
            color: "#378ADD",
          },
          { label: "Nb ventes", val: statsC?.nbVentes ?? "-", color: "#f59e0b" },
          {
            label: "Impayé",
            val: `${Number(statsC?.montantImpaye || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
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

      {statsC?.evolutionCA?.length > 0 && (
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
            Évolution CA 6 mois
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
            {statsC.evolutionCA.map((m, i) => {
              const maxVal = Math.max(...statsC.evolutionCA.map((x) => x.ca), 1);
              const h = Math.max(4, (m.ca / maxVal) * 56);
              const isLast = i === statsC.evolutionCA.length - 1;
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

      {statsC?.topArticles?.length > 0 && (
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
            Top articles achetés
          </p>
          {statsC.topArticles.map((a) => (
            <div
              key={a.code || a.libelle}
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
                {Number(a.totalQte || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} u —{" "}
                {Number(a.totalHT || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND
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
            value={venteDateDebut}
            onChange={(e) => {
              setVenteDateDebut(e.target.value);
              setVentePage(1);
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
            value={venteDateFin}
            onChange={(e) => {
              setVenteDateFin(e.target.value);
              setVentePage(1);
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
        {(venteDateDebut || venteDateFin) && (
          <button
            type="button"
            onClick={() => {
              setVenteDateDebut("");
              setVenteDateFin("");
              setVentePage(1);
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
              {["Réf.", "Date", "Statut", "Total TTC", "Solde dû"].map((h) => (
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
                  Aucune vente
                </td>
              </tr>
            ) : (
              (historiqueData?.items || []).map((v) => {
                const STATUT_COLOR = {
                  BROUILLON: "#64748b",
                  EN_ATTENTE: "#f59e0b",
                  VALIDE: "#3b82f6",
                  LIVRE: "#10b981",
                  ANNULE: "#ef4444",
                };
                return (
                  <tr key={v.id} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <td
                      style={{
                        padding: "7px 10px",
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {v.reference || `#${v.id}`}
                    </td>
                    <td style={{ padding: "7px 10px", color: "var(--color-text-secondary)", fontSize: 11 }}>
                      {v.dateVente ? new Date(v.dateVente).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: 20,
                          color: STATUT_COLOR[v.statut] || "#64748b",
                          background: `${STATUT_COLOR[v.statut] || "#64748b"}18`,
                          border: `0.5px solid ${STATUT_COLOR[v.statut] || "#64748b"}40`,
                        }}
                      >
                        {v.statut}
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
                      {Number(v.totalTTC || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: "var(--font-mono)",
                          color: Number(v.solde) > 0 ? "#ef4444" : "#10b981",
                        }}
                      >
                        {Number(v.solde || 0).toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND
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
            disabled={ventePage <= 1}
            onClick={() => setVentePage((p) => p - 1)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              background: "transparent",
              cursor: "pointer",
              border: "0.5px solid var(--color-border-secondary)",
              color: "var(--color-text-secondary)",
              opacity: ventePage <= 1 ? 0.4 : 1,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {ventePage} / {historiqueData?.pages || 1}
          </span>
          <button
            type="button"
            disabled={ventePage >= (historiqueData?.pages || 1)}
            onClick={() => setVentePage((p) => p + 1)}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              fontSize: 12,
              background: "transparent",
              cursor: "pointer",
              border: "0.5px solid var(--color-border-secondary)",
              color: "var(--color-text-secondary)",
              opacity: ventePage >= (historiqueData?.pages || 1) ? 0.4 : 1,
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY = {
  code: "",
  nom: "",
  adresse: "",
  telephone: "",
  email: "",
  contact: "",
  plafondCredit: "",
  tauxRemise: 0,
  modePaiement: "ESPECES",
  location: null,
};

function mapApiToForm(c) {
  if (!c) return null;
  const lat = c.latitude != null ? Number(c.latitude) : null;
  const lng = c.longitude != null ? Number(c.longitude) : null;
  const hasLatLng = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  return {
    code: c.code || "",
    nom: c.nom || "",
    adresse: c.adresse || "",
    telephone: c.telephone || "",
    email: c.email || "",
    contact: c.contact || "",
    plafondCredit: c.plafondCredit != null ? String(c.plafondCredit) : "",
    tauxRemise: Number(c.tauxRemise) || 0,
    modePaiement: c.modePaiement || "ESPECES",
    location: hasLatLng
      ? {
          adresse: c.adresse ?? "",
          ville: c.ville ?? "",
          pays: c.pays ?? "",
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
    plafondCredit: form.plafondCredit === "" ? null : Number(form.plafondCredit),
    tauxRemise: Number(form.tauxRemise) || 0,
    modePaiement: form.modePaiement || null,
    ville: loc?.ville?.trim() || null,
    pays: loc?.pays?.trim() || null,
    latitude: loc != null && loc.latitude != null && loc.latitude !== "" ? Number(loc.latitude) : null,
    longitude: loc != null && loc.longitude != null && loc.longitude !== "" ? Number(loc.longitude) : null,
  };
}

function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client?.id;
  const encours = Number(client?.encours) || 0;
  const [form, setForm] = useState(() => (client ? { ...EMPTY, ...mapApiToForm(client) } : { ...EMPTY }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [codeError, setCodeError] = useState("");
  const [codeFading, setCodeFading] = useState(false);
  const [codePulsing, setCodePulsing] = useState(false);
  const [tab, setTab] = useState("info");
  const [ventePage, setVentePage] = useState(1);
  const [venteDateDebut, setVenteDateDebut] = useState("");
  const [venteDateFin, setVenteDateFin] = useState("");

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
    clientSchema,
    values
  );

  useEffect(() => {
    setForm(client ? { ...EMPTY, ...mapApiToForm(client) } : { ...EMPTY });
    setTab("info");
    setError(null);
    setCodeError("");
    setVentePage(1);
    setVenteDateDebut("");
    setVenteDateFin("");
    clearErrors();
  }, [client]);

  const fetchNextCode = useCallback(async () => {
    setCodeFading(true);
    try {
      const { data } = await api.get("clients/next-code");
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

  const { data: statsC } = useQuery({
    queryKey: ["client-stats", client?.id],
    queryFn: () => api.get(`clients/${client.id}/stats`).then((r) => r.data),
    enabled: Boolean(client?.id) && isEdit,
    staleTime: 60000,
  });

  const { data: historiqueData, isLoading: loadHisto } = useQuery({
    queryKey: ["client-histo", client?.id, ventePage, venteDateDebut, venteDateFin],
    queryFn: () =>
      api
        .get(`clients/${client.id}/historique-ventes`, {
          params: {
            page: ventePage,
            limit: 10,
            ...(venteDateDebut ? { dateDebut: venteDateDebut } : {}),
            ...(venteDateFin ? { dateFin: venteDateFin } : {}),
          },
        })
        .then((r) => r.data),
    enabled: Boolean(client?.id) && isEdit && tab === "historique",
    staleTime: 30000,
  });

  const valid = isValid;
  const up = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    clearError(k);
  };
  const plafond = Number(form.plafondCredit) || 0;
  const depassePlafond = plafond > 0 && encours > plafond;

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
        await api.patch(`clients/${client.id}`, payload);
      } else {
        await api.post("clients", payload);
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
      variant="client"
      title={isEdit ? `Modifier — ${client.nom}` : "Nouveau client"}
      subtitle={isEdit ? client.code : "Coordonnées, conditions commerciales et localisation"}
      avatar={isEdit ? <Avatar nom={client.nom} size={40} /> : null}
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
                    animation: "clientSpin .6s linear infinite",
                  }}
                />
              )}
              {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Créer le client"}
            </button>
          )}
        </>
      }
    >
        {tab === "info" && (
          <div style={{ animation: "clientSlideUp .2s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label className="c-label">Code *</label>
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
                  placeholder="CLI-001"
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
                <label className="c-label">Nom *</label>
                <input
                  value={form.nom}
                  onChange={(e) => up("nom", e.target.value)}
                  onBlur={() => validateField("nom")}
                  placeholder="Nom du client"
                  style={errors.nom ? inputErrorStyle : undefined}
                />
                <FormFieldError message={errors.nom} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="c-label">Adresse</label>
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
                <label className="c-label">Téléphone</label>
                <input
                  value={form.telephone}
                  onChange={(e) => up("telephone", e.target.value)}
                  placeholder="+216 XX XXX XXX"
                />
              </div>
              <div>
                <label className="c-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => up("email", e.target.value)}
                  onBlur={() => validateField("email")}
                  placeholder="contact@client.com"
                  style={errors.email ? inputErrorStyle : undefined}
                />
                <FormFieldError message={errors.email} />
              </div>
            </div>

            <div>
              <label className="c-label">Personne de contact</label>
              <input
                value={form.contact}
                onChange={(e) => up("contact", e.target.value)}
                placeholder="Nom du responsable commercial"
              />
            </div>
          </div>
        )}

        {tab === "commercial" && (
          <div style={{ animation: "clientSlideUp .2s ease" }}>
            <div style={{ marginBottom: 16 }}>
              <label className="c-label">Plafond crédit (TND)</label>
              <div style={{ position: "relative" }}>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={form.plafondCredit}
                  onChange={(e) => up("plafondCredit", e.target.value)}
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
                    pointerEvents: "none",
                  }}
                >
                  TND
                </span>
              </div>
              {depassePlafond && (
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
                  ⚠ L&apos;encours ({encours.toLocaleString("fr-TN")} TND) dépasse le plafond crédit
                </div>
              )}
            </div>

            {isEdit && (
              <div style={{ marginBottom: 16 }}>
                <label className="c-label">Encours actuel</label>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--color-background-secondary)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    fontSize: 15,
                    fontWeight: 500,
                    fontFamily: "var(--font-mono)",
                    color: depassePlafond ? "#ef4444" : "var(--color-text-primary)",
                  }}
                >
                  {encours.toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label className="c-label">
                Taux de remise commerciale
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>
                  — appliqué automatiquement sur les ventes
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
                      color: Number(form.tauxRemise) > 0 ? "#10b981" : "var(--color-text-secondary)",
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
                  ✓ Une remise de {form.tauxRemise}% sera appliquée sur chaque ligne de vente
                </div>
              )}
            </div>

            <div>
              <label className="c-label">
                Mode de paiement habituel
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>
                  — préférence indicative pour les ventes
                </span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {MODE_PAIEMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => up("modePaiement", opt.val)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "0.5px solid",
                      borderColor:
                        form.modePaiement === opt.val ? "rgba(55,138,221,.5)" : "var(--color-border-secondary)",
                      background: form.modePaiement === opt.val ? "rgba(55,138,221,.1)" : "transparent",
                      color: form.modePaiement === opt.val ? "#378ADD" : "var(--color-text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "localisation" && (
          <div style={{ animation: "clientSlideUp .2s ease" }}>
            <div style={{ marginBottom: 12 }}>
              <label className="c-label">
                Adresse de livraison / facturation
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--color-text-secondary)", fontWeight: 400 }}>
                  — pour les bons de livraison et factures
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
                <label className="c-label">Ou saisissez l&apos;adresse manuellement</label>
                <input
                  value={form.adresse}
                  onChange={(e) => up("adresse", e.target.value)}
                  placeholder="Rue, ville, code postal..."
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
                La localisation permet d&apos;optimiser les tournées de livraison et d&apos;afficher le client sur la carte.
              </span>
            </div>
          </div>
        )}

        {tab === "historique" && isEdit && (
          <ClientHistoriqueTab
            statsC={statsC}
            historiqueData={historiqueData}
            loadHisto={loadHisto}
            ventePage={ventePage}
            setVentePage={setVentePage}
            venteDateDebut={venteDateDebut}
            setVenteDateDebut={setVenteDateDebut}
            venteDateFin={venteDateFin}
            setVenteDateFin={setVenteDateFin}
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

const MODE_LABELS = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  TRAITE: "Traite",
  MIXTE: "Mixte",
  CARTE: "Carte",
  EFFET: "Effet",
};

export default function Clients() {
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, "ventes:write");

  const [clients, setClients] = useState([]);
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
      .get("clients", {
        params: {
          page,
          limit: pageSize,
          statut: statutToApiParam(statutFilter),
          ...(search ? { search } : {}),
        },
      })
      .then((r) => {
        const data = r.data;
        const raw = data?.items ?? data;
        setClients(Array.isArray(raw) ? raw : []);
        setTotal(Number(data?.total) || 0);
        setPages(Math.max(1, Number(data?.pages) || 1));
        setLoading(false);
      })
      .catch(() => {
        setClients([]);
        setTotal(0);
        setPages(1);
        setLoading(false);
        showToast("Impossible de charger les clients", "error");
      });
  }, [page, pageSize, search, statutFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const sorted = sortTiers(clients, sortKey, sortDir);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const handleToggleActif = async (c, nextActif) => {
    const prev = clients;
    setClients((list) => list.map((row) => (row.id === c.id ? { ...row, actif: nextActif } : row)));
    try {
      const { data } = await api.patch(`clients/${c.id}`, { nom: c.nom, actif: nextActif });
      setClients((list) => list.map((row) => (row.id === c.id ? { ...row, ...data } : row)));
      showToast(nextActif ? `${c.nom} réactivé` : `${c.nom} désactivé`, nextActif ? "success" : "warning");
      setConfirmToggle(null);
    } catch (e) {
      setClients(prev);
      const msg = e.response?.data?.message || "Impossible de modifier le statut";
      showToast(msg, "error");
      setConfirmToggle(null);
      throw e;
    }
  };

  function applyTierUpdate(updated) {
    if (!updated?.id) return;
    setClients((list) => list.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
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
      Nouveau client
    </button>
  ) : null;

  const pageActifs = sorted.filter((c) => c.actif !== false).length;
  const pageInactifs = sorted.filter((c) => c.actif === false).length;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <PageShell
      title="Clients"
      subtitle="Référentiel clients — ventes, crédit, localisation et historique commercial."
      actions={headerBtn}
    >
      <div className="tiers-page clients-page max-w-[1200px]">
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
      `}</style>

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
            const empty = getTierEmptyMessage({ statutFilter, searchInput, entityLabel: "client" });
            return (
              <TierTableEmpty
                title={empty.title}
                subtitle={empty.subtitle}
                icon={Users}
                createLabel={canWrite ? "Nouveau client" : undefined}
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
            onView={(c) => setDetailId(c.id)}
            onEdit={(c) => setModal({ type: "edit", client: c })}
            onToggle={(c) => setConfirmToggle({ tier: c, nextActif: nextActifValue(c.actif) })}
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
            unitLabel="client(s)"
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
            {sorted.map((c, idx) => {
              const enc = Number(c.encours) || 0;
              const plaf = Number(c.plafondCredit) || 0;
              const modeLabel = MODE_LABELS[c.modePaiement] || c.modePaiement;
              const badges = [];
              if (Number(c.tauxRemise) > 0) {
                badges.push({
                  label: `Remise ${c.tauxRemise}%`,
                  style: { background: "rgba(16,185,129,.12)", color: "#10b981", borderColor: "rgba(16,185,129,.3)" },
                });
              }
              if (plaf > 0) {
                badges.push({
                  label: `Plafond ${plaf.toLocaleString("fr-TN")} TND`,
                  style: { background: "rgba(245,158,11,.12)", color: "#f59e0b", borderColor: "rgba(245,158,11,.3)" },
                });
              }
              const encStyle = getEncoursPillStyle(enc, plaf);
              badges.push({
                label: `Encours ${enc.toLocaleString("fr-TN", { maximumFractionDigits: 3 })} TND`,
                style: {
                  background: encStyle.background,
                  color: encStyle.color,
                  borderColor: String(encStyle.border || "").replace("0.5px solid ", "") || "transparent",
                },
              });
              if (modeLabel) {
                badges.push({
                  label: modeLabel,
                  style: { background: "rgba(55,138,221,.12)", color: "#378ADD", borderColor: "rgba(55,138,221,.3)" },
                });
              }
              if (c._count?.ventes > 0) {
                badges.push({
                  label: `${c._count.ventes} vente(s)`,
                  style: { background: "rgba(14,165,233,.12)", color: "#0EA5E9", borderColor: "rgba(14,165,233,.3)" },
                });
              }
              return (
                <TierGridCard
                  key={c.id}
                  tier={c}
                  index={idx}
                  badges={badges}
                  canWrite={canWrite}
                  onView={(item) => setDetailId(item.id)}
                  onEdit={(item) => setModal({ type: "edit", client: item })}
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
            unitLabel="client(s)"
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 25, 50]}
          />
          </>
        )}

        {modal?.type === "create" && (
          <ClientModal
            key="create"
            onClose={() => setModal(null)}
            onSaved={() => {
              showToast("Client créé avec succès");
              fetchList();
            }}
          />
        )}
        {modal?.type === "edit" && (
          <ClientModal
            key={modal.client.id}
            client={modal.client}
            onClose={() => setModal(null)}
            onSaved={() => {
              showToast("Client mis à jour");
              fetchList();
            }}
          />
        )}
        <ConfirmToggleTierModal
          tier={confirmToggle?.tier}
          tierType="client"
          nextActif={confirmToggle?.nextActif}
          onClose={() => setConfirmToggle(null)}
          onConfirm={handleToggleActif}
        />

        <ClientDetailModal
          clientId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(c) => setModal({ type: "edit", client: c })}
          onTierUpdated={applyTierUpdate}
        />
      </div>
    </PageShell>
  );
}
