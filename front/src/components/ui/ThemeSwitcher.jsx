import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun, Monitor } from "lucide-react";
import { useThemeStore } from "../../store/themeStore";
import { useLandingLang } from "../../pages/landing/LandingLangContext";

export default function ThemeSwitcher({ compact = false, menuPlacement = "auto" }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const { preference, effective, setTheme } = useThemeStore();
  const { t } = useLandingLang();

  const options = [
    { value: "dark", icon: Moon, label: t.themeDark },
    { value: "light", icon: Sun, label: t.themeLight },
    { value: "auto", icon: Monitor, label: t.themeAuto },
  ];

  const current = options.find((o) => o.value === preference) || options[0];
  const ActiveIcon =
    preference === "auto" ? Monitor : effective === "dark" ? Moon : Sun;

  const updateMenuPosition = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 150;
    let left = rect.right - menuWidth;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openDown =
      menuPlacement === "down" ||
      (menuPlacement !== "up" && (spaceBelow >= menuHeight || spaceBelow >= spaceAbove));

    const style = {
      position: "fixed",
      left,
      width: menuWidth,
      zIndex: 10000,
    };
    if (openDown) {
      style.top = Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - menuHeight - 8));
    } else {
      style.bottom = window.innerHeight - rect.top + 8;
    }
    setMenuStyle(style);
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
  }, [open, compact, menuPlacement]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (e) => {
      const inBtn = btnRef.current?.contains(e.target);
      const inMenu = menuRef.current?.contains(e.target);
      if (!inBtn && !inMenu) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const menu =
    open &&
    menuStyle &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label={t.themeChoose}
        style={{
          ...menuStyle,
          background: "var(--bg-dropdown)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          padding: 6,
          boxShadow: "var(--shadow-dropdown)",
          animation: "themeDropIn 150ms ease",
        }}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setTheme(opt.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 6,
                background: preference === opt.value ? "var(--accent-soft)" : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                color: preference === opt.value ? "var(--accent-primary)" : "var(--text-primary)",
                fontSize: 13,
              }}
            >
              <Icon size={16} aria-hidden />
              <span style={{ flex: 1 }}>{opt.label}</span>
              {preference === opt.value && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent-primary)",
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>,
      document.body
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) updateMenuPosition();
          setOpen((o) => !o);
        }}
        title={`${t.theme} : ${current.label}`}
        aria-label={t.themeChange}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-card-hover)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          cursor: "pointer",
          color: "var(--text-secondary)",
          flexShrink: 0,
        }}
      >
        <ActiveIcon size={17} aria-hidden />
      </button>
      {menu}
    </>
  );
}
