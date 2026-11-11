export default function RefsEmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#1a1d27]/40 px-6 py-16 text-center"
      style={{ animation: "refsFadeUp .4s ease both" }}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
          <Icon size={28} />
        </div>
      )}
      <h3 className="text-base font-medium text-slate-200">{title}</h3>
      {subtitle && <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
