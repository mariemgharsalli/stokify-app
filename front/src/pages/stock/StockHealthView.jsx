import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import { getLineStockMin } from "../../hooks/useStockGroupes";
import ArticleThumb from "../../components/stock/ArticleThumb";

function AlertColumn({ title, icon, color, emptyMsg, items, renderItem }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: "var(--border-default)", borderTop: `3px solid ${color}` }}
    >
      <div
        className="flex items-center justify-between p-4"
        style={{ background: "var(--bg-input)" }}
      >
        <div className="flex items-center gap-2">
          <i className={`ti ${icon}`} style={{ color, fontSize: 16 }} aria-hidden="true" />
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: `${color}20`, color }}
        >
          {items.length}
        </span>
      </div>
      <div
        className="max-h-[480px] divide-y overflow-y-auto"
        style={{ borderColor: "var(--border-default)" }}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center p-4 py-8 text-center">
            <i className="ti ti-circle-check mb-2 text-2xl" style={{ color: "#1D9E75" }} aria-hidden="true" />
            <p className="text-xs text-[var(--text-secondary)]">{emptyMsg}</p>
          </div>
        ) : (
          items.map((s, i) => renderItem(s, i))
        )}
      </div>
    </div>
  );
}

function AlertCard({ i, color, stock, badge, badgeBg, countdown, action }) {
  return (
    <div
      className="p-3 transition-colors"
      style={{
        animation: `fadeUp 0.3s ease ${i * 40}ms both`,
        background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-input)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ArticleThumb article={stock.article} alt="" size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                {stock.article?.libelle || stock.article?.code}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                {stock.article?.code} · {stock.depot?.libelle || stock.depot?.code}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: badgeBg, color }}
          >
            {badge}
          </span>
          <span className="text-xs font-semibold" style={{ color }}>
            {Number(stock.quantite).toLocaleString("fr-FR")} UN
          </span>
        </div>
      </div>
      {countdown !== null && countdown <= 7 && (
        <div
          className="mt-2 flex items-center gap-1 rounded-lg px-2 py-1"
          style={{ background: "rgba(226,75,74,0.08)" }}
        >
          <i className="ti ti-alarm text-[10px]" style={{ color: "#E24B4A" }} aria-hidden="true" />
          <span className="text-[10px] font-medium" style={{ color: "#E24B4A" }}>
            Expire dans {countdown} jour{countdown > 1 ? "s" : ""} !
          </span>
          <div
            className="ml-1 h-1.5 w-1.5 rounded-full"
            style={{ background: "#E24B4A", animation: "pulse 1s infinite" }}
          />
        </div>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors"
          style={{ background: `${action.color}12`, color: action.color }}
        >
          <i className={`ti ${action.icon} text-xs`} aria-hidden="true" />
          {action.label}
        </button>
      )}
    </div>
  );
}

