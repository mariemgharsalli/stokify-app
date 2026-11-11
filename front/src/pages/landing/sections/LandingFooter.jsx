import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Clock3,
  Instagram,
  Linkedin,
  Mail,
  Package,
  Warehouse,
} from "lucide-react";
import { SOCIAL_LINKS } from "../landingLocales";
import { useLandingLang } from "../LandingLangContext";
import StokifyFooterShell, {
  CYAN,
  FooterLink,
  LOGO_SRC,
  ORANGE,
  ORANGE_SOFT,
} from "../../../components/ui/StokifyFooterShell";

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

export default function LandingFooter() {
  const { t, lang } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const year = new Date().getFullYear();
  const isRtl = lang === "ar";

  const exploreLinks = [
    { label: t.home, href: "#accueil" },
    { label: t.services, href: "#fonctionnalites" },
    { label: t.about, href: "#apropos" },
    { label: t.navStats, href: "#stats" },
    { label: t.navWhy, href: "#pourquoi" },
    { label: t.projects, href: "#apercu" },
    { label: t.navJourney, href: "#parcours" },
  ];

  const accountLinks = [
    { label: t.login, to: "/login" },
    { label: t.signup, to: "/register" },
  ];

  return (
    <StokifyFooterShell
      waveFill="#ffffff"
      dir={isRtl ? "rtl" : "ltr"}
      backToTopLabel={t.footerBackToTop}
      bottomLeft={
        <p>{t.footerCopyright.replace("{year}", String(year))}</p>
      }
    >
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <a href="#accueil" className="inline-flex items-center gap-3">
              <img
                src={LOGO_SRC}
                alt="Stokify"
                className="h-11 w-auto object-contain object-left drop-shadow-[0_14px_28px_rgba(0,0,0,0.5)] sm:h-12"
              />
            </a>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium tracking-wide text-white/90">
              <Warehouse className="h-3.5 w-3.5" aria-hidden />
              {t.tagline}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/65">{t.footerTagline}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,84,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all duration-200 ease-out hover:-translate-y-1 hover:brightness-110 active:translate-y-0"
              style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_SOFT} 100%)` }}
            >
              {t.signup}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 shadow-[0_12px_28px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-white/35 hover:bg-white/10"
            >
              {t.login}
            </Link>
          </div>
        </div>

        <div className="grid gap-10 py-8 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <nav className="lg:col-span-3" aria-label={t.footerExplore}>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }}
              />
              {t.footerExplore}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {exploreLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="lg:col-span-3" aria-label={t.footerAccount}>
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }}
              />
              {t.footerAccount}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {accountLinks.map((link) => (
                <li key={link.label}>
                  <FooterLink to={link.to}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "#14B8A6", boxShadow: "0 0 8px #14B8A6" }}
              />
              {t.footerContact}
            </p>
            <ul className="mt-4 flex flex-col gap-3 text-sm text-white/70">
              <li>
                <a
                  href={`mailto:${t.email}`}
                  className="inline-flex items-center gap-2.5 transition-colors duration-200 hover:text-white"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                    style={{
                      boxShadow:
                        "0 10px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
                      transform: "rotateX(8deg)",
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {t.email}
                </a>
              </li>
              <li className="inline-flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                  style={{
                    boxShadow:
                      "0 10px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                </span>
                {t.hours}
              </li>
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <Package className="h-3 w-3" style={{ color: ORANGE }} aria-hidden />
              {t.follow}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5" style={{ perspective: 700 }}>
              {SOCIAL_LINKS.map((social) => {
                const Icon = SOCIAL_ICONS[social.id];
                if (!Icon) return null;
                return (
                  <motion.a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/5 text-white/70 transition-colors duration-200 hover:border-white/40 hover:bg-white/15 hover:text-white"
                    style={{
                      boxShadow:
                        "0 12px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
                      transformStyle: "preserve-3d",
                    }}
                    whileHover={
                      reduceMotion
                        ? undefined
                        : { y: -6, rotateX: 16, rotateY: -12, scale: 1.08 }
                    }
                    whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 380, damping: 20 }}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.a>
                );
              })}
            </div>
            <p className="mt-4 max-w-[16rem] text-xs leading-relaxed text-white/45">
              {t.footerSocialNote}
            </p>
          </div>
        </div>
      </div>
    </StokifyFooterShell>
  );
}
