import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Hash,
  Search,
  CheckCircle,
  ArrowRightLeft,
  Upload,
  Loader2,
  X,
  Check,
  XCircle,
  FileSpreadsheet,
  ClipboardList,
  Archive,
  LayoutGrid,
  List,
  Package,
  Warehouse,
} from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import { GlassAside } from "../../components/ui/GlassPageHeader";
import SearchableSelect from "../../components/ui/SearchableSelect";
import Modal, { btnPrimary, btnSecondary } from "../../components/ui/Modal";
import SerieCard, { SerieCardSkeleton } from "../../components/stock/SerieCard";
import StockPagination from "../../components/stock/StockPagination";
import api, { getAxiosErrorMessage } from "../../services/api";
import SuggestedCodeInput, {
  isDuplicateCodeError,
  getDuplicateCodeMessage,
  normalizeCodeClient,
} from "../../components/forms/SuggestedCodeInput";
import FormFieldError from "../../components/ui/FormFieldError";
import { numeroSerieSchema } from "../../validation";
import { useFormValidation } from "../../hooks/useFormValidation";
import { exportCsvFromRows } from "../../utils/exportHelpers";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import {
  PRIMARY_BTN_CLASSES,
  PRIMARY_BTN_SM_CLASSES,
  primaryButtonStyle,
  primaryOptionHighlightStyle,
  primaryOptionSelectedStyle,
  STOKIFY_BLUE,
  STOKIFY_BLUE_RGB,
} from "../../utils/brandStyles";
import SerieKpiCards from "./components/SerieKpiCards";
import SerieTable, { SERIE_STATUT_CFG } from "./components/SerieTable";

const SERIES_VIEW_KEY = "series-view-mode";

const INPUT_CN =
  "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#378ADD] focus:outline-none";

const FILTER_INPUT_CN =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent-500";

const STATUT_FILTERS = ["", "DISPONIBLE", "VENDU", "RETOURNE", "DEFECTUEUX", "DESACTIVE"];
const EDIT_STATUTS = ["DISPONIBLE", "VENDU", "RETOURNE", "DEFECTUEUX"];

