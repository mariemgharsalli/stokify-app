import { FolderTree, GitBranch, Package } from "lucide-react";
import { gradientFromString, useAnimatedNumber } from "./refsUtils";

function MiniStat({ icon: Icon, label, value, gradientSeed }) {
  const animated = useAnimatedNumber(value);
  const grad = gradientFromString(gradientSeed);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1a1d27]/80 px-4 py-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-md"
        style={{ background: grad }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-100">{animated}</p>
      </div>
    </div>
  );
}

export default function CatalogOverview({ famillesCount, sousFamillesCount, articlesCount }) {
  const max = Math.max(famillesCount, sousFamillesCount, articlesCount, 1);
  const famPct = (famillesCount / max) * 100;
  const sfPct = (sousFamillesCount / max) * 100;
  const artPct = (articlesCount / max) * 100;

  return (
    <div
      className="rounded-xl border border-white/10 bg-[#1a1d27]/60 p-4 backdrop-blur-sm"
      style={{ animation: "refsFadeUp .4s ease both" }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Richesse du référentiel</h3>
          <p className="text-[11px] text-slate-500">Structure du catalogue — aide à la décision</p>
        </div>
        <div className="hidden sm:flex items-center gap-1">
          {[famPct, sfPct, artPct].map((pct, i) => (
            <div
              key={i}
              className="rounded-full border border-white/10"
              style={{
                width: 28 + pct * 0.15,
                height: 28 + pct * 0.15,
                background: `conic-gradient(${gradientFromString(`ring-${i}`)} ${pct * 3.6}deg, rgba(255,255,255,0.06) 0)`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{
            width: `${famPct}%`,
            background: "linear-gradient(90deg, #2563eb, #06b6d4)",
          }}
          title={`${famillesCount} familles`}
        />
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{
            width: `${sfPct}%`,
            background: "linear-gradient(90deg, #10b981, #14b8a6)",
          }}
          title={`${sousFamillesCount} sous-familles`}
        />
        <div
          className="h-full transition-all duration-1000 ease-out"
          style={{
            width: `${artPct}%`,
            background: "linear-gradient(90deg, #7c3aed, #d946ef)",
          }}
          title={`${articlesCount} articles`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat icon={FolderTree} label="Familles" value={famillesCount} gradientSeed="overview-fam" />
        <MiniStat icon={GitBranch} label="Sous-familles" value={sousFamillesCount} gradientSeed="overview-sf" />
        <MiniStat icon={Package} label="Articles liés" value={articlesCount} gradientSeed="overview-art" />
      </div>
    </div>
  );
}
