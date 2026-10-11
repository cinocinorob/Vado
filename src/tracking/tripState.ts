/**
 * Stato del tragitto in corso e sue trasformazioni.
 *
 * Tutte le funzioni qui sono pure (dato uno stato ne restituiscono uno nuovo),
 * così si verificano con i test. I sensori vivono in tracker.ts, il
 * contenitore dello stato e la bozza su disco in store.ts.
 */
import {
  EMPTY_TRACK,
  addFix,
  breakTrack,
  closeTrack,
  withoutCoordinates,
  type Bridge,
  type Fix,
  type TrackState,
} from '../core/geo';
import { metroHop } from '../core/metro';
import { getMode, type ModeId } from '../core/modes';
import type { LegInput } from '../core/scoring';
import { ROMA } from '../data/metro';

export type ActiveLeg = {
  mode: ModeId;
  track: TrackState;
  /** Millisecondi di movimento già accumulati, pause escluse. */
  accumMs: number;
  /** Istante dell'ultima (ri)partenza; null se il tratto è in pausa o chiuso. */
  runningSince: number | null;
  /** Valore del contapassi da cui partire a contare; null finché non arriva la prima lettura. */
  stepBase: number | null;
  /** Passi definitivi, fissati quando il tratto viene chiuso. */
  finalSteps: number | null;
  /** Il tratto è chiuso: finalSteps vale anche se è null. */
  closed: boolean;
  /**
   * Durante il tratto l'app è stata in secondo piano: su alcuni telefoni in
   * quel tempo i passi non vengono contati, quindi il conteggio è un minimo.
   */
  backgrounded: boolean;
  /**
   * Intervalli di movimento già conclusi (inizio, fine), pause escluse.
   * Servono a chiedere a Connessione Salute i passi fatti proprio in quei minuti.
   */
  spans?: [number, number][];
};

export type PathPoint = { lat: number; lon: number };

export type ActiveTrip = {
  id: string;
  startedAt: number;
  commute: boolean;
  /** L'ultimo è il tratto corrente. */
  legs: ActiveLeg[];
  paused: boolean;
  /** Lettura del contapassi al momento della pausa. */
  stepsAtPause: number | null;
  /** Ultima lettura del contapassi (passi dall'avvio del tragitto). */
  stepsNow: number | null;
  /** Il contapassi è disponibile e la sua base non è andata persa. */
  stepsUsable: boolean;
  /**
   * L'app è stata in secondo piano e dal rientro non è ancora arrivata una
   * lettura: il numero in stepsNow è vecchio e non va usato.
   */
  stepsStale: boolean;
  /** Il permesso di posizione è stato concesso. */
  gpsUsable: boolean;
  /** Il rilevamento continua anche a schermo spento (servizio in primo piano). */
  background: boolean;
  /** Punti accreditati, solo per disegnare il percorso. Mai scritti su disco. */
  path: PathPoint[];
  /** Dopo un riavvio la base del contapassi è persa: per questo tragitto non si usa più. */
  stepsLost?: boolean;
  /** Istante dell'ultimo salvataggio della bozza, scritto dal contenitore. */
  savedAt?: number;
};

const MAX_PATH_POINTS = 400;

function newLeg(mode: ModeId, now: number, stepBase: number | null): ActiveLeg {
  return {
    mode,
    track: EMPTY_TRACK,
    accumMs: 0,
    runningSince: now,
    stepBase,
    finalSteps: null,
    closed: false,
    backgrounded: false,
  };
}

export function startTrip(opts: {
  mode: ModeId;
  commute: boolean;
  now: number;
  stepsUsable: boolean;
  gpsUsable: boolean;
  background: boolean;
}): ActiveTrip {
  return {
    id: `t${opts.now.toString(36)}`,
    startedAt: opts.now,
    commute: opts.commute,
    legs: [newLeg(opts.mode, opts.now, null)],
    paused: false,
    stepsAtPause: null,
    stepsNow: null,
    stepsUsable: opts.stepsUsable,
    stepsStale: false,
    gpsUsable: opts.gpsUsable,
    background: opts.background,
    path: [],
  };
}

