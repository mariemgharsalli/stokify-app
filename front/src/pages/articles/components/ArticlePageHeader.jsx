import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { CircleCheck, Package, PackageX, PlusCircle, Upload } from "lucide-react";
import GlassPageHeader from "../../../components/ui/GlassPageHeader";
import { PRIMARY_BTN_CLASSES, primaryButtonStyle } from "../../../utils/brandStyles";
import { useLandingLang } from "../../landing/LandingLangContext";

function useCountUp(target, enabled) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    const end = Number(target) || 0;
    if (!enabled || reduceMotion) {
      setValue(end);
      return undefined;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, reduceMotion]);

  return Math.round(value);
}

function StatChip({ icon: Icon, value, label, tone, loading }) {
  const n = useCountUp(value, !loading);
  return (
    <span className={`page-hero__chip page-hero__chip--${tone}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {loading ? (
        <span className="page-hero__chip-skel" aria-hidden />
      ) : (
        <strong>{n.toLocaleString("fr-FR")}</strong>
      )}
      <span>{label}</span>
    </span>
  );
}

export default function ArticlePageHeader({
  canWrite,
  onImport,
  onCreate,
  importPending = false,
  stats,
  statsLoading = false,
}) {
  const { tx } = useLandingLang();
  const ruptures = Number(stats?.ruptures) || 0;

  return (
    <GlassPageHeader
      title="Articles"
      subtitle="Référentiel produits — images, stock, prix et statut"
      icon={Package}
      badge="Catalogue"
      chips={
        <>
          <StatChip
            icon={Package}
            value={stats?.total}
            label={tx("articles")}
            tone="sky"
            loading={statsLoading}
          />
          <StatChip
            icon={CircleCheck}
            value={stats?.actifs}
            label={tx("actifs")}
            tone="emerald"
            loading={statsLoading}
          />
          <StatChip
            icon={PackageX}
            value={ruptures}
            label={tx("ruptures")}
            tone={ruptures > 0 ? "rose" : "sky"}
            loading={statsLoading}
          />
        </>
      }
      actions={
        <>
          <button
            type="button"
            onClick={onImport}
            disabled={importPending}
            className="page-hero__import inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium text-sky-50 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4 text-sky-300" aria-hidden />
            {importPending ? tx("Import en cours…") : tx("Importer")}
          </button>
          {canWrite ? (
            <button
              type="button"
              onClick={onCreate}
              className={`${PRIMARY_BTN_CLASSES} page-hero__create px-4 py-2.5`}
              style={primaryButtonStyle}
            >
              <PlusCircle className="h-[18px] w-[18px] shrink-0" aria-hidden />
              {tx("Nouvel article")}
            </button>
          ) : null}
        </>
      }
    />
  );
}
