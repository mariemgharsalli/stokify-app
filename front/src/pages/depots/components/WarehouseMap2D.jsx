import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Box,
  FileText,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  Package,
  ScanLine,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import BarcodeScanner from "./BarcodeScanner";
import { parseScannedCode } from "../../../utils/qrPayload";
import { exportWarehousePDF } from "./exportWarehousePDF";
import IsometricWarehouse, { IsometricLegend } from "./IsometricWarehouse";
import { useClientBranding } from "../../../hooks/useClientBranding";
import { DEPOT_ACCENT, DEPOT_CYAN } from "../depotsTheme";
import { buildClientLayout, emplacementCapaciteUnits, isSaneLayoutCoord, MAX_LAYOUT_DIM } from "../warehouseLayout";

const FAMILLE_COLORS = ["#1D9E75", "#378ADD", "#EF9F27", "#0EA5E9", "#E24B4A", "#06B6D4"];

const MAP_ANIMATIONS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(16px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes cellAppear {
    from { opacity: 0; transform: translateY(12px) scale(0.9); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes mapGaugeFill {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  @keyframes mapCellPulse {
    0%, 100% { opacity: 0.28; stroke-width: 2; }
    50% { opacity: 0.85; stroke-width: 2.8; }
  }
  @keyframes mapShineSweep {
    0% { opacity: 0.12; transform: translateY(0); }
    50% { opacity: 0.42; transform: translateY(1px); }
    100% { opacity: 0.12; transform: translateY(0); }
  }
  @keyframes mapCanvasGlow {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 0.85; }
  }
  @keyframes mapToolbarShine {
    from { transform: translateX(-120%); }
    to { transform: translateX(120%); }
  }
  .map-toolbar-pro {
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(135deg, color-mix(in srgb, #0B1F3A 92%, #378ADD) 0%, #0B1F3A 55%, color-mix(in srgb, #0B1F3A 88%, #0EA5E9) 100%);
    box-shadow: 0 18px 40px -22px rgba(11, 31, 58, 0.55);
  }
  .map-toolbar-pro::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%);
    animation: mapToolbarShine 4.5s ease-in-out infinite;
    pointer-events: none;
  }
  .map-canvas-pro {
    position: relative;
    isolation: isolate;
    min-height: 680px;
  }
  .map-canvas-pro::before {
    content: "";
    position: absolute;
    inset: -20% auto auto 18%;
    width: 280px;
    height: 280px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(55,138,221,0.18), transparent 68%);
    animation: mapCanvasGlow 5s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }
  .map-canvas-pro::after {
    content: "";
    position: absolute;
    inset: auto 12% -18% auto;
    width: 240px;
    height: 240px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(14,165,233,0.14), transparent 70%);
    animation: mapCanvasGlow 6.5s ease-in-out infinite reverse;
    pointer-events: none;
    z-index: 0;
  }
  .map-cell-shine {
    animation: mapShineSweep 3.2s ease-in-out infinite;
  }
  @keyframes mapLedPulse {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 1; }
  }
  .map-bay-tile { cursor: pointer; }
  .map-hud-corner {
    position: absolute;
    width: 28px;
    height: 28px;
    pointer-events: none;
    z-index: 2;
    border-color: rgba(56, 189, 248, 0.45);
  }
  .map-hud-tl { top: 14px; left: 14px; border-top: 2px solid; border-left: 2px solid; border-radius: 4px 0 0 0; }
  .map-hud-tr { top: 14px; right: 14px; border-top: 2px solid; border-right: 2px solid; border-radius: 0 4px 0 0; }
  .map-hud-bl { bottom: 14px; left: 14px; border-bottom: 2px solid; border-left: 2px solid; border-radius: 0 0 0 4px; }
  .map-hud-br { bottom: 14px; right: 14px; border-bottom: 2px solid; border-right: 2px solid; border-radius: 0 0 4px 0; }
  @keyframes mapLiquidRise {
    from { transform: scaleY(0.08); }
    to { transform: scaleY(1); }
  }
  .map-liquid {
    transform-origin: center bottom;
    animation: mapLiquidRise 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .map-cell-g, .map-gauge-bar, .map-cell-pulse, .map-cell-shine,
    .map-toolbar-pro::after, .map-canvas-pro::before, .map-canvas-pro::after,
    .map-led, .map-liquid {
      animation: none !important;
    }
  }
