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
import { completedChallenges } from './challenges';
import { totalCo2 } from './co2';
import { candyMeters } from './halloween';
import { isWitchingHour } from './look';
import { plantState } from './plant';
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
  | 'maratoneta'
  | 'mattiniero'
  | 'occhio-di-falco'
  | 'polmone-verde'
  | 'boscaiolo'
  | 'settimana-perfetta'
  | 'campione-del-mese'
  | 'podio'
  | 'fuori-porta'
  | 'lunga-distanza'
  | 'diecimila'
  | 'centurione'
  | 'viaggiatore'
  | 'notte-streghe';

export type BadgeUnit = 'tragitti' | 'km' | 'giorni' | 'kg' | 'alberi' | 'sfide' | 'volte' | 'percorsi' | 'viaggi';

export type Badge = {
  id: BadgeId;
  name: string;
  /** Cosa bisogna fare: {n} diventa il traguardo del grado. */
  goal: string;
  /** Traguardi dei gradi: bronzo, argento, oro. Un solo valore per le medaglie a un grado. */
  tiers: readonly number[];
  unit: BadgeUnit;
  /** Medaglia a tempo: si prende solo in un periodo dell'anno e non conta nel totale. */
  seasonal?: boolean;
};

export type BadgeState = Badge & {
  /** Avanzamento grezzo, senza tetto. */
  raw: number;
  /** Gradi presi: 0 nessuno, poi 1 bronzo, 2 argento, 3 oro. */
  level: number;
  /** Traguardo del prossimo grado (o dell'ultimo, se sono presi tutti). */
  target: number;
  /** Avanzamento verso `target`, mai oltre. */
  value: number;
  /** Da 0 a 1, verso il prossimo grado. */
  ratio: number;
  /** Almeno il primo grado. */
  unlocked: boolean;
  /** Tutti i gradi presi. */
  complete: boolean;
  /** L'obiettivo del prossimo grado (o dell'ultimo), in una riga. */
  goalText: string;
};

export const TIER_NAMES = ['Bronzo', 'Argento', 'Oro'] as const;

export const BADGES: readonly Badge[] = [
  { id: 'primo-passo', name: 'Primo passo', goal: 'Il primo tragitto a piedi', tiers: [1], unit: 'tragitti' },
  { id: 're-della-metro', name: 'Re della metro', goal: '{n} viaggi con i mezzi pubblici', tiers: [10, 50, 150], unit: 'viaggi' },
  { id: 'due-ruote', name: 'Due ruote', goal: '{n} km in bici', tiers: [50, 250, 1000], unit: 'km' },
  { id: 'sette-su-sette', name: 'Sette su sette', goal: '{n} giorni di fila senza auto', tiers: [7, 30, 100], unit: 'giorni' },
  { id: 'pendolare-doro', name: "Pendolare d'oro", goal: '{n} tragitti casa-lavoro senza auto', tiers: [20, 100, 250], unit: 'tragitti' },
  { id: 'scossa', name: 'Scossa', goal: '{n} tragitti in bici elettrica', tiers: [10, 50, 150], unit: 'tragitti' },
  { id: 'capotreno', name: 'Capotreno', goal: '{n} km in treno', tiers: [100, 500, 2000], unit: 'km' },
  { id: 'in-condivisione', name: 'In condivisione', goal: '{n} viaggi in car sharing', tiers: [5, 25, 75], unit: 'viaggi' },
  { id: 'maratoneta', name: 'Maratoneta', goal: '{n} km a piedi', tiers: [42, 100, 250], unit: 'km' },
  { id: 'mattiniero', name: 'Mattiniero', goal: '{n} tragitti senza auto prima delle 8', tiers: [5, 20, 60], unit: 'tragitti' },
  { id: 'occhio-di-falco', name: 'Occhio di falco', goal: '{n} viaggi in bus riconosciuti in tempo reale', tiers: [3, 15, 50], unit: 'viaggi' },
  { id: 'polmone-verde', name: 'Polmone verde', goal: '{n} kg di CO₂ evitata', tiers: [10, 50, 200], unit: 'kg' },
  { id: 'boscaiolo', name: 'Boscaiolo', goal: '{n} alberi nel bosco', tiers: [1, 3, 10], unit: 'alberi' },
  { id: 'settimana-perfetta', name: 'Settimana perfetta', goal: '{n} sfide della settimana completate', tiers: [1, 5, 20], unit: 'sfide' },
  { id: 'campione-del-mese', name: 'Campione del mese', goal: '{n} sfide del mese completate', tiers: [1, 3, 6], unit: 'sfide' },
  { id: 'podio', name: 'Podio', goal: '{n} volte sul podio della lega', tiers: [1, 5, 20], unit: 'volte' },
  { id: 'fuori-porta', name: 'Fuori porta', goal: '{n} tragitti senza auto nel fine settimana', tiers: [5, 20, 50], unit: 'tragitti' },
  { id: 'lunga-distanza', name: 'Lunga distanza', goal: '{n} tragitti di almeno 10 km senza auto', tiers: [1, 5, 20], unit: 'tragitti' },
  { id: 'diecimila', name: 'Diecimila', goal: '{n} giorni con 10.000 passi nei tragitti', tiers: [1, 10, 30], unit: 'giorni' },
  { id: 'centurione', name: 'Centurione', goal: '{n} giorni da almeno 100 punti', tiers: [1, 5, 20], unit: 'giorni' },
  { id: 'viaggiatore', name: 'Viaggiatore', goal: '{n} percorsi virtuali completati', tiers: [1, 2, 4], unit: 'percorsi' },
  {
    id: 'notte-streghe',
    name: 'Notte delle streghe',
    goal: 'Un tragitto senza auto la sera del 31 ottobre',
    tiers: [1],
    unit: 'tragitti',
    seasonal: true,
  },
];

