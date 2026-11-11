import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { inputClass } from "./formStyles";

function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Recherche tier (fournisseur / client) — menu en portail body (z-index élevé). */
export default function TierSearchSelect({
  options = [],
  value,
  onChange,
  placeholder = "Rechercher…",
  disabled,
  error,
  loading = false,
  emptyHint,
  renderOption,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState(null);
  const debounced = useDebounce(query, 300);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) => {
        const hay = `${o.label} ${o.meta || ""} ${o.city || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [options, debounced]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (e.target.closest?.("[data-tier-search-menu]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const menu =
    open && !disabled && menuPos ? (
      <ul
        data-tier-search-menu
        className="fixed z-[1100] max-h-56 overflow-auto rounded-xl border border-[var(--border-default)] py-1 shadow-xl"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          background: "var(--bg-card)",
        }}
        role="listbox"
      >
        {loading ? (
          <li className="px-3 py-2 text-sm text-[var(--text-muted)]">Chargement…</li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-[var(--text-muted)]">
            {options.length === 0
              ? emptyHint || "Aucune donnée — vérifiez la connexion ou la société active"
              : "Aucun résultat"}
          </li>
        ) : (
          filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value, o.raw);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {renderOption ? renderOption(o) : o.label}
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          className={`${inputClass} pl-9 ${error ? "field-error-shake border-[var(--accent-danger)]" : ""}`}
          placeholder={loading ? "Chargement…" : placeholder}
          value={open ? query : selected?.label || query}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery(selected?.label || "");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </div>
      {error ? <p className="mt-1 text-xs text-[var(--accent-danger)]">{error}</p> : null}
      {!loading && options.length > 0 ? (
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">{options.length} entrée(s) disponible(s)</p>
      ) : null}
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
