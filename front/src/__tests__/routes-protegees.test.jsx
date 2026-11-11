import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthPersistence, useAuthStore } from "../store/authStore";

const { facette } = vi.hoisted(() => {
  async function facette(nom) {
    const { default: pageFactice } = await import("../test/pageFactice");
    return { default: pageFactice(nom) };
  }
  return { facette };
});

vi.mock("../services/api", () => ({
  default: {
    get: () => new Promise(() => {}),
    post: () => new Promise(() => {}),
    interceptors: { request: { use: () => 0 }, response: { use: () => 0 } },
  },
  getAxiosErrorMessage: (_err, fallback) => fallback,
  getApiOrigin: () => "http://127.0.0.1:5000",
}));

vi.mock("../components/ui/Sidebar", () => facette("menu"));
vi.mock("../components/ui/AppNavbar", () => facette("barre"));
vi.mock("../components/ui/ClientLayout", () => facette("espace-client"));
vi.mock("../components/ui/ProfileSetupModal", () => ({ default: () => null }));
vi.mock("../components/ui/ToastHost", () => ({ default: () => null }));
vi.mock("../components/chatbot/ChatbotWidget", () => ({ default: () => null }));

vi.mock("../pages/landing/IntroSplash", () => facette("intro"));
vi.mock("../pages/landing/Landing", () => facette("accueil"));
vi.mock("../pages/auth/AuthPage", () => facette("page-connexion"));
vi.mock("../pages/dashboard/Dashboard", async () => {
  const { default: pageFactice } = await import("../test/pageFactice");
  return {
    default: pageFactice("page-tableau"),
    DashboardSkeleton: pageFactice("squelette"),
  };
});
vi.mock("../pages/stock/Stock", () => facette("page-stock"));
vi.mock("../pages/stock/AuditLog", () => facette("audit-stock"));
vi.mock("../pages/articles/Articles", () => facette("page-articles"));
vi.mock("../pages/articles/ArticleDetail", () => facette("detail-article"));
vi.mock("../pages/client/Panier", () => facette("panier"));
vi.mock("../pages/client/Checkout", () => facette("checkout"));
vi.mock("../pages/client/MesCommandes", () => facette("commandes"));
vi.mock("../pages/client/CommandeDetail", () => facette("detail-commande"));
vi.mock("../pages/client/Wishlist", () => facette("favoris"));
vi.mock("../pages/depots/Depots", () => facette("depots"));
vi.mock("../pages/depots/WarehouseMapPage", () => facette("carte"));
vi.mock("../pages/rapports/Rapports", () => facette("rapports"));
vi.mock("../pages/rapports/RapportRotation", () => facette("rotation"));
vi.mock("../pages/rapports/RapportEcartsInventaire", () => facette("ecarts"));
vi.mock("../pages/mouvements/Mouvements", () => facette("mouvements"));
vi.mock("../pages/comptabilite/Comptabilite", () => facette("compta"));
vi.mock("../pages/reglements/ReglementsPage", () => facette("reglements"));
vi.mock("../pages/tiers/Fournisseurs", () => facette("fournisseurs"));
vi.mock("../pages/tiers/Clients", () => facette("clients"));
vi.mock("../pages/achats/Achats", () => facette("achats"));
vi.mock("../pages/achats/AchatForm", () => facette("achat-form"));
vi.mock("../pages/achats/AchatDetail", () => facette("achat-detail"));
vi.mock("../pages/achats/ComparaisonFournisseurs", () => facette("comparaison"));
vi.mock("../pages/ventes/Ventes", () => facette("ventes"));
vi.mock("../pages/ventes/VenteForm", () => facette("vente-form"));
vi.mock("../pages/ventes/VenteDetail", () => facette("vente-detail"));
vi.mock("../pages/ventes/EncoursClients", () => facette("encours"));
vi.mock("../pages/refs/Marques", () => facette("marques"));
vi.mock("../pages/refs/Familles", () => facette("familles"));
vi.mock("../pages/stock/Lots", () => facette("lots"));
vi.mock("../pages/stock/LotScanPage", () => facette("scan-lot"));
vi.mock("../pages/stock/StockScanPage", () => facette("scan-stock"));
vi.mock("../pages/stock/RappelProduit", () => facette("rappel"));
vi.mock("../pages/stock/Rentabilite", () => facette("rentabilite"));
vi.mock("../pages/inventaires/InventairesPage", () => facette("inventaires"));
vi.mock("../pages/inventaires/InventaireDetailPage", () => facette("inventaire"));
vi.mock("../pages/stock/NumerosSerie", () => facette("series"));
vi.mock("../pages/stock/CoutStockage", () => facette("cout"));
vi.mock("../pages/stock/LoadOptimization", () => facette("chargement"));
vi.mock("../pages/stock/EmplacementOptimization", () => facette("emplacement"));
vi.mock("../pages/stock/PeremptionRiskDashboard", () => facette("peremption"));
vi.mock("../pages/stock/SalesForecast", () => facette("prevision"));
vi.mock("../pages/stock/AnomaliesDetection", () => facette("anomalies"));
vi.mock("../pages/ai/AiHub", () => facette("hub"));
vi.mock("../pages/ai/ModuleIA", () => facette("module-ia"));
vi.mock("../pages/vehicules/VehiculesList", () => facette("vehicules"));
vi.mock("../pages/stock/Valuation", () => facette("valorisation"));
vi.mock("../pages/admin/AdminUsers", () => facette("page-admin"));
vi.mock("../pages/admin/UserDetail", () => facette("user-detail"));
vi.mock("../pages/admin/AuditLog", () => facette("audit"));
vi.mock("../pages/superadmin/SuperAdminPanel", () => facette("superadmin"));
vi.mock("../pages/superadmin/SelectSociete", () => facette("choix-societe"));
vi.mock("../pages/profil/ProfilPage", () => facette("profil"));

import App from "../App";

async function session(user) {
  localStorage.clear();
  sessionStorage.clear();
  setAuthPersistence(true);
  useAuthStore.getState().logout();
  if (typeof useAuthStore.persist?.rehydrate === "function") {
    await useAuthStore.persist.rehydrate();
  }
  if (user) {
    useAuthStore.getState().setAuth("jeton-test", user, true);
  }
}

function ouvrir(chemin) {
  return render(
    <MemoryRouter initialEntries={[chemin]}>
      <App />
    </MemoryRouter>
  );
}

describe("routes protégées", () => {
  beforeEach(async () => {
    await session(null);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirige vers la connexion sans jeton, refuse un rôle non autorisé et affiche la page avec le bon rôle", async () => {
    ouvrir("/admin");
    expect(await screen.findByRole("heading", { name: "page-connexion" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "page-admin" })).not.toBeInTheDocument();

    cleanup();
    await session({ id: 2, role: "MAGASINIER", email: "mag@stokify.local", profileCompleted: true });
    ouvrir("/admin");
    expect(await screen.findByRole("heading", { name: "page-tableau" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "page-admin" })).not.toBeInTheDocument();

    cleanup();
    await session({ id: 3, role: "ADMIN", email: "admin@stokify.local", profileCompleted: true });
    ouvrir("/admin");
    expect(await screen.findByRole("heading", { name: "page-admin" })).toBeInTheDocument();
  });
});
