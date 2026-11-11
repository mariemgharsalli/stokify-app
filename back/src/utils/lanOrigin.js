const os = require("os");

function isPrivateIpv4(ip) {
  const p = String(ip)
    .split(".")
    .map((n) => Number(n));
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  return false;
}

function scoreCandidate(ip, ifaceName) {
  const n = String(ifaceName || "").toLowerCase();
  let score = 0;
  if (/wi-?fi|wlan|wireless|wifi/.test(n)) score += 40;
  if (/ethernet|eth\d|lan/.test(n)) score += 20;
  if (/vethernet|virtual|vmware|vbox|hyper-v|docker|wsl|loopback|bluetooth|vpn|tap|tun/.test(n)) {
    score -= 50;
  }
  if (ip.startsWith("192.168.56.")) score -= 25;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip) && /^172\.1[7-9]\./.test(ip)) score -= 20;
  if (ip.startsWith("192.168.0.") || ip.startsWith("192.168.1.")) score += 15;
  if (ip.startsWith("192.168.")) score += 20;
  if (ip.startsWith("10.")) score += 8;
  return score;
}

function listLanIpv4() {
  const nets = os.networkInterfaces();
  const scored = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const a of addrs || []) {
      const family = a.family === "IPv4" || a.family === 4;
      if (!family || a.internal || !isPrivateIpv4(a.address)) continue;
      scored.push({ ip: a.address, score: scoreCandidate(a.address, name), name });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.ip.localeCompare(b.ip));
  return [...new Set(scored.map((s) => s.ip))];
}

function configuredFrontendOrigin() {
  return String(process.env.FRONTEND_URL || process.env.FRONT_URL || process.env.VITE_FRONT_URL || "")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");
}

function isLoopbackOrigin(origin) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return !origin;
  }
}

function frontendLanOrigin(frontPort = Number(process.env.FRONT_PORT || 5173)) {
  const configured = configuredFrontendOrigin();
  if (configured && !isLoopbackOrigin(configured)) return configured;
  const ip = listLanIpv4()[0];
  if (ip) return `http://${ip}:${frontPort}`;
  return configured || `http://localhost:${frontPort}`;
}

module.exports = {
  listLanIpv4,
  frontendLanOrigin,
  isLoopbackOrigin,
};
