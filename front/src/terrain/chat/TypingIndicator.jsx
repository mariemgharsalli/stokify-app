import { useReducedMotion } from "framer-motion";
import { fr } from "../strings/fr";

export default function TypingIndicator() {
  const reduce = useReducedMotion();
  return (
    <p className="terrain-typing" role="status">
      <span className={reduce ? "is-still" : undefined} aria-hidden="true" />
      <span className={reduce ? "is-still" : undefined} aria-hidden="true" />
      <span className={reduce ? "is-still" : undefined} aria-hidden="true" />
      <span>{fr.stokiTyping}</span>
    </p>
  );
}
