import { useEffect, useState } from "react";
import { buildScanUrl, isLoopbackOrigin, stockScanPath } from "../../utils/qrPayload";

export default function QRModal({ stockLine, onClose }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [scanUrl, setScanUrl] = useState("");

  useEffect(() => {
    if (!stockLine) return;

    let cancelled = false;
    (async () => {
      const data = await buildScanUrl(stockScanPath(stockLine.id));
      if (cancelled) return;
      setScanUrl(data);
      const { default: QRCode } = await import("qrcode");
      const url = await QRCode.toDataURL(data, {
        width: 300,
        margin: 3,
        color: {
          dark: "#0f0f23",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      });
      if (!cancelled) setQrUrl(url);
    })();

    return () => {
      cancelled = true;
      setQrUrl(null);
      setCopied(false);
      setScanUrl("");
    };
  }, [stockLine]);

  function handleCopy() {
    navigator.clipboard.writeText(scanUrl || `${stockLine.article?.code} · ${stockLine.depot?.libelle}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    if (!qrUrl) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Stock — ${stockLine.article?.code}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, sans-serif;
            display: flex; flex-direction: column;
            align-items: center; padding: 24px;
            background: #fff; color: #111;
          }
          .header {
            width: 100%; border-bottom: 2px solid #E24B4A;
            padding-bottom: 12px; margin-bottom: 16px; text-align: center;
          }
          .brand {
            font-size: 11px; font-weight: 700; letter-spacing: 2px;
            color: #E24B4A; margin-bottom: 4px;
          }
          h1 { font-size: 18px; font-weight: 600; }
          .subtitle { font-size: 12px; color: #666; margin-top: 2px; }
          img { width: 220px; height: 220px; margin: 16px 0; }
          .info-grid {
            width: 100%; border: 1px solid #e5e7eb; border-radius: 8px;
            overflow: hidden; margin-top: 8px;
          }
          .info-row {
            display: flex; justify-content: space-between;
            padding: 8px 12px; font-size: 12px;
            border-bottom: 1px solid #f3f4f6;
          }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #666; }
          .info-value { font-weight: 600; }
          .qty { color: #1D9E75; font-size: 16px; font-weight: 700; }
          .footer {
            margin-top: 16px; font-size: 10px; color: #aaa;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">STOKIFY</div>
          <h1>${stockLine.article?.libelle || stockLine.article?.code}</h1>
          <div class="subtitle">Étiquette de stock</div>
        </div>
        <img src="${qrUrl}" alt="QR Code stock" />
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Code article</span>
            <span class="info-value">${stockLine.article?.code || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Dépôt</span>
            <span class="info-value">${stockLine.depot?.libelle || stockLine.depot?.code || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Emplacement</span>
            <span class="info-value">${stockLine.emplacement?.code || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Quantité</span>
            <span class="info-value qty">${Number(stockLine.quantite).toLocaleString("fr-FR")} ${stockLine.article?.unite || "UN"}</span>
          </div>
        </div>
        <div class="footer">
          Stokify · Généré le ${new Date().toLocaleDateString("fr-FR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (!stockLine) return null;

  const qtyColor = Number(stockLine.quantite) <= 0 ? "#E24B4A" : "#1D9E75";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ animation: "fadeIn 0.2s ease" }}
      role="dialog"
      aria-modal="true"
      aria-label="QR Code de la ligne de stock"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} role="presentation" />

      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "0.5px solid var(--border-default)",
          animation: "modalEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #378ADD, #1D9E75, #7F77DD)" }}
        />

        <div className="flex items-start justify-between p-5 pb-0">
          <div className="flex items-center gap-3">
            {stockLine.article?.imageUrl ? (
              <img
                src={stockLine.article.imageUrl}
                alt=""
                className="h-11 w-11 rounded-xl object-cover"
              />
            ) : (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "rgba(55,138,221,0.12)" }}
              >
                <i className="ti ti-package" style={{ color: "#378ADD", fontSize: 20 }} aria-hidden="true" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                {stockLine.article?.libelle || stockLine.article?.code}
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {stockLine.article?.code} · {stockLine.depot?.libelle || stockLine.depot?.code}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: "var(--text-muted)" }}
            aria-label="Fermer"
          >
            <i className="ti ti-x" style={{ fontSize: 18 }} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col items-center px-5 py-4">
          {qrUrl ? (
            <div
              className="rounded-2xl p-3"
              style={{
                background: "#ffffff",
                boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                animation: "scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, display: "block" }} />
            </div>
          ) : (
            <div
              className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl"
              style={{ background: "var(--bg-input)" }}
            >
              <div
                className="h-8 w-8 animate-spin rounded-full"
                style={{
                  border: "3px solid var(--border-default)",
                  borderTopColor: "#378ADD",
                }}
              />
            </div>
          )}

          <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
            Scannez avec l&apos;appareil photo (même Wi-Fi que le PC)
          </p>
          {scanUrl ? (
            <p className="mt-1 max-w-full truncate px-2 text-center font-mono text-[9px] text-[var(--text-muted)]" title={scanUrl}>
              {scanUrl}
            </p>
          ) : null}
          {scanUrl && isLoopbackOrigin(scanUrl) ? (
            <p className="mt-2 px-2 text-center text-[11px] text-amber-500">
              Ce lien est encore localhost : le téléphone ne pourra pas ouvrir Stokify. Redémarrez le front
              (`npm run dev`) puis régénérez le QR.
            </p>
          ) : null}
        </div>

        <div className="mx-5 mb-4 grid grid-cols-2 gap-2">
          {[
            {
              label: "Quantité",
              value: `${Number(stockLine.quantite).toLocaleString("fr-FR")} ${stockLine.article?.unite || "UN"}`,
              color: qtyColor,
            },
            {
              label: "Emplacement",
              value: stockLine.emplacement?.code || "Non défini",
              color: "#378ADD",
            },
            {
              label: "Famille",
              value: stockLine.article?.famille?.nom || "—",
              color: "#7F77DD",
            },
            {
              label: "Dépôt",
              value: stockLine.depot?.code || "—",
              color: "#BA7517",
            },
          ].map((info) => (
            <div
              key={info.label}
              className="rounded-xl border p-2.5"
              style={{ borderColor: "var(--border-default)", background: "var(--bg-input)" }}
            >
              <p className="text-[10px] text-[var(--text-muted)]">{info.label}</p>
              <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: info.color }}>
                {info.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t p-4" style={{ borderColor: "var(--border-default)" }}>
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all"
            style={{
              borderColor: copied ? "rgba(29,158,117,0.4)" : "var(--border-default)",
              color: copied ? "#1D9E75" : "var(--text-secondary)",
              background: copied ? "rgba(29,158,117,0.08)" : "transparent",
            }}
          >
            <i className={`ti ${copied ? "ti-check" : "ti-copy"} text-xs`} aria-hidden="true" />
            {copied ? "Copié !" : "Copier"}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!qrUrl}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: "#378ADD" }}
          >
            <i className="ti ti-printer text-xs" aria-hidden="true" />
            Imprimer l&apos;étiquette
          </button>
        </div>
      </div>
    </div>
  );
}
