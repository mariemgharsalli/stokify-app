import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Globe2, Search } from "lucide-react";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

export default function AppLanguageSwitcher() {
  const { lang, setLang, t, languages } = useLandingLang();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState(null);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const current = languages.find((l) => l.code === lang) || languages[0];
  const rtl = lang === "ar";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.short.toLowerCase().includes(q) ||
        item.region?.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
    );
  }, [languages, query]);

  const updateMenuPosition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    let left = rtl ? rect.left : rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 10,
      left,
      width,
      zIndex: 12000,
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onReflow = () => updateMenuPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, rtl]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return undefined;
    }
    const onPointer = (e) => {
      const inBtn = btnRef.current?.contains(e.target);
      const inPanel = panelRef.current?.contains(e.target);
      if (!inBtn && !inPanel) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function selectLang(code) {
    if (code === lang) {
      setOpen(false);
      return;
    }
    const next = languages.find((l) => l.code === code);
    setLang(code);
    setFlash(next?.label || code);
    window.setTimeout(() => setFlash(null), 1400);
    setOpen(false);
  }

  return (
    <div className="app-lang" ref={rootRef}>
      <motion.button
        ref={btnRef}
        type="button"
        className={`app-lang-trigger${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t.langChoose || t.lang}
        title={t.langTitle || t.lang}
        whileHover={reduceMotion ? undefined : { y: -1, scale: 1.03 }}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      >
        <span className="app-lang-orbit" aria-hidden />
        <Globe2 className="app-lang-globe" size={15} strokeWidth={2} />
        <img src={current.flagSrc} alt="" className="app-lang-flag" draggable={false} />
        <span className="app-lang-code">{current.short}</span>
      </motion.button>

      <AnimatePresence>
        {flash && (
          <motion.span
            className="app-lang-flash"
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {flash}
          </motion.span>
        )}
      </AnimatePresence>

      {open &&
        menuStyle &&
        createPortal(
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={t.langTitle || t.lang}
            className="app-lang-panel"
            style={menuStyle}
            data-no-i18n
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="app-lang-panel-head">
              <div className="app-lang-panel-kicker">
                <Globe2 size={14} />
                <span>{t.langTitle}</span>
              </div>
              <p>{t.langSubtitle}</p>
              <label className="app-lang-search">
                <Search size={13} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.langSearch}
                  aria-label={t.langSearch}
                />
              </label>
            </div>

            <ul className="app-lang-grid">
              {filtered.map((item) => {
                const selected = item.code === lang;
                return (
                  <li key={item.code}>
                    <button
                      type="button"
                      className={`app-lang-card${selected ? " is-selected" : ""}`}
                      onClick={() => selectLang(item.code)}
                      aria-pressed={selected}
                    >
                      <span className="app-lang-card-flag-wrap">
                        <img src={item.flagSrc} alt="" draggable={false} />
                      </span>
                      <span className="app-lang-card-copy">
                        <strong>{item.label}</strong>
                        <em>{item.region}</em>
                      </span>
                      <span className="app-lang-card-meta">
                        <b>{item.short}</b>
                        {selected ? <Check size={14} /> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="app-lang-panel-foot">
              <span className="app-lang-dot" />
              {t.langApplied}
            </div>
          </motion.div>,
          document.body
        )}
    </div>
  );
}
