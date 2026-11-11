import ModalReglement from "../reglements/ModalReglement";

export default function ModalReglementVente({ vente, onClose, onSuccess }) {
  if (!vente) return null;
  return <ModalReglement type="vente" document={vente} onClose={onClose} onSuccess={onSuccess} />;
}
