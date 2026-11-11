import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, ExternalLink, Eye, Heart, ImagePlus, PackageSearch, ShoppingCart, Sparkles, Tag, Upload, X } from "lucide-react";
import api from "../../../services/api";
import { useCartStore } from "../../../store/cartStore";
import { useToastStore } from "../../../store/toastStore";
import { formatMoneyTnd } from "../../../utils/formatMoneyTnd";
import { getArticleImageUrl, getArticleRealImageUrl } from "../../../utils/articleImage";
import { normalizeQty } from "../../../utils/clientQty";
import { useLandingLang } from "../../landing/LandingLangContext";
import { useVisualProductSearch } from "../../../hooks/useVisualProductSearch";
import { cosineSimilarity, selectCloseLooks } from "../../../utils/visualSearchMapping";

const EMPTY_ARTICLES = [];
const NO_SIMILAR_PRODUCT_MESSAGE =
  "Aucun article n'est assez proche de cette photo. Rapprochez le produit, sur un fond uni, et capturez à nouveau.";

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

function stockOf(article) {
  if (article == null || article.stockDisponible == null) return null;
  const n = Number(article.stockDisponible);
  return Number.isFinite(n) ? n : null;
}

function categoryOf(article) {
  return (
    article.familleNom ||
    article.famille?.nom ||
    article.famille?.libelle ||
    article.sousFamilleNom ||
    article.sousFamille?.nom ||
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

/** Même structure et mêmes classes que la carte inline de ClientCatalog. */
function CatalogArticleCard({
  article,
  wished,
  wishPending,
  onToggleWish,
  onAdd,
  cartBump,
  onOpen,
  newestAnchorId = 0,
  matchScore = null,
  proposalTag = "",
}) {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const stock = stockOf(article);
  const cat = categoryOf(article);
  const isNew = Number(article.id) > (Number(newestAnchorId) || 0) - 5;

  return (
    <motion.article
      variants={itemVariants}
      layout
      whileHover={reduceMotion ? undefined : { y: -8 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="catalog-card"
      onClick={() => onOpen(article)}
    >
      <div className="catalog-card__glow" aria-hidden="true" />
      <div className="catalog-card__accent" aria-hidden="true" />

      <button
        type="button"
        className={`catalog-card__wish${wished ? " is-active" : ""}`}
        title={wished ? t.catRemoveWishlist : t.catAddWishlist}
        aria-label={t.catWishlist}
        onClick={(e) => onToggleWish(e, article.id)}
        disabled={wishPending}
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
          onOpen(article);
        }}
        aria-label={`Détail ${article.libelle}`}
      >
        <img src={getArticleImageUrl(article)} alt="" loading="lazy" />
        <span className="catalog-card__shine" aria-hidden="true" />
        <span className="catalog-card__overlay" aria-hidden="true" />
        <div className="catalog-card__badges">
          <span className="code-badge">{article.code}</span>
          {isNew && (
            <span className="catalog-badge-new">
              <Sparkles className="w-3 h-3" />
              {t.catNew}
            </span>
          )}
        </div>
        <span className="catalog-card__price-float">{formatMoneyTnd(article.prixVente)}</span>
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
        <h3 className="catalog-card__title">{article.libelle}</h3>
        {matchScore != null && (
          <div className="vs-score" aria-label={`${Math.round(matchScore * 100)} pour cent de similarité`}>
            <span>Similarité</span>
            <strong>{Math.round(matchScore * 100)}%</strong>
            <div className="vs-score__track">
              <i style={{ width: `${Math.max(8, Math.round(matchScore * 100))}%` }} />
            </div>
          </div>
        )}
        {matchScore == null && proposalTag && <p className="vs-proposal">{proposalTag}</p>}
        {article.description && <p className="catalog-card__desc">{article.description}</p>}
        <div className="catalog-card__stock-row">
          <StockLabel stock={stock} />
          <StockMeter stock={stock} />
        </div>

        <div className="catalog-card__footer">
          <div>
            <p className="catalog-card__price-label">{t.catPriceTtc}</p>
            <p className="catalog-card__price">{formatMoneyTnd(article.prixVente)}</p>
            <p className="catalog-card__unit">
              {t.catUnit} : {article.unite || "UN"}
            </p>
          </div>
          <div className="catalog-card__actions">
            <Link
              to={`/articles/${article.id}`}
              className="catalog-card__detail"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(article, { alreadyNavigating: true });
              }}
              title={t.catFullSheet}
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <motion.button
              type="button"
              className="btn-primary-orange catalog-card__add"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(article);
              }}
              whileHover={reduceMotion ? undefined : { scale: 1.04 }}
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              animate={cartBump && !reduceMotion ? { scale: [1, 1.08, 1] } : {}}
            >
              <ShoppingCart className="w-4 h-4" />
              {t.catAddQty}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function isPermissionDenied(error) {
  return error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

function paintFrame(source, canvas) {
  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  const maxSide = 960;
  const scale = Math.min(1, maxSide / Math.max(width, height, 1));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
}

async function requestCamera() {
  const withRearCamera = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(withRearCamera);
  } catch (error) {
    if (isPermissionDenied(error)) throw error;
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  }
}

