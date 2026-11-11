import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Building2,
  ShieldCheck,
  PackageCheck,
  Truck,
  TrendingUp,
  ArrowRight,
  Loader2,
  X,
  Clock3,
  Home,
  Camera,
} from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import {
  useAuthStore,
  getRememberedEmail,
  saveRememberedEmail,
  clearRememberedEmail,
} from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { postAuthHomePath, postAuthRedirectPath } from "../../security/postAuthRoutes";
import { useQuery } from "@tanstack/react-query";
import { useFormValidation } from "../../hooks/useFormValidation";
import { loginSchema, registerSchema } from "../../validation";
import logoSrc from "../../assets/logo-stokify.png";
import { useLandingLang } from "../landing/LandingLangContext";
import { interpolate } from "../../i18n/languages";
import AppLanguageSwitcher from "../../components/ui/AppLanguageSwitcher";

const HERO_IMAGE = "/cutouts/magasinier.png";

function StatChip({ icon: Icon, value, label, delay = 0 }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl px-4 py-2.5"
      style={{
        background: "rgba(13,17,36,0.65)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.12)",
        animation: `chipFloat 6s ease-in-out infinite ${delay}s`,
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "rgba(79,142,247,0.2)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "#4F8EF7" }} />
      </div>
      <div>
        <p className="text-sm font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

function AccueilButton() {
  const { t } = useLandingLang();
  return (
    <Link
      to="/"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all duration-200 hover:bg-gray-50"
      style={{
        borderColor: "#e2e8f0",
        background: "#ffffff",
        color: "#374151",
      }}
    >
      <Home className="h-4 w-4" style={{ color: "#7c3aed" }} />
      {t.authHome}
    </Link>
  );
}

function EnterpriseAccessNote() {
  const { t } = useLandingLang();
  return (
    <>
      <div
        className="mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3.5"
        style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
      >
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgba(124,58,237,0.08)" }}
        >
          <Building2 className="h-4 w-4" style={{ color: "#7c3aed" }} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-snug" style={{ color: "#0f172a" }}>
            {t.authOrgTitle}
          </p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "#64748b" }}>
            {t.authOrgText}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-1.5">
        <Lock className="h-3 w-3" style={{ color: "#9ca3af" }} />
        <span className="text-xs" style={{ color: "#9ca3af" }}>
          {t.authSecure}
        </span>
      </div>
    </>
  );
}

function StokifyBrandMark({ className = "", variant = "dark" }) {
  const isLight = variant === "light";
  const { t } = useLandingLang();
  return (
    <Link
      to="/"
      aria-label={t.authBackHome}
      className={`inline-flex items-center transition-opacity hover:opacity-90 ${isLight ? "rounded-xl px-7 py-4" : ""} ${className}`}
      style={isLight ? { background: "#0d1124" } : undefined}
    >
      <img
        src={logoSrc}
        alt="Stokify"
        className={`w-auto object-contain object-left ${
          isLight ? "h-[4.5rem] sm:h-28 max-w-[480px]" : "h-28 xl:h-32 max-w-[520px]"
        }`}
      />
    </Link>
  );
}

function BrandPanel() {
  const { t } = useLandingLang();
  return (
    <div
      className="relative hidden lg:flex flex-col justify-between overflow-hidden p-8 xl:p-10"
      style={{ background: "#0d1124" }}
    >
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE}
          alt="Magasinier Stokify"
          className="h-full w-full object-cover object-[center_35%]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(30,58,138,0.5) 0%, rgba(79,142,247,0.35) 45%, rgba(124,58,237,0.45) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(13,17,36,0.82) 0%, rgba(13,17,36,0.15) 32%, rgba(13,17,36,0.1) 58%, rgba(13,17,36,0.88) 100%)",
          }}
        />
      </div>

      <div
        className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(79,142,247,0.22) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex items-center justify-between">
        <StokifyBrandMark />
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            background: "rgba(13,17,36,0.55)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
          </span>
          <span className="text-xs font-medium text-white">{t.authLiveSync}</span>
        </div>
      </div>

      <div className="relative z-10 mt-auto">
        <h2 className="text-2xl xl:text-[1.75rem] font-bold text-white leading-tight mb-2.5">
          {t.authHeroTitle1}
          <br />
          {t.authHeroTitle2}
        </h2>
        <p className="text-sm mb-7 max-w-md" style={{ color: "rgba(255,255,255,0.65)" }}>
          {t.authHeroText}
        </p>

        <div className="flex flex-wrap gap-2.5 mb-7">
          <StatChip icon={PackageCheck} value="+10 000" label={t.authStatArticles} delay={0} />
          <StatChip icon={Truck} value="50+" label={t.authStatDepots} delay={1} />
          <StatChip icon={TrendingUp} value="99%" label={t.authStatAi} delay={2} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.45)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              {t.authEncrypt}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="h-3.5 w-3.5 text-sky-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-xs font-medium text-white">4,9</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              {t.authTeams}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes chipFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

