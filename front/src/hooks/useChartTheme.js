import { useMemo } from "react";
import { useThemeStore } from "../store/themeStore";
import { getChartTheme } from "../utils/chartTheme";

export function useChartTheme() {
  const effective = useThemeStore((s) => s.effective);
  return useMemo(() => getChartTheme(), [effective]);
}
