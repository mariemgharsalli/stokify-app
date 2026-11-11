import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
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
  Camera,
  Eye,
  EyeOff,
  Check,
  X,
  Mail,
  Package,
  CreditCard,
  Settings,
  ChevronRight,
  Sun,
  Moon,
  Globe,
} from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { useProfileModalStore } from "../../store/profileModalStore";
import { useThemeStore, THEMES } from "../../store/themeStore";
import { roleLabel } from "../../security/roleLabels";
import { resolveAvatarUrl, uploadAvatarImage } from "../../utils/avatarUtils";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import LocationPicker from "../../components/ui/LocationPicker";
import TierMapPreview from "../tiers/components/TierMapPreview";
import {
  calcProfileCompletion,
  resolveSocieteLabel,
  formatLastLoginShort,
} from "../profil/profileUtils";
import { ACTION_META } from "../profil/profileTheme";
import { useLandingLang } from "../landing/LandingLangContext";

const ACTION_ICONS = {
  LOGIN: LogIn,
  LOGIN_FAIL: Key,
  UPDATE_ROLE: Edit3,
  UPDATE_STATUS: User,
  CREATE: Edit3,
  UPDATE: Edit3,
  DELETE: Trash2,
};

const PWD_RULES = [
  { id: "len", label: "8 caractères min.", test: (p) => p.length >= 8 },
  { id: "upper", label: "Une majuscule", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Une minuscule", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "Un chiffre", test: (p) => /[0-9]/.test(p) },
];

const ORDER_STATUS_LABELS = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EN_PREPARATION: "En préparation",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

function relativeDate(dateStr, localeTag = "fr-FR") {
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
  return d.toLocaleDateString(localeTag, { day: "numeric", month: "short" });
}

function pwdStrength(pwd) {
  const passed = PWD_RULES.filter((r) => r.test(pwd)).length;
  if (!pwd) return { score: 0, label: "", color: "#94a3b8", pct: 0 };
  if (passed <= 1) return { score: 1, label: "Très faible", color: "#ef4444", pct: 25 };
  if (passed === 2) return { score: 2, label: "Faible", color: "#f97316", pct: 45 };
  if (passed === 3) return { score: 3, label: "Correct", color: "#eab308", pct: 70 };
  return { score: 4, label: "Fort", color: "#16a34a", pct: 100 };
}

function Field({ label, value, editing, onChange, placeholder, multiline, emptyLabel }) {
  const empty = !String(value || "").trim();
  return (
    <label className="client-profile-field">
      <span>{label}</span>
      {editing ? (
        multiline ? (
          <textarea
            rows={3}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        )
      ) : (
        <p className={empty ? "is-empty" : ""}>{empty ? placeholder || emptyLabel || "Non renseigné" : value}</p>
      )}
    </label>
  );
}

function PasswordInput({ label, value, onChange, showStrength, showLabel, hideLabel }) {
  const [show, setShow] = useState(false);
  const meta = showStrength ? pwdStrength(value) : null;
  return (
    <div className="client-profile-field">
      <span>{label}</span>
      <div className="client-profile-pwd">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={label.includes("Ancien") ? "current-password" : "new-password"}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? hideLabel || "Masquer" : showLabel || "Afficher"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {showStrength && value && (
        <div className="client-profile-pwd-meter">
          <div style={{ width: `${meta.pct}%`, background: meta.color }} />
          <p>
            Force : <strong style={{ color: meta.color }}>{meta.label}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

export default function ClientProfilPage() {
  const { t, lang, setLang, languages } = useLandingLang();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const openProfileModal = useProfileModalStore((s) => s.openModal);
  const themePreference = useThemeStore((s) => s.preference);
  const setTheme = useThemeStore((s) => s.setTheme);
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const tabs = [
    { id: "info", label: "Mon Profil Client", icon: User },
    { id: "orders", label: "Historique des Commandes", icon: Package },
    { id: "address", label: "Adresse de Livraison", icon: MapPin },
    { id: "payment", label: "Préférence de Paiement", icon: CreditCard },
    { id: "preferences", label: "Préférences", icon: Settings },
  ];

  const PAYMENT_MODES = [
    { value: "VIREMENT", label: t.checkoutPayTransfer || "Virement" },
    { value: "CHEQUE", label: t.checkoutPayCheck || "Chèque" },
    { value: "A_LA_LIVRAISON", label: t.checkoutPayDelivery || "Espèces à la livraison" },
  ];

  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [tab, setTab] = useState("info");
  const [editing, setEditing] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState(null);
  const [addressForm, setAddressForm] = useState({ adresse: "", ville: "", pays: "" });
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

  const { data: myClient } = useQuery({
    queryKey: ["clients-me"],
    queryFn: () => api.get("clients/me").then((r) => r.data),
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["mes-commandes-profile"],
    queryFn: () => api.get("commandes-client", { params: { page: 1, limit: 5 } }).then((r) => r.data),
    enabled: tab === "orders",
  });

  const { data: auditItems = [], isLoading: auditLoading } = useQuery({
    queryKey: ["my-audit-client"],
    queryFn: () => api.get("users/me/audit", { params: { limit: 10 } }).then((r) => r.data),
    enabled: tab === "orders",
  });

  useEffect(() => {
    if (!myClient) return;
    setAddressForm({
      adresse: myClient.adresse || "",
      ville: myClient.ville || "",
      pays: myClient.pays || "",
    });
  }, [myClient]);

  const locationMutation = useMutation({
    mutationFn: (data) => api.patch("clients/me", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-me"] });
      setEditingLocation(false);
      setEditingAddress(false);
      useToastStore.getState().pushToast(t.profileLocationUpdated, "success");
    },
    onError: (err) => {
      useToastStore.getState().pushToast(err?.response?.data?.message || t.profileError, "error");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (modePaiement) => api.patch("clients/me", { modePaiement }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-me"] });
      useToastStore.getState().pushToast("Préférence de paiement enregistrée.", "success");
    },
    onError: (err) => {
      useToastStore.getState().pushToast(err?.response?.data?.message || t.profileError, "error");
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data) => api.patch("users/me/profile", data).then((r) => r.data),
    onSuccess: (updated) => {
      setAuth(token, { ...user, ...updated });
      setEditing(false);
      useToastStore.getState().pushToast(t.profileUpdated, "success");
    },
    onError: (err) => {
      useToastStore.getState().pushToast(err?.response?.data?.message || t.profileError, "error");
    },
  });

  const pwdMutation = useMutation({
    mutationFn: (data) => api.patch("auth/change-password", data).then((r) => r.data),
    onSuccess: () => {
      setPwdForm({ ancienMotDePasse: "", nouveauMotDePasse: "", confirmation: "" });
      useToastStore.getState().pushToast(t.profilePwdUpdated, "success");
    },
    onError: (err) => {
      useToastStore.getState().pushToast(err?.response?.data?.message || t.profileError, "error");
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
        useToastStore.getState().pushToast(t.profilePhotoUpdated, "success");
      })
      .catch(() => setAvatarPreview(""))
      .finally(() => setUploadingAvatar(false));
  }

  function formatOrderDate(d) {
    return new Intl.DateTimeFormat(t.localeTag, { dateStyle: "medium" }).format(new Date(d));
  }

  const avatarSrc = avatarPreview || resolveAvatarUrl(form.avatar || user?.avatar);
  const initials = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase() || "CL";
  const completion = calcProfileCompletion(user);
  const sessions = user?.loginCount ?? 0;
  const pwdMeta = pwdStrength(pwdForm.nouveauMotDePasse);
  const pwdMatch = pwdForm.confirmation && pwdForm.nouveauMotDePasse === pwdForm.confirmation;
  const canPwd =
    pwdForm.ancienMotDePasse &&
    pwdForm.nouveauMotDePasse &&
    pwdMatch &&
    pwdMeta.score >= 3 &&
    !pwdMutation.isPending;
  const recentOrders = ordersData?.items || [];
  const currentPayment = myClient?.modePaiement || "A_LA_LIVRAISON";

  const ringStyle = {
    background: `conic-gradient(#378ADD ${completion * 3.6}deg, rgba(255,255,255,0.18) 0deg)`,
  };

  return (
    <div>
      <div id="client-profile" className="client-profile max-w-5xl mx-auto px-4 sm:px-6 py-8 scroll-mt-20">
        <motion.section
          className="client-profile-hero"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
        >
          <div className="client-profile-hero__pad">
            <div className="client-profile-hero__glow" aria-hidden="true" />
            <div className="client-profile-hero__inner">
              <button
                type="button"
                className="client-profile-avatar"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label={t.profileChangePhoto}
              >
                <span className="client-profile-avatar__ring" style={ringStyle}>
                  <span className="client-profile-avatar__core">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" />
                    ) : (
                      <span className="client-profile-avatar__initials">{initials}</span>
                    )}
                  </span>
                </span>
                <span className="client-profile-avatar__cam">
                  <Camera className="w-3.5 h-3.5" />
                </span>
                <span className="client-profile-avatar__pct">{completion}%</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />

              <div className="client-profile-hero__meta min-w-0">
                <motion.h2
                  className="text-2xl sm:text-3xl font-extrabold truncate"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {user?.prenom} {user?.nom}
                </motion.h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="client-profile-badge">{roleLabel(user?.role)}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-sky-300" />
                    {user?.email}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Cliquez sur l&apos;avatar pour changer votre photo · Profil à{" "}
                  <strong className="text-sky-300">{completion}%</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="client-profile-hero__foot">
            {completion < 100 ? (
              <motion.button
                type="button"
                className="client-profile-complete-btn"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (!user?.profileCompleted) openProfileModal();
                  else {
                    setTab("info");
                    setEditing(true);
                  }
                }}
              >
                <Wand2 className="w-4 h-4" />
                Compléter ({completion}%)
              </motion.button>
            ) : null}

            <div className="client-profile-stats">
              {[
                { icon: MapPin, label: t.profileCompany, value: resolveSocieteLabel(user) },
                { icon: Clock, label: t.profileLastLogin, value: formatLastLoginShort(user?.lastLoginAt) },
                {
                  icon: Activity,
                  label: t.profileSessions,
                  value: `${sessions} session${sessions > 1 ? "s" : ""}`,
                },
                {
                  icon: BadgeCheck,
                  label: t.profileStatus,
                  value: user?.actif !== false ? t.profileActive : t.profileInactive,
                },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  className="client-profile-stat"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.06 }}
                  whileHover={{ y: -3 }}
                >
                  <s.icon className="w-4 h-4" />
                  <div>
                    <p>{s.label}</p>
                    <strong>{s.value}</strong>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="client-profile-tabs" role="tablist">
          {tabs.map((tabItem) => {
            const active = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? "is-active" : ""}
                onClick={() => setTab(tabItem.id)}
              >
                {active && (
                  <motion.span
                    layoutId="client-profile-tab"
                    className="client-profile-tabs__bg"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <tabItem.icon className="w-4 h-4 relative z-[1]" />
                <span className="relative z-[1]">{tabItem.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {tab === "info" && (
            <motion.section
              key="info"
              className={`client-profile-panel ${editing ? "is-editing" : ""}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <h3>{t.profilePersonal}</h3>
                  <p>{t.profilePersonalSub}</p>
                </div>
                {!editing && (
                  <motion.button
                    type="button"
                    className="btn-primary-orange inline-flex items-center gap-2 px-4 py-2.5 text-xs"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t.profileEdit}
                  </motion.button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t.profileFirstName}
                  value={form.prenom}
                  editing={editing}
                  emptyLabel={t.profileNotSet}
                  onChange={(v) => setForm((f) => ({ ...f, prenom: v }))}
                />
                <Field
                  label={t.profileLastName}
                  value={form.nom}
                  editing={editing}
                  emptyLabel={t.profileNotSet}
                  onChange={(v) => setForm((f) => ({ ...f, nom: v }))}
                />
                <Field
                  label={t.profilePhone}
                  value={form.telephone}
                  editing={editing}
                  placeholder="+216 XX XXX XXX"
                  emptyLabel={t.profileNotSet}
                  onChange={(v) => setForm((f) => ({ ...f, telephone: v }))}
                />
                <Field
                  label={t.profileJob}
                  value={form.poste}
                  editing={editing}
                  placeholder="ex: Responsable logistique"
                  emptyLabel={t.profileNotSet}
                  onChange={(v) => setForm((f) => ({ ...f, poste: v }))}
                />
                <div className="sm:col-span-2">
                  <Field
                    label={t.profileBio}
                    value={form.bio}
                    editing={editing}
                    multiline
                    placeholder="Quelques mots sur vous…"
                    emptyLabel={t.profileNotSet}
                    onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
                  />
                </div>
              </div>

              {editing && (
                <motion.div
                  className="client-profile-actions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    type="button"
                    className="btn-primary-orange inline-flex items-center gap-2 px-5 py-3 text-sm"
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
                  >
                    <Save className="w-4 h-4" />
                    {profileMutation.isPending ? t.profileSaving : t.profileSave}
                  </button>
                  <button
                    type="button"
                    className="btn-outline-teal px-5 py-3 text-sm"
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
                    {t.profileCancel}
                  </button>
                </motion.div>
              )}
            </motion.section>
          )}

          {tab === "orders" && (
            <motion.section
              key="orders"
              className="client-profile-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <h3>Historique des commandes</h3>
                  <p>Vos dernières commandes et l&apos;activité récente de votre compte.</p>
                </div>
                <button
                  type="button"
                  className="btn-primary-orange inline-flex items-center gap-2 px-4 py-2.5 text-xs"
                  onClick={() => navigate("/mes-commandes")}
                >
                  Voir tout l&apos;historique
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {ordersLoading && (
                <div className="space-y-3 mb-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-16" />
                  ))}
                </div>
              )}

              {!ordersLoading && recentOrders.length === 0 && (
                <p className="client-profile-empty mb-8">Aucune commande pour le moment.</p>
              )}

              <ul className="space-y-3 mb-8">
                {recentOrders.map((cmd, i) => (
                  <motion.li
                    key={cmd.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border p-4 flex flex-wrap items-center gap-3"
                    style={{ borderColor: "var(--client-border)", background: "var(--client-surface)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono-data font-bold text-sm" style={{ color: "var(--brand-teal)" }}>
                        {cmd.reference}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--client-text-muted)" }}>
                        {formatOrderDate(cmd.createdAt)} · {ORDER_STATUS_LABELS[cmd.statut] || cmd.statut}
                      </p>
                    </div>
                    <p className="font-extrabold" style={{ color: "var(--brand-orange)" }}>
                      {formatMoneyTnd(cmd.montantTTC)}
                    </p>
                    <Link
                      to={`/mes-commandes/${cmd.id}`}
                      className="text-xs font-semibold inline-flex items-center gap-1"
                      style={{ color: "var(--brand-blue)" }}
                    >
                      Détail <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </motion.li>
                ))}
              </ul>

              <div className="pt-6 border-t" style={{ borderColor: "var(--client-border)" }}>
                <h3 className="mb-1">Journal d&apos;activité</h3>
                <p className="mb-6">Connexions et actions récentes sur votre compte.</p>
                {auditLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="skeleton h-16" />
                    ))}
                  </div>
                )}
                {!auditLoading && auditItems.length === 0 && (
                  <p className="client-profile-empty">Aucune activité enregistrée.</p>
                )}
                <ul className="client-profile-timeline">
                  {auditItems.map((item, i) => {
                    const meta = ACTION_META[item.action] || { label: item.action };
                    const Icon = ACTION_ICONS[item.action] || Activity;
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span className="client-profile-timeline__icon">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{meta.label}</p>
                          <p className="text-xs truncate" style={{ color: "var(--client-text-muted)" }}>
                            {item.description || item.module || "—"}
                          </p>
                        </div>
                        <span className="text-xs shrink-0" style={{ color: "var(--client-text-muted)" }}>
                          {relativeDate(item.createdAt, t.localeTag)}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            </motion.section>
          )}

          {tab === "address" && (
            <motion.section
              key="address"
              className={`client-profile-panel ${editingAddress ? "is-editing" : ""}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <h3 className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--brand-teal)]" />
                    Adresse de livraison
                  </h3>
                  <p>Votre adresse unique pour les livraisons de commandes.</p>
                </div>
                {!editingAddress && !editingLocation && (
                  <motion.button
                    type="button"
                    className="btn-primary-orange inline-flex items-center gap-2 px-4 py-2.5 text-xs"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setEditingAddress(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t.profileEdit}
                  </motion.button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    label="Adresse"
                    value={addressForm.adresse}
                    editing={editingAddress}
                    placeholder="Rue, numéro, complément…"
                    emptyLabel="Non renseignée"
                    onChange={(v) => setAddressForm((f) => ({ ...f, adresse: v }))}
                  />
                </div>
                <Field
                  label="Ville"
                  value={addressForm.ville}
                  editing={editingAddress}
                  placeholder="Ville"
                  emptyLabel="Non renseignée"
                  onChange={(v) => setAddressForm((f) => ({ ...f, ville: v }))}
                />
                <Field
                  label="Pays"
                  value={addressForm.pays}
                  editing={editingAddress}
                  placeholder="Pays"
                  emptyLabel="Non renseigné"
                  onChange={(v) => setAddressForm((f) => ({ ...f, pays: v }))}
                />
              </div>

              {editingAddress && (
                <motion.div
                  className="client-profile-actions"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <button
                    type="button"
                    className="btn-primary-orange inline-flex items-center gap-2 px-5 py-3 text-sm"
                    disabled={locationMutation.isPending}
                    onClick={() =>
                      locationMutation.mutate({
                        adresse: addressForm.adresse.trim() || null,
                        ville: addressForm.ville.trim() || null,
                        pays: addressForm.pays.trim() || null,
                        ...(myClient?.latitude != null
                          ? {
                              latitude: Number(myClient.latitude),
                              longitude: Number(myClient.longitude),
                            }
                          : {}),
                      })
                    }
                  >
                    <Save className="w-4 h-4" />
                    {locationMutation.isPending ? t.profileSaving : t.profileSave}
                  </button>
                  <button
                    type="button"
                    className="btn-outline-teal px-5 py-3 text-sm"
                    onClick={() => {
                      setEditingAddress(false);
                      setAddressForm({
                        adresse: myClient?.adresse || "",
                        ville: myClient?.ville || "",
                        pays: myClient?.pays || "",
                      });
                    }}
                  >
                    {t.profileCancel}
                  </button>
                </motion.div>
              )}

              <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--client-border)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3>Localisation sur carte</h3>
                    <p>Affinez votre point de livraison sur la carte.</p>
                  </div>
                  {!editingLocation && (
                    <button
                      type="button"
                      className="btn-outline-teal inline-flex items-center gap-2 px-4 py-2 text-xs"
                      onClick={() => {
                        setLocationDraft(
                          myClient?.latitude != null
                            ? {
                                adresse: myClient.adresse || "",
                                ville: myClient.ville || "",
                                pays: myClient.pays || "",
                                latitude: Number(myClient.latitude),
                                longitude: Number(myClient.longitude),
                              }
                            : null
                        );
                        setEditingLocation(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {myClient?.latitude != null ? t.profileEdit : "Ajouter"}
                    </button>
                  )}
                </div>

                {!editingLocation && myClient?.latitude != null && myClient?.longitude != null && (
                  <div className="client-profile-map">
                    <TierMapPreview
                      latitude={myClient.latitude}
                      longitude={myClient.longitude}
                      nom={[user?.prenom, user?.nom].filter(Boolean).join(" ") || myClient.nom}
                      ville={myClient.ville}
                      pays={myClient.pays}
                      defaultExpanded
                      collapsedHeight={240}
                      expandedHeight={320}
                    />
                  </div>
                )}

                {!editingLocation && (myClient?.latitude == null || myClient?.longitude == null) && (
                  <div className="client-profile-map client-profile-map--empty">
                    <MapPin className="w-8 h-8 opacity-40 mb-2" />
                    <p className="text-sm font-semibold" style={{ color: "var(--brand-teal)" }}>
                      Carte non configurée
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--client-text-muted)" }}>
                      Cliquez sur « Ajouter » pour placer votre adresse.
                    </p>
                  </div>
                )}

                {editingLocation && (
                  <div className="space-y-3">
                    <LocationPicker
                      variant="light"
                      height={260}
                      value={locationDraft}
                      onChange={setLocationDraft}
                    />
                    {locationDraft?.adresse != null && (
                      <label className="client-profile-field">
                        <span>Adresse</span>
                        <input
                          value={locationDraft.adresse}
                          onChange={(e) =>
                            setLocationDraft((l) => (l ? { ...l, adresse: e.target.value } : l))
                          }
                        />
                      </label>
                    )}
                    <div className="client-profile-actions">
                      <button
                        type="button"
                        className="btn-primary-orange inline-flex items-center gap-2 px-5 py-3 text-sm"
                        disabled={
                          locationMutation.isPending ||
                          locationDraft?.latitude == null ||
                          locationDraft?.longitude == null
                        }
                        onClick={() =>
                          locationMutation.mutate({
                            adresse: locationDraft.adresse || null,
                            ville: locationDraft.ville || null,
                            pays: locationDraft.pays || "Tunisie",
                            latitude: locationDraft.latitude,
                            longitude: locationDraft.longitude,
                          })
                        }
                      >
                        <Save className="w-4 h-4" />
                        {locationMutation.isPending ? t.profileSaving : "Enregistrer la carte"}
                      </button>
                      <button
                        type="button"
                        className="btn-outline-teal px-5 py-3 text-sm"
                        onClick={() => setEditingLocation(false)}
                      >
                        {t.profileCancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {tab === "payment" && (
            <motion.section
              key="payment"
              className="client-profile-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="mb-1">Préférence de paiement</h3>
              <p className="mb-6">
                Choisissez votre mode de paiement habituel. Aucune carte bancaire n&apos;est stockée sur
                Stokify.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {PAYMENT_MODES.map((mode) => {
                  const selected = currentPayment === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      disabled={paymentMutation.isPending}
                      onClick={() => paymentMutation.mutate(mode.value)}
                      className="rounded-xl border p-4 text-left transition"
                      style={{
                        borderColor: selected ? "var(--brand-orange)" : "var(--client-border)",
                        background: selected ? "rgba(255, 107, 53, 0.08)" : "var(--client-surface)",
                        boxShadow: selected ? "0 0 0 1px var(--brand-orange)" : "none",
                      }}
                    >
                      <CreditCard
                        className="w-5 h-5 mb-2"
                        style={{ color: selected ? "var(--brand-orange)" : "var(--brand-teal)" }}
                      />
                      <p className="font-semibold text-sm" style={{ color: "var(--client-text)" }}>
                        {mode.label}
                      </p>
                      {selected && (
                        <span
                          className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: "var(--brand-orange)" }}
                        >
                          <Check className="w-3 h-3" /> Actif
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.section>
          )}

          {tab === "preferences" && (
            <motion.section
              key="preferences"
              className="client-profile-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <h3 className="mb-1">Préférences</h3>
              <p className="mb-6">Personnalisez votre expérience et sécurisez votre compte.</p>

              <div className="space-y-6 mb-10">
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--client-border)", background: "var(--client-surface)" }}
                >
                  <p className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: "var(--brand-teal)" }}>
                    {themePreference === THEMES.LIGHT ? (
                      <Sun className="w-4 h-4" />
                    ) : (
                      <Moon className="w-4 h-4" />
                    )}
                    Thème d&apos;affichage
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: THEMES.LIGHT, label: "Clair", icon: Sun },
                      { value: THEMES.DARK, label: "Sombre", icon: Moon },
                      { value: THEMES.AUTO, label: "Système", icon: Settings },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTheme(opt.value)}
                        className="rounded-full px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                        style={{
                          background: themePreference === opt.value ? "var(--brand-orange)" : "var(--client-bg)",
                          color: themePreference === opt.value ? "#fff" : "var(--client-text-muted)",
                          border: `1px solid ${themePreference === opt.value ? "var(--brand-orange)" : "var(--client-border)"}`,
                        }}
                      >
                        <opt.icon className="w-3.5 h-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--client-border)", background: "var(--client-surface)" }}
                >
                  <p className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: "var(--brand-teal)" }}>
                    <Globe className="w-4 h-4" />
                    Langue
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {languages.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setLang(item.code)}
                        className="rounded-full px-4 py-2 text-xs font-semibold transition"
                        style={{
                          background: lang === item.code ? "var(--brand-teal)" : "var(--client-bg)",
                          color: lang === item.code ? "#fff" : "var(--client-text-muted)",
                          border: `1px solid ${lang === item.code ? "var(--brand-teal)" : "var(--client-border)"}`,
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t" style={{ borderColor: "var(--client-border)" }}>
                <h3 className="mb-1">{t.profileTabSecurity}</h3>
                <p className="mb-6">Changez votre mot de passe en toute confiance.</p>
                <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (canPwd) pwdMutation.mutate(pwdForm);
                    }}
                  >
                    <PasswordInput
                      label="Ancien mot de passe"
                      value={pwdForm.ancienMotDePasse}
                      onChange={(v) => setPwdForm((f) => ({ ...f, ancienMotDePasse: v }))}
                      showLabel={t.profileShow}
                      hideLabel={t.profileHide}
                    />
                    <PasswordInput
                      label="Nouveau mot de passe"
                      value={pwdForm.nouveauMotDePasse}
                      onChange={(v) => setPwdForm((f) => ({ ...f, nouveauMotDePasse: v }))}
                      showStrength
                      showLabel={t.profileShow}
                      hideLabel={t.profileHide}
                    />
                    <PasswordInput
                      label="Confirmation"
                      value={pwdForm.confirmation}
                      onChange={(v) => setPwdForm((f) => ({ ...f, confirmation: v }))}
                      showLabel={t.profileShow}
                      hideLabel={t.profileHide}
                    />
                    {pwdForm.confirmation && (
                      <p
                        className="text-xs font-semibold inline-flex items-center gap-1"
                        style={{ color: pwdMatch ? "#16a34a" : "#ef4444" }}
                      >
                        {pwdMatch ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        {pwdMatch ? "Les mots de passe correspondent" : "Ne correspondent pas"}
                      </p>
                    )}
                    <motion.button
                      type="submit"
                      disabled={!canPwd}
                      className="btn-primary-orange inline-flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
                      whileHover={{ scale: canPwd ? 1.02 : 1 }}
                      whileTap={{ scale: canPwd ? 0.98 : 1 }}
                    >
                      <Key className="w-4 h-4" />
                      {pwdMutation.isPending ? "Modification…" : "Mettre à jour"}
                    </motion.button>
                  </form>

                  <aside className="client-profile-tips">
                    <Shield className="w-5 h-5" />
                    <h4>Conseils</h4>
                    <ul>
                      {PWD_RULES.map((r) => {
                        const ok = r.test(pwdForm.nouveauMotDePasse || "");
                        return (
                          <li key={r.id} className={ok ? "is-ok" : ""}>
                            {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {r.label}
                          </li>
                        );
                      })}
                    </ul>
                  </aside>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
