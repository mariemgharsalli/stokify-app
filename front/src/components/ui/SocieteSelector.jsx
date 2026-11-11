import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Loader2 } from "lucide-react";
import { useToastStore } from "../../store/toastStore";

function societeLabel(c) {
  if (!c) return "";
  return `${String(c.code ?? "").trim()} — ${String(c.nom ?? "").trim()}`.trim() || "—";
}

/**
 * Sélecteur société (super-admin) : affiché en tête de sidebar. « Changer » → /select-societe.
 * Masque les sociétés désactivées, sauf sur la page Sociétés (/superadmin) où tout est visible.
 */
export default function SocieteSelector({ user, value, onChange, companies = [], isLoading = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const societePulse = useToastStore((s) => s.societePulse);
  if (!user || user.role !== "SUPER_ADMIN") return null;

  const onSocietesPage =
    location.pathname === "/superadmin" || location.pathname.startsWith("/superadmin/");

  const list = useMemo(() => {
    const raw = Array.isArray(companies) ? companies : [];
    if (onSocietesPage) return raw;
    return raw.filter((c) => c.actif !== false);
  }, [companies, onSocietesPage]);

  const selected = useMemo(() => {
    if (value == null || value === "") return null;
    return list.find((c) => Number(c.id) === Number(value)) ?? null;
  }, [list, value]);

  const hasSociete = value != null && String(value).trim() !== "";

  function goSelect() {
    navigate("/select-societe");
  }

  return (
    <div
      data-societe-selector
      className={`relative w-full rounded-xl transition-shadow ${
        societePulse ? "ring-2 ring-accent-400/80 ring-offset-2 ring-offset-navy-950 animate-pulse" : ""
      }`}
    >
      <span className="text-[10px] text-slate-500 block mb-1">Société active</span>
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-navy-950/90 px-3 py-2.5 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          Chargement…
        </div>
      ) : hasSociete && selected ? (
        <button
          type="button"
          onClick={goSelect}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-navy-950/90 px-3 py-2.5 text-left text-xs text-slate-200 transition-colors hover:border-accent-500/35 hover:bg-white/[0.04] focus:outline-none focus:border-accent-500/40"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-emerald-300/95">● {societeLabel(selected)}</div>
          </div>
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-400">
            Changer
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      ) : hasSociete && !selected ? (
        <button
          type="button"
          onClick={goSelect}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2.5 text-center text-xs font-medium text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
        >
          <span aria-hidden>⚠</span>
          Société inactive — choisir une autre
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={goSelect}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2.5 text-center text-xs font-medium text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-950/60 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
        >
          <span aria-hidden>⚠</span>
          Choisir une société
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        </button>
      )}
    </div>
  );
}
