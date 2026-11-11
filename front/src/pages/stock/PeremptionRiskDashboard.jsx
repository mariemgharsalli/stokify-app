import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarClock, Hourglass, MapPin, Tag } from "lucide-react";
import AiModuleShell from "../../components/ai/AiModuleShell";
import api from "../../services/api";
import { useSocieteQueryScope } from "../../hooks/useSocieteQueryScope";
import { useCountUp } from "../../hooks/useCountUp";
import { FADE_UP, IA, STAGGER, controlStyle, surfaceStyle } from "../ai/moduleIaTheme";

const DAY_OPTIONS = [
  { id: "30", label: "30 jours" },
  { id: "60", label: "60 jours" },
  { id: "90", label: "90 jours" },
];

const LEVEL_OPTIONS = [
  { id: "", label: "Tous les niveaux" },
  { id: "élevé", label: "Élevé" },
  { id: "moyen", label: "Moyen" },
  { id: "faible", label: "Faible" },
];

const LEVEL_TONE = {
  élevé: { color: IA.accentDanger, label: "Élevé" },
  moyen: { color: IA.accentWarning, label: "Moyen" },
  faible: { color: "var(--accent-success)", label: "Faible" },
};

function formatDt(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DT`;
}

function formatUnits(n) {
  const v = Number(n) || 0;
  const txt = v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const one = Math.abs(v - 1) < 0.05;
  return `${txt} unité${one ? "" : "s"}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function lotSentence(lot) {
  const qty = formatUnits(lot.quantiteRisquee);
  const verb = Math.abs(Number(lot.quantiteRisquee) - 1) < 0.05 ? "risque" : "risquent";
  const sold = Math.abs(Number(lot.quantiteRisquee) - 1) < 0.05 ? "vendue" : "vendues";
  return `Lot ${lot.numero} de ${lot.articleLibelle} — ${qty} ${verb} de ne pas être ${sold} avant le ${formatDate(lot.dateExpiration)} — perte potentielle estimée : ${formatDt(lot.valeurRisquee)}`;
}

function sourceSentence(source) {
  if (source === "fallback") {
    return "Les prévisions détaillées sont momentanément indisponibles : ce calcul s'appuie sur les ventes des 30 derniers jours.";
  }
  if (source === "mixte") {
    return "Estimé à partir des ventes prévues, complété par les ventes des 30 derniers jours quand une prévision manque.";
  }
  return "Estimé à partir des ventes prévues jusqu'à la date du lot.";
}

function LevelBadge({ niveau }) {
  const tone = LEVEL_TONE[niveau] || LEVEL_TONE.faible;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{
        color: tone.color,
        background: `color-mix(in srgb, ${tone.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone.color} 35%, transparent)`,
      }}
    >
      {tone.label}
    </span>
  );
}