export default function StockHealthView({ stocks, societeScope }) {
  const navigate = useNavigate();

  const { data: lotsData } = useQuery({
    queryKey: ["lots-expiring-health", societeScope],
    queryFn: () => api.get("lots/expiring-soon", { params: { days: 30, limit: 500 } }).then((r) => r.data),
    enabled: societeScope != null,
  });

  const enrichedStocks = useMemo(() => {
    const lotsByArticle = new Map();
    for (const lot of lotsData?.items || []) {
      const aid = lot.articleId ?? lot.article?.id;
      if (!aid) continue;
      if (!lotsByArticle.has(aid)) lotsByArticle.set(aid, []);
      lotsByArticle.get(aid).push(lot);
    }
    return stocks.map((s) => {
      const aid = s.articleId ?? s.article?.id;
      const lots = lotsByArticle.get(aid) || [];
      return {
        ...s,
        article: { ...s.article, lots: lots.length ? lots : s.article?.lots },
      };
    });
  }, [stocks, lotsData]);

  const total = enrichedStocks.length;
  const ruptures = enrichedStocks.filter((s) => Number(s.quantite) <= 0).length;
  const critiques = enrichedStocks.filter((s) => {
    const seuil = getLineStockMin(s) ?? 0;
    return Number(s.quantite) > 0 && Number(s.quantite) <= seuil;
  }).length;
  const expirants = enrichedStocks.filter((s) => {
    if (!s.article?.lots?.length) return false;
    return s.article.lots.some((l) => {
      if (!l.dateExpiration) return false;
      const days = Math.ceil((new Date(l.dateExpiration) - new Date()) / 86400000);
      return days >= 0 && days <= 30;
    });
  }).length;

  const score =
    total === 0
      ? 100
      : Math.max(
          0,
          Math.round(100 - (ruptures / total) * 50 - (critiques / total) * 30 - (expirants / total) * 20)
        );

  const scoreColor = score >= 75 ? "#1D9E75" : score >= 50 ? "#BA7517" : "#E24B4A";
  const scoreLabel = score >= 75 ? "Bon" : score >= 50 ? "Attention" : "Critique";

  return (
    <div style={{ animation: "fadeUp 0.4s ease" }}>
      <div
        className="mb-6 flex flex-col items-center gap-4 rounded-2xl border p-6 sm:flex-row"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-default)",
          borderLeft: `4px solid ${scoreColor}`,
        }}
      >
        <div className="relative shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`Indice de santé du stock: ${score}%`}>
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-input)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke={scoreColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 50}`}
              strokeDashoffset={`${2 * Math.PI * 50 * (1 - score / 100)}`}
              transform="rotate(-90 60 60)"
              style={{
                transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)",
                filter: `drop-shadow(0 0 6px ${scoreColor}40)`,
              }}
            />
            <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="600" fill={scoreColor}>
              {score}
            </text>
            <text x="60" y="72" textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              / 100
            </text>
          </svg>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold" style={{ color: scoreColor }}>
              Indice de santé : {scoreLabel}
            </h2>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: `${scoreColor}15`, color: scoreColor }}
            >
              {score}%
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Basé sur {total} ligne(s) de stock · {ruptures} rupture(s) · {critiques} critique(s) · {expirants}{" "}
            expirant(s) bientôt
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Ruptures", count: ruptures, impact: 50, color: "#E24B4A", icon: "ti-circle-x" },
              { label: "Critiques", count: critiques, impact: 30, color: "#BA7517", icon: "ti-alert-triangle" },
              { label: "DLC < 30j", count: expirants, impact: 20, color: "#7F77DD", icon: "ti-clock" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-secondary)]">{item.label}</span>
                  <span className="text-sm font-semibold" style={{ color: item.color }}>
                    {item.count}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-card)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: total > 0 ? `${(item.count / total) * 100}%` : "0%",
                      background: item.color,
                      transition: "width 1s ease",
                    }}
                  />
                </div>
                <div className="mt-1 text-[9px] text-[var(--text-muted)]">Impact: -{item.impact}pts max</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AlertColumn
          title="Ruptures urgentes"
          icon="ti-circle-x"
          color="#E24B4A"
          emptyMsg="Aucune rupture"
          items={enrichedStocks.filter((s) => Number(s.quantite) <= 0)}
          renderItem={(s, i) => (
            <AlertCard
              key={s.id}
              i={i}
              color="#E24B4A"
              stock={s}
              badge="Rupture"
              badgeBg="rgba(226,75,74,0.12)"
              countdown={null}
              action={{
                label: "Commander",
                icon: "ti-shopping-cart",
                color: "#E24B4A",
                onClick: () => navigate(`/achats/new?articleId=${s.articleId ?? s.article?.id}`),
              }}
            />
          )}
        />

        <AlertColumn
          title="Expirent bientôt (< 30j)"
          icon="ti-clock"
          color="#7F77DD"
          emptyMsg="Aucune expiration proche"
          items={enrichedStocks.filter((s) =>
            s.article?.lots?.some((l) => {
              if (!l.dateExpiration) return false;
              const d = Math.ceil((new Date(l.dateExpiration) - new Date()) / 86400000);
              return d >= 0 && d <= 30;
            })
          )}
          renderItem={(s, i) => {
            const nearestLot = s.article?.lots
              ?.filter((l) => l.dateExpiration)
              ?.sort((a, b) => new Date(a.dateExpiration) - new Date(b.dateExpiration))[0];
            const daysLeft = nearestLot
              ? Math.ceil((new Date(nearestLot.dateExpiration) - new Date()) / 86400000)
              : null;
            return (
              <AlertCard
                key={s.id}
                i={i}
                color="#7F77DD"
                stock={s}
                badge={daysLeft !== null ? `J-${daysLeft}` : "DLC proche"}
                badgeBg="rgba(127,119,221,0.12)"
                countdown={daysLeft}
                action={{
                  label: "Voir les lots",
                  icon: "ti-barcode",
                  color: "#7F77DD",
                  onClick: () => navigate(`/lots?articleId=${s.articleId ?? s.article?.id}`),
                }}
              />
            );
          }}
        />

        <AlertColumn
          title="Stock critique / mort"
          icon="ti-alert-triangle"
          color="#BA7517"
          emptyMsg="Aucun stock critique"
          items={enrichedStocks.filter((s) => {
            const seuil = getLineStockMin(s) ?? 0;
            return Number(s.quantite) > 0 && Number(s.quantite) <= seuil;
          })}
          renderItem={(s, i) => (
            <AlertCard
              key={s.id}
              i={i}
              color="#BA7517"
              stock={s}
              badge="Critique"
              badgeBg="rgba(186,117,23,0.12)"
              countdown={null}
              action={{
                label: "Commander",
                icon: "ti-shopping-cart",
                color: "#BA7517",
                onClick: () => navigate(`/achats/new?articleId=${s.articleId ?? s.article?.id}`),
              }}
            />
          )}
        />
      </div>
    </div>
  );
}
