import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  User,
  Activity,
  Shield,
  Save,
  Pencil,
  LogIn,
  Edit3,
  Trash2,
  Key,
  MapPin,
  Clock,
  Wand2,
  BadgeCheck,
  Sparkles,
} from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { useProfileModalStore } from "../../store/profileModalStore";
import { roleLabel } from "../../security/roleLabels";
import { avatarColorForUser } from "../admin/adminTheme";
import { resolveAvatarUrl, uploadAvatarImage } from "../../utils/avatarUtils";
import ThemeSwitcher from "../../components/ui/ThemeSwitcher";
import GlassPageHeader from "../../components/ui/GlassPageHeader";
import ClientProfilPage from "../client/ClientProfilPage";
import ProfileProgressAvatar from "./components/ProfileProgressAvatar";
import ProfileSparkline from "./components/ProfileSparkline";
import ProfileFormField from "./components/ProfileFormField";
import ProfileSecurityPanel from "./components/ProfileSecurityPanel";
import {
  calcProfileCompletion,
  resolveSocieteLabel,
  formatLastLoginShort,
  buildSparklinePoints,
} from "./profileUtils";
import {
  PROFILE_CSS,
  PROFILE_ACCENT,
  PROFILE_CYAN,
  profilePage,
  profileGlassHero,
  profileGlassCard,
  profileMiniStat,
  profileBtnBlue,
  profileBtnOutlineBlue,
  profileBtnEditGlow,
  profileBtnGhost,
  profileTabBar,
  ACTION_META,
  ACTION_TONE,
} from "./profileTheme";
import { PROFILE_FIELD_CSS } from "./profileFields";

const TABS = [
  { id: "info", label: "Informations", icon: User },
  { id: "activity", label: "Activité", icon: Activity },
  { id: "security", label: "Sécurité", icon: Shield },
];

