import {
  Calculator,
  Package,
  Shield,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";

export const THEME = {
  bg: "#0f1117",
  card: "#161927",
  border: "#2d3148",
};

export const ROLE_CONFIG = {
  SUPER_ADMIN: {
    label: "Super Admin",
    bg: "#4c1d95",
    color: "#c4b5fd",
    border: "#6d28d9",
    Icon: ShieldCheck,
  },
  ADMIN: {
    label: "Admin",
    bg: "#1e3a5f",
    color: "#93c5fd",
    border: "#2563eb",
    Icon: Shield,
  },
  MAGASINIER: {
    label: "Magasinier",
    bg: "#064e3b",
    color: "#6ee7b7",
    border: "#059669",
    Icon: Package,
  },
  COMPTABLE: {
    label: "Comptable",
    bg: "#451a03",
    color: "#fcd34d",
    border: "#d97706",
    Icon: Calculator,
  },
  RESPONSABLE: {
    label: "Responsable logistique",
    bg: "#1e1b4b",
    color: "#a5b4fc",
    border: "#6366f1",
    Icon: Truck,
  },
  CLIENT: {
    label: "Client",
    bg: "#374151",
    color: "#9ca3af",
    border: "#4b5563",
    Icon: User,
  },
};

export const AVATAR_COLORS = [
  { bg: "#7c3aed", ring: "#a78bfa" },
  { bg: "#2563eb", ring: "#60a5fa" },
  { bg: "#059669", ring: "#34d399" },
  { bg: "#d97706", ring: "#fbbf24" },
  { bg: "#db2777", ring: "#f472b6" },
  { bg: "#0891b2", ring: "#22d3ee" },
];

export function roleLabel(role) {
  return ROLE_CONFIG[role]?.label || role || "Inconnu";
}

export function avatarColorForUser(user) {
  const key = `${user?.prenom || ""}${user?.nom || ""}${user?.email || ""}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = key.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function userInitials(user) {
  return `${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}`.toUpperCase() || "U";
}

export const METRIC_CARDS = [
  {
    key: "total",
    label: "Total utilisateurs",
    accent: "#7c3aed",
    gradient: "linear-gradient(135deg, #1e1b4b 0%, #1e2130 100%)",
    iconColor: "#a78bfa",
    valueClass: "text-white",
    trend: { text: "↑ +1 ce mois", up: true },
  },
  {
    key: "active",
    label: "Comptes actifs",
    accent: "#059669",
    iconColor: "#34d399",
    valueClass: "text-[#34d399]",
    trend: { text: "En ligne maintenant", pulse: true },
  },
  {
    key: "inactive",
    label: "Comptes inactifs",
    accent: "#dc2626",
    iconColor: "#f87171",
    valueClass: "text-[#f87171]",
    trend: { text: "Nécessitent attention", up: false },
  },
  {
    key: "admins",
    label: "Admins",
    accent: "#d97706",
    iconColor: "#fbbf24",
    valueClass: "text-[#fbbf24]",
    trend: { text: "Accès complet", up: true },
  },
];

export const FILTER_PILLS = [
  { id: "ALL", label: "Tous", emoji: null, active: "bg-[#7c3aed] text-white border-[#7c3aed]", idle: "border-[#2d3148] text-slate-400" },
  {
    id: "ACTIVE",
    label: "Actifs",
    emoji: "●",
    active: "bg-[rgba(5,150,105,0.25)] text-[#34d399] border-[#059669]",
    idle: "bg-[rgba(5,150,105,0.08)] text-[#34d399] border-[#059669]/50",
  },
  {
    id: "INACTIVE",
    label: "Inactifs",
    emoji: "○",
    active: "bg-[rgba(220,38,38,0.25)] text-[#f87171] border-[#dc2626]",
    idle: "bg-[rgba(220,38,38,0.08)] text-[#f87171] border-[#dc2626]/50",
  },
];
