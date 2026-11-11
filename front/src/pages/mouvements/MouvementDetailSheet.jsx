import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  RotateCcw,
  ShoppingCart,
  AlertTriangle,
  PackageX,
  Activity,
  X,
} from "lucide-react";
import ArticleAvatar from "../../components/ui/ArticleAvatar";
import { useAuthStore } from "../../store/authStore";
import { invaliderApresMouvement, rejeterMouvement, validerMouvement } from "../../services/mouvements";
import {
  effetStockApplique,
  estAuteurMouvement,
  messageErreurDecision,
  peutRejeterMouvement,
  peutValiderMouvement,
} from "./validationMouvement";

const TYPE_CONFIG = {
  ENTREE_ACHAT: { label: "Achat", group: "ENTREE", Icon: ArrowDownLeft },
  ENTREE_RETOUR_CLIENT: { label: "Retour client", group: "ENTREE", Icon: RotateCcw },
  ENTREE_AJUSTEMENT: { label: "Ajustement +", group: "ENTREE", Icon: Plus },
  SORTIE_VENTE: { label: "Vente", group: "SORTIE", Icon: ShoppingCart },
  SORTIE_PERTE: { label: "Perte", group: "SORTIE", Icon: AlertTriangle },
  SORTIE_CASSE: { label: "Casse", group: "SORTIE", Icon: PackageX },
  SORTIE_AUTRE: { label: "Sortie autre", group: "SORTIE", Icon: ArrowUpRight },
  TRANSFERT: { label: "Transfert dépôt", group: "TRANSFERT", Icon: ArrowLeftRight },
  TRANSFERT_EMPLACEMENT: { label: "Transfert emplacement", group: "TRANSFERT", Icon: MapPin },
};

const GROUP_THEME = {
  ENTREE: {
    accent: "var(--accent-success)",
    bg: "color-mix(in srgb, var(--accent-success) 14%, transparent)",
    text: "var(--accent-success)",
  },
  SORTIE: {
    accent: "var(--accent-danger)",
    bg: "color-mix(in srgb, var(--accent-danger) 14%, transparent)",
    text: "var(--accent-danger)",
  },
  TRANSFERT: {
    accent: "var(--accent-info, #378ADD)",
    bg: "color-mix(in srgb, var(--accent-info, #378ADD) 14%, transparent)",
    text: "var(--accent-info, #378ADD)",
  },
};

const STATUS = {
  VALIDE: { label: "Validé", color: "var(--accent-success)" },
  EN_ATTENTE_VALIDATION: { label: "En attente", color: "var(--accent-warning)" },
  REJETE: { label: "Rejeté", color: "var(--accent-danger)" },
};

