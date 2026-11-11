import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBuildingStore,
  IconCalendar,
  IconCash,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconFileInvoice,
  IconLoader2,
  IconMail,
  IconMapPin,
  IconPackage,
  IconPencil,
  IconReceiptRefund,
  IconShoppingBag,
  IconTruck,
} from "@tabler/icons-react";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import NumberCounter from "../../components/ui/NumberCounter";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Modal from "../../components/ui/Modal";
import ModalReglementVente from "../../components/ventes/ModalReglementVente";
import { formatDate, num3, initials, hashColor } from "../../utils/commerceUi";
import {
  STRATEGIE_COLORS,
  STATUTS_VENTE,
  isVenteConfirmee,
  normalizeStatutVente,
} from "../../constants/statuts";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

function freshnessColor(dateExpiration) {
  if (!dateExpiration) return "var(--accent-success)";
  const days = Math.ceil((new Date(dateExpiration) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "var(--accent-danger)";
  if (days <= 60) return "var(--accent-warning)";
  return "var(--accent-success)";
}

function StatutBadge({ statut }) {
  const key = normalizeStatutVente(statut);
  const cfg = STATUTS_VENTE[key] || STATUTS_VENTE.BROUILLON;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.pulse ? "animate-pulse" : ""}`}
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}
    >
      <Icon size={14} stroke={2} />
      {cfg.label}
    </span>
  );
}

function StrategyBadge({ strategie, article, confirme }) {
  const s = String(
    strategie || article?.strategieSortie || article?.modeGestion || "STANDARD"
  ).toUpperCase();
  const cfg = STRATEGIE_COLORS[s] || STRATEGIE_COLORS.STANDARD;
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
      {confirme && s !== "—" ? " (appliqué automatiquement)" : ""}
    </span>
  );
}

function parseLots(ligne) {
  if (!ligne?.lotsConsumed) return [];
  try {
    return JSON.parse(ligne.lotsConsumed);
  } catch {
    return [];
  }
}

function ArticleRow({ ligne, index, confirme }) {
  const art = ligne.article || {};
  const lineTotal = Number(ligne.totalHT || ligne.quantite * ligne.prixUnit);
  const lots = parseLots(ligne);

  return (
    <tr
      className="vente-row-fade border-b border-[var(--border-default)] transition-all duration-150 hover:border-l-[3px] hover:bg-[var(--bg-hover)]"
      style={{ animationDelay: `${index * 60}ms`, borderLeftColor: "var(--accent-success)" }}
    >
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          {art.imageUrl ? (
            <img
              src={art.imageUrl}
              alt=""
              className="h-[52px] w-[52px] shrink-0 rounded-lg border border-[var(--border-default)] object-cover"
            />
          ) : (
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)]">
              <IconPackage size={22} className="text-[var(--text-muted)]" stroke={1.5} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{art.libelle || "—"}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{art.code}</p>
            {art.famille?.nom ? (
              <span className="mt-1 inline-block rounded-full bg-[var(--bg-badge)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                {art.famille.nom}
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-sm tabular-nums">
        {ligne.quantite} {art.unite || ""}
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{num3(ligne.prixUnit)}</td>
      <td className="px-3 py-3">
        {Number(ligne.remise) > 0 ? (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "color-mix(in srgb, var(--accent-warning) 15%, transparent)",
              color: "var(--accent-warning)",
            }}
          >
            -{num3(ligne.remise)}
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-[var(--accent-success)]">
        {num3(lineTotal)}
      </td>
      <td className="px-3 py-3">
        <StrategyBadge
          strategie={ligne.strategieAppliquee || ligne.strategie}
          article={art}
          confirme={confirme}
        />
        {confirme && lots.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lots.map((lot, li) => {
              const freshColor = freshnessColor(lot.dateExpiration);
              return (
                <span
                  key={`${lot.lotId}-${li}`}
                  className="lot-chip-fade inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
                  style={{
                    animation: `fadeUp 0.25s ease ${li * 40}ms both`,
                    background: "var(--bg-hover)",
                    borderLeft: `2px solid ${freshColor}`,
                  }}
                >
                  {lot.lotNumero} — {lot.quantite} UN
                  {lot.dateExpiration ? (
                    <span style={{ color: freshColor }}> · exp. {formatDate(lot.dateExpiration)}</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function LifecycleTimeline({ vente, reduceMotion }) {
  const annulee = ["ANNULEE", "ANNULE"].includes(String(vente.statut || "").toUpperCase());
  const confirme = isVenteConfirmee(vente.statut) || annulee;
  const livree = Boolean(vente.livree) || String(vente.statut).toUpperCase() === "LIVRE";
  const facturee = Boolean(vente.facture);
  const totalRegle = (vente.reglements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
  const reglee = totalRegle + 1e-6 >= Number(vente.totalTTC || 0) && Number(vente.totalTTC) > 0;

  const steps = [
    { key: "brouillon", label: "Brouillon", done: true, active: !confirme && !annulee, Icon: IconPencil, date: vente.dateVente },
    { key: "confirmee", label: "Confirmée", done: confirme, active: confirme && !livree && !facturee && !annulee, Icon: IconShoppingBag, date: vente.confirmedAt },
    { key: "livree", label: "Livrée", done: livree && !annulee, active: livree && !reglee && !annulee, Icon: IconTruck, date: vente.dateLivraison },
    { key: "facturee", label: "Facturée", done: facturee && !annulee, active: facturee && !reglee && !annulee, Icon: IconFileInvoice, date: vente.facture?.createdAt },
    annulee
      ? { key: "annulee", label: "Annulée", done: true, active: true, Icon: IconReceiptRefund, date: null }
      : { key: "reglee", label: "Réglée", done: reglee, active: reglee, Icon: IconCash, date: null },
  ];

  return (
    <motion.section
      custom={0}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="vente-detail-card mb-6 p-5"
    >
      <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Cycle de vie</h3>
      <div className="relative flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
        <div
          className="pointer-events-none absolute bottom-4 left-[15px] top-4 w-px sm:bottom-auto sm:left-0 sm:right-0 sm:top-[15px] sm:h-px sm:w-full"
          style={{ background: "var(--border-default)" }}
          aria-hidden
        />
        {steps.map((step, i) => {
          const Icon = step.Icon;
          const color =
            step.key === "annulee"
              ? "#94a3b8"
              : step.done
                ? "var(--accent-success)"
                : step.active
                  ? "var(--accent-primary)"
                  : "var(--text-muted)";
          return (
            <motion.div
              key={step.key}
              custom={i}
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="relative z-[1] flex items-start gap-3 py-2 sm:flex-1 sm:flex-col sm:items-center sm:px-1 sm:text-center"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--bg-card)]"
                style={{ borderColor: color, color }}
              >
                {step.done && !step.active ? <IconCheck size={14} stroke={2.5} /> : <Icon size={14} stroke={2} />}
              </div>
              <div className="min-w-0 sm:mt-2">
                <p className="text-xs font-semibold" style={{ color }}>
                  {step.label}
                </p>
                {step.date ? (
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{formatDate(step.date)}</p>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

function ReglementsTimeline({ vente, reduceMotion, onAdd, canWrite }) {
  const regs = [...(vente.reglements || [])].sort(
    (a, b) => new Date(b.datePayment || 0) - new Date(a.datePayment || 0)
  );
  const totalRegle = regs.reduce((s, r) => s + Number(r.montant || 0), 0);
  const reste = Math.max(0, Number(vente.totalTTC || 0) - totalRegle);

  return (
    <motion.section
      custom={2}
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="vente-detail-card mt-6 p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Règlements</h3>
          <p className="text-[11px] text-[var(--text-muted)]">
            Réglé <NumberCounter value={totalRegle} className="font-semibold text-[var(--accent-success)]" /> · Reste dû{" "}
            <span
              className="font-semibold"
              style={{ color: reste > 0.009 ? "var(--accent-danger)" : "var(--accent-success)" }}
            >
              <NumberCounter value={reste} />
            </span>
          </p>
        </div>
        {canWrite && isVenteConfirmee(vente.statut) && reste > 0.009 ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--accent-success)" }}
          >
            <IconCash size={14} />
            Ajouter un règlement
          </button>
        ) : null}
      </div>

      {regs.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Aucun règlement enregistré.</p>
      ) : (
        <ul className="space-y-0">
          {regs.map((r, i) => (
            <motion.li
              key={r.id}
              custom={i}
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
              className="relative flex gap-3 border-l-2 py-3 pl-4"
              style={{ borderColor: "color-mix(in srgb, var(--accent-primary) 35%, var(--border-default))" }}
            >
              <span
                className="absolute -left-[5px] top-4 h-2 w-2 rounded-full"
                style={{ background: "var(--accent-primary)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{num3(r.montant)}</p>
                  <span className="text-[11px] text-[var(--text-muted)]">{formatDate(r.datePayment)}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  {r.mode || "—"}
                  {r.reference ? ` · ${r.reference}` : ""}
                  {r.statut ? ` · ${r.statut}` : ""}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}

export default function VenteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const societeScope = useSocieteQueryScope();
  const canWrite = hasPermission(user?.role, "ventes:write");
  const venteId = Number(id);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [avoirOpen, setAvoirOpen] = useState(false);
  const [avoirQtys, setAvoirQtys] = useState({});
  const [avoirMotif, setAvoirMotif] = useState("Retour client");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [reglementOpen, setReglementOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", message: "" });

  const { data: vente, isLoading } = useQuery({
    queryKey: ["vente", societeScope, venteId],
    queryFn: () => api.get(`ventes/${venteId}`).then((r) => r.data),
    enabled: Number.isFinite(venteId),
  });

  const { data: encours } = useQuery({
    queryKey: ["client-encours", vente?.clientId],
    queryFn: () => api.get(`clients/${vente.clientId}/encours`).then((r) => r.data),
    enabled: Boolean(vente?.clientId),
  });

  const { data: apercu } = useQuery({
    queryKey: ["facture-apercu", "v2", vente?.facture?.id],
    queryFn: () => api.get(`factures/${vente.facture.id}/apercu`).then((r) => r.data),
    enabled: Boolean(previewOpen && vente?.facture?.id),
    staleTime: 0,
  });

  const confirme = vente ? isVenteConfirmee(vente.statut) : false;
  const brouillon = vente ? normalizeStatutVente(vente.statut) === "BROUILLON" : false;

  const ligneReliquats = useMemo(() => {
    const deja = new Map();
    for (const av of vente?.avoirs || []) {
      for (const l of av.lignes || []) {
        deja.set(l.articleId, (deja.get(l.articleId) || 0) + Math.abs(Number(l.quantite) || 0));
      }
    }
    return (vente?.lignes || []).map((l) => {
      const dejaRetourne = deja.get(l.articleId) || 0;
      const reliquat = Math.max(0, Number(l.quantite) - dejaRetourne);
      return { ligne: l, dejaRetourne, reliquat };
    });
  }, [vente?.lignes, vente?.avoirs]);

  const hasReliquatRetour = ligneReliquats.some((r) => r.reliquat > 1e-9);

  const tvaLabel = useMemo(() => {
    const taux = [...new Set((vente?.lignes || []).map((l) => l.tauxTva).filter((t) => t != null))];
    if (taux.length === 0) return "TVA";
    if (taux.length === 1) return `TVA (${taux[0]}%)`;
    return `TVA (taux multiples : ${taux.join("% / ")}%)`;
  }, [vente?.lignes]);

  const dominantStrategy = useMemo(() => {
    const strategies = (vente?.lignes || []).map((l) =>
      String(
        l.strategieAppliquee ||
          l.strategie ||
          l.article?.strategieSortie ||
          l.article?.modeGestion ||
          "STANDARD"
      ).toUpperCase()
    );
    if (strategies.every((s) => s === strategies[0])) return strategies[0] || "FIFO";
    return null;
  }, [vente?.lignes]);

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`ventes/${venteId}/confirmer`),
    onSuccess: (res) => {
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1600);
      toast.success(`Vente ${res.data.reference} confirmée — stock mis à jour`);
      qc.invalidateQueries({ queryKey: ["vente", societeScope, venteId] });
      qc.invalidateQueries({ queryKey: ["ventes"] });
      qc.invalidateQueries({ queryKey: ["ventes-stats"] });
      qc.invalidateQueries({ queryKey: ["ventes-kpis"] });
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      setConfirmOpen(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const preparerMutation = useMutation({
    mutationFn: () => api.post(`ventes/${venteId}/preparer`),
    onSuccess: () => {
      toast.success("Commande client → En préparation");
      qc.invalidateQueries({ queryKey: ["vente", societeScope, venteId] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const expedierMutation = useMutation({
    mutationFn: () => api.post(`ventes/${venteId}/expedier`),
    onSuccess: () => {
      toast.success("Commande client → Expédiée");
      qc.invalidateQueries({ queryKey: ["vente", societeScope, venteId] });
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const avoirMutation = useMutation({
    mutationFn: (payload) => api.post(`ventes/${venteId}/avoir`, payload),
    onSuccess: (res) => {
      toast.success(`Avoir créé : ${res.data.facture?.numero || res.data.reference}`);
      qc.invalidateQueries({ queryKey: ["vente", societeScope, venteId] });
      qc.invalidateQueries({ queryKey: ["ventes"] });
      qc.invalidateQueries({ queryKey: ["ventes-kpis"] });
      setAvoirOpen(false);
      setAvoirQtys({});
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function openAvoirModal() {
    const initial = {};
    for (const { ligne, reliquat } of ligneReliquats) {
      if (reliquat > 1e-9) initial[ligne.id] = reliquat;
    }
    setAvoirQtys(initial);
    setAvoirMotif("Retour client");
    setAvoirOpen(true);
  }

  function submitAvoir() {
    const lignes = ligneReliquats
      .map(({ ligne, reliquat }) => {
        const q = Number(avoirQtys[ligne.id] || 0);
        if (!(q > 0) || q > reliquat + 1e-9) return null;
        return { ligneId: ligne.id, quantite: q };
      })
      .filter(Boolean);
    if (lignes.length === 0) {
      toast.error("Indiquez au moins une quantité à retourner");
      return;
    }
    avoirMutation.mutate({ motif: avoirMotif || "Retour client", lignes });
  }

  const emailMutation = useMutation({
    mutationFn: () => api.post(`factures/${vente.facture.id}/envoyer-email`, emailForm),
    onSuccess: (res) => {
      toast.success(`Email envoyé à ${res.data.factureEmailSentTo || emailForm.to}`);
      qc.invalidateQueries({ queryKey: ["vente", societeScope, venteId] });
      setEmailOpen(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  function copyReference() {
    if (!vente?.reference) return;
    navigator.clipboard.writeText(vente.reference);
    setCopied(true);
    toast.success("Référence copiée");
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadPdf() {
    if (!vente?.facture?.id) {
      toast.error("Facture non disponible");
      return;
    }
    setPdfLoading(true);
    try {
      const resp = await api.get(`factures/${vente.facture.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${vente.facture.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF téléchargé");
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Erreur PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  function openEmailModal() {
    const soc = vente?.societe?.nom || "Stokify";
    const num = vente?.facture?.numero || vente?.reference;
    setEmailForm({
      to: vente?.client?.email || "",
      subject: `Facture ${num} — ${soc}`,
      message: `Bonjour,\n\nVeuillez trouver ci-joint votre facture ${num}.\n\nCordialement,\n${soc}`,
    });
    setEmailOpen(true);
  }

  if (isLoading) {
    return (
      <PageShell title="Chargement…">
        <div className="h-48 animate-pulse rounded-xl bg-[var(--bg-hover)]" />
      </PageShell>
    );
  }

  if (!vente) {
    return (
      <PageShell title="Vente introuvable">
        <button type="button" className="text-sm text-[var(--text-link)]" onClick={() => navigate("/ventes")}>
          ← Retour à la liste
        </button>
      </PageShell>
    );
  }

  const encoursPct =
    encours?.plafondCredit > 0 ? Math.min(100, (encours.total / encours.plafondCredit) * 100) : 0;
  const encoursBarColor =
    encours?.depassement || encoursPct > 90
      ? "var(--accent-danger)"
      : encoursPct > 70
        ? "var(--accent-warning)"
        : "var(--accent-success)";

  return (
    <PageShell
      title=""
      subtitle=""
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {brouillon && canWrite ? (
            <button
              type="button"
              onClick={() => navigate(`/ventes/${venteId}/edit`)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-[var(--bg-hover)]"
            >
              <IconPencil size={16} />
              Modifier
            </button>
          ) : null}
          {confirme && vente.facture ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium transition-all duration-150 hover:scale-[1.02] hover:bg-[var(--bg-hover)]"
              >
                <IconFileInvoice size={16} style={{ color: "var(--accent-primary)" }} />
                Aperçu facture
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={pdfLoading}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.02] hover:brightness-110 disabled:opacity-60"
                style={{ background: "var(--accent-primary)" }}
              >
                {pdfLoading ? <IconLoader2 size={16} className="animate-spin" /> : <IconDownload size={16} />}
                {pdfLoading ? "Génération…" : "Générer PDF"}
              </button>
              <button
                type="button"
                onClick={openEmailModal}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium transition-all duration-150 hover:scale-[1.02] hover:bg-[var(--bg-hover)]"
              >
                <IconMail size={16} style={{ color: "var(--accent-primary)" }} />
                Envoyer par email
              </button>
            </>
          ) : null}
          {confirme && canWrite && hasReliquatRetour ? (
            <button
              type="button"
              onClick={openAvoirModal}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:scale-[1.02] hover:brightness-110"
              style={{ background: "var(--accent-warning)" }}
            >
              <IconReceiptRefund size={16} />
              Créer un avoir
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/ventes")}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-hover)]"
          >
            ← Liste
          </button>
        </div>
      }
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vente-row-fade { animation: fadeUp 0.4s ease both; }
        .lot-chip-fade { animation: fadeUp 0.35s ease both; }
        .vente-detail-card {
          background: var(--bg-card);
          border: 0.5px solid var(--border-default);
          border-radius: 12px;
        }
        @media (prefers-reduced-motion: reduce) {
          .vente-row-fade, .lot-chip-fade { animation: none !important; }
        }
      `}</style>

      <LifecycleTimeline vente={vente} reduceMotion={reduceMotion} />

      {confirme && vente.confirmedAt ? (
        <div
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 vente-detail-card"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-success) 40%, var(--border-default))",
            background: "color-mix(in srgb, var(--accent-success) 8%, transparent)",
          }}
        >
          <IconCheck size={20} style={{ color: "var(--accent-success)" }} />
          <p className="text-sm text-[var(--text-primary)]">
            Vente confirmée le <strong>{formatDate(vente.confirmedAt)}</strong>
            {vente.confirmateur
              ? ` par ${vente.confirmateur.prenom || ""} ${vente.confirmateur.nom || ""}`.trim()
              : ""}
            {vente.facture ? (
              <>
                {" "}
                — Facture <strong className="font-mono">{vente.facture.numero}</strong>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {vente.avoirs?.length > 0 ? (
        <div
          className="mb-4 rounded-xl border px-4 py-2 text-sm vente-detail-card"
          style={{
            borderColor: "color-mix(in srgb, var(--accent-warning) 40%, var(--border-default))",
            background: "color-mix(in srgb, var(--accent-warning) 8%, transparent)",
          }}
        >
          Avoir{vente.avoirs.length > 1 ? "s" : ""} créé{vente.avoirs.length > 1 ? "s" : ""} :{" "}
          {vente.avoirs.map((av, i) => (
            <span key={av.id}>
              {i > 0 ? ", " : ""}
              <strong className="font-mono">{av.facture?.numero || av.reference}</strong>
            </span>
          ))}
          {hasReliquatRetour ? (
            <span className="ml-2 text-[var(--text-muted)]">(retour partiel — reliquat retournable disponible)</span>
          ) : (
            <span className="ml-2 text-[var(--text-muted)]">(tout a été retourné)</span>
          )}
        </div>
      ) : null}

      {dominantStrategy && !confirme ? (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 vente-detail-card"
          style={{
            background:
              dominantStrategy === "FEFO"
                ? "color-mix(in srgb, var(--accent-success) 8%, transparent)"
                : "color-mix(in srgb, var(--accent-primary) 8%, transparent)",
            borderColor:
              dominantStrategy === "FEFO"
                ? "color-mix(in srgb, var(--accent-success) 35%, var(--border-default))"
                : "color-mix(in srgb, var(--accent-primary) 35%, var(--border-default))",
          }}
        >
          {dominantStrategy === "FEFO" ? (
            <IconClock size={20} style={{ color: "var(--accent-success)" }} />
          ) : (
            <IconArrowRight size={20} style={{ color: "var(--accent-primary)" }} />
          )}
          <p className="text-sm text-[var(--text-secondary)]">
            {dominantStrategy === "FEFO"
              ? "Sortie par date d'expiration (FEFO) — articles les plus proches de la péremption sortis en premier"
              : dominantStrategy === "FIFO"
                ? "Sortie par ordre d'arrivée (FIFO) — premier entré, premier sorti"
                : "Sortie standard — sans gestion par lots"}
          </p>
        </div>
      ) : null}

      {encours && encours.total > 0 ? (
        <div className="mb-6 vente-detail-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">Encours client</p>
            {encours.depassement ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-danger)]">
                <IconAlertTriangle size={14} />
                Plafond crédit dépassé
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Encours actuel : <strong>{num3(encours.total)} TND</strong>
            {encours.plafondCredit != null ? (
              <> / Plafond : <strong>{num3(encours.plafondCredit)} TND</strong></>
            ) : null}
          </p>
          {encours.plafondCredit > 0 ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${encoursPct}%`, background: encoursBarColor }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <header className="vente-detail-card mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] px-4 py-2 font-mono text-lg font-bold">
                {vente.reference}
                <button type="button" onClick={copyReference} className="rounded-lg p-1 hover:bg-[var(--bg-hover)]">
                  <IconCopy
                    size={16}
                    className={copied ? "text-[var(--accent-success)]" : "text-[var(--text-muted)]"}
                  />
                </button>
              </span>
              <StatutBadge statut={vente.statut} />
              {vente.typeVente === "COMMANDE_WEB" ? (
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    color: "var(--brand-teal, #0d9488)",
                    borderColor: "color-mix(in srgb, var(--brand-teal, #0d9488) 40%, transparent)",
                    background: "color-mix(in srgb, var(--brand-teal, #0d9488) 10%, transparent)",
                  }}
                >
                  Commande web client
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: hashColor(vente.client?.nom) }}
              >
                {initials(vente.client?.nom)}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                  <IconBuildingStore size={16} className="text-[var(--text-muted)]" />
                  {vente.client?.nom || "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconCalendar size={16} className="text-[var(--text-muted)]" />
                  {formatDate(vente.dateVente)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconMapPin size={16} className="text-[var(--text-muted)]" />
                  {vente.depot?.libelle || "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconCash size={16} className="text-[var(--text-muted)]" />
                  {vente.modePaiement || "—"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {brouillon && canWrite ? (
              <button
                type="button"
                disabled={confirmMutation.isPending}
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white transition-all duration-150 hover:brightness-110 disabled:opacity-60"
                style={{ background: "var(--accent-success)" }}
              >
                <IconShoppingBag size={20} />
                {confirmMutation.isPending ? "Confirmation…" : "Confirmer la vente"}
              </button>
            ) : null}
            {confirme && canWrite && vente.typeVente === "COMMANDE_WEB" ? (
              <>
                <button
                  type="button"
                  disabled={preparerMutation.isPending}
                  onClick={() => preparerMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  Préparer
                </button>
                <button
                  type="button"
                  disabled={expedierMutation.isPending}
                  onClick={() => expedierMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  Expédier
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <section className="vente-detail-card overflow-hidden">
          <div className="border-b border-[var(--border-default)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Articles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-app)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">Prix HT</th>
                  <th className="px-3 py-2 font-medium">Remise</th>
                  <th className="px-3 py-2 text-right font-medium">Total HT</th>
                  <th className="px-3 py-2 font-medium">Stratégie / Lots</th>
                </tr>
              </thead>
              <tbody>
                {(vente.lignes || []).map((l, i) => (
                  <ArticleRow key={l.id} ligne={l} index={i} confirme={confirme} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="vente-detail-card p-5 xl:sticky xl:top-4 xl:self-start">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Récapitulatif</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Total HT</span>
              <NumberCounter
                value={vente.totalHT + (vente.remise || 0)}
                className="tabular-nums text-[var(--text-primary)]"
              />
            </div>
            {Number(vente.remise) > 0 ? (
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Remise globale</span>
                <NumberCounter value={-vente.remise} className="tabular-nums" suffix=" TND" />
              </div>
            ) : null}
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Net HT</span>
              <NumberCounter value={vente.totalHT} className="tabular-nums text-[var(--text-primary)]" />
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>{tvaLabel}</span>
              <NumberCounter value={vente.totalTVA} className="tabular-nums text-[var(--text-primary)]" />
            </div>
            <div className="flex justify-between border-t border-[var(--border-default)] pt-3 text-base font-bold">
              <span>Total TTC</span>
              <span className="text-[var(--accent-success)]">
                <NumberCounter value={vente.totalTTC} className="tabular-nums" suffix=" TND" />
              </span>
            </div>
          </div>
        </aside>
      </div>

      <ReglementsTimeline
        vente={vente}
        reduceMotion={reduceMotion}
        canWrite={canWrite}
        onAdd={() => setReglementOpen(true)}
      />

      {confirmOpen ? (
        <ConfirmModal
          title="Confirmer la vente"
          message={`Confirmer la vente ${vente.reference} ? Le stock sera déduit selon la stratégie FIFO/FEFO et une facture sera générée.`}
          confirmLabel="Confirmer la vente"
          loading={confirmMutation.isPending}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => confirmMutation.mutate()}
        />
      ) : null}

      {avoirOpen ? (
        <Modal title="Créer un avoir" onClose={() => !avoirMutation.isPending && setAvoirOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Indiquez les quantités à retourner (max = reliquat encore retournable).
            </p>
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Motif
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                value={avoirMotif}
                onChange={(e) => setAvoirMotif(e.target.value)}
              />
            </label>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {ligneReliquats
                .filter((r) => r.reliquat > 1e-9)
                .map(({ ligne, dejaRetourne, reliquat }) => (
                  <motion.div
                    key={ligne.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {ligne.article?.libelle || `Article #${ligne.articleId}`}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Vendu {num3(ligne.quantite)} · déjà retourné {num3(dejaRetourne)} · max {num3(reliquat)}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      max={reliquat}
                      className="w-28 rounded-lg border border-[var(--border-default)] bg-[var(--bg-app)] px-2 py-1.5 text-right text-sm tabular-nums"
                      value={avoirQtys[ligne.id] ?? ""}
                      onChange={(e) =>
                        setAvoirQtys((q) => ({
                          ...q,
                          [ligne.id]: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                    />
                  </motion.div>
                ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={avoirMutation.isPending}
                onClick={() => setAvoirOpen(false)}
                className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={avoirMutation.isPending}
                onClick={submitAvoir}
                className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--accent-warning)" }}
              >
                {avoirMutation.isPending ? "Création…" : "Créer l'avoir"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {previewOpen ? (
        <Modal title={`Aperçu — ${vente.facture?.numero}`} onClose={() => setPreviewOpen(false)} size="lg">
          {apercu?.html ? (
            <iframe
              title={`Aperçu facture ${vente.facture?.numero || ""}`}
              srcDoc={apercu.html}
              className="w-full rounded-xl border border-[var(--border-default)] bg-white"
              style={{ height: "min(75vh, 820px)", background: "#e5e7eb", colorScheme: "light" }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="space-y-3 p-4">
              <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--bg-hover)]" />
              <div className="h-24 animate-pulse rounded-xl bg-[var(--bg-hover)]" />
              <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-hover)]" />
            </div>
          )}
        </Modal>
      ) : null}

      {emailOpen ? (
        <Modal
          title="Envoyer la facture par email"
          onClose={() => setEmailOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setEmailOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                disabled={emailMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--accent-primary)" }}
                onClick={() => emailMutation.mutate()}
              >
                {emailMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconMail size={14} />}
                {emailMutation.isPending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Destinataire</label>
              <input
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                value={emailForm.to}
                onChange={(e) => setEmailForm((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Objet</label>
              <input
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                value={emailForm.subject}
                onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-secondary)]">Message</label>
              <textarea
                rows={5}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm"
                value={emailForm.message}
                onChange={(e) => setEmailForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      ) : null}

      {reglementOpen ? (
        <ModalReglementVente
          vente={vente}
          onClose={() => setReglementOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["vente", societeScope, venteId] });
            qc.invalidateQueries({ queryKey: ["ventes"] });
            qc.invalidateQueries({ queryKey: ["ventes-kpis"] });
            qc.invalidateQueries({ queryKey: ["clients-encours"] });
            setReglementOpen(false);
            toast.success("Règlement enregistré");
          }}
        />
      ) : null}

      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            style={{ background: "rgba(11,18,32,0.35)" }}
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="rounded-full p-6"
              style={{ background: "var(--panel)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 260 }}
              >
                <IconCircleCheck size={56} style={{ color: "var(--brand-teal, #2dd4bf)" }} />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
