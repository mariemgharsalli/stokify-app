import { useEffect, useRef, useState } from "react";

export default function WizardStepPanel({ stepKey, direction, children }) {
  const isFirst = useRef(true);
  const [anim, setAnim] = useState("");

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    setAnim(direction === "forward" ? "wizard-slide-enter-right" : "wizard-slide-enter-left");
    const t = setTimeout(() => setAnim(""), 280);
    return () => clearTimeout(t);
  }, [stepKey, direction]);

  return <div className={`wizard-step-panel min-h-[200px] ${anim}`}>{children}</div>;
}