function Field({ label, icon: Icon, trailing, error, ...inputProps }) {
  const [focused, setFocused] = useState(false);
  const { tx } = useLandingLang();
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium" style={{ color: "#374151" }}>
        {label}
      </label>
      <div
        className="relative flex items-center rounded-xl border transition-all duration-200"
        style={{
          borderColor: error ? "#ef4444" : focused ? "#7c3aed" : "#e2e8f0",
          background: "#ffffff",
          boxShadow: focused ? "0 0 0 3px rgba(124,58,237,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <div className="pointer-events-none absolute start-3.5 flex items-center">
          <Icon
            className="h-4 w-4 transition-colors duration-200"
            style={{ color: focused ? "#7c3aed" : "#9ca3af" }}
          />
        </div>
        <input
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          className="h-11 w-full rounded-xl bg-transparent ps-10 pe-4 text-sm outline-none"
          style={{ color: "#0f172a" }}
        />
        {trailing && <div className="absolute end-3 flex items-center">{trailing}</div>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{tx(error)}</p>}
    </div>
  );
}

function PasswordStrength({ password }) {
  const { t } = useLandingLang();
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  if (!password) return null;
  const cfg = [
    null,
    { label: t.authWeak, color: "#ef4444" },
    { label: t.authMedium, color: "#f59e0b" },
    { label: t.authGood, color: "#3b82f6" },
    { label: t.authExcellent, color: "#10b981" },
  ][score];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-400"
            style={{ background: i <= score ? cfg?.color : "#e5e7eb" }}
          />
        ))}
      </div>
      <p className="text-[11px] font-medium" style={{ color: cfg?.color }}>
        {cfg?.label}
      </p>
    </div>
  );
}

