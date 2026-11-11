import { Building2, Globe2, MapPin, Package, Users } from "lucide-react";
import GlassPageHeader, { GlassAside } from "../../../components/ui/GlassPageHeader";
import SocieteKpiCard from "./SocieteKpiCard";
import { VENTES_RED } from "./societesTheme";
import { useLandingLang } from "../../landing/LandingLangContext";
import { interpolate } from "../../../i18n/languages";

export default function SocieteHeader({ companies, userCount, usersLoading }) {
  const { t } = useLandingLang();
  const visibleCount = companies.filter((s) => s.actif !== false).length;
  const locatedCount = companies.filter(
    (s) => s.latitude != null && s.longitude != null
  ).length;
  const total = companies.length || 1;
  const totalArticles = companies.reduce((n, s) => n + (s._count?.articles ?? 0), 0);

  return (
    <GlassPageHeader
      title={t.saTitle}
      subtitle={t.saSubtitle}
      icon={Building2}
      badge={t.saBadge}
      badgeIcon={Globe2}
      aside={
        <GlassAside
          icon={MapPin}
          label={t.saPlatform}
          value={
            <>
              <span className="tabular-nums text-emerald-300">{visibleCount}</span>
              {" / "}
              <span className="tabular-nums">{companies.length}</span>
              {" "}
              {interpolate(t.saTenantsActive, {
                n: `${visibleCount} / ${companies.length}`,
                s: companies.length !== 1 ? "s" : "",
              })}
            </>
          }
        />
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SocieteKpiCard
          delayIndex={0}
          title={t.saKpiCompanies}
          value={companies.length}
          icon={Building2}
          accentColor="#378ADD"
          valueColor="#378ADD"
          subtitle={t.saKpiCompaniesSub}
          barPct={100}
        />
        <SocieteKpiCard
          delayIndex={1}
          title={t.saKpiVisible}
          value={visibleCount}
          icon={Globe2}
          accentColor="#1D9E75"
          valueColor="#1D9E75"
          subtitle={interpolate(t.saKpiVisibleSub, { pct: Math.round((visibleCount / total) * 100) })}
          barPct={(visibleCount / total) * 100}
          pulse={visibleCount > 0 && visibleCount < total}
        />
        <SocieteKpiCard
          delayIndex={2}
          title={t.saKpiUsers}
          value={userCount}
          icon={Users}
          accentColor="#0EA5E9"
          valueColor="#0EA5E9"
          subtitle={t.saKpiUsersSub}
          formatValue={usersLoading ? () => "…" : undefined}
          barPct={usersLoading ? 12 : Math.min(100, (userCount / Math.max(userCount, 10)) * 100)}
        />
        <SocieteKpiCard
          delayIndex={3}
          title={t.saKpiArticles}
          value={totalArticles}
          icon={Package}
          accentColor={VENTES_RED.accent}
          valueColor={VENTES_RED.accent}
          subtitle={interpolate(t.saKpiGeo, {
            n: locatedCount,
            s: locatedCount !== 1 ? "s" : "",
          })}
          barPct={
            totalArticles > 0
              ? Math.min(100, (locatedCount / Math.max(companies.length, 1)) * 100)
              : 8
          }
          pulse={totalArticles > 0}
        />
      </div>
    </GlassPageHeader>
  );
}
