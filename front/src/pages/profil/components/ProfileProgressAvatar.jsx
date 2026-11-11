import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Camera, Loader2 } from "lucide-react";
import { PROFILE_ACCENT, PROFILE_CYAN } from "../profileTheme";

const SIZE = 120;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export default function ProfileProgressAvatar({
  src,
  initials,
  colors,
  percent = 0,
  uploading,
  onClick,
}) {
  const reduceMotion = useReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const target = Math.min(100, Math.max(0, percent));
    if (reduceMotion) {
      setAnimated(target);
      return undefined;
    }
    const t0 = performance.now();
    const duration = 950;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) ** 3;
      setAnimated(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [percent, reduceMotion]);

  const offset = C - (animated / 100) * C;
  const needsPulse = !reduceMotion && animated < 100;

  return (
    <div className="relative shrink-0" style={{ width: SIZE + 20, height: SIZE + 28 }}>
      {needsPulse ? (
        <span
          className="profile-btn-glow pointer-events-none absolute inset-2 rounded-full"
          style={{ "--kpi-accent": PROFILE_ACCENT }}
          aria-hidden
        />
      ) : null}

      <svg
        width={SIZE + 20}
        height={SIZE + 20}
        viewBox={`0 0 ${SIZE + 20} ${SIZE + 20}`}
        className="absolute left-0 top-0 block"
        aria-hidden
      >
        <defs>
          <linearGradient id="profileRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PROFILE_ACCENT} />
            <stop offset="100%" stopColor={PROFILE_CYAN} />
          </linearGradient>
          <filter id="profileRingGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={(SIZE + 20) / 2}
          cy={(SIZE + 20) / 2}
          r={R + 2}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={STROKE}
          opacity="0.4"
        />
        <motion.circle
          cx={(SIZE + 20) / 2}
          cy={(SIZE + 20) / 2}
          r={R + 2}
          fill="none"
          stroke="url(#profileRingGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          filter="url(#profileRingGlow)"
          transform={`rotate(-90 ${(SIZE + 20) / 2} ${(SIZE + 20) / 2})`}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />
      </svg>

      <motion.button
        type="button"
        onClick={onClick}
        className="group absolute left-1/2 top-[10px] -translate-x-1/2"
        style={{ width: SIZE - 10, height: SIZE - 10 }}
        whileHover={reduceMotion ? undefined : { scale: 1.03 }}
        whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        aria-label="Changer la photo de profil"
      >
        <span className="relative block h-full w-full overflow-hidden rounded-full ring-2 ring-[var(--bg-card)] shadow-lg">
          {src ? (
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center text-2xl font-bold"
              style={{
                background: colors?.bg || `linear-gradient(145deg, ${PROFILE_ACCENT}33, ${PROFILE_CYAN}22)`,
                color: colors?.ring || PROFILE_ACCENT,
              }}
            >
              {initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </span>
        </span>
      </motion.button>

      <span
        className="absolute -bottom-0.5 left-1/2 z-[1] -translate-x-1/2 rounded-md px-2 py-0.5 text-[10px] font-bold tabular-nums text-white"
        style={{
          background: `linear-gradient(135deg, ${PROFILE_ACCENT}, ${PROFILE_CYAN})`,
          boxShadow: `0 4px 12px -3px ${PROFILE_ACCENT}99`,
        }}
      >
        {animated}%
      </span>
    </div>
  );
}
