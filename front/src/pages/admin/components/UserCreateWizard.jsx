import { useEffect, useState } from "react";
import { z } from "zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  User,
  X,
} from "lucide-react";
import RoleSelector from "./RoleSelector";
import PasswordStrength, { scorePassword } from "./PasswordStrength";
import { avatarColorForUser, userInitials } from "../adminTheme";
import { mapApiErrors } from "../../../validation/helpers";
import FormFieldError, { inputErrorStyle } from "../../../components/ui/FormFieldError";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../../utils/brandStyles";

const STEPS = ["Identité", "Accès & rôle", "Sécurité"];

const STEP_FIELDS = {
  0: ["prenom", "nom", "email"],
  1: ["role"],
  2: ["motDePasse", "confirm"],
};

const FIELD_STEP = {
  prenom: 0,
  nom: 0,
  email: 0,
  telephone: 0,
  role: 1,
  motDePasse: 2,
  confirm: 2,
  motDePasseConfirmation: 2,
};

const inputCls =
  "w-full rounded-xl border bg-[rgba(15,23,42,0.65)] px-3 py-2.5 text-sm text-slate-100 placeholder:text-sky-200/30 outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20";
const inputBorder = { borderColor: "rgba(56,189,248,0.18)" };

const modalStyle = {
  background:
    "linear-gradient(165deg, rgba(17,34,66,0.98) 0%, rgba(12,22,40,0.98) 55%, rgba(10,18,32,0.99) 100%)",
  borderColor: "rgba(56,189,248,0.22)",
  boxShadow: "0 24px 64px -16px rgba(0,0,0,0.65), inset 0 1px 0 rgba(125,211,252,0.12)",
};

function isValidEmail(value) {
  return z.string().email().safeParse(String(value || "").trim()).success;
}

function FieldLabel({ children }) {
  return (
    <div className="mb-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/50">{children}</label>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  onBlur,
  minLength = 8,
  autoComplete = "new-password",
  error,
  placeholder,
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          required
          type={show ? "text" : "password"}
          minLength={minLength}
          autoComplete={autoComplete}
          className={`${inputCls} pr-10`}
          style={{ ...inputBorder, ...(error ? inputErrorStyle : {}) }}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-sky-200/45 hover:bg-white/5 hover:text-sky-100"
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FormFieldError message={error} />
    </div>
  );
}

