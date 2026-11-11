import { ScanLine } from "lucide-react";
import { unlockAudio } from "../lib/feedback";
import { fr } from "../strings/fr";

export function openTerrainScan(navigate) {
  unlockAudio();
  navigate("/terrain/scan");
}

export default function ScanFab({ onPress, label = fr.navScan }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="terrain-scan-fab relative flex h-[4.5rem] w-[4.5rem] -translate-y-3 flex-col items-center justify-center rounded-full touch-manipulation"
    >
      <ScanLine size={26} aria-hidden />
      <span className="text-xs font-bold leading-none">{label}</span>
    </button>
  );
}
