import { Building2, Camera, Check, Eye, EyeOff, Loader2, MapPin, Trash } from "lucide-react";
import { gradientFromString, statusGradient } from "../../refs/components/refsUtils";
import AnimatedSwitch from "./AnimatedSwitch";
import { inputClass, tableCellClass } from "./superadminTheme";

export function buildLogoUrl(logoPath) {
  if (!logoPath) return "";
  const raw = String(import.meta.env.VITE_API_URL || "").trim();
  if (raw) {
    const origin = raw.replace(/\/api\/?$/, "").replace(/\/$/, "");
    return `${origin}${logoPath}`;
  }
  return logoPath;
}

export function hasCompanyCoords(c) {
  if (c?.latitude == null || c?.longitude == null) return false;
  return Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude));
}

export default function SocieteTableRow({
  company: c,
  index,
  edits,
  setEdits,
  isSuperAdmin,
  updateMutation,
  deleteMutation,
  uploadLogoMutation,
  setFormError,
  setFormSuccess,
  onViewLocation,
  onRequestDelete,
}) {
  const row = edits[c.id] || { nom: c.nom, email: c.email || "" };

  return (
    <tr
      className="group transition-colors duration-150 hover:bg-rose-50/60 dark:hover:bg-white/[0.02]"
      style={{ animation: `superadminFadeUp 0.35s ease ${index * 50}ms both` }}
    >
      <td className={tableCellClass}>
        <div className="flex items-center gap-2">
          {c.logo ? (
            <img
              src={buildLogoUrl(c.logo)}
              alt={c.nom}
              className="h-10 w-10 rounded-xl border border-slate-200 object-cover dark:border-white/10"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: gradientFromString(c.code) }}
            >
              <Building2 className="h-5 w-5" />
            </div>
          )}
          {isSuperAdmin && (
            <>
              <input
                id={`logo-upload-${c.id}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFormError("");
                  setFormSuccess("");
                  uploadLogoMutation.mutate({ id: Number(c.id), code: c.code, file });
                  e.target.value = "";
                }}
              />
              <label
                htmlFor={`logo-upload-${c.id}`}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-violet-300 hover:text-violet-600 dark:border-white/15 dark:text-slate-400 dark:hover:border-violet-500/40 dark:hover:text-violet-300"
                title="Uploader un logo"
              >
                {uploadLogoMutation.isPending &&
                Number(uploadLogoMutation.variables?.id) === Number(c.id) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </label>
            </>
          )}
        </div>
      </td>

      <td className={tableCellClass}>
        <span
          className="inline-flex rounded-full px-2.5 py-0.5 font-mono text-xs font-medium text-white shadow-sm"
          style={{ background: gradientFromString(c.code) }}
        >
          {c.code}
        </span>
      </td>

      <td className={tableCellClass}>
        <input
          className={`${inputClass} max-w-xs py-1.5`}
          value={row.nom ?? c.nom}
          onChange={(e) =>
            setEdits((prev) => ({
              ...prev,
              [c.id]: {
                ...prev[c.id],
                nom: e.target.value,
                email: prev[c.id]?.email ?? c.email ?? "",
              },
            }))
          }
        />
      </td>

      <td className={tableCellClass}>
        <input
          className={`${inputClass} max-w-xs py-1.5`}
          value={row.email ?? c.email ?? ""}
          onChange={(e) =>
            setEdits((prev) => ({
              ...prev,
              [c.id]: { nom: prev[c.id]?.nom ?? c.nom, email: e.target.value },
            }))
          }
        />
      </td>

      <td className={tableCellClass}>
        {hasCompanyCoords(c) ? (
          <button
            type="button"
            title="Voir sur la carte"
            onClick={() =>
              onViewLocation({
                nom: c.nom,
                latitude: Number(c.latitude),
                longitude: Number(c.longitude),
                adresse: c.adresse ?? "",
                ville: c.ville ?? "",
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:scale-105 hover:shadow-sm dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400"
          >
            <MapPin className="h-3.5 w-3.5" />
            Localisée
          </button>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>

      <td className={tableCellClass}>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{
              background: c.actif ? statusGradient("ACTIF") : "linear-gradient(135deg, #94a3b8, #64748b)",
            }}
          >
            {c.actif ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {c.actif ? "Visible" : "Masqué"}
          </span>
          <AnimatedSwitch
            checked={Boolean(c.actif)}
            onChange={(checked) => {
              const r = edits[c.id] || { nom: c.nom, email: c.email || "" };
              const nom = String(r.nom ?? "").trim();
              const emailRaw = String(r.email ?? "").trim();
              setFormError("");
              setFormSuccess("");
              updateMutation.mutate({
                id: Number(c.id),
                payload: { nom, email: emailRaw, actif: checked },
              });
            }}
            disabled={updateMutation.isPending}
          />
        </div>
      </td>

      <td className={tableCellClass}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Enregistrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition-all duration-200 hover:scale-110 hover:bg-emerald-100 hover:shadow-md disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
            disabled={updateMutation.isPending}
            onClick={() => {
              setFormError("");
              setFormSuccess("");
              const r = edits[c.id] || { nom: c.nom, email: c.email || "" };
              const nom = String(r.nom ?? "").trim();
              const emailRaw = String(r.email ?? "").trim();
              updateMutation.mutate({
                id: Number(c.id),
                payload: { nom, email: emailRaw, actif: Boolean(c.actif) },
              });
            }}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Supprimer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition-all duration-200 hover:scale-110 hover:bg-red-100 hover:shadow-md disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            disabled={deleteMutation.isPending}
            onClick={() => onRequestDelete(c)}
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
