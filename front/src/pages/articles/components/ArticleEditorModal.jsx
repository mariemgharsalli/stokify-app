import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  FolderTree,
  Info,
  Loader2,
  Package,
  X,
} from "lucide-react";
import FormFieldError from "../../../components/ui/FormFieldError";
import { PRIMARY_BTN_CLASSES, STOKIFY_BLUE, primaryButtonStyle } from "../../../utils/brandStyles";

export const EDITOR_WIZARD_STEPS = [
  { id: 0, label: "Identité", desc: "Code, libellé et statut", Icon: Info },
  { id: 1, label: "Classification", desc: "Famille, fournisseur, dépôt", Icon: FolderTree },
  { id: 2, label: "Prix & stock", desc: "Tarifs, seuils et contraintes", Icon: Coins },
  { id: 3, label: "Photo", desc: "Visuel et contrôle final", Icon: Camera },
];

const EDITOR_STYLES = `
  @keyframes aemBackdropIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes aemModalIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export function EditorSectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "rgba(55, 138, 221, 0.12)", color: STOKIFY_BLUE }}
      >
        {Icon ? <Icon className="h-4 w-4" /> : <Package className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-sm leading-snug text-[var(--text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function ProductIdentity({ formCode, formLabel, margin, editing }) {
  const initials = (formLabel || formCode || "AR")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ background: `linear-gradient(160deg, ${STOKIFY_BLUE}, #1e4f86)` }}
        >
          {initials || "AR"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12px] tracking-wide text-sky-200">{formCode || "CODE —"}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-white">{formLabel || "Libellé de l'article"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-white/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
          {editing ? "Modification" : "Brouillon"}
        </span>
        {margin != null ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              Number(margin) >= 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
            }`}
          >
            Marge {margin}%
          </span>
        ) : (
          <span className="rounded-md bg-white/[0.08] px-2 py-0.5 text-[10px] text-slate-400">Marge à calculer</span>
        )}
      </div>
    </div>
  );
}

export default function ArticleEditorModal({
  open,
  onClose,
  editing,
  formStep,
  setFormStep,
  formCode = "",
  formLabel = "",
  margin = null,
  error,
  fieldErrors = {},
  onPrev,
  onNext,
  onSubmit,
  savePending = false,
  submitSuccess = false,
  submitDisabled = false,
  children,
}) {
  const [mounted, setMounted] = useState(false);
  const step = EDITOR_WIZARD_STEPS[formStep] ?? EDITOR_WIZARD_STEPS[0];
  const progressPct = ((formStep + 1) / EDITOR_WIZARD_STEPS.length) * 100;
  const StepIcon = step.Icon;

  useEffect(() => {
    if (!open) {
      setMounted(false);
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = requestAnimationFrame(() => setMounted(true));
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-5"
      style={{ animation: mounted ? "aemBackdropIn 0.22s ease both" : undefined }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-editor-title"
    >
      <style>{EDITOR_STYLES}</style>
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Fermer"
      />

      <div
        id="product-editor"
        className="relative flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-[var(--bg-modal)] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-[var(--border-default)] lg:flex-row"
        style={{ animation: mounted ? "aemModalIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both" : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <aside
          className="relative hidden w-[300px] shrink-0 flex-col overflow-hidden text-white lg:flex"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, rgba(55,138,221,0.28), transparent 55%), linear-gradient(180deg, #101828 0%, #0b1220 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "linear-gradient(180deg, #000 0%, transparent 78%)",
            }}
            aria-hidden
          />
          <div className="relative flex h-full flex-col px-5 py-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Package className="h-4 w-4 text-sky-200" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">Catalogue</p>
                <p className="text-sm font-semibold text-white">Fiche article</p>
              </div>
            </div>

            <div className="mt-6">
              <ProductIdentity formCode={formCode} formLabel={formLabel} margin={margin} editing={editing} />
            </div>

            <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Étapes de la fiche">
              {EDITOR_WIZARD_STEPS.map((s, i) => {
                const Icon = s.Icon;
                const active = formStep === i;
                const done = formStep > i;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFormStep(i)}
                    className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                      active ? "bg-white/10" : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                        done
                          ? "bg-emerald-400 text-emerald-950"
                          : active
                            ? "text-white"
                            : "bg-white/[0.08] text-slate-400"
                      }`}
                      style={active && !done ? { background: STOKIFY_BLUE } : undefined}
                    >
                      {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-medium ${active ? "text-white" : "text-slate-300"}`}>
                        {s.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Étape {formStep + 1} / {EDITOR_WIZARD_STEPS.length}
                </span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: STOKIFY_BLUE }}
                />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-default)] px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                <span className="rounded-md bg-[var(--bg-hover)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {editing ? "Modification" : "Création"}
                </span>
                {formCode ? (
                  <span className="font-mono text-[11px]" style={{ color: STOKIFY_BLUE }}>
                    {formCode}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="hidden h-8 w-8 items-center justify-center rounded-lg text-white lg:flex"
                  style={{ background: STOKIFY_BLUE }}
                >
                  <StepIcon className="h-4 w-4" />
                </span>
                <div>
                  <h2 id="article-editor-title" className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">
                    {editing ? "Modifier l'article" : "Nouvel article"}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {step.label} — {step.desc}
                    {formLabel ? ` · ${formLabel}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border-default)] px-4 py-2 lg:hidden">
            {EDITOR_WIZARD_STEPS.map((s, i) => {
              const active = formStep === i;
              const done = formStep > i;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFormStep(i)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "text-white"
                      : done
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                  }`}
                  style={active ? { background: STOKIFY_BLUE } : undefined}
                >
                  {done ? <Check className="h-3 w-3" /> : null}
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>

          {error ? (
            <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 sm:mx-6 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">
              {error}
            </div>
          ) : null}
          {!error && Object.keys(fieldErrors || {}).length > 0 ? (
            <div className="mx-4 mb-2 space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 sm:mx-6 dark:border-red-400/20 dark:bg-red-400/10">
              {Object.entries(fieldErrors)
                .slice(0, 5)
                .map(([k, msg]) => (
                  <FormFieldError key={k} message={msg} style={{ marginTop: 0 }} />
                ))}
            </div>
          ) : null}

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--bg-modal)] px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3.5 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)]"
            >
              <ChevronLeft className="h-4 w-4" />
              {formStep === 0 ? "Annuler" : "Précédent"}
            </button>

            <p className="hidden text-xs text-[var(--text-muted)] sm:block">
              Échap pour fermer · les champs obligatoires sont marqués *
            </p>

            <div className="min-w-[9.5rem]">
              {formStep < EDITOR_WIZARD_STEPS.length - 1 ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onNext}
                  className={`${PRIMARY_BTN_CLASSES} w-full justify-center rounded-lg px-4 py-2`}
                  style={primaryButtonStyle}
                >
                  Continuer
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={savePending || submitSuccess || submitDisabled}
                  className={`${PRIMARY_BTN_CLASSES} w-full justify-center rounded-lg px-4 py-2 disabled:opacity-60 ${
                    submitSuccess ? "!bg-emerald-600" : ""
                  }`}
                  style={submitSuccess ? undefined : primaryButtonStyle}
                >
                  {savePending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editing ? "Enregistrement…" : "Création…"}
                    </>
                  ) : submitSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      {editing ? "Enregistré" : "Créé"}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {editing ? "Enregistrer" : "Créer l'article"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
