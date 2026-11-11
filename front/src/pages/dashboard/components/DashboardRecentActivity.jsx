import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShoppingCart,
  PackagePlus,
  PackageMinus,
  ArrowLeftRight,
  ClipboardList,
  Activity,
  Eye,
} from "lucide-react";
import { Link } from "react-router-dom";
import ArticleAvatar from "../../../components/ui/ArticleAvatar";
import { getArticleRealImageUrl } from "../../../utils/articleImage";
import { DASHBOARD_TONES } from "./dashboardTones";
import { useLandingLang } from "../../landing/LandingLangContext";
import { interpolate } from "../../../i18n/languages";

const DETAIL_BLUE = "#378ADD";
const DETAIL_CYAN = "#0EA5E9";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const listStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045 } },
};

const rowFade = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

function resolveMvtMeta(type, t) {
  const code = String(type || "").trim().toUpperCase();
  const map = {
    SORTIE_VENTE: { label: t.dashMvtSale, tone: "success", icon: ShoppingCart },
    TRANSFERT: { label: t.dashMvtTransfer, tone: "primary", icon: ArrowLeftRight },
    ENTREE_ACHAT: { label: t.dashMvtPurchase, tone: "success", icon: PackagePlus },
    ENTREE_AJUSTEMENT: { label: t.dashMvtAdjust, tone: "warning", icon: ClipboardList },
    SORTIE_AUTRE: { label: t.dashMvtOtherOut, tone: "warning", icon: PackageMinus },
  };
  if (map[code]) return map[code];
  if (code.startsWith("ENTREE_")) return { label: t.dashMvtIn, tone: "success", icon: PackagePlus };
  if (code.startsWith("SORTIE_")) return { label: t.dashMvtOut, tone: "danger", icon: PackageMinus };
  return { label: code || t.dashMvtGeneric, tone: "accent", icon: Activity };
}

function formatRelativeDate(iso, t) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  const diffMs = Date.now() - dt.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t.dashRelJustNow;
  if (diffMin < 60) return interpolate(t.dashRelMin, { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return interpolate(t.dashRelHour, { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return interpolate(t.dashRelDay, { n: diffD });
  return dt.toLocaleDateString(t.localeTag || "fr-FR", { day: "2-digit", month: "short" });
}

function ActivityArticleThumb({ article, accent }) {
  const imgSrc = getArticleRealImageUrl(article);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
  }, [imgSrc, article?.id, article?.imageUrl]);

  return (
    <div
      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full"
      style={{
        boxShadow: `0 0 0 2px color-mix(in srgb, ${accent} 45%, transparent), 0 8px 16px -10px ${accent}99`,
        background: "var(--bg-input)",
      }}
    >
      {imgSrc && !imgErr ? (
        <img
          src={imgSrc}
          alt={article?.libelle || article?.code || "Article"}
          onError={() => setImgErr(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <ArticleAvatar
          article={article}
          size={44}
          className="!h-full !w-full !rounded-full !border-0"
        />
      )}
    </div>
  );
}

export default function DashboardRecentActivity({ movements, loading }) {
  const reduceMotion = useReducedMotion();
  const { t } = useLandingLang();
  const items = (movements || []).slice(0, 8);

  return (
    <motion.div
      variants={fadeUp}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      className="dash-glass-card h-full overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-[var(--dash-line)] px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            {t.dashActivity}
          </h2>
          <p className="text-[11px] text-[var(--text-muted)]">{t.dashActivitySub}</p>
        </div>
        <Link
          to="/mouvements"
          className="inline-flex items-center gap-1 text-xs font-semibold transition hover:brightness-110"
          style={{ color: DETAIL_CYAN }}
        >
          {t.dashSeeAll}
          <Eye className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-0 divide-y divide-[var(--dash-line)]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--bg-hover)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 animate-pulse rounded bg-[var(--bg-hover)]" />
                <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--bg-hover)]" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">
          {t.dashNoActivity}
        </div>
      ) : (
        <motion.ul
          variants={listStagger}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="relative"
        >
          <span
            className="pointer-events-none absolute bottom-4 left-[2.15rem] top-4 w-px bg-gradient-to-b from-[var(--accent-info)] via-[var(--dash-line)] to-transparent"
            aria-hidden
          />
          {items.map((mvt, index) => {
            const meta = resolveMvtMeta(mvt.type, t);
            const tone = DASHBOARD_TONES[meta.tone] ?? DASHBOARD_TONES.accent;
            const TypeIcon = meta.icon;
            const qty = Number(mvt.quantite ?? 0);
            const article = mvt.article || {
              code: mvt.articleCode,
              libelle: mvt.articleLibelle,
              imageUrl: mvt.imageUrl || mvt.article?.imageUrl,
            };
            const articleLabel =
              article?.libelle ||
              article?.designation ||
              article?.code ||
              mvt.articleCode ||
              mvt.reference ||
              t.dashArticle;

            return (
              <motion.li
                key={mvt.id ?? `${mvt.type}-${mvt.createdAt}-${index}`}
                variants={rowFade}
                whileHover={reduceMotion ? undefined : { x: 4 }}
                className="group relative flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <div className="relative z-[1] shrink-0">
                  <ActivityArticleThumb article={article} accent={tone.accent} />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--bg-card)]"
                    style={{
                      background: `linear-gradient(135deg, ${tone.accent}, color-mix(in srgb, ${tone.accent} 55%, ${DETAIL_CYAN}))`,
                      color: "#fff",
                    }}
                    title={meta.label}
                  >
                    <TypeIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {meta.label} — {articleLabel}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                    <span>{formatRelativeDate(mvt.createdAt, t)}</span>
                    {article?.code ? (
                      <span className="font-mono text-[10px]" style={{ color: DETAIL_BLUE }}>
                        {article.code}
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums"
                    style={{
                      background: `color-mix(in srgb, ${tone.accent} 12%, transparent)`,
                      color: tone.accent,
                    }}
                  >
                    {qty > 0 ? `+${qty}` : qty}
                  </span>
                  {mvt.depot?.libelle || mvt.depot?.nom || mvt.depot?.code ? (
                    <span className="max-w-[120px] truncate text-[10px] text-[var(--text-muted)]">
                      {mvt.depot?.code || mvt.depot?.libelle || mvt.depot?.nom}
                    </span>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </motion.div>
  );
}
