import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  X,
  Pencil,
  Package,
  MapPin,
  LayoutGrid,
  Warehouse,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import api from "../../../services/api";
import CapacityBar, { fillColor } from "./CapacityBar";
import DepotMiniMap from "./DepotMiniMap";
import { depotGradient, depotMarkerColor } from "./depotUtils";
import { hasCoords } from "./depotLeaflet";
import { DepotStatutBadge, parseDepotStatut } from "../depotStatusUi";
import { formatMoney } from "../../rapports/rapportUtils";

const MVT_LABELS = {
  ENTREE_ACHAT: { label: "Entrée achat", group: "ENTREE", color: "#1D9E75", bg: "rgba(29,158,117,0.14)" },
  ENTREE_INVENTAIRE: { label: "Entrée inventaire", group: "ENTREE", color: "#1D9E75", bg: "rgba(29,158,117,0.14)" },
  ENTREE_AUTRE: { label: "Entrée", group: "ENTREE", color: "#1D9E75", bg: "rgba(29,158,117,0.14)" },
  SORTIE_VENTE: { label: "Vente", group: "SORTIE", color: "#E24B4A", bg: "rgba(226,75,74,0.14)" },
  SORTIE_PERTE: { label: "Perte", group: "SORTIE", color: "#E24B4A", bg: "rgba(226,75,74,0.14)" },
  SORTIE_CASSE: { label: "Casse", group: "SORTIE", color: "#E24B4A", bg: "rgba(226,75,74,0.14)" },
  SORTIE_AUTRE: { label: "Sortie", group: "SORTIE", color: "#E24B4A", bg: "rgba(226,75,74,0.14)" },
  TRANSFERT: { label: "Transfert dépôt", group: "TRANSFERT", color: "#378ADD", bg: "rgba(55,138,221,0.14)" },
  TRANSFERT_EMPLACEMENT: { label: "Transfert empl.", group: "TRANSFERT", color: "#7F77DD", bg: "rgba(127,119,221,0.14)" },
};

function mvtMeta(type) {
  const key = String(type || "").toUpperCase();
  return (
    MVT_LABELS[key] || {
      label: key.replace(/_/g, " ").toLowerCase(),
      group: "TRANSFERT",
      color: "#7F77DD",
      bg: "rgba(127,119,221,0.14)",
    }
  );
}

function MvtGroupIcon({ group }) {
  if (group === "ENTREE") return <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />;
  if (group === "SORTIE") return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />;
  return <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />;
}

function DrawerSection({ title, subtitle, accent = "#378ADD", children }) {
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        background: "var(--color-background-primary, var(--bg-card))",
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{
          borderColor: "var(--color-border-tertiary, var(--border-default))",
          borderLeft: `3px solid ${accent}`,
          background: "var(--color-background-secondary, var(--bg-app))",
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary, var(--text-primary))" }}>
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: `${color}30`,
        background: bg,
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `${color}22`, color }}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
          {label}
        </span>
      </div>
      <p className="text-lg font-bold leading-none" style={{ color: "var(--color-text-primary, var(--text-primary))" }}>
        {value}
      </p>
    </div>
  );
}

