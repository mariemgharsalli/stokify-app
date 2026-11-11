const CAMION_SRC = "/cutouts/camion-cutout.png";

/**
 * Illustration camion réutilisable — image détourée + route animée.
 * @param {boolean} active — animation subtile si actif, grisé si inactif
 */
export default function TruckGlyph({ active = true, className = "", width = 140, height = 72, alt = "" }) {
  const roadH = 10;
  const truckH = Math.max(height - roadH, 48);

  return (
    <div
      className={`inline-flex flex-col items-center justify-end ${className}`.trim()}
      style={{ width, minHeight: height }}
      aria-hidden={!alt}
    >
      <img
        src={CAMION_SRC}
        alt={alt}
        className={`block w-full object-contain object-bottom ${active ? "truck-breathe" : "truck-inactive"}`}
        style={{ height: truckH }}
        draggable={false}
      />
      <svg viewBox="0 0 140 6" width={width} height={roadH} className="block shrink-0" aria-hidden>
        <line
          x1="0"
          y1="3"
          x2="140"
          y2="3"
          stroke="var(--border-default)"
          strokeWidth="2"
          strokeDasharray="8 6"
          className={active ? "road-dash" : undefined}
          opacity={active ? 1 : 0.45}
        />
      </svg>
    </div>
  );
}
