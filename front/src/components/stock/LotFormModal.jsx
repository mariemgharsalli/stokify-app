import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Loader2,
  Package,
  Plus,
  Warehouse,
  X,
} from "lucide-react";
import SearchableSelect from "../ui/SearchableSelect";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import SuggestedCodeInput, {
  isDuplicateCodeError,
  getDuplicateCodeMessage,
  normalizeCodeClient,
} from "../forms/SuggestedCodeInput";
import { useFormValidation } from "../../hooks/useFormValidation";
import { lotSchema } from "../../validation";
import api, { getAxiosErrorMessage } from "../../services/api";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../utils/brandStyles";
import { STATUT_CFG, daysLeft } from "../../pages/stock/lotsUi";

const inputCls =
  "w-full rounded-xl border bg-[rgba(15,23,42,0.65)] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50";
const border = { borderColor: "rgba(56,189,248,0.18)" };

function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/50">
        {children}
      </label>
      {hint || null}
    </div>
  );
}

function DlcHint({ dateExpiration }) {
  const days = daysLeft(dateExpiration);
  if (days === null) return null;
  if (days < 0)
    return <span className="text-[11px] font-semibold text-red-400">Expiré il y a {Math.abs(days)}j</span>;
  if (days === 0)
    return <span className="text-[11px] font-semibold text-red-400">Expire aujourd&apos;hui</span>;
  if (days <= 7)
    return (
      <span className="inline-flex rounded-md border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-[11px] font-semibold text-red-300">
        {days}j restants
      </span>
    );
  if (days <= 30)
    return (
      <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-300">
        {days}j restants
      </span>
    );
  return <span className="text-[11px] text-sky-200/45">{days}j restants</span>;
}

/**
 * Modal création / édition lot — glass navy, motion (style inventaire / détail).
 */
