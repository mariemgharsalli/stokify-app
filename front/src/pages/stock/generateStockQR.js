import QRCode from "qrcode";
import { buildScanUrl, stockScanPath } from "../../utils/qrPayload";

export async function generateStockQR(stockLine) {
  const data = await buildScanUrl(stockScanPath(stockLine.id));
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, data, {
    width: 256,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  return canvas.toDataURL("image/png");
}
