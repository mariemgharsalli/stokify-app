import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, FileDown, FileSpreadsheet, Filter, Printer } from "lucide-react";
import SearchableSelect from "../../../components/ui/SearchableSelect";
import { PERIOD_PRESETS } from "../rapportUtils";

const COLIS_SRC = "/cutouts/produit-colis-stack-cutout.png";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const BARS = [
  { h: 42, top: "#7dd3fc", mid: "#378ADD", delay: 0 },
  { h: 68, top: "#38bdf8", mid: "#0ea5e9", delay: 0.1 },
  { h: 52, top: "#67e8f9", mid: "#06b6d4", delay: 0.18 },
  { h: 88, top: "#93c5fd", mid: "#2563eb", delay: 0.26 },
  { h: 60, top: "#a5f3fc", mid: "#0891b2", delay: 0.34 },
  { h: 74, top: "#7dd3fc", mid: "#378ADD", delay: 0.42 },
];

/** Barre isométrique 3D (faces avant / côté / dessus). */
function IsoBar({ h, top, mid, delay, reduceMotion, w = 14 }) {
  const side = Math.round(w * 0.55);
  return (
    <motion.div
      className="relative origin-bottom"
      style={{ width: w, height: h, transformStyle: "preserve-3d" }}
      animate={
        reduceMotion
          ? undefined
          : { scaleY: [0.92, 1.06, 0.96, 1], y: [0, -3, 0] }
      }
      transition={{
        duration: 3.6 + delay,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {/* Face avant */}
      <div
        className="absolute inset-0 rounded-t-[3px]"
        style={{
          background: `linear-gradient(180deg, ${top} 0%, ${mid} 55%, #0c1e3a 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 18px ${mid}55`,
        }}
      />
      {/* Face côté */}
      <div
        className="absolute top-0 bottom-0 rounded-tr-[2px]"
        style={{
          left: "100%",
          width: side,
          background: `linear-gradient(180deg, ${mid}cc 0%, #0a1628 100%)`,
          transform: "skewY(-35deg)",
          transformOrigin: "top left",
          filter: "brightness(0.72)",
        }}
      />
      {/* Face dessus */}
      <div
        className="absolute left-0"
        style={{
          top: -side * 0.55,
          width: w,
          height: side * 0.7,
          background: `linear-gradient(135deg, ${top} 0%, ${mid} 100%)`,
          transform: "skewX(-35deg)",
          transformOrigin: "bottom left",
          filter: "brightness(1.15)",
          borderRadius: 2,
          boxShadow: `0 0 12px ${top}66`,
        }}
      />
    </motion.div>
  );
}

/** Scène analytics 3D — grille, barres iso, anneau, colis. */
function AnalyticsScene3D({ reduceMotion, compact = false, modelsOnly = false }) {
  const modelsClass = compact || modelsOnly ? "" : "hidden md:block";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Mesh / aurora — always */}
      <div
        className="absolute inset-0"
        style={{
          background: modelsOnly
            ? undefined
            : `
            radial-gradient(ellipse 70% 90% at 0% 0%, rgba(55,138,221,0.32) 0%, transparent 52%),
            radial-gradient(ellipse 55% 70% at 88% 40%, rgba(14,165,233,0.38) 0%, transparent 58%),
            radial-gradient(ellipse 40% 55% at 72% 90%, rgba(37,99,235,0.3) 0%, transparent 55%),
            radial-gradient(ellipse 35% 45% at 95% 8%, rgba(6,182,212,0.26) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 40% 70%, rgba(8,47,73,0.5) 0%, transparent 60%)
          `,
        }}
      />

      {/* Soft noise grain */}
      {!modelsOnly ? (
        <div
          className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      ) : null}

      <div className={`absolute inset-0 ${modelsClass}`}>
        {/* Perspective grid floor */}
        <div
          className="absolute bottom-0 right-0 h-[75%] w-[80%]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(56,189,248,0.11) 1px, transparent 1px),
              linear-gradient(90deg, rgba(56,189,248,0.11) 1px, transparent 1px)
            `,
            backgroundSize: "26px 26px",
            transform: "perspective(520px) rotateX(62deg) scale(1.4)",
            transformOrigin: "85% 100%",
            maskImage:
              "radial-gradient(ellipse 72% 82% at 72% 100%, #000 12%, transparent 74%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 72% 82% at 72% 100%, #000 12%, transparent 74%)",
          }}
        />

        {/* Horizon glow */}
        <div
          className="absolute bottom-[28%] right-[4%] h-px w-[58%]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(125,211,252,0.6), transparent)",
            boxShadow: "0 0 28px 6px rgba(56,189,248,0.28)",
          }}
        />

        {/* Floating particles */}
        {!reduceMotion &&
          [
            { l: "60%", t: "16%", s: 3, d: 0 },
            { l: "76%", t: "26%", s: 2, d: 0.6 },
            { l: "88%", t: "40%", s: 2.5, d: 1.1 },
            { l: "68%", t: "52%", s: 2, d: 0.3 },
            { l: "92%", t: "60%", s: 3, d: 1.4 },
            { l: "82%", t: "14%", s: 2, d: 0.9 },
          ].map((p, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: p.l,
                top: p.t,
                width: p.s,
                height: p.s,
                background: "rgba(186,230,253,0.9)",
                boxShadow: "0 0 12px rgba(56,189,248,0.85)",
              }}
              animate={{ y: [0, -12, 0], opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 3.2 + i * 0.35,
                delay: p.d,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

        {/* Ring chart 3D */}
        <motion.div
          className="absolute"
          style={{
            right: compact ? "50%" : "46%",
            top: compact ? "10%" : "8%",
            width: compact ? 58 : 78,
            height: compact ? 58 : 78,
            transformStyle: "preserve-3d",
          }}
          animate={
            reduceMotion ? undefined : { rotateZ: [0, 360], y: [0, -7, 0] }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  rotateZ: { duration: 18, repeat: Infinity, ease: "linear" },
                  y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
                }
          }
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 210deg, #38bdf8 0%, #378ADD 36%, #06b6d4 58%, #1e3a5f 58%, #1e3a5f 100%)",
              boxShadow:
                "0 14px 32px rgba(14,165,233,0.4), inset 0 0 0 1px rgba(255,255,255,0.18)",
              transform: "rotateX(58deg) rotateZ(-18deg)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: "22%",
              background: "radial-gradient(circle at 40% 35%, #1a3a66, #0a1628)",
              boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)",
              transform: "rotateX(58deg) rotateZ(-18deg)",
            }}
          />
        </motion.div>

        {/* Iso bars */}
        <div
          className="absolute flex items-end gap-2"
          style={{
            right: compact ? "36%" : "34%",
            bottom: compact ? "20%" : "18%",
            transform: "rotateX(12deg) rotateY(-18deg)",
            transformStyle: "preserve-3d",
            perspective: 600,
          }}
        >
          {BARS.map((b, i) => (
            <IsoBar
              key={i}
              {...b}
              h={compact ? Math.round(b.h * 0.75) : b.h}
              w={compact ? 10 : 14}
              reduceMotion={reduceMotion}
            />
          ))}
        </div>

        {/* Pedestal glow under boxes */}
        <div
          className="absolute"
          style={{
            right: compact ? 6 : 16,
            bottom: 4,
            width: compact ? 132 : 200,
            height: compact ? 30 : 44,
            background:
              "radial-gradient(ellipse at center, rgba(14,165,233,0.5) 0%, rgba(55,138,221,0.18) 42%, transparent 72%)",
            filter: "blur(7px)",
          }}
        />

        {/* Boxes cutout */}
        <motion.img
          src={COLIS_SRC}
          alt=""
          draggable={false}
          decoding="async"
          className="absolute object-contain"
          style={{
            right: compact ? 2 : 8,
            bottom: compact ? -2 : -4,
            width: compact ? 124 : 200,
            filter:
              "drop-shadow(0 24px 30px rgba(0,0,0,0.6)) drop-shadow(0 0 28px rgba(56,189,248,0.25))",
            transformStyle: "preserve-3d",
          }}
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -12, 0], rotate: [-2.5, 2.8, -2.5] }
          }
          transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Left readability veil (desktop) */}
      {!compact ? (
        <div
          className="absolute inset-y-0 left-0 hidden w-[58%] md:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(8,14,28,0.72) 0%, rgba(8,14,28,0.28) 55%, transparent 100%)",
          }}
        />
      ) : null}
    </div>
  );
}

export default function ReportPeriodSelector({
  preset,
  onPresetChange,
  dateDebut,
  dateFin,
  onDateDebut,
  onDateFin,
  onApply,
  depotId,
  depots,
  onDepotChange,
  userId,
  users,
  onUserChange,
  onExportPdf,
  onExportExcel,
  exportLoading,
}) {
  const reduceMotion = useReducedMotion();

  const depotOptions = useMemo(
    () =>
      (depots || []).map((d) => ({
        value: String(d.id),
        label: d.libelle || d.code || `Dépôt #${d.id}`,
      })),
    [depots]
  );

  const userOptions = useMemo(
    () =>
      (users || []).map((u) => ({
        value: String(u.id),
        label: `${u.prenom || ""} ${u.nom || ""}`.trim() || u.email || `User #${u.id}`,
      })),
    [users]
  );

  return (
    <motion.header
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="page-hero sticky top-2 z-20 p-5 sm:p-6"
    >
      {/* Full creative background */}
      <AnalyticsScene3D reduceMotion={reduceMotion} />

      {/* Top edge light */}
      <div
        className="pointer-events-none absolute left-[8%] right-[8%] top-0 z-[1] h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(125,211,252,0.55), transparent)",
        }}
        aria-hidden
      />

      {/* Content */}
      <div className="relative z-[2] flex flex-wrap items-start justify-between gap-4 md:pr-[36%]">
        <div className="flex items-start gap-3">
          <div className="page-hero__mark" aria-hidden>
            <span className="page-hero__orbit" />
            <BarChart3 className="relative h-7 w-7" strokeWidth={1.75} />
          </div>
          <div>
            <div className="page-hero__title-row">
              <h1 className="page-hero__title font-display">Rapports & Analytics</h1>
              <span className="page-hero__badge">
                <span className="page-hero__dot" aria-hidden />
                Analytics
              </span>
            </div>
            <p className="page-hero__subtitle">
              Pilotage dynamique — ventes, achats, stock et tendances
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { label: "PDF", Icon: FileDown, onClick: onExportPdf, disabled: exportLoading },
            { label: "Excel", Icon: FileSpreadsheet, onClick: onExportExcel, disabled: exportLoading },
            { label: "Imprimer", Icon: Printer, onClick: () => window.print() },
          ].map(({ label, Icon, onClick, disabled }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-50 backdrop-blur-sm transition hover:bg-sky-500/20 disabled:opacity-50"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-[2] mt-5 flex items-center gap-2 md:pr-[36%]">
        <Filter className="h-4 w-4 text-sky-300" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/55">
          Période
        </p>
      </div>

      <div className="relative z-[2] mt-2 flex flex-wrap gap-2 md:pr-[36%]">
        {PERIOD_PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <motion.button
              key={p.id}
              type="button"
              onClick={() => onPresetChange(p.id)}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm"
              style={
                active
                  ? {
                      background: "linear-gradient(135deg, #378ADD, #06b6d4)",
                      color: "#fff",
                      boxShadow: "0 2px 16px rgba(56,189,248,0.45)",
                    }
                  : {
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(186,230,253,0.78)",
                      border: "1px solid rgba(96,165,250,0.22)",
                      backdropFilter: "blur(6px)",
                    }
              }
            >
              {p.label}
            </motion.button>
          );
        })}
      </div>

      {preset === "custom" ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="relative z-[2] mt-3 flex flex-wrap items-end gap-3 overflow-hidden md:pr-[36%]"
        >
          <label className="text-xs text-sky-200/55">
            Du
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => onDateDebut(e.target.value)}
              className="art-filter-field mt-1 block px-3 py-2 text-sm shadow-none [color-scheme:dark]"
            />
          </label>
          <label className="text-xs text-sky-200/55">
            Au
            <input
              type="date"
              value={dateFin}
              onChange={(e) => onDateFin(e.target.value)}
              className="art-filter-field mt-1 block px-3 py-2 text-sm shadow-none [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={onApply}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #378ADD 0%, #0EA5E9 100%)",
              boxShadow: "0 4px 18px rgba(55,138,221,0.45)",
            }}
          >
            Appliquer
          </button>
        </motion.div>
      ) : null}

      <div className="relative z-[2] mt-4 flex flex-wrap items-end gap-4 border-t border-sky-400/15 pt-4 md:pr-[36%]">
        <div className="min-w-[200px] flex-1 sm:max-w-[260px]">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200/50">
            Dépôt
          </p>
          <SearchableSelect
            value={depotId ? String(depotId) : ""}
            onChange={onDepotChange}
            options={depotOptions}
            placeholder="Tous les dépôts"
            clearLabel="Tous les dépôts"
            searchPlaceholder="Rechercher un dépôt…"
            aria-label="Filtrer par dépôt"
            className="article-filter-select w-full"
          />
        </div>
        {users?.length > 0 && onUserChange ? (
          <div className="min-w-[200px] flex-1 sm:max-w-[260px]">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200/50">
              Créé par
            </p>
            <SearchableSelect
              value={userId ? String(userId) : ""}
              onChange={onUserChange}
              options={userOptions}
              placeholder="Tous les utilisateurs"
              clearLabel="Tous les utilisateurs"
              searchPlaceholder="Rechercher un utilisateur…"
              aria-label="Filtrer par créateur"
              className="article-filter-select w-full"
            />
          </div>
        ) : null}
      </div>

      {/* Mobile visual strip — models only */}
      <div
        className="relative z-[2] mt-4 h-[128px] overflow-hidden rounded-xl border border-sky-400/20 md:hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(14,40,78,0.85) 0%, rgba(8,24,52,0.95) 100%)",
        }}
        aria-hidden
      >
        <AnalyticsScene3D reduceMotion={reduceMotion} compact modelsOnly />
      </div>

      <style>{`
        @keyframes rapportFilterShimmer {
          0% { background-position: 120% 0; }
          100% { background-position: -40% 0; }
        }
        .article-filter-select button {
          border-radius: 0.75rem !important;
          border-color: rgba(96,165,250,0.28) !important;
          background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)) !important;
          color: rgba(255,255,255,0.94) !important;
          backdrop-filter: blur(8px);
        }
        .article-filter-select button:hover:not(:disabled) {
          border-color: rgba(96,165,250,0.45) !important;
          background: linear-gradient(145deg, rgba(59,130,246,0.16), rgba(255,255,255,0.06)) !important;
        }
        .art-filter-field {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(96,165,250,0.28);
          background: linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          color: rgba(255,255,255,0.94);
          backdrop-filter: blur(8px);
        }
        .art-filter-field:focus {
          outline: none;
          border-color: #378ADD;
          box-shadow: 0 0 0 3px rgba(55,138,221,0.25);
        }
      `}</style>
    </motion.header>
  );
}
