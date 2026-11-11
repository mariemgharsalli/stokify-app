const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/pages/refs/Familles.jsx");
let s = fs.readFileSync(filePath, "utf8");

const familleViewStart = s.indexOf('        ) : viewMode === "famille" ? (');
const listeViewStart = s.indexOf('        ) : (\n          <div className="grid gap-6 lg:grid-cols-2">');
if (familleViewStart < 0 || listeViewStart < 0) {
  console.error("markers not found", familleViewStart, listeViewStart);
  process.exit(1);
}

const familleViewReplacement = `        ) : viewMode === "famille" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredFamilles.map((f, i) => {
              const sfOfFam = sousByFamille.get(f.id) || [];
              return (
                <FamilleCard
                  key={f.id}
                  famille={f}
                  sousFamilles={sfOfFam}
                  index={i}
                  search={search}
                  canWrite={canWrite}
                  isEditing={editingFamilleId === f.id}
                  famEditForm={famEditForm}
                  originalFamNom={originalFamNom}
                  existingFamilleCodes={existingFamilleCodes}
                  onFamEditFormChange={setFamEditForm}
                  onStartEditFamille={startEditFamille}
                  onCancelEditFamille={cancelEditFamille}
                  onSaveFamille={() =>
                    updateFam.mutate({
                      id: f.id,
                      payload: {
                        code: famEditForm.code.trim(),
                        nom: famEditForm.nom.trim(),
                        description: famEditForm.description.trim() || null,
                      },
                    })
                  }
                  onToggleActifFamille={(fam) =>
                    setConfirmToggle({
                      item: fam,
                      refType: "famille",
                      nextActif: nextActifValue(fam.actif),
                    })
                  }
                  isSavingFamille={updateFam.isPending}
                  editingSousFamilleId={editingSousFamilleId}
                  sfEditForm={sfEditForm}
                  originalSfNom={originalSfNom}
                  existingSfCodes={existingSfCodes}
                  onSfEditFormChange={setSfEditForm}
                  onStartEditSousFamille={startEditSousFamille}
                  onCancelEditSousFamille={cancelEditSousFamille}
                  onSaveSousFamille={() =>
                    updateSf.mutate({
                      id: editingSousFamilleId,
                      payload: {
                        code: sfEditForm.code.trim(),
                        nom: sfEditForm.nom.trim(),
                        familleId: Number(sfEditForm.familleId),
                      },
                    })
                  }
                  onToggleActifSousFamille={(sf) =>
                    setConfirmToggle({
                      item: sf,
                      refType: "sous-famille",
                      nextActif: nextActifValue(sf.actif),
                    })
                  }
                  isSavingSousFamille={updateSf.isPending}
                  famillesOptions={familles}
                  isHighRotation={highRotationFamIds.has(f.id)}
                  highRotationSfIds={highRotationSfIds}
                  totalCatalogArticles={totalCatalogArticles}
                />
              );
            })}
          </div>`;

s = s.slice(0, familleViewStart) + familleViewReplacement + s.slice(listeViewStart);

const sfListStart = s.indexOf('                {filteredSous.map((s, i) => {');
const sfListEnd = s.indexOf('                })}\n              </div>\n            </div>\n          </div>\n        )}');
if (sfListStart < 0 || sfListEnd < 0) {
  console.error("sf list markers not found", sfListStart, sfListEnd);
  process.exit(1);
}

const sfListReplacement = `                <SousFamillesListView
                  sousFamilles={filteredSous}
                  search={search}
                  canWrite={canWrite}
                  editingSousFamilleId={editingSousFamilleId}
                  sfEditForm={sfEditForm}
                  originalSfNom={originalSfNom}
                  existingSfCodes={existingSfCodes}
                  onSfEditFormChange={setSfEditForm}
                  onStartEditSousFamille={startEditSousFamille}
                  onCancelEditSousFamille={cancelEditSousFamille}
                  onSaveSousFamille={() =>
                    updateSf.mutate({
                      id: editingSousFamilleId,
                      payload: {
                        code: sfEditForm.code.trim(),
                        nom: sfEditForm.nom.trim(),
                        familleId: Number(sfEditForm.familleId),
                      },
                    })
                  }
                  onToggleActifSousFamille={(sf) =>
                    setConfirmToggle({
                      item: sf,
                      refType: "sous-famille",
                      nextActif: nextActifValue(sf.actif),
                    })
                  }
                  isSavingSousFamille={updateSf.isPending}
                  famillesOptions={familles}
                  highRotationSfIds={highRotationSfIds}
                  totalCatalogArticles={totalCatalogArticles}
                />`;

s = s.slice(0, sfListStart) + sfListReplacement + s.slice(sfListEnd);

fs.writeFileSync(filePath, s);
console.log("Familles.jsx patched OK");
