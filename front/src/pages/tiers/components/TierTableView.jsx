import { motion, useReducedMotion } from "framer-motion";
import {
  Ban,
  Building2,
  CheckCircle,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Settings2,
  Timer,
  Users,
} from "lucide-react";
import TierStatusBadge from "./TierStatusBadge";
import { TIERS_ACCENT, TIERS_CYAN, TIERS_TABLE_CSS } from "./tiersTheme";

const COLUMNS = [
  { key: "nom", label: "Identité", Icon: Users, sortKey: "nom" },
  { key: "ville", label: "Localisation", Icon: MapPin, sortKey: "ville", hide: "md" },
  { key: "contact", label: "Contact", Icon: Mail, sortKey: "contact", hide: "sm" },
  { key: "actif", label: "Statut", Icon: Timer, sortKey: "actif", hide: "sm" },
  { key: "actions", label: "Actions", Icon: Settings2, sortKey: null, align: "right" },
];

function hideClass(hide) {
  if (hide === "sm") return "hidden sm:table-cell";
  if (hide === "md") return "hidden md:table-cell";
  return "";
}

function avatarGradient(name) {
  const palettes = [
    `linear-gradient(145deg, ${TIERS_ACCENT}, ${TIERS_CYAN})`,
    "linear-gradient(145deg, #1D9E75, #0EA5E9)",
    "linear-gradient(145deg, #0EA5E9, #378ADD)",
    "linear-gradient(145deg, #2563eb, #06B6D4)",
  ];
  const n = String(name || "?").charCodeAt(0) || 0;
  return palettes[n % palettes.length];
}

function SortArrow({ active, dir }) {
  if (!active) return null;
  return (
    <span
      className="ml-1 inline-block text-[10px] opacity-80 transition-transform"
      style={{ transform: dir === "desc" ? "rotate(180deg)" : undefined }}
    >
      ↑
    </span>
  );
}

function ActionBtn({ title, onClick, variant = "view", children }) {
  const styles = {
    view: {
      background: "var(--bg-hover)",
      borderColor: "var(--border-default)",
      color: "var(--text-secondary)",
    },
    edit: {
      background: "rgba(55,138,221,0.12)",
      borderColor: "rgba(55,138,221,0.3)",
      color: TIERS_ACCENT,
    },
    deactivate: {
      background: "rgba(226,75,74,0.1)",
      borderColor: "rgba(226,75,74,0.3)",
      color: "#E24B4A",
    },
    reactivate: {
      background: "rgba(29,158,117,0.1)",
      borderColor: "rgba(29,158,117,0.3)",
      color: "#1D9E75",
    },
  };
  const s = styles[variant] || styles.view;
  return (
    <motion.button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="tier-pro-action"
      style={s}
      whileTap={{ scale: 0.92 }}
    >
      {children}
    </motion.button>
  );
}