function ForgotPasswordModal({ open, initialEmail, onClose }) {
  const { t, tx } = useLandingLang();
  const [email, setEmail] = useState(initialEmail || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail || "");
      setError("");
      setSent(false);
      setLoading(false);
    }
  }, [open, initialEmail]);

  if (!open) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("auth/forgot-password", {
        email: String(email || "").trim().toLowerCase(),
      });
      setSent(true);
      useToastStore.getState().pushToast(
        res.data?.message || t.authForgotToast,
        "success"
      );
    } catch (err) {
      setError(tx(getAxiosErrorMessage(err, t.authForgotFail)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl"
        style={{ borderColor: "#e2e8f0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={t.chatClose}
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-xl font-bold mb-1" style={{ color: "#0f172a" }}>
          {t.authForgotTitle}
        </h2>
        <p className="text-sm mb-5" style={{ color: "#64748b" }}>
          {sent ? t.authForgotSent : t.authForgotAsk}
        </p>

        {sent ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #4F8EF7, #7c3aed)" }}
          >
            {t.authBackLogin}
          </button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label={t.authEmail}
              icon={Mail}
              type="email"
              placeholder={t.authEmailPh}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600"
                style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
              >
                ⚠ {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #4F8EF7, #7c3aed)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.authSending}
                </span>
              ) : (
                t.authSendLink
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ResetPasswordForm({ token }) {
  const navigate = useNavigate();
  const { t, tx, lang } = useLandingLang();
  const [form, setForm] = useState({ motDePasse: "", confirmation: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdC, setShowPwdC] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (form.motDePasse !== form.confirmation) {
      setError(t.authPwdMismatch);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("auth/reset-password", {
        token,
        motDePasse: form.motDePasse,
        confirmation: form.confirmation,
      });
      setDone(true);
      useToastStore.getState().pushToast(t.authResetOkToast, "success");
    } catch (err) {
      setError(tx(getAxiosErrorMessage(err, t.authLinkExpired)));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div style={{ animation: "formRise 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#0f172a" }}>
          {t.authResetInvalid}
        </h1>
        <p className="text-sm mb-5" style={{ color: "#64748b" }}>
          {t.authResetInvalidText}
        </p>
        <button
          type="button"
          onClick={() => navigate("/login", { replace: true })}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #4F8EF7, #7c3aed)" }}
        >
          {t.authBackLogin}
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ animation: "formRise 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#0f172a" }}>
          {t.authResetDone}
        </h1>
        <p className="text-sm mb-5" style={{ color: "#64748b" }}>
          {t.authResetDoneText}
        </p>
        <button
          type="button"
          onClick={() => navigate("/login", { replace: true })}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #4F8EF7, #7c3aed)" }}
        >
          {t.authSignIn}
        </button>
      </div>
    );
  }

  return (
    <div style={{ animation: "formRise 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#0f172a" }}>
          {t.authResetTitle}
        </h1>
        <p className="text-sm" style={{ color: "#64748b" }}>
          {t.authResetHint}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Field
            label={t.authNewPassword}
            icon={Lock}
            type={showPwd ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            value={form.motDePasse}
            onChange={(e) => setForm((f) => ({ ...f, motDePasse: e.target.value }))}
            trailing={
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={showPwd ? t.authHidePwd : t.authShowPwd}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <PasswordStrength password={form.motDePasse} />
        </div>

        <Field
          label={t.authConfirmPassword}
          icon={Lock}
          type={showPwdC ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="new-password"
          value={form.confirmation}
          onChange={(e) => setForm((f) => ({ ...f, confirmation: e.target.value }))}
          trailing={
            <button
              type="button"
              onClick={() => setShowPwdC((v) => !v)}
              className="text-gray-400 hover:text-gray-600"
              aria-label={showPwdC ? t.authHidePwd : t.authShowPwd}
            >
              {showPwdC ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #4F8EF7, #7c3aed)",
            boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.authSaving}
            </span>
          ) : (
            t.authResetSubmit
          )}
        </button>
      </form>
    </div>
  );
}
async function captureLoginPhoto() {
  if (!navigator?.mediaDevices?.getUserMedia) return null;
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => {
      if (video.readyState >= 2) resolve();
      else video.onloadeddata = () => resolve();
    });
    await new Promise((r) => setTimeout(r, 250));

    const srcW = video.videoWidth || 640;
    const srcH = video.videoHeight || 480;
    const maxW = 480;
    const scale = srcW > maxW ? maxW / srcW : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(srcW * scale));
    canvas.height = Math.max(1, Math.round(srcH * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Qualité décroissante pour rester sous la limite serveur (500 Ko)
    for (const quality of [0.65, 0.5, 0.35]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const approxBytes = Math.floor(((dataUrl.split(",").pop() || "").length * 3) / 4);
      if (approxBytes > 0 && approxBytes <= 500 * 1024) return dataUrl;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
    }
  }
}

function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, tx, lang } = useLandingLang();
  const setAuth = useAuthStore((s) => s.setAuth);
  const savedEmail = getRememberedEmail();
  const [form, setForm] = useState({ email: savedEmail, motDePasse: "" });
  const [rememberMe, setRememberMe] = useState(Boolean(savedEmail));
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [echecsConsecutifs, setEchecsConsecutifs] = useState(0);
  const [showCameraConsent, setShowCameraConsent] = useState(false);
  const [cameraDecision, setCameraDecision] = useState(null);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [lockUntilMs, setLockUntilMs] = useState(null);
  const [lockCountdown, setLockCountdown] = useState(0);
  const submitAfterConsentRef = useRef(false);

  const values = useMemo(
    () => ({ email: form.email, motDePasse: form.motDePasse }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError, applyApiErrors } = useFormValidation(
    loginSchema,
    values
  );

  const isLocked = Boolean(lockUntilMs && lockUntilMs > Date.now());

  useEffect(() => {
    if (!lockUntilMs) {
      setLockCountdown(0);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, lockUntilMs - Date.now());
      setLockCountdown(left);
      if (left <= 0) setLockUntilMs(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockUntilMs]);

  const performLogin = useCallback(
    async (photoBase64) => {
      setError("");
      setLoading(true);
      try {
        const email = String(form.email || "").trim().toLowerCase();
        const payload = { email, motDePasse: form.motDePasse };
        if (photoBase64) payload.photoBase64 = photoBase64;
        const res = await api.post("auth/login", payload, { timeout: 30_000 });
        const { token, user } = res.data || {};
        if (!token || !user) {
          setError(t.authInvalidServer);
          return;
        }
        setEchecsConsecutifs(0);
        setCameraDecision(null);
        setPendingPhotoBase64(null);
        setShowCameraConsent(false);
        setLockUntilMs(null);
        if (rememberMe) saveRememberedEmail(email);
        else clearRememberedEmail();
        setAuth(token, user, rememberMe);
        if (user.profileCompleted) {
          const msg =
            user.loginCount > 1
              ? interpolate(t.authWelcomeToast, {
                  name: user.prenom,
                  n: user.loginCount,
                  date: new Date(user.lastLoginAt).toLocaleDateString(t.localeTag || lang),
                })
              : interpolate(t.authWelcomeFirstToast, { name: user.prenom });
          useToastStore.getState().pushToast(msg, "success");
        }
        navigate(postAuthRedirectPath(user?.role, location.state?.from), { replace: true });
      } catch (err) {
        applyApiErrors(err.response?.data);
        const status = err.response?.status;
        const apiMessage = tx(getAxiosErrorMessage(err, t.authBadCredentials));

        if (status === 423) {
          const minutes =
            Number(err.response?.data?.minutesRestantes) ||
            (() => {
              const m = String(apiMessage).match(/(\d+)\s*minute/i);
              return m ? Number(m[1]) : 15;
            })();
          setLockUntilMs(Date.now() + Math.max(1, minutes) * 60 * 1000);
          setError(apiMessage);
          setEchecsConsecutifs(0);
          setPendingPhotoBase64(null);
          setCameraDecision(null);
          return;
        }

        // Compter les vrais échecs d'auth (pas les erreurs réseau)
        if (status === 401 || status === 403) {
          setEchecsConsecutifs((n) => n + 1);
        }

        setError(apiMessage);
      } finally {
        setLoading(false);
      }
    },
    [applyApiErrors, form.email, form.motDePasse, lang, location.state?.from, navigate, rememberMe, setAuth, t, tx]
  );

  async function onSubmit(e) {
    e.preventDefault();
    if (isLocked) return;
    setError("");
    if (!validate()) return;

    // Au 3e essai : demander le consentement caméra AVANT getUserMedia / login.
    if (echecsConsecutifs >= 2 && cameraDecision === null) {
      submitAfterConsentRef.current = true;
      setShowCameraConsent(true);
      return;
    }

    await performLogin(pendingPhotoBase64);
  }

  async function handleAllowCamera() {
    setCapturingPhoto(true);
    try {
      const photo = await captureLoginPhoto();
      setPendingPhotoBase64(photo);
      setCameraDecision(photo ? "allowed" : "skipped");
      setShowCameraConsent(false);
      if (submitAfterConsentRef.current) {
        submitAfterConsentRef.current = false;
        // 3e tentative : envoyer même sans photo pour déclencher verrouillage + mail admin
        await performLogin(photo);
      }
    } catch {
      setPendingPhotoBase64(null);
      setCameraDecision("skipped");
      setShowCameraConsent(false);
      if (submitAfterConsentRef.current) {
        submitAfterConsentRef.current = false;
        await performLogin(null);
      }
    } finally {
      setCapturingPhoto(false);
    }
  }

  async function handleSkipCamera() {
    setPendingPhotoBase64(null);
    setCameraDecision("skipped");
    setShowCameraConsent(false);
    if (submitAfterConsentRef.current) {
      submitAfterConsentRef.current = false;
      await performLogin(null);
    }
  }

  const lockMinutesLeft = Math.max(1, Math.ceil(lockCountdown / 60000));
  const lockSecondsDisplay = Math.max(0, Math.ceil(lockCountdown / 1000));

  return (
    <>
      <ForgotPasswordModal
        open={forgotOpen}
        initialEmail={form.email}
        onClose={() => setForgotOpen(false)}
      />
      {showCameraConsent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.45)" }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl"
            style={{ borderColor: "#e2e8f0" }}
          >
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "rgba(124,58,237,0.1)" }}
            >
              <Camera className="h-6 w-6" style={{ color: "#7c3aed" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>
              {t.authCameraTitle}
            </h2>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: "#64748b" }}>
              {t.authCameraText}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                disabled={capturingPhoto}
                onClick={handleAllowCamera}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #4F8EF7, #7c3aed)" }}
              >
                {capturingPhoto ? (
                  <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t.authCapture}
                    </span>
                ) : (
                  t.authAllow
                )}
              </button>
              <button
                type="button"
                disabled={capturingPhoto}
                onClick={handleSkipCamera}
                className="flex-1 rounded-xl border py-3 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: "#e2e8f0", color: "#374151", background: "#ffffff" }}
              >
                {t.authSkipCamera}
              </button>
            </div>
          </div>
        </div>
      )}
    <div style={{ animation: "formRise 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#0f172a" }}>
          {t.authWelcomeBack}
        </h1>
        <p className="text-sm" style={{ color: "#64748b" }}>
          {t.authWelcomeSub}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={t.authEmail}
          icon={Mail}
          type="email"
          placeholder={t.authEmailPh}
          autoComplete="email"
          value={form.email}
          error={errors.email}
          disabled={isLocked}
          onChange={(e) => {
            setForm((f) => ({ ...f, email: e.target.value }));
            clearError("email");
          }}
          onBlur={() => validateField("email")}
        />
        <Field
          label={t.authPassword}
          icon={Lock}
          type={showPwd ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="current-password"
          value={form.motDePasse}
          error={errors.motDePasse}
          disabled={isLocked}
          onChange={(e) => {
            setForm((f) => ({ ...f, motDePasse: e.target.value }));
            clearError("motDePasse");
          }}
          onBlur={() => validateField("motDePasse")}
          trailing={
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? t.authHidePwd : t.authShowPwd}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isLocked}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded accent-violet-600"
              disabled={isLocked}
            />
            <span className="text-sm" style={{ color: "#64748b" }}>
              {t.authRemember}
            </span>
          </label>
          <button
            type="button"
            className="text-sm font-medium transition-colors"
            style={{ color: "#7c3aed" }}
            onClick={() => setForgotOpen(true)}
            disabled={isLocked}
            onMouseEnter={(e) => {
              e.target.style.color = "#6d28d9";
            }}
            onMouseLeave={(e) => {
              e.target.style.color = "#7c3aed";
            }}
          >
            {t.authForgot}
          </button>
        </div>

        {isLocked && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
            style={{ background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412" }}
          >
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {error ||
                interpolate(t.authLockRetry, {
                  n: lockMinutesLeft,
                  s: lockMinutesLeft > 1 ? "s" : "",
                })}
              <span className="mt-1 block text-xs opacity-80">
                {interpolate(t.authUnlockIn, { n: lockSecondsDisplay })}
              </span>
            </span>
          </div>
        )}

        {error && !isLocked && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !isValid || isLocked}
          className="relative w-full overflow-hidden rounded-xl py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #4F8EF7, #7c3aed)",
            boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
          }}
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t.authSigningIn}
              </>
            ) : isLocked ? (
              <>
                <Lock className="h-4 w-4" /> {t.authLocked}
              </>
            ) : (
              <>
                {t.authSignIn} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </span>
        </button>
        <AccueilButton />
      </form>

      <EnterpriseAccessNote />
    </div>
    </>
  );
}

