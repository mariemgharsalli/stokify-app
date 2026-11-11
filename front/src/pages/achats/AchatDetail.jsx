import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  IconAlertTriangle,
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconDownload,
  IconMapPin,
  IconPackage,
  IconPackageOff,
  IconPencil,
  IconTruck,
  IconArrowBackUp,
} from "@tabler/icons-react";
import { Package, Sparkles } from "lucide-react";
import api from "../../services/api";
import PageShell from "../../components/ui/PageShell";
import NumberCounter from "../../components/ui/NumberCounter";
import ConfirmModal from "../../components/ui/ConfirmModal";
import RetourFournisseurModal from "../../components/achats/RetourFournisseurModal";
import {
  CommerceAvatarRing,
  CommerceMiniGauge,
  COMMERCE_THEME,
} from "../../components/commerce/CommerceDocCardShell";
import { formatDate, num3, initials } from "../../utils/commerceUi";
import { generateBonReceptionPdf } from "../../utils/bonReceptionPdf";
import { downloadBonRetourPdf, motifRetourTexte } from "../../utils/downloadBonRetour";
import { useClientBranding } from "../../hooks/useClientBranding";
import {
  STRATEGIE_COLORS,
  isAchatConfirme,
  isAchatEnRetard,
  normalizeStatutAchat,
  STATUTS_ACHAT,
} from "../../constants/statuts";
import { hasPermission } from "../../security/permissions";
import { useAuthStore } from "../../store/authStore";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";

const ACCENT = COMMERCE_THEME.accent;
const CYAN = COMMERCE_THEME.cyan;
const SUCCESS = COMMERCE_THEME.success;
const DANGER = COMMERCE_THEME.danger;

const fadeUp = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

