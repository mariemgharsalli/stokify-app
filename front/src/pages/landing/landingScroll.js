/** Ordre réel des sections sur /home (Landing.jsx) */
export const LANDING_SECTION_IDS = [
  "accueil",
  "fonctionnalites",
  "apropos",
  "stats",
  "pourquoi",
  "apercu",
  "parcours",
];

/** Hauteur approximative navbar fixe (hotbar + pill) */
export const LANDING_NAV_OFFSET = 112;

export function scrollToLandingSection(hash, behavior = "smooth") {
  const id = String(hash || "").replace(/^#/, "");
  if (!id) return false;

  const el = document.getElementById(id);
  if (!el) return false;

  const top = el.getBoundingClientRect().top + window.scrollY - LANDING_NAV_OFFSET;
  window.scrollTo({ top: Math.max(0, top), behavior });
  return true;
}

export function syncLandingHash(hash) {
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  if (!normalized || normalized === "#") return;
  window.history.replaceState(null, "", `/home${normalized}`);
}
