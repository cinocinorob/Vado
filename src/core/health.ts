/**
 * Regole per i dati che arrivano da Connessione Salute (Health Connect).
 * Funzioni pure: la lettura vera e propria sta in src/health/.
 *
 * Due usi:
 *  1. Passi: confermano i tratti a piedi anche quando il contapassi dell'app
 *     si ferma a schermo spento. Possono solo aiutare, mai togliere punti:
 *     Connessione Salute scrive i passi a blocchi, con circa un minuto di
 *     ritardo, quindi il suo conteggio a fine tragitto è un minimo.
 *  2. Attività: camminate, corse e giri in bici registrati da altre app
 *     diventano tragitti con punti, con le stesse regole di quelli misurati
 *     dall'app (punti per km, tetto, controlli su passi e velocità).
 *
 * Limite noto: l'app non può verificare ciò che un'altra app ha scritto. Si
 * escludono le voci inserite a mano, che sono l'imbroglio più facile; contro
 * un'app che scrive dati falsi non c'è difesa da qui.
 */
import type { ModeId } from './modes';
import { capUsedBefore, dayKey, scoreTrip, type LegInput, type Trip } from './scoring';

export type StepSample = {
  /** Millisecondi dall'epoca. */
  start: number;
  end: number;
  count: number;
  /** App o dispositivo che ha scritto il dato. */
  origin: string;
  /** Inserito a mano dall'utente. */
  manual: boolean;
};

/** Un campione più lungo di così non dice quando sono stati fatti i passi. */
export const MAX_SPLIT_SAMPLE_MS = 15 * 60 * 1000;

/**
 * Passi fatti negli intervalli indicati.
 *
 * Più sorgenti possono contare gli stessi passi (telefono e orologio): si
 * somma per sorgente e si tiene la più alta, non il totale. Le voci inserite
 * a mano non contano. Un campione a cavallo dell'intervallo viene diviso in
 * proporzione al tempo, ma solo se è breve.
 *
 * @returns null se per quegli intervalli non c'è alcun dato (diverso da zero passi)
 */
export function stepsInWindows(samples: StepSample[], windows: [number, number][]): number | null {
  const byOrigin = new Map<string, number>();
  for (const sample of samples) {
    if (sample.manual || sample.count <= 0 || sample.end < sample.start) continue;
    const length = sample.end - sample.start;
    let share = 0;
    let touched = false;
    for (const [from, to] of windows) {
      if (to <= from) continue;
      if (length === 0) {
        if (sample.start >= from && sample.start <= to) {
          share += 1;
          touched = true;
        }
        continue;
      }
      const overlap = Math.min(sample.end, to) - Math.max(sample.start, from);
      if (overlap <= 0) continue;
      const inside = sample.start >= from && sample.end <= to;
      if (!inside && length > MAX_SPLIT_SAMPLE_MS) continue;
      share += overlap / length;
      touched = true;
    }
    if (touched) byOrigin.set(sample.origin, (byOrigin.get(sample.origin) ?? 0) + sample.count * Math.min(1, share));
  }
  if (byOrigin.size === 0) return null;
  return Math.floor(Math.max(...byOrigin.values()) + 1e-9);
}

/**
 * Aggiunge a un tratto a piedi i passi letti da Connessione Salute.
 * Vale il conteggio più alto tra quello dell'app e quello di Connessione
 * Salute. Se l'app non aveva un conteggio completo, resta "non completo":
 * così un numero basso non viene mai usato contro l'utente.
 */
export function mergeHealthSteps(input: LegInput, healthSteps: number | null): LegInput {
  if (input.mode !== 'piedi' || healthSteps == null) return input;
  if (input.steps == null) return { ...input, steps: healthSteps, stepsComplete: false };
  return healthSteps > input.steps ? { ...input, steps: healthSteps } : input;
}

/** I tipi di esercizio di Connessione Salute che corrispondono a uno spostamento. */
export const EXERCISE_MODES: Readonly<Record<number, ModeId>> = {
  8: 'bici', // BIKING
  37: 'piedi', // HIKING
  56: 'piedi', // RUNNING
  79: 'piedi', // WALKING
  82: 'piedi', // WHEELCHAIR
};
/** In sedia a rotelle i passi non hanno senso: non si usano per il controllo. */
const NO_STEP_CHECK = new Set([82]);

/** Giorni all'indietro entro cui si importano le attività. */
export const IMPORT_DAYS = 7;
/** Sotto questa distanza l'attività non viene importata. */
export const IMPORT_MIN_M = 200;
/** Quota di sovrapposizione oltre la quale due registrazioni sono la stessa attività. */
export const OVERLAP_SHARE = 0.2;

