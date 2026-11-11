import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Brain,
  Building2,
  ChartBar,
  Coins,
  CreditCard,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Users,
  Wallet,
  X,
  ArrowLeftRight,
} from "lucide-react";
import api from "../../../services/api";
import UserRoleBadge from "./UserRoleBadge";
import { avatarColorForUser, THEME, userInitials } from "../adminTheme";

const NIVEAUX = [
  { key: "aucun", label: "Aucun", style: "border-slate-600/50 text-slate-400 bg-slate-800/40 hover:bg-slate-700/50" },
  { key: "lecture", label: "Lecture", style: "border-sky-500/50 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20" },
  { key: "ecriture", label: "Écriture", style: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20" },
  { key: "validation", label: "Validation", style: "border-amber-500/50 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20" },
];

const ICON_MAP = {
  "ti-box": Box,
  "ti-receipt": Receipt,
  "ti-shopping-cart": ShoppingCart,
  "ti-arrows-transfer-up": ArrowLeftRight,
  "ti-chart-bar": ChartBar,
  "ti-cash": Wallet,
  "ti-coin": Coins,
  "ti-users": Users,
  "ti-building": Building2,
  "ti-brain": Brain,
  "ti-credit-card": CreditCard,
};

function activeStyle(niveau) {
  const map = {
    aucun: "ring-2 ring-slate-400/60 bg-slate-600/30 text-slate-200 border-slate-400/60",
    lecture: "ring-2 ring-sky-400/70 bg-sky-500/25 text-sky-100 border-sky-400/70",
    ecriture: "ring-2 ring-emerald-400/70 bg-emerald-500/25 text-emerald-100 border-emerald-400/70",
    validation: "ring-2 ring-amber-400/70 bg-amber-500/25 text-amber-100 border-amber-400/70",
  };
  return map[niveau] || map.aucun;
}

export default function UserPermissionsDrawer({ user, onClose, onSaved, onReset }) {
  const queryClient = useQueryClient();
  const [levels, setLevels] = useState({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const permissionsQuery = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: () => api.get(`users/${user.id}/permissions`).then((r) => r.data),
    enabled: Boolean(user?.id),
  });

  const data = permissionsQuery.data;
  const isSuperAdmin = data?.isSuperAdmin;

  useEffect(() => {
    if (!data?.modules) return;
    const initial = {};
    data.modules.forEach((m) => {
      initial[m.key] = m.niveauActuel;
    });
    setLevels(initial);
  }, [data]);

  const hasChanges = useMemo(() => {
    if (!data?.modules) return false;
    return data.modules.some((m) => levels[m.key] !== m.niveauActuel);
  }, [data, levels]);

  const overrideCount = useMemo(() => {
    if (!data?.modules) return 0;
    return data.modules.filter((m) => {
      const current = levels[m.key];
      return current !== m.niveauRole;
    }).length;
  }, [data, levels]);

  if (!user) return null;

  const colors = avatarColorForUser(user);

  const setLevel = (moduleKey, niveau) => {
    if (isSuperAdmin) return;
    setLevels((prev) => ({ ...prev, [moduleKey]: niveau }));
  };

  const handleSave = async () => {
    if (!data?.modules || isSuperAdmin) return;
    setSaving(true);
    setError("");
    try {
      const overrides = data.modules
        .filter((m) => levels[m.key] !== m.niveauRole)
        .map((m) => ({ module: m.key, niveau: levels[m.key] }));

      const unchangedFromRole = data.modules.filter((m) => levels[m.key] === m.niveauRole && m.isOverride);
      const payload = [
        ...overrides,
        ...unchangedFromRole.map((m) => ({ module: m.key, niveau: m.niveauRole })),
      ];

      await api.put(`users/${user.id}/permissions`, { overrides: payload });
      await queryClient.invalidateQueries({ queryKey: ["user-permissions", user.id] });
      onSaved?.("Accès enregistrés avec succès");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (isSuperAdmin) return;
    if (!window.confirm("Réinitialiser tous les accès personnalisés au rôle de base ?")) return;
    setResetting(true);
    setError("");
    try {
      await api.delete(`users/${user.id}/permissions`);
      await queryClient.invalidateQueries({ queryKey: ["user-permissions", user.id] });
      onReset?.("Accès réinitialisés au rôle");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <aside
        className="fixed right-0 top-0 z-[210] flex h-full w-full max-w-[520px] flex-col border-l shadow-2xl transition-transform duration-[250ms] ease-out translate-x-0"
        style={{ background: THEME.card, borderColor: THEME.border }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: THEME.border }}>
          <span className="text-sm font-medium text-slate-300">Accès par module</span>
          <div className="flex items-center gap-2">
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting || permissionsQuery.isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
                Réinitialiser au rôle
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b px-5 py-4" style={{ borderColor: THEME.border }}>
          <div className="flex gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
              style={{ background: colors.bg }}
            >
              {userInitials(user)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-100">
                {user.prenom} {user.nom}
              </h2>
              <p className="text-sm text-slate-400 truncate">{user.email}</p>
              <UserRoleBadge role={user.role} className="mt-2" />
            </div>
          </div>
          {isSuperAdmin && (
            <p className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
              Super Admin — accès total (wildcard). Les overrides ne s&apos;appliquent pas.
            </p>
          )}
          {!isSuperAdmin && overrideCount > 0 && (
            <p className="mt-3 text-xs text-amber-300/90">
              {overrideCount} module{overrideCount > 1 ? "s" : ""} personnalisé{overrideCount > 1 ? "s" : ""} (non sauvegardé{hasChanges ? ", modifications en attente" : ""})
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {permissionsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : permissionsQuery.isError ? (
            <p className="text-sm text-red-300">Impossible de charger les permissions.</p>
          ) : (
            <ul className="space-y-3">
              {data.modules.map((mod, idx) => {
                const Icon = ICON_MAP[mod.icon] || Box;
                const current = levels[mod.key] ?? mod.niveauActuel;
                const isCustom = current !== mod.niveauRole;

                return (
                  <li
                    key={mod.key}
                    className="rounded-xl border px-4 py-3"
                    style={{
                      borderColor: THEME.border,
                      background: "#0f1117",
                      animation: `permRowIn .3s ease ${idx * 35}ms both`,
                    }}
                  >
                    <div className="mb-2.5 flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-violet-400" />
                      <span className="text-sm font-medium text-slate-200">{mod.label}</span>
                      {isCustom && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          personnalisé
                        </span>
                      )}
                      {!isCustom && mod.isOverride && (
                        <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] text-slate-400">
                          = rôle
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {NIVEAUX.map((n) => {
                        const active = current === n.key;
                        return (
                          <button
                            key={n.key}
                            type="button"
                            disabled={isSuperAdmin}
                            onClick={() => setLevel(mod.key, n.key)}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                              active ? activeStyle(n.key) : n.style
                            } ${isSuperAdmin ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                          >
                            {n.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[10px] text-slate-600">
                      Rôle par défaut : {NIVEAUX.find((n) => n.key === mod.niveauRole)?.label || mod.niveauRole}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!isSuperAdmin && (
          <div className="border-t p-4 space-y-2" style={{ borderColor: THEME.border }}>
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || permissionsQuery.isLoading || !hasChanges}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer les accès"}
            </button>
          </div>
        )}
      </aside>
      <style>{`
        @keyframes permRowIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
