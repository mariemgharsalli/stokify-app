import { useQuery } from "@tanstack/react-query";
import { MapPin, Package } from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import ArticlePhoto from "./ArticlePhoto";
import { getArticleRealImageUrl } from "../../utils/articleImage";
import { depotLines, formatDay, formatQty, levelFor, qtyOf, reservedOf } from "../lib/scanFacts";
import { fr } from "../strings/fr";

const LEVEL_COLOR = {
  ok: "var(--accent-success)",
  low: "var(--accent-warning)",
  out: "var(--accent-danger)",
};

function listFrom(data) {
  return Array.isArray(data) ? data : data?.items ?? [];
}

function LevelPill({ level }) {
  const label = level === "low" ? fr.stockLow : level === "out" ? fr.stockOut : fr.stockOk;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: LEVEL_COLOR[level], background: `color-mix(in srgb, ${LEVEL_COLOR[level]} 16%, transparent)` }}
    >
      {label}
    </span>
  );
}

function Identity({ imageUrl, title, code, kicker }) {
  return (
    <div className="flex items-center gap-3">
      <ArticlePhoto imageUrl={imageUrl} title={title} className="is-lg" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
          {kicker}
        </p>
        <h1 className="truncate text-xl font-semibold">{title}</h1>
        {code ? (
          <p className="truncate text-sm" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: "var(--text-secondary)" }}>
            {code}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function QtyBlock({ label, qty, unite, reserved, level }) {
  const available = Math.max(0, (Number(qty) || 0) - (Number(reserved) || 0));
  return (
    <div className="mt-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
          {label}
        </p>
        <p className="text-5xl font-semibold leading-none" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
          {formatQty(qty)}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          {unite || fr.unitPiece}
          {reserved > 0 ? ` · ${fr.qtyAvailable} ${formatQty(available)} · ${fr.qtyReserved} ${formatQty(reserved)}` : ""}
        </p>
      </div>
      {level ? <LevelPill level={level} /> : null}
    </div>
  );
}

function PlaceList({ rows }) {
  if (!rows.length) {
    return <p className="mt-4 text-base" style={{ color: "var(--text-secondary)" }}>{fr.noStockHere}</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {rows.map((row) => {
        const place = row.emplacement?.code || row.emplacement?.libelle || fr.noPlace;
        const name = row.emplacement?.libelle && row.emplacement?.code ? row.emplacement.libelle : "";
        return (
          <li
            key={row.id ?? `${place}-${row.quantite}`}
            className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3"
            style={{ background: "var(--bg-app)" }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin size={16} aria-hidden style={{ color: "var(--accent-primary)" }} />
              <span className="truncate">
                <span className="font-semibold">{place}</span>
                {name ? <span style={{ color: "var(--text-secondary)" }}> · {name}</span> : null}
              </span>
            </span>
            <span className="shrink-0 font-semibold" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              {formatQty(row.quantite)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SuggestionButton({ title, meta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-3 text-start touch-manipulation"
      style={{ background: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">{title}</span>
        {meta ? (
          <span className="block truncate text-sm" style={{ color: "var(--text-secondary)" }}>{meta}</span>
        ) : null}
      </span>
      <Package size={18} aria-hidden style={{ color: "var(--accent-primary)" }} />
    </button>
  );
}

export default function ScanTicket({ result, depotId, onRescan, onOpen }) {
  const kind = result?.kind;
  const data = result?.data || {};
  const raw = result?.parsed?.value || "";
  const article = kind === "article" ? data : data.article || null;
  const lines = depotLines(article?.stocks, depotId);
  const qty = kind === "stock-line" ? Number(data.quantite) || 0 : kind === "lot" ? Number(data.quantiteRestante) || 0 : qtyOf(lines);
  const reserved = kind === "stock-line" ? Number(data.qteReservee) || 0 : kind === "article" ? reservedOf(lines) : 0;
  const level = kind === "article" || kind === "stock-line" ? levelFor(qty, article) : kind === "lot" ? levelFor(qty, null) : null;
  const imageUrl = getArticleRealImageUrl(article);

  const placeQuery = useQuery({
    queryKey: ["terrain", "scan", "emplacement", depotId, kind === "emplacement" ? data.id : null],
    enabled: kind === "emplacement" && data.id != null && depotId != null,
    queryFn: async () => {
      const { data: payload } = await api.get("stock", {
        params: { depotId, emplacementId: data.id, limit: 40 },
      });
      return listFrom(payload);
    },
  });

  const title =
    kind === "emplacement"
      ? data.code || data.libelle || fr.kindEmplacement
      : kind === "lot"
        ? data.numero || article?.libelle || fr.kindLot
        : article?.libelle || data.libelle || article?.code || fr.kindArticle;
  const code =
    kind === "emplacement"
      ? data.libelle || ""
      : kind === "lot"
        ? article?.code || ""
        : article?.code || data.code || article?.codeBarres || "";

  const suggestions = result?.suggestions || { articles: [], emplacements: [] };
  const hasSuggestions = (suggestions.articles?.length || 0) + (suggestions.emplacements?.length || 0) > 0;

  return (
    <article className="overflow-hidden rounded-3xl border" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }}>
      <div className="h-1.5" style={{ background: level ? LEVEL_COLOR[level] : "var(--accent-primary)" }} aria-hidden />
      <div className="p-4">
        {kind === "unknown" ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent-warning)" }}>
              {fr.scanUnknown}
            </p>
            <h1 className="mt-2 break-all text-2xl font-semibold" style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
              {raw || "—"}
            </h1>
            <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
              {hasSuggestions ? fr.scanSuggestLead : fr.scanUnknownHint}
            </p>
            {hasSuggestions ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
                  {fr.suggestions}
                </p>
                {(suggestions.articles || []).map((item) => (
                  <SuggestionButton
                    key={`a-${item.id}`}
                    title={item.libelle || item.code}
                    meta={item.code || item.codeBarres}
                    onClick={() => onOpen({ kind: "article", data: item })}
                  />
                ))}
                {(suggestions.emplacements || []).map((item) => (
                  <SuggestionButton
                    key={`e-${item.id}`}
                    title={item.code || item.libelle}
                    meta={item.libelle || fr.kindEmplacement}
                    onClick={() => onOpen({ kind: "emplacement", data: item })}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <Identity
              imageUrl={imageUrl}
              title={title}
              code={code}
              kicker={
                kind === "stock-line"
                  ? fr.kindStock
                  : kind === "lot"
                    ? fr.kindLot
                    : kind === "emplacement"
                      ? fr.kindEmplacement
                      : fr.kindArticle
              }
            />
            {kind === "emplacement" ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>
                  {fr.linesHere}
                </p>
                {placeQuery.isPending ? (
                  <p className="mt-2 text-base" role="status" style={{ color: "var(--text-secondary)" }}>{fr.scanResolving}</p>
                ) : null}
                {placeQuery.isError ? (
                  <p className="mt-2 text-base" role="alert">{getAxiosErrorMessage(placeQuery.error, fr.depotError)}</p>
                ) : null}
                {placeQuery.isSuccess && placeQuery.data.length === 0 ? (
                  <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>{fr.placeEmpty}</p>
                ) : null}
                {placeQuery.isSuccess && placeQuery.data.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {placeQuery.data.map((line) => (
                      <SuggestionButton
                        key={line.id}
                        title={line.article?.libelle || line.article?.code || `#${line.id}`}
                        meta={`${line.article?.code || ""} · ${formatQty(line.quantite)} ${line.article?.unite || ""}`.trim()}
                        onClick={() => onOpen({ kind: "stock-line", data: line })}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <QtyBlock
                  label={kind === "lot" ? fr.lotRemaining : kind === "stock-line" ? fr.qtyOnLine : fr.qtyOnHand}
                  qty={qty}
                  unite={article?.unite}
                  reserved={reserved}
                  level={level}
                />
                {kind === "lot" && data.dateExpiration ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {fr.lotExpiry} · {formatDay(data.dateExpiration)}
                  </p>
                ) : null}
                {kind === "article" ? <PlaceList rows={lines} /> : null}
                {kind === "stock-line" && (data.emplacement?.code || data.emplacement?.libelle) ? (
                  <p className="mt-3 flex items-center gap-2 text-base">
                    <MapPin size={16} aria-hidden style={{ color: "var(--accent-primary)" }} />
                    {data.emplacement?.code || data.emplacement?.libelle}
                    {data.emplacement?.libelle && data.emplacement?.code ? ` · ${data.emplacement.libelle}` : ""}
                  </p>
                ) : null}
              </>
            )}
            {raw ? (
              <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                {fr.codeRead} : {raw}
              </p>
            ) : null}
          </>
        )}

        <button
          type="button"
          onClick={onRescan}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-base font-semibold text-white touch-manipulation"
          style={{ background: "var(--accent-primary)" }}
        >
          {fr.rescan}
        </button>
      </div>
    </article>
  );
}
