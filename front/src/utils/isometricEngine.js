/**
 * Projette un point 3D (x, y, z) en coordonnées écran 2D, selon un angle de
 * rotation horizontal (yaw / rotZ) et une inclinaison verticale (pitch / tiltX).
 * Retourne aussi `depth` pour trier les faces avec l'algorithme du peintre.
 */
export function project3D(x, y, z, rotZdeg, tiltXdeg, scale = 1) {
  const rz = (rotZdeg * Math.PI) / 180;
  const rx = (tiltXdeg * Math.PI) / 180;

  const x1 = x * Math.cos(rz) - y * Math.sin(rz);
  const y1 = x * Math.sin(rz) + y * Math.cos(rz);
  const z1 = z;

  const y2 = y1 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y1 * Math.sin(rx) + z1 * Math.cos(rx);

  return {
    sx: x1 * scale,
    sy: -z2 * scale,
    depth: y2,
  };
}

/** Calcule les 8 sommets 3D d'un pavé (footprint carré de côté `s`, hauteur `h`), positionné à (col, row). */
export function boxVertices(col, row, s, h, z0 = 0) {
  const x0 = col * s;
  const x1 = x0 + s;
  const y0 = row * s;
  const y1 = y0 + s;
  const z1 = z0 + h;
  return {
    b: [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    t: [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
  };
}

/** Construit les 3 faces visibles (top, front, side) sous forme de polygones projetés + profondeur moyenne pour le tri. */
export function projectBox(col, row, s, h, rotZdeg, tiltXdeg, scale, z0 = 0) {
  const v = boxVertices(col, row, s, h, z0);
  const P = (p) => project3D(p[0], p[1], p[2], rotZdeg, tiltXdeg, scale);

  const top = [v.t[0], v.t[1], v.t[2], v.t[3]].map(P);
  const front = [v.b[0], v.b[1], v.t[1], v.t[0]].map(P);
  const side = [v.b[1], v.b[2], v.t[2], v.t[1]].map(P);

  const avgDepth = (pts) => pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;

  return [
    { face: "top", points: top, depth: avgDepth(top) },
    { face: "front", points: front, depth: avgDepth(front) },
    { face: "side", points: side, depth: avgDepth(side) },
  ];
}

export function toSvgPoints(projectedPoints, originX, originY) {
  return projectedPoints.map((p) => `${p.sx + originX},${p.sy + originY}`).join(" ");
}
