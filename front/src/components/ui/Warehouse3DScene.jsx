import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { project3D, projectBox, toSvgPoints } from "../../utils/isometricEngine";
import {
  computeSceneGrid,
  emplacementId,
  gridPosition,
} from "../../utils/warehouse3dUtils";

const VIEW_W = 1360;
const VIEW_H = 840;
const DEFAULT_ROT_Z = -32;
const DEFAULT_TILT_X = 58;
const CELL_SIZE = 96;
const BOX_SIZE = CELL_SIZE * 0.7;
const MIN_BOX_HEIGHT = 14;
const MAX_BOX_HEIGHT = BOX_SIZE * 2.85;
const SHELL_H = MAX_BOX_HEIGHT;
const DECK_H = 20;
const POST_W = 6;
const PROJ_SCALE_FACTOR = 1.68;
const BADGE_LIFT = 52;

const CTRL_BTN =
  "rounded-lg border border-[var(--border-default)] bg-[var(--bg-modal)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-dropdown)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";

function normalizeOccupationRatio(empl) {
  const raw = Number(empl?.occupationRatio) || 0;
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function parseHex(hex) {
  const raw = String(hex).replace("#", "").trim();
  const norm =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return [
    parseInt(norm.slice(0, 2), 16),
    parseInt(norm.slice(2, 4), 16),
    parseInt(norm.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  const clamp = (n) => Math.min(255, Math.max(0, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsl(hex) {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

const LEGEND_COLORS = {
  low: hslToHex(152, 78, 64),
  mid: hslToHex(45, 78, 64),
  high: hslToHex(0, 78, 64),
};

function adjustLightness(hex, factor) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, Math.max(0, l * factor)));
}

function boxHeight(occupationRatio) {
  let raw = Number(occupationRatio);
  if (!Number.isFinite(raw) || raw < 0) raw = 0;
  const r = raw > 1 ? Math.min(1, raw / 100) : Math.min(1, raw);
  const h = MIN_BOX_HEIGHT + r ** 0.85 * (MAX_BOX_HEIGHT - MIN_BOX_HEIGHT);
  return Math.min(MAX_BOX_HEIGHT, h);
}

function insetFacePoints(points, factor = 0.38) {
  const cx = points.reduce((s, p) => s + p.sx, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.sy, 0) / points.length;
  return points.map((p) => ({
    sx: cx + (p.sx - cx) * factor,
    sy: cy + (p.sy - cy) * factor,
  }));
}

function normalizeEmplId(id) {
  if (id == null || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function sameEmplId(a, b) {
  const na = normalizeEmplId(a);
  const nb = normalizeEmplId(b);
  return na != null && nb != null && na === nb;
}

function hexToRgba(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function occupationColorVivid(empl) {
  const r = normalizeOccupationRatio(empl);
  if (r <= 0.02) return hslToHex(210, 22, 38);
  let hue;
  if (r < 0.5) {
    hue = 152 - (152 - 42) * (r / 0.5);
  } else {
    hue = 42 - 42 * ((r - 0.5) / 0.5);
  }
  return hslToHex(hue, 82, 58);
}

function stackSpec(occupationRatio) {
  const r = normalizeOccupationRatio({ occupationRatio });
  const totalH = boxHeight(r);
  if (r <= 0.02) return { layers: 1, layerH: Math.max(10, totalH * 0.45), gap: 0, totalH: Math.max(10, totalH * 0.45), fillH: Math.max(10, totalH * 0.45), empty: true };
  const layers = Math.min(5, Math.max(1, Math.round(r * 5)));
  const gap = 4;
  const layerH = Math.max(12, (totalH - gap * (layers - 1)) / layers);
  const fillH = layers * layerH + (layers - 1) * gap;
  return { layers, layerH, gap, totalH: fillH, fillH, empty: false };
}

function faceShade(hex, face) {
  const shadeFactor = { top: 1.22, front: 1, side: 0.62 }[face] ?? 1;
  return adjustLightness(hex, shadeFactor);
}

function worldSizeOrigin(x, y, size) {
  return { col: x / size, row: y / size };
}

function gridOriginOffset(cols) {
  return -(cols * CELL_SIZE) / 2;
}

function boxWorldOrigin(gridX, gridY, cols) {
  const offset = gridOriginOffset(cols);
  const padding = (CELL_SIZE - BOX_SIZE) / 2;
  return {
    x: (gridX - 1) * CELL_SIZE + offset + padding,
    y: (gridY - 1) * CELL_SIZE + offset + padding,
  };
}

function cellWorldCenter(gridX, gridY, cols) {
  const offset = gridOriginOffset(cols);
  return {
    x: (gridX - 1) * CELL_SIZE + offset + CELL_SIZE / 2,
    y: (gridY - 1) * CELL_SIZE + offset + CELL_SIZE / 2,
  };
}

function worldColRow(gridX, gridY, cols) {
  const { x, y } = boxWorldOrigin(gridX, gridY, cols);
  return { col: x / BOX_SIZE, row: y / BOX_SIZE };
}

function boxTopCenter(gridX, gridY, z, cols, rotZ, tiltX, zoom) {
  const { x, y } = boxWorldOrigin(gridX, gridY, cols);
  return project3D(x + BOX_SIZE / 2, y + BOX_SIZE / 2, z, rotZ, tiltX, zoom * PROJ_SCALE_FACTOR);
}

function computeAutoFrame(placedEmplacements, gridCols, rotZ = DEFAULT_ROT_Z, tiltX = DEFAULT_TILT_X, gridRows = gridCols) {
  if (!placedEmplacements.length) {
    return { originX: VIEW_W / 2, originY: VIEW_H / 2, zoom: 1 };
  }

  const scale = PROJ_SCALE_FACTOR;
  const xs = [];
  const ys = [];

  for (const { empl, gridX, gridY } of placedEmplacements) {
    const h = SHELL_H;
    const { col, row } = worldColRow(gridX, gridY, gridCols);
    const faces = projectBox(col, row, BOX_SIZE, h, rotZ, tiltX, scale);
    faces.forEach((f) => f.points.forEach((p) => {
      xs.push(p.sx);
      ys.push(p.sy);
    }));
  }

  const offset = gridOriginOffset(gridCols);
  const extentX = gridCols * CELL_SIZE;
  const extentY = (Number(gridRows) > 0 ? Number(gridRows) : gridCols) * CELL_SIZE;
  const floorCorners = [
    [offset, offset, 0],
    [offset + extentX, offset, 0],
    [offset + extentX, offset + extentY, 0],
    [offset, offset + extentY, 0],
  ].map((p) => project3D(p[0], p[1], p[2], rotZ, tiltX, scale));
  floorCorners.forEach((p) => {
    xs.push(p.sx);
    ys.push(p.sy);
  });

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bw = Math.max(maxX - minX, 80);
  const bh = Math.max(maxY - minY, 60);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const pad = 0.7;
  const zoom = Math.min(Math.max(Math.min((VIEW_W * pad) / bw, (VIEW_H * pad) / bh), 0.7), 2.25);

  return {
    originX: VIEW_W / 2 - cx * zoom,
    originY: VIEW_H / 2 - cy * zoom,
    zoom,
  };
}

function SceneHaloBackground() {
  return (
    <rect
      x={0}
      y={0}
      width={VIEW_W}
      height={VIEW_H}
      fill="url(#warehouse-scene-halo)"
      aria-hidden="true"
    />
  );
}

function FloorGridSvg({ rotZ, tiltX, zoom, originX, originY, cols, rows, dock, aisles }) {
  const colCount = Math.min(48, Math.max(1, Number(cols) || 1));
  const rowCount = Math.min(48, Number(rows) > 0 ? Number(rows) : colCount);
  const offset = gridOriginOffset(colCount);
  const extentX = colCount * CELL_SIZE;
  const extentY = rowCount * CELL_SIZE;
  const scale = zoom * PROJ_SCALE_FACTOR;
  const P = (x, y, z) => project3D(x, y, z, rotZ, tiltX, scale);

  const topCorners = [
    [offset, offset, 0],
    [offset + extentX, offset, 0],
    [offset + extentX, offset + extentY, 0],
    [offset, offset + extentY, 0],
  ].map((p) => P(p[0], p[1], p[2]));

  const deckEdges = [
    [[offset, offset], [offset + extentX, offset]],
    [[offset + extentX, offset], [offset + extentX, offset + extentY]],
    [[offset + extentX, offset + extentY], [offset, offset + extentY]],
    [[offset, offset + extentY], [offset, offset]],
  ].map(([[x0, y0], [x1, y1]], i) => {
    const pts = [
      P(x0, y0, -DECK_H),
      P(x1, y1, -DECK_H),
      P(x1, y1, 0),
      P(x0, y0, 0),
    ];
    const depth = pts.reduce((s, p) => s + p.depth, 0) / 4;
    return { i, depth, points: toSvgPoints(pts, originX, originY) };
  });
  deckEdges.sort((a, b) => a.depth - b.depth);

  const lines = [];
  const centerP = P(0, 0, 0);
  const centerSx = centerP.sx + originX;
  const centerSy = centerP.sy + originY;

  for (let i = 0; i <= colCount; i++) {
    const x = offset + i * CELL_SIZE;
    const p0 = P(x, offset, 0.4);
    const p1 = P(x, offset + extentY, 0.4);
    const mx = (p0.sx + p1.sx) / 2 + originX;
    const my = (p0.sy + p1.sy) / 2 + originY;
    const dist = Math.hypot(mx - centerSx, my - centerSy);
    lines.push({
      x1: p0.sx + originX,
      y1: p0.sy + originY,
      x2: p1.sx + originX,
      y2: p1.sy + originY,
      opacity: 0.12 + 0.18 * Math.max(0, 1 - dist / 340),
    });
  }
  for (let j = 0; j <= rowCount; j++) {
    const y = offset + j * CELL_SIZE;
    const p0 = P(offset, y, 0.4);
    const p1 = P(offset + extentX, y, 0.4);
    const mx = (p0.sx + p1.sx) / 2 + originX;
    const my = (p0.sy + p1.sy) / 2 + originY;
    const dist = Math.hypot(mx - centerSx, my - centerSy);
    lines.push({
      x1: p0.sx + originX,
      y1: p0.sy + originY,
      x2: p1.sx + originX,
      y2: p1.sy + originY,
      opacity: 0.12 + 0.18 * Math.max(0, 1 - dist / 340),
    });
  }

  const projectRect = (x0, y0, x1, y1, z = 0.6) =>
    [
      [offset + x0, offset + y0, z],
      [offset + x1, offset + y0, z],
      [offset + x1, offset + y1, z],
      [offset + x0, offset + y1, z],
    ]
      .map((p) => P(p[0], p[1], p[2]))
      .map((p) => `${p.sx + originX},${p.sy + originY}`)
      .join(" ");

  const dockRow = dock?.row != null ? Number(dock.row) : null;
  const dockPoly =
    Number.isFinite(dockRow) && dockRow >= 0
      ? projectRect(0, dockRow * CELL_SIZE, extentX, (dockRow + 1) * CELL_SIZE, 1.2)
      : null;

  const pylons = [
    [offset, offset],
    [offset + extentX, offset],
    [offset + extentX, offset + extentY],
    [offset, offset + extentY],
  ].map(([x, y], i) => {
    const { col, row } = worldSizeOrigin(x - POST_W / 2, y - POST_W / 2, POST_W);
    const faces = projectBox(col, row, POST_W, SHELL_H * 0.22, rotZ, tiltX, scale);
    return faces.map((f, fi) => ({
      key: `pylon-${i}-${f.face}-${fi}`,
      depth: f.depth,
      points: toSvgPoints(f.points, originX, originY),
      face: f.face,
    }));
  }).flat();
  pylons.sort((a, b) => a.depth - b.depth);

  return (
    <g aria-hidden="true">
      {deckEdges.map((edge) => (
        <polygon
          key={`deck-${edge.i}`}
          points={edge.points}
          fill="#081018"
          stroke="rgba(14,165,233,0.18)"
          strokeWidth="0.8"
        />
      ))}
      <polygon
        points={toSvgPoints(topCorners, originX, originY)}
        fill="#0a1628"
        stroke="none"
      />
      <polygon
        points={toSvgPoints(topCorners, originX, originY)}
        fill="none"
        stroke="rgba(56,189,248,0.7)"
        strokeWidth="2.4"
      />
      <polygon
        points={toSvgPoints(topCorners, originX, originY)}
        fill="none"
        stroke="rgba(125,211,252,0.28)"
        strokeWidth="7"
        opacity="0.7"
      />
      {dockPoly ? (
        <g>
          <polygon points={dockPoly} fill="#10233d" opacity="0.92" />
          <polygon points={dockPoly} fill="none" stroke="#38BDF8" strokeWidth="1.4" opacity="0.55" />
        </g>
      ) : null}
      {(aisles || []).map((aisle, i) => {
        const col = Number(aisle.col);
        const fromRow = Number(aisle.fromRow ?? 1);
        const toRow = Number(aisle.toRow ?? rowCount - 1);
        if (!Number.isFinite(col)) return null;
        const poly = projectRect(
          col * CELL_SIZE + CELL_SIZE * 0.32,
          fromRow * CELL_SIZE,
          (col + 1) * CELL_SIZE - CELL_SIZE * 0.32,
          (toRow + 1) * CELL_SIZE,
          0.8
        );
        return (
          <polygon
            key={`aisle-3d-${i}`}
            points={poly}
            fill="#F59E0B"
            opacity="0.22"
          />
        );
      })}
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="rgba(56,189,248,0.35)"
          strokeWidth="1"
          opacity={line.opacity}
        />
      ))}
      {pylons.map((p) => (
        <polygon
          key={p.key}
          points={p.points}
          fill={p.face === "top" ? "#38BDF8" : p.face === "front" ? "#164e75" : "#0c4a6e"}
          stroke="rgba(125,211,252,0.45)"
          strokeWidth="0.7"
        />
      ))}
    </g>
  );
}

function PathMotionTrail({ d, className = "patrol-trail-glow" }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="url(#warehouse-trail-gradient)"
      strokeWidth="7"
      strokeLinecap="round"
      opacity="0.35"
      filter="url(#warehouse-trail-blur)"
      className={className}
      strokeDasharray="18 90"
    />
  );
}

/** Arc de transfert (départ → arrivée) avec légère courbure. */
function buildTransferArcPath(x0, y0, x1, y1) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const lift = Math.min(48, Math.max(18, len * 0.18));
  const cx = mx - (dy / len) * lift;
  const cy = my + (dx / len) * lift;
  return `M${x0},${y0} Q${cx},${cy} ${x1},${y1}`;
}

function TransferTraceSvg({
  fromGrid,
  toGrid,
  fromId,
  toId,
  reduceMotion,
  rotZ,
  tiltX,
  zoom,
  originX,
  originY,
  cols,
}) {
  if (!fromGrid || !toGrid) return null;

  const scale = zoom * PROJ_SCALE_FACTOR;
  const fromCenter = cellWorldCenter(fromGrid.x, fromGrid.y, cols);
  const toCenter = cellWorldCenter(toGrid.x, toGrid.y, cols);

  const p0 = project3D(fromCenter.x, fromCenter.y, 4, rotZ, tiltX, scale);
  const p1 = project3D(toCenter.x, toCenter.y, 4, rotZ, tiltX, scale);

  const x0 = p0.sx + originX;
  const y0 = p0.sy + originY;
  const x1 = p1.sx + originX;
  const y1 = p1.sy + originY;
  const pathD = buildTransferArcPath(x0, y0, x1, y1);
  const pathId = `transfer-path-${fromId}-${toId}`;
  const motionDur = "3.2s";
  const pathOpacity = 0.55;
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;

  const halos = [fromGrid, toGrid].map((g, i) => {
    const origin = boxWorldOrigin(g.x, g.y, cols);
    const corners = [
      [origin.x - 4, origin.y - 4, 2],
      [origin.x + BOX_SIZE + 4, origin.y - 4, 2],
      [origin.x + BOX_SIZE + 4, origin.y + BOX_SIZE + 4, 2],
      [origin.x - 4, origin.y + BOX_SIZE + 4, 2],
    ].map((p) => project3D(p[0], p[1], p[2], rotZ, tiltX, scale));
    return { key: i, points: toSvgPoints(corners, originX, originY) };
  });

  return (
    <g pointerEvents="none">
      <path
        id={pathId}
        d={pathD}
        fill="none"
        stroke="#0EA5E9"
        strokeWidth="2.2"
        strokeDasharray="6 8"
        strokeLinecap="round"
        opacity={pathOpacity}
        className={!reduceMotion ? "transfer-path-flow" : ""}
      />
      {!reduceMotion && <PathMotionTrail d={pathD} className="transfer-trail-glow" />}
      {halos.map((h) => (
        <polygon
          key={h.key}
          points={h.points}
          fill="none"
          stroke="#378ADD"
          strokeWidth="2"
          opacity={0.75}
          className={!reduceMotion ? "warehouse-face-highlight" : ""}
        />
      ))}
      {!reduceMotion ? (
        <g>
          <circle r="7" fill="#0EA5E9" opacity="0.28" filter="url(#warehouse-selected-glow)">
            <animateMotion dur={motionDur} repeatCount="indefinite">
              <mpath href={`#${pathId}`} xlinkHref={`#${pathId}`} />
            </animateMotion>
          </circle>
          <circle r="3.4" fill="#F8FAFC" stroke="#0EA5E9" strokeWidth="1.4">
            <animateMotion dur={motionDur} repeatCount="indefinite">
              <mpath href={`#${pathId}`} xlinkHref={`#${pathId}`} />
            </animateMotion>
          </circle>
        </g>
      ) : (
        <circle cx={midX} cy={midY} r="4" fill="#0EA5E9" />
      )}
    </g>
  );
}

function BoxShadowsSvg({ placedEmplacements, cols, rotZ, tiltX, zoom, originX, originY }) {
  const scale = zoom * PROJ_SCALE_FACTOR;
  const pools = placedEmplacements.map(({ empl, gridX, gridY }) => {
    const { x, y } = boxWorldOrigin(gridX, gridY, cols);
    const p = project3D(x + BOX_SIZE / 2, y + BOX_SIZE / 2, 0.8, rotZ, tiltX, scale);
    const r = normalizeOccupationRatio(empl);
    const color = occupationColorVivid(empl);
    return {
      key: `${gridX}-${gridY}`,
      cx: p.sx + originX,
      cy: p.sy + originY,
      depth: p.depth,
      color,
      empty: r <= 0.02,
      intensity: 0.18 + r * 0.42,
    };
  });
  pools.sort((a, b) => a.depth - b.depth);

  return (
    <g aria-hidden="true">
      {pools.map((s) => (
        <g key={s.key}>
          <ellipse
            cx={s.cx}
            cy={s.cy + 6}
            rx={BOX_SIZE * 0.55 * scale * 0.46}
            ry={BOX_SIZE * 0.22 * scale * 0.46}
            fill="rgba(2,6,23,0.55)"
            filter="url(#warehouse-shadow-blur)"
          />
          <ellipse
            cx={s.cx}
            cy={s.cy}
            rx={BOX_SIZE * 0.48 * scale * 0.46}
            ry={BOX_SIZE * 0.18 * scale * 0.46}
            fill={s.empty ? "rgba(56,189,248,0.12)" : hexToRgba(s.color, s.intensity)}
            filter="url(#warehouse-glow-blur)"
          />
        </g>
      ))}
    </g>
  );
}

function faceStrokeStyle(face, highlighted, selected, rank) {
  if (highlighted && rank === 1 && face === "top") {
    return { stroke: "#FBBF24", strokeWidth: 3, strokeDasharray: "5 3" };
  }
  if (highlighted) {
    return { stroke: "#ffffff", strokeWidth: 2, strokeDasharray: undefined };
  }
  if (selected) {
    return { stroke: "var(--accent-primary)", strokeWidth: 2.2, strokeDasharray: undefined };
  }
  return { stroke: "rgba(255,255,255,0.42)", strokeWidth: 1, strokeDasharray: undefined };
}

function DefaultTooltip({ emplacement, rank }) {
  if (!emplacement) return null;
  return (
    <>
      <p className="font-mono text-xs font-semibold text-[var(--text-primary)]">{emplacement.code}</p>
      {emplacement.libelle && (
        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{emplacement.libelle}</p>
      )}
      <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
        Occupation : {Number(emplacement.occupationRatio || 0).toFixed(0)}%
      </p>
      {emplacement.distanceQuai != null && (
        <p className="text-[11px] text-[var(--text-muted)]">Distance quai : {emplacement.distanceQuai}</p>
      )}
      {rank != null && (
        <p className="mt-1 text-[10px] font-medium text-[var(--accent-primary)]">Suggestion IA #{rank}</p>
      )}
    </>
  );
}

export function WarehouseSceneLegend({ variant = "occupation" }) {
  if (variant === "suggestion") {
    return (
      <div className="flex flex-wrap items-center gap-3 px-1 text-[10px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEGEND_COLORS.low }} />
          Peu occupé (0–50%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEGEND_COLORS.mid }} />
          Occupation moyenne (50–80%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEGEND_COLORS.high }} />
          Presque plein (80–100%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span
              className="warehouse-face-highlight absolute inset-0 rounded-full border-2 border-dashed"
              style={{ borderColor: LEGEND_COLORS.mid }}
            />
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: LEGEND_COLORS.mid }} />
          </span>
          1er choix IA
        </span>
      </div>
    );
  }
  return null;
}

