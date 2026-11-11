import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { IA, formatRelativeTime } from "../moduleIaTheme";

function Row({ label, value, tone }) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-3 border-b py-2 last:border-b-0"
      style={{ borderColor: "color-mix(in srgb, #7dd3fc 16%, transparent)" }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#7dd3fc99" }}>
        {label}
      </span>
      <span
        className="truncate text-right font-mono text-[11px] font-semibold tabular-nums"
        style={{ color: tone || "#e2f3ff" }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function deriveMape(confiance) {
  if (typeof confiance !== "number" || Number.isNaN(confiance)) return null;
  return Math.max(0, Math.round((100 - confiance) * 10) / 10);
}

function methodLabel(prevision, meta) {
  const modele = (prevision?.produits || []).find((p) => p.modele)?.modele;
  if (modele) return String(modele).replace(/_/g, " ");
  return meta?.aiServiceOnline === false ? "Holt-Winters (local)" : "Holt-Winters + N-BEATS";
}

export default function SystemStatusPanel({ open, onClose, meta, kpis, prevision, pulse, anchorRef }) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef(null);
  const online = meta?.aiServiceOnline !== false;
  const confiance = kpis?.confianceMoyenne ?? meta?.confianceMoyenne;
  const mape = deriveMape(typeof confiance === "number" ? confiance : null);
  const latency = meta?.aiLatencyMs;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const onPointer = (e) => {
      const panel = panelRef.current;
      const anchor = anchorRef?.current;
      if (panel?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, anchorRef]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          ref={panelRef}
          data-no-i18n
          role="dialog"
          aria-modal="true"
          aria-label="Statut système"
          className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(100vw-2rem,380px)] overflow-hidden rounded-xl"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          style={{
            background: "linear-gradient(180deg, #07111c 0%, #050b12 100%)",
            border: "1px solid color-mix(in srgb, #7dd3fc 28%, transparent)",
            boxShadow: "0 24px 48px -24px rgba(0,0,0,0.72), inset 0 1px 0 rgba(125,211,252,0.12)",
            color: "#d7ecf8",
            fontFamily: IA.fontMono,
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #7dd3fc88, transparent)" }}
            aria-hidden
          />
          <div className="flex items-center justify-between border-b px-3.5 py-2.5" style={{ borderColor: "rgba(125,211,252,0.14)" }}>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: "#7dd3fc" }}>
                console · admin
              </p>
              <p className="text-[12px] font-semibold" style={{ color: "#f1f7fb" }}>
                Statut système
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ color: "#7dd3fc", border: "1px solid rgba(125,211,252,0.22)" }}
              aria-label="Fermer le statut système"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-1 px-3.5 py-3">
            <Row
              label="FastAPI"
              value={online ? "online" : "offline"}
              tone={online ? "#34d399" : "#fbbf24"}
            />
            <Row label="Endpoint" value={meta?.aiServiceUrl || "—"} />
            <Row
              label="Latence"
              value={latency != null ? `${latency} ms` : "n/a"}
              tone={latency != null && latency > 800 ? "#fbbf24" : "#e2f3ff"}
            />
            <Row
              label="Runtime"
              value={meta?.runtime === "resilience" || online === false ? "fallback local" : "deep · FastAPI"}
            />
            <Row
              label="Groq LLM"
              value={meta?.groqConfigured === false ? "non configuré" : "configuré"}
              tone={meta?.groqConfigured === false ? "#fbbf24" : "#34d399"}
            />
            <Row label="Méthode prévision" value={methodLabel(prevision, meta)} />
            <Row
              label="MAPE (Holt-Winters)"
              value={mape != null ? `${mape}%` : "—"}
            />
            <Row
              label="Confiance backtest"
              value={typeof confiance === "number" ? `${confiance}%` : "—"}
            />
            <Row
              label="Pulse"
              value={typeof pulse?.score === "number" ? `${pulse.score} · ${pulse.band || pulse.label || "—"}` : meta?.pulseScore ?? "—"}
            />
            <Row label="Décisions 14j" value={String(meta?.decisionsAppliquees ?? kpis?.decisionsAppliquees ?? 0)} />
            <Row label="Dernière synchro" value={formatRelativeTime(meta?.updatedAt)} />
            <Row
              label="Horodatage"
              value={meta?.updatedAt ? new Date(meta.updatedAt).toLocaleTimeString("fr-FR") : "—"}
            />
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
