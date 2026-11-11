import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Search, Warehouse } from "lucide-react";
import { inputClass } from "./formStyles";

function useDebounce(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Sélecteur de dépôt avec recherche (portail body, z-index élevé). */
export default function DepotSearchSelect({
  options = [],
  value,
  onChange,
  placeholder = "Rechercher un dépôt…",
  disabled,
  error,
  loading = false,
  emptyHint,
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
        const hay = `${o.label} ${o.meta || ""} ${o.code || ""}`.toLowerCase();
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
      if (e.target.closest?.("[data-depot-search-menu]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const menu =
    open && !disabled && menuPos ? (
      <ul
        data-depot-search-menu
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
          <li className="px-3 py-2 text-sm text-[var(--text-muted)]">Chargement des dépôts…</li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-[var(--text-muted)]">
            {options.length === 0
              ? emptyHint || "Aucun dépôt — créez-en un dans Dépôts"
              : "Aucun dépôt ne correspond à votre recherche"}
          </li>
        ) : (
          filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={String(o.value) === String(value)}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--bg-hover)]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.value, o.raw);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed]/12 text-[#7c3aed]">
                  <Warehouse className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[var(--text-primary)]">{o.raw?.libelle || o.label}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-muted)]">
                    {o.raw?.code ? <span className="font-mono">{o.raw.code}</span> : null}
                    {o.meta ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {o.meta}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      {selected && !open ? (
        <div
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
            error ? "border-[var(--accent-danger)]" : "border-[var(--border-default)] bg-[var(--bg-input)]"
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed]/12 text-[#7c3aed]">
            <Warehouse className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{selected.raw?.libelle}</p>
            <p className="truncate text-[11px] text-[var(--text-muted)]">
              {selected.raw?.code ? `${selected.raw.code}` : ""}
              {selected.meta ? ` · ${selected.meta}` : ""}
            </p>
          </div>
          {!disabled ? (
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#7c3aed] hover:bg-[#7c3aed]/10"
              onClick={() => {
                onChange("", null);
                setQuery("");
              }}
            >
              Changer
            </button>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            className={`${inputClass} pl-9 ${error ? "field-error-shake border-[var(--accent-danger)]" : ""}`}
            placeholder={loading ? "Chargement des dépôts…" : placeholder}
            value={open ? query : ""}
            onFocus={() => {
              if (disabled) return;
              setOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
          />
        </div>
      )}
      {error ? <p className="mt-1.5 text-xs text-[var(--accent-danger)]">{error}</p> : null}
      {!loading && options.length > 0 && !selected ? (
        <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">{options.length} dépôt(s) disponible(s)</p>
      ) : null}
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
