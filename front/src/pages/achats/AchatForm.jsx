import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { IconBuilding, IconCalendar, IconCheck, IconLoader2, IconPackage, IconTruck } from "@tabler/icons-react";
import api from "../../services/api";
import CommerceFormDrawer from "../../components/forms/CommerceFormDrawer";
import TierSearchSelect from "../../components/forms/TierSearchSelect";
import DepotSearchSelect from "../../components/forms/DepotSearchSelect";
import MiniCarteFournisseur from "../../components/forms/MiniCarteFournisseur";
import LignesAchatPanel from "../../components/forms/LignesAchatPanel";
import TotauxFooter from "../../components/forms/TotauxFooter";
import WizardStepPanel from "../../components/forms/WizardStepPanel";
import LockedDateField from "../../components/forms/LockedDateField";
import { FormGateBanner, FormLoadError, FormLoadingHint } from "../../components/forms/FormDataAlert";
import { btnPrimary, btnSecondary, inputClass, labelClass, selectClass, primaryButtonStyle } from "../../components/forms/formStyles";
import FormFieldError from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { achatStep1Schema, achatLignesSchema } from "../../validation";
import { useCommerceFormGate } from "../../hooks/useCommerceFormReady";
import { useCommerceReferenceData } from "../../hooks/useCommerceReferenceData";
import { articleFromRow, calcTotaux, ligneToPayload, newLigneId } from "../../utils/formHelpers";
import { formatDate } from "../../utils/commerceUi";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import ConditionsPaiementPrevu from "../../components/forms/ConditionsPaiementPrevu";

