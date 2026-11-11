import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LayoutGrid,
  List,
  PackageSearch,
  ShoppingCart,
  X,
  Filter,
  SlidersHorizontal,
  RotateCcw,
  ExternalLink,
  Package,
  Tag,
  Heart,
  Eye,
  Sparkles,
  Camera,
  MessageSquare,
} from "lucide-react";
import api from "../../services/api";
import { useCartStore } from "../../store/cartStore";
import { useToastStore } from "../../store/toastStore";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import { normalizeQty } from "../../utils/clientQty";
import {
  getArticleImageUrl,
  getArticleRealImageUrl,
  resolveArticleImageUrl,
} from "../../utils/articleImage";
import ClientHeroBanner from "../../components/ui/ClientHeroBanner";
import ClientPagination from "../../components/ui/ClientPagination";
import ClientQtyStepper from "../../components/ui/ClientQtyStepper";
import ClientPageIntro from "../../components/client/ClientPageIntro";
import { useLandingLang } from "../landing/LandingLangContext";
import { VisualSearchModal } from "../client/components/VisualSearchModal";
import DemandeComposer from "../../components/demandes/DemandeComposer";

export { getArticleImageUrl, getArticleRealImageUrl, resolveArticleImageUrl };

const PAGE_SIZE_OPTIONS = [6, 9, 12, 24];
const TRANSPALETTE_SRC = "/cutouts/transpalette-cutout.png";

function stockOf(a) {
  if (a == null || a.stockDisponible == null) return null;
  const n = Number(a.stockDisponible);
  return Number.isFinite(n) ? n : null;
}

/** Plafond qty selon stockDisponible ; toast discret si dépassement. null = pas de plafond. */
function clampQtyToStock(article, qty, pushToast, t) {
  const q = normalizeQty(qty);
  const stock = stockOf(article);
  if (stock == null) return q;
  const cap = Math.max(0, Math.floor(stock));
  if (q > cap) {
    pushToast(`${t.catStockAvailable} : ${cap} ${t.catUnits}`, "warning");
    return cap;
  }
  return q;
}

function categoryOf(a) {
  return (
    a.familleNom ||
    a.famille?.nom ||
    a.famille?.libelle ||
    a.sousFamilleNom ||
    a.sousFamille?.nom ||
    ""
  );
}

function StockLabel({ stock }) {
  const { t } = useLandingLang();
  if (stock == null) {
    return (
      <span className="catalog-stock catalog-stock--muted">
        <span className="stock-dot stock-dot--out" />
        {t.catStockConfirm}
      </span>
    );
  }
  if (stock > 5) {
    return (
      <span className="catalog-stock catalog-stock--ok">
        <span className="stock-dot stock-dot--ok" />
        {t.catStockOk} · {stock}
      </span>
    );
  }
  if (stock > 0) {
    return (
      <span className="catalog-stock catalog-stock--low">
        <span className="stock-dot stock-dot--low" />
        {t.catStockLow} · {stock}
      </span>
    );
  }
  return (
    <span className="catalog-stock catalog-stock--muted">
      <span className="stock-dot stock-dot--out" />
      {t.catStockOrder}
    </span>
  );
}

