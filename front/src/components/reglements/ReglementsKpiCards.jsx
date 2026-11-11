import {
  ArrowDownLeft,
  Store,
  AlertTriangle,
  CircleCheck,
  Hourglass,
} from "lucide-react";
import KpiCard from "../ui/KpiCard";

export default function ReglementsKpiCards({ stats }) {
  const s = stats || {};
  const enRetard = Number(s.clientsEnRetard) || 0;
  const tendance = s.tendanceEncaisse;

  const encaisseSub =
    tendance !== undefined && tendance !== null
      ? `Paiements clients · ${tendance >= 0 ? "+" : ""}${tendance}% vs mois dernier`
      : "Paiements clients reçus";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        delayIndex={0}
        title="Encaissé ce mois"
        value={s.encaisseeMois ?? 0}
        isCurrency
        subtitle={encaisseSub}
        icon={ArrowDownLeft}
        accentColor="#1D9E75"
      />
      <KpiCard
        delayIndex={1}
        title="Payé fournisseurs"
        value={s.payeFournisseurs ?? 0}
        isCurrency
        subtitle="Règlements achats"
        icon={Store}
        accentColor="#378ADD"
      />
      <KpiCard
        delayIndex={2}
        title="Clients en retard"
        value={enRetard}
        subtitle="Non réglés > 30 jours"
        icon={enRetard > 0 ? AlertTriangle : CircleCheck}
        accentColor={enRetard > 0 ? "#E24B4A" : "#1D9E75"}
        pulse={enRetard > 0}
      />
      <KpiCard
        delayIndex={3}
        title="À encaisser"
        value={s.totalAEncaisser ?? 0}
        isCurrency
        subtitle="Ventes confirmées non réglées"
        icon={Hourglass}
        accentColor="#BE185D"
      />
    </div>
  );
}
