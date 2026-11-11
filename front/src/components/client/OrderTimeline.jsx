import { motion } from "framer-motion";
import { Check, Package, Truck, ClipboardCheck, Clock, XCircle } from "lucide-react";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

const ORDER = ["EN_ATTENTE", "CONFIRMEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"];

export default function OrderTimeline({ statut }) {
  const { t } = useLandingLang();

  const STEPS = [
    { key: "EN_ATTENTE", label: t.statusPending, icon: Clock },
    { key: "CONFIRMEE", label: t.statusConfirmed, icon: ClipboardCheck },
    { key: "EN_PREPARATION", label: t.statusPreparingShort, icon: Package },
    { key: "EXPEDIEE", label: t.statusShipped, icon: Truck },
    { key: "LIVREE", label: t.statusDelivered, icon: Check },
  ];

  if (statut === "ANNULEE") {
    return (
      <div className="orders-tl orders-tl--cancelled">
        <XCircle className="h-5 w-5 shrink-0" />
        {t.orderCancelled}
      </div>
    );
  }

  const idx = Math.max(0, ORDER.indexOf(statut));

  return (
    <ol className="orders-tl">
      <span className="orders-tl__rail" aria-hidden="true">
        <motion.span
          className="orders-tl__rail-fill"
          initial={false}
          animate={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }}
          transition={{ type: "spring", stiffness: 240, damping: 28 }}
        />
      </span>
      {STEPS.map((step, i) => {
        const done = i <= idx;
        const current = i === idx;
        const Icon = step.icon;
        return (
          <li key={step.key} className={`orders-tl__step${done ? " is-done" : ""}${current ? " is-current" : ""}`}>
            <motion.span
              className="orders-tl__dot"
              animate={current ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 1.6, repeat: current ? Infinity : 0 }}
            >
              <Icon className="h-4 w-4" />
            </motion.span>
            <span className="orders-tl__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
