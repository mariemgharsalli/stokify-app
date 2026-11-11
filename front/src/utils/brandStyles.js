/** Couleurs Stokify — indépendantes de la config Tailwind `accent`. */
export const STOKIFY_BLUE = "#378ADD";
export const STOKIFY_BLUE_HOVER = "#5596e8";
export const STOKIFY_BLUE_RGB = "55, 138, 221";

/** Rouge doux — alertes, erreurs, badges, bordures de validation (ne pas utiliser sur les boutons). */
export const STOKIFY_RED = "#E24B4A";
export const STOKIFY_RED_RGB = "226, 75, 74";

/** Rouge intense — boutons d'action uniquement. */
export const STOKIFY_RED_ACTION = "#E11D2E";
export const STOKIFY_RED_ACTION_HOVER = "#C81826";
export const STOKIFY_RED_ACTION_RGB = "225, 29, 46";

/** Boutons d'action primaires (Nouveau, Créer, Enregistrer, Exporter…). */
export const primaryButtonStyle = { background: STOKIFY_RED_ACTION };

export const primaryButtonShadowStyle = {
  background: STOKIFY_RED_ACTION,
  boxShadow: `0 4px 12px rgba(${STOKIFY_RED_ACTION_RGB}, 0.28)`,
};

export const primaryButtonGradientStyle = {
  background: `linear-gradient(135deg, ${STOKIFY_RED_ACTION}, ${STOKIFY_RED_ACTION_HOVER})`,
  boxShadow: `0 4px 14px rgba(${STOKIFY_RED_ACTION_RGB}, 0.32)`,
};

/** État sélectionné (onglet actif, page courante) — reste bleu, distinct des actions. */
export const primarySelectionStyle = { background: STOKIFY_BLUE };

/** Listes déroulantes — surlignage option survolée / sélectionnée. */
export const primaryOptionHighlightStyle = { background: `rgba(${STOKIFY_BLUE_RGB}, 0.25)` };
export const primaryOptionSelectedStyle = { color: STOKIFY_BLUE };

/** Structure commune des boutons d'action primaires (sans classes bg-accent-*). */
export const PRIMARY_BTN_CLASSES =
  "stokify-btn-action inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50";

export const PRIMARY_BTN_SM_CLASSES =
  "stokify-btn-action inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50";
