/**
 * Regole del punteggio. Funzioni pure: nessun accesso a sensori o memoria,
 * così si possono verificare con i test (scoring.test.ts).
 */
import { getMode, type ModeId } from './modes';

/** Tetto di punti per singolo tragitto (somma dei tratti, bonus escluso). */
export const TRIP_CAP = 60;
/**
 * Due tragitti separati da meno di questo intervallo contano come uno solo ai
 * fini del tetto: altrimenti basterebbe premere Termina e Avvia per azzerarlo.
 */
export const CHAIN_GAP_MS = 30 * 60 * 1000;
/** Bonus per il tragitto abituale casa-lavoro, una volta al giorno. */
export const COMMUTE_BONUS = 10;
/** Distanza minima perché il bonus scatti. */
export const COMMUTE_MIN_M = 500;
/** Obiettivo giornaliero. */
export const DAILY_GOAL = 80;

/** Lunghezza massima credibile di un passo, corsa compresa. */
export const MAX_STRIDE_M = 1.5;
/** Sotto questa distanza i dati sono troppo pochi per dichiarare un'anomalia. */
export const ANOMALY_MIN_M = 200;
/** Velocità media massima a piedi quando i passi confermano (corsa compresa). */
export const VERIFIED_WALK_MAX_KMH = 20;

export type LegStatus =
  /** I sensori confermano il mezzo dichiarato. */
  | 'verificato'
  /** Nessuna prova contraria, ma nemmeno una conferma: vale la dichiarazione. */
  | 'dichiarato'
  /** I dati contraddicono il mezzo dichiarato: zero punti. */
  | 'anomalo';

export type LegInput = {
  mode: ModeId;
  /** Metri accreditati dal GPS. */
  gpsM: number;
  /** Metri scartati perché troppo veloci per il mezzo. */
  rejectedM: number;
  /** Secondi di movimento, pause escluse. */
  seconds: number;
  /** Passi contati nel tratto; null se non disponibili o non aggiornati. */
  steps: number | null;
  /**
   * Falso se durante il tratto l'app è stata in secondo piano: su alcuni
   * telefoni in quel tempo i passi non vengono contati, quindi il numero è
   * solo un minimo e non può essere usato contro l'utente. Predefinito: vero.
   */
  stepsComplete?: boolean;
  /** Posizioni simulate da un'altra app ricevute nel tratto. */
  mocked?: number;
};

export type LegResult = {
  mode: ModeId;
  /** Metri validi ai fini del punteggio. */
  meters: number;
  seconds: number;
  steps: number | null;
  status: LegStatus;
  /** Spiegazione leggibile dello stato, vuota se non serve. */
  note: string;
  /** Punti prima del tetto. */
  rawPoints: number;
  /** Punti assegnati dopo il tetto del tragitto. */
  points: number;
};

type Evaluated = Omit<LegResult, 'points'> & {
  /** Punti con i decimali, prima di qualsiasi arrotondamento. */
  exactPoints: number;
};

/**
 * Valuta un singolo tratto: distanza valida, stato e punti prima del tetto.
 *
 * La distanza viene sempre e solo dal GPS. I passi servono a confermarla o a
 * limitarla, mai a crearla: altrimenti basterebbe agitare il telefono.
 */
export function evaluateLeg(input: LegInput): Evaluated {
  const mode = getMode(input.mode);
  const base = { mode: input.mode, seconds: input.seconds, steps: input.steps };
  const invalid = (note: string) => ({ ...base, meters: 0, status: 'anomalo' as const, note, rawPoints: 0, exactPoints: 0 });

  if ((input.mocked ?? 0) > 0) {
    return invalid("Posizione simulata da un'altra app");
  }

  // Più di un terzo del percorso a velocità impossibile per il mezzo.
  const total = input.gpsM + input.rejectedM;
  if (input.rejectedM > Math.max(100, total * 0.3)) {
    return invalid(`Velocità troppo alta per "${mode.label}"`);
  }

  let meters = input.gpsM;
  let status: LegStatus = 'dichiarato';
  let note = '';

  if (input.mode === 'piedi' && input.steps != null && input.gpsM > 0) {
    const reach = input.steps * MAX_STRIDE_M;
    if (reach >= input.gpsM) {
      // Ogni metro è spiegato dai passi.
      status = 'verificato';
    } else if (input.stepsComplete === false) {
      // Passi contati solo in parte: non confermano, ma nemmeno smentiscono.
      note = 'Passi non contati a schermo spento';
    } else if (input.gpsM >= ANOMALY_MIN_M && reach < input.gpsM * 0.5) {
      return invalid('Troppo pochi passi per la distanza');
    } else if (reach <= 0) {
      meters = 0;
      note = 'Nessun passo contato';
    } else {
      // Il GPS non può accreditare più strada di quanta ne permettano i passi.
      meters = reach;
      status = 'verificato';
      note = 'Distanza limitata dai passi contati';
    }
  }

  if (meters > 0 && input.seconds > 0) {
    const kmh = (meters / input.seconds) * 3.6;
    const limit = input.mode === 'piedi' && status === 'verificato' ? VERIFIED_WALK_MAX_KMH : mode.maxAvgKmh;
    if (kmh > limit) {
      return invalid(`Velocità media troppo alta per "${mode.label}"`);
    }
  }

  const exactPoints = (meters / 1000) * mode.ptPerKm;
  return { ...base, meters, status, note, exactPoints, rawPoints: Math.floor(exactPoints + 1e-9) };
}

