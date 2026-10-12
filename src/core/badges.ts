/**
 * Medaglie. Funzioni pure, calcolate ogni volta dallo storico dei tragitti:
 * non c'è un elenco salvato di medaglie "possedute", quindi non può andare
 * fuori sincronia con i tragitti che le giustificano.
 *
 * Contano solo i tratti validi (non "Non valido"). Per le medaglie a numero di
 * tragitti il tratto deve essere lungo almeno MIN_LEG_M, altrimenti basterebbe
 * premere Avvia e Termina dieci volte.
 */
import type { ModeId } from './modes';
import { getMode } from './modes';
import { dayKey, type LegResult, type Trip } from './scoring';

/** Lunghezza minima di un tratto perché conti per le medaglie a numero di tragitti. */
export const MIN_LEG_M = 500;
/** La prima medaglia chiede meno, per arrivare al primo giorno d'uso. */
export const FIRST_WALK_M = 200;

export type BadgeId =
  | 'primo-passo'
  | 're-della-metro'
  | 'due-ruote'
  | 'sette-su-sette'
  | 'pendolare-doro'
  | 'scossa'
  | 'capotreno'
  | 'in-condivisione'
  | 'maratoneta';

export type BadgeUnit = 'tragitti' | 'km' | 'giorni';

export type Badge = {
  id: BadgeId;
  name: string;
  /** Cosa bisogna fare, in una riga. */
  goal: string;
  target: number;
  unit: BadgeUnit;
};

export type BadgeState = Badge & {
  /** Avanzamento nella stessa unità di `target`, mai oltre il traguardo. */
  value: number;
  /** Da 0 a 1. */
  ratio: number;
  unlocked: boolean;
};

export const BADGES: readonly Badge[] = [
  { id: 'primo-passo', name: 'Primo passo', goal: 'Il primo tragitto a piedi', target: 1, unit: 'tragitti' },
  { id: 're-della-metro', name: 'Re della metro', goal: '10 viaggi con i mezzi pubblici', target: 10, unit: 'tragitti' },
  { id: 'due-ruote', name: 'Due ruote', goal: '50 km in bici', target: 50, unit: 'km' },
  { id: 'sette-su-sette', name: 'Sette su sette', goal: '7 giorni di fila senza auto', target: 7, unit: 'giorni' },
  { id: 'pendolare-doro', name: "Pendolare d'oro", goal: '20 tragitti casa-lavoro senza auto', target: 20, unit: 'tragitti' },
  { id: 'scossa', name: 'Scossa', goal: '10 tragitti in bici elettrica', target: 10, unit: 'tragitti' },
  { id: 'capotreno', name: 'Capotreno', goal: '100 km in treno', target: 100, unit: 'km' },
  { id: 'in-condivisione', name: 'In condivisione', goal: '5 viaggi in car sharing', target: 5, unit: 'tragitti' },
  { id: 'maratoneta', name: 'Maratoneta', goal: '42 km a piedi', target: 42, unit: 'km' },
];

const valid = (leg: LegResult) => leg.status !== 'anomalo' && leg.meters > 0;

/** Chilometri validi fatti con uno dei mezzi indicati. */
function kmWith(trips: Trip[], modes: ModeId[]): number {
  let meters = 0;
  for (const trip of trips) {
    for (const leg of trip.legs) {
      if (valid(leg) && modes.includes(leg.mode)) meters += leg.meters;
    }
  }
  return meters / 1000;
}

/** Tragitti con almeno un tratto valido, abbastanza lungo, fatto con il mezzo indicato. */
function tripsWith(trips: Trip[], mode: ModeId, minMeters = MIN_LEG_M): number {
  return trips.filter((trip) => trip.legs.some((leg) => valid(leg) && leg.mode === mode && leg.meters >= minMeters)).length;
}

const usesPrivateCar = (trip: Trip) => trip.legs.some((leg) => getMode(leg.mode).privateCar && leg.meters > 0);
const hasAnomaly = (trip: Trip) => trip.legs.some((leg) => leg.status === 'anomalo');