export type HealthSession = {
  /** Identificativo del dato in Connessione Salute. */
  id: string;
  origin: string;
  start: number;
  end: number;
  /** Codice del tipo di esercizio (ExerciseSessionRecord.EXERCISE_TYPE_*). */
  exerciseType: number;
  manual: boolean;
  /** Metri registrati durante l'attività; null se l'app di origine non li scrive. */
  distanceM: number | null;
  /** Passi nell'intervallo dell'attività; null se non ci sono dati. */
  steps: number | null;
};

export type SkipReason =
  /** Non è uno spostamento (palestra, nuoto, cyclette…). */
  | 'tipo'
  | 'manuale'
  | 'senza-distanza'
  | 'corta'
  | 'vecchia'
  | 'non-conclusa'
  | 'gia-importata'
  /** Coincide con un tragitto già presente: contarla sarebbe un doppione. */
  | 'doppione';

export type ImportOutcome = {
  trips: Trip[];
  skipped: { id: string; reason: SkipReason }[];
};

export const tripIdFor = (sessionId: string) => `salute:${sessionId}`;

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/** Perché un'attività non può essere importata, guardando solo l'attività stessa. */
export function sessionProblem(session: HealthSession, opts: { now: number; from: number }): SkipReason | null {
  if (!(session.exerciseType in EXERCISE_MODES)) return 'tipo';
  if (session.manual) return 'manuale';
  if (session.end > opts.now || session.end <= session.start) return 'non-conclusa';
  if (session.start < opts.from) return 'vecchia';
  return null;
}

/**
 * Trasforma le attività lette da Connessione Salute in tragitti.
 * @param existing tragitti già nello storico (misurati dall'app o importati)
 * @param opts.from non si importa nulla che sia iniziato prima di questo istante
 */
export function importSessions(sessions: HealthSession[], existing: Trip[], opts: { now: number; from: number }): ImportOutcome {
  const known = new Set(existing.map((t) => t.id));
  const all = [...existing];
  const trips: Trip[] = [];
  const skipped: ImportOutcome['skipped'] = [];
  const skip = (id: string, reason: SkipReason) => skipped.push({ id, reason });

  // In ordine di tempo, così il tetto concatenato si applica nel verso giusto.
  for (const session of [...sessions].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    const id = tripIdFor(session.id);
    if (known.has(id)) {
      skip(session.id, 'gia-importata');
      continue;
    }
    const problem = sessionProblem(session, opts);
    if (problem) {
      skip(session.id, problem);
      continue;
    }
    if (session.distanceM == null || session.distanceM <= 0) {
      skip(session.id, 'senza-distanza');
      continue;
    }
    if (session.distanceM < IMPORT_MIN_M) {
      skip(session.id, 'corta');
      continue;
    }
    const length = session.end - session.start;
    if (all.some((t) => overlapMs(session.start, session.end, t.startedAt, t.endedAt) > length * OVERLAP_SHARE)) {
      skip(session.id, 'doppione');
      continue;
    }

    const mode = EXERCISE_MODES[session.exerciseType];
    const checkSteps = mode === 'piedi' && !NO_STEP_CHECK.has(session.exerciseType);
    const input: LegInput = {
      mode,
      gpsM: session.distanceM,
      rejectedM: 0,
      seconds: Math.round(length / 1000),
      // Zero passi in Connessione Salute di solito significa "nessuno li ha
      // contati", non "non hai camminato": senza dato vale la dichiarazione.
      steps: checkSteps && session.steps != null && session.steps > 0 ? session.steps : null,
    };
    const score = scoreTrip([input], {
      commute: false,
      bonusAlreadyToday: true,
      capUsed: capUsedBefore(all, session.start),
    });
    const trip: Trip = {
      ...score,
      id,
      day: dayKey(session.end),
      startedAt: session.start,
      endedAt: session.end,
      commute: false,
      source: 'salute',
      sourceApp: session.origin,
    };
    known.add(id);
    all.push(trip);
    trips.push(trip);
  }
  return { trips, skipped };
}

const APP_NAMES: Readonly<Record<string, string>> = {
  android: 'questo telefono',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.strava': 'Strava',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.healthdata': 'Connessione Salute',
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.polar.polarflow': 'Polar Flow',
  'com.komoot.android': 'Komoot',
};

/** Nome leggibile dell'app che ha registrato un'attività. */
export function appName(origin: string | undefined): string {
  if (!origin) return 'Connessione Salute';
  if (origin.startsWith('com.android.healthconnect.phone')) return 'questo telefono';
  return APP_NAMES[origin] ?? origin;
}
