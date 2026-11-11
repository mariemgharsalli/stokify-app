import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check } from "lucide-react";
import api from "../../services/api";
import Modal, { btnPrimary, btnSecondary, primaryButtonStyle } from "../ui/Modal";
import { useToast } from "../../hooks/useToast";

export default function ModalValidation({ venteId, onClose, onSuccess }) {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: vente, isLoading } = useQuery({
    queryKey: ["vente", venteId],
    queryFn: () => api.get(`ventes/${venteId}`).then((r) => r.data),
    enabled: Boolean(venteId),
  });

  const { data: stockRows } = useQuery({
    queryKey: ["vente-stock-check", venteId, vente?.depotId],
    queryFn: async () => {
      const lignes = vente?.lignes || [];
      const rows = await Promise.all(
        lignes.map(async (l) => {
          try {
            const r = await api.get("stock/disponible", {
              params: { articleId: l.articleId, depotId: vente.depotId },
            });
            return {
              ...l,
              stockDisponible: Number(r.data?.disponible ?? r.data?.quantite ?? 0),
            };
          } catch {
            return { ...l, stockDisponible: 0 };
          }
        })
      );
      return rows;
    },
    enabled: Boolean(vente?.lignes?.length),
  });

  const lignes = stockRows || [];
  const hasStockInsuffisant = lignes.some((l) => l.stockDisponible + 1e-6 < Number(l.quantite));

  const validateMutation = useMutation({
    mutationFn: () => api.post(`ventes/${venteId}/confirmer`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventes"] });
      qc.invalidateQueries({ queryKey: ["ventes-stats"] });
      toast.success("Vente confirmée — stock déduit");
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  return (
    <Modal
      title="Confirmer la vente"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Annuler
          </button>
          <button
            type="button"
            disabled={validateMutation.isPending || isLoading || hasStockInsuffisant}
            onClick={() => validateMutation.mutate()}
            className={btnPrimary}
            style={primaryButtonStyle}
            title={
              hasStockInsuffisant
                ? "Impossible de confirmer : stock insuffisant sur le dépôt de la vente"
                : undefined
            }
          >
            <Check className="h-4 w-4" />
            {validateMutation.isPending ? "Confirmation…" : "Confirmer la vente"}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        Vérification du stock disponible avant confirmation. Le stock sera déduit automatiquement selon la
        règle FIFO/FEFO.
      </p>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[var(--bg-hover)]" />
      ) : (
        <div className="divide-y divide-[var(--border-default)]">
          {lignes.map((l) => {
            const ok = l.stockDisponible >= Number(l.quantite);
            return (
              <div
                key={l.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2.5 text-sm"
              >
                <span className="text-[var(--text-primary)]">{l.article?.libelle}</span>
                <span className="text-xs text-[var(--text-secondary)]">Demandé : {l.quantite}</span>
                <span className="text-xs text-[var(--text-secondary)]">Dispo : {l.stockDisponible}</span>
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    background: ok ? "rgba(29,158,117,0.12)" : "rgba(226,75,74,0.12)",
                    color: ok ? "#1D9E75" : "#E24B4A",
                    borderColor: ok ? "rgba(29,158,117,0.4)" : "rgba(226,75,74,0.4)",
                  }}
                >
                  {ok ? "✓ OK" : "✗ Insuffisant"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {hasStockInsuffisant ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs"
          style={{
            background: "rgba(226,75,74,0.08)",
            borderColor: "rgba(226,75,74,0.2)",
            color: "#E24B4A",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Stock insuffisant sur le dépôt de cette vente. Réduisez la quantité ou réapprovisionnez avant de
          confirmer.
        </div>
      ) : null}
    </Modal>
  );
}
