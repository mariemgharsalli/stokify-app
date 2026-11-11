import { DASHBOARD_SURFACE } from "./dashboardTones";

export function DashboardPageStyles() {
  return (
    <style>{`
      .dashboard-page-bg {
        --dash-line: color-mix(in srgb, var(--border-default) 82%, transparent);
        --dash-shadow: 0 18px 50px -28px rgba(15, 23, 42, 0.28), 0 1px 0 rgba(255,255,255,0.7) inset;
        --dash-glass: rgba(255, 255, 255, 0.72);
        --dash-glass-strong: rgba(255, 255, 255, 0.88);
        position: relative;
        isolation: isolate;
        background: transparent;
      }

      .dark .dashboard-page-bg {
        --dash-line: rgba(148, 163, 184, 0.14);
        --dash-shadow: 0 24px 60px -28px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(255,255,255,0.05) inset;
        --dash-glass: rgba(12, 18, 34, 0.62);
        --dash-glass-strong: rgba(14, 22, 42, 0.78);
        background: transparent;
      }

      .dash-glass-card {
        position: relative;
        overflow: hidden;
        border-radius: 1.25rem;
        border: 1px solid var(--dash-line);
        background: var(--dash-glass);
        box-shadow: var(--dash-shadow);
        backdrop-filter: blur(18px) saturate(1.2);
        -webkit-backdrop-filter: blur(18px) saturate(1.2);
      }

      .dash-glass-hover {
        transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease;
      }
      .dash-glass-hover:hover {
        transform: translateY(-3px);
        border-color: color-mix(in srgb, var(--accent-info) 38%, var(--dash-line));
        box-shadow: 0 22px 48px -24px color-mix(in srgb, var(--accent-info) 45%, transparent);
      }

      .dash-live-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #22c55e;
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
        animation: dashLivePulse 1.8s ease-out infinite;
      }

      .dash-kpi-pulse {
        animation: dashKpiPulse 2.6s ease-in-out infinite;
      }

      @keyframes dashLivePulse {
        0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
        70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
        100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
      }

      @keyframes dashKpiPulse {
        0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--kpi-accent) 18%, transparent); }
        50% { box-shadow: 0 0 26px 2px color-mix(in srgb, var(--kpi-accent) 30%, transparent); }
      }

      @media (prefers-reduced-motion: reduce) {
        .dash-live-dot,
        .dash-kpi-pulse {
          animation: none !important;
        }
      }
    `}</style>
  );
}

export default function DashboardPageBackground({ children }) {
  return (
    <div className={DASHBOARD_SURFACE.pageOuter}>
      <DashboardPageStyles />
      {children}
    </div>
  );
}
