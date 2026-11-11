import { useEffect, useMemo, useState, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, LayoutGroup } from "framer-motion";
import api from "../../services/api";
import {
  LayoutDashboard,
  Package,
  Brain,
  Warehouse,
  Boxes,
  ArrowLeftRight,
  BarChart3,
  Building2,
  Calculator,
  ShoppingCart,
  Users,
  Truck,
  UserCircle,
  Layers,
  ScanLine,
  Smartphone,
  Coins,
  TrendingUp,
  ClipboardList,
  CreditCard,
  Receipt,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../security/permissions";
import { isSuperConsoleNavTo } from "../../security/superAdminNav";
import BrandLogo from "../brand/BrandLogo";
import SocieteSelector from "./SocieteSelector";
import { Sidebar3DIcon } from "./Sidebar3D";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

function itemVisible(role, item) {
  if (!role) return false;
  if (item.onlyRoles && !item.onlyRoles.includes(role)) return false;
  if (item.hideRoles?.includes(role)) return false;
  if (item.permissionAny) {
    if (!item.permissionAny.some((p) => hasPermission(role, p))) return false;
  } else if (item.permission && !hasPermission(role, item.permission)) return false;
  return true;
}

function itemLabel(item, role, t) {
  if (role === "CLIENT" && item.labelClientKey && t[item.labelClientKey]) {
    return t[item.labelClientKey];
  }
  if (item.labelKey && t[item.labelKey]) return t[item.labelKey];
  if (role === "CLIENT" && item.labelClient) return item.labelClient;
  return item.label;
}

const CLOSED_GROUPS_KEY = "stokify-sb-closed-groups";

/** Sections métier, dans l’ordre d’un ERP entrepôt. */
const NAV_GROUPS = [
  { id: "pilotage", labelKey: "sidebarGroupPilotage", labelClientKey: "sidebarGroupPortal" },
  { id: "catalogue", labelKey: "sidebarGroupCatalogue" },
  { id: "achats", labelKey: "sidebarGroupAchats" },
  { id: "ventes", labelKey: "sidebarGroupVentes" },
  { id: "entrepot", labelKey: "sidebarGroupEntrepot" },
  { id: "finance", labelKey: "sidebarGroupFinance" },
  { id: "admin", labelKey: "sidebarGroupAdmin" },
];

/** Navigation complète (icônes + permissions). */
const opsNav = [
  { group: "pilotage", to: "/dashboard", icon: LayoutDashboard, label: "Tableau de bord", labelClient: "Accueil", labelKey: "navDashboard", labelClientKey: "navHomeClient" },
  { group: "pilotage", to: "/rapports", icon: BarChart3, label: "Rapports", labelKey: "navRapports", permission: "rapports:read" },
  { group: "pilotage", to: "/ai", icon: Brain, label: "Intelligence IA", labelKey: "navAi", permission: "ai:read" },
  { group: "catalogue", to: "/articles", icon: Boxes, label: "Articles", labelClient: "Catalogue", labelKey: "navArticles", labelClientKey: "navCatalogClient", permission: "stock:read" },
  { group: "achats", to: "/fournisseurs", icon: Truck, label: "Fournisseurs", labelKey: "navFournisseurs", permission: "achats:read", hideRoles: ["CLIENT"] },
  { group: "achats", to: "/achats", icon: ShoppingCart, label: "Achats", labelKey: "navAchats", permission: "achats:read", hideRoles: ["CLIENT"] },
  { group: "ventes", to: "/gestion-clients", icon: UserCircle, label: "Clients", labelKey: "navClients", permission: "ventes:read", hideRoles: ["CLIENT"] },
  { group: "ventes", to: "/ventes", icon: Receipt, label: "Ventes", labelKey: "navVentes", permission: "ventes:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/terrain", icon: Smartphone, label: "Mode terrain", onlyRoles: ["MAGASINIER", "RESPONSABLE", "ADMIN", "SUPER_ADMIN"] },
  { group: "entrepot", to: "/stock", icon: Package, label: "Stock", labelKey: "navStock", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/depots", icon: Warehouse, label: "Dépôts", labelKey: "navDepots", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/lots", icon: Layers, label: "Lots", labelKey: "navLots", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/numeros-serie", icon: ScanLine, label: "N° série", labelKey: "navSeries", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/inventaires", icon: ClipboardList, label: "Inventaires", labelKey: "navInventaires", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/mouvements", icon: ArrowLeftRight, label: "Mouvements", labelKey: "navMouvements", permission: "mouvements:write" },
  { group: "entrepot", to: "/vehicules", icon: Truck, label: "Véhicules", labelKey: "navVehicules", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "entrepot", to: "/rappel-produit", icon: AlertTriangle, label: "Rappel produit", labelKey: "navRappel", permission: "stock:read", hideRoles: ["CLIENT"] },
  { group: "finance", to: "/reglements", icon: CreditCard, label: "Règlements", labelKey: "navReglements", permission: "reglements:write", hideRoles: ["CLIENT"] },
  { group: "finance", to: "/comptabilite", icon: Calculator, label: "Comptabilité", labelKey: "navComptabilite", permission: "accounting:read" },
  { group: "finance", to: "/cout-stockage", icon: Coins, label: "Coût stockage", labelKey: "navCoutStockage", permission: "valorisation:read", hideRoles: ["CLIENT"] },
  { group: "finance", to: "/valorisation", icon: TrendingUp, label: "Valorisation", labelKey: "navValorisation", permission: "valorisation:read", hideRoles: ["CLIENT"] },
  { group: "finance", to: "/rentabilite", icon: TrendingUp, label: "Rentabilité", labelKey: "navRentabilite", permission: "valorisation:read", hideRoles: ["CLIENT"] },
  { group: "admin", to: "/admin", icon: Users, label: "Utilisateurs", labelKey: "navUsers", permission: "users:manage" },
  { group: "admin", to: "/audit", icon: Shield, label: "Journal audit", labelKey: "navAudit", permission: "users:manage" },
  { group: "admin", to: "/superadmin", icon: Building2, label: "Sociétés", labelKey: "navSocietes", onlyRoles: ["SUPER_ADMIN"] },
];

function readClosedGroups() {
  try {
    const raw = localStorage.getItem(CLOSED_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function rememberClosedGroups(groups) {
  localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify([...groups]));
}

function groupLabel(group, role, t) {
  if (role === "CLIENT" && group.labelClientKey && t[group.labelClientKey]) {
    return t[group.labelClientKey];
  }
  if (group.labelKey && t[group.labelKey]) return t[group.labelKey];
  return group.id;
}

export default function Sidebar() {
  const { t } = useLandingLang();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const setActiveSociete = useAuthStore((s) => s.setActiveSociete);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role;
  const isSuper = role === "SUPER_ADMIN";
  const hasSuperSociete = isSuper && activeSocieteId != null && String(activeSocieteId).trim() !== "";
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState(readClosedGroups);

  const { data: companies = [], isPending: companiesLoading } = useQuery({
    queryKey: ["companies", "sidebar-super-admin"],
    queryFn: () => api.get("companies").then((r) => r.data),
    enabled: isSuper && Boolean(token),
  });

  const filtered = useMemo(() => opsNav.filter((item) => itemVisible(role, item)), [role]);
  const superNavLocked = isSuper && !hasSuperSociete;

  const activeGroupId = useMemo(() => {
    const path = location.pathname || "";
    const match = filtered.find((item) =>
      item.to === "/dashboard" ? path === "/dashboard" : path === item.to || path.startsWith(`${item.to}/`)
    );
    return match?.group || null;
  }, [filtered, location.pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!activeGroupId) return;
    setClosedGroups((prev) => {
      if (!prev.has(activeGroupId)) return prev;
      const next = new Set(prev);
      next.delete(activeGroupId);
      rememberClosedGroups(next);
      return next;
    });
  }, [activeGroupId]);

  const toggleGroup = useCallback((id) => {
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      rememberClosedGroups(next);
      return next;
    });
  }, []);

  const groupedNav = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        label: groupLabel(group, role, t),
        items: filtered.filter((item) => item.group === group.id),
      })).filter((group) => group.items.length > 0),
    [filtered, role, t]
  );

  const sidebarInset = 14;
  const sidebarWidth = collapsed ? 84 : 276;
  const spacerWidth = sidebarWidth + sidebarInset * 2;

  const handleNavRipple = useCallback((e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--ripple-x", `${x}%`);
    el.style.setProperty("--ripple-y", `${y}%`);
  }, []);

  return (
    <>
        <aside
        className={`sidebar sb-root${mounted ? " is-mounted" : ""}${collapsed ? " is-collapsed" : ""}`}
        style={{ width: sidebarWidth }}
        data-no-i18n
      >
        <div className="sb-ambient" aria-hidden>
          <span className="sb-orb sb-orb--a" />
          <span className="sb-orb sb-orb--b" />
          <span className="sb-mesh" />
          <span className="sb-filament" />
        </div>
        <div className="sb-shine" aria-hidden />

        <div className="sb-header">
          <div className="sb-brand-card">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              title={collapsed ? t.sidebarExpand : t.sidebarCollapse}
              className={`sb-collapse-btn${collapsed ? " is-collapsed" : ""}`}
              aria-expanded={!collapsed}
            >
              <ChevronLeft size={15} strokeWidth={2.5} />
            </button>
            {!collapsed ? (
              <>
                <div className="sb-brand-logo-wrap">
                  <BrandLogo variant="sidebar" className="sb-brand-logo" />
                </div>
                {!isSuper && user?.societe?.nom ? (
                  <div className="sb-brand-meta-row">
                    <span className="sb-societe-chip" title={user.societe.nom}>
                      {String(user.societe.code || user.societe.nom).trim()}
                    </span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {isSuper && (
          <div className="sb-societe-wrap">
            {!collapsed ? (
              <div className="sb-societe-card">
                <SocieteSelector
                  user={user}
                  value={activeSocieteId}
                  onChange={setActiveSociete}
                  companies={companies}
                  isLoading={companiesLoading}
                />
                {superNavLocked && (
                  <div className="sb-societe-alert">
                    <span className="sb-societe-dot" />
                    {t.sidebarNeedCompany}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/select-societe")}
                title={activeSocieteId ? t.sidebarCompanyActive : t.sidebarPickCompany}
                className="sb-societe-btn-collapsed"
              >
                {activeSocieteId ? "OK" : "!"}
              </button>
            )}
          </div>
        )}

        <nav className="sb-nav sb-scrollbar">
          <LayoutGroup id="sb-nav">
            {groupedNav.map((group, groupIndex) => {
              const open = collapsed || !closedGroups.has(group.id);
              return (
              <div key={group.id} className={`sb-group${open ? "" : " is-closed"}`}>
                {!collapsed && (
                  <button
                    type="button"
                    className="sb-group-label"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={open}
                  >
                    <span>{group.label}</span>
                    <ChevronDown size={13} strokeWidth={2.4} className="sb-group-chevron" />
                  </button>
                )}

                <div className="sb-nav-list">
                  {group.items.map((item, idx) => {
                    const Icon = item.icon;
                    const locked = superNavLocked && !isSuperConsoleNavTo(item.to);
                    const label = itemLabel(item, role, t);
                    const end = item.to === "/dashboard";
                    const delay = 0.04 + groupIndex * 0.06 + idx * 0.025;

                    if (locked) {
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => navigate("/select-societe")}
                          title={collapsed ? label : t.sidebarPickCompany}
                          className="sb-nav-link-locked"
                          style={{ animationDelay: `${delay}s` }}
                        >
                          <Sidebar3DIcon>
                            <Icon size={17} />
                          </Sidebar3DIcon>
                          {!collapsed && <span className="sb-nav-label">{label}</span>}
                        </button>
                      );
                    }

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={end}
                        title={collapsed ? label : undefined}
                        onMouseMove={handleNavRipple}
                        className={({ isActive }) => `sb-nav-link${isActive ? " is-active" : ""}`}
                        style={{ animationDelay: `${delay}s` }}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId="sb-active-indicator"
                                className="sb-active-pill"
                                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                              />
                            )}
                            <span className="sb-active-glow" aria-hidden />
                            <span className="sb-nav-ripple" aria-hidden />
                            <Sidebar3DIcon active={isActive}>
                              <Icon size={17} />
                            </Sidebar3DIcon>
                            {!collapsed && <span className="sb-nav-label">{label}</span>}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </LayoutGroup>
        </nav>

        <div className="sb-footer">
          <button
            type="button"
            onClick={() => {
              logout?.();
              navigate("/login");
            }}
            title={collapsed ? t.sidebarLogout : undefined}
            className="sb-logout-btn"
          >
            <LogOut size={17} />
            {!collapsed && <span>{t.sidebarLogout}</span>}
          </button>
        </div>
      </aside>

      <div className="sb-spacer" style={{ width: spacerWidth, minHeight: "100vh" }} />
    </>
  );
}