function EmplacementRow({ e }) {
  const pct = e.remplissagePct ?? 0;
  return (
    <li
      className="rounded-xl border p-3"
      style={{
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        background: "var(--color-background-secondary, var(--bg-app))",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 font-mono text-xs font-bold"
              style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD" }}
            >
              {e.code}
            </span>
            <DepotStatutBadge row={e} />
            {e.categorie ? (
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase"
                style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}
              >
                {e.categorie}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm font-medium" style={{ color: "var(--color-text-primary, var(--text-primary))" }}>
            {e.libelle}
          </p>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[10px]">
              <span style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}>Remplissage</span>
              <span style={{ color: fillColor(pct) }}>{pct}%</span>
            </div>
            <CapacityBar value={pct} height={5} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold" style={{ color: "#1D9E75" }}>
            {e.nbArticles ?? 0}
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}>
            articles
          </p>
          <p className="mt-1 text-xs font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
            {e.stockActuel ?? 0} u.
          </p>
        </div>
      </div>
    </li>
  );
}

const PIE_COLORS = ["#378ADD", "#1D9E75", "#7F77DD", "#EF9F27", "#E24B4A", "#2FB6C9"];

function ChartTooltipStyle() {
  return {
    background: "var(--color-background-primary, var(--bg-card))",
    border: "1px solid var(--color-border-tertiary, var(--border-default))",
    borderRadius: 10,
    fontSize: 12,
    color: "var(--color-text-primary, var(--text-primary))",
  };
}

function DepotCharts({ depot, stats }) {
  const emplacements = depot.emplacements || [];

  const articlesData = (stats?.articlesParEmplacement || emplacements).map((e) => ({
    name: e.code,
    articles: e.nbArticles ?? 0,
  }));

  const remplissageData = emplacements.map((e) => ({
    name: e.code,
    pct: Math.min(100, Number(e.remplissagePct ?? 0)),
    fill: fillColor(e.remplissagePct ?? 0),
  }));

  const stockPieData = emplacements
    .filter((e) => Number(e.stockActuel ?? 0) > 0)
    .map((e) => ({ name: e.code, value: Number(e.stockActuel) }));

  const mvtData = (stats?.derniersMouvements || []).reduce((acc, m) => {
    const label = mvtMeta(m.type).label;
    const existing = acc.find((x) => x.name === label);
    if (existing) existing.count += 1;
    else acc.push({ name: label, count: 1 });
    return acc;
  }, []);

  if (!emplacements.length && !mvtData.length) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}>
        Pas assez de données pour afficher les graphiques.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {articlesData.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
            Articles par emplacement
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={articlesData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, var(--border-default))" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--color-text-secondary, var(--text-secondary))", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-tertiary, var(--text-muted))", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip cursor={{ fill: "rgba(55,138,221,0.08)" }} contentStyle={ChartTooltipStyle()} formatter={(v) => [`${v} article(s)`, "Stock"]} />
                <Bar dataKey="articles" fill="#378ADD" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {remplissageData.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
            Taux de remplissage (%)
          </p>
          <div style={{ height: Math.max(100, remplissageData.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={remplissageData} margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary, var(--border-default))" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "var(--color-text-tertiary, var(--text-muted))" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10, fill: "var(--color-text-secondary, var(--text-secondary))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={ChartTooltipStyle()} formatter={(v) => [`${v}%`, "Remplissage"]} />
                <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {remplissageData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stockPieData.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
              Stock par emplacement
            </p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={52}
                    paddingAngle={2}
                  >
                    {stockPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={ChartTooltipStyle()} formatter={(v) => [`${v} u.`, "Stock"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {stockPieData.map((d, i) => (
                <span key={d.name} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {mvtData.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
              Mouvements récents (types)
            </p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mvtData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--color-text-secondary, var(--text-secondary))" }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--color-text-tertiary, var(--text-muted))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={ChartTooltipStyle()} formatter={(v) => [`${v}`, "Opérations"]} />
                  <Bar dataKey="count" fill="#7F77DD" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MouvementRow({ m }) {
  const meta = mvtMeta(m.type);
  const ref = m.reference || "";
  const shortRef = ref.length > 22 ? `${ref.slice(0, 10)}…${ref.slice(-8)}` : ref;

  return (
    <li
      className="flex gap-3 rounded-xl border p-3"
      style={{
        borderColor: "var(--color-border-tertiary, var(--border-default))",
        background: "var(--color-background-secondary, var(--bg-app))",
      }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: meta.bg, color: meta.color }}
      >
        <MvtGroupIcon group={meta.group} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.label}
          </span>
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}
          >
            <Calendar className="h-3 w-3" aria-hidden />
            {new Date(m.createdAt).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <p className="mt-1.5 truncate text-sm font-medium" style={{ color: "var(--color-text-primary, var(--text-primary))" }}>
          {m.article?.libelle || m.article?.code || "Article inconnu"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="font-semibold" style={{ color: meta.color }}>
            Qté {m.quantite}
          </span>
          {shortRef ? (
            <span
              className="font-mono truncate"
              style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}
              title={ref}
            >
              {shortRef}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function formatDepotLocation(depot) {
  const parts = [depot.adresse, depot.ville, depot.region].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (hasCoords(depot)) return "Position GPS enregistrée";
  return "Localisation non renseignée";
}

export default function DepotDrawer({ depot, onClose, onEdit, onViewStock }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["depot-stats", depot?.id],
    queryFn: () => api.get(`depots/${depot.id}/stats`).then((r) => r.data),
    enabled: Boolean(depot?.id),
  });

  if (!depot) return null;

  const statut = parseDepotStatut(depot);
  const pct = stats?.remplissagePct ?? depot.stockSummary?.remplissagePct ?? 0;
  const nbEmp = stats?.nbEmplacements ?? depot.stockSummary?.nbEmplacements ?? (depot.emplacements || []).length;
  const nbArticles = stats?.nbArticles ?? depot.stockSummary?.nbArticles ?? 0;
  const stockTotal = stats?.stockTotal ?? depot.stockSummary?.stockTotal ?? 0;
  const valeurStock = depot.stockSummary?.valeurStock ?? depot.valeurStock ?? 0;
  const located = hasCoords(depot);
  const locationLabel = formatDepotLocation(depot);

  const capaciteRows = [
    { label: "Surface", value: stats?.capaciteM2 ?? depot.capacite, unit: "m²" },
    { label: "Poids max", value: stats?.poidsTotal ?? depot.capacitePoids, unit: "kg" },
    { label: "Volume max", value: stats?.volumeTotal ?? depot.capaciteVolume, unit: "m³" },
  ].filter((r) => r.value != null && r.value !== "");

  const accentColor = depotMarkerColor(depot.code);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          animation: "depotModalIn .25s ease-out",
          background: "var(--color-background-primary, var(--bg-card))",
          borderColor: "var(--color-border-tertiary, var(--border-default))",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="depot-detail-title"
      >
        {/* En-tête */}
        <div
          className="shrink-0 border-b px-5 pb-4 pt-5 sm:px-6"
          style={{
            borderColor: "var(--color-border-tertiary, var(--border-default))",
            background: `linear-gradient(160deg, ${accentColor}18 0%, transparent 60%)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                style={{ background: depotGradient(depot.code) }}
              >
                <Warehouse className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h2
                  id="depot-detail-title"
                  className="text-xl font-bold leading-tight"
                  style={{ color: "var(--color-text-primary, var(--text-primary))" }}
                >
                  {depot.libelle}
                </h2>
                <span
                  className="mt-1 inline-block rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                  style={{ background: "rgba(55,138,221,0.15)", color: "#378ADD" }}
                >
                  {depot.code}
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {statut === "ACTIF" ? (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: "rgba(29,158,117,0.18)", color: "#1D9E75" }}
                    >
                      ● Actif
                    </span>
                  ) : (
                    <DepotStatutBadge row={depot} />
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 transition-colors"
              style={{
                color: "var(--color-text-tertiary, var(--text-muted))",
                background: "var(--color-background-secondary, var(--bg-app))",
              }}
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-end justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
                Capacité utilisée
              </span>
              <span className="text-2xl font-bold leading-none" style={{ color: fillColor(pct) }}>
                {pct}%
              </span>
            </div>
            <CapacityBar value={pct} height={12} />
          </div>
          {(depot.storageRefrigere || depot.storageChimique || depot.storageInflammable || depot.storageFragile || stats?.storageRefrigere) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                [(depot.storageRefrigere ?? stats?.storageRefrigere), "Réfrigéré"],
                [(depot.storageChimique ?? stats?.storageChimique), "Chimique"],
                [(depot.storageInflammable ?? stats?.storageInflammable), "Inflammable"],
                [(depot.storageFragile ?? stats?.storageFragile), "Fragile"],
              ]
                .filter(([on]) => on)
                .map(([, label]) => (
                  <span
                    key={label}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ background: "rgba(55,138,221,0.12)", color: "#378ADD" }}
                  >
                    {label}
                  </span>
                ))}
            </div>
          )}
          {(stats?.remplissagePoidsPct != null || stats?.remplissageVolumePct != null) && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
              {stats?.remplissagePoidsPct != null && (
                <p>Poids occupé {stats.remplissagePoidsPct}%</p>
              )}
              {stats?.remplissageVolumePct != null && (
                <p>Volume occupé {stats.remplissageVolumePct}%</p>
              )}
            </div>
          )}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl"
                  style={{ background: "var(--color-background-secondary, var(--bg-app))" }}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  <KpiCard icon={LayoutGrid} label="Emplacements" value={nbEmp} color="#378ADD" bg="rgba(55,138,221,0.06)" />
                  <KpiCard icon={Package} label="Articles distincts" value={nbArticles} color="#1D9E75" bg="rgba(29,158,117,0.06)" />
                  <KpiCard icon={Boxes} label="Unités en stock" value={stockTotal} color="#7F77DD" bg="rgba(127,119,221,0.06)" />
                  <KpiCard
                    icon={Package}
                    label="Valeur stock"
                    value={valeurStock > 0 ? formatMoney(valeurStock) : "—"}
                    color="#BA7517"
                    bg="rgba(186,117,23,0.06)"
                  />
                </div>

                {capaciteRows.length > 0 && (
                  <DrawerSection title="Capacités physiques" subtitle="Limites configurées du dépôt" accent="#BA7517">
                    <div className="grid grid-cols-3 gap-2">
                      {capaciteRows.map((r) => (
                        <div
                          key={r.label}
                          className="rounded-xl border px-2 py-3 text-center"
                          style={{
                            borderColor: "var(--color-border-tertiary, var(--border-default))",
                            background: "var(--color-background-secondary, var(--bg-app))",
                          }}
                        >
                          <p className="text-lg font-bold" style={{ color: "var(--color-text-primary, var(--text-primary))" }}>
                            {r.value}
                            <span className="ml-0.5 text-xs font-normal" style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}>
                              {r.unit}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-secondary, var(--text-secondary))" }}>
                            {r.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </DrawerSection>
                )}

                <DrawerSection
                  title={`Emplacements (${(depot.emplacements || []).length})`}
                  subtitle="Zones de stockage dans ce dépôt"
                  accent="#378ADD"
                >
                  {(depot.emplacements || []).length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}>
                      Aucun emplacement configuré.
                    </p>
                  ) : (
                    <ul className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                      {(depot.emplacements || []).map((e) => (
                        <EmplacementRow key={e.id} e={e} />
                      ))}
                    </ul>
                  )}
                </DrawerSection>

                <DrawerSection
                  title="Derniers mouvements"
                  subtitle={`${(stats?.derniersMouvements || []).length} opération(s) récente(s)`}
                  accent="#7F77DD"
                >
                  {(stats?.derniersMouvements || []).length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--color-text-tertiary, var(--text-muted))" }}>
                      Aucun mouvement enregistré récemment.
                    </p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto">
                      {stats.derniersMouvements.map((m) => (
                        <MouvementRow key={m.id} m={m} />
                      ))}
                    </ul>
                  )}
                </DrawerSection>
              </div>

              <div className="space-y-4 lg:col-span-2">
                <DrawerSection title="Localisation" subtitle="Adresse et position sur la carte" accent="#378ADD">
                  <div className="mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5"
                    style={{
                      borderColor: "var(--color-border-tertiary, var(--border-default))",
                      background: "var(--color-background-secondary, var(--bg-app))",
                    }}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#378ADD" }} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary, var(--text-primary))" }}>
                        {locationLabel}
                      </p>
                    </div>
                  </div>
                  {located ? (
                    <DepotMiniMap depot={depot} height={240} zoomable />
                  ) : (
                    <div
                      className="rounded-xl border border-dashed px-4 py-8 text-center text-sm"
                      style={{
                        borderColor: "var(--color-border-tertiary, var(--border-default))",
                        color: "var(--color-text-tertiary, var(--text-muted))",
                      }}
                    >
                      Aucune position GPS — utilisez « Modifier » pour ajouter la localisation.
                    </div>
                  )}
                </DrawerSection>

                <DrawerSection
                  title="Vue graphique"
                  subtitle="Répartition du stock et de l'activité"
                  accent="#7F77DD"
                >
                  <DepotCharts depot={depot} stats={stats} />
                </DrawerSection>
              </div>
            </div>
          )}
        </div>

        {/* Pied */}
        <div
          className="shrink-0 border-t p-4 sm:px-5"
          style={{
            borderColor: "var(--color-border-tertiary, var(--border-default))",
            background: "var(--color-background-secondary, var(--bg-app))",
          }}
        >
          <button
            type="button"
            onClick={() => onViewStock(depot)}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white shadow-sm"
            style={{ background: "#378ADD" }}
          >
            <Package size={16} /> Consulter le stock
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to={`/depots/${depot.id}/plan`}
              className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium"
              style={{
                borderColor: "rgba(55,138,221,0.4)",
                color: "#378ADD",
                background: "var(--color-background-primary, var(--bg-card))",
              }}
            >
              <LayoutGrid size={14} /> Plan 2D
            </Link>
            <Link
              to={`/stock/emplacement-optimization?depotId=${depot.id}&tab=audit`}
              className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium"
              style={{
                borderColor: "rgba(127,119,221,0.4)",
                color: "#7F77DD",
                background: "var(--color-background-primary, var(--bg-card))",
              }}
            >
              Slotting
            </Link>
          </div>
          <button
            type="button"
            onClick={() => onEdit(depot)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium"
            style={{
              borderColor: "var(--color-border-secondary, var(--border-default))",
              color: "var(--color-text-primary, var(--text-primary))",
              background: "var(--color-background-primary, var(--bg-card))",
            }}
          >
            <Pencil size={14} /> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}
