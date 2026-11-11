import AchatsKpiCard from "../../../components/achats/AchatsKpiCard";

/** Orange-rouge alerte — même style que la carte « Non réglé » (Achats). */
export const REFS_ALERT_ORANGE = "#E24B4A";

export default function RefsAlertKpiCard({ pulse, ...props }) {
  return (
    <AchatsKpiCard
      accentColor={REFS_ALERT_ORANGE}
      valueColor={REFS_ALERT_ORANGE}
      solidIcon
      pulse={pulse}
      {...props}
    />
  );
}
