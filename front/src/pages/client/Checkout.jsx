import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, ShoppingBag } from "lucide-react";
import { useCartStore } from "../../store/cartStore";
import ClientHeroBanner from "../../components/ui/ClientHeroBanner";
import { useLandingLang } from "../landing/LandingLangContext";

export default function Checkout() {
  const { t } = useLandingLang();
  const items = useCartStore((s) => s.items);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const syncFromServer = useCartStore((s) => s.syncFromServer);
  const openedRef = useRef(false);

  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  useEffect(() => {
    if (openedRef.current || !items.length) return;
    openedRef.current = true;
    openDrawer(1);
  }, [items.length, openDrawer]);

  return (
    <div>
      <ClientHeroBanner
        eyebrow={t.checkoutHeroEyebrow}
        title={t.checkoutHeroTitle}
        titleAccent={t.checkoutHeroAccent}
        subtitle={t.checkoutHeroSubtitle}
        onExplore={() => openDrawer(items.length ? 1 : 0)}
        ctaLabel={t.checkoutHeroCta}
      />
      <div id="checkout-content" className="max-w-md mx-auto px-4 py-16 text-center scroll-mt-20">
        {!items.length ? (
          <>
            <p style={{ color: "var(--client-text-muted)" }}>{t.checkoutEmpty}</p>
            <Link to="/articles" className="btn-primary-orange inline-flex mt-6 px-6 py-3 text-sm">
              {t.checkoutSeeCatalog}
            </Link>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="client-cart-drawer__empty-orb mx-auto mb-5">
              <MapPin className="w-10 h-10" strokeWidth={1.4} />
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: "var(--brand-teal)" }}>
              {t.checkoutTitle}
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--client-text-muted)" }}>
              {t.checkoutMapKicker}
            </p>
            <motion.button
              type="button"
              className="btn-primary-orange inline-flex items-center gap-2 mt-8 px-6 py-3 text-sm"
              onClick={() => openDrawer(1)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <ShoppingBag className="w-4 h-4" />
              {t.cartCheckout}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
