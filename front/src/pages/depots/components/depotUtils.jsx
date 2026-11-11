import { DEPOT_COLORS } from "../depotsTheme";

export function depotGradient(code = "") {
  const i = (code.charCodeAt(0) || 0) % DEPOT_COLORS.length;
  const [a, b] = DEPOT_COLORS[i];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function depotMarkerColor(code = "") {
  const i = (code.charCodeAt(0) || 0) % DEPOT_COLORS.length;
  return DEPOT_COLORS[i][0];
}

export const EMP_TYPES = [
  { val: "ZONE", label: "Zone" },
  { val: "RAYON", label: "Rayon" },
  { val: "ETAGERE", label: "Étagère" },
  { val: "ALLEE", label: "Allée" },
  { val: "CASIER", label: "Casier" },
  { val: "AUTRE", label: "Autre" },
];

export function highlightMatch(text, term) {
  if (!term || !text) return text;
  const q = term.trim();
  if (!q) return text;
  const idx = String(text).toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-sky-500/25 px-0.5 text-sky-700 dark:text-sky-200">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function suggestDepotCode() {
  const n = Date.now().toString().slice(-4);
  return `DEP${n}`;
}

export function suggestEmpCode() {
  const n = Date.now().toString().slice(-4);
  return `EMP${n}`;
}
