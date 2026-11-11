import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Mail, Send } from "lucide-react";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { useNotificationStore } from "../../store/notificationStore";
import { useLandingLang } from "../../pages/landing/LandingLangContext";
import { hasPermission } from "../../security/permissions";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useToastStore } from "../../store/toastStore";
import { formatRelativeTime } from "../../utils/formatRelativeTime";

function formatBadge(count) {
  if (!count || count <= 0) return null;
  if (count > 9) return "9+";
  return String(count);
}

function subjectOf(item, t) {
  if (item.sujet === "COMMANDE") {
    return item.commande?.reference || t.demandesAboutOrder;
  }
  return item.article?.libelle || item.article?.code || t.demandesAboutArticle;
}

export default function DemandesInboxButton({ variant = "staff" }) {
  const { t } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const societeScope = useSocieteQueryScope();
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");

  const isClient = role === "CLIENT";
  const canRead = isClient || hasPermission(role, "ventes:read");
  const enabled = Boolean(canRead && societeScope != null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setActiveId(null);
  }, [societeScope]);

  const { data: countData } = useQuery({
    queryKey: ["demandes-count", societeScope, role],
    queryFn: () => api.get("demandes-client/count").then((r) => r.data),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["demandes-client", societeScope, role],
    queryFn: () => api.get("demandes-client").then((r) => r.data),
    enabled: enabled && open,
    staleTime: 5_000,
  });

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ["demande-thread", activeId],
    queryFn: () => api.get(`demandes-client/${activeId}`).then((r) => r.data),
    enabled: enabled && open && activeId != null,
  });

  useEffect(() => {
    if (!thread) return;
    qc.invalidateQueries({ queryKey: ["demandes-count"] });
    qc.invalidateQueries({ queryKey: ["demandes-client"] });
  }, [thread, qc]);

  const replyMut = useMutation({
    mutationFn: () =>
      api.post(`demandes-client/${activeId}/messages`, { message: draft.trim() }).then((r) => r.data),
    onSuccess: (data) => {
      setDraft("");
      qc.setQueryData(["demande-thread", activeId], data);
      qc.invalidateQueries({ queryKey: ["demandes-client"] });
      qc.invalidateQueries({ queryKey: ["demandes-count"] });
    },
    onError: (e) => pushToast(e.response?.data?.message || t.demandesError, "error"),
  });

  const closeMut = useMutation({
    mutationFn: () => api.post(`demandes-client/${activeId}/fermer`).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["demande-thread", activeId], data);
      qc.invalidateQueries({ queryKey: ["demandes-client"] });
      qc.invalidateQueries({ queryKey: ["demandes-count"] });
    },
  });

  if (!canRead) return null;

  const badge = formatBadge(Number(countData?.count) || 0);
  const items = listData?.items || [];
  const title = isClient ? t.demandesMine : t.demandesTitle;

  function toggle() {
    useNotificationStore.getState().closePanel();
    setOpen((v) => !v);
    setActiveId(null);
    setDraft("");
  }

  const button =
    variant === "client" ? (
      <button
        type="button"
        onClick={toggle}
        className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition-all duration-200 ease-out hover:bg-slate-100"
        aria-label={title}
        aria-expanded={open}
      >
        <Mail className="h-4 w-4" />
        <span className="hidden lg:inline">{t.navMessages}</span>
        {badge && (
          <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F97316] px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </button>
    ) : (
      <motion.button
        type="button"
        onClick={toggle}
        aria-label={title}
        aria-expanded={open}
        title={title}
        className={`app-navbar-icon-btn${open ? " is-active" : ""}`}
        whileHover={reduceMotion ? undefined : { y: -2, scale: 1.04 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      >
        <span className="app-navbar-icon-glow" aria-hidden />
        <Mail size={18} strokeWidth={1.85} />
        {badge && <span className="app-navbar-badge">{badge}</span>}
      </motion.button>
    );

  return (
    <div className="relative" ref={wrapRef}>
      {button}
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.55rem)] z-[1200] flex w-[min(24rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] flex-col overflow-hidden rounded-xl border shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
          style={{ background: "var(--bg-card, #fff)", borderColor: "var(--border-default, #e2e8f0)", color: "var(--text-primary, #0f172a)" }}
          role="dialog"
          aria-label={title}
        >
          <div className="flex items-center gap-2 border-b px-3.5 py-2.5" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
            {activeId != null && (
              <button type="button" onClick={() => setActiveId(null)} className="rounded-md p-1 opacity-70 hover:opacity-100" aria-label={t.demandesBack}>
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <p className="text-sm font-semibold">{activeId != null ? subjectOf(thread || items.find((i) => i.id === activeId) || {}, t) : title}</p>
          </div>

          {activeId == null ? (
            <div className="max-h-[22rem] overflow-y-auto">
              {listLoading && <p className="px-3.5 py-4 text-sm opacity-70">{t.demandesLoading}</p>}
              {!listLoading && items.length === 0 && <p className="px-3.5 py-4 text-sm opacity-70">{t.demandesEmpty}</p>}
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  className="flex w-full flex-col gap-0.5 border-b px-3.5 py-2.5 text-left hover:bg-black/5"
                  style={{ borderColor: "var(--border-default, #e2e8f0)" }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{subjectOf(item, t)}</span>
                    {item.nonLu && <span className="h-2 w-2 shrink-0 rounded-full bg-[#F97316]" />}
                  </span>
                  <span className="truncate text-xs opacity-70">
                    {!isClient && item.client?.nom ? `${item.client.nom} · ` : ""}
                    {item.apercu || "—"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide opacity-50">
                    {item.statut === "FERMEE" ? t.demandesClosed : t.demandesOpen} · {formatRelativeTime(item.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex max-h-[18rem] flex-col gap-2 overflow-y-auto px-3.5 py-3">
                {threadLoading && <p className="text-sm opacity-70">{t.demandesLoading}</p>}
                {(thread?.messages || []).map((msg) => {
                  const mine = msg.auteurId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[85%] rounded-xl px-3 py-2 text-sm"
                        style={{
                          background: mine ? "var(--accent-primary, #0B3A44)" : "var(--bg-hover, #f1f5f9)",
                          color: mine ? "#fff" : "inherit",
                        }}
                      >
                        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          {mine ? t.demandesYou : [msg.auteur?.prenom, msg.auteur?.nom].filter(Boolean).join(" ") || t.demandesTeam}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.corps}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {thread?.statut === "FERMEE" ? (
                <p className="border-t px-3.5 py-2.5 text-xs opacity-70" style={{ borderColor: "var(--border-default, #e2e8f0)" }}>
                  {t.demandesClosed}
                </p>
              ) : (
                <form
                  className="border-t p-2.5"
                  style={{ borderColor: "var(--border-default, #e2e8f0)" }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim().length < 2 || replyMut.isPending) return;
                    replyMut.mutate();
                  }}
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder={t.demandesPlaceholder}
                    className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--border-default, #e2e8f0)" }}
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => closeMut.mutate()}
                      disabled={closeMut.isPending}
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      {t.demandesCloseThread}
                    </button>
                    <button
                      type="submit"
                      disabled={draft.trim().length < 2 || replyMut.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#F97316] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {t.demandesReply}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