function PendingValidationCard({ onBackToLogin }) {
  const { t } = useLandingLang();
  return (
    <motion.div
      className="flex flex-col items-center text-center px-2"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
    >
      <motion.div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(145deg, rgba(79,142,247,0.18), rgba(56,189,248,0.12))",
          border: "1px solid rgba(79,142,247,0.35)",
          boxShadow: "0 12px 32px rgba(79,142,247,0.15)",
        }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 20 }}
      >
        <Clock3 className="h-8 w-8" style={{ color: "#4F8EF7" }} />
      </motion.div>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#0f172a" }}>
        {t.authAccountCreated}
      </h1>
      <p className="text-sm leading-relaxed max-w-sm mb-6" style={{ color: "#64748b" }}>
        {t.authPending1}{" "}
        <span style={{ color: "#0f172a", fontWeight: 600 }}>{t.authPendingHighlight}</span>
        {t.authPending2}
      </p>
      <div
        className="w-full rounded-2xl border px-4 py-3 mb-6 text-left text-sm"
        style={{
          background: "rgba(79,142,247,0.06)",
          borderColor: "rgba(79,142,247,0.2)",
          color: "#334155",
        }}
      >
        {t.authPendingAdmin}
      </div>
      <button
        type="button"
        onClick={onBackToLogin}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg, #4F8EF7, #3b6fd4)" }}
      >
        {t.authBackLogin}
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

