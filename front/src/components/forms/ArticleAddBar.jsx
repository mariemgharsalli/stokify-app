import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { inputClass, btnPrimary, primaryButtonStyle } from "./formStyles";

function useDebounce(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ArticleAddBar({ articles = [], stockByArticle = {}, onAdd, disabled }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 200);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const list = q
      ? articles.filter((a) => `${a.code} ${a.libelle}`.toLowerCase().includes(q))
      : articles;
    return list.slice(0, 30);
  }, [articles, debounced]);

  function handleAdd(art) {
    onAdd(art);
    setQuery("");
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (e.target.closest?.("[data-article-add-bar]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative flex flex-col gap-2 sm:flex-row" data-article-add-bar>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          disabled={disabled}
          className={`${inputClass} pl-9 transition focus:border-[#7c3aed]/50 focus:ring-2 focus:ring-[#7c3aed]/15`}
          placeholder="Code ou libellé de l'article…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
        {open && !disabled ? (
          <ul
            className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-[#7c3aed]/25 py-1 shadow-xl"
            style={{ background: "var(--bg-card)" }}
          >
            {filtered.map((a) => {
              const stock = stockByArticle[a.id];
              const rupture = stock != null && stock <= 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[#7c3aed]/8"
                    onClick={() => handleAdd(a)}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-[var(--text-muted)]">{a.code}</span> — {a.libelle}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-muted)]">
                      {a.prixAchat != null ? `${Number(a.prixAchat).toFixed(3)} TND` : ""}
                      {stock != null ? ` · stock ${stock}` : ""}
                    </span>
                    {rupture ? (
                      <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                        Rupture
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        disabled={disabled || filtered.length === 0}
        className={`${btnPrimary} shrink-0 sm:min-w-[120px]`}
        style={primaryButtonStyle}
        onClick={() => filtered[0] && handleAdd(filtered[0])}
      >
        <Plus className="h-4 w-4" />
        Ajouter
      </button>
    </div>
  );
}
