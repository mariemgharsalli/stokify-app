export const calcTotalLigne = (ligne) => {
  const brut = (parseFloat(ligne.quantite) || 0) * (parseFloat(ligne.prixUnitHT ?? ligne.prixUnit) || 0);
  const remise = (parseFloat(ligne.remise) || 0) / 100;
  return parseFloat((brut * (1 - remise)).toFixed(3));
};

export const calcTVALigne = (ligne) => {
  const ht = calcTotalLigne(ligne);
  return parseFloat((ht * ((parseFloat(ligne.tauxTVA ?? ligne.tva) || 19) / 100)).toFixed(3));
};

export const calcTotaux = (lignes, remiseGlobale = 0) => {
  const ht = lignes.reduce((s, l) => s + calcTotalLigne(l), 0);
  const remise = ht * ((remiseGlobale || 0) / 100);
  const htApresRemise = ht - remise;
  const tvaBrut = lignes.reduce((s, l) => s + calcTVALigne(l), 0);
  const ratio = ht > 0 ? htApresRemise / ht : 1;
  const tva = parseFloat((tvaBrut * ratio).toFixed(3));
  const ttc = htApresRemise + tva;
  return {
    ht: ht.toFixed(3),
    remiseGlobale: remise.toFixed(3),
    htApresRemise: htApresRemise.toFixed(3),
    tva: tva.toFixed(3),
    ttc: ttc.toFixed(3),
  };
};

export const joursAvantExpiration = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const genererReference = (prefix, lastNum) => {
  const year = new Date().getFullYear();
  const num = String((lastNum || 0) + 1).padStart(4, "0");
  return `${prefix}-${year}-${num}`;
};

export const hashColorForm = (str = "") => {
  const colors = ["#7c3aed", "#378ADD", "#1D9E75", "#EF9F27", "#E24B4A", "#D4537E"];
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const initialsForm = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export function newLigneId() {
  return `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function tracksLot(mode) {
  return mode === "LOT" || mode === "LOT_SERIE";
}

export function tracksSerie(mode) {
  return mode === "SERIE" || mode === "LOT_SERIE";
}

export function resolveModeTracage(art) {
  const mt = String(art?.modeTracage || "").toUpperCase();
  if (mt === "LOT" || mt === "SERIE" || mt === "LOT_SERIE" || mt === "AUCUN") return mt;
  const mg = String(art?.modeGestion || "STANDARD").toUpperCase();
  if (["LOTS", "FIFO", "LOT", "FEFO"].includes(mg)) return "LOT";
  return "AUCUN";
}

export function articleFromRow(art) {
  if (!art) return null;
  const modeTracage = resolveModeTracage(art);
  return {
    id: art.id,
    code: art.code,
    libelle: art.libelle,
    unite: art.unite || "UN",
    modeGestion: String(art.modeGestion || "STANDARD").toUpperCase(),
    modeTracage,
    tracageAuto: Boolean(art.tracageAuto) && modeTracage !== "AUCUN",
    strategieSortie: String(art.strategieSortie || art.modeGestion || "STANDARD").toUpperCase(),
    imageUrl: art.imageUrl,
    famille: art.famille,
    prixAchat: art.prixAchat ?? 0,
    prixVente: art.prixVente ?? 0,
    cmp: art.cmp ?? art.prixAchat ?? 0,
    tauxTva: art.tauxTva ?? art.tvaPrix ?? art.tva ?? 19,
    tva: art.tauxTva ?? art.tvaPrix ?? art.tva ?? 19,
  };
}

export function ligneToPayload(l) {
  const q = Number(l.quantite);
  const pu = Number(l.prixUnitHT ?? l.prixUnit);
  const rPct = Number(l.remise) || 0;
  const remiseAbs = Math.round(q * pu * (rPct / 100) * 100) / 100;
  return {
    articleId: Number(l.article?.id ?? l.articleId),
    quantite: q,
    prixUnit: pu,
    remise: remiseAbs,
    ...(l.dateExpiration ? { dateExpiration: l.dateExpiration } : {}),
  };
}
