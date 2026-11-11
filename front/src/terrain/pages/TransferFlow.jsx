import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { feedback } from "../lib/feedback";
import { resolveScan } from "../lib/resolveScan";
import { useTransferMutation } from "../lib/useTransferMutation";
import {
  articleSerie,
  classerLignesStock,
  classeTransfert,
  comparerSnapshot,
  corpsTransfert,
  interDepotInterdit,
  memeEmplacement,
  messageBackend,
  quantiteTransfert,
  sommeQuantite,
} from "../lib/transfer";
import TransferStepper from "../components/TransferStepper";
import SuccessMark from "../motion/SuccessMark";
import EmplacementPicker from "../components/EmplacementPicker";
import TerrainScanner from "../components/TerrainScanner";
import TerrainSheet from "../components/TerrainSheet";
import { fr } from "../strings/fr";

async function quantiteEmplacement(depotId, articleId, emplacementId) {
  const { data } = await api.get("stock", {
    params: { depotId, articleId, emplacementId, limit: 20 },
  });
  return sommeQuantite(data?.items);
}

export default function TransferFlow() {
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const prefill = location.state || {};
  const sessionKey = useTerrainSessionKey();
  const depotSession = useTerrainStore((s) => s.depotId);
  const depotLabel = useTerrainStore((s) => s.depotLabel);
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = hasPermission(role, "stock:write");
  const online = useOnlineStatus();
  const mutation = useTransferMutation(sessionKey);
  const verrou = useRef(false);

  const [etape, setEtape] = useState(prefill.articleId && prefill.emplacementId ? 2 : prefill.articleId || prefill.emplacementId ? 1 : 0);
  const [source, setSource] = useState(prefill.emplacementId ? { id: Number(prefill.emplacementId), code: prefill.emplacementCode || "" } : null);
  const [article, setArticle] = useState(prefill.articleId ? { id: Number(prefill.articleId), code: prefill.articleCode || "", libelle: prefill.articleLibelle || "", modeTracage: prefill.modeTracage || "" } : null);
  const [ligne, setLigne] = useState(null);
  const [quantite, setQuantite] = useState("");
  const [autreDepot, setAutreDepot] = useState(false);
  const [depotDest, setDepotDest] = useState(null);
  const [destination, setDestination] = useState(null);
  const [scanner, setScanner] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avertissement, setAvertissement] = useState("");
  const [noteLots, setNoteLots] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [reseau, setReseau] = useState(null);

  const depotOrigineId = prefill.depotId || depotSession;
  const depotDestinationId = autreDepot ? depotDest?.id : depotSession;

  const stockSource = useQuery({
    queryKey: ["terrain", sessionKey, "transfert", "source", depotOrigineId ?? null, source?.id ?? null, article?.id ?? null],
    enabled: Boolean(sessionKey) && canWrite && depotOrigineId != null && (source?.id != null || article?.id != null),
    queryFn: async () => {
      const params = { depotId: depotOrigineId, limit: 50 };
      if (source?.id != null && article?.id == null) params.emplacementId = source.id;
      if (article?.id != null) params.articleId = article.id;
      const { data } = await api.get("stock", { params });
      return data?.items || [];
    },
  });

  const depots = useQuery({
    queryKey: ["terrain", sessionKey, "transfert", "depots"],
    enabled: Boolean(sessionKey) && canWrite && autreDepot,
    queryFn: async () => {
      const { data } = await api.get("depots", { params: { statut: "ACTIF", limit: 100 } });
      return data?.items || [];
    },
  });

  const compat = useQuery({
    queryKey: ["terrain", sessionKey, "transfert", "compat", article?.id ?? null, destination?.id ?? null],
    enabled: Boolean(sessionKey) && article?.id != null && destination?.id != null,
    queryFn: async () => {
      const { data } = await api.get("stock/emplacement-compatibility", {
        params: { articleId: article.id, emplacementId: destination.id },
      });
      return data;
    },
  });

  const disponibles = classerLignesStock(stockSource.data);
  const dispo = ligne ? Number(ligne.quantite) || 0 : disponibles.deplacables
    .filter((row) => !article?.id || Number(row.articleId || row.article?.id) === Number(article.id))
    .filter((row) => !source?.id || Number(row.emplacementId || row.emplacement?.id) === Number(source.id))
    .reduce((sum, row) => sum + (Number(row.quantite) || 0), 0);
  const serie = articleSerie(article || ligne?.article);
  const saisie = quantiteTransfert(quantite, dispo, serie);
  const interdit = interDepotInterdit(article || ligne?.article, depotOrigineId, depotDestinationId);
  const identique = memeEmplacement(source?.id, destination?.id);
  const etapeIndex = resultat || reseau ? 3 : etape;

  async function lireCode(raw) {
    setErreur("");
    setScanner(false);
    const resolu = await resolveScan(raw, { depotId: depotOrigineId, sessionKey });
    if (resolu.kind === "stock-line") {
      const id = resolu.data?.emplacementId || resolu.data?.emplacement?.id;
      if (id == null) {
        setErreur(fr.transferNoPlaceLine);
        feedback.warn();
        return;
      }
      choisirLigne(resolu.data);
      feedback.success();
      return;
    }
    if (etape === 0 && resolu.kind === "emplacement") {
      setSource({ id: resolu.data.id, code: resolu.data.code || "" });
      setEtape(1);
      feedback.success();
      return;
    }
    if (resolu.kind === "lot" || resolu.kind === "article") {
      const depuisLot = resolu.kind === "lot";
      if (depuisLot) setNoteLots(true);
      const art = depuisLot
        ? {
            id: resolu.data?.article?.id || resolu.data?.articleId,
            code: resolu.data?.article?.code || "",
            libelle: resolu.data?.article?.libelle || "",
            modeTracage: resolu.data?.article?.modeTracage || "",
          }
        : resolu.data;
      if (!art?.id) return;
      const rows = stockSource.data || [];
      if (source?.id && rows.length) {
        const row = rows.find((item) => Number(item.articleId || item.article?.id) === Number(art.id));
        if (!row || (row.emplacementId ?? row.emplacement?.id) == null) {
          setErreur(fr.scanUnknown);
          feedback.warn();
          return;
        }
        choisirLigne(row);
        return;
      }
      setArticle(art);
      setEtape(source?.id ? 2 : 1);
      feedback.success();
      return;
    }
    setErreur(fr.scanUnknown);
    feedback.warn();
  }

  function choisirLigne(row) {
    const id = row.emplacementId || row.emplacement?.id;
    if (id == null) return;
    setLigne(row);
    setSource({ id: Number(id), code: row.emplacement?.code || source?.code || "" });
    setArticle({
      id: row.articleId || row.article?.id,
      code: row.article?.code || article?.code || "",
      libelle: row.article?.libelle || article?.libelle || "",
      modeTracage: row.article?.modeTracage || article?.modeTracage || "",
    });
    setQuantite(String(row.quantite ?? ""));
    setEtape(2);
  }

  async function envoyer() {
    if (verrou.current || mutation.isPending || !saisie.ok || !online || interdit || identique) return;
    verrou.current = true;
    setErreur("");
    setReseau(null);
    const body = corpsTransfert({
      articleId: article.id,
      depotOrigineId,
      emplacementOrigineId: source.id,
      depotDestId: depotDestinationId,
      emplacementDestId: destination.id,
      quantite: saisie.quantite,
    });
    let avant = null;
    let avantDest = null;
    try {
      avant = await quantiteEmplacement(depotOrigineId, article.id, source.id);
      avantDest = await quantiteEmplacement(depotDestinationId, article.id, destination.id);
      const data = await mutation.mutateAsync(body);
      setConfirmer(false);
      setResultat({ data, avant, avantDest });
      if (data?.statut === "EN_ATTENTE_VALIDATION") feedback.warn();
      else feedback.success();
    } catch (error) {
      if (classeTransfert(error) === "validation") {
        setErreur(messageBackend(error) || getAxiosErrorMessage(error));
        feedback.error();
      } else {
        let apres = null;
        let apresDest = null;
        try {
          apres = await quantiteEmplacement(depotOrigineId, article.id, source.id);
          apresDest = await quantiteEmplacement(depotDestinationId, article.id, destination.id);
        } catch {
          apres = null;
        }
        setConfirmer(false);
        setReseau({
          verdict: comparerSnapshot(avant, apres, avantDest, apresDest, saisie.quantite),
          reference: typeof error?.response?.data?.reference === "string" ? error.response.data.reference : "",
          avant,
          source: apres,
          avantDest,
          destination: apresDest,
        });
        feedback.error();
      }
    } finally {
      verrou.current = false;
    }
  }

  if (!canWrite) {
    return <p className="px-4 py-6 text-base">{fr.transferForbidden}</p>;
  }

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 py-4 text-text-main"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      <h1 className="text-2xl font-semibold">{fr.transferTitle}</h1>
      <TransferStepper etape={etapeIndex} />

      {resultat ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card-bg p-4" aria-label={resultat.data?.statut || fr.transferValidated}>
          {resultat.data?.statut === "EN_ATTENTE_VALIDATION" ? null : <SuccessMark quiet />}
          <p className="text-lg font-semibold">{resultat.data?.statut || fr.transferValidated}</p>
          {resultat.data?.statut === "EN_ATTENTE_VALIDATION" ? <p>{fr.transferPending}</p> : null}
          <p>{fr.transferReference} {resultat.data?.reference}</p>
          <p>{saisie.quantite} · {source?.code} → {destination?.code}</p>
          {(resultat.data?.lotsTransferred || []).map((lot) => (
            <p key={`${lot.lotId}-${lot.quantite}`} className="text-sm">{lot.lotNumero} · {lot.quantite}</p>
          ))}
        </section>
      ) : null}

      {reseau ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card-bg p-4" role="alert">
          <p className="text-lg font-semibold">
            {reseau.verdict === "applique" ? fr.transferAppliedGuess : reseau.verdict === "inchange" ? fr.transferUnchanged : fr.transferUncertain}
          </p>
          {reseau.reference ? <p>{fr.transferReference} {reseau.reference}</p> : null}
          <p>{fr.transferNow} {reseau.avant ?? "—"} → {reseau.source ?? "—"} · {reseau.avantDest ?? "—"} → {reseau.destination ?? "—"}</p>
          {reseau.verdict === "incertain" ? <p>{fr.transferCheckMoves}</p> : null}
        </section>
      ) : null}

      {!resultat && etape === 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{fr.transferSource}</h2>
          <button type="button" onClick={() => setScanner(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
            {fr.placeScan}
          </button>
          <button type="button" onClick={() => setEtape(1)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border text-base font-semibold touch-manipulation">
            {fr.transferArticleFirst}
          </button>
        </section>
      ) : null}

      {!resultat && etape === 1 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{fr.transferArticle}</h2>
          {source?.code ? <p className="text-sm text-text-sub">{source.code}</p> : null}
          <button type="button" onClick={() => setScanner(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
            {fr.scanNow}
          </button>
          {noteLots ? <p className="text-sm text-text-sub">{fr.transferLotsChosen}</p> : null}
          {stockSource.isLoading ? <p role="status">{fr.scanResolving}</p> : null}
          {disponibles.immobiles.map((row) => (
            <p key={row.id} className="text-sm">{row.article?.libelle || row.article?.code} · {fr.transferNoPlaceLine}</p>
          ))}
          {disponibles.deplacables.map((row) => (
            <button key={row.id} type="button" onClick={() => choisirLigne(row)} className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card-bg px-3 text-start touch-manipulation">
              <span>{row.article?.libelle || row.article?.code} · {row.emplacement?.code}</span>
              <span className="font-semibold">{row.quantite}</span>
            </button>
          ))}
        </section>
      ) : null}

      {!resultat && etape === 2 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{fr.transferQty}</h2>
          <p className="text-sm text-text-sub">{article?.libelle || article?.code} · {dispo}</p>
          <input
            inputMode={serie ? "numeric" : "decimal"}
            aria-label={fr.transferQty}
            value={quantite}
            onChange={(event) => setQuantite(event.target.value)}
            className="min-h-12 rounded-2xl border border-border bg-card-bg px-3 text-2xl text-text-main"
          />
          <button
            type="button"
            disabled={!saisie.ok}
            onClick={() => setEtape(3)}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation disabled:opacity-50"
            style={{ background: "var(--accent-primary)" }}
          >
            {fr.transferDest}
          </button>
        </section>
      ) : null}

      {!resultat && reseau?.verdict !== "applique" && reseau?.verdict !== "incertain" && etape === 3 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{fr.transferDest}</h2>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={!autreDepot} onClick={() => { setAutreDepot(false); setDestination(null); }} className="min-h-12 rounded-2xl border border-border bg-card-bg text-sm font-semibold touch-manipulation">
              {fr.transferSessionDepot}
            </button>
            <button type="button" aria-pressed={autreDepot} onClick={() => { setAutreDepot(true); setDestination(null); }} className="min-h-12 rounded-2xl border border-border bg-card-bg text-sm font-semibold touch-manipulation">
              {fr.transferOtherDepot}
            </button>
          </div>
          {!autreDepot ? <p className="text-sm text-text-sub">{depotLabel}</p> : null}
          {autreDepot && depots.isLoading ? <p role="status">{fr.scanResolving}</p> : null}
          {autreDepot ? (depots.data || []).filter((depot) => Number(depot.id) !== Number(depotSession)).map((depot) => (
            <button key={depot.id} type="button" aria-pressed={depotDest?.id === depot.id} onClick={() => { setDepotDest(depot); setDestination(null); }} className="min-h-12 rounded-2xl border border-border bg-card-bg px-3 text-start font-semibold touch-manipulation">
              {depot.libelle || depot.code}
            </button>
          )) : null}
          {depotDestinationId != null ? (
            <EmplacementPicker depotId={depotDestinationId} articleId={article?.id} value={destination} onChange={setDestination} />
          ) : null}
          {identique ? <p className="text-sm" style={{ color: "var(--accent-danger)" }}>{fr.transferSamePlace}</p> : null}
          {interdit ? <p className="text-sm" style={{ color: "var(--accent-danger)" }}>{fr.transferSeriesBlocked}</p> : null}
          {compat.data && compat.data.ok === false ? <p className="text-sm" role="alert">{compat.data.message}</p> : null}
          {avertissement ? <p className="text-sm">{avertissement}</p> : null}
          {Number(depotOrigineId) !== Number(depotDestinationId) && depotDestinationId != null ? (
            <p className="text-sm text-text-sub">{fr.transferLotsExpired}</p>
          ) : null}
          {erreur ? <p role="alert" className="text-sm">{erreur}</p> : null}
          {!online ? (
            <>
              <p className="text-sm">{fr.offlineRequired}</p>
              <p className="text-sm">{fr.queueBlocked}</p>
            </>
          ) : null}
          <button
            type="button"
            disabled={!online || !destination?.id || identique || interdit || !saisie.ok || mutation.isPending}
            onClick={() => { setAvertissement(compat.data?.ok === false ? compat.data.message : ""); setConfirmer(true); }}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation disabled:opacity-50"
            style={{ background: "var(--accent-primary)" }}
          >
            {mutation.isPending ? fr.sending : fr.transferConfirm}
          </button>
        </section>
      ) : null}

      {scanner ? (
        <TerrainScanner elevated title={etape === 0 ? fr.transferSource : fr.transferArticle} onClose={() => setScanner(false)} onDetected={lireCode} />
      ) : null}
      {confirmer ? (
        <TerrainSheet title={fr.transferConfirm} onClose={() => setConfirmer(false)}>
          <div className="flex flex-col gap-3">
            <p>{article?.libelle || article?.code}</p>
            <p>{saisie.quantite}</p>
            <p>{source?.code} → {destination?.code}</p>
            {Number(depotOrigineId) !== Number(depotDestinationId) ? <p className="text-sm text-text-sub">{fr.transferLotsExpired}</p> : null}
            {erreur ? <p role="alert">{erreur}</p> : null}
            {!online ? <p className="text-sm">{fr.queueBlocked}</p> : null}
            <button type="button" disabled={mutation.isPending || !online} onClick={envoyer} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation disabled:opacity-50" style={{ background: "var(--accent-primary)" }}>
              {mutation.isPending ? fr.sending : fr.transferConfirm}
            </button>
          </div>
        </TerrainSheet>
      ) : null}
    </motion.div>
  );
}
