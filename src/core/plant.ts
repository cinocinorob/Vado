/**
 * Il germoglio: cresce con la CO₂ evitata, appassisce se per giorni non ci
 * sono tragitti senza auto. Funzioni pure.
 *
 * Due regole separate:
 * - la crescita dipende dal totale di CO₂ evitata e non torna mai indietro;
 * - l'aspetto (in forma, ha sete, appassita) dipende solo dai giorni recenti
 *   e si recupera con un solo tragitto.
 * A 22 kg, quanto assorbe un albero adulto in un anno, l'albero è completo:
 * va nel bosco e nasce un seme nuovo.
 *
 * Le pause ("Sono in pausa") congelano l'aspetto: i giorni in pausa non
 * contano come giorni fermi. Non toccano punti, serie né medaglie.
 */
import { TREE_G_PER_YEAR, tripCo2 } from './co2';
import { dayKey, type Trip } from './scoring';

/** CO₂ che fa un albero intero. */
export const TREE_G = TREE_G_PER_YEAR;
export const SPROUT_G = 3000;
export const SAPLING_G = 10000;
/** Giorni fermi dopo cui la pianta ha sete, e dopo cui è appassita. */
export const THIRSTY_DAYS = 3;
export const WILTED_DAYS = 6;
/** Durata massima di una pausa: poi si riprende da sola. */
export const PAUSE_MAX_DAYS = 14;

export type Stage = 'seme' | 'germoglio' | 'piantina';
export type Health = 'forma' | 'sete' | 'appassita' | 'pausa';

export type SpeciesId = 'pino' | 'cipresso' | 'leccio' | 'ulivo' | 'platano';
export const SPECIES: readonly { id: SpeciesId; name: string }[] = [
  { id: 'pino', name: 'Pino domestico' },
  { id: 'cipresso', name: 'Cipresso' },
  { id: 'leccio', name: 'Leccio' },
  { id: 'ulivo', name: 'Ulivo' },
  { id: 'platano', name: 'Platano' },
];

/** Una pausa: giorni locali AAAA-MM-GG. `to` è null finché non la si chiude. */
export type Pause = { from: string; to: string | null };

export type PlantState = {
  totalG: number;
  /** Alberi completi, nell'ordine in cui sono cresciuti. */
  forest: SpeciesId[];
  /** CO₂ del ciclo in corso, da 0 a TREE_G. */
  cycleG: number;
  stage: Stage;
  /** Soglia del prossimo passo nel ciclo in corso (germoglio, piantina o albero). */
  nextG: number;
  health: Health;
  /** Giorni fermi che contano (pause escluse). */
  idleDays: number;
};

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() + n);
  return dayKey(date.getTime());
}

/** Ultimo giorno coperto da una pausa, rispettando la durata massima. */
export function pauseLastDay(pause: Pause): string {
  const cap = addDays(pause.from, PAUSE_MAX_DAYS - 1);
  return pause.to && pause.to < cap ? pause.to : cap;
}

export function isPaused(day: string, pauses: readonly Pause[]): boolean {
  return pauses.some((p) => day >= p.from && day <= pauseLastDay(p));
}

/** La pausa che copre oggi, se l'utente non l'ha ancora chiusa. */
export function activePause(pauses: readonly Pause[], today: string): Pause | null {
  return pauses.find((p) => p.to === null && today >= p.from && today <= pauseLastDay(p)) ?? null;
}

/** Giorni di pausa ancora disponibili in quella in corso, oggi compreso. */
export function pauseDaysLeft(pause: Pause, today: string): number {
  let left = 0;
  for (let day = today; day <= pauseLastDay(pause) && left <= PAUSE_MAX_DAYS; day = addDays(day, 1)) left += 1;
  return left;
}

function stageOf(cycleG: number): { stage: Stage; nextG: number } {
  if (cycleG < SPROUT_G) return { stage: 'seme', nextG: SPROUT_G };
  if (cycleG < SAPLING_G) return { stage: 'germoglio', nextG: SAPLING_G };
  return { stage: 'piantina', nextG: TREE_G };
}

export function plantState(trips: readonly Trip[], now: number, pauses: readonly Pause[] = []): PlantState {
  const today = dayKey(now);
  let totalG = 0;
  let lastActive: string | null = null;
  for (const trip of trips) {
    const g = tripCo2(trip);
    if (g <= 0) continue;
    totalG += g;
    if (trip.day <= today && (lastActive === null || trip.day > lastActive)) lastActive = trip.day;
  }

  // Piccola tolleranza per le somme di decimali, come per le medaglie.
  const trees = Math.floor((totalG + 1e-6) / TREE_G);
  const forest = Array.from({ length: trees }, (_, i) => SPECIES[i % SPECIES.length].id);
  const cycleG = Math.max(0, totalG - trees * TREE_G);
  const { stage, nextG } = stageOf(cycleG);

  // Giorni interi senza tragitti tra l'ultimo attivo e oggi (oggi non conta: non è finito).
  let idleDays = 0;
  if (lastActive !== null) {
    for (let day = addDays(lastActive, 1); day < today && idleDays < 60; day = addDays(day, 1)) {
      if (!isPaused(day, pauses)) idleDays += 1;
    }
  }

  let health: Health = 'forma';
  if (activePause(pauses, today)) health = 'pausa';
  else if (idleDays >= WILTED_DAYS) health = 'appassita';
  else if (idleDays >= THIRSTY_DAYS) health = 'sete';

  return { totalG, forest, cycleG, stage, nextG, health, idleDays };
}

export function speciesName(id: SpeciesId): string {
  return SPECIES.find((s) => s.id === id)?.name ?? id;
}

/** Inizia una pausa oggi; se ce n'è già una aperta non cambia nulla. */
export function startPause(pauses: readonly Pause[], today: string): Pause[] {
  if (activePause(pauses, today)) return [...pauses];
  return [...pauses, { from: today, to: null }];
}

/** Chiude la pausa in corso: l'ultimo giorno in pausa è ieri, oggi conta di nuovo. */
export function endPause(pauses: readonly Pause[], today: string): Pause[] {
  return pauses
    .map((p) => (p.to === null ? { from: p.from, to: addDays(today, -1) } : p))
    .filter((p) => p.to === null || p.to >= p.from);
}
