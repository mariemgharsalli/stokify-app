import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  FileText,
  Hash,
  Loader2,
  Printer,
  User,
} from "lucide-react";
import api from "../../services/api";
import CommerceFormDrawer from "../../components/forms/CommerceFormDrawer";
import TierSearchSelect from "../../components/forms/TierSearchSelect";
import DepotSearchSelect from "../../components/forms/DepotSearchSelect";
import MiniCarteClient from "../../components/forms/MiniCarteClient";
import LignesVentePanel from "../../components/forms/LignesVentePanel";
import TotauxFooter from "../../components/forms/TotauxFooter";
import WizardStepPanel from "../../components/forms/WizardStepPanel";
import LockedDateField from "../../components/forms/LockedDateField";
import { FormGateBanner, FormLoadError, FormLoadingHint } from "../../components/forms/FormDataAlert";
import { btnPrimary, btnSecondary, inputClass, labelClass, selectClass, primaryButtonStyle } from "../../components/forms/formStyles";
import FormFieldError from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { venteStep1Schema, venteLignesSchema } from "../../validation";
import { useCommerceFormGate } from "../../hooks/useCommerceFormReady";
import { useCommerceReferenceData } from "../../hooks/useCommerceReferenceData";
import {
  articleFromRow,
  calcTotaux,
  calcTotalLigne,
  ligneToPayload,
  newLigneId,
  resolveModeTracage,
} from "../../utils/formHelpers";
import { formatDate, asItems } from "../../utils/commerceUi";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";
import { StatutBadgeVente } from "../../components/ui/StatutBadge";
import ConditionsPaiementPrevu from "../../components/forms/ConditionsPaiementPrevu";

