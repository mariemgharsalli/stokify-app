import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, X } from "lucide-react";
import api from "../../services/api";
import { useLandingLang } from "../../pages/landing/LandingLangContext";
import { useToastStore } from "../../store/toastStore";
import { formatRelativeTime } from "../../utils/formatRelativeTime";

function subjectParams(article, commande) {
  if (article?.id) return { articleId: article.id };
  if (commande?.id) return { commandeId: commande.id };
  return null;
}

function subjectLabel(article, commande, t) {
  if (article) return `${t.demandesAboutArticle} · ${article.libelle || article.code || ""}`;
  if (commande) return `${t.demandesAboutOrder} · ${commande.reference || ""}`;
  return t.demandesWrite;
}

export default function DemandeComposer({ open, onClose, article = null, commande = null }) {
  const { t } = useLandingLang();
  const qc = useQueryClient();
  const pushToast = useToastStore((s) => s.pushToast);
  const [text, setText] = useState("");
  const params = subjectParams(article, commande);

  const { data, isLoading } = useQuery({
    queryKey: ["demande-sujet", params],
    queryFn: () => api.get("demandes-client/sujet", { params }).then((r) => r.data),
    enabled: Boolean(open && params),
  });

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const demande = data?.demande || null;
  const closed = demande?.statut === "FERMEE";

  const sendMut = useMutation({
    mutationFn: async () => {
      const message = text.trim();
      if (demande && !closed) {
        return api.post(`demandes-client/${demande.id}/messages`, { message }).then((r) => r.data);
      }
      return api
        .post("demandes-client", { message, ...(params || {}) })
        .then((r) => r.data);
    },
    onSuccess: () => {
      setText("");
      pushToast(t.demandesSent, "success");
      qc.invalidateQueries({ queryKey: ["demande-sujet"] });
      qc.invalidateQueries({ queryKey: ["demandes-client"] });
      qc.invalidateQueries({ queryKey: ["demandes-count"] });
    },
    onError: (e) => {
      pushToast(e.response?.data?.message || t.demandesError, "error");
    },
  });

  if (!open || !params) return null;

  const messages = demande?.messages || [];

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-slate-950/55" aria-label={t.catClose} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[min(34rem,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquare className="h-4 w-4 shrink-0 text-[#0B3A44]" />
              {t.demandesWrite}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{subjectLabel(article, commande, t)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label={t.catClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[8rem] flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
          {isLoading && <p className="text-sm text-slate-500">{t.demandesLoading}</p>}
          {!isLoading && messages.length === 0 && (
            <p className="text-sm text-slate-500">{t.demandesEmptyThread}</p>
          )}
          {messages.map((msg) => {
            const mine = msg.auteur?.role === "CLIENT";
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-[#0B3A44] text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {mine ? t.demandesYou : t.demandesTeam}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.corps}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form
          className="border-t border-slate-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length < 2 || sendMut.isPending) return;
            sendMut.mutate();
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t.demandesPlaceholder}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#0B3A44]"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={text.trim().length < 2 || sendMut.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {t.demandesSend}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
