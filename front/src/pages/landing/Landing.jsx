import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { postAuthHomePath } from "../../security/postAuthRoutes";
import api from "../../services/api";
import { LandingLangProvider, useLandingLang } from "./LandingLangContext";
import LandingNavbar from "./sections/LandingNavbar";
import LandingHero from "./sections/LandingHero";
import LandingFeatures from "./sections/LandingFeatures";
import LandingModules from "./sections/LandingModules";
import LandingStats from "./sections/LandingStats";
import LandingWhyUs from "./sections/LandingWhyUs";
import LandingShowcase from "./sections/LandingShowcase";
import LandingCta from "./sections/LandingCta";
import LandingFlow from "./sections/LandingFlow";
import LandingFooter from "./sections/LandingFooter";

function LandingShell() {
  const { t } = useLandingLang();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!token) return;
    const current = useAuthStore.getState().token;
    if (!current) return;
    api
      .get("auth/me")
      .then((res) => setAuth(current, res.data))
      .catch(() => logout());
  }, [token, setAuth, logout]);

  if (token && !user) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center text-slate-400 text-sm">
        {t.loading}
      </div>
    );
  }

  if (token && user) {
    return <Navigate to={postAuthHomePath(user.role)} replace />;
  }

  return (
    <div className="min-h-screen bg-[#0B3A44] text-white">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingModules />
        <LandingStats />
        <LandingWhyUs />
        <LandingShowcase />
        <LandingCta />
        <LandingFlow />
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * Landing marketing React — sections assemblées.
 * Auth inchangée : token sans user → Chargement ; token + user → redirect post-auth.
 */
export default function Landing() {
  return (
    <LandingLangProvider>
      <LandingShell />
    </LandingLangProvider>
  );
}
