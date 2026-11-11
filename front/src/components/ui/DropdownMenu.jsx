import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { getOverlayRoot } from "../../utils/overlayRoot";

const MENU_WIDTH_DEFAULT = 192;
const MENU_ITEM_HEIGHT = 40;

export default function DropdownMenu({
  items = [],
  align = "right",
  menuWidth = MENU_WIDTH_DEFAULT,
  triggerClassName,
  ariaLabel = "Plus d'actions",
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (
        btnRef.current &&
        !btnRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }

    const updatePosition = () => {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = items.length * MENU_ITEM_HEIGHT + 8;
      let top = rect.bottom + 4;
      let left = align === "left" ? rect.left : rect.right - menuWidth;

      if (top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 4);
      }
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      setPos({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, align, items.length, menuWidth]);

  if (!items.length) return null;

  const menu =
    open && pos ? (
      <div
        ref={menuRef}
        role="menu"
        className="stokify-dropdown-menu"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: menuWidth,
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.tooltip}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.action?.();
              }}
              className="flex w-full items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: item.color || "var(--text-primary)" }}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
              {item.label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={
          triggerClassName ||
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        }
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {menu ? createPortal(menu, getOverlayRoot()) : null}
    </>
  );
}
