/**
 * "Dolcetto o scherzetto": dal 15 al 31 ottobre ogni km senza auto vale una
 * caramella. Funzioni pure.
 */
import { legCo2 } from './co2';
import type { Trip } from './scoring';

/** Inizio e fine (esclusa) della raccolta dell'anno di `now`, ora locale. */
export function candySeason(now: number): { from: number; to: number } {
  const year = new Date(now).getFullYear();
  return { from: new Date(year, 9, 15).getTime(), to: new Date(year, 10, 1).getTime() };
}

/** Metri validi senza auto (gli stessi che contano per la CO₂) di un tragitto. */
export function candyMeters(trip: Pick<Trip, 'legs'>): number {
  return trip.legs.reduce((sum, leg) => sum + (legCo2(leg) > 0 ? leg.meters : 0), 0);
}

/** Caramelle raccolte: un km intero senza auto, una caramella. */
export function candies(trips: readonly Trip[], now: number): number {
  const { from, to } = candySeason(now);
  const meters = trips.filter((t) => t.endedAt >= from && t.endedAt < to).reduce((sum, t) => sum + candyMeters(t), 0);
  return Math.floor(meters / 1000 + 1e-9);
}

export function candyOpen(now: number): boolean {
  const { from, to } = candySeason(now);
  return now >= from && now < to;
}
