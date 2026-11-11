/** Theme inventaires — aligné glass navy / bleu-cyan (pas de violet) */
export const INV_THEME = {
  bg: "transparent",
  card: "var(--bg-card)",
  border: "var(--border-default)",
  accent: "#378ADD",
  cyan: "#0EA5E9",
  success: "#1D9E75",
  danger: "#E24B4A",
  amber: "#D97706",
  text: "var(--text-primary)",
  muted: "var(--text-muted)",
};

export const STATUS_MAP = {
  EN_COURS: {
    label: "En cours",
    bg: "rgba(55,138,221,0.16)",
    color: "#7dd3fc",
    dot: "#378ADD",
    pulse: true,
  },
  VALIDE: {
    label: "Validé",
    bg: "rgba(29,158,117,0.16)",
    color: "#6ee7b7",
    dot: "#1D9E75",
  },
  ANNULE: {
    label: "Annulé",
    bg: "rgba(226,75,74,0.14)",
    color: "#fca5a5",
    dot: "#E24B4A",
  },
  BROUILLON: {
    label: "Brouillon",
    bg: "rgba(148,163,184,0.12)",
    color: "#94a3b8",
    dot: "#64748b",
  },
};

export const INV_STATUT_OPTIONS = [
  { value: "", label: "Tous", color: "#3b82f6" },
  { value: "EN_COURS", label: "En cours", color: "#378ADD" },
  { value: "VALIDE", label: "Validé", color: "#1D9E75" },
  { value: "ANNULE", label: "Annulé", color: "#E24B4A" },
];

export function formatTnd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  try {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency: "TND",
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `${Math.round(Number(n))} TND`;
  }
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-TN");
}

export function ligneEcart(qteTheorique, qteReelle) {
  if (qteReelle == null || qteReelle === "") return null;
  return Number(qteReelle) - Number(qteTheorique ?? 0);
}

export function computeRecap(lignes) {
  const total = lignes.length;
  let saisis = 0;
  let conformes = 0;
  let ecartsNeg = 0;
  let ecartsPos = 0;
  let valeurEcart = 0;
  for (const l of lignes) {
    if (l.qteReelle == null) continue;
    saisis += 1;
    const ec = ligneEcart(l.qteTheorique, l.qteReelle);
    valeurEcart += Number(l.valeurEcart ?? 0);
    if (ec === 0) conformes += 1;
    else if (ec < 0) ecartsNeg += 1;
    else ecartsPos += 1;
  }
  return {
    total,
    saisis,
    conformes,
    ecartsNeg,
    ecartsPos,
    ecarts: ecartsNeg + ecartsPos,
    valeurEcart,
    progressionPct: total > 0 ? Math.round((saisis / total) * 100) : 0,
    precisionPct: saisis > 0 ? Math.round((conformes / saisis) * 100) : 0,
  };
}

export function suggestInvCode() {
  const y = new Date().getFullYear();
  const n = String(Date.now()).slice(-4);
  return `INV-${y}-${n}`;
}

