import { useEffect, useRef, useState } from "react";
import { CalendarRange, RefreshCw } from "lucide-react";
import { IconInfoCircle } from "@tabler/icons-react";
import { IA, formatClock, toneColor } from "../moduleIaTheme";
import { useLandingLang } from "../../landing/LandingLangContext";
import { interpolate } from "../../../i18n/languages";
import ModuleIACore3D, { ModuleIACoreScene } from "./ModuleIACore3D";
import SystemStatusPanel from "./SystemStatusPanel";

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function DateRangePicker({ start, end, onChange, t }) {
  return (
    <label className="ia-command__control">
      <CalendarRange size={14} className="text-sky-300" />
      <input
        type="date"
        value={start}
        onChange={(e) => onChange({ start: e.target.value, end })}
        aria-label={t.aiDateStart}
      />
      <span className="text-[11px] text-sky-200/50">—</span>
      <input
        type="date"
        value={end}
        onChange={(e) => onChange({ start, end: e.target.value })}
        aria-label={t.aiDateEnd}
      />
    </label>
  );
}

export default function ModuleIAHeader({
  dateRange,
  onDateRangeChange,
  meta,
  pulse,
  kpis,
  prevision,
  onRefresh,
  refreshing,
}) {
  const { t, lang } = useLandingLang();
  const now = useLiveClock();
  const [statusOpen, setStatusOpen] = useState(false);
  const statusBtnRef = useRef(null);
  const online = meta?.aiServiceOnline !== false;
  const fallback = meta?.aiServiceOnline === false;
  const statusColor = fallback ? IA.yellow : IA.accent;
  const statusLabel = fallback ? t.aiIaFallback : t.aiIaActive;
  const pulseColor = toneColor(pulse?.tone);

  const formatRel = (iso) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.aiJustNow;
    if (mins < 60) return interpolate(t.aiMinAgo, { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return interpolate(t.aiHourAgo, { n: hrs });
    return new Date(iso).toLocaleDateString(t.localeTag || lang);
  };

  const statusItems = [
    {
      label: t.aiPulse,
      value: typeof pulse?.score === "number" ? `${pulse.score}` : "—",
      tone: pulseColor,
    },
    {
      label: t.aiConfidence,
      value: typeof meta?.confianceMoyenne === "number" ? `${meta.confianceMoyenne}%` : "—",
      tone: IA.accent,
    },
    {
      label: t.aiDecisions,
      value: String(meta?.decisionsAppliquees ?? 0),
      tone: IA.text,
    },
    {
      label: t.aiSyncLabel,
      value: formatRel(meta?.updatedAt),
      tone: IA.textSecondary,
    },
  ];

  return (
    <header className="ia-command">
      <div className="ia-command__grid" aria-hidden />
      <span className="ia-command__orb ia-command__orb--a" aria-hidden />
      <span className="ia-command__orb ia-command__orb--b" aria-hidden />
      <span className="ia-command__sheen" aria-hidden />
      <span className="ia-command__edge" aria-hidden />
      <div className="ia-command__scene" aria-hidden>
        <ModuleIACoreScene pulse={typeof pulse?.score === "number" ? pulse.score : 50} />
      </div>

      <div className="ia-command__body">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="ia-command__identity">
            <div className="ia-command__core ia-brain-slot ia-holo-scan" aria-hidden>
              <span className="ia-command__ring" />
              <ModuleIACore3D compact pulse={typeof pulse?.score === "number" ? pulse.score : 50} />
            </div>
            <div className="min-w-0">
              <p className="ia-command__kicker">
                <span className="ia-command__dot" aria-hidden />
                Stokify · {t.aiHubTitle}
              </p>
              <h1 className="ia-command__title" style={{ fontFamily: IA.fontTitle }}>
                {t.aiHeroTitle}{" "}
                <span className="ai-hero-word">{t.aiHeroAccent}</span>
              </h1>
              <p className="ia-command__sub">{t.aiHeroSub}</p>
              {fallback ? <p className="ia-command__warn">{t.aiIaFallbackHint}</p> : null}
              <div className="ia-command__metrics">
                {statusItems.map((item) => (
                  <div key={item.label} className="ia-command__metric">
                    <span>{item.label}</span>
                    <strong style={{ color: item.tone === IA.text || item.tone === IA.textSecondary ? "#e0f2fe" : item.tone }}>
                      {item.value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="ia-command__tools">
            <DateRangePicker start={dateRange.start} end={dateRange.end} onChange={onDateRangeChange} t={t} />
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="ia-command__control"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Actualiser
              </button>
            ) : null}
            <div className="ia-command__control" title={statusLabel} style={{ color: statusColor }}>
              <span className="relative flex h-2 w-2">
                {online && !fallback ? (
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 motion-reduce:animate-none"
                    style={{ background: statusColor }}
                  />
                ) : null}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: statusColor }} />
              </span>
              {statusLabel}
            </div>
            <div className="relative">
              <button
                ref={statusBtnRef}
                type="button"
                onClick={() => setStatusOpen((v) => !v)}
                className="ia-command__control h-9 w-9 justify-center px-0"
                aria-label={t.aiSystemStatusAria}
                aria-expanded={statusOpen}
                title={t.aiSystemStatus}
              >
                <IconInfoCircle size={16} stroke={1.6} />
              </button>
              <SystemStatusPanel
                open={statusOpen}
                onClose={() => setStatusOpen(false)}
                meta={meta}
                kpis={kpis}
                prevision={prevision}
                pulse={pulse}
                anchorRef={statusBtnRef}
              />
            </div>
            <div className="ia-command__control hidden font-mono text-[11px] sm:inline-flex">
              {formatClock(now)}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
