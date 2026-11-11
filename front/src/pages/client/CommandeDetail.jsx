import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, MapPin, CreditCard, StickyNote, Package, Sparkles, MessageSquare } from "lucide-react";
import api from "../../services/api";
import { getAxiosErrorMessage } from "../../services/api";
import { formatMoneyTnd } from "../../utils/formatMoneyTnd";
import { getArticleImageUrl } from "../articles/ClientCatalog";
import OrderTimeline from "../../components/client/OrderTimeline";
import ClientDeliveryMapModal, {
  parseGpsFromNotes,
  stripGpsFromNotes,
} from "../../components/ui/ClientDeliveryMapModal";
import { useToastStore } from "../../store/toastStore";
import { useLandingLang } from "../landing/LandingLangContext";
import DemandeComposer from "../../components/demandes/DemandeComposer";

const STATUT_STYLE_BASE = {
  EN_ATTENTE: { bg: "#fff7ed", color: "#c2410c" },
  CONFIRMEE: { bg: "#ecfdf5", color: "#047857" },
  EN_PREPARATION: { bg: "#eff6ff", color: "#378ADD" },
  EXPEDIEE: { bg: "#e0f2fe", color: "#0284c7" },
  LIVREE: { bg: "#ecfeff", color: "#0e7490" },
  ANNULEE: { bg: "#fef2f2", color: "#b91c1c" },
};

