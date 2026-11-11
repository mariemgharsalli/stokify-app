import { Navigate, Outlet, Route, Routes, useLocation, useOutlet } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import RequireNonClient from "./components/auth/RequireNonClient";
import { useAuthStore } from "./store/authStore";
import { useProfileModalStore } from "./store/profileModalStore";
import api from "./services/api";
import { hasPermission } from "./security/permissions";
import ToastHost from "./components/ui/ToastHost";
import SuperAdminOpsOutlet from "./components/layout/SuperAdminOpsOutlet";
import { postAuthHomePath } from "./security/postAuthRoutes";
import { useAuthPersistHydrated } from "./hooks/useAuthPersistHydrated";
import { LandingLangProvider, useLandingLang } from "./pages/landing/LandingLangContext";
import QrTerrainRedirect from "./security/qrTerrainRedirect";

function RouteFallback() {
  return <div className="min-h-[40vh] w-full" role="status" />;
}

function lazyRoute(loader) {
  const Component = lazy(loader);
  function LazyRoute(props) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Component {...props} />
      </Suspense>
    );
  }
  return LazyRoute;
}

const Sidebar = lazyRoute(() => import("./components/ui/Sidebar"));
const AppNavbar = lazyRoute(() => import("./components/ui/AppNavbar"));
const ClientLayout = lazyRoute(() => import("./components/ui/ClientLayout"));
const ProfileSetupModal = lazyRoute(() => import("./components/ui/ProfileSetupModal"));
const ChatbotWidget = lazy(() => import("./components/chatbot/ChatbotWidget"));
const TerrainApp = lazy(() => import("./terrain/TerrainApp"));
const ProfilPage = lazyRoute(() => import("./pages/profil/ProfilPage"));
const Landing = lazyRoute(() => import("./pages/landing/Landing"));
const IntroSplash = lazyRoute(() => import("./pages/landing/IntroSplash"));
const AuthPage = lazyRoute(() => import("./pages/auth/AuthPage"));
const Dashboard = lazyRoute(() => import("./pages/dashboard/Dashboard"));
const Stock = lazyRoute(() => import("./pages/stock/Stock"));
const StockAuditLog = lazyRoute(() => import("./pages/stock/AuditLog"));
const Articles = lazyRoute(() => import("./pages/articles/Articles"));
const ArticleDetail = lazyRoute(() => import("./pages/articles/ArticleDetail"));
const Panier = lazyRoute(() => import("./pages/client/Panier"));
const Checkout = lazyRoute(() => import("./pages/client/Checkout"));
const MesCommandes = lazyRoute(() => import("./pages/client/MesCommandes"));
const CommandeDetail = lazyRoute(() => import("./pages/client/CommandeDetail"));
const Wishlist = lazyRoute(() => import("./pages/client/Wishlist"));
const Depots = lazyRoute(() => import("./pages/depots/Depots"));
const WarehouseMapPage = lazyRoute(() => import("./pages/depots/WarehouseMapPage"));
const Rapports = lazyRoute(() => import("./pages/rapports/Rapports"));
const RapportRotation = lazyRoute(() => import("./pages/rapports/RapportRotation"));
const RapportEcartsInventaire = lazyRoute(() => import("./pages/rapports/RapportEcartsInventaire"));
const Mouvements = lazyRoute(() => import("./pages/mouvements/Mouvements"));
const Comptabilite = lazyRoute(() => import("./pages/comptabilite/Comptabilite"));
const ReglementsPage = lazyRoute(() => import("./pages/reglements/ReglementsPage"));
const Fournisseurs = lazyRoute(() => import("./pages/tiers/Fournisseurs"));
const Clients = lazyRoute(() => import("./pages/tiers/Clients"));
const Achats = lazyRoute(() => import("./pages/achats/Achats"));
const AchatForm = lazyRoute(() => import("./pages/achats/AchatForm"));
const AchatDetail = lazyRoute(() => import("./pages/achats/AchatDetail"));
const ComparaisonFournisseurs = lazyRoute(() => import("./pages/achats/ComparaisonFournisseurs"));
const Ventes = lazyRoute(() => import("./pages/ventes/Ventes"));
const VenteForm = lazyRoute(() => import("./pages/ventes/VenteForm"));
const VenteDetail = lazyRoute(() => import("./pages/ventes/VenteDetail"));
const EncoursClients = lazyRoute(() => import("./pages/ventes/EncoursClients"));
const Marques = lazyRoute(() => import("./pages/refs/Marques"));
const Familles = lazyRoute(() => import("./pages/refs/Familles"));
const Lots = lazyRoute(() => import("./pages/stock/Lots"));
const LotScanPage = lazyRoute(() => import("./pages/stock/LotScanPage"));
const StockScanPage = lazyRoute(() => import("./pages/stock/StockScanPage"));
const RappelProduit = lazyRoute(() => import("./pages/stock/RappelProduit"));
const Rentabilite = lazyRoute(() => import("./pages/stock/Rentabilite"));
const InventairesPage = lazyRoute(() => import("./pages/inventaires/InventairesPage"));
const InventaireDetailPage = lazyRoute(() => import("./pages/inventaires/InventaireDetailPage"));
const NumerosSerie = lazyRoute(() => import("./pages/stock/NumerosSerie"));
const CoutStockage = lazyRoute(() => import("./pages/stock/CoutStockage"));
const LoadOptimization = lazyRoute(() => import("./pages/stock/LoadOptimization"));
const EmplacementOptimization = lazyRoute(() => import("./pages/stock/EmplacementOptimization"));
const PeremptionRiskDashboard = lazyRoute(() => import("./pages/stock/PeremptionRiskDashboard"));
const SalesForecast = lazyRoute(() => import("./pages/stock/SalesForecast"));
const AnomaliesDetection = lazyRoute(() => import("./pages/stock/AnomaliesDetection"));
const AiHub = lazyRoute(() => import("./pages/ai/AiHub"));
const ModuleIA = lazyRoute(() => import("./pages/ai/ModuleIA"));
const VehiculesList = lazyRoute(() => import("./pages/vehicules/VehiculesList"));
const Valuation = lazyRoute(() => import("./pages/stock/Valuation"));
const AdminUsers = lazyRoute(() => import("./pages/admin/AdminUsers"));
const UserDetail = lazyRoute(() => import("./pages/admin/UserDetail"));
const AuditLog = lazyRoute(() => import("./pages/admin/AuditLog"));
const SuperAdminPanel = lazyRoute(() => import("./pages/superadmin/SuperAdminPanel"));
const SelectSociete = lazyRoute(() => import("./pages/superadmin/SelectSociete"));

