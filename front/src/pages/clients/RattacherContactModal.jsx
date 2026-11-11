import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, UserPlus, X } from "lucide-react";
import api, { getAxiosErrorMessage } from "../../services/api";
import FormFieldError from "../../components/ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { rattacherContactSchema } from "../../validation";

export default function RattacherContactModal({ open, clientId, onClose, onAttached }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");

  const values = useMemo(() => ({ utilisateurId: selectedId }), [selectedId]);
  const { errors, validate, isValid, clearError, clearErrors } = useFormValidation(
    rattacherContactSchema,
    values
  );

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["utilisateurs-en-attente"],
    queryFn: () => api.get("clients/utilisateurs-en-attente").then((r) => r.data),
    enabled: open,
  });

  const attachMutation = useMutation({
    mutationFn: (utilisateurId) =>
      api.post(`clients/${clientId}/rattacher-utilisateur`, { utilisateurId }).then((r) => r.data),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["utilisateurs-en-attente"] });
      onAttached?.(row);
      setSelectedId(null);
      setError("");
      clearErrors();
      onClose?.();
    },
    onError: (err) => {
      setError(getAxiosErrorMessage(err, "Impossible de rattacher ce contact"));
    },
  });

  function handleClose() {
    if (attachMutation.isPending) return;
    setSelectedId(null);
    setError("");
    clearErrors();
    onClose?.();
  }

  function handleAttach() {
    if (!validate()) return;
    attachMutation.mutate(selectedId);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rattacher-backdrop"
          role="presentation"
          className="fixed inset-0 z-[220] flex items-center justify-center p-4"
          style={{
            background: "rgba(13, 17, 36, 0.55)",
            backdropFilter: "blur(8px)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rattacher-contact-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              borderColor: "rgba(255, 255, 255, 0.18)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
              backdropFilter: "blur(18px)",
            }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-start justify-between border-b px-5 py-4"
              style={{
                borderColor: "rgba(255,255,255,0.12)",
                background: "var(--bg-modal, rgba(15,23,42,0.92))",
              }}
            >
              <div>
                <h2
                  id="rattacher-contact-title"
                  className="text-base font-semibold"
                  style={{ color: "var(--text-primary, #f8fafc)" }}
                >
                  Rattacher un contact
                </h2>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary, #94a3b8)" }}>
                  Comptes clients en attente de validation
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{
                  borderColor: "var(--border-default, rgba(255,255,255,0.15))",
                  color: "var(--text-secondary, #94a3b8)",
                }}
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4" style={{ background: "var(--bg-modal, rgba(15,23,42,0.92))" }}>
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-muted, #64748b)" }} />
                </div>
              ) : pending.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "var(--text-secondary, #94a3b8)" }}>
                  Aucun compte en attente pour le moment.
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {pending.map((u) => {
                    const selected = selectedId === u.id;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(u.id);
                            clearError("utilisateurId");
                            setError("");
                          }}
                          className="w-full rounded-xl border px-3 py-3 text-left transition-colors"
                          style={{
                            borderColor: selected
                              ? "var(--accent-primary, #4F8EF7)"
                              : errors.utilisateurId
                                ? "rgba(226,75,74,0.65)"
                                : "var(--border-default, rgba(255,255,255,0.12))",
                            background: selected
                              ? "rgba(79, 142, 247, 0.12)"
                              : "rgba(255,255,255,0.03)",
                          }}
                        >
                          <p className="text-sm font-medium" style={{ color: "var(--text-primary, #f8fafc)" }}>
                            {[u.prenom, u.nom].filter(Boolean).join(" ") || "—"}
                          </p>
                          <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary, #94a3b8)" }}>
                            {u.email}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <FormFieldError message={errors.utilisateurId} />
              {error ? (
                <p className="mt-3 text-xs" style={{ color: "var(--accent-danger, #f87171)" }}>
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border px-3 py-2 text-xs font-medium"
                  style={{
                    borderColor: "var(--border-default, rgba(255,255,255,0.15))",
                    color: "var(--text-secondary, #94a3b8)",
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={!isValid || attachMutation.isPending}
                  onClick={handleAttach}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-45"
                  style={{ background: "var(--accent-primary, #4F8EF7)" }}
                >
                  {attachMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Rattacher
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