export default function CommandeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);
  const { t } = useLandingLang();
  const reduce = useReducedMotion();
  const [mapOpen, setMapOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const MODE_LABELS = {
    A_LA_LIVRAISON: t.orderPayOnDelivery,
    VIREMENT: t.orderPayTransfer,
    ESPECES: t.orderPayCash,
    CHEQUE: t.orderPayCheck,
    CARTE: t.orderPayCard,
    AUTRE: t.orderPayOther,
  };

  const statusLabels = {
    EN_ATTENTE: t.statusPending,
    CONFIRMEE: t.statusConfirmed,
    EN_PREPARATION: t.statusPreparing,
    EXPEDIEE: t.statusShipped,
    LIVREE: t.statusDelivered,
    ANNULEE: t.statusCancelled,
  };

  const { data: commande, isLoading, isError } = useQuery({
    queryKey: ["commande-client", id],
    queryFn: () => api.get(`commandes-client/${id}`).then((r) => r.data),
    enabled: Number.isFinite(Number(id)),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`commandes-client/${id}/annuler`),
    onSuccess: () => {
      pushToast(t.orderDetailCancelledToast, "success");
      qc.invalidateQueries({ queryKey: ["commande-client", id] });
      qc.invalidateQueries({ queryKey: ["mes-commandes"] });
    },
    onError: (e) => pushToast(getAxiosErrorMessage?.(e) || e.response?.data?.message || t.orderDetailFail, "error"),
  });

  if (isLoading) {
    return (
      <div className="orders-atelier orders-hero">
        <div className="orders-atelier__stage orders-atelier__stage--solo">
          <div className="orders-atelier__skel" />
          <div className="orders-atelier__skel" style={{ height: "16rem" }} />
        </div>
      </div>
    );
  }

  if (isError || !commande) {
    return (
      <div className="orders-atelier orders-hero">
        <div className="orders-atelier__stage">
          <div className="orders-atelier__empty">
            <Package className="w-10 h-10" />
            <h2>{t.orderDetailNotFound}</h2>
            <Link to="/mes-commandes" className="orders-atelier__cta">
              <span className="orders-atelier__cta-shine" aria-hidden="true" />
              <span>{t.orderDetailBack}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statutStyle = STATUT_STYLE_BASE[commande.statut] || STATUT_STYLE_BASE.EN_ATTENTE;
  const deliveryGps = parseGpsFromNotes(commande.notesLivraison);
  const notesClean = stripGpsFromNotes(commande.notesLivraison);

  return (
    <div className="orders-atelier orders-hero">
      <section className="orders-atelier__hero orders-atelier__hero--detail">
        <div className="orders-atelier__atmos" aria-hidden="true">
          <img className="orders-atelier__photo" src="/cutouts/hero-orders-atelier.png" alt="" />
          <div className="orders-atelier__veil" />
          <div className="orders-atelier__lattice" />
          <div className="orders-atelier__sheen" />
        </div>
        <div className="orders-atelier__hero-inner">
          <div className="orders-atelier__copy">
          <motion.p
            className="orders-atelier__eyebrow"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t.orderDetailHeroEyebrow}
          </motion.p>
          <motion.h1
            className="orders-atelier__title"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {t.orderDetailHeroTitle} <span>{commande.reference}</span>
          </motion.h1>
          <motion.p
            className="orders-atelier__sub"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {t.orderDetailHeroSubtitle}
          </motion.p>
          <span className="client-statut-badge orders-atelier__hero-badge" style={{ background: statutStyle.bg, color: statutStyle.color }}>
            <span className="client-statut-badge__dot" style={{ background: statutStyle.color }} />
            {statusLabels[commande.statut] || commande.statut}
          </span>
          </div>
        </div>
      </section>

      <section id="commande-detail" className="orders-atelier__stage scroll-mt-24">
        <button type="button" onClick={() => navigate("/mes-commandes")} className="orders-atelier__back">
          <ArrowLeft className="w-4 h-4" />
          {t.orderDetailBack}
        </button>

        <motion.div
          className="orders-detail"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
        >
          <OrderTimeline statut={commande.statut} />

          <div className="orders-detail__tiles">
            <motion.button
              type="button"
              className="orders-detail__tile orders-detail__tile--map"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              onClick={() => setMapOpen(true)}
              disabled={!deliveryGps}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <div>
                <p>{t.checkoutStepDelivery}</p>
                <strong className="whitespace-pre-line">
                  {commande.adresseLivraison || "—"}
                </strong>
                {deliveryGps ? (
                  <span className="orders-detail__map-cta">{t.orderDetailViewMap}</span>
                ) : null}
              </div>
            </motion.button>
            {[
              {
                icon: CreditCard,
                label: t.checkoutPayment,
                value: MODE_LABELS[commande.modePaiement] || commande.modePaiement || "—",
              },
              {
                icon: StickyNote,
                label: t.checkoutNotes,
                value: notesClean || "—",
              },
            ].map((block, i) => {
              const Icon = block.icon;
              return (
                <motion.div
                  key={block.label}
                  className="orders-detail__tile"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 + i * 0.06 }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div>
                    <p>{block.label}</p>
                    <strong>{block.value}</strong>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <ul className="orders-card__lines">
            {(commande.lignes || []).map((l, li) => (
              <motion.li
                key={l.id}
                className="orders-line"
                initial={reduce ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + li * 0.04 }}
              >
                <div className="orders-line__media">
                  <img src={getArticleImageUrl(l.article)} alt="" />
                </div>
                <div className="orders-line__info">
                  <p className="orders-line__title">{l.article?.libelle}</p>
                  <p className="orders-line__sub">
                    {l.article?.code && <span className="orders-line__code">{l.article.code}</span>}
                    <span>× {Number(l.quantite).toLocaleString(t.localeTag)}</span>
                  </p>
                </div>
                <p className="orders-line__total">{formatMoneyTnd(l.totalLigne)}</p>
              </motion.li>
            ))}
          </ul>

          <div className="orders-card__foot">
            <div className="orders-card__total">
              <span>{t.cartTotalTtc}</span>
              <strong>{formatMoneyTnd(commande.montantTTC)}</strong>
            </div>
          </div>

          <button type="button" className="orders-atelier__cta orders-atelier__cta--sm mt-4" onClick={() => setAskOpen(true)}>
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{t.demandesWrite}</span>
          </button>

          {commande.statut === "EN_ATTENTE" && (
            <motion.button
              type="button"
              disabled={cancelMut.isPending}
              whileHover={{ scale: cancelMut.isPending ? 1 : 1.01 }}
              whileTap={{ scale: cancelMut.isPending ? 1 : 0.98 }}
              onClick={() => {
                if (window.confirm(t.ordersCancelConfirm)) cancelMut.mutate();
              }}
              className="orders-detail__cancel"
            >
              {cancelMut.isPending ? t.ordersCancelling : t.ordersCancel}
            </motion.button>
          )}
        </motion.div>
      </section>

      <DemandeComposer open={askOpen} commande={commande} onClose={() => setAskOpen(false)} />
      <ClientDeliveryMapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        latitude={deliveryGps?.latitude}
        longitude={deliveryGps?.longitude}
        address={commande.adresseLivraison || ""}
        title={t.orderDetailMapTitle}
        closeLabel={t.orderDetailMapClose}
        emptyLabel={t.orderDetailMapEmpty}
      />
    </div>
  );
}
