import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock3, Loader2, Mail, ShieldAlert, X } from "lucide-react";
import { avatarColorForUser, roleLabel, userInitials } from "../adminTheme";

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function PendingUserCard({ user, busy, approving, rejecting, onApprove, onReject, index }) {
  const reduceMotion = useReducedMotion();
  const colors = avatarColorForUser(user);
  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || "—";

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.28 }}
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "color-mix(in srgb, #BA7517 35%, var(--border-default))",
        background: "var(--bg-card)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
        style={{
          borderColor: "var(--border-default)",
          background: "linear-gradient(90deg, rgba(186,117,23,0.14), transparent 70%)",
        }}
      >
        <div className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: "#BA7517" }}>
          <Clock3 className="h-3.5 w-3.5" />
          En attente de validation
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">{formatDate(user.createdAt)}</span>
      </div>

      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
            style={{ background: colors.bg, boxShadow: `0 8px 18px ${colors.bg}55` }}
          >
            {userInitials(user)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{fullName}</h3>
            <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold"
                style={{ background: "rgba(127,119,221,0.16)", color: "#7F77DD" }}
              >
                {roleLabel(user.role)}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium"
                style={{ background: "rgba(55,138,221,0.12)", color: "#378ADD" }}
              >
                <Mail className="h-3 w-3" />
                Notification e-mail
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition disabled:opacity-45 lg:flex-none"
            style={{
              borderColor: "rgba(226,75,74,0.5)",
              color: "#E24B4A",
              background: "rgba(226,75,74,0.08)",
            }}
          >
            {busy && rejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            Rejeter + e-mail
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-45 lg:flex-none"
            style={{
              background: "linear-gradient(135deg, #1D9E75 0%, #168a65 100%)",
              boxShadow: "0 8px 18px rgba(29,158,117,0.28)",
            }}
          >
            {busy && approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Accepter + e-mail
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export default function PendingUsersPanel({
  users,
  isLoading,
  isError,
  errorMessage,
  actionBusyId,
  approving,
  rejecting,
  onApprove,
  onReject,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div
        className="rounded-2xl border px-4 py-4 sm:px-5"
        style={{
          borderColor: "color-mix(in srgb, #BA7517 30%, var(--border-default))",
          background:
            "linear-gradient(135deg, rgba(186,117,23,0.12) 0%, color-mix(in srgb, var(--bg-card) 92%, transparent) 55%)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(186,117,23,0.18)", color: "#BA7517" }}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Validation des inscriptions</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-secondary)]">
                Ces comptes n&apos;apparaissent pas dans la liste principale tant qu&apos;ils n&apos;ont pas été
                acceptés. L&apos;e-mail est envoyé automatiquement après votre décision.
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ background: "#E24B4A" }}
          >
            {users.length} en attente
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center rounded-2xl border border-[var(--border-default)] py-14">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
        </div>
      ) : isError ? (
        <p className="rounded-2xl border border-[var(--accent-danger)]/40 bg-[var(--accent-danger)]/10 px-4 py-3 text-sm text-[var(--accent-danger)]">
          Impossible de charger. {errorMessage}
        </p>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-default)] px-6 py-14 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "rgba(29,158,117,0.12)", color: "#1D9E75" }}
          >
            <Check className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">Aucune demande en cours</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Les nouvelles inscriptions staff apparaîtront ici pour validation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u, index) => (
            <PendingUserCard
              key={u.id}
              user={u}
              index={index}
              busy={actionBusyId === u.id}
              approving={approving}
              rejecting={rejecting}
              onApprove={() => {
                if (window.confirm(`Accepter le compte de ${u.prenom} ${u.nom} et envoyer l'e-mail d'activation ?`)) {
                  onApprove(u.id);
                }
              }}
              onReject={() => {
                if (window.confirm(`Rejeter le compte de ${u.prenom} ${u.nom} et envoyer un e-mail de refus ?`)) {
                  onReject(u.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}
