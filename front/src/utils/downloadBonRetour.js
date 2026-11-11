import api from "../services/api";

export const MOTIF_RETOUR_LABEL = {
  NON_CONFORME: "Non-conforme",
  ABIME: "Abîmé",
  ERREUR_REFERENCE: "Erreur de référence",
  DATE_PEREMPTION_COURTE: "Date de péremption courte",
  SURPLUS: "Surplus",
  QUALITE_INSUFFISANTE: "Qualité insuffisante",
  AUTRE: "Autre",
};

export function motifRetourTexte(retour) {
  if (!retour) return "—";
  return retour.notes || MOTIF_RETOUR_LABEL[retour.motif] || retour.motif || "—";
}

async function readBlobMessage(data) {
  if (!(data instanceof Blob)) return "";
  try {
    const json = JSON.parse(await data.text());
    return json?.message || "";
  } catch {
    return "";
  }
}

/** Télécharge le bon de retour PDF émis par l'API. */
export async function downloadBonRetourPdf(retourId, reference) {
  try {
    const res = await api.get(`achats/retours-fournisseur/${retourId}/pdf`, { responseType: "blob" });
    const type = String(res.headers?.["content-type"] || "");
    if (!type.includes("pdf")) {
      const message = (await readBlobMessage(res.data)) || "Impossible de générer le bon de retour";
      throw new Error(message);
    }
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = String(reference || retourId).replace(/[^\w.-]+/g, "_");
    a.href = url;
    a.download = `bon-retour-${safe}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (e) {
    const fromBlob = await readBlobMessage(e.response?.data);
    throw new Error(fromBlob || e.response?.data?.message || e.message || "Impossible de générer le bon de retour");
  }
}
