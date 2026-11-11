import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Camera,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  FolderTree,
  Hash,
  Hand,
  HelpCircle,
  ImagePlus,
  Info,
  Layers,
  Boxes,
  Lock,
  Minus,
  Package,
  Pencil,
  Tag,
  Thermometer,
  Truck,
  Warehouse,
  Weight,
  X,
  Zap,
} from "lucide-react";
import StockPagination from "../../components/stock/StockPagination";
import ArticleKpiCards, { computeArticleKpis } from "./components/ArticleKpiCards";
import api from "../../services/api";
import * as XLSX from "xlsx";
import { exportArticlesExcel as downloadArticlesExcelFromApi } from "../../utils/exportHelpers";
import { exportArticleCatalogPdf } from "../../utils/articleCatalogPdf";
import PageShell from "../../components/ui/PageShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import ClientCatalog, {
  resolveArticleImageUrl,
} from "./ClientCatalog";
import { refsSelectOptions } from "../refs/refsStatusUi";
import { hasPermission } from "../../security/permissions";
import SuggestedCodeInput, {
  isDuplicateCodeError,
  getDuplicateCodeMessage,
  normalizeCodeClient,
} from "../../components/forms/SuggestedCodeInput";
import FormFieldError, { INPUT_ERROR_CLASS } from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { articleCreateSchema } from "../../validation";
import { flattenZodIssues } from "../../validation/helpers";
import { useAuthStore } from "../../store/authStore";
import { useClientBranding } from "../../hooks/useClientBranding";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import {
  ARTICLE_IMPORT_TEMPLATE_EXAMPLE_ROWS,
  getArticleImportExportHeaders,
  mapArticleToImportExportRow,
} from "./articleImportExportSchema";
import ArticlePageHeader from "./components/ArticlePageHeader";
import ArticleRefNavTabs from "./components/ArticleRefNavTabs";
import ArticleFiltersBar from "./components/ArticleFiltersBar";
import ArticleTableToolbar from "./components/ArticleTableToolbar";
import ArticleGridCard from "./components/ArticleGridCard";
import ArticleTableRow from "./components/ArticleTableRow";
import { ARTICLES_TABLE_UI_CSS, ArticleTableColGroup, ArticleTableHeadRow } from "./components/articleTableUi";
import ArticleTableSkeleton, { checkboxClass } from "./components/ArticleTableSkeleton";
import ArticleEmptyState from "./components/ArticleEmptyState";
import ArticleDetailModal from "./components/ArticleDetailModal";
import ArticleEditorModal, { EditorSectionHeader } from "./components/ArticleEditorModal";
import { pageShellClass, tableHeadClass, tableShellClass, articleTableStockLevelClass } from "./components/articlesTheme";
import {
  ARTICLES_ANIMATIONS_STYLE,
  stockIsCritical,
} from "../refs/components/refsUtils";

function formatErr(err) {
  const d = err.response?.data;
  if (d?.message) return String(d.message);
  if (Array.isArray(d?.errors)) return d.errors[0]?.message || d.errors[0]?.msg || "Erreur";
  return err.message || "Erreur";
}


function hasActiveFilterCriteria(searchVal, filtersVal, statutVal) {
  return (
    Boolean(String(searchVal ?? "").trim()) ||
    Boolean(statutVal) ||
    Object.values(filtersVal).some((v) => Boolean(v))
  );
}

function mapRawArticleToListItem(a) {
  const familleObj = a.famille ?? a.family ?? null;
  const sousFamilleObj = a.sousFamille ?? a.sous_famille ?? a.subFamily ?? null;
  const stock = Number(
    a.totalStock ??
      (Array.isArray(a.stocks) ? a.stocks.reduce((sum, s) => sum + (Number(s.quantite) || 0), 0) : 0)
  );
  const stockMin = Number(a.stockMin ?? 0);
  const prixUnitaire = Number(a.prixAchat ?? 0);
  const prixCatalogue = Number(a.prixVente ?? 0);
  const margePct = prixCatalogue > 0 ? ((prixCatalogue - prixUnitaire) / prixCatalogue) * 100 : 0;

  const firstStock = Array.isArray(a.stocks) && a.stocks.length > 0 ? a.stocks[0] : null;
  const statutNorm = String(a.statut ?? a.Statut ?? "ACTIF").trim().toUpperCase();
  const statutFinal = statutNorm === "ARCHIVE" || statutNorm === "BLOQUE" ? statutNorm : "ACTIF";
  return {
    ...a,
    statut: statutFinal,
    stock,
    stockMin,
    prixUnitaire,
    prixCatalogue,
    margePct,
    designation: a.libelle ?? a.designation ?? "Produit",
    marqueNom: a.marque?.nom ?? a.marque ?? "",
    familleNom:
      familleObj?.nom ??
      familleObj?.libelle ??
      familleObj?.name ??
      a.familleNom ??
      a.famille_nom ??
      (typeof familleObj === "string" ? familleObj : "") ??
      "",
    sousFamilleNom:
      sousFamilleObj?.nom ??
      sousFamilleObj?.libelle ??
      sousFamilleObj?.name ??
      a.sousFamilleNom ??
      a.sous_famille_nom ??
      (typeof sousFamilleObj === "string" ? sousFamilleObj : "") ??
      "",
    familleCode: familleObj?.code ?? a.famille?.code ?? "",
    sousFamilleCode: sousFamilleObj?.code ?? a.sousFamille?.code ?? "",
    fournisseurs: (() => {
      if (Array.isArray(a.fournisseurs) && a.fournisseurs.length > 0) {
        return a.fournisseurs
          .map((f) =>
            f && typeof f === "object"
              ? [f.code, f.nom ?? f.name].filter(Boolean).join(" — ") || (f.nom ?? f.name ?? String(f.id ?? ""))
              : String(f ?? "")
          )
          .filter(Boolean)
          .join(", ");
      }
      if (a.fournisseurNom && String(a.fournisseurNom).trim()) return String(a.fournisseurNom).trim();
      if (a.fournisseur && typeof a.fournisseur === "object") {
        return (
          [a.fournisseur.code, a.fournisseur.nom ?? a.fournisseur.name].filter(Boolean).join(" — ") ||
          (a.fournisseur.nom ?? a.fournisseur.name ?? "")
        );
      }
      return typeof a.fournisseur === "string" ? a.fournisseur : "";
    })(),
    emplacementNom:
      firstStock?.emplacement?.libelle ??
      firstStock?.emplacement?.nom ??
      a.emplacement?.libelle ??
      a.emplacement?.nom ??
      a.emplacement ??
      a.depot?.nom ??
      "",
    hasTva: Boolean(a.tvaPrix ?? a.tva ?? a.tauxTva),
  };
}

function applyClientArticleFilters(items, searchVal, filtersVal) {
  return items.filter((item) => {
    const matchesSearch =
      !searchVal ||
      item.code?.toLowerCase().includes(String(searchVal).toLowerCase()) ||
      item.designation?.toLowerCase().includes(String(searchVal).toLowerCase());

    const matchesMarque = !filtersVal.marque || item.marqueNom === filtersVal.marque;
    const matchesFamille =
      !filtersVal.familleId || String(item.familleId ?? item.famille?.id ?? "") === String(filtersVal.familleId);
    const matchesSousFamille =
      !filtersVal.sousFamilleId ||
      String(item.sousFamilleId ?? item.sousFamille?.id ?? "") === String(filtersVal.sousFamilleId);
    const matchesFournisseur =
      !filtersVal.fournisseur ||
      (() => {
        const f = filtersVal.fournisseur;
        if (/^\d+$/.test(String(f))) {
          return String(item.fournisseurId ?? item.fournisseur?.id ?? "") === String(f);
        }
        return (item.fournisseurs || "") === f;
      })();
    const matchesMarge =
      !filtersVal.marge ||
      (filtersVal.marge === "positive" && item.margePct > 0) ||
      (filtersVal.marge === "faible" && item.margePct > 0 && item.margePct < 15) ||
      (filtersVal.marge === "forte" && item.margePct >= 15);
    const matchesTva = !filtersVal.tvaPrix || (filtersVal.tvaPrix === "filtrer" ? item.hasTva : true);

    return (
      matchesSearch &&
      matchesMarque &&
      matchesFamille &&
      matchesSousFamille &&
      matchesFournisseur &&
      matchesMarge &&
      matchesTva
    );
  });
}

async function fetchAllArticlesFromApi(apiParams) {
  const limit = 100;
  let page = 1;
  const merged = [];
  let totalPages = 1;
  while (page <= totalPages) {
    const { data: res } = await api.get("articles", { params: { ...apiParams, page, limit } });
    const batch = res?.items ?? [];
    merged.push(...batch);
    totalPages = Number(res?.pages) || 1;
    if (!batch.length) break;
    page += 1;
  }
  return merged;
}

/** Dégradé boutons modale (mode clair). */
const ARTICLE_MODAL_GRADIENT = "linear-gradient(135deg, #4F8EF7, #7c3aed)";
const ARTICLE_MODAL_GRADIENT_SHADOW = "0 4px 20px rgba(124,58,237,0.35)";

const wizardInputClass =
  "w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-150 outline-none " +
  "border-[#e2e8f0] bg-white text-[#0f172a] placeholder:text-[#9ca3af] " +
  "focus:border-[#378ADD] focus:shadow-[0_0_0_3px_rgba(55,138,221,0.16)] " +
  "dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/25 " +
  "dark:focus:border-[#378ADD] dark:focus:bg-white/[0.06] dark:focus:shadow-[0_0_0_3px_rgba(55,138,221,0.18)]";

const wizardLabelClass =
  "mb-1.5 block text-sm font-medium text-[#374151] dark:text-xs dark:text-white/50";
const wizardHintClass = "mt-1 text-[11px] text-[#64748b] dark:text-white/55";
const WIZARD_ACCENT = { infos: "#6366f1", classif: "#06b6d4", prix: "#10b981", photo: "#f59e0b" };