function SecurityOption({ active, onClick, icon: Icon, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
        active
          ? "border-sky-400/50 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
          : "border-sky-400/15 bg-slate-900/40 hover:border-sky-400/25 hover:bg-slate-900/70"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-sky-500/20 text-sky-300" : "bg-slate-800 text-slate-400"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-sky-200/45">{description}</span>
      </span>
      <span
        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          active ? "border-sky-400 bg-sky-500 text-white" : "border-slate-600 bg-transparent"
        }`}
      >
        {active ? <Check className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}

export default function UserCreateWizard({ open, onClose, roles, onSubmit, loading, error, fieldErrors }) {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    role: roles[0] || "ADMIN",
    motDePasse: "",
    confirm: "",
    forceChange: true,
    sendInvite: true,
  });
  const [touchedFields, setTouchedFields] = useState({});
  const [backendErrors, setBackendErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setTouchedFields({});
    setBackendErrors({});
    setStep(0);
  }, [open]);

  useEffect(() => {
    if (!fieldErrors?.length) return;

    const mapped = mapApiErrors(fieldErrors);
    if (mapped.motDePasseConfirmation && !mapped.confirm) {
      mapped.confirm = mapped.motDePasseConfirmation;
    }

    setBackendErrors(mapped);

    const fields = Object.keys(mapped);
    setTouchedFields((prev) => {
      const next = { ...prev };
      fields.forEach((field) => {
        next[field] = true;
      });
      return next;
    });

    if (fields.length) {
      const targetStep = Math.min(...fields.map((field) => FIELD_STEP[field] ?? 0));
      setStep(targetStep);
    }
  }, [fieldErrors]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const previewUser = { prenom: form.prenom, nom: form.nom, email: form.email };
  const colors = avatarColorForUser(previewUser);
  const passwordsMatch = form.motDePasse === form.confirm;
  const passwordStrongEnough = scorePassword(form.motDePasse) >= 2;

  const validateStep = (stepNum) => {
    const errors = {};

    if (stepNum === 0) {
      if (!form.prenom.trim()) errors.prenom = "Prénom requis";
      if (!form.nom.trim()) errors.nom = "Nom requis";
      if (!form.email.trim()) errors.email = "Email requis";
      else if (!isValidEmail(form.email)) errors.email = "Email invalide";
    }

    if (stepNum === 1) {
      if (!form.role) errors.role = "Rôle requis";
      else if (!roles.includes(form.role)) errors.role = "Rôle invalide";
    }

    if (stepNum === 2) {
      if (!form.motDePasse) errors.motDePasse = "Mot de passe requis";
      else if (!passwordStrongEnough) errors.motDePasse = "Mot de passe trop faible";
      if (!form.confirm) errors.confirm = "Confirmation requise";
      else if (!passwordsMatch) errors.confirm = "Les mots de passe ne correspondent pas.";
    }

    return errors;
  };

  const allStepsValid =
    Object.keys(validateStep(0)).length === 0 &&
    Object.keys(validateStep(1)).length === 0 &&
    Object.keys(validateStep(2)).length === 0;
  const canSubmit = allStepsValid;

  const touchField = (field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  };

  const clearBackendError = (field) => {
    setBackendErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateField = (field, value) => {
    clearBackendError(field);
    setForm((f) => ({ ...f, [field]: value }));
  };

  const getDisplayError = (field) => {
    if (backendErrors[field]) return backendErrors[field];
    const stepNum = FIELD_STEP[field] ?? 0;
    const stepFieldErrors = validateStep(stepNum);
    if (touchedFields[field] && stepFieldErrors[field]) return stepFieldErrors[field];
    return null;
  };

  const next = () => {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setTouchedFields((prev) => {
        const nextTouched = { ...prev };
        (STEP_FIELDS[step] || []).forEach((field) => {
          nextTouched[field] = true;
        });
        return nextTouched;
      });
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      email: form.email.trim().toLowerCase(),
      telephone: form.telephone.trim() || undefined,
      motDePasse: form.motDePasse,
      role: form.role,
      forceChangeOnFirstLogin: form.forceChange,
      sendInviteEmail: form.sendInvite,
    });
  };

  const confirmError = getDisplayError("confirm");
  const showConfirmMatch = touchedFields.confirm && form.confirm && passwordsMatch && !confirmError;

  const stepSubtitle =
    step === 0
      ? "Identité et coordonnées du compte"
      : step === 1
        ? "Rôle et niveau d'accès"
        : "Mot de passe et options de sécurité";

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="user-create-root"
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

        <motion.form
          onSubmit={step === 2 ? submit : (e) => e.preventDefault()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-create-title"
          className="relative z-[1] flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={modalStyle}
          onClick={(e) => e.stopPropagation()}
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(125,211,252,0.5), transparent)",
            }}
            aria-hidden
          />

          {/* Header */}
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
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300/60">
                    Gestion des accès
                  </p>
                  <h2 id="user-create-title" className="font-display text-lg font-bold text-white">
                    Nouvel utilisateur
                  </h2>
                  <p className="text-xs text-sky-200/45">{stepSubtitle}</p>
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

          {/* Stepper */}
          <div
            className="flex shrink-0 justify-center gap-3 border-b px-5 py-3"
            style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(8,15,28,0.35)" }}
          >
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5 text-xs">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: i < step ? "rgba(16,185,129,0.85)" : i === step ? "#378ADD" : "rgba(51,65,85,0.8)",
                    color: "#fff",
                    boxShadow: i === step ? "0 4px 12px -4px rgba(55,138,221,0.65)" : undefined,
                  }}
                >
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={i === step ? "font-medium text-sky-100" : "text-sky-200/40"}>{label}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {step === 0 && (
              <motion.div
                className="space-y-4"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <div className="flex items-center gap-4 rounded-xl border border-sky-400/15 bg-slate-900/40 px-4 py-3">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white"
                    style={{ background: colors.bg, boxShadow: "0 8px 20px -8px rgba(0,0,0,0.45)" }}
                  >
                    {userInitials(previewUser) || <User className="h-6 w-6" />}
                  </div>
                  <p className="text-xs text-sky-200/45">Aperçu de l&apos;avatar en temps réel</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Prénom *</FieldLabel>
                    <input
                      required
                      className={inputCls}
                      style={{ ...inputBorder, ...(getDisplayError("prenom") ? inputErrorStyle : {}) }}
                      value={form.prenom}
                      placeholder="Ex. : Jean"
                      onChange={(e) => updateField("prenom", e.target.value)}
                      onBlur={() => touchField("prenom")}
                    />
                    <FormFieldError message={getDisplayError("prenom")} />
                  </div>
                  <div>
                    <FieldLabel>Nom *</FieldLabel>
                    <input
                      required
                      className={inputCls}
                      style={{ ...inputBorder, ...(getDisplayError("nom") ? inputErrorStyle : {}) }}
                      value={form.nom}
                      placeholder="Ex. : Dupont"
                      onChange={(e) => updateField("nom", e.target.value)}
                      onBlur={() => touchField("nom")}
                    />
                    <FormFieldError message={getDisplayError("nom")} />
                  </div>
                  <div className="col-span-2">
                    <FieldLabel>Email *</FieldLabel>
                    <input
                      required
                      type="email"
                      className={inputCls}
                      style={{ ...inputBorder, ...(getDisplayError("email") ? inputErrorStyle : {}) }}
                      value={form.email}
                      placeholder="Ex. : jean.dupont@entreprise.com"
                      onChange={(e) => updateField("email", e.target.value)}
                      onBlur={() => touchField("email")}
                    />
                    <FormFieldError message={getDisplayError("email")} />
                  </div>
                  <div className="col-span-2">
                    <FieldLabel>Téléphone</FieldLabel>
                    <input
                      className={inputCls}
                      style={inputBorder}
                      value={form.telephone}
                      placeholder="Ex. : +216 12 345 678"
                      onChange={(e) => updateField("telephone", e.target.value)}
                      onBlur={() => touchField("telephone")}
                    />
                    <FormFieldError message={getDisplayError("telephone")} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                className="space-y-3"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <FieldLabel>Choisissez le rôle *</FieldLabel>
                <RoleSelector
                  roles={roles}
                  value={form.role}
                  onChange={(role) => {
                    touchField("role");
                    updateField("role", role);
                  }}
                />
                <FormFieldError message={getDisplayError("role")} />
                <p className="rounded-xl border border-sky-400/15 bg-slate-900/40 px-3 py-2 text-xs text-sky-200/45">
                  Sociétés et dépôts : hérités de la société active (configuration avancée à venir).
                </p>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                className="space-y-4"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <PasswordInput
                  label="Mot de passe *"
                  value={form.motDePasse}
                  placeholder="Min. 8 caractères"
                  onChange={(value) => updateField("motDePasse", value)}
                  onBlur={() => touchField("motDePasse")}
                  error={getDisplayError("motDePasse")}
                />
                <PasswordStrength password={form.motDePasse} />
                <PasswordInput
                  label="Confirmation *"
                  value={form.confirm}
                  placeholder="Retapez le mot de passe"
                  onChange={(value) => updateField("confirm", value)}
                  onBlur={() => touchField("confirm")}
                  autoComplete="new-password"
                  error={confirmError}
                />
                {showConfirmMatch && (
                  <p className="text-xs text-emerald-400">Les mots de passe correspondent.</p>
                )}

                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-200/50">
                    Options de sécurité
                  </p>
                  <SecurityOption
                    active={form.forceChange}
                    onClick={() => setForm((f) => ({ ...f, forceChange: !f.forceChange }))}
                    icon={KeyRound}
                    title="Forcer le changement au premier login"
                    description="L'utilisateur devra définir un nouveau mot de passe avant d'accéder à l'application."
                  />
                  <SecurityOption
                    active={form.sendInvite}
                    onClick={() => setForm((f) => ({ ...f, sendInvite: !f.sendInvite }))}
                    icon={Mail}
                    title="Envoyer une invitation par email"
                    description="Un email professionnel avec les identifiants et le lien de connexion sera envoyé automatiquement."
                  />
                  {form.sendInvite ? (
                    <p className="text-xs text-sky-300/90">
                      L&apos;invitation sera envoyée à{" "}
                      <span className="font-medium text-sky-200">
                        {form.email.trim() || "l'e-mail saisi à l'étape Identité"}
                      </span>
                      .
                    </p>
                  ) : (
                    <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Aucun e-mail ne sera envoyé. Vous devrez transmettre les identifiants manuellement à l&apos;utilisateur.
                    </p>
                  )}
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
            className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-4"
            style={{ borderColor: "rgba(56,189,248,0.14)", background: "rgba(8,15,28,0.55)" }}
          >
            <motion.button
              type="button"
              onClick={step === 0 ? onClose : back}
              className="inline-flex items-center gap-1 rounded-xl border border-sky-400/20 px-4 py-2.5 text-sm font-medium text-sky-100/80"
              whileHover={reduceMotion ? undefined : { y: -1, backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <ChevronLeft className="h-4 w-4" />
              {step === 0 ? "Annuler" : "Retour"}
            </motion.button>

            {step < 2 ? (
              <motion.button
                type="button"
                onClick={next}
                className={`${PRIMARY_BTN_CLASSES} rounded-xl py-2.5`}
                style={{ ...primaryButtonStyle, boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)" }}
                whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                disabled={loading || !canSubmit}
                className={`${PRIMARY_BTN_CLASSES} rounded-xl py-2.5 disabled:opacity-50`}
                style={{ ...primaryButtonStyle, boxShadow: "0 8px 22px -8px rgba(55,138,221,0.55)" }}
                whileHover={reduceMotion || loading ? undefined : { y: -2, scale: 1.02 }}
                whileTap={reduceMotion || loading ? undefined : { scale: 0.97 }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Création…" : "Créer le compte"}
              </motion.button>
            )}
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}