const ACTION_ICONS = {
  LOGIN: LogIn,
  LOGIN_FAIL: Key,
  UPDATE_ROLE: Edit3,
  UPDATE_STATUS: User,
  CREATE: Edit3,
  UPDATE: Edit3,
  DELETE: Trash2,
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

function relativeDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function MiniStat({ icon: Icon, value, sub, caption, extra, accent = PROFILE_ACCENT, index = 0, pulse }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      whileHover={reduceMotion ? undefined : { y: -4 }}
      className={`${profileMiniStat} ${pulse ? "profile-kpi-pulse" : ""}`}
      style={
        pulse
          ? { borderColor: `${accent}55`, boxShadow: `0 0 0 1px ${accent}22` }
          : undefined
      }
    >
      <motion.span
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ background: accent }}
        initial={reduceMotion ? false : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.12 + index * 0.05, duration: 0.4 }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${accent}12 0%, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative pl-2.5">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `linear-gradient(145deg, ${accent}22, transparent)`,
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}33`,
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
          {extra}
        </div>
        <p className="mt-2.5 truncate text-sm font-semibold text-[var(--text-primary)]">{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</p> : null}
        <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {caption}
        </p>
        <motion.div
          className="mt-2 h-px origin-left"
          style={{
            background: `linear-gradient(90deg, ${accent}55, transparent)`,
          }}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2 + index * 0.05, duration: 0.45 }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}

export default function ProfilPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === "CLIENT") return <ClientProfilPage />;
  return <StaffProfilPage />;
}

function StaffProfilPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const openProfileModal = useProfileModalStore((s) => s.openModal);
  const reduceMotion = useReducedMotion();
  const fileRef = useRef(null);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tab, setTab] = useState("info");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    prenom: user?.prenom || "",
    nom: user?.nom || "",
    telephone: user?.telephone || "",
    poste: user?.poste || "",
    bio: user?.bio || "",
    avatar: user?.avatar || "",
  });
  const [pwdForm, setPwdForm] = useState({
    ancienMotDePasse: "",
    nouveauMotDePasse: "",
    confirmation: "",
  });

  const { data: auditItems = [] } = useQuery({
    queryKey: ["my-audit"],
    queryFn: () => api.get("users/me/audit", { params: { limit: 10 } }).then((r) => r.data),
    enabled: tab === "activity",
  });

  const profileMutation = useMutation({
    mutationFn: (data) => api.patch("users/me/profile", data).then((r) => r.data),
    onSuccess: (updated) => {
      setAuth(token, { ...user, ...updated });
      setEditing(false);
      useToastStore.getState().pushToast("Profil mis à jour", "success");
    },
    onError: (err) => {
      useToastStore.getState().pushToast(err?.response?.data?.message || "Erreur", "error");
    },
  });

  const pwdMutation = useMutation({
    mutationFn: (data) => api.patch("auth/change-password", data).then((r) => r.data),
    onSuccess: () => {
      setPwdForm({ ancienMotDePasse: "", nouveauMotDePasse: "", confirmation: "" });
      useToastStore.getState().pushToast("Mot de passe modifié", "success");
    },
    onError: (err) => {
      useToastStore.getState().pushToast(err?.response?.data?.message || "Erreur", "error");
    },
  });

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setUploadingAvatar(true);
    uploadAvatarImage(file)
      .then((data) => {
        if (data?.url) setForm((f) => ({ ...f, avatar: data.url }));
        if (data?.user) setAuth(token, { ...user, ...data.user });
        useToastStore.getState().pushToast("Photo mise à jour", "success");
      })
      .catch(() => setAvatarPreview(""))
      .finally(() => setUploadingAvatar(false));
  }

  const avatarSrc = avatarPreview || resolveAvatarUrl(form.avatar || user?.avatar);
  const avatarColors = avatarColorForUser(user);
  const initials = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase();
  const completion = calcProfileCompletion(user);
  const sparkPoints = buildSparklinePoints(user?.loginCount);
  const sessions = user?.loginCount ?? 0;
  const trendPct = sessions > 1 ? Math.min(99, Math.round((sessions / Math.max(sessions - 1, 1)) * 8)) : 0;

  return (
    <div className={profilePage}>
      <style>{PROFILE_CSS}{PROFILE_FIELD_CSS}</style>

      <div className="relative mx-auto max-w-[1140px] px-4 py-6 sm:px-6 lg:px-8">
        <GlassPageHeader
          className="mb-6"
          title="Mon Profil"
          subtitle={`Gestion de stock — ${resolveSocieteLabel(user)}`}
          icon={User}
          badge="Espace personnel"
          actions={
            <>
              <ThemeSwitcher compact />
              {completion < 100 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!user?.profileCompleted) openProfileModal();
                    else {
                      setTab("info");
                      setEditing(true);
                    }
                  }}
                  className={profileBtnOutlineBlue}
                >
                  <Wand2 className="h-4 w-4" />
                  Compléter le profil
                </button>
              ) : null}
            </>
          }
        />

        {/* Hero glass navy */}
        <motion.section
          className={`${profileGlassHero} mb-6`}
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <div
            className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-7"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, #0B1F3A 90%, #378ADD), color-mix(in srgb, #0B1F3A 92%, #0EA5E9))",
            }}
          >
            <div className="profile-hero-mesh pointer-events-none absolute inset-0" aria-hidden />
            <Sparkles
              className="pointer-events-none absolute -bottom-4 -right-2 h-28 w-28 text-white opacity-[0.07]"
              strokeWidth={1}
              aria-hidden
            />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
              <div className="flex shrink-0 justify-center lg:justify-start">
                <ProfileProgressAvatar
                  src={avatarSrc}
                  initials={initials}
                  colors={avatarColors}
                  percent={completion}
                  uploading={uploadingAvatar}
                  onClick={() => fileRef.current?.click()}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                />
              </div>

              <div className="min-w-0 flex-1 text-center lg:text-left">
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  {user?.prenom} {user?.nom}
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span
                    className="rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                    style={{
                      background: `linear-gradient(135deg, ${PROFILE_ACCENT}, ${PROFILE_CYAN})`,
                    }}
                  >
                    {roleLabel(user?.role)}
                  </span>
                  <span className="text-sm text-slate-300">{user?.email}</span>
                </div>
                {user?.poste ? (
                  <p className="mt-2 text-sm text-sky-200/80">{user.poste}</p>
                ) : null}
                <p className="mt-3 text-xs text-slate-400">
                  Cliquez sur l&apos;avatar pour changer votre photo · Profil complété à{" "}
                  <strong className="text-sky-300">{completion}%</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-4">
            <MiniStat
              index={0}
              icon={MapPin}
              value={resolveSocieteLabel(user)}
              caption="Société"
              accent={PROFILE_ACCENT}
            />
            <MiniStat
              index={1}
              icon={Clock}
              value={formatLastLoginShort(user?.lastLoginAt)}
              caption="Dernière connexion"
              accent={PROFILE_CYAN}
            />
            <MiniStat
              index={2}
              icon={Activity}
              value={`${sessions} session${sessions > 1 ? "s" : ""}`}
              caption="Activité"
              accent="#1D9E75"
              extra={
                <div className="flex flex-col items-end gap-0.5">
                  {trendPct > 0 ? (
                    <span className="text-[10px] font-bold text-emerald-500">+{trendPct}%</span>
                  ) : null}
                  <ProfileSparkline points={sparkPoints} />
                </div>
              }
            />
            <MiniStat
              index={3}
              icon={BadgeCheck}
              value={user?.profileCompleted ? "Vérifié" : "En cours"}
              caption="Statut"
              sub={user?.actif !== false ? "Compte actif" : "Compte inactif"}
              accent={user?.profileCompleted ? "#1D9E75" : "#EF9F27"}
              pulse={!user?.profileCompleted}
            />
          </div>
        </motion.section>

        {/* Tabs */}
        <motion.nav
          className={`${profileTabBar} mb-6`}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="profile-tab-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${PROFILE_ACCENT}, ${PROFILE_CYAN})`,
                      boxShadow: "0 8px 18px -8px rgba(55,138,221,0.55)",
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <t.icon className="relative z-[1] h-4 w-4" />
                <span className="relative z-[1]">{t.label}</span>
              </button>
            );
          })}
        </motion.nav>

        {/* Panels */}
        <AnimatePresence mode="wait">
          {tab === "info" && (
            <motion.div
              key="info"
              className={`${profileGlassCard} p-6 sm:p-8 ${
                editing ? "ring-1 ring-[rgba(55,138,221,0.35)]" : ""
              }`}
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.28 }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  background:
                    "radial-gradient(ellipse 50% 40% at 0% 0%, rgba(55,138,221,0.1), transparent 55%)",
                }}
                aria-hidden
              />
              <div className="relative mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Informations personnelles
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Mettez à jour vos coordonnées et votre présentation professionnelle.
                  </p>
                </div>
                {!editing ? (
                  <motion.button
                    type="button"
                    onClick={() => setEditing(true)}
                    className={profileBtnEditGlow}
                    whileHover={reduceMotion ? undefined : { y: -2 }}
                  >
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </motion.button>
                ) : null}
              </div>

              <div className="relative grid gap-5 sm:grid-cols-2">
                <ProfileFormField
                  label="Prénom"
                  value={form.prenom}
                  editing={editing}
                  onChange={(v) => setForm((f) => ({ ...f, prenom: v }))}
                />
                <ProfileFormField
                  label="Nom"
                  value={form.nom}
                  editing={editing}
                  onChange={(v) => setForm((f) => ({ ...f, nom: v }))}
                />
                <ProfileFormField
                  label="Téléphone"
                  value={form.telephone}
                  editing={editing}
                  placeholder="+216 XX XXX XXX"
                  onChange={(v) => setForm((f) => ({ ...f, telephone: v }))}
                />
                <ProfileFormField
                  label="Poste"
                  value={form.poste}
                  editing={editing}
                  placeholder="ex: Responsable logistique"
                  onChange={(v) => setForm((f) => ({ ...f, poste: v }))}
                />
                <div className="sm:col-span-2">
                  <ProfileFormField
                    label="Bio"
                    value={form.bio}
                    editing={editing}
                    multiline
                    placeholder="Quelques mots sur vous…"
                    onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
                  />
                </div>
              </div>

              {editing ? (
                <motion.div
                  className="relative mt-8 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-6"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    type="button"
                    disabled={profileMutation.isPending}
                    onClick={() =>
                      profileMutation.mutate({
                        nom: form.nom.trim(),
                        prenom: form.prenom.trim(),
                        telephone: form.telephone.trim() || null,
                        poste: form.poste.trim() || null,
                        bio: form.bio.trim() || null,
                      })
                    }
                    className={profileBtnBlue}
                    style={{
                      background: `linear-gradient(135deg, ${PROFILE_ACCENT}, ${PROFILE_CYAN})`,
                      boxShadow: "0 8px 20px -8px rgba(55,138,221,0.55)",
                    }}
                  >
                    <Save className="h-4 w-4" />
                    {profileMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
                  </button>
                  <button
                    type="button"
                    className={profileBtnGhost}
                    onClick={() => {
                      setEditing(false);
                      setForm({
                        prenom: user?.prenom || "",
                        nom: user?.nom || "",
                        telephone: user?.telephone || "",
                        poste: user?.poste || "",
                        bio: user?.bio || "",
                        avatar: user?.avatar || "",
                      });
                    }}
                  >
                    Annuler
                  </button>
                </motion.div>
              ) : null}
            </motion.div>
          )}

          {tab === "activity" && (
            <motion.div
              key="activity"
              className={`${profileGlassCard} p-6 sm:p-8`}
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.28 }}
            >
              <h3 className="mb-6 text-lg font-semibold text-[var(--text-primary)]">
                Journal d&apos;activité
              </h3>
              {auditItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border-default)] py-16 text-center">
                  <Activity className="mx-auto h-10 w-10 text-sky-400/40" />
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Aucune activité enregistrée.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditItems.map((item, i) => {
                    const meta = ACTION_META[item.action] || { label: item.action, tone: "accent" };
                    const tone = ACTION_TONE[meta.tone] || ACTION_TONE.accent;
                    const Icon = ACTION_ICONS[item.action] || Activity;
                    return (
                      <motion.div
                        key={item.id}
                        className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/50 px-4 py-3 transition-colors hover:border-[rgba(55,138,221,0.35)]"
                        initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.05, 0.35) }}
                        whileHover={reduceMotion ? undefined : { x: 3 }}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tone.border} ${tone.iconBg}`}
                        >
                          <Icon className={`h-4 w-4 ${tone.icon}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {meta.label}
                          </p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {item.description || item.module || "—"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--text-muted)]">
                          {relativeDate(item.createdAt)}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {tab === "security" && (
            <motion.div
              key="security"
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
              transition={{ duration: 0.28 }}
            >
              <ProfileSecurityPanel
                pwdForm={pwdForm}
                setPwdForm={setPwdForm}
                isPending={pwdMutation.isPending}
                onSubmit={() => pwdMutation.mutate(pwdForm)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