function RegisterForm() {
  const navigate = useNavigate();
  const { t, tx } = useLandingLang();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    motDePasse: "",
    motDePasseConfirmation: "",
    role: "MAGASINIER",
    societeCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdC, setShowPwdC] = useState(false);
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [pendingValidation, setPendingValidation] = useState(false);

  const values = useMemo(
    () => ({
      nom: form.nom,
      prenom: form.prenom,
      email: form.email,
      motDePasse: form.motDePasse,
      motDePasseConfirmation: form.motDePasseConfirmation,
      role: form.role,
      societeCode: form.societeCode,
    }),
    [form]
  );
  const { errors, validate, validateField, isValid, clearError, applyApiErrors } = useFormValidation(
    registerSchema,
    values
  );

  const { data: companies = [] } = useQuery({
    queryKey: ["public-companies"],
    queryFn: () => api.get("companies/public").then((r) => r.data),
  });

  useEffect(() => {
    if (!companies.length) {
      setForm((f) => ({ ...f, societeCode: "" }));
      return;
    }
    setForm((f) => {
      const codes = companies.map((c) => String(c.code));
      return codes.includes(f.societeCode) ? f : { ...f, societeCode: String(companies[0].code) };
    });
  }, [companies]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.post("auth/register", {
        nom: form.nom,
        prenom: form.prenom,
        email: String(form.email).trim().toLowerCase(),
        motDePasse: form.motDePasse,
        motDePasseConfirmation: form.motDePasseConfirmation,
        role: form.role,
        societeCode: form.societeCode,
      });
      const data = res.data || {};
      if (data.status === "EN_ATTENTE_VALIDATION" || !data.token) {
        setPendingValidation(true);
        return;
      }
      const { token, user } = data;
      if (!token || !user) {
        setError(t.authInvalidServer);
        return;
      }
      useAuthStore.getState().setAuth(token, user);
      navigate(postAuthHomePath(user?.role), { replace: true });
    } catch (err) {
      applyApiErrors(err.response?.data);
      setError(tx(getAxiosErrorMessage(err, t.authRegisterFail)));
    } finally {
      setLoading(false);
    }
  }

  if (pendingValidation) {
    return (
      <PendingValidationCard
        onBackToLogin={() => navigate("/login", { replace: true })}
      />
    );
  }

  const ROLES = [
    { value: "MAGASINIER", label: t.authRoleMagasinier },
    { value: "RESPONSABLE", label: t.authRoleResponsable },
    { value: "COMPTABLE", label: t.authRoleComptable },
    { value: "CLIENT", label: t.authRoleClient },
  ];

  const selectStyle = {
    height: "2.75rem",
    width: "100%",
    borderRadius: "0.75rem",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    paddingLeft: "0.875rem",
    paddingRight: "0.875rem",
    fontSize: "0.875rem",
    color: "#0f172a",
    outline: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  return (
    <div style={{ animation: "formRise 0.5s cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#0f172a" }}>
          {t.authRegisterTitle}
        </h1>
        <p className="text-sm" style={{ color: "#64748b" }}>
          {t.authRegisterSub}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t.authFirstName}
            icon={User}
            placeholder="Jean"
            value={form.prenom}
            error={errors.prenom}
            onChange={(e) => {
              setForm((f) => ({ ...f, prenom: e.target.value }));
              clearError("prenom");
            }}
            onBlur={() => validateField("prenom")}
          />
          <Field
            label={t.authLastName}
            icon={User}
            placeholder="Dupont"
            value={form.nom}
            error={errors.nom}
            onChange={(e) => {
              setForm((f) => ({ ...f, nom: e.target.value }));
              clearError("nom");
            }}
            onBlur={() => validateField("nom")}
          />
        </div>

        <Field
          label={t.authEmail}
          icon={Mail}
          type="email"
          placeholder={t.authEmailPh}
          value={form.email}
          error={errors.email}
          onChange={(e) => {
            setForm((f) => ({ ...f, email: e.target.value }));
            clearError("email");
          }}
          onBlur={() => validateField("email")}
        />

        <div>
          <Field
            label={t.authPassword}
            icon={Lock}
            type={showPwd ? "text" : "password"}
            placeholder="••••••••"
            value={form.motDePasse}
            error={errors.motDePasse}
            onChange={(e) => {
              setForm((f) => ({ ...f, motDePasse: e.target.value }));
              clearError("motDePasse");
            }}
            onBlur={() => validateField("motDePasse")}
            trailing={
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? t.authHidePwd : t.authShowPwd}
                className="text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <PasswordStrength password={form.motDePasse} />
        </div>

        <Field
          label={t.authConfirmPassword}
          icon={Lock}
          type={showPwdC ? "text" : "password"}
          placeholder="••••••••"
          value={form.motDePasseConfirmation}
          error={errors.motDePasseConfirmation}
          onChange={(e) => {
            setForm((f) => ({ ...f, motDePasseConfirmation: e.target.value }));
            clearError("motDePasseConfirmation");
          }}
          onBlur={() => validateField("motDePasseConfirmation")}
          trailing={
            <button
              type="button"
              onClick={() => setShowPwdC((v) => !v)}
              className="text-gray-400 hover:text-gray-600"
            >
              {showPwdC ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "#374151" }}>
              {t.authRole}
            </label>
            <select
              style={selectStyle}
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "#374151" }}>
              {t.authCompany}
            </label>
            <select
              style={selectStyle}
              value={form.societeCode}
              onChange={(e) => setForm((f) => ({ ...f, societeCode: e.target.value }))}
            >
              {companies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nom || c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptCGU}
            onChange={(e) => setAcceptCGU(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-violet-600"
            required
          />
          <span className="text-sm" style={{ color: "#64748b" }}>
            {t.authAcceptTerms}{" "}
            <span className="font-medium underline cursor-pointer" style={{ color: "#7c3aed" }}>
              {t.authTerms}
            </span>{" "}
            {t.authAndPrivacy}
          </span>
        </label>

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-600"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            ⚠ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !acceptCGU || !isValid}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #4F8EF7, #7c3aed)",
            boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
          }}
        >
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {t.authCreating}
              </>
            ) : (
              <>
                {t.authCreateAccount} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </span>
        </button>
        <AccueilButton />
      </form>

      <EnterpriseAccessNote />
    </div>
  );
}

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useLandingLang();
  const isRegister = location.pathname === "/register";
  const isResetPassword = location.pathname === "/reset-password";
  const resetToken = new URLSearchParams(location.search).get("token") || "";
  const [mode, setMode] = useState(isRegister ? "signup" : "login");

  useEffect(() => {
    setMode(location.pathname === "/register" ? "signup" : "login");
  }, [location.pathname]);

  const switchMode = (m) => {
    setMode(m);
    navigate(m === "login" ? "/login" : "/register", { replace: true, state: location.state });
  };

  return (
    <div
      className="grid min-h-screen lg:grid-cols-2"
      style={{ background: "#f8fafc" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <style>{`
        @keyframes formRise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <BrandPanel />

      <div className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="absolute end-6 top-6">
          <AppLanguageSwitcher />
        </div>
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <StokifyBrandMark variant="light" />
          </div>

          <div className="mb-6 flex justify-center">
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5"
              style={{ borderColor: "#e2e8f0", background: "#ffffff" }}
            >
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#7c3aed" }} />
              <span className="text-xs font-medium" style={{ color: "#374151" }}>
                {t.authPlatform}
              </span>
            </div>
          </div>

          {isResetPassword ? (
            <ResetPasswordForm token={resetToken} />
          ) : (
            <>
              <div
                className="mb-7 inline-flex w-full rounded-xl border p-1"
                style={{ borderColor: "#e2e8f0", background: "#f1f5f9" }}
              >
                {[
                  { key: "login", label: t.authLogin },
                  { key: "signup", label: t.authSignup },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => switchMode(tab.key)}
                    className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200"
                    style={{
                      background: mode === tab.key ? "#ffffff" : "transparent",
                      color: mode === tab.key ? "#0f172a" : "#64748b",
                      boxShadow: mode === tab.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {mode === "login" ? <LoginForm key="login" /> : <RegisterForm key="register" />}

              <p className="mt-6 text-center text-sm" style={{ color: "#94a3b8" }}>
                {mode === "login" ? (
                  <>
                    {t.authNoAccount}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="font-medium"
                      style={{ color: "#7c3aed" }}
                    >
                      {t.authSignupFree}
                    </button>
                  </>
                ) : (
                  <>
                    {t.authHasAccount}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="font-medium"
                      style={{ color: "#7c3aed" }}
                    >
                      {t.authSignIn}
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
