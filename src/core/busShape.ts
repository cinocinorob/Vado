/**
 * Riconoscere un viaggio in bus o in tram dal percorso, senza il tempo reale:
 * la traccia del telefono passa accanto alle fermate di una linea, una dopo
 * l'altra nell'ordine giusto, a velocità da mezzo. Funzioni pure.
 *
 * Serve quando il flusso in tempo reale non risponde o la posizione del bus
 * è vecchia: il percorso della linea si conosce, quindi basta la traccia.
 * Non distingue un'auto che segue la stessa strada: per questo l'esito è
 * "linea riconosciuta dal percorso", più debole del bus in tempo reale.
 */
import type { BusNetwork } from './bus';
import type { Sample } from './busMatch';
import { haversineM } from './geo';

/** Una fermata conta come "passata" se il telefono è passato entro questa distanza. */
export const SHAPE_STOP_M = 70;
/** Fermate della stessa linea, in ordine, che servono per riconoscerla. */
export const SHAPE_MIN_STOPS = 3;
/** Strada minima lungo la linea. */
export const SHAPE_MIN_M = 500;
/** Più veloce di una camminata svelta, fermate comprese (7 km/h). */
export const SHAPE_MIN_MS = 1.9;

export type ShapeMatch = { line: string; routeId: string; tram: boolean; from: string; to: string; meters: number; stops: number; fromT: number; toT: number };

/** Fermate consecutive della linea che si possono saltare (il GPS non arriva, il bus non si ferma). */
export const SHAPE_MAX_SKIP = 4;

function pathBetween(samples: readonly Sample[], from: number, to: number): number {
  let m = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1].t >= from && samples[i].t <= to) m += haversineM(samples[i - 1], samples[i]);
  }
  return m;
}

const CELL = 0.002;
type Grid = Map<string, number[]>;
const grids = new WeakMap<BusNetwork, Grid>();

function gridOf(net: BusNetwork): Grid {
  let grid = grids.get(net);
  if (grid) return grid;
  grid = new Map();
  for (const s of net.stops) {
    const key = `${Math.floor(s.lat / CELL)}:${Math.floor(s.lon / CELL)}`;
    const list = grid.get(key) ?? [];
    list.push(s.index);
    grid.set(key, list);
  }
  grids.set(net, grid);
  return grid;
}

/** Fermate entro `radius` metri da un punto, con la griglia (veloce). */
function stopsAround(net: BusNetwork, lat: number, lon: number, radius: number): number[] {
  const grid = gridOf(net);
  const gy = Math.floor(lat / CELL);
  const gx = Math.floor(lon / CELL);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const i of grid.get(`${gy + dy}:${gx + dx}`) ?? []) {
        const s = net.stops[i];
        if (haversineM({ lat, lon }, s) <= radius) out.push(i);
      }
    }
  }
  return out;
}

/** La linea percorsa, se la traccia ne passa abbastanza fermate in ordine e a velocità da mezzo. */
export function matchBusLine(net: BusNetwork, samples: readonly Sample[]): ShapeMatch | null {
  if (samples.length < 3) return null;
  // Per ogni linea (percorso con capolinea), i passaggi dalle sue fermate: posizione nella sequenza e istante.
  const hits = new Map<number, { pos: number; t: number }[]>();
  for (const s of samples) {
    for (const stop of stopsAround(net, s.lat, s.lon, SHAPE_STOP_M)) {
      for (const [pi, pos] of net.at[stop]) {
        const list = hits.get(pi) ?? [];
        list.push({ pos, t: s.t });
        hits.set(pi, list);
      }
    }
  }
  let best: (ShapeMatch & { score: number }) | null = null;
  for (const [pi, list] of hits) {
    // Sequenze di fermate in ordine crescente nel tempo, una per fermata, con al
    // massimo qualche fermata saltata tra una e l'altra: si tiene la più lunga.
    list.sort((a, b) => a.t - b.t || a.pos - b.pos);
    let chain: { pos: number; t: number }[] = [];
    let current: { pos: number; t: number }[] = [];
    for (const h of list) {
      const last = current[current.length - 1];
      if (last && h.pos === last.pos) continue;
      if (!last || (h.pos > last.pos && h.pos - last.pos <= SHAPE_MAX_SKIP)) current.push(h);
      else if (h.pos > last.pos || h.pos < last.pos) {
        if (current.length > chain.length) chain = current;
        current = [h];
      }
    }
    if (current.length > chain.length) chain = current;
    if (chain.length < SHAPE_MIN_STOPS) continue;
    const p = net.patterns[pi];
    const first = chain[0];
    const last = chain[chain.length - 1];
    const meters = p.meters[last.pos] - p.meters[first.pos];
    const seconds = (last.t - first.t) / 1000;
    // La strada fatta davvero, secondo le posizioni, deve somigliare a quella della linea.
    const walked = pathBetween(samples, first.t, last.t);
    if (meters < SHAPE_MIN_M || seconds <= 0 || walked < meters * 0.5 || walked > meters * 1.8) continue;
    if (Math.min(meters, walked) / seconds < SHAPE_MIN_MS) continue;
    // Le fermate saltate contano poco: un bus non si ferma a tutte, il GPS a volte non arriva.
    const score = chain.length * 1000 + meters / 100;
    if (!best || score > best.score) {
      best = {
        score,
        line: p.line,
        routeId: p.routeId,
        tram: p.tram,
        from: net.stops[p.stops[first.pos]].name,
        to: net.stops[p.stops[last.pos]].name,
        meters,
        stops: last.pos - first.pos,
        fromT: first.t,
        toT: last.t,
      };
    }
  }
  if (!best) return null;
  const { score: _score, ...match } = best;
  return match;
}