/** Tragitti casa-lavoro validi e senza auto privata (il bonus vale una volta al giorno, la medaglia li conta tutti). */
function carFreeCommutes(trips: Trip[]): number {
  return trips.filter((t) => t.commute && !usesPrivateCar(t) && !hasAnomaly(t) && t.meters >= MIN_LEG_M).length;
}

/**
 * Giorni "senza auto": almeno un tragitto valido senza auto privata e nessun
 * tragitto in auto privata. L'app vede solo ciò che viene registrato: un
 * viaggio in auto non registrato non interrompe la serie.
 */
export function carFreeDays(trips: Trip[]): Set<string> {
  const good = new Set<string>();
  const bad = new Set<string>();
  for (const trip of trips) {
    if (usesPrivateCar(trip)) bad.add(trip.day);
    else if (!hasAnomaly(trip) && trip.carFreeMeters >= MIN_LEG_M) good.add(trip.day);
  }
  for (const day of bad) good.delete(day);
  return good;
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() - 1);
  return dayKey(date.getTime());
}

/** La serie più lunga di sempre e quella in corso (che vale anche se oggi non c'è ancora un tragitto). */
export function carFreeStreaks(trips: Trip[], now: number): { best: number; current: number } {
  const days = carFreeDays(trips);
  let best = 0;
  for (const day of days) {
    let length = 1;
    let cursor = previousDay(day);
    while (days.has(cursor)) {
      length += 1;
      cursor = previousDay(cursor);
    }
    best = Math.max(best, length);
  }
  let cursor = dayKey(now);
  if (!days.has(cursor)) cursor = previousDay(cursor);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }
  return { best, current };
}

function progress(id: BadgeId, trips: Trip[], now: number): number {
  switch (id) {
    case 'primo-passo':
      return tripsWith(trips, 'piedi', FIRST_WALK_M);
    case 're-della-metro':
      return tripsWith(trips, 'tpl');
    case 'due-ruote':
      return kmWith(trips, ['bici', 'ebike']);
    case 'sette-su-sette': {
      const { best, current } = carFreeStreaks(trips, now);
      // Una volta raggiunti i sette giorni la medaglia resta, anche se la serie si interrompe.
      return best >= 7 ? best : current;
    }
    case 'pendolare-doro':
      return carFreeCommutes(trips);
    case 'scossa':
      return tripsWith(trips, 'ebike');
    case 'capotreno':
      return kmWith(trips, ['treno']);
    case 'in-condivisione':
      return tripsWith(trips, 'carsharing');
    case 'maratoneta':
      return kmWith(trips, ['piedi']);
  }
}

export function badgeStates(trips: Trip[], now: number): BadgeState[] {
  return BADGES.map((badge) => {
    const raw = progress(badge.id, trips, now);
    // Piccola tolleranza per le somme di numeri con la virgola (49,999999 km).
    const unlocked = raw >= badge.target - 1e-6;
    const value = Math.min(badge.target, raw);
    return { ...badge, value, unlocked, ratio: unlocked ? 1 : Math.max(0, value / badge.target) };
  });
}

/** La medaglia non ancora sbloccata più vicina al traguardo; a parità, la prima dell'elenco. */
export function nextBadge(states: BadgeState[]): BadgeState | null {
  let next: BadgeState | null = null;
  for (const state of states) {
    if (!state.unlocked && (!next || state.ratio > next.ratio)) next = state;
  }
  return next;
}

/** Medaglie sbloccate aggiungendo `added` allo storico `before`. */
export function newlyUnlocked(before: Trip[], added: Trip[], now: number): BadgeState[] {
  const had = new Set(badgeStates(before, now).filter((b) => b.unlocked).map((b) => b.id));
  return badgeStates([...before, ...added], now).filter((b) => b.unlocked && !had.has(b.id));
}

/** "14 di 20", "12,5 di 50 km". */
export function progressLabel(state: BadgeState): string {
  const value =
    state.unit === 'km' ? (Math.floor(state.value * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.floor(state.value));
  const unit = state.unit === 'km' ? ' km' : state.unit === 'giorni' ? ' giorni' : '';
  return `${value} di ${state.target}${unit}`;
}
