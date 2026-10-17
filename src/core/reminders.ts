/** Quando mandare i promemoria. Funzioni pure. */
import { legCo2 } from './co2';
import { activePause, type Pause } from './plant';
import type { Trip } from './scoring';

/** Dopo quanti giorni senza tragitti senza auto si avvisa che la pianta ha sete. */
export const THIRSTY_REMINDER_DAYS = 2;
export const REMINDER_HOUR = 18;
/** Fermi da tanto con un tragitto aperto: forse ci si è dimenticati di premere Termina. */
export const FORGOT_AFTER_MS = 15 * 60 * 1000;

/**
 * Istante del promemoria "la tua pianta ha sete": alle 18 del secondo giorno
 * dopo l'ultimo tragitto senza auto. null se non c'è mai stato un tragitto,
 * se l'istante è già passato o se la pianta è in pausa.
 */
export function thirstyAt(trips: readonly Trip[], now: number, pauses: readonly Pause[], today: string): number | null {
  if (activePause(pauses, today)) return null;
  let last = 0;
  for (const t of trips) if (t.endedAt > last && t.legs.some((l) => legCo2(l) > 0)) last = t.endedAt;
  if (last === 0) return null;
  const d = new Date(last);
  d.setHours(REMINDER_HOUR, 0, 0, 0);
  d.setDate(d.getDate() + THIRSTY_REMINDER_DAYS);
  return d.getTime() > now ? d.getTime() : null;
}

type Standing = { id: string; name: string; points: number; me?: boolean };

/** Chi era dietro e adesso è davanti (per punti). */
export function overtakers(before: readonly Standing[], after: readonly Standing[]): string[] {
  const meBefore = before.find((e) => e.me);
  const meAfter = after.find((e) => e.me);
  if (!meBefore || !meAfter) return [];
  const wasBehind = new Set(before.filter((e) => !e.me && e.points <= meBefore.points).map((e) => e.id));
  return after.filter((e) => !e.me && wasBehind.has(e.id) && e.points > meAfter.points).map((e) => e.name);
}
