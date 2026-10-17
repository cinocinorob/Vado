/**
 * Riconoscere un viaggio in bus confrontando la traccia del telefono con le
 * posizioni dei mezzi in tempo reale. Funzioni pure.
 *
 * Idea: se per qualche minuto il telefono sta sempre a pochi metri dallo
 * stesso bus, mentre entrambi si muovono, si è su quel bus. Un'auto che
 * segue lo stesso bus così a lungo è improbabile; chi aspetta alla fermata
 * non si muove, e viene escluso dalla distanza percorsa.
 */
import { haversineM } from './geo';
import type { Vehicle } from './gtfsrt';

/** Un mezzo vicino al telefono in un certo momento. */
export type Sighting = { id: string; routeId: string; t: number; gapM: number; lat: number; lon: number };
export type Sample = { t: number; lat: number; lon: number };

/** Distanza massima tra telefono e mezzo (errori di entrambi i GPS compresi). */
export const MATCH_M = 90;
/** Quante volte, per quanto tempo e per quanta strada lo stesso mezzo deve stare accanto. */
export const MATCH_MIN_TIMES = 3;
export const MATCH_MIN_S = 150;
export const MATCH_MIN_M = 600;
/** Le posizioni dei mezzi più vecchie di così non servono. */
export const VEHICLE_MAX_AGE_MS = 120_000;

/** Posizione del telefono all'istante t, interpolata tra i campioni; null se t è fuori dalla traccia. */
export function phoneAt(samples: readonly Sample[], t: number): { lat: number; lon: number } | null {
  if (samples.length === 0 || t < samples[0].t - 20_000 || t > samples[samples.length - 1].t + 20_000) return null;
  let i = 1;
  while (i < samples.length && samples[i].t < t) i++;
  if (i >= samples.length) return samples[samples.length - 1];
  const a = samples[i - 1];
  const b = samples[i];
  if (t <= a.t) return a;
  const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
  return { lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k };
}

/** I mezzi del flusso che stavano accanto al telefono quando hanno mandato la posizione. */
export function sightings(vehicles: readonly Vehicle[], samples: readonly Sample[], fetchedAt: number): Sighting[] {
  const out: Sighting[] = [];
  for (const v of vehicles) {
    if (fetchedAt - v.t > VEHICLE_MAX_AGE_MS) continue;
    const phone = phoneAt(samples, v.t);
    if (!phone) continue;
    const gap = haversineM(phone, v);
    if (gap <= MATCH_M) out.push({ id: v.id, routeId: v.routeId, t: v.t, gapM: Math.round(gap), lat: v.lat, lon: v.lon });
  }
  return out;
}

/** Il mezzo su cui si è viaggiato, se le prove bastano. */
export function boardedVehicle(all: readonly Sighting[]): { id: string; routeId: string; times: number; seconds: number; meters: number } | null {
  const byId = new Map<string, Sighting[]>();
  for (const s of all) {
    const list = byId.get(s.id) ?? [];
    // Stessa posizione mandata due volte: conta una.
    if (!list.some((x) => x.t === s.t)) list.push(s);
    byId.set(s.id, list);
  }
  let best: ReturnType<typeof boardedVehicle> = null;
  for (const [id, list] of byId) {
    list.sort((a, b) => a.t - b.t);
    const seconds = (list[list.length - 1].t - list[0].t) / 1000;
    const meters = haversineM(list[0], list[list.length - 1]);
    if (list.length >= MATCH_MIN_TIMES && seconds >= MATCH_MIN_S && meters >= MATCH_MIN_M) {
      if (!best || list.length > best.times) best = { id, routeId: list[list.length - 1].routeId, times: list.length, seconds, meters };
    }
  }
  return best;
}