async function fetchVisualSearchCatalogue() {
  const limit = 100;
  const first = await api
    .get("articles/catalogue", { params: { statut: "ACTIF", page: 1, limit } })
    .then((response) => response.data);
  const items = [...(first?.items || [])];
  const pages = Math.max(1, Number(first?.pages) || 1);
  for (let page = 2; page <= pages; page += 1) {
    const next = await api
      .get("articles/catalogue", { params: { statut: "ACTIF", page, limit } })
      .then((response) => response.data);
    items.push(...(next?.items || []));
  }
  return items;
}

/**
 * Modal de recherche visuelle.
 * Le modèle n'est demandé qu'à l'ouverture (preloadModel), jamais à l'import du fichier.
 */
export function VisualSearchModal({ open, onClose, articles = EMPTY_ARTICLES }) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { t } = useLandingLang();
  const qc = useQueryClient();
  const addItem = useCartStore((s) => s.addItem);
  const pushToast = useToastStore((s) => s.pushToast);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const resultRef = useRef(null);
  const streamRef = useRef(null);
  const indexPromiseRef = useRef(null);
  const mountedRef = useRef(true);
  const { embedImage, indexCatalogueImages, preloadModel } = useVisualProductSearch();

  const [cameraStatus, setCameraStatus] = useState("starting");
  const [sourceMode, setSourceMode] = useState("camera");
  const [phase, setPhase] = useState("idle");
  const [outcome, setOutcome] = useState(null);
  const [matches, setMatches] = useState([]);
  const [newestAnchorId, setNewestAnchorId] = useState(0);
  const [cartBumpId, setCartBumpId] = useState(null);
  const [shotUrl, setShotUrl] = useState("");
  const [cameraSession, setCameraSession] = useState(0);
  const [indexProgress, setIndexProgress] = useState({ done: 0, total: 0 });
  const [indexReady, setIndexReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [flash, setFlash] = useState(false);

  const hasProvidedArticles = Array.isArray(articles) && articles.length > 0;
  useQuery({
    queryKey: ["articles", "visual-search"],
    queryFn: fetchVisualSearchCatalogue,
    enabled: open && !hasProvidedArticles,
    staleTime: 60 * 1000,
  });

  const { data: wishIds } = useQuery({
    queryKey: ["wishlist-ids"],
    queryFn: () => api.get("wishlist/ids").then((r) => r.data),
    enabled: open,
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

  const resetOutcome = useCallback(() => {
    setOutcome(null);
    setMatches([]);
    setNewestAnchorId(0);
    setPhase("idle");
    setShotUrl("");
  }, []);

  function stopCamera() {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus("closed");
  }

  function rememberShot(canvas) {
    const preview = document.createElement("canvas");
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height, 1));
    preview.width = Math.max(1, Math.round(canvas.width * scale));
    preview.height = Math.max(1, Math.round(canvas.height * scale));
    preview.getContext("2d").drawImage(canvas, 0, 0, preview.width, preview.height);
    setShotUrl(preview.toDataURL("image/jpeg", 0.84));
    stopCamera();
  }

  function retake() {
    resetOutcome();
    setSourceMode("camera");
    setCameraSession((session) => session + 1);
  }

  function chooseMode(next) {
    if (next === sourceMode || phase === "analyzing") return;
    setSourceMode(next);
    resetOutcome();
    if (next === "camera") setCameraSession((session) => session + 1);
  }

  const loadCatalogueArticles = useCallback(async () => {
    if (Array.isArray(articles) && articles.length > 0) return articles;
    return qc.fetchQuery({
      queryKey: ["articles", "visual-search"],
      queryFn: fetchVisualSearchCatalogue,
      staleTime: 60 * 1000,
    });
  }, [articles, qc]);

  const ensureIndex = useCallback(() => {
    if (indexPromiseRef.current) return indexPromiseRef.current;
    indexPromiseRef.current = (async () => {
      let catalogue = [];
      try {
        catalogue = (await loadCatalogueArticles()) || [];
      } catch {
        indexPromiseRef.current = null;
        throw new Error("catalogue");
      }
      const entries = [];
      for (const article of catalogue) {
        const url = getArticleRealImageUrl(article);
        if (url) entries.push({ article, url });
      }
      const indexed = await indexCatalogueImages(entries, {
        onProgress: (done, total) => {
          if (!mountedRef.current) return;
          setIndexProgress({ done, total });
        },
      });
      if (mountedRef.current) {
        setIndexProgress({ done: entries.length, total: entries.length });
        setIndexReady(true);
      }
      return { catalogue, indexed };
    })();
    return indexPromiseRef.current;
  }, [indexCatalogueImages, loadCatalogueArticles]);

  const analyzeCanvas = useCallback(
    async (canvas) => {
      setPhase("analyzing");
      setOutcome(null);
      setMatches([]);
      setNewestAnchorId(0);
      rememberShot(canvas);
      try {
        const indexPromise = ensureIndex();
        const query = await embedImage(canvas);
        const packed = await indexPromise;
        const catalogue = packed?.catalogue || [];
        const indexed = packed?.indexed || [];
        const scored = indexed.map((item) => ({
          article: item.article,
          shape: cosineSimilarity(query?.vector, item.vector),
          color: cosineSimilarity(query?.color, item.color),
        }));
        const found = selectCloseLooks(scored);
        setNewestAnchorId(Number(catalogue[0]?.id) || 0);
        setMatches(found);
        setOutcome("ready");
      } catch (error) {
        setOutcome(error?.message === "catalogue" ? "catalogue-error" : "failed");
      } finally {
        setPhase("idle");
      }
    },
    [embedImage, ensureIndex]
  );

  function handleAdd(article, qty = 1) {
    const q = normalizeQty(qty);
    const stock = stockOf(article);
    let capped = q;
    if (stock != null) {
      const cap = Math.max(0, Math.floor(stock));
      if (q > cap) {
        pushToast(`${t.catStockAvailable} : ${cap} ${t.catUnits}`, "warning");
        capped = cap;
      }
    }
    if (capped <= 0) return;
    const result = addItem(article, capped);
    if (!result?.ok) {
      pushToast(`${t.catStockAvailable} : 0 ${t.catUnits}`, "warning");
      return;
    }
    if (result.clamped) {
      pushToast(`${t.catStockAvailable} : ${result.stockDisponible} ${t.catUnits}`, "warning");
    }
    const shown = result.added ?? result.quantite ?? capped;
    if (shown <= 0) return;
    setCartBumpId(article.id);
    setTimeout(() => setCartBumpId(null), 700);
    pushToast(`${article.libelle} × ${shown.toLocaleString(t.localeTag)} ${t.catAdded}`, "success");
  }

  function openArticle(article, options = {}) {
    onClose?.();
    if (!options.alreadyNavigating) navigate(`/articles/${article.id}`);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    preloadModel();
    ensureIndex().catch(() => {
      if (mountedRef.current) setIndexReady(false);
    });
  }, [open, preloadModel, ensureIndex]);

  useEffect(() => {
    if (!open || sourceMode !== "camera") {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (open && sourceMode !== "camera") setCameraStatus("closed");
      return undefined;
    }
    let cancelled = false;
    resetOutcome();
    setCameraStatus(navigator.mediaDevices?.getUserMedia ? "starting" : "unavailable");

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await requestCamera();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // Lecture bloquée : la piste reste active, la capture utilisera la frame courante.
          }
        }
        if (!cancelled) setCameraStatus("live");
      } catch (error) {
        stopStream(streamRef.current);
        streamRef.current = null;
        if (cancelled) return;
        setCameraStatus(isPermissionDenied(error) ? "denied" : "unavailable");
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, sourceMode, cameraSession, resetOutcome]);

  useEffect(() => {
    if (!open || phase === "analyzing" || !outcome) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open, outcome, phase, matches.length]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || phase === "analyzing") return;
    if (!video.videoWidth) {
      setOutcome("not-ready");
      return;
    }
    paintFrame(video, canvas);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 160);
    analyzeCanvas(canvas);
  }

  async function ingestFile(file) {
    if (!file || phase === "analyzing") return;
    if (!file.type.startsWith("image/")) {
      setOutcome("failed");
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const canvas = canvasRef.current;
      if (!canvas) return;
      paintFrame(image, canvas);
      await analyzeCanvas(canvas);
    } catch {
      setOutcome("failed");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function onPickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    ingestFile(file);
  }
  const cameraMessage =
    cameraStatus === "denied"
      ? "L'accès à la caméra a été refusé. Autorisez-la dans le navigateur, ou importez une photo."
      : cameraStatus === "unavailable"
        ? "La caméra n'est pas disponible sur cet appareil. Importez une photo du produit."
        : null;
  const indexPct = indexProgress.total
    ? Math.round((indexProgress.done / indexProgress.total) * 100)
    : 0;
  const showShot = Boolean(shotUrl) && (phase === "analyzing" || outcome);

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 340, damping: 26 };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="client-shop catalog-modal-portal">
      <AnimatePresence>
        {open && (
          <motion.div
            className="catalog-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="catalog-modal__backdrop"
              aria-label="Fermer"
              onClick={() => onClose?.()}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="catalog-modal__panel catalog-modal__panel--pro vs-lab"
              initial={reduceMotion ? false : { opacity: 0, y: 36, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
              transition={spring}
            >
              <div className="catalog-modal__topbar">
                <div className="catalog-modal__topbar-left">
                  <span id={titleId} className="catalog-modal__kicker">
                    Studio visuel
                  </span>
                  <div className="vs-modes" role="tablist" aria-label="Source de la photo">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sourceMode === "camera"}
                      className={sourceMode === "camera" ? "is-on" : ""}
                      onClick={() => chooseMode("camera")}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Caméra
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={sourceMode === "file"}
                      className={sourceMode === "file" ? "is-on" : ""}
                      onClick={() => chooseMode("file")}
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      Importer
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="catalog-modal__close"
                  onClick={() => onClose?.()}
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {showShot ? (
                <div className="vs-results" ref={resultRef}>
                  {phase === "analyzing" && (
                    <div className="vs-analyzing">
                      <div className="vs-analyzing__shot">
                        <img src={shotUrl} alt="" />
                        <span className="vs-scan" />
                      </div>
                      <div className="vs-analyzing__copy">
                        <p className="vs-kicker">Analyse en cours</p>
                        <h2>Recherche des produits similaires</h2>
                        <p className="catalog-modal__desc">
                          {indexReady
                            ? "Comparaison avec les photos du catalogue."
                            : `Préparation du catalogue · ${indexPct}%`}
                        </p>
                        <div className="vs-progress" aria-hidden="true">
                          <span style={{ width: indexReady ? "100%" : `${indexPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                  {phase !== "analyzing" && outcome === "ready" && matches.length > 0 && (
                    <>
                      <div className="vs-results__head">
                        <img src={shotUrl} alt="" className="vs-polaroid" />
                        <div>
                          <p className="vs-kicker">Propositions</p>
                          <h2>Produits similaires</h2>
                          <p className="catalog-modal__desc">
                            {`${matches.length} article${matches.length > 1 ? "s" : ""} très proche${matches.length > 1 ? "s" : ""} de votre photo.`}
                          </p>
                        </div>
                        <div className="vs-results__actions">
                          <button type="button" className="btn-outline-teal inline-flex items-center justify-center gap-2 px-4 py-3 text-sm" onClick={retake}>
                            <Camera className="w-4 h-4" />
                            Caméra
                          </button>
                          <button type="button" className="btn-primary-orange inline-flex items-center justify-center gap-2 px-4 py-3 text-sm" onClick={() => fileRef.current?.click()}>
                            <ImagePlus className="w-4 h-4" />
                            Autre image
                          </button>
                        </div>
                      </div>
                      <motion.div className="catalog-grid" variants={listVariants} initial="hidden" animate="show">
                        {matches.map(({ article, similarity }) => (
                          <CatalogArticleCard
                            key={article.id}
                            article={article}
                            matchScore={similarity}
                            proposalTag={similarity == null ? "Même catégorie" : ""}
                            wished={wishSet.has(Number(article.id))}
                            wishPending={wishMut.isPending}
                            onToggleWish={(event, articleId) => {
                              event.stopPropagation();
                              event.preventDefault();
                              wishMut.mutate(articleId);
                            }}
                            onAdd={handleAdd}
                            cartBump={cartBumpId === article.id}
                            newestAnchorId={newestAnchorId}
                            onOpen={openArticle}
                          />
                        ))}
                      </motion.div>
                    </>
                  )}
                  {phase !== "analyzing" && outcome === "ready" && matches.length === 0 && (
                    <motion.div className="catalog-empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                      <img src={shotUrl} alt="" className="mb-2 h-24 w-24 rounded-2xl object-cover" />
                      <PackageSearch className="w-10 h-10 opacity-40" />
                      <p className="font-bold text-[var(--client-text)]">Aucun produit similaire</p>
                      <p className="text-sm">{NO_SIMILAR_PRODUCT_MESSAGE}</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <button type="button" className="btn-primary-orange px-5 py-2.5 text-sm" onClick={retake}>
                          Nouvelle photo
                        </button>
                        <button type="button" className="btn-outline-teal px-5 py-2.5 text-sm" onClick={() => fileRef.current?.click()}>
                          Importer une image
                        </button>
                      </div>
                    </motion.div>
                  )}
                  {phase !== "analyzing" && outcome === "failed" && (
                    <p className="catalog-modal__desc">Impossible d'analyser cette photo. Essayez une autre prise.</p>
                  )}
                  {phase !== "analyzing" && outcome === "catalogue-error" && (
                    <p className="catalog-modal__desc">Le catalogue n'a pas pu être chargé. Réessayez.</p>
                  )}
                  {phase !== "analyzing" && outcome && outcome !== "ready" && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-outline-teal inline-flex items-center justify-center gap-2 px-4 py-3 text-sm" onClick={retake}>
                        <Camera className="w-4 h-4" />
                        Nouvelle photo
                      </button>
                      <button type="button" className="btn-primary-orange inline-flex items-center justify-center gap-2 px-4 py-3 text-sm" onClick={() => fileRef.current?.click()}>
                        <Upload className="w-4 h-4" />
                        Importer une image
                      </button>
                    </div>
                  )}
                </div>
              ) : sourceMode === "file" ? (
                <div
                  className={`vs-drop${dragOver ? " is-hot" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    ingestFile(event.dataTransfer.files?.[0]);
                  }}
                >
                  <span className="vs-drop__icon">
                    <Upload className="w-7 h-7" />
                  </span>
                  <h2>Déposez une photo du produit</h2>
                  <p className="catalog-modal__desc">
                    JPG, PNG ou WEBP. L'analyse démarre dès que l'image est ajoutée et propose les articles qui lui ressemblent.
                  </p>
                  <button
                    type="button"
                    className="btn-primary-orange inline-flex items-center justify-center gap-2 px-5 py-3 text-sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={phase === "analyzing"}
                  >
                    <ImagePlus className="w-4 h-4" />
                    Choisir une image
                  </button>
                  <button type="button" className="vs-link" onClick={() => chooseMode("camera")}>
                    Utiliser la caméra à la place
                  </button>
                  {outcome === "failed" && (
                    <p className="catalog-modal__desc">Cette image n'a pas pu être lue. Choisissez une photo du produit.</p>
                  )}
                </div>
              ) : (
                <div className="vs-stage">
                  <video
                    ref={videoRef}
                    className={cameraStatus === "live" ? "vs-stage__video" : "hidden"}
                    playsInline
                    muted
                    autoPlay
                  />
                  <div className="vs-frame" aria-hidden="true">
                    <i /><i /><i /><i />
                  </div>
                  {flash && <div className="vs-flash" />}
                  {cameraStatus === "live" && !indexReady && (
                    <p className="vs-chip">Catalogue {indexPct}%</p>
                  )}
                  {cameraMessage && (
                    <div className="vs-stage__message">
                      <p>{cameraMessage}</p>
                      <button
                        type="button"
                        className="btn-primary-orange inline-flex items-center justify-center gap-2 px-4 py-3 text-sm"
                        onClick={() => fileRef.current?.click()}
                      >
                        <ImagePlus className="w-4 h-4" />
                        Importer une image
                      </button>
                    </div>
                  )}
                  {cameraStatus === "starting" && (
                    <div className="vs-stage__message">
                      <span className="vs-spinner" />
                      <p>Ouverture de la caméra…</p>
                    </div>
                  )}
                  <div className="vs-dock">
                    <button
                      type="button"
                      className="vs-import"
                      onClick={() => fileRef.current?.click()}
                      disabled={phase === "analyzing"}
                      aria-label="Importer une image"
                      title="Importer une image"
                    >
                      <ImagePlus className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="vs-shutter"
                      onClick={captureFrame}
                      disabled={cameraStatus !== "live" || phase === "analyzing"}
                      aria-label="Capturer"
                    >
                      <span />
                    </button>
                    <div className="vs-dock__copy">
                      <strong>Capturer</strong>
                      <span>
                        Placez le produit dans le cadre, puis capturez. L'analyse compare cette photo au catalogue.
                      </span>
                      {outcome === "not-ready" && <span>Attendez l'image, puis capturez à nouveau.</span>}
                      {outcome === "failed" && <span>Cette image n'a pas pu être lue.</span>}
                    </div>
                  </div>
                </div>
              )}

              <canvas ref={canvasRef} hidden aria-hidden="true" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
