export default function UserStatusDot({ actif, neverConnected = false }) {
  if (neverConnected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        Jamais connecté
      </span>
    );
  }
  if (actif) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#34d399]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Actif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#f87171]">
      <span className="h-2 w-2 rounded-full bg-red-400" />
      Inactif
    </span>
  );
}
