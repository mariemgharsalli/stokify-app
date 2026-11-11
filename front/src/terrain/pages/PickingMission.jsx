import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { usePickStore } from "../store/pickStore";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import { feedback } from "../lib/feedback";
import SuccessMark from "../motion/SuccessMark";
import {
  appliquerQuantiteLot,
  classerScan,
  construireMission,
  empreinteVente,
  etatEntree,
  incrementer,
  ligneTerminee,
  missionTerminee,
  quantiteFaite,
} from "../lib/picking";
import PickLineCard from "../components/PickLineCard";
import PickQuantitySheet from "../components/PickQuantitySheet";
import PickScanSheet from "../components/PickScanSheet";
import { fr } from "../strings/fr";

function texte(modele, valeurs) {
  return Object.entries(valeurs).reduce((label, [cle, valeur]) => label.replace(`{${cle}}`, String(valeur)), modele);
}

function duree(debut, fin) {
  const start = Number(debut);
  const end = Number(fin || Date.now());
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "0:00";
  const ms = Math.max(0, end - start);
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  return `${minutes}:${String(secondes).padStart(2, "0")}`;
}

export default function PickingMission() {
  const { venteId } = useParams();
  const reduceMotion = useReducedMotion();
  const sessionKey = useTerrainSessionKey();
  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasPermission(role, "ventes:read");
  const bind = usePickStore((s) => s.bind);
  const enregistrer = usePickStore((s) => s.enregistrer);
  const invalider = usePickStore((s) => s.invalider);
  const local = usePickStore((s) => s.ventes[String(venteId)]);
  const [activeId, setActiveId] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState("");
  const [proposition, setProposition] = useState(null);
  const [alerte, setAlerte] = useState("");
  const [feuille, setFeuille] = useState(null);
  const celebrated = useRef(false);

  useEffect(() => {
    if (sessionKey) bind(sessionKey);
  }, [sessionKey, bind]);

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "preparation", "vente", String(venteId)],
    enabled: Boolean(sessionKey) && canRead && Boolean(venteId),
    queryFn: async () => (await api.get(`ventes/${venteId}`)).data,
  });

  const mission = useMemo(() => (query.data ? construireMission(query.data) : null), [query.data]);
  const empreinte = query.data ? empreinteVente(query.data) : "";
  const disponible = Boolean(mission) && mission.statut === "CONFIRME" && !mission.livree;
  const complet = Boolean(mission) && disponible && missionTerminee(mission, local?.lignes, local?.bloquees);

  useEffect(() => {
    if (!mission || !empreinte) return;
    if (!disponible) {
      if (local) invalider(venteId);
      setAlerte(fr.pickDelivered);
      return;
    }
    if (local?.fingerprint && local.fingerprint !== empreinte) {
      invalider(venteId);
      setAlerte(fr.pickStale);
    }
  }, [mission, empreinte, disponible, local, invalider, venteId]);

  useEffect(() => {
    if (!complet || celebrated.current) return;
    celebrated.current = true;
    feedback.success();
  }, [complet]);

  useEffect(() => {
    if (!mission || activeId != null) return;
    const ouverte = mission.lignes.find((ligne) => !ligneTerminee(ligne, local?.lignes, local?.bloquees));
    setActiveId((ouverte || mission.lignes[0])?.id ?? null);
  }, [mission, activeId, local]);

  function traiter(code) {
    if (!mission || !disponible) return;
    const verdict = classerScan(mission, activeId, code, local?.lignes);
    enregistrer(venteId, { fingerprint: empreinte, scan: verdict.type !== "vide" });
    setProposition(null);
    if (verdict.type === "ok" && verdict.entry?.kind === "lot" && !verdict.serie) {
      setFeuille({ ligneId: verdict.ligneId, entry: verdict.entry });
      setOuvert(false);
      setMessage("");
      return;
    }
    if (verdict.type === "ok") {
      const etat = etatEntree(local?.lignes, verdict.ligneId, verdict.entry.id);
      const suivant = incrementer(verdict.entry, etat, verdict.serie);
      const lignes = { [verdict.ligneId]: { [verdict.entry.id]: suivant } };
      const apres = { ...(local?.lignes || {}), [verdict.ligneId]: { ...(local?.lignes?.[verdict.ligneId] || {}), [verdict.entry.id]: suivant } };
      const fin = missionTerminee(mission, apres, local?.bloquees);
      enregistrer(venteId, { fingerprint: empreinte, lignes, complete: fin });
      setMessage("");
      if (fin) setOuvert(false);
      else feedback.success();
      return;
    }
    if (verdict.type === "bloque-lot" || verdict.type === "bloque-expire") {
      enregistrer(venteId, { fingerprint: empreinte, blocked: true });
      setMessage(verdict.type === "bloque-expire" ? fr.pickExpired : fr.pickWrongLot);
      feedback.error();
      return;
    }
    if (verdict.type === "autre-ligne") {
      setProposition({ ligneId: verdict.ligneId, libelle: verdict.libelle });
      setMessage(fr.pickOtherLine);
      feedback.warn();
      return;
    }
    if (verdict.type === "complet" || verdict.type === "deja") {
      setMessage(fr.lineDone);
      feedback.warn();
      return;
    }
    if (verdict.type === "hors") {
      setMessage(fr.notOnOrder);
      feedback.warn();
    }
  }

  function appliquerFeuille(valeur) {
    if (!feuille) return false;
    const etat = etatEntree(local?.lignes, feuille.ligneId, feuille.entry.id);
    const resultat = appliquerQuantiteLot(feuille.entry, etat, valeur);
    if (!resultat.ok) {
      feedback.error();
      return false;
    }
    const lignes = { [feuille.ligneId]: { [feuille.entry.id]: resultat.etat } };
    const apres = {
      ...(local?.lignes || {}),
      [feuille.ligneId]: { ...(local?.lignes?.[feuille.ligneId] || {}), [feuille.entry.id]: resultat.etat },
    };
    const fin = missionTerminee(mission, apres, local?.bloquees);
    enregistrer(venteId, { fingerprint: empreinte, lignes, complete: fin });
    setFeuille(null);
    if (!fin) feedback.success();
    return true;
  }

  function signaler(motif, detail) {
    const ligneId = feuille?.ligneId || activeId;
    enregistrer(venteId, {
      fingerprint: empreinte,
      anomalie: { ligneId, motif, detail, at: Date.now() },
      bloquee: { ligneId, motif, detail },
    });
    const bloquees = { ...(local?.bloquees || {}), [String(ligneId)]: { ligneId, motif, detail } };
    if (missionTerminee(mission, local?.lignes, bloquees)) {
      enregistrer(venteId, { fingerprint: empreinte, complete: true });
    }
    setFeuille(null);
    setOuvert(false);
    setMessage("");
  }

  const status = query.error?.response?.status;

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 py-4 text-text-main"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      {!canRead ? <p>{fr.pickForbidden}</p> : null}
      {query.isLoading ? <p role="status">{fr.scanResolving}</p> : null}
      {query.isError ? (
        <div className="flex flex-col gap-2">
          <p style={{ color: "var(--accent-danger)" }}>
            {status === 403 ? fr.pickForbidden : status === 404 ? fr.pickMissing : getAxiosErrorMessage(query.error, fr.depotError)}
          </p>
          {status !== 404 && status !== 403 ? (
            <button type="button" onClick={() => query.refetch()} className="inline-flex min-h-12 items-center font-semibold touch-manipulation">{fr.retry}</button>
          ) : null}
        </div>
      ) : null}

      {mission ? (
        <>
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{mission.reference}</h1>
            <p className="text-sm text-text-sub">{mission.client.nom}{mission.client.ville ? ` · ${mission.client.ville}` : ""}</p>
            {mission.depot ? <p className="text-sm">{mission.depot}</p> : null}
          </header>
          {alerte ? <p role="status">{alerte}</p> : null}
          {mission.typeVente === "COMMANDE_WEB" ? <p className="text-sm text-text-sub">{fr.pickWeb}</p> : null}
          <p className="text-sm text-text-sub">{fr.pickNoPlace}</p>

          {complet ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card-bg p-4" aria-label={fr.pickVerified}>
              <SuccessMark quiet />
              <p className="text-lg font-semibold">
                {(local?.anomalies || []).length ? fr.pickVerifiedAnomalies : fr.pickVerified}
              </p>
              <p>{texte(fr.pickDoneLines, { done: mission.lignes.length, total: mission.lignes.length })}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {mission.lignes.map((ligne) => {
                  const faite = ligne.entries.reduce((sum, entry) => sum + quantiteFaite(entry, etatEntree(local?.lignes, ligne.id, entry.id)), 0);
                  return <li key={ligne.id}>{ligne.article.libelle || ligne.article.code} · {faite}</li>;
                })}
              </ul>
              <p>{fr.pickDuration} {duree(local?.startedAt, local?.finishedAt)}</p>
              <p>{fr.pickScans} {local?.scans || 0}</p>
              <p>{fr.pickBlocked} {local?.blocked || 0}</p>
              {(local?.anomalies || []).map((anomalie, index) => (
                <p key={`${anomalie.ligneId}-${index}`}>{fr.pickBlockedLine} · {fr.pickAnomalyMotif[anomalie.motif] || anomalie.motif}{anomalie.detail ? ` · ${anomalie.detail}` : ""}</p>
              ))}
              <Link to="/terrain/preparation" className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
                {fr.pickNext}
              </Link>
              <Link to="/terrain" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
                {fr.backHome}
              </Link>
            </section>
          ) : (
            <div className="flex flex-col gap-3">
              {mission.lignes.map((ligne) => (
                <PickLineCard
                  key={ligne.id}
                  ligne={ligne}
                  progress={local?.lignes}
                  active={String(ligne.id) === String(activeId)}
                  verrouillee={!disponible}
                  bloquee={Boolean(local?.bloquees?.[ligne.id] || local?.bloquees?.[String(ligne.id)])}
                  onOpen={() => {
                    if (!disponible) return;
                    setActiveId(ligne.id);
                    setMessage("");
                    setProposition(null);
                    setOuvert(true);
                  }}
                />
              ))}
            </div>
          )}
          {ouvert && !complet ? (
            <PickScanSheet
              title={mission.lignes.find((ligne) => String(ligne.id) === String(activeId))?.article?.libelle || mission.reference}
              message={message}
              proposition={proposition}
              onClose={() => setOuvert(false)}
              bloquant={message === fr.pickWrongLot || message === fr.pickExpired}
              onSignaler={signaler}
              onCode={traiter}
              onSwitch={(ligneId) => {
                setActiveId(ligneId);
                setProposition(null);
                setMessage("");
              }}
            />
          ) : null}
          {feuille ? (
            <PickQuantitySheet
              entry={feuille.entry}
              etat={etatEntree(local?.lignes, feuille.ligneId, feuille.entry.id)}
              onConfirm={appliquerFeuille}
              onSignaler={signaler}
              onClose={() => setFeuille(null)}
            />
          ) : null}
        </>
      ) : null}
    </motion.div>
  );
}