`;

/** Couleurs de carte assez claires, mais avec assez de contraste pour le texte foncé. */
function occupationColor(rate) {
  if (rate < 50) return "#34d399";
  if (rate <= 80) return "#fbbf24";
  return "#f87171";
}

function occupationSoft(rate) {
  if (rate < 50) return "#a7f3d0";
  if (rate <= 80) return "#fde68a";
  return "#fecaca";
}

/** Encre claire sur cartes navy (lisibles en clair et sombre). */
const CARD_INK = "#F8FAFC";
const CARD_INK_MUTED = "rgba(248,250,252,0.68)";

function EmplacementHoverCard({ cell }) {
  if (!cell) return null;
  const { em, stockInfo, rate, capaciteUnites } = cell;
  const isEmpty = stockInfo.qty === 0;
  const occPct = Math.min(100, Math.max(0, rate));
  const color = isEmpty ? "var(--text-muted)" : occupationColor(rate);
  const articles = stockInfo.items?.slice(0, 3) ?? [];
  const cap = capaciteUnites || emplacementCapaciteUnits(em);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none absolute left-5 top-5 z-30 w-[300px] overflow-hidden rounded-2xl border px-4 py-3.5"
      style={{
        background: "color-mix(in srgb, var(--bg-modal) 92%, transparent)",
        borderColor: "color-mix(in srgb, #378ADD 28%, var(--border-default))",
        boxShadow: "0 20px 44px -18px rgba(11, 31, 58, 0.45)",
        backdropFilter: "blur(12px)",
      }}
      role="tooltip"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${color}, ${DEPOT_CYAN})` }}
      />
      <div className="mb-2.5 flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <MapPin size={14} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-[var(--text-primary)]">{em.code}</p>
          <p className="truncate text-[11px] text-[var(--text-secondary)]">
            {em.libelle || "Sans libellé"}
          </p>
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-[var(--text-muted)]">Occupation</span>
          <span className="font-semibold tabular-nums" style={{ color }}>
            {isEmpty ? "Vide" : `${occPct.toFixed(0)}%`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${isEmpty ? 0 : occPct}%`, background: color }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>{(stockInfo.qty || 0).toLocaleString("fr-FR")} unités</span>
          <span>Cap. {cap.toLocaleString("fr-FR")}</span>
        </div>
      </div>

      {em.zoneDangereuse && (
        <p className="mb-2 rounded-lg px-2 py-1 text-[10px] font-medium" style={{ background: "var(--warning-bg)", color: "var(--accent-warning)" }}>
          ⚠ Zone dangereuse
        </p>
      )}

      {isEmpty ? (
        <p className="text-[11px] text-[var(--text-muted)]">Aucun article stocké</p>
      ) : (
        <div className="space-y-1 border-t border-[var(--border-default)] pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Articles ({stockInfo.items?.length || 0})
          </p>
          {articles.map((s, i) => (
            <div key={s.id || i} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-[var(--text-secondary)]">
                {s.article?.code || s.article?.libelle || "Article"}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-[var(--text-primary)]">
                {Number(s.quantite).toLocaleString("fr-FR")}
              </span>
            </div>
          ))}
          {(stockInfo.items?.length || 0) > 3 && (
            <p className="text-[10px] text-[var(--text-muted)]">
              +{stockInfo.items.length - 3} autre(s)
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function familleColor(familleId) {
  if (!familleId) return "#64748b";
  return FAMILLE_COLORS[Number(familleId) % FAMILLE_COLORS.length];
}

function computeGridSize(count) {
  const cols = Math.ceil(Math.sqrt(count)) || 1;
  const rows = Math.ceil(count / cols) || 1;
  return { cols, rows };
}

export default function WarehouseMap2D({
  emplacements = [],
  stocks = [],
  depot,
  depotCapacite,
  layout: layoutProp,
  fullscreen = false,
  onToggleFullscreen,
  clientBranding: clientBrandingProp,
}) {
  const navigate = useNavigate();
  const clientBrandingFromHook = useClientBranding();
  const clientBranding = clientBrandingProp ?? clientBrandingFromHook;
  const [scale, setScale] = useState(1);
  const [scale3d, setScale3d] = useState(1);
  const [viewMode, setViewMode] = useState("occupation");
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [searchCode, setSearchCode] = useState("");
  const [gridOpacity, setGridOpacity] = useState(1);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion = useReducedMotion();

  const stockByEmplacement = useMemo(() => {
    const map = new Map();
    for (const s of stocks) {
      if (!s.emplacementId) continue;
      const cur = map.get(s.emplacementId) || { qty: 0, items: [], mainArticle: null, mainFamille: null };
      cur.qty += Number(s.quantite || 0);
      cur.items.push(s);
      if (!cur.mainArticle || Number(s.quantite) > Number(cur.mainArticle.quantite)) {
        cur.mainArticle = s;
        cur.mainFamille = s.article?.familleId;
      }
      map.set(s.emplacementId, cur);
    }
    return map;
  }, [stocks]);

  const layoutMeta = useMemo(() => {
    const coerceId = (id) => {
      const n = Number(id);
      return Number.isFinite(n) ? n : id;
    };
    const fromEmps = emplacements
      .filter((e) => e.layoutCol != null && e.layoutRow != null)
      .map((e) => [
        coerceId(e.id),
        { id: coerceId(e.id), col: Number(e.layoutCol), row: Number(e.layoutRow) },
      ]);
    const fromCells = (layoutProp?.cells || []).map((c) => [
      coerceId(c.id),
      { ...c, id: coerceId(c.id), col: Number(c.col), row: Number(c.row) },
    ]);
    const mergedById = new Map([...fromEmps, ...fromCells]);
    if (layoutProp?.byId instanceof Map) {
      layoutProp.byId.forEach((cell, id) => mergedById.set(coerceId(id), cell));
    }

    const saneEntries = [...mergedById.entries()].filter(([, c]) =>
      isSaneLayoutCoord(c.col, c.row, emplacements.length)
    );
    const saneMap = new Map(saneEntries);
    const apiDimsOk =
      (layoutProp?.cols == null || Number(layoutProp.cols) <= MAX_LAYOUT_DIM) &&
      (layoutProp?.rows == null || Number(layoutProp.rows) <= MAX_LAYOUT_DIM);

    if (saneMap.size === emplacements.length && apiDimsOk) {
      const cols = Math.min(
        MAX_LAYOUT_DIM,
        Math.max(
          1,
          ...[...saneMap.values()].map((c) => (Number(c.col) || 0) + 1),
          Number(layoutProp?.cols) || 0
        )
      );
      const rows = Math.min(
        MAX_LAYOUT_DIM,
        Math.max(
          1,
          ...[...saneMap.values()].map((c) => (Number(c.row) || 0) + 1),
          Number(layoutProp?.rows) || 0
        )
      );
      return {
        ...layoutProp,
        mode: layoutProp?.mode || "api",
        cols,
        rows,
        dock: layoutProp?.dock || { row: 0 },
        aisles: layoutProp?.aisles || [],
        byId: saneMap,
      };
    }
    return buildClientLayout(emplacements);
  }, [layoutProp, emplacements]);

  const cells = useMemo(
    () =>
      emplacements.map((em, idx) => {
        const fromStock = stockByEmplacement.get(em.id);
        const qty =
          fromStock?.qty != null
            ? fromStock.qty
            : Number(em.stockActuel || 0);
        const stockInfo = fromStock || {
          qty,
          items: em.stocks || em.topArticles || [],
          mainArticle: null,
          mainFamille: em.stocks?.[0]?.article?.familleId ?? null,
        };
        if (!fromStock) stockInfo.qty = qty;
        const cap = emplacementCapaciteUnits(em);
        const rate =
          em.remplissagePct != null && fromStock == null
            ? Number(em.remplissagePct)
            : cap > 0
              ? (qty / cap) * 100
              : 0;
        const pos =
          layoutMeta.byId?.get(em.id) ||
          layoutMeta.byId?.get(Number(em.id)) ||
          layoutMeta.byId?.get(String(em.id));
        const fallback = computeGridSize(emplacements.length);
        let col = pos?.col ?? idx % fallback.cols;
        let row = pos?.row ?? 1 + Math.floor(idx / fallback.cols);
        if (!isSaneLayoutCoord(col, row, emplacements.length)) {
          col = idx % fallback.cols;
          row = 1 + Math.floor(idx / fallback.cols);
        }
        return { em, row, col, stockInfo, rate, capaciteUnites: cap };
      }),
    [emplacements, stockByEmplacement, layoutMeta]
  );

  const showDock = useMemo(() => {
    if (cells.length < 4) return false;
    if (layoutMeta.mode === "parsed" && (layoutMeta.allees || []).length > 0) return true;
    if ((layoutMeta.aisles || []).length > 0) return true;
    return cells.length >= 8;
  }, [cells.length, layoutMeta]);

  const placedCells = useMemo(() => {
    const minRow = cells.reduce((m, c) => Math.min(m, Number(c.row) || 0), Infinity);
    const shift = showDock && Number.isFinite(minRow) && minRow <= 0 ? 1 : 0;
    return cells.map((c) => ({
      ...c,
      col: Number(c.col) || 0,
      row: (Number(c.row) || 0) + shift,
    }));
  }, [cells, showDock]);

  const { cols, rows } = useMemo(() => {
    if (!placedCells.length) {
      return { cols: 1, rows: 1 };
    }
    const maxCol = Math.max(...placedCells.map((c) => c.col));
    const maxRow = Math.max(...placedCells.map((c) => c.row));
    return {
      cols: Math.min(MAX_LAYOUT_DIM, Math.max(maxCol + 1, 1)),
      rows: Math.min(MAX_LAYOUT_DIM, Math.max(maxRow + 1, showDock ? 2 : 1)),
    };
  }, [placedCells, showDock]);

  const cellPx = useMemo(() => {
    const c = Math.max(cols, 1);
    const r = Math.max(rows, 1);
    const fit = Math.floor(Math.min(1360 / c, 900 / r));
    return Math.max(118, Math.min(228, fit));
  }, [cols, rows]);

  const mapW = cols * cellPx;
  const mapH = rows * cellPx;
  const viewW = Math.max(mapW, 720);
  const viewH = Math.max(mapH, 520);
  const originX = (viewW - mapW) / 2;

  const hoveredCell = useMemo(
    () => (hovered ? placedCells.find((c) => c.em.id === hovered.id) ?? null : null),
    [placedCells, hovered]
  );

  const highlightId = useMemo(() => {
    const q = searchCode.trim().toLowerCase();
    if (!q) return null;
    const found = cells.find(
      (c) =>
        c.em.code?.toLowerCase().includes(q) ||
        c.em.barcode?.toLowerCase() === q
    );
    return found?.em.id ?? null;
  }, [searchCode, cells]);

  const show3dView = viewMode === "3d";
  const isSvgView = viewMode === "occupation" || viewMode === "articles";

  const mapStats = useMemo(() => {
    const occupied = cells.filter((c) => c.stockInfo.qty > 0).length;
    const critical = cells.filter((c) => c.rate > 80).length;
    const avg =
      cells.length > 0
        ? Math.round(cells.reduce((s, c) => s + (Number(c.rate) || 0), 0) / cells.length)
        : 0;
    return { occupied, critical, avg, total: cells.length };
  }, [cells]);

  useEffect(() => {
    setIsMobile(typeof window !== "undefined" && ("ontouchstart" in window || window.navigator.maxTouchPoints > 0));
  }, []);

  useEffect(() => {
    setGridOpacity(0);
    const t = setTimeout(() => setGridOpacity(1), 80);
    return () => clearTimeout(t);
  }, [viewMode]);

  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => {
      const cellId = viewMode === "3d" ? `iso-cell-${highlightId}` : `cell-${highlightId}`;
      document.getElementById(cellId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => clearTimeout(t);
  }, [highlightId, viewMode]);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleScanDetected = useCallback(
    (code) => {
      setScannerOpen(false);
      const parsed = parseScannedCode(code);
      if (parsed.type === "stock" || parsed.type === "lot") {
        showToast("QR reconnu — ouverture de la fiche", "success");
        navigate(parsed.path);
        return;
      }
      const lookup = parsed.type === "stock-text" ? parsed.emplacement || parsed.articleCode : parsed.value;
      setSearchCode(lookup || code);
      const q = String(lookup || code).trim().toLowerCase();
      const found = cells.find(
        (c) =>
          c.em.code?.toLowerCase() === q ||
          c.em.barcode?.toLowerCase() === q
      );
      if (found) {
        setSelected(found.em);
        showToast(`✓ Emplacement ${found.em.code} localisé`, "success");
        setTimeout(() => {
          const cellId = viewMode === "3d" ? `iso-cell-${found.em.id}` : `cell-${found.em.id}`;
          document.getElementById(cellId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      } else {
        showToast(`Code « ${lookup || code} » non trouvé dans ce dépôt`, "error");
      }
    },
    [cells, navigate, showToast, viewMode]
  );

  const handleExportPDF = async () => {
    if (!cells.length) return;
    setPdfExporting(true);
    try {
      const depotInfo = depot || {
        libelle: emplacements[0]?.depot?.libelle || "Dépôt",
        code: emplacements[0]?.depot?.code || "DEPOT",
      };
      await exportWarehousePDF(depotInfo, cells, cells[0]?.capaciteUnites, viewMode, clientBranding);
      showToast("Plan exporté en PDF", "success");
    } catch {
      showToast("Erreur lors de l'export PDF", "error");
    } finally {
      setPdfExporting(false);
    }
  };

  const viewModes = [
    { key: "occupation", label: "Occupation", icon: BarChart3, color: "#1D9E75" },
    { key: "articles", label: "Articles", icon: Package, color: DEPOT_ACCENT },
    { key: "3d", label: "Vue 3D", icon: Box, color: DEPOT_CYAN },
  ];

  const kpiItems = [
    {
      label: "Occupés",
      value: `${mapStats.occupied}/${mapStats.total}`,
      color: DEPOT_ACCENT,
    },
    {
      label: "Moyenne",
      value: `${mapStats.avg}%`,
      color: DEPOT_CYAN,
    },
    {
      label: "Critiques",
      value: String(mapStats.critical),
      color: mapStats.critical > 0 ? "#E24B4A" : "#1D9E75",
    },
  ];

  return (
    <div
      className={`flex flex-col gap-4 ${fullscreen ? "fixed inset-0 z-[300] overflow-auto p-4" : ""}`}
      style={{
        background: fullscreen ? "var(--color-background-primary, var(--bg-app))" : undefined,
        transition: "all 0.3s ease",
      }}
    >
      <style>{MAP_ANIMATIONS}</style>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="map-toolbar-pro flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/10 p-3.5"
      >
        <div className="relative z-[1] min-w-[170px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/45" />
          <input
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Rechercher un emplacement…"
            className="w-full rounded-xl border border-white/15 bg-white/10 py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-white/40 transition focus:border-sky-400/50 focus:bg-white/15"
          />
        </div>

        <div className="relative z-[1] flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
          {viewModes.map((m) => {
            const Icon = m.icon;
            const active = viewMode === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setViewMode(m.key)}
                className="relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
              >
                {active && (
                  <motion.span
                    layoutId="map-view-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${m.color}, color-mix(in srgb, ${m.color} 55%, #0EA5E9))`,
                      boxShadow: `0 8px 18px -10px ${m.color}`,
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative z-[1] flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" /> {m.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleExportPDF}
          disabled={pdfExporting || cells.length === 0}
          className="relative z-[1] flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pdfExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Exporter
        </button>

        <div className="relative z-[1] flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() =>
              show3dView
                ? setScale3d((s) => Math.max(0.45, +(s - 0.12).toFixed(2)))
                : setScale((s) => Math.max(0.4, +(s - 0.15).toFixed(2)))
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-[11px] font-semibold tabular-nums text-white/80">
            {Math.round((show3dView ? scale3d : scale) * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              show3dView
                ? setScale3d((s) => Math.min(1.85, +(s + 0.12).toFixed(2)))
                : setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2)))
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="relative z-[1] flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white"
            title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        )}

        {isMobile && (
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="relative z-[1] flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-200"
          >
            <ScanLine className="h-3.5 w-3.5" />
            Scanner
          </button>
        )}
      </motion.div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {kpiItems.map((k, i) => (
          <motion.div
            key={k.label}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.06 * i, duration: 0.3 }}
            className="rounded-2xl border px-3.5 py-3"
            style={{
              borderColor: "var(--border-default)",
              background:
                "linear-gradient(160deg, color-mix(in srgb, var(--bg-card) 88%, white), var(--bg-card))",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {k.label}
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums" style={{ color: k.color }}>
              {k.value}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: k.color }}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{
                  width:
                    k.label === "Occupés"
                      ? `${mapStats.total ? (mapStats.occupied / mapStats.total) * 100 : 0}%`
                      : k.label === "Moyenne"
                        ? `${Math.min(100, mapStats.avg)}%`
                        : `${mapStats.total ? Math.min(100, (mapStats.critical / mapStats.total) * 100) : 0}%`,
                }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 space-y-3">
          <div
            className="map-canvas-pro relative overflow-auto rounded-[28px] border p-6 pt-7 transition-opacity duration-200"
            style={{
              opacity: gridOpacity,
              background: show3dView
                ? "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(14,165,233,0.18), transparent 55%), linear-gradient(165deg, #06101c, #0B1F3A 48%, #071525)"
                : "linear-gradient(180deg, #081424 0%, #0B1F3A 100%)",
              borderColor: "color-mix(in srgb, #38BDF8 38%, var(--border-default))",
              boxShadow: "0 28px 64px -30px rgba(8, 20, 36, 0.75), inset 0 1px 0 rgba(255,255,255,0.08)",
              backgroundImage: show3dView
                ? undefined
                : `
                linear-gradient(180deg, #081424 0%, #0B1F3A 100%),
                linear-gradient(rgba(56,189,248,0.09) 1px, transparent 1px),
                linear-gradient(90deg, rgba(14,165,233,0.07) 1px, transparent 1px)
              `,
              backgroundSize: show3dView ? undefined : `auto, ${cellPx}px ${cellPx}px, ${cellPx}px ${cellPx}px`,
            }}
          >
            <span className="map-hud-corner map-hud-tl" />
            <span className="map-hud-corner map-hud-tr" />
            <span className="map-hud-corner map-hud-bl" />
            <span className="map-hud-corner map-hud-br" />
            <div className="relative z-[1] mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300/55">
                  {show3dView ? "Studio volumétrique" : "Cartographie live"}
                </p>
                <p className="text-lg font-semibold tracking-tight text-white">
                  {show3dView
                    ? "Vue 3D — tours d'occupation"
                    : viewMode === "articles"
                      ? "Répartition par famille"
                      : "Baies intelligentes"}
                </p>
              </div>
              <span
                className="rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tabular-nums text-white/90"
              >
                {cols} × {rows} · {cells.length} baies
              </span>
            </div>

            <AnimatePresence>
              {!show3dView && hoveredCell && (
                <EmplacementHoverCard cell={hoveredCell} />
              )}
            </AnimatePresence>
            {show3dView ? (
              <IsometricWarehouse
                cells={placedCells}
                highlightId={highlightId}
                selected={selected}
                hoveredId={hovered?.id ?? null}
                setSelected={setSelected}
                setHovered={setHovered}
                scale={scale3d}
                onZoomChange={setScale3d}
                sceneHeight={fullscreen ? 920 : 800}
                layoutHints={{
                  cols,
                  rows,
                  dock: showDock ? layoutMeta.dock || { row: 0 } : null,
                  aisles: showDock ? layoutMeta.aisles : [],
                }}
              />
            ) : isSvgView ? (
              <svg
                viewBox={`0 0 ${viewW} ${viewH}`}
                width={viewW}
                height={viewH}
                className="relative z-[1] mx-auto block"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: fullscreen ? 900 : 820,
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                  transition: "transform 0.25s ease",
                }}
              >
                <defs>
                  <filter id="map-cell-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#020617" floodOpacity="0.45" />
                  </filter>
                  <linearGradient id="map-empty-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16304f" />
                    <stop offset="100%" stopColor="#0a1628" />
                  </linearGradient>
                  <linearGradient id="map-select-ring" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={DEPOT_ACCENT} />
                    <stop offset="100%" stopColor={DEPOT_CYAN} />
                  </linearGradient>
                  <linearGradient id="map-glass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                    <stop offset="42%" stopColor="#ffffff" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                  <pattern id="map-bay-hatch" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M0 10 L10 0" stroke="rgba(148,163,184,0.16)" strokeWidth="1" />
                  </pattern>
                  {cells.map(({ em, stockInfo, rate }) => {
                    const base =
                      viewMode === "occupation"
                        ? occupationColor(rate) || "#64748b"
                        : familleColor(stockInfo.mainFamille);
                    const soft =
                      viewMode === "occupation"
                        ? occupationSoft(rate) || "#94a3b8"
                        : base;
                    return (
                      <g key={`g-${em.id}`}>
                        <linearGradient id={`map-grad-${em.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#13263f" />
                          <stop offset="100%" stopColor="#0a1628" />
                        </linearGradient>
                        <linearGradient id={`map-liquid-${em.id}`} x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor={base} stopOpacity="0.95" />
                          <stop offset="70%" stopColor={soft} stopOpacity="0.82" />
                          <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0.28" />
                        </linearGradient>
                      </g>
                    );
                  })}
                </defs>

                <g transform={`translate(${originX}, 0)`}>
                {showDock ? (
                  <g>
                    <rect
                      x={4}
                      y={(layoutMeta.dock?.row ?? 0) * cellPx + 8}
                      width={Math.max(1, cols) * cellPx - 8}
                      height={cellPx - 20}
                      rx={8}
                      fill="#0B1F3A"
                      opacity="0.92"
                    />
                    <text
                      x={(Math.max(1, cols) * cellPx) / 2}
                      y={(layoutMeta.dock?.row ?? 0) * cellPx + cellPx / 2 - 2}
                      textAnchor="middle"
                      fill="#F8FAFC"
                      fontSize="15"
                      fontWeight="800"
                      letterSpacing="2"
                    >
                      QUAI
                    </text>
                  </g>
                ) : null}

                {(showDock ? layoutMeta.aisles || [] : []).map((aisle, i) => (
                  <rect
                    key={`aisle-${i}`}
                    x={aisle.col * cellPx + 18}
                    y={(aisle.fromRow || 1) * cellPx + 4}
                    width={cellPx - 36}
                    height={((aisle.toRow || rows) - (aisle.fromRow || 1) + 1) * cellPx - 8}
                    rx={6}
                    fill="#EAB308"
                    opacity="0.28"
                  />
                ))}

                {placedCells.map(({ em, row, col, stockInfo, rate }, idx) => {
                  const isHighlit = em.id === highlightId;
                  const isSelected = selected?.id === em.id;
                  const isEmpty = stockInfo.qty === 0;
                  const isHovered = hovered?.id === em.id;
                  const cellDelay = Math.min(idx * 45, 900);
                  const pad = 12;
                  const x = col * cellPx + pad;
                  const y = row * cellPx + pad;
                  const w = cellPx - pad * 2;
                  const h = cellPx - pad * 2;
                  const rx = 22;
                  const innerX = x + 12;
                  const innerY = y + 40;
                  const innerW = w - 24;
                  const innerH = h - 68;
                  const fill = isEmpty ? "url(#map-empty-grad)" : `url(#map-grad-${em.id})`;
                  const accent = isEmpty
                    ? "#64748b"
                    : viewMode === "occupation"
                      ? occupationColor(rate)
                      : familleColor(stockInfo.mainFamille);
                  const stroke = isHighlit || isSelected
                    ? "#38BDF8"
                    : isHovered
                      ? DEPOT_ACCENT
                      : "rgba(148,163,184,0.22)";
                  const strokeW = isHighlit || isSelected ? 2.6 : isHovered ? 2 : 1.2;
                  const occPct = Math.min(100, Math.max(0, rate));
                  const fillRatio = isEmpty ? 0 : occPct / 100;
                  const liquidH = innerH * fillRatio;
                  const cx = x + w / 2;
                  const codeLabel = (em.code || "").length > 10 ? `${em.code.slice(0, 10)}…` : em.code || "—";

                  return (
                    <g
                      key={em.id}
                      id={`cell-${em.id}`}
                      className="map-cell-g map-bay-tile"
                      style={{ animation: `cellAppear 0.45s cubic-bezier(0.22,1,0.36,1) ${cellDelay}ms both` }}
                    >
                      {(isSelected || isHighlit) && (
                        <rect
                          className="map-cell-pulse"
                          x={x - 6}
                          y={y - 6}
                          width={w + 12}
                          height={h + 12}
                          rx={26}
                          fill="none"
                          stroke="url(#map-select-ring)"
                          strokeWidth={2.4}
                          style={{ animation: "mapCellPulse 1.8s ease-in-out infinite" }}
                        />
                      )}

                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={rx}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeW}
                        filter="url(#map-cell-shadow)"
                        onMouseEnter={() => setHovered(em)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => setSelected((sel) => (sel?.id === em.id ? null : em))}
                      />

                      <rect x={x + 5} y={y + 16} width={4} height={h - 28} rx={2} fill="rgba(56,189,248,0.22)" pointerEvents="none" />
                      <rect x={x + w - 9} y={y + 16} width={4} height={h - 28} rx={2} fill="rgba(56,189,248,0.22)" pointerEvents="none" />

                      <clipPath id={`bay-clip-${em.id}`}>
                        <rect x={innerX} y={innerY} width={innerW} height={innerH} rx={14} />
                      </clipPath>

                      {isEmpty ? (
                        <rect
                          x={innerX}
                          y={innerY}
                          width={innerW}
                          height={innerH}
                          rx={14}
                          fill="url(#map-bay-hatch)"
                          pointerEvents="none"
                        />
                      ) : (
                        <g clipPath={`url(#bay-clip-${em.id})`} pointerEvents="none">
                          <rect
                            className={reduceMotion ? undefined : "map-liquid"}
                            x={innerX}
                            y={innerY + innerH - liquidH}
                            width={innerW}
                            height={liquidH + 18}
                            fill={`url(#map-liquid-${em.id})`}
                            style={reduceMotion ? undefined : { animationDelay: `${cellDelay}ms` }}
                          />
                        </g>
                      )}

                      <rect
                        x={innerX}
                        y={innerY}
                        width={innerW}
                        height={innerH}
                        rx={14}
                        fill="url(#map-glass)"
                        pointerEvents="none"
                      />

                      <rect
                        x={x + 10}
                        y={y + 8}
                        width={w - 20}
                        height={26}
                        rx={10}
                        fill="rgba(2,6,23,0.45)"
                        pointerEvents="none"
                      />

                      <circle
                        className={!isEmpty && !reduceMotion ? "map-led" : undefined}
                        cx={x + 24}
                        cy={y + 21}
                        r={4.4}
                        fill={accent}
                        style={!isEmpty && !reduceMotion ? { animation: "mapLedPulse 1.8s ease-in-out infinite" } : undefined}
                        pointerEvents="none"
                      />

                      <text
                        x={x + 34}
                        y={y + 25}
                        fill={CARD_INK}
                        fontSize={12}
                        fontWeight={800}
                        letterSpacing={0.6}
                        pointerEvents="none"
                      >
                        {codeLabel}
                      </text>

                      <g pointerEvents="none">
                        <text
                          x={cx}
                          y={y + h / 2 + 6}
                          textAnchor="middle"
                          fill={CARD_INK}
                          fontSize={Math.max(22, Math.min(34, w * 0.24))}
                          fontWeight={800}
                          letterSpacing="-0.5"
                        >
                          {isEmpty ? "—" : `${occPct.toFixed(0)}%`}
                        </text>
                        <rect
                          x={cx - 32}
                          y={y + h - 30}
                          width={64}
                          height={18}
                          rx={9}
                          fill={isEmpty ? "rgba(148,163,184,0.16)" : `${accent}33`}
                        />
                        <text
                          x={cx}
                          y={y + h - 17}
                          textAnchor="middle"
                          fill={isEmpty ? CARD_INK_MUTED : CARD_INK}
                          fontSize={9}
                          fontWeight={800}
                          letterSpacing={1.1}
                        >
                          {isEmpty ? "LIBRE" : "OCCUPÉ"}
                        </text>
                      </g>

                      {em.zoneDangereuse && (
                        <text
                          x={x + w - 20}
                          y={y + 26}
                          textAnchor="middle"
                          fontSize={13}
                          pointerEvents="none"
                        >
                          ⚠
                        </text>
                      )}
                    </g>
                  );
                })}
                </g>
              </svg>
            ) : null}
          </div>

          {show3dView ? (
            <IsometricLegend cells={cells} />
          ) : (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-4 rounded-2xl border p-3.5"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, #378ADD 8%, var(--bg-card)) 0%, var(--bg-card) 55%, color-mix(in srgb, #0EA5E9 5%, var(--bg-card)) 100%)",
              borderColor: "color-mix(in srgb, #378ADD 20%, var(--border-default))",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Légende
            </span>
            {viewMode === "occupation" ? (
              <>
                {[
                  { color: "#1a2d4a", label: "Libre", border: true },
                  { color: "#34d399", label: "< 50% — OK" },
                  { color: "#fbbf24", label: "50–80% — Attention" },
                  { color: "#f87171", label: "> 80% — Critique" },
                ].map((l, i) => (
                  <span
                    key={l.label}
                    className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] animate-fadeUp"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-md shadow-sm"
                      style={{
                        background: l.color,
                        border: l.border ? "1px solid var(--border-default)" : "none",
                      }}
                    />
                    {l.label}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-[11px] text-[var(--text-secondary)]">
                Couleur par famille d&apos;article · cliquez une case pour le détail
              </span>
            )}
            <span
              className="ml-auto rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums"
              style={{ background: "var(--accent-soft)", color: "var(--accent-primary)" }}
            >
              {mapStats.occupied} / {mapStats.total} emplacements occupés
            </span>
          </motion.div>
          )}
        </div>

        {selected && (
          <aside
            className="w-full shrink-0 rounded-2xl border p-4 lg:w-72"
            style={{
              background: "var(--color-background-primary, var(--bg-card))",
              borderColor: "var(--color-border-tertiary, var(--border-default))",
              borderLeft: "3px solid #378ADD",
              animation: "slideInRight 0.25s ease",
            }}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "rgba(55,138,221,0.12)" }}
                >
                  <MapPin className="h-4 w-4" style={{ color: "#378ADD" }} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-[var(--color-text-primary,var(--text-primary))]">
                    {selected.code}
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-secondary,var(--text-secondary))]">
                    {selected.libelle || "Sans libellé"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 transition-colors"
                style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {(() => {
              const selectedCell = cells.find((c) => c.em.id === selected.id);
              const info = selectedCell?.stockInfo || stockByEmplacement.get(selected.id);
              const cap = selectedCell?.capaciteUnites || emplacementCapaciteUnits(selected);
              const rate = selectedCell?.rate ?? (info && cap ? Math.min((info.qty / cap) * 100, 100) : 0);
              const color = occupationColor(rate);
              return (
                <div
                  className="mb-4 rounded-xl border p-3"
                  style={{
                    background: "var(--color-background-secondary, var(--bg-app))",
                    borderColor: "var(--color-border-tertiary, var(--border-default))",
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-[var(--color-text-secondary,var(--text-secondary))]">
                      Taux d&apos;occupation
                    </span>
                    <span className="text-sm font-medium" style={{ color }}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full"
                    style={{ background: "var(--color-background-primary, var(--bg-card))" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${rate}%`, background: color }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] text-[var(--color-text-tertiary,var(--text-muted))]">
                    <span>{info?.qty?.toLocaleString("fr-FR") ?? 0} unités</span>
                    <span>Capacité: {cap.toLocaleString("fr-FR")}</span>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const info = stockByEmplacement.get(selected.id);
              if (!info?.items?.length) {
                return (
                  <p className="py-3 text-center text-xs text-[var(--color-text-tertiary,var(--text-muted))]">
                    Emplacement vide
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary,var(--text-muted))]">
                    Articles stockés ({info.items.length})
                  </p>
                  {info.items.map((s, i) => (
                    <div
                      key={s.id || i}
                      className="flex items-center justify-between rounded-lg border p-2"
                      style={{
                        background: "var(--color-background-secondary, var(--bg-app))",
                        borderColor: "var(--color-border-tertiary, var(--border-default))",
                        animation: `fadeUp 0.25s ease ${i * 40}ms both`,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-[var(--color-text-primary,var(--text-primary))]">
                          {s.article?.libelle || s.article?.code || "Article"}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-tertiary,var(--text-muted))]">
                          {s.article?.code}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs font-medium" style={{ color: "#1D9E75" }}>
                        {Number(s.quantite).toLocaleString("fr-FR")} UN
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

                {selected.categorieAutorisee ? (
                  <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
                    Catégorie autorisée : {selected.categorieAutorisee}
                  </p>
                ) : null}
                <Link
                  to={`/stock/emplacement-optimization?depotId=${selected.depotId || depot?.id || ""}&tab=audit`}
                  className="mt-3 inline-flex text-[11px] font-semibold"
                  style={{ color: DEPOT_ACCENT }}
                >
                  Ouvrir le slotting de ce dépôt →
                </Link>
            {selected.zoneDangereuse && (
              <div
                className="mt-3 flex items-center gap-2 rounded-xl border p-2"
                style={{
                  background: "rgba(186,117,23,0.08)",
                  borderColor: "rgba(186,117,23,0.25)",
                }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#BA7517" }} />
                <p className="text-[11px]" style={{ color: "#BA7517" }}>
                  Zone dangereuse — produits chimiques uniquement
                </p>
              </div>
            )}
          </aside>
        )}
      </div>

      {hovered && !selected && (() => {
        const hoveredMapCell = cells.find((c) => c.em.id === hovered.id);
        const info = hoveredMapCell?.stockInfo || stockByEmplacement.get(hovered.id);
        const rate = hoveredMapCell?.rate ?? 0;
        const color = occupationColor(rate);
        return (
          <div
            className="pointer-events-none fixed bottom-6 left-1/2 z-[400] -translate-x-1/2 rounded-xl border px-4 py-2.5 shadow-2xl"
            style={{
              background: "var(--color-background-primary, var(--bg-card))",
              borderColor: "var(--color-border-secondary, var(--border-default))",
              animation: "fadeUp 0.15s ease",
            }}
          >
            <div className="flex items-center gap-3 text-xs">
              <span className="font-medium text-[var(--color-text-primary,var(--text-primary))]">
                {hovered.code}
              </span>
              <span className="text-[var(--color-text-secondary,var(--text-secondary))]">
                {info?.mainArticle?.article?.libelle || "Vide"}
              </span>
              <span className="font-medium" style={{ color }}>
                {rate.toFixed(0)}% occupé
              </span>
              {info?.qty > 0 && (
                <span className="text-[var(--color-text-tertiary,var(--text-muted))]">
                  {info.items.length} article{info.items.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {scannerOpen && (
        <BarcodeScanner onDetected={handleScanDetected} onClose={() => setScannerOpen(false)} />
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[450] rounded-xl border px-4 py-3 text-sm font-medium shadow-xl"
          style={{
            animation: "fadeUp 0.2s ease",
            background: toast.type === "error" ? "rgba(226,75,74,0.12)" : "rgba(29,158,117,0.12)",
            borderColor: toast.type === "error" ? "rgba(226,75,74,0.35)" : "rgba(29,158,117,0.35)",
            color: toast.type === "error" ? "#E24B4A" : "#1D9E75",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
