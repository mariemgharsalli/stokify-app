export const DASHBOARD_VIEW_KEY = "stokify-dashboard-view";

export function resetDashboardToCinematicView() {
  try {
    sessionStorage.setItem(DASHBOARD_VIEW_KEY, "cinematic");
  } catch {
    /* ignore */
  }
}

export function readDashboardViewMode() {
  try {
    return sessionStorage.getItem(DASHBOARD_VIEW_KEY) === "details";
  } catch {
    return false;
  }
}

export function persistDashboardViewMode(showDetails) {
  try {
    sessionStorage.setItem(DASHBOARD_VIEW_KEY, showDetails ? "details" : "cinematic");
  } catch {
    /* ignore */
  }
}
