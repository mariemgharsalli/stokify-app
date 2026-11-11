import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useTerrainStore } from "../store/terrainStore";
import { fr } from "../strings/fr";

const EMPTY_DEPOTS = [];

function isDepotActif(depot) {
  if (!depot || typeof depot !== "object") return false;
  if (typeof depot.actif === "boolean") return depot.actif;
  if (depot.statut == null || depot.statut === "") return true;
  return String(depot.statut).toUpperCase() === "ACTIF";
}

export default function TerrainDepot() {
  const navigate = useNavigate();
  const setDepot = useTerrainStore((s) => s.setDepot);
  const depotId = useTerrainStore((s) => s.depotId);
  const [picking, setPicking] = useState(false);
  const autoRef = useRef(false);

  const query = useQuery({
    queryKey: ["terrain", "ref", "depots"],
    queryFn: async () => {
      const { data } = await api.get("depots", { params: { statut: "ACTIF", limit: 100 } });
      const raw = Array.isArray(data) ? data : data?.items ?? [];
      const items = raw.filter(isDepotActif);
      const total = Number(data?.total);
      return {
        items,
        truncated: Number.isFinite(total) && total > raw.length,
      };
    },
  });

  const items = query.data?.items ?? EMPTY_DEPOTS;

  useEffect(() => {
    if (autoRef.current || picking || items.length !== 1) return;
    autoRef.current = true;
    setPicking(true);
    setDepot(items[0]);
    navigate("/terrain", { replace: true });
  }, [items, picking, setDepot, navigate]);

  function choose(depot) {
    if (picking) return;
    setPicking(true);
    setDepot(depot);
    navigate("/terrain", { replace: true });
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{fr.depotTitle}</h1>
        <p className="text-base" style={{ color: "var(--text-secondary)" }}>
          {fr.depotHint}
        </p>
      </header>

      {query.isPending ? (
        <p className="text-base" role="status" style={{ color: "var(--text-secondary)" }}>
          {fr.depotLoading}
        </p>
      ) : null}

      {query.isError ? (
        <div className="flex flex-col gap-3 rounded-2xl border p-4" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)" }} role="alert">
          <p className="text-base">{getAxiosErrorMessage(query.error, fr.depotError)}</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-base font-semibold text-white touch-manipulation"
            style={{ background: "var(--accent-primary)" }}
          >
            {fr.retry}
          </button>
        </div>
      ) : null}

      {query.isSuccess && items.length === 0 ? (
        <p className="rounded-2xl border p-4 text-base" style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
          {fr.depotEmpty}
        </p>
      ) : null}

      {query.isSuccess && items.length >= 1 ? (
        <ul className="flex flex-col gap-3">
          {items.map((depot) => {
            const selected = depotId != null && String(depot.id) === String(depotId);
            const title = depot.libelle || depot.code || depot.nom || "";
            return (
              <li key={depot.id}>
                <button
                  type="button"
                  disabled={picking}
                  aria-pressed={selected}
                  onClick={() => choose(depot)}
                  className="flex min-h-[4.5rem] w-full flex-col items-start justify-center rounded-2xl border px-4 py-3 text-start touch-manipulation disabled:opacity-60"
                  style={{
                    background: "var(--bg-card)",
                    borderColor: selected ? "var(--accent-primary)" : "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span className="text-lg font-semibold">{title}</span>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {depot.code}
                    {depot.ville ? ` · ${depot.ville}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {query.data?.truncated ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {fr.depotTruncated}
        </p>
      ) : null}
    </div>
  );
}
