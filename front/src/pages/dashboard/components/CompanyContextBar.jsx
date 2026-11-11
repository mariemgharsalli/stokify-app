import { Building2, ArrowLeftRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DASHBOARD_SURFACE } from "./dashboardTones";
import { useLandingLang } from "../../landing/LandingLangContext";

export default function CompanyContextBar({ company }) {
  const navigate = useNavigate();
  const { t } = useLandingLang();
  if (!company) return null;

  const code = String(company.code ?? "").trim();
  const nom = String(company.nom ?? "").trim();

  return (
    <div
      className={`${DASHBOARD_SURFACE.contextBar} flex flex-col gap-3 px-4 py-3 animate-fadeUp sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--accent-info) 14%, transparent)",
            color: "var(--info-text)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent-info) 28%, transparent)",
          }}
        >
          <Building2 className="h-4 w-4" />
        </div>
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          {t.dashCompanyContext}{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            [{code}] — {nom}
          </span>
        </p>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--dash-line)] bg-[var(--bg-hover)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-all hover:border-[color-mix(in_srgb,var(--accent-info)_35%,transparent)] hover:text-[var(--text-primary)]"
        onClick={() => navigate("/select-societe")}
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {t.dashChangeCompany}
      </button>
    </div>
  );
}