/** Date au format JJ/MM/AAAA pour les libellés de duplication. */
export function formatDateDuplication(d = new Date()) {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Préremplit le formulaire « Nouvel inventaire » à partir d'un inventaire source.
 */
export function buildDuplicatePrefill(source) {
  const ref = String(source?.reference || "").trim();
  const articleIds = [
    ...new Set(
      (source?.lignes || [])
        .map((l) => l.articleId ?? l.article?.id)
        .filter((id) => id != null && Number.isFinite(Number(id)))
        .map(Number)
    ),
  ];
  return {
    code: ref ? `COPIE-${ref}` : suggestInvCode(),
    depotId: source?.depotId != null ? String(source.depotId) : "",
    note: ref
      ? `Dupliqué depuis ${ref} le ${formatDateDuplication()}`
      : `Dupliqué le ${formatDateDuplication()}`,
    typeInv: "partiel",
    articleIds,
    sourceReference: ref,
  };
}

export function printFicheInventaire(inventaire, options = {}) {
  const { masquerTheorique = true, titre = "Fiche de comptage terrain" } = options;
  const lignes = inventaire?.lignes ?? [];
  const depot = inventaire?.depot;
  const date = new Date(inventaire?.date ?? Date.now());

  const byEmpl = {};
  lignes.forEach((l) => {
    const key = l.emplacement?.code ?? "Sans emplacement";
    if (!byEmpl[key]) byEmpl[key] = [];
    byEmpl[key].push(l);
  });

  const rowsHtml = Object.entries(byEmpl)
    .map(
      ([empl, rows]) => `
    <tr class="zone-header">
      <td colspan="5">📍 Emplacement : ${empl}</td>
    </tr>
    ${rows
      .map(
        (l, i) => `
      <tr class="${i % 2 === 0 ? "even" : ""}">
        <td class="code">${l.article?.code ?? "—"}</td>
        <td>${l.article?.libelle ?? "—"}</td>
        <td class="center">${l.article?.unite ?? "u"}</td>
        <td class="center">${masquerTheorique ? "" : Number(l.qteTheorique ?? 0)}</td>
        <td class="saisie-box"></td>
      </tr>
    `
      )
      .join("")}
  `
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Fiche inventaire ${inventaire?.reference}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    .header-left h1 { font-size: 18px; font-weight: 900; margin: 0 0 2px; color: #1a1a2e; }
    .header-left p { font-size: 10px; color: #555; margin: 2px 0; }
    .header-right { text-align: right; }
    .ref-badge { background: #1a1a2e; color: white; padding: 6px 14px; border-radius: 6px; font-size: 14px; font-weight: bold; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .meta-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 10px; }
    .meta-box label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin-bottom: 2px; }
    .meta-box span { font-size: 12px; font-weight: 600; }
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 14px; }
    .sig-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px; }
    .sig-box label { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; }
    .sig-line { margin-top: 24px; border-top: 1px dashed #9ca3af; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead { background: #1a1a2e; color: white; }
    thead th { padding: 7px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
    thead th.center { text-align: center; }
    .zone-header td { background: #f3f4f6; font-weight: 700; font-size: 10px; padding: 5px 8px; color: #374151; border-top: 2px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; letter-spacing: .03em; }
    tr.even td { background: #f9fafb; }
    td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    td.code { font-family: 'Courier New', monospace; font-weight: 600; color: #4338ca; font-size: 10px; }
    td.center { text-align: center; }
    td.saisie-box { width: 80px; text-align: center; }
    .saisie-input { display: inline-block; width: 70px; height: 24px; border: 1.5px solid #374151; border-radius: 4px; }
    .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    .instruction-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 10px; color: #78350f; }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>📋 ${titre}</h1>
    <p>Référence : <strong>${inventaire?.reference ?? "—"}</strong></p>
    <p>Dépôt : <strong>${depot?.code ?? ""} — ${depot?.libelle ?? depot?.nom ?? "—"}</strong></p>
  </div>
  <div class="header-right">
    <div class="ref-badge">${inventaire?.reference ?? ""}</div>
    <p style="font-size:10px;color:#555;margin-top:6px">
      ${date.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
    </p>
  </div>
</div>
<div class="meta-grid">
  <div class="meta-box">
    <label>Type inventaire</label>
    <span>${inventaire?.typeInventaire === "tournant" ? "🔄 Tournant" : inventaire?.typeInventaire === "partiel" ? "📦 Partiel" : "🏭 Complet"}</span>
  </div>
  <div class="meta-box">
    <label>Nombre d'articles</label>
    <span>${lignes.length} article(s)</span>
  </div>
  <div class="meta-box">
    <label>Stock théorique masqué</label>
    <span>${masquerTheorique ? "✅ Oui (mode aveugle)" : "❌ Non"}</span>
  </div>
</div>
<div class="instruction-box">
  ⚠️ Instructions : Comptez physiquement chaque article et inscrivez la quantité réelle dans la colonne "Qté comptée".
  ${masquerTheorique ? "Le stock théorique est volontairement masqué pour garantir un comptage indépendant." : ""}
  En cas de doute, recomptez. Signez la fiche à la fin.
</div>
<div class="signature-row">
  <div class="sig-box">
    <label>Compteur (Nom &amp; Prénom)</label>
    <div class="sig-line"></div>
  </div>
  <div class="sig-box">
    <label>Responsable inventaire</label>
    <div class="sig-line"></div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width:90px">Code article</th>
      <th>Désignation</th>
      <th class="center" style="width:50px">Unité</th>
      <th class="center" style="width:80px">${masquerTheorique ? "" : "Qté système"}</th>
      <th class="center" style="width:90px">Qté comptée ✍️</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>
<div class="footer">
  <span>Stokify — Gestion intelligente de stock</span>
  <span>Fiche générée le ${new Date().toLocaleString("fr-FR")} · ${lignes.length} articles</span>
  <span>Page 1</span>
</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}
