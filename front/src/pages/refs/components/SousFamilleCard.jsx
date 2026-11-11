import { useEffect, useRef, useState } from "react";
import { MoreVertical, Package, Power, PowerOff, Pencil } from "lucide-react";
import { EditCodeReadonly } from "./RefsCodeDisplay";
import SmartBadge from "./SmartBadge";
import {
  generateSousFamilleCodeFromName,
  getArticleCount,
  highlightMatch,
  lighterGradientFromString,
  refsInputClass,
  sousFamilleAccent,
  useAnimatedNumber,
} from "./refsUtils";
import {
  canDeleteSousFamillePermanent,
  parseRefsStatut,
  RefsStatutBadge,
} from "../refsStatusUi";

export default function SousFamilleCard({
  sousFamille,
  parentCode,
  parentColor,
  index,
  search,
  canWrite,
  isEditing,
  sfEditForm,
  originalNom,
  existingCodes,
  onSfEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onToggleStatut,
  isSaving,
  famillesOptions,
  variant = "nested",
  isHighRotation = false,
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const code = sousFamille.code;
  const pCode = parentCode || sousFamille.famille?.code || "";
  const color = sousFamilleAccent(code, pCode);
  const articleCount = getArticleCount(sousFamille);
  const animatedCount = useAnimatedNumber(articleCount);
  const statut = parseRefsStatut(sousFamille);
  const gradientSeed = pCode ? `sf-${pCode}-${code}` : `sf-${code}`;

  useEffect(() => {
    if (!menu) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menu]);

  function handleRegenerateCode() {
    const parent =
      famillesOptions.find((f) => String(f.id) === String(sfEditForm.familleId))?.code || pCode;
    const next = generateSousFamilleCodeFromName(
      sfEditForm.nom,
      parent,
      existingCodes.filter((c) => c !== sousFamille.code)
    );
    if (
      !next ||
      !window.confirm(
        `Régénérer le code en « ${next} » ? Cela peut affecter les articles liés à l'ancien code « ${sfEditForm.code} ».`
      )
    ) {
      return;
    }
    onSfEditFormChange((prev) => ({ ...prev, code: next }));
  }

  if (isEditing) {
    return (
      <div
        className="rounded-lg border border-violet-500/25 bg-[#141a24] p-3"
        style={{ animation: `refsFadeUp .3s ease ${index * 50}ms both` }}
      >
        <div className="space-y-2">
          <EditCodeReadonly
            code={sfEditForm.code}
            colorSeed={gradientSeed}
            originalNom={originalNom}
            currentNom={sfEditForm.nom}
            onRegenerate={handleRegenerateCode}
          />
          <input
            className={`${refsInputClass} text-xs`}
            value={sfEditForm.nom}
            onChange={(e) => onSfEditFormChange((prev) => ({ ...prev, nom: e.target.value }))}
            placeholder="Nom"
          />
          {variant === "flat" && (
            <select
              className={`${refsInputClass} text-xs`}
              value={sfEditForm.familleId}
              onChange={(e) => onSfEditFormChange((prev) => ({ ...prev, familleId: e.target.value }))}
            >
              <option value="">Famille parente…</option>
              {famillesOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.nom}
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSaving || (variant === "flat" && !sfEditForm.familleId)}
              onClick={onSave}
              className="rounded bg-violet-600 px-2 py-1 text-[11px] text-white disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded border border-white/15 px-2 py-1 text-[11px] text-slate-300"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="refs-branch-connector group/sf relative rounded-lg border border-white/10 p-3 pl-4 transition duration-200 hover:-translate-y-0.5"
      style={{
        animation: `refsFadeUp .3s ease ${index * 50}ms both`,
        background: lighterGradientFromString(gradientSeed),
        opacity: statut === "INACTIF" ? 0.85 : 1,
      }}
    >
      {variant === "nested" && (
        <span
          className="absolute left-0 top-4 h-2 w-2 -translate-x-1/2 rounded-full ring-2 ring-[#1a1d27]"
          style={{ background: parentColor || color }}
          aria-hidden
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-block rounded-full border px-1.5 py-0.5 font-mono text-[10px]"
              style={{ borderColor: `${color}44`, color }}
            >
              {highlightMatch(sousFamille.code, search)}
            </span>
            {isHighRotation && <SmartBadge type="high-rotation" />}
            {articleCount === 0 && <SmartBadge type="unused" />}
            <RefsStatutBadge row={sousFamille} />
          </div>
          <p className="mt-1 text-sm font-medium text-slate-200">
            {highlightMatch(sousFamille.nom, search)}
          </p>
          {variant === "flat" && sousFamille.famille && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {sousFamille.famille.code} · {sousFamille.famille.nom}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
            <Package size={11} style={{ color }} />
            <span>
              <span className="font-medium text-slate-400">{animatedCount}</span> article
              {articleCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-1">
            {onToggleStatut && (
              <button
                type="button"
                onClick={() => onToggleStatut(sousFamille)}
                title={statut === "INACTIF" ? "Réactiver" : "Désactiver"}
                className="rounded p-1 transition hover:bg-white/5"
                style={{ color: statut === "INACTIF" ? "#1D9E75" : "#94A3B8" }}
              >
                {statut === "INACTIF" ? <Power size={14} /> : <PowerOff size={14} />}
              </button>
            )}
            <button
              type="button"
              className="rounded p-1 text-slate-500 transition hover:bg-white/5"
              onClick={() => onStartEdit(sousFamille)}
            >
              <Pencil size={14} />
            </button>
            {canDeleteSousFamillePermanent(sousFamille) && onDelete && (
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  className="rounded p-1 text-red-400 transition hover:bg-white/5"
                  onClick={() => setMenu((m) => !m)}
                >
                  <MoreVertical size={14} />
                </button>
                {menu && (
                  <div className="absolute right-0 top-6 z-10 min-w-[120px] rounded-lg border border-white/10 bg-[#141a24] py-1 shadow-xl">
                    <button
                      type="button"
                      className="block w-full px-2 py-1.5 text-left text-[11px] text-red-400 hover:bg-white/5"
                      onClick={() => {
                        onDelete(sousFamille);
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
    </div>
  );
}
