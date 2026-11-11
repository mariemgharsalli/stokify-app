import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { primaryOptionHighlightStyle, primaryOptionSelectedStyle } from "../../utils/brandStyles";

/**
 * Liste déroulante simple (sans recherche), rendue en portail pour un z-index fiable.
 */
export default function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = "— Choisir —",
  disabled = false,
  className = "",
  id,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const displayText = selected?.label ?? "";

  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((o) => o.value === value)),
    [options, value]
  );

  useEffect(() => {
    if (open) setHighlight(selectedIndex);
  }, [open, selectedIndex]);

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
      setMenuStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
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
    onChange(row.value);
    setOpen(false);
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
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const row = options[highlight];
      if (row) pick(row);
    }
  }

  return (
    <div ref={rootRef} className={`relative min-w-[140px] ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full min-w-[140px] items-center justify-between gap-2 rounded-lg border border-white/10 bg-navy-950 px-3 py-2 text-left text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          value === "" || value == null ? "text-slate-500" : "text-slate-100"
        }`}
      >
        <span className="truncate">{displayText || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            className="z-[10050] overflow-hidden rounded-lg border border-white/20 bg-navy-950 shadow-2xl ring-1 ring-black/40"
            style={{ position: "fixed", top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
            role="listbox"
            onKeyDown={onListKeyDown}
            tabIndex={-1}
          >
            <ul className="max-h-72 overflow-y-auto py-1">
              {options.map((row, idx) => {
                const isSelected = row.value === value;
                const isHighlighted = idx === highlight;
                return (
                  <li key={`${row.value}-${row.label}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`flex w-full px-3 py-2.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "font-semibold"
                          : isHighlighted
                            ? "text-white"
                            : "text-slate-100 hover:bg-white/10 hover:text-white"
                      }`}
                      style={{
                        ...(isHighlighted ? primaryOptionHighlightStyle : {}),
                        ...(isSelected ? primaryOptionSelectedStyle : {}),
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pick(row)}
                    >
                      <span className="truncate">{row.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