export default function Warehouse3DScene({
  emplacements = [],
  highlightedIds = [],
  highlightRanks = {},
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
  renderTooltip,
  zoom: controlledZoom,
  onZoomChange,
  sceneHeight = 760,
  emptyLabel = "Aucun emplacement à afficher",
  transferFrom = null,
  transferTo = null,
  transferActive = false,
  autoRotateDefault = false,
  layoutHints = null,
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [rotZ, setRotZ] = useState(DEFAULT_ROT_Z);
  const [tiltX, setTiltX] = useState(DEFAULT_TILT_X);
  const [autoRotate, setAutoRotate] = useState(() => Boolean(autoRotateDefault));
  const [internalZoom, setInternalZoom] = useState(1);
  const [sceneOrigin, setSceneOrigin] = useState({ x: VIEW_W / 2, y: VIEW_H / 2 });
  const [isDragging, setIsDragging] = useState(false);
  const [hovered, setHovered] = useState(null);
  const dragState = useRef(null);
  const dragMovedRef = useRef(false);
  const rafRef = useRef(null);
  const framingKeyRef = useRef("");

  const zoom = controlledZoom ?? internalZoom;
  const setZoom = useCallback(
    (value) => {
      const next = typeof value === "function" ? value(zoom) : value;
      if (onZoomChange) onZoomChange(next);
      else setInternalZoom(next);
    },
    [onZoomChange, zoom]
  );

  const highlightSet = useMemo(() => new Set(highlightedIds.map((id) => normalizeEmplId(id))), [highlightedIds]);
  const { cols: gridCols, rows: gridRows } = useMemo(() => {
    const MAX = 48;
    const hasPos = emplacements.some((e) => e.col != null && e.row != null);
    if (hasPos) {
      const maxCol = Math.max(0, ...emplacements.map((e) => Number(e.col) || 0));
      const maxRow = Math.max(0, ...emplacements.map((e) => Number(e.row) || 0));
      return {
        cols: Math.min(MAX, Math.max(1, Math.min(maxCol, MAX) + 1, Number(layoutHints?.cols) || 0)),
        rows: Math.min(MAX, Math.max(1, Math.min(maxRow, MAX) + 1, Number(layoutHints?.rows) || 0)),
      };
    }
    const fallback = computeSceneGrid(emplacements.length);
    return {
      cols: Math.min(MAX, fallback.cols),
      rows: Math.min(MAX, fallback.rows || fallback.cols),
    };
  }, [emplacements, layoutHints]);

  const placedEmplacements = useMemo(
    () =>
      emplacements.map((empl, index) => {
        const grid = gridPosition(empl, index, gridCols);
        return {
          empl,
          index,
          gridX: Math.min(gridCols, Math.max(1, Number(grid.x) || 1)),
          gridY: Math.min(gridRows, Math.max(1, Number(grid.y) || 1)),
        };
      }),
    [emplacements, gridCols, gridRows]
  );

  const transferFromGrid = useMemo(() => {
    if (transferFrom == null) return null;
    const found = placedEmplacements.find((p) => sameEmplId(emplacementId(p.empl), transferFrom));
    return found ? { x: found.gridX, y: found.gridY } : null;
  }, [placedEmplacements, transferFrom]);

  const transferToGrid = useMemo(() => {
    if (transferTo == null) return null;
    const found = placedEmplacements.find((p) => sameEmplId(emplacementId(p.empl), transferTo));
    return found ? { x: found.gridX, y: found.gridY } : null;
  }, [placedEmplacements, transferTo]);

  const showSuggestionTransfer = Boolean(
    transferActive &&
      transferFrom != null &&
      transferTo != null &&
      transferFromGrid &&
      transferToGrid &&
      !sameEmplId(transferFrom, transferTo)
  );

  const sceneData = useMemo(() => {
    const allFaces = [];
    const hitAreas = [];
    const topShines = [];
    const beams = [];
    const kindRank = { fill: 0, post: 1, glass: 2 };

    for (const { empl, gridX, gridY } of placedEmplacements) {
      const id = emplacementId(empl);
      const normId = normalizeEmplId(id);
      const spec = stackSpec(empl.occupationRatio);
      const color = occupationColorVivid(empl);
      const { col, row } = worldColRow(gridX, gridY, gridCols);
      const highlighted = normId != null && highlightSet.has(normId);
      const selected = sameEmplId(selectedId, id) || sameEmplId(hoveredId, id);
      const rank = normId != null ? highlightRanks[id] ?? highlightRanks[normId] : undefined;
      const origin = boxWorldOrigin(gridX, gridY, gridCols);
      const innerS = BOX_SIZE * 0.78;
      const innerPad = (BOX_SIZE - innerS) / 2;
      const inner = worldSizeOrigin(origin.x + innerPad, origin.y + innerPad, innerS);

      for (let li = 0; li < spec.layers; li++) {
        const z0 = li * (spec.layerH + spec.gap);
        const layerColor = spec.empty
          ? hslToHex(210, 18, 32)
          : adjustLightness(color, 0.8 + (li / Math.max(1, spec.layers - 1)) * 0.28);
        const faces = projectBox(inner.col, inner.row, innerS, spec.layerH, rotZ, tiltX, zoom * PROJ_SCALE_FACTOR, z0);
        faces.forEach((f) => {
          allFaces.push({
            ...f,
            color: layerColor,
            kind: "fill",
            emplacement: empl,
            emplId: id,
            highlighted,
            selected,
            rank,
            gridX,
            gridY,
            layer: li,
          });
        });

        if (li === spec.layers - 1) {
          const topFace = faces.find((f) => f.face === "top");
          if (topFace) {
            topShines.push({
              emplId: id,
              points: insetFacePoints(topFace.points, 0.46),
              depth: topFace.depth,
              selected,
              color,
            });
          }
        }
      }

      const glass = projectBox(col, row, BOX_SIZE, SHELL_H, rotZ, tiltX, zoom * PROJ_SCALE_FACTOR);
      glass.forEach((f) => {
        allFaces.push({
          ...f,
          color: "#7dd3fc",
          kind: "glass",
          emplacement: empl,
          emplId: id,
          highlighted,
          selected,
          rank,
          gridX,
          gridY,
          layer: 0,
        });
      });
      const glassTop = glass.find((f) => f.face === "top");
      const glassFront = glass.find((f) => f.face === "front");
      [glassTop, glassFront].forEach((face) => {
        if (!face) return;
        hitAreas.push({
          empl,
          emplId: id,
          points: face.points,
          depth: face.depth,
          highlighted,
          selected,
          rank,
        });
      });

      const postOff = [
        [0, 0],
        [BOX_SIZE - POST_W, 0],
        [BOX_SIZE - POST_W, BOX_SIZE - POST_W],
        [0, BOX_SIZE - POST_W],
      ];
      postOff.forEach(([dx, dy], pi) => {
        const pos = worldSizeOrigin(origin.x + dx, origin.y + dy, POST_W);
        const faces = projectBox(pos.col, pos.row, POST_W, SHELL_H, rotZ, tiltX, zoom * PROJ_SCALE_FACTOR);
        faces.forEach((f) => {
          allFaces.push({
            ...f,
            color: f.face === "top" ? "#38bdf8" : "#1e3a5f",
            kind: "post",
            emplacement: empl,
            emplId: `${id}-p${pi}`,
            highlighted,
            selected,
            rank,
            gridX,
            gridY,
            layer: pi,
          });
        });
      });

      const topC = boxTopCenter(gridX, gridY, SHELL_H, gridCols, rotZ, tiltX, zoom);
      const lightC = boxTopCenter(gridX, gridY, SHELL_H + 42, gridCols, rotZ, tiltX, zoom);
      beams.push({
        id,
        x0: lightC.sx,
        y0: lightC.sy,
        x1: topC.sx,
        y1: topC.sy,
        color,
        selected,
      });
    }

    allFaces.sort((a, b) => a.depth - b.depth || kindRank[a.kind] - kindRank[b.kind]);
    hitAreas.sort((a, b) => b.depth - a.depth);
    topShines.sort((a, b) => a.depth - b.depth);

    return { allFaces, hitAreas, topShines, beams };
  }, [placedEmplacements, gridCols, rotZ, tiltX, zoom, highlightSet, highlightRanks, selectedId, hoveredId]);

  const applyAutoFrame = useCallback(() => {
    const frame = computeAutoFrame(placedEmplacements, gridCols, DEFAULT_ROT_Z, DEFAULT_TILT_X, gridRows);
    setSceneOrigin({ x: frame.originX, y: frame.originY });
    if (controlledZoom == null) {
      setInternalZoom(frame.zoom);
    } else if (onZoomChange) {
      // Keep controlled zoom aligned with framing so the scene is centered correctly
      onZoomChange(frame.zoom);
    }
  }, [placedEmplacements, gridCols, gridRows, controlledZoom, onZoomChange]);

  useEffect(() => {
    if (!placedEmplacements.length) return;
    const key = `${emplacements.length}-${gridCols}-${gridRows}`;
    if (framingKeyRef.current === key) return;
    framingKeyRef.current = key;
    if (isDragging) return;
    applyAutoFrame();
  }, [emplacements.length, gridCols, placedEmplacements, isDragging, applyAutoFrame]);

  useEffect(() => {
    if (!autoRotate || reduceMotion) return undefined;
    let last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setRotZ((r) => r + dt * 4.2);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoRotate, reduceMotion]);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("button, [data-warehouse-controls], a, input, select, textarea")) return;
      setAutoRotate(false);
      dragMovedRef.current = false;
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRotZ: rotZ,
        startTiltX: tiltX,
      };
      setIsDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [rotZ, tiltX]
  );

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMovedRef.current = true;
    setRotZ(dragState.current.startRotZ + dx * 0.4);
    setTiltX(Math.min(80, Math.max(20, dragState.current.startTiltX - dy * 0.3)));
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!dragState.current) return;
    dragState.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) => Math.min(2.25, Math.max(0.55, +(z + delta).toFixed(3))));
    },
    [setZoom]
  );

  const handleHover = useCallback(
    (empl) => {
      setHovered(empl);
      onHover?.(empl);
    },
    [onHover]
  );

  const handleBoxClick = useCallback(
    (empl) => {
      if (dragMovedRef.current) return;
      onSelect?.(empl);
    },
    [onSelect]
  );

  const activeHover = hovered;
  const hoverId = activeHover ? emplacementId(activeHover) : null;
  const activeRank = hoverId != null ? highlightRanks[hoverId] : undefined;

  if (!emplacements.length) {
    return <p className="py-12 text-center text-sm text-[var(--text-muted)]">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      <div
        className={`warehouse-scene-shell relative overflow-hidden rounded-[28px] border border-[var(--border-default)] ${
          reduceMotion ? "" : "warehouse-scene-enter"
        }`}
        style={{
          height: sceneHeight,
          background:
            "radial-gradient(ellipse 78% 52% at 50% 8%, rgba(56,189,248,0.22), transparent 58%), linear-gradient(180deg, #050d18 0%, #0B1F3A 46%, #06101c 100%)",
          boxShadow: "0 36px 70px -34px rgba(5, 13, 24, 0.85), inset 0 1px 0 rgba(255,255,255,0.08)",
          borderColor: "color-mix(in srgb, #38BDF8 42%, var(--border-default))",
        }}
      >
        <span className="map-hud-corner map-hud-tl" style={{ borderColor: "rgba(56,189,248,0.5)" }} />
        <span className="map-hud-corner map-hud-tr" style={{ borderColor: "rgba(56,189,248,0.5)" }} />
        <span className="map-hud-corner map-hud-bl" style={{ borderColor: "rgba(56,189,248,0.5)" }} />
        <span className="map-hud-corner map-hud-br" style={{ borderColor: "rgba(56,189,248,0.5)" }} />
        <div className="pointer-events-none absolute inset-0 warehouse-scene-grid-overlay opacity-50" />
        {!reduceMotion && <div className="pointer-events-none absolute inset-0 warehouse-scene-scan" />}
        <div
          className="absolute inset-0"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            xmlnsXlink="http://www.w3.org/1999/xlink"
            className="h-full w-full"
            style={{ cursor: isDragging ? "grabbing" : onSelect ? "grab" : "default" }}
            role="img"
            aria-label="Vue isométrique de l'entrepôt"
          >
            <defs>
              <filter id="warehouse-shadow-blur" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
              <filter id="warehouse-glow-blur" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="6.5" />
              </filter>
              <filter id="warehouse-trail-blur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
              <filter id="warehouse-selected-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="warehouse-trail-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0" />
                <stop offset="70%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.55" />
              </linearGradient>
              <radialGradient
                id="warehouse-scene-halo"
                cx={sceneOrigin.x}
                cy={sceneOrigin.y}
                r="560"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
                <stop offset="45%" stopColor="var(--accent-primary)" stopOpacity="0.07" />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <SceneHaloBackground />

            <FloorGridSvg
              rotZ={rotZ}
              tiltX={tiltX}
              zoom={zoom}
              originX={sceneOrigin.x}
              originY={sceneOrigin.y}
              cols={gridCols}
              rows={gridRows}
              dock={layoutHints?.dock}
              aisles={layoutHints?.aisles}
            />

            <BoxShadowsSvg
              placedEmplacements={placedEmplacements}
              cols={gridCols}
              rotZ={rotZ}
              tiltX={tiltX}
              zoom={zoom}
              originX={sceneOrigin.x}
              originY={sceneOrigin.y}
            />

            {sceneData.allFaces.map((f, i) => {
              const isGlass = f.kind === "glass";
              const isPost = f.kind === "post";
              const strokeStyle = isGlass
                ? {
                    stroke: f.selected || f.highlighted ? "#F8FAFC" : "rgba(125,211,252,0.55)",
                    strokeWidth: f.selected ? 2.2 : 1.15,
                    strokeDasharray: undefined,
                  }
                : faceStrokeStyle(f.face, f.highlighted, f.selected, f.rank);
              const breatheClass =
                f.rank === 1 && f.highlighted && f.face === "top" && f.kind === "fill" && !reduceMotion
                  ? "warehouse-rank1-breathe"
                  : "";
              const selectedClass =
                f.selected && f.kind === "fill" && !reduceMotion ? "warehouse-selected-pulse" : "";
              return (
                <polygon
                  key={`face-${f.kind}-${f.emplId}-${f.face}-${f.layer ?? 0}-${i}`}
                  points={toSvgPoints(f.points, sceneOrigin.x, sceneOrigin.y)}
                  fill={isGlass ? "#7dd3fc" : faceShade(f.color, f.face)}
                  fillOpacity={isGlass ? (f.selected ? 0.12 : 0.055) : isPost ? 0.96 : 1}
                  stroke={strokeStyle.stroke}
                  strokeWidth={isPost ? 0.6 : strokeStyle.strokeWidth}
                  strokeDasharray={strokeStyle.strokeDasharray}
                  filter={f.selected && f.kind === "fill" ? "url(#warehouse-selected-glow)" : undefined}
                  className={`${f.highlighted && !reduceMotion && f.rank !== 1 && f.kind === "fill" ? "warehouse-face-highlight" : ""} ${breatheClass} ${selectedClass}`.trim()}
                />
              );
            })}

            {sceneData.topShines.map((s, i) => (
              <polygon
                key={`shine-${s.emplId}-${i}`}
                points={toSvgPoints(s.points, sceneOrigin.x, sceneOrigin.y)}
                fill={s.selected ? "rgba(255,255,255,0.42)" : hexToRgba(s.color || "#ffffff", 0.22)}
                stroke="none"
                pointerEvents="none"
              />
            ))}

            {sceneData.beams.map((b) => (
              <g key={`beam-${b.id}`} pointerEvents="none" opacity={b.selected ? 0.7 : 0.42}>
                <line
                  x1={b.x0 + sceneOrigin.x}
                  y1={b.y0 + sceneOrigin.y}
                  x2={b.x1 + sceneOrigin.x}
                  y2={b.y1 + sceneOrigin.y}
                  stroke={b.color}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle
                  cx={b.x0 + sceneOrigin.x}
                  cy={b.y0 + sceneOrigin.y}
                  r="3.4"
                  fill="#F8FAFC"
                  stroke={b.color}
                  strokeWidth="1.2"
                />
              </g>
            ))}

            {placedEmplacements.map(({ empl, gridX, gridY }) => {
              const id = emplacementId(empl);
              const labelCenter = boxTopCenter(gridX, gridY, SHELL_H + 8, gridCols, rotZ, tiltX, zoom);
              const badgeCenter = boxTopCenter(gridX, gridY, SHELL_H + BADGE_LIFT, gridCols, rotZ, tiltX, zoom);
              const rank = highlightRanks[id] ?? highlightRanks[normalizeEmplId(id)];
              const occPct = Math.round(normalizeOccupationRatio(empl) * 100);
              const accent = occupationColorVivid(empl);
              const lx = labelCenter.sx + sceneOrigin.x;
              const ly = labelCenter.sy + sceneOrigin.y - 8;
              const code = (empl.code || "—").slice(0, 8);
              const cardW = Math.max(78, 10 + code.length * 7.2);

              return (
                <g key={`label-${id ?? `${gridX}-${gridY}`}`} pointerEvents="none">
                  <rect
                    x={lx - cardW / 2}
                    y={ly - 22}
                    width={cardW}
                    height={40}
                    rx={12}
                    fill="rgba(7,17,31,0.82)"
                    stroke={accent}
                    strokeWidth="1.4"
                    filter="url(#warehouse-selected-glow)"
                  />
                  <rect
                    x={lx - cardW / 2}
                    y={ly - 22}
                    width={cardW}
                    height={3}
                    rx={2}
                    fill={accent}
                  />
                  <text
                    x={lx}
                    y={ly - 6}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="11"
                    fontWeight="800"
                    fill="#F8FAFC"
                    letterSpacing="0.4"
                  >
                    {code}
                  </text>
                  <text
                    x={lx}
                    y={ly + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="13"
                    fontWeight="800"
                    fill={accent}
                  >
                    {occPct}%
                  </text>
                  {empl.zoneDangereuse && (
                    <text x={lx + cardW / 2 + 6} y={ly - 4} fontSize="13">
                      ⚠
                    </text>
                  )}
                  {rank != null && (
                    <g>
                      <circle
                        cx={badgeCenter.sx + sceneOrigin.x}
                        cy={badgeCenter.sy + sceneOrigin.y}
                        r="12"
                        fill={rank === 1 ? "#FBBF24" : "var(--accent-primary)"}
                        stroke={rank === 1 ? "#D97706" : "none"}
                        strokeWidth={rank === 1 ? 1.5 : 0}
                      />
                      <text
                        x={badgeCenter.sx + sceneOrigin.x}
                        y={badgeCenter.sy + sceneOrigin.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12"
                        fontWeight="700"
                        fill={rank === 1 ? "#0f172a" : "var(--text-inverse)"}
                      >
                        {rank}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {sceneData.hitAreas.map((hit, i) => {
              const occPct = (normalizeOccupationRatio(hit.empl) * 100).toFixed(0);
              return (
                <polygon
                  key={`hit-${hit.emplId}-${i}`}
                  points={toSvgPoints(hit.points, sceneOrigin.x, sceneOrigin.y)}
                  fill="transparent"
                  stroke="none"
                  style={{ cursor: onSelect ? "pointer" : "default" }}
                  onClick={() => handleBoxClick(hit.empl)}
                  onPointerEnter={() => handleHover(hit.empl)}
                  onPointerLeave={() => handleHover(null)}
                >
                  <title>{`${hit.empl.code || "Emplacement"} — ${occPct}% occupé`}</title>
                </polygon>
              );
            })}

            {showSuggestionTransfer ? (
              <TransferTraceSvg
                fromGrid={transferFromGrid}
                toGrid={transferToGrid}
                fromId={transferFrom}
                toId={transferTo}
                reduceMotion={reduceMotion}
                rotZ={rotZ}
                tiltX={tiltX}
                zoom={zoom}
                originX={sceneOrigin.x}
                originY={sceneOrigin.y}
                cols={gridCols}
              />
            ) : null}
          </svg>
        </div>

        {activeHover && (
          <div
            className="pointer-events-none absolute left-5 top-5 z-20 max-w-[280px] overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-950/85 px-4 py-3 shadow-[0_20px_40px_-18px_rgba(0,0,0,0.65)] backdrop-blur-md animate-fadeUp"
            role="tooltip"
          >
            {renderTooltip ? (
              renderTooltip(activeHover, activeRank)
            ) : (
              <DefaultTooltip emplacement={activeHover} rank={activeRank} />
            )}
          </div>
        )}

        <div
          data-warehouse-controls
          className="absolute bottom-3 right-3 z-30 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-modal)]/90 p-1.5 shadow-[var(--shadow-dropdown)] backdrop-blur-md"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {!reduceMotion && (
            <button
              type="button"
              className={CTRL_BTN}
              onClick={(e) => {
                e.stopPropagation();
                setAutoRotate((v) => !v);
              }}
            >
              {autoRotate ? "⏸ Pause rotation" : "▶ Rotation auto"}
            </button>
          )}
          <button
            type="button"
            className={CTRL_BTN}
            onClick={(e) => {
              e.stopPropagation();
              setRotZ(DEFAULT_ROT_Z);
              setTiltX(DEFAULT_TILT_X);
              setAutoRotate(false);
              framingKeyRef.current = "";
              applyAutoFrame();
            }}
          >
            ↺ Réinitialiser
          </button>
          <button
            type="button"
            className={CTRL_BTN}
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => Math.min(2.25, z + 0.15));
            }}
          >
            +
          </button>
          <button
            type="button"
            className={CTRL_BTN}
            onClick={(e) => {
              e.stopPropagation();
              setZoom((z) => Math.max(0.5, z - 0.15));
            }}
          >
            −
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-col gap-1">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-cyan-400/25 bg-slate-950/70 px-2.5 py-1 text-[10px] font-medium text-sky-100/80 backdrop-blur-sm">
            <span className="slotting-pulse-dot h-1.5 w-1.5 rounded-full bg-sky-400" />
            Glisser pour orbiter · molette pour zoomer
          </span>
          <span className="text-[10px] text-sky-100/45">Cage = capacité · volume intérieur = occupation</span>
        </div>
      </div>
    </div>
  );
}