function StockMeter({ stock }) {
  if (stock == null) return null;
  const pct = Math.max(0, Math.min(100, (Number(stock) / 40) * 100));
  const tone = stock > 5 ? "ok" : stock > 0 ? "low" : "out";
  return (
    <div className={`catalog-card__meter catalog-card__meter--${tone}`} aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function ClientCatalog({
  items,
  search,
  setSearch,
  isLoading,
  serverPagination = null,
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useLandingLang();
  const qc = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);
  const pushToast = useToastStore((s) => s.pushToast);
  const catalogRef = useRef(null);
  const serverMode = Boolean(serverPagination);

  const { data: wishIds } = useQuery({
    queryKey: ["wishlist-ids"],
    queryFn: () => api.get("wishlist/ids").then((r) => r.data),
  });
  const wishSet = useMemo(
    () => new Set((wishIds?.articleIds || []).map(Number)),
    [wishIds]
  );

  const wishMut = useMutation({
    mutationFn: async (articleId) => {
      const id = Number(articleId);
      if (wishSet.has(id)) return api.delete(`wishlist/items/${id}`);
      return api.post("wishlist/items", { articleId: id });
    },
    onSuccess: (_d, articleId) => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      pushToast(
        wishSet.has(Number(articleId)) ? t.catRemovedWishlist : t.catAddedWishlist,
        "success"
      );
    },
    onError: (e) => pushToast(e.response?.data?.message || t.catWishlistError, "error"),
  });

  function toggleWish(e, articleId) {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    wishMut.mutate(articleId);
  }

  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("nouveaute");
  const [enStockOnly, setEnStockOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [quickView, setQuickView] = useState(null);
  const [demandeArticle, setDemandeArticle] = useState(null);
  const [qvQty, setQvQty] = useState(1);
  const [cartBumpId, setCartBumpId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(serverMode ? 24 : 9);
  const [visualSearchOpen, setVisualSearchOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set();
    (items || []).forEach((a) => {
      const c = categoryOf(a);
      if (c) set.add(c);
    });
    return [...set].sort((a, b) => a.localeCompare(b, t.localeTag));
  }, [items, t.localeTag]);

  const priceBounds = useMemo(() => {
    const prices = (items || []).map((a) => Number(a.prixVente) || 0);
    if (!prices.length) return { min: 0, max: 100 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices) || 100) };
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...(items || [])];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          String(a.code || "").toLowerCase().includes(q) ||
          String(a.libelle || "").toLowerCase().includes(q) ||
          String(a.description || "").toLowerCase().includes(q)
      );
    }
    if (category) list = list.filter((a) => categoryOf(a) === category);
    if (enStockOnly) list = list.filter((a) => (stockOf(a) ?? 1) > 0);
    const min = priceMin === "" ? null : Number(priceMin);
    const max = priceMax === "" ? null : Number(priceMax);
    if (min != null && Number.isFinite(min)) list = list.filter((a) => Number(a.prixVente) >= min);
    if (max != null && Number.isFinite(max)) list = list.filter((a) => Number(a.prixVente) <= max);

    list.sort((a, b) => {
      if (sortBy === "prix-asc") return Number(a.prixVente) - Number(b.prixVente);
      if (sortBy === "prix-desc") return Number(b.prixVente) - Number(a.prixVente);
      if (sortBy === "nom") return String(a.libelle || "").localeCompare(String(b.libelle || ""), t.localeTag);
      return Number(b.id) - Number(a.id);
    });
    return list;
  }, [items, search, category, enStockOnly, priceMin, priceMax, sortBy, t.localeTag]);

  const stats = useMemo(() => {
    const total = (items || []).length;
    const inStock = (items || []).filter((a) => (stockOf(a) ?? 1) > 0).length;
    return { total, inStock, shown: filtered.length };
  }, [items, filtered.length]);

  const totalPages = serverMode
    ? Math.max(1, Number(serverPagination.pages) || 1)
    : Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const pageSafe = serverMode
    ? Math.min(Number(serverPagination.page) || 1, totalPages)
    : Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    if (serverMode) return filtered;
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize, serverMode]);

  useEffect(() => {
    if (!serverMode) setPage(1);
  }, [search, category, enStockOnly, priceMin, priceMax, sortBy, pageSize, serverMode]);

  useEffect(() => {
    if (!serverMode && page > totalPages) setPage(totalPages);
  }, [page, totalPages, serverMode]);

  function goPage(next) {
    if (serverMode) serverPagination.onPageChange?.(next);
    else setPage(next);
  }

  const activeChips = useMemo(() => {
    const chips = [];
    if (category) chips.push({ key: "cat", label: category, clear: () => setCategory("") });
    if (enStockOnly) chips.push({ key: "stock", label: t.catInStock, clear: () => setEnStockOnly(false) });
    if (priceMin !== "") chips.push({ key: "min", label: `Min ${priceMin} TND`, clear: () => setPriceMin("") });
    if (priceMax !== "") chips.push({ key: "max", label: `Max ${priceMax} TND`, clear: () => setPriceMax("") });
    if (sortBy !== "nouveaute") {
      const labels = {
        "prix-asc": t.catSortPriceAsc,
        "prix-desc": t.catSortPriceDesc,
        nom: t.catSortName,
      };
      chips.push({ key: "sort", label: labels[sortBy] || sortBy, clear: () => setSortBy("nouveaute") });
    }
    return chips;
  }, [category, enStockOnly, priceMin, priceMax, sortBy, t]);

  function resetFilters() {
    setCategory("");
    setEnStockOnly(false);
    setPriceMin("");
    setPriceMax("");
    setSortBy("nouveaute");
    setSearch("");
  }

  function handleAdd(article, qty = 1) {
    const q = clampQtyToStock(article, qty, pushToast, t);
    if (q <= 0) return;
    const result = addItem(article, q);
    if (!result?.ok) {
      pushToast(`${t.catStockAvailable} : 0 ${t.catUnits}`, "warning");
      return;
    }
    if (result.clamped) {
      pushToast(`${t.catStockAvailable} : ${result.stockDisponible} ${t.catUnits}`, "warning");
    }
    const shown = result.added ?? result.quantite ?? q;
    if (shown <= 0) return;
    setCartBumpId(article.id);
    setTimeout(() => setCartBumpId(null), 700);
    pushToast(`${article.libelle} × ${shown.toLocaleString(t.localeTag)} ${t.catAdded}`, "success");
  }

  function toastStockCap(cap) {
    pushToast(`${t.catStockAvailable} : ${cap} ${t.catUnits}`, "warning");
  }

  function openQuickView(article) {
    setQuickView(article);
    setQvQty(1);
  }

  useEffect(() => {
    if (!quickView) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setQuickView(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [quickView]);

  function scrollToCatalog() {
    catalogRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function goToPage(next) {
    goPage(next);
    catalogRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  const dockBusy = Boolean(search.trim() || activeChips.length);

  return (
    <div>
      <ClientHeroBanner
        eyebrow={t.catHeroEyebrow}
        title={t.catHeroTitle}
        titleAccent={t.catHeroAccent}
        subtitle={t.catHeroSubtitle}
        stats={stats}
        onExplore={scrollToCatalog}
        ctaLabel={t.catHeroCta}
      />

      <div ref={catalogRef} className="space-y-6 px-4 sm:px-6 max-w-7xl mx-auto py-8 scroll-mt-20">
        <ClientPageIntro
          icon={PackageSearch}
          kicker={t.catKicker}
          title={t.catTitle}
          subtitle={t.catSubtitle}
          showCatalogProducts
          showRunway={false}
        />

        <motion.section
          className={`catalog-filters${dockBusy ? " is-scanning" : ""}`}
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="catalog-filters__rail">
            <div className="catalog-filters__bay" aria-hidden>
              <span className="catalog-filters__aurora catalog-filters__aurora--a" />
              <span className="catalog-filters__aurora catalog-filters__aurora--b" />
              <span className="catalog-filters__sweep" />
              <span className="catalog-filters__fiber" />
              <span className="catalog-filters__spark catalog-filters__spark--1" />
              <span className="catalog-filters__spark catalog-filters__spark--2" />
              <span className="catalog-filters__spark catalog-filters__spark--3" />
            </div>

            <div className="catalog-filters__head">
              <div className="catalog-filters__title">
                <span
                  className={`catalog-filters__live${dockBusy ? " is-busy" : ""}`}
                  aria-hidden
                />
                <span className="catalog-filters__title-icon">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </span>
                <span>{t.catExplore}</span>
                <span className="catalog-filters__dock-tag">
                  <Sparkles className="w-3 h-3" />
                  {dockBusy ? t.catDockBusy : t.catDockIdle}
                </span>
              </div>
              <div className="catalog-filters__head-actions">
                <button
                  type="button"
                  className="catalog-chip-btn"
                  onClick={() => setVisualSearchOpen(true)}
                  aria-label="Recherche visuelle"
                  title="Recherche visuelle"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Recherche visuelle
                </button>
                <button type="button" className="catalog-chip-btn" onClick={() => setFiltersOpen((v) => !v)}>
                  <Filter className="w-3.5 h-3.5" />
                  {filtersOpen ? t.catHide : t.catFilters}
                </button>
                <button type="button" className="catalog-chip-btn" onClick={resetFilters}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.catReset}
                </button>
                <div className="catalog-view-toggle">
                  {!reduceMotion ? (
                    <motion.span
                      className="catalog-view-toggle__pill"
                      animate={{ x: viewMode === "grid" ? 0 : "100%" }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  ) : null}
                  <button
                    type="button"
                    className={viewMode === "grid" ? "is-active" : ""}
                    onClick={() => setViewMode("grid")}
                    aria-label={t.catViewGrid}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className={viewMode === "list" ? "is-active" : ""}
                    onClick={() => setViewMode("list")}
                    aria-label={t.catViewList}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`catalog-filters__jack${reduceMotion ? " is-parked" : ""}${
                dockBusy ? " is-busy" : ""
              }`}
              aria-hidden
            >
              <span className="catalog-filters__jack-bob">
                <span className="catalog-filters__jack-face">
                  <span className="catalog-filters__jack-echo">
                    <img src={TRANSPALETTE_SRC} alt="" draggable={false} decoding="async" />
                  </span>
                  <img
                    src={TRANSPALETTE_SRC}
                    alt=""
                    draggable={false}
                    decoding="async"
                    className="catalog-filters__jack-img"
                  />
                </span>
              </span>
            </div>
          </div>

          <div className="catalog-filters__search">
            <div className="catalog-filters__search-box">
              <PackageSearch className="catalog-filters__search-icon" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.catSearchPlaceholder}
              />
              {search && (
                <button type="button" className="catalog-filters__clear" onClick={() => setSearch("")} aria-label={t.catClear}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                className="catalog-filters__body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                  className="catalog-filters__grid"
                  initial={reduceMotion ? false : "hidden"}
                  animate="show"
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.055 } },
                  }}
                >
                  <motion.label
                    className="catalog-field"
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <span>{t.catPriceMin}</span>
                    <input
                      type="number"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder={String(priceBounds.min)}
                    />
                  </motion.label>
                  <motion.label
                    className="catalog-field"
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <span>{t.catPriceMax}</span>
                    <input
                      type="number"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder={String(priceBounds.max)}
                    />
                  </motion.label>
                  <motion.label
                    className="catalog-field"
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <span>{t.catCategory}</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="">{t.catAllCategories}</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </motion.label>
                  <motion.label
                    className="catalog-field"
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <span>{t.catSort}</span>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                      <option value="nouveaute">{t.catSortNew}</option>
                      <option value="prix-asc">{t.catSortPriceAsc}</option>
                      <option value="prix-desc">{t.catSortPriceDesc}</option>
                      <option value="nom">{t.catSortName}</option>
                    </select>
                  </motion.label>
                  <motion.button
                    type="button"
                    className={`catalog-stock-toggle ${enStockOnly ? "is-on" : ""}`}
                    onClick={() => setEnStockOnly((v) => !v)}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  >
                    <span className="catalog-stock-toggle__dot" />
                    {t.catInStockOnly}
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="catalog-filters__footer">
            <p className="catalog-filters__count">
              <strong>{stats.shown}</strong>{" "}
              {stats.shown !== 1 ? t.catResultsPlural : t.catResults}
              <span>
                {" "}
                · {t.catPage} {pageSafe}/{totalPages}
              </span>
            </p>
            <div className="catalog-filters__chips">
              <AnimatePresence>
                {activeChips.map((chip) => (
                  <motion.button
                    key={chip.key}
                    type="button"
                    className="catalog-active-chip"
                    onClick={chip.clear}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    {chip.label}
                    <X className="w-3 h-3" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* PRODUCTS */}
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid sm:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4"}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="skeleton h-[360px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div className="catalog-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <PackageSearch className="w-10 h-10 opacity-40" />
            <p className="font-bold">{t.catEmptyTitle}</p>
            <p className="text-sm">{t.catEmptyText}</p>
            <button type="button" className="btn-primary-orange mt-4 px-5 py-2.5 text-sm" onClick={resetFilters}>
              {t.catReset}
            </button>
          </motion.div>
        ) : (
          <>
            <motion.div
              key={`${viewMode}-${sortBy}-${category}-${enStockOnly}-${search}-${pageSafe}`}
              variants={listVariants}
              initial="hidden"
              animate="show"
              className={viewMode === "grid" ? "catalog-grid" : "catalog-list"}
            >
              {pageItems.map((a) => {
                const stock = stockOf(a);
                const isNew = Number(a.id) > (items?.[0]?.id || 0) - 5;
                const cat = categoryOf(a);
                const wished = wishSet.has(Number(a.id));
                return (
                  <motion.article
                    key={a.id}
                    variants={itemVariants}
                    layout
                    whileHover={reduceMotion ? undefined : { y: -8 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    className={`catalog-card ${viewMode === "list" ? "catalog-card--list" : ""}`}
                    onClick={() => openQuickView(a)}
                  >
                    <div className="catalog-card__glow" aria-hidden="true" />
                    <div className="catalog-card__accent" aria-hidden="true" />

                    <button
                      type="button"
                      className={`catalog-card__wish${wished ? " is-active" : ""}`}
                      title={wished ? t.catRemoveWishlist : t.catAddWishlist}
                      aria-label={t.catWishlist}
                      onClick={(e) => toggleWish(e, a.id)}
                      disabled={wishMut.isPending}
                    >
                      <Heart
                        className="w-4 h-4"
                        style={{
                          color: wished ? "#fff" : "#0c5460",
                          fill: wished ? "#fff" : "transparent",
                        }}
                      />
                    </button>

                    <button
                      type="button"
                      className="catalog-card__media"
                      onClick={(e) => {
                        e.stopPropagation();
                        openQuickView(a);
                      }}
                      aria-label={`Détail ${a.libelle}`}
                    >
                      <img src={getArticleImageUrl(a)} alt="" loading="lazy" />
                      <span className="catalog-card__shine" aria-hidden="true" />
                      <span className="catalog-card__overlay" aria-hidden="true" />
                      <div className="catalog-card__badges">
                        <span className="code-badge">{a.code}</span>
                        {isNew && (
                          <span className="catalog-badge-new">
                            <Sparkles className="w-3 h-3" />
                            {t.catNew}
                          </span>
                        )}
                      </div>
                      <span className="catalog-card__price-float">{formatMoneyTnd(a.prixVente)}</span>
                      <span className="catalog-card__hint">
                        <Eye className="w-3.5 h-3.5" />
                        {t.catQuickView}
                      </span>
                    </button>

                    <div className="catalog-card__body">
                      {cat && (
                        <p className="catalog-card__cat">
                          <Tag className="w-3 h-3" />
                          {cat}
                        </p>
                      )}
                      <h3 className="catalog-card__title">{a.libelle}</h3>
                      {a.description && <p className="catalog-card__desc">{a.description}</p>}
                      <div className="catalog-card__stock-row">
                        <StockLabel stock={stock} />
                        <StockMeter stock={stock} />
                      </div>

                      <div className="catalog-card__footer">
                        <div>
                          <p className="catalog-card__price-label">{t.catPriceTtc}</p>
                          <p className="catalog-card__price">{formatMoneyTnd(a.prixVente)}</p>
                          <p className="catalog-card__unit">{t.catUnit} : {a.unite || "UN"}</p>
                        </div>
                        <div className="catalog-card__actions">
                          <Link
                            to={`/articles/${a.id}`}
                            className="catalog-card__detail"
                            onClick={(e) => e.stopPropagation()}
                            title={t.catFullSheet}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            className="catalog-card__detail"
                            title={t.demandesWrite}
                            aria-label={t.demandesWrite}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDemandeArticle(a);
                            }}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <motion.button
                            type="button"
                            className="btn-primary-orange catalog-card__add"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdd(a);
                            }}
                            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
                            whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                            animate={
                              cartBumpId === a.id && !reduceMotion ? { scale: [1, 1.08, 1] } : {}
                            }
                          >
                            <ShoppingCart className="w-4 h-4" />
                            {t.catAddQty}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>

            <ClientPagination
              page={pageSafe}
              totalPages={totalPages}
              totalItems={serverMode ? Number(serverPagination.total) || filtered.length : filtered.length}
              pageSize={pageSize}
              onPageChange={goToPage}
              onPageSizeChange={serverMode ? undefined : setPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              label={t.catProducts}
            />
          </>
        )}

        {/* DETAIL MODAL — portail body pour passer au-dessus du footer */}
        {createPortal(
          <div className="client-shop catalog-modal-portal">
            <AnimatePresence>
              {quickView && (
                <motion.div
                  className="catalog-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button type="button" className="catalog-modal__backdrop" aria-label={t.catClose} onClick={() => setQuickView(null)} />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="catalog-modal-title"
                  className="catalog-modal__panel catalog-modal__panel--pro"
                  initial={{ opacity: 0, y: 36, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 340, damping: 26 }}
                >
                  <div className="catalog-modal__topbar">
                    <div className="catalog-modal__topbar-left">
                      <span className="catalog-modal__kicker">{t.catProductDetail}</span>
                    </div>
                    <button type="button" className="catalog-modal__close" onClick={() => setQuickView(null)} aria-label={t.catClose}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="catalog-modal__grid">
                    <div className="catalog-modal__visual">
                      <img src={getArticleImageUrl(quickView)} alt={quickView.libelle} />
                      <div className="catalog-modal__visual-meta">
                        <span className="code-badge">{quickView.code}</span>
                        <StockLabel stock={stockOf(quickView)} />
                      </div>
                    </div>

                    <div className="catalog-modal__info">
                      <h2 id="catalog-modal-title">{quickView.libelle}</h2>
                      <p className="catalog-modal__desc">
                        {quickView.description || t.catNoDescription}
                      </p>

                      <div className="catalog-modal__specs">
                        <div>
                          <Package className="w-4 h-4" />
                          <div>
                            <span>{t.catUnit}</span>
                            <strong>{quickView.unite || "UN"}</strong>
                          </div>
                        </div>
                        <div>
                          <Tag className="w-4 h-4" />
                          <div>
                            <span>{t.catCategory}</span>
                            <strong>{categoryOf(quickView) || "—"}</strong>
                          </div>
                        </div>
                        {quickView.poids != null && (
                          <div>
                            <Package className="w-4 h-4" />
                            <div>
                              <span>Poids</span>
                              <strong>{quickView.poids} kg</strong>
                            </div>
                          </div>
                        )}
                        {quickView.volume != null && (
                          <div>
                            <Package className="w-4 h-4" />
                            <div>
                              <span>Volume</span>
                              <strong>{quickView.volume} m³</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="catalog-modal__price-row">
                        <div>
                          <p className="catalog-card__price-label">{t.catPriceTtc}</p>
                          <p className="catalog-modal__price">{formatMoneyTnd(quickView.prixVente)}</p>
                        </div>
                        <p className="catalog-modal__line-total">
                          Total ligne
                          <strong>{formatMoneyTnd(Number(quickView.prixVente || 0) * normalizeQty(qvQty))}</strong>
                        </p>
                      </div>

                      <div className="catalog-modal__actions">
                        <ClientQtyStepper
                          value={qvQty}
                          onChange={setQvQty}
                          max={stockOf(quickView) ?? undefined}
                          onExceedMax={toastStockCap}
                        />
                        <button
                          type="button"
                          className="btn-outline-teal inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"
                          onClick={(e) => toggleWish(e, quickView.id)}
                          disabled={wishMut.isPending}
                          title={t.catWishlist}
                        >
                          <Heart
                            className="w-4 h-4"
                            style={{
                              color: wishSet.has(Number(quickView.id)) ? "#ff6b35" : undefined,
                              fill: wishSet.has(Number(quickView.id)) ? "#ff6b35" : "transparent",
                            }}
                          />
                        </button>
                        <motion.button
                          type="button"
                          className="btn-primary-orange flex-1 py-3 text-sm inline-flex items-center justify-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            handleAdd(quickView, qvQty);
                            setQuickView(null);
                          }}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          {t.catAddQty} × {normalizeQty(qvQty).toLocaleString(t.localeTag)}
                        </motion.button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-outline-teal catalog-modal__full flex-1"
                          onClick={() => setDemandeArticle(quickView)}
                        >
                          <MessageSquare className="w-4 h-4" />
                          {t.demandesWrite}
                        </button>
                        <Link
                          to={`/articles/${quickView.id}`}
                          className="btn-outline-teal catalog-modal__full flex-1"
                          onClick={() => setQuickView(null)}
                        >
                          <ExternalLink className="w-4 h-4" />
                          {t.catFullSheet}
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>,
          document.body
        )}
      </div>
      <VisualSearchModal open={visualSearchOpen} onClose={() => setVisualSearchOpen(false)} />
      <DemandeComposer
        open={Boolean(demandeArticle)}
        article={demandeArticle}
        onClose={() => setDemandeArticle(null)}
      />
    </div>
  );
}
