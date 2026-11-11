const OVERLAY_ROOT_ID = "stokify-overlay-root";

/** Conteneur de portail au-dessus de l'app (#root) pour menus / overlays flottants. */
export function ensureOverlayRoot() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(OVERLAY_ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = OVERLAY_ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

export function getOverlayRoot() {
  return ensureOverlayRoot() || document.body;
}