const STEPS = [
  { key: "tier", label: "Fournisseur & dépôt" },
  { key: "lignes", label: "Articles" },
  { key: "confirm", label: "Confirmation" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AchatForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const formGate = useCommerceFormGate();
  const canWrite = hasPermission(user?.role, "achats:write");

  const isCreate = location.pathname.endsWith("/new");
  const achatId = isCreate ? null : routeId ? Number(routeId) : null;

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("forward");
  const [shakeBtn, setShakeBtn] = useState(false);
  const refData = useCommerceReferenceData("fournisseur", { loadArticles: step >= 2 });

  const [form, setForm] = useState({
    fournisseurId: "",
    depotId: "",
    dateCommande: todayISO(),
    dateLivraisonPrevue: "",
    devise: "TND",
    modePaiement: "ESPECES",
    champsReglement: {},
    echeancePaiement: "",
    conditionsPaiement: "",
    remiseGlobale: 0,
    notes: "",
  });
  const [fournisseur, setFournisseur] = useState(null);
  const [lignes, setLignes] = useState([]);

  const step1Values = useMemo(
    () => ({
      fournisseurId: form.fournisseurId,
      depotId: form.depotId,
      dateCommande: form.dateCommande,
      dateLivraisonPrevue: form.dateLivraisonPrevue,
    }),
    [form.fournisseurId, form.depotId, form.dateCommande, form.dateLivraisonPrevue]
  );
  const {
    errors: fieldErrors,
    validate: validateStep1Schema,
    isValid: step1Valid,
    clearError: clearStep1Error,
  } = useFormValidation(achatStep1Schema, step1Values);

  const lignesValues = useMemo(() => ({ lignes }), [lignes]);
  const {
    errors: lignesErrors,
    validate: validateLignes,
    isValid: lignesValid,
  } = useFormValidation(achatLignesSchema, lignesValues);

  useEffect(() => {
    if (isCreate) {
      setForm((f) => ({ ...f, dateCommande: todayISO() }));
    }
  }, [isCreate]);

  // Prefetch articles en arrière-plan dès que l'étape 1 est utilisable
  useEffect(() => {
    if (!refData.ready || societeScope == null || step >= 2) return;
    qc.prefetchQuery({
      queryKey: ["articles", "commerce-form", societeScope],
      queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
      staleTime: 5 * 60_000,
    });
  }, [refData.ready, societeScope, step, qc]);

  const { data: achat, isLoading } = useQuery({
    queryKey: ["achat", societeScope, achatId],
    queryFn: () => api.get(`achats/${achatId}`).then((r) => r.data),
    enabled: Boolean(achatId),
  });

  const { data: fournisseurStats } = useQuery({
    queryKey: ["fournisseur-stats", form.fournisseurId],
    queryFn: () => api.get(`fournisseurs/${form.fournisseurId}/stats`).then((r) => r.data),
    enabled: Boolean(form.fournisseurId),
  });

  const fournisseurs = refData.tiers;
  const depots = refData.depots;
  const articles = refData.articles;
  const formDisabled = formGate.blocked || !refData.ready;
  const readonly = Boolean(achat && achat.statut !== "BROUILLON");

  useEffect(() => {
    if (achat && achat.statut !== "BROUILLON") {
      navigate(`/achats/${achat.id}`, { replace: true });
    }
  }, [achat, navigate]);

  const fournisseurOptions = useMemo(
    () =>
      fournisseurs.map((f) => ({
        value: String(f.id),
        label: `${f.code || ""} — ${f.nom}`.trim(),
        meta: f.ville,
        city: f.ville,
        raw: f,
      })),
    [fournisseurs]
  );

  const depotOptions = useMemo(
    () =>
      depots.map((d) => ({
        value: String(d.id),
        label: `${d.code || ""} — ${d.libelle || d.code}`.trim(),
        meta: [d.ville, d.region].filter(Boolean).join(", "),
        code: d.code,
        raw: d,
      })),
    [depots]
  );

  const totaux = useMemo(() => calcTotaux(lignes, form.remiseGlobale), [lignes, form.remiseGlobale]);

  useEffect(() => {
    if (!achat) return;
    const brutHT = Number(achat.totalHT || 0) + Number(achat.remise || 0);
    setForm((f) => ({
      ...f,
      fournisseurId: String(achat.fournisseurId ?? ""),
      depotId: achat.depotId != null ? String(achat.depotId) : "",
      dateCommande: achat.dateCommande ? String(achat.dateCommande).slice(0, 10) : todayISO(),
      dateLivraisonPrevue: achat.dateLivraisonPrevue ? String(achat.dateLivraisonPrevue).slice(0, 10) : "",
      remiseGlobale: brutHT > 0 ? Number(((Number(achat.remise || 0) / brutHT) * 100).toFixed(2)) : 0,
    }));
    const fl = refData.tiers.find((x) => x.id === achat.fournisseurId) || fournisseurs.find((x) => x.id === achat.fournisseurId);
    if (fl) setFournisseur(fl);
    setLignes(
      (achat.lignes || []).map((l) => ({
        id: newLigneId(),
        article: articleFromRow(l.article),
        quantite: l.quantite,
        prixUnitHT: l.prixUnit,
        remise:
          l.quantite * l.prixUnit > 0
            ? Number(((1 - Number(l.totalHT) / (l.quantite * l.prixUnit)) * 100).toFixed(2))
            : 0,
        tauxTVA: 19,
        dateExpiration: l.dateExpiration ? String(l.dateExpiration).slice(0, 10) : "",
      }))
    );
  }, [achat, refData.tiers, fournisseurs]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const r = achatId ? await api.put(`achats/${achatId}`, payload) : await api.post("achats", payload);
      return r.data;
    },
    onSuccess: (data) => {
      toast.success(isCreate ? "Brouillon créé — référence générée automatiquement" : "Brouillon enregistré");
      qc.invalidateQueries({ queryKey: ["achats"] });
      if (data?.id) navigate(`/achats/${data.id}`, { replace: true });
      else navigate("/achats");
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function goStep(next, dir = "forward") {
    setDirection(dir);
    setStep(next);
  }

  function validateStep1() {
    const ok = validateStep1Schema();
    if (!ok) {
      setShakeBtn(true);
      setTimeout(() => setShakeBtn(false), 320);
      return false;
    }
    return true;
  }

  function validateStep2() {
    const ok = validateLignes();
    if (!ok) {
      toast.error("Corrigez les lignes d'articles (quantité, prix, article)");
      return false;
    }
    return true;
  }

  function addArticle(art) {
    const a = articleFromRow(art);
    if (!a) return;
    if (lignes.some((l) => l.article?.id === a.id)) {
      toast.error("Article déjà dans la liste");
      return;
    }
    setLignes((rows) => [
      ...rows,
      {
        id: newLigneId(),
        article: a,
        quantite: 1,
        prixUnitHT: a.prixAchat ?? 0,
        remise: 0,
        tauxTVA: a.tva ?? 19,
        dateExpiration: "",
      },
    ]);
  }

  function updateLigne(id, field, value) {
    setLignes((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function handleSubmit() {
    if (!validateStep1() || !validateStep2()) return;
    const noteLines = [form.notes?.trim()].filter(Boolean);
    if (form.modePaiement) noteLines.push(`Mode paiement prévu : ${form.modePaiement}`);
    const cr = form.champsReglement || {};
    Object.entries(cr).forEach(([k, v]) => {
      if (v) noteLines.push(`${k}: ${v}`);
    });
    if (form.echeancePaiement) noteLines.push(`Échéance paiement : ${form.echeancePaiement}`);
    if (form.conditionsPaiement) noteLines.push(`Conditions : ${form.conditionsPaiement}`);

    const payload = {
      fournisseurId: Number(form.fournisseurId),
      depotId: Number(form.depotId),
      dateCommande: isCreate ? todayISO() : form.dateCommande,
      dateLivraisonPrevue: form.dateLivraisonPrevue || null,
      remiseGlobale: Math.round(Number(totaux.remiseGlobale) * 100) / 100,
      lignes: lignes.map(ligneToPayload),
      statut: "BROUILLON",
    };
    if (noteLines.length) payload.notes = noteLines.join("\n");
    saveMutation.mutate(payload);
  }

  const depotLabel = depots.find((d) => String(d.id) === form.depotId)?.libelle;

  const footer =
    step === 2 ? (
      <TotauxFooter
        totaux={totaux}
        backLabel="← Fournisseur"
        nextLabel="Confirmation →"
        onBack={() => goStep(1, "back")}
        onNext={() => {
          if (!validateStep2()) return;
          goStep(3);
        }}
        nextDisabled={!lignesValid}
      />
    ) : null;

  if (!isCreate && achatId && isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--text-muted)]">
        <IconLoader2 size={20} className="mr-2 animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <CommerceFormDrawer
      title={isCreate ? "Nouvel achat" : `Modifier ${achat?.reference || ""}`}
      subtitle={isCreate ? "La référence sera générée automatiquement" : "Brouillon"}
      steps={STEPS}
      currentStep={step}
      onClose={() => navigate("/achats")}
      footer={footer}
      wide
      accent="achat"
    >
      <WizardStepPanel stepKey={step} direction={direction}>
        <FormGateBanner gate={formGate} />
        <FormLoadError message={refData.isError ? refData.errorMessage : null} onRetry={refData.refetchAll} />
        <FormLoadingHint show={refData.isLoadingCore && refData.ready} label="Chargement fournisseurs & dépôts…" />

        {step === 1 ? (
          <div className="space-y-6">
            <section>
              <label className={labelClass}>Fournisseur *</label>
              {!fournisseur ? (
                <TierSearchSelect
                  options={fournisseurOptions}
                  value={form.fournisseurId}
                  error={fieldErrors.fournisseurId}
                  placeholder="Rechercher un fournisseur…"
                  loading={refData.isLoadingCore}
                  disabled={readonly || !canWrite || formDisabled}
                  onChange={(v, raw) => {
                    setForm((f) => ({ ...f, fournisseurId: v }));
                    setFournisseur(raw || fournisseurs.find((x) => String(x.id) === v));
                    clearStep1Error("fournisseurId");
                  }}
                  renderOption={(o) => (
                    <span>
                      <strong>{o.raw?.nom}</strong>
                      {o.city ? <span className="text-[var(--text-muted)]"> · {o.city}</span> : null}
                    </span>
                  )}
                />
              ) : (
                <MiniCarteFournisseur
                  fournisseur={fournisseur}
                  stats={{
                    dernierAchat: fournisseurStats?.derniersAchats?.[0]?.dateCommande,
                    totalAchats: fournisseurStats?.totalAchatsTTC,
                  }}
                  onChange={() => {
                    setFournisseur(null);
                    setForm((f) => ({ ...f, fournisseurId: "" }));
                  }}
                />
              )}
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LockedDateField
                label="Date commande *"
                value={form.dateCommande}
                hint={isCreate ? "Date du jour — non modifiable" : "Date de la commande — non modifiable"}
                accent="achat"
              />
              <div>
                <label className={labelClass}>Livraison prévue</label>
                <input
                  type="date"
                  className={inputClass}
                  disabled={readonly}
                  value={form.dateLivraisonPrevue}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, dateLivraisonPrevue: e.target.value }));
                    clearStep1Error("dateLivraisonPrevue");
                  }}
                />
                <FormFieldError message={fieldErrors.dateLivraisonPrevue} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Dépôt de réception *</label>
                <DepotSearchSelect
                  options={depotOptions}
                  value={form.depotId}
                  error={fieldErrors.depotId}
                  loading={refData.isLoadingCore}
                  disabled={readonly || formDisabled}
                  placeholder="Rechercher par nom, code ou ville…"
                  onChange={(v) => {
                    setForm((f) => ({ ...f, depotId: v }));
                    clearStep1Error("depotId");
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Devise</label>
                <select
                  className={selectClass}
                  value={form.devise}
                  onChange={(e) => setForm((f) => ({ ...f, devise: e.target.value }))}
                >
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </section>

            <div className="flex justify-between pt-2">
              <button type="button" className={btnSecondary} onClick={() => navigate("/achats")}>
                Annuler
              </button>
              <button
                type="button"
                className={`${btnPrimary} ${shakeBtn ? "btn-shake" : ""}`}
                style={primaryButtonStyle}
                disabled={!step1Valid}
                onClick={() => validateStep1() && goStep(2)}
              >
                Continuer → Articles
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <>
            <FormLoadingHint show={refData.isLoadingArticles} label="Chargement des articles…" />
            {(lignesErrors.lignes || Object.keys(lignesErrors).some((k) => k.startsWith("lignes."))) && (
              <FormFieldError
                message={
                  lignesErrors.lignes ||
                  Object.entries(lignesErrors).find(([k]) => k.startsWith("lignes."))?.[1]
                }
              />
            )}
            <LignesAchatPanel
            lignes={lignes}
            totaux={totaux}
            articles={articles}
            readonly={readonly}
            canWrite={canWrite}
            formDisabled={formDisabled}
            onAdd={addArticle}
            onUpdate={updateLigne}
            onRemove={(id) => setLignes((rows) => rows.filter((r) => r.id !== id))}
          />
          </>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5 pb-4">
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { Icon: IconBuilding, label: "Fournisseur", value: fournisseur?.nom },
                  { Icon: IconPackage, label: "Dépôt", value: depotLabel },
                  { Icon: IconCalendar, label: "Date commande", value: formatDate(form.dateCommande) },
                  { Icon: IconTruck, label: "Livraison prévue", value: formatDate(form.dateLivraisonPrevue) },
                  { Icon: IconPackage, label: "Nb articles", value: `${lignes.length} références` },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)]">
                      <r.Icon size={16} className="text-[var(--accent-primary)]" stroke={1.75} />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">{r.label}</p>
                      <p className="text-sm font-medium">{r.value || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
              {isCreate ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  La référence sera attribuée automatiquement à l'enregistrement.
                </p>
              ) : achat?.reference ? (
                <p className="mt-3 font-mono text-sm text-[var(--text-link)]">{achat.reference}</p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--border-default)] text-xs">
              {lignes.map((l, i) => (
                <div
                  key={l.id}
                  className="grid grid-cols-5 gap-2 border-b border-[var(--border-default)]/50 px-3 py-2"
                  style={{ background: i % 2 ? "var(--bg-hover)" : "transparent" }}
                >
                  <span className="col-span-2 truncate">{l.article?.libelle}</span>
                  <span className="text-right">{l.quantite}</span>
                  <span className="text-right">{Number(l.prixUnitHT).toFixed(3)}</span>
                  <span className="text-right font-medium">
                    {(Number(l.quantite) * Number(l.prixUnitHT) * (1 - (Number(l.remise) || 0) / 100)).toFixed(3)}
                  </span>
                </div>
              ))}
            </div>

            <ConditionsPaiementPrevu variant="achat" form={form} setForm={setForm} />

            <div>
              <label className={labelClass}>Notes internes</label>
              <textarea
                rows={3}
                className={`${inputClass} resize-y`}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Instructions de livraison…"
              />
            </div>

            <div
              className="rounded-xl border p-5"
              style={{
                borderColor: "rgba(29,158,117,0.25)",
                background: "linear-gradient(135deg, rgba(29,158,117,0.06), rgba(55,138,221,0.06))",
              }}
            >
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Total HT</span>
                  <span>{totaux.ht} TND</span>
                </div>
                {Number(totaux.remiseGlobale) > 0 ? (
                  <div className="flex justify-between" style={{ color: "var(--commerce-success)" }}>
                    <span>Remises</span>
                    <span>- {totaux.remiseGlobale} TND</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">TVA</span>
                  <span>{totaux.tva} TND</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-default)] pt-3 text-base font-medium">
                  <span>Total TTC</span>
                  <span className="text-xl" style={{ color: "var(--commerce-success)" }}>
                    {totaux.ttc} TND
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button type="button" className={btnSecondary} onClick={() => goStep(2, "back")}>
                ← Articles
              </button>
              <div className="flex gap-2">
                <button type="button" className={btnSecondary} onClick={() => navigate("/achats")}>
                  Annuler
                </button>
                <button
                  type="button"
                  className={`${btnPrimary} min-w-[180px]`}
                  style={primaryButtonStyle}
                  disabled={saveMutation.isPending || !canWrite}
                  onClick={handleSubmit}
                >
                  {saveMutation.isPending ? (
                    <>
                      <IconLoader2 size={16} className="mr-1 inline animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <IconCheck size={16} className="mr-1 inline" stroke={2} />
                      Enregistrer le brouillon
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </WizardStepPanel>
    </CommerceFormDrawer>
  );
}
