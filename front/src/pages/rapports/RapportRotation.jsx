import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageShell from "../../components/ui/PageShell";
import RotationReportContent from "../../components/reports/RotationReportContent";

export default function RapportRotation() {
  return (
    <PageShell
      title="Rapport de rotation"
      subtitle="Analyse du taux de rotation par article — les articles à faible rotation apparaissent en premier."
      actions={
        <Link
          to="/rapports"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-muted)", border: "0.5px solid var(--color-border-tertiary, var(--border-default))" }}
        >
          <ArrowLeft size={16} /> Retour
        </Link>
      }
    >
      <RotationReportContent />
    </PageShell>
  );
}
