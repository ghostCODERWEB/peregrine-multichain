// A 3D force layout that settles onto a sphere shell, and the rotate +
// perspective projection to draw it. On a sphere, connected wallets form
// caps you can spin toward, and depth carries information colour alone
// could not. No 3D library: at ~100 nodes this is a few thousand float ops
// per frame, which SVG handles comfortably. (Ported from Peregrine.)

export interface Node3 { id: string; x: number; y: number; z: number; r: number }
export interface Edge3 { a: string; b: string; w: number }

export const SPHERE_RADIUS = 165;

export function layout3d(nodes: Node3[], edges: Edge3[], steps = 240): Node3[] {
  const n = nodes.length;
  if (!n) return nodes;
  const R = SPHERE_RADIUS;
  const idx = new Map(nodes.map((v, i) => [v.id, i]));
  // A Fibonacci sphere: an even starting shell, so the simulation has no
  // clumps to undo before it can cluster by connectivity.
  const golden = Math.PI * (3 - Math.sqrt(5));
  nodes.forEach((v, i) => {
    const y = 1 - (i / Math.max(n - 1, 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    v.x = Math.cos(th) * rad * R; v.y = y * R; v.z = Math.sin(th) * rad * R;
  });
  const vx = new Float64Array(n), vy = new Float64Array(n), vz = new Float64Array(n);
  const links = edges.map((e) => ({ a: idx.get(e.a), b: idx.get(e.b), w: e.w }))
    .filter((l): l is { a: number; b: number; w: number } => l.a !== undefined && l.b !== undefined && l.a !== l.b);

  for (let s = 0; s < steps; s++) {
    const cool = 1 - s / steps;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y, dz = nodes[j].z - nodes[i].z;
        let d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1e-6) { dx = (i % 5) - 2; dy = (j % 5) - 2; dz = ((i + j) % 5) - 2; d2 = dx * dx + dy * dy + dz * dz; }
        const d = Math.sqrt(d2);
        const min = nodes[i].r + nodes[j].r + 3;
        let f = 2600 / d2;
        if (d < min) f += (min - d) * 0.5;
        const ux = dx / d, uy = dy / d, uz = dz / d;
        vx[i] -= ux * f; vy[i] -= uy * f; vz[i] -= uz * f;
        vx[j] += ux * f; vy[j] += uy * f; vz[j] += uz * f;
      }
    }
    for (const l of links) {
      const dx = nodes[l.b].x - nodes[l.a].x, dy = nodes[l.b].y - nodes[l.a].y, dz = nodes[l.b].z - nodes[l.a].z;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.01);
      const f = (d - (nodes[l.a].r + nodes[l.b].r + 26)) * 0.02 * Math.min(l.w, 4);
      const ux = dx / d, uy = dy / d, uz = dz / d;
      vx[l.a] += ux * f; vy[l.a] += uy * f; vz[l.a] += uz * f;
      vx[l.b] -= ux * f; vy[l.b] -= uy * f; vz[l.b] -= uz * f;
    }
    for (let i = 0; i < n; i++) {
      const v = nodes[i];
      v.x += Math.max(-14, Math.min(14, vx[i] * cool));
      v.y += Math.max(-14, Math.min(14, vy[i] * cool));
      v.z += Math.max(-14, Math.min(14, vz[i] * cool));
      // Back onto the shell, so the result is a sphere and not a blob.
      const len = Math.hypot(v.x, v.y, v.z) || 1;
      v.x += (v.x / len * R - v.x) * 0.22; v.y += (v.y / len * R - v.y) * 0.22; v.z += (v.z / len * R - v.z) * 0.22;
      vx[i] *= 0.78; vy[i] *= 0.78; vz[i] *= 0.78;
    }
  }
  return nodes;
}

export interface Projected { x: number; y: number; scale: number; depth: number }

/** Rotate by yaw and pitch, then project with a perspective divide. */
export function project(v: { x: number; y: number; z: number }, yaw: number, pitch: number, cx: number, cy: number): Projected {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const x = v.x * cyw - v.z * syw;
  let z = v.x * syw + v.z * cyw;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y = v.y * cp - z * sp;
  z = v.y * sp + z * cp;
  const focal = 620;
  const scale = focal / (focal - z);
  return { x: cx + x * scale, y: cy + y * scale, scale, depth: (z + SPHERE_RADIUS) / (2 * SPHERE_RADIUS) };
}
