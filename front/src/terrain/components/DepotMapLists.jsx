import { fr } from "../strings/fr";

function tonDepot(depot) {
  if (depot?.health === "red" || Number(depot?.ruptures) > 0) return "danger";
  if (depot?.health === "amber" || Number(depot?.critiques) > 0) return "warn";
  return "ok";
}

function Ligne({ depot, pressed, onClick, detail, tone }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={pressed}
        onClick={onClick}
        className="terrain-row flex min-h-14 w-full items-center gap-3 px-4 text-start touch-manipulation"
      >
        <span className="terrain-dot" data-tone={tone} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{depot.libelle || depot.code}</span>
          <span className="block truncate text-sm text-text-sub">{detail}</span>
        </span>
      </button>
    </li>
  );
}

export default function DepotMapLists({ places, missing, selectedId, depotId, onChoose }) {
  return (
    <>
      {places.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="terrain-kicker">{fr.mapLocated}</h2>
          <ul className="flex flex-col gap-2">
            {places.map((depot) => (
              <Ligne
                key={depot.id}
                depot={depot}
                pressed={depot.id === selectedId}
                tone={tonDepot(depot)}
                onClick={() => onChoose(depot)}
                detail={`${depot.ville || depot.code}${Number(depot.id) === Number(depotId) ? ` · ${fr.mapCurrent}` : ""}`}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {missing.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="terrain-kicker">{fr.mapNoPin}</h2>
          <ul className="flex flex-col gap-2">
            {missing.map((depot) => (
              <Ligne
                key={depot.id}
                depot={depot}
                pressed={depot.id === selectedId}
                tone="muted"
                onClick={() => onChoose(depot)}
                detail={fr.mapNoPin}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
