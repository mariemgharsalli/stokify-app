import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import { fillTemplate } from "../lib/dayProgress";
import { useTerrainStore } from "../store/terrainStore";
import CompletionBar from "../motion/CompletionBar";
import { fr } from "../strings/fr";

const Warehouse3DScene = lazy(() => import("../../components/ui/Warehouse3DScene"));

const FILTRES = [
  { id: "all", label: "planAll" },
  { id: "busy", label: "planBusy" },
  { id: "watch", label: "planWatch" },
  { id: "free", label: "planFree" },
];

function versScene(emplacement) {
  return {
    id: emplacement.id,
    code: emplacement.code,
    libelle: emplacement.libelle || "",
    col: emplacement.layoutCol,
    row: emplacement.layoutRow,
    occupationRatio: Number(emplacement.remplissagePct) || 0,
    stockQty: Number(emplacement.stockActuel) || 0,
    zoneDangereuse: Boolean(emplacement.zoneDangereuse),
  };
}

function tonOccupation(ratio) {
  if (ratio > 80) return "danger";
  if (ratio >= 50) return "warn";
  if (ratio > 0) return "ok";
  return "muted";
}

function garde(emplacement, filtre, recherche) {
  const texte = `${emplacement.code || ""} ${emplacement.libelle || ""}`.toLowerCase();
  if (recherche && !texte.includes(recherche)) return false;
  const taux = Number(emplacement.occupationRatio) || 0;
  const occupe = taux > 0 || emplacement.stockQty > 0;
  if (filtre === "busy") return occupe;
  if (filtre === "watch") return taux >= 50;
  if (filtre === "free") return !occupe;
  return true;
}

export default function TerrainPlan() {
  const depotId = useTerrainStore((state) => state.depotId);
  const depotLabel = useTerrainStore((state) => state.depotLabel);
  const sessionKey = useTerrainStore((state) => state.sessionKey);
  const [selectedId, setSelectedId] = useState(null);
  const [filtre, setFiltre] = useState("all");
  const [recherche, setRecherche] = useState("");

  const plan = useQuery({
    queryKey: ["terrain", sessionKey, "plan", depotId],
    enabled: depotId != null,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => (await api.get(`depots/${depotId}/layout`)).data,
  });

  const emplacements = useMemo(
    () => (plan.data?.emplacements || []).map(versScene),
    [plan.data]
  );
  const cherche = recherche.trim().toLowerCase();
  const visibles = emplacements.filter((emplacement) => garde(emplacement, filtre, cherche));
  const selection = emplacements.find((emplacement) => emplacement.id === selectedId) || null;
  const layout = plan.data?.layout;
  const summary = plan.data?.summary;
  const occupes = emplacements.filter((emplacement) => emplacement.stockQty > 0 || emplacement.occupationRatio > 0).length;
  const remplissage = summary?.remplissagePct ?? (
    emplacements.length
      ? Math.round(emplacements.reduce((total, emplacement) => total + emplacement.occupationRatio, 0) / emplacements.length)
      : 0
  );
  const stock = summary?.stockTotal ?? emplacements.reduce((total, emplacement) => total + emplacement.stockQty, 0);
  const ton = selection ? tonOccupation(selection.occupationRatio) : "muted";

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="terrain-kicker">{fr.plan3d}</p>
          <h1 className="truncate text-2xl font-semibold">{depotLabel || fr.planTitle}</h1>
        </div>
        <Link to="/terrain" className="terrain-chip inline-flex min-h-12 items-center px-4 text-sm font-semibold touch-manipulation">
          {fr.back}
        </Link>
      </header>

      {plan.isPending ? <p role="status">{fr.planLoading}</p> : null}
      {plan.isError ? (
        <div className="terrain-panel flex flex-col gap-3 p-4" role="alert">
          <p>{getAxiosErrorMessage(plan.error, fr.planError)}</p>
          <button type="button" onClick={() => plan.refetch()} className="terrain-primary inline-flex min-h-12 items-center justify-center rounded-2xl font-semibold touch-manipulation">
            {fr.retry}
          </button>
        </div>
      ) : null}
      {plan.isSuccess && emplacements.length === 0 ? <p>{fr.planEmpty}</p> : null}

      {emplacements.length > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <p className="terrain-stat"><strong>{Math.round(Number(remplissage) || 0)}%</strong><span>{fr.planFill}</span></p>
            <p className="terrain-stat"><strong>{occupes}/{emplacements.length}</strong><span>{fr.planSlots}</span></p>
            <p className="terrain-stat"><strong>{Number(stock || 0).toLocaleString("fr-FR")}</strong><span>{fr.planStock}</span></p>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              ["ok", fr.planLegendOk],
              ["warn", fr.planLegendWarn],
              ["danger", fr.planLegendDanger],
              ["muted", fr.planFree],
            ].map(([tone, label]) => (
              <span key={tone} className="terrain-legend inline-flex items-center gap-2">
                <span className="terrain-dot" data-tone={tone} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <input
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder={fr.planSearch}
            aria-label={fr.planSearch}
            className="min-h-12 rounded-2xl border border-border bg-card-bg px-4"
          />
          <div className="terrain-filters" role="group" aria-label={fr.planAll}>
            {FILTRES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filtre === item.id}
                onClick={() => setFiltre(item.id)}
                className="terrain-chip inline-flex min-h-12 shrink-0 items-center px-4 text-sm font-semibold touch-manipulation"
              >
                {fr[item.label]}
              </button>
            ))}
          </div>

          {visibles.length === 0 ? <p>{fr.planNoMatch}</p> : (
            <div className="terrain-plan">
              <Suspense fallback={<p role="status" className="p-4">{fr.planLoading}</p>}>
                <Warehouse3DScene
                  key={`${filtre}:${cherche}`}
                  emplacements={visibles}
                  selectedId={selection?.id ?? null}
                  onSelect={(emplacement) => setSelectedId(emplacement?.id ?? null)}
                  sceneHeight={520}
                  layoutHints={layout ? { cols: layout.cols, rows: layout.rows, dock: layout.dock, aisles: layout.aisles } : null}
                />
              </Suspense>
            </div>
          )}
        </>
      ) : null}

      {selection ? (
        <article className="terrain-panel terrain-place p-4" data-tone={ton}>
          <p className="terrain-legend inline-flex items-center gap-2">
            <span className="terrain-dot" data-tone={ton} aria-hidden="true" />
            {ton === "danger" ? fr.planLegendDanger : ton === "warn" ? fr.planLegendWarn : ton === "ok" ? fr.planLegendOk : fr.planFree}
          </p>
          <p className="terrain-mono mt-1 text-xl font-semibold">{selection.code}</p>
          {selection.libelle ? <p>{selection.libelle}</p> : null}
          <CompletionBar
            ratio={(Number(selection.occupationRatio) || 0) / 100}
            label={fillTemplate(fr.meterOf, { done: Math.round(selection.occupationRatio), total: 100 })}
          />
          <p className="mt-2">{fillTemplate(fr.planUnits, { n: Number(selection.stockQty || 0).toLocaleString("fr-FR") })}</p>
          {selection.zoneDangereuse ? <p className="font-semibold">{fr.planDanger}</p> : null}
        </article>
      ) : null}
    </div>
  );
}
