import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import CountSheet from "../components/CountSheet";
import UnexpectedItemSheet from "../components/UnexpectedItemSheet";
import TerrainScanner from "../components/TerrainScanner";
import { feedback } from "../lib/feedback";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { mettreEnFile } from "../offline/queue";
import { resolveScan } from "../lib/resolveScan";
import { useAjouterLigne, useCompterLigne, useInventaireCourant } from "../lib/useInventoryMutations";
import {
  classeInventaire,
  debutSession,
  dureeSession,
  inventaireCloture,
  ligneNouvelle,
  lignesCorrespondantes,
  lireMasque,
  messageBackend,
  progression,
  vueLigne,
} from "../lib/inventory";
import SuccessMark from "../motion/SuccessMark";
import SwipeRow from "../motion/SwipeRow";
import { fr } from "../strings/fr";

function texte(modele, valeurs) {
  return Object.entries(valeurs).reduce((label, [cle, valeur]) => label.replace(`{${cle}}`, String(valeur)), modele);
}

function etatLigne(ligne) {
  if (ligne?.recomptageDemande) return fr.inventoryRecount;
  if (ligne?.qteReelle == null) return fr.inventoryUncounted;
  return texte(fr.inventoryCounted, { n: ligne.qteReelle });
}

export default function InventoryLocation() {
  const { emplacementId } = useParams();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const canWrite = hasPermission(role, "stock:write");
  const { sessionKey, depotId, detail, id } = useInventaireCourant();
  const compter = useCompterLigne(sessionKey);
  const ajouter = useAjouterLigne(sessionKey);
  const online = useOnlineStatus();
  const verrou = useRef(false);
  const [feuille, setFeuille] = useState(location.state?.ligneId ? { id: location.state.ligneId } : null);
  const [choix, setChoix] = useState([]);
  const [horsListe, setHorsListe] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [message, setMessage] = useState("");
  const [cloture, setCloture] = useState(false);
  const [fin, setFin] = useState(false);
  const [ajoutes, setAjoutes] = useState([]);
  const [debut, setDebut] = useState(null);
  const [masquer, setMasquer] = useState(lireMasque);
  const inventaire = detail.data;
  const aveugle = Boolean(inventaire?.modeAveugle);
  const cacher = aveugle || masquer;
  useEffect(() => {
    if (inventaire?.id) setDebut(debutSession(`stokify-terrain-inventaire-session:${inventaire.id}`));
  }, [inventaire?.id]);
  useEffect(() => {
    setMasquer(lireMasque());
  }, [inventaire?.id]);
  const sans = emplacementId === "sans";
  const lignesLieu = (inventaire?.lignes || []).filter((ligne) => {
    const place = ligne.emplacementId ?? ligne.emplacement?.id ?? null;
    return sans ? place == null : Number(place) === Number(emplacementId);
  });
  const titre = sans ? fr.inventoryNoPlace : lignesLieu[0]?.emplacement?.code || fr.placeLabel;
  const active = lignesLieu.find((ligne) => Number(ligne.id) === Number(feuille?.id)) || null;

  function memoriser(frais) {
    queryClient.setQueryData(["terrain", sessionKey, "inventaire", String(id)], frais);
  }

  async function lire(raw) {
    setMessage("");
    const resolu = await resolveScan(raw, { depotId });
    setScanner(false);
    const articleId = resolu.kind === "article" ? resolu.data?.id : resolu.kind === "lot" ? resolu.data?.article?.id || resolu.data?.articleId : null;
    const lotId = resolu.kind === "lot" ? resolu.data?.id : null;
    if (!articleId) {
      setMessage(fr.scanUnknown);
      return;
    }
    const trouvees = lignesCorrespondantes(lignesLieu, { articleId, lotId });
    if (!trouvees.length) {
      setMessage(fr.inventoryNotOnList);
      setHorsListe(true);
      return;
    }
    if (trouvees.length === 1) setFeuille(trouvees[0]);
    else setChoix(trouvees);
  }

  async function enregistrer(qteReelle) {
    if (!active || verrou.current || compter.isPending) return;
    verrou.current = true;
    setMessage("");
    try {
      if (!online) {
        await mettreEnFile({
          sessionKey,
          inventaireId: id,
          ligneId: active.id,
          qteReelle,
          qteAvant: active.qteReelle ?? null,
          label: active.article?.libelle || active.article?.code || "",
        });
        setFeuille(null);
        setMessage(fr.queueSaved);
        return;
      }
      const ligne = await compter.mutateAsync({ inventaireId: id, ligneId: active.id, qteReelle });
      setFeuille(null);
      if (ligne?.recomptageDemande) setMessage(fr.inventorySameQty);
      else feedback.success();
    } catch (error) {
      if (inventaireCloture(error)) {
        setCloture(messageBackend(error) || fr.inventoryClosed);
        return;
      }
      if (classeInventaire(error) === "validation") {
        setMessage(messageBackend(error) || getAxiosErrorMessage(error));
      } else {
        try {
          const { data } = await api.get(`inventaires/${id}`);
          memoriser(data);
          const serveur = (data?.lignes || []).find((ligne) => ligne.id === active.id);
          setMessage(`${fr.inventoryAmbiguous} ${serveur?.qteReelle ?? fr.inventoryUncounted}`);
        } catch (reloadError) {
          await mettreEnFile({
            sessionKey,
            inventaireId: id,
            ligneId: active.id,
            qteReelle,
            qteAvant: active.qteReelle ?? null,
            label: active.article?.libelle || active.article?.code || "",
          });
          setFeuille(null);
          setMessage(fr.queueSaved);
          return;
        }
      }
      feedback.error();
    } finally {
      verrou.current = false;
    }
  }

  async function ajouterArticle({ article, lot, quantite }) {
    if (verrou.current || ajouter.isPending) return;
    if (!online) {
      setHorsListe(false);
      setMessage(fr.queueBlocked);
      return;
    }
    verrou.current = true;
    const critere = { articleId: article.id, lotId: lot?.id ?? null, emplacementId: sans ? null : Number(emplacementId) };
    const ids = (inventaire?.lignes || []).map((ligne) => ligne.id);
    try {
      const ligne = await ajouter.mutateAsync({ inventaireId: id, ...critere, qteReelle: quantite });
      setAjoutes((liste) => [...liste, ligne.id]);
      setHorsListe(false);
      feedback.success();
    } catch (error) {
      if (inventaireCloture(error)) {
        setCloture(messageBackend(error) || fr.inventoryClosed);
        return;
      }
      if (classeInventaire(error) === "validation") {
        setMessage(messageBackend(error) || getAxiosErrorMessage(error));
      } else {
        try {
          const { data } = await api.get(`inventaires/${id}`);
          memoriser(data);
          const neuve = ligneNouvelle(ids, data?.lignes, critere);
          if (neuve) {
            setAjoutes((liste) => [...liste, neuve.id]);
            setHorsListe(false);
          }
          setMessage(fr.inventoryAmbiguous);
        } catch (reloadError) {
          setMessage(getAxiosErrorMessage(reloadError));
        }
      }
      feedback.error();
    } finally {
      verrou.current = false;
    }
  }

  if (cloture) {
    return (
      <div className="flex flex-col gap-3 px-4 py-6">
        <p>{fr.inventoryClosed}</p>
        <p>{cloture}</p>
        <Link to="/terrain/inventaire" className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>{fr.back}</Link>
      </div>
    );
  }

  if (fin) {
    const toutes = inventaire?.lignes || [];
    const compte = progression(toutes);
    const restantes = toutes.filter((ligne) => ligne.qteReelle == null && !ligne.recomptageDemande);
    const recompter = toutes.filter((ligne) => ligne.recomptageDemande);
    return (
      <motion.div className="flex flex-col gap-3 px-4 py-4 text-text-main" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
        <SuccessMark quiet />
        <h1 className="text-2xl font-semibold">{fr.inventoryFinish}</h1>
        <p>{fr.inventoryDone}</p>
        <p>{texte(fr.inventoryProgress, compte)}</p>
        <p>{fr.inventoryRecount} {recompter.length}</p>
        <p>{fr.inventoryAddedCount} {ajoutes.length}</p>
        <p>{fr.inventoryDuration} {dureeSession(debut)}</p>
        {!cacher ? toutes.filter((ligne) => ligne.qteReelle != null && ligne.ecart != null).map((ligne) => (
          <p key={ligne.id}>{ligne.article?.code} · {ligne.ecart}</p>
        )) : null}
        <h2 className="text-lg font-semibold">{fr.inventoryRemaining}</h2>
        {restantes.map((ligne) => (
          <button key={ligne.id} type="button" onClick={() => { setFin(false); setFeuille(ligne); }} className="min-h-12 rounded-2xl border border-border bg-card-bg px-3 text-start touch-manipulation">
            {ligne.article?.libelle || ligne.article?.code}
          </button>
        ))}
        <Link to="/terrain/inventaire" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">{fr.back}</Link>
      </motion.div>
    );
  }

  return (
    <motion.div className="flex flex-col gap-3 px-4 py-4 text-text-main" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
      <h1 className="text-2xl font-semibold">{titre}</h1>
      {detail.isLoading ? <p role="status">{fr.scanResolving}</p> : null}
      {detail.isError ? <p role="alert">{getAxiosErrorMessage(detail.error)}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {lignesLieu.map((ligne) => {
        const vu = vueLigne(ligne, { aveugle, masquer: cacher });
        const ajoutee = ajoutes.includes(ligne.id);
        return (
          <SwipeRow key={ligne.id} enabled={canWrite} actionLabel={fr.count} onAction={() => setFeuille(ligne)}>
            <button type="button" onClick={() => canWrite && setFeuille(ligne)} className="flex min-h-12 w-full flex-col items-start justify-center rounded-2xl border border-border bg-card-bg px-3 text-start touch-manipulation">
              <span className="font-semibold">{vu.article?.libelle || vu.article?.code}</span>
              <span className="text-sm text-text-sub">{vu.article?.code}{vu.lot?.numero ? ` · ${vu.lot.numero}` : ""} · {etatLigne(vu)}{ajoutee ? ` · ${fr.inventoryAdded}` : ""}</span>
              {cacher ? null : <span className="text-sm">{ligne.qteTheorique}</span>}
            </button>
          </SwipeRow>
        );
      })}
      {canWrite ? (
        <>
          <button type="button" onClick={() => setScanner(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>{fr.scanNow}</button>
          <button type="button" onClick={() => setHorsListe(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">{fr.inventoryUnexpected}</button>
        </>
      ) : null}
      <button type="button" onClick={() => setFin(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">{fr.inventoryFinish}</button>
      {choix.length > 1 ? (
        <div className="flex flex-col gap-2">
          {choix.map((ligne) => (
            <button key={ligne.id} type="button" onClick={() => { setFeuille(ligne); setChoix([]); }} className="min-h-12 rounded-2xl border border-border bg-card-bg px-3 text-start touch-manipulation">
              {ligne.article?.libelle || ligne.article?.code}{ligne.lot?.numero ? ` · ${ligne.lot.numero}` : ""}
            </button>
          ))}
        </div>
      ) : null}
      {active && canWrite ? <CountSheet ligne={vueLigne(active, { aveugle, masquer: cacher })} onClose={() => setFeuille(null)} onSave={enregistrer} pending={compter.isPending} /> : null}
      {horsListe && canWrite ? <UnexpectedItemSheet depotId={depotId} onClose={() => setHorsListe(false)} onSave={ajouterArticle} pending={ajouter.isPending} /> : null}
      {scanner ? <TerrainScanner elevated title={fr.scanNow} onClose={() => setScanner(false)} onDetected={lire} /> : null}
    </motion.div>
  );
}
