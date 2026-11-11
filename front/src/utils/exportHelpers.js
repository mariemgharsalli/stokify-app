/**
 * Déclenche un téléchargement navigateur fiable (Chrome/Edge).
 * Ne pas appeler URL.revokeObjectURL tout de suite : le navigateur annule le téléchargement.
 */
export function downloadBlob(blob, filename) {
  if (!blob) return;
  const data =
    blob instanceof Blob ? blob : new Blob([blob], { type: blob.type || "application/octet-stream" });

  if (typeof window.navigator?.msSaveOrOpenBlob === "function") {
    window.navigator.msSaveOrOpenBlob(data, filename);
    return;
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Si l'API renvoie une erreur JSON avec responseType blob, extraire le message. */
export async function readBlobErrorMessage(blob, fallback = "Erreur export") {
  if (!(blob instanceof Blob)) return fallback;
  const type = String(blob.type || "").toLowerCase();
  if (!type.includes("json") && !type.includes("text")) return fallback;
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed.message || parsed.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function downloadApiBlob(response, filename) {
  const status = response?.status;
  const blob = response?.data;
  if (status >= 400) {
    throw new Error(await readBlobErrorMessage(blob));
  }
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Fichier export vide ou invalide");
  }
  downloadBlob(blob, filename);
}

export async function exportInventairePdf(api, inventaireId, reference = inventaireId) {
  const res = await api.get(`inventaires/${inventaireId}/export-pdf`, { responseType: "blob" });
  downloadBlob(res.data, `inventaire-${reference}.pdf`);
}

export async function exportInventaireExcel(api, inventaireId, reference = inventaireId) {
  const res = await api.get(`inventaires/${inventaireId}/export-excel`, { responseType: "blob" });
  downloadBlob(res.data, `inventaire-${reference}.xlsx`);
}

export async function exportInventairesListExcel(api, params = {}) {
  const res = await api.get("inventaires/export-list-excel", { params, responseType: "blob" });
  downloadBlob(res.data, "inventaires-liste.xlsx");
}

export async function exportRapportPdf(api, params) {
  const res = await api.get("accounting/export-rapport-pdf", { params, responseType: "blob" });
  downloadBlob(res.data, "rapport-financier.pdf");
}

export async function exportRapportExcel(api, params) {
  const res = await api.get("accounting/export-rapport-excel", { params, responseType: "blob" });
  downloadBlob(res.data, "rapport-stokify.xlsx");
}

export async function exportValuationExcel(api, params = {}) {
  const methode = params.methodePrix || params.methode || "CMP";
  const res = await api.get("valuation/export-excel", { params, responseType: "blob" });
  downloadBlob(res.data, `valorisation-${methode}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportRotationExcel(api, params = {}) {
  const res = await api.get("rapports/rotation/export-excel", { params, responseType: "blob" });
  downloadBlob(res.data, `rapport-rotation-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportDeadStockReportExcel(api, params = {}) {
  const res = await api.get("rapports/dead-stock/export-excel", { params, responseType: "blob" });
  downloadBlob(res.data, `rapport-stock-dormant-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportCoutStockageExcel(api, params = {}) {
  const periode = params.periode || new Date().toISOString().slice(0, 7);
  const res = await api.get("cout-stockage/export-excel", { params, responseType: "blob" });
  downloadBlob(res.data, `rapport-couts-stockage-${periode}.xlsx`);
}

export async function exportArticlesExcel(api, params = {}) {
  const res = await api.get("articles/export-excel", { params, responseType: "blob" });
  const suffix = params.ids ? "selection" : "tous";
  downloadBlob(res.data, `articles-export-${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportStockExcel(api) {
  const res = await api.get("stock/export-excel", { responseType: "blob" });
  downloadBlob(res.data, "stock-export.xlsx");
}

export async function exportAchatsExcel(api, params = {}) {
  const res = await api.get("achats/export", { params: { ...params, format: "excel" }, responseType: "blob" });
  downloadBlob(res.data, `achats-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportVentesExcel(api, params = {}) {
  const res = await api.get("ventes/export", { params: { ...params, format: "excel" }, responseType: "blob" });
  downloadBlob(res.data, `ventes-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportMouvementsExcel(api, params = {}) {
  const res = await api.get("mouvements/export", { params: { ...params, format: "excel" }, responseType: "blob" });
  downloadBlob(res.data, `mouvements-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportLotsExpiringExcel(api, params = {}) {
  const res = await api.get("lots/export/expiring", { params: { ...params, format: "excel" }, responseType: "blob" });
  downloadBlob(res.data, `lots-expiring-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportCsvFromRows(rows, filename = "export.csv") {
  if (!rows?.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(";")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
}
