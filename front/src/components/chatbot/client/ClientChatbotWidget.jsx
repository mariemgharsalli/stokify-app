import { useState } from "react";
import { createPortal } from "react-dom";
import ClientChatFloatingButton from "./ClientChatFloatingButton";
import ClientChatbotPanel from "./ClientChatbotPanel";

/**
 * Assistant client B2B (STELLA) — catalogue, panier, commandes.
 */
export default function ClientChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  function toggle() {
    setOpen((v) => !v);
    setHasUnread(false);
  }

  return createPortal(
    <>
      <ClientChatbotPanel open={open} onClose={() => setOpen(false)} />
      <ClientChatFloatingButton onClick={toggle} isOpen={open} hasUnread={hasUnread} />
    </>,
    document.body
  );
}
