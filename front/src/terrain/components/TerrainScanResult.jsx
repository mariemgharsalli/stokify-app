import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, CircleOff } from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { getArticleRealImageUrl } from "../../utils/articleImage";
import ArticlePhoto from "./ArticlePhoto";
import { computeStatut, daysUntil, fmtDate } from "../../utils/lotStatut";
import { formatQty } from "../lib/scanFacts";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import ErrorShake from "../motion/ErrorShake";
import SheetSpring from "../motion/SheetSpring";
import { fr } from "../strings/fr";

function listFrom(data) {
  return Array.isArray(data) ? data : data?.items ?? [];
}

function lotTone(statut) {
  if (statut === "ACTIF") return "ok";
  if (statut === "EXPIRE" || statut === "EPUISE") return "danger";
  return "warn";
}

function LotStatus({ statut }) {
  const tone = lotTone(statut);
  const label = fr.lotStatut[statut] || statut;
  const Icon = tone === "ok" ? Check : tone === "danger" ? AlertTriangle : CircleOff;
  return (
    <p className={`terrain-lot-status is-${tone}`}>
      <Icon size={18} aria-hidden />
      <span>{label}</span>
    </p>
  );
}

function Identity({ title, code, imageUrl, kicker }) {
  return (
    <div className="flex items-center gap-3">
      <ArticlePhoto imageUrl={imageUrl} title={title} className="is-lg" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-sub">{kicker}</p>
        <h2 className="truncate text-xl font-semibold">{title}</h2>
        {code ? <p className="truncate text-sm text-text-sub">{code}</p> : null}
      </div>
    </div>
  );
}

function QueryState({ query, children }) {
  if (query.isLoading) {
    return (
      <p className="mt-3 text-base text-text-sub" role="status">
        {fr.scanResolving}
      </p>
    );
  }
  if (query.isError) {
    return (
      <div className="mt-3 flex flex-col gap-3" role="alert">
        <p className="text-base">{getAxiosErrorMessage(query.error)}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent-500 px-4 text-base font-semibold text-white touch-manipulation"
        >
          {fr.retry}
        </button>
      </div>
    );
  }
  return children;
}

function etatTransfert(kind, data, depotId) {
  if (kind === "stock-line") {
    return {
      articleId: data?.articleId || data?.article?.id,
      articleCode: data?.article?.code || "",
      articleLibelle: data?.article?.libelle || "",
      modeTracage: data?.article?.modeTracage || "",
      emplacementId: data?.emplacementId || data?.emplacement?.id || null,
      emplacementCode: data?.emplacement?.code || "",
      depotId: data?.depotId || depotId,
    };
  }
  if (kind === "emplacement") return { emplacementId: data?.id, emplacementCode: data?.code || "", depotId };
  if (kind === "article") {
    return {
      articleId: data?.id,
      articleCode: data?.code || "",
      articleLibelle: data?.libelle || "",
      modeTracage: data?.modeTracage || "",
      depotId,
    };
  }
  if (kind === "lot") return { articleId: data?.article?.id || data?.articleId, depotId };
  return { depotId };
}

function cibleComptage(kind, data) {
  if (kind === "emplacement" && data?.id) return `/terrain/inventaire/emplacement/${data.id}`;
  const place = kind === "stock-line" ? data?.emplacementId || data?.emplacement?.id : null;
  if (place) return `/terrain/inventaire/emplacement/${place}`;
  return "/terrain/inventaire";
}

function Actions({ role, kind, data, depotId }) {
  const navigate = useNavigate();
  const canMove = hasPermission(role, "stock:write");
  const canCount = hasPermission(role, "stock:write");
  if (!canMove && !canCount) return null;
  return (
    <div className="mt-4 flex gap-2">
      {canMove ? (
        <button
          type="button"
          onClick={() => navigate("/terrain/transfert", { state: etatTransfert(kind, data, depotId) })}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-accent-500 px-3 text-base font-semibold text-white touch-manipulation"
        >
          {fr.move}
        </button>
      ) : null}
      {canCount ? (
        <button
          type="button"
          onClick={() => navigate(cibleComptage(kind, data))}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border px-3 text-base font-semibold touch-manipulation"
        >
          {fr.count}
        </button>
      ) : null}
    </div>
  );
}

