import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import { usePickStore } from "../store/pickStore";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import { empreinteVente, filtrerVentes, trierVentes, venteFragile } from "../lib/picking";
import { fillTemplate } from "../lib/dayProgress";
import CompletionBar from "../motion/CompletionBar";
import Skeleton from "../motion/Skeleton";
import StaggerList from "../motion/StaggerList";
import { fr } from "../strings/fr";

function texte(modele, valeurs) {
  return Object.entries(valeurs).reduce((label, [cle, valeur]) => label.replace(`{${cle}}`, String(valeur)), modele);
}

function formatJour(date) {
  if (!date) return fr.lotNoDate;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return fr.lotNoDate;
  return value.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PickingList() {
  const reduceMotion = useReducedMotion();
  const sessionKey = useTerrainSessionKey();
  const depotId = useTerrainStore((s) => s.depotId);
  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasPermission(role, "ventes:read");
  const bind = usePickStore((s) => s.bind);
  const locales = usePickStore((s) => s.ventes);
  const [recherche, setRecherche] = useState("");
  const [scope, setScope] = useState("depot");

  useEffect(() => {
    if (sessionKey) bind(sessionKey);
  }, [sessionKey, bind]);

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "preparation", "liste"],
    enabled: Boolean(sessionKey) && canRead,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get("stock/ventes-a-livrer");
      return trierVentes(data?.items || []);
    },
  });

  const tous = query.data || [];
  const items = filtrerVentes(tous, { depotId, scope, recherche });
  const totalDepot = filtrerVentes(tous, { depotId, scope: "depot" }).length;
  const totalTous = filtrerVentes(tous, { scope: "tous" }).length;

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 py-4 text-text-main"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      <h1 className="text-2xl font-semibold">{fr.pickTitle}</h1>
      <p className="text-sm text-text-sub">{fr.prepareScope}</p>
      <input
        type="search"
        aria-label={fr.pickSearch}
        placeholder={fr.pickSearch}
        value={recherche}
        onChange={(event) => setRecherche(event.target.value)}
        className="min-h-12 rounded-2xl border border-border bg-card-bg px-3 text-base text-text-main"
      />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={scope === "depot"} onClick={() => setScope("depot")} className="min-h-12 rounded-2xl border border-border bg-card-bg text-sm font-semibold touch-manipulation">
          {fr.scopeDepot} ({totalDepot})
        </button>
        <button type="button" aria-pressed={scope === "tous"} onClick={() => setScope("tous")} className="min-h-12 rounded-2xl border border-border bg-card-bg text-sm font-semibold touch-manipulation">
          {fr.scopeAll} ({totalTous})
        </button>
      </div>

      {!canRead ? <p>{fr.pickForbidden}</p> : null}
      {query.isLoading ? (
        <div role="status" aria-label={fr.listLoading} className="flex flex-col gap-3">
          <Skeleton className="terrain-skeleton-card" />
          <Skeleton className="terrain-skeleton-card" />
        </div>
      ) : null}
      {query.isError ? (
        <div className="flex flex-col gap-2">
          <p style={{ color: "var(--accent-danger)" }}>{getAxiosErrorMessage(query.error, fr.depotError)}</p>
          <button type="button" onClick={() => query.refetch()} className="inline-flex min-h-12 items-center font-semibold touch-manipulation">{fr.retry}</button>
        </div>
      ) : null}
      {query.isSuccess && items.length === 0 ? <p>{fr.pickEmpty}</p> : null}

      <StaggerList
        label={fr.pickTitle}
        items={items}
        renderItem={(vente) => {
          const local = locales[String(vente.id)];
          const prete = Boolean(local?.complete && local.fingerprint === empreinteVente(vente));
          const lignes = vente.lignes?.length || 0;
          return (
            <Link to={`/terrain/preparation/${vente.id}`} className="flex min-h-12 flex-col gap-2 rounded-2xl border border-border bg-card-bg p-3 touch-manipulation">
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{vente.reference}</span>
                {prete ? <span className="shrink-0 text-xs font-semibold" style={{ color: "var(--accent-success)" }}>{fr.pickPrepared}</span> : null}
              </span>
              <span className="text-sm text-text-sub">{vente.client?.nom}{vente.client?.ville ? ` · ${vente.client.ville}` : ""}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {vente.depotId == null || vente.depotId === "" ? (
                  <span className="rounded-full px-2 py-1 text-xs font-semibold">{fr.defaultDepot}</span>
                ) : null}
                <span>{texte(fr.pickLines, { n: lignes })} · {formatJour(vente.dateVente)}</span>
              </span>
              {venteFragile(vente) ? <span className="text-xs font-semibold" style={{ color: "var(--accent-warning)" }}>{fr.pickFragile}</span> : null}
              <CompletionBar ratio={prete ? 1 : 0} label={fillTemplate(fr.meterOf, { done: prete ? lignes : 0, total: lignes })} />
            </Link>
          );
        }}
      />
    </motion.div>
  );
}
