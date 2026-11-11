import { CoutCardSkeleton } from "../../pages/stock/components/CoutSkeleton";
import { fmtNum } from "../../pages/stock/CoutStockageCharts";
import { rotationBadgeFromTaux, rotationGaugeScore } from "./rotationReportHelpers";

function ArticleRotationRing({ score, badge }) {
  const size = 76;
  const sw = 5;
  const radius = (size - sw) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`${badge.label} : ${score} %`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-background-secondary, var(--bg-input))"
          strokeWidth={sw}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={badge.color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1.5 text-center leading-none">
        <span className="text-xs font-bold tabular-nums" style={{ color: badge.color }}>
          {score}%
        </span>
        <div className="mt-1 space-y-px">
          {badge.labelLines.map((line) => (
            <span key={line} className="block text-[7px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {line}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RotationArticleCard({ row, showDepot, delayIndex }) {
  const score = rotationGaugeScore(row.taux);
  const badge = rotationBadgeFromTaux(row.taux);
  const depotHint = showDepot && row.depot?.code
    ? `${row.depot.code}${row.depot.libelle ? ` · ${row.depot.libelle}` : ""}`
    : null;
  const metrics = `Stock moy: ${fmtNum(row.stockMoyen, 2)} · Vendu: ${fmtNum(row.qteVendue, 2)}`;

  return (
    <div
      className="relative rounded-xl border p-4"
      style={{
        background: "var(--color-background-primary, var(--bg-card))",
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        animation: `fadeUp 0.35s ease ${delayIndex * 40}ms both`,
      }}
    >
      <span
        className="absolute left-3 top-3 h-2 w-2 rounded-full"
        style={{ background: badge.color }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 pl-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {row.article?.libelle || "Article"}
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--text-primary)]">
            {row.article?.code || "—"}
          </p>
          {depotHint ? (
            <p className="mt-1.5 truncate text-[11px] text-[var(--text-muted)]">{depotHint}</p>
          ) : null}
          <p className="mt-1.5 text-xs leading-snug text-[var(--text-secondary)]">{metrics}</p>
        </div>
        <ArticleRotationRing score={score} badge={badge} />
      </div>
    </div>
  );
}

export default function RotationReportCards({ items, isLoading, showDepot }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CoutCardSkeleton key={i} delayIndex={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>Aucune donnée pour cette période</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((row, i) => (
        <RotationArticleCard
          key={`${row.articleId}-${row.depotId}`}
          row={row}
          showDepot={showDepot}
          delayIndex={i % 8}
        />
      ))}
    </div>
  );
}
