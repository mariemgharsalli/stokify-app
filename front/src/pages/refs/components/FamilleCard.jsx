import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, FolderTree, Layers, MoreVertical, Package, Power, PowerOff, Pencil } from "lucide-react";
import { EditCodeReadonly } from "./RefsCodeDisplay";
import RefsSegmentBar from "./RefsSegmentBar";
import SmartBadge from "./SmartBadge";
import SousFamilleCard from "./SousFamilleCard";
import {
  familleAccent,
  familleGradient,
  generateCodeFromName,
  getArticleCount,
  highlightMatch,
  refsInputClass,
  useAnimatedNumber,
} from "./refsUtils";
import {
  canDeleteFamillePermanent,
  parseRefsStatut,
  RefsStatutBadge,
} from "../refsStatusUi";

export default function FamilleCard({
  famille,
  sousFamilles,
  index,
  search,
  canWrite,
  isEditing,
  famEditForm,
  originalFamNom,
  existingFamilleCodes,
  onFamEditFormChange,
  onStartEditFamille,
  onCancelEditFamille,
  onSaveFamille,
  onDeleteFamille,
  onToggleStatutFamille,
  isSavingFamille,
  editingSousFamilleId,
  sfEditForm,
  originalSfNom,
  existingSfCodes,
  onSfEditFormChange,
  onStartEditSousFamille,
  onCancelEditSousFamille,
  onSaveSousFamille,
  onDeleteSousFamille,
  onToggleStatutSousFamille,
  isSavingSousFamille,
  famillesOptions,
  isHighRotation = false,
  highRotationSfIds = new Set(),
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const color = familleAccent(famille.code);
  const grad = familleGradient(famille.code);
  const articleCount = getArticleCount(famille);
  const sfCount = famille._count?.sousFamilles ?? sousFamilles.length;
  const animatedArticles = useAnimatedNumber(articleCount);
  const animatedSf = useAnimatedNumber(sfCount);
  const statut = parseRefsStatut(famille);

  const segmentData = useMemo(
    () =>
      sousFamilles
        .filter((sf) => getArticleCount(sf) > 0)
        .map((sf) => ({
          id: sf.id,
          label: sf.code,
          value: getArticleCount(sf),
        })),
    [sousFamilles]
  );

  useEffect(() => {
    if (!menu) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menu]);

  useEffect(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return;
    const matchSf = sousFamilles.some(
      (s) => s.code?.toLowerCase().includes(q) || s.nom?.toLowerCase().includes(q)
    );
    const matchFam =
      famille.code?.toLowerCase().includes(q) ||
      famille.nom?.toLowerCase().includes(q) ||
      (famille.description || "").toLowerCase().includes(q);
    if (matchSf || matchFam) setIsExpanded(true);
  }, [search, sousFamilles, famille]);

  function handleRegenerateFamCode() {
    const next = generateCodeFromName(
      famEditForm.nom,
      existingFamilleCodes.filter((c) => c !== famille.code)
    );
    if (
      !next ||
      !window.confirm(
        `Régénérer le code en « ${next} » ? Cela peut affecter les articles liés à l'ancien code « ${famEditForm.code} ».`
      )
    ) {
      return;
    }
    onFamEditFormChange((prev) => ({ ...prev, code: next }));
  }

  if (isEditing) {
    return (
      <article
        className="rounded-xl border border-violet-500/30 bg-[#1a1d27] p-4"
        style={{ animation: `refsFadeUp .35s ease ${index * 70}ms both` }}
      >
        <h4 className="mb-3 text-sm font-medium text-slate-200">Modifier la famille</h4>
        <div className="space-y-3">
          <EditCodeReadonly
            code={famEditForm.code}
            colorSeed={`famille-${famEditForm.code}`}
            originalNom={originalFamNom}
            currentNom={famEditForm.nom}
            onRegenerate={handleRegenerateFamCode}
          />
          <input
            className={refsInputClass}
            value={famEditForm.nom}
            onChange={(e) => onFamEditFormChange((prev) => ({ ...prev, nom: e.target.value }))}
            placeholder="Nom"
          />
          <input
            className={refsInputClass}
            value={famEditForm.description}
            onChange={(e) => onFamEditFormChange((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
          />
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSavingFamille}
              onClick={onSaveFamille}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onCancelEditFamille}
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
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -3, boxShadow: `0 12px 32px ${color}33`, borderColor: `${color}55` }
      }
      className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
    >
      <div
        className="absolute bottom-0 left-0 top-0 w-1"
        style={{ background: grad }}
        aria-hidden
      />
      <div className="p-4 pl-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md ring-2 ring-white/10"
            style={{ background: grad }}
          >
            <FolderTree size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block rounded-full border px-2 py-0.5 font-mono text-[11px]"
                style={{ borderColor: `${color}44`, background: `${color}18`, color }}
              >
                {highlightMatch(famille.code, search)}
              </span>
              {isHighRotation && <SmartBadge type="high-rotation" />}
              {articleCount === 0 && sfCount === 0 && <SmartBadge type="unused" />}
              <RefsStatutBadge row={famille} />
            </div>
            <h3 className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">
              {highlightMatch(famille.nom, search)}
            </h3>
            {famille.description && (
              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                {highlightMatch(famille.description, search)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <Package size={12} style={{ color }} />
                <span className="font-medium text-[var(--text-secondary)]">{animatedArticles}</span> article
                {articleCount !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers size={12} style={{ color }} />
                <span className="font-medium text-[var(--text-secondary)]">{animatedSf}</span> branche
                {sfCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          {canWrite && (
            <div className="flex shrink-0 items-center gap-1">
              {onToggleStatutFamille && (
                <button
                  type="button"
                  onClick={() => onToggleStatutFamille(famille)}
                  title={statut === "INACTIF" ? "Réactiver" : "Désactiver"}
                  className="rounded-lg p-1.5 transition hover:bg-white/5"
                  style={{ color: statut === "INACTIF" ? "#1D9E75" : "#94A3B8" }}
                >
                  {statut === "INACTIF" ? <Power size={16} /> : <PowerOff size={16} />}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5"
                onClick={() => onStartEditFamille(famille)}
              >
                <Pencil size={16} />
              </button>
              {canDeleteFamillePermanent(famille) && onDeleteFamille && (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-red-400 transition hover:bg-white/5"
                    onClick={() => setMenu((m) => !m)}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menu && (
                    <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-lg border border-white/10 bg-[#141a24] py-1 shadow-xl">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5"
                        onClick={() => {
                          onDeleteFamille(famille);
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

        {sfCount > 0 && (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-white/10 py-2 text-xs text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-300"
            onClick={() => setIsExpanded((o) => !o)}
            aria-expanded={isExpanded}
          >
            <ChevronDown
              size={16}
              className="transition-transform duration-300 ease-out"
              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
            {isExpanded
              ? "Replier les branches"
              : `Déployer les branches (${sfCount})`}
          </button>
        )}

        {sfCount === 0 && (
          <p className="mt-3 rounded-lg border border-dashed border-white/15 px-3 py-2 text-center text-xs text-slate-500">
            Aucune branche rattachée — arbre à compléter
          </p>
        )}

        <div className={`refs-collapse overflow-hidden ${isExpanded && sfCount > 0 ? "is-open" : ""}`}>
          <div className="mt-3 space-y-3 border-l-2 border-dashed pl-3" style={{ borderColor: `${color}33` }}>
            {isExpanded && segmentData.length > 0 && (
              <RefsSegmentBar segments={segmentData} parentSeed={`famille-${famille.code}`} />
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {sousFamilles.map((sf, si) => (
                <SousFamilleCard
                  key={sf.id}
                  sousFamille={sf}
                  parentCode={famille.code}
                  parentColor={color}
                  index={si}
                  search={search}
                  canWrite={canWrite}
                  isEditing={editingSousFamilleId === sf.id}
                  sfEditForm={sfEditForm}
                  originalNom={editingSousFamilleId === sf.id ? originalSfNom : ""}
                  existingCodes={existingSfCodes}
                  onSfEditFormChange={onSfEditFormChange}
                  onStartEdit={onStartEditSousFamille}
                  onCancelEdit={onCancelEditSousFamille}
                  onSave={onSaveSousFamille}
                  onDelete={onDeleteSousFamille}
                  onToggleStatut={onToggleStatutSousFamille}
                  isSaving={isSavingSousFamille}
                  famillesOptions={famillesOptions}
                  isHighRotation={highRotationSfIds.has(sf.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
