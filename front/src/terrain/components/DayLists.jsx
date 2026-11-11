import { useNavigate } from "react-router-dom";
import { daysUntil } from "../../utils/lotStatut";
import ArticlePhoto from "./ArticlePhoto";
import Skeleton from "../motion/Skeleton";
import StaggerList from "../motion/StaggerList";
import { fr } from "../strings/fr";

function bandStyle(days, empty) {
  if (empty || days == null || days < 0 || days <= 7) return "var(--accent-danger)";
  if (days <= 30) return "var(--accent-warning)";
  return "var(--text-secondary)";
}

function lotWhen(lot) {
  const days = lot.joursRestants != null ? Number(lot.joursRestants) : daysUntil(lot.dateExpiration);
  const empty = Number(lot.quantiteRestante) <= 0;
  const when = empty ? fr.lotEmpty : days == null ? fr.lotNoDate : days < 0 ? fr.lotExpired : `${days} ${fr.days}`;
  return { when, tone: bandStyle(days, empty) };
}

export default function DayLists({ lots, alerts, onAlert }) {
  const navigate = useNavigate();
  const lotItems = (lots.data?.items || []).slice(0, 3).map((lot) => ({ ...lot, id: String(lot.lotId) }));
  const alertItems = (alerts.data?.items || []).slice(0, 3).map((row) => ({
    ...row,
    id: `${row.articleId}-${row.depotId}`,
  }));

  return (
    <>
      <section id="terrain-lots" aria-label={fr.priorityOut} className="flex scroll-mt-24 flex-col gap-3">
        <h2 className="terrain-kicker">{fr.priorityOut}</h2>
        {lots.data?.truncated ? <p className="text-sm text-text-sub">{fr.lotsPartial}</p> : null}
        {lots.isLoading ? <Skeleton className="h-14 w-full" /> : null}
        {lots.isError ? (
          <button type="button" onClick={() => lots.refetch()} className="min-h-12 text-start font-semibold touch-manipulation" style={{ color: "var(--accent-danger)" }}>
            {fr.retry}
          </button>
        ) : null}
        {lots.isSuccess && lotItems.length === 0 ? <p className="text-base text-text-sub">{fr.nothingToReport}</p> : null}
        {lotItems.length > 0 ? (
          <StaggerList
            label={fr.priorityOut}
            items={lotItems}
            renderItem={(lot) => {
              const { when, tone } = lotWhen(lot);
              return (
                <button
                  type="button"
                  onClick={() => navigate(`/terrain/scan/lot/${lot.lotId}`)}
                  className="terrain-row flex min-h-12 w-full items-center justify-between gap-3 px-3 text-start touch-manipulation"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{lot.articleLibelle || lot.numero}</span>
                    <span className="block truncate text-sm text-text-sub">{lot.numero}</span>
                  </span>
                  <span className="shrink-0 rounded-full px-2 py-1 text-sm font-semibold" style={{ color: tone }}>{when}</span>
                </button>
              );
            }}
          />
        ) : null}
      </section>

      <section id="terrain-alerts" aria-label={fr.alertsTitle} className="flex scroll-mt-24 flex-col gap-3">
        <h2 className="terrain-kicker">
          {fr.alertsTitle}
          {alerts.data?.scoped === false ? <span className="ms-2 normal-case">{fr.allDepots}</span> : null}
        </h2>
        {alerts.isLoading ? <Skeleton className="h-14 w-full" /> : null}
        {alerts.isError ? (
          <button type="button" onClick={() => alerts.refetch()} className="min-h-12 text-start font-semibold touch-manipulation" style={{ color: "var(--accent-danger)" }}>
            {fr.retry}
          </button>
        ) : null}
        {alerts.isSuccess && alertItems.length === 0 ? <p className="text-base text-text-sub">{fr.nothingToReport}</p> : null}
        {alertItems.length > 0 ? (
          <StaggerList
            label={fr.alertsTitle}
            items={alertItems}
            renderItem={(row) => (
              <button
                type="button"
                onClick={() => onAlert({
                  id: row.articleId,
                  code: row.code,
                  libelle: row.libelle,
                  imageUrl: row.imageUrl,
                  unite: row.unite,
                })}
                className="terrain-row flex min-h-14 w-full items-center justify-between gap-3 px-3 text-start touch-manipulation"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <ArticlePhoto article={{ imageUrl: row.imageUrl }} title={row.libelle || row.code} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{row.libelle || row.code}</span>
                    <span className="block truncate text-sm text-text-sub">
                      {fr.threshold} {row.seuil}
                      {row.depot?.libelle ? ` · ${row.depot.libelle}` : ""}
                    </span>
                  </span>
                </span>
                <span className="terrain-mono font-semibold">{row.quantite}</span>
              </button>
            )}
          />
        ) : null}
      </section>
    </>
  );
}
