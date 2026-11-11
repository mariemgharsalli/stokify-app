import PageShell from "../ui/PageShell";
import AiModuleHero from "./AiModuleHero";

/**
 * En mode embedded (Module IA), évite le double chrome PageShell.
 * Titres prévision / anomalies / chargement / slotting : AiModuleHero.
 */
export default function AiModuleShell({
  embedded,
  title,
  subtitle,
  actions,
  kicker,
  badge,
  models,
  accent,
  badgeTitle,
  badgeStyle,
  children,
}) {
  const hero =
    title || subtitle ? (
      <AiModuleHero
        title={title}
        subtitle={subtitle}
        kicker={kicker}
        badge={badge}
        badgeTitle={badgeTitle}
        badgeStyle={badgeStyle}
        models={models}
        accent={accent}
        actions={actions}
      />
    ) : null;

  if (embedded) {
    return (
      <div className="space-y-6">
        {hero}
        {children}
      </div>
    );
  }

  return (
    <PageShell actions={hero ? undefined : actions}>
      {hero}
      {children}
    </PageShell>
  );
}