export function currentLeg(trip: ActiveTrip): ActiveLeg {
  return trip.legs[trip.legs.length - 1];
}

function replaceCurrent(trip: ActiveTrip, leg: ActiveLeg): ActiveTrip {
  return { ...trip, legs: [...trip.legs.slice(0, -1), leg] };
}

/** Passi del tratto: lettura corrente meno la base. Null se non si sa. */
export function legSteps(trip: ActiveTrip, leg: ActiveLeg): number | null {
  if (leg.closed) return leg.finalSteps;
  if (!trip.stepsUsable || trip.stepsStale) return null;
  // Nessuna lettura arrivata: non si sa, ed è diverso da "zero passi".
  if (leg.stepBase == null || trip.stepsNow == null) return null;
  const reference = trip.paused && trip.stepsAtPause != null ? trip.stepsAtPause : trip.stepsNow;
  return Math.max(0, reference - leg.stepBase);
}

export function legElapsedMs(leg: ActiveLeg, now: number): number {
  return leg.accumMs + (leg.runningSince != null ? Math.max(0, now - leg.runningSince) : 0);
}

/** Intervalli di movimento del tratto fino a `now`, compreso quello ancora aperto. */
export function legSpans(leg: ActiveLeg, now: number): [number, number][] {
  const done = leg.spans ?? [];
  return leg.runningSince != null && now > leg.runningSince ? [...done, [leg.runningSince, now]] : done;
}

/**
 * Con i mezzi pubblici, quando le posizioni spariscono tra due stazioni della
 * metro la distanza viene dalla rete invece che dalla linea d'aria.
 */
const metroBridge: Bridge = (from, to, straightM) => metroHop(ROMA, from, to, straightM);

/** Nuove posizioni dal GPS. In pausa vengono ignorate. */
export function applyFixes(trip: ActiveTrip, fixes: Fix[]): ActiveTrip {
  if (trip.paused || fixes.length === 0) return trip;
  const leg = currentLeg(trip);
  const maxMs = getMode(leg.mode).maxSegmentMs;
  const bridge = leg.mode === 'tpl' ? metroBridge : undefined;
  let track = leg.track;
  let path = trip.path;
  for (const fix of fixes) {
    const result = addFix(track, fix, maxMs, bridge);
    track = result.state;
    if (result.credited) {
      path = [...path, { lat: result.credited.lat, lon: result.credited.lon }];
    }
  }
  if (track === leg.track) return trip;
  while (path.length > MAX_PATH_POINTS) {
    // Si dimezza la risoluzione tenendo l'ultimo punto.
    const full = path;
    path = full.filter((_, i) => i % 2 === 0 || i === full.length - 1);
  }
  return { ...replaceCurrent(trip, { ...leg, track }), path };
}

/** Nuova lettura del contapassi. */
export function applySteps(trip: ActiveTrip, steps: number): ActiveTrip {
  const leg = currentLeg(trip);
  const next = { ...trip, stepsNow: steps, stepsStale: false };
  // La prima lettura fissa la base del tratto corrente.
  return leg.stepBase == null ? replaceCurrent(next, { ...leg, stepBase: steps }) : next;
}

/** L'app va in secondo piano: da qui le letture dei passi si fermano. */
export function enterBackground(trip: ActiveTrip): ActiveTrip {
  if (!trip.stepsUsable) return trip;
  const leg = currentLeg(trip);
  return { ...replaceCurrent(trip, { ...leg, backgrounded: leg.backgrounded || !trip.paused }), stepsStale: true };
}

function closeLeg(trip: ActiveTrip, leg: ActiveLeg, now: number): ActiveLeg {
  return {
    ...leg,
    track: closeTrack(leg.track, getMode(leg.mode).maxSegmentMs),
    accumMs: legElapsedMs(leg, now),
    spans: legSpans(leg, now),
    runningSince: null,
    finalSteps: legSteps(trip, leg),
    closed: true,
  };
}

