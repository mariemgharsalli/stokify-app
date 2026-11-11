import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import SuggestedCodeInput, { normalizeCodeClient } from "../../../components/forms/SuggestedCodeInput";
import FormFieldError from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { depotSchema } from "../../../validation";
import { suggestDepotCode } from "./depotUtils";
import DepotLocationTab from "./DepotLocationTab";

const TABS = [
  { id: "info", label: "📋 Informations" },
  { id: "capacite", label: "⚙️ Capacité & seuils" },
  { id: "localisation", label: "📍 Localisation" },
];

const TAB_ORDER = ["info", "capacite", "localisation"];

const FORM_STYLES = `
  @keyframes depotModalIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes depotTabFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .depot-form-modal .f-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .depot-form-modal input:not([type="range"]):not([type="checkbox"]),
  .depot-form-modal textarea,
  .depot-form-modal select {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    border-radius: 8px;
    border: 0.5px solid var(--color-border-secondary);
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
    font-size: 14px;
  }
  .depot-form-modal input.depot-input-err,
  .depot-form-modal textarea.depot-input-err {
    border-color: rgba(239, 68, 68, 0.6);
  }
  .depot-form-modal input::placeholder,
  .depot-form-modal textarea::placeholder {
    color: var(--color-text-secondary);
    opacity: 0.65;
  }
`;

function Field({ label, error, children, hint }) {
  return (
    <div>
      <label className="f-label">
        {label}
        {hint && (
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
            {hint}
          </span>
        )}
      </label>
      {children}
      <FormFieldError message={error} />
    </div>
  );
}