export type TripScore = {
  legs: LegResult[];
  /** Punti dei tratti dopo il tetto. */
  legPoints: number;
  bonus: number;
  /** Totale del tragitto: tratti + bonus. */
  total: number;
  meters: number;
  /** Metri fatti senza auto privata. */
  carFreeMeters: number;
  /** Punti del tetto già usati dai tragitti immediatamente precedenti. */
  capUsed: number;
};

export type ScoreOptions = {
  /** Il tragitto è stato segnato come abituale casa-lavoro. */
  commute: boolean;
  /** Il bonus di oggi è già stato assegnato. */
  bonusAlreadyToday: boolean;
  /** Punti del tetto già usati dai tragitti immediatamente precedenti. */
  capUsed?: number;
};

/** Punteggio di un tragitto composto da uno o più tratti. */
export function scoreTrip(inputs: LegInput[], options: ScoreOptions): TripScore {
  const capUsed = Math.max(0, options.capUsed ?? 0);
  const evaluated = inputs.map(evaluateLeg);

  // Si arrotonda per difetto una volta sola, sulla somma del tragitto: così
  // spezzare un percorso in pezzetti non rende mai più punti che farlo di
  // fila, e chi cambia mezzo non perde un punto a ogni cambio. I punti interi
  // che avanzano vanno ai tratti con la parte decimale più alta.
  const whole = evaluated.map((leg) => Math.floor(leg.exactPoints + 1e-9));
  const target = Math.floor(evaluated.reduce((sum, leg) => sum + leg.exactPoints, 0) + 1e-9);
  let spare = target - whole.reduce((sum, n) => sum + n, 0);
  const byFraction = evaluated
    .map((leg, i) => ({ i, fraction: leg.exactPoints - whole[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of byFraction) {
    if (spare <= 0) break;
    whole[i] += 1;
    spare -= 1;
  }

  let remaining = Math.max(0, TRIP_CAP - capUsed);
  const legs: LegResult[] = evaluated.map(({ exactPoints: _exact, ...leg }, i) => {
    const points = Math.min(whole[i], remaining);
    remaining -= points;
    return { ...leg, rawPoints: whole[i], points };
  });

  const meters = legs.reduce((sum, l) => sum + l.meters, 0);
  const carFreeMeters = legs.filter((l) => !getMode(l.mode).privateCar).reduce((sum, l) => sum + l.meters, 0);
  const usesPrivateCar = legs.some((l) => getMode(l.mode).privateCar && l.meters > 0);
  const hasAnomaly = legs.some((l) => l.status === 'anomalo');

  const bonus =
    options.commute && !options.bonusAlreadyToday && !usesPrivateCar && !hasAnomaly && meters >= COMMUTE_MIN_M
      ? COMMUTE_BONUS
      : 0;
  const legPoints = legs.reduce((sum, l) => sum + l.points, 0);

  return { legs, legPoints, bonus, total: legPoints + bonus, meters, carFreeMeters, capUsed };
}

/** Un tragitto concluso, come viene salvato. Nessuna coordinata. */
export type Trip = TripScore & {
  id: string;
  /** Giorno locale, AAAA-MM-GG. */
  day: string;
  startedAt: number;
  endedAt: number;
  commute: boolean;
  /** Presente se il tragitto non è stato misurato dall'app ma importato da Connessione Salute. */
  source?: 'salute';
  /** App che aveva registrato l'attività importata. */
  sourceApp?: string;
};

/**
 * Punti del tetto già consumati dalla catena di tragitti che precede
 * immediatamente `startedAt` (ognuno iniziato entro CHAIN_GAP_MS dalla fine
 * del precedente).
 */
export function capUsedBefore(trips: Trip[], startedAt: number): number {
  const earlier = trips.filter((t) => t.endedAt <= startedAt).sort((a, b) => b.endedAt - a.endedAt);
  let used = 0;
  let cursor = startedAt;
  for (const trip of earlier) {
    if (cursor - trip.endedAt > CHAIN_GAP_MS) break;
    used += trip.legPoints;
    cursor = trip.startedAt;
  }
  return Math.min(TRIP_CAP, used);
}

export type DaySummary = {
  points: number;
  carFreeMeters: number;
  steps: number;
  bonusAwarded: boolean;
  trips: Trip[];
};

export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function summarizeDay(trips: Trip[], day: string): DaySummary {
  const today = trips.filter((t) => t.day === day);
  return {
    points: today.reduce((sum, t) => sum + t.total, 0),
    carFreeMeters: today.reduce((sum, t) => sum + t.carFreeMeters, 0),
    steps: today.reduce((sum, t) => sum + t.legs.reduce((s, l) => s + (l.steps ?? 0), 0), 0),
    bonusAwarded: today.some((t) => t.bonus > 0),
    trips: today,
  };
}

/**
 * Giorni consecutivi con almeno un punto, contando all'indietro da oggi.
 * Se oggi non ci sono ancora punti la serie di ieri resta valida.
 */
export function streak(trips: Trip[], now: number): number {
  const days = new Set(trips.filter((t) => t.total > 0).map((t) => t.day));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
