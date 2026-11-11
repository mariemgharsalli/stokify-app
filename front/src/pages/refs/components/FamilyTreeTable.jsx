import { Fragment, useState } from "react";
import {
  FolderTree,
  GitBranch,
  Hash,
  Layers,
  Package,
  Zap,
} from "lucide-react";
import { parseRefsStatut } from "../refsStatusUi";
import { getArticleCount } from "./refsUtils";
import FamillesPagination from "./FamillesPagination";
import {
  MarquesActionsBar,
  MarquesArticlesBadge,
  MarquesAvatarWrap,
  MarquesCodeChip,
  MarquesColHead,
  MarquesColHeadActions,
  MarquesIconBtn,
  MarquesStatutPill,
  MarquesTableShell,
  MarquesTableStyles,
} from "./marquesTableUi";

function brandHue(nom) {
  return ((nom?.charCodeAt(0) ?? 65) * 137) % 360;
}

function familleAvatarStyle(nom) {
  const hue = brandHue(nom);
  return {
    background: `linear-gradient(145deg, hsl(${hue}, 58%, 42%), hsl(${(hue + 28) % 360}, 52%, 32%))`,
    boxShadow: `0 4px 14px -2px hsl(${hue}, 55%, 38% / 0.45)`,
  };
}

const inputStyle = {
  background: "var(--bg-input, var(--color-background-secondary))",
  border: "1px solid var(--border-default, var(--color-border-tertiary))",
  color: "var(--text-primary, var(--color-text-primary))",
};

function RowActions({
  statut,
  isEditing,
  onEdit,
  onToggle,
  onSave,
  onCancel,
  savePending,
  onDelete,
  canDelete,
}) {
  if (isEditing) {
    return (
      <MarquesActionsBar>
        <MarquesIconBtn variant="save" title="Enregistrer" disabled={savePending} onClick={onSave} />
        <MarquesIconBtn variant="cancel" title="Annuler" onClick={onCancel} />
      </MarquesActionsBar>
    );
  }

  return (
    <MarquesActionsBar>
      <MarquesIconBtn variant="edit" title="Modifier" onClick={onEdit} />
      <MarquesIconBtn
        variant={statut === "INACTIF" ? "activate" : "deactivate"}
        title={statut === "INACTIF" ? "Réactiver" : "Désactiver"}
        onClick={onToggle}
      />
      {canDelete && onDelete && (
        <MarquesIconBtn variant="delete" title="Supprimer définitivement" onClick={onDelete} />
      )}
    </MarquesActionsBar>
  );
}

