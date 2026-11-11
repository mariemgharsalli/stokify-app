import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import api, { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useTerrainStore } from "../store/terrainStore";
import { useTerrainSessionKey } from "../lib/useTerrainSessionKey";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import { invaliderReception, useRecevoirTout } from "../lib/useReceptionMutations";
import {
  bilanLignes,
  compteSeriesAuto,
  interpreterScan,
  joursDeRetard,
  lotsDesLignes,
  messageBackend,
  motifToutRecevoir,
  progression,
  resteLigne,
  traceOf,
} from "../lib/reception";
import { feedback } from "../lib/feedback";
import TerrainScanner from "../components/TerrainScanner";
import ReceptionLineSheet from "../components/ReceptionLineSheet";
import { fillTemplate } from "../lib/dayProgress";
import CompletionBar from "../motion/CompletionBar";
import SuccessMark from "../motion/SuccessMark";
import SwipeRow from "../motion/SwipeRow";
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

function badge(article) {
  const trace = traceOf(article);
  if (trace.mode === "AUCUN") return null;
  const nom = fr.traceLabel[trace.mode] || trace.mode;
  return trace.auto ? `${nom} · ${fr.traceAuto}` : nom;
}

export default function ReceptionDetail() {
  const { achatId } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const sessionKey = useTerrainSessionKey();
  const depotId = useTerrainStore((s) => s.depotId);
  const role = useAuthStore((s) => s.user?.role);
  const canRead = hasPermission(role, "achats:read");
  const canWrite = hasPermission(role, "achats:write");
  const online = useOnlineStatus();
  const tout = useRecevoirTout();
  const guard = useRef(false);
  const [code, setCode] = useState("");
  const [avis, setAvis] = useState("");
  const [scanOuvert, setScanOuvert] = useState(false);
  const [active, setActive] = useState(null);
  const [extra, setExtra] = useState(0);
  const [confirmerTout, setConfirmerTout] = useState(false);
  const [confirmeDepot, setConfirmeDepot] = useState(false);
  const [echec, setEchec] = useState(null);
  const [succes, setSucces] = useState(null);

  const query = useQuery({
    queryKey: ["terrain", sessionKey, "reception", "achat", achatId],
    enabled: Boolean(sessionKey) && canRead && achatId != null,
    queryFn: async () => (await api.get(`achats/${achatId}`)).data,
  });

  const achat = query.data;
  const depotDifferent = achat && depotId != null && Number(achat.depotId) !== Number(depotId);
  const depotLabel = achat?.depot?.libelle || achat?.depot?.code || "";
  const motif = achat ? motifToutRecevoir(achat) : "vide";
  const barre = progression(achat);

  function memoriser(frais) {
    if (!frais) return;
    queryClient.setQueryData(["terrain", sessionKey, "reception", "achat", achatId], frais);
  }

  function ouvrirLigne(ligne) {
    setAvis("");
    setSucces(null);
    setActive((courante) => {
      if (courante?.id === ligne.id) setExtra((n) => n + 1);
      else setExtra(0);
      return ligne;
    });
  }

  function traiterCode(raw) {
    if (!achat || active) return;
    const resultat = interpreterScan(achat.lignes, raw);
    if (resultat.type === "hors") {
      feedback.warn();
      setAvis(fr.notOnOrder);
      return;
    }
    if (resultat.type === "complet") {
      feedback.warn();
      setAvis(fr.lineDone);
      return;
    }
    feedback.success();
    setAvis("");
    ouvrirLigne(resultat.ligne);
  }

  async function lancerTout() {
    if (guard.current || tout.isPending || !online || !canWrite) return;
    if (depotDifferent && !confirmeDepot) return;
    guard.current = true;
    setEchec(null);
    try {
      const resultat = await tout.mutateAsync(achat.id);
      memoriser(resultat.achat);
      setConfirmerTout(false);
      setSucces(resultat);
      feedback.success();
    } catch (error) {
      if (error?.etat) memoriser(error.etat);
      setEchec(error);
      setConfirmerTout(false);
      feedback.error();
    } finally {
      guard.current = false;
    }
  }

  if (!canRead) return <p className="px-4 py-6">{fr.purchaseForbidden}</p>;

  return (
    <motion.div
      className="flex flex-col gap-4 px-4 py-4 text-text-main"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      {query.isLoading ? <p role="status">{fr.scanResolving}</p> : null}
      {query.isError ? (
        <div>
          <p style={{ color: "var(--accent-danger)" }}>
            {query.error?.response?.status === 403 ? fr.purchaseForbidden : query.error?.response?.status === 404 ? fr.purchaseMissing : getAxiosErrorMessage(query.error)}
          </p>
          <button type="button" onClick={() => query.refetch()} className="mt-2 inline-flex min-h-12 items-center font-semibold touch-manipulation">{fr.retry}</button>
        </div>
      ) : null}

      {achat ? (
        <>
          <header className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{achat.reference}</h1>
            <p>{achat.fournisseur?.nom || achat.fournisseur?.code}</p>
            <p className="font-semibold">{fr.destination} : {depotLabel}</p>
            <p className="text-sm text-text-sub">{formatJour(achat.dateLivraisonPrevue)}{joursDeRetard(achat.dateLivraisonPrevue) > 0 ? ` · ${texte(fr.lateBadge, { n: joursDeRetard(achat.dateLivraisonPrevue) })}` : ""}</p>
            <p className="terrain-mono text-sm text-text-sub">{barre.recue} / {barre.commandee}</p>
            <CompletionBar ratio={barre.ratio} label={fillTemplate(fr.meterOf, { done: barre.recue, total: barre.commandee })} />
          </header>

          {depotDifferent ? (
            <p className="rounded-2xl border border-border bg-card-bg px-3 py-3 text-sm font-semibold" style={{ color: "var(--accent-warning)" }}>
              {texte(fr.depotWarning, { depot: depotLabel })}
            </p>
          ) : null}

          {succes ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card-bg p-3" aria-label={fr.receivedLines}>
              <SuccessMark quiet />
              <h2 className="text-lg font-semibold">{succes.statut === "RECU" ? fr.orderComplete : fr.receivedLines}</h2>
              <p>{fr.statusLabel} : {succes.statut}</p>
              <ul className="flex flex-col gap-2">
                {(succes.faites || []).map((ligne) => (
                  <li key={ligne.id} className="flex min-h-12 items-center justify-between gap-2">
                    <span>{ligne.article?.libelle || ligne.article?.code}</span>
                    <span className="font-semibold">{ligne.quantiteRecue}</span>
                  </li>
                ))}
              </ul>
              {lotsDesLignes(succes.achat, (succes.faites || []).map((ligne) => ligne.id)).map((lot) => (
                <p key={lot.numero}>{fr.lotNumber} : {lot.numero}</p>
              ))}
              {compteSeriesAuto(succes.faites) > 0 ? <p>{texte(fr.seriesGeneratedCount, { n: compteSeriesAuto(succes.faites) })}</p> : null}
              <Link to="/terrain/reception" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border font-semibold touch-manipulation">{fr.nextReceipt}</Link>
              <button type="button" onClick={() => navigate("/terrain")} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
                {fr.backHome}
              </button>
            </section>
          ) : null}

          {echec ? (
            <section className="rounded-2xl border border-border bg-card-bg p-3">
              <p className="font-semibold">
                {texte(fr.linesState, {
                  done: bilanLignes(echec.etat || achat).recues,
                  left: bilanLignes(echec.etat || achat).restantes,
                })}
              </p>
              {echec.classe === "validation" ? <p className="mt-2">{messageBackend(echec.cause) || getAxiosErrorMessage(echec.cause)}</p> : <p className="mt-2">{fr.verifyBeforeRetry}</p>}
            </section>
          ) : null}

          {canWrite ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = code.trim();
                if (!value) return;
                setCode("");
                traiterCode(value);
              }}
            >
              <input
                aria-label={fr.codeOfOrder}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="min-h-12 min-w-0 flex-1 rounded-2xl border border-border bg-card-bg px-3 text-base text-text-main"
              />
              <button type="submit" className="inline-flex min-h-12 items-center rounded-2xl border border-border px-3 text-sm font-semibold touch-manipulation">{fr.scanSubmit}</button>
            </form>
          ) : null}
          {avis ? <p className="text-sm font-semibold" style={{ color: "var(--accent-warning)" }}>{avis}</p> : null}
          {canWrite ? (
            <button type="button" onClick={() => setScanOuvert(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-border font-semibold touch-manipulation">
              {fr.scanOrder}
            </button>
          ) : null}

          <ul className="flex flex-col gap-3">
            {(achat.lignes || []).map((ligne) => {
              const reste = resteLigne(ligne);
              const ratio = Number(ligne.quantite) > 0 ? Math.min(1, Number(ligne.quantiteRecue || 0) / Number(ligne.quantite)) : 0;
              const etiquette = badge(ligne.article);
              const ouvert = active?.id === ligne.id;
              const ouvrable = canWrite && reste > 0;
              return (
                <li key={ligne.id}>
                  <SwipeRow enabled={ouvrable} actionLabel={fr.openLine} onAction={() => ouvrirLigne(ligne)}>
                    <div className={`rounded-2xl border bg-card-bg p-3 ${ouvert ? "border-[var(--accent-primary)]" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{ligne.article?.libelle}</p>
                          <p className="text-sm text-text-sub">{ligne.article?.code}</p>
                        </div>
                        {etiquette ? <span className="rounded-full px-2 py-1 text-xs font-semibold">{etiquette}</span> : null}
                      </div>
                      <p className="mt-2 text-sm">{fr.ordered} {ligne.quantite} · {fr.received} {ligne.quantiteRecue || 0} · {fr.remaining} {reste}</p>
                      <CompletionBar ratio={ratio} label={fillTemplate(fr.meterOf, { done: ligne.quantiteRecue || 0, total: ligne.quantite })} />
                      {ouvrable ? (
                        <button type="button" onClick={() => ouvrirLigne(ligne)} className="mt-3 inline-flex min-h-12 items-center font-semibold touch-manipulation">
                          {fr.openLine}
                        </button>
                      ) : null}
                    </div>
                  </SwipeRow>
                </li>
              );
            })}
          </ul>

          {canWrite && motif === "ok" && !succes ? (
            <button type="button" onClick={() => { setConfirmeDepot(false); setConfirmerTout(true); }} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>
              {fr.confirmAll}
            </button>
          ) : null}
          {canWrite && motif === "manuel" ? <p className="text-sm text-text-sub">{fr.confirmAllHidden}</p> : null}
        </>
      ) : null}

      {active && achat ? (
        <ReceptionLineSheet
          ligne={(achat.lignes || []).find((ligne) => ligne.id === active.id) || active}
          achat={achat}
          sessionDepotId={depotId}
          extra={extra}
          onClose={() => setActive(null)}
          onVerified={(frais) => {
            memoriser(frais);
            setActive(null);
            setEchec({ etat: frais, classe: "verifier", cause: null });
          }}
          onApplied={async (resultat) => {
            memoriser(resultat.achat);
            setActive(null);
            setSucces(resultat);
            invaliderReception(queryClient, sessionKey);
          }}
        />
      ) : null}

      {confirmerTout && achat ? (
        <div className="fixed inset-0 z-[60] flex items-end">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label={fr.close} onClick={() => setConfirmerTout(false)} />
          <div role="dialog" aria-modal="true" aria-label={fr.confirmAll} className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card-bg p-4 text-text-main">
            <h2 className="text-xl font-semibold">{fr.confirmAll}</h2>
            <p className="mt-2 text-sm">{fr.confirmAllHint}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {(achat.lignes || []).filter((ligne) => resteLigne(ligne) > 0).map((ligne) => (
                <li key={ligne.id} className="flex min-h-12 items-center justify-between gap-2">
                  <span>{ligne.article?.libelle}</span>
                  <span className="font-semibold">{resteLigne(ligne)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">{fr.destination} : {depotLabel}</p>
            {depotDifferent ? (
              <label className="mt-3 flex min-h-12 items-center gap-3">
                <input type="checkbox" checked={confirmeDepot} onChange={(event) => setConfirmeDepot(event.target.checked)} />
                <span>{texte(fr.depotConfirm, { depot: depotLabel })}</span>
              </label>
            ) : null}
            {!online ? (
              <>
                <p className="mt-3 font-semibold">{fr.offlineRequired}</p>
                <p className="text-sm">{fr.queueBlocked}</p>
              </>
            ) : null}
            <button
              type="button"
              disabled={!online || tout.isPending || (depotDifferent && !confirmeDepot)}
              onClick={lancerTout}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl font-semibold text-white touch-manipulation disabled:opacity-50"
              style={{ background: "var(--accent-primary)" }}
            >
              {tout.isPending ? fr.sending : fr.confirmReceipt}
            </button>
          </div>
        </div>
      ) : null}

      {scanOuvert ? (
        <TerrainScanner
          continuous
          title={fr.scanOrder}
          onClose={() => setScanOuvert(false)}
          onDetected={(raw) => traiterCode(raw)}
        />
      ) : null}
    </motion.div>
  );
}
