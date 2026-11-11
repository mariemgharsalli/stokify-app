import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { Flashlight, X } from "lucide-react";
import { phoneScanUrl } from "../lib/phoneScan";
import { useWakeLock } from "../lib/useWakeLock";
import SuccessMark from "../motion/SuccessMark";
import { fr } from "../strings/fr";

const NATIVE_FORMATS = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e"];
const DEDUPE_MS = 1500;
const SUCCESS_MS = 250;

const CAMERA_ATTEMPTS = [
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  },
  { audio: false, video: { facingMode: "environment" } },
  { audio: false, video: true },
];

function secureScanUrl() {
  return phoneScanUrl();
}

async function openCameraStream() {
  let lastError = null;
  for (const constraints of CAMERA_ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      const name = error?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") throw error;
    }
  }
  throw lastError || new Error("camera");
}

function trackHasTorch(track) {
  try {
    return Boolean(track?.getCapabilities?.().torch);
  } catch {
    return false;
  }
}

async function startZxing(video, stream, onText) {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import("@zxing/browser"),
    import("@zxing/library"),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
  return reader.decodeFromStream(stream, video, (result) => {
    if (!result) return;
    const text = typeof result.getText === "function" ? result.getText() : "";
    if (text) onText(text);
  });
}

function ScannerFrame({ hint, showLaser, locked }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
      <div className={`terrain-frame relative aspect-square w-full max-w-[18rem]${locked ? " is-locked" : ""}`}>
        <span className="terrain-corner is-tl" />
        <span className="terrain-corner is-tr" />
        <span className="terrain-corner is-bl" />
        <span className="terrain-corner is-br" />
        {showLaser ? <span className="terrain-laser absolute start-3 end-3 h-0.5" /> : null}
        <p className="absolute start-0 end-0 -bottom-10 text-center text-sm text-white/80">
          {hint}
        </p>
      </div>
    </div>
  );
}

