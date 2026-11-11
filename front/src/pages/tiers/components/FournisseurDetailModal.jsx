import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Ban,
  CheckCircle,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  User,
  X,
} from "lucide-react";
import api from "../../../services/api";
import { hasPermission } from "../../../security/permissions";
import { useAuthStore } from "../../../store/authStore";
import TierStatusBadge from "./TierStatusBadge";
import ConfirmToggleTierModal from "./ConfirmToggleTierModal";
import TierMapPreview, { hasTierLocation } from "./TierMapPreview";
import { fmtDate, fmtTnd, nextActifValue } from "./tiersUtils";
import { TIERS_ACCENT, TIERS_CYAN } from "./tiersTheme";

function StatTile({ label, value, color = TIERS_ACCENT, index = 0 }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border p-3"
      style={{
        borderColor: "color-mix(in srgb, #378ADD 18%, var(--border-default))",
        background:
          "linear-gradient(160deg, color-mix(in srgb, #378ADD 6%, var(--bg-card)), var(--bg-card))",
      }}
    >
      <span className="absolute inset-y-2 left-0 w-[3px] rounded-full" style={{ background: color }} />
      <p className="pl-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 pl-2.5 text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </motion.div>
  );
}

export default function FournisseurDetailModal({ fournisseurId, onClose, onEdit, onTierUpdated }) {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, "achats:write");
  const [histPage, setHistPage] = useState(1);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const open = fournisseurId != null;

  const { data: fournisseur, isLoading, isError } = useQuery({
    queryKey: ["fournisseur", fournisseurId],
    queryFn: () => api.get(`fournisseurs/${fournisseurId}`).then((r) => r.data),
    enabled: open,
  });

  const { data: stats } = useQuery({
    queryKey: ["fournisseur-stats", fournisseurId],
    queryFn: () => api.get(`fournisseurs/${fournisseurId}/stats`).then((r) => r.data),
    enabled: open,
  });

  const { data: historique, isLoading: histLoading } = useQuery({
    queryKey: ["fournisseur-historique", fournisseurId, histPage],
    queryFn: () =>
      api
        .get(`fournisseurs/${fournisseurId}/historique-achats`, { params: { page: histPage, limit: 10 } })
        .then((r) => r.data),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleToggleActif(tier, nextActif) {
    const updated = await api.patch(`fournisseurs/${tier.id}`, { nom: tier.nom, actif: nextActif });
    onTierUpdated?.(updated.data);
    qc.invalidateQueries({ queryKey: ["fournisseur", fournisseurId] });
    setConfirmToggle(null);
  }

  function handleClose() {
    setHistPage(1);
    onClose();
  }

  const dernierAchat = stats?.derniersAchats?.[0];

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="fournisseur-detail-backdrop"
            role="presentation"
            className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto p-4"
            style={{ background: "rgba(11, 31, 58, 0.38)", backdropFilter: "blur(3px)" }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) handleClose();
            }}
          >
            <motion.div
              className="relative my-4 w-full max-w-3xl overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                background: "var(--bg-modal)",
                borderColor: "color-mix(in srgb, #378ADD 25%, var(--border-default))",
                boxShadow: "0 28px 60px -28px rgba(11, 31, 58, 0.55)",
              }}
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative border-b px-6 py-5 pr-14"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, #0B1F3A 90%, #378ADD), #0B1F3A 60%, color-mix(in srgb, #0B1F3A 88%, #0EA5E9))",
                }}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                  style={{
                    background: `linear-gradient(90deg, #0B1F3A, ${TIERS_ACCENT}, ${TIERS_CYAN}, #67E8F9)`,
                  }}
                />
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>

                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
                  </div>
                ) : isError || !fournisseur ? (
                  <p className="text-sm text-rose-300">Fournisseur introuvable.</p>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
                        style={{
                          background: `linear-gradient(145deg, ${TIERS_ACCENT}, ${TIERS_CYAN})`,
                          boxShadow: "0 10px 24px -10px rgba(55,138,221,0.7)",
                        }}
                      >
                        {(fournisseur.nom || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{fournisseur.nom}</h2>
                        <p className="mt-1 font-mono text-xs text-sky-200/80">{fournisseur.code}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <TierStatusBadge actif={fournisseur.actif} />
                          {dernierAchat && (
                            <span className="text-xs text-white/55">
                              Dernier achat : {fmtDate(dernierAchat.dateCommande)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleClose();
                            onEdit?.(fournisseur);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmToggle({
                              tier: fournisseur,
                              nextActif: nextActifValue(fournisseur.actif),
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          {fournisseur.actif !== false ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          {fournisseur.actif !== false ? "Désactiver" : "Réactiver"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {fournisseur && (
                <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile index={0} label="Achats (année)" value={fmtTnd(stats?.totalAnnee)} />
                    <StatTile index={1} label="Achats (mois)" value={fmtTnd(stats?.totalMois)} color={TIERS_CYAN} />
                    <StatTile index={2} label="Commandes" value={stats?.nbCommandes ?? 0} color="#1D9E75" />
                    <StatTile
                      index={3}
                      label="Non réglé"
                      value={fmtTnd(stats?.montantNonRegle)}
                      color="#EF9F27"
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border-default)] p-4">
                      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Coordonnées</h3>
                      <dl className="space-y-2.5 text-sm">
                        {[
                          {
                            icon: MapPin,
                            label: "Adresse",
                            value:
                              [fournisseur.adresse, fournisseur.ville, fournisseur.pays]
                                .filter(Boolean)
                                .join(", ") || "—",
                          },
                          { icon: Phone, label: "Téléphone", value: fournisseur.telephone || "—" },
                          { icon: Mail, label: "Email", value: fournisseur.email || "—" },
                          { icon: User, label: "Contact", value: fournisseur.contact || "—" },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="flex gap-2.5">
                            <span
                              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: "rgba(55,138,221,0.12)", color: TIERS_ACCENT }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <dt className="text-[11px] text-[var(--text-muted)]">{label}</dt>
                              <dd className="text-[var(--text-primary)]">{value}</dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="rounded-xl border border-[var(--border-default)] p-4">
                      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Indicateurs</h3>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-[11px] text-[var(--text-muted)]">Délai livraison</dt>
                          <dd className="font-semibold text-[var(--text-primary)]">
                            {stats?.delaiMoyenLivraison != null ? `${stats.delaiMoyenLivraison} j` : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[var(--text-muted)]">Taux réception</dt>
                          <dd className="font-semibold text-[var(--text-primary)]">
                            {stats?.tauxReception ?? 0}%
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[var(--text-muted)]">Remise</dt>
                          <dd className="font-semibold text-[var(--text-primary)]">
                            {fournisseur.tauxRemise != null ? `${fournisseur.tauxRemise}%` : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-[var(--text-muted)]">Paiement</dt>
                          <dd className="font-semibold text-[var(--text-primary)]">
                            {fournisseur.delaiPayment != null ? `${fournisseur.delaiPayment} j` : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-default)] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Localisation</h3>
                    {hasTierLocation(fournisseur.latitude, fournisseur.longitude) ? (
                      <TierMapPreview
                        latitude={Number(fournisseur.latitude)}
                        longitude={Number(fournisseur.longitude)}
                        nom={fournisseur.nom}
                        ville={fournisseur.ville}
                        pays={fournisseur.pays}
                      />
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">Localisation non renseignée</p>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
                    <div
                      className="border-b px-4 py-2.5 text-sm font-semibold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #0B1F3A, color-mix(in srgb, #0B1F3A 80%, #378ADD))",
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      Historique des achats
                    </div>
                    {histLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                            <th className="px-4 py-2">Réf.</th>
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2">Statut</th>
                            <th className="px-4 py-2 text-right">TTC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(historique?.items ?? []).map((a) => (
                            <tr key={a.id} className="border-t border-[var(--border-default)]">
                              <td className="px-4 py-2">
                                <Link
                                  to={`/achats/${a.id}`}
                                  className="font-medium hover:underline"
                                  style={{ color: TIERS_ACCENT }}
                                  onClick={handleClose}
                                >
                                  {a.reference}
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-[var(--text-muted)]">
                                {fmtDate(a.dateCommande)}
                              </td>
                              <td className="px-4 py-2 text-[var(--text-muted)]">{a.statut}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">
                                {fmtTnd(a.totalTTC)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {(historique?.pages ?? 1) > 1 && (
                      <div className="flex justify-between border-t border-[var(--border-default)] px-4 py-2 text-xs">
                        <button
                          type="button"
                          disabled={histPage <= 1}
                          onClick={() => setHistPage((p) => p - 1)}
                          className="disabled:opacity-40"
                          style={{ color: TIERS_ACCENT }}
                        >
                          ← Préc.
                        </button>
                        <span className="text-[var(--text-muted)]">
                          {histPage}/{historique.pages}
                        </span>
                        <button
                          type="button"
                          disabled={histPage >= historique.pages}
                          onClick={() => setHistPage((p) => p + 1)}
                          className="disabled:opacity-40"
                          style={{ color: TIERS_ACCENT }}
                        >
                          Suiv. →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ConfirmToggleTierModal
        tier={confirmToggle?.tier}
        tierType="fournisseur"
        nextActif={confirmToggle?.nextActif}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleActif}
      />
    </>
  );
}