export default function FamilyTreeTable({
  familles,
  totalCount,
  totalSfCount,
  page,
  pages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sousByFamille,
  canWrite,
  onToggleStatutFamille,
  onToggleStatutSousFamille,
  onEditFamille,
  onEditSousFamille,
  onDeleteFamille,
  onDeleteSousFamille,
  canDeleteFamille,
  canDeleteSousFamille,
  editingFamilleId,
  famEditForm,
  onFamEditFormChange,
  onSaveFamille,
  onCancelEditFamille,
  updateFamPending,
  editingSousFamilleId,
  sfEditForm,
  onSfEditFormChange,
  onSaveSousFamille,
  onCancelEditSousFamille,
  updateSfPending,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleExpanded = (id) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const displayTotal = totalCount ?? familles.length;
  const sfTotal = totalSfCount ?? familles.reduce((acc, f) => acc + (sousByFamille.get(f.id)?.length || 0), 0);

  return (
    <>
      <MarquesTableStyles />
      <MarquesTableShell
        resultCount={displayTotal}
        title="Hiérarchie familles"
        subtitle={`${displayTotal} famille${displayTotal !== 1 ? "s" : ""} · ${sfTotal} sous-famille${sfTotal !== 1 ? "s" : ""}`}
        icon={FolderTree}
      >
        <div className="max-h-[min(70vh,640px)] overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="marques-pro-thead sticky top-0 z-10">
              <tr>
                <MarquesColHead icon={Layers} label="Nom" tone="info" />
                <MarquesColHead icon={Hash} label="Code" tone="accent" />
                <MarquesColHead icon={Package} label="Articles" tone="success" />
                <MarquesColHead icon={Zap} label="Statut" tone="warning" />
                {canWrite && <MarquesColHeadActions />}
              </tr>
            </thead>
            <tbody>
              {familles.map((f, i) => {
                const sousFamilles = sousByFamille.get(f.id) || [];
                const isOpen = expanded.has(f.id);
                const isEditingFam = editingFamilleId === f.id;
                const famStatut = parseRefsStatut(f);
                const articleCount = getArticleCount(f);
                const hue = brandHue(f.nom);

                return (
                  <Fragment key={f.id}>
                    <tr
                      className={`familles-tree-row--parent group ${famStatut === "INACTIF" ? "is-inactive opacity-80" : ""}`}
                      style={{
                        "--famille-accent": `hsl(${hue}, 58%, 48%)`,
                        animation: `marquesRowIn 0.4s ease ${Math.min(i * 45, 540)}ms both`,
                      }}
                    >
                      <td
                        className="cursor-pointer px-5 py-4 align-middle"
                        onClick={() => {
                          if (!isEditingFam) toggleExpanded(f.id);
                        }}
                      >
                        {isEditingFam ? (
                          <div className="space-y-2">
                            <input
                              className="w-full max-w-[260px] rounded-xl px-3 py-2 text-sm font-semibold outline-none"
                              style={{
                                ...inputStyle,
                                border: "1px solid var(--accent-info)",
                                boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent-info) 15%, transparent)",
                              }}
                              value={famEditForm.nom}
                              onChange={(e) => onFamEditFormChange((p) => ({ ...p, nom: e.target.value }))}
                              placeholder="Nom"
                              autoFocus
                            />
                            <input
                              className="w-full max-w-[260px] rounded-xl px-3 py-2 text-xs outline-none"
                              style={inputStyle}
                              value={famEditForm.description}
                              onChange={(e) =>
                                onFamEditFormChange((p) => ({ ...p, description: e.target.value }))
                              }
                              placeholder="Description (optionnel)"
                            />
                          </div>
                        ) : (
                          <div className="flex w-full min-w-0 items-center gap-3">
                            <span
                              className={`familles-tree-expand ${isOpen ? "is-open" : ""}`}
                              aria-hidden
                            >
                              <GitBranch size={13} strokeWidth={2.25} />
                            </span>
                            <MarquesAvatarWrap>
                              <div
                                className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                                style={familleAvatarStyle(f.nom)}
                              >
                                {(f.nom || "?").charAt(0).toUpperCase()}
                              </div>
                            </MarquesAvatarWrap>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="truncate text-sm font-semibold tracking-tight"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {f.nom}
                                </span>
                                <span
                                  className={`familles-sf-count ${sousFamilles.length > 0 ? "has-items" : ""}`}
                                >
                                  <GitBranch size={10} />
                                  {sousFamilles.length}
                                </span>
                              </div>
                              {f.description && (
                                <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                                  {f.description}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        {isEditingFam ? (
                          <input
                            className="w-32 rounded-xl px-3 py-2 font-mono text-xs font-bold outline-none"
                            style={{
                              ...inputStyle,
                              border: "1px solid var(--info-border)",
                              color: "var(--info-text)",
                            }}
                            value={famEditForm.code}
                            onChange={(e) => onFamEditFormChange((p) => ({ ...p, code: e.target.value }))}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : f.code ? (
                          <MarquesCodeChip code={f.code} />
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <MarquesArticlesBadge count={articleCount} />
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <MarquesStatutPill row={f} />
                      </td>
                      {canWrite && (
                        <td
                          className="w-[120px] min-w-[120px] px-5 py-4 align-middle text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RowActions
                            statut={famStatut}
                            isEditing={isEditingFam}
                            onEdit={() => onEditFamille(f)}
                            onToggle={() => onToggleStatutFamille(f)}
                            onSave={() => onSaveFamille(f)}
                            onCancel={onCancelEditFamille}
                            savePending={updateFamPending}
                            onDelete={() => onDeleteFamille(f)}
                            canDelete={canDeleteFamille(f)}
                          />
                        </td>
                      )}
                    </tr>

                    {isOpen &&
                      sousFamilles.map((sf, j) => {
                        const isEditingSf = editingSousFamilleId === sf.id;
                        const sfStatut = parseRefsStatut(sf);
                        const sfArticles = getArticleCount(sf);

                        return (
                          <tr
                            key={sf.id}
                            className={`familles-tree-row--child group ${sfStatut === "INACTIF" ? "is-inactive opacity-80" : ""}`}
                            style={{
                              animation: `marquesRowIn 0.35s ease ${Math.min(i * 45 + j * 35 + 50, 600)}ms both`,
                            }}
                          >
                            <td className="px-5 py-3.5 align-middle">
                              {isEditingSf ? (
                                <input
                                  className="ml-14 w-full max-w-[220px] rounded-xl px-3 py-2 text-sm outline-none"
                                  style={{
                                    ...inputStyle,
                                    border: "1px solid var(--success-border)",
                                    boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent-success) 15%, transparent)",
                                  }}
                                  value={sfEditForm.nom}
                                  onChange={(e) => onSfEditFormChange((p) => ({ ...p, nom: e.target.value }))}
                                  placeholder="Nom"
                                  autoFocus
                                />
                              ) : (
                                <div className="familles-child-connector">
                                  <span className="familles-child-line" aria-hidden />
                                  <span className="familles-child-icon">
                                    <GitBranch size={13} strokeWidth={2.25} />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className="truncate text-sm font-medium"
                                        style={{ color: "var(--text-primary)" }}
                                      >
                                        {sf.nom}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5 align-middle">
                              {isEditingSf ? (
                                <input
                                  className="w-32 rounded-xl px-3 py-2 font-mono text-xs font-bold outline-none"
                                  style={{
                                    ...inputStyle,
                                    border: "1px solid var(--info-border)",
                                    color: "var(--info-text)",
                                  }}
                                  value={sfEditForm.code}
                                  onChange={(e) => onSfEditFormChange((p) => ({ ...p, code: e.target.value }))}
                                />
                              ) : sf.code ? (
                                <MarquesCodeChip code={sf.code} />
                              ) : (
                                <span className="text-xs text-[var(--text-muted)]">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 align-middle">
                              <MarquesArticlesBadge count={sfArticles} />
                            </td>
                            <td className="px-5 py-3.5 align-middle">
                              <MarquesStatutPill row={sf} />
                            </td>
                            {canWrite && (
                              <td
                                className="w-[120px] min-w-[120px] px-5 py-3.5 align-middle text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <RowActions
                                  statut={sfStatut}
                                  isEditing={isEditingSf}
                                  onEdit={() => onEditSousFamille(sf)}
                                  onToggle={() => onToggleStatutSousFamille(sf)}
                                  onSave={() => onSaveSousFamille(sf)}
                                  onCancel={onCancelEditSousFamille}
                                  savePending={updateSfPending}
                                  onDelete={() => onDeleteSousFamille(sf)}
                                  canDelete={canDeleteSousFamille(sf)}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {onPageChange && (
          <FamillesPagination
            page={page}
            pages={pages}
            total={displayTotal}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        )}
      </MarquesTableShell>
    </>
  );
}
