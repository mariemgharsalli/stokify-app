import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Layers,
  Package,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

/** Default icon + badge by page title (French labels used in PageShell). */
const PAGE_PRESETS = {
  Stock: { icon: Package, badge: "Temps réel" },
  "Mouvements de stock": { icon: Boxes, badge: "Flux" },
  Articles: { icon: Package, badge: "Catalogue" },
  Marques: { icon: Layers, badge: "Référentiel" },
  "Familles & sous-familles": { icon: Layers, badge: "Arborescence" },
  "Ventes & Facturation": { icon: ShoppingCart, badge: "Commercial" },
  "Encours clients": { icon: BarChart3, badge: "Créances" },
  Rapports: { icon: BarChart3, badge: "Analytics" },
  Achats: { icon: Truck, badge: "Approvisionnement" },
  "Achats fournisseurs": { icon: Truck, badge: "Approvisionnement" },
  "Comparaison fournisseurs": { icon: Truck, badge: "Sourcing" },
  Clients: { icon: Users, badge: "Tiers" },
  Fournisseurs: { icon: Building2, badge: "Tiers" },
  Utilisateurs: { icon: Users, badge: "Accès" },
  "Dépôts & Emplacements": { icon: Warehouse, badge: "Logistique" },
  Sociétés: { icon: Building2, badge: "Multi-tenant" },
  Inventaires: { icon: ClipboardList, badge: "Contrôle" },
  Lots: { icon: Package, badge: "Traçabilité" },
  "Numéros de série": { icon: Package, badge: "Traçabilité" },
  "Rappel produit": { icon: Package, badge: "Qualité" },
  "Scan lot": { icon: Package, badge: "Terrain" },
  "Scan terrain": { icon: Package, badge: "Terrain" },
  Valorisation: { icon: BarChart3, badge: "Finance" },
  Comptabilité: { icon: BarChart3, badge: "Finance" },
  Règlements: { icon: BarChart3, badge: "Encaissements" },
  "Tableau de bord": { icon: BarChart3, badge: "Pilotage" },
  "Coûts de stockage": { icon: Warehouse, badge: "Logistique" },
  Rentabilité: { icon: BarChart3, badge: "Performance" },
  "Prévision des ventes": { icon: BarChart3, badge: "IA" },
  "Prévisions de ventes": { icon: BarChart3, badge: "IA" },
  "Optimisation chargement": { icon: Truck, badge: "IA" },
  "Optimisation de charge": { icon: Truck, badge: "Logistique" },
  "Optimisation des emplacements": { icon: Warehouse, badge: "IA" },
  "Optimisation d'emplacements": { icon: Warehouse, badge: "IA" },
  "Détection d'anomalies": { icon: BarChart3, badge: "IA" },
  "Journal d'audit stock": { icon: ClipboardList, badge: "Audit" },
  "Journal d'audit": { icon: ClipboardList, badge: "Audit" },
  Véhicules: { icon: Truck, badge: "Flotte" },
  "Écarts d'inventaire": { icon: ClipboardList, badge: "Contrôle" },
  Rotation: { icon: Boxes, badge: "Stock" },
};

const fadeUp = (reduceMotion, delay = 0) =>
  reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
      };

/**
 * Glass navy page hero — shared across Stokify interfaces (style Sociétés).
 *
 * @param {object} props
 * @param {string|React.ReactNode} props.title
 * @param {string|React.ReactNode} [props.subtitle]
 * @param {import('lucide-react').LucideIcon} [props.icon]
 * @param {string|React.ReactNode} [props.badge]
 * @param {import('lucide-react').LucideIcon} [props.badgeIcon]
 * @param {React.ReactNode} [props.aside] — right glass pill / KPI
 * @param {React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.chips] — live counters under the subtitle
 * @param {React.ReactNode} [props.children] — content below the band (e.g. KPI row)
 */
export default function GlassPageHeader({
  title,
  subtitle,
  icon: IconProp,
  badge: badgeProp,
  badgeIcon: BadgeIconProp,
  aside,
  actions,
  chips,
  children,
  className = "",
}) {
  const reduceMotion = useReducedMotion();
  const { tx } = useLandingLang();
  const titleKey = typeof title === "string" ? title : "";
  const preset = PAGE_PRESETS[titleKey] || {};
  const Icon = IconProp || preset.icon || Layers;
  const badge = badgeProp !== undefined ? badgeProp : preset.badge;
  const BadgeIcon = BadgeIconProp || null;
  const displayTitle = typeof title === "string" ? tx(title) : title;
  const displaySubtitle = typeof subtitle === "string" ? tx(subtitle) : subtitle;
  const displayBadge = typeof badge === "string" ? tx(badge) : badge;

  if (!title) return children ? <>{children}</> : null;

  return (
    <header className={`space-y-6 ${className}`.trim()}>
      <motion.div {...fadeUp(reduceMotion)} className="page-hero">
        <div className="page-hero__grid" aria-hidden />
        <span className="page-hero__orb page-hero__orb--a" aria-hidden />
        <span className="page-hero__orb page-hero__orb--b" aria-hidden />
        <span className="page-hero__orb page-hero__orb--c" aria-hidden />
        <span className="page-hero__sheen" aria-hidden />
        <span className="page-hero__edge" aria-hidden />

        <div className="page-hero__body">
          <div className="page-hero__identity">
            <div className="page-hero__mark" aria-hidden>
              <span className="page-hero__orbit" />
              <Icon className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <div className="page-hero__copy">
              <div className="page-hero__title-row">
                <h1 className="page-hero__title font-display">{displayTitle}</h1>
                {displayBadge ? (
                  <span className="page-hero__badge">
                    <span className="page-hero__dot" aria-hidden />
                    {BadgeIcon ? <BadgeIcon className="h-3 w-3" aria-hidden /> : null}
                    {displayBadge}
                  </span>
                ) : null}
              </div>
              {displaySubtitle ? <p className="page-hero__subtitle">{displaySubtitle}</p> : null}
              {chips ? <div className="page-hero__chips">{chips}</div> : null}
            </div>
          </div>

          {(aside || actions) && (
            <div className="page-hero__actions">
              {aside}
              {actions}
            </div>
          )}
        </div>
      </motion.div>

      {children}
    </header>
  );
}

/** Compact glass aside pill (right side of the hero). */
export function GlassAside({
  icon: Icon,
  label,
  value,
  iconColor = "#6ee7b7",
  iconBg = "rgba(29,158,117,0.2)",
  iconBorder = "rgba(52,211,153,0.35)",
}) {
  const reduceMotion = useReducedMotion();
  const { tx } = useLandingLang();
  const displayLabel = typeof label === "string" ? tx(label) : label;
  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl border px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        borderColor: "rgba(96,165,250,0.22)",
        backdropFilter: "blur(8px)",
      }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
    >
      {Icon ? (
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            background: iconBg,
            color: iconColor,
            border: `1px solid ${iconBorder}`,
          }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
      <div>
        {displayLabel ? (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-200/50">
            {displayLabel}
          </p>
        ) : null}
        <p className="text-sm font-semibold text-white">{value}</p>
      </div>
    </motion.div>
  );
}
