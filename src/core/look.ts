/**
 * Quale aspetto ha l'app: chiaro, scuro o Halloween. Funzioni pure.
 *
 * "auto" segue il periodo dell'anno (Halloween dal 15 ottobre al 2 novembre)
 * e, fuori periodo, la modalità scura del telefono.
 */
export type LookChoice = 'auto' | 'chiaro' | 'scuro' | 'halloween';
export type Look = 'chiaro' | 'scuro' | 'halloween';

export const LOOK_CHOICES: readonly LookChoice[] = ['auto', 'chiaro', 'scuro', 'halloween'];

/** Vero dal 15 ottobre al 2 novembre compresi, ora locale. */
export function isHalloweenSeason(now: number): boolean {
  const d = new Date(now);
  const m = d.getMonth();
  const day = d.getDate();
  return (m === 9 && day >= 15) || (m === 10 && day <= 2);
}

export function resolveLook(choice: LookChoice, now: number, systemDark: boolean): Look {
  if (choice !== 'auto') return choice;
  if (isHalloweenSeason(now)) return 'halloween';
  return systemDark ? 'scuro' : 'chiaro';
}

export function isLookChoice(value: unknown): value is LookChoice {
  return typeof value === 'string' && (LOOK_CHOICES as readonly string[]).includes(value);
}

/** Il 31 ottobre dopo il tramonto (a Roma, dopo il cambio d'ora, verso le 17). */
export function isWitchingHour(timestamp: number): boolean {
  const d = new Date(timestamp);
  return d.getMonth() === 9 && d.getDate() === 31 && d.getHours() >= 17;
}
