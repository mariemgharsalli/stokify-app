import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Loader2,
  PackageX,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import KpiCard from "../../components/ui/KpiCard";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToast } from "../../hooks/useToast";

const DS = {
  blue: "#378ADD",
  teal: "#1D9E75",
  amber: "#BA7517",
  red: "#E24B4A",
  violet: "#7F77DD",
};

const STATUT_CFG = {
  EN_ATTENTE: {
    label: "En attente",
    color: DS.amber,
    cls: "bg-[#BA7517]/15 border-[#BA7517]/40 text-[#BA7517]",
  },
  NOTIFIE: {
    label: "Notifié",
    color: DS.blue,
    cls: "bg-[#378ADD]/15 border-[#378ADD]/40 text-[#378ADD]",
  },
  RETIRE: {
    label: "Retiré",
    color: DS.red,
    cls: "bg-[#E24B4A]/15 border-[#E24B4A]/40 text-[#E24B4A]",
  },
  CLOS: {
    label: "Clos",
    color: DS.teal,
    cls: "bg-[#1D9E75]/15 border-[#1D9E75]/40 text-[#1D9E75]",
  },
};

const CRITICITE = { EN_ATTENTE: 0, NOTIFIE: 1, RETIRE: 2, CLOS: 3 };

const easeOut = [0.16, 1, 0.3, 1];

function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("fr-FR");
}

