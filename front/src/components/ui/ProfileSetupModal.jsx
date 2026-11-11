import { useMemo, useState, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  UserCircle,
  Phone,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  MapPin,
  Camera,
} from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useProfileModalStore } from "../../store/profileModalStore";
import { useToastStore } from "../../store/toastStore";
import { avatarColorForUser } from "../../pages/admin/adminTheme";
import { resolveAvatarUrl, uploadAvatarImage } from "../../utils/avatarUtils";
import {
  PROFILE_ACCENT,
  PROFILE_CYAN,
  PROFILE_CSS,
  profileLabel,
  profileBtnGhost,
} from "../../pages/profil/profileTheme";
import { PROFILE_FIELD_CSS, profileFieldEdit } from "../../pages/profil/profileFields";
import LocationPicker from "./LocationPicker";

const EASE = [0.22, 1, 0.36, 1];
const ACCENT = PROFILE_ACCENT;
const CYAN = PROFILE_CYAN;

const SECURITY_STEP = { id: 0, label: "Sécurité", icon: KeyRound };

function buildProfileSteps(isClient) {
  const steps = [
    { id: 1, label: "Identité", icon: UserCircle },
    { id: 2, label: "Contact", icon: Phone },
  ];
  if (isClient) {
    steps.push({ id: 3, label: "Localisation", icon: MapPin });
    steps.push({ id: 4, label: "Prêt", icon: Check });
  } else {
    steps.push({ id: 3, label: "Prêt", icon: Check });
  }
  return steps;
}

const stepPanel = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 28 : -28, filter: "blur(4px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -22 : 22, filter: "blur(3px)" }),
};

function SetupStepper({ steps, step, reduceMotion }) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-0">
        {steps.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border-2"
                  animate={
                    reduceMotion
                      ? undefined
                      : {
                          scale: active ? 1.06 : 1,
                          borderColor: done || active ? ACCENT : "var(--border-default)",
                          background:
                            done || active
                              ? `linear-gradient(145deg, ${ACCENT}, ${CYAN})`
                              : "var(--bg-input)",
                          color: done || active ? "#fff" : "var(--text-muted)",
                          boxShadow:
                            active
                              ? `0 0 0 4px color-mix(in srgb, ${ACCENT} 22%, transparent), 0 10px 22px -10px ${ACCENT}`
                              : "none",
                        }
                  }
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  style={
                    reduceMotion
                      ? {
                          borderColor: done || active ? ACCENT : "var(--border-default)",
                          background:
                            done || active
                              ? `linear-gradient(145deg, ${ACCENT}, ${CYAN})`
                              : "var(--bg-input)",
                          color: done || active ? "#fff" : "var(--text-muted)",
                        }
                      : undefined
                  }
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : <Icon className="h-4 w-4" />}
                  {active && !reduceMotion ? (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ border: `1px solid color-mix(in srgb, ${CYAN} 50%, transparent)` }}
                      animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                      aria-hidden
                    />
                  ) : null}
                </motion.div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: active ? ACCENT : "var(--text-muted)" }}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <div className="mx-1.5 mb-5 h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--border-default)]">
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{ background: `linear-gradient(90deg, ${ACCENT}, ${CYAN})` }}
                    initial={false}
                    animate={{ scaleX: step > s.id ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--border-subtle)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${ACCENT}, ${CYAN})` }}
          initial={false}
          animate={{
            width: `${((steps.findIndex((s) => s.id === step) + 1) / steps.length) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>
    </div>
  );
}

