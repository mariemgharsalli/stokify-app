import { IA } from "../moduleIaTheme";

export function HudFrame({ color = IA.accent, children, className = "", style, as: Tag = "div", ...rest }) {
  return (
    <Tag
      className={`ia-frame relative overflow-hidden ${rest.type === "button" || rest.onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ "--ia-frame": color, ...style }}
      {...rest}
    >
      <span className="ia-frame__rail" aria-hidden />
      <span className="ia-frame__hairline" aria-hidden />
      {children}
    </Tag>
  );
}

export function MiniSpark({ values = [], color = IA.accent, width = 92, height = 28 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
    const y = height - ((v - min) / span) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts.at(-1)?.split(",") || ["0", "0"];
  const fillPts = `0,${height} ${pts.join(" ")} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
      <polygon points={fillPts} fill={color} opacity="0.12" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}

export function Kicker({ color, icon: Icon, children, live = false }) {
  return (
    <p
      className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em]"
      style={{ color }}
    >
      {Icon ? <Icon size={12} /> : null}
      {children}
      {live ? (
        <span className="ai-hero-live-dot ml-0.5 h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      ) : null}
    </p>
  );
}
