import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Heart,
  Package,
  Scale,
  MessageSquare,
  ShoppingCart,
  Sparkles,
  Tag,
} from "lucide-react";

import api from "../../services/api";
import { getArticleImageUrl } from "../articles/ClientCatalog";
import { useCartStore } from "../../store/cartStore";
import { useToastStore } from "../../store/toastStore";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import ClientQtyStepper from "../../components/ui/ClientQtyStepper";
import { normalizeQty } from "../../utils/clientQty";
import { useLandingLang } from "../landing/LandingLangContext";
import DemandeComposer from "../../components/demandes/DemandeComposer";

const EASE = [0.16, 1, 0.3, 1];

function stockTone(stock) {
  if (stock == null) return "muted";
  if (stock > 5) return "ok";
  if (stock > 0) return "low";
  return "out";
}

function stockLabel(stock) {
  if (stock == null) return "Disponibilité à confirmer";
  if (stock > 5) return `En stock · ${stock} unités`;
  if (stock > 0) return `Stock faible · ${stock}`;
  return "Sur commande";
}

export default function ClientArticleDetail({ articleId }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const addItem = useCartStore((s) => s.addItem);
  const pushToast = useToastStore((s) => s.pushToast);
  const [qty, setQty] = useState(1);
  const [addedPulse, setAddedPulse] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const { t } = useLandingLang();

  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article-client", articleId],
    queryFn: () => api.get(`articles/${articleId}`).then((r) => r.data),
    enabled: Number.isFinite(articleId) && articleId > 0,
  });

  const { data: similaires } = useQuery({
    queryKey: ["articles-similaires", articleId],
    queryFn: () =>
      api.get(`articles/${articleId}/similaires`, { params: { limit: 6 } }).then((r) => r.data),
    enabled: Number.isFinite(articleId) && articleId > 0,
  });

  const { data: wishIds } = useQuery({
    queryKey: ["wishlist-ids"],
    queryFn: () => api.get("wishlist/ids").then((r) => r.data),
  });

  const wishMut = useMutation({
    mutationFn: async () => {
      const inWish = (wishIds?.articleIds || []).includes(Number(articleId));
      if (inWish) return api.delete(`wishlist/items/${articleId}`);
      return api.post("wishlist/items", { articleId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      pushToast("Favoris mis à jour", "success");
    },
  });

  const stock = useMemo(() => {
    if (!article) return null;
    if (article.stockDisponible != null) return Number(article.stockDisponible);
    if (Array.isArray(article.stocks)) {
      return article.stocks.reduce(
        (s, x) => s + Math.max(0, (Number(x.quantite) || 0) - (Number(x.qteReservee) || 0)),
        0
      );
    }
    return null;
  }, [article]);

  const category =
    article?.famille?.nom || article?.familleNom || article?.sousFamille?.nom || "";
  const inWishlist = (wishIds?.articleIds || []).includes(Number(articleId));
  const lineTotal = Number(article?.prixVente || 0) * normalizeQty(qty);
  const meterPct =
    stock == null ? 0 : Math.max(0, Math.min(100, (Number(stock) / 40) * 100));

  function handleAdd() {
    const r = addItem({ ...article, stockDisponible: stock }, normalizeQty(qty));
    if (r.ok) {
      pushToast(`${article.libelle} × ${r.added || normalizeQty(qty)} ajouté`, "success");
      setAddedPulse(true);
      setTimeout(() => setAddedPulse(false), 700);
    } else {
      pushToast("Stock insuffisant", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="client-product client-product--loading max-w-6xl mx-auto px-4 py-8">
        <div className="skeleton h-8 w-40 mb-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="skeleton aspect-square rounded-3xl" />
          <div className="space-y-3">
            <div className="skeleton h-10 w-3/4" />
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-32 w-full rounded-2xl" />
            <div className="skeleton h-16 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p style={{ color: "var(--client-text-muted)" }}>Article introuvable.</p>
        <Link to="/articles" className="btn-primary-orange inline-flex mt-6 px-6 py-3 text-sm">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  const specs = [
    { icon: Package, label: "Unité", value: article.unite || "UN" },
    { icon: Boxes, label: "Stock", value: stock != null ? String(stock) : "—" },
    article.poids != null
      ? { icon: Scale, label: "Poids", value: `${article.poids} kg` }
      : null,
    article.volume != null
      ? { icon: Boxes, label: "Volume", value: `${article.volume} m³` }
      : null,
    category ? { icon: Tag, label: "Catégorie", value: category } : null,
  ].filter(Boolean);

  return (
    <motion.div
      className="client-product"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="client-product__shell">
        <button
          type="button"
          onClick={() => navigate("/articles")}
          className="client-product__back"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au catalogue
        </button>

        <div className="client-product__hero">
          <motion.div
            className="client-product__media"
            initial={reduce ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <span className="client-product__media-beam" aria-hidden />
            <div className="client-product__media-frame">
              <motion.img
                src={getArticleImageUrl(article)}
                alt={article.libelle}
                initial={reduce ? false : { scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.75, ease: EASE }}
              />
              <div className="client-product__media-fade" aria-hidden />
            </div>
            <motion.button
              type="button"
              className={`client-product__wish${inWishlist ? " is-active" : ""}`}
              onClick={() => wishMut.mutate()}
              disabled={wishMut.isPending}
              whileHover={reduce ? undefined : { scale: 1.08 }}
              whileTap={reduce ? undefined : { scale: 0.92 }}
              aria-label="Favoris"
            >
              <Heart
                className="w-5 h-5"
                style={{
                  fill: inWishlist ? "#fff" : "transparent",
                  color: inWishlist ? "#fff" : "var(--brand-blue)",
                }}
              />
            </motion.button>
            <span className={`client-product__stock-pill client-product__stock-pill--${stockTone(stock)}`}>
              <span className="client-product__stock-dot" />
              {stockLabel(stock)}
            </span>
          </motion.div>

          <div className="client-product__info">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.45, ease: EASE }}
            >
              <div className="client-product__kicker">
                <Sparkles className="w-3.5 h-3.5" />
                Fiche produit
              </div>
              {category ? <p className="client-product__cat">{category}</p> : null}
              <h1 className="client-product__title">{article.libelle}</h1>
              <span className="code-badge client-product__code">{article.code}</span>
              <p className="client-product__desc">
                {article.description || "Aucune description pour cet article."}
              </p>
            </motion.div>

            <motion.div
              className="client-product__price-block"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.4, ease: EASE }}
            >
              <div>
                <p className="client-product__price-label">Prix TTC</p>
                <p className="client-product__price">{formatMoneyTnd(article.prixVente)}</p>
              </div>
              <div className="client-product__meter-wrap">
                <p>Disponibilité</p>
                <div className={`client-product__meter client-product__meter--${stockTone(stock)}`}>
                  <motion.span
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${meterPct}%` }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
                  />
                </div>
              </div>
            </motion.div>

            <div className="client-product__specs">
              {specs.map(({ icon: Icon, label, value }, i) => (
                <motion.div
                  key={label}
                  className="client-product__spec"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 + i * 0.05, duration: 0.35, ease: EASE }}
                  whileHover={reduce ? undefined : { y: -3 }}
                >
                  <span className="client-product__spec-icon">
                    <Icon className="w-4 h-4" strokeWidth={2.25} />
                  </span>
                  <div>
                    <p>{label}</p>
                    <strong>{value}</strong>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="client-product__buybar"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4, ease: EASE }}
            >
              <div className="client-product__buybar-total">
                <p>Total ligne</p>
                <motion.strong key={lineTotal} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }}>
                  {formatMoneyTnd(lineTotal)}
                </motion.strong>
              </div>
              <ClientQtyStepper
                value={qty}
                onChange={setQty}
                max={stock != null && stock > 0 ? stock : undefined}
              />
              <motion.button
                type="button"
                className="btn-primary-orange client-product__add"
                whileHover={reduce ? undefined : { scale: 1.03 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                animate={
                  addedPulse && !reduce ? { scale: [1, 1.06, 1] } : undefined
                }
                onClick={handleAdd}
              >
                <ShoppingCart className="w-4 h-4" />
                Ajouter au panier
              </motion.button>
              <button
                type="button"
                className="btn-outline-teal inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"
                onClick={() => setAskOpen(true)}
              >
                <MessageSquare className="w-4 h-4" />
                {t.demandesWrite}
              </button>
            </motion.div>
          </div>
        </div>

        {(similaires?.items || []).length > 0 && (
          <section className="client-product__similar">
            <div className="client-product__similar-head">
              <div>
                <p className="client-product__similar-kicker">Complément</p>
                <h2>Produits similaires</h2>
              </div>
              <Link to="/articles" className="client-product__similar-all">
                Voir le catalogue
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="client-product__similar-grid">
              {similaires.items.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
                  whileHover={reduce ? undefined : { y: -4 }}
                >
                  <Link to={`/articles/${a.id}`} className="client-similar-card">
                    <div className="client-similar-card__media">
                      <img src={getArticleImageUrl(a)} alt="" />
                    </div>
                    <div className="client-similar-card__body">
                      <p className="client-similar-card__name">{a.libelle}</p>
                      <p className="client-similar-card__price">{formatMoneyTnd(a.prixVente)}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
      <DemandeComposer open={askOpen} article={article} onClose={() => setAskOpen(false)} />
    </motion.div>
  );
}