function PrimaryBtn({ children, disabled, onClick, glow }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-45 ${
        glow ? "profile-btn-glow" : ""
      }`}
      style={{
        background: `linear-gradient(135deg, ${ACCENT}, ${CYAN})`,
        boxShadow: `0 12px 28px -12px ${ACCENT}`,
      }}
    >
      {children}
    </motion.button>
  );
}

export default function ProfileSetupModal() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const closeModal = useProfileModalStore((s) => s.closeModal);
  const fileRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const isClient = user?.role === "CLIENT";
  const requiresPasswordChange = Boolean(user?.mustChangePassword);
  const PROFILE_STEPS = useMemo(() => buildProfileSteps(isClient), [isClient]);
  const STEPS = requiresPasswordChange ? [SECURITY_STEP, ...PROFILE_STEPS] : PROFILE_STEPS;
  const readyStep = isClient ? 4 : 3;
  const locationStep = isClient ? 3 : null;

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [step, setStep] = useState(requiresPasswordChange ? 0 : 1);
  const [direction, setDirection] = useState(1);
  const [pwdForm, setPwdForm] = useState({ ancien: "", nouveau: "", confirmation: "" });
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [form, setForm] = useState({
    prenom: user?.prenom || "",
    nom: user?.nom || "",
    poste: user?.poste || "",
    telephone: user?.telephone || "",
    bio: user?.bio || "",
    avatar: user?.avatar || "",
  });
  const [location, setLocation] = useState(null);
  const [saving, setSaving] = useState(false);

  function goTo(next) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function handlePasswordChange() {
    if (!pwdForm.ancien || !pwdForm.nouveau || pwdForm.nouveau !== pwdForm.confirmation) return;
    setPwdSaving(true);
    try {
      await api.patch("auth/change-password", {
        ancienMotDePasse: pwdForm.ancien,
        nouveauMotDePasse: pwdForm.nouveau,
        confirmation: pwdForm.confirmation,
      });
      setAuth(token, { ...user, mustChangePassword: false });
      useToastStore.getState().pushToast("Mot de passe mis à jour avec succès.", "success");
      goTo(1);
    } catch (err) {
      useToastStore.getState().pushToast(
        err?.response?.data?.message || "Impossible de changer le mot de passe",
        "error"
      );
    } finally {
      setPwdSaving(false);
    }
  }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleFinish() {
    setSaving(true);
    try {
      let avatarUrl = form.avatar || null;
      if (avatarFile) {
        const uploaded = await uploadAvatarImage(avatarFile);
        avatarUrl = uploaded?.url || avatarUrl;
      }
      const updated = await api
        .patch("users/me/profile", {
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          poste: form.poste.trim() || null,
          telephone: form.telephone.trim() || null,
          bio: form.bio.trim() || null,
          ...(avatarUrl ? { avatar: avatarUrl } : {}),
          theme: "dark",
        })
        .then((r) => r.data);

      if (isClient && location?.latitude != null && location?.longitude != null) {
        const nomClient = [form.prenom, form.nom].filter(Boolean).join(" ").trim();
        await api.patch("clients/me", {
          adresse: location.adresse || null,
          ville: location.ville || null,
          pays: location.pays || "Tunisie",
          latitude: location.latitude,
          longitude: location.longitude,
          telephone: form.telephone.trim() || null,
          ...(nomClient ? { nom: nomClient } : {}),
        });
      }

      setAuth(token, { ...user, ...updated, profileCompleted: true });
      closeModal();
      useToastStore.getState().pushToast(
        `Bienvenue dans Stokify, ${updated.prenom} ! Votre espace est prêt.`,
        "success"
      );
    } catch (err) {
      useToastStore.getState().pushToast(
        err?.response?.data?.message || "Erreur lors de la sauvegarde du profil",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  const avatarSrc = avatarPreview || resolveAvatarUrl(form.avatar);
  const avatarColors = avatarColorForUser({ ...user, prenom: form.prenom, nom: form.nom });
  const initials = `${form.prenom?.[0] || ""}${form.nom?.[0] || ""}`.toUpperCase();
  const pwdReady =
    pwdForm.ancien.length >= 6 &&
    pwdForm.nouveau.length >= 8 &&
    pwdForm.nouveau === pwdForm.confirmation;
  const locationReady =
    location != null &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude));
  const canContinue =
    step === 1
      ? form.prenom.trim() && form.nom.trim()
      : step === locationStep
        ? locationReady
        : true;

  const title =
    requiresPasswordChange && step === 0
      ? "Sécurisez votre compte"
      : step === locationStep
        ? "Où vous livrer ?"
        : step === readyStep
          ? "Tout est prêt"
          : "Créez votre profil";

  const subtitle =
    requiresPasswordChange && step === 0
      ? "Définissez un mot de passe personnel avant de continuer."
      : step === locationStep
        ? "Placez votre adresse sur la carte — utilisée pour vos livraisons."
        : step === readyStep
          ? "Votre espace Stokify est configuré."
          : "Personnalisez Stokify en quelques étapes";

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4">
      <style>{PROFILE_CSS}{PROFILE_FIELD_CSS}</style>

      <motion.div
        className="absolute inset-0 bg-black/55 backdrop-blur-md dark:bg-black/70"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        aria-hidden
      />

      {/* ambient orbs */}
      {!reduceMotion ? (
        <>
          <motion.div
            className="pointer-events-none absolute left-[12%] top-[18%] h-48 w-48 rounded-full blur-3xl"
            style={{ background: `color-mix(in srgb, ${ACCENT} 28%, transparent)` }}
            animate={{ y: [0, 18, 0], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
          <motion.div
            className="pointer-events-none absolute bottom-[16%] right-[14%] h-56 w-56 rounded-full blur-3xl"
            style={{ background: `color-mix(in srgb, ${CYAN} 22%, transparent)` }}
            animate={{ y: [0, -14, 0], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        </>
      ) : null}

      <motion.div
        className={`relative z-10 w-full overflow-hidden rounded-3xl border ${
          step === locationStep ? "max-w-2xl" : "max-w-lg"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-setup-title"
        style={{
          background: "var(--bg-modal)",
          borderColor: `color-mix(in srgb, ${ACCENT} 28%, var(--border-default))`,
          boxShadow: "0 32px 80px -28px rgba(11, 31, 58, 0.65), var(--shadow-modal)",
          borderLeft: `3px solid ${ACCENT}`,
        }}
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: EASE }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: `radial-gradient(ellipse 60% 70% at 0% 0%, color-mix(in srgb, ${ACCENT} 22%, transparent), transparent 55%), radial-gradient(ellipse 45% 55% at 100% 100%, color-mix(in srgb, ${CYAN} 14%, transparent), transparent 50%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, #0B1F3A, ${ACCENT}, ${CYAN})` }}
          aria-hidden
        />

        {/* Header */}
        <div className="relative border-b border-[var(--border-subtle)] px-6 py-6">
          <motion.div
            className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: `color-mix(in srgb, ${ACCENT} 40%, var(--border-default))`,
              background: `color-mix(in srgb, ${ACCENT} 14%, transparent)`,
              color: ACCENT,
            }}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {requiresPasswordChange ? "Première connexion — sécurité requise" : "Première connexion"}
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={title}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <h2 id="profile-setup-title" className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            </motion.div>
          </AnimatePresence>

          <SetupStepper steps={STEPS} step={step} reduceMotion={reduceMotion} />
        </div>

        {/* Body */}
        <div className={`relative px-6 py-6 ${step === locationStep ? "min-h-[380px]" : "min-h-[300px]"}`}>
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 ? (
              <motion.div
                key="sec"
                custom={direction}
                variants={stepPanel}
                initial={reduceMotion ? false : "enter"}
                animate="center"
                exit={reduceMotion ? undefined : "exit"}
                transition={{ duration: 0.32, ease: EASE }}
                className="space-y-4"
              >
                <p className="text-sm text-[var(--text-secondary)]">
                  Utilisez le mot de passe temporaire reçu, puis choisissez un mot de passe personnel.
                </p>
                {[
                  { key: "ancien", label: "Mot de passe actuel", show: showOldPwd, setShow: setShowOldPwd },
                  { key: "nouveau", label: "Nouveau mot de passe", show: showNewPwd, setShow: setShowNewPwd },
                  {
                    key: "confirmation",
                    label: "Confirmer le mot de passe",
                    show: showConfirmPwd,
                    setShow: setShowConfirmPwd,
                  },
                ].map(({ key, label, show, setShow }, i) => (
                  <motion.div
                    key={key}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.05, duration: 0.3, ease: EASE }}
                  >
                    <label className={profileLabel}>{label}</label>
                    <div className="relative">
                      <input
                        type={show ? "text" : "password"}
                        className={`${profileFieldEdit} pr-11`}
                        value={pwdForm[key]}
                        onChange={(e) => setPwdForm((f) => ({ ...f, [key]: e.target.value }))}
                        autoComplete={key === "ancien" ? "current-password" : "new-password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                        aria-label={show ? "Masquer" : "Afficher"}
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
                {pwdForm.confirmation && pwdForm.nouveau !== pwdForm.confirmation ? (
                  <p className="text-xs text-red-400">Les mots de passe ne correspondent pas.</p>
                ) : null}
              </motion.div>
            ) : null}

            {step === 1 ? (
              <motion.div
                key="id"
                custom={direction}
                variants={stepPanel}
                initial={reduceMotion ? false : "enter"}
                animate="center"
                exit={reduceMotion ? undefined : "exit"}
                transition={{ duration: 0.32, ease: EASE }}
                className="space-y-4"
              >
                <p className="text-sm text-[var(--text-secondary)]">Qui êtes-vous dans l&apos;organisation ?</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={profileLabel}>Prénom</label>
                    <input
                      className={profileFieldEdit}
                      value={form.prenom}
                      onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className={profileLabel}>Nom</label>
                    <input
                      className={profileFieldEdit}
                      value={form.nom}
                      onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className={profileLabel}>Poste / Titre</label>
                  <input
                    className={profileFieldEdit}
                    placeholder="ex: Responsable logistique"
                    value={form.poste}
                    onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))}
                  />
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="contact"
                custom={direction}
                variants={stepPanel}
                initial={reduceMotion ? false : "enter"}
                animate="center"
                exit={reduceMotion ? undefined : "exit"}
                transition={{ duration: 0.32, ease: EASE }}
                className="space-y-5"
              >
                <div className="flex flex-col items-center gap-3 py-2">
                  <motion.button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="group relative"
                    whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                    whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  >
                    <span
                      className="absolute -inset-1 rounded-full opacity-70 blur-[2px]"
                      style={{
                        background: `conic-gradient(from 120deg, ${ACCENT}, ${CYAN}, ${ACCENT})`,
                      }}
                      aria-hidden
                    />
                    {!reduceMotion ? (
                      <motion.span
                        className="absolute -inset-1 rounded-full opacity-40"
                        style={{
                          background: `conic-gradient(from 0deg, transparent, ${CYAN}, transparent)`,
                        }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        aria-hidden
                      />
                    ) : null}
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="Avatar"
                        className="relative h-24 w-24 rounded-full object-cover ring-4 ring-[var(--bg-modal)]"
                      />
                    ) : (
                      <div
                        className="relative flex h-24 w-24 items-center justify-center rounded-full text-2xl font-bold ring-4 ring-[var(--bg-modal)]"
                        style={{ background: avatarColors.bg, color: avatarColors.ring }}
                      >
                        {initials || "?"}
                      </div>
                    )}
                    <span
                      className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-lg"
                      style={{ background: `linear-gradient(145deg, ${ACCENT}, ${CYAN})` }}
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </span>
                  </motion.button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-medium hover:underline"
                    style={{ color: ACCENT }}
                  >
                    Choisir une photo
                  </button>
                </div>
                <div>
                  <label className={profileLabel}>Téléphone</label>
                  <input
                    className={profileFieldEdit}
                    placeholder="+216 XX XXX XXX"
                    value={form.telephone}
                    onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={profileLabel}>Bio courte</label>
                  <textarea
                    rows={3}
                    maxLength={200}
                    className={`${profileFieldEdit} resize-none`}
                    placeholder="Quelques mots sur vous…"
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  />
                </div>
              </motion.div>
            ) : null}

            {step === locationStep ? (
              <motion.div
                key="loc"
                custom={direction}
                variants={stepPanel}
                initial={reduceMotion ? false : "enter"}
                animate="center"
                exit={reduceMotion ? undefined : "exit"}
                transition={{ duration: 0.32, ease: EASE }}
                className="space-y-3"
              >
                <p className="text-sm text-[var(--text-secondary)]">
                  Recherchez votre adresse ou cliquez sur la carte. Vous pourrez la modifier plus tard dans votre
                  profil.
                </p>
                <LocationPicker
                  variant="light"
                  height={240}
                  value={location}
                  onChange={(loc) => {
                    setLocation(loc);
                  }}
                />
                {location?.adresse ? (
                  <div>
                    <label className={profileLabel}>Adresse détectée</label>
                    <input
                      className={profileFieldEdit}
                      value={location.adresse}
                      onChange={(e) => setLocation((l) => (l ? { ...l, adresse: e.target.value } : l))}
                    />
                  </div>
                ) : null}
                {!locationReady ? (
                  <p className="text-xs text-amber-500">Placez un point sur la carte pour continuer.</p>
                ) : null}
              </motion.div>
            ) : null}

            {step === readyStep ? (
              <motion.div
                key="ready"
                custom={direction}
                variants={stepPanel}
                initial={reduceMotion ? false : "enter"}
                animate="center"
                exit={reduceMotion ? undefined : "exit"}
                transition={{ duration: 0.32, ease: EASE }}
                className="flex flex-col items-center justify-center py-6 text-center"
              >
                <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
                  {!reduceMotion ? (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ background: `color-mix(in srgb, ${ACCENT} 22%, transparent)` }}
                      animate={{ scale: [1, 1.25, 1], opacity: [0.45, 0.15, 0.45] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : null}
                  <motion.span
                    className="relative flex h-24 w-24 items-center justify-center rounded-full ring-2"
                    style={{
                      background: `linear-gradient(145deg, color-mix(in srgb, ${ACCENT} 18%, transparent), color-mix(in srgb, ${CYAN} 12%, transparent))`,
                      borderColor: `color-mix(in srgb, ${ACCENT} 35%, transparent)`,
                      boxShadow: `0 0 0 1px color-mix(in srgb, ${ACCENT} 25%, transparent), 0 16px 32px -16px ${ACCENT}`,
                    }}
                    initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                  >
                    <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke={ACCENT} strokeWidth="2" opacity="0.25" />
                      <motion.path
                        d="M8 12l3 3 5-6"
                        stroke={ACCENT}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={reduceMotion ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: 0.2, duration: 0.55, ease: EASE }}
                      />
                    </svg>
                  </motion.span>
                </div>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  Bienvenue,{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${CYAN})`,
                    }}
                  >
                    {form.prenom}
                  </span>{" "}
                  !
                </p>
                <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
                  {isClient && locationReady
                    ? `Votre adresse (${[location.ville, location.pays].filter(Boolean).join(", ") || "carte"}) est enregistrée.`
                    : "Votre espace Stokify est configuré. Vous pouvez commencer à explorer."}
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="relative flex items-center justify-between border-t border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--bg-card)_70%,transparent)] px-6 py-4 backdrop-blur-sm">
          {step > 1 && step < readyStep ? (
            <button type="button" onClick={() => goTo(step - 1)} className={profileBtnGhost}>
              <ChevronLeft className="h-4 w-4" /> Retour
            </button>
          ) : (
            <span />
          )}

          {step === 0 ? (
            <PrimaryBtn onClick={handlePasswordChange} disabled={!pwdReady || pwdSaving} glow>
              {pwdSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Mise à jour…
                </>
              ) : (
                <>
                  Continuer <ChevronRight className="h-4 w-4" />
                </>
              )}
            </PrimaryBtn>
          ) : step < readyStep ? (
            <PrimaryBtn onClick={() => goTo(step + 1)} disabled={!canContinue} glow>
              Continuer <ChevronRight className="h-4 w-4" />
            </PrimaryBtn>
          ) : (
            <PrimaryBtn onClick={handleFinish} disabled={saving} glow>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
                </>
              ) : (
                "Commencer"
              )}
            </PrimaryBtn>
          )}
        </div>
      </motion.div>
    </div>
  );
}
