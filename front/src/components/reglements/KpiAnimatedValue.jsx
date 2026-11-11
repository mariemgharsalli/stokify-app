import { useEffect, useState } from "react";

export default function KpiAnimatedValue({ value, isMoney, className = "", style = {} }) {
  const end = Number(value) || 0;
  const [display, setDisplay] = useState(() => format(0, isMoney));

  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(format(start, isMoney));
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [end, isMoney]);

  return (
    <span className={`inline tabular-nums ${className}`} style={style}>
      {display}
    </span>
  );
}

function format(n, isMoney) {
  if (isMoney) {
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return Math.round(n).toString();
}
