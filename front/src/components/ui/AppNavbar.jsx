import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../security/permissions";
import { roleLabel } from "../../security/roleLabels";
import { resolveAvatarUrl } from "../../utils/avatarUtils";
import NotificationBell from "../notifications/NotificationBell";
import DemandesInboxButton from "../demandes/DemandesInboxButton";
import { useNotificationStore } from "../../store/notificationStore";
import AppLanguageSwitcher from "./AppLanguageSwitcher";
import ThemeSwitcher from "./ThemeSwitcher";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

function formatBadge(count) {
  if (!count || count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

function getGreeting(t) {
  const h = new Date().getHours();
  if (h < 12) return t.greetMorning;
  if (h < 18) return t.greetAfternoon;
  return t.greetEvening;
}

function useClickOutside(ref, handler) {
  useEffect(() => {
    function onPointerDown(e) {
      if (!ref.current?.contains(e.target)) handler();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref, handler]);
}

function NavIconButton({ icon: Icon, label, badge, active, onClick }) {
  const badgeLabel = formatBadge(badge);
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`app-navbar-icon-btn${active ? " is-active" : ""}`}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.04 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
    >
      <span className="app-navbar-icon-glow" aria-hidden />
      <Icon size={18} strokeWidth={1.85} />
      {badgeLabel && (
        <motion.span
          className="app-navbar-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18 }}
        >
          {badgeLabel}
        </motion.span>
      )}
    </motion.button>
  );
}

export default function AppNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { t, lang } = useLandingLang();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const profileRef = useRef(null);

  useClickOutside(profileRef, () => setProfileOpen(false));

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("app-navbar-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const avatarSrc = resolveAvatarUrl(user?.avatar);
  const displayName =
    [user?.prenom, user?.nom].filter(Boolean).join(" ").trim() || t.userFallback;
  const initials = `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase() || "U";
  const todayLabel = new Date().toLocaleDateString(t.localeTag || "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    if (hasPermission(role, "stock:read")) {
      navigate("/articles", { state: { navbarSearch: q } });
      return;
    }
    navigate("/dashboard");
  }

  const enter = reduceMotion
    ? { opacity: 1, y: 0 }
    : { opacity: 0, y: -14 };
  const animate = { opacity: 1, y: 0 };

  return (
    <motion.header
      className={`app-navbar${mounted ? " app-navbar--mounted" : ""}`}
      initial={enter}
      animate={animate}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      data-no-i18n
    >
      <div className="app-navbar-ambient" aria-hidden>
        <span className="app-navbar-orb app-navbar-orb--a" />
        <span className="app-navbar-orb app-navbar-orb--b" />
      </div>
      <div className="app-navbar-shine" aria-hidden />

      <div className="app-navbar-inner">
        <div className="app-navbar-left">
          <motion.div
            className="app-navbar-greeting"
            initial={reduceMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
          >
            <span className="app-navbar-greeting-icon">
              <Sparkles size={14} />
            </span>
            <div className="app-navbar-greeting-text">
              <span className="app-navbar-greeting-line">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={lang}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.22 }}
                    className="inline-block"
                  >
                    {getGreeting(t)}, <strong>{user?.prenom || t.greetTeam}</strong>
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="app-navbar-greeting-date">{todayLabel}</span>
            </div>
          </motion.div>
        </div>

        <motion.form
          className={`app-navbar-search${searchFocused ? " is-focused" : ""}${search ? " has-value" : ""}`}
          onSubmit={handleSearchSubmit}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.42 }}
        >
          <Search size={17} className="app-navbar-search-icon" strokeWidth={2} />
          <input
            id="app-navbar-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            className="app-navbar-search-input"
          />
          <kbd className="app-navbar-kbd" aria-hidden>
            Ctrl K
          </kbd>
          <motion.button
            type="submit"
            className="app-navbar-search-btn"
            aria-label={t.searchSubmit}
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.95 }}
          >
            <Search size={16} strokeWidth={2.4} />
          </motion.button>
        </motion.form>

        <motion.div
          className="app-navbar-actions"
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.42 }}
        >
          <div className="app-navbar-actions-pill">
            <div className="app-navbar-theme">
              <ThemeSwitcher compact menuPlacement="down" />
            </div>
            <div
              onPointerDown={() => {
                useNotificationStore.getState().closePanel();
                setProfileOpen(false);
              }}
            >
              <AppLanguageSwitcher />
            </div>
            <NotificationBell />

            <DemandesInboxButton />
          </div>

          <span className="app-navbar-divider" aria-hidden />

          <div className="app-navbar-profile-wrap" ref={profileRef}>
            <motion.button
              type="button"
              onClick={() => {
                useNotificationStore.getState().closePanel();
                setProfileOpen((v) => !v);
              }}
              className={`app-navbar-profile${profileOpen ? " is-open" : ""}`}
              title={t.navProfile}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            >
              <span className="app-navbar-profile-copy">
                <span className="app-navbar-profile-name">{displayName}</span>
                <span className="app-navbar-profile-role">{roleLabel(role)}</span>
              </span>
              <span className="app-navbar-avatar-ring">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="app-navbar-avatar" />
                ) : (
                  <span className="app-navbar-avatar app-navbar-avatar-fallback">{initials}</span>
                )}
              </span>
            </motion.button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  className="app-navbar-dropdown app-navbar-dropdown--profile"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="app-navbar-dropdown-user">
                    <span className="app-navbar-dropdown-user-name">{displayName}</span>
                    <span className="app-navbar-dropdown-user-role">{roleLabel(role)}</span>
                  </div>
                  <button type="button" onClick={() => navigate("/profil")} className="app-navbar-menu-item">
                    <User size={15} /> {t.navProfile}
                  </button>
                  <button type="button" onClick={() => navigate("/dashboard")} className="app-navbar-menu-item">
                    <LayoutDashboard size={15} /> {t.navDashboardShort}
                  </button>
                  <button type="button" onClick={() => navigate("/profil")} className="app-navbar-menu-item">
                    <Settings size={15} /> {t.navSettings}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
