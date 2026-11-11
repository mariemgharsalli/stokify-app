import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import ModePaiementSelector, { MODES_CONFIG } from "../ui/ModePaiementSelector";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { reglementSchema } from "../../validation";
import { getModeConfig, validateModeChamps, buildReglementApiPayload, getReglementDetailLines } from "../../constants/modesPaiementConfig";
import { useToast } from "../../hooks/useToast";

function todayISO() {
  return new Date().toISOString().split(0, 10);
}

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3 });
}

/** Modal règlement réel — type: "vente" | "achat", document: vente ou achat */
export default function ModalReglement({ type, document: doc, onClose, onSuccess }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isVente = type === "vente";

  const [reglements, setReglements] = useState([]);
  const [loadingRegl, setLoadingRegl] = useState(true);
  const [activeTab, setActiveTab] = useState("nouveau");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [form, setForm] = useState({
    montant: "",
    mode: "ESPECES",
    dateReglement: todayISO(),
    commentaire: "",
  });
  const [champsSupValues, setChampsSupValues] = useState({});

  const values = useMemo(
    () => ({
      montant: form.montant,
      mode: form.mode,
      datePayment: form.dateReglement,
      commentaire: form.commentaire,
    }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError } = useFormValidation(
    reglementSchema,
    values
  );

  const endpoint = isVente ? `reglements/ventes/${doc.id}` : `reglements/achats/${doc.id}`;
  const queryKey = isVente ? "ventes" : "achats";

  const themeColor = isVente ? "#1D9E75" : "#378ADD";
  const themeBg = isVente ? "rgba(29,158,117,0.1)" : "rgba(55,138,221,0.1)";
  const actionLabel = isVente ? "Encaisser" : "Régler";
  const docName = isVente ? doc.client?.nom : doc.fournisseur?.nom;

  useEffect(() => {
    setLoadingRegl(true);
    api
      .get(endpoint)
      .then((res) => setReglements(Array.isArray(res.data) ? res.data : res.data?.data || []))
      .catch(() => setReglements([]))
      .finally(() => setLoadingRegl(false));
  }, [endpoint]);

  const totalDoc = parseFloat(doc.totalTTC) || 0;
  const totalDejaRegle = reglements.reduce((s, r) => s + parseFloat(r.montant || 0), 0);
  const resteARegler = Math.max(0, totalDoc - totalDejaRegle);
  const pct = totalDoc > 0 ? Math.min(100, (totalDejaRegle / totalDoc) * 100) : 0;
  const modeConfig = getModeConfig(form.mode);
  const montantNum = parseFloat(form.montant) || 0;

  async function handleSubmit() {
    setError(null);
    setSuccessMsg(null);
    if (!validate()) return;
    if (montantNum > resteARegler + 0.001) {
      setError(`Montant trop élevé. Reste : ${fmt(resteARegler)} TND`);
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
        datePayment: form.dateReglement,
        commentaire: form.commentaire,
        champsSupValues,
      });
      await api.post(endpoint, payload);
      setSuccessMsg("Règlement enregistré avec succès !");
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: [`${queryKey}-stats`] });
      qc.invalidateQueries({ queryKey: ["reglements-global"] });
      toast.success(isVente ? "Encaissement enregistré" : "Règlement enregistré");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 900);
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  const stop = (e) => e.stopPropagation();

  const content = (
    <div
      className="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop — seul le fond ferme la modal */}
      <div
        className="absolute inset-0 z-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panneau modal — bloque la propagation vers le backdrop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reglement-modal-title"
        className="modal-panel pointer-events-auto relative z-[1] flex max-h-[88vh] w-full max-w-[580px] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl"
        onClick={stop}
        onMouseDown={stop}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: themeBg }}>
              <i className="ti ti-cash text-xl" style={{ color: themeColor }} aria-hidden="true" />
            </div>
            <div>
              <h2 id="reglement-modal-title" className="text-base font-medium text-[var(--text-primary)]">
                {isVente ? "Encaissement client" : "Paiement fournisseur"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {doc.reference} · {docName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            aria-label="Fermer"
          >
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="shrink-0 bg-black/15 px-5 py-3.5">
          <div className="mb-2.5 grid grid-cols-3 gap-2">
            {[
              { label: isVente ? "Facture TTC" : "Montant TTC", val: totalDoc, color: "var(--text-primary)" },
              { label: isVente ? "Encaissé" : "Déjà réglé", val: totalDejaRegle, color: themeColor },
              { label: "Reste", val: resteARegler, color: resteARegler > 0 ? "#E24B4A" : themeColor },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{item.label}</div>
                <div className="text-sm font-medium tabular-nums" style={{ color: item.color }}>
                  {fmt(item.val)} TND
                </div>
              </div>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded bg-[var(--border-default)]">
            <div className="progress-bar-fill h-full rounded" style={{ width: `${pct}%`, background: pct >= 100 ? "#1D9E75" : themeColor }} />
          </div>
        </div>

        <div className="flex shrink-0 border-b border-[var(--border-default)]">
          {[
            { key: "nouveau", label: `${actionLabel} maintenant`, icon: "ti-plus" },
            { key: "historique", label: `Historique (${reglements.length})`, icon: "ti-history" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={(e) => {
                stop(e);
                setActiveTab(tab.key);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-[13px] transition-colors"
              style={{
                borderBottomColor: activeTab === tab.key ? themeColor : "transparent",
                color: activeTab === tab.key ? themeColor : "var(--text-muted)",
                fontWeight: activeTab === tab.key ? 500 : 400,
              }}
            >
              <i className={`ti ${tab.icon}`} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" onClick={stop} onMouseDown={stop}>
          {activeTab === "nouveau" &&
            (resteARegler > 0 ? (
              <div className="flex flex-col gap-4">
                {successMsg ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[rgba(29,158,117,0.3)] bg-[rgba(29,158,117,0.12)] px-3 py-2.5 text-sm text-[#1D9E75]">
                    <i className="ti ti-circle-check" aria-hidden="true" />
                    {successMsg}
                  </div>
                ) : null}

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Montant *</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        autoFocus
                        value={form.montant}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, montant: e.target.value }));
                          clearError("montant");
                          setError(null);
                        }}
                        onBlur={() => validateField("montant")}
                        placeholder={`Max : ${resteARegler.toFixed(3)}`}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pr-12 pl-3.5 text-[15px] font-medium text-[var(--text-primary)] outline-none"
                        style={errors.montant ? inputErrorStyle : undefined}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">TND</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, montant: resteARegler.toFixed(3) }))}
                      className="shrink-0 rounded-lg border px-4 text-xs font-medium whitespace-nowrap"
                      style={{ background: themeBg, borderColor: `${themeColor}50`, color: themeColor }}
                    >
                      Tout {actionLabel.toLowerCase()}
                    </button>
                  </div>
                  <FormFieldError message={errors.montant} />
                  {form.montant && montantNum > 0 ? (
                    <p className="mt-1.5 text-[11px]" style={{ color: montantNum > resteARegler ? "#E24B4A" : "#1D9E75" }}>
                      {montantNum > resteARegler ? "Dépasse le reste à régler" : `Reste après : ${fmt(resteARegler - montantNum)} TND`}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Mode de paiement *</label>
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Date du règlement *</label>
                    <input
                      type="date"
                      value={form.dateReglement}
                      onChange={(e) => setForm((f) => ({ ...f, dateReglement: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Commentaire</label>
                    <input
                      type="text"
                      value={form.commentaire}
                      onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                      placeholder="Note interne..."
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="flex gap-2 rounded-lg border border-[rgba(226,75,74,0.3)] bg-[rgba(226,75,74,0.1)] px-3 py-2.5 text-xs text-[#E24B4A]">
                    <i className="ti ti-alert-triangle shrink-0" aria-hidden="true" />
                    {error}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgba(29,158,117,0.12)]">
                  <i className="ti ti-circle-check text-4xl text-[#1D9E75]" aria-hidden="true" />
                </div>
                <p className="text-lg font-medium text-[#1D9E75]">
                  {isVente ? "Vente entièrement encaissée" : "Achat entièrement réglé"}
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {reglements.length} règlement(s) · {fmt(totalDoc)} TND
                </p>
              </div>
            ))}

          {activeTab === "historique" && (
            <div>
              {loadingRegl ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="mb-2 h-14 animate-pulse rounded-lg bg-[var(--bg-card-hover)]" />
                ))
              ) : reglements.length === 0 ? (
                <div className="py-8 text-center text-[var(--text-muted)]">
                  <i className="ti ti-history mb-2 block text-4xl opacity-30" aria-hidden="true" />
                  <p className="text-sm">Aucun règlement enregistré</p>
                </div>
              ) : (
                <>
                  {reglements.map((r, i) => {
                    const mc = MODES_CONFIG[r.mode] ? getModeConfig(r.mode) : getModeConfig("AUTRE");
                    const details = getReglementDetailLines(r);
                    return (
                      <div key={r.id || i} className="reglement-history-row flex items-center gap-3 border-b border-[var(--border-default)] py-3 last:border-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: mc.bg }}>
                          <i className={`ti ${mc.icon} text-lg`} style={{ color: mc.color }} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[var(--text-primary)]">
                            {mc.label}
                            {details.length ? <span className="ml-1.5 font-normal text-[var(--text-muted)]">· {details.join(" · ")}</span> : null}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                            {new Date(r.datePayment).toLocaleDateString("fr-FR")}
                            {r.banque ? ` · ${r.banque}` : ""}
                            {r.commentaire ? ` · ${r.commentaire}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[15px] font-medium" style={{ color: themeColor }}>
                          {fmt(r.montant)} TND
                        </span>
                      </div>
                    );
                  })}
                  <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: `${themeColor}30` }}>
                    <span className="text-xs text-[var(--text-muted)]">Total réglé</span>
                    <span className="text-base font-medium" style={{ color: themeColor }}>
                      {fmt(totalDejaRegle)} TND
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {activeTab === "nouveau" && resteARegler > 0 && !successMsg ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-3.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-medium" style={{ background: modeConfig.bg, borderColor: modeConfig.border, color: modeConfig.color }}>
              <i className={`ti ${modeConfig.icon} text-xs`} aria-hidden="true" />
              {modeConfig.badge}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onClose();
                }}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={submitting || !isValid}
                onClick={(e) => {
                  stop(e);
                  handleSubmit();
                }}
                className="inline-flex min-w-[180px] items-center justify-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: submitting || !isValid ? `${themeColor}99` : themeColor }}
              >
                {submitting ? (
                  <>
                    <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <i className="ti ti-check" aria-hidden="true" />
                    Enregistrer le règlement
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  /* Hors #stokify-overlay-root (pointer-events:none) — comme CommerceFormDrawer */
  return createPortal(content, document.body);
}
