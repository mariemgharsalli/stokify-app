const MODULES = [
  { key: "stock", label: "Stock", icon: "ti-box" },
  { key: "ventes", label: "Ventes & Facturation", icon: "ti-receipt" },
  { key: "achats", label: "Achats", icon: "ti-shopping-cart" },
  { key: "mouvements", label: "Mouvements de stock", icon: "ti-arrows-transfer-up" },
  { key: "rapports", label: "Rapports", icon: "ti-chart-bar" },
  { key: "accounting", label: "Comptabilité", icon: "ti-cash" },
  { key: "valorisation", label: "Valorisation", icon: "ti-coin" },
  { key: "users", label: "Utilisateurs", icon: "ti-users" },
  { key: "companies", label: "Sociétés", icon: "ti-building" },
  { key: "ai", label: "Module IA", icon: "ti-brain" },
  { key: "reglements", label: "Règlements", icon: "ti-credit-card" },
];

const NIVEAUX = ["aucun", "lecture", "ecriture", "validation"];

function permGranted(perms, permission) {
  if (perms.includes("*")) return true;
  if (perms.includes(permission)) return true;
  const [moduleName] = permission.split(":");
  return perms.includes(`${moduleName}:*`);
}

function levelToPermissions(moduleKey, niveau) {
  if (niveau === "aucun") return [];

  switch (moduleKey) {
    case "stock":
      if (niveau === "lecture") return ["stock:read"];
      if (niveau === "ecriture") return ["stock:read", "stock:write"];
      if (niveau === "validation") return ["stock:read", "stock:write", "stock:delete"];
      break;
    case "ventes":
      if (niveau === "lecture") return ["ventes:read"];
      if (niveau === "ecriture") return ["ventes:read", "ventes:write"];
      if (niveau === "validation") return ["ventes:read", "ventes:write", "ventes:validate"];
      break;
    case "users":
      if (niveau === "lecture") return ["users:read"];
      if (niveau === "ecriture") return ["users:read"];
      if (niveau === "validation") return ["users:read", "users:manage"];
      break;
    case "reglements":
      if (niveau === "lecture") return [];
      if (niveau === "ecriture") return ["reglements:write"];
      if (niveau === "validation") return ["reglements:*"];
      break;
    case "rapports":
    case "accounting":
    case "valorisation":
    case "companies":
    case "ai":
      if (niveau === "lecture" || niveau === "ecriture" || niveau === "validation") {
        return [`${moduleKey}:read`];
      }
      break;
    default:
      if (niveau === "lecture") return [`${moduleKey}:read`];
      if (niveau === "ecriture") return [`${moduleKey}:read`, `${moduleKey}:write`];
      if (niveau === "validation") {
        const base = [`${moduleKey}:read`, `${moduleKey}:write`];
        return [...base, `${moduleKey}:validate`];
      }
      break;
  }

  return [];
}

function permissionsToLevel(moduleKey, perms) {
  switch (moduleKey) {
    case "stock":
      if (permGranted(perms, "stock:delete")) return "validation";
      if (permGranted(perms, "stock:write")) return "ecriture";
      if (permGranted(perms, "stock:read")) return "lecture";
      return "aucun";
    case "ventes":
      if (permGranted(perms, "ventes:validate")) return "validation";
      if (permGranted(perms, "ventes:write")) return "ecriture";
      if (permGranted(perms, "ventes:read")) return "lecture";
      return "aucun";
    case "users":
      if (permGranted(perms, "users:manage")) return "validation";
      if (permGranted(perms, "users:read")) return "lecture";
      return "aucun";
    case "reglements":
      if (permGranted(perms, "reglements:*")) return "validation";
      if (permGranted(perms, "reglements:write")) return "ecriture";
      return "aucun";
    case "rapports":
    case "accounting":
    case "valorisation":
    case "companies":
    case "ai":
      if (permGranted(perms, `${moduleKey}:read`)) return "lecture";
      return "aucun";
    default:
      if (permGranted(perms, `${moduleKey}:validate`) || permGranted(perms, `${moduleKey}:manage`)) {
        return "validation";
      }
      if (permGranted(perms, `${moduleKey}:write`)) return "ecriture";
      if (permGranted(perms, `${moduleKey}:read`)) return "lecture";
      return "aucun";
  }
}

module.exports = { MODULES, NIVEAUX, levelToPermissions, permissionsToLevel };