function freshnessColor(dateExpiration) {
  if (!dateExpiration) return SUCCESS;
  const days = Math.ceil((new Date(dateExpiration) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return DANGER;
  if (days <= 30) return COMMERCE_THEME.warning;
  return SUCCESS;
}

function DetailCard({ children, className = "", accent = ACCENT, style, ...rest }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${className}`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${accent}`,
        boxShadow: "var(--shadow-card)",
        ...style,
      }}
      {...rest}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-300 group-hover:opacity-80"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${accent}18, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${CYAN}10, transparent 50%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}77, transparent)` }}
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function StatutBadge({ statut }) {
  const key = normalizeStatutAchat(statut);
  const cfg = STATUTS_ACHAT[key] || STATUTS_ACHAT.BROUILLON;
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

function StrategyBadge({ article }) {
  const s = String(article?.strategieSortie || article?.modeGestion || "STANDARD").toUpperCase();
  const cfg = STRATEGIE_COLORS[s] || STRATEGIE_COLORS.STANDARD;
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function LifecycleStrip({ achat, reduceMotion }) {
  const brouillon = normalizeStatutAchat(achat.statut) === "BROUILLON";
  const confirme = isAchatConfirme(achat.statut);
  const steps = [
    {
      key: "brouillon",
      label: "Brouillon",
      done: true,
      active: brouillon,
      Icon: IconPencil,
      date: achat.dateCommande,
    },
    {
      key: "confirme",
      label: "Confirmé",
      done: confirme,
      active: confirme,
      Icon: IconCheck,
      date: achat.confirmedAt || (confirme ? achat.updatedAt : null),
    },
    {
      key: "stock",
      label: "Stock & lots",
      done: confirme && (achat.lots || []).length > 0,
      active: false,
      Icon: IconPackage,
      date: null,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {steps.map((step, idx) => {
        const Icon = step.Icon;
        const tone = step.active ? ACCENT : step.done ? SUCCESS : "var(--text-muted)";
        return (
          <div key={step.key} className="flex items-center gap-2 sm:gap-3">
            {idx > 0 ? (
              <div
                className="hidden h-px w-6 sm:block md:w-10"
                style={{
                  background: step.done || steps[idx - 1].done
                    ? `linear-gradient(90deg, ${SUCCESS}, ${ACCENT})`
                    : "var(--border-default)",
                }}
                aria-hidden
              />
            ) : null}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + idx * 0.07, duration: 0.35 }}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: step.active || step.done ? `${tone}55` : "var(--border-default)",
                background: step.active
                  ? `color-mix(in srgb, ${ACCENT} 16%, transparent)`
                  : step.done
                    ? `color-mix(in srgb, ${SUCCESS} 12%, transparent)`
                    : "var(--bg-input)",
                color: tone,
                boxShadow: step.active ? `0 6px 16px -10px ${ACCENT}` : undefined,
              }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background: step.done || step.active ? `${tone}22` : "var(--bg-hover)",
                }}
              >
                <Icon size={13} stroke={2.2} />
              </span>
              <span>{step.label}</span>
              {step.date ? (
                <span className="hidden text-[10px] font-medium opacity-70 sm:inline">
                  {formatDate(step.date)}
                </span>
              ) : null}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function ArticleRow({ ligne, lot, index }) {
  const art = ligne.article || {};
  const lineTotal = Number(ligne.totalHT || ligne.quantite * ligne.prixUnit);

  return (
    <tr
      className="border-b border-[var(--border-default)] transition-all duration-150 hover:border-l-[3px] hover:bg-[color-mix(in_srgb,#378ADD_6%,transparent)]"
      style={{
        animation: `achatDetailFade 0.4s ease ${index * 50}ms both`,
        borderLeftColor: ACCENT,
      }}
    >
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl border"
            style={{
              borderColor: `color-mix(in srgb, ${ACCENT} 28%, var(--border-default))`,
              boxShadow: `0 8px 18px -12px ${ACCENT}88`,
            }}
          >
            {art.imageUrl ? (
              <img src={art.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background: `linear-gradient(145deg, ${ACCENT}22, ${CYAN}14)`,
                }}
              >
                <IconPackage size={22} style={{ color: ACCENT }} stroke={1.5} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {art.libelle || "—"}
            </p>
            <p className="font-mono text-[11px] font-semibold text-[#378ADD]">{art.code}</p>
            {art.famille?.nom ? (
              <span className="mt-1 inline-block rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                {art.famille.nom}
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {ligne.quantite}{" "}
        <span className="text-[10px] font-medium uppercase text-[var(--text-muted)]">
          {art.unite || ""}
        </span>
      </td>
      <td className="px-3 py-3.5 text-right text-sm tabular-nums text-[var(--text-secondary)]">
        {num3(ligne.prixUnit)}
      </td>
      <td className="px-3 py-3.5 text-right text-sm font-bold tabular-nums" style={{ color: ACCENT }}>
        {num3(lineTotal)}
      </td>
      <td className="px-3 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {lot ? (
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium"
              style={{
                background: "var(--bg-hover)",
                borderLeft: `2px solid ${freshnessColor(lot.dateExpiration)}`,
                color: "var(--text-secondary)",
              }}
            >
              {lot.numero}
              {lot.dateExpiration ? ` · ${formatDate(lot.dateExpiration)}` : ""}
            </span>
          ) : null}
          <StrategyBadge article={art} />
        </div>
      </td>
    </tr>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div
        className="h-36 animate-pulse rounded-2xl border border-[var(--border-default)]"
        style={{
          background: "var(--bg-card)",
          borderLeft: `3px solid ${ACCENT}55`,
        }}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--bg-hover)]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[var(--bg-hover)]" />
      </div>
    </div>
  );
}

export default function AchatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const clientBranding = useClientBranding();
  const societeScope = useSocieteQueryScope();
  const canWrite = hasPermission(user?.role, "achats:write");
  const achatId = Number(id);

  const [lotsOpen, setLotsOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retourOpen, setRetourOpen] = useState(false);
  const [capacityError, setCapacityError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [retourPdfId, setRetourPdfId] = useState(null);

  const { data: achat, isLoading } = useQuery({
    queryKey: ["achat", societeScope, achatId],
    queryFn: () => api.get(`achats/${achatId}`).then((r) => r.data),
    enabled: Number.isFinite(achatId),
  });

  const { data: retoursData } = useQuery({
    queryKey: ["retours-fournisseur", societeScope, achatId],
    queryFn: () =>
      api.get("achats/retours-fournisseur", { params: { achatId } }).then((r) => r.data),
    enabled: Number.isFinite(achatId),
  });
  const retours = (retoursData?.items || []).filter(
    (r) => Number(r.achatId ?? r.achat?.id) === achatId
  );

  const confirme = achat ? isAchatConfirme(achat.statut) : false;
  const brouillon = achat ? normalizeStatutAchat(achat.statut) === "BROUILLON" : false;
  const enRetard = achat ? isAchatEnRetard(achat) : false;
  const heroAccent = enRetard ? DANGER : confirme ? SUCCESS : ACCENT;
  const lineCount = achat?.lignes?.length || 0;
  const lotCount = achat?.lots?.length || 0;
  const progressPct = confirme ? 100 : brouillon ? 28 : 55;

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`achats/${achatId}/confirmer`),
    onSuccess: (res) => {
      toast.success(`Commande ${res.data.reference} confirmée — stock mis à jour`);
      if (res.data.warnings?.length) {
        res.data.warnings.forEach((w) => toast.warning(w));
      }
      qc.invalidateQueries({ queryKey: ["achat", societeScope, achatId] });
      qc.invalidateQueries({ queryKey: ["achats"] });
      qc.invalidateQueries({ queryKey: ["achats-stats"] });
      setConfirmOpen(false);
      setCapacityError(null);
    },
    onError: (e) => {
      if (e.response?.status === 409) {
        setCapacityError(e.response?.data?.message || "Capacité dépôt dépassée");
        setConfirmOpen(false);
        return;
      }
      toast.error(e.response?.data?.message || e.message);
    },
  });

  function copyReference() {
    if (!achat?.reference) return;
    navigator.clipboard.writeText(achat.reference);
    setCopied(true);
    toast.success("Référence copiée");
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadBonReception() {
    if (!achat) return;
    await generateBonReceptionPdf(achat, user, clientBranding);
  }

  async function downloadRetour(retour) {
    setRetourPdfId(retour.id);
    try {
      await downloadBonRetourPdf(retour.id, retour.reference);
      toast.success("Bon de retour téléchargé");
    } catch (e) {
      toast.error(e.message || "Impossible de télécharger le bon de retour");
    } finally {
      setRetourPdfId(null);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Chargement…">
        <DetailSkeleton />
      </PageShell>
    );
  }

  if (!achat) {
    return (
      <PageShell title="Achat introuvable">
        <DetailCard className="px-6 py-12 text-center" accent={DANGER}>
          <IconPackageOff size={40} className="mx-auto text-[var(--text-muted)] opacity-50" />
          <p className="mt-3 font-semibold text-[var(--text-primary)]">Achat introuvable</p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-[#378ADD]"
            onClick={() => navigate("/achats")}
          >
            ← Retour à la liste
          </button>
        </DetailCard>
      </PageShell>
    );
  }

  return (
    <PageShell
      title=""
      subtitle=""
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {brouillon && canWrite ? (
            <button
              type="button"
              onClick={() => navigate(`/achats/${achatId}/edit`)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5"
              style={{
                borderColor: `color-mix(in srgb, ${ACCENT} 35%, var(--border-default))`,
                background: "var(--bg-card)",
                color: ACCENT,
              }}
            >
              <IconPencil size={16} />
              Modifier
            </button>
          ) : null}
          {confirme ? (
            <button
              type="button"
              onClick={downloadBonReception}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:-translate-y-0.5 hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${CYAN})`,
                borderColor: "transparent",
                boxShadow: `0 10px 22px -12px ${ACCENT}`,
              }}
            >
              <IconDownload size={16} />
              Bon de réception
            </button>
          ) : null}
          {confirme && canWrite ? (
            <motion.button
              type="button"
              onClick={() => setRetourOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5"
              style={{
                borderColor: `color-mix(in srgb, ${DANGER} 40%, var(--border-default))`,
                background: `color-mix(in srgb, ${DANGER} 10%, var(--bg-card))`,
                color: DANGER,
              }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <IconArrowBackUp size={16} />
              Signaler un retour fournisseur
            </motion.button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/achats")}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-all duration-150 hover:bg-[var(--bg-hover)]"
          >
            ← Liste
          </button>
        </div>
      }
    >
      <style>{`
        @keyframes achatDetailFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="space-y-5">
        <AnimatePresence>
          {confirme ? (
            <motion.div
              key="success"
              custom={0}
              variants={fadeUp}
              initial={reduceMotion ? false : "hidden"}
              animate="visible"
            >
              <DetailCard accent={SUCCESS} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                    style={{
                      background: `linear-gradient(145deg, ${SUCCESS}, #34d399)`,
                      boxShadow: `0 10px 20px -10px ${SUCCESS}`,
                    }}
                  >
                    <IconCheck size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" style={{ color: SUCCESS }}>
                      Commande confirmée avec succès
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Référence{" "}
                      <strong className="font-mono text-[#378ADD]">{achat.reference}</strong>
                      {" — "}stock et lots créés automatiquement
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: "rgba(29,158,117,0.16)", color: "#6ee7b7" }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Stock à jour
                  </span>
                </div>
              </DetailCard>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Hero */}
        <motion.div
          custom={0.2}
          variants={fadeUp}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
        >
          <DetailCard accent={heroAccent} className="p-5 sm:p-6">
            <Package
              className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 opacity-[0.06] transition-transform duration-500 group-hover:scale-110"
              style={{ color: heroAccent }}
              strokeWidth={1}
              aria-hidden
            />

            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 flex-1 flex-wrap items-start gap-4">
                <CommerceAvatarRing
                  pct={progressPct}
                  accent={heroAccent}
                  size={64}
                  pulse={enRetard && !reduceMotion}
                  chipLabel={`${progressPct}%`}
                >
                  {initials(achat.fournisseur?.nom)}
                </CommerceAvatarRing>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 font-mono text-lg font-bold"
                      style={{
                        borderColor: `color-mix(in srgb, ${ACCENT} 35%, var(--border-default))`,
                        background: `color-mix(in srgb, ${ACCENT} 10%, var(--bg-input))`,
                        color: ACCENT,
                      }}
                    >
                      {achat.reference}
                      <button
                        type="button"
                        onClick={copyReference}
                        className="rounded-lg p-1 transition-all duration-150 hover:bg-[var(--bg-hover)]"
                        title="Copier la référence"
                      >
                        <IconCopy
                          size={16}
                          className={
                            copied ? "text-[var(--commerce-success,#1D9E75)]" : "text-[var(--text-muted)]"
                          }
                        />
                      </button>
                    </span>
                    <StatutBadge statut={achat.statut} />
                    {enRetard ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: "rgba(226,75,74,0.18)", color: "#fca5a5" }}
                      >
                        En retard
                      </span>
                    ) : null}
                  </div>

                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {achat.fournisseur?.nom || "Fournisseur —"}
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <IconBuilding size={15} className="text-sky-400/80" />
                      {achat.fournisseur?.code || "Fournisseur"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <IconCalendar size={15} className="text-sky-400/80" />
                      {formatDate(achat.dateCommande)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <IconMapPin size={15} className="text-sky-400/80" />
                      {achat.depot?.libelle || "—"}
                    </span>
                    {achat.dateLivraisonPrevue ? (
                      <span className="inline-flex items-center gap-1.5">
                        <IconTruck size={15} className="text-sky-400/80" />
                        Liv. prévue {formatDate(achat.dateLivraisonPrevue)}
                      </span>
                    ) : null}
                  </div>

                  <CommerceMiniGauge
                    pct={progressPct}
                    accent={heroAccent}
                    reduceMotion={reduceMotion}
                  />

                  <LifecycleStrip achat={achat} reduceMotion={reduceMotion} />
                </div>
              </div>

              {brouillon && canWrite ? (
                <button
                  type="button"
                  disabled={confirmMutation.isPending}
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white transition-all duration-150 hover:brightness-110 disabled:opacity-60"
                  style={{
                    background: `linear-gradient(135deg, ${SUCCESS}, #34d399)`,
                    boxShadow: `0 12px 28px -12px ${SUCCESS}`,
                  }}
                >
                  <IconTruck size={20} />
                  {confirmMutation.isPending ? "Confirmation…" : "Confirmer la commande"}
                </button>
              ) : null}
            </div>
          </DetailCard>
        </motion.div>

        {/* Lines + Recap */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
          <motion.div
            custom={0.5}
            variants={fadeUp}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
          >
            <DetailCard accent={ACCENT} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{
                      background: `linear-gradient(145deg, ${ACCENT}, ${CYAN})`,
                      color: "white",
                      boxShadow: `0 8px 16px -10px ${ACCENT}`,
                    }}
                  >
                    <IconPackage size={16} />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                      Articles commandés
                    </h2>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {lineCount} ligne{lineCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>

              {lineCount === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <IconPackageOff size={48} className="text-[var(--text-muted)] opacity-40" stroke={1.25} />
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    Aucun article dans cette commande
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] bg-[color-mix(in_srgb,#378ADD_5%,var(--bg-app))] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                        <th className="px-4 py-2.5 font-medium">Article</th>
                        <th className="px-3 py-2.5 font-medium">Quantité</th>
                        <th className="px-3 py-2.5 text-right font-medium">Prix HT</th>
                        <th className="px-3 py-2.5 text-right font-medium">Total HT</th>
                        <th className="px-3 py-2.5 font-medium">Lot / Stratégie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(achat.lignes || []).map((l, i) => (
                        <ArticleRow key={l.id} ligne={l} lot={l.lot} index={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DetailCard>

            {retours.length > 0 ? (
              <DetailCard accent={DANGER} className="mt-5 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                      style={{
                        background: `linear-gradient(145deg, ${DANGER}, #C73E3E)`,
                        boxShadow: `0 8px 16px -10px ${DANGER}`,
                      }}
                    >
                      <IconArrowBackUp size={16} />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Bons de retour</h2>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {retours.length} document{retours.length > 1 ? "s" : ""} à joindre au fournisseur
                      </p>
                    </div>
                  </div>
                </div>
                <ul>
                  {retours.map((retour) => (
                    <li
                      key={retour.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-[#378ADD]">{retour.reference}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                          {retour.article?.libelle || "Article"}
                          {" · "}
                          {Number(retour.quantiteRetournee || 0).toLocaleString("fr-FR")}
                          {retour.article?.unite ? ` ${retour.article.unite}` : ""}
                          {" · "}
                          {motifRetourTexte(retour)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{formatDate(retour.createdAt)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={retourPdfId === retour.id}
                        onClick={() => downloadRetour(retour)}
                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 hover:-translate-y-0.5 disabled:opacity-60"
                        style={{
                          borderColor: `color-mix(in srgb, ${DANGER} 35%, var(--border-default))`,
                          color: DANGER,
                          background: `color-mix(in srgb, ${DANGER} 8%, var(--bg-card))`,
                        }}
                      >
                        <IconDownload size={14} />
                        {retourPdfId === retour.id ? "Préparation…" : "Bon PDF"}
                      </button>
                    </li>
                  ))}
                </ul>
              </DetailCard>
            ) : null}
          </motion.div>

          <motion.aside
            custom={0.7}
            variants={fadeUp}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            className="xl:sticky xl:top-4 xl:self-start"
          >
            <DetailCard accent={SUCCESS} className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                  style={{
                    background: `linear-gradient(145deg, ${SUCCESS}, ${CYAN})`,
                    boxShadow: `0 8px 16px -10px ${SUCCESS}`,
                  }}
                >
                  <IconCheck size={15} />
                </span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Récapitulatif</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Total HT</span>
                  <NumberCounter value={achat.totalHT} className="tabular-nums text-[var(--text-primary)]" />
                </div>
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>TVA (19%)</span>
                  <NumberCounter value={achat.totalTVA} className="tabular-nums text-[var(--text-primary)]" />
                </div>
                <div
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: `color-mix(in srgb, ${SUCCESS} 30%, var(--border-default))`,
                    background: `linear-gradient(135deg, color-mix(in srgb, ${SUCCESS} 12%, transparent), color-mix(in srgb, ${CYAN} 8%, transparent))`,
                  }}
                >
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Total TTC
                    </span>
                    <span className="text-xl font-bold tabular-nums" style={{ color: SUCCESS }}>
                      <NumberCounter value={achat.totalTTC} className="tabular-nums" suffix=" TND" />
                    </span>
                  </div>
                  <div
                    className="mt-3 h-1 overflow-hidden rounded-full"
                    style={{ background: "color-mix(in srgb, var(--border-default) 70%, transparent)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${SUCCESS}, ${CYAN})`,
                        boxShadow: `0 0 8px ${SUCCESS}55`,
                      }}
                      initial={reduceMotion ? false : { width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Lignes</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-[#378ADD]">{lineCount}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Lots</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums" style={{ color: SUCCESS }}>
                      {lotCount}
                    </p>
                  </div>
                </div>
              </div>
            </DetailCard>
          </motion.aside>
        </div>

        {/* Lots */}
        {confirme && lotCount > 0 ? (
          <motion.div
            custom={0.9}
            variants={fadeUp}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
          >
            <DetailCard accent={CYAN} className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,#0EA5E9_6%,transparent)]"
                onClick={() => setLotsOpen((o) => !o)}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                    style={{
                      background: `linear-gradient(145deg, ${CYAN}, ${ACCENT})`,
                      boxShadow: `0 8px 16px -10px ${CYAN}`,
                    }}
                  >
                    <IconPackage size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Lots créés automatiquement
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {lotCount} lot{lotCount > 1 ? "s" : ""} généré{lotCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {lotsOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
              </button>

              <AnimatePresence initial={false}>
                {lotsOpen ? (
                  <motion.div
                    key="lots"
                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-default)] p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {achat.lots.map((lot, i) => {
                        const fresh = freshnessColor(lot.dateExpiration);
                        return (
                          <motion.div
                            key={lot.id}
                            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.3 }}
                            whileHover={
                              reduceMotion
                                ? undefined
                                : {
                                    y: -4,
                                    boxShadow: `0 14px 28px -16px ${fresh}66`,
                                  }
                            }
                            className="relative overflow-hidden rounded-xl border p-3.5"
                            style={{
                              background: "var(--bg-card)",
                              borderColor: "var(--border-default)",
                              borderLeft: `3px solid ${fresh}`,
                            }}
                          >
                            <div
                              className="pointer-events-none absolute inset-0 opacity-60"
                              style={{
                                background: `radial-gradient(ellipse 60% 70% at 0% 0%, ${fresh}18, transparent 55%)`,
                              }}
                              aria-hidden
                            />
                            <div className="relative z-[1]">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-mono text-xs font-semibold text-[#378ADD]">
                                  {lot.numero}
                                </p>
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{
                                    background: fresh,
                                    boxShadow: `0 0 8px ${fresh}88`,
                                  }}
                                  title="Indicateur de fraîcheur"
                                />
                              </div>
                              <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
                                {lot.article?.libelle}
                              </p>
                              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                                Qté :{" "}
                                <strong className="tabular-nums">
                                  {lot.quantiteRestante ?? lot.quantiteInitiale}
                                </strong>{" "}
                                {lot.article?.unite || ""}
                              </p>
                              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                Réception : {formatDate(lot.dateFabrication)}
                                {lot.dateExpiration
                                  ? ` · Exp. ${formatDate(lot.dateExpiration)}`
                                  : ""}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </DetailCard>
          </motion.div>
        ) : null}
      </div>

      {confirmOpen ? (
        <ConfirmModal
          title="Confirmer la commande"
          message={`Confirmer l'achat ${achat.reference} ? Le stock sera mis à jour et des lots seront créés automatiquement.`}
          confirmLabel="Confirmer la commande"
          loading={confirmMutation.isPending}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => confirmMutation.mutate()}
        />
      ) : null}

      <AnimatePresence>
        {retourOpen ? (
          <RetourFournisseurModal
            open={retourOpen}
            onClose={() => setRetourOpen(false)}
            achat={achat}
          />
        ) : null}
      </AnimatePresence>

      {capacityError ? (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center p-4"
          style={{ background: "rgba(11, 31, 58, 0.45)", backdropFilter: "blur(5px)" }}
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setCapacityError(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
            style={{
              background: "var(--bg-card)",
              borderColor: `color-mix(in srgb, ${DANGER} 40%, var(--border-default))`,
              borderLeft: `3px solid ${DANGER}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 border-b px-5 py-4"
              style={{
                borderColor: `color-mix(in srgb, ${DANGER} 25%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in srgb, ${DANGER} 14%, transparent), transparent)`,
              }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
                style={{ background: DANGER }}
              >
                <IconAlertTriangle size={18} />
              </span>
              <h3 className="text-base font-semibold" style={{ color: DANGER }}>
                Capacité dépôt dépassée
              </h3>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--text-secondary)]">{capacityError}</p>
              <p className="text-sm text-[var(--text-muted)]">
                Choisissez un autre dépôt ou réduisez les quantités.
              </p>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCapacityError(null)}
                  className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
