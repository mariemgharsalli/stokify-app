import ModalReglement from "../reglements/ModalReglement";

export default function ModalReglementAchat({ achat, onClose, onSuccess }) {
  if (!achat) return null;
  return <ModalReglement type="achat" document={achat} onClose={onClose} onSuccess={onSuccess} />;
}
