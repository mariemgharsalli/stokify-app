import { useTypewriter } from "../../hooks/useTypewriter";

/**
 * Carte d'insight réutilisable — lecture studio, badge, typewriter.
 *
 * @param {{ text?: string, title?: string, icon?: React.ReactNode, loading?: boolean, badge?: string }} props
 */
export default function AiInsightCard({ text = "", title, icon, loading = false, badge = "IA" }) {
  const typed = useTypewriter(loading ? "" : text);
  const isTyping = !loading && typed.length < (text?.length ?? 0);

  return (
    <article className="ia-insight">
      <span className="ia-insight__rail" aria-hidden />
      <div className="ia-insight__head">
        <h3 className="ia-insight__title">
          {icon ? <span className="ia-insight__icon">{icon}</span> : null}
          {title || "Lecture IA"}
        </h3>
        <span className="ia-insight__badge">{badge}</span>
      </div>

      {loading ? (
        <div className="mt-3 space-y-2.5" aria-busy="true" aria-label="Chargement de l'analyse">
          <span className="ia-hub-card__skel" />
          <span className="ia-hub-card__skel" style={{ width: "62%" }} />
        </div>
      ) : (
        <p className="ia-insight__text">
          {typed}
          {isTyping ? (
            <span
              className="ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle"
              style={{ background: "#8b7cf7" }}
            />
          ) : null}
        </p>
      )}
    </article>
  );
}
