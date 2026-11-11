import { useMemo } from "react";
import { MODES_CONFIG } from "../../constants/modesPaiementConfig";

const GRID = "grid grid-cols-[220px_1fr_130px_130px_140px_90px]";

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 3 });
}

function StatusBadge({ statut }) {
  const valide = !statut || statut === "VALIDE";
  if (valide) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(29,158,117,0.25)] bg-[rgba(29,158,117,0.1)] px-2 py-0.5 text-[10px] font-medium text-[#1D9E75]">
        <i className="ti ti-check text-[11px]" aria-hidden="true" />
        Validé
      </span>
    );
  }
  if (statut === "EN_ATTENTE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,159,39,0.3)] bg-[rgba(239,159,39,0.1)] px-2 py-0.5 text-[10px] font-medium text-[#EF9F27]">
        <i className="ti ti-clock text-[11px]" aria-hidden="true" />
        En attente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-card-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
      {statut}
    </span>
  );
}

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, i) => (
    <div
      key={i}
      className={`${GRID} gap-4 border-b border-[var(--border-default)] px-[18px] py-3`}
      style={{ animation: `pulseUrgent 1.5s ease ${i * 0.1}s infinite` }}
    >
      {[140, 180, 100, 90, 110, 60].map((w, j) => (
        <div key={j} className="h-5 rounded-md bg-[var(--bg-card-hover)]" style={{ width: w, maxWidth: "100%" }} />
      ))}
    </div>
  ));
}

export default function ReglementsTable({ reglements, type, loading, filtersActive }) {
  const isVente = type === "ventes";
  const accent = isVente ? "#1D9E75" : "#378ADD";
  const accentBg = isVente ? "rgba(29,158,117,0.12)" : "rgba(55,138,221,0.12)";

  const maxMontant = useMemo(
    () => Math.max(...reglements.map((r) => parseFloat(r.montant || 0)), 0),
    [reglements]
  );

  const total = useMemo(
    () => reglements.reduce((s, r) => s + parseFloat(r.montant || 0), 0),
    [reglements]
  );

  return (
    <div className="reglements-table overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
      <div
        className={`${GRID} border-b border-[var(--border-default)] bg-black/15 px-[18px] py-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]`}
      >
        <span>{isVente ? "Client" : "Fournisseur"}</span>
        <span>Référence</span>
        <span>Mode</span>
        <span>Date</span>
        <span className="text-right">Montant</span>
        <span className="text-center">Statut</span>
      </div>

      {loading ? <SkeletonRows /> : null}

      {!loading &&
        reglements.map((r, i) => {
          const modeConf = MODES_CONFIG[r.mode] || MODES_CONFIG.AUTRE;
          const nom = isVente ? r.vente?.client?.nom : r.achat?.fournisseur?.nom;
          const ref = isVente ? r.vente?.reference : r.achat?.reference;
          const datePay = r.datePayment || r.dateReglement;
          const montant = parseFloat(r.montant || 0);
          const barWidth = maxMontant > 0 ? (montant / maxMontant) * 100 : 0;
          const idShort = r.id != null ? String(r.id).slice(-4).toUpperCase() : "—";

          return (
            <div
              key={r.id ?? i}
              className={`${GRID} reglement-history-row items-center border-b border-[var(--border-default)] px-[18px] py-3 transition-colors last:border-0 hover:bg-white/[0.02]`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold"
                  style={{ background: accentBg, color: accent }}
                >
                  {(nom || "??").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[var(--text-primary)]">{nom || "—"}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">ID #{idShort}</div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="font-mono text-xs font-medium text-[#a78bfa]">{ref || "—"}</div>
                {r.numeroCheque ? (
                  <div className="text-[11px] text-[var(--text-muted)]">Chq N° {r.numeroCheque}</div>
                ) : null}
                {r.referenceVirement ? (
                  <div className="text-[11px] text-[var(--text-muted)]">Vir: {r.referenceVirement}</div>
                ) : null}
                {r.referenceEffet ? (
                  <div className="text-[11px] text-[var(--text-muted)]">Effet: {r.referenceEffet}</div>
                ) : null}
              </div>

              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                  style={{ background: modeConf.bg, borderColor: modeConf.border }}
                >
                  <i className={`ti ${modeConf.icon} text-[13px]`} style={{ color: modeConf.color }} aria-hidden="true" />
                  <span className="text-[11px] font-medium" style={{ color: modeConf.color }}>
                    {modeConf.label}
                  </span>
                </span>
              </div>

              <div>
                <div className="text-xs text-[var(--text-primary)]">
                  {datePay
                    ? new Date(datePay).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </div>
                {r.dateEcheance ? (
                  <div
                    className="mt-0.5 text-[10px]"
                    style={{
                      color: new Date(r.dateEcheance) < new Date() ? "#E24B4A" : "var(--text-muted)",
                    }}
                  >
                    Éch:{" "}
                    {new Date(r.dateEcheance).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                ) : null}
              </div>

              <div className="text-right">
                <div className="text-sm font-medium tabular-nums" style={{ color: accent }}>
                  {isVente ? "+" : "-"}
                  {fmt(montant)} TND
                </div>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-sm bg-[var(--border-default)]">
                  <div
                    className="h-full rounded-sm transition-[width] duration-700 ease-out"
                    style={{ width: `${barWidth}%`, background: accent, opacity: 0.75 }}
                  />
                </div>
              </div>

              <div className="text-center">
                <StatusBadge statut={r.statut} />
              </div>
            </div>
          );
        })}

      {!loading && reglements.length > 0 ? (
        <div
          className={`${GRID} border-t-2 border-[var(--border-default)] bg-black/20 px-[18px] py-3`}
        >
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <i className="ti ti-list-numbers" aria-hidden="true" />
            {reglements.length} règlement(s)
          </div>
          <span />
          <span />
          <span />
          <div className="text-right text-base font-medium tabular-nums" style={{ color: accent }}>
            {fmt(total)} TND
          </div>
          <span />
        </div>
      ) : null}

      {!loading && reglements.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <div
            className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: accentBg }}
          >
            <i className="ti ti-cash-off text-[28px] opacity-60" style={{ color: accent }} aria-hidden="true" />
          </div>
          <p className="text-[15px] font-medium text-[var(--text-primary)]">Aucun règlement trouvé</p>
          <p className="mt-1.5 text-[13px] text-[var(--text-muted)]">
            {filtersActive
              ? "Essayez de modifier les filtres"
              : isVente
                ? "Encaissez une vente depuis la page Ventes"
                : "Réglez un achat depuis la page Achats"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
