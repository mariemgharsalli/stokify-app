export function calcProfileCompletion(user) {
  const fields = [user?.prenom, user?.nom, user?.telephone, user?.poste, user?.bio, user?.avatar];
  const filled = fields.filter((f) => String(f || "").trim()).length;
  return Math.round((filled / fields.length) * 100);
}

export function resolveSocieteLabel(user) {
  const soc = user?.societe;
  if (!soc) return "Stokify";
  const nom = String(soc.nom || "").trim();
  const ville = String(soc.ville || "").trim();
  if (nom && ville) return `${nom} — ${ville}`;
  return nom || String(soc.code || "").trim() || "Stokify";
}

export function formatLastLoginShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Aujourd'hui, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `Hier, ${time}`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Points normalisés 0–1 pour mini sparkline */
export function buildSparklinePoints(loginCount = 0) {
  const base = Math.max(1, Number(loginCount) || 1);
  const seeds = [0.35, 0.42, 0.38, 0.55, 0.48, 0.62, 0.58, 0.72, 0.68, 0.85, 0.78, 1];
  return seeds.map((s, i) => {
    const wobble = ((base + i * 3) % 7) * 0.02;
    return Math.min(1, s * (0.75 + Math.min(base, 20) / 40) + wobble);
  });
}