export default function TerrainScanner({ onDetected, onClose, onHistory, title = fr.scanTitle, hint = fr.scanHint, continuous = false, elevated = false }) {
  const onDetectedRef = useRef(onDetected);
  const continuousRef = useRef(continuous);
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const stopRef = useRef(() => {});
  const stoppedRef = useRef(false);
  const lastRef = useRef({ value: "", at: 0 });
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState("starting");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [flash, setFlash] = useState(false);
  const [manual, setManual] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const armRef = useRef(() => {});
  const cameraAllowed = typeof window !== "undefined" && window.isSecureContext;

  onDetectedRef.current = onDetected;
  continuousRef.current = continuous;
  useWakeLock(true);

  useEffect(() => {
    if (!cameraAllowed) {
      setPhase("entry");
      return undefined;
    }
    const video = videoRef.current;
    let cancelled = false;
    let generation = 0;
    let stream = null;
    let controls = null;
    let raf = 0;

    const stop = () => {
      generation += 1;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      try {
        controls?.stop?.();
      } catch {
        /* déjà arrêté */
      }
      controls = null;
      stream?.getTracks?.().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
      stream = null;
      trackRef.current = null;
      if (video?.srcObject) video.srcObject = null;
    };
    stopRef.current = stop;

    const accept = (raw) => {
      if (stoppedRef.current) return;
      const code = String(raw || "").trim();
      if (!code) return;
      const now = Date.now();
      if (lastRef.current.value === code && now - lastRef.current.at < DEDUPE_MS) return;
      lastRef.current = { value: code, at: now };
      if (!continuousRef.current) stoppedRef.current = true;
      setFlash(true);
      window.setTimeout(() => setFlash(false), SUCCESS_MS);
      if (!continuousRef.current) stop();
      window.setTimeout(() => {
        onDetectedRef.current?.(code);
      }, SUCCESS_MS);
    };

    async function loopNative(detector, gen) {
      const tick = async () => {
        if (cancelled || stoppedRef.current || gen !== generation) return;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const value = codes?.[0]?.rawValue;
            if (value) {
              accept(value);
              if (stoppedRef.current || gen !== generation) return;
            }
          } catch {
            /* frame illisible */
          }
        }
        if (!cancelled && !stoppedRef.current && gen === generation) {
          raf = requestAnimationFrame(tick);
        }
      };
      raf = requestAnimationFrame(tick);
    }

    async function start() {
      if (cancelled || stoppedRef.current || document.visibilityState === "hidden") return;
      const gen = ++generation;
      setPhase("starting");
      setTorchOn(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase("unsupported");
        return;
      }
      try {
        const nextStream = await openCameraStream();
        if (cancelled || stoppedRef.current || gen !== generation) {
          nextStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = nextStream;
        const track = stream.getVideoTracks()[0] || null;
        trackRef.current = track;
        setTorchAvailable(trackHasTorch(track));

        if (typeof window.BarcodeDetector === "function") {
          try {
            const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
            if (video) {
              video.srcObject = stream;
              await video.play();
            }
            if (cancelled || gen !== generation) return;
            setPhase("scanning");
            await loopNative(detector, gen);
            return;
          } catch {
            /* repli zxing */
          }
        }

        controls = await startZxing(video, stream, accept);
        if (cancelled || stoppedRef.current || gen !== generation) {
          try {
            controls?.stop?.();
          } catch {
            /* ignore */
          }
          controls = null;
          return;
        }
        setPhase("scanning");
      } catch (error) {
        if (cancelled || gen !== generation) return;
        const name = error?.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
          setPhase("denied");
        } else if (name === "NotFoundError" || name === "NotSupportedError" || name === "NotReadableError" || name === "OverconstrainedError") {
          setPhase("unsupported");
        } else {
          setPhase("error");
        }
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        stop();
        return;
      }
      if (!stoppedRef.current) start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    armRef.current = () => {
      if (cancelled) return;
      stoppedRef.current = false;
      start();
    };
    start();
    return () => {
      cancelled = true;
      armRef.current = () => {};
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [retryToken, cameraAllowed]);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  function armFromTap() {
    stoppedRef.current = false;
    lastRef.current = { value: "", at: 0 };
    if (armRef.current) armRef.current();
    else setRetryToken((value) => value + 1);
  }

  function submitManual(event) {
    event.preventDefault();
    const code = manual.trim();
    if (!code || stoppedRef.current) return;
    setManual("");
    setFlash(true);
    if (!continuousRef.current) {
      stoppedRef.current = true;
      stopRef.current?.();
    }
    window.setTimeout(() => {
      setFlash(false);
      onDetectedRef.current?.(code);
    }, SUCCESS_MS);
  }

  const blocked = phase === "denied" || phase === "unsupported" || phase === "error";
  const manualFirst = phase === "entry" || blocked;
  const blockedCopy =
    phase === "denied"
      ? { title: fr.scanDenied, hint: fr.scanDeniedHint }
      : phase === "unsupported"
        ? { title: fr.scanUnsupported, hint: fr.scanUnsupportedHint }
        : { title: fr.scanError, hint: fr.scanUnsupportedHint };

  const ui = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`terrain-scanner fixed start-0 end-0 top-0 flex h-dvh max-h-dvh flex-col ${elevated ? "z-[80]" : "z-50"}`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <style>{`
        @keyframes terrain-laser {
          0% { top: 8%; }
          50% { top: 86%; }
          100% { top: 8%; }
        }
        .terrain-laser { animation: terrain-laser 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .terrain-laser { animation: none; top: 46%; }
        }
      `}</style>
      <header className="terrain-scan-bar flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.close}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full touch-manipulation"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        >
          <X size={22} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold">{title}</h1>
        {torchAvailable ? (
          <button
            type="button"
            onClick={toggleTorch}
            aria-pressed={torchOn}
            aria-label={fr.torch}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full touch-manipulation"
            style={{
              background: torchOn ? "var(--accent-warning)" : "var(--bg-card)",
              color: torchOn ? "var(--text-inverse)" : "var(--text-primary)",
            }}
          >
            <Flashlight size={22} />
          </button>
        ) : (
          <span className="h-12 w-12" aria-hidden />
        )}
      </header>
      {onHistory ? (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onHistory}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold touch-manipulation"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-card)" }}
          >
            {fr.recentScans}
          </button>
        </div>
      ) : null}

      <div className="terrain-viewfinder relative min-h-[52dvh] min-w-0 flex-1">
        <video
          ref={videoRef}
          className={phase === "scanning" ? "h-full w-full object-cover" : "absolute inset-0 h-full w-full object-cover opacity-0"}
          playsInline
          muted
          autoPlay
        />
        {phase === "scanning" ? <ScannerFrame hint={hint} showLaser={!reduceMotion} locked={flash} /> : null}
        {phase === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>{fr.scanStarting}</p>
            <button
              type="button"
              onClick={armFromTap}
              className="inline-flex min-h-14 items-center justify-center rounded-full px-6 text-base font-semibold text-white touch-manipulation"
              style={{ background: "var(--accent-primary)" }}
            >
              {fr.scanArm}
            </button>
          </div>
        ) : null}
        {manualFirst ? (
          <div className="absolute inset-0 flex flex-col justify-end px-4 pb-3">
            <div className="terrain-scan-card rounded-3xl border p-5">
              <p className="terrain-kicker">
                {phase === "entry" ? fr.scanEntryKicker : blockedCopy.title}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {phase === "entry" ? fr.scanEntryTitle : fr.scanManual}
              </h2>
              <p className="mt-2 text-base" style={{ color: "var(--text-secondary)" }}>
                {phase === "entry" ? fr.scanEntryLead : blockedCopy.hint}
              </p>
              {phase === "entry" ? (
                <>
                  <a
                    href={secureScanUrl()}
                    className="terrain-secure-link mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-full px-5 text-center text-base font-semibold text-white touch-manipulation"
                  >
                    {fr.scanOpenSecure}
                  </a>
                  <p className="terrain-url mt-3 break-all">{secureScanUrl()}</p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={armFromTap}
                  className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full px-5 text-base font-semibold text-white touch-manipulation"
                  style={{ background: "var(--accent-primary)" }}
                >
                  {fr.scanArm}
                </button>
              )}
            </div>
          </div>
        ) : null}
        {flash ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--accent-success) 38%, transparent)" }}
          >
            <SuccessMark />
          </div>
        ) : null}
      </div>

      <form
        onSubmit={submitManual}
        className={`terrain-scan-dock ${manualFirst ? "flex flex-col gap-3 px-4 py-4" : "flex items-end gap-2 px-3 py-3"}`}
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {fr.scanManual}
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder={fr.scanManualPlaceholder}
            autoFocus={manualFirst}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            className={`w-full rounded-xl border px-3 text-base touch-manipulation ${manualFirst ? "min-h-14" : "min-h-12"}`}
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
              fontSize: "1rem",
            }}
          />
        </label>
        <button
          type="submit"
          disabled={!manual.trim()}
          className={`inline-flex items-center justify-center rounded-xl px-4 text-base font-semibold text-white touch-manipulation disabled:opacity-45 ${manualFirst ? "min-h-14 w-full" : "min-h-12"}`}
          style={{ background: "var(--accent-primary)" }}
        >
          {fr.scanSubmit}
        </button>
      </form>
    </div>
  );

  return createPortal(ui, document.body);
}
