import { Building2, Globe, ShieldCheck } from "lucide-react";
import SocieteMetricCard from "./SocieteMetricCard";

export default function SocieteMetrics({ totalCompanies, visibleCompanies, totalUsers, usersLoading }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SocieteMetricCard icon={Building2} label="Sociétés" value={totalCompanies} delay={0} accent="rose" />
      <SocieteMetricCard
        icon={Globe}
        label="Visibles inscription"
        value={visibleCompanies}
        delay={60}
        accent="emerald"
      />
      <SocieteMetricCard
        icon={ShieldCheck}
        label="Utilisateurs"
        value={usersLoading ? 0 : totalUsers}
        delay={120}
        accent="indigo"
      />
    </div>
  );
}
