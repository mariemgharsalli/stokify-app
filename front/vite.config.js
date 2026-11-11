import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function lanIps() {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      const v4 = net.family === "IPv4" || net.family === 4;
      if (v4 && !net.internal && net.address) ips.push(net.address);
    }
  }
  return [...new Set(ips)];
}

function devHttps() {
  const ips = ["127.0.0.1", ...lanIps()];
  const dir = path.join(rootDir, ".cert");
  const pfxPath = path.join(dir, "dev.pfx");
  const stampPath = path.join(dir, "hosts.txt");
  const hosts = ["localhost", ...ips].join(",");
  if (!fs.existsSync(pfxPath) || !fs.existsSync(stampPath) || fs.readFileSync(stampPath, "utf8") !== hosts) {
    fs.mkdirSync(dir, { recursive: true });
    const san = ["DNS=localhost", ...ips.map((ip) => `IPAddress=${ip}`)].join("&");
    const ps = [
      `$cert = New-SelfSignedCertificate -Subject "CN=Stokify Terrain" -TextExtension @("2.5.29.17={text}${san}") -KeyExportPolicy Exportable -KeyAlgorithm RSA -KeyLength 2048 -NotAfter (Get-Date).AddDays(30) -CertStoreLocation Cert:\\CurrentUser\\My`,
      `$pwd = ConvertTo-SecureString -String "stokify" -Force -AsPlainText`,
      `Export-PfxCertificate -Cert $cert -FilePath '${pfxPath.replace(/'/g, "''")}' -Password $pwd | Out-Null`,
      `Remove-Item "Cert:\\CurrentUser\\My\\$($cert.Thumbprint)"`,
    ].join("; ");
    execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
    fs.writeFileSync(stampPath, hosts);
  }
  return { pfx: fs.readFileSync(pfxPath), passphrase: "stokify" };
}

function heavyChunk(id) {
  if (id.includes("@tensorflow")) return "vendor-tf";
  if (id.includes("jspdf")) return "vendor-pdf";
  if (id.includes("node_modules/xlsx") || id.includes("node_modules\\xlsx")) return "vendor-xlsx";
  if (id.includes("recharts") || id.includes("node_modules/d3-") || id.includes("node_modules\\d3-")) return "vendor-charts";
  if (id.includes("leaflet")) return "vendor-maps";
  return undefined;
}

const shellCache = new Map();

function shellReachable(id, getModuleInfo, stack = new Set()) {
  const cached = shellCache.get(id);
  if (cached !== undefined) return cached;
  if (stack.has(id)) return false;
  const info = getModuleInfo(id);
  if (!info) return false;
  if (info.isEntry) return true;
  stack.add(id);
  for (const importer of info.importers || []) {
    if (shellReachable(importer, getModuleInfo, stack)) {
      stack.delete(id);
      shellCache.set(id, true);
      return true;
    }
  }
  stack.delete(id);
  shellCache.set(id, false);
  return false;
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_TARGET || "http://127.0.0.1:5000";
  const wantHttps =
    command === "serve" &&
    (process.env.VITE_DEV_HTTPS === "true" || env.VITE_DEV_HTTPS === "true");

  return {
    plugins: [
      react(),
      // Repli si le certificat Windows n'a pas pu être créé.
      wantHttps && process.platform !== "win32" ? basicSsl() : null,
      VitePWA({
        registerType: "prompt", // on propose la mise à jour, on ne la force pas en plein picking
        injectRegister: false, // enregistrement manuel, uniquement depuis /terrain
        // Au-delà de 4 Mio : avertir et exclure, sans faire échouer le build.
        // index.html et le bundle d'entrée restent dans le précache.
        showMaximumFileSizeToCacheInBytesWarning: true,
        includeAssets: ["pwa/apple-touch-icon.png"],
        manifest: {
          id: "/terrain/",
          name: "Stokify Terrain",
          short_name: "Terrain",
          description: "Application magasinier Stokify : scan, réception, préparation, inventaire.",
          lang: "fr",
          start_url: "/terrain/",
          scope: "/terrain/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#0f1117",
          theme_color: "#0f1117",
          icons: [
            { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: "/index.html",
          // Le SPA desktop n'est pas servi hors-ligne : seules les navigations /terrain le sont.
          navigateFallbackAllowlist: [/^\/terrain/],
          navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          globIgnores: [
            "**/vendor-tf*",
            "**/vendor-pdf*",
            "**/vendor-xlsx*",
            "**/vendor-charts*",
            "**/vendor-maps*",
            // Visuels marketing : inutiles au précache Terrain.
            // Le bundle d'entrée (assets/index-*.js) n'est pas ignoré : index.html le référence.
            "**/home-assets/**",
            "**/cutouts/**",
          ],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          // VOLONTAIREMENT aucun runtimeCaching sur /api : multi-société + téléphone partagé = risque de fuite de données.
        },
        devOptions: { enabled: false },
      }),
    ].filter(Boolean),
    optimizeDeps: { include: ["leaflet"] },
    build: {
      rollupOptions: {
        output: {
          // Les modules partagés avec l'entrée (react, helpers) vont dans vendor-shell.
          // Sinon Rollup les aspire dans vendor-charts / vendor-pdf et index.html les précharge.
          manualChunks(id, { getModuleInfo }) {
            const heavy = heavyChunk(id);
            if (heavy) return heavy;
            if (id.includes("/src/") || id.includes("\\src\\")) return undefined;
            if (shellReachable(id, getModuleInfo)) return "vendor-shell";
            return undefined;
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      https: wantHttps && process.platform === "win32" ? devHttps() : undefined,
      proxy: {
        "/api": { target: proxyTarget, changeOrigin: true, timeout: 120_000, proxyTimeout: 120_000 },
        "/uploads": { target: proxyTarget, changeOrigin: true, timeout: 120_000, proxyTimeout: 120_000 },
      },
    },
  };
});
