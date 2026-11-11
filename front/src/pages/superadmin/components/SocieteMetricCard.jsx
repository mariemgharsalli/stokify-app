import { useAnimatedNumber } from "../../refs/components/refsUtils";

export default function SocieteMetricCard({ icon: Icon, label, value, suffix = "", delay = 0, accent = "violet" }) {
  const animated = useAnimatedNumber(typeof value === "number" ? value : parseFloat(value) || 0);
  const display = Number.isInteger(Number(value)) ? Math.round(animated) : animated.toFixed(1);

  const accentMap = {
    rose: "from-rose-500/15 to-fuchsia-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/25",
    violet: "from-violet-500/15 to-indigo-500/10 text-violet-600 dark:text-violet-400 border-violet-200/80 dark:border-violet-500/25",
    emerald: "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/25",
    indigo: "from-indigo-500/15 to-blue-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-500/25",
  };
  const accentCls = accentMap[accent] ?? accentMap.violet;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#1a1d27] dark:hover:border-rose-500/20"
      style={{ animation: `superadminFadeUp 0.4s ease ${delay}ms both` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {display}
            {suffix}
          </p>
        </div>
        {Icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br ${accentCls}`}
          >
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
