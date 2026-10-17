/** Storico per settimane e mesi. Funzioni pure. */
import { tripCo2 } from './co2';
import type { Trip } from './scoring';
import { monthStart, weekStart } from './social';

export type Period = { start: number; points: number; carFreeMeters: number; co2: number; trips: number };

function sum(trips: readonly Trip[], start: number, end: number): Period {
  const inside = trips.filter((t) => t.endedAt >= start && t.endedAt < end);
  return {
    start,
    points: inside.reduce((s, t) => s + t.total, 0),
    carFreeMeters: inside.reduce((s, t) => s + t.carFreeMeters, 0),
    co2: inside.reduce((s, t) => s + tripCo2(t), 0),
    trips: inside.length,
  };
}

function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Le ultime `count` settimane (da lunedì), dalla più vecchia alla corrente. */
export function weeks(trips: readonly Trip[], now: number, count = 8): Period[] {
  const current = weekStart(now);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(current, -7 * (count - 1 - i));
    return sum(trips, start, addDays(start, 7));
  });
}

/** Gli ultimi `count` mesi, dal più vecchio al corrente. */
export function months(trips: readonly Trip[], now: number, count = 6): Period[] {
  const d = new Date(monthStart(now));
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(d.getFullYear(), d.getMonth() - (count - 1 - i), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() - (count - 1 - i) + 1, 1).getTime();
    return sum(trips, start, end);
  });
}

/** Il giorno con più punti di sempre; null se non ci sono tragitti. */
export function bestDay(trips: readonly Trip[]): { day: string; points: number } | null {
  const byDay = new Map<string, number>();
  for (const t of trips) byDay.set(t.day, (byDay.get(t.day) ?? 0) + t.total);
  let best: { day: string; points: number } | null = null;
  for (const [day, points] of byDay) if (!best || points > best.points || (points === best.points && day > best.day)) best = { day, points };
  return best;
}
