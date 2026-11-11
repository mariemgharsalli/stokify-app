/**
 * Message d'erreur uniforme sous un champ de formulaire.
 * Couleur design system : #E24B4A
 */
export default function FormFieldError({ message, style, className }) {
  if (!message) return null;
  return (
    <p
      className={className}
      role="alert"
      style={{
        marginTop: 4,
        fontSize: 12,
        lineHeight: 1.35,
        color: "#E24B4A",
        ...style,
      }}
    >
      {message}
    </p>
  );
}

/** Classe bordure rouge à appliquer sur l'input en erreur. */
export const INPUT_ERROR_CLASS = "border-[rgba(226,75,74,0.65)]";

/** Style inline bordure rouge. */
export const inputErrorStyle = {
  borderColor: "rgba(226, 75, 74, 0.65)",
};
