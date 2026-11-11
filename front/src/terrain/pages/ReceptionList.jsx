import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import { chargerAchatsAReceptionner, filtrerAchats, joursDeRetard, progression } from "../lib/reception";
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

export default function ReceptionList() {
  const reduceMotion = useReducedMotion();
  const sessionKey = useTerrainSessionKey();
  const depotId = useTerrainStore((s) => s.depotId);
  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasPermission(role, "achats:read");
  const [recherche, setRecherche] = useState("");
  const [scope, setScope] = useState("depot");

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "reception", "liste"],
    enabled: Boolean(sessionKey) && canRead,
    staleTime: 60_000,
    queryFn: () => chargerAchatsAReceptionner(api),
  });

  const tous = query.data || [];
  const items = filtrerAchats(tous, { depotId, scope, recherche });
  const totalDepot = filtrerAchats(tous, { depotId, scope: "depot" }).length;
  const totalTous = filtrerAchats(tous, { scope: "tous" }).length;

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 py-4 text-text-main"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      <h1 className="text-2xl font-semibold">{fr.receptionTitle}</h1>
      <p className="text-sm text-text-sub">{fr.allDepots}</p>
      <input
        type="search"
        aria-label={fr.receptionSearch}
        placeholder={fr.receptionSearch}
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

      {!canRead ? <p>{fr.purchaseForbidden}</p> : null}
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
      {query.isSuccess && items.length === 0 ? <p>{fr.receptionEmpty}</p> : null}

      <StaggerList
        label={fr.receptionTitle}
        items={items}
        renderItem={(achat) => {
          const retard = joursDeRetard(achat.dateLivraisonPrevue);
          const barre = progression(achat);
          return (
            <Link to={`/terrain/reception/${achat.id}`} className="flex min-h-12 flex-col gap-2 rounded-2xl border border-border bg-card-bg p-3 touch-manipulation">
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold">{achat.reference}</span>
                {retard > 0 ? (
                  <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold" style={{ color: "var(--accent-danger)" }}>
                    {texte(fr.lateBadge, { n: retard })}
                  </span>
                ) : null}
              </span>
              <span className="text-sm text-text-sub">{achat.fournisseur?.nom || achat.fournisseur?.code}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {achat.depotId == null || achat.depotId === "" ? (
                  <span className="rounded-full px-2 py-1 text-xs font-semibold">{fr.defaultDepot}</span>
                ) : (
                  <span>{achat.depot?.libelle || achat.depot?.code}</span>
                )}
                <span>{formatJour(achat.dateLivraisonPrevue)}</span>
              </span>
              <span className="terrain-mono text-sm text-text-sub">{barre.recue} / {barre.commandee}</span>
              <CompletionBar ratio={barre.ratio} label={fillTemplate(fr.meterOf, { done: barre.recue, total: barre.commandee })} />
            </Link>
          );
        }}
      />
    </motion.div>
  );
}
