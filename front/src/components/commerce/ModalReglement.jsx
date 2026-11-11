import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote } from "lucide-react";
import api from "../../services/api";
import Modal, { btnPrimary, btnSecondary, inputStyle, primaryButtonStyle } from "../ui/Modal";
import FormFieldError, { inputErrorStyle } from "../ui/FormFieldError";
import { useFormValidation } from "../../hooks/useFormValidation";
import { reglementSchema } from "../../validation";
import { useToast } from "../../hooks/useToast";
import { num3 } from "../../utils/commerceUi";

export default function ModalReglement({ type, docId, reference, solde, onClose, onSuccess }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [montant, setMontant] = useState(solde ? String(solde) : "");
  const [mode, setMode] = useState("VIREMENT");

  const values = useMemo(
    () => ({
      montant,
      mode: type === "vente" ? mode : "ESPECES",
    }),
    [montant, mode, type]
  );
  const { errors, validate, validateField, isValid, clearError } = useFormValidation(
    reglementSchema,
    values
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const m = Number(montant);
      if (type === "achat") {
        await api.post(`achats/${docId}/paiement`, { montant: m });
      } else {
        await api.post(`ventes/${docId}/reglements`, { montant: m, mode });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [type === "achat" ? "achats" : "ventes"] });
      qc.invalidateQueries({ queryKey: [`${type === "achat" ? "achats" : "ventes"}-stats`] });
      toast.success("Règlement enregistré");
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <Modal
      title={type === "achat" ? "Règlement fournisseur" : "Encaissement client"}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button
            type="button"
            disabled={mutation.isPending || !isValid}
            onClick={() => {
              if (!validate()) return;
              mutation.mutate();
            }}
            className={btnPrimary}
            style={primaryButtonStyle}
          >
            <Banknote className="h-4 w-4" />
            Enregistrer
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-[var(--text-secondary)]">
        {reference} — Solde restant : <strong className="text-[var(--text-primary)]">{num3(solde)}</strong>
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">Montant *</label>
          <input
            type="number"
            min={0}
            step="0.001"
            value={montant}
            onChange={(e) => {
              setMontant(e.target.value);
              clearError("montant");
            }}
            onBlur={() => validateField("montant")}
            className={inputStyle}
            style={errors.montant ? inputErrorStyle : undefined}
          />
          <FormFieldError message={errors.montant} />
        </div>
        {type === "vente" ? (
          <div>
            <label className="mb-1 block text-xs text-[var(--text-secondary)]">Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                clearError("mode");
              }}
              className={inputStyle}
              style={errors.mode ? inputErrorStyle : undefined}
            >
              <option value="ESPECES">Espèces</option>
              <option value="CHEQUE">Chèque</option>
              <option value="VIREMENT">Virement</option>
              <option value="TRAITE">Traite</option>
              <option value="CREDIT">Crédit</option>
            </select>
            <FormFieldError message={errors.mode} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