export default function LotFormModal({ lot, articles = [], depots = [], onClose, onSaved }) {
  const isEdit = !!lot?.id;
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();

  const [form, setForm] = useState(
    isEdit
      ? {
          numero: lot.numero || "",
          articleId: String(lot.articleId),
          depotId: String(lot.depotId),
          quantiteInitiale: lot.quantiteInitiale || "",
          dateFabrication: lot.dateFabrication ? lot.dateFabrication.slice(0, 10) : "",
          dateExpiration: lot.dateExpiration ? lot.dateExpiration.slice(0, 10) : "",
          statut: lot.statut || "ACTIF",
        }
      : {
          numero: "",
          articleId: "",
          depotId: "",
          quantiteInitiale: "",
          dateFabrication: "",
          dateExpiration: "",
          statut: "ACTIF",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [isManualNumero, setIsManualNumero] = useState(false);
  const [fetchingNumero, setFetchingNumero] = useState(false);

  const values = useMemo(
    () => ({
      // numéro auto accepté : placeholder pour schéma si vide à la création
      numero: form.numero?.trim() || (isEdit ? lot?.numero || "AUTO" : "AUTO"),
      articleId: form.articleId,
      depotId: form.depotId,
      quantiteInitiale: form.quantiteInitiale,
      dateFabrication: form.dateFabrication,
      dateExpiration: form.dateExpiration,
      statut: form.statut,
    }),
    [form, isEdit, lot?.numero]
  );
  const { errors, validate, validateField, isValid, clearError } = useFormValidation(lotSchema, values);

  async function loadSuggestedNumero(articleId) {
    if (!articleId || isEdit) return;
    setFetchingNumero(true);
    try {
      const r = await api.get("lots/generate-numero", { params: { articleId } });
      if (!isManualNumero) {
        setForm((p) => ({ ...p, numero: r.data?.numero || "" }));
      }
    } catch {
      /* preview optionnelle */
    } finally {
      setFetchingNumero(false);
    }
  }

  useEffect(() => {
    if (!isEdit && form.articleId) {
      loadSuggestedNumero(form.articleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.articleId, isEdit]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function regenerateNumero() {
    if (!form.articleId) return;
    setIsManualNumero(false);
    setFetchingNumero(true);
    try {
      const r = await api.get("lots/generate-numero", { params: { articleId: form.articleId } });
      setForm((p) => ({ ...p, numero: r.data?.numero || "" }));
    } catch {
      /* preview optionnelle */
    } finally {
      setFetchingNumero(false);
    }
  }

  async function save() {
    if (!isEdit && !validate()) {
      setError("Corrigez les champs obligatoires");
      return;
    }
    if (isEdit) {
      // dates seulement — revalider cohérence fab/exp
      if (form.dateFabrication && form.dateExpiration) {
        const fab = new Date(form.dateFabrication);
        const exp = new Date(form.dateExpiration);
        if (!Number.isNaN(fab.getTime()) && !Number.isNaN(exp.getTime()) && exp <= fab) {
          setError("La date d'expiration doit être postérieure à la fabrication");
          return;
        }
      }
    }
    setSaving(true);
    setError("");
    setCodeError("");
    try {
      if (isEdit) {
        await api.patch(`lots/${lot.id}`, {
          statut: form.statut,
          dateFabrication: form.dateFabrication || undefined,
          dateExpiration: form.dateExpiration || undefined,
        });
      } else {
        const payload = {
          articleId: Number(form.articleId),
          depotId: Number(form.depotId),
          quantiteInitiale: Number(form.quantiteInitiale),
          dateFabrication: form.dateFabrication || undefined,
          dateExpiration: form.dateExpiration || undefined,
          statut: form.statut,
        };
        if (form.numero?.trim()) payload.numero = normalizeCodeClient(form.numero);
        await api.post("lots", payload);
      }
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.invalidateQueries({ queryKey: ["lots-expiring"] });
      qc.invalidateQueries({ queryKey: ["lots-alert"] });
      onSaved();
      onClose();
    } catch (e) {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
      } else {
        setError(getAxiosErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="lot-form-root"
        className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={onClose}
        role="presentation"
      >
        <div
          className="absolute inset-0"
          style={{ background: "rgba(6,10,20,0.72)", backdropFilter: "blur(8px)" }}
          aria-hidden
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lot-form-title"
          className="relative z-[1] flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background:
              "linear-gradient(165deg, rgba(17,34,66,0.98) 0%, rgba(12,22,40,0.98) 55%, rgba(10,18,32,0.99) 100%)",
            borderColor: "rgba(56,189,248,0.22)",
            boxShadow:
              "0 24px 64px -16px rgba(0,0,0,0.65), inset 0 1px 0 rgba(125,211,252,0.12)",
          }}
          onClick={(e) => e.stopPropagation()}
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(125,211,252,0.5), transparent)",
            }}
            aria-hidden
          />

          {/* Header */}
          <div
            className="relative shrink-0 border-b px-5 py-4"
            style={{ borderColor: "rgba(56,189,248,0.14)" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 55% 80% at 0% 0%, rgba(55,138,221,0.22), transparent 55%)",
              }}
              aria-hidden
            />
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "linear-gradient(145deg, rgba(55,138,221,0.4), rgba(14,165,233,0.2))",
                    color: "#7dd3fc",
                    border: "1px solid rgba(96,165,250,0.35)",
                    boxShadow: "0 8px 20px -8px rgba(55,138,221,0.55)",
                  }}
                >
                  {isEdit ? <Package className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/60">
                    Traçabilité FIFO / FEFO
                  </p>
                  <h2 id="lot-form-title" className="font-display text-lg font-bold text-white">
                    {isEdit ? `Modifier — ${lot.numero}` : "Nouveau lot"}
                  </h2>
                  <p className="text-xs text-sky-200/45">
                    {isEdit ? lot.article?.libelle || "Édition du lot" : "Créer un lot traçable en stock"}
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-400/20 text-sky-200/70"
                aria-label="Fermer"
                whileHover={reduceMotion ? undefined : { scale: 1.05, backgroundColor: "rgba(255,255,255,0.06)" }}
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <motion.div
              className="grid grid-cols-2 gap-3"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="col-span-2 sm:col-span-1">
                <FieldLabel
                  hint={
                    !isEdit ? (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          isManualNumero
                            ? "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                            : "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {isManualNumero ? "Manuel" : "Auto"}
                      </span>
                    ) : null
                  }
                >
                  N° lot {!isEdit && "(auto si vide)"}
                </FieldLabel>
                <SuggestedCodeInput
                  value={form.numero}
                  locked={isEdit}
                  codeError={codeError}
                  onClearError={() => setCodeError("")}
                  onRegenerate={regenerateNumero}
                  onChange={(v) => {
                    setIsManualNumero(true);
                    setForm((p) => ({ ...p, numero: v }));
                    clearError("numero");
                  }}
                  placeholder="LOT-ART001-20260613-001"
                  inputClassName={`${inputCls} flex-1 font-mono`}
                  disabled={fetchingNumero}
                />
                <FormFieldError message={errors.numero} />
              </div>
              <div>
                <FieldLabel>Qté initiale *</FieldLabel>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  disabled={isEdit}
                  value={form.quantiteInitiale}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, quantiteInitiale: e.target.value }));
                    clearError("quantiteInitiale");
                  }}
                  onBlur={() => validateField("quantiteInitiale")}
                  className={`${inputCls} text-center font-semibold tabular-nums`}
                  style={{ ...border, ...(errors.quantiteInitiale ? inputErrorStyle : {}) }}
                />
                <FormFieldError message={errors.quantiteInitiale} />
              </div>
            </motion.div>

            {!isEdit && (
              <motion.div
                className="space-y-3"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div>
                  <FieldLabel>
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-3 w-3 text-sky-400" />
                      Article *
                    </span>
                  </FieldLabel>
                  <SearchableSelect
                    value={form.articleId}
                    onChange={(v) => {
                      setForm((p) => ({ ...p, articleId: v }));
                      clearError("articleId");
                    }}
                    options={articles.map((a) => ({
                      value: String(a.id),
                      label: `${a.code} — ${a.libelle}`,
                    }))}
                    placeholder="Choisir un article"
                    allowClear={false}
                  />
                  <FormFieldError message={errors.articleId} />
                </div>
                <div>
                  <FieldLabel>
                    <span className="inline-flex items-center gap-1.5">
                      <Warehouse className="h-3 w-3 text-cyan-400" />
                      Dépôt *
                    </span>
                  </FieldLabel>
                  <SearchableSelect
                    value={form.depotId}
                    onChange={(v) => {
                      setForm((p) => ({ ...p, depotId: v }));
                      clearError("depotId");
                    }}
                    options={depots.map((d) => ({
                      value: String(d.id),
                      label: `${d.code} — ${d.libelle || d.nom}`,
                    }))}
                    placeholder="Choisir un dépôt"
                    allowClear={false}
                  />
                  <FormFieldError message={errors.depotId} />
                </div>
              </motion.div>
            )}

            <motion.div
              className="grid grid-cols-2 gap-3"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              <div>
                <FieldLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-sky-400" />
                    Fabrication
                  </span>
                </FieldLabel>
                <input
                  type="date"
                  value={form.dateFabrication}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, dateFabrication: e.target.value }));
                    clearError("dateFabrication");
                    clearError("dateExpiration");
                  }}
                  onBlur={() => validateField("dateFabrication")}
                  className={inputCls}
                  style={border}
                />
              </div>
              <div>
                <FieldLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-amber-400" />
                    DLC
                  </span>
                </FieldLabel>
                <input
                  type="date"
                  value={form.dateExpiration}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, dateExpiration: e.target.value }));
                    clearError("dateExpiration");
                  }}
                  onBlur={() => validateField("dateExpiration")}
                  className={inputCls}
                  style={{
                    ...border,
                    ...(errors.dateExpiration ? inputErrorStyle : {}),
                    ...(form.dateExpiration &&
                    daysLeft(form.dateExpiration) !== null &&
                    daysLeft(form.dateExpiration) <= 30
                      ? { borderColor: "rgba(245,158,11,0.55)" }
                      : {}),
                  }}
                />
                <FormFieldError message={errors.dateExpiration} />
                {form.dateExpiration ? (
                  <div className="mt-1.5">
                    <DlcHint dateExpiration={form.dateExpiration} />
                  </div>
                ) : null}
              </div>
            </motion.div>

            {isEdit && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
              >
                <FieldLabel>Statut</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["ACTIF", "EPUISE", "EXPIRE", "DESACTIVE"].map((s) => {
                    const cfg = STATUT_CFG[s];
                    const sel = form.statut === s;
                    return (
                      <motion.button
                        key={s}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, statut: s }))}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          sel ? cfg.cls : "border-sky-400/15 text-sky-200/50 hover:bg-white/5"
                        }`}
                        whileHover={reduceMotion ? undefined : { y: -1 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      >
                        {cfg.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {error ? (
                <motion.p
                  className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300"
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div
            className="flex shrink-0 justify-end gap-2 border-t px-5 py-4"
            style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(8,15,28,0.55)" }}
          >
            <motion.button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-sky-400/20 px-4 py-2.5 text-sm font-medium text-sky-100/80"
              whileHover={reduceMotion ? undefined : { y: -1, backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              Annuler
            </motion.button>
            <motion.button
              type="button"
              onClick={save}
              disabled={saving || (!isEdit && !isValid)}
              className={`${PRIMARY_BTN_CLASSES} disabled:opacity-50`}
              style={{
                ...primaryButtonStyle,
                boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)",
              }}
              whileHover={reduceMotion || saving ? undefined : { y: -2, scale: 1.02 }}
              whileTap={reduceMotion || saving ? undefined : { scale: 0.97 }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Enregistrer" : "Créer le lot"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
