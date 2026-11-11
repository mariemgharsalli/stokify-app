import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import api from "../../services/api";
import StockPagination from "../../components/stock/StockPagination";

const PAGE_SIZE_OPTIONS = [6, 9, 12, 24];
const DEFAULT_PAGE_SIZE = 6;

const AVATAR_GRADIENTS = [
  { from: "#378ADD", to: "#0EA5E9" },
  { from: "#0ea5e9", to: "#06b6d4" },
  { from: "#10b981", to: "#0ea5e9" },
  { from: "#f59e0b", to: "#ef4444" },
  { from: "#06b6d4", to: "#378ADD" },
  { from: "#14b8a6", to: "#0EA5E9" },
];

function buildLogoUrl(logoPath) {
  if (!logoPath) return "";
  const raw = String(import.meta.env.VITE_API_URL || "").trim();
  if (raw) {
    const origin = raw.replace(/\/api\/?$/, "").replace(/\/$/, "");
    return `${origin}${logoPath}`;
  }
  return logoPath.startsWith("http") ? logoPath : `http://localhost:5000${logoPath}`;
}

export default function SelectSociete() {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const user = useAuthStore((s) => s.user);
  const activeSocieteId = useAuthStore((s) => s.activeSocieteId);
  const setActiveSociete = useAuthStore((s) => s.setActiveSociete);

  const [societes, setSocietes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const isSuper = user?.role === "SUPER_ADMIN";
  const hasContext = activeSocieteId != null && String(activeSocieteId).trim() !== "";

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return societes;
    return societes.filter(
      (s) =>
        String(s.nom ?? "")
          .toLowerCase()
          .includes(q) ||
        String(s.code ?? "")
          .toLowerCase()
          .includes(q)
    );
  }, [search, societes]);

  const totalResults = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalResults === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, totalResults);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isSuper) return;
    api
      .get("companies")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setSocietes(data.filter((s) => s.actif !== false));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isSuper]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleSelect(societe) {
    if (selecting != null) return;
    setSelecting(societe.id);
    setActiveSociete(societe.id);
    await new Promise((r) => setTimeout(r, 400));
    navigate("/dashboard", { replace: true });
  }

  if (!isSuper) return <Navigate to="/dashboard" replace />;

  return (
    <div
      className="select-societe-page relative min-h-screen overflow-hidden"
      style={{ padding: 0 }}
    >
      <style>{`
        @keyframes select-societe-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes select-societe-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes select-societe-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes select-societe-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        @keyframes select-societe-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(55,138,221,0.45); }
          70% { box-shadow: 0 0 0 10px rgba(55,138,221,0); }
          100% { box-shadow: 0 0 0 0 rgba(55,138,221,0); }
        }
        @keyframes selectHeroKenBurns {
          0% { transform: scale(1.02); }
          100% { transform: scale(1.06); }
        }
        .select-societe-hero-img {
          animation: selectHeroKenBurns 36s ease-in-out infinite alternate;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .select-societe-hero-img { animation: none !important; }
        }
        .select-societe-page .select-societe-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
        }
        .select-societe-page .select-societe-card:not(.select-societe-card--disabled):hover {
          transform: translateY(-4px) !important;
          box-shadow: 0 12px 32px rgba(0,0,0,0.35) !important;
          border-color: rgba(56,189,248,0.45) !important;
        }
        .select-societe-page .select-societe-card:not(.select-societe-card--disabled):hover .select-societe-acceder {
          background: linear-gradient(135deg, #378ADD, #0EA5E9) !important;
          color: white !important;
          border-color: transparent !important;
        }
        .select-societe-skeleton {
          background: linear-gradient(90deg,
            rgba(30,41,59,0.9) 25%,
            rgba(51,65,85,0.55) 50%,
            rgba(30,41,59,0.9) 75%
          );
          background-size: 400px 100%;
          animation: select-societe-shimmer 1.4s ease infinite;
        }
        .select-societe-search:focus {
          border-color: #378ADD !important;
          box-shadow: 0 0 0 3px rgba(55,138,221,0.22) !important;
          outline: none !important;
        }
        .select-societe-retour:hover {
          background: rgba(30,41,59,0.85) !important;
          border-color: rgba(56,189,248,0.35) !important;
        }
        .select-societe-page .select-societe-pagination {
          border-color: rgba(148,163,184,0.2) !important;
          background: rgba(15,23,42,0.78) !important;
          backdrop-filter: blur(10px);
        }
      `}</style>

      {/* Même image que le hero du tableau de bord */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <img
          src="/images/warehouse-hero.png"
          alt=""
          className="select-societe-hero-img absolute inset-0 h-full w-full object-cover object-[68%_32%] brightness-[0.95]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(7,13,24,0.72) 0%, rgba(7,13,24,0.82) 40%, rgba(7,13,24,0.92) 100%), radial-gradient(ellipse 70% 50% at 50% 0%, rgba(55,138,221,0.18), transparent 55%)",
          }}
        />
      </div>

      {hasContext && (
        <div
          className="fixed right-6 top-4 z-20 transition-opacity duration-500 ease-out"
          style={{ opacity: mounted ? 1 : 0, transitionDelay: "0.2s" }}
        >
          <button
            type="button"
            className="select-societe-retour flex cursor-pointer items-center gap-1.5 rounded-xl border px-4 py-2 text-[13px] text-slate-300 transition-all duration-200"
            style={{
              background: "rgba(15,23,42,0.92)",
              borderColor: "rgba(148,163,184,0.25)",
            }}
            onClick={() => navigate("/dashboard")}
          >
            ← Tableau de bord
          </button>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[960px] px-8 pb-16 pt-[6vh] sm:px-8">
        <div
          className="mb-12 text-center transition-all duration-500 ease-out"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
          }}
        >
          <div
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
            style={{
              background: "rgba(55,138,221,0.16)",
              borderColor: "rgba(56,189,248,0.35)",
            }}
          >
            <div
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
              style={{ animation: "select-societe-pulse-ring 2s ease infinite" }}
            />
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-sky-200">
              Super administrateur
            </span>
          </div>

          <h1
            className="m-0 mb-2 font-display text-[28px] font-medium tracking-tight text-white sm:text-[32px]"
            style={{ letterSpacing: "-0.5px" }}
          >
            Choisissez une société
          </h1>
          <p className="m-0 text-sm text-slate-300/80">
            {loading
              ? "Chargement des sociétés…"
              : `${societes.length} société${societes.length !== 1 ? "s" : ""} disponible${societes.length !== 1 ? "s" : ""} sur la plateforme`}
          </p>
        </div>

        <div
          className="mx-auto mb-10 max-w-[440px] transition-all duration-500 ease-out"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transitionDelay: "0.1s",
          }}
        >
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchRef}
              autoFocus
              className="select-societe-search h-11 w-full rounded-xl border text-sm text-slate-100 transition-all duration-200"
              style={{
                paddingLeft: "42px",
                paddingRight: search ? "36px" : "14px",
                boxSizing: "border-box",
                background: "rgba(15,23,42,0.78)",
                borderColor: "rgba(148,163,184,0.28)",
                backdropFilter: "blur(8px)",
              }}
              type="text"
              placeholder="Rechercher par nom ou code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0.5 text-base leading-none text-slate-500 hover:text-slate-300"
                onClick={() => setSearch("")}
                aria-label="Effacer la recherche"
              >
                ×
              </button>
            ) : null}
          </div>
          {search ? (
            <p className="mt-1.5 pl-1 text-xs text-slate-400">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""} pour « {search} »
            </p>
          ) : null}
        </div>

        {loading ? (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-2xl border p-6"
                style={{
                  borderColor: "rgba(148,163,184,0.12)",
                  background: "rgba(15,23,42,0.55)",
                  opacity: 1 - i * 0.08,
                }}
              >
                <div className="mb-5 flex justify-between">
                  <div>
                    <div className="select-societe-skeleton mb-2 h-2.5 w-[60px] rounded" />
                    <div className="select-societe-skeleton h-4 w-[120px] rounded" />
                  </div>
                  <div className="select-societe-skeleton h-11 w-11 shrink-0 rounded-[10px]" />
                </div>
                <div
                  className="mb-4 flex border-t pt-4"
                  style={{ borderColor: "rgba(148,163,184,0.12)" }}
                >
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="flex-1 text-center"
                      style={{
                        borderRight: j < 3 ? "0.5px solid rgba(148,163,184,0.12)" : "none",
                      }}
                    >
                      <div className="select-societe-skeleton mx-auto mb-1 h-5 w-6 rounded" />
                      <div className="select-societe-skeleton mx-auto h-2 w-12 rounded" />
                    </div>
                  ))}
                </div>
                <div className="select-societe-skeleton h-[34px] w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center" style={{ animation: "select-societe-fadeIn 0.3s ease" }}>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              style={{ background: "rgba(30,41,59,0.85)" }}
            >
              🔍
            </div>
            <p className="m-0 mb-1 text-[15px] font-medium text-slate-100">Aucune société trouvée</p>
            <p className="m-0 mb-4 text-sm text-slate-400">Aucun résultat pour « {search} »</p>
            <button
              type="button"
              className="cursor-pointer rounded-lg border px-4 py-1.5 text-[13px] text-slate-400 transition-colors hover:border-sky-500/40 hover:text-slate-200"
              style={{ background: "transparent", borderColor: "rgba(148,163,184,0.25)" }}
              onClick={() => setSearch("")}
            >
              Effacer la recherche
            </button>
          </div>
        ) : (
          <>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {pageItems.map((societe, idx) => {
                const isSelecting = selecting === societe.id;
                const isOther = selecting != null && !isSelecting;
                const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                const initial = String(societe.nom || societe.code || "?")
                  .trim()
                  .charAt(0)
                  .toUpperCase();
                const logoUrl = buildLogoUrl(societe.logo);

                return (
                  <div
                    key={societe.id}
                    role="button"
                    tabIndex={0}
                    className={`select-societe-card rounded-2xl border p-5 backdrop-blur-md ${
                      isOther ? "select-societe-card--disabled" : ""
                    }`}
                    style={{
                      background: isSelecting ? "rgba(55,138,221,0.14)" : "rgba(15,23,42,0.72)",
                      borderWidth: isSelecting ? "1.5px" : "0.5px",
                      borderStyle: "solid",
                      borderColor: isSelecting ? "rgba(56,189,248,0.55)" : "rgba(148,163,184,0.18)",
                      cursor: selecting ? (isSelecting ? "wait" : "not-allowed") : "pointer",
                      opacity: isOther ? 0.45 : 1,
                      transform: isSelecting ? "scale(0.98)" : undefined,
                      animation: `select-societe-fadeUp 0.4s ease both`,
                      animationDelay: `${idx * 0.05}s`,
                    }}
                    onClick={() => !selecting && handleSelect(societe)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !selecting) {
                        e.preventDefault();
                        handleSelect(societe);
                      }
                    }}
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div className="min-w-0 flex-1 pr-3 text-left">
                        <div className="mb-1 font-mono text-[11px] tracking-wide text-slate-400">
                          {societe.code}
                        </div>
                        <div className="truncate text-base font-medium text-slate-100">
                          {societe.nom}
                        </div>
                      </div>
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={societe.nom}
                          className="h-12 w-12 rounded-full border-2 border-white/10 object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[17px] font-semibold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
                            boxShadow: `0 4px 12px ${grad.from}66`,
                          }}
                        >
                          {initial}
                        </div>
                      )}
                    </div>

                    <div
                      className="mb-4 flex border-t pt-4"
                      style={{ borderColor: "rgba(148,163,184,0.12)" }}
                    >
                      {[
                        { label: "Utilisateurs", value: societe._count?.utilisateurs ?? 0 },
                        { label: "Articles", value: societe._count?.articles ?? 0 },
                        { label: "Dépôts", value: societe._count?.depots ?? 0 },
                      ].map((stat, i) => (
                        <div
                          key={stat.label}
                          className="flex-1 text-center"
                          style={{
                            borderRight: i < 2 ? "0.5px solid rgba(148,163,184,0.12)" : "none",
                          }}
                        >
                          <div className="text-xl font-medium leading-tight text-white">
                            {stat.value}
                          </div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="select-societe-acceder flex items-center justify-center gap-2 rounded-lg border py-2 text-[13px] font-medium transition-all duration-200"
                      style={{
                        borderColor: isSelecting ? "transparent" : "rgba(148,163,184,0.2)",
                        color: isSelecting ? "white" : "rgb(148,163,184)",
                        background: isSelecting
                          ? "linear-gradient(135deg, #378ADD, #0EA5E9)"
                          : "transparent",
                      }}
                    >
                      {isSelecting ? (
                        <>
                          <span
                            className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white/40 border-t-white"
                            style={{ animation: "select-societe-spin 0.6s linear infinite" }}
                          />
                          Chargement…
                        </>
                      ) : (
                        <>
                          Accéder <span className="ml-0.5">→</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6">
              <StockPagination
                page={safePage}
                totalPages={totalPages}
                totalResults={totalResults}
                pageSize={pageSize}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                unitLabel="société(s)"
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                className="select-societe-pagination"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
