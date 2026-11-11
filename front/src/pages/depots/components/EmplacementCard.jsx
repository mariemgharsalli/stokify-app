import { MoreVertical, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { highlightMatch } from "./depotUtils";
import {
  DepotStatutBadge,
  canDeleteEmplacementPermanent,
  parseDepotStatut,
} from "../depotStatusUi";

function occupationColor(rate) {
  if (rate < 50) return "#1D9E75";
  if (rate <= 80) return "#EF9F27";
  return "#E24B4A";
}

function EmpDeleteMenu({ anchorRect, close, onDelete }) {
  useEffect(() => {
    if (!anchorRect) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchorRect, close]);

  if (!anchorRect) return null;

  const menuWidth = 200;
  const left = Math.max(
    12,
    Math.min(anchorRect.right - menuWidth, window.innerWidth - menuWidth - 12)
  );
  const top = anchorRect.bottom + 6;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[200]" onClick={close} role="presentation" />
      <div
        className="fixed z-[210] w-[200px] overflow-hidden rounded-xl border p-1.5 shadow-2xl"
        style={{
          top,
          left,
          background: "var(--bg-dropdown, var(--bg-card, #fff))",
          borderColor: "var(--border-default)",
          boxShadow: "0 20px 40px -12px rgba(11, 31, 58, 0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#E24B4A] transition-colors hover:bg-[rgba(226,75,74,0.1)]"
          onClick={() => {
            onDelete();
            close();
          }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(226,75,74,0.12)]">
            <Trash2 className="h-3.5 w-3.5" />
          </span>
          Supprimer définitivement
        </button>
      </div>
    </>,
    document.body
  );
}

export default function EmplacementCard({
  emp,
  search,
  index = 0,
  onEdit,
  onToggleStatut,
  onDelete,
  canWrite,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const occupationRate = emp.remplissagePct ?? 0;
  const locationParts = [emp.zone, emp.rayon, emp.etagere].filter(Boolean);
  const locationLabel = locationParts.length
    ? locationParts.join(" · ")
    : emp.categorie || "—";
  const statut = parseDepotStatut(emp);
  const canDeletePermanent = canDeleteEmplacementPermanent(emp);

  return (
    <div
      className="group relative rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        animation: `fadeUp 0.3s ease ${index * 40}ms both`,
        background: "var(--color-background-primary, var(--bg-card))",
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        borderLeft: `3px solid ${emp.zoneDangereuse ? "#BA7517" : "#378ADD"}`,
        opacity: statut === "INACTIF" ? 0.85 : 1,
      }}
      title={
        emp.topArticles?.length
          ? `Articles : ${emp.topArticles.map((a) => a.libelle).join(", ")}`
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold"
              style={{ background: "rgba(55,138,221,0.12)", color: "#378ADD" }}
            >
              {highlightMatch(emp.code, search)}
            </span>
            <DepotStatutBadge row={emp} />
            {emp.zoneDangereuse && (
              <span
                className="rounded-md px-1.5 py-0.5 text-[9px] font-medium"
                style={{ background: "rgba(186,117,23,0.12)", color: "#BA7517" }}
              >
                ⚠ Zone dangereuse
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-primary,var(--text-primary))]">
            {highlightMatch(emp.libelle, search)}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary,var(--text-muted))]">
            {locationLabel}
            {emp.capaciteUnites
              ? ` · cap. ${emp.capaciteUnites} u.`
              : emp.capaciteSlots
                ? ` · cap. ${emp.capaciteSlots} u.`
                : emp.niveaux
                  ? ` · ${emp.niveaux} niv.`
                  : ""}
            {emp.distanceQuai != null ? ` · quai ${emp.distanceQuai}` : ""}
          </p>
        </div>

        {canWrite && (
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(emp)}
              className="rounded-lg p-1.5"
              style={{ color: "#378ADD" }}
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onToggleStatut(emp)}
              className="rounded-lg p-1.5"
              title={statut === "ACTIF" ? "Désactiver cet emplacement" : "Réactiver cet emplacement"}
              aria-label={statut === "ACTIF" ? "Désactiver" : "Réactiver"}
            >
              {statut === "ACTIF" ? (
                <PowerOff className="h-3.5 w-3.5 text-[var(--color-text-tertiary,var(--text-muted))]" />
              ) : (
                <Power className="h-3.5 w-3.5 text-[#1D9E75]" />
              )}
            </button>
            {canDeletePermanent && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuAnchor(menuAnchor ? null : rect);
                  }}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] p-1.5 text-[var(--text-primary)]"
                  aria-label="Plus d'actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
                <EmpDeleteMenu
                  anchorRect={menuAnchor}
                  close={() => setMenuAnchor(null)}
                  onDelete={() => onDelete(emp)}
                />
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--color-background-secondary, var(--bg-app))" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(occupationRate, 100)}%`,
              background: occupationColor(occupationRate),
            }}
          />
        </div>
      </div>
    </div>
  );
}
