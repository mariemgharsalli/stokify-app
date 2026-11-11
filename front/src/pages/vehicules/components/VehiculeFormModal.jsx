import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Truck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import TruckGlyph from "../../../components/ui/TruckGlyph";
import CapacityBar from "../../depots/components/CapacityBar";
import api from "../../../services/api";
import { useToast } from "../../../hooks/useToast";

const THEME = {
  accent: "#378ADD",
  cyan: "#0EA5E9",
};

const EASE = [0.22, 1, 0.36, 1];

const INPUT =
  "w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] transition focus:outline-none focus:border-[color-mix(in_srgb,#378ADD_55%,var(--border-default))] focus:shadow-[0_0_0_3px_rgba(55,138,221,0.18)]";

const EMPTY_FORM = {
  nom: "",
  immatriculation: "",
  capacitePoids: "",
  capaciteVolume: "",
};

function PreviewShell({ children }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-default)",
        borderLeft: `3px solid ${THEME.accent}`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${THEME.accent}18, transparent 55%)`,
        }}
        aria-hidden
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function VehiculeFormPreview({ poids, volume }) {
  const poidsNum = Number(poids) || 0;
  const volumeNum = Number(volume) || 0;
  const maxPoids = Math.max(poidsNum, 1000);
  const maxVolume = Math.max(volumeNum, 10);

  return (
    <PreviewShell>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Prévisualisation
      </p>
      <TruckGlyph active className="mx-auto mb-3" width={150} height={78} />
      <div className="space-y-2.5">
        <CapacityBar
          theme
          label="Poids max"
          value={poidsNum ? Math.min(100, (poidsNum / maxPoids) * 100) : 0}
          capacity={poidsNum || "—"}
          suffix="kg"
          height={6}
          animate={!!poidsNum}
        />
        <CapacityBar
          theme
          label="Volume max"
          value={volumeNum ? Math.min(100, (volumeNum / maxVolume) * 100) : 0}
          capacity={volumeNum || "—"}
          suffix="m³"
          height={6}
          animate={!!volumeNum}
        />
      </div>
    </PreviewShell>
  );
}

/**
 * Modal création / édition véhicule — réutilisable (flotte, optimisation chargement).
 */
export default function VehiculeFormModal({ open, onClose, editing = null, onSuccess }) {
  const qc = useQueryClient();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        nom: editing.nom || "",
        immatriculation: editing.immatriculation || "",
        capacitePoids: String(editing.capacitePoids ?? ""),
        capaciteVolume: String(editing.capaciteVolume ?? ""),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editing]);

  const saveMut = useMutation({
    mutationFn: (payload) => api.post("vehicules", payload),
    onSuccess: (res) => {
      toast.success("Véhicule créé");
      qc.invalidateQueries({ queryKey: ["vehicules"] });
      onSuccess?.(res.data);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`vehicules/${id}`, payload),
    onSuccess: (res) => {
      toast.success("Véhicule modifié");
      qc.invalidateQueries({ queryKey: ["vehicules"] });
      onSuccess?.(res.data);
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  const formPending = saveMut.isPending || updateMut.isPending;

  function submit(e) {
    e.preventDefault();
    const payload = {
      nom: form.nom.trim(),
      immatriculation: form.immatriculation.trim() || null,
      capacitePoids: Number(form.capacitePoids),
      capaciteVolume: Number(form.capaciteVolume),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, payload });
    } else {
      saveMut.mutate(payload);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(11, 31, 58, 0.45)", backdropFilter: "blur(5px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border"
            style={{
              background: "var(--bg-modal)",
              borderColor: `color-mix(in srgb, ${THEME.accent} 28%, var(--border-default))`,
              boxShadow: "0 28px 64px -24px rgba(11, 31, 58, 0.55)",
              borderLeft: `3px solid ${THEME.accent}`,
            }}
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background: `radial-gradient(ellipse 55% 70% at 0% 0%, ${THEME.accent}16, transparent 55%), radial-gradient(ellipse 40% 50% at 100% 100%, ${THEME.cyan}10, transparent 50%)`,
              }}
              aria-hidden
            />
            <div
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, #0B1F3A, ${THEME.accent}, ${THEME.cyan})` }}
              aria-hidden
            />

            <div className="relative z-[1] p-5">
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{
                    background: `linear-gradient(145deg, ${THEME.accent}, ${THEME.cyan})`,
                    boxShadow: `0 10px 22px -10px ${THEME.accent}`,
                  }}
                >
                  <Truck className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">Flotte</p>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    {editing ? "Modifier le véhicule" : "Nouveau véhicule"}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-3 sm:col-span-1">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nom *</label>
                    <input
                      className={INPUT}
                      value={form.nom}
                      onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Immatriculation
                    </label>
                    <input
                      className={INPUT}
                      value={form.immatriculation}
                      onChange={(e) => setForm((f) => ({ ...f, immatriculation: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Capacité poids (kg) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      className={INPUT}
                      value={form.capacitePoids}
                      onChange={(e) => setForm((f) => ({ ...f, capacitePoids: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                      Capacité volume (m³) *
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.01"
                      className={INPUT}
                      value={form.capaciteVolume}
                      onChange={(e) => setForm((f) => ({ ...f, capaciteVolume: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="sm:col-span-1">
                  <VehiculeFormPreview poids={form.capacitePoids} volume={form.capaciteVolume} />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[var(--border-default)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formPending}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.cyan})`,
                    boxShadow: `0 10px 22px -12px ${THEME.accent}`,
                  }}
                >
                  {formPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editing ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
