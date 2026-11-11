import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import api, { getApiOrigin } from "../../services/api";
import ModePaiementSelector from "../ui/ModePaiementSelector";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { reglementSchema } from "../../validation";
import {
  getModeConfig,
  validateModeChamps,
  buildReglementApiPayload,
  getReglementDetailLines,
} from "../../constants/modesPaiementConfig";
import { labelClass, inputClass, btnSecondary } from "../forms/formStyles";
import { useToast } from "../../hooks/useToast";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3 });
}

function justificatifHref(url) {
  if (!url) return null;
  if (String(url).startsWith("http")) return url;
  const path = String(url).startsWith("/") ? url : `/${url}`;
  const origin = getApiOrigin?.() || "";
  return origin ? `${origin}${path}` : path;
}

export default function ReglementModalBase({ type, doc, onClose, onSuccess }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isAchat = type === "achat";

  const [reglements, setReglements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("ajouter");

  const [form, setForm] = useState({
    montant: "",
    mode: "ESPECES",
    datePayment: todayISO(),
    commentaire: "",
  });
  const [champsSupValues, setChampsSupValues] = useState({});
  const [pieceJointe, setPieceJointe] = useState(null);

  const values = useMemo(
    () => ({
      montant: form.montant,
      mode: form.mode,
      datePayment: form.datePayment,
      commentaire: form.commentaire,
    }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError } = useFormValidation(
    reglementSchema,
    values
  );

  const apiBase = isAchat ? `reglements/achats/${doc.id}` : `reglements/ventes/${doc.id}`;
  const queryKey = isAchat ? "achats" : "ventes";

  useEffect(() => {
    setLoading(true);
    api
      .get(apiBase)
      .then((res) => setReglements(Array.isArray(res.data) ? res.data : res.data?.data || []))
      .catch(() => setReglements([]))
      .finally(() => setLoading(false));
  }, [apiBase]);

  const totalTTC = parseFloat(doc.totalTTC) || 0;
  const totalRegle = reglements.reduce((s, r) => s + parseFloat(r.montant || 0), 0);
  const reste = Math.max(0, totalTTC - totalRegle);
  const pct = totalTTC > 0 ? Math.min(100, (totalRegle / totalTTC) * 100) : 0;
  const modeConfig = getModeConfig(form.mode);
  const tierName = isAchat ? doc.fournisseur?.nom : doc.client?.nom;
  const accent = isAchat ? "#7c3aed" : "#1D9E75";

  const montantNum = parseFloat(form.montant) || 0;

  async function handleSubmit() {
    setError(null);
    if (!validate()) return;
    if (montantNum > reste + 0.001) {
      setError(`Maximum : ${fmt(reste)} TND`);
      return;
    }
    const modeErr = validateModeChamps(form.mode, champsSupValues);
    if (modeErr) {
      setError(modeErr);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildReglementApiPayload({
        montant: montantNum,
        mode: form.mode,
        datePayment: form.datePayment,
        commentaire: form.commentaire,
        champsSupValues,
      });

      if (pieceJointe) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v != null && v !== "") fd.append(k, String(v));
        });
        fd.append("pieceJointe", pieceJointe);
        await api.post(apiBase, fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await api.post(apiBase, payload);
      }
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: [`${queryKey}-stats`] });
      toast.success(isAchat ? "Règlement enregistré" : "Encaissement enregistré");
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  const stop = (e) => e.stopPropagation();

  const content = (
    <div className="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 z-0 bg-black/65 backdrop-blur-[3px]"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reglement-modal-title"
        className="modal-panel pointer-events-auto relative z-[1] flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl"
        onClick={stop}
        onMouseDown={stop}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
              style={{ background: isAchat ? "rgba(124,58,237,0.12)" : "rgba(29,158,117,0.12)" }}
            >
              <i
                className="ti ti-cash text-lg"
                style={{ color: accent }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 id="reglement-modal-title" className="text-[15px] font-medium text-[var(--text-primary)]">
                {isAchat ? "Règlement achat" : "Encaissement client"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {doc.reference}
                {tierName ? ` · ${tierName}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onClose();
            }}
            className="flex items-center rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            aria-label="Fermer"
          >
            <i className="ti ti-x text-xl" aria-hidden="true" />
          </button>
        </div>

        {/* Progression */}
        <div className="shrink-0 bg-black/15 px-5 py-3">
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            {[
              { label: "Facture TTC", val: totalTTC, color: "var(--text-secondary)" },
              { label: isAchat ? "Réglé" : "Encaissé", val: totalRegle, color: "#1D9E75" },
              {
                label: "Reste",
                val: reste,
                color: reste > 0 ? "#E24B4A" : "#1D9E75",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-center"
              >
                <div className="mb-0.5 text-[11px] text-[var(--text-muted)]">{item.label}</div>
                <div className="text-[13px] font-medium" style={{ color: item.color }}>
                  {fmt(item.val)} TND
                </div>
              </div>
            ))}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
            <div
              className="progress-bar-fill h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: pct >= 100 ? "#1D9E75" : accent,
              }}
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-[var(--text-muted)]">{pct.toFixed(0)}% {isAchat ? "réglé" : "encaissé"}</p>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-[var(--border-default)]">
          {[
            { key: "ajouter", label: isAchat ? "Nouveau règlement" : "Nouvel encaissement", icon: "ti-plus" },
            { key: "historique", label: `Historique (${reglements.length})`, icon: "ti-history" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[13px] transition-colors"
              style={{
                borderBottomColor: activeTab === tab.key ? accent : "transparent",
                color: activeTab === tab.key ? accent : "var(--text-muted)",
                fontWeight: activeTab === tab.key ? 500 : 400,
              }}
            >
              <i className={`ti ${tab.icon} text-sm`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {activeTab === "ajouter" && (
            reste > 0 ? (
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className={labelClass}>{isAchat ? "Montant à régler *" : "Montant à encaisser *"}</label>
                  <div className="mt-1.5 flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0.001"
                        max={reste}
                        step="0.001"
                        autoFocus
                        value={form.montant}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, montant: e.target.value }));
                          clearError("montant");
                          setError(null);
                        }}
                        onBlur={() => validateField("montant")}
                        placeholder={`Max : ${reste.toFixed(3)}`}
                        className={`${inputClass} pr-12`}
                        style={errors.montant ? inputErrorStyle : undefined}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                        TND
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, montant: reste.toFixed(3) }));
                        clearError("montant");
                      }}
                      className="shrink-0 rounded-lg border px-3.5 text-xs whitespace-nowrap"
                      style={{
                        background: isAchat ? "rgba(124,58,237,0.1)" : "rgba(29,158,117,0.1)",
                        borderColor: isAchat ? "rgba(124,58,237,0.3)" : "rgba(29,158,117,0.3)",
                        color: isAchat ? "#a78bfa" : "#1D9E75",
                      }}
                    >
                      {isAchat ? "Tout régler" : "Tout encaisser"}
                    </button>
                  </div>
                  <FormFieldError message={errors.montant} />
                  {form.montant ? (
                    <p
                      className="mt-1.5 text-[11px]"
                      style={{ color: montantNum > reste ? "#E24B4A" : "#1D9E75" }}
                    >
                      {montantNum > reste
                        ? `Dépasse le reste (${fmt(reste)} TND)`
                        : `Reste après ce règlement : ${fmt(reste - montantNum)} TND`}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className={labelClass}>Mode de paiement *</label>
                  <div className="mt-1.5">
                    <ModePaiementSelector
                      value={form.mode}
                      onChange={(mode) => {
                        setForm((f) => ({ ...f, mode }));
                        setChampsSupValues({});
                        setError(null);
                      }}
                      champsValues={champsSupValues}
                      onChampsChange={setChampsSupValues}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>
                      {form.mode === "EFFET" && champsSupValues.dateEcheance
                        ? "Date du règlement"
                        : form.mode === "EFFET"
                          ? "Date du règlement *"
                          : "Date du règlement *"}
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      value={form.datePayment}
                      onChange={(e) => setForm((f) => ({ ...f, datePayment: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Commentaire</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.commentaire}
                      onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                      placeholder="Note interne..."
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Justificatif (PDF / JPG, optionnel)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    className={`${inputClass} mt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--bg-hover)] file:px-2 file:py-1 file:text-xs file:text-[var(--text-secondary)]`}
                    onChange={(e) => setPieceJointe(e.target.files?.[0] || null)}
                  />
                  {pieceJointe ? (
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{pieceJointe.name}</p>
                  ) : null}
                </div>

                {error ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[rgba(226,75,74,0.3)] bg-[rgba(226,75,74,0.1)] px-3 py-2.5 text-xs text-[#E24B4A]">
                    <i className="ti ti-alert-triangle" aria-hidden="true" />
                    {error}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-8 text-center text-[#1D9E75]">
                <i className="ti ti-circle-check mb-2 block text-5xl" aria-hidden="true" />
                <p className="text-base font-medium">
                  {isAchat ? "Achat entièrement réglé" : "Vente entièrement encaissée"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {reglements.length} règlement(s) enregistré(s)
                </p>
              </div>
            )
          )}

          {activeTab === "historique" && (
            <div>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="mb-2 h-[60px] animate-pulse rounded-lg bg-[var(--bg-card-hover)]"
                  />
                ))
              ) : reglements.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-muted)]">
                  <i className="ti ti-history mb-2 block text-4xl opacity-30" aria-hidden="true" />
                  <p className="text-sm">Aucun règlement enregistré</p>
                </div>
              ) : (
                reglements.map((r, i) => {
                  const mc = getModeConfig(r.mode);
                  const details = getReglementDetailLines(r);
                  return (
                    <div
                      key={r.id || i}
                      className="reglement-history-row flex items-center gap-3 border-b border-[var(--border-default)] py-3 last:border-0"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                        style={{ background: mc.bg }}
                      >
                        <i className={`ti ${mc.icon} text-lg`} style={{ color: mc.color }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">
                          {mc.label}
                          {details.length ? (
                            <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                              · {details.join(" · ")}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                          {new Date(r.datePayment).toLocaleDateString("fr-FR")}
                          {r.banque ? ` · ${r.banque}` : ""}
                          {r.commentaire ? ` · ${r.commentaire}` : ""}
                        </p>
                        {r.pieceJointeUrl ? (
                          <a
                            href={justificatifHref(r.pieceJointeUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-link)] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            📎 Voir le justificatif
                          </a>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-sm font-medium text-[#1D9E75]">
                        +{fmt(r.montant)} TND
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === "ajouter" && reste > 0 && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-3.5">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
              style={{
                background: modeConfig.bg,
                borderColor: modeConfig.border,
                color: modeConfig.color,
              }}
            >
              <i className={`ti ${modeConfig.icon} text-xs`} aria-hidden="true" />
              {modeConfig.badge}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={btnSecondary}>
                Annuler
              </button>
              <button
                type="button"
                disabled={submitting || !isValid}
                onClick={handleSubmit}
                className="inline-flex min-w-[160px] items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: submitting || !isValid ? `${accent}66` : accent }}
              >
                {submitting ? (
                  <>
                    <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <i className="ti ti-check" aria-hidden="true" />
                    {isAchat ? "Enregistrer le règlement" : "Enregistrer l'encaissement"}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
