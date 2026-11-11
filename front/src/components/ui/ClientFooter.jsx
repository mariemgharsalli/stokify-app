import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUp,
  ArrowUpRight,
  ClipboardList,
  Heart,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { useClientBranding } from "../../hooks/useClientBranding";
import { clientContactLine, clientLocationLine } from "../../utils/clientBranding";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

const STOKIFY_LOGO = "/home-assets/stokify-logo-home.png";

/**
 * Footer espace client — marque Stokify + fond dégradé bleu.
 * La société (Vitalait…) n’apparaît que comme contact, pas comme logo du site.
 */
export default function ClientFooter() {
  const { t } = useLandingLang();
  const branding = useClientBranding();
  const year = new Date().getFullYear();
  const location = clientLocationLine(branding);
  const contact = clientContactLine(branding);

  const NAV_LINKS = [
    { to: "/articles", label: t.navCatalog, icon: Package },
    { to: "/favoris", label: t.navWishlist, icon: Heart },
    { to: "/panier", label: t.navCart, icon: ShoppingCart },
  ];

  const ACCOUNT_LINKS = [
    { to: "/mes-commandes", label: t.footerMyOrders, icon: ClipboardList },
    { to: "/favoris", label: t.footerMyWishlist, icon: Heart },
    { to: "/profil", label: t.footerMyProfile, icon: UserRound },
  ];

  const TRUST = [
    { icon: ShieldCheck, label: t.footerTrustSecure },
    { icon: Zap, label: t.footerTrustFast },
    { icon: Sparkles, label: t.footerTrustStock },
  ];

  const phones = useMemo(() => {
    const raw = branding?.telephones;
    if (!raw) return [];
    return String(raw)
      .split(/[,;/|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2);
  }, [branding?.telephones]);

  const hasContact =
    (location && location !== "—") ||
    !!branding?.email ||
    phones.length > 0 ||
    !!contact;

  const scrollTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <footer className="client-footer">
      <div className="client-footer__beam" aria-hidden />
      <div className="client-footer__aurora" aria-hidden />
      <div className="client-footer__glow" aria-hidden />
      <span className="client-footer__orb client-footer__orb--a" aria-hidden />
      <span className="client-footer__orb client-footer__orb--b" aria-hidden />

      <div className="client-footer__inner">
        <div className="client-footer__showcase">
          <Link to="/articles" className="client-footer__brand-link" aria-label="Stokify">
            <span className="client-footer__mark">
              <img src={STOKIFY_LOGO} alt="Stokify" className="client-footer__logo" />
            </span>
            <span className="client-footer__brand-copy">
              <span className="client-footer__kicker">{t.footerKicker}</span>
              <span className="client-footer__name">Stokify</span>
              <span className="client-footer__tagline">{t.cFooterTagline}</span>
            </span>
          </Link>
          <ul className="client-footer__trust">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={13} strokeWidth={2.2} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <nav className="client-footer__nav" aria-label={t.footerNav}>
          <p className="client-footer__title">{t.footerNav}</p>
          <ul className="client-footer__links">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="client-footer__link">
                  <span className="client-footer__link-ico">
                    <Icon size={15} strokeWidth={2} aria-hidden />
                  </span>
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="client-footer__account" aria-label={t.footerAccount}>
          <p className="client-footer__title">{t.footerAccount}</p>
          <ul className="client-footer__links">
            {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
              <li key={`${to}-${label}`}>
                <Link to={to} className="client-footer__link">
                  <span className="client-footer__link-ico">
                    <Icon size={15} strokeWidth={2} aria-hidden />
                  </span>
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="client-footer__contact">
          <p className="client-footer__title">{t.footerContact}</p>
          {hasContact ? (
            <ul className="client-footer__contact-list">
              {location && location !== "—" ? (
                <li>
                  <MapPin size={15} strokeWidth={2} aria-hidden />
                  <span>{location}</span>
                </li>
              ) : null}
              {branding?.email ? (
                <li>
                  <Mail size={15} strokeWidth={2} aria-hidden />
                  <a href={`mailto:${branding.email}`}>{branding.email}</a>
                </li>
              ) : null}
              {phones.map((p) => (
                <li key={p}>
                  <Phone size={15} strokeWidth={2} aria-hidden />
                  <a href={`tel:${p.replace(/\s/g, "")}`}>{p}</a>
                </li>
              ))}
              {!branding?.email && phones.length === 0 && contact ? (
                <li>
                  <Mail size={15} strokeWidth={2} aria-hidden />
                  <span>{contact}</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="client-footer__contact-empty">{t.footerHelp}</p>
          )}
          <Link to="/articles" className="client-footer__cta">
            {t.footerDiscover}
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        </div>

        <div className="client-footer__bottom">
          <p className="client-footer__copy">
            © {year} Stokify — {t.footerRights}
          </p>
          <p className="client-footer__powered">Where Stock Meets Intelligence</p>
          <button type="button" className="client-footer__top" onClick={scrollTop}>
            {t.footerBackTop}
            <ArrowUp size={13} aria-hidden />
          </button>
        </div>
      </div>
    </footer>
  );
}
