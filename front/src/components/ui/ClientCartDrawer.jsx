import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Landmark,
  MapPin,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useCartStore } from "../../store/cartStore";
import { useToastStore } from "../../store/toastStore";
import { getArticleImageUrl } from "../../pages/articles/ClientCatalog";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import ClientQtyStepper from "./ClientQtyStepper";
import ClientCheckoutMap from "./ClientCheckoutMap";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

const TVA = 0.19;

const PAY_ICONS = {
  A_LA_LIVRAISON: Truck,
  VIREMENT: Landmark,
  ESPECES: Banknote,
  CHEQUE: Receipt,
  CARTE: CreditCard,
};

function formatAddress(loc) {
  if (!loc) return "";
  const parts = [loc.adresse, loc.ville, loc.pays].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

export default function ClientCartDrawer() {
  const navigate = useNavigate();
  const { t } = useLandingLang();
  const open = useCartStore((s) => s.drawerOpen);
  const step = useCartStore((s) => s.checkoutStep);
  const closeDrawer = useCartStore((s) => s.closeDrawer);
  const setCheckoutStep = useCartStore((s) => s.setCheckoutStep);
  const items = useCartStore((s) => s.items);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const syncFromServer = useCartStore((s) => s.syncFromServer);
  const submitOrder = useCartStore((s) => s.submitOrder);
  const isSyncing = useCartStore((s) => s.isSyncing);
  const pushToast = useToastStore((s) => s.pushToast);

  const [order, setOrder] = useState(null);
  const [form, setForm] = useState({
    adresseLivraison: "",
    notesLivraison: "",
    modePaiement: "A_LA_LIVRAISON",
    latitude: null,
    longitude: null,
    ville: "",
    pays: "",
  });

  const STEPS = [t.checkoutStepCart, t.checkoutStepDelivery, t.checkoutStepPayment, t.checkoutStepDone];
  const MODES = [
    { value: "A_LA_LIVRAISON", label: t.checkoutPayDelivery },
    { value: "VIREMENT", label: t.checkoutPayTransfer },
    { value: "ESPECES", label: t.checkoutPayCash },
    { value: "CHEQUE", label: t.checkoutPayCheck },
    { value: "CARTE", label: t.checkoutPayCard },
  ];

  useEffect(() => {
    if (open) syncFromServer();
  }, [open, syncFromServer]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeDrawer]);

  useEffect(() => {
    if (!open) {
      setOrder(null);
    }
  }, [open]);

  const { data: myClient } = useQuery({
    queryKey: ["clients-me"],
    queryFn: () => api.get("clients/me").then((r) => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !myClient || form.adresseLivraison) return;
    const parts = [myClient.adresse, myClient.ville, myClient.pays].filter(Boolean);
    const lat = Number(myClient.latitude);
    const lng = Number(myClient.longitude);
    setForm((f) => ({
      ...f,
      adresseLivraison: parts.join(", "),
      ville: myClient.ville || "",
      pays: myClient.pays || "",
      latitude: Number.isFinite(lat) ? lat : f.latitude,
      longitude: Number.isFinite(lng) ? lng : f.longitude,
    }));
  }, [open, myClient, form.adresseLivraison]);

  const totalTTC = items.reduce((sum, i) => sum + Number(i.quantite) * Number(i.prixVente || 0), 0);
  const totalHT = totalTTC / (1 + TVA);
  const totalTva = totalTTC - totalHT;
  const totalUnits = items.reduce((s, i) => s + Number(i.quantite || 0), 0);

  const mapValue = useMemo(() => {
    if (form.latitude == null || form.longitude == null) return null;
    return {
      adresse: form.adresseLivraison,
      ville: form.ville,
      pays: form.pays,
      latitude: form.latitude,
      longitude: form.longitude,
    };
  }, [form.adresseLivraison, form.ville, form.pays, form.latitude, form.longitude]);

  const title =
    step === 1
      ? t.checkoutStepDelivery
      : step === 2
        ? t.checkoutPayment
        : step === 3
          ? t.checkoutSuccess
          : t.cartDrawerTitle;

  function goNextFromCart() {
    if (!items.length) return;
    setCheckoutStep(1);
  }

  function goNextFromDelivery() {
    if (!String(form.adresseLivraison || "").trim()) {
      pushToast(t.checkoutNeedAddress, "error");
      return;
    }
    if (form.latitude == null || form.longitude == null) {
      pushToast(t.checkoutNeedPin, "error");
      return;
    }
    setCheckoutStep(2);
  }

  async function confirm() {
    if (!String(form.adresseLivraison || "").trim()) {
      pushToast(t.checkoutNeedAddress, "error");
      setCheckoutStep(1);
      return;
    }
    const gps =
      form.latitude != null && form.longitude != null
        ? `GPS ${Number(form.latitude).toFixed(5)}, ${Number(form.longitude).toFixed(5)}`
        : "";
    const notes = [form.notesLivraison, gps].map((s) => String(s || "").trim()).filter(Boolean).join("\n");
    try {
      const res = await submitOrder({
        adresseLivraison: form.adresseLivraison.trim(),
        notesLivraison: notes || undefined,
        modePaiement: form.modePaiement,
      });
      if (!res) return;
      setOrder(res);
      setCheckoutStep(3);
      pushToast(`${t.orderDetailHeroTitle} ${res.reference} ${t.checkoutOrderConfirmed}`, "success");
    } catch (e) {
      pushToast(getAxiosErrorMessage?.(e) || e.response?.data?.message || t.checkoutOrderFail, "error");
    }
  }

  function openOrder() {
    const id = order?.id;
    closeDrawer();
    if (id) navigate(`/mes-commandes/${id}`);
    else navigate("/mes-commandes");
  }

  const inCheckout = items.length > 0 || step === 3;

  return (
    <AnimatePresence>
      {open && (
        <div className="client-cart-drawer" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            type="button"
            className="client-cart-drawer__backdrop"
            aria-label={t.cartDrawerClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={closeDrawer}
          />

          <motion.aside
            className={`client-cart-drawer__panel${inCheckout ? " is-checkout" : ""}`}
            initial={{ x: "108%", opacity: 0.65 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "108%", opacity: 0.7 }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.85 }}
          >
            <div className="client-cart-drawer__mesh" aria-hidden="true" />
            <div className="client-cart-drawer__aura" aria-hidden="true" />
            <div className="client-cart-drawer__aura client-cart-drawer__aura--blue" aria-hidden="true" />
            <div className="client-cart-drawer__aura client-cart-drawer__aura--cyan" aria-hidden="true" />
            <div className="client-cart-drawer__edge" aria-hidden="true" />
            <div className="client-cart-drawer__sheen" aria-hidden="true" />
            <div className="client-cart-drawer__orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <header className="client-cart-drawer__head">
              <div className="client-cart-drawer__title-block">
                <div className="client-cart-drawer__title-row">
                  <motion.span
                    className="client-cart-drawer__bag-wrap"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <span className="client-cart-drawer__bag-ring" />
                    {step === 1 ? (
                      <MapPin className="client-cart-drawer__bag" strokeWidth={1.7} />
                    ) : step === 2 ? (
                      <CreditCard className="client-cart-drawer__bag" strokeWidth={1.7} />
                    ) : step === 3 ? (
                      <Sparkles className="client-cart-drawer__bag" strokeWidth={1.7} />
                    ) : (
                      <ShoppingBag className="client-cart-drawer__bag" strokeWidth={1.7} />
                    )}
                  </motion.span>
                  <div className="min-w-0">
                    <p className="client-cart-drawer__eyebrow">
                      {step === 0 ? t.cartKicker : t.checkoutKicker}
                    </p>
                    <h2 className="client-cart-drawer__title">{title}</h2>
                  </div>
                </div>
                {items.length > 0 && step < 3 && (
                  <div className="client-cart-drawer__chips">
                    <p className="client-cart-drawer__meta">
                      <Package className="w-3.5 h-3.5" strokeWidth={2} />
                      <span>
                        {items.length} {items.length > 1 ? t.cartArticlesPlural : t.cartArticle}
                        {" · "}
                        {totalUnits.toLocaleString(t.localeTag)} {t.cartUnits.toLowerCase()}
                      </span>
                    </p>
                    <motion.p
                      key={totalTTC}
                      className="client-cart-drawer__live-total"
                      initial={{ scale: 0.86, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      {formatMoneyTnd(totalTTC)}
                    </motion.p>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="client-cart-drawer__close"
                onClick={closeDrawer}
                aria-label={t.cartDrawerClose}
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {inCheckout && (
              <div className="client-cart-drawer__tracker">
                <div className="client-cart-drawer__rail" aria-hidden="true">
                  <motion.span
                    className="client-cart-drawer__rail-fill"
                    initial={false}
                    animate={{ width: `${(Math.min(step, 3) / 3) * 100}%` }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  />
                </div>
                <ol className="client-cart-drawer__steps" aria-label={t.checkoutStep}>
                  {STEPS.map((label, i) => {
                    const active = i === step;
                    const done = i < step || step === 3;
                    return (
                      <li
                        key={label}
                        className={`client-cart-drawer__step${active ? " is-active" : ""}${done ? " is-done" : ""}${i < step && step < 3 ? " is-clickable" : ""}`}
                        onClick={() => {
                          if (i < step && step < 3) setCheckoutStep(i);
                        }}
                      >
                        <span className="client-cart-drawer__step-dot">
                          {done ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
                        </span>
                        <span className="client-cart-drawer__step-label">{label}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="client-cart-drawer__body">
              <AnimatePresence mode="wait">
                {!items.length && step !== 3 ? (
                  <motion.div
                    key="empty"
                    className="client-cart-drawer__empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <motion.div
                      className="client-cart-drawer__empty-orb"
                      animate={{ y: [0, -10, 0], rotate: [0, 2, -2, 0] }}
                      transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ShoppingBag className="w-11 h-11" strokeWidth={1.25} />
                    </motion.div>
                    <p className="client-cart-drawer__empty-title">{t.cartEmptyTitle}</p>
                    <p className="client-cart-drawer__empty-text">{t.cartEmptyText}</p>
                    <Link to="/articles" className="client-cart-drawer__cta" onClick={closeDrawer}>
                      <span className="client-cart-drawer__cta-shine" aria-hidden="true" />
                      <span>{t.cartBackCatalog}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                ) : step === 0 ? (
                  <motion.ul
                    key="cart"
                    className="client-cart-drawer__list"
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <AnimatePresence initial={false}>
                      {items.map((item, index) => {
                        const lineTotal = Number(item.quantite) * Number(item.prixVente || 0);
                        return (
                          <motion.li
                            key={item.articleId}
                            layout
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 48, height: 0, marginBottom: 0 }}
                            transition={{ delay: Math.min(index * 0.04, 0.2) }}
                            className="client-cart-drawer__line"
                          >
                            <div className="client-cart-drawer__thumb">
                              <img
                                src={getArticleImageUrl({ id: item.articleId, imageUrl: item.imageUrl })}
                                alt=""
                              />
                            </div>
                            <div className="client-cart-drawer__info">
                              <div className="client-cart-drawer__info-top">
                                <div className="min-w-0">
                                  {item.code && (
                                    <span className="client-cart-drawer__code">{item.code}</span>
                                  )}
                                  <p className="client-cart-drawer__name">{item.libelle}</p>
                                  <p className="client-cart-drawer__price">
                                    {formatMoneyTnd(item.prixVente)}
                                    <span className="client-cart-drawer__per">{t.cartPerUnit}</span>
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="client-cart-drawer__trash"
                                  onClick={() => removeItem(item.articleId)}
                                  aria-label={t.cartRemove}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="client-cart-drawer__controls">
                                <ClientQtyStepper
                                  size="sm"
                                  className="client-cart-drawer__qty"
                                  value={item.quantite}
                                  onChange={(q) => updateQty(item.articleId, q)}
                                  max={item.stockDisponible ?? undefined}
                                />
                                <motion.p
                                  key={`${item.articleId}-${item.quantite}`}
                                  initial={{ opacity: 0.4, y: 3 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="client-cart-drawer__line-total"
                                >
                                  {formatMoneyTnd(lineTotal)}
                                </motion.p>
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </motion.ul>
                ) : step === 1 ? (
                  <motion.div
                    key="delivery"
                    className="client-cart-drawer__stage"
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="client-cart-drawer__stage-kicker">{t.checkoutMapKicker}</p>
                    <ClientCheckoutMap
                      active={open && step === 1}
                      value={mapValue}
                      onChange={(loc) => {
                        if (!loc) {
                          setForm((f) => ({ ...f, latitude: null, longitude: null }));
                          return;
                        }
                        setForm((f) => ({
                          ...f,
                          latitude: loc.latitude,
                          longitude: loc.longitude,
                          ville: loc.ville || f.ville,
                          pays: loc.pays || f.pays,
                          adresseLivraison: formatAddress(loc) || f.adresseLivraison,
                        }));
                      }}
                      labels={{
                        searchPh: t.checkoutMapSearchPh,
                        searchBtn: t.checkoutMapSearchBtn,
                        locate: t.checkoutMapLocate,
                        clear: t.checkoutMapClear,
                        hint: t.checkoutMapHint,
                        searchMin: t.checkoutMapSearchMin,
                        noResult: t.checkoutMapNoResult,
                        networkError: t.checkoutMapNetwork,
                        geoUnsupported: t.checkoutMapGeoOff,
                        geoDenied: t.checkoutMapGeoDenied,
                      }}
                    />
                    <label className="client-cart-drawer__label">{t.checkoutAddress}</label>
                    <textarea
                      rows={2}
                      className="client-cart-drawer__field"
                      value={form.adresseLivraison}
                      onChange={(e) => setForm((f) => ({ ...f, adresseLivraison: e.target.value }))}
                      placeholder={t.checkoutAddressPh}
                    />
                    <label className="client-cart-drawer__label">{t.checkoutNotes}</label>
                    <textarea
                      rows={2}
                      className="client-cart-drawer__field"
                      value={form.notesLivraison}
                      onChange={(e) => setForm((f) => ({ ...f, notesLivraison: e.target.value }))}
                      placeholder={t.checkoutNotesPh}
                    />
                  </motion.div>
                ) : step === 2 ? (
                  <motion.div
                    key="pay"
                    className="client-cart-drawer__stage"
                    initial={{ opacity: 0, x: 28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 }}
                    transition={{ duration: 0.22 }}
                  >
                    <p className="client-cart-drawer__stage-kicker">{t.checkoutPayment}</p>
                    <div className="client-cart-drawer__pays">
                      {MODES.map((m) => {
                        const Icon = PAY_ICONS[m.value] || CreditCard;
                        const selected = form.modePaiement === m.value;
                        return (
                          <motion.button
                            key={m.value}
                            type="button"
                            className={`client-cart-drawer__pay${selected ? " is-selected" : ""}`}
                            onClick={() => setForm((f) => ({ ...f, modePaiement: m.value }))}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Icon className="w-4 h-4" strokeWidth={1.8} />
                            <span>{m.label}</span>
                            {selected && <Check className="client-cart-drawer__pay-check" strokeWidth={3} />}
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="client-cart-drawer__drop">
                      <MapPin className="w-4 h-4" />
                      <div>
                        <p>{form.adresseLivraison || t.checkoutNeedAddress}</p>
                        {form.latitude != null && form.longitude != null && (
                          <span>
                            {Number(form.latitude).toFixed(4)}, {Number(form.longitude).toFixed(4)}
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="client-cart-drawer__mini">
                      {items.map((item) => (
                        <li key={item.articleId}>
                          <span>
                            {item.libelle}
                            <em>
                              × {Number(item.quantite).toLocaleString(t.localeTag)}
                            </em>
                          </span>
                          <strong>
                            {formatMoneyTnd(Number(item.quantite) * Number(item.prixVente || 0))}
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ) : (
                  <motion.div
                    key="done"
                    className="client-cart-drawer__success"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="client-cart-drawer__confetti" aria-hidden="true">
                      {Array.from({ length: 10 }, (_, i) => (
                        <span key={i} style={{ "--i": i }} />
                      ))}
                    </div>
                    <motion.div
                      className="client-cart-drawer__success-ring"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.05 }}
                    >
                      <Check className="w-9 h-9" strokeWidth={2.6} />
                    </motion.div>
                    <h3>{t.checkoutSuccess}</h3>
                    <p>
                      {t.checkoutRef}{" "}
                      <strong>{order?.reference}</strong>
                      <br />
                      {t.checkoutEmailNote}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {items.length > 0 && step < 3 && (
              <footer className="client-cart-drawer__foot">
                {step === 0 && (
                  <div className="client-cart-drawer__summary">
                    <div className="client-cart-drawer__row">
                      <span>{t.cartSubtotal}</span>
                      <span>{formatMoneyTnd(totalHT)}</span>
                    </div>
                    <div className="client-cart-drawer__row">
                      <span>{t.cartTva}</span>
                      <span>{formatMoneyTnd(totalTva)}</span>
                    </div>
                    <div className="client-cart-drawer__row client-cart-drawer__row--total">
                      <span>{t.cartTotalTtc}</span>
                      <motion.span key={totalTTC} initial={{ opacity: 0.35, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                        {formatMoneyTnd(totalTTC)}
                      </motion.span>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="client-cart-drawer__summary">
                    <div className="client-cart-drawer__row client-cart-drawer__row--total">
                      <span>{t.cartTotalTtc}</span>
                      <span>{formatMoneyTnd(totalTTC)}</span>
                    </div>
                  </div>
                )}

                <div className={`client-cart-drawer__actions${step > 0 ? " has-back" : ""}`}>
                  {step > 0 && (
                    <button
                      type="button"
                      className="client-cart-drawer__back"
                      onClick={() => setCheckoutStep(step - 1)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t.checkoutBack}
                    </button>
                  )}
                  <motion.button
                    type="button"
                    className="client-cart-drawer__cta"
                    disabled={isSyncing}
                    onClick={step === 0 ? goNextFromCart : step === 1 ? goNextFromDelivery : confirm}
                    whileHover={{ scale: isSyncing ? 1 : 1.015 }}
                    whileTap={{ scale: isSyncing ? 1 : 0.98 }}
                  >
                    <span className="client-cart-drawer__cta-shine" aria-hidden="true" />
                    <span>
                      {step === 0
                        ? t.cartCheckout
                        : step === 1
                          ? t.checkoutNext
                          : isSyncing
                            ? t.checkoutValidating
                            : t.checkoutConfirm}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="client-cart-drawer__trust">
                  <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2} />
                  <span>{t.checkoutKicker}</span>
                </div>

                {step === 0 && (
                  <Link to="/articles" className="client-cart-drawer__continue" onClick={closeDrawer}>
                    {t.cartContinue}
                  </Link>
                )}
              </footer>
            )}

            {step === 3 && (
              <footer className="client-cart-drawer__foot">
                <motion.button
                  type="button"
                  className="client-cart-drawer__cta"
                  onClick={openOrder}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="client-cart-drawer__cta-shine" aria-hidden="true" />
                  <span>{t.checkoutSeeOrder}</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
                <button type="button" className="client-cart-drawer__continue" onClick={closeDrawer}>
                  {t.cartContinue}
                </button>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
