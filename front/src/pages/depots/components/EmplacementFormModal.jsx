import { useEffect, useMemo, useState } from "react";
import { Package, X } from "lucide-react";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { emplacementSchema } from "../../../validation";
import { EMP_TYPES, suggestEmpCode } from "./depotUtils";

const INPUT =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 [border-color:var(--color-border-secondary,#e2e8f0)] [background:var(--color-background-primary,#ffffff)] [color:var(--color-text-primary,#0f172a)]";
const INPUT_ERR = `${INPUT} !border-red-400 ${INPUT_ERROR_CLASS}`;

export default function EmplacementFormModal({ emplacement, depots, defaultDepotId, onClose, onSave, saving }) {
  const isEdit = Boolean(emplacement?.id);
  const [form, setForm] = useState({
    depotId: "",
    code: "",
    libelle: "",
    categorie: "ZONE",
    barcode: "",
    niveaux: "",
    zoneDangereuse: false,
    categorieAutorisee: "",
    distanceQuai: "50",
    capaciteSlots: "",
  });

  const values = useMemo(
    () => ({
      depotId: form.depotId,
      code: form.code,
      libelle: form.libelle,
      categorie: form.categorie,
      barcode: form.barcode,
      distanceQuai: form.distanceQuai,
      capaciteSlots: form.capaciteSlots,
      niveaux: form.niveaux,
      zoneDangereuse: form.zoneDangereuse,
      categorieAutorisee: form.categorieAutorisee,
    }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError, clearErrors } = useFormValidation(
    emplacementSchema,
    values
  );

  useEffect(() => {
    clearErrors();
    if (emplacement) {
      setForm({
        depotId: String(emplacement.depotId || defaultDepotId || ""),
        code: emplacement.code || "",
        libelle: emplacement.libelle || "",
        categorie: emplacement.categorie || "ZONE",
        barcode: emplacement.barcode || "",
        niveaux: emplacement.niveaux != null ? String(emplacement.niveaux) : "",
        zoneDangereuse: Boolean(emplacement.zoneDangereuse),
        categorieAutorisee: emplacement.categorieAutorisee || "",
        distanceQuai: emplacement.distanceQuai != null ? String(emplacement.distanceQuai) : "50",
        capaciteSlots: emplacement.capaciteSlots != null ? String(emplacement.capaciteSlots) : "",
      });
    } else {
      setForm({
        depotId: String(defaultDepotId || depots[0]?.id || ""),
        code: "",
        libelle: "",
        categorie: "ZONE",
        barcode: "",
        niveaux: "",
        zoneDangereuse: false,
        categorieAutorisee: "",
        distanceQuai: "50",
        capaciteSlots: "",
      });
    }
  }, [emplacement, defaultDepotId, depots]);

  const up = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    clearError(k);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      depotId: Number(form.depotId),
      code: form.code.trim(),
      libelle: form.libelle.trim(),
      categorie: form.categorie || "ZONE",
      barcode: form.barcode.trim() || null,
      niveaux: form.niveaux === "" ? null : Number(form.niveaux),
      zoneDangereuse: Boolean(form.zoneDangereuse),
      categorieAutorisee: form.categorieAutorisee || null,
      distanceQuai: form.distanceQuai === "" ? 50 : Number(form.distanceQuai),
      capaciteSlots: form.capaciteSlots === "" ? null : Number(form.capaciteSlots),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
        style={{
          animation: "depotModalIn .2s ease",
          borderColor: "var(--color-border-tertiary, #e2e8f0)",
          background: "var(--color-background-primary, #ffffff)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package style={{ color: "#378ADD" }} size={22} />
            <h2 className="text-lg font-medium" style={{ color: "var(--color-text-primary, #0f172a)" }}>
              {isEdit ? "Modifier l'emplacement" : "Nouvel emplacement"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ color: "var(--color-text-tertiary, #94a3b8)" }}
          >
            <X size={22} />
          </button>
        </div>

        <label className="mb-1 block text-xs" style={{ color: "var(--color-text-secondary, #64748b)" }}>
          Dépôt parent *
        </label>
        <select
          className={`${errors.depotId ? INPUT_ERR : INPUT} mb-1`}
          value={form.depotId}
          disabled={isEdit}
          onChange={(e) => up("depotId", e.target.value)}
          onBlur={() => validateField("depotId")}
        >
          <option value="">— Choisir —</option>
          {depots.map((d) => (
            <option key={d.id} value={d.id}>
              {d.libelle} — {d.code}
            </option>
          ))}
        </select>
        <FormFieldError message={errors.depotId} style={{ marginBottom: 8 }} />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Code *</label>
            <input
              className={errors.code ? INPUT_ERR : INPUT}
              value={form.code}
              onFocus={() => !isEdit && !form.code && up("code", suggestEmpCode())}
              onChange={(e) => up("code", e.target.value.toUpperCase())}
              onBlur={() => validateField("code")}
            />
            <FormFieldError message={errors.code} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Libellé *</label>
            <input
              className={errors.libelle ? INPUT_ERR : INPUT}
              value={form.libelle}
              onChange={(e) => up("libelle", e.target.value)}
              onBlur={() => validateField("libelle")}
            />
            <FormFieldError message={errors.libelle} />
          </div>
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-tertiary, #94a3b8)" }}>
          Type d&apos;emplacement
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {EMP_TYPES.map((t) => (
            <label
              key={t.val}
              className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs"
              style={
                form.categorie === t.val
                  ? { borderColor: "rgba(55,138,221,0.4)", background: "rgba(55,138,221,0.1)", color: "#378ADD" }
                  : {
                      borderColor: "var(--color-border-tertiary, #e2e8f0)",
                      color: "var(--color-text-secondary, #64748b)",
                    }
              }
            >
              <input
                type="radio"
                className="sr-only"
                name="categorie"
                checked={form.categorie === t.val}
                onChange={() => up("categorie", t.val)}
              />
              {t.label}
            </label>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Niveaux de rack (étages)</label>
            <input
              type="number"
              min={0}
              className={INPUT}
              value={form.niveaux}
              onChange={(e) => up("niveaux", e.target.value)}
              placeholder="Ex: 4"
            />
            <p className="mt-1 text-[10px] text-slate-500">Hauteur physique du rack — pas la capacité</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Code-barres</label>
            <input className={INPUT} value={form.barcode} onChange={(e) => up("barcode", e.target.value)} />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Distance au quai (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              className={errors.distanceQuai ? INPUT_ERR : INPUT}
              value={form.distanceQuai}
              onChange={(e) => up("distanceQuai", e.target.value)}
              onBlur={() => validateField("distanceQuai")}
              placeholder="50"
            />
            <FormFieldError message={errors.distanceQuai} />
            <p className="mt-1 text-[10px] text-slate-500">0 = proche du quai, 100 = éloigné</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Capacité slots (unités)</label>
            <input
              type="number"
              min={0}
              className={errors.capaciteSlots ? INPUT_ERR : INPUT}
              value={form.capaciteSlots}
              onChange={(e) => up("capaciteSlots", e.target.value)}
              onBlur={() => validateField("capaciteSlots")}
              placeholder="Ex: 40"
            />
            <FormFieldError message={errors.capaciteSlots} />
            <p className="mt-1 text-[10px] text-slate-500">
              Unités max pour le % d&apos;occupation (sinon niveaux, sinon 100)
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-[#BA7517]/25 bg-[#BA7517]/5 p-3">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm text-amber-200/90">Zone dangereuse 🔶</span>
            <input
              type="checkbox"
              checked={form.zoneDangereuse}
              onChange={(e) => up("zoneDangereuse", e.target.checked)}
              className="h-4 w-4 rounded accent-amber-500"
            />
          </label>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-slate-400">Catégorie autorisée</label>
          <select
            className={INPUT}
            value={form.categorieAutorisee}
            onChange={(e) => up("categorieAutorisee", e.target.value)}
          >
            <option value="">Aucune restriction</option>
            <option value="ALIMENTAIRE">Alimentaire</option>
            <option value="CHIMIQUE">Chimique</option>
            <option value="MIXTE">Mixte</option>
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || !isValid}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer emplacement"}
          </button>
        </div>
      </form>
    </div>
  );
}