/** Cambio di mezzo a metà tragitto: chiude il tratto e ne apre uno nuovo. */
export function switchMode(trip: ActiveTrip, mode: ModeId, now: number): ActiveTrip {
  const leg = currentLeg(trip);
  if (leg.mode === mode) return trip;
  const closed = closeLeg(trip, leg, now);
  const base = trip.stepsStale ? null : trip.paused && trip.stepsAtPause != null ? trip.stepsAtPause : trip.stepsNow;
  const opened: ActiveLeg = {
    ...newLeg(mode, now, base),
    runningSince: trip.paused ? null : now,
    // Il nuovo tratto riparte dall'ultima posizione nota del precedente.
    track: { ...EMPTY_TRACK, last: closed.track.last, estimate: closed.track.estimate, lastRaw: closed.track.lastRaw },
  };
  return { ...trip, legs: [...trip.legs.slice(0, -1), closed, opened] };
}

export function pauseTrip(trip: ActiveTrip, now: number): ActiveTrip {
  if (trip.paused) return trip;
  const leg = currentLeg(trip);
  return {
    ...replaceCurrent(trip, {
      ...leg,
      // L'ultimo pezzo fatto prima della pausa viene accreditato adesso.
      track: closeTrack(leg.track, getMode(leg.mode).maxSegmentMs),
      accumMs: legElapsedMs(leg, now),
      spans: legSpans(leg, now),
      runningSince: null,
    }),
    paused: true,
    stepsAtPause: trip.stepsStale ? null : trip.stepsNow,
  };
}

export function resumeTrip(trip: ActiveTrip, now: number): ActiveTrip {
  if (!trip.paused) return trip;
  const leg = currentLeg(trip);
  // I passi fatti in pausa non contano: si sposta in avanti la base.
  const walkedInPause =
    trip.stepsNow != null && trip.stepsAtPause != null ? Math.max(0, trip.stepsNow - trip.stepsAtPause) : 0;
  return {
    ...replaceCurrent(trip, {
      ...leg,
      runningSince: now,
      stepBase: leg.stepBase != null ? leg.stepBase + walkedInPause : leg.stepBase,
      track: breakTrack(leg.track),
    }),
    paused: false,
    stepsAtPause: null,
  };
}

/**
 * Dati dei tratti nella forma che serve al punteggio.
 * @param final a tragitto concluso: accredita anche l'ultimo pezzo del tratto aperto
 */
export function toLegInputs(trip: ActiveTrip, now: number, final = false): LegInput[] {
  return trip.legs.map((leg) => {
    const track = final && !leg.closed && !trip.paused ? closeTrack(leg.track, getMode(leg.mode).maxSegmentMs) : leg.track;
    return {
      mode: leg.mode,
      gpsM: track.distanceM,
      rejectedM: track.rejectedM,
      seconds: Math.round(legElapsedMs(leg, now) / 1000),
      steps: legSteps(trip, leg),
      stepsComplete: !leg.backgrounded,
      mocked: track.mocked,
      hops: track.hops,
    };
  });
}

/**
 * Dopo un riavvio dell'app la base del contapassi è persa: i passi non sono
 * più affidabili per questo tragitto, e il tratto GPS va spezzato.
 * Il tempo trascorso fino all'ultimo salvataggio resta contato; quello ad app
 * chiusa no.
 */
export function afterRestart(trip: ActiveTrip, now: number): ActiveTrip {
  const leg = currentLeg(trip);
  const until = trip.savedAt ?? leg.runningSince ?? now;
  const ranMs = leg.runningSince != null ? Math.max(0, until - leg.runningSince) : 0;
  return {
    ...replaceCurrent(trip, {
      ...leg,
      accumMs: leg.accumMs + ranMs,
      spans: legSpans(leg, until),
      runningSince: trip.paused ? null : now,
      track: breakTrack(leg.track),
    }),
    stepsUsable: false,
    stepsStale: false,
    stepsLost: true,
    stepsNow: null,
    stepsAtPause: null,
  };
}

/**
 * Copia da scrivere su disco come bozza: senza percorso e senza posizioni.
 * Così sul telefono non resta mai scritta una coordinata.
 */
export function forDraft(trip: ActiveTrip, savedAt: number): ActiveTrip {
  return {
    ...trip,
    path: [],
    legs: trip.legs.map((leg) => ({ ...leg, track: withoutCoordinates(leg.track) })),
    savedAt,
  };
}
