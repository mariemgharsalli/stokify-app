import { INV_THEME } from "../inventaireUtils";

export default function ProgressBar({ value = 0, height = 8, className = "" }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color =
    pct >= 100 ? INV_THEME.success : pct >= 50 ? INV_THEME.cyan : INV_THEME.accent;

  return (
    <div className={className}>
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, background: "var(--border-subtle, var(--border-default))" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}bb, ${color})`,
            boxShadow: `0 0 10px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}