function FieldHelp({ text }) {
  if (!text) return null;
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 translate-y-px items-center justify-center rounded-full text-[#94a3b8] dark:text-white/40"
      title={text}
    >
      <HelpCircle className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

function WizardGroupCard({ delay = 0, children, className = "" }) {
  return (
    <div
      className={`space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-sm dark:bg-white/[0.02] ${className}`}
      style={{ animation: `fadeUp 0.35s ease ${delay}ms both` }}
    >
      {children}
    </div>
  );
}

function WizardCardHeading({ icon: Icon, title, subtitle, accent }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon ? (
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${accent}18`, color: accent }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-white/55">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] leading-snug text-[#94a3b8] dark:text-white/45">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function EmptyRefHint({ message, actionLabel, onAction }) {
  return (
    <p className={`${wizardHintClass} flex flex-wrap items-center gap-x-1`}>
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="font-medium underline underline-offset-2"
          style={{ color: WIZARD_ACCENT.classif }}
        >
          {actionLabel}
        </button>
      ) : null}
    </p>
  );
}

function SummaryRow({ label, value, badge, valueClass = "" }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-[#94a3b8] dark:text-white/55">{label}</span>
      <span className={`flex items-center gap-1.5 text-right font-medium text-[#0f172a] dark:text-white/80 ${valueClass}`}>
        {value}
        {badge ? (
          <span className="rounded-full bg-[#ede9fe] px-1.5 py-0.5 text-[9px] font-medium text-[#7c3aed] dark:bg-[color-mix(in_srgb,var(--accent-500)_15%,transparent)] dark:text-[var(--accent-500)]">
            {badge}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Zone de sélection manuelle (fichier local uniquement — jamais d'image auto). */
function ArticleImagePicker({
  fileInputRef,
  inputId,
  previewSrc,
  isDragging,
  onDragState,
  onPickFile,
  onClear,
  compact = false,
  full = false,
  optional = false,
}) {
  const hasPreview = Boolean(previewSrc);
  const showOptionalHint = optional || full;

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="sr-only"
        onChange={(e) => {
          onPickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        className={`article-image-picker relative block cursor-pointer rounded-2xl border-2 border-dashed text-center transition-all duration-200 ${
          compact ? "min-h-[140px] p-4" : full ? "min-h-[280px] p-6" : "min-h-[220px] p-8"
        } ${
          isDragging
            ? "scale-[1.01] border-[#378ADD] bg-[#f3f8fd] dark:border-[#378ADD] dark:bg-[color-mix(in_srgb,#378ADD_8%,transparent)]"
            : hasPreview
              ? "border-[#378ADD] bg-[#f7fbff] dark:border-[#378ADD] dark:bg-[color-mix(in_srgb,#378ADD_6%,transparent)]"
              : "border-[#e2e8f0] bg-[#f8fafc] hover:border-[#378ADD] hover:bg-[#f7fbff] dark:border-[var(--color-border-secondary)] dark:bg-white/[0.02] dark:hover:border-[#378ADD] dark:hover:bg-[color-mix(in_srgb,#378ADD_6%,transparent)]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          onDragState(true);
        }}
        onDragLeave={() => onDragState(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragState(false);
          onPickFile(e.dataTransfer.files?.[0]);
        }}
      >
        {hasPreview ? (
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <img
              src={previewSrc}
              alt="Aperçu"
              className={`rounded-xl border border-[#e2e8f0] object-cover dark:border-white/10 ${
                compact ? "h-20 w-20" : full ? "h-40 w-40" : "h-32 w-32"
              }`}
            />
            <div className="flex justify-center gap-3 text-xs pointer-events-auto">
              <button
                type="button"
                className="text-[#378ADD] underline"
                onClick={(e) => {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }}
              >
                Changer l&apos;image
              </button>
              <button
                type="button"
                className="text-[#E24B4A] underline"
                onClick={(e) => {
                  e.preventDefault();
                  onClear();
                }}
              >
                Retirer
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center pointer-events-none ${full ? "gap-2 py-4" : "gap-3"}`}>
            {full ? (
              <ImagePlus className="h-8 w-8 text-[#94a3b8] dark:text-[var(--color-text-tertiary)]" aria-hidden="true" />
            ) : (
              <div
                className={`flex items-center justify-center rounded-xl bg-[#f1f5f9] text-[#94a3b8] transition-colors dark:bg-[var(--color-background-secondary)] dark:text-white/25 ${
                  compact ? "h-10 w-10" : "h-14 w-14"
                }`}
              >
                <i
                  className={`ti ti-photo-plus text-[#378ADD] ${compact ? "text-xl" : "text-2xl"}`}
                  aria-hidden="true"
                />
              </div>
            )}
            <p className={`font-medium text-[#0f172a] dark:text-white/80 ${compact ? "text-xs" : "text-sm"}`}>
              {full ? "Glissez une image ou cliquez pour parcourir" : "Cliquez ici pour choisir une photo (JPG, PNG)"}
            </p>
            {showOptionalHint ? (
              <p className="text-xs text-[#64748b] dark:text-[var(--color-text-tertiary)]">
                Facultatif — l&apos;article peut être créé sans photo
              </p>
            ) : !compact ? (
              <p className="max-w-xs text-xs text-[#94a3b8] dark:text-white/55">
                Ou glissez-déposez votre fichier dans cette zone. Aucune image n&apos;est ajoutée sans votre choix.
              </p>
            ) : null}
            <button
              type="button"
              className={
                full
                  ? "pointer-events-auto mt-2 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs text-[#64748b] transition-colors hover:border-[#378ADD] dark:border-[var(--color-border-secondary)] dark:text-[var(--color-text-secondary)] dark:hover:border-[#378ADD]"
                  : "pointer-events-auto rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 dark:bg-[var(--accent-500)]"
              }
              style={full ? undefined : { background: ARTICLE_MODAL_GRADIENT }}
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              {full ? "Parcourir" : "Parcourir mes fichiers…"}
            </button>
          </div>
        )}
      </label>
    </div>
  );
}

const PERISHABLE_KEYWORDS = [
  "yaourt",
  "lait",
  "fromage",
  "viande",
  "poisson",
  "fruit",
  "légume",
  "legume",
  "charcuterie",
  "pâtisserie",
  "patisserie",
  "boulangerie",
  "laitier",
];

const TVA_OPTIONS = [
  { value: 19, label: "19% (taux normal)" },
  { value: 13, label: "13% (taux intermédiaire)" },
  { value: 7, label: "7% (taux réduit)" },
  { value: 0, label: "0% (exonéré)" },
];

const STRATEGIE_OPTIONS = [
  {
    value: "FIFO",
    label: "FIFO",
    desc: "Premier entré, premier sorti",
    color: "#378ADD",
    Icon: ArrowRight,
  },
  {
    value: "FEFO",
    label: "FEFO",
    desc: "Expire le plus tôt sort en premier",
    color: "#1D9E75",
    Icon: Clock,
  },
  {
    value: "STANDARD",
    label: "Standard",
    desc: "Ordre d'entrée en stock (indépendant des dates de fabrication)",
    color: "var(--color-text-tertiary)",
    Icon: Minus,
  },
];

const MODE_TRACAGE_OPTIONS = [
  {
    value: "AUCUN",
    label: "Aucun",
    desc: "Pas de suivi lot ni série",
    color: "#64748b",
    Icon: Ban,
  },
  {
    value: "LOT",
    label: "Lot",
    desc: "Suivi par numéro de lot",
    color: "#378ADD",
    Icon: Package,
  },
  {
    value: "SERIE",
    label: "Numéro de série",
    desc: "Un identifiant unique par unité",
    color: "#7c3aed",
    Icon: Hash,
  },
  {
    value: "LOT_SERIE",
    label: "Lot + série",
    desc: "Les deux sont créés ensemble à la réception",
    color: "#0f766e",
    Icon: Boxes,
  },
];

const TRACAGE_AUTO_OPTIONS = [
  {
    value: true,
    label: "Automatique",
    desc: "Génération automatique à la réception, décrément automatique à la vente",
    color: "#f59e0b",
    Icon: Zap,
  },
  {
    value: false,
    label: "Manuel",
    desc: "Vous saisissez les lots / numéros de série vous-même dans l'interface",
    color: "#64748b",
    Icon: Hand,
  },
];

function ArticleWizardSummary({
  form,
  editing,
  editorImagePreview,
  marquesOptions,
  famillesOptions,
  sousFamillesOptions = [],
  fournisseursOptions = [],
  depotsOptions = [],
  emplacementsOptions = [],
  onJumpToStep,
}) {
  const summary = useMemo(() => {
    const famille = famillesOptions.find((f) => String(f.id) === String(form.familleId));
    const sousFamille = sousFamillesOptions.find((sf) => String(sf.id) === String(form.sousFamilleId));
    const marque = marquesOptions.find((m) => String(m.id) === String(form.marqueId));
    const fournisseur = fournisseursOptions.find((fr) => String(fr.id) === String(form.fournisseurId));
    const depot = depotsOptions.find((d) => String(d.id) === String(form.depotId));
    const emplacement = emplacementsOptions.find((em) => String(em.id) === String(form.emplacementId));
    const pa = parseFloat(form.prixAchat);
    const pv = parseFloat(form.prixVente);
    const margePct =
      Number.isFinite(pa) && pa > 0 && Number.isFinite(pv) ? (((pv - pa) / pa) * 100).toFixed(1) : null;
    const tracage =
      form.modeTracage === "AUCUN"
        ? "Aucun"
        : `${
            form.modeTracage === "LOT_SERIE"
              ? "Lot + n° de série"
              : form.modeTracage === "SERIE"
                ? "N° de série"
                : "Lot"
          } · ${form.tracageAuto ? "Auto" : "Manuel"}`;
    return {
      familleNom: famille?.nom || famille?.code || "—",
      sousFamilleNom: sousFamille?.nom || sousFamille?.code || "—",
      marqueLabel: marque ? [marque.code, marque.nom].filter(Boolean).join(" — ") : "—",
      fournisseurLabel: fournisseur
        ? [fournisseur.code, fournisseur.nom].filter(Boolean).join(" — ")
        : "—",
      depotLabel: depot ? `${depot.code} — ${depot.libelle}` : "—",
      emplacementLabel: emplacement ? `${emplacement.code} — ${emplacement.libelle}` : "—",
      margePct,
      tracage,
    };
  }, [
    form,
    famillesOptions,
    sousFamillesOptions,
    marquesOptions,
    fournisseursOptions,
    depotsOptions,
    emplacementsOptions,
  ]);

  const editBtn = (step) =>
    onJumpToStep ? (
      <button
        type="button"
        onClick={() => onJumpToStep(step)}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium text-[#64748b] transition hover:bg-white/80 hover:text-[#6366f1] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-violet-300"
      >
        <Pencil className="h-3 w-3" />
        Modifier
      </button>
    ) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 shadow-sm">
      <div className="relative mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#378ADD]/12 text-[#378ADD]">
          <Eye className="h-4 w-4" />
        </span>
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Récapitulatif</h4>
          <p className="text-[11px] text-[#94a3b8] dark:text-white/45">Vérifiez les informations avant de valider</p>
        </div>
      </div>

      <div className="commerce-card mb-3 flex items-center gap-3 rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] dark:border-[var(--color-border-secondary)] dark:bg-[var(--color-background-secondary)]">
          {editorImagePreview ? (
            <img src={editorImagePreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <i className="ti ti-package text-lg text-[#94a3b8] dark:text-white/30" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-[#378ADD]">{form.code || "—"}</span>
            {summary.familleNom !== "—" ? (
              <span className="rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2 py-0.5 text-[10px] text-[#64748b] dark:border-[var(--color-border-secondary)] dark:bg-[var(--color-background-secondary)] dark:text-[var(--color-text-secondary)]">
                {summary.familleNom}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[#64748b] dark:text-[var(--color-text-secondary)]">
            {form.libelle || "Libellé de l'article"}
          </p>
          <p className="text-[10px] text-[#94a3b8] dark:text-white/55">{form.unite || "UN"}</p>
        </div>
      </div>

      <div className="space-y-2 border-t border-[#e2e8f0] pt-3 dark:border-white/8">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: WIZARD_ACCENT.infos }}>
            Identité
          </span>
          {editBtn(0)}
        </div>
        <SummaryRow label="Code" value={form.code || "—"} badge={!editing ? "Auto" : null} />
        <SummaryRow label="Libellé" value={form.libelle || "—"} />
        <SummaryRow label="Unité" value={form.unite || "UN"} />
        <SummaryRow label="Marque" value={summary.marqueLabel} />
        <SummaryRow label="Statut" value={form.actif ? "Actif" : "Inactif"} />
      </div>

      <div className="mt-3 space-y-2 border-t border-[#e2e8f0] pt-3 dark:border-white/8">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: WIZARD_ACCENT.classif }}>
            Classification
          </span>
          {editBtn(1)}
        </div>
        <SummaryRow label="Famille" value={summary.familleNom} />
        <SummaryRow label="Sous-famille" value={summary.sousFamilleNom} />
        <SummaryRow label="Fournisseur" value={summary.fournisseurLabel} />
        <SummaryRow label="Dépôt" value={summary.depotLabel} />
        <SummaryRow label="Emplacement" value={summary.emplacementLabel} />
        <SummaryRow label="Traçabilité" value={summary.tracage} />
        {form.modeTracage !== "AUCUN" ? (
          <SummaryRow
            label="Stratégie"
            value={STRATEGIE_OPTIONS.find((o) => o.value === form.strategieSortie)?.label || form.strategieSortie}
          />
        ) : null}
      </div>

      <div className="mt-3 space-y-2 border-t border-[#e2e8f0] pt-3 dark:border-white/8">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: WIZARD_ACCENT.prix }}>
            Prix &amp; stock
          </span>
          {editBtn(2)}
        </div>
        <SummaryRow label="Prix achat" value={form.prixAchat ? `${form.prixAchat} TND` : "—"} />
        <SummaryRow label="Prix vente" value={form.prixVente ? `${form.prixVente} TND` : "—"} />
        {summary.margePct != null ? (
          <SummaryRow
            label="Marge"
            value={`${summary.margePct}%`}
            valueClass={Number(summary.margePct) < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}
          />
        ) : null}
        <SummaryRow label="TVA" value={`${form.tauxTva ?? 19}%`} />
        <SummaryRow label="Stock min / max" value={`${form.stockMin || "—"} / ${form.stockMax || "—"}`} />
        <SummaryRow label="Quantité initiale" value={String(form.quantiteInitiale ?? 0)} />
        {form.poids ? <SummaryRow label="Poids" value={`${form.poids} kg`} /> : null}
        {form.volume ? <SummaryRow label="Volume" value={`${form.volume} m³`} /> : null}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {form.fragile ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> Fragile
            </span>
          ) : null}
          {form.dangereuxChimique ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" /> Chimique dangereux
            </span>
          ) : null}
          {form.modeTracage === "LOT" || form.modeTracage === "LOT_SERIE" ? (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
              Lot
            </span>
          ) : null}
          {form.modeTracage === "SERIE" || form.modeTracage === "LOT_SERIE" ? (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
              N° de série
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Normalise les reponses API { items: [...] } ou tableau brut. */
function asItemArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

/** Champs Zod par étape — aligné sur EDITOR_WIZARD_STEPS (ArticleEditorModal). */
const ARTICLE_EDITOR_STEP_FIELDS = {
  0: ["code", "libelle"],
  1: ["familleId", "sousFamilleId", "fournisseurId", "depotId", "emplacementId", "modeTracage", "strategieSortie"],
  2: ["prixAchat", "prixVente", "stockMin", "stockMax", "tauxTva"],
  3: [],
};

function getStepFields(step) {
  return ARTICLE_EDITOR_STEP_FIELDS[step] ?? [];
}

function findFirstStepWithFieldErrors(flat) {
  for (let step = 0; step <= 2; step += 1) {
    if (getStepFields(step).some((field) => flat[field])) return step;
  }
  return null;
}

function FormSelect({ label, value, onChange, options, placeholder, required, disabled, onBlur, error, hint, help }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const filtered = (options ?? []).filter((o) =>
    String(o.label ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const selected = (options ?? []).find((o) => String(o.value) === String(value));
  const hasSelection = Boolean(selected);
  const displayPlaceholder = placeholder || "Sélectionner…";
  const showErrorState = Boolean(error) && !hasSelection;

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
      onBlur?.();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const updateMenuPos = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuMaxHeight = 280;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceBelow < menuMaxHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.min(menuMaxHeight, openUp ? spaceAbove : spaceBelow);

      setMenuStyle({
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, maxHeight),
        placement: openUp ? "top" : "bottom",
      });
    };
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <label className={`${wizardLabelClass} text-xs inline-flex items-center`}>
        {label}
        {required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
        <FieldHelp text={help} />
      </label>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={showErrorState}
        onClick={() => {
          setOpen((v) => {
            if (v) onBlur?.();
            return !v;
          });
          setQ("");
        }}
        onBlur={() => {
          if (!open) onBlur?.();
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 min-h-[44px]
                    rounded-xl border text-sm text-left transition-all
                    bg-white dark:bg-[var(--bg-dropdown)]
                    ${showErrorState ? INPUT_ERROR_CLASS : ""}
                    ${
                      disabled
                        ? "border-[#e2e8f0] text-[#94a3b8] cursor-not-allowed opacity-60 dark:border-white/5 dark:text-white/20"
                        : open
                          ? "border-[#7c3aed] text-[#0f172a] shadow-[0_0_0_3px_rgba(124,58,237,0.12)] dark:border-[#3b82f6] dark:text-white dark:ring-[#3b82f6]/15 dark:shadow-none dark:ring-[3px]"
                          : showErrorState
                            ? "border-[rgba(226,75,74,0.65)] bg-red-50/40 dark:bg-red-500/5"
                            : "border-[#e2e8f0] text-[#0f172a] hover:border-[#7c3aed]/50 dark:border-[var(--border-default)] dark:text-white/80 dark:hover:border-[#3b82f6]/50"
                    }`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            hasSelection
              ? "font-medium text-[#0f172a] dark:text-white"
              : "text-[#64748b] dark:text-white/55"
          }`}
        >
          {hasSelection ? selected.label : displayPlaceholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""} ${
            hasSelection ? "text-[#94a3b8] dark:text-white/55" : "text-[#64748b] dark:text-white/70"
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            className="z-[10050] flex flex-col overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-xl dark:border-[var(--border-default)] dark:bg-[var(--bg-dropdown)] dark:shadow-[var(--shadow-dropdown)]"
            style={{
              position: "fixed",
              top: menuStyle.top,
              bottom: menuStyle.bottom,
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
            }}
            role="listbox"
          >
            <div className="shrink-0 border-b border-[#e2e8f0] p-2 dark:border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 rounded-lg bg-[#f8fafc] px-2 py-1.5 dark:bg-[var(--bg-input)]">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="shrink-0 text-[#94a3b8] dark:text-white/40"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#9ca3af] dark:text-white dark:placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-[var(--bg-dropdown)]">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-center text-xs text-[#94a3b8] dark:text-white/55">Aucun résultat</div>
              ) : (
                filtered.map((o) => (
                  <button
                    key={`${label}-${String(o.value)}`}
                    type="button"
                    role="option"
                    aria-selected={String(o.value) === String(value)}
                    onClick={() => {
                      onChange(String(o.value));
                      setOpen(false);
                      setQ("");
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition-colors
                                ${
                                  String(o.value) === String(value)
                                    ? "bg-[#f5f3ff] text-[#7c3aed] dark:bg-[var(--bg-card-hover)] dark:text-[#3b82f6]"
                                    : "text-[#374151] hover:bg-[#f8fafc] dark:text-white dark:hover:bg-[var(--info-bg)] dark:hover:text-white"
                                }`}
                  >
                    <span className="min-w-0 truncate">{o.label}</span>
                    {String(o.value) === String(value) && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="shrink-0 text-[#7c3aed] dark:text-[#3b82f6]"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      <FormFieldError message={showErrorState ? error : null} />
      {hint ? <p className={wizardHintClass}>{hint}</p> : null}
    </div>
  );
}

export default function Articles() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const societeScope = useSocieteQueryScope();
  const clientBranding = useClientBranding();
  const canWrite = hasPermission(user?.role, "stock:write");
  const canDeletePermanent = hasPermission(user?.role, "stock:delete");
  const isClient = user?.role === "CLIENT";
  const importInputRef = useRef(null);
  const articleImageInputRef = useRef(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    marque: "",
    familleId: "",
    sousFamilleId: "",
    fournisseur: "",
    marge: "",
    tvaPrix: "",
  });
  const [viewMode, setViewMode] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  /** Filtre API sur le champ statut : "" = tous les statuts, sinon ACTIF | ARCHIVE | BLOQUE */
  const [statut, setStatut] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [detailArticleId, setDetailArticleId] = useState(null);
  const [detailListItem, setDetailListItem] = useState(null);
  const [formStep, setFormStep] = useState(0);
  const [margin, setMargin] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [codeFading, setCodeFading] = useState(false);
  const [codePulsing, setCodePulsing] = useState(false);
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportErrors, setShowImportErrors] = useState(false);
  const [pdfExportPending, setPdfExportPending] = useState(false);
  const [excelExportPending, setExcelExportPending] = useState(false);
  const [userTouchedStrategie, setUserTouchedStrategie] = useState(false);
  const [suggestedStrategie, setSuggestedStrategie] = useState(null);
  const [tracageGuard, setTracageGuard] = useState({ locked: false, hasHistory: false });
  const [form, setForm] = useState({
    code: "",
    libelle: "",
    unite: "UN",
    marqueId: "",
    familleId: "",
    sousFamilleId: "",
    fournisseurId: "",
    depotId: "",
    emplacementId: "",
    strategieSortie: "FIFO",
    modeTracage: "AUCUN",
    tracageAuto: false,
    prixAchat: "",
    prixVente: "",
    tauxTva: 19,
    quantiteInitiale: 0,
    stockMin: "",
    stockMax: "",
    seuilAlerte: "",
    temperatureMin: "",
    temperatureMax: "",
    poids: "",
    volume: "",
    fragile: false,
    dangereuxChimique: false,
    actif: true,
    imageUrl: "",
  });

  const articleValues = useMemo(
    () => ({
      code: form.code,
      libelle: form.libelle,
      familleId: form.familleId,
      sousFamilleId: form.sousFamilleId,
      fournisseurId: form.fournisseurId,
      depotId: form.depotId,
      emplacementId: form.emplacementId,
      poids: form.poids,
      volume: form.volume,
      prixAchat: form.prixAchat,
      prixVente: form.prixVente,
      stockMin: form.stockMin,
      stockMax: form.stockMax,
      tauxTva: form.tauxTva,
      modeTracage: form.modeTracage,
      tracageAuto: form.tracageAuto,
      strategieSortie: form.strategieSortie,
    }),
    [form]
  );
  const {
    errors,
    validate: validateArticle,
    validateField,
    isValid: articleFormValid,
    setErrors,
    clearError,
    clearErrors,
    applyApiErrors,
  } = useFormValidation(articleCreateSchema, articleValues);

  const validateStep = useCallback(
    (step) => {
      const fields = getStepFields(step);
      if (!fields.length) return true;

      const result = articleCreateSchema.safeParse(articleValues);
      const flat = result.success ? {} : flattenZodIssues(result.error.issues);
      const stepErrors = {};
      for (const field of fields) {
        if (flat[field]) stepErrors[field] = flat[field];
      }

      setErrors((prev) => {
        const next = { ...prev };
        for (const field of fields) {
          delete next[field];
        }
        return { ...next, ...stepErrors };
      });

      return Object.keys(stepErrors).length === 0;
    },
    [articleValues, setErrors]
  );

  const handleNext = useCallback(() => {
    if (!validateStep(formStep)) return;
    setFormStep((s) => Math.min(3, s + 1));
  }, [formStep, validateStep]);

  const modalFieldErrors = useMemo(() => {
    const stepFields = new Set(getStepFields(formStep));
    return Object.fromEntries(Object.entries(errors).filter(([key]) => !stepFields.has(key)));
  }, [errors, formStep]);

  const resetEditorForm = useCallback(() => {
    setSelectedImageFile(null);
    setImagePreview("");
    setIsDraggingImage(false);
    setCodeFading(false);
    setCodePulsing(false);
    setRefreshSpinning(false);
    setSubmitSuccess(false);
    setUserTouchedStrategie(false);
    setSuggestedStrategie(null);
    setTracageGuard({ locked: false, hasHistory: false });
    setForm({
      code: "",
      libelle: "",
      unite: "UN",
      marqueId: "",
      familleId: "",
      sousFamilleId: "",
      fournisseurId: "",
      depotId: "",
      emplacementId: "",
      strategieSortie: "FIFO",
      modeTracage: "AUCUN",
      tracageAuto: false,
      prixAchat: "",
      prixVente: "",
      tauxTva: 19,
      quantiteInitiale: 0,
      stockMin: "",
      stockMax: "",
      seuilAlerte: "",
      temperatureMin: "",
      temperatureMax: "",
      poids: "",
      volume: "",
      fragile: false,
      dangereuxChimique: false,
      actif: true,
      imageUrl: "",
    });
  }, []);

  const fetchNextCode = useCallback(async () => {
    setCodeFading(true);
    try {
      const { data } = await api.get("articles/next-code");
      if (data?.code) {
        setTimeout(() => {
          setForm((f) => ({ ...f, code: data.code }));
          setCodeFading(false);
        }, 75);
      } else {
        setCodeFading(false);
      }
    } catch {
      setCodeFading(false);
    }
  }, []);

  const regenerateCode = useCallback(async () => {
    setRefreshSpinning(true);
    await fetchNextCode();
    setTimeout(() => setRefreshSpinning(false), 400);
  }, [fetchNextCode]);

  function openForm() {
    setFormStep(0);
    setEditing(null);
    resetEditorForm();
    setError("");
    setErrors({});
    setMargin(null);
    setShowForm(true);
    navigate("/articles?mode=create");
    window.location.hash = "product-editor";
  }

  function closeForm() {
    setMargin(null);
    setErrors({});
    setError("");
    setFormStep(0);
    setShowForm(false);
    setEditing(null);
    resetEditorForm();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "create" || hash === "#product-editor") {
      navigate({ pathname: "/articles", search: "", hash: "" }, { replace: true });
    }
  }

  useEffect(() => {
    if (!showForm || editing) return;
    fetchNextCode();
  }, [showForm, editing, fetchNextCode]);

  useEffect(() => {
    const pa = parseFloat(form.prixAchat);
    const pv = parseFloat(form.prixVente);
    if (Number.isFinite(pa) && pa > 0 && form.prixVente !== "" && Number.isFinite(pv)) {
      setMargin((((pv - pa) / pa) * 100).toFixed(1));
    } else {
      setMargin(null);
    }
  }, [form.prixAchat, form.prixVente]);

  const [clientPage, setClientPage] = useState(1);
  const [clientEnStock, setClientEnStock] = useState("");
  const [clientSort, setClientSort] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["articles", societeScope, search, isClient, statut, clientPage, clientEnStock, clientSort],
    queryFn: () =>
      api
        .get(isClient ? "articles/catalogue" : "articles", {
          params: {
            search: search || undefined,
            ...(isClient
              ? {
                  statut: "ACTIF",
                  page: clientPage,
                  limit: 24,
                  ...(clientEnStock !== "" ? { enStock: clientEnStock } : {}),
                  ...(clientSort ? { sort: clientSort } : {}),
                }
              : {
                  limit: 100,
                  ...(statut ? { statut } : {}),
                }),
          },
        })
        .then((r) => r.data),
  });

  const setStatutArticle = useMutation({
    mutationFn: ({ id, statut: next }) =>
      api.patch(`articles/${Number(id)}/statut`, { statut: String(next).trim() }),
    onSuccess: () => {
      setError("");
      setSuccess("Statut mis à jour.");
      setTimeout(() => setSuccess(""), 3000);
      qc.invalidateQueries({ queryKey: ["articles"], exact: false });
      qc.invalidateQueries({ queryKey: ["articles", "detail"], exact: false });
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
    },
    onError: (e) => setError(formatErr(e)),
  });

  const { data: marquesList = [], error: marquesError } = useQuery({
    queryKey: ["marques", "article-form", societeScope],
    queryFn: () => api.get("marques", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
    enabled: !isClient,
  });

  const { data: famillesList = [] } = useQuery({
    queryKey: ["familles", "article-form", societeScope],
    queryFn: () => api.get("familles", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
    enabled: !isClient,
  });

  const { data: sousFamillesFormList = [] } = useQuery({
    queryKey: ["sous-familles", "article-form", societeScope, form.familleId],
    queryFn: () =>
      api
        .get("familles/sous-familles", {
          params: {
            familleId: form.familleId || undefined,
            limit: 100,
            statut: "ACTIF",
          },
        })
        .then((r) => r.data),
    enabled: canWrite && !isClient && Boolean(form.familleId),
  });

  const { data: sousFamillesFilterList = [] } = useQuery({
    queryKey: ["sous-familles", "article-filters", societeScope, filters.familleId],
    queryFn: () =>
      api
        .get("familles/sous-familles", {
          params: {
            familleId: filters.familleId || undefined,
            limit: 100,
            statut: "ACTIF",
          },
        })
        .then((r) => r.data),
    enabled: !isClient && Boolean(filters.familleId),
  });

  const { data: fournisseursList = [], error: fournisseursError } = useQuery({
    queryKey: ["fournisseurs", "article-form", societeScope],
    queryFn: () => api.get("fournisseurs", { params: { limit: 300 } }).then((r) => r.data),
    enabled: !isClient,
  });

  const { data: depotsList = [] } = useQuery({
    queryKey: ["depots", "article-form", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 300, statut: "ACTIF" } }).then((r) => r.data),
    enabled: !isClient,
  });

  const { data: emplacementsList = [] } = useQuery({
    queryKey: ["emplacements", "article-form", societeScope, form.depotId],
    queryFn: () => api.get("emplacements", { params: { depotId: form.depotId, statut: "ACTIF" } }).then((r) => r.data),
    enabled: canWrite && !isClient && Boolean(form.depotId),
  });

  const { data: publicCompanies = [] } = useQuery({
    queryKey: ["companies", "public", "articles-pdf"],
    queryFn: () => api.get("companies/public").then((r) => r.data),
    enabled: !isClient,
  });

  const activeSociete = useMemo(() => {
    const sid =
      user?.role === "SUPER_ADMIN"
        ? activeSocieteId
        : user?.societeId ?? activeSocieteId;
    if (sid == null) return publicCompanies[0] ?? null;
    return publicCompanies.find((c) => Number(c.id) === Number(sid)) ?? null;
  }, [publicCompanies, activeSocieteId, user?.role, user?.societeId]);

  const saveMutation = useMutation({
    mutationFn: async ({ payload, imageFile }) => {
      let imageUrl = payload.imageUrl ?? null;
      if (imageFile) {
        const fd = new FormData();
        fd.append("image", imageFile);
        const uploadRes = await api.post("articles/upload-image", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const uploadedUrl = uploadRes.data?.url || null;
        if (!uploadedUrl) {
          throw new Error("Échec de l'upload de l'image");
        }
        imageUrl = uploadedUrl;
      }
      const finalPayload = { ...payload, imageUrl };
      return editing ? api.patch(`articles/${editing.id}`, finalPayload) : api.post("articles", finalPayload);
    },
    onSuccess: () => {
      setError("");
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setSuccess(editing ? "Article mis a jour." : "Article cree.");
        setTimeout(() => setSuccess(""), 3000);
        setEditing(null);
        setFormStep(0);
        setShowForm(false);
        resetEditorForm();
        navigate({ pathname: "/articles", search: "", hash: "" }, { replace: true });
        qc.invalidateQueries({ queryKey: ["articles"] });
        qc.invalidateQueries({ queryKey: ["stock"] });
      }, 400);
    },
    onError: (e) => {
      if (isDuplicateCodeError(e)) {
        setCodeError(getDuplicateCodeMessage(e));
        setFormStep(0);
      }
      applyApiErrors(e.response?.data);
      setError(formatErr(e));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`articles/${id}`),
    onSuccess: () => {
      setSuccess("Article supprime.");
      setTimeout(() => setSuccess(""), 3000);
      qc.invalidateQueries({ queryKey: ["articles"], exact: false });
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
    },
    onError: (e) => setError(formatErr(e)),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.delete(`articles/${id}`))),
    onSuccess: () => {
      setSuccess("Produits selectionnes supprimes.");
      setTimeout(() => setSuccess(""), 3000);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["articles"], exact: false });
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
    },
    onError: (e) => setError(formatErr(e)),
  });

  const rawItems = data?.items || [];

  const items = useMemo(() => rawItems.map(mapRawArticleToListItem), [rawItems]);

  const apiTotal = Number(data?.total ?? rawItems.length) || 0;

  const options = useMemo(() => {
    const uniques = (getter) =>
      Array.from(
        new Set(items.map(getter).filter((v) => typeof v === "string" && v.trim() !== ""))
      ).sort((a, b) => a.localeCompare(b));

    const marquesArr = asItemArray(marquesList);
    const famillesArr = asItemArray(famillesList);
    const sousFiltArr = asItemArray(sousFamillesFilterList);
    const fournisseursArr = asItemArray(fournisseursList);

    const famillesFromApi = famillesArr
      .map((f) => ({ id: f.id, label: f.nom || f.code || String(f.id) }))
      .filter((f) => f.label);

    const sousFromApi = filters.familleId
      ? sousFiltArr
          .map((sf) => ({ id: sf.id, label: sf.nom || sf.code || String(sf.id), familleId: sf.familleId }))
          .filter((sf) => sf.label)
      : [];

    const fournisseursFromApi = fournisseursArr
      .map((fr) => ({ id: fr.id, label: fr.nom || fr.code || String(fr.id) }))
      .filter((fr) => fr.label);

    return {
      marques:
        marquesArr.length > 0
          ? marquesArr
              .map((m) => m.nom ?? "")
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b))
          : uniques((i) => i.marqueNom),
      familles: famillesFromApi.length ? famillesFromApi : items.map((i) => ({ id: i.familleId ?? i.famille?.id, label: i.familleNom })).filter((x) => x.id && x.label),
      sousFamilles:
        sousFromApi.length > 0
          ? sousFromApi
          : items
              .filter(
                (i) =>
                  !filters.familleId ||
                  String(i.familleId ?? i.famille?.id ?? "") === String(filters.familleId)
              )
              .map((i) => ({
                id: i.sousFamilleId ?? i.sousFamille?.id,
                label: i.sousFamilleNom,
                familleId: i.familleId ?? i.famille?.id,
              }))
              .filter((x) => x.id && x.label),
      fournisseurs: fournisseursFromApi.length ? fournisseursFromApi : uniques((i) => i.fournisseurs).map((label) => ({ id: label, label })),
    };
  }, [items, marquesList, famillesList, sousFamillesFilterList, fournisseursList, filters.familleId]);

  const filteredItems = useMemo(
    () => applyClientArticleFilters(items, search, filters),
    [items, search, filters]
  );

  const articleKpis = useMemo(() => computeArticleKpis(items), [items]);

  const totalResults = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);
  const rangeStart = totalResults === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalResults);

  useEffect(() => {
    setPage(1);
  }, [search, filters, pageSize, statut]);

  const hasActiveCriteria = useMemo(
    () => hasActiveFilterCriteria(search, filters, statut),
    [search, filters, statut]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => filteredItems.some((item) => item.id === id)));
  }, [filteredItems]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "create") {
      if (showForm) return;
      setFormStep(0);
      setEditing(null);
      resetEditorForm();
      setError("");
      setErrors({});
      setMargin(null);
      setShowForm(true);
    }
  }, [location.search, resetEditorForm, showForm]);

  const isAllPageSelected = pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id));

  function formatCurrency(value) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND" }).format(Number(value || 0));
  }

  function getStockBadgeClass(item) {
    return `${articleTableStockLevelClass(item.stock, item.stockMin)}${stockIsCritical(item.stock, item.stockMin) ? " article-stock-critical" : ""}`;
  }

  function toggleSelectAllPage() {
    if (isAllPageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageItems.some((item) => item.id === id)));
      return;
    }
    const pageIds = pageItems.map((item) => item.id);
    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  function toggleSelectOne(id) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function exportArticlesExcel({ forceTemplate = false } = {}) {
    if (excelExportPending) return;

    setExcelExportPending(true);
    setError("");
    try {
      if (forceTemplate) {
        const headers = getArticleImportExportHeaders();
        const rows = ARTICLE_IMPORT_TEMPLATE_EXAMPLE_ROWS;
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        ws["!cols"] = headers.map(() => ({ wch: 18 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modèle import");
        XLSX.writeFile(wb, "modele-import-produits.xlsx");
        setSuccess("Modèle avec exemples téléchargé — prêt pour un nouvel import");
        setTimeout(() => setSuccess(""), 5000);
        return;
      }

      const hasSelection = selectedIds.length > 0;
      const hasClientOnlyFilters = Object.values(filters).some((v) => Boolean(v));
      const apiParams = {};

      if (hasSelection) {
        apiParams.ids = selectedIds.join(",");
      } else if (hasClientOnlyFilters) {
        const rawAll = await fetchAllArticlesFromApi({
          search: search || undefined,
          ...(statut ? { statut } : {}),
        });
        const allItems = rawAll.map(mapRawArticleToListItem);
        const rowsToExport = applyClientArticleFilters(allItems, search, filters);
        if (rowsToExport.length === 0) {
          const headers = getArticleImportExportHeaders();
          const ws = XLSX.utils.aoa_to_sheet([headers, ...ARTICLE_IMPORT_TEMPLATE_EXAMPLE_ROWS]);
          ws["!cols"] = headers.map(() => ({ wch: 18 }));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Modèle import");
          XLSX.writeFile(wb, "modele-import-produits.xlsx");
          setSuccess("Aucun article pour l'instant — voici un modèle avec exemples pour démarrer");
          setTimeout(() => setSuccess(""), 5000);
          return;
        }
        apiParams.ids = rowsToExport.map((item) => item.id).join(",");
      } else {
        if (search) apiParams.search = search;
        if (statut) apiParams.statut = statut;
      }

      await downloadArticlesExcelFromApi(api, apiParams);

      let toastMessage;
      if (hasSelection) {
        toastMessage = `Export de ${selectedIds.length} article(s) sélectionné(s)`;
      } else if (hasActiveCriteria) {
        toastMessage = "Export Excel téléchargé (filtres actifs appliqués)";
      } else {
        toastMessage = `Export de ${apiTotal} article(s)`;
      }
      setSuccess(toastMessage);
      setTimeout(() => setSuccess(""), 5000);
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setExcelExportPending(false);
    }
  }

  function handleCreateProduct() {
    openForm();
  }

  function handleInlineEdit(item) {
    setFormStep(0);
    startEdit(item);
    setError("");
    setErrors({});
    setMargin(null);
    setShowForm(true);
    window.location.hash = "product-editor";
  }

  function handleViewDetail(item) {
    setDetailListItem(item);
    setDetailArticleId(Number(item.id));
  }

  function handleCloseDetail() {
    setDetailArticleId(null);
    setDetailListItem(null);
  }

  function handleEditFromDetail(article) {
    handleCloseDetail();
    handleInlineEdit(article);
  }

  function handleImporter() {
    if (importPending) return;
    importInputRef.current?.click();
  }

  async function onImportFileSelected(file) {
    if (!file || importPending) return;
    if (importInputRef.current) importInputRef.current.value = "";

    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      setError("Format non supporté : utilisez un fichier CSV (.csv) ou Excel (.xlsx)");
      setTimeout(() => setError(""), 5000);
      return;
    }

    setImportPending(true);
    setError("");
    setImportResult(null);
    setShowImportErrors(false);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("articles/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImportResult(data);
      if (data?.success > 0) {
        qc.invalidateQueries({ queryKey: ["articles"], exact: false });
        qc.invalidateQueries({ queryKey: ["stock"], exact: false });
      }
      if (data?.failed > 0) {
        setShowImportErrors(true);
      }
      setSuccess(
        `Import terminé : ${data?.success ?? 0} article(s) importé(s), ${data?.failed ?? 0} échec(s).`
      );
      setTimeout(() => setSuccess(""), 8000);
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setImportPending(false);
    }
  }

  async function exportCatalogPdf() {
    const selectedRows = filteredItems.filter((item) => selectedIds.includes(item.id));
    const rowsToExport = selectedRows.length ? selectedRows : filteredItems;
    if (!rowsToExport.length) {
      setError("Aucun article à exporter (ajustez les filtres ou sélectionnez des lignes).");
      setTimeout(() => setError(""), 4000);
      return;
    }

    setPdfExportPending(true);
    setError("");
    try {
      await exportArticleCatalogPdf({
        articles: rowsToExport,
        societe: activeSociete,
        clientBranding,
        userName: [user?.prenom, user?.nom].filter(Boolean).join(" ") || user?.email || "",
        search,
        statut,
        filters,
        selectedCount: selectedRows.length,
      });
    } catch (e) {
      setError(e.message || "Erreur lors de la génération du PDF");
    } finally {
      setPdfExportPending(false);
    }
  }

  const filterMarqueOptions = useMemo(
    () => options.marques.map((v) => ({ value: v, label: v })),
    [options.marques]
  );
  const filterFamilleOptions = useMemo(() => {
    const seen = new Set();
    return options.familles
      .filter((x) => x.id != null && String(x.id) !== "" && x.label)
      .filter((x) => {
        const k = String(x.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((x) => ({ value: String(x.id), label: x.label }));
  }, [options.familles]);
  const filterSousFamilleOptions = useMemo(
    () =>
      options.sousFamilles
        .filter((sous) => !filters.familleId || String(sous.familleId) === String(filters.familleId))
        .filter((sf) => sf.id != null && String(sf.id) !== "" && sf.label)
        .map((sf) => ({ value: String(sf.id), label: sf.label })),
    [options.sousFamilles, filters.familleId]
  );
  const filterFournisseurOptions = useMemo(() => {
    const arr = asItemArray(fournisseursList);
    if (arr.length > 0) {
      const seen = new Set();
      return arr
        .map((fr) => ({
          value: String(fr.id),
          label: [fr.code, fr.nom].filter(Boolean).join(" — ") || fr.nom || fr.code || String(fr.id),
        }))
        .filter((o) => {
          if (seen.has(o.value)) return false;
          seen.add(o.value);
          return true;
        });
    }
    return options.fournisseurs.map((fr) => ({
      value: String(fr.id),
      label: fr.label || String(fr.id),
    }));
  }, [fournisseursList, options.fournisseurs]);

  const famillesOptions = refsSelectOptions(asItemArray(famillesList), form.familleId);
  const sousFamillesOptions = refsSelectOptions(asItemArray(sousFamillesFormList), form.sousFamilleId);
  const fournisseursOptions = asItemArray(fournisseursList);
  const depotsOptions = asItemArray(depotsList);
  const emplacementsOptions = asItemArray(emplacementsList);
  const marquesOptions = refsSelectOptions(asItemArray(marquesList), form.marqueId);

  useEffect(() => {
    if (!form.familleId || userTouchedStrategie) return;
    const famille = famillesOptions.find((f) => String(f.id) === String(form.familleId));
    if (!famille) return;
    const isPerishable = PERISHABLE_KEYWORDS.some((kw) =>
      String(famille.nom || "").toLowerCase().includes(kw)
    );
    const suggestion = isPerishable ? "FEFO" : "FIFO";
    setForm((f) => ({ ...f, strategieSortie: suggestion }));
    setSuggestedStrategie(suggestion);
  }, [form.familleId, famillesOptions, userTouchedStrategie]);

  function startEdit(a) {
    setEditing(a);
    setSelectedImageFile(null);
    setImagePreview("");
    setIsDraggingImage(false);
    setUserTouchedStrategie(true);
    setSuggestedStrategie(null);
    setTracageGuard({
      locked: Boolean(a.tracageLocked),
      hasHistory: Boolean(a.tracageHasHistory),
    });
    setForm({
      code: a.code,
      libelle: a.libelle,
      unite: a.unite || "UN",
      marqueId: a.marqueId != null ? String(a.marqueId) : a.marque?.id != null ? String(a.marque.id) : "",
      familleId:
        a.familleId != null ? String(a.familleId) : a.famille?.id != null ? String(a.famille.id) : "",
      sousFamilleId:
        a.sousFamilleId != null
          ? String(a.sousFamilleId)
          : a.sousFamille?.id != null
            ? String(a.sousFamille.id)
            : "",
      fournisseurId:
        a.fournisseurId != null
          ? String(a.fournisseurId)
          : a.fournisseur?.id != null
            ? String(a.fournisseur.id)
            : Array.isArray(a.fournisseurs) && a.fournisseurs[0]?.id != null
              ? String(a.fournisseurs[0].id)
              : "",
      depotId:
        a.depotId != null
          ? String(a.depotId)
          : Array.isArray(a.stocks) && a.stocks[0]?.depotId != null
            ? String(a.stocks[0].depotId)
            : a.depot?.id != null
              ? String(a.depot.id)
              : "",
      emplacementId:
        a.emplacementId != null
          ? String(a.emplacementId)
          : Array.isArray(a.stocks) && a.stocks[0]?.emplacementId != null
            ? String(a.stocks[0].emplacementId)
            : a.emplacement?.id != null
              ? String(a.emplacement.id)
              : "",
      strategieSortie: String(a.strategieSortie || "FIFO").toUpperCase(),
      modeTracage: ["AUCUN", "LOT", "SERIE", "LOT_SERIE"].includes(String(a.modeTracage || "").toUpperCase())
        ? String(a.modeTracage).toUpperCase()
        : ["LOTS", "FIFO", "LOT", "FEFO"].includes(String(a.modeGestion || "").toUpperCase())
          ? "LOT"
          : "AUCUN",
      tracageAuto: Boolean(a.tracageAuto),
      prixAchat: a.prixAchat != null && String(a.prixAchat) !== "" ? String(a.prixAchat) : "",
      prixVente: a.prixVente != null && String(a.prixVente) !== "" ? String(a.prixVente) : "",
      tauxTva: a.tauxTva != null ? Number(a.tauxTva) : 19,
      quantiteInitiale: 0,
      stockMin: a.stockMin ?? "",
      stockMax: a.stockMax ?? "",
      seuilAlerte: a.seuilAlerte ?? "",
      temperatureMin: a.temperatureMin ?? "",
      temperatureMax: a.temperatureMax ?? "",
      poids: a.poids != null ? String(a.poids) : "",
      volume: a.volume != null ? String(a.volume) : "",
      fragile: Boolean(a.fragile),
      dangereuxChimique: Boolean(a.dangereuxChimique),
      actif: a.actif,
      imageUrl: a.imageUrl || "",
    });
    setError("");
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get("edit");
    if (!editId) return;
    const idNum = Number(editId);
    if (!Number.isInteger(idNum) || idNum < 1) return;
    let cancelled = false;
    api
      .get(`articles/${idNum}`)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setFormStep(0);
        startEdit(data);
        setShowForm(true);
        window.location.hash = "product-editor";
        navigate({ pathname: "/articles", search: "", hash: "product-editor" }, { replace: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // startEdit uses stable setters; omit from deps to avoid re-running each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate]);

  function submit(e) {
    e.preventDefault();
    if (formStep !== 3) return;
    setError("");
    if (!validateArticle()) {
      setError("Corrigez les champs obligatoires du formulaire.");
      const result = articleCreateSchema.safeParse(articleValues);
      if (!result.success) {
        const flat = flattenZodIssues(result.error.issues);
        const targetStep = findFirstStepWithFieldErrors(flat);
        if (targetStep != null) setFormStep(targetStep);
      }
      return;
    }
    const pa = parseFloat(form.prixAchat);
    const pv = parseFloat(form.prixVente);
    const fieldErrors = {};
    if (!form.prixAchat || pa <= 0 || Number.isNaN(pa)) fieldErrors.prixAchat = "Prix achat requis et > 0";
    if (!form.prixVente || pv <= 0 || Number.isNaN(pv)) fieldErrors.prixVente = "Prix vente requis et > 0";
    if (!fieldErrors.prixVente && !Number.isNaN(pa) && !Number.isNaN(pv) && pv < pa) {
      fieldErrors.prixVente = "Prix vente doit être ≥ prix achat";
    }
    if (Object.keys(fieldErrors).length) {
      setErrors((prev) => ({ ...prev, ...fieldErrors }));
      return;
    }
    const payload = {
      code: normalizeCodeClient(form.code),
      libelle: form.libelle.trim(),
      unite: form.unite.trim(),
      marqueId: form.marqueId === "" ? null : Number(form.marqueId),
      familleId: Number(form.familleId),
      sousFamilleId: Number(form.sousFamilleId),
      fournisseurId: Number(form.fournisseurId),
      depotId: Number(form.depotId),
      emplacementId: Number(form.emplacementId),
      prixAchat: parseFloat(form.prixAchat) || 0,
      prixVente: parseFloat(form.prixVente) || 0,
      tauxTva: Number(form.tauxTva ?? 19),
      quantiteInitiale: parseInt(form.quantiteInitiale, 10) || 0,
      stockMin: form.stockMin === "" ? null : Number(form.stockMin),
      stockMax: form.stockMax === "" ? null : Number(form.stockMax),
      seuilAlerte: form.seuilAlerte === "" ? null : Number(form.seuilAlerte),
      temperatureMin: form.temperatureMin === "" ? null : Number(form.temperatureMin),
      temperatureMax: form.temperatureMax === "" ? null : Number(form.temperatureMax),
      poids: form.poids === "" ? null : Number(form.poids),
      volume: form.volume === "" ? null : Number(form.volume),
      fragile: Boolean(form.fragile),
      dangereuxChimique: Boolean(form.dangereuxChimique),
      actif: form.actif,
      strategieSortie:
        form.modeTracage !== "AUCUN" && form.strategieSortie === "STANDARD"
          ? "FIFO"
          : form.strategieSortie || "FIFO",
      modeTracage: form.modeTracage || "AUCUN",
      tracageAuto: form.modeTracage !== "AUCUN" && Boolean(form.tracageAuto),
      imageUrl: form.imageUrl?.trim() ? form.imageUrl.trim() : null,
    };
    saveMutation.mutate({ payload, imageFile: selectedImageFile });
  }

  function setPickedImage(file) {
    if (!file) return;
    const okType = ["image/jpeg", "image/jpg", "image/png"].includes(file.type);
    if (!okType) {
      setError("Format image non supporte (jpg, jpeg, png)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(String(reader.result || ""));
      setSelectedImageFile(file);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function clearImageSelection() {
    setSelectedImageFile(null);
    setImagePreview("");
    setForm((f) => ({ ...f, imageUrl: "" }));
  }

  const editorImagePreview =
    imagePreview || (form.imageUrl?.trim() ? resolveArticleImageUrl(form.imageUrl) : "");

  if (isClient) {
    return (
      <ClientCatalog
        items={data?.items || []}
        search={search}
        setSearch={(v) => {
          setSearch(v);
          setClientPage(1);
        }}
        isLoading={isLoading}
        serverPagination={{
          page: data?.page || clientPage,
          pages: data?.pages || 1,
          total: data?.total || 0,
          onPageChange: setClientPage,
        }}
      />
    );
  }

  return (
    <div className={`${pageShellClass} mx-auto max-w-7xl p-6 lg:p-8`}>
      <style>{`${ARTICLES_ANIMATIONS_STYLE}${ARTICLES_TABLE_UI_CSS}`}</style>

      <ArticlePageHeader
        canWrite={canWrite}
        onImport={handleImporter}
        onCreate={handleCreateProduct}
        importPending={importPending}
        stats={articleKpis}
        statsLoading={isLoading}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
      >
        <ArticleKpiCards stats={articleKpis} />
      </motion.div>

      <ArticleRefNavTabs />

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => onImportFileSelected(e.target.files?.[0])}
      />

      {importResult && (
        <div className="animate-fadeUp rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-[#1a1d27]/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              Résultat import —{" "}
              <span className="text-emerald-600 dark:text-emerald-400">{importResult.success ?? 0} succès</span>
              {importResult.failed > 0 && (
                <>
                  {" · "}
                  <span className="text-red-600 dark:text-red-400">{importResult.failed} échec(s)</span>
                </>
              )}
            </p>
            {importResult.failed > 0 && (
              <button
                type="button"
                onClick={() => setShowImportErrors((v) => !v)}
                className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400"
              >
                {showImportErrors ? "Masquer les erreurs" : "Voir les erreurs"}
              </button>
            )}
          </div>
          {importResult.entitesCreees && (
            <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {[
                ["fournisseurs", "Fournisseurs créés"],
                ["marques", "Marques créées"],
                ["familles", "Familles créées"],
                ["sousFamilles", "Sous-familles créées"],
                ["emplacements", "Emplacements créés"],
              ].map(([key, label]) => {
                const items = importResult.entitesCreees[key];
                if (!Array.isArray(items) || items.length === 0) return null;
                return (
                  <p key={key}>
                    {label} : <span className="font-medium text-slate-800 dark:text-slate-200">{items.join(", ")}</span>
                  </p>
                );
              })}
            </div>
          )}
          {showImportErrors && Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-red-200/60 bg-red-50/80 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {importResult.errors.map((err) => (
                <li key={`${err.line}-${err.message}`}>
                  Ligne {err.line} : {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {(marquesError || fournisseursError) && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
          Impossible de charger certaines listes (marques/fournisseurs) :{" "}
          {formatErr(marquesError || fournisseursError)}
        </p>
      )}

      <ArticleFiltersBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        statut={statut}
        onStatutChange={setStatut}
        filterMarqueOptions={filterMarqueOptions}
        filterFamilleOptions={filterFamilleOptions}
        filterSousFamilleOptions={filterSousFamilleOptions}
        filterFournisseurOptions={filterFournisseurOptions}
      />

      {canWrite && showForm && (
        <ArticleEditorModal
          open={showForm}
          onClose={closeForm}
          editing={Boolean(editing)}
          formStep={formStep}
          setFormStep={setFormStep}
          formCode={form.code}
          formLabel={form.libelle}
          margin={margin}
          error={error}
          fieldErrors={modalFieldErrors}
          onPrev={() => (formStep > 0 ? setFormStep((s) => s - 1) : closeForm())}
          onNext={handleNext}
          onSubmit={submit}
          savePending={saveMutation.isPending}
          submitSuccess={submitSuccess}
          submitDisabled={!articleFormValid}
        >
          <form id="article-editor-product-form" onSubmit={submit} className="px-5 py-4 sm:px-6 sm:py-5">
                    {/* STEP 0 — Informations de base */}
                    <div
                      className={formStep === 0 ? "block" : "hidden"}
                      style={{ animation: formStep === 0 ? "wizardStepIn 200ms ease forwards" : undefined }}
                    >
                      <div className="space-y-4">
                        <EditorSectionHeader
                          icon={Info}
                          title="Identité de l'article"
                          subtitle="Ces informations identifient l'article partout dans l'application (factures, bons de commande, étiquettes)"
                          accent={WIZARD_ACCENT.infos}
                        />
                        <WizardGroupCard accent={WIZARD_ACCENT.infos} delay={0}>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={`${wizardLabelClass} inline-flex items-center`}>
                              Code article
                              <FieldHelp text="Référence unique utilisée sur les documents et les étiquettes" />
                            </label>
                            <SuggestedCodeInput
                              value={form.code}
                              locked={Boolean(editing)}
                              codeError={codeError}
                              onClearError={() => setCodeError("")}
                              onRegenerate={!editing ? regenerateCode : undefined}
                              onChange={(v) => {
                                setCodeError("");
                                setForm((f) => ({ ...f, code: v }));
                                clearError("code");
                                setCodePulsing(true);
                                setTimeout(() => setCodePulsing(false), 600);
                              }}
                              onFieldBlur={() => validateField("code")}
                              placeholder="ART-001"
                              className={codePulsing ? "animate-[pulseAccent_0.6s_ease]" : ""}
                              inputClassName={`w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 font-mono text-sm font-medium text-[#0f172a] outline-none transition-opacity duration-150 dark:border-white/10 dark:bg-white/[0.03] dark:text-white ${
                                codeFading ? "opacity-30" : "opacity-100"
                              } ${errors.code ? INPUT_ERROR_CLASS : ""}`}
                            />
                            <FormFieldError message={errors.code} />
                            {!editing ? (
                              <p className={wizardHintClass}>
                                Suggestion auto — modifiable avant enregistrement
                              </p>
                            ) : (
                              <p className={wizardHintClass}>Code existant (lecture seule)</p>
                            )}
                          </div>
                          <div>
                            <label className={`${wizardLabelClass} inline-flex items-center`}>
                              Unité
                              <FieldHelp text="Unité dans laquelle le stock et les ventes sont exprimés" />
                            </label>
                            <input
                              value={form.unite}
                              onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))}
                              placeholder="Ex: UN, KG, L, BOITE"
                              className={wizardInputClass}
                            />
                            <p className={wizardHintClass}>
                              Unité de vente et de stock (ex: unité, kilogramme, litre)
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className={`${wizardLabelClass} inline-flex items-center`}>
                            Libellé <span className="text-red-500 dark:text-red-400">*</span>
                            <FieldHelp text="Nom affiché sur les factures, bons de commande et le catalogue" />
                          </label>
                          <input
                            required
                            value={form.libelle}
                            onChange={(e) => {
                              setForm((f) => ({ ...f, libelle: e.target.value }));
                              clearError("libelle");
                            }}
                            onBlur={() => validateField("libelle")}
                            placeholder="Désignation complète du produit"
                            className={`${wizardInputClass} ${errors.libelle ? INPUT_ERROR_CLASS : ""}`}
                          />
                          <FormFieldError message={errors.libelle} />
                          <p className={wizardHintClass}>Nom commercial tel qu&apos;il apparaîtra partout dans Stokify</p>
                        </div>
                        <div>
                          <FormSelect
                            label="Marque"
                            value={form.marqueId}
                            onChange={(v) => setForm((f) => ({ ...f, marqueId: v }))}
                            placeholder="Marque (optionnel)"
                            options={marquesOptions.map((m) => ({
                              value: m.id,
                              label: `${m.code} — ${m.nom}`,
                            }))}
                            help="Facultatif — utile pour filtrer le catalogue et les rapports"
                          />
                        </div>
                        <div className="flex items-start gap-3 rounded-xl border border-[#e2e8f0] bg-white px-3 py-3 dark:border-white/15 dark:bg-white/[0.07]">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={form.actif}
                            onClick={() => setForm((f) => ({ ...f, actif: !f.actif }))}
                            className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                              form.actif
                                ? "bg-[#378ADD]"
                                : "bg-[#e2e8f0] dark:bg-white/20"
                            }`}
                          >
                            <span
                              className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                              style={{ transform: form.actif ? "translateX(16px)" : "translateX(0)" }}
                            />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-[#0f172a] dark:text-white">Article actif</p>
                            <p className={wizardHintClass}>
                              Un article inactif n&apos;apparaît plus dans les ventes ni les achats, mais reste
                              consultable dans l&apos;historique
                            </p>
                          </div>
                        </div>
                        </WizardGroupCard>
                      </div>
                    </div>

                    {/* STEP 1 — Classification & stockage */}
                    <div
                      className={formStep === 1 ? "block" : "hidden"}
                      style={{ animation: formStep === 1 ? "wizardStepIn 200ms ease forwards" : undefined }}
                    >
                      <div className="space-y-4">
                        <EditorSectionHeader
                          icon={FolderTree}
                          title="Classification & stockage"
                          subtitle="Classez l'article, rattachez un fournisseur et choisissez où il sera stocké"
                          accent={WIZARD_ACCENT.classif}
                        />
                        <WizardGroupCard accent={WIZARD_ACCENT.classif} delay={50}>
                          <WizardCardHeading
                            icon={Layers}
                            title="Catégorie produit"
                            subtitle="Famille et sous-famille utilisées pour les filtres, rapports et le catalogue"
                            accent={WIZARD_ACCENT.classif}
                          />
                          {(form.familleId || form.sousFamilleId) ? (
                            <div
                              className="flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                              style={{ background: `${WIZARD_ACCENT.classif}12`, color: WIZARD_ACCENT.classif }}
                            >
                              <span>
                                {famillesOptions.find((f) => String(f.id) === String(form.familleId))?.nom ||
                                  famillesOptions.find((f) => String(f.id) === String(form.familleId))?.code ||
                                  "Famille"}
                              </span>
                              <ChevronRight className="h-3 w-3 opacity-70" />
                              <span className={form.sousFamilleId ? "" : "opacity-50"}>
                                {form.sousFamilleId
                                  ? sousFamillesOptions.find((sf) => String(sf.id) === String(form.sousFamilleId))?.nom ||
                                    sousFamillesOptions.find((sf) => String(sf.id) === String(form.sousFamilleId))?.code
                                  : "Sous-famille"}
                              </span>
                            </div>
                          ) : null}
                          <FormSelect
                            label="Famille"
                            required
                            value={form.familleId}
                            onChange={(v) => {
                              setForm((f) => ({
                                ...f,
                                familleId: v,
                                sousFamilleId: "",
                              }));
                              clearError("familleId");
                              clearError("sousFamilleId");
                            }}
                            onBlur={() => validateField("familleId")}
                            error={errors.familleId}
                            placeholder="Choisir une famille"
                            options={famillesOptions.map((f) => ({
                              value: f.id,
                              label: `${f.code} — ${f.nom}`,
                            }))}
                            help="Regroupe les articles similaires (ex: Boissons, Cosmétiques)"
                            hint="Obligatoire — sert de base aux analyses et au catalogue"
                          />
                          {famillesOptions.length === 0 ? (
                            <EmptyRefHint
                              message="Aucune famille n'existe encore."
                              actionLabel="Créer une famille"
                              onAction={() => navigate("/familles")}
                            />
                          ) : null}
                          <FormSelect
                            label="Sous-famille"
                            required
                            value={form.sousFamilleId}
                            onChange={(v) => {
                              setForm((f) => ({ ...f, sousFamilleId: v }));
                              clearError("sousFamilleId");
                            }}
                            onBlur={() => validateField("sousFamilleId")}
                            error={errors.sousFamilleId}
                            placeholder={
                              form.familleId ? "Choisir une sous-famille" : "Sélectionnez d'abord une famille"
                            }
                            disabled={!form.familleId}
                            options={sousFamillesOptions.map((sf) => ({
                              value: sf.id,
                              label: `${sf.code} — ${sf.nom}`,
                            }))}
                            help="Précise la catégorie au sein de la famille choisie"
                          />
                          {form.familleId && sousFamillesOptions.length === 0 ? (
                            <EmptyRefHint
                              message="Cette famille n'a pas encore de sous-famille."
                              actionLabel="Créer une sous-famille"
                              onAction={() => navigate("/familles")}
                            />
                          ) : null}
                        </WizardGroupCard>
                        <WizardGroupCard accent={WIZARD_ACCENT.classif} delay={120}>
                          <WizardCardHeading
                            icon={Truck}
                            title="Fournisseur"
                            subtitle="Partenaire habituel pour réapprovisionner cet article"
                            accent={WIZARD_ACCENT.classif}
                          />
                          <FormSelect
                            label="Fournisseur"
                            required
                            value={form.fournisseurId}
                            onChange={(v) => {
                              setForm((f) => ({ ...f, fournisseurId: v }));
                              clearError("fournisseurId");
                            }}
                            onBlur={() => validateField("fournisseurId")}
                            error={errors.fournisseurId}
                            placeholder="Choisir un fournisseur"
                            options={fournisseursOptions.map((fr) => ({
                              value: fr.id,
                              label: [fr.code, fr.nom].filter(Boolean).join(" — ") || `Fournisseur #${fr.id}`,
                            }))}
                            help="Fournisseur par défaut proposé lors d'un nouvel achat"
                            hint="Obligatoire — peut être changé au moment de la commande"
                          />
                          {fournisseursOptions.length === 0 ? (
                            <EmptyRefHint
                              message="Aucun fournisseur n'est encore enregistré."
                              actionLabel="Créer un fournisseur"
                              onAction={() => navigate("/fournisseurs")}
                            />
                          ) : null}
                        </WizardGroupCard>
                        <WizardGroupCard accent={WIZARD_ACCENT.classif} delay={190}>
                          <WizardCardHeading
                            icon={Warehouse}
                            title="Emplacement de stockage"
                            subtitle="Dépôt et emplacement où l'article sera rangé"
                            accent={WIZARD_ACCENT.classif}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormSelect
                              label="Dépôt"
                              required
                              value={form.depotId}
                              onChange={(v) => {
                                setForm((f) => ({
                                  ...f,
                                  depotId: v,
                                  emplacementId: "",
                                }));
                                clearError("depotId");
                                clearError("emplacementId");
                              }}
                              onBlur={() => validateField("depotId")}
                              error={errors.depotId}
                              placeholder="Choisir un dépôt"
                              options={depotsOptions.map((d) => ({
                                value: d.id,
                                label: `${d.code} — ${d.libelle}`,
                              }))}
                              help="Entrepôt physique qui accueille le stock"
                            />
                            <FormSelect
                              label="Emplacement"
                              required
                              value={form.emplacementId}
                              onChange={(v) => {
                                setForm((f) => ({ ...f, emplacementId: v }));
                                clearError("emplacementId");
                              }}
                              onBlur={() => validateField("emplacementId")}
                              error={errors.emplacementId}
                              placeholder={
                                form.depotId ? "Choisir un emplacement" : "Sélectionnez d'abord un dépôt"
                              }
                              disabled={!form.depotId}
                              options={emplacementsOptions.map((em) => ({
                                value: em.id,
                                label: `${em.code} — ${em.libelle}`,
                              }))}
                              help="Allée, rack ou casier précis dans le dépôt"
                            />
                          </div>
                          {depotsOptions.length === 0 ? (
                            <EmptyRefHint
                              message="Aucun dépôt n'existe encore."
                              actionLabel="Créer un dépôt"
                              onAction={() => navigate("/depots")}
                            />
                          ) : form.depotId && emplacementsOptions.length === 0 ? (
                            <EmptyRefHint
                              message="Ce dépôt n'a pas encore d'emplacement."
                              actionLabel="Créer un emplacement"
                              onAction={() => navigate("/depots")}
                            />
                          ) : (
                            <p className={wizardHintClass}>L'emplacement est proposé par défaut à la réception.</p>
                          )}
                        </WizardGroupCard>
                        <WizardGroupCard accent={WIZARD_ACCENT.classif} delay={260}>
                          <label className={`${wizardLabelClass} flex items-center gap-1.5`}>
                            <Tag className="h-3.5 w-3.5 text-[#378ADD]" />
                            Traçabilité
                            <FieldHelp text="Lot, numéro de série, ou les deux créés ensemble à la réception" />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {MODE_TRACAGE_OPTIONS.map((opt) => {
                              const Icon = opt.Icon;
                              const selected = form.modeTracage === opt.value;
                              const lockedOut = tracageGuard.locked && !selected;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={lockedOut}
                                  title={
                                    lockedOut
                                      ? "Impossible de changer le mode : des lots ou numéros de série actifs existent encore"
                                      : undefined
                                  }
                                  onClick={() => {
                                    if (opt.value === form.modeTracage) return;
                                    if (
                                      opt.value === "AUCUN" &&
                                      form.modeTracage !== "AUCUN" &&
                                      tracageGuard.hasHistory
                                    ) {
                                      const ok = window.confirm(
                                        "Cet article a déjà un historique de lots ou de numéros de série. Passer en « Aucun » n'efface pas l'historique, mais les prochaines réceptions et ventes ne seront plus tracées. Continuer ?"
                                      );
                                      if (!ok) return;
                                    }
                                    setForm((f) => ({
                                      ...f,
                                      modeTracage: opt.value,
                                      tracageAuto:
                                        opt.value === "AUCUN" ? false : opt.value === "LOT_SERIE" ? true : f.tracageAuto,
                                      strategieSortie:
                                        opt.value !== "AUCUN" && f.strategieSortie === "STANDARD"
                                          ? "FIFO"
                                          : f.strategieSortie,
                                    }));
                                  }}
                                  className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
                                    lockedOut ? "cursor-not-allowed opacity-45" : ""
                                  } ${
                                    selected
                                      ? "scale-[1.02]"
                                      : "scale-100 border-[#e2e8f0] bg-white dark:border-white/10 dark:bg-transparent"
                                  }`}
                                  style={
                                    selected
                                      ? { borderColor: opt.color, background: `${opt.color}12` }
                                      : undefined
                                  }
                                >
                                  <Icon
                                    className={`h-4 w-4 ${selected ? "" : "text-[#94a3b8] dark:text-white/55"}`}
                                    style={selected ? { color: opt.color } : undefined}
                                  />
                                  <span
                                    className={`text-xs font-medium ${selected ? "" : "text-[#0f172a] dark:text-white/90"}`}
                                    style={selected ? { color: opt.color } : undefined}
                                  >
                                    {opt.label}
                                  </span>
                                  <span className="text-[11px] leading-tight text-[#94a3b8] dark:text-white/55">
                                    {opt.desc}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          <AnimatePresence initial={false}>
                            {form.modeTracage !== "AUCUN" ? (
                              <motion.div
                                key="tracage-details"
                                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    {TRACAGE_AUTO_OPTIONS.map((opt) => {
                                      const Icon = opt.Icon;
                                      const selected = Boolean(form.tracageAuto) === opt.value;
                                      return (
                                        <button
                                          key={String(opt.value)}
                                          type="button"
                                          onClick={() => setForm((f) => ({ ...f, tracageAuto: opt.value }))}
                                          className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
                                            selected
                                              ? "scale-[1.02]"
                                              : "scale-100 border-[#e2e8f0] bg-white dark:border-white/10 dark:bg-transparent"
                                          }`}
                                          style={
                                            selected
                                              ? { borderColor: opt.color, background: `${opt.color}12` }
                                              : undefined
                                          }
                                        >
                                          <Icon
                                            className={`h-4 w-4 ${selected ? "" : "text-[#94a3b8] dark:text-white/55"}`}
                                            style={selected ? { color: opt.color } : undefined}
                                          />
                                          <span
                                            className={`text-xs font-medium ${selected ? "" : "text-[#0f172a] dark:text-white/90"}`}
                                            style={selected ? { color: opt.color } : undefined}
                                          >
                                            {opt.label}
                                          </span>
                                          <span className="text-[11px] leading-tight text-[#94a3b8] dark:text-white/55">
                                            {opt.desc}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div>
                                    <label className={`${wizardLabelClass} flex items-center gap-1.5`}>
                                      Stratégie de sortie de stock{" "}
                                      <span className="text-red-500 dark:text-red-400">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {STRATEGIE_OPTIONS.filter((opt) => opt.value !== "STANDARD").map((opt) => {
                                        const Icon = opt.Icon;
                                        const selected = form.strategieSortie === opt.value;
                                        const isSuggested =
                                          opt.value === suggestedStrategie && !userTouchedStrategie;
                                        return (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                              setUserTouchedStrategie(true);
                                              setForm((f) => ({ ...f, strategieSortie: opt.value }));
                                            }}
                                            className={`relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200 ${
                                              selected
                                                ? "scale-[1.02]"
                                                : "scale-100 border-[#e2e8f0] bg-white dark:border-white/10 dark:bg-transparent"
                                            }`}
                                            style={
                                              selected
                                                ? { borderColor: opt.color, background: `${opt.color}12` }
                                                : undefined
                                            }
                                          >
                                            {isSuggested ? (
                                              <span
                                                className="absolute -top-1.5 -right-1.5 rounded-full bg-[#378ADD] px-1.5 py-0.5 text-[8px] font-medium text-white"
                                                style={{ animation: "popIn 0.3s ease" }}
                                              >
                                                Suggéré
                                              </span>
                                            ) : null}
                                            <Icon
                                              className={`h-4 w-4 ${selected ? "" : "text-[#94a3b8] dark:text-white/55"}`}
                                              style={selected ? { color: opt.color } : undefined}
                                            />
                                            <span
                                              className={`text-xs font-medium ${selected ? "" : "text-[#0f172a] dark:text-white/90"}`}
                                              style={selected ? { color: opt.color } : undefined}
                                            >
                                              {opt.label}
                                            </span>
                                            <span className="text-[11px] leading-tight text-[#94a3b8] dark:text-white/55">
                                              {opt.desc}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <p className={wizardHintClass}>
                                      Détermine quel lot ou numéro de série est consommé en priorité lors d&apos;une
                                      vente. Cette règle s&apos;applique automatiquement à chaque vente future.
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>
                          {form.modeTracage === "AUCUN" ? (
                            <p className={wizardHintClass}>
                              Sans traçabilité, les réceptions et ventes déplacent uniquement le stock agrégé.
                            </p>
                          ) : null}
                          {form.modeTracage === "LOT_SERIE" && form.tracageAuto ? (
                            <p className={wizardHintClass}>
                              À chaque réception, Stokify crée un numéro de lot et un numéro de série par unité, liés
                              ensemble.
                            </p>
                          ) : null}
                          {tracageGuard.locked ? (
                            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                              Mode verrouillé : des lots ou n° de série actifs existent encore.
                            </p>
                          ) : null}
                        </WizardGroupCard>
                        <WizardGroupCard accent={WIZARD_ACCENT.classif} delay={330}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-white/55">
                            Récapitulatif de l&apos;étape
                          </p>
                          <div className="space-y-1.5 text-xs">
                            <SummaryRow
                              label="Catégorie"
                              value={`${
                                famillesOptions.find((f) => String(f.id) === String(form.familleId))?.nom ||
                                famillesOptions.find((f) => String(f.id) === String(form.familleId))?.code ||
                                "—"
                              } → ${
                                sousFamillesOptions.find((sf) => String(sf.id) === String(form.sousFamilleId))?.nom ||
                                sousFamillesOptions.find((sf) => String(sf.id) === String(form.sousFamilleId))?.code ||
                                "—"
                              }`}
                            />
                            <SummaryRow
                              label="Fournisseur"
                              value={
                                (() => {
                                  const fr = fournisseursOptions.find((f) => String(f.id) === String(form.fournisseurId));
                                  return fr ? [fr.code, fr.nom].filter(Boolean).join(" — ") : "—";
                                })()
                              }
                            />
                            <SummaryRow
                              label="Stockage"
                              value={
                                (() => {
                                  const d = depotsOptions.find((x) => String(x.id) === String(form.depotId));
                                  const e = emplacementsOptions.find((x) => String(x.id) === String(form.emplacementId));
                                  if (!d && !e) return "—";
                                  return [d ? `${d.code} — ${d.libelle}` : null, e ? `${e.code} — ${e.libelle}` : null]
                                    .filter(Boolean)
                                    .join(" · ");
                                })()
                              }
                            />
                            <SummaryRow
                              label="Traçabilité"
                              value={
                                form.modeTracage === "AUCUN"
                                  ? "Aucun"
                                  : `${
                                      form.modeTracage === "LOT_SERIE"
                                        ? "Lot + n° de série"
                                        : form.modeTracage === "SERIE"
                                          ? "N° de série"
                                          : "Lot"
                                    } · ${form.tracageAuto ? "Auto" : "Manuel"}`
                              }
                            />
                          </div>
                        </WizardGroupCard>
                      </div>
                    </div>

                    {/* STEP 2 — Prix & stock */}
                    <div
                      className={formStep === 2 ? "block" : "hidden"}
                      style={{ animation: formStep === 2 ? "wizardStepIn 200ms ease forwards" : undefined }}
                    >
                      <div className="space-y-4">
                        <EditorSectionHeader
                          icon={Coins}
                          title="Prix & stock"
                          subtitle="Seuils, contraintes de stockage et tarification de l'article"
                          accent={WIZARD_ACCENT.prix}
                        />
                        <WizardGroupCard accent={WIZARD_ACCENT.prix} delay={0}>
                          <WizardCardHeading
                            icon={Package}
                            title="Seuils de stock"
                            subtitle="Définit quand réapprovisionner et à partir de quand alerter"
                            accent={WIZARD_ACCENT.prix}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={`${wizardLabelClass} inline-flex items-center`}>
                                Stock minimum
                                <FieldHelp text="Niveau à partir duquel un réapprovisionnement est recommandé" />
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={form.stockMin}
                                onChange={(e) => {
                                  setForm((f) => ({ ...f, stockMin: e.target.value }));
                                  clearError("stockMin");
                                }}
                                onBlur={() => validateField("stockMin")}
                                placeholder="0"
                                className={`${wizardInputClass} ${errors.stockMin ? INPUT_ERROR_CLASS : ""}`}
                              />
                              <FormFieldError message={errors.stockMin} />
                            </div>
                            <div>
                              <label className={`${wizardLabelClass} inline-flex items-center`}>
                                Stock maximum
                                <FieldHelp text="Capacité cible pour éviter le surstockage" />
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={form.stockMax}
                                onChange={(e) => {
                                  setForm((f) => ({ ...f, stockMax: e.target.value }));
                                  clearError("stockMax");
                                }}
                                onBlur={() => validateField("stockMax")}
                                placeholder="0"
                                className={`${wizardInputClass} ${errors.stockMax ? INPUT_ERROR_CLASS : ""}`}
                              />
                              <FormFieldError message={errors.stockMax} />
                            </div>
                          </div>
                          <p className={wizardHintClass}>
                            Stock minimum = seuil de réapprovisionnement recommandé. Stock maximum = capacité cible pour
                            éviter le surstockage.
                          </p>
                          <div>
                            <label className={`${wizardLabelClass} inline-flex items-center`}>
                              Seuil d&apos;alerte personnalisé
                              <FieldHelp text="Si vide, le stock minimum sert de seuil d'alerte" />
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={form.seuilAlerte}
                              onChange={(e) => setForm((f) => ({ ...f, seuilAlerte: e.target.value }))}
                              placeholder="Par défaut: stockMin"
                              className={wizardInputClass}
                            />
                            <p className={wizardHintClass}>
                              Laissez vide pour utiliser le Stock minimum comme seuil d&apos;alerte par défaut
                            </p>
                          </div>
                        </WizardGroupCard>

                        <WizardGroupCard accent={WIZARD_ACCENT.prix} delay={100}>
                          <WizardCardHeading
                            icon={Thermometer}
                            title="Conditions de stockage"
                            subtitle="Contraintes physiques à respecter pour cet article"
                            accent={WIZARD_ACCENT.prix}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={wizardLabelClass}>Temp. min (°C)</label>
                              <input
                                type="number"
                                value={form.temperatureMin}
                                onChange={(e) => setForm((f) => ({ ...f, temperatureMin: e.target.value }))}
                                className={wizardInputClass}
                              />
                            </div>
                            <div>
                              <label className={wizardLabelClass}>Temp. max (°C)</label>
                              <input
                                type="number"
                                value={form.temperatureMax}
                                onChange={(e) => setForm((f) => ({ ...f, temperatureMax: e.target.value }))}
                                className={wizardInputClass}
                              />
                            </div>
                          </div>
                          <p className={wizardHintClass}>
                            Laissez vide si l&apos;article ne nécessite pas de contrôle de température
                          </p>
                          <label className="flex items-center gap-2 text-sm text-[#64748b] dark:text-slate-300">
                            <input
                              type="checkbox"
                              className="accent-violet-600"
                              checked={form.fragile}
                              onChange={(e) => setForm((f) => ({ ...f, fragile: e.target.checked }))}
                            />
                            Fragile
                            {form.fragile ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : null}
                          </label>
                          <label className="flex items-center gap-2 text-sm text-[#64748b] dark:text-slate-300">
                            <input
                              type="checkbox"
                              className="accent-violet-600"
                              checked={form.dangereuxChimique}
                              onChange={(e) => setForm((f) => ({ ...f, dangereuxChimique: e.target.checked }))}
                            />
                            Produit chimique dangereux
                            {form.dangereuxChimique ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : null}
                          </label>
                        </WizardGroupCard>

                        <WizardGroupCard accent={WIZARD_ACCENT.prix} delay={200}>
                          <WizardCardHeading
                            icon={Weight}
                            title="Poids, volume & tarification"
                            subtitle="Dimensions unitaires puis prix de vente"
                            accent={WIZARD_ACCENT.prix}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={wizardLabelClass}>Poids unitaire (kg)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={form.poids}
                                onChange={(e) => setForm((f) => ({ ...f, poids: e.target.value }))}
                                placeholder="Ex: 0.250"
                                className={wizardInputClass}
                              />
                            </div>
                            <div>
                              <label className={wizardLabelClass}>Volume unitaire (m³)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={form.volume}
                                onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))}
                                placeholder="Ex: 0.002"
                                className={wizardInputClass}
                              />
                            </div>
                          </div>
                          <p className={wizardHintClass}>
                            Utilisés pour le calcul de capacité dépôt et l&apos;optimisation du chargement véhicule
                          </p>
                          <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-[#64748b] dark:text-white/55">
                            Tarification
                          </p>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className={`${wizardLabelClass} inline-flex items-center`}>
                                Prix achat HT <span className="text-red-500 dark:text-red-400">*</span>
                                <FieldHelp text="Coût d'achat hors taxes, base de calcul de la marge" />
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={form.prixAchat}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setForm((p) => ({ ...p, prixAchat: v }));
                                    clearError("prixAchat");
                                  }}
                                  onBlur={() => validateField("prixAchat")}
                                  placeholder="0.000"
                                  className={`${wizardInputClass} pr-14 ${errors.prixAchat ? INPUT_ERROR_CLASS : ""}`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#94a3b8] dark:text-white/30">
                                  TND
                                </span>
                              </div>
                              <FormFieldError message={errors.prixAchat} />
                            </div>

                            <div>
                              <label className={`${wizardLabelClass} inline-flex items-center`}>
                                Prix vente HT <span className="text-red-500 dark:text-red-400">*</span>
                                <FieldHelp text="Prix de vente hors taxes facturé au client" />
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={form.prixVente}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setForm((p) => ({ ...p, prixVente: v }));
                                    clearError("prixVente");
                                  }}
                                  onBlur={() => validateField("prixVente")}
                                  placeholder="0.000"
                                  className={`${wizardInputClass} pr-14 ${errors.prixVente ? INPUT_ERROR_CLASS : ""} ${
                                    margin != null && Number(margin) < 0
                                      ? "!border-red-400 shadow-[0_0_0_3px_rgba(226,75,74,0.12)]"
                                      : ""
                                  }`}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#94a3b8] dark:text-white/30">
                                  TND
                                </span>
                              </div>
                              {margin != null && (
                                <span
                                  className={`mt-1 block text-[11px] ${
                                    Number(margin) >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-red-600 dark:text-red-300"
                                  }`}
                                >
                                  {Number(margin) >= 0 ? "↑" : "↓"} Marge : {margin}%
                                </span>
                              )}
                              <FormFieldError message={errors.prixVente} />
                            </div>

                            <div>
                              <FormSelect
                                label="Taux de TVA"
                                value={form.tauxTva ?? 19}
                                onChange={(v) => {
                                  setForm((f) => ({ ...f, tauxTva: Number(v) }));
                                  clearError("tauxTva");
                                }}
                                onBlur={() => validateField("tauxTva")}
                                error={errors.tauxTva}
                                placeholder="Choisir un taux de TVA"
                                options={TVA_OPTIONS}
                                help="Taux appliqué sur les lignes d'achat et de vente"
                              />
                            </div>

                            <div className={`sm:col-span-1 ${editing ? "opacity-50" : ""}`}>
                              <label className={`${wizardLabelClass} inline-flex items-center`}>
                                Quantité initiale
                                <FieldHelp text="Stock de départ à la création de la fiche" />
                              </label>
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  type="button"
                                  disabled={Boolean(editing)}
                                  onClick={() =>
                                    setForm((p) => ({
                                      ...p,
                                      quantiteInitiale: Math.max(0, (p.quantiteInitiale || 0) - 1),
                                    }))
                                  }
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] transition-all duration-100 hover:border-[#378ADD] hover:bg-[#f3f8fd] hover:text-[#378ADD] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-transparent dark:bg-[var(--color-background-secondary)] dark:text-white/60 dark:hover:bg-[color-mix(in_srgb,var(--accent-500)_15%,transparent)] dark:hover:text-[var(--accent-500)]"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={Boolean(editing)}
                                  value={form.quantiteInitiale}
                                  onChange={(e) =>
                                    setForm((p) => ({
                                      ...p,
                                      quantiteInitiale: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                                    }))
                                  }
                                  className="w-20 border-0 bg-transparent py-2 text-center text-lg font-bold text-[#0f172a] outline-none disabled:cursor-not-allowed dark:text-white"
                                />
                                <button
                                  type="button"
                                  disabled={Boolean(editing)}
                                  onClick={() =>
                                    setForm((p) => ({
                                      ...p,
                                      quantiteInitiale: (p.quantiteInitiale || 0) + 1,
                                    }))
                                  }
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] text-[#64748b] transition-all duration-100 hover:border-[#378ADD] hover:bg-[#f3f8fd] hover:text-[#378ADD] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-transparent dark:bg-[var(--color-background-secondary)] dark:text-white/60 dark:hover:bg-[color-mix(in_srgb,var(--accent-500)_15%,transparent)] dark:hover:text-[var(--accent-500)]"
                                >
                                  +
                                </button>
                              </div>
                              {Boolean(editing) ? (
                                <span className="mt-2 flex items-center justify-center gap-1 text-[10px] text-[#94a3b8] dark:text-white/35">
                                  <Lock className="h-3 w-3" aria-hidden="true" />
                                  Lecture seule : la quantité se gère par le stock
                                </span>
                              ) : (
                                <p className={wizardHintClass}>
                                  Quantité en stock à la création. Les mouvements suivants se gèrent ensuite via
                                  Achats/Ventes.
                                </p>
                              )}
                            </div>
                          </div>
                        </WizardGroupCard>
                      </div>
                    </div>

                    {/* STEP 3 — Photo & Récapitulatif */}
                    <div
                      className={formStep === 3 ? "block" : "hidden"}
                      style={{ animation: formStep === 3 ? "wizardStepIn 200ms ease forwards" : undefined }}
                    >
                      <div>
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div>
                          <EditorSectionHeader
                            icon={Camera}
                            title="Photo & Récapitulatif"
                            subtitle="Photo facultative — vous pouvez créer l'article sans image"
                            accent={WIZARD_ACCENT.photo}
                          />
                          <ArticleImagePicker
                            fileInputRef={articleImageInputRef}
                            inputId="article-image-input-step3"
                            previewSrc={editorImagePreview}
                            isDragging={isDraggingImage}
                            onDragState={setIsDraggingImage}
                            onPickFile={setPickedImage}
                            onClear={clearImageSelection}
                            full
                            optional
                          />
                        </div>
                        <div className="min-h-0">
                          <ArticleWizardSummary
                            form={form}
                            editing={editing}
                            editorImagePreview={editorImagePreview}
                            marquesOptions={marquesOptions}
                            famillesOptions={famillesOptions}
                            sousFamillesOptions={sousFamillesOptions}
                            fournisseursOptions={fournisseursOptions}
                            depotsOptions={depotsOptions}
                            emplacementsOptions={emplacementsOptions}
                            onJumpToStep={setFormStep}
                          />
                        </div>
                      </div>
                      </div>
                    </div>
          </form>
        </ArticleEditorModal>
      )}

      <div className={tableShellClass}>
        <ArticleTableToolbar
          isAllPageSelected={isAllPageSelected}
          onToggleSelectAll={toggleSelectAllPage}
          selectedCount={selectedIds.length}
          canDeletePermanent={canDeletePermanent}
          onBulkDelete={() => {
            if (window.confirm("Supprimer les produits selectionnes ?")) {
              bulkDeleteMutation.mutate(selectedIds);
            }
          }}
          bulkDeletePending={bulkDeleteMutation.isPending}
          onExportExcel={exportArticlesExcel}
          excelExportPending={excelExportPending}
          filteredCount={filteredItems.length}
          totalCount={apiTotal}
          hasActiveFilters={hasActiveCriteria}
          onExportPdf={exportCatalogPdf}
          pdfExportPending={pdfExportPending}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          checkboxClass={checkboxClass}
        />

        {isLoading ? (
          <ArticleTableSkeleton />
        ) : pageItems.length === 0 ? (
          <ArticleEmptyState
            canWrite={canWrite}
            onCreate={handleCreateProduct}
            hasFilters={Boolean(search || statut || Object.values(filters).some(Boolean))}
          />
        ) : viewMode === "list" ? (
          <div className="art-table-wrap overflow-x-auto">
            <table className="min-w-[1180px] w-full border-collapse">
              <ArticleTableColGroup />
              <thead>
                <ArticleTableHeadRow headClass={tableHeadClass} />
              </thead>
              <tbody>
                {pageItems.map((item, idx) => (
                  <ArticleTableRow
                    key={item.id}
                    item={item}
                    index={idx}
                    search={search}
                    selected={selectedIds.includes(item.id)}
                    onToggleSelect={toggleSelectOne}
                    onInlineEdit={handleInlineEdit}
                    onViewDetail={handleViewDetail}
                    formatCurrency={formatCurrency}
                    canWrite={canWrite}
                    canDeletePermanent={canDeletePermanent}
                    userRole={user?.role}
                    setStatutArticle={setStatutArticle}
                    deleteMutation={deleteMutation}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {pageItems.map((item, idx) => (
              <ArticleGridCard
                key={item.id}
                item={item}
                index={idx}
                formatCurrency={formatCurrency}
                stockBadgeClass={getStockBadgeClass(item)}
                canWrite={canWrite}
                canDeletePermanent={canDeletePermanent}
                onViewDetail={handleViewDetail}
                onEdit={handleInlineEdit}
                setStatutArticle={setStatutArticle}
                deleteMutation={deleteMutation}
              />
            ))}
          </div>
        )}

      </div>

      {!isLoading && totalResults > 0 ? (
        <StockPagination
          page={safePage}
          totalPages={totalPages}
          totalResults={totalResults}
          pageSize={pageSize}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          unitLabel="article(s)"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      ) : null}

      <ArticleDetailModal
        articleId={detailArticleId}
        open={detailArticleId != null}
        onClose={handleCloseDetail}
        onEdit={handleEditFromDetail}
        initialListItem={detailListItem}
      />

    </div>
  );
}