function TierProRow({
  item,
  index,
  contactField,
  canWrite,
  onView,
  onEdit,
  onToggle,
}) {
  const reduceMotion = useReducedMotion();
  const isDisabled = item.actif === false;
  const contact = item[contactField] || item.telephone || item.contact || "";
  const initial = (item.nom || item.code || "?")[0].toUpperCase();

  return (
    <motion.tr
      className={`tier-pro-row group ${isDisabled ? "is-disabled" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: isDisabled ? 0.78 : 1, x: 0 }}
      transition={{
        duration: 0.36,
        delay: reduceMotion ? 0 : Math.min(index * 0.04, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduceMotion ? undefined : { x: 2 }}
      style={{ borderLeft: `3px solid ${isDisabled ? "#64748b" : TIERS_ACCENT}` }}
    >
      <td>
        <div className="flex items-center gap-3">
          <div className="tier-pro-avatar" style={{ background: avatarGradient(item.nom) }}>
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">
              {item.nom || "—"}
            </p>
            <span className="tier-pro-code mt-0.5">{item.code || "—"}</span>
          </div>
        </div>
      </td>

      <td className={hideClass("md")}>
        {item.ville || item.adresse ? (
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
            <span className="truncate">{item.ville || item.adresse}</span>
          </motion.div>
        ) : (
          <span className="text-xs italic text-[var(--text-muted)]">Non localisé</span>
        )}
      </td>

      <td className={hideClass("sm")}>
        {contact ? (
          <span className="block max-w-[200px] truncate text-sm text-[var(--text-secondary)]" title={contact}>
            {contact}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">—</span>
        )}
      </td>

      <td className={hideClass("sm")}>
        <TierStatusBadge actif={item.actif} />
      </td>

      <td className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <ActionBtn title="Voir le détail" onClick={() => onView?.(item)} variant="view">
            <Eye size={14} strokeWidth={2.25} />
          </ActionBtn>
          {canWrite ? (
            <>
              <ActionBtn title="Modifier" onClick={() => onEdit?.(item)} variant="edit">
                <Pencil size={14} strokeWidth={2.25} />
              </ActionBtn>
              <ActionBtn
                title={isDisabled ? "Réactiver" : "Désactiver"}
                onClick={() => onToggle?.(item)}
                variant={isDisabled ? "reactivate" : "deactivate"}
              >
                {isDisabled ? <CheckCircle size={14} strokeWidth={2.25} /> : <Ban size={14} strokeWidth={2.25} />}
              </ActionBtn>
            </>
          ) : null}
        </div>
      </td>
    </motion.tr>
  );
}

function TableSkeleton() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <tr key={i} className="tier-pro-row">
          <td colSpan={5}>
            <div className="flex items-center gap-3" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="h-11 w-11 rounded-xl tier-pro-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-44 rounded tier-pro-shimmer" />
                <div className="h-3 w-20 rounded tier-pro-shimmer" />
              </div>
              <div className="hidden h-7 w-28 rounded-lg tier-pro-shimmer md:block" />
              <div className="hidden h-7 w-36 rounded-lg tier-pro-shimmer sm:block" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function TierTableEmpty({ title, subtitle, onCreate, createLabel, icon: Icon = Building2 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center"
      style={{
        background:
          "linear-gradient(165deg, color-mix(in srgb, #378ADD 6%, var(--bg-card)), var(--bg-card))",
        borderColor: "color-mix(in srgb, #378ADD 28%, var(--border-default))",
      }}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: `linear-gradient(145deg, ${TIERS_ACCENT}, ${TIERS_CYAN})`,
          color: "#fff",
          boxShadow: "0 12px 28px -12px rgba(55,138,221,0.55)",
        }}
        animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="h-7 w-7" />
      </motion.div>
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">{subtitle}</p>
      {onCreate && createLabel ? (
        <motion.button
          type="button"
          onClick={onCreate}
          className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${TIERS_ACCENT}, ${TIERS_CYAN})` }}
          whileHover={reduceMotion ? undefined : { y: -2 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
        >
          {createLabel}
        </motion.button>
      ) : null}
    </motion.div>
  );
}

export default function TierTableView({
  items,
  loading = false,
  sortKey,
  sortDir,
  onSort,
  onView,
  onEdit,
  onToggle,
  canWrite,
  contactField = "email",
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="tier-pro-shell"
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <style>{TIERS_TABLE_CSS}</style>
      <div className="tier-pro-wrap">
        <table>
          <thead className="tier-pro-head">
            <tr>
              {COLUMNS.map((col) => {
                const Icon = col.Icon;
                const sortable = !!col.sortKey;
                return (
                  <th
                    key={col.key}
                    className={`${hideClass(col.hide)} ${col.align === "right" ? "text-right" : ""} ${
                      sortable ? "" : "no-sort"
                    }`}
                    onClick={sortable ? () => onSort?.(col.sortKey) : undefined}
                  >
                    <span
                      className={`tier-pro-head__cell ${
                        col.align === "right" ? "w-full justify-end" : ""
                      }`}
                    >
                      {Icon ? (
                        <span className="tier-pro-head__icon">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      {col.label}
                      {sortable ? (
                        <SortArrow active={sortKey === col.sortKey} dir={sortDir} />
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton />
            ) : (
              items.map((item, index) => (
                <TierProRow
                  key={item.id}
                  item={item}
                  index={index}
                  contactField={contactField}
                  canWrite={canWrite}
                  onView={onView}
                  onEdit={onEdit}
                  onToggle={onToggle}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