function ArticleBody({ data, depotId, sessionKey }) {
  const articleId = data?.id;
  const query = useQuery({
    queryKey: ["terrain", sessionKey, "scan", "article-stock", depotId ?? null, articleId ?? null],
    enabled: Boolean(sessionKey && depotId != null && articleId != null),
    queryFn: async () => {
      const { data: payload } = await api.get("stock", {
        params: { depotId, articleId, limit: 50 },
      });
      return listFrom(payload);
    },
  });
  const lines = query.data || [];
  const qty = lines.reduce((sum, row) => sum + (Number(row.quantite) || 0), 0);
  return (
    <>
      <Identity
        title={data?.libelle || data?.code || fr.kindArticle}
        code={data?.code}
        imageUrl={getArticleRealImageUrl(data)}
        kicker={fr.kindArticle}
      />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-sub">{fr.qtyOnHand}</p>
      {depotId == null ? <p className="mt-2 text-base text-text-sub">{fr.chooseDepot}</p> : null}
      {depotId != null ? (
        <QueryState query={query}>
          <p className="terrain-mono text-5xl font-semibold leading-none">{formatQty(qty)}</p>
          <p className="mt-2 text-sm text-text-sub">{data?.unite || fr.unitPiece}</p>
          {lines.length === 0 ? <p className="mt-3 text-base text-text-sub">{fr.noStockHere}</p> : null}
          {lines.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {lines.map((row) => (
                <li key={row.id} className="flex min-h-12 items-center justify-between rounded-xl bg-app-bg px-3">
                  <span>{row.emplacement?.code || row.emplacement?.libelle || fr.noPlace}</span>
                  <span className="terrain-mono font-semibold">{formatQty(row.quantite)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </QueryState>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {fr.strategyLabel[data?.strategieSortie] ? (
          <div>
            <dt className="text-text-sub">{fr.strategy}</dt>
            <dd className="font-semibold">{fr.strategyLabel[data.strategieSortie]}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-text-sub">{fr.traceMode}</dt>
          <dd className="font-semibold">{fr.traceLabel[data?.modeTracage] || data?.modeTracage || "—"}</dd>
        </div>
      </dl>
    </>
  );
}

function StockLineBody({ data }) {
  return (
    <>
      <Identity
        title={data?.article?.libelle || data?.article?.code || fr.kindStock}
        code={data?.article?.code}
        imageUrl={getArticleRealImageUrl(data?.article)}
        kicker={fr.kindStock}
      />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-sub">{fr.qtyOnLine}</p>
      <p className="terrain-mono text-5xl font-semibold leading-none">{formatQty(data?.quantite)}</p>
      <p className="mt-3 text-base">
        {data?.emplacement?.code || data?.emplacement?.libelle || fr.noPlace}
        {data?.statut ? ` · ${data.statut}` : ""}
      </p>
    </>
  );
}

function LotBody({ data }) {
  const statut = computeStatut(data);
  const days = daysUntil(data?.dateExpiration);
  let daysLabel = fr.lotNoDate;
  if (days != null && days < 0) daysLabel = fr.lotExpired;
  else if (days === 0) daysLabel = fr.lotToday;
  else if (days != null) daysLabel = `${days} ${fr.days}`;
  return (
    <>
      <Identity
        title={data?.numero || fr.kindLot}
        code={data?.article?.libelle || data?.articleLibelle}
        imageUrl={getArticleRealImageUrl(data?.article)}
        kicker={fr.kindLot}
      />
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-sub">{fr.lotRemaining}</p>
      <p className="terrain-mono text-5xl font-semibold leading-none">{formatQty(data?.quantiteRestante)}</p>
      <LotStatus statut={statut} />
      {statut === "EPUISE" || statut === "EXPIRE" ? (
        <p className="mt-3 text-base">{statut === "EPUISE" ? fr.lotEmpty : fr.lotExpired}</p>
      ) : null}
      <p className="mt-2 text-sm text-text-sub">
        {fr.lotExpiry} · {fmtDate(data?.dateExpiration)} · {daysLabel}
      </p>
    </>
  );
}

function PlaceBody({ data, depotId, sessionKey }) {
  const query = useQuery({
    queryKey: ["terrain", sessionKey, "scan", "place", depotId ?? null, data?.id ?? null],
    enabled: Boolean(sessionKey && depotId != null && data?.id != null),
    queryFn: async () => {
      const { data: payload } = await api.get("stock", {
        params: { depotId, emplacementId: data.id, limit: 40 },
      });
      return listFrom(payload);
    },
  });
  return (
    <>
      <Identity title={data?.code || data?.libelle || fr.kindEmplacement} code={data?.libelle} kicker={fr.kindEmplacement} />
      {data?.capaciteSlots != null ? (
        <p className="mt-3 text-sm text-text-sub">
          {fr.capacity} · {data.capaciteSlots}
        </p>
      ) : null}
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-text-sub">{fr.linesHere}</p>
      {depotId == null ? <p className="mt-2 text-base text-text-sub">{fr.chooseDepot}</p> : null}
      {depotId != null ? (
        <QueryState query={query}>
          {(query.data || []).length === 0 ? <p className="mt-2 text-base text-text-sub">{fr.placeEmpty}</p> : null}
          <ul className="mt-2 flex flex-col gap-2">
            {(query.data || []).map((line) => (
              <li key={line.id} className="flex min-h-12 items-center justify-between rounded-xl bg-app-bg px-3">
                <span className="truncate">{line.article?.libelle || line.article?.code || `#${line.id}`}</span>
                <span className="terrain-mono font-semibold">{formatQty(line.quantite)}</span>
              </li>
            ))}
          </ul>
        </QueryState>
      ) : null}
    </>
  );
}

export default function TerrainScanResult({ open, kind, data, depotId, onClose, raw }) {
  const sessionKey = useTerrainSessionKey();
  const role = useAuthStore((s) => s.user?.role);
  if (!open) return null;

  const title =
    kind === "unknown"
      ? fr.scanUnknown
      : kind === "lot"
        ? data?.numero || fr.kindLot
        : kind === "emplacement"
          ? data?.code || fr.kindEmplacement
          : data?.article?.libelle || data?.libelle || fr.kindArticle;

  return (
    <SheetSpring title={title} onClose={onClose}>
      <ErrorShake active={kind === "unknown"}>
      {kind === "article" ? <ArticleBody data={data} depotId={depotId} sessionKey={sessionKey} /> : null}
      {kind === "stock-line" ? <StockLineBody data={data} /> : null}
      {kind === "lot" ? <LotBody data={data} /> : null}
      {kind === "emplacement" ? <PlaceBody data={data} depotId={depotId} sessionKey={sessionKey} /> : null}
      {kind === "unknown" ? (
        <>
          <h2 className="text-xl font-semibold">{fr.scanUnknown}</h2>
          <p className="mt-2 text-base text-text-sub">{fr.scanUnknownHint}</p>
          {raw ? <p className="mt-3 break-all text-lg font-semibold">{raw}</p> : null}
        </>
      ) : null}
      {kind !== "unknown" ? <Actions role={role} kind={kind} data={data} depotId={depotId} /> : null}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-500 px-4 text-base font-semibold text-white touch-manipulation"
      >
        {fr.rescan}
      </button>
      </ErrorShake>
    </SheetSpring>
  );
}
