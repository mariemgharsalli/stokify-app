import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Package,
  ExternalLink,
  Search,
  Truck,
  CheckCircle2,
  Clock3,
  Sparkles,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import api from "../../services/api";
import { getArticleImageUrl } from "../articles/ClientCatalog";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import ClientPagination from "../../components/ui/ClientPagination";
import OrderTimeline from "../../components/client/OrderTimeline";
import { useLandingLang } from "../landing/LandingLangContext";
import DemandeComposer from "../../components/demandes/DemandeComposer";

const PAGE_SIZE_OPTIONS = [5, 6, 10, 20];

const STATUT_STYLE_BASE = {
  EN_ATTENTE: { bg: "#fff7ed", color: "#c2410c" },
  CONFIRMEE: { bg: "#ecfdf5", color: "#047857" },
  EN_PREPARATION: { bg: "#eff6ff", color: "#378ADD" },
  EXPEDIEE: { bg: "#e0f2fe", color: "#0284c7" },
  LIVREE: { bg: "#ecfeff", color: "#0e7490" },
  ANNULEE: { bg: "#fef2f2", color: "#b91c1c" },
};

const FILTER_KEYS = ["TOUS", "EN_ATTENTE", "CONFIRMEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE", "ANNULEE"];

function StatutBadge({ statut }) {
  const { t } = useLandingLang();
  const labels = {
    EN_ATTENTE: t.statusPending,
    CONFIRMEE: t.statusConfirmed,
    EN_PREPARATION: t.statusPreparing,
    EXPEDIEE: t.statusShipped,
    LIVREE: t.statusDelivered,
    ANNULEE: t.statusCancelled,
  };
  const base = STATUT_STYLE_BASE[statut] || STATUT_STYLE_BASE.EN_ATTENTE;
  const label = labels[statut] || labels.EN_ATTENTE;
  return (
    <span className="client-statut-badge" style={{ background: base.bg, color: base.color }}>
      <span className="client-statut-badge__dot" style={{ background: base.color }} />
      {label}
    </span>
  );
}

