import { AlertTriangle, Check } from "lucide-react";
import { fr } from "../strings/fr";
import SafeReply from "./SafeReply";

export default function BriefingCard({ briefing }) {
  if (!briefing?.greeting) return null;
  const tone = briefing.status?.tone;
  const Icon = tone === "ok" ? Check : AlertTriangle;
  return (
    <section className="terrain-briefing" aria-label={fr.stokiBriefing}>
      {briefing.status?.label ? (
        <p className={`terrain-lot-status is-${tone === "ok" ? "ok" : tone === "warn" ? "warn" : "danger"}`}>
          <Icon size={18} aria-hidden="true" />
          <span>{briefing.status.label}</span>
        </p>
      ) : null}
      <SafeReply content={briefing.greeting} />
      {briefing.kpis ? (
        <div className="terrain-kpis">
          <p><strong>{briefing.kpis.stockCount ?? 0}</strong><span>{fr.stokiKpiStock}</span></p>
          <p><strong>{briefing.kpis.ruptureCount ?? 0}</strong><span>{fr.stokiKpiRupture}</span></p>
          <p><strong>{briefing.kpis.lotsCount ?? 0}</strong><span>{fr.stokiKpiLots}</span></p>
        </div>
      ) : null}
    </section>
  );
}
