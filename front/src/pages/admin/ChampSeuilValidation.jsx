import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api, { getAxiosErrorMessage } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

const INPUT_ADMIN = "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80";
const INPUT_FICHE =
  "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]";

export function erreurSeuilValidation(valeur) {
  const brut = String(valeur ?? "").trim().replace(",", ".");
  if (!brut) return "";
  const nombre = Number(brut);
  if (!Number.isFinite(nombre) || nombre < 0) return "Le seuil ne peut pas être négatif.";
  return "";
}

export default function ChampSeuilValidation({ societeId, valeur, fiche = false }) {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [saisie, setSaisie] = useState(valeur == null ? "" : String(valeur));
  const [erreur, setErreur] = useState("");
  const visible = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    setSaisie(valeur == null ? "" : String(valeur));
    setErreur("");
  }, [societeId, valeur]);

  const enregistrer = useMutation({
    mutationFn: (seuilValidationMouvement) =>
      api.patch(`companies/${societeId}/seuil-validation`, { seuilValidationMouvement }),
    onSuccess: () => {
      setErreur("");
      qc.invalidateQueries({ queryKey: ["companies-admin"] });
    },
    onError: (err) => setErreur(getAxiosErrorMessage(err)),
  });

  if (!visible) return null;

  function soumettre() {
    const message = erreurSeuilValidation(saisie);
    if (message) {
      setErreur(message);
      return;
    }
    const brut = String(saisie).trim().replace(",", ".");
    enregistrer.mutate(brut === "" ? "" : Number(brut));
  }

  const id = `seuil-validation-${societeId}`;
  const label = fiche ? "text-[var(--text-muted)]" : "text-white/40";

  return (
    <div className="min-w-[9rem] space-y-1">
      <label htmlFor={id} className={`block text-[10px] font-semibold uppercase tracking-wide ${label}`}>
        Seuil de validation des mouvements (DT)
      </label>
      <input
        id={id}
        type="number"
        min="0"
        step="0.001"
        inputMode="decimal"
        className={fiche ? INPUT_FICHE : INPUT_ADMIN}
        value={saisie}
        onChange={(event) => setSaisie(event.target.value)}
      />
      <p className={`text-[10px] ${label}`}>0 ou vide = validation désactivée</p>
      {erreur ? (
        <p role="alert" className="text-[10px] font-medium text-red-400">
          {erreur}
        </p>
      ) : null}
      <button
        type="button"
        disabled={enregistrer.isPending}
        onClick={soumettre}
        className="text-xs text-accent-400 hover:underline disabled:opacity-40"
      >
        Enregistrer
      </button>
    </div>
  );
}
