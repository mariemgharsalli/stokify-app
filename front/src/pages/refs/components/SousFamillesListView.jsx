import SousFamilleCard from "./SousFamilleCard";

export default function SousFamillesListView({
  sousFamilles,
  search,
  canWrite,
  editingSousFamilleId,
  sfEditForm,
  originalSfNom,
  existingSfCodes,
  onSfEditFormChange,
  onStartEditSousFamille,
  onCancelEditSousFamille,
  onSaveSousFamille,
  onDeleteSousFamille,
  isSavingSousFamille,
  famillesOptions,
  highRotationSfIds = new Set(),
}) {
  return (
    <div className="refs-view-transition grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sousFamilles.map((sf, i) => (
        <SousFamilleCard
          key={sf.id}
          sousFamille={sf}
          parentCode={sf.famille?.code}
          index={i}
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
          isSaving={isSavingSousFamille}
          famillesOptions={famillesOptions}
          variant="flat"
          isHighRotation={highRotationSfIds.has(sf.id)}
        />
      ))}
    </div>
  );
}