function useCountUp(target, active, duration = 400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }
    const end = Number(target) || 0;
    if (end <= 0) {
      setValue(0);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(end * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

function ConfirmModal({ title, message, onClose, onConfirm, loading, accent = DS.red }) {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.55)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <motion.div
        className="glass w-full max-w-md rounded-xl p-6"
        style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.28, ease: easeOut }}
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm transition-colors duration-200 hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50"
            style={{ background: accent }}
          >
            {loading ? "…" : "Confirmer"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function RappelProduit() {
  const societeScope = useSocieteQueryScope();
  const toast = useToast();
  const qc = useQueryClient();
  const [statutFilter, setStatutFilter] = useState("");
  const [search, setSearch] = useState("");
  const [confirmLot, setConfirmLot] = useState(null);
  const [retireLot, setRetireLot] = useState(null);
  const [notifyLot, setNotifyLot] = useState(null);
  const [notifiedClients, setNotifiedClients] = useState([]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["lots-rappels", societeScope],
    queryFn: () => api.get("lots/rappels").then((r) => r.data),
  });

  const declencherMut = useMutation({
    mutationFn: (id) => api.post(`lots/${id}/rappel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lots-rappels"] });
      toast.success("Rappel déclenché");
      setConfirmLot(null);
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e)),
  });

  const notifierMut = useMutation({
    mutationFn: (id) => api.post(`lots/${id}/notifier`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["lots-rappels"] });
      const clients = res.data?.clients ?? [];
      setNotifiedClients(clients);
      toast.success(`Notification enregistrée (${clients.length} client(s))`);
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e)),
  });

  const statutMut = useMutation({
    mutationFn: ({ id, statut }) => api.put(`lots/${id}/statut-rappel`, { statut }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lots-rappels"] });
      toast.success("Statut mis à jour");
      setRetireLot(null);
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e)),
  });

  const filtered = useMemo(() => {
    let rows = data?.items || [];
    if (statutFilter) rows = rows.filter((l) => l.statutRappel === statutFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.numero?.toLowerCase().includes(q) ||
          l.article?.libelle?.toLowerCase().includes(q) ||
          l.article?.code?.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const ca = CRITICITE[a.statutRappel] ?? 9;
      const cb = CRITICITE[b.statutRappel] ?? 9;
      if (ca !== cb) return ca - cb;
      return String(a.numero || "").localeCompare(String(b.numero || ""));
    });
  }, [data, statutFilter, search]);

  const kpis = data?.kpis || {};
  const clientCount = useCountUp(notifiedClients.length, notifiedClients.length > 0);

  const closeNotify = () => {
    setNotifyLot(null);
    setNotifiedClients([]);
  };

  return (
    <PageShell title="Rappel produit" subtitle="Gestion des lots à rappeler et notifications clients">
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard title="Lots rappelés actifs" value={kpis.lotsRappelActifs ?? 0} icon={AlertTriangle} accentColor={DS.red} delayIndex={0} pulse />
        <KpiCard title="Clients à notifier" value={kpis.clientsANotifier ?? 0} icon={Users} accentColor={DS.amber} delayIndex={1} />
        <KpiCard title="Expirent sous 7j" value={kpis.expiring7 ?? 0} icon={Clock} accentColor={DS.amber} delayIndex={2} />
        <KpiCard title="Lots conformes" value={kpis.conformes ?? 0} icon={CheckCircle} accentColor={DS.teal} delayIndex={3} />
      </div>

      <div className="glass mb-4 flex flex-wrap gap-3 rounded-xl p-4">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher lot / article…"
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        >
          <option value="">Tous statuts rappel</option>
          {Object.keys(STATUT_CFG).map((k) => (
            <option key={k} value={k}>{STATUT_CFG[k].label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      ) : isError ? (
        <p className="p-6 text-[#E24B4A]">{getAxiosErrorMessage(error)}</p>
      ) : filtered.length === 0 ? (
        <motion.div
          className="glass flex flex-col items-center justify-center rounded-xl px-6 py-16 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: `color-mix(in srgb, ${DS.teal} 14%, transparent)`, color: DS.teal }}
          >
            <PackageX className="h-7 w-7" />
          </div>
          <p className="text-base font-medium text-[var(--text-primary)]">Aucun rappel en cours</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
            Les lots soumis à un rappel apparaîtront ici, triés par criticité.
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {filtered.map((lot) => {
            const st = lot.statutRappel ? STATUT_CFG[lot.statutRappel] : null;
            const border = st?.color || "var(--border-default)";
            const urgent = lot.statutRappel === "EN_ATTENTE";
            return (
              <motion.article
                key={lot.id}
                className="glass rounded-xl p-4 transition-colors duration-200 hover:bg-white/[0.03]"
                style={{
                  borderColor: `color-mix(in srgb, ${border} 55%, transparent)`,
                  boxShadow: urgent
                    ? `inset 0 0 0 1px color-mix(in srgb, ${DS.amber} 20%, transparent)`
                    : undefined,
                }}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-[var(--text-muted)]">{lot.numero}</p>
                    <h3 className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">
                      {lot.article?.libelle}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">{lot.article?.code}</p>
                  </div>
                  {urgent ? (
                    <AlertTriangle
                      className="h-5 w-5 shrink-0 animate-pulse"
                      style={{ color: DS.amber }}
                    />
                  ) : st ? (
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>
                      {st.label}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--text-muted)]">
                  <div>
                    <p className="uppercase tracking-wide opacity-70">Dépôt</p>
                    <p className="text-[var(--text-primary)]">{lot.depot?.code || "—"}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide opacity-70">Qté</p>
                    <p className="font-mono text-[var(--text-primary)]">
                      {Number(lot.quantiteRestante).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-wide opacity-70">Exp.</p>
                    <p className="text-[var(--text-primary)]">{fmtDate(lot.dateExpiration)}</p>
                  </div>
                </div>

                {urgent && st && (
                  <span className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-[11px] ${st.cls}`}>
                    {st.label}
                  </span>
                )}

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {!lot.statutRappel && (
                    <button
                      type="button"
                      onClick={() => setConfirmLot(lot)}
                      className="rounded-lg border px-2.5 py-1 text-[11px] transition-colors duration-200"
                      style={{
                        borderColor: `color-mix(in srgb, ${DS.red} 35%, transparent)`,
                        background: `color-mix(in srgb, ${DS.red} 12%, transparent)`,
                        color: DS.red,
                      }}
                    >
                      Déclencher
                    </button>
                  )}
                  {lot.statutRappel === "EN_ATTENTE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setNotifiedClients([]);
                        setNotifyLot(lot);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition-colors duration-200"
                      style={{
                        borderColor: `color-mix(in srgb, ${DS.blue} 35%, transparent)`,
                        background: `color-mix(in srgb, ${DS.blue} 12%, transparent)`,
                        color: DS.blue,
                      }}
                    >
                      <Bell className="h-3 w-3" />
                      Notifier
                    </button>
                  )}
                  {lot.statutRappel && !["RETIRE", "CLOS"].includes(lot.statutRappel) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setRetireLot(lot)}
                        className="rounded-lg border px-2.5 py-1 text-[11px]"
                        style={{
                          borderColor: `color-mix(in srgb, ${DS.amber} 35%, transparent)`,
                          color: DS.amber,
                        }}
                        title="Retirer du stock"
                      >
                        <Trash2 className="inline h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => statutMut.mutate({ id: lot.id, statut: "CLOS" })}
                        className="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
                      >
                        Clôturer
                      </button>
                    </>
                  )}
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}

      <div className="glass mt-6 rounded-xl p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">
          Timeline d&apos;audit (20 derniers événements)
        </h3>
        <ul className="space-y-3 border-l border-white/10 pl-4">
          {(data?.timeline || []).map((ev) => (
            <li key={ev.id} className="relative text-xs">
              <span
                className="absolute -left-[21px] top-1 h-2 w-2 rounded-full"
                style={{ background: DS.red }}
              />
              <span className="text-[var(--text-muted)]">
                {new Date(ev.createdAt).toLocaleString("fr-FR")}
              </span>
              <p className="text-[var(--text-primary)]">
                {ev.utilisateur?.prenom} {ev.utilisateur?.nom} — {ev.description || ev.action}
              </p>
            </li>
          ))}
          {!data?.timeline?.length && (
            <li className="text-[var(--text-muted)]">Aucun événement</li>
          )}
        </ul>
      </div>

      <AnimatePresence>
        {confirmLot && (
          <ConfirmModal
            title="Déclencher le rappel"
            message={`Confirmer le rappel pour le lot ${confirmLot.numero} (${confirmLot.article?.libelle}) ?`}
            onClose={() => setConfirmLot(null)}
            onConfirm={() => declencherMut.mutate(confirmLot.id)}
            loading={declencherMut.isPending}
            accent={DS.red}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {retireLot && (
          <ConfirmModal
            title="Retirer le lot"
            message={`Retirer du stock le lot ${retireLot.numero} (${retireLot.article?.libelle}) ?`}
            onClose={() => setRetireLot(null)}
            onConfirm={() => statutMut.mutate({ id: retireLot.id, statut: "RETIRE" })}
            loading={statutMut.isPending}
            accent={DS.amber}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notifyLot && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <motion.div
              className="glass w-full max-w-lg rounded-xl p-6"
              style={{ borderColor: `color-mix(in srgb, ${DS.blue} 45%, transparent)` }}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Notifier clients — lot {notifyLot.numero}
                </h3>
                <button type="button" onClick={closeNotify}>
                  <X className="h-5 w-5 text-[var(--text-muted)]" />
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Notifier les clients ayant réellement reçu ce lot (
                <strong className="text-[var(--text-primary)]">{notifyLot.article?.libelle}</strong>
                ).
              </p>

              {notifiedClients.length === 0 ? (
                <button
                  type="button"
                  disabled={notifierMut.isPending}
                  onClick={() => notifierMut.mutate(notifyLot.id)}
                  className="mt-4 w-full rounded-lg py-2 text-sm text-white disabled:opacity-50"
                  style={{ background: DS.blue }}
                >
                  {notifierMut.isPending ? "Envoi…" : "Envoyer notification email"}
                </button>
              ) : (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-[var(--text-primary)]">
                    <span className="font-semibold tabular-nums" style={{ color: DS.blue }}>
                      {clientCount}
                    </span>{" "}
                    client(s) notifié(s)
                  </p>
                  <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                    <AnimatePresence initial>
                      {notifiedClients.map((row, i) => (
                        <motion.li
                          key={`${row.client?.email || row.client?.nom}-${i}`}
                          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
                        >
                          <p className="font-medium text-[var(--text-primary)]">
                            {row.client?.nom || "Client"}
                          </p>
                          <p className="text-[var(--text-muted)]">
                            {row.client?.email || "—"}
                            {row.quantiteTotale != null ? ` · qté ${row.quantiteTotale}` : ""}
                          </p>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  <button
                    type="button"
                    onClick={closeNotify}
                    className="mt-4 w-full rounded-lg border border-white/15 py-2 text-sm text-[var(--text-primary)]"
                  >
                    Fermer
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