export default function DepotFormModal({ depot, onClose, onSave, saving, onToast, codeError, onClearCodeError }) {
  const isEdit = Boolean(depot?.id);
  const [tab, setTab] = useState("info");
  const [form, setForm] = useState({
    code: "",
    libelle: "",
    ville: "",
    adresse: "",
    region: "",
    capacite: "",
    qteMin: "",
    qteMax: "",
    capaciteVolume: "",
    capacitePoids: "",
    latitude: "",
    longitude: "",
  });
  const [storageFlags, setStorageFlags] = useState({
    refrigere: false,
    chimique: false,
    inflammable: false,
    fragile: false,
  });

  const values = useMemo(
    () => ({
      code: form.code,
      libelle: form.libelle,
      ville: form.ville,
      adresse: form.adresse,
      region: form.region,
      capacite: form.capacite,
      qteMin: form.qteMin,
      qteMax: form.qteMax,
      capaciteVolume: form.capaciteVolume,
      capacitePoids: form.capacitePoids,
      latitude: form.latitude,
      longitude: form.longitude,
    }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError, clearErrors } = useFormValidation(
    depotSchema,
    values
  );

  useEffect(() => {
    setTab("info");
    onClearCodeError?.();
    clearErrors();
    if (depot) {
      setForm({
        code: depot.code || "",
        libelle: depot.libelle || "",
        ville: depot.ville || "",
        adresse: depot.adresse || "",
        region: depot.region || "",
        capacite: depot.capacite ?? "",
        qteMin: depot.qteMin ?? "",
        qteMax: depot.qteMax ?? "",
        capaciteVolume: depot.capaciteVolume ?? "",
        capacitePoids: depot.capacitePoids ?? "",
        latitude: depot.latitude != null ? String(depot.latitude) : "",
        longitude: depot.longitude != null ? String(depot.longitude) : "",
      });
      setStorageFlags({
        refrigere: Boolean(depot.storageRefrigere),
        chimique: Boolean(depot.storageChimique),
        inflammable: Boolean(depot.storageInflammable),
        fragile: Boolean(depot.storageFragile),
      });
    } else {
      setForm({
        code: "",
        libelle: "",
        ville: "",
        adresse: "",
        region: "",
        capacite: "",
        qteMin: "",
        qteMax: "",
        capaciteVolume: "",
        capacitePoids: "",
        latitude: "",
        longitude: "",
      });
      setStorageFlags({ refrigere: false, chimique: false, inflammable: false, fragile: false });
    }
  }, [depot]);

  const up = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    clearError(k);
  };
  const tabIndex = TAB_ORDER.indexOf(tab);

  const goBack = () => {
    if (tabIndex > 0) setTab(TAB_ORDER[tabIndex - 1]);
  };

  const submit = (e) => {
    e?.preventDefault?.();
    if (!validate()) {
      setTab("info");
      onToast?.("Corrigez les champs obligatoires.", "error");
      return;
    }
    onSave({
      code: normalizeCodeClient(form.code),
      libelle: form.libelle.trim(),
      ville: form.ville.trim() || null,
      adresse: form.adresse.trim() || null,
      region: form.region.trim() || null,
      capacite: form.capacite === "" ? null : Number(form.capacite),
      qteMin: form.qteMin === "" ? null : Number(form.qteMin),
      qteMax: form.qteMax === "" ? null : Number(form.qteMax),
      capaciteVolume: form.capaciteVolume === "" ? null : Number(form.capaciteVolume),
      capacitePoids: form.capacitePoids === "" ? null : Number(form.capacitePoids),
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      storageRefrigere: Boolean(storageFlags.refrigere),
      storageChimique: Boolean(storageFlags.chimique),
      storageInflammable: Boolean(storageFlags.inflammable),
      storageFragile: Boolean(storageFlags.fragile),
    });
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      role="presentation"
      className="depot-form-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <style>{FORM_STYLES}</style>
      <div
        style={{
          background: "var(--color-background-primary, var(--bg-card, #ffffff))",
          border: "0.5px solid var(--color-border-secondary, var(--border-default, #e2e8f0))",
          borderRadius: 16,
          padding: "1.75rem",
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,.3)",
          animation: "depotModalIn .2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1rem",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 4px" }}>
              {isEdit ? `Modifier — ${depot.libelle}` : "Nouveau dépôt"}
            </h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
              {isEdit ? depot.code : "Remplissez les informations du dépôt"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 0,
            marginBottom: "1.25rem",
            borderBottom: "1px solid #2d3148",
            flexShrink: 0,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                fontSize: 12,
                fontWeight: tab === t.id ? 500 : 400,
                cursor: "pointer",
                border: "none",
                borderBottom: tab === t.id ? "2px solid #7c3aed" : "2px solid transparent",
                marginBottom: -1,
                background: tab === t.id ? "#1e2130" : "transparent",
                color: tab === t.id ? "#f1f5f9" : "#6b7280",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12, flexShrink: 0 }}>
          {TAB_ORDER.map((id, i) => (
            <span
              key={id}
              style={{
                width: i === tabIndex ? 8 : 6,
                height: i === tabIndex ? 8 : 6,
                borderRadius: "50%",
                background: i <= tabIndex ? "#7c3aed" : "#374151",
                transition: "all 150ms",
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
          {tab === "info" && (
            <div style={{ animation: "depotTabFade .15s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Code *" error={!codeError ? errors.code : null}>
                  <SuggestedCodeInput
                    value={form.code}
                    codeError={codeError}
                    onClearError={onClearCodeError}
                    onChange={(v) => up("code", v)}
                    onRegenerate={() => {
                      if (!isEdit) up("code", suggestDepotCode());
                    }}
                    placeholder="DEP004"
                    inputClassName={errors.code ? "depot-input-err" : ""}
                  />
                </Field>
                <Field label="Libellé *" error={errors.libelle}>
                  <input
                    className={errors.libelle ? "depot-input-err" : ""}
                    value={form.libelle}
                    onChange={(e) => up("libelle", e.target.value)}
                    onBlur={() => validateField("libelle")}
                    placeholder="Nom du dépôt"
                  />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Ville">
                  <input value={form.ville} onChange={(e) => up("ville", e.target.value)} placeholder="Tunis" />
                </Field>
                <Field label="Adresse complète">
                  <input
                    value={form.adresse}
                    onChange={(e) => up("adresse", e.target.value)}
                    placeholder="Rue, numéro, quartier"
                  />
                </Field>
              </div>
              <Field label="Notes / région">
                <textarea
                  value={form.region}
                  onChange={(e) => up("region", e.target.value)}
                  placeholder="Description ou notes internes"
                  rows={3}
                  style={{ resize: "vertical", minHeight: 72 }}
                />
              </Field>
            </div>
          )}

          {tab === "capacite" && (
            <div style={{ animation: "depotTabFade .15s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Capacité (m²)">
                  <input
                    type="number"
                    min={0}
                    value={form.capacite}
                    onChange={(e) => up("capacite", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Seuil min (qté)" hint="alerte stock bas">
                  <input
                    type="number"
                    min={0}
                    value={form.qteMin}
                    onChange={(e) => up("qteMin", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Seuil max (qté)" hint="alerte surcharge">
                  <input
                    type="number"
                    min={0}
                    value={form.qteMax}
                    onChange={(e) => up("qteMax", e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <Field label="Responsable" hint="— bientôt disponible">
                  <select disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                    <option>Sélectionner un utilisateur</option>
                  </select>
                </Field>
              </div>

              <div
                style={{
                  marginTop: 8,
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "0.5px solid var(--color-border-secondary)",
                  background: "var(--color-background-secondary)",
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  📦 Capacités physiques
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Capacité volume (m³)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.capaciteVolume}
                      onChange={(e) => up("capaciteVolume", e.target.value)}
                      placeholder="Ex: 200"
                    />
                  </Field>
                  <Field label="Capacité poids (kg)">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={form.capacitePoids}
                      onChange={(e) => up("capacitePoids", e.target.value)}
                      placeholder="Ex: 3900"
                    />
                  </Field>
                </div>
              </div>
              <p className="f-label" style={{ marginBottom: 8 }}>
                Conditions de stockage
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: "#94a3b8" }}>
                {[
                  ["refrigere", "Réfrigéré"],
                  ["chimique", "Produit chimique"],
                  ["inflammable", "Inflammable"],
                  ["fragile", "Fragile"],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={storageFlags[key]}
                      onChange={(e) => setStorageFlags((p) => ({ ...p, [key]: e.target.checked }))}
                      style={{ width: "auto" }}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                Ces conditions sont enregistrées et visibles sur la fiche du dépôt.
              </p>
            </div>
          )}

          {tab === "localisation" && (
            <DepotLocationTab
              active={tab === "localisation"}
              latitude={form.latitude}
              longitude={form.longitude}
              onCoordsChange={(lat, lng) => setForm((p) => ({ ...p, latitude: lat, longitude: lng }))}
              onSearchError={(msg) => onToast?.(msg, "error")}
            />
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid #2d3148",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={goBack}
            disabled={tabIndex === 0}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              background: "transparent",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 8,
              cursor: tabIndex === 0 ? "not-allowed" : "pointer",
              color: tabIndex === 0 ? "#4b5563" : "var(--color-text-secondary)",
              opacity: tabIndex === 0 ? 0.5 : 1,
            }}
          >
            ← Retour
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                background: "transparent",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--color-text-secondary)",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={saving || !isValid}
              onClick={submit}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 500,
                background: saving || !isValid ? "rgba(124,58,237,.4)" : "linear-gradient(135deg,#7c3aed,#8b5cf6)",
                border: "none",
                borderRadius: 8,
                cursor: saving || !isValid ? "not-allowed" : "pointer",
                color: "white",
              }}
            >
              {saving ? "Enregistrement…" : isEdit ? "Enregistrer →" : "Créer le dépôt →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
