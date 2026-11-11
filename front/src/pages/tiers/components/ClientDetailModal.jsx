import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Loader2,
  Mail,
  MapPin,
  Phone,
  User,
  UserPlus,
  X,
  Pencil,
  Ban,
  CheckCircle,
} from "lucide-react";
import api from "../../../services/api";
import { hasPermission } from "../../../security/permissions";
import { useAuthStore } from "../../../store/authStore";
import RattacherContactModal from "../../clients/RattacherContactModal";
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
      <span
        className="absolute inset-y-2 left-0 w-[3px] rounded-full"
        style={{ background: color }}
      />
      <p className="pl-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-1 pl-2.5 text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </motion.div>
  );
}

export default function ClientDetailModal({ clientId, onClose, onEdit, onTierUpdated }) {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const canWrite = hasPermission(user?.role, "ventes:write");
  const canAttach = hasPermission(user?.role, "clients:write");
  const [histPage, setHistPage] = useState(1);
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [showRattacher, setShowRattacher] = useState(false);

  const open = clientId != null;

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => api.get(`clients/${clientId}`).then((r) => r.data),
    enabled: open,
  });

  const { data: stats } = useQuery({
    queryKey: ["client-stats", clientId],
    queryFn: () => api.get(`clients/${clientId}/stats`).then((r) => r.data),
    enabled: open,
  });

  const { data: encours } = useQuery({
    queryKey: ["client-encours", clientId],
    queryFn: () => api.get(`clients/${clientId}/encours`).then((r) => r.data),
    enabled: open,
  });

  const { data: historique, isLoading: histLoading } = useQuery({
    queryKey: ["client-historique", clientId, histPage],
    queryFn: () =>
      api.get(`clients/${clientId}/historique-ventes`, { params: { page: histPage, limit: 10 } }).then((r) => r.data),
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

  const relancerMutation = useMutation({
    mutationFn: () => api.post(`clients/${clientId}/relancer`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-encours", clientId] }),
  });

  async function handleToggleActif(tier, nextActif) {
    const updated = await api.patch(`clients/${tier.id}`, { nom: tier.nom, actif: nextActif });
    onTierUpdated?.(updated.data);
    qc.invalidateQueries({ queryKey: ["client", clientId] });
    setConfirmToggle(null);
  }

  function handleClose() {
    setHistPage(1);
    onClose();
  }

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="client-detail-backdrop"
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
                  style={{ background: `linear-gradient(90deg, #0B1F3A, ${TIERS_ACCENT}, ${TIERS_CYAN}, #67E8F9)` }}
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
                ) : isError || !client ? (
                  <p className="text-sm text-rose-300">Client introuvable.</p>
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
                        {(client.nom || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{client.nom}</h2>
                        <p className="mt-1 font-mono text-xs text-sky-200/80">{client.code}</p>
                        <div className="mt-3">
                          <TierStatusBadge actif={client.actif} />
                        </div>
                      </div>
                    </div>
                    {canWrite && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleClose();
                            onEdit?.(client);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmToggle({ tier: client, nextActif: nextActifValue(client.actif) })
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                        >
                          {client.actif !== false ? (
                            <Ban className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          {client.actif !== false ? "Désactiver" : "Réactiver"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {client && (
                <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile index={0} label="CA année" value={fmtTnd(stats?.caAnnee)} color={TIERS_ACCENT} />
                    <StatTile index={1} label="CA mois" value={fmtTnd(stats?.caMois)} color={TIERS_CYAN} />
                    <StatTile index={2} label="Ventes" value={stats?.nbVentes ?? 0} color="#1D9E75" />
                    <StatTile index={3} label="Impayé" value={fmtTnd(stats?.montantImpaye)} color="#EF9F27" />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border-default)] p-4">
                      <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Coordonnées</h3>
                      <dl className="space-y-2.5 text-sm">
                        {[
                          {
                            icon: MapPin,
                            label: "Adresse",
                            value: [client.adresse, client.ville, client.pays].filter(Boolean).join(", ") || "—",
                          },
                          { icon: Phone, label: "Téléphone", value: client.telephone || "—" },
                          { icon: Mail, label: "Email", value: client.email || "—" },
                          { icon: User, label: "Contact", value: client.contact || "—" },
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
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Encours</h3>
                        {canWrite && Number(encours?.total) > 0 && (
                          <button
                            type="button"
                            disabled={relancerMutation.isPending}
                            onClick={() => relancerMutation.mutate()}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                            style={{ background: "#f59e0b" }}
                          >
                            <Mail className="h-3 w-3" />
                            {relancerMutation.isPending ? "Envoi…" : "Relancer"}
                          </button>
                        )}
                      </div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--commerce-warning)" }}>
                        {fmtTnd(encours?.total)}
                      </p>
                      {(encours?.ventes ?? []).slice(0, 4).map((v) => (
                        <div key={v.id} className="mt-2 flex justify-between text-xs text-[var(--text-muted)]">
                          <span>{v.reference}</span>
                          <span className="tabular-nums">{fmtTnd(v.solde)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-default)] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Localisation</h3>
                    {hasTierLocation(client.latitude, client.longitude) ? (
                      <TierMapPreview
                        latitude={Number(client.latitude)}
                        longitude={Number(client.longitude)}
                        nom={client.nom}
                        ville={client.ville}
                        pays={client.pays}
                      />
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">Localisation non renseignée</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--border-default)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Contacts rattachés</h3>
                      {canAttach && (
                        <button
                          type="button"
                          onClick={() => setShowRattacher(true)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white"
                          style={{ background: TIERS_ACCENT }}
                        >
                          <UserPlus className="h-3 w-3" />
                          Rattacher
                        </button>
                      )}
                    </div>
                    {(client.utilisateurs ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">Aucun contact rattaché pour le moment.</p>
                    ) : (
                      <ul className="space-y-2">
                        {(client.utilisateurs ?? []).map((u) => (
                          <li
                            key={u.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                            style={{ borderColor: "var(--border-default)" }}
                          >
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {[u.prenom, u.nom].filter(Boolean).join(" ") || "—"}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                            </div>
                            <span
                              className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{ background: "rgba(55,138,221,0.12)", color: TIERS_ACCENT }}
                            >
                              {u.role}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-xl border border-[var(--border-default)]">
                    <div
                      className="border-b px-4 py-2.5 text-sm font-semibold text-white"
                      style={{
                        background: "linear-gradient(135deg, #0B1F3A, color-mix(in srgb, #0B1F3A 80%, #378ADD))",
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      Historique des ventes
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
                            <th className="px-4 py-2 text-right">TTC</th>
                            <th className="px-4 py-2 text-right">Solde</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(historique?.items ?? []).map((v) => (
                            <tr key={v.id} className="border-t border-[var(--border-default)]">
                              <td className="px-4 py-2">
                                <Link
                                  to={`/ventes/${v.id}`}
                                  className="font-medium hover:underline"
                                  style={{ color: TIERS_ACCENT }}
                                  onClick={handleClose}
                                >
                                  {v.reference}
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-[var(--text-muted)]">{fmtDate(v.dateVente)}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-[var(--text-primary)]">
                                {fmtTnd(v.totalTTC)}
                              </td>
                              <td
                                className="px-4 py-2 text-right tabular-nums"
                                style={{ color: "var(--commerce-warning)" }}
                              >
                                {fmtTnd(v.solde)}
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
        tierType="client"
        nextActif={confirmToggle?.nextActif}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleActif}
      />

      <RattacherContactModal
        open={showRattacher}
        clientId={clientId}
        onClose={() => setShowRattacher(false)}
        onAttached={() => qc.invalidateQueries({ queryKey: ["client", clientId] })}
      />
    </>
  );
}
