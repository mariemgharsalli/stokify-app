import {
  AlertCircle,
  Building2,
  PieChart,
  Receipt,
  Scale,
  ShoppingCart,
} from "lucide-react";
import KpiCard from "../../../components/ui/KpiCard";

export default function ComptabiliteKpiCards({ stats }) {
  const s = stats || {};
  const solde = Number(s.solde ?? 0);
  const marge = Number(s.margePct ?? 0);
  const impayes = Number(s.impayesClients ?? 0);
  const dettes = Number(s.dettesFournisseurs ?? 0);

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        delayIndex={0}
        title="Achats du mois"
        value={s.achatsMois ?? 0}
        isCurrency
        subtitle="Total factures fournisseurs"
        icon={ShoppingCart}
        accentColor="#378ADD"
      />
      <KpiCard
        delayIndex={1}
        title="Ventes du mois"
        value={s.ventesMois ?? 0}
        isCurrency
        subtitle="CA total facturé"
        icon={Receipt}
        accentColor="#7F77DD"
      />
      <KpiCard
        delayIndex={2}
        title="Solde"
        value={solde}
        isCurrency
        subtitle="Ventes − Achats"
        icon={Scale}
        accentColor={solde >= 0 ? "#1D9E75" : "#E24B4A"}
      />
      <KpiCard
        delayIndex={3}
        title="Marge brute"
        value={marge}
        formatValue={(v) => `${Number(v).toFixed(1)} %`}
        subtitle="(Ventes − Coût revient) / Ventes HT"
        icon={PieChart}
        accentColor={marge >= 20 ? "#1D9E75" : marge >= 10 ? "#EF9F27" : "#E24B4A"}
      />
      <KpiCard
        delayIndex={4}
        title="Impayés clients"
        value={impayes}
        isCurrency
        subtitle={
          s.tauxRecouvrement != null
            ? `Taux recouvrement : ${Number(s.tauxRecouvrement).toFixed(1)} %`
            : "Ventes non encaissées"
        }
        icon={AlertCircle}
        accentColor={impayes > 0 ? "#E24B4A" : "#1D9E75"}
        pulse={impayes > 0}
      />
      <KpiCard
        delayIndex={5}
        title="Dettes fournisseurs"
        value={dettes}
        isCurrency
        subtitle="Achats non réglés"
        icon={Building2}
        accentColor={dettes > 0 ? "#EF9F27" : "#1D9E75"}
      />
    </div>
  );
}