const ROUTE_TRANSITION = { duration: 0.22, ease: "easeOut" };

/**
 * Transition d'entrée uniquement (pas d'AnimatePresence exit).
 * L'exit gardait l'ancienne route montée : son <Outlet /> basculait vers la
 * nouvelle page → double VenteForm/AchatForm (portail body).
 */
function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={location.pathname}
      className="min-h-full w-full"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : ROUTE_TRANSITION}
    >
      {outlet}
    </motion.div>
  );
}

function PublicOnly({ children }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token) return children;
  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={postAuthHomePath(user.role)} replace />;
}

function ProtectedOrClientLayout() {
  const { t: labels } = useLandingLang();
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const openProfileModal = useProfileModalStore((s) => s.openModal);
  const profileModalOpen = useProfileModalStore((s) => s.open);

  useEffect(() => {
    if (!token) return;
    /** Court délai : après login/inscription, le token doit être lisible par l’intercepteur Axios + persistance zustand (sinon 401 → logout). */
    const t = window.setTimeout(() => {
      const current = useAuthStore.getState().token;
      if (!current) return;
      api
        .get("auth/me")
        .then((res) => setAuth(current, res.data))
        .catch(() => logout());
    }, 50);
    return () => window.clearTimeout(t);
  }, [token, setAuth, logout]);

  useEffect(() => {
    if (user && (!user.profileCompleted || user.mustChangePassword)) {
      const t = setTimeout(() => openProfileModal(), 600);
      return () => clearTimeout(t);
    }
  }, [user, openProfileModal]);

  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-400 text-sm">
        {labels.loading}
      </div>
    );
  }
  if (user.role === "CLIENT") {
    return (
      <>
        {profileModalOpen && <ProfileSetupModal />}
        <ClientLayout />
      </>
    );
  }

  // Stokify Terrain : layout mobile propre à /terrain, mais on garde ici
  // le rafraîchissement auth/me et le modal profil/mot de passe.
  if (location.pathname.startsWith("/terrain")) {
    return (
      <>
        {profileModalOpen && <ProfileSetupModal />}
        <Outlet />
      </>
    );
  }

  return (
    <div className="min-h-screen flex mesh-bg" style={{ background: "var(--bg-app)" }}>
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <AppNavbar />
        <main className="mesh-bg min-w-0 flex-1 overflow-x-hidden">
          <AnimatedOutlet />
        </main>
      </div>
      {profileModalOpen && <ProfileSetupModal />}
      <Suspense fallback={null}>
        {hasPermission(user.role, "ai:read") && <ChatbotWidget />}
      </Suspense>
    </div>
  );
}

function DashboardGate() {
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const persistHydrated = useAuthPersistHydrated();

  if (user?.role === "CLIENT") return <Navigate to="/articles" replace />;
  if (!persistHydrated) {
    return (
        <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <RouteFallback />
      </div>
    );
  }

  const dashboardKey =
    user?.role === "SUPER_ADMIN" ? String(activeSocieteId ?? "no-company") : "default";

  return <Dashboard key={dashboardKey} />;
}

