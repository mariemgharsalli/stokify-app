import { useState } from "react";
import logoSrc from "../../assets/logo-stokify.png";

const base = () => String(import.meta.env.BASE_URL || "/");

/**
 * Logo officiel (PNG). Fichier source : `src/assets/logo-stokify.png`
 * (copie miroir dans `public/logos/logo-stokify.png` pour le favicon).
 * L’import Vite garantit l’affichage même si `public/` n’est pas servi correctement.
 */
const FALLBACK_URLS = [`${base()}logos/logo-stokify.png`, `${base()}logos/logo-stokify-full.png`];

const SIZE_CLASSES = {
  /** Landing, header large */
  default:
    "h-20 sm:h-24 md:h-32 lg:h-36 xl:h-40 w-auto max-w-[min(100%,96vw)] sm:max-w-[640px] md:max-w-[800px] lg:max-w-[920px] xl:max-w-[min(96vw,1040px)] object-contain object-left",
  /** Login / register */
  auth: "h-20 sm:h-28 md:h-32 lg:h-36 xl:h-40 2xl:h-[11rem] w-auto max-w-[min(100%,96vw)] sm:max-w-[680px] md:max-w-[820px] lg:max-w-[960px] xl:max-w-[min(96vw,1080px)] object-contain object-left",
  /** Barre latérale */
  sidebar:
    "h-[5.5rem] sm:h-28 md:h-32 lg:h-36 xl:h-40 w-full max-w-full object-contain object-left",
  /** PageShell, dashboard, admin… */
  page: "h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 2xl:h-36 w-auto max-w-[min(100%,96vw)] sm:max-w-[480px] md:max-w-[600px] lg:max-w-[720px] xl:max-w-[840px] object-contain object-left opacity-95",
  /** Navbar fixe (h-14) — même PNG, taille compacte */
  nav: "h-8 sm:h-9 w-auto max-w-[140px] sm:max-w-[180px] object-contain object-left",
};

export default function BrandLogo({
  variant = "default",
  className = "",
  showTagline = false,
}) {
  const [srcIndex, setSrcIndex] = useState(-1);
  const [broken, setBroken] = useState(false);

  const imgClasses = SIZE_CLASSES[variant] || SIZE_CLASSES.default;

  const activeSrc = srcIndex < 0 ? logoSrc : FALLBACK_URLS[srcIndex] || logoSrc;

  function onImgError() {
    if (srcIndex < 0) {
      setSrcIndex(0);
      return;
    }
    if (srcIndex < FALLBACK_URLS.length - 1) {
      setSrcIndex((n) => n + 1);
      return;
    }
    setBroken(true);
  }

  if (broken) {
    return (
      <span className={`inline-flex flex-col gap-1 ${className}`}>
        <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
          Stokify
        </span>
        {showTagline && (
          <span className="text-[10px] text-slate-500 font-medium tracking-wide">
            Where Stock Meets Intelligence
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`}>
      <img
        key={activeSrc}
        src={activeSrc}
        alt="Stokify — Where Stock Meets Intelligence"
        className={imgClasses}
        loading="eager"
        decoding="async"
        onError={onImgError}
      />
      {showTagline && (
        <span className="text-[10px] text-slate-500 font-medium tracking-wide hidden sm:block pl-0.5">
          Where Stock Meets Intelligence
        </span>
      )}
    </span>
  );
}
