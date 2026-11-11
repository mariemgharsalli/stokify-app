import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MoreVertical, Package, Power, PowerOff, Pencil } from "lucide-react";
import { EditCodeReadonly } from "./RefsCodeDisplay";
import MarqueAvatar from "./MarqueAvatar";
import MarqueImagePicker from "./MarqueImagePicker";
import RefsShareBar from "./RefsShareBar";
import SmartBadge from "./SmartBadge";
import {
  colorFromString,
  generateCodeFromName,
  getArticleCount,
  highlightMatch,
  marqueAccent,
  resolveMarqueImageUrl,
  refsInputClass,
  useAnimatedNumber,
} from "./refsUtils";
import {
  canDeleteMarquePermanent,
  parseRefsStatut,
  RefsStatutBadge,
} from "../refsStatusUi";

export default function MarqueCard({
  marque,
  index,
  search,
  canWrite,
  isEditing,
  editForm,
  originalNom,
  existingCodes,
  editImagePreview,
  onPickEditImage,
  onClearEditImage,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleStatut,
  isSaving,
  totalCatalogArticles = 0,
  isHighRotation = false,
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const color = marqueAccent(marque.code);
  const [gradA, gradB] = colorFromString(`marque-${marque.code}`);
  const articleCount = getArticleCount(marque);
  const animatedCount = useAnimatedNumber(articleCount);
  const statut = parseRefsStatut(marque);
  const catalogShare =
    totalCatalogArticles > 0 ? (articleCount / totalCatalogArticles) * 100 : 0;

  useEffect(() => {
    if (!menu) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menu]);

  function handleRegenerateCode() {
    const next = generateCodeFromName(
      editForm.nom,
      existingCodes.filter((c) => c !== marque.code)
    );
    if (
      !next ||
      !window.confirm(
        `Régénérer le code en « ${next} » ? Cela peut affecter les articles liés à l'ancien code « ${editForm.code} ».`
      )
    ) {
      return;
    }
    onEditFormChange((prev) => ({ ...prev, code: next }));
  }

  const editPreviewSrc =
    editImagePreview ||
    (editForm.imageUrl ? resolveMarqueImageUrl(editForm.imageUrl) : "");

  if (isEditing) {
    return (
      <article
        className="rounded-xl border border-violet-500/30 bg-[#1a1d27] p-4"
        style={{ animation: `refsFadeUp .35s ease ${index * 70}ms both` }}
      >
        <h4 className="mb-3 text-sm font-medium text-slate-200">Modifier la marque</h4>
        <div className="space-y-3">
          <EditCodeReadonly
            code={editForm.code}
            colorSeed={`marque-${editForm.code}`}
            originalNom={originalNom}
            currentNom={editForm.nom}
            onRegenerate={handleRegenerateCode}
          />
          <input
            className={refsInputClass}
            value={editForm.nom}
            onChange={(e) => onEditFormChange((prev) => ({ ...prev, nom: e.target.value }))}
            placeholder="Nom"
          />
          <MarqueImagePicker
            nom={editForm.nom}
            code={editForm.code}
            previewSrc={editPreviewSrc}
            onPickFile={onPickEditImage}
            onClear={onClearEditImage}
            compact
          />
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSaving || !editForm.code.trim() || !editForm.nom.trim()}
              onClick={onSave}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              Annuler
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: statut === "INACTIF" ? 0.85 : 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -3, boxShadow: `0 12px 32px ${color}40`, borderColor: `${color}55` }
      }
      className="group rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start gap-3">
        <MarqueAvatar marque={marque} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block rounded-full border px-2 py-0.5 font-mono text-[11px]"
              style={{
                borderColor: `${color}44`,
                background: `${color}18`,
                color,
              }}
            >
              {highlightMatch(marque.code, search)}
            </span>
            {isHighRotation && <SmartBadge type="high-rotation" />}
            {articleCount === 0 && <SmartBadge type="unused" />}
            <RefsStatutBadge row={marque} />
          </div>
          <h3 className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">
            {highlightMatch(marque.nom, search)}
          </h3>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Package size={13} style={{ color }} />
            <span>
              <span className="font-medium text-[var(--text-secondary)]">{animatedCount}</span> article
              {articleCount !== 1 ? "s" : ""}
            </span>
            {articleCount > 0 && (
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: color }} />
            )}
          </div>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-1">
            {onToggleStatut && (
              <button
                type="button"
                onClick={() => onToggleStatut(marque)}
                title={statut === "INACTIF" ? "Réactiver" : "Désactiver"}
                className="rounded-lg p-1.5 transition hover:bg-white/5"
                style={{ color: statut === "INACTIF" ? "#1D9E75" : "#94A3B8" }}
              >
                {statut === "INACTIF" ? <Power size={16} /> : <PowerOff size={16} />}
              </button>
            )}
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              onClick={() => onStartEdit(marque)}
              aria-label="Modifier"
            >
              <Pencil size={16} />
            </button>
            {canDeleteMarquePermanent(marque) && onDelete && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-red-400 transition hover:bg-white/5"
                  onClick={() => setMenu((m) => !m)}
                  aria-label="Plus d'actions"
                >
                  <MoreVertical size={16} />
                </button>
                {menu && (
                  <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-lg border border-white/10 bg-[#141a24] py-1 shadow-xl">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5"
                      onClick={() => {
                        onDelete(marque);
                        setMenu(false);
                      }}
                    >
                      Supprimer définitivement
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {totalCatalogArticles > 0 && articleCount > 0 && (
        <RefsShareBar
          value={catalogShare}
          color={gradA}
          secondaryColor={gradB}
          label="Part du catalogue"
          height={5}
        />
      )}
    </motion.article>
  );
}
