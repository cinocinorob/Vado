/**
 * Simulatore di GPS per i test: percorsi veri + errori di misura realistici.
 *
 * Gli errori del GPS non sono rumore bianco. Qui si riproducono i tre tipi che
 * contano: una deriva lenta e correlata nel tempo, salti isolati, e scarti
 * laterali che persistono per qualche minuto (riflessi sui palazzi). Tutto con
 * un seme fisso, così ogni esecuzione dà gli stessi numeri.
 *
 * I parametri dei tre ambienti sono stime ragionevoli, non misure: servono a
 * confrontare varianti del filtro, e vanno corretti con le prove su strada.
 */
import type { Fix } from '../geo';

export const M_PER_DEG_LAT = 111_195;
const LAT0 = 41.9;
const LON0 = 12.5;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);

/** Generatore pseudo-casuale con seme (congruenziale lineare). */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

export type Noise = {
  /** Deviazione standard dell'errore di posizione, in metri. */
  sigma: number;
  /** Correlazione dell'errore tra una lettura e la successiva (0–1). */
  rho: number;
  /** Intervallo dell'incertezza dichiarata dal ricevitore, in metri. */
  accuracy: [number, number];
  /** Probabilità e ampiezza dei salti isolati. */
  outlierP: number;
  outlierM: number;
  /** Probabilità e ampiezza degli scarti che persistono. */
  shiftP: number;
  shiftM: number;
  /** Errore della velocità misurata, in m/s, e probabilità che sia disponibile. */
  speedSigma: number;
  speedP: number;
};

/** Cielo aperto. */
export const OPEN_SKY: Noise = { sigma: 3, rho: 0.97, accuracy: [5, 10], outlierP: 0.005, outlierM: 25, shiftP: 0, shiftM: 0, speedSigma: 0.15, speedP: 1 };
/** Strade di città. */
export const CITY: Noise = { sigma: 6, rho: 0.95, accuracy: [8, 18], outlierP: 0.02, outlierM: 35, shiftP: 0.004, shiftM: 20, speedSigma: 0.3, speedP: 0.95 };
/** Vie strette tra palazzi alti. */
export const CANYON: Noise = { sigma: 12, rho: 0.93, accuracy: [15, 35], outlierP: 0.04, outlierM: 50, shiftP: 0.01, shiftM: 30, speedSigma: 0.6, speedP: 0.8 };
/** Lo stesso ambiente, ma con un ricevitore che non comunica la velocità. */
export const withoutSpeed = (noise: Noise): Noise => ({ ...noise, speedP: 0 });

/** Un punto del percorso vero: posizione in metri e velocità in m/s. */
export type TruePoint = { x: number; y: number; v: number };

/** Trasforma un percorso vero nelle posizioni che il telefono riceverebbe. */
export function observe(truth: TruePoint[], everyS: number, noise: Noise, seed: number): Fix[] {
  const r = rng(seed);
  const k = Math.sqrt(1 - noise.rho * noise.rho);
  let ex = 0;
  let ey = 0;
  let sx = 0;
  let sy = 0;
  return truth.map((p, i) => {
    ex = noise.rho * ex + k * noise.sigma * gauss(r);
    ey = noise.rho * ey + k * noise.sigma * gauss(r);
    if (r() < noise.shiftP) {
      const a = r() * 2 * Math.PI;
      sx = Math.cos(a) * noise.shiftM;
      sy = Math.sin(a) * noise.shiftM;
    } else {
      sx *= 0.98;
      sy *= 0.98;
    }
    let ox = 0;
    let oy = 0;
    if (r() < noise.outlierP) {
      const a = r() * 2 * Math.PI;
      ox = Math.cos(a) * noise.outlierM;
      oy = Math.sin(a) * noise.outlierM;
    }
    const accuracy = noise.accuracy[0] + r() * (noise.accuracy[1] - noise.accuracy[0]);
    // Android riporta 0 quando la velocità non è nota.
    const speed = r() < noise.speedP ? Math.abs(p.v + noise.speedSigma * gauss(r)) : 0;
    return {
      lat: LAT0 + (p.y + ey + sy + oy) / M_PER_DEG_LAT,
      lon: LON0 + (p.x + ex + sx + ox) / M_PER_DEG_LON,
      t: 1_000_000_000 + i * everyS * 1000,
      accuracy,
      speed,
    };
  });
}

/** Telefono fermo per un certo numero di secondi. */
export function still(seconds: number, everyS = 3): TruePoint[] {
  return Array.from({ length: Math.floor(seconds / everyS) }, () => ({ x: 0, y: 0, v: 0 }));
}

/**
 * Percorso a isolati: si avanza di `block` metri e si svolta, alternando.
 * Con `block` = 0 il percorso è rettilineo. Si può aggiungere una sosta di
 * `stopS` secondi ogni `stopEveryM` metri (semafori, fermate).
 */
export function route(
  meters: number,
  speedAt: (i: number) => number,
  opts: { everyS?: number; block?: number; stopEveryM?: number; stopS?: number } = {},
): { points: TruePoint[]; meters: number; seconds: number } {
  const { everyS = 3, block = 0, stopEveryM = 0, stopS = 0 } = opts;
  const points: TruePoint[] = [];
  let x = 0;
  let y = 0;
  let done = 0;
  let north = true;
  let sinceTurn = 0;
  let sinceStop = 0;
  let i = 0;
  while (done < meters) {
    const v = speedAt(i++);
    const step = v * everyS;
    done += step;
    sinceTurn += step;
    sinceStop += step;
    if (north) y += step;
    else x += step;
    points.push({ x, y, v });
    if (block && sinceTurn >= block) {
      north = !north;
      sinceTurn = 0;
    }
    if (stopEveryM && sinceStop >= stopEveryM) {
      for (let s = 0; s < stopS / everyS; s++) points.push({ x, y, v: 0 });
      sinceStop = 0;
    }
  }
  return { points, meters: done, seconds: points.length * everyS };
}

export function summary(values: number[]): { min: number; median: number; p90: number; max: number } {
  const s = [...values].sort((a, b) => a - b);
  return { min: s[0], median: s[Math.floor(s.length / 2)], p90: s[Math.floor(s.length * 0.9)], max: s[s.length - 1] };
}