function formatQty(value) {
  return Number(value || 0).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(value) {
  if (value == null || value === "" || Number.isNaN(Number(value))) return null;
  return new Intl.NumberFormat("fr-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function parseLots(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function personName(user) {
  if (!user) return "—";
  const name = [user.prenom, user.nom].filter(Boolean).join(" ");
  return name || user.email || "—";
}

function initials(user) {
  if (!user) return "?";
  const parts = [user.prenom, user.nom].filter(Boolean);
  if (parts.length === 0) return (user.email?.[0] ?? "?").toUpperCase();
  return parts
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashColor(seed = "") {
  const colors = ["#378ADD", "#7F77DD", "#1D9E75", "#BA7517", "#E24B4A", "#0F6E56"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function placeTitle(depot) {
  return depot?.libelle || depot?.code || "—";
}

function placeCode(depot) {
  if (!depot?.code || depot.code === depot.libelle) return null;
  return depot.code;
}

export function MouvementStatutBadge({ statut }) {
  if (!statut || statut === "VALIDE") return null;
  const status = STATUS[statut];
  if (!status) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${status.color} 16%, transparent)`,
        color: status.color,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
      {status.label}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="px-5 py-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-[var(--text-primary)]">{children}</dd>
    </div>
  );
}

function PlaceCard({ kicker, depot, emplacement }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{kicker}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{placeTitle(depot)}</p>
      {placeCode(depot) ? (
        <p className="font-mono text-[11px] text-[var(--text-muted)]">{placeCode(depot)}</p>
      ) : null}
      {emplacement ? (
        <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{emplacement.libelle || emplacement.code}</span>
        </p>
      ) : null}
    </div>
  );
}

export default function MouvementDetailSheet({ mouvement, onClose, onToast }) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const [copied, setCopied] = useState(false);
  const [rejetOuvert, setRejetOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [decisionErreur, setDecisionErreur] = useState("");
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!mouvement) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, [mouvement]);

  useEffect(() => {
    setCopied(false);
    setRejetOuvert(false);
    setMotif("");
    setDecisionErreur("");
  }, [mouvement?.id]);

  const valider = useMutation({
    mutationFn: () => validerMouvement(mouvement.id),
    onSuccess: () => {
      setDecisionErreur("");
      invaliderApresMouvement(qc);
      onToast?.("Mouvement validé.");
    },
    onError: (error) => {
      setDecisionErreur(messageErreurDecision(error));
      invaliderApresMouvement(qc);
    },
  });

  const rejeter = useMutation({
    mutationFn: () => rejeterMouvement(mouvement.id, motif),
    onSuccess: () => {
      setDecisionErreur("");
      setRejetOuvert(false);
      invaliderApresMouvement(qc);
      onToast?.("Mouvement rejeté.");
    },
    onError: (error) => {
      setDecisionErreur(messageErreurDecision(error));
      invaliderApresMouvement(qc);
    },
  });

  const cfg = TYPE_CONFIG[mouvement?.type] || {
    label: mouvement?.type || "Mouvement",
    group: "TRANSFERT",
    Icon: Activity,
  };
  const theme = GROUP_THEME[cfg.group] || GROUP_THEME.TRANSFERT;
  const TypeIcon = cfg.Icon;
  const isEntree = cfg.group === "ENTREE";
  const isSortie = cfg.group === "SORTIE";
  const stockApplique = effetStockApplique(mouvement?.statut);
  const sign = stockApplique ? (isEntree ? "+" : isSortie ? "−" : "") : "";
  const peutValider = peutValiderMouvement(user, mouvement);
  const peutRejeter = peutRejeterMouvement(user, mouvement);
  const explicationAuteur =
    mouvement?.statut === "EN_ATTENTE_VALIDATION" &&
    peutRejeter &&
    !peutValider &&
    estAuteurMouvement(user, mouvement)
      ? "Vous ne pouvez pas valider votre propre mouvement."
      : "";
  const status = STATUS[mouvement?.statut] || {
    label: mouvement?.statut || "Validé",
    color: "var(--accent-success)",
  };
  const lots = parseLots(mouvement?.lotsDetail);
  const singleLot = lots[0]?.lotNumero || mouvement?.lot?.numero;
  const money = formatMoney(mouvement?.valeur);
  const hasRoute = Boolean(mouvement?.depotDest || mouvement?.emplacementDest);
  const userSeed = mouvement?.utilisateur?.nom || mouvement?.utilisateur?.email || "";

  async function copyReference() {
    const reference = mouvement?.reference;
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AnimatePresence>
      {mouvement ? (
        <motion.div className="fixed inset-0 z-[220] flex justify-end" role="presentation">
          <motion.button
            type="button"
            aria-label="Fermer le détail"
            className="absolute inset-0 cursor-default border-0"
            style={{ background: "rgba(8, 10, 16, 0.48)", backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="mouvement-detail-title"
            className="relative z-10 flex h-full w-full max-w-[440px] flex-col border-l border-[var(--border-default)] bg-[var(--bg-app)] shadow-2xl"
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 380, damping: 38, mass: 0.8 }
            }
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-28"
              style={{
                background: `linear-gradient(180deg, color-mix(in srgb, ${theme.accent} 18%, transparent), transparent)`,
              }}
              aria-hidden
            />

            <header className="relative flex items-start justify-between gap-3 px-5 pb-2 pt-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Fiche mouvement
                </p>
                <h2 id="mouvement-detail-title" className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                  {cfg.label}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: theme.bg,
                      borderColor: `color-mix(in srgb, ${theme.accent} 35%, transparent)`,
                      color: theme.text,
                    }}
                  >
                    <TypeIcon size={12} />
                    {cfg.label}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${status.color} 16%, transparent)`,
                      color: status.color,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                    {status.label}
                  </span>
                </div>

                <div
                  className="mt-4 overflow-hidden rounded-2xl border px-4 py-4"
                  style={{
                    borderColor: `color-mix(in srgb, ${theme.accent} 28%, var(--border-default))`,
                    background: `linear-gradient(145deg, color-mix(in srgb, ${theme.accent} 12%, var(--bg-card)), var(--bg-card))`,
                  }}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Quantité</p>
                  <p
                    className="mt-1 font-mono text-3xl font-semibold tabular-nums"
                    style={{ color: stockApplique ? theme.text : "var(--text-secondary)" }}
                  >
                    {sign}
                    {formatQty(mouvement.quantite)}
                    {mouvement.article?.unite ? (
                      <span className="ml-2 text-sm font-medium text-[var(--text-secondary)]">
                        {mouvement.article.unite}
                      </span>
                    ) : null}
                  </p>
                  {mouvement.reference ? (
                    <button
                      type="button"
                      onClick={copyReference}
                      className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]/80 px-2.5 py-1 font-mono text-[11px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      title="Copier la référence"
                    >
                      <span className="truncate">{mouvement.reference}</span>
                      {copied ? <Check size={12} className="shrink-0 text-[var(--accent-success)]" /> : <Copy size={12} className="shrink-0" />}
                      <span className="sr-only">{copied ? "Référence copiée" : "Copier la référence"}</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="h-px bg-[var(--border-default)]" />

              <Section title="Article">
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3">
                  <ArticleAvatar article={mouvement.article} size={48} className="rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {mouvement.article?.libelle || "Article"}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                      {mouvement.article?.code || "—"}
                    </p>
                  </div>
                  <Package size={16} className="ml-auto shrink-0 text-[var(--text-muted)]" />
                </div>
              </Section>

              <div className="h-px bg-[var(--border-default)]" />

              <Section title={hasRoute ? "Trajet" : "Emplacement"}>
                {hasRoute ? (
                  <div className="flex items-stretch gap-2">
                    <PlaceCard kicker="Origine" depot={mouvement.depot} emplacement={mouvement.emplacement} />
                    <div className="flex w-7 shrink-0 items-center justify-center text-[var(--text-muted)]">
                      <ArrowRight size={16} />
                    </div>
                    <PlaceCard
                      kicker="Destination"
                      depot={mouvement.depotDest || mouvement.depot}
                      emplacement={mouvement.emplacementDest}
                    />
                  </div>
                ) : (
                  <PlaceCard kicker="Dépôt" depot={mouvement.depot} emplacement={mouvement.emplacement} />
                )}
              </Section>

              <div className="h-px bg-[var(--border-default)]" />

              <Section title="Traçabilité">
                {lots.length > 0 ? (
                  <ul className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]">
                    {lots.map((lot, index) => {
                      const expiry = formatShortDate(lot.dateExpiration);
                      return (
                        <li
                          key={lot.lotId ?? `${lot.lotNumero}-${index}`}
                          className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-3 py-2.5 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]">
                              {lot.lotNumero || `Lot #${lot.lotId}`}
                            </p>
                            {expiry ? (
                              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Exp. {expiry}</p>
                            ) : null}
                          </div>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                            {formatQty(lot.quantite)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : singleLot ? (
                  <p className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2.5 font-mono text-xs text-[var(--text-primary)]">
                    Lot {singleLot}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">Aucun lot rattaché à ce mouvement.</p>
                )}
              </Section>

              <div className="h-px bg-[var(--border-default)]" />

              <Section title="Commentaire">
                <div className="flex gap-2.5 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-3">
                  <MessageSquare size={15} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {mouvement.commentaire?.trim() || "Aucun commentaire."}
                  </p>
                </div>
              </Section>

              <div className="h-px bg-[var(--border-default)]" />

              <Section title="Journal">
                <dl>
                  <MetaRow label="Date">{formatWhen(mouvement.createdAt)}</MetaRow>
                  {money ? <MetaRow label="Valeur">{money}</MetaRow> : null}
                  <MetaRow label="Opérateur">
                    <span className="inline-flex items-center justify-end gap-2">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: hashColor(userSeed) }}
                      >
                        {initials(mouvement.utilisateur)}
                      </span>
                      <span className="truncate">{personName(mouvement.utilisateur)}</span>
                    </span>
                  </MetaRow>
                </dl>
              </Section>
            </div>

            <footer className="border-t border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-3">
              {peutValider || peutRejeter ? (
                <div className="space-y-2">
                  {explicationAuteur ? (
                    <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">{explicationAuteur}</p>
                  ) : null}
                  {decisionErreur ? (
                    <p role="alert" className="text-xs font-medium" style={{ color: "var(--accent-danger)" }}>
                      {decisionErreur}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {peutRejeter ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMotif("");
                          setDecisionErreur("");
                          setRejetOuvert(true);
                        }}
                        className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
                      >
                        Rejeter
                      </button>
                    ) : null}
                    {peutValider ? (
                      <button
                        type="button"
                        disabled={valider.isPending}
                        onClick={() => valider.mutate()}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: "var(--accent-primary)" }}
                      >
                        Valider
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                  Lecture seule. Ce mouvement fait partie du journal de stock et ne se modifie pas depuis cette fiche.
                </p>
              )}
            </footer>
            {rejetOuvert ? (
              <motion.div
                className="absolute inset-0 z-10 flex items-end bg-black/35 p-4"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="rejet-mouvement-titre"
              >
                <div className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                  <h3 id="rejet-mouvement-titre" className="text-sm font-semibold text-[var(--text-primary)]">
                    Rejeter le mouvement
                  </h3>
                  <label className="mt-3 block text-xs text-[var(--text-muted)]">
                    Motif du rejet (optionnel)
                    <textarea
                      value={motif}
                      onChange={(event) => setMotif(event.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </label>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejetOuvert(false)}
                      className="rounded-full border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={rejeter.isPending}
                      onClick={() => rejeter.mutate()}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--accent-danger)" }}
                    >
                      Confirmer le rejet
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
