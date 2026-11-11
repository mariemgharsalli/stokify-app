import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Heart,
  Instagram,
  Linkedin,
  LogOut,
  Mail,
  Menu,
  Package,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { SOCIAL_LINKS } from "../landingLocales";
import { useLandingLang } from "../LandingLangContext";
import { useAuthStore } from "../../../store/authStore";
import { useCartStore } from "../../../store/cartStore";
import { resolveAvatarUrl } from "../../../utils/avatarUtils";
import {
  LANDING_NAV_OFFSET,
  LANDING_SECTION_IDS,
  scrollToLandingSection,
  syncLandingHash,
} from "../landingScroll";

const LOGO_SRC = "/home-assets/stokify-logo-home.png";

function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M14 8h3V4.5C16.4 4.3 15.2 4 13.9 4 11.3 4 9.5 5.6 9.5 8.5V11H6.5v4H9.5v9H14v-9h3.2l.5-4H14V8.7c0-.6.2-1.2.9-1.2H14z" />
    </svg>
  );
}

function XIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.725-8.915L2.25 2.25h6.093l4.261 5.697L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

const SOCIAL_ICONS = {
  facebook: FacebookIcon,
  x: XIcon,
  linkedin: Linkedin,
  instagram: Instagram,
};

export function LanguageSwitcher({ variant = "dark" }) {
  const { lang, setLang, t, languages } = useLandingLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = languages.find((l) => l.code === lang) || languages[0];
  const light = variant === "light";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.lang}
        className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 ${
          light
            ? "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#F97316]/40 hover:bg-orange-50"
            : "border-white/25 bg-white/10 text-white backdrop-blur-sm hover:border-[#F97316]/50 hover:bg-white/20"
        }`}
      >
        <img
          src={current.flagSrc}
          alt=""
          aria-hidden
          className="h-5 w-5 rounded-full object-cover shadow-sm ring-1 ring-black/10"
          draggable={false}
        />
        <span className="tracking-wide">{current.short}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          } ${light ? "text-slate-400" : "text-white/60"}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={t.lang}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`absolute right-0 top-[calc(100%+8px)] z-[60] min-w-[190px] overflow-hidden rounded-xl border py-1.5 shadow-2xl backdrop-blur-xl ${
              light
                ? "border-slate-200 bg-white/98 shadow-slate-900/15"
                : "border-white/20 bg-[#0B3A44]/85 shadow-black/40"
            }`}
          >
            {languages.map((item) => {
              const selected = item.code === lang;
              return (
                <li key={item.code} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      setLang(item.code);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12px] transition-colors duration-150 ${
                      selected
                        ? light
                          ? "bg-orange-50 text-[#0B3A44]"
                          : "bg-[#F97316]/20 text-white"
                        : light
                          ? "text-slate-600 hover:bg-slate-50 hover:text-[#0B3A44]"
                          : "text-white/85 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <img
                      src={item.flagSrc}
                      alt=""
                      aria-hidden
                      className="h-7 w-7 rounded-full object-cover shadow-sm ring-1 ring-black/10"
                      draggable={false}
                    />
                    <span className="flex-1 font-medium">{item.label}</span>
                    <span
                      className={`text-[10px] font-bold tracking-wider ${
                        light ? "text-slate-400" : "text-white/45"
                      }`}
                    >
                      {item.short}
                    </span>
                    {selected && <Check className="h-3.5 w-3.5 text-[#F97316]" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function LandingDiscoverMenu({ label, links, active, onNavigate, pillId }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const isSectionActive = links.some((link) => link.href === active);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <li ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative z-10 inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors duration-200 ease-out ${
          isSectionActive ? "text-[#0B3A44]" : "text-slate-600 hover:text-[#0B3A44]"
        }`}
      >
        {label}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {isSectionActive && (
        <motion.span
          layoutId={pillId}
          className="absolute inset-0 rounded-full bg-[#0B3A44]/10 ring-1 ring-[#0B3A44]/15"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-[calc(100%+8px)] z-[60] min-w-[220px] overflow-hidden rounded-xl border border-slate-200/80 bg-white/98 py-1.5 shadow-xl shadow-slate-900/15 backdrop-blur-xl"
          >
            {links.map((link) => {
              const selected = active === link.href;
              return (
                <li key={link.href} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      setOpen(false);
                      onNavigate(e, link.href);
                    }}
                    className={`flex w-full px-3.5 py-2.5 text-left text-[12px] font-semibold transition-colors duration-150 ${
                      selected
                        ? "bg-orange-50 text-[#0B3A44]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-[#0B3A44]"
                    }`}
                  >
                    {link.label}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * Navbar partagée — portfolio (landing) et espace client.
 * @param {"landing"|"client"} variant
 */
export default function LandingNavbar({ variant = "landing" }) {
  const isClient = variant === "client";
  const { t } = useLandingLang();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("#accueil");
  const [badgePop, setBadgePop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  /** Hotbar opaque — pages client sans photo pleine largeur derrière (texte blanc lisible). */
  const onProfile =
    location.pathname === "/profil" || location.pathname.startsWith("/profil/");
  const onArticleDetail = /^\/articles\/[^/]+$/.test(location.pathname);
  const isSolidHotbar = isClient && (onProfile || onArticleDetail);

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const items = useCartStore((s) => s.items);
  const lastAddedAt = useCartStore((s) => s.lastAddedAt);
  const syncFromServer = useCartStore((s) => s.syncFromServer);
  const hydratedFromServer = useCartStore((s) => s.hydratedFromServer);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const totalItems = items.reduce((sum, i) => sum + Number(i.quantite || 0), 0);

  const landingPrimaryLinks = [
    { label: t.home, href: "#accueil" },
    { label: t.services, href: "#fonctionnalites" },
    { label: t.about, href: "#apropos" },
    { label: t.projects, href: "#apercu" },
  ];

  const landingDiscoverLinks = [
    { label: t.navStats, href: "#stats" },
    { label: t.navWhy, href: "#pourquoi" },
    { label: t.navJourney, href: "#parcours" },
  ];

  const landingMobileLinks = useMemo(
    () =>
      LANDING_SECTION_IDS.map((id) => ({
        href: `#${id}`,
        label: {
          accueil: t.home,
          fonctionnalites: t.services,
          apropos: t.about,
          stats: t.navStats,
          pourquoi: t.navWhy,
          apercu: t.projects,
          parcours: t.navJourney,
        }[id],
      })),
    [t.home, t.services, t.about, t.navStats, t.navWhy, t.projects, t.navJourney]
  );

  const clientLinks = [
    { to: "/articles", label: t.navCatalog, icon: Package },
    { to: "/favoris", label: t.navWishlist, icon: Heart },
    { to: "/mes-commandes", label: t.navOrders, icon: ClipboardList },
    { to: "/profil", label: t.navProfile, icon: UserRound },
  ];

  const initials = useMemo(() => {
    const a = String(user?.prenom || "").trim().charAt(0);
    const b = String(user?.nom || "").trim().charAt(0);
    return (a + b || "CL").toUpperCase();
  }, [user?.prenom, user?.nom]);

  const avatarSrc = useMemo(() => resolveAvatarUrl(user?.avatar), [user?.avatar]);

  useEffect(() => {
    if (!isClient || user?.role !== "CLIENT" || hydratedFromServer) return;
    syncFromServer();
  }, [isClient, user?.role, hydratedFromServer, syncFromServer]);

  useEffect(() => {
    if (!isClient || !lastAddedAt) return;
    setBadgePop(true);
    const timer = setTimeout(() => setBadgePop(false), 500);
    return () => clearTimeout(timer);
  }, [isClient, lastAddedAt]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  useEffect(() => {
    if (isClient) return undefined;

    const sectionEls = LANDING_SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!sectionEls.length) return undefined;

    const ratios = new Map();

    const updateActive = () => {
      let bestId = LANDING_SECTION_IDS[0];
      let bestRatio = -1;
      for (const id of LANDING_SECTION_IDS) {
        const ratio = ratios.get(id) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      }
      if (bestRatio > 0) setActive(`#${bestId}`);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        updateActive();
      },
      {
        rootMargin: `-${LANDING_NAV_OFFSET}px 0px -45% 0px`,
        threshold: [0, 0.12, 0.25, 0.4, 0.55, 0.7],
      }
    );

    sectionEls.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isClient, location.pathname]);

  useEffect(() => {
    if (isClient || !location.hash) return undefined;

    const scrollToHash = () => scrollToLandingSection(location.hash, "auto");
    const t1 = window.setTimeout(scrollToHash, 80);
    const t2 = window.setTimeout(scrollToHash, 350);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isClient, location.pathname, location.hash]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const navigateToSection = (e, href) => {
    e.preventDefault();
    closeMenu();
    setActive(href);
    syncLandingHash(href);
    scrollToLandingSection(href);
  };

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  const logoHref = isClient ? "/articles" : "#accueil";
  const pillId = isClient ? "client-nav-pill" : "nav-pill";
  const menuId = isClient ? "client-mobile-menu" : "landing-mobile-menu";

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-[100]"
    >
      {/* Hotbar */}
      <AnimatePresence>
        {!scrolled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="relative z-[55] hidden overflow-visible sm:block"
          >
            <div
              className={`relative border-b border-white/15 backdrop-blur-md ${
                isSolidHotbar ? "" : "bg-transparent"
              }`}
              style={
                isSolidHotbar
                  ? {
                      background:
                        "linear-gradient(155deg, #081828 0%, #0b1f3a 40%, #0B3A44 78%, #071525 100%)",
                    }
                  : undefined
              }
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent" />

              <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/80">
                  <a
                    href={`mailto:${t.email}`}
                    className="inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-[#F97316]"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[#F97316] ring-1 ring-white/15">
                      <Mail className="h-3 w-3" aria-hidden />
                    </span>
                    <span className="truncate font-medium">{t.email}</span>
                  </a>
                  <span className="hidden h-3 w-px bg-white/20 md:block" aria-hidden />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/75 ring-1 ring-white/15">
                      <Clock3 className="h-3 w-3" aria-hidden />
                    </span>
                    <span className="hidden lg:inline">{t.hours}</span>
                    <span className="lg:hidden">{t.hoursShort}</span>
                  </span>
                  <span className="hidden items-center gap-1.5 text-white/50 xl:inline-flex">
                    <span className="h-1 w-1 rounded-full bg-[#F97316]" />
                    {t.tagline}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <LanguageSwitcher variant="dark" />

                  <span className="h-4 w-px bg-white/20" aria-hidden />

                  <div className="flex items-center gap-1" aria-label={t.follow}>
                    {SOCIAL_LINKS.map((social) => {
                      const Icon = SOCIAL_ICONS[social.id];
                      return (
                        <motion.a
                          key={social.id}
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={social.label}
                          whileHover={{ y: -2, scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-sm transition-colors duration-200 hover:border-[#F97316]/60 hover:bg-[#F97316] hover:text-white"
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </motion.a>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 pt-2 sm:px-4 sm:pt-2.5 lg:px-6">
        <motion.nav
          layout
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={`mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3 transition-all duration-300 ease-out sm:px-4 ${
            scrolled
              ? "border border-slate-200/70 bg-white/90 py-1.5 shadow-lg shadow-slate-900/15 backdrop-blur-xl"
              : "border border-white/40 bg-white/90 py-2 shadow-md shadow-slate-900/10 backdrop-blur-md"
          }`}
        >
          {isClient ? (
            <Link to={logoHref} className="group flex shrink-0 items-center" onClick={closeMenu}>
              <motion.img
                layout
                src={LOGO_SRC}
                alt="Stokify"
                className={`w-auto object-contain object-left transition-all duration-300 ease-out ${
                  scrolled ? "h-7 sm:h-8" : "h-8 sm:h-9"
                }`}
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.2 }}
              />
            </Link>
          ) : (
            <a
              href={logoHref}
              className="group flex shrink-0 items-center"
              onClick={(e) => navigateToSection(e, "#accueil")}
            >
              <motion.img
                layout
                src={LOGO_SRC}
                alt="Stokify"
                className={`w-auto object-contain object-left transition-all duration-300 ease-out ${
                  scrolled ? "h-7 sm:h-8" : "h-8 sm:h-9"
                }`}
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.2 }}
              />
            </a>
          )}

          {isClient ? (
            <ul className="relative hidden items-center gap-0.5 md:flex">
              {clientLinks.map(({ to, label, icon: Icon }) => (
                <li key={to} className="relative">
                  <NavLink to={to} className="relative z-10 block">
                    {({ isActive }) => (
                      <span
                        className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors duration-200 ease-out ${
                          isActive ? "text-[#0B3A44]" : "text-slate-600 hover:text-[#0B3A44]"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId={pillId}
                            className="absolute inset-0 rounded-full bg-[#0B3A44]/10 ring-1 ring-[#0B3A44]/15"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          />
                        )}
                        <Icon className="relative z-10 h-3.5 w-3.5" />
                        <span className="relative z-10">{label}</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="relative hidden items-center gap-0.5 lg:flex">
              {landingPrimaryLinks.slice(0, 3).map((link) => {
                const isActive = active === link.href;
                return (
                  <li key={link.href} className="relative">
                    <a
                      href={link.href}
                      onClick={(e) => navigateToSection(e, link.href)}
                      className={`relative z-10 block rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors duration-200 ease-out ${
                        isActive ? "text-[#0B3A44]" : "text-slate-600 hover:text-[#0B3A44]"
                      }`}
                    >
                      {link.label}
                    </a>
                    {isActive && (
                      <motion.span
                        layoutId={pillId}
                        className="absolute inset-0 rounded-full bg-[#0B3A44]/10 ring-1 ring-[#0B3A44]/15"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </li>
                );
              })}
              <LandingDiscoverMenu
                label={t.navDiscover}
                links={landingDiscoverLinks}
                active={active}
                onNavigate={navigateToSection}
                pillId={pillId}
              />
              {landingPrimaryLinks.slice(3).map((link) => {
                const isActive = active === link.href;
                return (
                  <li key={link.href} className="relative">
                    <a
                      href={link.href}
                      onClick={(e) => navigateToSection(e, link.href)}
                      className={`relative z-10 block rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors duration-200 ease-out ${
                        isActive ? "text-[#0B3A44]" : "text-slate-600 hover:text-[#0B3A44]"
                      }`}
                    >
                      {link.label}
                    </a>
                    {isActive && (
                      <motion.span
                        layoutId={pillId}
                        className="absolute inset-0 rounded-full bg-[#0B3A44]/10 ring-1 ring-[#0B3A44]/15"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="hidden items-center gap-2 md:flex">
            {scrolled && <LanguageSwitcher variant="light" />}

            {isClient ? (
              <>
                <button
                  type="button"
                  onClick={openDrawer}
                  className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition-all duration-200 ease-out hover:bg-slate-100"
                  aria-label={`${t.navCart} — ${totalItems}`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{t.navCart}</span>
                  <AnimatePresence>
                    {totalItems > 0 && (
                      <motion.span
                        key={lastAddedAt || "badge"}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: badgePop ? 1.15 : 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 18 }}
                        className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F97316] px-1 text-[10px] font-bold text-white"
                      >
                        {totalItems > 99 ? "99+" : totalItems}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <Link
                  to="/profil"
                  className="hidden items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 transition-colors hover:bg-slate-100 md:flex"
                  title={user?.email || ""}
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover ring-2 ring-[#0B3A44]/15"
                    />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0B3A44] text-[11px] font-bold text-white">
                      {initials}
                    </span>
                  )}
                  <span className="flex flex-col leading-tight">
                    <span className="text-[11px] font-semibold text-[#0B3A44]">
                      {[user?.prenom, user?.nom].filter(Boolean).join(" ") || "Client"}
                    </span>
                    <span className="text-[10px] text-slate-500">{t.navClientSpace}</span>
                  </span>
                </Link>

                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F97316] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-orange-900/20 transition-colors duration-200 ease-out hover:bg-[#ea6a0c]"
                    aria-label={t.navLogout}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden xl:inline">{t.navLogout}</span>
                  </button>
                </motion.div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-all duration-200 ease-out hover:bg-slate-100"
                >
                  {t.login}
                </Link>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/register"
                    className="inline-flex items-center rounded-full bg-[#F97316] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-md shadow-orange-900/20 transition-colors duration-200 ease-out hover:bg-[#ea6a0c]"
                  >
                    {t.signup}
                  </Link>
                </motion.div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            {isClient && (
              <button
                type="button"
                onClick={openDrawer}
                className="relative inline-flex items-center justify-center rounded-xl p-1.5 text-slate-800 transition-colors duration-200 ease-out hover:bg-slate-100"
                aria-label={`${t.navCart} — ${totalItems}`}
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F97316] px-1 text-[9px] font-bold text-white">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
            )}
            <LanguageSwitcher variant="light" />
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl p-1.5 text-slate-800 transition-colors duration-200 ease-out hover:bg-slate-100"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? t.menuClose : t.menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </motion.nav>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id={menuId}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="mx-3 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#0B3A44]/90 shadow-xl backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col gap-0.5 p-2">
              {isClient
                ? clientLinks.map(({ to, label, icon: Icon }, i) => (
                    <motion.li
                      key={to}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25, ease: "easeOut" }}
                    >
                      <NavLink
                        to={to}
                        onClick={closeMenu}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ease-out ${
                            isActive
                              ? "bg-white/15 text-[#F97316]"
                              : "text-white/90 hover:bg-white/10 hover:text-[#F97316]"
                          }`
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </NavLink>
                    </motion.li>
                  ))
                : landingMobileLinks.map((link, i) => {
                    const isActive = active === link.href;
                    return (
                    <motion.li
                      key={link.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25, ease: "easeOut" }}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => navigateToSection(e, link.href)}
                        className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ease-out ${
                          isActive
                            ? "bg-white/15 text-[#F97316]"
                            : "text-white/90 hover:bg-white/10 hover:text-[#F97316]"
                        }`}
                      >
                        {link.label}
                      </a>
                    </motion.li>
                    );
                  })}

              <li className="flex items-center justify-center gap-2 border-t border-white/10 px-2 py-3">
                {SOCIAL_LINKS.map((social) => {
                  const Icon = SOCIAL_ICONS[social.id];
                  return (
                    <a
                      key={social.id}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:border-[#F97316]/50 hover:bg-[#F97316] hover:text-white"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </li>

              {isClient ? (
                <li className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      openDrawer();
                    }}
                    className="rounded-xl border border-white/20 px-3 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    {t.navCart}
                    {totalItems > 0 ? ` (${totalItems})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      handleLogout();
                    }}
                    className="rounded-xl bg-[#F97316] px-3 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    {t.navLogout}
                  </button>
                </li>
              ) : (
                <li className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to="/login"
                    onClick={closeMenu}
                    className="rounded-xl border border-white/20 px-3 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    {t.login}
                  </Link>
                  <Link
                    to="/register"
                    onClick={closeMenu}
                    className="rounded-xl bg-[#F97316] px-3 py-2.5 text-center text-sm font-semibold text-white"
                  >
                    {t.signup}
                  </Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