function RequireRole({ roles }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function RequirePermission({ permission }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user.role, permission)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function PermissionPage({ permission, children }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!hasPermission(user.role, permission)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <LandingLangProvider>
      <ToastHost />
      <Routes>
      <Route path="/" element={<IntroSplash />} />
      <Route path="/home" element={<Landing />} />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <AuthPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <AuthPage />
          </PublicOnly>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicOnly>
            <AuthPage />
          </PublicOnly>
        }
      />
      <Route element={<ProtectedOrClientLayout />}>
        <Route
          path="/terrain/*"
          element={
            <Suspense fallback={<div className="min-h-screen bg-app-bg" />}>
              <TerrainApp />
            </Suspense>
          }
        />
        <Route element={<SuperAdminOpsOutlet />}>
        <Route path="/users" element={<Navigate to="/admin" replace />} />
        <Route path="/companies" element={<Navigate to="/superadmin" replace />} />
        <Route path="/select-societe" element={<SelectSociete />} />
        <Route path="/profil" element={<ProfilPage />} />
        <Route path="/dashboard" element={<DashboardGate />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/panier" element={<Panier />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/mes-commandes" element={<MesCommandes />} />
        <Route path="/mes-commandes/:id" element={<CommandeDetail />} />
        <Route path="/favoris" element={<Wishlist />} />
        <Route
          path="/orders"
          element={
            <Navigate
              to={useAuthStore.getState().user?.role === "CLIENT" ? "/articles" : "/dashboard"}
              replace
            />
          }
        />
        <Route element={<RequireNonClient />}>
          <Route path="/stock" element={<Stock />} />
          <Route
            path="/stock/peremption-risk"
            element={
              <PermissionPage permission="stock:read">
                <PeremptionRiskDashboard />
              </PermissionPage>
            }
          />
          <Route
            path="/stock/emplacement-optimization"
            element={
              <PermissionPage permission="stock:read">
                <EmplacementOptimization />
              </PermissionPage>
            }
          />
          <Route
            path="/stock/load-optimization"
            element={
              <PermissionPage permission="stock:read">
                <LoadOptimization />
              </PermissionPage>
            }
          />
          <Route
            path="/stock/forecast"
            element={
              <PermissionPage permission="stock:read">
                <SalesForecast />
              </PermissionPage>
            }
          />
          <Route
            path="/stock/anomalies"
            element={
              <PermissionPage permission="stock:read">
                <AnomaliesDetection />
              </PermissionPage>
            }
          />
          <Route
            path="/vehicules"
            element={
              <PermissionPage permission="stock:read">
                <VehiculesList />
              </PermissionPage>
            }
          />
          <Route
            path="/stock/audit"
            element={
              <PermissionPage permission="stock:read">
                <StockAuditLog />
              </PermissionPage>
            }
          />
          <Route
            path="/depots"
            element={
              <PermissionPage permission="stock:read">
                <Depots />
              </PermissionPage>
            }
          />
          <Route
            path="/depots/:id/plan"
            element={
              <PermissionPage permission="stock:read">
                <WarehouseMapPage />
              </PermissionPage>
            }
          />
          <Route
            path="/fournisseurs"
            element={
              <PermissionPage permission="achats:read">
                <Fournisseurs />
              </PermissionPage>
            }
          />
          <Route
            path="/achats"
            element={
              <PermissionPage permission="achats:read">
                <Achats />
              </PermissionPage>
            }
          />
          <Route
            path="/achats/new"
            element={
              <PermissionPage permission="achats:write">
                <>
                  <Achats />
                  <AchatForm />
                </>
              </PermissionPage>
            }
          />
          <Route
            path="/achats/comparaison-fournisseurs"
            element={
              <PermissionPage permission="achats:read">
                <ComparaisonFournisseurs />
              </PermissionPage>
            }
          />
          <Route
            path="/achats/:id/edit"
            element={
              <PermissionPage permission="achats:write">
                <AchatForm />
              </PermissionPage>
            }
          />
          <Route
            path="/achats/:id"
            element={
              <PermissionPage permission="achats:read">
                <AchatDetail />
              </PermissionPage>
            }
          />
          <Route
            path="/gestion-clients"
            element={
              <PermissionPage permission="ventes:read">
                <Clients />
              </PermissionPage>
            }
          />
          <Route
            path="/ventes"
            element={
              <PermissionPage permission="ventes:read">
                <Ventes />
              </PermissionPage>
            }
          />
          <Route
            path="/ventes/new"
            element={
              <PermissionPage permission="ventes:write">
                <>
                  <Ventes />
                  <VenteForm />
                </>
              </PermissionPage>
            }
          />
          <Route path="/ventes/encours-clients" element={<Navigate to="/encours-clients" replace />} />
          <Route
            path="/encours-clients"
            element={
              <PermissionPage permission="encours:read">
                <EncoursClients />
              </PermissionPage>
            }
          />
          <Route
            path="/ventes/:id/edit"
            element={
              <PermissionPage permission="ventes:write">
                <VenteForm />
              </PermissionPage>
            }
          />
          <Route
            path="/ventes/:id"
            element={
              <PermissionPage permission="ventes:read">
                <VenteDetail />
              </PermissionPage>
            }
          />
          <Route
            path="/marques"
            element={
              <PermissionPage permission="stock:read">
                <Marques />
              </PermissionPage>
            }
          />
          <Route
            path="/familles"
            element={
              <PermissionPage permission="stock:read">
                <Familles />
              </PermissionPage>
            }
          />
          <Route
            path="/lots"
            element={
              <PermissionPage permission="stock:read">
                <Lots />
              </PermissionPage>
            }
          />
          <Route
            path="/rappel-produit"
            element={
              <PermissionPage permission="stock:read">
                <RappelProduit />
              </PermissionPage>
            }
          />
          <Route
            path="/stock/scan/:id"
            element={
              <PermissionPage permission="stock:read">
                <QrTerrainRedirect kind="stock">
                  <StockScanPage />
                </QrTerrainRedirect>
              </PermissionPage>
            }
          />
          <Route
            path="/stock/lots/scan/:id"
            element={
              <PermissionPage permission="stock:read">
                <QrTerrainRedirect kind="lot">
                  <LotScanPage />
                </QrTerrainRedirect>
              </PermissionPage>
            }
          />
          <Route
            path="/numeros-serie"
            element={
              <PermissionPage permission="stock:read">
                <NumerosSerie />
              </PermissionPage>
            }
          />
          <Route
            path="/cout-stockage"
            element={
              <PermissionPage permission="valorisation:read">
                <CoutStockage />
              </PermissionPage>
            }
          />
          <Route
            path="/valorisation"
            element={
              <PermissionPage permission="valorisation:read">
                <Valuation />
              </PermissionPage>
            }
          />
          <Route
            path="/rentabilite"
            element={
              <PermissionPage permission="valorisation:read">
                <Rentabilite />
              </PermissionPage>
            }
          />
          <Route
            path="/inventaires"
            element={
              <PermissionPage permission="stock:read">
                <InventairesPage />
              </PermissionPage>
            }
          />
          <Route
            path="/inventaires/:id"
            element={
              <PermissionPage permission="stock:read">
                <InventaireDetailPage />
              </PermissionPage>
            }
          />
          <Route
            path="/reglements"
            element={
              <PermissionPage permission="reglements:write">
                <ReglementsPage />
              </PermissionPage>
            }
          />
        </Route>
        <Route
          path="/mouvements"
          element={
            <PermissionPage permission="mouvements:write">
              <Mouvements />
            </PermissionPage>
          }
        />
        <Route
          path="/comptabilite"
          element={
            <PermissionPage permission="accounting:read">
              <Comptabilite />
            </PermissionPage>
          }
        />
        <Route
          path="/rapports"
          element={
            <PermissionPage permission="rapports:read">
              <Rapports />
            </PermissionPage>
          }
        />
        <Route
          path="/rapports/rotation"
          element={
            <PermissionPage permission="rapports:read">
              <RapportRotation />
            </PermissionPage>
          }
        />
        <Route
          path="/rapports/ecarts-inventaire"
          element={
            <PermissionPage permission="rapports:read">
              <RapportEcartsInventaire />
            </PermissionPage>
          }
        />
        <Route
          path="/ai"
          element={
            <PermissionPage permission="ai:read">
              <ModuleIA />
            </PermissionPage>
          }
        />
        <Route
          path="/ai/hub"
          element={
            <PermissionPage permission="ai:read">
              <AiHub />
            </PermissionPage>
          }
        />
        <Route element={<RequireRole roles={["ADMIN", "SUPER_ADMIN"]} />}>
          <Route element={<RequirePermission permission="users:manage" />}>
            <Route path="/admin" element={<AdminUsers />} />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/audit" element={<AuditLog />} />
          </Route>
        </Route>
        <Route element={<RequireRole roles={["SUPER_ADMIN"]} />}>
          <Route path="/superadmin" element={<SuperAdminPanel />} />
        </Route>
        <Route path="/admin/societes" element={<Navigate to="/superadmin" replace />} />
        <Route path="/superadmin/companies" element={<Navigate to="/superadmin" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LandingLangProvider>
  );
}
