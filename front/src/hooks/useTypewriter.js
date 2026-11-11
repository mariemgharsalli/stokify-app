import { useEffect, useState } from "react";

/**
 * Affiche un texte caractère par caractère (effet machine à écrire).
 * Respecte prefers-reduced-motion en affichant immédiatement le texte final.
 *
 * @param {string} text - texte à afficher progressivement
 * @param {number} speed - délai entre chaque caractère (ms)
 * @returns {string} portion actuellement affichée
 */
export function useTypewriter(text, speed = 22) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!text) {
      setDisplayed("");
      return undefined;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayed(text);
      return undefined;
    }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

export default useTypewriter;
