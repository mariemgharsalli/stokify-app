import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Search } from "lucide-react";
import { createPortal } from "react-dom";
import { primaryOptionHighlightStyle, primaryOptionSelectedStyle } from "../../utils/brandStyles";

/**
 * Liste déroulante filtrable (saisie + clic), pour listes longues.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— Choisir —",
  searchPlaceholder = "Rechercher…",
  disabled = false,
  className = "",
  allowClear = true,
  clearLabel = "Tous",
  id,
  "aria-label": ariaLabel,
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const displayText = value === "" ? "" : selected?.label ?? value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (o) =>
      !q ||
      o.label.toLowerCase().includes(q) ||
      String(o.value).toLowerCase().includes(q);

    const rows = options.filter(match);
    if (!allowClear) return rows;
    const clearRow = { value: "__CLEAR__", label: clearLabel };
    if (!q || clearLabel.toLowerCase().includes(q)) return [clearRow, ...rows];
    return rows;
  }, [options, query, allowClear, clearLabel]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const updateMenuPos = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 220);
      setMenuStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width,
      });
    };
    updateMenuPos();
    window.addEventListener("resize", updateMenuPos);
    window.addEventListener("scroll", updateMenuPos, true);
    return () => {
      window.removeEventListener("resize", updateMenuPos);
      window.removeEventListener("scroll", updateMenuPos, true);
    };
  }, [open]);

  function pick(row) {
    if (row.value === "__CLEAR__") onChange("");
    else onChange(row.value);
    setOpen(false);
    setQuery("");
  }

  function onTriggerKeyDown(e) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = filtered[highlight];
      if (row) pick(row);
    }
  }

  return (
    <div ref={rootRef} className={`relative min-w-[160px] ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="flex w-full min-w-[160px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: "var(--bg-input)",
          borderColor: open
            ? "color-mix(in srgb, var(--accent-primary) 55%, var(--border-default))"
            : "var(--border-default)",
          color: displayText ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open
            ? "0 0 0 3px color-mix(in srgb, var(--accent-primary) 18%, transparent)"
            : undefined,
        }}
      >
        <span className="truncate">{displayText || placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && menuStyle ? (
              <motion.div
                ref={menuRef}
                role="listbox"
                initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="z-[100001] max-h-80 overflow-hidden rounded-xl border shadow-xl"
                style={{
                  position: "fixed",
                  top: menuStyle.top,
                  left: menuStyle.left,
                  width: menuStyle.width,
                  background: "var(--bg-modal, var(--bg-card))",
                  borderColor: "color-mix(in srgb, var(--accent-primary) 28%, var(--border-default))",
                  boxShadow: "0 20px 48px -20px rgba(11, 31, 58, 0.55)",
                }}
              >
                <div
                  className="border-b p-2"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                      style={{ color: "var(--text-muted)" }}
                    />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setOpen(false);
                          return;
                        }
                        onListKeyDown(e);
                      }}
                      placeholder={searchPlaceholder}
                      className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-[13px] outline-none"
                      style={{
                        background: "var(--bg-input)",
                        borderColor: "var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
                <ul className="max-h-52 overflow-y-auto py-1">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-2.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                      Aucun résultat
                    </li>
                  ) : (
                    filtered.map((row, idx) => {
                      const selectedRow =
                        row.value === "__CLEAR__" ? value === "" : row.value === value;
                      return (
                        <li key={row.value === "__CLEAR__" ? "__clear__" : `${row.value}-${row.label}`}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedRow}
                            className="flex w-full px-3 py-2 text-left text-[13px] transition"
                            style={{
                              color: selectedRow
                                ? "var(--accent-primary)"
                                : "var(--text-primary)",
                              fontWeight: selectedRow ? 600 : 400,
                              ...(idx === highlight ? primaryOptionHighlightStyle : {}),
                              ...(selectedRow ? primaryOptionSelectedStyle : {}),
                            }}
                            onMouseEnter={() => setHighlight(idx)}
                            onClick={() => pick(row)}
                          >
                            <span className="truncate">{row.label}</span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
