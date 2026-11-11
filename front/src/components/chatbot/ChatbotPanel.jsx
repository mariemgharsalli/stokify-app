import { useEffect, useRef, useState } from "react";
import { IconRefresh, IconRobot, IconSend, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import api from "../../services/api";
import { useLandingLang } from "../../pages/landing/LandingLangContext";
import { interpolate } from "../../i18n/languages";
import { useAuthStore } from "../../store/authStore";
import {
  ArticleCards,
  EASE,
  FollowUpChips,
  MAX_MESSAGES,
  ORANGE_GRAD,
  RevealedMarkdown,
  STOKI_LOADING_KEYS,
  StatusChip,
  SuggestionChips,
  ToolTrace,
  TypingDots,
} from "./chatUi";

function buildStokiGreeting(t, prenom, kpis = {}) {
  const name = prenom ? ` ${prenom}` : "";
  let pulse = t.stokiPulseCalm;
  if (kpis.ruptureCount) {
    const lots = kpis.lotsCount ? interpolate(t.stokiLotsHint, { n: kpis.lotsCount }) : "";
    pulse = interpolate(t.stokiPulseRupture, { n: kpis.ruptureCount, lots });
  } else if (kpis.lotsCount) {
    pulse = interpolate(t.stokiPulseLots, { n: kpis.lotsCount });
  }
  return interpolate(t.stokiGreeting, { name, pulse });
}

function buildStokiSuggestions(t, kpis = {}) {
  return [
    kpis.ruptureCount > 0 ? t.stokiSug1 : t.stokiSugRisk,
    kpis.lotsCount > 0 ? t.stokiSug2 : t.stokiSug3,
    t.stokiSug4,
    t.stokiSugAnom,
  ];
}

export default function ChatbotPanel({ open, onClose }) {
  const { t, lang } = useLandingLang();
  const user = useAuthStore((s) => s.user);
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState(() => [
    { role: "assistant", content: t.stokiBoot, timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState(t.stokiLoad0);
  const [suggestions, setSuggestions] = useState(() => buildStokiSuggestions(t));
  const [status, setStatus] = useState({ tone: "ok", label: t.chatOnline });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const briefingRef = useRef(null);

  const conversationCount = messages.length - 1;
  const historyLimitReached = conversationCount >= MAX_MESSAGES;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, loadingLabel]);

  useEffect(() => {
    if (!loading) {
      setLoadingLabel(t.stokiLoad0);
      return undefined;
    }
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % STOKI_LOADING_KEYS.length;
      setLoadingLabel(t[STOKI_LOADING_KEYS[i]]);
    }, 1400);
    return () => clearInterval(id);
  }, [loading, t]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    briefingRef.current = null;
  }, [lang]);

  useEffect(() => {
    if (!open || briefingRef.current) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("ai/chat/briefing", { params: { lang } });
        if (cancelled) return;
        briefingRef.current = res.data;
        const kpis = res.data.kpis || {};
        setStatus({
          tone: kpis.ruptureCount ? "alert" : kpis.lotsCount ? "warn" : "ok",
          label: kpis.ruptureCount
            ? interpolate(t.stokiPulseRupture, { n: kpis.ruptureCount, lots: "" }).replace(/\*\*/g, "")
            : kpis.lotsCount
              ? t.stokiStatusWatch
              : t.stokiStatusOk,
        });
        setSuggestions(buildStokiSuggestions(t, kpis));
        setMessages((prev) => {
          if (prev.length > 1) return prev;
          return [
            {
              role: "assistant",
              content: buildStokiGreeting(t, user?.prenom, kpis),
              timestamp: new Date(),
              reveal: true,
            },
          ];
        });
      } catch {
        if (cancelled) return;
        setSuggestions(buildStokiSuggestions(t));
        setMessages([
          {
            role: "assistant",
            content: buildStokiGreeting(t, user?.prenom),
            timestamp: new Date(),
            reveal: true,
          },
        ]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, lang, t, user?.prenom]);

  function applyGreeting(content, extra = {}) {
    setMessages([{ role: "assistant", content, timestamp: new Date(), reveal: true, ...extra }]);
    setInput("");
  }

  function resetConversation() {
    const data = briefingRef.current;
    const kpis = data?.kpis || {};
    setSuggestions(buildStokiSuggestions(t, kpis));
    applyGreeting(buildStokiGreeting(t, user?.prenom, kpis));
  }

  async function sendMessage(text) {
    const userMsg = text || input.trim();
    if (!userMsg || loading || historyLimitReached) return;
    setInput("");

    const newMessages = [...messages, { role: "user", content: userMsg, timestamp: new Date() }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = newMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(1)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post("ai/chat", {
        message: userMsg,
        history: history.slice(0, -1),
        lang,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.reply,
          articlesSuggeres: res.data.articlesSuggeres || [],
          suggestions: res.data.suggestions || [],
          trace: res.data.trace || [],
          timestamp: new Date(),
          reveal: true,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            t.stokiError,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="stoki-panel"
          className="fixed bottom-24 right-6 z-[89] flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border shadow-2xl max-[480px]:bottom-0 max-[480px]:left-0 max-[480px]:right-0 max-[480px]:max-w-none max-[480px]:rounded-b-none max-[480px]:rounded-t-3xl"
          style={{
            height: "560px",
            background: "var(--color-background-primary, var(--bg-card))",
            borderColor: "var(--color-border-secondary, var(--border-default))",
            boxShadow: "0 24px 64px rgba(249,115,22,0.18), 0 12px 32px rgba(0,0,0,0.28)",
          }}
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="relative shrink-0 overflow-hidden" style={{ background: ORANGE_GRAD, padding: "14px 16px 12px" }}>
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(circle at 12% 0%, rgba(255,255,255,0.35), transparent 46%), radial-gradient(circle at 100% 120%, rgba(0,0,0,0.18), transparent 50%)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <IconRobot size={20} className="text-white" stroke={1.75} aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#f97316] bg-[#22c55e]" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-wide text-white">STOKI</h3>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-medium text-white">
                    {t.stokiBadge}
                  </span>
                </div>
                <div className="mt-1">
                  <StatusChip status={status} />
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={resetConversation}
                  className="flex h-8 w-8 items-center justify-center rounded-[0.55rem] bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label={t.chatNew}
                  title={t.chatNew}
                >
                  <IconRefresh size={16} stroke={2.2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-[0.55rem] bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label={t.chatCloseAssistant}
                  title={t.chatClose}
                >
                  <IconX size={16} stroke={2} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => {
              const isLastAssistant = msg.role === "assistant" && msg === lastAssistant && !loading;
              return (
                <motion.div
                  key={`${msg.timestamp?.getTime?.() ?? i}-${i}`}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: ORANGE_GRAD }}
                    >
                      <IconRobot size={12} className="text-white" stroke={2} aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className={`flex min-w-0 flex-1 flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm"
                      }`}
                      style={{
                        background:
                          msg.role === "user"
                            ? ORANGE_GRAD
                            : msg.isError
                              ? "color-mix(in srgb, #E24B4A 10%, transparent)"
                              : "var(--color-background-secondary, var(--bg-input))",
                        color: msg.role === "user" ? "#fff" : "var(--color-text-primary, var(--text-primary))",
                        border:
                          msg.role === "assistant"
                            ? `0.5px solid ${msg.isError ? "color-mix(in srgb, #E24B4A 35%, transparent)" : "rgba(249, 115, 22, 0.15)"}`
                            : "none",
                      }}
                    >
                      {msg.role === "assistant" ? (
                        <RevealedMarkdown content={msg.content} reveal={Boolean(msg.reveal && isLastAssistant)} reduce={reduce} />
                      ) : (
                        <RevealedMarkdown content={msg.content} reveal={false} reduce />
                      )}
                      <p className="mt-1.5 text-[9px] opacity-50">
                        {msg.timestamp.toLocaleTimeString(t.localeTag || lang, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    {msg.role === "assistant" && (
                      <>
                        <ArticleCards articles={msg.articlesSuggeres} reduce={reduce} onClose={onClose} />
                        <ToolTrace trace={msg.trace} reduce={reduce} t={t} />
                      </>
                    )}

                    {isLastAssistant && messages.length > 1 && !loading && (
                      <FollowUpChips items={msg.suggestions} onPick={sendMessage} reduce={reduce} />
                    )}
                  </div>
                </motion.div>
              );
            })}

            {loading && (
              <div className="flex gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: ORANGE_GRAD }}
                >
                  <IconRobot size={12} className="text-white" stroke={2} aria-hidden="true" />
                </div>
                <TypingDots reduce={reduce} label={loadingLabel} />
              </div>
            )}

            {messages.length === 1 && !loading && !historyLimitReached && (
              <SuggestionChips items={suggestions} onPick={sendMessage} reduce={reduce} label={t.stokiPistes} />
            )}

            {historyLimitReached && (
              <div
                className="rounded-xl border px-3 py-2.5 text-center text-[11px]"
                style={{
                  borderColor: "var(--color-border-tertiary, var(--border-default))",
                  background: "var(--color-background-secondary, var(--bg-input))",
                  color: "var(--color-text-secondary, var(--text-secondary))",
                }}
              >
                <p>{t.stokiLongConv}</p>
                <button
                  type="button"
                  onClick={resetConversation}
                  className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
                  style={{ background: ORANGE_GRAD }}
                >
                  {t.chatNew}
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div
            className="shrink-0 border-t p-3"
            style={{ borderColor: "var(--color-border-tertiary, var(--border-default))" }}
          >
            <div className="flex items-end gap-2">
              <div
                className="flex-1 rounded-2xl border px-3 py-2"
                style={{
                  borderColor: "rgba(249, 115, 22, 0.22)",
                  background: "var(--color-background-secondary, var(--bg-input))",
                }}
              >
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    historyLimitReached ? t.stokiPlaceholderLimit : t.stokiPlaceholder
                  }
                  rows={1}
                  disabled={historyLimitReached}
                  className="w-full resize-none bg-transparent text-xs text-[var(--color-text-primary,var(--text-primary))] outline-none placeholder:text-[var(--color-text-tertiary,var(--text-muted))] disabled:opacity-50"
                  style={{ maxHeight: "80px" }}
                />
              </div>
              <motion.button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || historyLimitReached}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
                style={{ background: ORANGE_GRAD, boxShadow: "0 8px 24px -8px rgba(249,115,22,0.45)" }}
                aria-label={t.chatSend}
                whileHover={reduce || !input.trim() || loading ? undefined : { scale: 1.06 }}
                whileTap={reduce || !input.trim() || loading ? undefined : { scale: 0.94 }}
              >
                <IconSend size={15} stroke={2} aria-hidden="true" />
              </motion.button>
            </div>
            <p className="mt-1.5 text-center text-[9px] text-[var(--color-text-tertiary,var(--text-muted))]">
              {t.stokiFooter}
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
