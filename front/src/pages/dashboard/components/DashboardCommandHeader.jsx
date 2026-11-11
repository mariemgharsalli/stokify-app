import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Film, Gauge, Package } from "lucide-react";
import GlassPageHeader, { GlassAside } from "../../../components/ui/GlassPageHeader";
import { useLandingLang } from "../../landing/LandingLangContext";

function useLiveClock(localeTag, reduceMotion) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [reduceMotion]);
  return {
    time: now.toLocaleTimeString(localeTag || "fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: reduceMotion ? undefined : "2-digit",
    }),
    date: now,
  };
}

export default function DashboardCommandHeader({
  title,
  subtitle,
  societeLabel,
  onCinematic,
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useLandingLang();
  const { time } = useLiveClock(t.localeTag, reduceMotion);

  return (
    <GlassPageHeader
      title={title}
      subtitle={subtitle}
      icon={Gauge}
      badge={t.dashLive}
      chips={
        t.dashCommandSub ? (
          <span className="page-hero__chip page-hero__chip--sky">{t.dashCommandSub}</span>
        ) : null
      }
      aside={
        societeLabel ? (
          <GlassAside icon={Package} label={t.dashCompany} value={societeLabel} />
        ) : null
      }
      actions={
        <>
          <div className="rounded-xl border border-sky-300/20 bg-white/5 px-3.5 py-2.5 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/55">
              {t.dashNow}
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-white">{time}</p>
          </div>
          <button
            type="button"
            onClick={onCinematic}
            className="page-hero__import inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold text-sky-50 transition"
          >
            <Film className="h-3.5 w-3.5 text-sky-300" />
            {t.dashCinematic}
          </button>
        </>
      }
    />
  );
}
