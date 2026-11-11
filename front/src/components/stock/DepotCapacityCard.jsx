import { useEffect, useState } from "react";
import { IconAlertTriangle, IconBox, IconBuildingWarehouse } from "@tabler/icons-react";

const COLORS = {
  OK: "#1D9E75",
  CRITIQUE: "#BA7517",
  DEPASSE: "#E24B4A",
  NON_CONFIGURE: "#64748b",
};

function statutColor(statut) {
  return COLORS[statut] || COLORS.OK;
}

function worstStatut(volumeStatut, poidsStatut) {
  const order = { DEPASSE: 3, CRITIQUE: 2, OK: 1, NON_CONFIGURE: 0 };
  const v = order[volumeStatut] ?? 0;
  const p = order[poidsStatut] ?? 0;
  if (v >= p) return volumeStatut;
  return poidsStatut;
}

function CapacityBar({ label, occupe, capacite, pct, statut }) {
  const [animated, setAnimated] = useState(false);
  const color = statutColor(statut);
  const displayPct = pct != null ? Math.min(100, pct) : 0;

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, [pct]);

  if (capacite == null) {
    return (
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</p>
        <p className="text-sm text-[var(--text-secondary)]">Capacité non configurée</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>
          {displayPct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div
          className={`h-full rounded-full ${statut === "DEPASSE" ? "animate-pulse-capacity" : ""}`}
          style={{
            width: animated ? `${displayPct}%` : "0%",
            backgroundColor: color,
            transition: "width 1.2s ease",
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)] font-mono">
        {Number(occupe).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        {" / "}
        {Number(capacite).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
        {label.includes("Volume") ? " m³" : " kg"}
      </p>
    </div>
  );
}

export default function DepotCapacityCard({ data, depotEditPath: _depotEditPath, className = "" }) {
  if (!data) return null;

  const accent = statutColor(worstStatut(data.statutVolume, data.statutPoids));
  const notConfigured = data.capaciteVolume == null && data.capacitePoids == null;

  // Ne pas afficher la carte si aucune capacité n'est définie
  if (notConfigured) return null;

  return (
    <div
      className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 animate-fadeUp ${className}`}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <IconBuildingWarehouse size={18} style={{ color: accent }} />
        <h3 className="font-semibold text-[var(--text-primary)]">{data.depotLibelle}</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <CapacityBar
          label="Volume occupé"
          occupe={data.volumeOccupe}
          capacite={data.capaciteVolume}
          pct={data.pctVolume}
          statut={data.statutVolume}
        />
        <CapacityBar
          label="Poids total"
          occupe={data.poidsTotal}
          capacite={data.capacitePoids}
          pct={data.pctPoids}
          statut={data.statutPoids}
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {data.articlesDangereux?.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-[#BA7517]/15 text-[#BA7517] border border-[#BA7517]/30">
            <IconAlertTriangle size={12} />
            {data.articlesDangereux.length} article{data.articlesDangereux.length > 1 ? "s" : ""} dangereux
          </span>
        )}
        {data.articlesFragiles?.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-[#378ADD]/15 text-[#378ADD] border border-[#378ADD]/30">
            <IconBox size={12} />
            {data.articlesFragiles.length} article{data.articlesFragiles.length > 1 ? "s" : ""} fragiles
          </span>
        )}
      </div>
    </div>
  );
}
