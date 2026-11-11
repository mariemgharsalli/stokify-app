import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, CircleCheck, Users } from "lucide-react";
import { formatTnd } from "../comptabiliteUtils";

const PAGE_SIZE_OPTIONS = [5, 10, 25];

function EmptyState({ title, subtitle, color = "#1D9E75" }) {
  return (
    <div className="px-5 py-8 text-center">
      <div
        className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `${color}18` }}
      >
        <CircleCheck className="h-5 w-5" style={{ color }} aria-hidden />
      </div>
      <p className="text-sm font-medium" style={{ color }}>
        {title}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
    </div>
  );
}

function ImpayeRow({ item, type, index, onNavigate }) {
  const isAchat = type === "achat";
  const tier = isAchat ? item.fournisseur : item.client;
  const isEnRetard = isAchat && item.echeance && new Date(item.echeance) < new Date();
  const amountColor = isAchat ? "#EF9F27" : "#E24B4A";
  const avatarBg = isAchat ? "rgba(55,138,221,0.12)" : "rgba(226,75,74,0.12)";
  const avatarColor = isAchat ? "#378ADD" : "#E24B4A";

  return (
    <div
      role="button"
      tabIndex={0}
      className="grid cursor-pointer grid-cols-[1fr_140px_100px] items-center border-t border-[var(--border-default)] px-4 py-2.5 transition-colors hover:bg-white/[0.02] md:px-[18px]"
      style={{ animation: `fadeIn 0.3s ease ${index * 0.05}s both` }}
      onClick={onNavigate}
      onKeyDown={(e) => e.key === "Enter" && onNavigate()}
    >
      <div className="min-w-0">
        <div className="font-mono text-xs font-medium text-violet-300">{item.reference}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold"
            style={{ background: avatarBg, color: avatarColor }}
          >
            {(tier?.nom || "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate">{tier?.nom ?? "—"}</span>
        </div>
      </div>
      <div>
        {isAchat ? (
          item.echeance ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
              style={{
                background: isEnRetard ? "rgba(226,75,74,0.1)" : "rgba(239,159,39,0.1)",
                color: isEnRetard ? "#E24B4A" : "#EF9F27",
                borderColor: isEnRetard ? "rgba(226,75,74,0.25)" : "rgba(239,159,39,0.25)",
              }}
            >
              {isEnRetard && <AlertTriangle className="h-3 w-3" aria-hidden />}
              {new Date(item.echeance).toLocaleDateString("fr-FR")}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">—</span>
          )
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">
            {item.dateLivraison
              ? new Date(item.dateLivraison).toLocaleDateString("fr-FR")
              : "—"}
          </span>
        )}
      </div>
      <div className="text-right text-sm font-medium tabular-nums" style={{ color: amountColor }}>
        {formatTnd(item.montantDu)}
      </div>
    </div>
  );
}

function ListPagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange, unitLabel }) {
  const nums = useMemo(() => {
    if (totalPages <= 1) return [1];
    const out = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, Math.max(start + 4, page + 2));
    const from = Math.max(1, end - 4);
    for (let p = from; p <= end; p += 1) out.push(p);
    return out;
  }, [page, totalPages]);

  if (total === 0) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border-default)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between md:px-[18px]">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          Par page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none"
            aria-label="Nombre par page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          sur <span className="font-medium text-[var(--text-secondary)]">{total}</span> {unitLabel}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {nums.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px] font-semibold transition ${
              p === page
                ? "text-white"
                : "border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            }`}
            style={p === page ? { background: "var(--accent-primary)" } : undefined}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ImpayesPanel({
  type,
  title,
  subtitle,
  items,
  badgeLabel,
  badgeColor,
  icon: Icon,
  iconBg,
  iconColor,
  totalLabel,
  totalColor,
  emptyTitle,
  emptySubtitle,
}) {
  const navigate = useNavigate();
  const isAchat = type === "achat";
  const total = items.reduce((s, i) => s + Number(i.montantDu || 0), 0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const listKey = items.map((item) => item.id).join(",");
  useEffect(() => {
    setPage(1);
  }, [listKey, pageSize]);

  return (
    <div className="animate-fade-up overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3.5 md:px-[18px]">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: iconBg }}
          >
            <Icon className="h-4 w-4" style={{ color: iconColor }} aria-hidden />
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">{title}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{subtitle}</div>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
          style={{
            background: `${badgeColor}18`,
            borderColor: `${badgeColor}40`,
            color: badgeColor,
            animation: !isAchat && items.length > 0 ? "pulse 2s ease infinite" : undefined,
          }}
        >
          {items.length} {badgeLabel}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_140px_100px] bg-black/10 px-4 py-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)] md:px-[18px]">
            <span>{isAchat ? "Référence / Fournisseur" : "Référence / Client"}</span>
            <span>{isAchat ? "Échéance" : "Livré le"}</span>
            <span className="text-right">Montant dû</span>
          </div>
          {pageItems.map((item, i) => (
            <ImpayeRow
              key={item.id}
              item={item}
              type={type}
              index={i}
              onNavigate={() =>
                navigate(isAchat ? `/achats/${item.achatId}` : `/ventes/${item.venteId}`)
              }
            />
          ))}
          <div className="grid grid-cols-[1fr_140px_100px] border-t border-[var(--border-default)] bg-black/15 px-4 py-2.5 md:px-[18px]">
            <span className="text-xs text-[var(--text-muted)]">{totalLabel}</span>
            <span />
            <span className="text-right text-[15px] font-medium tabular-nums" style={{ color: totalColor }}>
              {formatTnd(total)}
            </span>
          </div>
          <ListPagination
            page={safePage}
            totalPages={totalPages}
            total={items.length}
            pageSize={pageSize}
            unitLabel={badgeLabel}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}

export default function ComptabiliteImpayes({ impayesAchats = [], impayesVentes = [] }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
      <ImpayesPanel
        type="achat"
        title="Factures achats non réglées"
        subtitle="Dettes envers les fournisseurs"
        items={impayesAchats}
        badgeLabel="achat(s)"
        badgeColor="#EF9F27"
        icon={Building2}
        iconBg="rgba(55,138,221,0.12)"
        iconColor="#378ADD"
        totalLabel="Total dû"
        totalColor="#EF9F27"
        emptyTitle="Aucun impayé achat"
        emptySubtitle="Tous les fournisseurs sont réglés"
      />
      <ImpayesPanel
        type="vente"
        title="Factures ventes non encaissées"
        subtitle="Créances clients en attente"
        items={impayesVentes}
        badgeLabel="vente(s)"
        badgeColor="#E24B4A"
        icon={Users}
        iconBg="rgba(226,75,74,0.12)"
        iconColor="#E24B4A"
        totalLabel="Total à encaisser"
        totalColor="#E24B4A"
        emptyTitle="Aucun impayé client"
        emptySubtitle="Tous les clients ont réglé"
      />
    </div>
  );
}
