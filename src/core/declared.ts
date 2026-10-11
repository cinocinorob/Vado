/**
 * Viaggio in metro registrato a posteriori ("Ho preso la metro").
 *
 * Chi dimentica di avviare il tragitto può registrarlo all'uscita: la
 * stazione di arrivo è quella dove si trova in quel momento (verificata dalla
 * posizione), quella di partenza la sceglie lui. Poiché metà del dato è una
 * dichiarazione, ci sono due limiti: un numero massimo al giorno e nessuna
 * registrazione subito dopo un tragitto con i mezzi pubblici già contato.
 *
 * Funzioni pure, verificate in declared.test.ts.
 */
import { DECLARED_GAP_MS, DECLARED_PER_DAY, rideSeconds, routeLabel, routeLines, type Route } from './metro';
import { capUsedBefore, dayKey, scoreTrip, summarizeDay, type Trip } from './scoring';

export type DeclareCheck = { ok: true; left: number } | { ok: false; reason: string };

/** Si può registrare adesso un viaggio in metro a posteriori? */
export function canDeclare(trips: Trip[], now: number): DeclareCheck {
  const day = dayKey(now);
  const used = trips.filter((t) => t.day === day && t.source === 'metro').length;
  if (used >= DECLARED_PER_DAY) {
    return {
      ok: false,
      reason: `Per oggi hai già registrato ${DECLARED_PER_DAY} viaggi in metro a posteriori. Per gli altri avvia il tragitto prima di scendere: la distanza viene calcolata da sola.`,
    };
  }
  const justCounted = trips.some(
    (t) => t.endedAt <= now && now - t.endedAt < DECLARED_GAP_MS && t.legs.some((leg) => leg.mode === 'tpl' && leg.meters > 0),
  );
  if (justCounted) {
    return { ok: false, reason: 'Hai appena concluso un tragitto con i mezzi pubblici: questo viaggio risulta già contato.' };
  }
  return { ok: true, left: DECLARED_PER_DAY - used };
}

/** Il tragitto da salvare per un viaggio in metro dichiarato che finisce adesso. */
export function declaredTrip(route: Route, opts: { now: number; commute: boolean; trips: Trip[] }): Trip {
  const seconds = rideSeconds(route);
  const startedAt = opts.now - seconds * 1000;
  const day = dayKey(opts.now);
  const score = scoreTrip(
    [
      {
        mode: 'tpl',
        gpsM: route.meters,
        rejectedM: 0,
        seconds,
        steps: null,
        hops: [{ label: routeLabel(route), lines: routeLines(route), meters: route.meters }],
        declared: true,
      },
    ],
    {
      commute: opts.commute,
      bonusAlreadyToday: summarizeDay(opts.trips, day).bonusAwarded,
      capUsed: capUsedBefore(opts.trips, startedAt),
    },
  );
  return { ...score, id: `m${opts.now.toString(36)}`, day, startedAt, endedAt: opts.now, commute: opts.commute, source: 'metro' };
}
