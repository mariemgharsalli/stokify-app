import { useMemo, useState } from "react";
import { Eye, EyeOff, Shield, Lock, KeyRound, Check, X, Fingerprint, Sparkles } from "lucide-react";
import {
  PROFILE_CSS,
  profileGlassCard,
  profileLabel,
  profileBtnBlue,
  profileBtnGhost,
} from "../profileTheme";
import { PROFILE_FIELD_CSS, profileFieldEdit } from "../profileFields";
import FormFieldError, { inputErrorStyle } from "../../../components/ui/FormFieldError";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { changePasswordSchema } from "../../../validation";

const RULES = [
  { id: "len", label: "8 caractères minimum", test: (p) => p.length >= 8 },
  { id: "upper", label: "Une majuscule", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Une minuscule", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "Un chiffre", test: (p) => /[0-9]/.test(p) },
];

function strengthMeta(pwd) {
  const passed = RULES.filter((r) => r.test(pwd)).length;
  if (!pwd) return { score: 0, label: "", color: "#64748b", pct: 0 };
  if (passed <= 1) return { score: 1, label: "Très faible", color: "#ef4444", pct: 25 };
  if (passed === 2) return { score: 2, label: "Faible", color: "#f97316", pct: 45 };
  if (passed === 3) return { score: 3, label: "Correct", color: "#eab308", pct: 70 };
  return { score: 4, label: "Fort", color: "#22c55e", pct: 100 };
}

function PasswordField({ label, value, onChange, showStrength, error, onBlur }) {
  const [show, setShow] = useState(false);
  const meta = showStrength ? strengthMeta(value) : null;

  return (
    <div>
      <label className={profileLabel}>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`${profileFieldEdit} pr-11`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          style={error ? inputErrorStyle : undefined}
          autoComplete={label.includes("Ancien") ? "current-password" : "new-password"}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label={show ? "Masquer" : "Afficher"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <FormFieldError message={error} />
      {showStrength && value && (
        <div className="mt-3 space-y-2">
          <div className="flex h-2 overflow-hidden rounded-full bg-[var(--border-subtle)]">
            <div
              className="profile-meter-seg h-full rounded-full transition-all duration-500"
              style={{ width: `${meta.pct}%`, background: meta.color }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Force : <span style={{ color: meta.color }} className="font-semibold">{meta.label}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function ProfileSecurityPanel({ pwdForm, setPwdForm, onSubmit, isPending }) {
  const values = useMemo(
    () => ({
      ancienMotDePasse: pwdForm.ancienMotDePasse,
      nouveauMotDePasse: pwdForm.nouveauMotDePasse,
      confirmation: pwdForm.confirmation,
    }),
    [pwdForm]
  );
  const { errors, validate, validateField, isValid, clearError } = useFormValidation(
    changePasswordSchema,
    values
  );

  const meta = strengthMeta(pwdForm.nouveauMotDePasse);
  const match = pwdForm.confirmation && pwdForm.nouveauMotDePasse === pwdForm.confirmation;
  const canSubmit = isValid && meta.score >= 3 && !isPending;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <style>{PROFILE_CSS}{PROFILE_FIELD_CSS}</style>

      {/* Panneau principal */}
      <div className={`${profileGlassCard} relative overflow-hidden`}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(55,138,221,0.45) 2px, rgba(55,138,221,0.45) 3px)`,
          }}
        />
        <div className="profile-scan-line pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-sky-500/20 to-transparent" />

        <div className="relative border-b border-[var(--border-subtle)] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="profile-shield-float relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#378ADD]/30 to-[#0EA5E9]/15 ring-1 ring-[#378ADD]/35">
              <Shield className="h-7 w-7 text-[#378ADD]" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Lock className="h-3 w-3" />
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Centre de sécurité</h3>
              <p className="text-sm text-[var(--text-muted)]">Protégez votre compte avec un mot de passe robuste</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-5 p-6 sm:p-8">
          <PasswordField
            label="Ancien mot de passe"
            value={pwdForm.ancienMotDePasse}
            error={errors.ancienMotDePasse}
            onChange={(v) => {
              setPwdForm((f) => ({ ...f, ancienMotDePasse: v }));
              clearError("ancienMotDePasse");
            }}
            onBlur={() => validateField("ancienMotDePasse")}
          />
          <PasswordField
            label="Nouveau mot de passe"
            value={pwdForm.nouveauMotDePasse}
            error={errors.nouveauMotDePasse}
            onChange={(v) => {
              setPwdForm((f) => ({ ...f, nouveauMotDePasse: v }));
              clearError("nouveauMotDePasse");
            }}
            onBlur={() => validateField("nouveauMotDePasse")}
            showStrength
          />
          <div>
            <PasswordField
              label="Confirmer le mot de passe"
              value={pwdForm.confirmation}
              error={errors.confirmation}
              onChange={(v) => {
                setPwdForm((f) => ({ ...f, confirmation: v }));
                clearError("confirmation");
              }}
              onBlur={() => validateField("confirmation")}
            />
            {pwdForm.confirmation && (
              <p
                className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                  match ? "text-emerald-500" : "text-red-400"
                }`}
              >
                {match ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                {match ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-6">
            <button
              type="button"
              onClick={() => {
                if (!validate()) return;
                onSubmit();
              }}
              disabled={!canSubmit}
              className={profileBtnBlue}
              style={{
                background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
                boxShadow: "0 8px 20px -8px rgba(55,138,221,0.55)",
              }}
            >
              <KeyRound className="h-4 w-4" />
              {isPending ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
            <button
              type="button"
              className={profileBtnGhost}
              onClick={() => setPwdForm({ ancienMotDePasse: "", nouveauMotDePasse: "", confirmation: "" })}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Panneau latéral — critères & conseils */}
      <div className="space-y-4">
        <div className={`${profileGlassCard} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-[#378ADD]" />
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Critères de sécurité</h4>
          </div>
          <ul className="space-y-2.5">
            {RULES.map((rule, i) => {
              const ok = rule.test(pwdForm.nouveauMotDePasse);
              return (
                <li
                  key={rule.id}
                  className="flex items-center gap-2.5 text-sm"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                      ok
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-500 profile-check-pop"
                        : "border-[var(--border-default)] bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    }`}
                  >
                    {ok ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />}
                  </span>
                  <span className={ok ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}>{rule.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div
          className={`${profileGlassCard} overflow-hidden p-5`}
          style={{
            background: "linear-gradient(135deg, rgba(55,138,221,0.1) 0%, transparent 60%)",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#378ADD]/15">
              <Sparkles className="h-4 w-4 text-[#378ADD]" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Conseil Stokify</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                Utilisez un mot de passe unique, évitez les informations personnelles et renouvelez-le tous les 90 jours.
              </p>
            </div>
          </div>
        </div>

        <div className={`${profileGlassCard} flex items-center gap-3 p-4`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--success-bg)] text-[var(--success-text)]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Chiffrement</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">Connexion sécurisée SSL</p>
          </div>
        </div>
      </div>
    </div>
  );
}
