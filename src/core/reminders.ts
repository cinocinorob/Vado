/** Quando mandare i promemoria. Funzioni pure. */
import { formatCo2, legCo2, totalCo2 } from './co2';
import { activePause, type Pause } from './plant';
import type { Trip } from './scoring';
import { weekEnd, weekStart } from './social';

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

/** Ora del riepilogo settimanale, il lunedì. */
export const WEEKLY_HOUR = 9;

const kmText = (m: number) => `${String(Math.round(m / 100) / 10).replace('.', ',')} km`;

/**
 * Il riepilogo della settimana in corso, da mandare il lunedì successivo
 * alle 9. null se in settimana non c'è nessun tragitto.
 */
export function weeklyRecap(trips: readonly Trip[], now: number): { when: number; title: string; body: string } | null {
  const from = weekStart(now);
  const to = weekEnd(now);
  const week = trips.filter((t) => t.endedAt >= from && t.endedAt < to);
  if (week.length === 0) return null;
  const meters = week.reduce((sum, t) => sum + t.carFreeMeters, 0);
  const points = week.reduce((sum, t) => sum + t.total, 0);
  const days = new Set(week.filter((t) => t.carFreeMeters > 0).map((t) => t.day)).size;
  const previous = trips.filter((t) => t.endedAt >= from - 7 * 86_400_000 && t.endedAt < from).reduce((sum, t) => sum + t.carFreeMeters, 0);
  const when = new Date(to);
  when.setHours(WEEKLY_HOUR, 0, 0, 0);
  const trend =
    previous > 0 && meters > 0
      ? meters >= previous
        ? ` ${Math.round(((meters - previous) / previous) * 100)}% in più della settimana prima.`
        : ` La settimana prima ne avevi fatti ${kmText(previous)}.`
      : '';
  return {
    when: when.getTime(),
    title: `La tua settimana: ${kmText(meters)} senza auto`,
    body: `${points} punti in ${days} ${days === 1 ? 'giorno' : 'giorni'}, ${formatCo2(totalCo2(week))} di CO₂ evitata.${trend}`,
  };
}
