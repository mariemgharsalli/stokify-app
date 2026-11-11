import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { fr } from "../strings/fr";

export function speechAvailable() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export default function VoiceInput({ disabled, onText }) {
  const [live, setLive] = useState(false);
  const session = useRef(null);
  useEffect(() => () => session.current?.stop?.(), []);
  if (!speechAvailable()) return null;

  function toggle() {
    if (live) {
      session.current?.stop?.();
      setLive(false);
      return;
    }
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = event?.results?.[0]?.[0]?.transcript || "";
      if (text) onText(text);
    };
    recognition.onend = () => setLive(false);
    session.current = recognition;
    setLive(true);
    recognition.start();
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border touch-manipulation"
      aria-pressed={live}
      aria-label={fr.stokiVoice}
      disabled={disabled}
      onClick={toggle}
    >
      <Mic size={20} aria-hidden="true" />
    </button>
  );
}
