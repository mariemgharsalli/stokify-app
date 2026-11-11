import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ScanLine } from "lucide-react";
import { getAxiosErrorMessage } from "../../services/api";
import TerrainScanner from "../components/TerrainScanner";
import { fillTemplate } from "../lib/dayProgress";
import { useOnlineStatus } from "../lib/useOnlineStatus";
import SheetSpring from "../motion/SheetSpring";
import { fr } from "../strings/fr";
import BriefingCard from "./BriefingCard";
import { contextChipKey, retryAfterSeconds } from "./chatText";
import MessageBubble from "./MessageBubble";
import SuggestionChips from "./SuggestionChips";
import TypingIndicator from "./TypingIndicator";
import { useStokiBriefing, useStokiSend } from "./useChat";
import VoiceInput from "./VoiceInput";

const CHIP = {
  prepare: fr.stokiChipPrepare,
  lots: fr.stokiChipLots,
  place: fr.stokiChipPlace,
  gap: fr.stokiChipGap,
};

function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const sync = () => {
      const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--terrain-keyboard", `${overlap}px`);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--terrain-keyboard");
    };
  }, []);
}

export default function ChatSheet({ onClose }) {
  const location = useLocation();
  const online = useOnlineStatus();
  const briefing = useStokiBriefing(online);
  const send = useStokiSend();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [reported, setReported] = useState({});
  const [scanner, setScanner] = useState(false);
  const logRef = useRef(null);
  const pinned = useRef(true);
  const lock = useRef(false);
  useKeyboardInset();

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (!pinned.current) return;
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, send.isPending, briefing.data]);

  const context = CHIP[contextChipKey(location.pathname)];
  const suggestions = [...new Set([...(briefing.data?.suggestions || []), context])].slice(0, 4);
  const blocked = !online || cooldown > 0 || send.isPending || messages.length >= 20;

  async function ask(text) {
    const message = String(text || input).trim();
    if (!message || blocked || lock.current) return;
    lock.current = true;
    const history = messages.map((item) => ({ role: item.role, content: item.content }));
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${prev.length}`, role: "user", content: message }]);
    try {
      const data = await send.mutateAsync({ message, history });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${prev.length}`,
          role: "assistant",
          content: String(data?.reply || ""),
          articles: Array.isArray(data?.articlesSuggeres) ? data.articlesSuggeres : [],
        },
      ]);
    } catch (error) {
      if (error?.response?.status === 429) {
        setCooldown(retryAfterSeconds(error.response.headers));
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `e-${prev.length}`, role: "assistant", content: getAxiosErrorMessage(error, fr.stokiError) },
      ]);
    } finally {
      lock.current = false;
    }
  }

  return (
    <SheetSpring title={fr.stokiTitle} onClose={onClose} rootClass="terrain-chat-sheet">
      <p className="text-sm text-text-sub">{fr.stokiHint}</p>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={fr.stokiTitle}
        className="terrain-chat-log mt-3 flex flex-col gap-3"
        onScroll={(event) => {
          const node = event.currentTarget;
          pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
        }}
      >
        <BriefingCard briefing={briefing.data} />
        {briefing.isError ? (
          <p role="alert">
            {fr.stokiError}{" "}
            <button type="button" className="min-h-12 font-semibold" onClick={() => briefing.refetch()}>
              {fr.retry}
            </button>
          </p>
        ) : null}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            reported={Boolean(reported[message.id])}
            canReport={message.role === "assistant" && message.id === [...messages].reverse().find((item) => item.role === "assistant")?.id}
            onReport={() => setReported((prev) => ({ ...prev, [message.id]: true }))}
          />
        ))}
        {send.isPending ? <TypingIndicator /> : null}
        {!online ? <p>{fr.stokiOffline}</p> : null}
        {cooldown > 0 ? <p role="status">{fillTemplate(fr.stokiRate, { n: cooldown })}</p> : null}
      </div>
      <SuggestionChips items={suggestions} disabled={blocked} onPick={ask} />
      <form
        className="terrain-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          ask(input);
        }}
      >
        <input
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-app-bg px-3 text-base"
          aria-label={fr.stokiPlaceholder}
          placeholder={fr.stokiPlaceholder}
          value={input}
          disabled={blocked}
          onChange={(event) => setInput(event.target.value)}
        />
        <VoiceInput disabled={blocked} onText={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))} />
        <button
          type="button"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-border touch-manipulation"
          aria-label={fr.stokiScan}
          onClick={() => setScanner(true)}
        >
          <ScanLine size={20} aria-hidden="true" />
        </button>
        <button type="submit" className="terrain-primary inline-flex min-h-14 items-center rounded-xl px-4 font-semibold touch-manipulation" disabled={blocked || !input.trim()}>
          {fr.stokiSend}
        </button>
      </form>
      {messages.length >= 20 ? <p className="mt-2 text-sm">{fr.stokiLimit}</p> : null}
      {scanner ? (
        <TerrainScanner
          elevated
          title={fr.stokiScan}
          onClose={() => setScanner(false)}
          onDetected={(code) => {
            setScanner(false);
            setInput(fillTemplate(fr.stokiWhere, { code }));
          }}
        />
      ) : null}
    </SheetSpring>
  );
}