function RiskCard({ lot }) {
  const tone = LEVEL_TONE[lot.niveau] || LEVEL_TONE.faible;
  const action = lot.action;
  return (
    <motion.article variants={FADE_UP} className="p-5" style={surfaceStyle()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <LevelBadge niveau={lot.niveau} />
        <p className="text-sm font-semibold tabular-nums" style={{ color: tone.color }}>
          {formatDt(lot.valeurRisquee)}
        </p>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: IA.text, fontFamily: IA.fontBody }}>
        {lotSentence(lot)}
      </p>
      <p className="mt-2 text-xs" style={{ color: IA.muted }}>
        {lot.depotLibelle ? `${lot.depotLibelle} · ` : ""}
        {lot.joursRestants === 0
          ? "Expire aujourd'hui"
          : `${lot.joursRestants} jour${lot.joursRestants > 1 ? "s" : ""} restants`}
        {" · "}
        chance estimée : {lot.probabiliteRisque}%
      </p>
      {action?.to ? (
        <Link
          to={action.to}
          className="mt-4 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{
            color: IA.onAccent,
            background: tone.color,
          }}
        >
          {action.type === "transfert" ? <MapPin className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
          {action.type === "transfert" ? "Transférer vers un dépôt qui vend plus" : "Proposer une promotion"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
      {action?.type === "transfert" && action.depotCibleLibelle ? (
        <p className="mt-2 text-xs" style={{ color: IA.textSecondary }}>
          {action.label}
        </p>
      ) : null}
    </motion.article>
  );
}

export default function PeremptionRiskDashboard({ embedded = false }) {
  const societeScope = useSocieteQueryScope();
  const reduceMotion = useReducedMotion();
  const [days, setDays] = useState("30");
  const [depotId, setDepotId] = useState("");
  const [niveau, setNiveau] = useState("");

  const { data: depotsData } = useQuery({
    queryKey: ["depots", societeScope, "peremption-risk"],
    queryFn: () => api.get("depots", { params: { limit: 100, statut: "ACTIF" } }).then((r) => r.data),
  });
  const depots = depotsData?.items ?? depotsData ?? [];

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["lots-peremption-risk", societeScope, days, depotId, niveau],
    queryFn: () =>
      api
        .get("lots/peremption-risk", {
          params: {
            days,
            ...(depotId ? { depotId } : {}),
            ...(niveau ? { niveau } : {}),
          },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  const valeur = Number(data?.valeurEnJeu) || 0;
  const animated = useCountUp(valeur, 900, 2);
  const items = data?.items ?? [];
  const shownMoney = useMemo(() => formatDt(isPending ? 0 : animated), [animated, isPending]);

  return (
    <AiModuleShell
      embedded={embedded}
      kicker="Lots à surveiller"
      title="Risque de péremption"
      subtitle="Les lots qui risquent de rester invendus avant leur date, et l'argent que cela représente."
      badge="Recommandé"
      models={["Ventes prévues", "Date du lot", "Perte en DT"]}
      accent={IA.accentWarning}
    >
      <motion.section
        variants={STAGGER}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        className="space-y-5"
      >
        <motion.div variants={FADE_UP} className="p-5 sm:p-6" style={surfaceStyle()}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: IA.accentDanger }}
              >
                {days === "30" ? "En jeu ce mois-ci" : `En jeu sur ${days} jours`}
              </p>
              <p
                className="mt-1 font-display text-3xl font-bold tabular-nums sm:text-4xl"
                style={{ color: IA.text, fontFamily: IA.fontTitle }}
              >
                {isPending ? "…" : shownMoney}
              </p>
              <p className="mt-1 text-sm" style={{ color: IA.textSecondary }}>
                {isPending
                  ? "Calcul en cours…"
                  : `${data?.lotsEleves ?? 0} lot${(data?.lotsEleves ?? 0) > 1 ? "s" : ""} à risque élevé`}
              </p>
            </div>
            <Hourglass className="h-8 w-8" style={{ color: IA.accentWarning }} aria-hidden />
          </div>
          {!isPending && data?.source ? (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: IA.muted }}>
              {sourceSentence(data.source)}
            </p>
          ) : null}
        </motion.div>

        <motion.div variants={FADE_UP} className="flex flex-wrap gap-2">
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDays(opt.id)}
              className="px-3 py-2 text-sm font-semibold"
              style={controlStyle({
                color: days === opt.id ? IA.onAccent : IA.text,
                background: days === opt.id ? IA.accent : IA.bgElevated,
              })}
            >
              {opt.label}
            </button>
          ))}
          <label className="sr-only" htmlFor="peremption-depot">
            Dépôt
          </label>
          <select
            id="peremption-depot"
            value={depotId}
            onChange={(e) => setDepotId(e.target.value)}
            className="px-3 py-2 text-sm"
            style={controlStyle({ color: IA.text })}
          >
            <option value="">Tous les dépôts</option>
            {depots.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.libelle || d.code}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="peremption-niveau">
            Niveau de risque
          </label>
          <select
            id="peremption-niveau"
            value={niveau}
            onChange={(e) => setNiveau(e.target.value)}
            className="px-3 py-2 text-sm"
            style={controlStyle({ color: IA.text })}
          >
            {LEVEL_OPTIONS.map((opt) => (
              <option key={opt.id || "all"} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </motion.div>

        {isError ? (
          <motion.div variants={FADE_UP} className="p-5" style={surfaceStyle()}>
            <p className="text-sm" style={{ color: IA.text }}>
              Le calcul n'a pas abouti. Réessayez dans un instant.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm font-semibold"
              style={{ color: IA.accent }}
            >
              Réessayer
            </button>
          </motion.div>
        ) : null}

        {isPending ? (
          <motion.div variants={FADE_UP} className="p-6 text-sm" style={{ ...surfaceStyle(), color: IA.muted }}>
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Lecture des lots et des ventes prévues…
            </span>
          </motion.div>
        ) : null}

        {!isPending && !isError && items.length === 0 ? (
          <motion.div variants={FADE_UP} className="p-6" style={surfaceStyle()}>
            <p className="text-sm leading-relaxed" style={{ color: IA.text }}>
              Aucun lot ne risque de rester invendu sur cette période.
            </p>
          </motion.div>
        ) : null}

        {!isPending && items.length > 0 ? (
          <motion.div variants={STAGGER} className="grid gap-3" style={{ opacity: isFetching ? 0.72 : 1 }}>
            {items.map((lot) => (
              <RiskCard key={lot.lotId} lot={lot} />
            ))}
          </motion.div>
        ) : null}
      </motion.section>
    </AiModuleShell>
  );
}
