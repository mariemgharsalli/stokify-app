import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { getAxiosErrorMessage } from "../../services/api";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import TerrainScanner from "../components/TerrainScanner";
import { resolveScan } from "../lib/resolveScan";
import { useInventaireCourant } from "../lib/useInventoryMutations";
import { debutSession, ecrireMasque, grouperParEmplacement, lireMasque, progression, vueLigne } from "../lib/inventory";
import { fillTemplate } from "../lib/dayProgress";
import CompletionBar from "../motion/CompletionBar";
import Skeleton from "../motion/Skeleton";
import { fr } from "../strings/fr";

function texte(modele, valeurs) {
  return Object.entries(valeurs).reduce((label, [cle, valeur]) => label.replace(`{${cle}}`, String(valeur)), modele);
}

function dateInventaire(valeur) {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function InventoryHome() {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.user?.role);
  const canRead = hasPermission(role, "stock:read");
  const { depotId, list, detail, id } = useInventaireCourant();
  const [onglet, setOnglet] = useState("lieux");
  const [scanner, setScanner] = useState(false);
  const [masquer, setMasquer] = useState(lireMasque);
  const [erreur, setErreur] = useState("");
  const inventaire = detail.data;
  const aveugle = Boolean(inventaire?.modeAveugle);
  const lignes = (inventaire?.lignes || []).map((ligne) => vueLigne(ligne, { aveugle, masquer: aveugle || masquer }));
  const groupes = grouperParEmplacement(lignes);
  const total = progression(inventaire?.lignes || []);
  const aRecompter = (inventaire?.lignes || []).filter((ligne) => ligne.recomptageDemande);

  useEffect(() => {
    if (inventaire?.id) debutSession(`stokify-terrain-inventaire-session:${inventaire.id}`);
  }, [inventaire?.id]);

  async function ouvrirCode(raw) {
    setErreur("");
    const resolu = await resolveScan(raw, { depotId });
    if (resolu.kind !== "emplacement") {
      setErreur(fr.scanUnknown);
      return;
    }
    const groupe = groupes.find((item) => Number(item.id) === Number(resolu.data.id));
    if (!groupe) {
      setErreur(fr.inventoryPlaceMissing);
      return;
    }
    setScanner(false);
    navigate(`/terrain/inventaire/emplacement/${resolu.data.id}`);
  }

  if (!canRead) return <p className="px-4 py-6">{fr.inventoryForbidden}</p>;
  if (depotId == null) return <p className="px-4 py-6">{fr.chooseDepot}</p>;

  return (
    <motion.div className="flex flex-col gap-4 px-4 py-4 text-text-main" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.22 }}>
      <h1 className="text-2xl font-semibold">{fr.navInventory}</h1>
      {list.isLoading || detail.isLoading ? (
        <div role="status" aria-label={fr.listLoading} className="flex flex-col gap-3">
          <Skeleton className="terrain-skeleton-card" />
        </div>
      ) : null}
      {list.isError ? <p role="alert">{getAxiosErrorMessage(list.error)}</p> : null}
      {detail.isError ? <p role="alert">{getAxiosErrorMessage(detail.error)}</p> : null}
      {list.isSuccess && !id ? <p>{fr.inventoryEmpty}</p> : null}
      {inventaire ? (
        <>
          <header className="flex flex-col gap-2 rounded-2xl border border-border bg-card-bg p-4">
            <p className="text-lg font-semibold">{inventaire.reference}</p>
            <p>{fr.inventoryTypes[inventaire.typeInventaire] || inventaire.typeInventaire}</p>
            <p className="text-sm">{texte(fr.inventoryStarted, { date: dateInventaire(inventaire.date) })}</p>
            {aveugle ? <p className="text-sm font-semibold">{fr.inventoryBlind}</p> : null}
            <p>{texte(fr.inventoryProgress, total)}</p>
            <CompletionBar ratio={total.total ? total.done / total.total : 0} label={fillTemplate(fr.meterOf, { done: total.done, total: total.total })} />
            {aveugle ? null : (
              <label className="flex min-h-12 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={masquer}
                  onChange={(event) => {
                    setMasquer(event.target.checked);
                    ecrireMasque(event.target.checked);
                  }}
                />
                {fr.inventoryHideTheory}
              </label>
            )}
          </header>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={onglet === "lieux"} onClick={() => setOnglet("lieux")} className="min-h-12 rounded-2xl border border-border bg-card-bg text-sm font-semibold touch-manipulation">{fr.inventoryPlacesTab}</button>
            <button type="button" aria-pressed={onglet === "recompter"} onClick={() => setOnglet("recompter")} className="min-h-12 rounded-2xl border border-border bg-card-bg text-sm font-semibold touch-manipulation">{fr.inventoryRecountTab}</button>
          </div>
          <button type="button" onClick={() => setScanner(true)} className="inline-flex min-h-12 items-center justify-center rounded-2xl text-base font-semibold text-white touch-manipulation" style={{ background: "var(--accent-primary)" }}>{fr.placeScan}</button>
          {erreur ? <p role="alert">{erreur}</p> : null}
          {onglet === "lieux" ? groupes.map((groupe) => {
            const fait = progression(groupe.lignes);
            const cible = groupe.id == null ? "sans" : groupe.id;
            return (
              <Link key={cible} to={`/terrain/inventaire/emplacement/${cible}`} className="flex min-h-12 flex-col justify-center rounded-2xl border border-border bg-card-bg px-3 py-2 touch-manipulation">
                <span className="flex items-center justify-between gap-2">
                  <span>{groupe.id == null ? fr.inventoryNoPlace : groupe.code || groupe.libelle}</span>
                  <span className="terrain-mono">{fait.done}/{fait.total}</span>
                </span>
                <CompletionBar ratio={fait.total ? fait.done / fait.total : 0} label={fillTemplate(fr.meterOf, { done: fait.done, total: fait.total })} />
              </Link>
            );
          }) : aRecompter.map((ligne) => {
            const vu = vueLigne(ligne, { aveugle, masquer: true });
            const cible = vu.emplacementId ?? vu.emplacement?.id ?? "sans";
            return (
              <Link key={ligne.id} to={`/terrain/inventaire/emplacement/${cible}`} state={{ ligneId: ligne.id }} className="flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card-bg px-3 touch-manipulation">
                <span>{vu.article?.libelle || vu.article?.code}</span>
                <span>{fr.inventoryRecount}</span>
              </Link>
            );
          })}
        </>
      ) : null}
      {scanner ? <TerrainScanner elevated title={fr.placeScan} onClose={() => setScanner(false)} onDetected={ouvrirCode} /> : null}
    </motion.div>
  );
}
