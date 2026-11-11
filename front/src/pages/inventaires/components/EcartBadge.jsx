import { INV_THEME } from "../inventaireUtils";

export default function EcartBadge({ ecart }) {
  if (ecart === null || ecart === undefined || Number.isNaN(Number(ecart))) {
    return (
      <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
        —
      </span>
    );
  }
  const n = Number(ecart);
  if (Math.abs(n) < 1e-9) {
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: `${INV_THEME.success}22`, color: "#6ee7b7" }}
      >
        Conforme
      </span>
    );
  }
  if (n < 0) {
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
        style={{ background: `${INV_THEME.danger}22`, color: "#fca5a5" }}
      >
        {n}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ background: `${INV_THEME.amber}22`, color: "#fbbf24" }}
    >
      +{n}
    </span>
  );
}