export default function MesCommandes() {
  const { t } = useLandingLang();
  const reduce = useReducedMotion();
  const [openId, setOpenId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [statutFilter, setStatutFilter] = useState("TOUS");
  const [search, setSearch] = useState("");
  const [demandeCommande, setDemandeCommande] = useState(null);

  const filterLabels = {
    TOUS: t.ordersFilterAll,
    EN_ATTENTE: t.statusPending,
    CONFIRMEE: t.statusConfirmed,
    EN_PREPARATION: t.statusPreparing,
    EXPEDIEE: t.statusShipped,
    LIVREE: t.statusDelivered,
    ANNULEE: t.statusCancelled,
  };

  function formatDate(d) {
    return new Intl.DateTimeFormat(t.localeTag, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(d));
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mes-commandes", page, pageSize],
    queryFn: () =>
      api.get("commandes-client", { params: { page, limit: pageSize } }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const totalItems = data?.total ?? items.length;
  const totalPages = data?.pages ?? Math.max(1, Math.ceil(totalItems / pageSize) || 1);

  const visibleItems = items.filter((c) => {
    if (statutFilter !== "TOUS" && c.statut !== statutFilter) return false;
    if (search && !c.reference?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pageStats = useMemo(() => {
    const pending = items.filter((c) =>
      ["EN_ATTENTE", "CONFIRMEE", "EN_PREPARATION"].includes(c.statut)
    ).length;
    const shipped = items.filter((c) => ["EXPEDIEE", "LIVREE"].includes(c.statut)).length;
    return { pending, shipped, total: totalItems };
  }, [items, totalItems]);

  function goToPage(next) {
    setPage(next);
    setOpenId(null);
    document.getElementById("mes-commandes-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changePageSize(next) {
    setPageSize(next);
    setPage(1);
    setOpenId(null);
  }

  function resetFilters() {
    setStatutFilter("TOUS");
    setSearch("");
  }

  const kpis = [
    { icon: Package, label: t.ordersStatTotal, value: pageStats.total, tone: "navy" },
    { icon: Clock3, label: t.ordersStatLive, value: pageStats.pending, tone: "warn" },
    { icon: Truck, label: t.ordersStatShipped, value: pageStats.shipped, tone: "ok" },
    { icon: CheckCircle2, label: t.ordersStatPage, value: `${page}/${totalPages}`, tone: "cyan" },
  ];

  return (
    <div className="orders-atelier orders-hero">
      <section className="orders-atelier__hero">
        <div className="orders-atelier__atmos" aria-hidden="true">
          <img className="orders-atelier__photo" src="/cutouts/hero-orders-atelier.png" alt="" />
          <div className="orders-atelier__veil" />
          <div className="orders-atelier__lattice" />
          <div className="orders-atelier__sheen" />
          {!reduce &&
            [0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="orders-atelier__orb"
                style={{ left: `${16 + i * 20}%`, top: `${20 + (i % 2) * 26}%` }}
                animate={{ y: [0, -14, 0], opacity: [0.2, 0.65, 0.2] }}
                transition={{ duration: 4.2 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
              />
            ))}
        </div>

        <div className="orders-atelier__hero-inner">
          <div className="orders-atelier__copy">
          <motion.p
            className="orders-atelier__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t.ordersHeroEyebrow}
          </motion.p>
          <motion.h1
            className="orders-atelier__title"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            {t.ordersHeroTitle} <span>{t.ordersHeroAccent}</span>
          </motion.h1>
          <motion.p
            className="orders-atelier__sub"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            {!isLoading && totalItems > 0
              ? `${totalItems} ${t.ordersLabel} · ${t.ordersHistoryPage} ${page}/${totalPages}`
              : t.ordersHeroSubtitle}
          </motion.p>

          {!isLoading && !isError && totalItems > 0 && (
            <motion.ul
              className="orders-atelier__kpis"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              {kpis.map((k) => (
                <li key={k.label} className={`orders-atelier__kpi is-${k.tone}`}>
                  <k.icon className="w-4 h-4" />
                  <div>
                    <span>{k.label}</span>
                    <strong>{k.value}</strong>
                  </div>
                </li>
              ))}
            </motion.ul>
          )}
          </div>
        </div>
      </section>

      <section id="mes-commandes-list" className="orders-atelier__stage scroll-mt-24">
        {isLoading && (
          <div className="orders-atelier__skels">
            {[1, 2, 3].map((i) => (
              <div key={i} className="orders-atelier__skel" />
            ))}
          </div>
        )}

        {isError && <p className="orders-atelier__error">{t.ordersLoadError}</p>}

        {!isLoading && !isError && items.length === 0 && (
          <motion.div
            className="orders-atelier__empty"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="orders-atelier__empty-orb"
              animate={reduce ? undefined : { y: [0, -10, 0] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="orders-atelier__empty-ring" />
              <Package className="w-10 h-10" strokeWidth={1.4} />
            </motion.div>
            <h2>{t.ordersEmpty}</h2>
            <p>{t.ordersEmptyLead}</p>
            <Link to="/articles" className="orders-atelier__cta">
              <span className="orders-atelier__cta-shine" aria-hidden="true" />
              <span>{t.ordersBrowse}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <motion.div
            className="orders-atelier__toolbar"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <label className="orders-atelier__search">
              <Search className="w-4 h-4" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.ordersSearchPh}
              />
            </label>
            <div className="orders-atelier__chips">
              {FILTER_KEYS.map((s) => {
                const active = statutFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatutFilter(s)}
                    className={`orders-atelier__chip${active ? " is-active" : ""}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="orders-chip-pill"
                        className="orders-atelier__chip-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span>{filterLabels[s] || s}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {!isLoading && !isError && items.length > 0 && visibleItems.length === 0 && (
          <motion.div className="orders-atelier__nomatch" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Sparkles className="w-6 h-6 mb-2 opacity-40" />
            <p>{t.ordersNoMatch}</p>
            <button type="button" className="orders-atelier__reset" onClick={resetFilters}>
              {t.ordersReset}
            </button>
          </motion.div>
        )}

        <ul className="orders-atelier__list">
          {visibleItems.map((cmd, idx) => {
            const open = openId === cmd.id;
            const lignes = cmd.lignes || [];
            const preview = lignes.slice(0, 3);
            const extra = Math.max(0, lignes.length - preview.length);

            return (
              <motion.li
                key={cmd.id}
                layout
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                className={`orders-card${open ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="orders-card__head"
                  onClick={() => setOpenId(open ? null : cmd.id)}
                  aria-expanded={open}
                >
                  <div className="orders-card__thumbs" aria-hidden="true">
                    {preview.length > 0 ? (
                      preview.map((l, ti) => (
                        <span
                          key={l.id}
                          className="orders-card__thumb"
                          style={{ zIndex: preview.length - ti, marginLeft: ti === 0 ? 0 : -12 }}
                        >
                          <img src={getArticleImageUrl(l.article || { id: l.articleId })} alt="" />
                        </span>
                      ))
                    ) : (
                      <span className="orders-card__thumb orders-card__thumb--empty">
                        <Package className="w-5 h-5" />
                      </span>
                    )}
                    {extra > 0 && <span className="orders-card__more">+{extra}</span>}
                  </div>

                  <div className="orders-card__meta">
                    <div className="orders-card__row">
                      <span className="orders-card__ref">{cmd.reference}</span>
                      <StatutBadge statut={cmd.statut} />
                    </div>
                    <p className="orders-card__sub">
                      {formatDate(cmd.createdAt)}
                      <span className="orders-card__sep" />
                      {lignes.length} {t.ordersLines}
                    </p>
                  </div>

                  <div className="orders-card__price-col">
                    <p className="orders-card__price">{formatMoneyTnd(cmd.montantTTC)}</p>
                    <span className={`orders-card__chevron${open ? " is-open" : ""}`}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="orders-card__body">
                        <OrderTimeline statut={cmd.statut} />

                        <div className="orders-card__lines-head">
                          <Package className="w-3.5 h-3.5" />
                          {t.ordersLinesHead}
                        </div>

                        <ul className="orders-card__lines">
                          {lignes.map((l, li) => (
                            <motion.li
                              key={l.id}
                              className="orders-line"
                              initial={reduce ? false : { opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: li * 0.04 }}
                            >
                              <div className="orders-line__media">
                                <img src={getArticleImageUrl(l.article || { id: l.articleId })} alt="" />
                              </div>
                              <div className="orders-line__info">
                                <p className="orders-line__title">
                                  {l.article?.libelle || `${t.ordersArticle} #${l.articleId}`}
                                </p>
                                <p className="orders-line__sub">
                                  {l.article?.code && <span className="orders-line__code">{l.article.code}</span>}
                                  <span>
                                    × {Number(l.quantite).toLocaleString(t.localeTag)} ·{" "}
                                    {formatMoneyTnd(l.prixUnitaire)}
                                  </span>
                                </p>
                              </div>
                              <p className="orders-line__total">{formatMoneyTnd(l.totalLigne)}</p>
                            </motion.li>
                          ))}
                        </ul>

                        <div className="orders-card__foot">
                          <div className="orders-card__total">
                            <span>{t.cartTotalTtc}</span>
                            <strong>{formatMoneyTnd(cmd.montantTTC)}</strong>
                          </div>
                          <button
                            type="button"
                            className="orders-atelier__cta orders-atelier__cta--sm"
                            onClick={() => setDemandeCommande(cmd)}
                          >
                            <span className="orders-atelier__cta-shine" aria-hidden="true" />
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{t.demandesWrite}</span>
                          </button>
                          <Link to={`/mes-commandes/${cmd.id}`} className="orders-atelier__cta orders-atelier__cta--sm">
                            <span className="orders-atelier__cta-shine" aria-hidden="true" />
                            <span>{t.ordersDetailLink}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>

        {!isLoading && !isError && totalItems > 0 && (
          <motion.div className="mt-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ClientPagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              label={t.ordersLabel}
            />
          </motion.div>
        )}
      </section>
      <DemandeComposer
        open={Boolean(demandeCommande)}
        commande={demandeCommande}
        onClose={() => setDemandeCommande(null)}
      />
    </div>
  );
}