/** Dati che non vengono dai tragitti: vittorie in lega e percorsi virtuali completati. */
export type BadgeContext = { podiums: number; journeys: number };
const NO_CONTEXT: BadgeContext = { podiums: 0, journeys: 0 };

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

/** Tragitto valido senza auto, di almeno MIN_LEG_M. */
const carFreeTrip = (t: Trip) => !usesPrivateCar(t) && !hasAnomaly(t) && candyMeters(t) >= MIN_LEG_M;

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

function progress(id: BadgeId, trips: Trip[], now: number, ctx: BadgeContext): number {
  switch (id) {
    case 'primo-passo':
      return tripsWith(trips, 'piedi', FIRST_WALK_M);
    case 're-della-metro':
      return tripsWith(trips, 'tpl');
    case 'due-ruote':
      return kmWith(trips, ['bici', 'ebike']);
    case 'sette-su-sette': {
      // I gradi già presi restano anche se la serie si interrompe: conta la serie migliore.
      const { best, current } = carFreeStreaks(trips, now);
      return Math.max(best, current);
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
    case 'mattiniero':
      return trips.filter((t) => new Date(t.startedAt).getHours() < 8 && carFreeTrip(t)).length;
    case 'occhio-di-falco':
      return trips.reduce((n, t) => n + t.legs.filter((l) => l.status === 'verificato' && !!l.route && /^(Bus|Tram) /.test(l.route) && l.note.includes('tempo reale')).length, 0);
    case 'polmone-verde':
      return totalCo2(trips) / 1000;
    case 'boscaiolo':
      return plantState(trips, now).trees;
    case 'settimana-perfetta':
      return completedChallenges(trips, now).filter((r) => r.id.startsWith('s-')).length;
    case 'campione-del-mese':
      return completedChallenges(trips, now).filter((r) => r.id.startsWith('m-')).length;
    case 'podio':
      return ctx.podiums;
    case 'fuori-porta':
      return trips.filter((t) => [0, 6].includes(new Date(t.startedAt).getDay()) && carFreeTrip(t)).length;
    case 'lunga-distanza':
      return trips.filter((t) => !usesPrivateCar(t) && candyMeters(t) >= 10000).length;
    case 'diecimila': {
      const steps = new Map<string, number>();
      for (const t of trips) steps.set(t.day, (steps.get(t.day) ?? 0) + t.legs.reduce((s, l) => s + (valid(l) ? (l.steps ?? 0) : 0), 0));
      return [...steps.values()].filter((n) => n >= 10000).length;
    }
    case 'centurione': {
      const points = new Map<string, number>();
      for (const t of trips) points.set(t.day, (points.get(t.day) ?? 0) + t.total);
      return [...points.values()].filter((n) => n >= 100).length;
    }
    case 'viaggiatore':
      return ctx.journeys;
    case 'notte-streghe':
      return trips.filter(
        (t) => (isWitchingHour(t.startedAt) || isWitchingHour(t.endedAt)) && !usesPrivateCar(t) && !hasAnomaly(t) && t.carFreeMeters >= MIN_LEG_M,
      ).length;
  }
}

export function goalFor(badge: Badge, target: number): string {
  return badge.goal.replace('{n}', target.toLocaleString('it-IT'));
}

export function badgeStates(trips: Trip[], now: number, ctx: BadgeContext = NO_CONTEXT): BadgeState[] {
  return BADGES.map((badge) => {
    const raw = progress(badge.id, trips, now, ctx);
    // Piccola tolleranza per le somme di numeri con la virgola (49,999999 km).
    const level = badge.tiers.filter((t) => raw >= t - 1e-6).length;
    const complete = level === badge.tiers.length;
    const target = badge.tiers[Math.min(level, badge.tiers.length - 1)];
    const value = Math.min(target, raw);
    return {
      ...badge,
      raw,
      level,
      target,
      value,
      complete,
      unlocked: level > 0,
      ratio: complete ? 1 : Math.max(0, value / target),
      goalText: goalFor(badge, target),
    };
  });
}

/** Il prossimo grado più vicino, tra le medaglie non a tempo; a parità, la prima dell'elenco. */
export function nextBadge(states: BadgeState[]): BadgeState | null {
  let next: BadgeState | null = null;
  for (const state of states) {
    if (!state.complete && !state.seasonal && (!next || state.ratio > next.ratio)) next = state;
  }
  return next;
}

/** Medaglie che salgono di grado aggiungendo `added` allo storico `before`. */
export function newlyUnlocked(before: Trip[], added: Trip[], now: number, ctx: BadgeContext = NO_CONTEXT): BadgeState[] {
  const had = new Map(badgeStates(before, now, ctx).map((b) => [b.id, b.level]));
  return badgeStates([...before, ...added], now, ctx).filter((b) => b.level > (had.get(b.id) ?? 0));
}

/** "14 di 20", "12,5 di 50 km". */
export function progressLabel(state: BadgeState): string {
  const value =
    state.unit === 'km' || state.unit === 'kg' ? (Math.floor(state.value * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.floor(state.value));
  const unit = state.unit === 'km' ? ' km' : state.unit === 'giorni' ? ' giorni' : state.unit === 'kg' ? ' kg' : '';
  return `${value} di ${state.target.toLocaleString('it-IT')}${unit}`;
}
