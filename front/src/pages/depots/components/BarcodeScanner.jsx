import { useEffect, useRef, useState } from "react";
import { ScanLine, X } from "lucide-react";

const SCANNER_ANIMATIONS = `
  @keyframes scanLine {
    0%, 100% { top: 8px; opacity: 1; }
    50% { top: calc(100% - 8px); opacity: 0.7; }
  }
  @keyframes flashSuccess {
    0% { opacity: 0; }
    50% { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [manualCode, setManualCode] = useState("");
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    detectedRef.current = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 640, height: 480 },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanLoop();
        }
      } catch {
        setError("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
      }
    }

    async function scanLoop() {
      if (!("BarcodeDetector" in window)) {
        setError("MANUAL_INPUT");
        return;
      }

      const detector = new window.BarcodeDetector({
        formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8"],
      });

      async function detect() {
        if (detectedRef.current) return;
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            detectedRef.current = true;
            setLastResult(code);
            setTimeout(() => onDetected(code), 300);
            return;
          }
        } catch {
          /* continue scanning */
        }
        animFrameRef.current = requestAnimationFrame(detect);
      }
      detect();
    }

    startCamera();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [onDetected]);

  return (
    <div
      className="fixed inset-0 z-[500] flex flex-col"
      style={{ background: "#000", animation: "fadeIn 0.2s ease" }}
    >
      <style>{SCANNER_ANIMATIONS}</style>

      <div className="flex items-center justify-between p-4 text-white">
        <div>
          <h2 className="text-base font-medium">Scanner un emplacement</h2>
          <p className="text-xs text-white/60">Pointez vers le code-barres de l&apos;étiquette</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2">
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {error !== "MANUAL_INPUT" && (
        <div className="relative flex-1">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-48 w-48">
              {[
                "top-0 left-0 border-t-2 border-l-2",
                "top-0 right-0 border-t-2 border-r-2",
                "bottom-0 left-0 border-b-2 border-l-2",
                "bottom-0 right-0 border-b-2 border-r-2",
              ].map((c, i) => (
                <div key={i} className={`absolute h-8 w-8 ${c} border-[#1D9E75]`} />
              ))}
              <div
                className="absolute left-2 right-2 h-0.5 bg-[#1D9E75]"
                style={{ animation: "scanLine 2s ease-in-out infinite" }}
              />
            </div>
          </div>

          {lastResult && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#1D9E75]/20"
              style={{ animation: "flashSuccess 0.3s ease" }}
            >
              <div className="rounded-2xl bg-[#1D9E75] px-6 py-3">
                <p className="font-medium text-white">✓ {lastResult}</p>
              </div>
            </div>
          )}

          {error && error !== "MANUAL_INPUT" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-6 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>
      )}

      {error === "MANUAL_INPUT" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <ScanLine className="h-16 w-16 text-white/30" />
          <p className="text-center text-sm text-white/60">
            Scanner non disponible sur cet appareil. Saisissez le code manuellement :
          </p>
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manualCode && onDetected(manualCode)}
            placeholder="Code emplacement…"
            autoFocus
            className="w-full max-w-sm rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center font-mono text-lg text-white outline-none"
          />
          <button
            type="button"
            onClick={() => manualCode && onDetected(manualCode)}
            disabled={!manualCode}
            className="rounded-xl px-6 py-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#1D9E75" }}
          >
            Localiser cet emplacement
          </button>
        </div>
      )}

      <div className="p-4 text-center text-xs text-white/40">
        Formats supportés : QR Code, Code 128, Code 39, EAN
      </div>
    </div>
  );
}
