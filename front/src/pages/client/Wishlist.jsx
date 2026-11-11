import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring } from "framer-motion";
import {
  Heart,
  ShoppingCart,
  Trash2,
  PackageCheck,
  PackageX,
  Search,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import api from "../../services/api";
import { getArticleImageUrl } from "../articles/ClientCatalog";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import { useCartStore } from "../../store/cartStore";
import { useToastStore } from "../../store/toastStore";
import { useLandingLang } from "../landing/LandingLangContext";

function formatSavedDate(dateStr, localeTag) {
  if (!dateStr) return null;
  try {
    return new Intl.DateTimeFormat(localeTag, { dateStyle: "medium" }).format(new Date(dateStr));
  } catch {
    return null;
  }
}

function AnimatedCount({ value, reduce }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 90, damping: 18 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return undefined;
    }
    motionVal.set(value);
    return spring.on("change", (v) => setDisplay(Math.round(v)));
  }, [value, reduce, motionVal, spring]);

  return <span>{display}</span>;
}

export default function Wishlist() {
  const { t } = useLandingLang();
  const reduce = useReducedMotion();
  const qc = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);
  const pushToast = useToastStore((s) => s.pushToast);
  const [filter, setFilter] = useState("tous");
  const [query, setQuery] = useState("");

  const FILTERS = [
    { id: "tous", label: t.wishFilterAll, icon: Heart },
    { id: "disponibles", label: t.wishFilterIn, icon: PackageCheck },
    { id: "rupture", label: t.wishFilterOut, icon: PackageX },
  ];

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get("wishlist").then((r) => r.data),
  });

  const removeMut = useMutation({
    mutationFn: (articleId) => api.delete(`wishlist/items/${articleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const items = data?.items || [];

  const availableCount = useMemo(
    () => items.filter((r) => r.article?.stockDisponible == null || r.article.stockDisponible > 0).length,
    [items]
  );
  const outCount = items.length - availableCount;
  const availPct = items.length > 0 ? Math.round((availableCount / items.length) * 100) : 0;

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      const a = row.article;
      if (!a) return false;
      const stock = a.stockDisponible;
      if (filter === "disponibles" && !(stock == null || stock > 0)) return false;
      if (filter === "rupture" && !(stock != null && stock <= 0)) return false;
      if (!q) return true;
      return (
        String(a.libelle || "").toLowerCase().includes(q) ||
        String(a.code || "").toLowerCase().includes(q) ||
        String(a.description || "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  function addToCart(a) {
    const r = addItem({ ...a, stockDisponible: a.stockDisponible }, 1);
    if (r.ok) pushToast(t.wishAddedCart, "success");
    else pushToast(t.wishStockLow, "error");
  }

  function addAllAvailable() {
    let ok = 0;
    let fail = 0;
    items.forEach((row) => {
      const a = row.article;
      if (!a) return;
      if (a.stockDisponible != null && a.stockDisponible <= 0) return;
      const r = addItem({ ...a, stockDisponible: a.stockDisponible }, 1);
      if (r.ok) ok += 1;
      else fail += 1;
    });
    if (ok) pushToast(`${ok} article${ok > 1 ? "s" : ""} ajouté${ok > 1 ? "s" : ""} au panier`, "success");
    if (fail && !ok) pushToast(t.wishStockLow, "error");
  }

  const kpis = [
    { id: "saved", label: t.wishStatSaved, value: items.length, tone: "navy" },
    { id: "in", label: t.wishStatIn, value: availableCount, tone: "ok" },
    { id: "out", label: t.wishStatOut, value: outCount, tone: "warn" },
  ];

  return (
    <div className="wish-atelier wishlist-hero">
      <section className="wish-atelier__hero">
        <div className="wish-atelier__atmos" aria-hidden="true">
          <img className="wish-atelier__photo" src="/cutouts/hero-favoris-atelier.png?v=20260829c" alt="" />
          <div className="wish-atelier__veil" />
          <div className="wish-atelier__lattice" />
          <div className="wish-atelier__sheen" />
          {!reduce &&
            [0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="wish-atelier__orb"
                style={{
                  left: `${12 + i * 17}%`,
                  top: `${18 + (i % 3) * 22}%`,
                }}
                animate={{ y: [0, -16, 0], opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 4.4 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
              />
            ))}
        </div>

        <div className="wish-atelier__hero-inner">
          <div className="wish-atelier__copy">
          <motion.p
            className="wish-atelier__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t.wishHeroEyebrow}
          </motion.p>

          <motion.h1
            className="wish-atelier__title"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {t.wishHeroTitle} <span>{t.wishHeroAccent}</span>
          </motion.h1>

          <motion.p
            className="wish-atelier__sub"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
          >
            {t.wishHeroSubtitle}
          </motion.p>

          <motion.ul
            className="wish-atelier__kpis"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {kpis.map((k) => (
              <li key={k.id} className={`wish-atelier__kpi is-${k.tone}`}>
                <span>{k.label}</span>
                <strong>
                  <AnimatedCount value={isLoading ? 0 : k.value} reduce={reduce} />
                </strong>
              </li>
            ))}
          </motion.ul>

          <motion.div
            className="wish-atelier__tabs"
            role="tablist"
            aria-label={t.wishTitle}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26 }}
          >
            {FILTERS.map((f) => {
              const active = filter === f.id;
              const count =
                f.id === "tous" ? items.length : f.id === "disponibles" ? availableCount : outCount;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`wish-atelier__tab${active ? " is-active" : ""}`}
                  onClick={() => setFilter(f.id)}
                >
                  <f.icon className="w-4 h-4" strokeWidth={1.8} />
                  <span>
                    {f.label}
                    {!isLoading ? <em> {count}</em> : null}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="wish-tab-pill"
                      className="wish-atelier__tab-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                </button>
              );
            })}
          </motion.div>
          </div>
        </div>
      </section>

      <section id="wishlist-list" className="wish-atelier__stage scroll-mt-24">
        {isLoading && (
          <div className="wish-atelier__grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="wish-atelier__skel" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <motion.div
            className="wish-atelier__empty"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="wish-atelier__empty-orb"
              animate={reduce ? undefined : { y: [0, -10, 0], scale: [1, 1.04, 1] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="wish-atelier__empty-ring" />
              <Heart className="w-10 h-10" strokeWidth={1.4} />
            </motion.div>
            <h2>{t.wishEmptyTitle}</h2>
            <p>{t.wishEmptyText}</p>
            <Link to="/articles" className="wish-atelier__cta">
              <span className="wish-atelier__cta-shine" aria-hidden="true" />
              <span>{t.wishExplore}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {!isLoading && items.length > 0 && (
          <>
            <div className="wish-atelier__toolbar">
              <div className="wish-atelier__meter" aria-hidden="true">
                <div className="wish-atelier__meter-bar">
                  <motion.span
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${availPct}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p>
                  <strong>{availPct}%</strong> {t.wishAvailOf}
                </p>
              </div>

              <label className="wish-atelier__search">
                <Search className="w-4 h-4" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.wishSearchPh}
                />
              </label>

              <motion.button
                type="button"
                className="wish-atelier__cta wish-atelier__cta--compact"
                disabled={availableCount === 0}
                onClick={addAllAvailable}
                whileHover={reduce || availableCount === 0 ? undefined : { y: -1 }}
                whileTap={reduce || availableCount === 0 ? undefined : { scale: 0.98 }}
              >
                <span className="wish-atelier__cta-shine" aria-hidden="true" />
                <ShoppingCart className="w-4 h-4" />
                <span>{t.wishAddAll}</span>
              </motion.button>

              <Link to="/articles" className="wish-atelier__ghost">
                {t.wishExploreMore}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <AnimatePresence mode="popLayout">
              {filteredItems.length === 0 && (
                <motion.div
                  key="empty-filter"
                  className="wish-atelier__nomatch"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <p>{t.wishNoMatch}</p>
                  <button
                    type="button"
                    className="wish-atelier__reset"
                    onClick={() => {
                      setFilter("tous");
                      setQuery("");
                    }}
                  >
                    {t.wishReset}
                  </button>
                </motion.div>
              )}

              <div className="wish-atelier__grid">
                {filteredItems.map((row, idx) => {
                  const a = row.article;
                  if (!a) return null;
                  const inStock = a.stockDisponible == null || a.stockDisponible > 0;
                  const lowStock =
                    inStock &&
                    a.stockDisponible != null &&
                    a.stockDisponible > 0 &&
                    a.stockDisponible <= 5;
                  const saved = formatSavedDate(row.createdAt || row.addedAt, t.localeTag);
                  const famille = a.famille?.libelle;

                  return (
                    <motion.article
                      key={row.id}
                      layout
                      className="wish-tile"
                      initial={reduce ? false : { opacity: 0, y: 22 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{
                        delay: Math.min(idx * 0.05, 0.28),
                        type: "spring",
                        stiffness: 280,
                        damping: 24,
                      }}
                      whileHover={reduce ? undefined : { y: -6 }}
                    >
                      <Link to={`/articles/${a.id}`} className="wish-tile__media">
                        <img src={getArticleImageUrl(a)} alt="" />
                        <span className="wish-tile__heart">
                          <Heart className="w-3.5 h-3.5" fill="currentColor" />
                        </span>
                        <span className={`wish-tile__stock${inStock ? " is-ok" : " is-out"}`}>
                          {inStock ? t.wishInStock : t.wishOutStock}
                        </span>
                      </Link>

                      <div className="wish-tile__body">
                        <div className="wish-tile__meta">
                          {a.code && <span className="wish-tile__code">{a.code}</span>}
                          <Link to={`/articles/${a.id}`} className="wish-tile__name">
                            {a.libelle}
                          </Link>
                          <p className="wish-tile__saved">{saved || t.wishKicker}</p>
                        </div>

                        <div className="wish-tile__price-row">
                          <p className="wish-tile__price">{formatMoneyTnd(a.prixVente)}</p>
                          {famille && (
                            <span className="wish-tile__tag">
                              <Layers className="w-3 h-3" />
                              {famille}
                            </span>
                          )}
                        </div>

                        {(lowStock || !inStock) && (
                          <div className={`wish-tile__note${inStock ? " is-low" : " is-out"}`}>
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <div>
                              <strong>{inStock ? t.wishLowTitle : t.wishOutTitle}</strong>
                              <p>
                                {inStock
                                  ? t.wishLowText.replace("{n}", String(a.stockDisponible))
                                  : t.wishOutText}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="wish-tile__actions">
                          <motion.button
                            type="button"
                            className="wish-tile__add"
                            disabled={!inStock}
                            onClick={() => addToCart(a)}
                            whileHover={reduce || !inStock ? undefined : { scale: 1.015 }}
                            whileTap={reduce || !inStock ? undefined : { scale: 0.98 }}
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {t.wishAddCartFull}
                          </motion.button>
                          <button
                            type="button"
                            className="wish-tile__remove"
                            onClick={() => removeMut.mutate(a.id)}
                            aria-label={t.wishRemove}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </AnimatePresence>
          </>
        )}
      </section>
    </div>
  );
}