function asItems(d) {
  if (Array.isArray(d)) return d;
  return d?.items || [];
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function DeactivateSerieModal({ serie, onClose, onConfirm, loading }) {
  return (
    <Modal
      title={`Désactiver ${serie?.numero || ""}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={loading}>
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`${btnPrimary} !bg-rose-600 hover:!bg-rose-500`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                …
              </>
            ) : (
              "Confirmer la désactivation"
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-hover)]/60 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
            <Archive className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">{serie?.numero}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{serie?.article?.libelle || "—"}</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Ce numéro sera archivé et n&apos;apparaîtra plus dans les sélections actives. L&apos;historique reste
          consultable et la désactivation est réversible.
        </p>
        {serie?.statut && serie.statut !== "DISPONIBLE" ? (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: "#EF9F2740", background: "#EF9F2712", color: "#BA7517" }}
          >
            ⚠ Statut actuel : {SERIE_STATUT_CFG[serie.statut]?.label || serie.statut}. À la réactivation, le
            numéro repassera en <strong>Disponible</strong>.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

const serieInputCls =
  "w-full rounded-xl border bg-[rgba(15,23,42,0.65)] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50";

function SerieFieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/50">{children}</label>
      {hint || null}
    </div>
  );
}

function SerieModal({ serie, articles, depots, onClose, onSaved }) {
  const isEdit = !!serie?.id;
  const [form, setForm] = useState(
    isEdit
      ? { statut: serie.statut || "DISPONIBLE" }
      : { numero: "", articleId: "", depotId: "", statut: "DISPONIBLE" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeFading, setCodeFading] = useState(false);
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();

  const { errors, validate, validateField, clearError } = useFormValidation(numeroSerieSchema, {
    numero: form.numero,
    articleId: form.articleId,
  });

  const fetchNextCode = useCallback(async (articleId) => {
    if (!articleId) return;
    setCodeFading(true);
    try {
      const { data } = await api.get("numeros-serie/next-code", { params: { articleId } });
      if (data?.numero) {
        setTimeout(() => {
          setForm((f) => ({ ...f, numero: data.numero }));
          setCodeFading(false);
        }, 75);
      } else {
        setCodeFading(false);
      }
    } catch {
      setCodeFading(false);
    }
  }, []);

  const regenerateCode = useCallback(
    () => fetchNextCode(form.articleId),
    [fetchNextCode, form.articleId]
  );

  useEffect(() => {
    if (isEdit || !form.articleId) return;
    fetchNextCode(form.articleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.articleId, isEdit]);

  async function save() {
    if (!isEdit && !validate()) return;
    setSaving(true);
    setError("");
    setCodeError("");
    try {
      if (isEdit) {
        await api.patch(`numeros-serie/${serie.id}`, { statut: form.statut });
      } else {
        await api.post("numeros-serie", {
          numero: normalizeCodeClient(form.numero),
          articleId: Number(form.articleId),
          depotId: form.depotId ? Number(form.depotId) : undefined,
          statut: form.statut,
        });
      }
      qc.invalidateQueries({ queryKey: ["numeros-serie"] });
      onSaved();
      onClose();
    } catch (e) {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
      }
      setError(getAxiosErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-0"
        style={{ background: "rgba(6,10,20,0.62)" }}
        aria-label="Fermer"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="serie-form-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background:
            "linear-gradient(165deg, #1a3358 0%, #152844 55%, #122033 100%)",
          borderColor: "rgba(125,211,252,0.35)",
          boxShadow: "0 24px 64px -16px rgba(0,0,0,0.65), inset 0 1px 0 rgba(125,211,252,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(125,211,252,0.5), transparent)" }}
            aria-hidden
          />

          <div className="relative shrink-0 border-b px-5 py-4" style={{ borderColor: "rgba(56,189,248,0.14)" }}>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 55% 80% at 0% 0%, rgba(55,138,221,0.22), transparent 55%)",
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
                  {isEdit ? <Hash className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/60">
                    Traçabilité unitaire
                  </p>
                  <h2 id="serie-form-title" className="font-display text-lg font-bold text-white">
                    {isEdit ? `Modifier — ${serie.numero}` : "Nouveau N° de série"}
                  </h2>
                  <p className="text-xs text-sky-200/45">
                    {isEdit ? serie.article?.libelle || "Édition du numéro" : "Un numéro = une unité traçable"}
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

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {!isEdit ? (
              <motion.div
                className="space-y-3"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <div>
                  <SerieFieldLabel
                    hint={
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        Auto
                      </span>
                    }
                  >
                    N° de série *
                  </SerieFieldLabel>
                  <SuggestedCodeInput
                    value={form.numero}
                    codeError={codeError}
                    onClearError={() => setCodeError("")}
                    onRegenerate={form.articleId ? regenerateCode : undefined}
                    onChange={(v) => {
                      setCodeError("");
                      clearError("numero");
                      setForm((p) => ({ ...p, numero: v }));
                    }}
                    onFieldBlur={() => validateField("numero")}
                    placeholder={form.articleId ? "SN-ART-0001" : "Choisissez d'abord un article"}
                    inputClassName={`${serieInputCls} font-mono transition-opacity duration-150 ${codeFading ? "opacity-30" : "opacity-100"}`}
                  />
                  <FormFieldError message={!codeError ? errors.numero : null} />
                  <p className="mt-1 text-[11px] text-sky-200/45">
                    {form.articleId
                      ? "Suggestion auto — modifiable avant enregistrement"
                      : "Sélectionnez un article pour générer un numéro"}
                  </p>
                </div>
                <div>
                  <SerieFieldLabel>
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="h-3 w-3 text-sky-400" />
                      Article *
                    </span>
                  </SerieFieldLabel>
                  <SearchableSelect
                    value={form.articleId}
                    onChange={(v) => {
                      setForm((p) => ({ ...p, articleId: v }));
                      clearError("articleId");
                    }}
                    options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))}
                    placeholder="Choisir un article"
                    allowClear={false}
                  />
                  <FormFieldError message={errors.articleId} />
                </div>
                <div>
                  <SerieFieldLabel>
                    <span className="inline-flex items-center gap-1.5">
                      <Warehouse className="h-3 w-3 text-cyan-400" />
                      Dépôt
                    </span>
                  </SerieFieldLabel>
                  <SearchableSelect
                    value={form.depotId}
                    onChange={(v) => setForm((p) => ({ ...p, depotId: v }))}
                    options={depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
                    placeholder="Optionnel"
                    clearLabel="Aucun"
                  />
                </div>
              </motion.div>
            ) : null}

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <SerieFieldLabel>Statut</SerieFieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {EDIT_STATUTS.map((s) => {
                  const cfg = SERIE_STATUT_CFG[s];
                  const sel = form.statut === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, statut: s }))}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        sel ? cfg.cls : "border-sky-400/15 text-sky-200/50 hover:bg-white/5"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {error ? (
              <p className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
            ) : null}
          </div>

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
              disabled={saving}
              className={`${PRIMARY_BTN_CLASSES} disabled:opacity-50`}
              style={{
                ...primaryButtonStyle,
                boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)",
              }}
              whileHover={reduceMotion || saving ? undefined : { y: -2, scale: 1.02 }}
              whileTap={reduceMotion || saving ? undefined : { scale: 0.97 }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Enregistrer" : "Créer le N°"}
            </motion.button>
          </div>
      </div>
    </div>,
    document.body
  );
}

function AssignLotModal({ serie, lots, onClose, onSaved }) {
  const [lotId, setLotId] = useState(serie.lotId ? String(serie.lotId) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lotOptions = useMemo(
    () =>
      lots
        .filter((l) => String(l.articleId) === String(serie.articleId))
        .map((l) => ({
          value: String(l.id),
          label: `${l.numero} — ${l.depot?.code || ""} (reste ${Number(l.quantiteRestante).toLocaleString("fr-FR")})`,
        })),
    [lots, serie.articleId]
  );

  async function save() {
    if (!lotId) return setError("Sélectionnez un lot");
    setSaving(true);
    setError("");
    try {
      await api.patch(`numeros-serie/${serie.id}/assigner-lot`, { lotId: Number(lotId) });
      onSaved();
      onClose();
    } catch (e) {
      setError(getAxiosErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Assigner à un lot</h2>
            <p className="font-mono text-xs text-sky-300">{serie.numero}</p>
            <p className="text-xs text-slate-400">{serie.article?.libelle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <label className="mb-1 block text-xs text-slate-400">Lot (même article)</label>
        <SearchableSelect
          value={lotId}
          onChange={setLotId}
          options={lotOptions}
          placeholder="Choisir un lot"
          allowClear={false}
        />
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400">
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={`${PRIMARY_BTN_CLASSES} disabled:opacity-50`}
            style={primaryButtonStyle}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Assigner
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ serie, depots, onClose, onConfirm, isPending, error }) {
  const [depotId, setDepotId] = useState("");
  const fromLabel = serie.depot?.code || serie.depot?.libelle || "Aucun (non assigné)";

  const destOptions = depots.filter((d) => String(d.id) !== String(serie.depotId ?? ""));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white">Confirmer le transfert</h2>
        <p className="mt-2 text-sm text-slate-300">
          Transférer N° <span className="font-mono text-sky-300">{serie.numero}</span> de{" "}
          <strong>{fromLabel}</strong> vers le dépôt sélectionné ?
        </p>
        <label className="mb-1 mt-4 block text-xs text-slate-400">Dépôt destination</label>
        {destOptions.length === 0 ? (
          <p className="text-xs text-amber-300">Aucun autre dépôt disponible.</p>
        ) : (
          <SearchableSelect
            value={depotId}
            onChange={setDepotId}
            options={destOptions.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
            placeholder="Choisir"
            allowClear={false}
          />
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400">
            Annuler
          </button>
          <button
            type="button"
            disabled={!depotId || isPending || destOptions.length === 0}
            onClick={() => onConfirm(Number(depotId))}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmer le transfert
          </button>
        </div>
      </div>
    </div>
  );
}

const MVT_TYPE_CFG = {
  TRANSFERT: {
    label: "Transfert",
    cls: "bg-blue-500/20 border-blue-500/30 text-blue-300",
    Icon: ArrowRightLeft,
  },
  ENTREE_ACHAT: { label: "Achat", cls: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", Icon: null },
  SORTIE_VENTE: { label: "Vente", cls: "bg-red-500/20 border-red-500/30 text-red-300", Icon: null },
};

function MvtTypeBadge({ type }) {
  const cfg = MVT_TYPE_CFG[type];
  if (!cfg) {
    return (
      <span className="inline-flex rounded-full border border-slate-500/30 bg-slate-500/20 px-2 py-0.5 text-[11px] text-slate-300">
        {type}
      </span>
    );
  }
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

function HistoriqueSerieModal({ serie, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["ns-mouvements", serie.id],
    queryFn: () => api.get(`numeros-serie/${serie.id}/mouvements`).then((r) => r.data),
  });
  const mvts = data?.items || [];

  function fmtWhen(v) {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-white/10 bg-navy-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Historique — {serie.numero}</h2>
            <p className="text-xs text-slate-400">
              {serie.article?.libelle}
              {serie.lot?.numero ? ` · Lot ${serie.lot.numero}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent-400" />
            </div>
          ) : mvts.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun mouvement enregistré</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Dépôt</th>
                  <th className="px-2 py-2 text-right">Qté</th>
                </tr>
              </thead>
              <tbody>
                {mvts.map((m) => (
                  <tr key={m.id} className="border-b border-white/5">
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-400">{fmtWhen(m.createdAt)}</td>
                    <td className="px-2 py-2">
                      <MvtTypeBadge type={m.type} />
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-400">
                      {m.depot?.code || "—"}
                      {m.depotDest ? ` → ${m.depotDest.code}` : ""}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-200">{m.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function autoSerieNumero(articleCode, index) {
  const code = String(articleCode || "ART")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `SN-${code}-${ts}-${String(index + 1).padStart(3, "0")}`;
}

function BulkImportModal({ articles, depots, lots, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [defaultArticleId, setDefaultArticleId] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const articleById = useMemo(() => new Map(articles.map((a) => [String(a.id), a])), [articles]);
  const depotById = useMemo(() => new Map(depots.map((d) => [String(d.id), d])), [depots]);
  const lotById = useMemo(() => new Map(lots.map((l) => [String(l.id), l])), [lots]);

  const parseCsvText = useCallback(
    (text) => {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) return [];
      const header = lines[0].toLowerCase();
      const body = lines.slice(header.includes("numero") ? 1 : 0);
      return body.map((line, idx) => {
        const parts = line.split(/[,;]/).map((s) => s.trim());
        const [numero, articleId, depotId, lotId] = parts;
        const art = articleById.get(String(articleId));
        const autoNum = !numero?.trim() && art ? autoSerieNumero(art.code, idx) : numero?.trim() || "";
        return {
          id: `row-${idx}-${Date.now()}`,
          numero: autoNum,
          articleId: articleId || "",
          depotId: depotId || "",
          lotId: lotId || "",
        };
      });
    },
    [articleById]
  );

  const parsePasteLines = useCallback(
    (text, defaultArticleId, defaultDepotId) => {
      const art = articleById.get(String(defaultArticleId));
      return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((numero, idx) => ({
          id: `paste-${idx}-${Date.now()}`,
          numero: numero || (art ? autoSerieNumero(art.code, idx) : ""),
          articleId: defaultArticleId || "",
          depotId: defaultDepotId || "",
          lotId: "",
        }));
    },
    [articleById]
  );

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsvText(String(reader.result || ""));
      if (parsed.length) {
        setRows(parsed);
        setStep(2);
        setError("");
      } else setError("Fichier CSV vide ou invalide");
    };
    reader.readAsText(file, "UTF-8");
  }

  function validateRow(row, allRows) {
    const errs = [];
    if (!row.numero?.trim()) errs.push("Numéro requis");
    const dup = allRows.filter((r) => r.numero?.trim() && r.numero === row.numero);
    if (dup.length > 1) errs.push("Doublon local");
    if (!row.articleId || !articleById.has(String(row.articleId))) errs.push("Article invalide");
    if (row.depotId && !depotById.has(String(row.depotId))) errs.push("Dépôt invalide");
    if (row.lotId && !lotById.has(String(row.lotId))) errs.push("Lot invalide");
    return errs;
  }

  const validatedRows = useMemo(
    () =>
      rows.map((r) => {
        const errors = validateRow(r, rows);
        return { ...r, errors, valid: errors.length === 0 };
      }),
    [rows, articleById, depotById, lotById]
  );

  const validCount = validatedRows.filter((r) => r.valid).length;

  function updateRow(id, field, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function downloadTemplate() {
    const blob = new Blob(
      ["numero_serie,article_id,depot_id,lot_id\n,1,1,\nSN-MANUEL-001,1,1,1\n"],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-numeros-serie.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    const items = validatedRows.filter((r) => r.valid).map((r) => ({
      numero: r.numero.trim(),
      articleId: Number(r.articleId),
      depotId: r.depotId ? Number(r.depotId) : undefined,
      lotId: r.lotId ? Number(r.lotId) : undefined,
    }));
    if (!items.length) return setError("Aucune ligne valide à importer");
    setStep(3);
    setImporting(true);
    setProgress(10);
    setError("");
    try {
      setProgress(40);
      const r = await api.post("numeros-serie/bulk", { items });
      setProgress(100);
      setResult(r.data);
    } catch (e) {
      setError(getAxiosErrorMessage(e));
      setStep(2);
    } finally {
      setImporting(false);
    }
  }

  const STEPS = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Preview" },
    { n: 3, label: "Import" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-navy-900 shadow-2xl transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Import en masse</h2>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all duration-300 ${
                  step === s.n
                    ? "font-medium text-white"
                    : step > s.n
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/5 text-slate-500"
                }`}
                style={step === s.n ? primaryOptionHighlightStyle : undefined}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                  {step > s.n ? <Check className="h-3 w-3" /> : s.n}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(92vh-140px)] overflow-y-auto p-6">
          {step === 1 && (
            <div className="animate-[fadeIn_0.3s_ease] space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                  dragOver
                    ? "scale-[1.01]"
                    : "border-white/20 bg-white/[0.02] hover:border-white/30"
                }`}
                style={
                  dragOver
                    ? { borderColor: STOKIFY_BLUE, background: `rgba(${STOKIFY_BLUE_RGB}, 0.1)` }
                    : undefined
                }
              >
                <Upload className={`mx-auto mb-3 h-10 w-10 ${dragOver ? "animate-bounce" : "text-slate-500"}`} style={dragOver ? { color: STOKIFY_BLUE } : undefined} />
                <p className="text-sm font-medium text-slate-200">Glissez-déposez un fichier CSV</p>
                <p className="mt-1 text-xs text-slate-500">ou</p>
                <label className={`mt-3 inline-block cursor-pointer ${PRIMARY_BTN_SM_CLASSES}`} style={primaryButtonStyle}>
                  Parcourir…
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Coller du texte (un numéro par ligne)</label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className={`${INPUT_CN} min-h-[80px] font-mono text-xs`}
                  placeholder="SN-001&#10;SN-002"
                />
                <div className="mt-2">
                  <SearchableSelect
                    value={defaultArticleId}
                    onChange={setDefaultArticleId}
                    options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))}
                    placeholder="Article par défaut (coller)"
                    allowClear={false}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!defaultArticleId) return setError("Sélectionnez un article par défaut");
                    const parsed = parsePasteLines(pasteText, defaultArticleId, "");
                    if (!parsed.length) return setError("Aucune ligne à parser");
                    setRows(parsed);
                    setStep(2);
                    setError("");
                  }}
                  className="mt-2 text-xs text-accent-400 hover:underline"
                >
                  Parser le texte collé →
                </button>
              </div>
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 text-xs text-emerald-400 hover:underline">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Télécharger le modèle CSV
              </button>
              {error && <p className="text-xs text-red-300">{error}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="animate-[fadeIn_0.3s_ease] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>{validatedRows.length} ligne(s) · {validCount} valide(s)</span>
                <button type="button" onClick={() => setStep(1)} className="text-accent-400 hover:underline">
                  ← Retour upload
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-[720px] w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-navy-950/50 text-left text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="px-2 py-2 w-8" />
                      <th className="px-2 py-2">Numéro</th>
                      <th className="px-2 py-2">Article ID</th>
                      <th className="px-2 py-2">Dépôt ID</th>
                      <th className="px-2 py-2">Lot ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validatedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-white/5 ${!row.valid ? "bg-red-500/10" : row.errors.some((e) => e === "Doublon local") ? "bg-red-500/5" : ""}`}
                      >
                        <td className="px-2 py-1.5">
                          {row.valid ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <span title={row.errors.join(", ")}>
                              <XCircle className="h-4 w-4 text-red-400" />
                            </span>
                          )}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.numero}
                            onChange={(e) => updateRow(row.id, "numero", e.target.value)}
                            className={`${INPUT_CN} font-mono text-[11px] py-1`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.articleId}
                            onChange={(e) => updateRow(row.id, "articleId", e.target.value)}
                            className={`${INPUT_CN} text-[11px] py-1`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.depotId}
                            onChange={(e) => updateRow(row.id, "depotId", e.target.value)}
                            className={`${INPUT_CN} text-[11px] py-1`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.lotId}
                            onChange={(e) => updateRow(row.id, "lotId", e.target.value)}
                            className={`${INPUT_CN} text-[11px] py-1`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validatedRows.some((r) => !r.valid) && (
                <p className="text-[11px] text-red-300/80">
                  Survolez les ✗ pour voir l&apos;erreur. Les doublons locaux sont surlignés en rouge.
                </p>
              )}
              {error && <p className="text-xs text-red-300">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={validCount === 0}
                  onClick={runImport}
                  className={`${PRIMARY_BTN_CLASSES} disabled:opacity-50`}
            style={primaryButtonStyle}
                >
                  Importer {validCount} ligne(s)
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-[fadeIn_0.3s_ease] space-y-4 py-4 text-center">
              {importing ? (
                <>
                  <Loader2 className="mx-auto h-12 w-12 animate-spin text-accent-400" />
                  <p className="text-sm text-slate-300">Import en cours…</p>
                  <div className="mx-auto h-2 max-w-md overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, background: STOKIFY_BLUE }}
                    />
                  </div>
                </>
              ) : result ? (
                <>
                  <CheckCircle className="mx-auto h-14 w-14 text-emerald-400" />
                  <p className="text-lg font-semibold text-white">
                    {result.created} créé(s) / {result.errors?.length || 0} erreur(s)
                  </p>
                  {result.errors?.length > 0 && (
                    <div className="mx-auto max-w-lg rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left">
                      <p className="mb-2 text-xs font-medium text-red-300">Détail des erreurs</p>
                      <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-red-200/90">
                        {result.errors.map((err, i) => (
                          <li key={i}>
                            <span className="font-mono">{err.numero || `#${err.index}`}</span> — {err.message}
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() =>
                          exportCsvFromRows(
                            result.errors.map((e) => ({ numero: e.numero, index: e.index, message: e.message })),
                            "erreurs-import-ns.csv"
                          )
                        }
                        className="mt-3 text-xs text-accent-400 hover:underline"
                      >
                        Exporter les erreurs (CSV)
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => result && onDone(result)}
                    className={`rounded-lg px-6 py-2 text-sm text-white hover:brightness-110`}
                    style={primaryButtonStyle}
                  >
                    Fermer
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NumerosSerie() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const canRead = hasPermission(user?.role, "stock:read");
  const canWrite = hasPermission(user?.role, "stock:write");

  const [articleFilterId, setArticleFilterId] = useState("");
  const [depotFilterId, setDepotFilterId] = useState("");
  const [lotFilterId, setLotFilterId] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [transferBanner, setTransferBanner] = useState(null);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const v = localStorage.getItem(SERIES_VIEW_KEY);
      return v === "table" || v === "cards" ? v : "cards";
    } catch {
      return "cards";
    }
  });

  function setViewModePersist(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem(SERIES_VIEW_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: seriesData, isLoading } = useQuery({
    queryKey: ["numeros-serie", societeScope, { articleFilterId, depotFilterId, lotFilterId, statutFilter, search, page, pageSize }],
    queryFn: () =>
      api
        .get("numeros-serie", {
          params: {
            limit: pageSize,
            page,
            ...(articleFilterId ? { articleId: articleFilterId } : {}),
            ...(depotFilterId ? { depotId: depotFilterId } : {}),
            ...(lotFilterId ? { lotId: lotFilterId } : {}),
            ...(statutFilter ? { statut: statutFilter } : {}),
            ...(search ? { search } : {}),
          },
        })
        .then((r) => r.data),
    enabled: canRead,
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles", "ns", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots", "ns", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: lotsData } = useQuery({
    queryKey: ["lots", "ns-filter", societeScope],
    queryFn: () => api.get("lots", { params: { limit: 200 } }).then((r) => r.data),
    enabled: canRead,
  });

  const items = asItems(seriesData);
  const articles = asItems(articlesData);
  const depots = asItems(depotsData);
  const lots = asItems(lotsData);
  const seriesItems = useMemo(() => {
    const byId = new Map(articles.map((a) => [String(a.id), a]));
    return items.map((serie) => {
      const art = byId.get(String(serie.articleId ?? serie.article?.id ?? ""));
      const imageUrl = serie.article?.imageUrl || art?.imageUrl || "";
      if (!imageUrl || serie.article?.imageUrl) return serie;
      return {
        ...serie,
        article: {
          ...(serie.article || {}),
          id: serie.article?.id ?? art?.id,
          code: serie.article?.code || art?.code,
          libelle: serie.article?.libelle || art?.libelle,
          imageUrl,
        },
      };
    });
  }, [items, articles]);
  const total = seriesData?.total ?? 0;
  const totalPages = Math.max(1, Number(seriesData?.pages) || Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [articleFilterId, depotFilterId, lotFilterId, statutFilter, pageSize, search]);

  const lotFilterOptions = lots.map((l) => ({
    value: String(l.id),
    label: `${l.numero} — ${l.article?.code || ""}`,
  }));

  const stats = useMemo(
    () => ({
      total,
      disponible: items.filter((i) => i.statut === "DISPONIBLE").length,
      vendu: items.filter((i) => i.statut === "VENDU").length,
      defectueux: items.filter((i) => i.statut === "DEFECTUEUX").length,
    }),
    [items, total]
  );

  const [transferError, setTransferError] = useState("");

  const transferMut = useMutation({
    mutationFn: ({ id, depotId }) => api.patch(`numeros-serie/${id}/transfert`, { depotId }),
    onMutate: () => setTransferError(""),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["numeros-serie"] });
      qc.invalidateQueries({ queryKey: ["ns-mouvements"] });
      qc.invalidateQueries({ queryKey: ["lot-mouvements"] });
      qc.invalidateQueries({ queryKey: ["mouvements"] });
      setTransferBanner({
        numero: res.data?.numero || modal?.serie?.numero,
        depot: res.data?.depot?.code || res.data?.depot?.libelle || "—",
      });
      setTimeout(() => setTransferBanner(null), 4000);
      setModal(null);
      setTransferError("");
    },
    onError: (e) => {
      const msg = getAxiosErrorMessage(e);
      setTransferError(msg);
      showToast(msg, "error");
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (id) => api.delete(`numeros-serie/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["numeros-serie"] });
      showToast("Numéro désactivé", "warning");
      setModal(null);
    },
    onError: (e) => showToast(getAxiosErrorMessage(e), "error"),
  });

  const reactivateMut = useMutation({
    mutationFn: (id) => api.patch(`numeros-serie/${id}`, { statut: "DISPONIBLE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["numeros-serie"] });
      showToast("Numéro réactivé", "success");
    },
    onError: (e) => showToast(getAxiosErrorMessage(e), "error"),
  });

  function resetFilters() {
    setSearch("");
    setArticleFilterId("");
    setDepotFilterId("");
    setLotFilterId("");
    setStatutFilter("");
    setPage(1);
  }

  const hasFilters = Boolean(search || articleFilterId || depotFilterId || lotFilterId || statutFilter);

  if (!canRead) {
    return (
      <PageShell title="Numéros de série" subtitle="">
        <p className="text-sm text-slate-400">Accès refusé.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Numéros de série"
      subtitle={`Traçabilité unitaire · ${total} enregistrement${total !== 1 ? "s" : ""}`}
      icon={Hash}
      badge="Série"
      aside={
        <GlassAside
          icon={CheckCircle}
          label="Disponibles"
          value={
            <>
              <span className="tabular-nums text-emerald-300">{stats.disponible}</span>
              {" sur cette page"}
            </>
          }
          iconColor="#6ee7b7"
          iconBg="rgba(29,158,117,0.22)"
          iconBorder="rgba(110,231,183,0.35)"
        />
      }
      actions={
        canWrite ? (
          <div className="flex flex-wrap gap-2">
            <motion.button
              type="button"
              onClick={() => setModal({ type: "bulk" })}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-white/5 px-3.5 py-2 text-xs font-medium text-sky-50"
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Upload className="h-4 w-4" />
              Import en masse
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setModal({ type: "create" })}
              className={PRIMARY_BTN_CLASSES}
              style={primaryButtonStyle}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Plus className="h-4 w-4" />
              Nouveau N° série
            </motion.button>
          </div>
        ) : null
      }
    >
      <div className="space-y-6 text-slate-200">
        <AnimatePresence>
          {transferBanner ? (
            <motion.p
              key="transfer-banner"
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/12 px-3 py-2 text-sm text-emerald-200"
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            >
              ✓ Numéro {transferBanner.numero} transféré avec succès vers {transferBanner.depot}
            </motion.p>
          ) : null}
          {toast ? (
            <motion.p
              key="serie-toast"
              className={`rounded-xl border px-3 py-2 text-sm ${
                toast.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            >
              {toast.msg}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <SerieKpiCards stats={stats} />

        <div className="rounded-2xl border border-white/10 bg-navy-900 p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher numéro, article..."
                className={`${FILTER_INPUT_CN} pl-9`}
              />
            </div>
            <div className="w-full sm:w-44">
              <SearchableSelect
                value={articleFilterId}
                onChange={setArticleFilterId}
                options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))}
                placeholder="Tous articles"
                clearLabel="Tous"
              />
            </div>
            <div className="w-full sm:w-36">
              <SearchableSelect
                value={depotFilterId}
                onChange={setDepotFilterId}
                options={depots.map((d) => ({ value: String(d.id), label: d.code }))}
                placeholder="Tous dépôts"
                clearLabel="Tous"
              />
            </div>
            <div className="w-full sm:w-40">
              <SearchableSelect
                value={lotFilterId}
                onChange={setLotFilterId}
                options={lotFilterOptions}
                placeholder="Tous lots"
                clearLabel="Tous"
              />
            </div>
            {STATUT_FILTERS.map((s) => (
              <button
                key={s || "all"}
                type="button"
                onClick={() => setStatutFilter(s)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  statutFilter === s ? "" : "border-white/10 text-slate-400 hover:text-slate-200"
                }`}
                style={
                  statutFilter === s
                    ? {
                        borderColor: `rgba(${STOKIFY_BLUE_RGB}, 0.5)`,
                        ...primaryOptionHighlightStyle,
                        ...primaryOptionSelectedStyle,
                      }
                    : undefined
                }
              >
                {s ? SERIE_STATUT_CFG[s]?.label : "Tous"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 p-0.5">
              <button
                type="button"
                title="Vue cartes"
                onClick={() => setViewModePersist("cards")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "cards" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Vue tableau"
                onClick={() => setViewModePersist("table")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "table" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === "cards" ? (
          <div>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SerieCardSkeleton key={i} index={i} />
                ))}
              </div>
            ) : seriesItems.length === 0 ? (
              <motion.div
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-4 py-16 text-center"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, #378ADD 10%, var(--bg-card)), var(--bg-card))",
                  borderColor: "rgba(55,138,221,0.28)",
                }}
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
              >
                <motion.div
                  className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{
                    background: "linear-gradient(145deg, rgba(55,138,221,0.4), rgba(6,182,212,0.22))",
                    color: "#7dd3fc",
                    border: "1px solid rgba(96,165,250,0.4)",
                    boxShadow: "0 12px 28px -12px rgba(55,138,221,0.55)",
                  }}
                  animate={reduceMotion ? undefined : { y: [0, -6, 0], rotate: [0, -3, 3, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Hash className="h-8 w-8" />
                </motion.div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Aucun numéro de série
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  {hasFilters ? "Aucun résultat pour ces filtres" : "Créez votre premier numéro de série"}
                </p>
                {hasFilters ? (
                  <motion.button
                    type="button"
                    onClick={resetFilters}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-400/25 px-4 py-2 text-xs font-medium text-sky-100"
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                  >
                    Réinitialiser les filtres
                  </motion.button>
                ) : null}
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {seriesItems.map((serie, index) => (
                  <SerieCard
                    key={serie.id}
                    serie={serie}
                    index={index}
                    canWrite={canWrite}
                    deactivatePending={deactivateMut.isPending || reactivateMut.isPending}
                    onHistory={(ns) => setModal({ type: "history", serie: ns })}
                    onTransfer={(ns) => setModal({ type: "transfer", serie: ns })}
                    onAssign={(ns) => setModal({ type: "assign", serie: ns })}
                    onEdit={(ns) => setModal({ type: "edit", serie: ns })}
                    onDesactiver={(ns) => setModal({ type: "deactivate", serie: ns })}
                    onReactivate={(ns) => reactivateMut.mutate(ns.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <SerieTable
              items={seriesItems}
              isLoading={isLoading}
              canWrite={canWrite}
              deactivatePending={deactivateMut.isPending || reactivateMut.isPending}
              onHistory={(ns) => setModal({ type: "history", serie: ns })}
              onTransfer={(ns) => setModal({ type: "transfer", serie: ns })}
              onAssign={(ns) => setModal({ type: "assign", serie: ns })}
              onEdit={(ns) => setModal({ type: "edit", serie: ns })}
              onDesactiver={(ns) => setModal({ type: "deactivate", serie: ns })}
              onReactivate={(ns) => reactivateMut.mutate(ns.id)}
              empty={
                <>
                  <Hash className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">Aucun numéro de série</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {search ? "Essayez un autre terme" : "Créez votre premier numéro de série"}
                  </p>
                  {hasFilters ? (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    >
                      Réinitialiser les filtres
                    </button>
                  ) : null}
                </>
              }
            />
          </motion.div>
        )}

        {total > 0 ? (
          <StockPagination
            page={safePage}
            totalPages={totalPages}
            totalResults={total}
            pageSize={pageSize}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            unitLabel="numéro(s)"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </div>

      {(modal?.type === "create" || modal?.type === "edit") && (
        <SerieModal
          serie={modal.serie}
          articles={articles}
          depots={depots}
          onClose={() => setModal(null)}
          onSaved={() => showToast(modal.type === "create" ? "N° série créé" : "N° série mis à jour")}
        />
      )}
      {modal?.type === "assign" && (
        <AssignLotModal
          serie={modal.serie}
          lots={lots}
          onClose={() => setModal(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["numeros-serie"] });
            showToast("Lot assigné");
          }}
        />
      )}
      {modal?.type === "history" && (
        <HistoriqueSerieModal serie={modal.serie} onClose={() => setModal(null)} />
      )}
      {modal?.type === "transfer" && (
        <TransferModal
          serie={modal.serie}
          depots={depots}
          isPending={transferMut.isPending}
          error={transferError}
          onClose={() => {
            setTransferError("");
            setModal(null);
          }}
          onConfirm={(depotId) => transferMut.mutate({ id: modal.serie.id, depotId })}
        />
      )}
      {modal?.type === "bulk" && (
        <BulkImportModal
          articles={articles}
          depots={depots}
          lots={lots}
          onClose={() => setModal(null)}
          onDone={(data) => {
            qc.invalidateQueries({ queryKey: ["numeros-serie"] });
            showToast(`${data.created} numéro(s) créé(s)${data.errors?.length ? ` · ${data.errors.length} erreur(s)` : ""}`);
            setModal(null);
          }}
        />
      )}
      {modal?.type === "deactivate" && (
        <DeactivateSerieModal
          serie={modal.serie}
          loading={deactivateMut.isPending}
          onClose={() => setModal(null)}
          onConfirm={() => deactivateMut.mutate(modal.serie.id)}
        />
      )}
    </PageShell>
  );
}

