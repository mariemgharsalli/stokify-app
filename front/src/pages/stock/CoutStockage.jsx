import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconAlertCircle,
  IconArrowUp,
  IconBuilding,
  IconBuildingWarehouse,
  IconCalculator,
  IconChartBar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClockPause,
  IconCoin,
  IconDeviceFloppy,
  IconDownload,
  IconFileTypePdf,
  IconLoader2,
  IconLock,
  IconMessage,
  IconPackage,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconRotate,
  IconTrash,
  IconTrendingUp,
  IconX,
} from "@tabler/icons-react";
import {
  CalendarCheck,
  CircleDot,
  Coins,
  ListChecks,
  Package,
  Receipt,
  Repeat,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import GlassPageHeader from "../../components/ui/GlassPageHeader";
import CoutKpiCard from "./components/CoutKpiCard";
import { CoutCardSkeleton, CoutEmptyState, CoutKpiSkeleton, CoutTableRowSkeleton } from "./components/CoutSkeleton";
import ProgressRing, { gravityRingColors } from "./components/ProgressRing";
import {
  AnimatedNumber,
  CostSparkline,
  StackedCostBlock,
  buildSegmentsFromGroupedEntries,
  CATEGORY_COLORS,
} from "./CoutStockageCharts";
import {
  ProfitabilityBreakdown,
  ProfitabilityComparisonBar,
  ProfitabilityVerdict,
} from "./RentabiliteCharts";
import { exportCoutStockagePdf, exportDeadStockCsv, exportDeadStockReportPdf } from "../../utils/stockReports";
import { exportCoutStockageExcel, exportDeadStockReportExcel, exportCsvFromRows } from "../../utils/exportHelpers";
import RotationReportContent from "../../components/reports/RotationReportContent";
import SearchableSelect from "../../components/ui/SearchableSelect";
import FormFieldError, { inputErrorStyle } from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { coutEntrySchema, coutStockageSchema } from "../../validation";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { PRIMARY_BTN_CLASSES, PRIMARY_BTN_SM_CLASSES, primaryButtonStyle, primaryButtonShadowStyle, primaryButtonGradientStyle, STOKIFY_RED_ACTION } from "../../utils/brandStyles";
import "./coutStockage.css";

const INPUT_STYLE = {
  border: "0.5px solid var(--color-border-secondary, var(--border-default))",
  borderRadius: 8,
  padding: "8px 12px",
  background: "var(--color-background-primary, var(--bg-input))",
  color: "var(--text-primary)",
  fontSize: 13,
  width: "100%",
};

const DEVISES = ["TND", "EUR", "USD", "GBP", "MAD"];

const TABS = [
  { id: "unitaires", label: "Coûts unitaires", color: "#7F77DD", Icon: IconReceipt },
  { id: "depot", label: "Coûts dépôt", color: "#378ADD", Icon: IconBuildingWarehouse },
  { id: "dormant", label: "Stock dormant", color: "#BA7517", Icon: IconClockPause },
  { id: "rotation", label: "Taux rotation", color: "#1D9E75", Icon: IconRotate },
  { id: "rentabilite", label: "Rentabilité", color: "#D4537E", Icon: IconTrendingUp },
];

const TAB_ACTIVE_STYLE = {
  unitaires: { bg: "rgba(127,119,221,0.2)", color: "#7F77DD", inset: "rgba(127,119,221,0.4)" },
  depot: { bg: "rgba(55,138,221,0.2)", color: "#378ADD", inset: "rgba(55,138,221,0.4)" },
  dormant: { bg: "rgba(186,117,23,0.2)", color: "#BA7517", inset: "rgba(186,117,23,0.4)" },
  rotation: { bg: "rgba(29,158,117,0.2)", color: "#1D9E75", inset: "rgba(29,158,117,0.4)" },
  rentabilite: { bg: "rgba(212,83,126,0.2)", color: "#D4537E", inset: "rgba(212,83,126,0.4)" },
};

const PRIMARY_BTN = PRIMARY_BTN_CLASSES;

const SECONDARY_BTN =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-150 hover:bg-[var(--bg-hover)] disabled:opacity-50";

const ENTRY_COLORS = ["#1D9E75", "#378ADD", "#7F77DD", "#BA7517", "#D4537E", "#E24B4A", "#888780"];

const SUGGESTED_COST_NAMES = {
  STOCKAGE: ["Loyer", "Assurance", "Maintenance"],
  LOGISTIQUE: ["Transport", "Internet", "Sécurité"],
  MANUTENTION: ["Personnel", "Manutention", "Nettoyage"],
  AUTRE: ["Eau", "Électricité", "Énergie"],
};

const COST_CATEGORIES = [
  { id: "STOCKAGE", label: "Stockage", Icon: Warehouse, color: CATEGORY_COLORS.stockage },
  { id: "LOGISTIQUE", label: "Logistique", Icon: Truck, color: CATEGORY_COLORS.logistique },
  { id: "MANUTENTION", label: "Manutention", Icon: Users, color: CATEGORY_COLORS.manutention },
  { id: "AUTRE", label: "Autre", Icon: CircleDot, color: CATEGORY_COLORS.autre },
];

const ALL_SUGGESTED_NAMES = Object.entries(SUGGESTED_COST_NAMES).flatMap(([cat, names]) =>
  names.map((name) => ({ name, categorie: cat }))
);

const DEAD_DAYS = ["30", "60", "90", "180"];
const DEAD_STOCK_THRESHOLD = 50000;
const UNITAIRES_PAGE_SIZE = 25;
const DEAD_PAGE_SIZE = 12;
const TAB_IDS = TABS.map((t) => t.id);

function useEscapeToClose(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CoutSection({ children, className = "" }) {
  return (
    <div className={`cout-dot-grid relative isolate rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

function CoutDashedSeparator({ className = "my-5" }) {
  return <div className={`cout-dashed-sep ${className}`} role="separator" aria-hidden />;
}

function StockPctBar({ pct, delayIndex = 0 }) {
  const [mounted, setMounted] = useState(false);
  const color = pctBarColor(pct);
  const gradEnd = pct > 30 ? "#2BC492" : pct >= 10 ? "#E8A020" : "#94a3b8";
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-input)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: mounted ? `${Math.min(100, pct)}%` : "0%",
            background: `linear-gradient(90deg, ${color}, ${gradEnd})`,
            transition: `width 0.75s cubic-bezier(0.16, 1, 0.3, 1) ${delayIndex * 25}ms`,
          }}
        />
      </div>
      <span className="text-[11px] tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function manualAppliesToMonth(manual, periodeYm) {
  if (!manual?.periodeDebut || !periodeYm) return false;
  const [y, m] = periodeYm.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
  const start = new Date(manual.periodeDebut);
  const end = manual.periodeFin ? new Date(manual.periodeFin) : null;
  if (start > monthEnd) return false;
  if (end && end < monthStart) return false;
  return true;
}

function asItems(d) {
  if (Array.isArray(d)) return d;
  return d?.items || [];
}

function toIsoStartOfDay(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

function monthStartIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtIsoDateLabel(iso) {
  if (!iso) return "";
  const [y, m, day] = iso.split("-").map(Number);
  if (!y || !m || !day) return "";
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtNum(v) {
  return Number(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtMonthLabel(periode) {
  if (!periode) return "—";
  const [y, m] = periode.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function truncate(str, len = 30) {
  if (!str) return "—";
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

function immobileBadge(jours) {
  if (jours > 90) return { label: "Immobile 90j+", color: "#E24B4A" };
  if (jours >= 60) return { label: "Immobile 60j+", color: "#BA7517" };
  return { label: "Immobile 30j+", color: "#1D9E75" };
}

function formatPeriode(periode) {
  return fmtMonthLabel(periode);
}

function shiftPeriode(periode, delta) {
  const [y, m] = periode.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeNom(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSuggestedCategoryForName(name) {
  const norm = normalizeNom(name);
  const match = ALL_SUGGESTED_NAMES.find((s) => normalizeNom(s.name) === norm);
  return match?.categorie || null;
}

function findSimilarEntry(nom, entries, excludeId = null) {
  const norm = normalizeNom(nom);
  if (!norm) return null;
  return (entries || []).find((e) => {
    if (excludeId && e.id === excludeId) return false;
    const eNorm = normalizeNom(e.nom);
    return eNorm === norm || eNorm.includes(norm) || norm.includes(eNorm);
  }) || null;
}

function fmtPeriodRange(periode) {
  if (!periode) return "—";
  const [y, m] = periode.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(start)} → ${fmt(end)}`;
}

function pctBarColor(pct) {
  if (pct > 30) return "#1D9E75";
  if (pct >= 10) return "#BA7517";
  return "var(--text-muted)";
}

function DeleteCoutModal({ open, entry, onConfirm, onClose, deleting }) {
  useEscapeToClose(open, onClose);
  if (!open || !entry) return null;
  return createPortal(
    <div
      className="cout-modal-backdrop fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="cout-modal-panel relative w-full max-w-xs overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          background: "var(--color-background-primary)",
          borderColor: "var(--color-border-secondary)",
        }}
      >
        <div className="h-1" style={{ background: "#E24B4A" }} />
        <div className="flex flex-col items-center gap-3 p-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(226,75,74,0.1)" }}>
            <IconTrash size={26} stroke={1.75} style={{ color: "#E24B4A" }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Supprimer ce coût ?</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              <strong>&quot;{entry.nom}&quot;</strong> — {Number(entry.montant).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">Cette action est irréversible.</p>
          </div>
          <div className="mt-1 flex w-full gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border py-2.5 text-sm"
              style={{ borderColor: "var(--color-border-secondary)", color: "var(--color-text-secondary)" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => onConfirm(entry.id)}
              disabled={deleting}
              className="stokify-btn-action flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: STOKIFY_RED_ACTION }}
            >
              {deleting ? "..." : "Supprimer"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CoutEntryModal({ open, entry, depotId, periode, depotLabel, existingEntries = [], onClose, onSave, onEditExisting }) {
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [montant, setMontant] = useState("");
  const [categorie, setCategorie] = useState(null);
  const [recurrent, setRecurrent] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [saving, setSaving] = useState(false);
  const nomRef = useRef(null);
  const isEdit = !!entry?.id;
  useEscapeToClose(open, onClose);

  const formValues = useMemo(
    () => ({
      nom,
      description,
      montant,
      categorie,
      recurrent,
    }),
    [nom, description, montant, categorie, recurrent]
  );

  const { errors, validate, validateField, isValid, clearError, clearErrors, setErrors } =
    useFormValidation(coutEntrySchema, formValues);

  useEffect(() => {
    if (open) {
      setNom(entry?.nom || "");
      setDescription(entry?.description || "");
      setMontant(entry?.montant?.toString() || "");
      setCategorie(entry?.categorie || null);
      setRecurrent(false);
      clearErrors();
      setDuplicateWarning(null);
      setTimeout(() => nomRef.current?.focus(), 100);
    }
  }, [open, entry, clearErrors]);

  async function performSave() {
    setSaving(true);
    try {
      await onSave({
        id: entry?.id,
        nom: nom.trim(),
        description: description.trim() || null,
        montant: Number(String(montant).replace(",", ".")),
        categorie: categorie || null,
        depotId,
        periode,
        recurrent: !isEdit && recurrent,
      });
      onClose();
    } catch (err) {
      setErrors({ _form: err.message || "Erreur lors de l'enregistrement" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    if (!validate()) return;
    if (!isEdit) {
      const similar = findSimilarEntry(nom, existingEntries);
      if (similar) {
        setDuplicateWarning(similar);
        return;
      }
    }
    await performSave();
  }

  function applySuggestedName(name) {
    setNom(name);
    setCategorie(getSuggestedCategoryForName(name));
    clearError("nom");
    setDuplicateWarning(null);
  }

  const filteredSuggestions = ALL_SUGGESTED_NAMES.filter(
    (s) => !nom || s.name.toLowerCase().includes(nom.toLowerCase())
  ).slice(0, 8);

  if (!open) return null;

  return createPortal(
    <div
      className="cout-drawer-backdrop fixed inset-0 z-[200] flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="cout-drawer-panel relative flex h-full w-full max-w-md flex-col overflow-hidden"
        style={{
          background: "var(--color-background-primary, var(--bg-card))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 shrink-0" style={{ background: "linear-gradient(90deg, #E24B4A, #7F77DD, #1D9E75)" }} />
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(226,75,74,0.1)" }}>
              {isEdit ? <IconPencil size={18} stroke={1.75} style={{ color: "#E24B4A" }} /> : <IconPlus size={18} stroke={2} style={{ color: "#E24B4A" }} />}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{isEdit ? "Modifier le coût" : "Nouveau coût"}</h2>
              <p className="text-[11px] text-[var(--color-text-secondary)]">{depotLabel} · {formatPeriode(periode)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 transition-colors" style={{ color: "var(--color-text-tertiary)" }} aria-label="Fermer">
            <IconX size={18} stroke={1.75} />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSave} noValidate>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {errors._form && (
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: "rgba(226,75,74,0.08)", borderColor: "rgba(226,75,74,0.25)" /* , animation: "fadeUp 0.2s ease" */ }}>
              <IconAlertCircle size={14} stroke={1.75} style={{ color: "#E24B4A" }} />
              <p className="text-xs" style={{ color: "#E24B4A" }}>{errors._form}</p>
            </div>
          )}

          {duplicateWarning && (
            <div className="rounded-xl border px-3 py-3" style={{ background: "rgba(186,117,23,0.08)", borderColor: "rgba(186,117,23,0.3)" /* , animation: "fadeUp 0.2s ease" */ }}>
              <p className="text-xs" style={{ color: "#BA7517" }}>
                Un coût similaire existe déjà ce mois-ci : <strong>{duplicateWarning.nom}</strong> — {Number(duplicateWarning.montant).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setDuplicateWarning(null); performSave(); }}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
                  style={{ border: "0.5px solid rgba(186,117,23,0.4)", color: "#BA7517" }}
                >
                  Continuer quand même
                </button>
                <button
                  type="button"
                  onClick={() => { onEditExisting?.(duplicateWarning); onClose(); }}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white"
                  style={{ background: "#BA7517" }}
                >
                  Voir l&apos;entrée existante
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Nom du coût <span style={{ color: "#E24B4A" }}>*</span>
            </label>
            <input
              ref={nomRef}
              type="text"
              value={nom}
              maxLength={120}
              onChange={(e) => { setNom(e.target.value); clearError("nom"); setDuplicateWarning(null); }}
              onBlur={() => validateField("nom")}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), document.getElementById("montant-input")?.focus())}
              placeholder="Ex: Loyer mensuel, Salaire gardien, Eau..."
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "var(--color-background-secondary)",
                borderColor: errors.nom ? inputErrorStyle.borderColor : "var(--color-border-secondary)",
                color: "var(--color-text-primary)",
                boxShadow: errors.nom ? "0 0 0 3px rgba(226,75,74,0.1)" : "none",
              }}
            />
            <FormFieldError message={errors.nom} className="mt-1 flex items-center gap-1 text-[11px]" />
            {!isEdit && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {filteredSuggestions.map((s) => {
                  const catColor = COST_CATEGORIES.find((c) => c.id === s.categorie)?.color || "#7F77DD";
                  const active = nom === s.name;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => applySuggestedName(s.name)}
                      className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all hover:-translate-y-0.5"
                      style={{
                        borderColor: active ? catColor : "var(--color-border-secondary)",
                        background: active ? `${catColor}20` : "transparent",
                        color: active ? catColor : "var(--color-text-secondary)",
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">Catégorie</label>
            <div className="flex flex-wrap gap-1.5">
              {COST_CATEGORIES.map((cat, i) => {
                const active = categorie === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategorie(active ? null : cat.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all hover:-translate-y-0.5"
                    style={{
                      borderColor: active ? cat.color : "var(--color-border-secondary)",
                      background: active ? `${cat.color}20` : "transparent",
                      color: active ? cat.color : "var(--color-text-secondary)",
                      // animation: `fadeUp 0.25s ease ${i * 30}ms both`,
                    }}
                  >
                    <cat.Icon size={14} stroke={1.75} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
            {!categorie && (
              <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                Catégorie non précisée — classée en Autre
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
              Montant <span style={{ color: "#E24B4A" }}>*</span>
            </label>
            <div className="relative">
              <input
                id="montant-input"
                type="text"
                inputMode="decimal"
                value={montant}
                onChange={(e) => { setMontant(e.target.value); clearError("montant"); }}
                onBlur={() => validateField("montant")}
                placeholder="0,000"
                className="w-full rounded-xl border py-3 pl-4 pr-16 text-lg font-semibold outline-none transition-all"
                style={{
                  background: "var(--color-background-secondary)",
                  borderColor: errors.montant ? inputErrorStyle.borderColor : "var(--color-border-secondary)",
                  color: Number(String(montant).replace(",", ".")) > 0 ? "#1D9E75" : "var(--color-text-primary)",
                }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "var(--color-text-tertiary)" }}>TND</span>
            </div>
            <FormFieldError message={errors.montant} className="mt-1 flex items-center gap-1 text-[11px]" />
          </div>

          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-[var(--color-text-secondary)]">
              <span>Description</span>
              <span className="font-normal text-[var(--color-text-tertiary)]">Optionnel</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); clearError("description"); }}
              onBlur={() => validateField("description")}
              maxLength={500}
              rows={3}
              placeholder="Détails supplémentaires sur ce coût..."
              className="w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: "var(--color-background-secondary)",
                borderColor: errors.description ? inputErrorStyle.borderColor : "var(--color-border-secondary)",
                color: "var(--color-text-primary)",
              }}
            />
            <div className="mt-1 flex items-center justify-between gap-2">
              <FormFieldError message={errors.description} className="text-[11px]" />
              <span className="text-[11px] text-[var(--color-text-tertiary)]">{description.length}/500</span>
            </div>
          </div>

          {!isEdit && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors hover:bg-[var(--color-background-secondary)]" style={{ borderColor: "var(--color-border-secondary)" }}>
              <input
                type="checkbox"
                checked={recurrent}
                onChange={(e) => setRecurrent(e.target.checked)}
                className="h-4 w-4 rounded accent-[#378ADD]"
              />
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                <Repeat size={14} stroke={1.75} style={{ color: "#378ADD" }} />
                Dupliquer sur les 3 prochains mois
              </span>
            </label>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t px-5 py-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--color-border-secondary)", color: "var(--color-text-secondary)" }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || (!isEdit && !isValid)}
            className="stokify-btn-action-gradient flex flex-[2] items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{
              background: saving ? "var(--color-background-secondary)" : primaryButtonGradientStyle.background,
              boxShadow: saving ? "none" : primaryButtonGradientStyle.boxShadow,
            }}
          >
            {saving ? (
              <>
                <IconLoader2 size={16} stroke={1.75} className="animate-spin" />
                <span style={{ color: "var(--color-text-secondary)" }}>Enregistrement...</span>
              </>
            ) : (
              <>
                <IconDeviceFloppy size={16} stroke={1.75} />
                {isEdit ? "Mettre à jour" : "Enregistrer le coût"}
              </>
            )}
          </button>
        </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function MonthNavigator({ periode, onChange }) {
  const [anim, setAnim] = useState("");
  function shift(delta) {
    const [y, m] = periode.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setAnim(delta > 0 ? "coutMonthSlideRight" : "coutMonthSlideLeft");
    onChange(next);
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => shift(-1)}
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-background-secondary, var(--bg-hover))"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <IconChevronLeft size={16} stroke={1.75} />
      </button>
      <span
        key={periode}
        className="min-w-[110px] text-center capitalize"
        style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15, animation: `${anim || "coutFadeUp"} 0.3s cubic-bezier(0.22, 1, 0.36, 1) both` }}
      >
        {fmtMonthLabel(periode)}
      </span>
      <button
        type="button"
        onClick={() => shift(1)}
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-background-secondary, var(--bg-hover))"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <IconChevronRight size={16} stroke={1.75} />
      </button>
    </div>
  );
}

function Pagination({ page, pages, onPageChange }) {
  const nums = useMemo(() => {
    const out = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p += 1) out.push(p);
    return out;
  }, [page, pages]);

  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30" style={{ border: "0.5px solid var(--color-border-tertiary, var(--border-default))", color: "var(--text-muted)" }}>
        <IconChevronLeft size={16} stroke={1.75} />
      </button>
      {nums.map((p) => (
        <button key={p} type="button" onClick={() => onPageChange(p)} className="flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium" style={p === page ? { background: "#7F77DD", color: "#fff" } : { border: "0.5px solid var(--color-border-tertiary, var(--border-default))", color: "var(--text-muted)" }}>
          {p}
        </button>
      ))}
      <button type="button" disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30" style={{ border: "0.5px solid var(--color-border-tertiary, var(--border-default))", color: "var(--text-muted)" }}>
        <IconChevronRight size={16} stroke={1.75} />
      </button>
    </div>
  );
}

function CoutModal({ cout, articles, depots, onClose, onSaved }) {
  const isEdit = !!cout?.id;
  const [form, setForm] = useState(
    isEdit
      ? {
          articleId: String(cout.articleId),
          depotId: String(cout.depotId),
          coutUnitaire: cout.coutUnitaire || "",
          devise: cout.devise || "TND",
          periodeDebut: cout.periodeDebut ? cout.periodeDebut.slice(0, 10) : "",
          periodeFin: cout.periodeFin ? cout.periodeFin.slice(0, 10) : "",
          commentaire: cout.commentaire || "",
        }
      : {
          articleId: "",
          depotId: "",
          coutUnitaire: "",
          devise: "TND",
          periodeDebut: monthStartIsoDate(),
          periodeFin: "",
          commentaire: "",
        }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const qc = useQueryClient();
  useEscapeToClose(true, onClose);

  const formValues = useMemo(() => ({ ...form }), [form]);
  const { errors, validate, validateField, clearError, applyApiErrors } =
    useFormValidation(coutStockageSchema, formValues);

  const visibleErrors = submitAttempted ? errors : {};

  function updateField(name, value) {
    setForm((p) => ({ ...p, [name]: value }));
    clearError(name);
  }

  async function save(e) {
    e?.preventDefault?.();
    setSubmitAttempted(true);
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        articleId: Number(form.articleId),
        depotId: Number(form.depotId),
        coutUnitaire: Number(String(form.coutUnitaire).replace(",", ".")),
        devise: form.devise || "TND",
        periodeDebut: toIsoStartOfDay(form.periodeDebut),
        periodeFin: form.periodeFin ? toIsoStartOfDay(form.periodeFin) : null,
        commentaire: form.commentaire.trim() || null,
      };
      if (isEdit) await api.patch(`cout-stockage/${cout.id}`, payload);
      else await api.post("cout-stockage", payload);
      qc.invalidateQueries({ queryKey: ["cout-stockage"] });
      onSaved();
      onClose();
    } catch (e) {
      const apiMapped = applyApiErrors(e?.response?.data);
      if (!Object.keys(apiMapped).length) {
        setError(getAxiosErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = (name) => ({
    ...INPUT_STYLE,
    ...(visibleErrors[name] ? inputErrorStyle : {}),
  });

  const montantParsed = Number(String(form.coutUnitaire).replace(",", "."));
  const montantValid = !Number.isNaN(montantParsed) && montantParsed > 0;

  return createPortal(
    <div className="cout-drawer-backdrop fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden />
      <div
        className="cout-drawer-panel relative flex h-full w-full max-w-lg flex-col overflow-hidden"
        style={{ background: "var(--bg-modal, var(--bg-card))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 shrink-0" style={{ background: "linear-gradient(90deg, #7F77DD, #378ADD, #1D9E75)" }} />
        <div className="mb-2 flex items-start justify-between px-6 pt-5">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{isEdit ? "Modifier le coût" : "Nouveau coût de stockage"}</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Frais logistiques par article et dépôt</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5" style={{ color: "var(--text-muted)" }}>
            <IconX size={20} stroke={1.75} />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={save} noValidate>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>Article <span style={{ color: "#E24B4A" }}>*</span></label>
            <p className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>Article concerné par ce frais de stockage</p>
            <SearchableSelect
              value={form.articleId}
              onChange={(v) => updateField("articleId", v)}
              options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))}
              placeholder="Choisir un article"
              allowClear={false}
            />
            <FormFieldError message={visibleErrors.articleId} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>Dépôt <span style={{ color: "#E24B4A" }}>*</span></label>
            <p className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>Emplacement où le stock est entreposé</p>
            <SearchableSelect
              value={form.depotId}
              onChange={(v) => updateField("depotId", v)}
              options={depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
              placeholder="Choisir un dépôt"
              allowClear={false}
            />
            <FormFieldError message={visibleErrors.depotId} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              Coût unitaire <span style={{ color: "#E24B4A" }}>*</span>
            </label>
            <p className="mb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Montant par unité stockée (ex. 2,500 {form.devise} / pièce)
            </p>
            <div
              className="flex overflow-hidden rounded-lg"
              style={{
                border: visibleErrors.coutUnitaire
                  ? `1px solid ${inputErrorStyle.borderColor}`
                  : "0.5px solid var(--color-border-secondary, var(--border-default))",
                background: "var(--color-background-primary, var(--bg-input))",
              }}
            >
              <input
                type="text"
                inputMode="decimal"
                value={form.coutUnitaire}
                onChange={(e) => updateField("coutUnitaire", e.target.value)}
                onBlur={() => validateField("coutUnitaire")}
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-lg font-semibold outline-none"
                style={{
                  color: montantValid ? "#1D9E75" : "var(--text-primary)",
                }}
                placeholder="0,000"
                aria-label="Coût unitaire"
              />
              <div
                className="flex shrink-0 items-center border-l px-1"
                style={{
                  borderColor: "var(--color-border-secondary, var(--border-default))",
                  background: "var(--color-background-secondary, var(--bg-hover))",
                }}
              >
                <select
                  value={form.devise}
                  onChange={(e) => updateField("devise", e.target.value)}
                  className="cursor-pointer border-0 bg-transparent py-2 pl-2 pr-1 text-sm font-semibold outline-none"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Devise"
                >
                  {DEVISES.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
            </div>
            {montantValid && (
              <p className="mt-1.5 text-[11px] font-medium" style={{ color: "#1D9E75" }}>
                {montantParsed.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {form.devise} / unité
              </p>
            )}
            <FormFieldError message={visibleErrors.coutUnitaire} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                Date de début <span style={{ color: "#E24B4A" }}>*</span>
              </label>
              <p className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>Début d&apos;application du coût</p>
              <input
                type="date"
                value={form.periodeDebut}
                onChange={(e) => updateField("periodeDebut", e.target.value)}
                onBlur={() => validateField("periodeDebut")}
                style={fieldStyle("periodeDebut")}
              />
              {form.periodeDebut && (
                <p className="mt-1.5 text-[11px] capitalize" style={{ color: "#378ADD" }}>
                  {fmtIsoDateLabel(form.periodeDebut)}
                </p>
              )}
              <FormFieldError message={visibleErrors.periodeDebut} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>Date de fin</label>
              <p className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>Optionnel — laisser vide si toujours actif</p>
              <input
                type="date"
                value={form.periodeFin}
                min={form.periodeDebut || undefined}
                onChange={(e) => updateField("periodeFin", e.target.value)}
                onBlur={() => validateField("periodeFin")}
                style={fieldStyle("periodeFin")}
              />
              {form.periodeFin && (
                <p className="mt-1.5 text-[11px] capitalize" style={{ color: "#378ADD" }}>
                  {fmtIsoDateLabel(form.periodeFin)}
                </p>
              )}
              <FormFieldError message={visibleErrors.periodeFin} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-primary)" }}>Commentaire</label>
            <input
              value={form.commentaire}
              onChange={(e) => updateField("commentaire", e.target.value)}
              onBlur={() => validateField("commentaire")}
              maxLength={500}
              style={fieldStyle("commentaire")}
              placeholder="Ex: Frais de location, manutention, assurance..."
            />
            <FormFieldError message={visibleErrors.commentaire} />
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-2 rounded-lg px-3 py-2 text-xs" style={{ border: "0.5px solid rgba(226,75,74,0.35)", background: "rgba(226,75,74,0.1)", color: "#E24B4A" }}>
            {error}
          </p>
        )}

        <div className="mt-auto flex shrink-0 justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--border-default)" }}>
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm" style={{ border: "0.5px solid var(--color-border-secondary, var(--border-default))", color: "var(--text-muted)" }}>Annuler</button>
          <button type="submit" disabled={saving} className={PRIMARY_BTN} style={primaryButtonStyle}>
            {saving && <IconLoader2 size={16} stroke={1.75} className="animate-spin" />}
            {isEdit ? "Enregistrer" : "Créer le coût"}
          </button>
        </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function DepotMensuelTab({ depots, canWrite, showToast }) {
  const qc = useQueryClient();
  const societeScope = useSocieteQueryScope();
  const [depotId, setDepotId] = useState("");
  const [periode, setPeriode] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [entryModal, setEntryModal] = useState({ open: false, entry: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, entry: null });
  const [deleting, setDeleting] = useState(false);
  const [actionToast, setActionToast] = useState(null);
  const [depotFlash, setDepotFlash] = useState(false);
  const [exitingIds, setExitingIds] = useState(() => new Set());
  const [kpiGeneration, setKpiGeneration] = useState(0);
  const singleDepotMode = depots.length === 1;

  useEffect(() => {
    if (depots.length === 1 && !depotId) {
      setDepotId(String(depots[0].id));
    }
  }, [depots, depotId]);

  useEffect(() => {
    if (!depotId) return undefined;
    setDepotFlash(true);
    setKpiGeneration((g) => g + 1);
    const t = setTimeout(() => setDepotFlash(false), 650);
    return () => clearTimeout(t);
  }, [depotId]);

  useEffect(() => {
    setEntryModal({ open: false, entry: null });
    setDeleteModal({ open: false, entry: null });
  }, [depotId, periode]);

  const selectedDepot = depots.find((d) => String(d.id) === String(depotId));
  const depotLabel = selectedDepot ? `${selectedDepot.code} — ${selectedDepot.libelle || selectedDepot.nom}` : "—";
  const depotShortName = selectedDepot?.libelle || selectedDepot?.code || "ce dépôt";
  const needsDepotSelection = depots.length > 1 && !depotId;
  const previousPeriode = shiftPeriode(periode, -1);

  const { data: entries = [], isLoading: loading, isFetching: entriesFetching } = useQuery({
    queryKey: ["cout-entries", societeScope, depotId, periode],
    queryFn: () =>
      api
        .get("cout-stockage/cout-entries", {
          params: { depotId: Number(depotId), periode },
        })
        .then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled: !!depotId && !!periode,
  });

  const { data: groupedData = [] } = useQuery({
    queryKey: ["cout-entries-grouped", societeScope, depotId, periode],
    queryFn: () =>
      api
        .get("cout-stockage/cout-entries/grouped", {
          params: { depotId: Number(depotId), periode },
        })
        .then((r) => (Array.isArray(r.data) ? r.data : [])),
    enabled: !!depotId && !!periode,
  });

  const { data: prevTotalData } = useQuery({
    queryKey: ["cout-entries-total", societeScope, depotId, previousPeriode],
    queryFn: () =>
      api
        .get("cout-stockage/cout-entries/total", {
          params: { depotId: Number(depotId), periode: previousPeriode },
        })
        .then((r) => r.data),
    enabled: !!depotId && !!previousPeriode,
  });

  const totalMois = useMemo(
    () => entries.reduce((s, e) => s + Number(e.montant || 0), 0),
    [entries]
  );

  const categorySegments = useMemo(
    () => buildSegmentsFromGroupedEntries(groupedData),
    [groupedData]
  );

  const prevTotal = Number(prevTotalData?.total || 0);
  const trendPct = prevTotal > 0 ? ((totalMois - prevTotal) / prevTotal) * 100 : null;
  const trendUp = trendPct != null && trendPct > 0;
  const trendDown = trendPct != null && trendPct < 0;

  const entriesBusy = loading || entriesFetching;

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => Number(b.montant) - Number(a.montant)),
    [entries]
  );

  const topEntry = sortedEntries[0];

  function openModal(entry) {
    if (!canWrite && !entry) return;
    if (entry || canWrite) setEntryModal({ open: true, entry });
  }

  function invalidateEntryQueries() {
    qc.invalidateQueries({ queryKey: ["cout-entries"] });
    qc.invalidateQueries({ queryKey: ["cout-entries-grouped"] });
    qc.invalidateQueries({ queryKey: ["cout-entries-total"] });
    qc.invalidateQueries({ queryKey: ["cout-entries-all"] });
    qc.invalidateQueries({ queryKey: ["cout-imputation"] });
  }

  async function handleSave(payload) {
    try {
      if (payload.id) {
        await api.put(`cout-stockage/cout-entries/${payload.id}`, {
          nom: payload.nom,
          description: payload.description,
          montant: payload.montant,
          categorie: payload.categorie,
        });
        showToast("Coût mis à jour");
      } else {
        const { recurrent, id: _id, ...createPayload } = payload;
        await api.post("cout-stockage/cout-entries", {
          ...createPayload,
          dupliquerMois: recurrent ? 3 : 0,
        });
        showToast(recurrent ? "Coût enregistré et dupliqué sur 3 mois" : "Coût enregistré");
      }
      invalidateEntryQueries();
    } catch (e) {
      throw new Error(getAxiosErrorMessage(e));
    }
  }

  async function handleDelete(id) {
    setExitingIds((prev) => new Set(prev).add(id));
    await new Promise((r) => setTimeout(r, 280));
    setDeleting(true);
    try {
      await api.delete(`cout-stockage/cout-entries/${id}`);
      invalidateEntryQueries();
      showToast("Coût supprimé", "warning");
      setDeleteModal({ open: false, entry: null });
    } catch (e) {
      showToast(getAxiosErrorMessage(e), "error");
    } finally {
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleting(false);
    }
  }

  const kpiCards = depotId
    ? [
        {
          label: "Total coûts",
          value: totalMois,
          isCurrency: true,
          color: "#1D9E75",
          gradientTo: "#2BC492",
          Icon: IconCoin,
          sub: `${entries.length} entrée(s) ce mois · ${depotShortName}`,
        },
        {
          label: "Coût moyen / entrée",
          value: entries.length > 0 ? totalMois / entries.length : 0,
          isCurrency: true,
          isEmpty: entries.length === 0,
          color: "#378ADD",
          gradientTo: "#5BA3F5",
          Icon: IconChartBar,
          sub: "Moyenne des coûts saisis",
        },
        {
          label: "Plus gros poste",
          value: topEntry?.nom || "—",
          isTextValue: true,
          isEmpty: !topEntry,
          color: "#BA7517",
          gradientTo: "#E8A020",
          Icon: IconArrowUp,
          sub: topEntry
            ? `${Number(topEntry.montant).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND`
            : "Aucune entrée ce mois",
        },
      ]
    : [
        {
          label: "Total coûts",
          value: "—",
          isTextValue: true,
          color: "#1D9E75",
          gradientTo: "#2BC492",
          Icon: IconCoin,
          sub: "Choisissez un dépôt pour afficher le détail",
        },
        {
          label: "Coût moyen / entrée",
          value: "—",
          isTextValue: true,
          color: "#378ADD",
          gradientTo: "#5BA3F5",
          Icon: IconChartBar,
          sub: "Indicateur par dépôt sélectionné",
        },
        {
          label: "Plus gros poste",
          value: "—",
          isTextValue: true,
          color: "#BA7517",
          gradientTo: "#E8A020",
          Icon: IconArrowUp,
          sub: "En attente de sélection",
        },
      ];

  return (
    <div className="space-y-5" style={{ animation: "tabContent 0.18s ease both" }}>
      <div
        className={`depot-selector-card relative overflow-hidden rounded-2xl p-4 sm:p-5 ${!depotId ? "depot-selector-empty" : ""} ${needsDepotSelection ? "depot-selector-invite" : ""} ${depotFlash ? "depot-selector-flash" : ""}`}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.14] blur-2xl"
          style={{ background: "radial-gradient(circle, #378ADD, #1D9E75, transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-[2] gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${!depotId ? "depot-warehouse-icon-pulse" : ""}`}
              style={{ background: "#378ADD", color: "#fff" }}
            >
              <IconBuildingWarehouse size={24} stroke={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                Dépôt
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal" style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD" }}>
                  {depotId ? "Sélectionné" : "Requis"}
                </span>
              </label>
              <div className="depot-select-wrap">
                <SearchableSelect
                  value={depotId}
                  onChange={setDepotId}
                  options={depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
                  placeholder="Cliquez pour choisir un dépôt…"
                  allowClear={false}
                  className="w-full"
                  aria-label="Sélectionner un dépôt"
                />
              </div>
              {needsDepotSelection && (
                <p className="mt-2 text-xs font-medium" style={{ color: "#378ADD" }}>
                  ↑ Sélectionnez un dépôt pour afficher les coûts du mois
                </p>
              )}
              {depotId && selectedDepot && (
                <p className="mt-1.5 truncate text-xs text-[var(--text-secondary)]">
                  {depotLabel}
                </p>
              )}
            </div>
          </div>
          <div className="hidden w-px self-stretch lg:block" style={{ background: "color-mix(in srgb, #378ADD 25%, var(--border-default))" }} />
          <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border px-3 py-2" style={{ borderColor: "color-mix(in srgb, #378ADD 20%, var(--border-default))", background: "var(--bg-input)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">Mois</span>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPeriode((p) => shiftPeriode(p, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                aria-label="Mois précédent"
              >
                <IconChevronLeft size={16} stroke={1.75} />
              </button>
              <span className="min-w-[120px] text-center text-sm font-bold capitalize text-[var(--text-primary)]">
                {formatPeriode(periode)}
              </span>
              <button
                type="button"
                onClick={() => setPeriode((p) => shiftPeriode(p, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                aria-label="Mois suivant"
              >
                <IconChevronRight size={16} stroke={1.75} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div key={`depot-kpis-${kpiGeneration}`} className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {loading && depotId
          ? Array.from({ length: 3 }).map((_, i) => <CoutKpiSkeleton key={i} delayIndex={i} />)
          : kpiCards.map((card, i) => (
              <CoutKpiCard
                key={`${card.label}-${kpiGeneration}`}
                delayIndex={i}
                title={card.label}
                value={card.isEmpty ? "—" : card.value}
                isCurrency={card.isCurrency && !card.isEmpty}
                isTextValue={card.isTextValue || card.isEmpty}
                icon={card.Icon}
                accentColor={card.color}
                gradientTo={card.gradientTo}
                subtitle={card.sub}
                deltaPct={i === 0 && trendPct != null ? trendPct : null}
                deltaPolarity="cost"
                deltaLabel={i === 0 && trendPct != null ? "vs mois préc." : undefined}
              />
            ))}
      </div>

      {actionToast && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
          style={{ background: "rgba(55,138,221,0.08)", borderColor: "rgba(55,138,221,0.25)" /* , animation: "fadeUp 0.25s ease both" */ }}
        >
          <p className="text-sm" style={{ color: "#378ADD" }}>{actionToast.msg}</p>
          <button
            type="button"
            onClick={actionToast.onAction}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
            style={primaryButtonStyle}
          >
            {actionToast.actionLabel}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border cout-table-panel" style={{ borderColor: "var(--color-border-tertiary)" }}>
        <div
          className="cout-table-header flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--color-border-tertiary)" }}
        >
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Coûts du mois — {formatPeriode(periode)}</h3>
            {depotId && (
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {selectedDepot?.libelle || selectedDepot?.code} · {entries.length} entrée(s)
              </p>
            )}
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => openModal(null)}
              disabled={!depotId}
              className="stokify-btn-action flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              style={primaryButtonShadowStyle}
            >
              <IconPlus size={14} stroke={2} />
              Ajouter un coût
            </button>
          )}
        </div>

        {entries.length > 0 && totalMois > 0 && (
          <>
            <CoutDashedSeparator className="mx-4 my-0 border-b-0" />
            <div
              className="border-b px-4 py-4"
              style={{ animation: "fadeUp 0.25s ease both", borderColor: "var(--color-border-tertiary)" }}
            >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Total du mois par catégorie
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: "#1D9E75" }}>
                  <AnimatedNumber value={totalMois} duration={900} decimals={3} suffix=" TND" />
                </span>
                {trendPct != null && (
                  <span
                    className="inline-flex items-center gap-0.5 text-xs font-semibold"
                    style={{ color: trendUp ? "#E24B4A" : trendDown ? "#1D9E75" : "var(--color-text-tertiary)" }}
                  >
                    {trendUp ? "▲" : trendDown ? "▼" : "—"}
                    {Math.abs(trendPct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <StackedCostBlock segments={categorySegments} segmentCascade />
            </div>
          </>
        )}

        {(entriesBusy || entries.length > 0) && depotId && <CoutDashedSeparator className="mx-4 my-0 border-b-0" />}

        {!entriesBusy && entries.length > 0 && (
          <div
            className="hidden gap-3 border-b px-4 py-2 md:grid"
            style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", background: "var(--color-background-secondary)", borderColor: "var(--color-border-tertiary)" }}
          >
            {[
              { label: "Nom du coût", span: 3 },
              { label: "Description", span: 4 },
              { label: "Montant", span: 2 },
              { label: "Ajouté par", span: 1 },
              { label: "Date", span: 1 },
              { label: "Actions", span: 1 },
            ].map((col) => (
              <div key={col.label} className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]" style={{ gridColumn: `span ${col.span}` }}>
                {col.label}
              </div>
            ))}
          </div>
        )}

        {entriesBusy ? (
          Array.from({ length: 4 }).map((_, i) => <CoutTableRowSkeleton key={i} columns={6} delayIndex={i} />)
        ) : !depotId ? (
          <CoutEmptyState
            icon={IconBuildingWarehouse}
            accentColor="#378ADD"
            title="Sélectionnez un dépôt pour commencer"
            description="Les coûts affichés ici sont par dépôt. Utilisez le menu déroulant ci-dessus pour afficher le détail du mois."
          />
        ) : entries.length === 0 ? (
          <CoutEmptyState
            icon={IconCoin}
            accentColor="#E24B4A"
            title={
              singleDepotMode || depotId
                ? `Ajoutez votre premier coût pour ${depotShortName}`
                : "Aucun coût saisi pour ce mois"
            }
            description={`${formatPeriode(periode)} — saisissez vos charges (loyer, personnel, énergie…) pour démarrer le suivi.`}
            actionLabel={canWrite ? "Ajouter un premier coût" : undefined}
            onAction={canWrite ? () => openModal(null) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            {sortedEntries.map((entry, i) => {
              const color = ENTRY_COLORS[i % ENTRY_COLORS.length];
              const isExiting = exitingIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`cout-data-row group grid min-w-[760px] items-center gap-3 px-4 py-3.5 md:min-w-0 even:bg-[var(--bg-input)] ${isExiting ? "cout-row-exit" : "cout-row-enter"}`}
                  style={{
                    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                    animationDelay: isExiting ? undefined : `${i * 40}ms`,
                    borderTop: "0.5px solid var(--color-border-tertiary)",
                    "--row-accent": color,
                  }}
                >
                  <div className="col-span-3 flex items-center gap-2.5">
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconCoin size={14} stroke={1.75} style={{ color }} />
                    </div>
                    <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">{entry.nom}</span>
                    {entry.categorie && (
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: COST_CATEGORIES.find((c) => c.id === entry.categorie)?.color || "#888780", background: "var(--bg-input)" }}>
                        {COST_CATEGORIES.find((c) => c.id === entry.categorie)?.label || entry.categorie}
                      </span>
                    )}
                  </div>
                  <div className="col-span-4">
                    <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                      {entry.description || <span className="italic text-[var(--color-text-tertiary)]">—</span>}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-bold" style={{ color }}>
                      {Number(entry.montant).toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
                    </span>
                    <div className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                      {totalMois > 0 ? `${((entry.montant / totalMois) * 100).toFixed(1)}% du total` : "—"}
                    </div>
                  </div>
                  <div className="col-span-1">
                    {entry.utilisateur ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#7F77DD" }}>
                        {entry.utilisateur.prenom?.[0]}
                        {entry.utilisateur.nom?.[0]}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-[10px] text-[var(--color-text-tertiary)]">
                    {new Date(entry.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </div>
                  {canWrite && (
                    <div className="col-span-1 flex gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
                      <button type="button" onClick={() => openModal(entry)} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(55,138,221,0.12)]" style={{ color: "#378ADD" }} title="Modifier">
                        <IconPencil size={14} stroke={1.75} />
                      </button>
                      <button type="button" onClick={() => setDeleteModal({ open: true, entry })} className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[rgba(226,75,74,0.12)]" style={{ color: "#E24B4A" }} title="Supprimer">
                        <IconTrash size={14} stroke={1.75} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {entries.length > 0 && (
          <div
            className="flex items-center justify-between border-t px-4 py-3"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-default)" }}
          >
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">TOTAL — {entries.length} entrée(s)</span>
            <span className="text-base font-bold" style={{ color: "#1D9E75" }}>
              {totalMois.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND
            </span>
          </div>
        )}
      </div>

      <CoutEntryModal
        open={entryModal.open}
        entry={entryModal.entry}
        depotId={depotId ? Number(depotId) : null}
        periode={periode}
        depotLabel={depotLabel}
        existingEntries={entries}
        onClose={() => setEntryModal({ open: false, entry: null })}
        onSave={handleSave}
        onEditExisting={(existing) => setEntryModal({ open: true, entry: existing })}
      />
      <DeleteCoutModal
        open={deleteModal.open}
        entry={deleteModal.entry}
        deleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteModal({ open: false, entry: null })}
      />
    </div>
  );
}
function UnitairesTab({ depots, manualItems, onGoDepotTab, societeScope, canWrite, onEditManual, onDeleteManual, deletingManualId }) {
  const [depotId, setDepotId] = useState("");
  const [periode, setPeriode] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showComments, setShowComments] = useState(false);
  const [page, setPage] = useState(1);
  const singleDepotMode = depots.length === 1;

  useEffect(() => {
    if (depots.length === 1 && !depotId) {
      setDepotId(String(depots[0].id));
    }
  }, [depots, depotId]);

  useEffect(() => {
    setPage(1);
  }, [depotId, periode]);

  const selectedDepot = depots.find((d) => String(d.id) === String(depotId));
  const needsDepotSelection = depots.length > 1 && !depotId;

  const { data: imputation, isLoading: stockLoading, isFetching: stockFetching } = useQuery({
    queryKey: ["cout-imputation", societeScope, depotId, periode],
    queryFn: () =>
      api
        .get("cout-stockage/imputation", { params: { depotId: Number(depotId), periode, months: 6 } })
        .then((r) => r.data),
    enabled: !!depotId && !!periode,
  });

  const stockBusy = stockLoading || stockFetching;
  const totalDepotCost = Number(imputation?.totalDepotCost || 0);
  const hasDepotCosts = Boolean(imputation?.hasDepotCosts);
  const imputedRows = imputation?.items || [];

  const kpiStats = {
    entrees: Number(imputation?.entriesCount || 0),
    articles: Number(imputation?.articlesCount || 0),
    coutMoyen: imputedRows.length
      ? imputedRows.reduce((s, r) => s + Number(r.coutUnitaire || 0), 0) / imputedRows.length
      : 0,
    periodes: Number(imputation?.periodesActives || 0),
  };

  const manualForDepot = useMemo(
    () =>
      (manualItems || []).filter((c) => {
        if (depotId && String(c.depotId) !== String(depotId)) return false;
        return manualAppliesToMonth(c, periode);
      }),
    [manualItems, depotId, periode]
  );

  const pages = Math.max(1, Math.ceil(imputedRows.length / UNITAIRES_PAGE_SIZE));
  const pagedRows = imputedRows.slice((page - 1) * UNITAIRES_PAGE_SIZE, page * UNITAIRES_PAGE_SIZE);

  const gridCols = showComments
    ? "2fr 100px 120px 110px 110px 100px 140px 1fr"
    : "2fr 100px 120px 110px 110px 100px 140px";

  return (
    <div className="space-y-4">
      <div
        className={`depot-selector-card relative overflow-hidden rounded-2xl p-4 sm:p-5 ${!depotId ? "depot-selector-empty" : ""} ${needsDepotSelection ? "depot-selector-invite" : ""}`}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-[0.14] blur-2xl"
          style={{ background: "radial-gradient(circle, #378ADD, #1D9E75, transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-[2] gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${!depotId ? "depot-warehouse-icon-pulse" : ""}`}
              style={{ background: "#378ADD", color: "#fff" }}
            >
              <IconBuildingWarehouse size={24} stroke={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
                Dépôt
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal" style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD" }}>
                  {depotId ? "Sélectionné" : "Requis"}
                </span>
              </label>
              <div className="depot-select-wrap">
                <SearchableSelect
                  value={depotId}
                  onChange={setDepotId}
                  options={depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle || d.nom}` }))}
                  placeholder="Cliquez pour choisir un dépôt…"
                  allowClear={false}
                  className="w-full"
                  aria-label="Sélectionner un dépôt"
                />
              </div>
              {needsDepotSelection && (
                <p className="mt-2 text-xs font-medium" style={{ color: "#378ADD" }}>
                  ↑ Sélectionnez un dépôt pour voir l&apos;imputation des coûts
                </p>
              )}
              {depotId && selectedDepot && (
                <p className="mt-1.5 truncate text-xs text-[var(--text-secondary)]">
                  {`${selectedDepot.code} — ${selectedDepot.libelle || selectedDepot.nom}`}
                </p>
              )}
            </div>
          </div>
          <div className="hidden w-px self-stretch lg:block" style={{ background: "color-mix(in srgb, #378ADD 25%, var(--border-default))" }} />
          <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border px-3 py-2" style={{ borderColor: "color-mix(in srgb, #378ADD 20%, var(--border-default))", background: "var(--bg-input)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)]">Mois</span>
            <MonthNavigator periode={periode} onChange={setPeriode} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stockBusy && depotId ? (
          Array.from({ length: 4 }).map((_, i) => <CoutKpiSkeleton key={i} delayIndex={i} />)
        ) : (
          <>
            <CoutKpiCard
              delayIndex={0}
              title="Charges dépôt"
              value={depotId ? kpiStats.entrees : 0}
              icon={Receipt}
              accentColor="#7F77DD"
              gradientTo="#A89EF0"
              subtitle={!depotId ? "Sélectionnez un dépôt" : "Entrées saisies ce mois"}
            />
            <CoutKpiCard
              delayIndex={1}
              title="Articles imputés"
              value={depotId ? kpiStats.articles : 0}
              icon={Package}
              accentColor="#378ADD"
              gradientTo="#5BA3F5"
              subtitle={depotId ? "Articles en stock dans ce dépôt" : undefined}
            />
            <CoutKpiCard
              delayIndex={2}
              title="Coût moyen unitaire"
              value={depotId ? kpiStats.coutMoyen : 0}
              isCurrency
              icon={Coins}
              accentColor="#E24B4A"
              gradientTo="#E8A020"
            />
            <CoutKpiCard
              delayIndex={3}
              title="Mois avec charges"
              value={depotId ? kpiStats.periodes : 0}
              icon={CalendarCheck}
              accentColor="#1D9E75"
              gradientTo="#2BC492"
              subtitle="Sur les 6 derniers mois"
            />
          </>
        )}
      </div>

      {depotId && !hasDepotCosts && (
        <div className="cout-alert-amber relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl p-4">
          <div
            className="pointer-events-none absolute -left-4 top-0 h-full w-24 opacity-30"
            style={{ background: "radial-gradient(circle at left, #BA7517, transparent 70%)" }}
            aria-hidden
          />
          <div className="relative flex min-w-0 flex-1 items-start gap-3">
            <div className="cout-alert-icon-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "#BA7517", color: "#fff" }}>
              <IconAlertCircle size={22} stroke={1.75} />
            </div>
            <p className="text-sm leading-snug" style={{ color: "#BA7517" }}>
              Aucun coût dépôt saisi pour ce mois — saisissez d&apos;abord les charges dans l&apos;onglet « Coûts dépôt » pour obtenir des coûts unitaires précis.
            </p>
          </div>
          <button type="button" onClick={onGoDepotTab} className="cout-alert-cta relative shrink-0 rounded-lg px-4 py-2 text-xs font-semibold">
            Saisir les coûts →
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CoutKpiCard
          delayIndex={0}
          title="Coût imputé total"
          value={totalDepotCost}
          isCurrency
          icon={Wallet}
          accentColor="#E24B4A"
          gradientTo="#E8A020"
          subtitle={depotId ? `${imputedRows.length} article(s) répartis` : "Sélectionnez un dépôt"}
        />
        <CoutKpiCard
          delayIndex={1}
          title="Articles imputés"
          value={imputedRows.length}
          icon={ListChecks}
          accentColor="#378ADD"
          gradientTo="#5BA3F5"
          subtitle={depotId ? fmtPeriodRange(periode) : undefined}
        />
      </div>

      <CoutDashedSeparator />

      {depotId && manualForDepot.length > 0 && (
        <CoutSection className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Coûts unitaires manuels</h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Prioritaires sur l&apos;imputation automatique · {manualForDepot.length} actif(s) ce mois
              </p>
            </div>
          </div>
          <div className="divide-y divide-[var(--border-default)]">
            {manualForDepot.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{c.article?.libelle || "Article"}</p>
                  <p className="font-mono text-[11px] text-[var(--text-muted)]">
                    {c.article?.code} · {fmtNum(c.coutUnitaire)} {c.devise || "TND"} / unité · {fmtDate(c.periodeDebut)}
                    {c.periodeFin ? ` → ${fmtDate(c.periodeFin)}` : " → ouvert"}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => onEditManual?.(c)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[rgba(55,138,221,0.12)]" style={{ color: "#378ADD" }} title="Modifier" aria-label="Modifier le coût manuel">
                      <IconPencil size={14} stroke={1.75} />
                    </button>
                    <button type="button" onClick={() => onDeleteManual?.(c)} disabled={deletingManualId === c.id} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[rgba(226,75,74,0.12)] disabled:opacity-40" style={{ color: "#E24B4A" }} title="Supprimer" aria-label="Supprimer le coût manuel">
                      <IconTrash size={14} stroke={1.75} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CoutSection>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--text-muted)]">
          Tendance estimée au stock actuel (pas un historique de quantité).
        </p>
        <button type="button" onClick={() => setShowComments((v) => !v)} className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <IconMessage size={14} stroke={1.75} /> Afficher commentaires
        </button>
      </div>

      <CoutSection className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        {depotId && !stockBusy && (
        <div
          className="hidden min-w-[1060px] gap-2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider md:grid"
          style={{
            gridTemplateColumns: gridCols,
            background: "var(--color-background-secondary, var(--bg-card))",
            color: "var(--text-muted)",
            letterSpacing: "0.05em",
          }}
        >
          {["ARTICLE", "QTÉ EN STOCK", "% DU STOCK", "COÛT IMPUTÉ", "COÛT/UNITÉ", "TENDANCE", "PÉRIODE", ...(showComments ? ["COMMENTAIRE"] : [])].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        )}

        {!depotId ? (
          <CoutEmptyState
            icon={IconBuilding}
            accentColor="#7F77DD"
            title={"Sélectionnez un dépôt pour voir l'imputation"}
            description="Les coûts unitaires sont calculés à partir des charges dépôt réparties par article."
            actionLabel={singleDepotMode && depots[0] ? `Utiliser ${depots[0].code}` : undefined}
            onAction={singleDepotMode && depots[0] ? () => setDepotId(String(depots[0].id)) : undefined}
          />
        ) : stockBusy ? (
          Array.from({ length: 5 }).map((_, i) => <CoutTableRowSkeleton key={i} columns={7} delayIndex={i} />)
        ) :           imputedRows.length === 0 ? (
          <CoutEmptyState
            icon={IconPackage}
            accentColor="#7F77DD"
            title="Aucun stock dans ce dépôt"
            description="Ajoutez des mouvements de stock ou choisissez un autre dépôt pour calculer les coûts unitaires."
          />
        ) : (
          pagedRows.map((row, i) => (
            <div
              key={row.articleId}
              className="cout-data-row cout-row-enter group mb-0 grid min-w-[1060px] items-center gap-2 border-b border-[var(--border-default)] px-4 py-2.5 md:grid even:bg-[var(--bg-input)]"
              style={{
                gridTemplateColumns: gridCols,
                animationDelay: `${i * 35}ms`,
                "--row-accent": row.costSource === "manual" ? "#378ADD" : "#1D9E75",
              }}
            >
              <div className="flex items-center gap-2">
                {row.article?.imageUrl ? (
                  <img src={row.article.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--color-background-secondary, var(--bg-card))" }}>
                    <IconPackage size={18} stroke={1.75} style={{ color: "var(--text-muted)" }} />
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{row.article?.libelle}</p>
                    {row.costSource === "manual" && (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD", border: "1px solid rgba(55,138,221,0.35)" }}
                      >
                        Coût manuel
                      </span>
                    )}
                    {row.costSource === "calculated" && (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75", border: "1px solid rgba(29,158,117,0.3)" }}
                      >
                        Coût calculé
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{row.article?.code}</p>
                </div>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {Math.round(row.quantite).toLocaleString("fr-FR")} {row.unite}
              </span>
              <StockPctBar pct={row.pctStock} delayIndex={i} />
              <span className="text-sm font-bold" style={{ color: "#BA7517" }}>{fmtNum(row.coutImpute)}</span>
              <span className="text-sm font-bold" style={{ color: "#1D9E75" }}>{fmtNum(row.coutUnitaire)}</span>
              <div className="flex items-center justify-start">
                <CostSparkline data={row.sparkline || []} color="#7F77DD" width={88} height={32} />
              </div>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtPeriodRange(periode)}</span>
              {showComments && (
                <span className="truncate text-xs" style={{ color: "var(--text-muted)" }} title={row.commentaire}>
                  {row.commentaire || "—"}
                </span>
              )}
            </div>
          ))
        )}
      </div>
      {imputedRows.length > UNITAIRES_PAGE_SIZE && (
        <div className="border-t border-[var(--border-default)] px-4 py-3">
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
      </CoutSection>
    </div>
  );
}

function DeadStockTab({ depots, threshold = DEAD_STOCK_THRESHOLD, showToast, societeLogo, societeName, canWrite }) {
  const societeScope = useSocieteQueryScope();
  const [depotId, setDepotId] = useState("");
  const [jours, setJours] = useState("90");
  const [exportLoading, setExportLoading] = useState(false);
  const [taux, setTaux] = useState("");
  const [page, setPage] = useState(1);

  const { data: parametres } = useQuery({
    queryKey: ["cout-parametres", societeScope],
    queryFn: () => api.get("cout-stockage/parametres").then((r) => r.data),
  });

  const tauxEffectif = Number(taux || parametres?.tauxPossessionAnnuel || 2);

  const { data, isLoading } = useQuery({
    queryKey: ["dead-stock", societeScope, depotId, jours, tauxEffectif],
    queryFn: () =>
      api
        .get("cout-stockage/dead-stock", {
          params: { jours, tauxPossession: tauxEffectif, ...(depotId ? { depotId } : {}) },
        })
        .then((r) => r.data),
  });

  const items = useMemo(() => {
    const list = data?.items || [];
    return [...list].sort((a, b) => (b.joursImmobilise || 0) - (a.joursImmobilise || 0));
  }, [data?.items]);
  const coutMensuelDormant = Number(data?.coutMensuelDormant ?? 0);

  useEffect(() => {
    setPage(1);
  }, [depotId, jours, tauxEffectif]);

  const tranches = useMemo(() => {
    const t = { ">90j": 0, "60-90j": 0, "30-60j": 0 };
    for (const row of items) {
      const j = row.joursImmobilise || 0;
      if (j > 90) t[">90j"] += 1;
      else if (j >= 60) t["60-90j"] += 1;
      else t["30-60j"] += 1;
    }
    return t;
  }, [items]);

  const depotLabel = useMemo(() => {
    if (!depotId) return "Tous les dépôts";
    const d = depots.find((x) => String(x.id) === String(depotId));
    return d ? `${d.code} — ${d.libelle}` : "—";
  }, [depotId, depots]);

  async function handleFullExport(format) {
    setExportLoading(true);
    try {
      const params = { seuil: Number(jours), ...(depotId ? { depotId } : {}) };
      if (format === "pdf") {
        const res = await api.get("rapports/dead-stock", { params });
        await exportDeadStockReportPdf({
          report: res.data,
          depotLabel,
          clientBranding: { nom: societeName, logo: societeLogo },
        });
      } else {
        await exportDeadStockReportExcel(api, params);
      }
    } catch (e) {
      showToast?.(getAxiosErrorMessage(e), "error");
    } finally {
      setExportLoading(false);
    }
  }

  const totalItems = items.length || 1;
  const alertThreshold = data?.seuilAlerteMontant ?? threshold;
  const showAlert = data?.alerteMontantEleve || (data?.totalValeurBloquee || 0) > alertThreshold;
  const severityWarm = showAlert || items.length > 5;

  return (
    <div className="space-y-4">
      <div className="dead-filter-card relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-[0.1] blur-2xl"
          style={{ background: "radial-gradient(circle, #94a3b8, #64748b, transparent 70%)" }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end gap-4">
          <div className="w-full sm:min-w-[200px] sm:flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              Dépôt <span className="font-normal normal-case text-[var(--text-secondary)]">(optionnel)</span>
            </label>
            <div className="dead-select-wrap">
              <SearchableSelect
                value={depotId}
                onChange={setDepotId}
                options={depots.map((d) => ({
                  value: String(d.id),
                  label: d.libelle || d.nom ? `${d.code} — ${d.libelle || d.nom}` : d.code,
                }))}
                placeholder="Tous dépôts"
                clearLabel="Tous"
                aria-label="Filtrer par dépôt"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="mb-1 w-full text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] sm:mb-0 sm:w-auto sm:self-center">
              Immobile depuis
            </span>
            {DEAD_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setJours(d)}
                className={`dead-period-btn rounded-full px-3.5 py-1.5 text-xs ${jours === d ? "dead-period-btn--active" : ""}`}
              >
                {d} jours
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Taux de possession
            </label>
            <select
              value={String(tauxEffectif)}
              onChange={async (e) => {
                const next = e.target.value;
                setTaux(next);
                if (!canWrite) return;
                try {
                  await api.patch("cout-stockage/parametres", { tauxPossessionAnnuel: Number(next) });
                  showToast?.(`Taux de possession enregistré : ${next} % / an`);
                } catch {
                  showToast?.(`Taux appliqué à l'analyse : ${next} % / an`);
                }
              }}
              className="rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: "var(--border-default)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
              aria-label="Taux annuel de possession"
            >
              {[1, 2, 3, 5, 8, 12].map((n) => (
                <option key={n} value={n}>{n} % / an</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        className={`dead-summary-card relative overflow-hidden rounded-2xl p-5 ${severityWarm ? "dead-summary-card--warn" : ""}`}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-[0.14] blur-2xl"
          style={{
            background: showAlert
              ? "radial-gradient(circle, #E24B4A, #BA7517, transparent 70%)"
              : "radial-gradient(circle, #64748b, #94a3b8, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">Valeur immobilisée (CMP)</p>
            <p className="cout-kpi-value text-[28px] font-bold tabular-nums" style={{ color: "#E24B4A" }}>
              <AnimatedNumber value={data?.totalValeurBloquee || 0} decimals={3} suffix=" TND" />
            </p>
          </div>
          <div className="hidden h-12 w-px sm:block" style={{ background: "color-mix(in srgb, var(--text-muted) 30%, var(--border-default))" }} />
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">Coût mensuel dormant</p>
            <p className="cout-kpi-value text-[28px] font-bold tabular-nums" style={{ color: "#BA7517" }}>
              <AnimatedNumber value={coutMensuelDormant} decimals={3} suffix=" TND/mois" />
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {showAlert && (
              <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ border: "1px solid rgba(226,75,74,0.45)", background: "rgba(226,75,74,0.12)", color: "#E24B4A" }}>
                Alerte : dépasse {fmtNum(alertThreshold)} TND
              </span>
            )}
            <button type="button" disabled={exportLoading || !items.length} onClick={() => handleFullExport("pdf")} className={PRIMARY_BTN_SM_CLASSES} style={primaryButtonStyle}>
              <IconFileTypePdf size={14} stroke={1.75} /> Export rapport complet
            </button>
            <button type="button" disabled={exportLoading || !items.length} onClick={() => handleFullExport("excel")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50">
              <IconDownload size={14} stroke={1.75} /> Excel
            </button>
            <button type="button" onClick={() => exportDeadStockCsv(items)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
              <IconDownload size={14} stroke={1.75} /> CSV
            </button>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "> 90 jours", count: tranches[">90j"], color: "#E24B4A", gradientTo: "#F06B6A" },
            { label: "60 – 90 jours", count: tranches["60-90j"], color: "#BA7517", gradientTo: "#E8A020" },
            { label: "30 – 60 jours", count: tranches["30-60j"], color: "#1D9E75", gradientTo: "#2BC492" },
          ].map((t, i) => {
            const tranchePct = totalItems > 0 ? (t.count / totalItems) * 100 : 0;
            const grav = gravityRingColors(tranchePct);
            return (
              <CoutKpiCard
                key={t.label}
                delayIndex={i}
                title={t.label}
                value={t.count}
                accentColor={t.color}
                gradientTo={t.gradientTo}
                subtitle={`${tranchePct.toFixed(0)}% du stock dormant · ${t.count} article(s)`}
                ring={{
                  value: tranchePct,
                  max: 100,
                  color: grav.color,
                  gradientTo: grav.gradientTo,
                  label: "part",
                  size: 58,
                  formatValue: () => `${Math.round(tranchePct)}%`,
                }}
              />
            );
          })}
        </div>
      )}

      <CoutDashedSeparator />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <CoutCardSkeleton key={i} delayIndex={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
          <CoutEmptyState
            icon={IconTrendingUp}
            accentColor="#1D9E75"
            title="Aucun stock immobilisé — rotation saine"
            description={`Aucun article ne dépasse le seuil de ${jours} jours sans mouvement${depotId ? " pour ce dépôt" : ""}.`}
          />
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.slice((page - 1) * DEAD_PAGE_SIZE, page * DEAD_PAGE_SIZE).map((row, i) => {
            const badge = immobileBadge(row.joursImmobilise);
            const coutEst = Number(row.coutMensuel ?? (Number(row.valeurBloquee || 0) * tauxEffectif) / 100 / 12);
            const overThreshold = showAlert && row.joursImmobilise > 90;
            const gravPct = Math.min(100, (row.joursImmobilise / 180) * 100);
            const grav = gravityRingColors(gravPct);
            const severityClass =
              row.joursImmobilise > 90
                ? "dead-stock-card--critical"
                : row.joursImmobilise >= 60
                  ? "dead-stock-card--warn"
                  : "dead-stock-card--ok";
            return (
              <div
                key={`${row.articleId}-${row.depotId}`}
                className={`dead-stock-card ${severityClass} cout-row-enter relative flex gap-3 overflow-hidden rounded-xl p-[0.85rem] ${overThreshold ? "cout-kpi-pulse-halo" : ""}`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <ProgressRing
                  value={gravPct}
                  max={100}
                  color={grav.color}
                  gradientTo={grav.gradientTo}
                  label="gel"
                  size={52}
                  formatValue={() => `${row.joursImmobilise}j`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">{row.article?.libelle}</p>
                  <p className="font-mono text-[11px] text-[var(--text-muted)]">{row.article?.code}</p>
                  <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${badge.color}20`, color: badge.color, border: `0.5px solid ${badge.color}40` }}>
                    {badge.label}
                  </span>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                    Qté {fmtNum(row.quantite)} · Valeur {fmtNum(row.valeurBloquee)} TND ({row.valeurSource === "cmp" ? "CMP" : "PA"}) · {row.joursImmobilise} j sans mvt
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold" style={{ color: "#BA7517" }}>{fmtNum(coutEst)}/mois</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Coût d&apos;immobilisation</p>
                </div>
              </div>
            );
          })}
        </div>
        {items.length > DEAD_PAGE_SIZE && (
          <div className="mt-4">
            <Pagination page={page} pages={Math.ceil(items.length / DEAD_PAGE_SIZE)} onPageChange={setPage} />
          </div>
        )}
        </>
      )}
    </div>
  );
}

const PROFITABILITY_SOURCE_BADGES = {
  coutDedicace: { label: "Coût dédié", color: "#378ADD" },
  poidsReel: { label: "Poids réel", color: "#1D9E75" },
  repartitionEgale: { label: "Répartition égale", color: "#BA7517" },
  valorisation: { label: "CMP/FIFO", color: "#378ADD" },
  prixAchatBrut: { label: "Prix d'achat", color: "#BA7517" },
};

function ProfitabilitySourceBadge({ source, delay = 0 }) {
  const cfg = PROFITABILITY_SOURCE_BADGES[source];
  if (!cfg) return null;
  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: delay * 0.05 }}
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium normal-case"
      style={{
        background: `${cfg.color}18`,
        color: cfg.color,
        border: `0.5px solid ${cfg.color}40`,
      }}
    >
      {cfg.label}
    </motion.span>
  );
}

function RentabiliteTab({ depots, articles }) {
  const navigate = useNavigate();
  const societeScope = useSocieteQueryScope();
  const [depotId, setDepotId] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["cout-kpi-rentabilite", societeScope, depotId],
    queryFn: () => api.get("cout-stockage/kpi-rentabilite", { params: { ...(depotId ? { depotId } : {}) } }).then((r) => r.data),
    staleTime: 30000,
  });
  const rows = data?.items || [];
  const kpis = data?.kpis || {};

  return (
    <div className="space-y-4" style={{ animation: "tabContent 0.2s ease both" }}>
      <ProfitabilityCard articles={articles} depots={depots} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <SearchableSelect
            value={depotId}
            onChange={setDepotId}
            options={depots.map((d) => ({
              value: String(d.id),
              label: d.libelle || d.nom ? `${d.code} — ${d.libelle || d.nom}` : d.code,
            }))}
            placeholder="Tous dépôts"
            clearLabel="Tous"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/rentabilite")}
            className={SECONDARY_BTN}
          >
            Analyse complète
          </button>
          <button
            type="button"
            disabled={!rows.length}
            onClick={() =>
              exportCsvFromRows(
                rows.map((r) => ({
                  Article: r.article?.libelle,
                  Depot: r.depot?.code,
                  "Prix vente moy.": r.prixVenteMoyen,
                  CMP: r.cmp,
                  "Coût stockage": r.coutStockage,
                  "Marge nette": r.margeNette,
                  "Taux marge %": r.tauxMarge,
                })),
                `rentabilite-stockage-${new Date().toISOString().slice(0, 10)}.csv`
              )
            }
            className={SECONDARY_BTN}
          >
            <IconDownload size={16} stroke={1.75} /> CSV
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CoutKpiCard delayIndex={0} title="Articles" value={kpis.articles || 0} icon={Package} accentColor="#7F77DD" gradientTo="#A89EF0" />
        <CoutKpiCard delayIndex={1} title="Marge nette cumulée" value={kpis.totalMargeNette || 0} isCurrency icon={Coins} accentColor="#1D9E75" gradientTo="#2BC492" />
        <CoutKpiCard delayIndex={2} title="Taux de marge moyen" value={kpis.avgTauxMarge || 0} icon={IconTrendingUp} accentColor="#378ADD" gradientTo="#5BA3F5" formatValue={(v) => `${Number(v).toFixed(1)} %`} />
        <CoutKpiCard delayIndex={3} title="Articles déficitaires" value={kpis.negatives || 0} icon={IconAlertCircle} accentColor="#E24B4A" gradientTo="#F06B6A" subtitle={`${kpis.positives || 0} positifs`} />
      </div>
      <div className="overflow-x-auto">
        <div className="hidden min-w-[900px] grid-cols-[2fr_repeat(5,1fr)] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider md:grid" style={{ background: "var(--color-background-secondary, var(--bg-card))", color: "var(--text-muted)", letterSpacing: "0.05em" }}>
          {["ARTICLE", "PRIX VENTE MOY.", "CMP", "COÛT STOCKAGE", "MARGE NETTE", "TAUX MARGE %"].map((h) => (
            <span key={h} className={h !== "ARTICLE" ? "text-right" : ""}>{h}</span>
          ))}
        </div>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CoutTableRowSkeleton key={i} columns={6} delayIndex={i} />)
        ) : rows.length === 0 ? (
          <CoutEmptyState
            icon={IconTrendingUp}
            accentColor="#D4537E"
            title="Aucune donnée de rentabilité"
            description="Sélectionnez un dépôt avec du stock et des ventes pour analyser les marges par article."
          />
        ) : (
          rows.map((row, i) => {
            const t = Number(row.tauxMarge || 0);
            const mc = t >= 20 ? "#1D9E75" : t >= 10 ? "#BA7517" : "#E24B4A";
            return (
              <div key={`${row.article?.id}-${row.depot?.id}`} className="cout-data-row cout-row-enter mb-2 grid min-w-[900px] grid-cols-[2fr_repeat(5,1fr)] items-center gap-2 rounded-xl border border-[var(--border-default)] px-3 py-3 md:grid" style={{ background: "var(--bg-card)", animationDelay: `${i * 45}ms`, "--row-accent": mc }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{row.article?.libelle}</p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>{row.depot?.code}</p>
                </div>
                <span className="text-right text-xs font-mono" style={{ color: "#1D9E75" }}>{fmtNum(row.prixVenteMoyen)}</span>
                <span className="text-right text-xs font-mono" style={{ color: "#378ADD" }}>{fmtNum(row.cmp)}</span>
                <span className="text-right text-xs font-mono" style={{ color: "#BA7517" }}>{fmtNum(row.coutStockage)}</span>
                <span className="text-right text-xs font-mono font-semibold" style={{ color: row.margeNette >= 0 ? "#1D9E75" : "#E24B4A" }}>{fmtNum(row.margeNette)}</span>
                <span className="text-right">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${mc}20`, color: mc, border: `0.5px solid ${mc}40` }}>
                    {t.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
                  </span>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ProfitabilityCard({ articles, depots }) {
  const [articleId, setArticleId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function calc() {
    if (!articleId || !depotId) return setErr("Article et dépôt requis");
    setLoading(true);
    setErr("");
    try {
      const r = await api.get(`cout-stockage/profitability/${articleId}`, { params: { depotId } });
      setResult(r.data);
    } catch (e) {
      setErr(getAxiosErrorMessage(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const qty = Number(result?.quantiteStock || 0);
  const storageUnit = Number(result?.storageCostUnitaire ?? result?.storageCost ?? 0);
  const margePct = result && result.prixVente > 0 ? (result.netMargin / result.prixVente) * 100 : 0;
  const margeColor = margePct > 20 ? "#1D9E75" : margePct >= 10 ? "#BA7517" : "#E24B4A";
  const coutTotalUnit = result ? Number(result.prixAchat || 0) + storageUnit : 0;
  const coutSourceBadge = result?.coutSource ? (
    <ProfitabilitySourceBadge source={result.coutSource} delay={1} />
  ) : null;
  const storageSourceBadge = result?.storageCostSource ? (
    <ProfitabilitySourceBadge source={result.storageCostSource} delay={2} />
  ) : null;

  const breakdownRows = result
    ? [
        {
          label: "Prix achat / unité",
          amount: `${fmtNum(result.prixAchat)} TND`,
          pct: coutTotalUnit > 0 ? `${Math.round((result.prixAchat / coutTotalUnit) * 100)}%` : "—",
          color: "#378ADD",
          badge: coutSourceBadge,
        },
        {
          label: "Coût stockage / unité",
          amount: `${fmtNum(storageUnit)} TND`,
          pct: coutTotalUnit > 0 ? `${Math.round((storageUnit / coutTotalUnit) * 100)}%` : "—",
          color: "#BA7517",
          badge: storageSourceBadge,
        },
        { label: "TOTAL coût / unité", amount: `${fmtNum(coutTotalUnit)} TND`, pct: "100%", color: "#E24B4A" },
        { label: "Prix vente / unité", amount: `${fmtNum(result.prixVente)} TND`, pct: "—", color: "#1D9E75" },
        {
          label: "MARGE NETTE / unité",
          amount: `${fmtNum(result.netMargin)} TND`,
          pct: `${margePct.toFixed(1)}%`,
          bold: true,
        },
      ]
    : [];

  return (
    <div className="cout-profit-card">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-lg"
          style={{ background: "#7F77DD", color: "#fff" }}
        >
          <IconCalculator size={22} stroke={1.75} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Calculateur de rentabilité</h3>
          <p className="text-xs text-[var(--text-muted)]">Tous les montants ci-dessous sont par unité</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:flex-1 sm:max-w-[220px]">
          <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>Article</label>
          <SearchableSelect value={articleId} onChange={setArticleId} options={articles.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.libelle}` }))} placeholder="Article" allowClear={false} />
        </div>
        <div className="w-full sm:flex-1 sm:max-w-[180px]">
          <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>Dépôt</label>
          <SearchableSelect
            value={depotId}
            onChange={setDepotId}
            options={depots.map((d) => ({
              value: String(d.id),
              label: d.libelle || d.nom ? `${d.code} — ${d.libelle || d.nom}` : d.code,
            }))}
            placeholder="Dépôt"
            allowClear={false}
          />
        </div>
        <button type="button" onClick={calc} disabled={loading} className={SECONDARY_BTN}>
          {loading ? <IconLoader2 size={16} stroke={1.75} className="animate-spin" /> : <IconCalculator size={16} stroke={1.75} />}
          Calculer
        </button>
      </div>
      {err && <p className="mt-2 text-xs" style={{ color: "#E24B4A" }}>{err}</p>}
      {result && (
        <div className="mt-4 space-y-4" style={{ animation: "fadeUp 0.35s ease both" }}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <CoutKpiCard
              delayIndex={0}
              title="Prix achat"
              value={result.prixAchat}
              isCurrency
              icon={Coins}
              accentColor="#378ADD"
              gradientTo="#5BA3F5"
            />
            <CoutKpiCard
              delayIndex={1}
              title="Prix vente"
              value={result.prixVente}
              isCurrency
              icon={Receipt}
              accentColor="#1D9E75"
              gradientTo="#2BC492"
            />
            <CoutKpiCard
              delayIndex={2}
              title={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  Marge brute
                  {coutSourceBadge}
                </span>
              }
              value={result.grossMargin}
              isCurrency
              icon={Receipt}
              accentColor={result.grossMargin >= 0 ? "#1D9E75" : "#E24B4A"}
              gradientTo={result.grossMargin >= 0 ? "#2BC492" : "#F06B6A"}
            />
            <CoutKpiCard
              delayIndex={3}
              title="Rentabilité nette"
              value={margePct}
              icon={CalendarCheck}
              accentColor={margeColor}
              gradientTo={margePct > 20 ? "#2BC492" : margePct >= 10 ? "#E8A020" : "#F06B6A"}
              formatValue={(v) => `${Number(v).toFixed(1)}%`}
            />
          </div>
          <ProfitabilityComparisonBar coutTotal={coutTotalUnit} prixVente={result.prixVente} />
          {qty > 0 && (
            <p className="text-[11px] text-[var(--text-muted)]">
              Stock actuel : {qty.toLocaleString("fr-FR")} · Marge nette totale {fmtNum(result.netMarginTotal ?? result.netMargin * qty)} TND · Coût stockage total {fmtNum(result.storageCostTotal ?? storageUnit * qty)} TND
            </p>
          )}
          <ProfitabilityBreakdown rows={breakdownRows} margePct={result.netMargin} />
          <ProfitabilityVerdict
            tauxMarge={margePct}
            ringSlot={
              <ProgressRing
                value={Math.max(0, margePct)}
                max={100}
                color={margeColor}
                gradientTo={margePct > 20 ? "#2BC492" : margePct >= 10 ? "#E8A020" : "#F06B6A"}
                label="marge nette"
                size={72}
                formatValue={() => `${margePct.toFixed(1)}%`}
              />
            }
          />
        </div>
      )}
    </div>
  );
}

export default function CoutStockage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const societeScope = useSocieteQueryScope();
  const canRead = hasPermission(user?.role, "valorisation:read");
  const canWrite = hasPermission(user?.role, "stock:write");

  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState(null);
  const [unitDelete, setUnitDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const tabsContainerRef = useRef(null);
  const tabButtonRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });
  const tabFromUrl = searchParams.get("tab");
  const activeTab = TAB_IDS.includes(tabFromUrl) ? tabFromUrl : "unitaires";

  const setActiveTab = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const updateTabIndicator = useCallback(() => {
    const container = tabsContainerRef.current;
    const btn = tabButtonRefs.current[activeTab];
    if (!container || !btn) return;
    const cRect = container.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    setTabIndicator({ left: bRect.left - cRect.left, width: bRect.width });
  }, [activeTab]);

  useLayoutEffect(() => {
    updateTabIndicator();
  }, [updateTabIndicator]);

  useEffect(() => {
    window.addEventListener("resize", updateTabIndicator);
    return () => window.removeEventListener("resize", updateTabIndicator);
  }, [updateTabIndicator]);

  useEffect(() => {
    setModal(null);
  }, [activeTab]);

  const { data, isLoading } = useQuery({
    queryKey: ["cout-stockage", societeScope],
    queryFn: () => api.get("cout-stockage", { params: { limit: 500 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: articlesData } = useQuery({
    queryKey: ["articles", "cout", societeScope],
    queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots", "cout", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 100 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: allCoutEntries } = useQuery({
    queryKey: ["cout-entries-all", societeScope],
    queryFn: () => {
      const curMonth = new Date().toISOString().slice(0, 7);
      return api.get("cout-stockage/cout-entries", { params: { periode: curMonth } }).then((r) => (Array.isArray(r.data) ? r.data : []));
    },
    enabled: canRead,
  });

  const { data: deadStockData } = useQuery({
    queryKey: ["dead-stock-pdf", societeScope],
    queryFn: () => api.get("cout-stockage/dead-stock", { params: { jours: 90 } }).then((r) => r.data),
    enabled: canRead,
  });

  const { data: publicCompanies = [] } = useQuery({
    queryKey: ["companies", "public", "cout-stockage", societeScope],
    queryFn: () => api.get("companies/public").then((r) => r.data),
    enabled: canRead,
  });

  const societeBranding = useMemo(() => {
    const sid =
      user?.role === "SUPER_ADMIN"
        ? activeSocieteId ?? societeScope
        : user?.societeId ?? societeScope;
    const match =
      publicCompanies.find((c) => Number(c.id) === Number(sid)) ||
      (user?.societe?.code
        ? publicCompanies.find(
            (c) => String(c.code).toLowerCase() === String(user.societe.code).toLowerCase()
          )
        : null);
    return {
      nom: match?.nom || user?.societe?.nom || user?.societeNom || "—",
      logo: match?.logo ?? user?.societe?.logo ?? null,
    };
  }, [publicCompanies, user, activeSocieteId, societeScope]);

  const items = asItems(data);
  const coutEntriesAll = allCoutEntries || [];
  const articles = asItems(articlesData);
  const depots = asItems(depotsData);

  const stats = useMemo(() => {
    const now = new Date();
    const actives = items.filter((c) => {
      const start = c.periodeDebut ? new Date(c.periodeDebut) : null;
      const end = c.periodeFin ? new Date(c.periodeFin) : null;
      return start && start <= now && (!end || end >= now);
    }).length;
    const totalCout = items.reduce((s, c) => s + Number(c.coutUnitaire || 0), 0);
    return {
      count: items.length,
      articles: new Set(items.map((i) => i.articleId)).size,
      moyenne: items.length ? totalCout / items.length : 0,
      actives,
    };
  }, [items]);

  const globalSummary = useMemo(() => {
    const totalCeMois = coutEntriesAll.reduce((s, e) => s + Number(e.montant || 0), 0);
    const depotsActifs = new Set(coutEntriesAll.map((e) => e.depotId)).size;
    return { totalCeMois, depotsActifs };
  }, [coutEntriesAll]);

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`cout-stockage/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cout-stockage"] });
      qc.invalidateQueries({ queryKey: ["cout-imputation"] });
      showToast("Coût unitaire supprimé", "warning");
      setModal(null);
      setUnitDelete(null);
    },
    onError: (e) => showToast(getAxiosErrorMessage(e), "error"),
  });

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  if (!canRead) {
    return (
      <PageShell title="Coûts de stockage" subtitle="Valorisation et charges logistiques">
        <CoutEmptyState
          icon={IconLock}
          accentColor="#E24B4A"
          title="Accès restreint"
          description="Votre rôle ne permet pas d’ouvrir le module Coûts de stockage. Demandez le droit « valorisation » à un administrateur."
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="" subtitle="">
      <div className="cout-page space-y-5">
        <GlassPageHeader
          title="Coûts de stockage"
          subtitle="Suivi des frais logistiques par article et dépôt"
          icon={IconCoin}
          badge="Logistique"
          chips={
            <>
              <span className="page-hero__chip page-hero__chip--sky">
                <strong>{fmtNum(globalSummary.totalCeMois)}</strong>
                <span>TND ce mois</span>
              </span>
              <span className="page-hero__chip page-hero__chip--emerald">
                <strong>{stats.articles}</strong>
                <span>articles suivis</span>
              </span>
              <span className="page-hero__chip page-hero__chip--sky">
                <strong>{globalSummary.depotsActifs}</strong>
                <span>dépôts actifs</span>
              </span>
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await exportCoutStockagePdf({
                      clientBranding: societeBranding,
                      depotLabel: "Tous",
                      periodeLabel: currentYm(),
                      depotMensuels: coutEntriesAll,
                      unitCosts: items,
                      deadStock: deadStockData,
                      topArticles: [...items].sort((a, b) => Number(b.coutUnitaire) - Number(a.coutUnitaire)),
                    });
                  } catch (e) {
                    showToast(getAxiosErrorMessage(e), "error");
                  }
                }}
                className="page-hero__import inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-sky-50"
              >
                <IconFileTypePdf size={15} stroke={1.75} /> Export PDF
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await exportCoutStockageExcel(api, {
                      periode: currentYm(),
                    });
                  } catch (e) {
                    showToast(getAxiosErrorMessage(e), "error");
                  }
                }}
                className="page-hero__import inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-sky-50"
              >
                <IconDownload size={15} stroke={1.75} /> Export Excel
              </button>
              {canWrite && activeTab === "unitaires" && (
                <button
                  type="button"
                  onClick={() => setModal({ type: "create" })}
                  className={`${PRIMARY_BTN} page-hero__create`}
                  style={primaryButtonStyle}
                >
                  <IconPlus size={16} stroke={2.25} />
                  Nouveau coût
                </button>
              )}
            </>
          }
        />

        {toast && (
          <p
            className="cout-toast px-4 py-3 text-sm font-medium"
            style={
              toast.type === "success"
                ? { border: "1px solid #1D9E75", background: "var(--bg-card)", color: "#1D9E75", borderLeft: "4px solid #1D9E75" }
                : toast.type === "error"
                  ? { border: "1px solid #E24B4A", background: "var(--bg-card)", color: "#E24B4A", borderLeft: "4px solid #E24B4A" }
                  : { border: "1px solid #BA7517", background: "var(--bg-card)", color: "#BA7517", borderLeft: "4px solid #BA7517" }
            }
          >
            {toast.msg}
          </p>
        )}

        {/* Tab bar — indicateur glissant + hover teinté */}
        <div className="cout-tabs-wrap overflow-x-auto">
          <div
            ref={tabsContainerRef}
            className="cout-tabs"
            role="tablist"
            aria-label="Sections coûts de stockage"
            onKeyDown={(e) => {
              const idx = TAB_IDS.indexOf(activeTab);
              if (idx < 0) return;
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = e.key === "ArrowRight"
                  ? TAB_IDS[(idx + 1) % TAB_IDS.length]
                  : TAB_IDS[(idx - 1 + TAB_IDS.length) % TAB_IDS.length];
                setActiveTab(next);
                tabButtonRefs.current[next]?.focus();
              }
            }}
          >
            <div
              className="cout-tab-indicator pointer-events-none"
              style={{
                left: tabIndicator.left,
                width: tabIndicator.width,
                "--cout-tab-accent": TAB_ACTIVE_STYLE[activeTab]?.color || "#7F77DD",
              }}
              aria-hidden
            />
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const TabIcon = tab.Icon;
              const activeStyle = TAB_ACTIVE_STYLE[tab.id];
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabButtonRefs.current[tab.id] = el; }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`cout-tab-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${active ? "cout-tab-btn--active" : ""}`}
                  style={{
                    color: active ? activeStyle.color : "var(--text-secondary, var(--color-text-secondary))",
                    "--cout-tab-hover-color": activeStyle.color,
                    "--cout-tab-hover-bg": activeStyle.bg,
                  }}
                >
                  <TabIcon size={15} stroke={1.75} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div key={activeTab} className="cout-tab-panel">
          {activeTab === "depot" && <DepotMensuelTab depots={depots} canWrite={canWrite} showToast={showToast} />}
          {activeTab === "dormant" && (
            <DeadStockTab
              depots={depots}
              showToast={showToast}
              societeLogo={societeBranding.logo}
              societeName={societeBranding.nom}
              canWrite={canWrite}
            />
          )}
          {activeTab === "rotation" && <RotationReportContent embedded />}
          {activeTab === "rentabilite" && <RentabiliteTab depots={depots} articles={articles} />}
          {activeTab === "unitaires" && (
            <UnitairesTab
              depots={depots}
              manualItems={items}
              onGoDepotTab={() => setActiveTab("depot")}
              societeScope={societeScope}
              canWrite={canWrite}
              onEditManual={(cout) => setModal({ type: "edit", cout })}
              onDeleteManual={(cout) => setUnitDelete(cout)}
              deletingManualId={deleteMut.isPending ? unitDelete?.id : null}
            />
          )}
        </div>
      </div>

      {(modal?.type === "create" || modal?.type === "edit") && (
        <CoutModal cout={modal.cout} articles={articles} depots={depots} onClose={() => setModal(null)} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["cout-imputation"] });
          showToast(modal.type === "create" ? "Coût créé" : "Coût mis à jour");
        }} />
      )}
      <DeleteCoutModal
        open={!!unitDelete}
        entry={unitDelete ? { id: unitDelete.id, nom: unitDelete.article?.libelle || "Coût unitaire", montant: unitDelete.coutUnitaire } : null}
        deleting={deleteMut.isPending}
        onConfirm={(id) => deleteMut.mutate(id)}
        onClose={() => setUnitDelete(null)}
      />
    </PageShell>
  );
}


