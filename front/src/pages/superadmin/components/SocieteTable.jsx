import {
  Activity,
  Building2,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Settings2,
  Users,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { buildLogoUrl } from "./SocieteTableRow";
import SocieteActionMenu from "./SocieteActionMenu";
import AnimatedSwitch from "./AnimatedSwitch";
import SocieteStatusBadge from "./SocieteStatusBadge";
import { getCardAccent, STAT_COLORS, VENTES_RED } from "./societesTheme";

const COLUMNS = [
  { key: "societe", label: "Société", Icon: Building2, hide: null },
  { key: "statut", label: "Statut", Icon: Activity, hide: "md" },
  { key: "activite", label: "Activité", Icon: Package, hide: "lg" },
  { key: "localisation", label: "Localisation", Icon: MapPin, hide: "xl" },
  { key: "contact", label: "Contact", Icon: Mail, hide: "sm" },
  { key: "actions", label: "Actions", Icon: Settings2, hide: null, align: "right" },
];

function hideClass(hide) {
  if (hide === "sm") return "hidden sm:table-cell";
  if (hide === "md") return "hidden md:table-cell";
  if (hide === "lg") return "hidden lg:table-cell";
  if (hide === "xl") return "hidden xl:table-cell";
  return "";
}

function StatChip({ icon: Icon, value, label, color, bg, border }) {
  return (
    <div
      className="societe-stat-chip"
      title={label}
      style={{ color, background: bg, borderColor: border }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums">{value ?? 0}</span>
    </div>
  );
}

function SocieteTableRow({
  societe: s,
  index,
  onAction,
  onToggleActif,
  togglePending,
  logoUploadPending,
  logoUploadId,
}) {
  const reduceMotion = useReducedMotion();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const logoUrl = buildLogoUrl(s.logo);
  const isUploading = logoUploadPending && Number(logoUploadId) === Number(s.id);
  const counts = s._count || {};
  const accent = getCardAccent(s);

  return (
    <>
      <motion.tr
        className="societe-table-row group"
        initial={reduceMotion ? false : { opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: 0.38,
          delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.45),
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={reduceMotion ? undefined : { x: 2 }}
        style={{ borderLeft: `3px solid ${accent.accent}` }}
      >
        <td>
          <div className="flex items-center gap-3">
            <div
              className="societe-logo-ring relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-105"
              style={{
                background: logoUrl ? "var(--bg-input)" : accent.gradient,
                boxShadow: `0 6px 16px -6px ${accent.soft}`,
                border: `1px solid ${accent.border}`,
              }}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--text-muted)" }} />
              ) : logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white">
                  {(s.nom || "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                className="truncate text-left text-sm font-semibold tracking-tight transition-colors hover:text-[#0284c7]"
                style={{ color: "var(--text-primary)" }}
                onClick={() => onAction("view", s)}
                title="Voir le détail"
              >
                {s.nom || "—"}
              </button>
              <span className="societe-code-pill">{s.code}</span>
            </div>
          </div>
        </td>

        <td className="hidden md:table-cell">
          <div className="flex items-center gap-2.5">
            <AnimatedSwitch
              checked={s.actif !== false}
              disabled={togglePending}
              onChange={() => onToggleActif?.(s)}
              id={`societe-toggle-${s.id}`}
            />
            <SocieteStatusBadge actif={s.actif} />
          </div>
        </td>

        <td className="hidden lg:table-cell">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatChip
              icon={Users}
              value={counts.utilisateurs}
              label="Utilisateurs"
              color={STAT_COLORS.users.color}
              bg={STAT_COLORS.users.bg}
              border={STAT_COLORS.users.border}
            />
            <StatChip
              icon={Package}
              value={counts.articles}
              label="Articles"
              color={VENTES_RED.accent}
              bg={VENTES_RED.soft}
              border={VENTES_RED.border}
            />
            <StatChip
              icon={Warehouse}
              value={counts.depots}
              label="Dépôts"
              color={STAT_COLORS.depots.color}
              bg={STAT_COLORS.depots.bg}
              border={STAT_COLORS.depots.border}
            />
          </div>
        </td>

        <td className="hidden xl:table-cell">
          {s.ville || s.adresse ? (
            <motion.div
              className="inline-flex max-w-[180px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm"
              style={{
                color: "var(--text-secondary)",
                borderColor: "rgba(29,158,117,0.25)",
                background: "rgba(29,158,117,0.08)",
              }}
              whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">{s.ville || s.adresse}</span>
            </motion.div>
          ) : (
            <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
              Non localisée
            </span>
          )}
        </td>

        <td className="hidden sm:table-cell">
          {s.email ? (
            <span
              className="block max-w-[190px] truncate text-sm"
              style={{ color: "var(--text-secondary)" }}
              title={s.email}
            >
              {s.email}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              —
            </span>
          )}
        </td>

        <td className="text-right">
          <motion.button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuAnchor(menuAnchor ? null : rect);
            }}
            className="societe-action-btn"
            aria-label="Actions"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </motion.button>
        </td>
      </motion.tr>

      {menuAnchor ? (
        <SocieteActionMenu
          societe={s}
          anchorRect={menuAnchor}
          close={() => setMenuAnchor(null)}
          onAction={onAction}
        />
      ) : null}
    </>
  );
}

function TableSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="societe-table-row">
          <td colSpan={6}>
            <div
              className="flex items-center gap-3"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-11 w-11 rounded-xl societes-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-44 rounded societes-shimmer" />
                <div className="h-3 w-20 rounded societes-shimmer" />
              </div>
              <div className="hidden h-7 w-24 rounded-lg societes-shimmer md:block" />
              <div className="hidden h-7 w-40 rounded-lg societes-shimmer lg:block" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function SocieteTable({
  companies,
  loading,
  onAction,
  onToggleActif,
  togglePending,
  logoUploadPending,
  logoUploadId,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="societe-table-shell"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="societe-table-wrap">
        <table>
          <thead className="societe-table-head">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${hideClass(col.hide)} ${col.align === "right" ? "text-right" : ""}`}
                >
                  <span
                    className={`societe-table-head__cell ${
                      col.align === "right" ? "justify-end w-full" : ""
                    }`}
                  >
                    {col.Icon ? (
                      <span className="societe-table-head__icon">
                        <col.Icon className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    {col.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton />
            ) : (
              companies.map((s, i) => (
                <SocieteTableRow
                  key={s.id}
                  societe={s}
                  index={i}
                  onAction={onAction}
                  onToggleActif={onToggleActif}
                  togglePending={togglePending}
                  logoUploadPending={logoUploadPending}
                  logoUploadId={logoUploadId}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export function SocieteTableEmpty({ isSearchEmpty, onCreate }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center"
      style={{
        background:
          "linear-gradient(165deg, color-mix(in srgb, #378ADD 6%, var(--bg-card)), var(--bg-card))",
        borderColor: "rgba(55,138,221,0.35)",
      }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(145deg, rgba(55,138,221,0.18), rgba(14,165,233,0.12))",
          border: "1px solid rgba(55,138,221,0.3)",
          boxShadow: "0 12px 28px -14px rgba(55,138,221,0.45)",
        }}
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Building2 className="h-7 w-7 text-[#378ADD]" />
      </motion.div>
      <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {isSearchEmpty ? "Aucun résultat" : "Aucune société"}
      </h3>
      <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--text-secondary)" }}>
        {isSearchEmpty
          ? "Modifiez vos filtres ou votre recherche pour afficher des sociétés."
          : "Créez votre premier tenant pour activer la gestion multi-sociétés."}
      </p>
      {!isSearchEmpty ? (
        <motion.button
          type="button"
          onClick={onCreate}
          className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          style={{
            background: "linear-gradient(135deg, #378ADD, #0EA5E9)",
            boxShadow: "0 10px 24px -10px rgba(55,138,221,0.55)",
          }}
          whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          Créer une société
        </motion.button>
      ) : null}
    </motion.div>
  );
}
