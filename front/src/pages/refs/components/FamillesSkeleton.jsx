export default function FamillesSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl border border-white/5 bg-white/[0.04]"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
