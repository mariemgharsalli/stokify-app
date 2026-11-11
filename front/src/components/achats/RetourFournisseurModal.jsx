import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileDown, Loader2, PackageMinus, X } from "lucide-react";
import api from "../../services/api";
import SearchableSelect from "../ui/SearchableSelect";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { downloadBonRetourPdf } from "../../utils/downloadBonRetour";

const ACCENT = "#E24B4A";

function parseLotsConsumed(payload) {
  const raw = payload?.lotsConsumed || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => ({
    lotId: l.lotId ?? l.id,
    numero: l.numero || l.lotNumero || `#${l.lotId ?? l.id}`,
    quantite: Number(l.quantite ?? l.qte ?? 0),
  }));
}

export default function RetourFournisseurModal({ open, onClose, achat }) {
  const qc = useQueryClient();
  const toast = useToast();
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState("form");
  const [articleId, setArticleId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");
  const [error, setError] = useState("");
  const [lotsConsumed, setLotsConsumed] = useState([]);
  const [issued, setIssued] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const fournisseurId = achat?.fournisseurId ?? achat?.fournisseur?.id;
  const fournisseurNom = achat?.fournisseur?.nom || "—";
  const lignes = achat?.lignes || [];

  const articleOptions = useMemo(
    () =>
      lignes.map((l) => ({
        value: String(l.articleId ?? l.article?.id),
        label: `${l.article?.code || "?"} — ${l.article?.libelle || "Article"}`,
        ligne: l,
      })),
    [lignes]
  );

  const selectedLigne = useMemo(
    () => articleOptions.find((o) => o.value === String(articleId))?.ligne,
    [articleOptions, articleId]
  );
  const selectedArticle = selectedLigne?.article;

  const { data: stockData } = useQuery({
    queryKey: ["stock-dispo-retour", societeScope, articleId, depotId],
    queryFn: () =>
      api
        .get("stock/disponible", { params: { articleId, depotId } })
        .then((r) => r.data),
    enabled: open && Boolean(articleId) && Boolean(depotId),
  });

  const { data: depotsData } = useQuery({
    queryKey: ["depots-dd", societeScope],
    queryFn: () => api.get("depots", { params: { limit: 200, statut: "ACTIF" } }).then((r) => r.data),
    enabled: open,
  });

  const depots = Array.isArray(depotsData) ? depotsData : depotsData?.items || [];
  const depotOptions = useMemo(
    () => depots.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.libelle}` })),
    [depots]
  );

  const maxQty = Number(stockData?.disponible ?? stockData?.quantite ?? 0) || 0;
  const depotLabel = useMemo(() => {
    const d = depots.find((x) => String(x.id) === String(depotId));
    return d ? `${d.code} — ${d.libelle}` : "—";
  }, [depots, depotId]);

  useEffect(() => {
    if (!open || !achat) return;
    setStep("form");
    setArticleId(lignes[0] ? String(lignes[0].articleId ?? lignes[0].article?.id) : "");
    setDepotId(achat.depotId ? String(achat.depotId) : "");
    setQuantite("");
    setMotif("");
    setError("");
    setLotsConsumed([]);
    setIssued(null);
    setPdfLoading(false);
    // Réinitialise à l'ouverture seulement : un refetch de la commande ne doit pas
    // effacer l'écran « bon de retour » après confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, achat?.id]);

  const createRetour = useMutation({
    mutationFn: (payload) => api.post("achats/retours-fournisseur", payload).then((r) => r.data),
    onSuccess: (data) => {
      setLotsConsumed(parseLotsConsumed(data));
      setIssued({
        id: data?.retour?.id,
        reference: data?.retour?.reference,
      });
      toast.success("Bon de retour émis.");
      qc.invalidateQueries({ queryKey: ["stock"], exact: false });
      qc.invalidateQueries({ queryKey: ["mouvements"], exact: false });
      qc.invalidateQueries({ queryKey: ["lots"], exact: false });
      qc.invalidateQueries({ queryKey: ["achat"], exact: false });
      qc.invalidateQueries({ queryKey: ["retours-fournisseur"], exact: false });
      setStep("success");
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || e.message);
      setError(e.response?.data?.message || e.message);
    },
  });

  function goToReview(e) {
    e.preventDefault();
    const q = Number(quantite);
    if (!articleId || !depotId) {
      setError("Article et dépôt obligatoires.");
      return;
    }
    if (!(q > 0)) {
      setError("Quantité invalide.");
      return;
    }
    if (q > maxQty + 1e-9) {
      setError(`Quantité maximale : ${maxQty.toLocaleString("fr-FR")}.`);
      return;
    }
    if (!motif.trim()) {
      setError("Le motif est obligatoire.");
      return;
    }
    setError("");
    setStep("review");
  }

  async function downloadIssued() {
    if (!issued?.id) return;
    setPdfLoading(true);
    try {
      await downloadBonRetourPdf(issued.id, issued.reference);
      toast.success("Bon de retour téléchargé.");
    } catch (e) {
      toast.error(e.message || "Impossible de télécharger le bon de retour");
    } finally {
      setPdfLoading(false);
    }
  }

  function confirmRetour() {
    createRetour.mutate({
      fournisseurId: Number(fournisseurId),
      articleId: Number(articleId),
      depotId: Number(depotId),
      quantite: Number(quantite),
      motif: motif.trim(),
      achatId: achat?.id ? Number(achat.id) : undefined,
    });
  }

  if (!open || !achat) return null;

  const slide = {
    initial: reduceMotion ? false : { opacity: 0, x: 28 },
    animate: { opacity: 1, x: 0 },
    exit: reduceMotion ? undefined : { opacity: 0, x: -28 },
    transition: { duration: 0.22 },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-modal)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="retour-fournisseur-title"
        initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28 }}
      >
        <div className="border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                Retour fournisseur
              </p>
              <h2
                id="retour-fournisseur-title"
                className="mt-0.5 text-base font-semibold text-[var(--text-primary)]"
              >
                {step === "review"
                  ? "Vérifiez le retour"
                  : step === "success"
                    ? "Bon de retour émis"
                    : "Signaler un retour"}
              </h2>
              {step === "form" ? (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Fournisseur : <span className="font-medium text-[var(--text-secondary)]">{fournisseurNom}</span>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {step === "form" ? (
              <motion.form key="form" {...slide} onSubmit={goToReview} className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Article <span className="text-[#E24B4A]">*</span>
                  </label>
                  <SearchableSelect
                    value={articleId}
                    onChange={(v) => {
                      setArticleId(v);
                      setQuantite("");
                      setError("");
                    }}
                    options={articleOptions}
                    placeholder="Choisir un article…"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Dépôt <span className="text-[#E24B4A]">*</span>
                  </label>
                  <SearchableSelect
                    value={depotId}
                    onChange={(v) => {
                      setDepotId(v);
                      setQuantite("");
                      setError("");
                    }}
                    options={depotOptions}
                    placeholder="Choisir un dépôt…"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Quantité <span className="text-[#E24B4A]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0.001}
                      max={maxQty || undefined}
                      step="any"
                      value={quantite}
                      onChange={(e) => {
                        setQuantite(e.target.value);
                        setError("");
                      }}
                      className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm tabular-nums text-[var(--text-primary)] focus:border-[#E24B4A] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantite(String(maxQty))}
                      disabled={!(maxQty > 0)}
                      className="shrink-0 rounded-lg border border-[var(--border-default)] px-3 text-xs font-semibold text-[#E24B4A] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                    >
                      Max
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Max. {maxQty.toLocaleString("fr-FR")} disponible
                    {selectedArticle?.unite ? ` ${selectedArticle.unite}` : ""}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                    Motif <span className="text-[#E24B4A]">*</span>
                  </label>
                  <textarea
                    value={motif}
                    onChange={(e) => {
                      setMotif(e.target.value);
                      setError("");
                    }}
                    rows={3}
                    placeholder="Ex. : marchandise défectueuse, non-conformité…"
                    className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#E24B4A] focus:outline-none"
                  />
                </div>

                {error ? <p className="text-xs text-[#E24B4A]">{error}</p> : null}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, #C73E3E)`,
                      boxShadow: "0 8px 18px -8px rgba(226,75,74,0.55)",
                    }}
                  >
                    Continuer
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.form>
            ) : null}

            {step === "review" ? (
              <motion.div key="review" {...slide} className="space-y-4">
                <div
                  className="rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor: `color-mix(in srgb, ${ACCENT} 35%, var(--border-default))`,
                    background: `color-mix(in srgb, ${ACCENT} 8%, var(--bg-card))`,
                  }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <PackageMinus className="h-5 w-5" style={{ color: ACCENT }} />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Récapitulatif</p>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-muted)]">Fournisseur</dt>
                      <dd className="font-medium text-[var(--text-primary)]">{fournisseurNom}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-muted)]">Article</dt>
                      <dd className="text-right font-medium text-[var(--text-primary)]">
                        <span className="font-mono text-[#378ADD]">{selectedArticle?.code}</span>
                        <br />
                        {selectedArticle?.libelle}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-muted)]">Dépôt</dt>
                      <dd className="font-medium text-[var(--text-primary)]">{depotLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-muted)]">Quantité</dt>
                      <dd className="font-semibold tabular-nums" style={{ color: ACCENT }}>
                        {Number(quantite).toLocaleString("fr-FR")}
                        {selectedArticle?.unite ? ` ${selectedArticle.unite}` : ""}
                      </dd>
                    </div>
                    <div className="border-t border-[var(--border-default)] pt-2">
                      <dt className="mb-1 text-[var(--text-muted)]">Motif</dt>
                      <dd className="text-[var(--text-secondary)]">{motif.trim()}</dd>
                    </div>
                  </dl>
                </div>

                {error ? <p className="text-xs text-[#E24B4A]">{error}</p> : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={createRetour.isPending}
                    onClick={confirmRetour}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, #C73E3E)`,
                      boxShadow: "0 8px 18px -8px rgba(226,75,74,0.55)",
                    }}
                  >
                    {createRetour.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Envoi…
                      </>
                    ) : (
                      "Confirmer le retour"
                    )}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === "success" ? (
              <motion.div key="success" {...slide} className="space-y-4">
                <div className="flex items-start gap-3">
                  <motion.div
                    initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  >
                    <CheckCircle2 className="h-10 w-10" style={{ color: "#1D9E75" }} aria-hidden />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[var(--text-primary)]">Retour enregistré</p>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      {Number(quantite).toLocaleString("fr-FR")}
                      {selectedArticle?.unite ? ` ${selectedArticle.unite}` : ""} —{" "}
                      {selectedArticle?.libelle || "article"}
                    </p>
                  </div>
                </div>

                <div
                  className="rounded-xl border px-4 py-3.5"
                  style={{
                    borderColor: "color-mix(in srgb, #1D9E75 35%, var(--border-default))",
                    background: "color-mix(in srgb, #1D9E75 8%, var(--bg-card))",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1D9E75]">
                        Document à joindre au colis
                      </p>
                      <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {issued?.reference || "Bon de retour"}
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                      En attente
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    Fournisseur, article, quantité, dépôt, motif
                    {lotsConsumed.length ? ", lots" : ""} et lien avec la commande d&apos;origine.
                  </p>
                  {lotsConsumed.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t border-[var(--border-default)] pt-2">
                      {lotsConsumed.map((l) => (
                        <li
                          key={l.lotId || l.numero}
                          className="flex justify-between text-xs text-[var(--text-secondary)]"
                        >
                          <span className="font-mono">{l.numero}</span>
                          <span className="tabular-nums">−{l.quantite.toLocaleString("fr-FR")}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    disabled={!issued?.id || pdfLoading}
                    onClick={downloadIssued}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #1D9E75, #157A5C)",
                      boxShadow: "0 8px 18px -8px rgba(29,158,117,0.55)",
                    }}
                  >
                    {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Télécharger le bon
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
