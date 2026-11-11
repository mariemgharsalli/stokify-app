import { Archive, Lock, MinusCircle, Unlock } from "lucide-react";
import { statusGradient, statusGlowColor } from "../refs/components/refsUtils";

/** Aligné avec le cycle de vie backend (ALLOWED_TRANSITIONS). */

/** Boutons transition statut sans texte (liste, détail, grille). */
export function TransitionTargetIcon({ value, className }) {
  const v = String(value || "").toUpperCase();
  if (v === "BLOQUE") return <Lock className={className} aria-hidden />;
  if (v === "ARCHIVE") return <Archive className={className} aria-hidden />;
  if (v === "ACTIF") return <Unlock className={className} aria-hidden />;
  return <MinusCircle className={className} aria-hidden />;
}

/** @returns {"ACTIF" | "ARCHIVE" | "BLOQUE"} */
export function parseArticleStatut(row) {
  const raw = String(row?.statut ?? row?.Statut ?? "ACTIF").trim().toUpperCase();
  if (raw === "ARCHIVE") return "ARCHIVE";
  if (raw === "BLOQUE") return "BLOQUE";
  return "ACTIF";
}

export function articleStatutLabel(key) {
  if (key === "ARCHIVE") return "Archivé";
  if (key === "BLOQUE") return "Bloqué";
  return "Actif";
}

export const ARTICLE_TRANSITIONS = {
  ACTIF: [
    {
      value: "BLOQUE",
      label: "Bloquer",
      color: "text-orange-400 hover:bg-orange-500/15 hover:text-orange-300",
      icon: "🔒",
    },
    {
      value: "ARCHIVE",
      label: "Archiver",
      color: "text-amber-400 hover:bg-amber-500/15 hover:text-amber-300",
      icon: "📦",
    },
  ],
  BLOQUE: [
    {
      value: "ACTIF",
      label: "Débloquer",
      color: "text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-300",
      icon: "🔓",
    },
    {
      value: "ARCHIVE",
      label: "Archiver",
      color: "text-amber-400 hover:bg-amber-500/15 hover:text-amber-300",
      icon: "📦",
    },
  ],
  ARCHIVE: [
    {
      value: "ACTIF",
      label: "Désarchiver",
      color: "text-teal-400 hover:bg-teal-500/15 hover:text-teal-300",
      icon: "📦",
    },
  ],
};

export const ARTICLE_STATUS_STYLES = {
  ACTIF: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  BLOQUE: "bg-red-400/10 text-red-400 border-red-400/20",
  ARCHIVE: "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

export const ARTICLE_STATUS_ICONS = {
  ACTIF: "●",
  BLOQUE: "🔒",
  ARCHIVE: "📦",
};

/** Badge statut liste / grille — dégradé cohérent avec le segmented control */
export function ArticleStatutBadge({ row }) {
  const statutKey = parseArticleStatut(row);
  const gradient = statusGradient(statutKey);
  const glow = statusGlowColor(statutKey);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
      style={{ background: gradient, boxShadow: `0 2px 10px ${glow}` }}
    >
      {articleStatutLabel(statutKey)}
    </span>
  );
}

const ARTICLE_TABLE_STATUS_GRADIENTS = {
  ACTIF: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
  ARCHIVE: "linear-gradient(135deg, #2563eb 0%, #0284c7 100%)",
  BLOQUE: "linear-gradient(135deg, #dc2626 0%, #e11d48 100%)",
};

const ARTICLE_TABLE_STATUS_GLOW = {
  ACTIF: "rgba(5, 150, 105, 0.4)",
  ARCHIVE: "rgba(37, 99, 235, 0.4)",
  BLOQUE: "rgba(220, 38, 38, 0.4)",
};

/** Badge statut dans le tableau produits — Archivé en bleu (pas orange). */
export function ArticleTableStatutBadge({ row }) {
  const statutKey = parseArticleStatut(row);
  const gradient = ARTICLE_TABLE_STATUS_GRADIENTS[statutKey] ?? ARTICLE_TABLE_STATUS_GRADIENTS.ACTIF;
  const glow = ARTICLE_TABLE_STATUS_GLOW[statutKey] ?? ARTICLE_TABLE_STATUS_GLOW.ACTIF;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
      style={{ background: gradient, boxShadow: `0 2px 10px ${glow}` }}
    >
      {articleStatutLabel(statutKey)}
    </span>
  );
}
