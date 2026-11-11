export function scorePassword(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return Math.min(4, s);
}

const LEVELS = [
  { label: "Faible", color: "#ef4444", pct: 25 },
  { label: "Moyen", color: "#f97316", pct: 50 },
  { label: "Bon", color: "#eab308", pct: 75 },
  { label: "Fort", color: "#10b981", pct: 100 },
];

export default function PasswordStrength({ password }) {
  const score = scorePassword(password);
  const level = LEVELS[Math.max(0, score - 1)] || LEVELS[0];
  const pct = password ? level.pct : 0;

  return (
    <div className="space-y-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#2d3148]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: level.color }}
        />
      </div>
      <p className="text-[11px] text-slate-500">
        Force : <span style={{ color: level.color }}>{password ? level.label : "—"}</span>
      </p>
    </div>
  );
}
