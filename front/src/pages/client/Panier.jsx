import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, ShoppingBag, ArrowRight, Package, Coins, Layers } from "lucide-react";
import { useCartStore } from "../../store/cartStore";
import { getArticleImageUrl } from "../articles/ClientCatalog";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import ClientHeroBanner from "../../components/ui/ClientHeroBanner";
import ClientQtyStepper from "../../components/ui/ClientQtyStepper";
import ClientKpiRibbon from "../../components/client/ClientKpiRibbon";
import { useLandingLang } from "../landing/LandingLangContext";

const TVA = 0.19;

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 24 } },
};

export default function Panier() {
  const { t } = useLandingLang();
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const syncFromServer = useCartStore((s) => s.syncFromServer);
  const openDrawer = useCartStore((s) => s.openDrawer);

  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);
  const totalTTC = items.reduce((sum, i) => sum + Number(i.quantite) * Number(i.prixVente || 0), 0);
  const totalHT = totalTTC / (1 + TVA);
  const totalTva = totalTTC - totalHT;
  const totalUnits = items.reduce((s, i) => s + Number(i.quantite || 0), 0);

  const heroSubtitle =
    items.length > 0
      ? `${items.length} ${items.length > 1 ? t.cartArticlesPlural : t.cartArticle} · ${totalUnits.toLocaleString(t.localeTag)} ${t.cartUnits.toLowerCase()} · TND`
      : t.cartHeroSubtitle;

  const hero = (
    <ClientHeroBanner
      compact
      eyebrow={t.cartHeroEyebrow}
      title={t.cartHeroTitle}
      titleAccent={t.cartHeroAccent}
      subtitle={heroSubtitle}
      onExplore={() =>
        document.getElementById("panier-content")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      ctaLabel={t.cartHeroCta}
    />
  );

  if (!items.length) {
    return (
      <div>
        {hero}
        <motion.div
          id="panier-content"
          className="client-empty max-w-lg mx-auto px-4 py-20 text-center scroll-mt-20"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="client-empty__orb mx-auto mb-6"
            animate={{ y: [0, -10, 0], rotate: [0, 2, -2, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <ShoppingBag className="w-14 h-14 text-[var(--brand-teal)]" strokeWidth={1.25} />
          </motion.div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--client-text)" }}>
            {t.cartEmptyTitle}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--client-text-muted)" }}>
            {t.cartEmptyText}
          </p>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link to="/articles" className="btn-primary-orange inline-flex items-center gap-2 mt-8 px-6 py-3 text-sm">
              {t.cartBackCatalog}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div>
      {hero}
      <div id="panier-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 scroll-mt-20">
        <ClientKpiRibbon
          items={[
            {
              icon: Package,
              label: t.cartArticles,
              value: String(items.length),
              accent: "var(--brand-blue)",
            },
            {
              icon: Layers,
              label: t.cartUnits,
              value: totalUnits.toLocaleString(t.localeTag),
              accent: "var(--brand-cyan)",
            },
            {
              icon: Coins,
              label: t.cartTotalTtc,
              value: formatMoneyTnd(totalTTC),
              accent: "var(--brand-orange)",
            },
          ]}
        />

        <div className="client-panier-stage">
          <motion.section
            className="client-panier-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            <div className="client-panier-panel__head">
              <ShoppingBag className="w-4 h-4 client-panier-panel__head-icon" strokeWidth={1.7} />
              <h2 className="client-panier-panel__head-title">{t.cartDrawerTitle}</h2>
            </div>

            <motion.ul
              className="client-cart-drawer__list"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.li
                    key={item.articleId}
                    layout
                    variants={itemVariants}
                    exit={{ opacity: 0, x: -48, height: 0, marginBottom: 0 }}
                    className="client-cart-drawer__line"
                  >
                    <div className="client-cart-drawer__thumb">
                      <img
                        src={getArticleImageUrl({ id: item.articleId, imageUrl: item.imageUrl })}
                        alt=""
                      />
                    </div>
                    <div className="client-cart-drawer__info">
                      <span className="code-badge" style={{ alignSelf: "flex-start" }}>
                        {item.code}
                      </span>
                      <p className="client-cart-drawer__name">{item.libelle}</p>
                      <p className="client-cart-drawer__price">
                        {formatMoneyTnd(item.prixVente)} {t.cartPerUnit}
                      </p>
                      <div className="client-cart-drawer__controls">
                        <ClientQtyStepper
                          size="sm"
                          className="client-cart-drawer__qty"
                          value={item.quantite}
                          onChange={(q) => updateQty(item.articleId, q)}
                          max={item.stockDisponible ?? undefined}
                        />
                        <div className="flex items-center gap-2">
                          <motion.p
                            key={`${item.articleId}-${item.quantite}`}
                            initial={{ scale: 0.9, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="font-extrabold text-sm text-white"
                          >
                            {formatMoneyTnd(Number(item.quantite) * Number(item.prixVente || 0))}
                          </motion.p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.articleId)}
                            className="client-cart-drawer__trash"
                            aria-label={t.cartRemove}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          </motion.section>

          <motion.aside
            className="client-panier-recap"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 260, damping: 22 }}
          >
            <p className="client-panier-recap__label">{t.cartRecap}</p>
            <div className="client-cart-drawer__row">
              <span>{t.cartTotalHt}</span>
              <span>{formatMoneyTnd(totalHT)}</span>
            </div>
            <div className="client-cart-drawer__row">
              <span>{t.cartTva}</span>
              <span>{formatMoneyTnd(totalTva)}</span>
            </div>
            <div className="client-cart-drawer__row client-cart-drawer__row--total">
              <span>{t.cartTotalTtc}</span>
              <motion.span
                key={totalTTC}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                {formatMoneyTnd(totalTTC)}
              </motion.span>
            </div>
            <motion.button
              type="button"
              className="client-cart-drawer__cta"
              onClick={() => openDrawer(1)}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
            >
              {t.cartCheckout}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <Link to="/articles" className="client-cart-drawer__continue">
              {t.cartContinue}
            </Link>
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
