import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FloatingChatButton from "./FloatingChatButton";
import ChatbotPanel from "./ChatbotPanel";

export default function ChatbotWidget() {
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);

  useEffect(() => {
    const open = () => {
      setChatOpen(true);
      setHasUnread(false);
    };
    window.addEventListener("stokify:open-stoki", open);
    return () => window.removeEventListener("stokify:open-stoki", open);
  }, []);

  function toggleChat() {
    setChatOpen((v) => !v);
    setHasUnread(false);
  }

  return createPortal(
    <>
      <ChatbotPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <FloatingChatButton onClick={toggleChat} isOpen={chatOpen} hasUnread={hasUnread} />
    </>,
    document.body
  );
}