const STEPS = [
  { key: "tier", label: "Client" },
  { key: "lignes", label: "Articles" },
  { key: "confirm", label: "Récapitulatif" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function VenteForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const formGate = useCommerceFormGate();
  const canWrite = hasPermission(user?.role, "ventes:write");

  const isCreate = location.pathname.endsWith("/new");
  const venteId = isCreate ? null : routeId ? Number(routeId) : null;

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState("forward");
  const [shakeBtn, setShakeBtn] = useState(false);
  const refData = useCommerceReferenceData("client", { loadArticles: step >= 2 });

  const [form, setForm] = useState({
    clientId: "",
    depotId: "",
    dateVente: todayISO(),
    dateLivraison: "",
    devise: "TND",
    remiseGlobale: 0,
    notes: "",
    modePaiement: "ESPECES",
    champsReglement: {},
  });
  const [client, setClient] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [statutInitial, setStatutInitial] = useState("BROUILLON");

  const step1Values = useMemo(
    () => ({
      clientId: form.clientId,
      depotId: form.depotId,
      dateVente: form.dateVente,
      dateLivraison: form.dateLivraison,
    }),
    [form.clientId, form.depotId, form.dateVente, form.dateLivraison]
  );
  const {
    errors: fieldErrors,
    validate: validateStep1Schema,
    isValid: step1Valid,
    clearError: clearStep1Error,
    setErrors: setFieldErrors,
  } = useFormValidation(venteStep1Schema, step1Values);

  const lignesValues = useMemo(() => ({ lignes }), [lignes]);
  const {
    errors: lignesErrors,
    validate: validateLignes,
    isValid: lignesValid,
  } = useFormValidation(venteLignesSchema, lignesValues);

  useEffect(() => {
    if (isCreate) {
      setForm((f) => ({ ...f, dateVente: todayISO() }));
    }
  }, [isCreate]);

  useEffect(() => {
    if (!refData.ready || societeScope == null || step >= 2) return;
    qc.prefetchQuery({
      queryKey: ["articles", "commerce-form", societeScope],
      queryFn: () => api.get("articles", { params: { limit: 500 } }).then((r) => r.data),
      staleTime: 5 * 60_000,
    });
  }, [refData.ready, societeScope, step, qc]);

  const { data: vente, isLoading } = useQuery({
    queryKey: ["vente", societeScope, venteId],
    queryFn: () => api.get(`ventes/${venteId}`).then((r) => r.data),
    enabled: Boolean(venteId),
  });

  const { data: clientStats } = useQuery({
    queryKey: ["client-stats", form.clientId],
    queryFn: () => api.get(`clients/${form.clientId}/stats`).then((r) => r.data),
    enabled: Boolean(form.clientId),
  });

  const clients = refData.tiers;
  const depots = refData.depots;
  const articles = refData.articles;
  const formDisabled = formGate.blocked || !refData.ready;
  const readonly = Boolean(vente && vente.statut !== "BROUILLON");
  const useWizard = isCreate || (vente && vente.statut === "BROUILLON");

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: String(c.id),
        label: `${c.code || ""} — ${c.nom}`.trim(),
        city: c.ville,
        raw: c,
      })),
    [clients]
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

  const margeGlobale = useMemo(() => {
    let rev = 0;
    let cost = 0;
    for (const l of lignes) {
      const ht = calcTotalLigne(l);
      const cmp = Number(l.article?.cmp ?? l.article?.prixAchat) || 0;
      rev += ht;
      cost += cmp * (Number(l.quantite) || 0);
    }
    return rev > 0 ? ((rev - cost) / rev) * 100 : 0;
  }, [lignes]);

  const articleIdsStock = useMemo(
    () => [...new Set(lignes.map((l) => l.article?.id).filter(Boolean))],
    [lignes]
  );

  const stockQueries = useQueries({
    queries: articleIdsStock.map((aid) => ({
      queryKey: ["stock-dispo", aid, form.depotId],
      queryFn: () =>
        api.get("stock/disponible", { params: { articleId: aid, depotId: form.depotId } }).then((r) => r.data),
      enabled: refData.ready && Boolean(form.depotId),
      staleTime: 15_000,
    })),
  });

  const stockByArticleId = useMemo(() => {
    const map = {};
    articleIdsStock.forEach((aid, i) => {
      const q = stockQueries[i];
      map[aid] = {
        disponible: q?.data?.disponible ?? q?.data?.quantite,
        loading: q?.isLoading,
      };
    });
    return map;
  }, [articleIdsStock, stockQueries]);

  const stockInsuffisant = useMemo(() => {
    return lignes.some((l) => {
      const d = stockByArticleId[l.article?.id]?.disponible;
      if (d == null) return false;
      return Number(l.quantite) > Number(d);
    });
  }, [lignes, stockByArticleId]);

  const lotArticleIds = useMemo(
    () =>
      [...new Set(lignes.filter((l) => {
        const mode = resolveModeTracage(l.article);
        return mode === "LOT" || mode === "LOT_SERIE";
      }).map((l) => l.article.id))],
    [lignes]
  );

  const lotQueries = useQueries({
    queries: lotArticleIds.map((aid) => {
      const mode = lignes.find((l) => l.article?.id === aid)?.article?.strategieSortie;
      return {
        queryKey: ["lots-vente", aid, form.depotId, mode],
        queryFn: () =>
          api
            .get("lots", { params: { articleId: aid, depotId: form.depotId, limit: 50 } })
            .then((r) => {
              const items = asItems(r.data).filter(
                (x) =>
                  Number(x.quantiteRestante) > 0 &&
                  String(x.statut || "ACTIF").toUpperCase() !== "DESACTIVE"
              );
              return [...items].sort((a, b) => {
                if (mode === "FEFO") {
                  const ea = a.dateExpiration ? new Date(a.dateExpiration).getTime() : Infinity;
                  const eb = b.dateExpiration ? new Date(b.dateExpiration).getTime() : Infinity;
                  return ea - eb;
                }
                const fa = a.dateFabrication ? new Date(a.dateFabrication).getTime() : 0;
                const fb = b.dateFabrication ? new Date(b.dateFabrication).getTime() : 0;
                return fa - fb;
              });
            }),
        enabled: refData.ready && Boolean(form.depotId),
      };
    }),
  });

  const lotsByArticleId = useMemo(() => {
    const map = {};
    lotArticleIds.forEach((aid, i) => {
      map[aid] = lotQueries[i]?.data || [];
    });
    return map;
  }, [lotArticleIds, lotQueries]);

  useEffect(() => {
    if (!vente) return;
    const brut = Number(vente.totalHT || 0) + Number(vente.remise || 0);
    setForm((f) => ({
      ...f,
      clientId: String(vente.clientId ?? ""),
      depotId: vente.depotId != null ? String(vente.depotId) : "",
      dateVente: vente.dateVente ? String(vente.dateVente).slice(0, 10) : todayISO(),
      dateLivraison: vente.dateLivraison ? String(vente.dateLivraison).slice(0, 10) : "",
      modePaiement: vente.modePaiement || "ESPECES",
      remiseGlobale: brut > 0 ? Number(((Number(vente.remise || 0) / brut) * 100).toFixed(2)) : 0,
    }));
    const cl = clients.find((c) => c.id === vente.clientId);
    if (cl) setClient(cl);
    setLignes(
      (vente.lignes || []).map((l) => ({
        id: newLigneId(),
        article: articleFromRow(l.article),
        quantite: l.quantite,
        prixUnitHT: l.prixUnit,
        remise:
          l.quantite * l.prixUnit > 0
            ? Number(((1 - Number(l.totalHT) / (l.quantite * l.prixUnit)) * 100).toFixed(2))
            : 0,
        tauxTVA: l.tauxTva ?? l.tauxTVA ?? 19,
        lotId: null,
      }))
    );
  }, [vente, clients]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const r = venteId ? await api.put(`ventes/${venteId}`, payload) : await api.post("ventes", payload);
      return r.data;
    },
    onSuccess: async (data) => {
      toast.success("Vente enregistrée en brouillon");
      qc.invalidateQueries({ queryKey: ["ventes"] });
      navigate(`/ventes/${data.id}`);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const validerMutation = useMutation({
    mutationFn: () => api.post(`ventes/${venteId}/valider`),
    onSuccess: () => {
      toast.success("Vente validée");
      navigate("/ventes");
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
        prixUnitHT: a.prixVente ?? 0,
        remise: 0,
        tauxTVA: a.tauxTva ?? a.tva ?? 19,
        lotId: null,
      },
    ]);
  }

  function updateLigne(id, field, value) {
    setLignes((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function handleSubmit() {
    if (!validateStep1() || !validateStep2()) return;
    const payload = {
      clientId: Number(form.clientId),
      depotId: Number(form.depotId),
      dateVente: isCreate ? todayISO() : form.dateVente,
      dateLivraison: form.dateLivraison || null,
      ...(form.modePaiement ? { modePaiement: form.modePaiement } : {}),
      remiseGlobale: Math.round(Number(totaux.remiseGlobale) * 100) / 100,
      lignes: lignes.map(ligneToPayload),
      statut: "BROUILLON",
    };
    saveMutation.mutate(payload);
  }

  const depotLabel = depots.find((d) => String(d.id) === form.depotId)?.libelle;

  const footer =
    step === 2 ? (
      <TotauxFooter
        totaux={totaux}
        margeGlobale={margeGlobale}
        backLabel="← Client"
        nextLabel="Confirmation →"
        onBack={() => goStep(1, "back")}
        onNext={() => {
          if (!validateStep2()) return;
          goStep(3);
        }}
        nextDisabled={!lignesValid}
      />
    ) : null;

  if (!isCreate && venteId && isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  if (!useWizard) {
    return (
      <CommerceFormDrawer
        title={`Vente ${vente?.reference || ""}`}
        subtitle="Consultation"
        onClose={() => navigate("/ventes")}
        accent="vente"
      >
        <div className="space-y-4">
          <StatutBadgeVente statut={vente?.statut} />
          <p className="text-sm text-[var(--text-secondary)]">
            {vente?.client?.nom} · {formatDate(vente?.dateVente)}
          </p>
          <p className="text-lg font-semibold text-[var(--accent-primary)]">{Number(vente?.totalTTC || 0).toFixed(3)} TND TTC</p>
          <div className="flex flex-wrap gap-2">
            {canWrite && ["BROUILLON", "EN_ATTENTE"].includes(vente?.statut) ? (
              <div>
                <button
                  type="button"
                  className={btnPrimary}
                  style={primaryButtonStyle}
                  disabled={stockInsuffisant || !canWrite || formDisabled || validerMutation.isPending}
                  onClick={() => validerMutation.mutate()}
                >
                  Valider
                </button>
                <AnimatePresence>
                  {stockInsuffisant ? (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-1 text-xs text-[var(--accent-danger,#f0556b)]"
                    >
                      Stock insuffisant sur au moins un article — ajustez les quantités ou le dépôt avant de valider.
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
            <button
              type="button"
              className={btnSecondary}
              onClick={async () => {
                const resp = await api.get(`ventes/${venteId}/facture/pdf`, { responseType: "blob" });
                const url = URL.createObjectURL(resp.data);
                window.open(url, "_blank");
              }}
            >
              <Printer className="mr-1 inline h-4 w-4" />
              Facture PDF
            </button>
          </div>
        </div>
      </CommerceFormDrawer>
    );
  }

  return (
    <CommerceFormDrawer
      title={isCreate ? "Nouvelle vente" : `Modifier ${vente?.reference || ""}`}
      subtitle={isCreate ? "Assistant de création" : "Brouillon"}
      steps={STEPS}
      currentStep={step}
      onClose={() => navigate("/ventes")}
      footer={footer}
      wide
      accent="vente"
    >
      <WizardStepPanel stepKey={step} direction={direction}>
        <FormGateBanner gate={formGate} />
        <FormLoadError message={refData.isError ? refData.errorMessage : null} onRetry={refData.refetchAll} />
        <FormLoadingHint show={refData.isLoadingCore && refData.ready} label="Chargement clients & dépôts…" />

        {step === 1 ? (
          <div className="space-y-6">
            <section>
              <label className={labelClass}>Client *</label>
              {!client ? (
                <TierSearchSelect
                  options={clientOptions}
                  value={form.clientId}
                  error={fieldErrors.clientId}
                  placeholder="Rechercher un client…"
                  loading={refData.isLoadingCore}
                  disabled={readonly || !canWrite || formDisabled}
                  onChange={(v, raw) => {
                    setForm((f) => ({ ...f, clientId: v }));
                    setClient(raw || clients.find((x) => String(x.id) === v));
                    clearStep1Error("clientId");
                  }}
                />
              ) : (
                <MiniCarteClient
                  client={client}
                  stats={{
                    caTotal: clientStats?.caAnnee,
                    nbVentes: clientStats?.nbVentes,
                    derniereVente: null,
                  }}
                  onChange={() => {
                    setClient(null);
                    setForm((f) => ({ ...f, clientId: "" }));
                  }}
                />
              )}
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LockedDateField
                label="Date vente *"
                value={form.dateVente}
                hint={isCreate ? "Date du jour — non modifiable" : "Date de la vente — non modifiable"}
                accent="vente"
              />
              <div>
                <label className={labelClass}>Date livraison</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.dateLivraison}
                  disabled={readonly}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, dateLivraison: e.target.value }));
                    clearStep1Error("dateLivraison");
                  }}
                />
                <FormFieldError message={fieldErrors.dateLivraison} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Dépôt de sortie stock *</label>
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
                    setFieldErrors((err) => ({ ...err, depotId: undefined }));
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
                </select>
              </div>
            </section>

            <div className="flex justify-between">
              <button type="button" className={btnSecondary} onClick={() => navigate("/ventes")}>
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
            <LignesVentePanel
            lignes={lignes}
            totaux={totaux}
            margeGlobale={margeGlobale}
            articles={articles}
            readonly={readonly}
            canWrite={canWrite}
            formDisabled={formDisabled}
            remiseGlobale={form.remiseGlobale}
            onRemiseGlobaleChange={(v) => setForm((f) => ({ ...f, remiseGlobale: v }))}
            stockInsuffisant={stockInsuffisant}
            stockByArticleId={stockByArticleId}
            lotsByArticleId={lotsByArticleId}
            onAdd={addArticle}
            onUpdate={updateLigne}
            onRemove={(id) => setLignes((rows) => rows.filter((r) => r.id !== id))}
            onLotSelect={(id, lotId) => updateLigne(id, "lotId", lotId)}
          />
          </>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5 pb-4">
            <ConditionsPaiementPrevu variant="vente" form={form} setForm={setForm} />

            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>{client?.nom}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>{depotLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>{formatDate(form.dateVente)}</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-[var(--accent-primary)]">
                  {totaux.ttc} TND TTC
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Enregistrer comme</label>
              <div
                className="mt-2 rounded-xl border p-3"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent-warning) 45%, var(--border-default))",
                  background: "color-mix(in srgb, var(--accent-warning) 10%, transparent)",
                }}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-warning)]">
                  <FileText className="h-4 w-4" />
                  Brouillon — la référence sera générée automatiquement (VTE-AAAA-XXXX)
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Confirmez la vente depuis la page détail pour sortir le stock et émettre la facture.
                </p>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <button type="button" className={btnSecondary} onClick={() => goStep(2, "back")}>
                ← Articles
              </button>
              <div className="flex gap-2">
                <button type="button" className={btnSecondary} onClick={() => navigate("/ventes")}>
                  Annuler
                </button>
                <button
                  type="button"
                  className={`${btnPrimary} min-w-[160px]`}
                  style={primaryButtonStyle}
                  disabled={saveMutation.isPending || !canWrite}
                  onClick={handleSubmit}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1 inline h-4 w-4" />
                  )}
                  Enregistrer le brouillon
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </WizardStepPanel>
    </CommerceFormDrawer>
  );
}
