/**
 * Le forme della grafica Expressive (in stile Material 3): biscotti a lobi,
 * fiori, quadrifogli, poligoni smussati. Tracciati SVG in un'area 96×96,
 * calcolati una volta all'avvio.
 */

function path(points: [number, number][]): string {
  return 'M' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + 'Z';
}

/** Cerchio ondulato: `n` lobi di ampiezza `a`. */
function lobes(n: number, a: number, R = 44, rot = 0, steps = 240): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const r = R - a + a * Math.cos(n * (t - rot));
    pts.push([48 + r * Math.cos(t - Math.PI / 2), 48 + r * Math.sin(t - Math.PI / 2)]);
  }
  return path(pts);
}

/** Poligono di `n` lati con gli angoli smussati. */
function roundedPolygon(n: number, R = 46, soft = 0.3, steps = 240): string {
  const pts: [number, number][] = [];
  const seg = (2 * Math.PI) / n;
  for (let i = 0; i < steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const u = (t % seg) - seg / 2;
    const poly = Math.cos(seg / 2) / Math.cos(u);
    const r = R * ((1 - soft) * poly + soft * Math.cos(seg / 2) * 1.04);
    pts.push([48 + r * Math.cos(t - Math.PI / 2), 48 + r * Math.sin(t - Math.PI / 2)]);
  }
  return path(pts);
}

export const SHAPES = {
  cookie9: lobes(9, 3.4),
  cookie12: lobes(12, 2.6, 45),
  sunny: lobes(16, 2.2, 46),
  clover4: lobes(4, 8.5, 46, Math.PI / 4),
  flower8: lobes(8, 6.5, 46),
  burst: lobes(10, 5.5, 46),
  cookie6: lobes(6, 4.5, 46),
  hept: roundedPolygon(7, 47),
  pent: roundedPolygon(5, 49, 0.25),
  pill: 'M28 4h40a24 24 0 0 1 24 24v40a24 24 0 0 1-24 24H28A24 24 0 0 1 4 68V28A24 24 0 0 1 28 4Z',
} as const;

export type ShapeId = keyof typeof SHAPES;

/** Linea ondulata da (x0, y) a (x1, y). */
export function waveLine(x0: number, x1: number, y: number, amp = 3, wavelength = 14): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1 + 0.01; x += 0.8) {
    pts.push(`${x.toFixed(1)} ${(y + amp * Math.sin((2 * Math.PI * (x - x0)) / wavelength)).toFixed(1)}`);
  }
  if (pts.length === 1) pts.push(`${x1.toFixed(1)} ${y.toFixed(1)}`);
  return 'M' + pts.join(' L');
}

/** Arco ondulato attorno a (c, c), da mezzogiorno in senso orario, per la frazione `frac`. */
export function waveArc(c: number, r: number, frac: number, amp = 3.2, waves = 16, steps = 360): string {
  const pts: string[] = [];
  const last = Math.max(1, Math.round(steps * Math.min(1, Math.max(0, frac))));
  for (let i = 0; i <= last; i++) {
    const t = (2 * Math.PI * i) / steps;
    const rr = r + amp * Math.sin(waves * t);
    pts.push(`${(c + rr * Math.cos(t - Math.PI / 2)).toFixed(1)} ${(c + rr * Math.sin(t - Math.PI / 2)).toFixed(1)}`);
  }
  return 'M' + pts.join(' L');
}
