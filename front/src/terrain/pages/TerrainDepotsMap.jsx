import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import { createDepotDivIcon, getMapTiles, hasCoords, loadLeaflet, TUNISIA_CENTER } from "../../pages/depots/components/depotLeaflet";
import DepotMapLists from "../components/DepotMapLists";
import { fillTemplate } from "../lib/dayProgress";
import { useTerrainStore } from "../store/terrainStore";
import { fr } from "../strings/fr";

const TONES = { ok: "--accent-success", warn: "--accent-warning", danger: "--accent-danger" };

function couleur(name) {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

function tonDepot(depot) {
  if (depot?.health === "red" || Number(depot?.ruptures) > 0) return "danger";
  if (depot?.health === "amber" || Number(depot?.critiques) > 0) return "warn";
  return "ok";
}

function argent(valeur) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(valeur) || 0);
}

export default function TerrainDepotsMap() {
  const navigate = useNavigate();
  const sessionKey = useTerrainStore((state) => state.sessionKey);
  const depotId = useTerrainStore((state) => state.depotId);
  const setDepot = useTerrainStore((state) => state.setDepot);
  const host = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const colorsRef = useRef({});
  const leafletRef = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [mapBroken, setMapBroken] = useState(false);
  const selectedRef = useRef(null);
  selectedRef.current = selectedId;

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "carte-depots"],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await api.get("depots/with-stock-summary");
      return Array.isArray(data) ? data : data?.items ?? [];
    },
  });

  const depots = query.data ?? [];
  const places = useMemo(() => depots.filter(hasCoords), [depots]);
  const sansPosition = depots.filter((depot) => !hasCoords(depot));
  const selected = depots.find((depot) => depot.id === selectedId) || null;
  const signature = places.map((depot) => `${depot.id}:${depot.latitude}:${depot.longitude}:${depot.health}`).join("|");

  useEffect(() => {
    const node = host.current;
    if (!node || !query.isSuccess) return undefined;
    let cancelled = false;
    const holder = { map: null, timer: 0, fit: null };

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !host.current || host.current._leaflet_id) return;
        const tiles = getMapTiles("light");
        const colors = {
          ok: couleur(TONES.ok),
          warn: couleur(TONES.warn),
          danger: couleur(TONES.danger),
          ink: couleur("--terrain-hero-ink"),
        };
        colorsRef.current = colors;
        const map = L.map(host.current, { center: TUNISIA_CENTER, zoom: 6, zoomControl: false, scrollWheelZoom: true });
        holder.map = map;
        leafletRef.current = L;
        mapRef.current = map;
        L.control.zoom({ position: "topright" }).addTo(map);
        L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: 19 }).addTo(map);
        const markers = new Map();
        const bounds = [];
        places.forEach((depot) => {
          const marker = L.marker([Number(depot.latitude), Number(depot.longitude)], {
            icon: createDepotDivIcon(L, colors[tonDepot(depot)], ""),
          }).addTo(map);
          marker.on("click", () => setSelectedId(depot.id));
          markers.set(depot.id, marker);
          bounds.push([Number(depot.latitude), Number(depot.longitude)]);
        });
        markersRef.current = markers;
        if (bounds.length === 1) map.setView(bounds[0], 13);
        else if (bounds.length > 1) map.fitBounds(bounds, { padding: [36, 36] });
        const fit = () => map.invalidateSize();
        holder.fit = fit;
        requestAnimationFrame(fit);
        holder.timer = window.setTimeout(fit, 400);
        window.addEventListener("resize", fit);
        setMapBroken(false);
      } catch {
        if (!cancelled) setMapBroken(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(holder.timer);
      if (holder.fit) window.removeEventListener("resize", holder.fit);
      holder.map?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = new Map();
    };
  }, [query.isSuccess, signature, places, depotId]);

  useEffect(() => {
    const L = leafletRef.current;
    const colors = colorsRef.current;
    if (!L) return;
    markersRef.current.forEach((marker, id) => {
      const depot = depots.find((item) => item.id === id);
      const actif = id === selectedId || Number(id) === Number(depotId);
      marker.setIcon(createDepotDivIcon(L, colors[tonDepot(depot)] || colors.ok, actif ? "●" : ""));
      marker.setZIndexOffset(actif ? 500 : 0);
    });
  }, [selectedId, depotId, depots]);

  function choisir(depot) {
    setDepot(depot);
    navigate("/terrain");
  }

  function centrer(depot) {
    setSelectedId(depot.id);
    if (!hasCoords(depot) || !mapRef.current) return;
    mapRef.current.setView([Number(depot.latitude), Number(depot.longitude)], 14);
  }

  function toutVoir() {
    const map = mapRef.current;
    if (!map || !places.length) return;
    const bounds = places.map((depot) => [Number(depot.latitude), Number(depot.longitude)]);
    if (bounds.length === 1) map.setView(bounds[0], 12);
    else map.fitBounds(bounds, { padding: [36, 36] });
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="terrain-kicker">{fr.depotMap}</p>
          <h1 className="text-2xl font-semibold">{fr.mapTitle}</h1>
        </div>
        <Link to="/terrain" className="terrain-chip inline-flex min-h-12 items-center px-4 text-sm font-semibold touch-manipulation">
          {fr.back}
        </Link>
      </header>

      <div className="flex flex-wrap gap-3">
        {[
          ["ok", fr.mapHealthy],
          ["warn", fr.mapWatch],
          ["danger", fr.mapAlert],
        ].map(([tone, label]) => (
          <span key={tone} className="terrain-legend inline-flex items-center gap-2">
            <span className="terrain-dot" data-tone={tone} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      {query.isPending ? <p role="status">{fr.mapLoading}</p> : null}
      {query.isError ? (
        <div className="terrain-panel flex flex-col gap-3 p-4" role="alert">
          <p>{getAxiosErrorMessage(query.error, fr.mapError)}</p>
          <button type="button" onClick={() => query.refetch()} className="terrain-primary inline-flex min-h-12 items-center justify-center rounded-2xl font-semibold touch-manipulation">
            {fr.retry}
          </button>
        </div>
      ) : null}
      {query.isSuccess && depots.length === 0 ? <p>{fr.mapEmpty}</p> : null}
      {mapBroken ? <p role="alert">{fr.mapError}</p> : null}

      {query.isSuccess && depots.length > 0 ? (
        <div className="terrain-map-stage">
          <div ref={host} className="terrain-map" role="region" aria-label={fr.mapTitle} />
          {places.length > 0 ? (
            <button type="button" onClick={toutVoir} className="terrain-map-fit terrain-chip inline-flex min-h-12 items-center px-4 text-sm font-semibold touch-manipulation">
              {fr.mapFit}
            </button>
          ) : (
            <p className="mt-2 text-sm text-text-sub">{fr.mapNoGps}</p>
          )}
        </div>
      ) : null}

      {selected ? (
        <article className="terrain-panel flex flex-col gap-2 p-4" data-tone={tonDepot(selected)}>
          <p className="terrain-legend inline-flex items-center gap-2">
            <span className="terrain-dot" data-tone={tonDepot(selected)} aria-hidden="true" />
            {tonDepot(selected) === "danger" ? fr.mapAlert : tonDepot(selected) === "warn" ? fr.mapWatch : fr.mapHealthy}
            {Number(selected.id) === Number(depotId) ? ` · ${fr.mapCurrent}` : ""}
          </p>
          <h2 className="text-xl font-semibold">{selected.libelle || selected.code}</h2>
          <p className="text-text-sub">{[selected.code, selected.ville, selected.region].filter(Boolean).join(" · ")}</p>
          <p>{fillTemplate(fr.mapArticles, { n: selected.totalArticles ?? 0 })}</p>
          <p>{fillTemplate(fr.mapRuptures, { n: selected.ruptures ?? 0 })} · {fillTemplate(fr.mapCritiques, { n: selected.critiques ?? 0 })}</p>
          <p className="terrain-mono">{fillTemplate(fr.mapValue, { n: argent(selected.valeurStock) })}</p>
          <button type="button" onClick={() => choisir(selected)} className="terrain-primary mt-1 inline-flex min-h-14 items-center justify-center rounded-2xl font-semibold touch-manipulation">
            {fr.mapWork}
          </button>
        </article>
      ) : null}

      <DepotMapLists
        places={places}
        missing={sansPosition}
        selectedId={selectedId}
        depotId={depotId}
        onChoose={centrer}
      />
    </div>
  );
}
