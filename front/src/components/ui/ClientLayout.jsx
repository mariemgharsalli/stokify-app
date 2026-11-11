import { Outlet } from "react-router-dom";
import ClientNavbar from "./ClientNavbar";
import ClientFooter from "./ClientFooter";
import ClientCartDrawer from "./ClientCartDrawer";
import ClientChatbotWidget from "../chatbot/client/ClientChatbotWidget";
import { LandingLangProvider } from "../../pages/landing/LandingLangContext";
import "../../styles/client-theme.css";

export default function ClientLayout() {
  return (
    <LandingLangProvider>
      <div className="client-shop min-h-screen flex flex-col">
        <ClientNavbar />
        {/* Hotbar (~36px) + navbar flottante — même shell que le portfolio */}
        <main className="flex-1 min-w-0 overflow-x-hidden pt-[6.5rem] sm:pt-[7.25rem] has-[.client-hero]:pt-0 has-[.wishlist-hero]:pt-0 has-[.orders-hero]:pt-0">
          <Outlet />
        </main>
        <ClientFooter />
        <ClientChatbotWidget />
        <ClientCartDrawer />
      </div>
    </LandingLangProvider>
  );
}
