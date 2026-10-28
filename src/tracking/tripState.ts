/**
 * Stato del tragitto in corso e sue trasformazioni.
 *
 * Tutte le funzioni qui sono pure (dato uno stato ne restituiscono uno nuovo),
 * così si verificano con i test. I sensori vivono in tracker.ts, il
 * contenitore dello stato e la bozza su disco in store.ts.
 */
import {
  EMPTY_TRACK,
  MAX_ACCURACY_M,
  VEHICLE_MAX_ACCURACY_M,
  addFix,
  breakTrack,
  closeTrack,
  withoutCoordinates,
  type Bridge,
  type FastSpan,
  type Fix,
  haversineM,
  type TrackState,
} from '../core/geo';
import { boardedVehicle, type Sample, type Sighting } from '../core/busMatch';
import { HOP_MIN_M, TRIP_STATION_RADIUS_M, metroHop } from '../core/metro';
import { getMode, type ModeId } from '../core/modes';
import type { LegInput } from '../core/scoring';
import { matchBusLine } from '../core/busShape';
import { BUS_ROMA } from '../data/bus';
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
  /**
   * Il tratto precedente era con i mezzi pubblici e si è chiuso senza una
   * posizione recente (cambio di mezzo fatto sottoterra): la strada tra
   * l'ultima posizione nota e la prima nuova appartiene a lui, non a questo.
   * Resta vero finché non arriva una posizione che lo decide.
   */
  handover?: boolean;
  /**
   * Solo con i mezzi pubblici: posizioni del telefono ogni qualche secondo
   * (in memoria, mai su disco) e i mezzi in tempo reale trovati accanto.
   */
  bus?: { samples: Sample[]; sightings: Sighting[] };
  /** L'utente ha detto che il pezzo troppo veloce non era un mezzo pubblico: non si chiede più. */
  transitDismissed?: boolean;
};

/** Ogni quanto si tiene una posizione per il confronto con i bus. */
export const BUS_SAMPLE_MS = 8000;
const BUS_MAX_SAMPLES = 900;

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
const metroBridge: Bridge = (from, to, straightM) => metroHop(ROMA, from, to, straightM, TRIP_STATION_RADIUS_M);
const bridgeFor = (mode: ModeId): Bridge | undefined => (mode === 'tpl' ? metroBridge : undefined);

/** Precisione minima delle posizioni usate per la distanza: più larga sui mezzi. */
const accuracyFor = (mode: ModeId): number => (getMode(mode).maxSegmentMs >= 30 ? VEHICLE_MAX_ACCURACY_M : MAX_ACCURACY_M);

/** Mezzi a forza di gambe: un pezzo troppo veloce per loro può essere un mezzo pubblico dimenticato. */
export const HUMAN_MODES: readonly ModeId[] = ['piedi', 'bici', 'ebike'];
/**
 * Sopra questa velocità media, un pezzo senza posizioni tra due stazioni non
 * è stato fatto con le proprie gambe (9 km/h a piedi, 29 km/h in bici).
 */
const TRANSIT_ABOVE_MS: Partial<Record<ModeId, number>> = { piedi: 2.5, bici: 8, ebike: 8 };
function fastBridgeFor(mode: ModeId): Bridge | undefined {
  const above = TRANSIT_ABOVE_MS[mode];
  if (above == null) return undefined;
  return (from, to, straightM) => {
    const seconds = (to.t - from.t) / 1000;
    return seconds > 0 && straightM / seconds > above ? metroHop(ROMA, from, to, straightM, TRIP_STATION_RADIUS_M) : null;
  };
}

/** Il tratto corrente riparte da dove è arrivato un altro tracciato, senza ereditarne i metri. */
function continueFrom(track: TrackState): TrackState {
  return { ...EMPTY_TRACK, last: track.last, estimate: track.estimate, lastRaw: track.lastRaw, pending: track.pending };
}

/**
 * Prima posizione dopo un cambio di mezzo fatto sottoterra (vedi `handover`).
 *
 * Se è lontana dall'ultima nota, quella strada è stata fatta con il mezzo di
 * prima: viene accreditata al tratto precedente (con i metri della rete, se
 * le due posizioni sono a due stazioni), insieme al tempo trascorso, e il
 * tratto corrente riparte dal punto di arrivo. Senza questo, il viaggio in
 * metro finirebbe sul conto di "A piedi" e verrebbe scartato per la velocità.
 *
 * @returns null se la posizione va trattata normalmente
 */
function handOver(trip: ActiveTrip, fix: Fix): { trip: ActiveTrip; credited: Fix | null } | null {
  const current = currentLeg(trip);
  const previous = trip.legs[trip.legs.length - 2];
  const from = previous?.track.last;
  const usable = !fix.mocked && fix.accuracy != null && fix.accuracy <= MAX_ACCURACY_M;
  // Posizione inutilizzabile: si aspetta la prossima.
  if (previous && from && !usable) return null;

  const settle = (prev: ActiveLeg, cur: ActiveLeg) => ({ ...trip, legs: [...trip.legs.slice(0, -2), prev, cur] });
  // Ancora vicino a dove si è cambiato mezzo: nessun viaggio da attribuire.
  if (!previous || !from || haversineM(from, fix) < HOP_MIN_M) {
    return previous ? applyOne(settle(previous, { ...current, handover: false }), fix) : null;
  }

  const result = addFix(previous.track, fix, getMode(previous.mode).maxSegmentMs, bridgeFor(previous.mode));
  const arrived = result.state.last;
  if (result.state.distanceM > previous.track.distanceM && arrived) {
    // Il tempo passato dal cambio di mezzo all'arrivo è tempo di viaggio del tratto precedente.
    const since = current.runningSince;
    const moved = since != null ? Math.max(0, arrived.t - since) : 0;
    const spans = previous.spans && previous.spans.length > 0 && moved > 0
      ? [...previous.spans.slice(0, -1), [previous.spans[previous.spans.length - 1][0], arrived.t] as [number, number]]
      : previous.spans;
    return {
      trip: settle(
        { ...previous, track: { ...result.state, pending: null, suspect: null }, accumMs: previous.accumMs + moved, spans },
        { ...current, handover: false, runningSince: since != null ? since + moved : since, track: continueFrom(result.state) },
      ),
      credited: result.credited,
    };
  }
  if (result.state.rejectedM > previous.track.rejectedM || result.state.last !== previous.track.last) {
    // Troppo veloce anche per un treno, o un salto del GPS: quella strada non
    // va a nessuno dei due tratti. Si riparte da qui.
    return { trip: settle(previous, { ...current, handover: false, track: continueFrom(result.state) }), credited: null };
  }
  // Una sola posizione lontana non basta: serve la conferma della successiva.
  return { trip: settle({ ...previous, track: result.state }, current), credited: null };
}

function applyOne(trip: ActiveTrip, fix: Fix): { trip: ActiveTrip; credited: Fix | null } {
  const leg = currentLeg(trip);
  if (leg.handover) {
    const handed = handOver(trip, fix);
    if (handed) return handed;
  }
  const result = addFix(leg.track, fix, getMode(leg.mode).maxSegmentMs, bridgeFor(leg.mode), fastBridgeFor(leg.mode), accuracyFor(leg.mode));
  const bus = BUS_MODES.includes(leg.mode) ? withSample(leg.bus, fix) : leg.bus;
  if (result.state === leg.track && bus === leg.bus) return { trip, credited: result.credited };
  return { trip: replaceCurrent(trip, { ...leg, track: result.state, ...(bus ? { bus } : {}) }), credited: result.credited };
}

function withSample(bus: ActiveLeg['bus'], fix: Fix): ActiveLeg['bus'] {
  const current = bus ?? { samples: [], sightings: [] };
  const last = current.samples[current.samples.length - 1];
  if (last && fix.t - last.t < BUS_SAMPLE_MS) return bus;
  // Per il confronto con le fermate basta una posizione approssimata: dentro un bus il GPS è spesso impreciso.
  if ((fix.accuracy ?? 0) > 100) return bus;
  return { ...current, samples: [...current.samples, { t: fix.t, lat: fix.lat, lon: fix.lon }].slice(-BUS_MAX_SAMPLES) };
}

/**
 * Tratti in cui si confronta la traccia con i bus in tempo reale: i mezzi
 * pubblici, e "A piedi" quando si va troppo veloci (bus preso senza cambiare
 * mezzo: se il bus viene trovato, il pezzo riattribuito risulta verificato).
 */
export const BUS_MODES: readonly ModeId[] = ['tpl', 'piedi'];

/** Mezzi in tempo reale trovati accanto al telefono nel tratto corrente. */
export function addSightings(trip: ActiveTrip, found: Sighting[]): ActiveTrip {
  const leg = currentLeg(trip);
  if (!BUS_MODES.includes(leg.mode) || found.length === 0) return trip;
  const bus = leg.bus ?? { samples: [], sightings: [] };
  return replaceCurrent(trip, { ...leg, bus: { ...bus, sightings: [...bus.sightings, ...found].slice(-300) } });
}

/** Nuove posizioni dal GPS. In pausa vengono ignorate. */
export function applyFixes(trip: ActiveTrip, fixes: Fix[]): ActiveTrip {
  if (trip.paused || fixes.length === 0) return trip;
  let next = trip;
  let path = trip.path;
  for (const fix of fixes) {
    const result = applyOne(next, fix);
    next = result.trip;
    if (result.credited) {
      path = [...path, { lat: result.credited.lat, lon: result.credited.lon }];
    }
  }
  if (next === trip) return trip;
  while (path.length > MAX_PATH_POINTS) {
    // Si dimezza la risoluzione tenendo l'ultimo punto.
    const full = path;
    path = full.filter((_, i) => i % 2 === 0 || i === full.length - 1);
  }
  return { ...next, path };
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
    track: closeTrack(leg.track, getMode(leg.mode).maxSegmentMs, bridgeFor(leg.mode), fastBridgeFor(leg.mode)),
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
    // Dai mezzi pubblici si può scendere sottoterra, dove la posizione non arriva.
    handover: closed.mode === 'tpl' && closed.track.last != null,
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
      track: closeTrack(leg.track, getMode(leg.mode).maxSegmentMs, bridgeFor(leg.mode), fastBridgeFor(leg.mode)),
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
      handover: false,
    }),
    paused: false,
    stepsAtPause: null,
  };
}

/**
 * Dati dei tratti nella forma che serve al punteggio.
 * @param final a tragitto concluso: accredita anche l'ultimo pezzo del tratto aperto
 */
function busOf(leg: ActiveLeg, final: boolean): Pick<LegInput, 'bus' | 'busShape'> {
  if (leg.mode !== 'tpl' || !leg.bus) return {};
  const found = boardedVehicle(leg.bus.sightings);
  if (found) return { bus: { line: found.routeId } };
  // Senza il tempo reale: la linea dal percorso, solo a fine tragitto (il calcolo non serve a ogni secondo).
  if (!final || (leg.track.hops?.length ?? 0) > 0) return {};
  const shape = matchBusLine(BUS_ROMA, leg.bus.samples);
  return shape ? { busShape: { line: shape.line, tram: shape.tram, from: shape.from, to: shape.to, meters: shape.meters } } : {};
}

export function toLegInputs(trip: ActiveTrip, now: number, final = false): LegInput[] {
  return trip.legs.map((leg) => {
    const track =
      final && !leg.closed && !trip.paused ? closeTrack(leg.track, getMode(leg.mode).maxSegmentMs, bridgeFor(leg.mode), fastBridgeFor(leg.mode)) : leg.track;
    return {
      mode: leg.mode,
      gpsM: track.distanceM,
      rejectedM: track.rejectedM,
      seconds: Math.round(legElapsedMs(leg, now) / 1000),
      steps: legSteps(trip, leg),
      stepsComplete: !leg.backgrounded,
      mocked: track.mocked,
      hops: track.hops,
      ...busOf(leg, final),
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
      handover: false,
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
    legs: trip.legs.map((leg) => ({
      ...leg,
      track: withoutCoordinates(leg.track),
      ...(leg.bus ? { bus: { samples: [], sightings: leg.bus.sightings } } : {}),
    })),
    savedAt,
  };
}

// ---------- mezzo pubblico dimenticato ----------

/** Sotto questi metri troppo veloci è rumore del GPS, non un viaggio su un mezzo. */
export const TRANSIT_MIN_M = 300;
/** Se l'ultimo pezzo veloce è più recente di così, si è ancora sul mezzo. */
export const STILL_ON_BOARD_MS = 2 * 60 * 1000;

/** Il pezzo troppo veloce di un tratto a piedi o in bici, se è abbastanza lungo da essere un viaggio. */
export function transitSpan(leg: ActiveLeg): FastSpan | null {
  const fast = leg.track.fast;
  if (!HUMAN_MODES.includes(leg.mode) || !fast || fast.rejectedM < TRANSIT_MIN_M) return null;
  return fast;
}

/** Il pezzo veloce è un viaggio in metro riconosciuto dalle stazioni: si può riattribuire senza chiedere. */
export function isMetroSpan(fast: FastSpan): boolean {
  const onNetwork = fast.hops.reduce((sum, h) => sum + h.meters, 0);
  return fast.hops.length > 0 && onNetwork >= (fast.rejectedM + fast.extraM) * 0.5;
}

/** Tratti con un pezzo veloce ancora da decidere (non metro, non già rifiutato). */
export function pendingTransit(trip: ActiveTrip): { leg: ActiveLeg; fast: FastSpan } | null {
  for (const leg of trip.legs) {
    const fast = transitSpan(leg);
    if (fast && !isMetroSpan(fast) && !leg.transitDismissed && !spanBus(leg, fast) && !legBusSpan(leg)) return { leg, fast };
  }
  return null;
}

const busMemo = new WeakMap<object, ReturnType<typeof matchBusLine>>();
const legBusMemo = new WeakMap<object, FastSpan | null>();

/** Lunghezza della spezzata delle posizioni tra due istanti. */
function pathLength(samples: readonly { t: number; lat: number; lon: number }[], from: number, to: number): number {
  let m = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a.t >= from && b.t <= to) m += haversineM(a, b);
  }
  return m;
}

/**
 * Bus preso con il tratto "A piedi" senza mai superare la velocità massima
 * della camminata (un bus nel traffico va spesso sotto i 20 km/h): se le
 * posizioni seguono le fermate di una linea, il pezzo tra la prima e
 * l'ultima fermata riconosciuta diventa un pezzo veloce da riattribuire.
 * I metri accreditati prima e dopo si dividono in proporzione alla strada
 * fatta secondo le posizioni.
 */
export function legBusSpan(leg: ActiveLeg): FastSpan | null {
  if (leg.mode !== 'piedi') return null;
  const samples = leg.bus?.samples;
  if (!samples || samples.length < 3) return null;
  const cached = legBusMemo.get(samples);
  if (cached !== undefined) return cached;
  const shape = matchBusLine(BUS_ROMA, samples);
  let span: FastSpan | null = null;
  if (shape) {
    const total = pathLength(samples, -Infinity, Infinity);
    const before = pathLength(samples, -Infinity, shape.fromT);
    const during = pathLength(samples, shape.fromT, shape.toT);
    const k = total > 0 ? leg.track.distanceM / total : 0;
    const startM = before * k;
    const endM = (before + during) * k;
    const rejected = leg.track.rejectedM;
    span = {
      t: shape.fromT,
      startM,
      endT: shape.toT,
      endM,
      rejectedM: rejected,
      extraM: Math.max(0, shape.meters - (endM - startM) - rejected),
      hops: [],
    };
  }
  legBusMemo.set(samples, span);
  return span;
}

/**
 * Il pezzo veloce segue le fermate di una linea di bus o tram: è un mezzo
 * pubblico anche senza chiederlo. Il risultato si ricorda per la stessa
 * serie di posizioni, perché la schermata lo chiede a ogni secondo.
 */
export function spanBus(leg: ActiveLeg, fast: FastSpan): ReturnType<typeof matchBusLine> {
  const samples = leg.bus?.samples;
  if (!samples || samples.length < 3) return null;
  const cached = busMemo.get(samples);
  if (cached !== undefined) return cached;
  const window = samples.filter((x) => x.t >= fast.t - 30_000 && x.t <= fast.endT + 30_000);
  const found = matchBusLine(BUS_ROMA, window);
  busMemo.set(samples, found);
  return found;
}

/** L'utente dice che il pezzo veloce non era un mezzo pubblico. */
export function dismissTransit(trip: ActiveTrip): ActiveTrip {
  return { ...trip, legs: trip.legs.map((leg) => (transitSpan(leg) ? { ...leg, transitDismissed: true } : leg)) };
}

const spanMs = (spans: [number, number][]) => spans.reduce((sum, [a, b]) => sum + Math.max(0, b - a), 0);

/** Gli intervalli ritagliati tra `from` e `to`. */
function clip(spans: [number, number][], from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of spans) {
    const x = Math.max(a, from);
    const y = Math.min(b, to);
    if (y > x) out.push([x, y]);
  }
  return out;
}

/**
 * Divide un tratto a piedi o in bici con un pezzo troppo veloce in: il tratto
 * prima, il viaggio con i mezzi pubblici e il tratto dopo. I metri scartati
 * per la velocità passano ai mezzi pubblici (con i metri della rete, se è un
 * viaggio in metro), insieme al tempo e ai metri fatti in mezzo.
 * I passi si dividono tra i due pezzi a piedi in proporzione alla distanza.
 */
function splitLeg(trip: ActiveTrip, leg: ActiveLeg, fast: FastSpan, now: number, stillOnBoard: boolean): ActiveLeg[] {
  const open = !leg.closed;
  const allSpans = legSpans(leg, now);
  const steps = legSteps(trip, leg);
  const before = fast.startM;
  const after = Math.max(0, leg.track.distanceM - fast.endM);
  const walkSteps = (meters: number) => (steps == null ? null : before + after > 0 ? Math.round((steps * meters) / (before + after)) : 0);
  const mocked = leg.track.mocked;
  const transitM = Math.max(0, fast.endM - fast.startM) + fast.rejectedM + fast.extraM;

  const seen = (leg.bus?.sightings ?? []).filter((x) => x.t >= fast.t - 60_000 && x.t <= fast.endT + 60_000);
  const windowSamples = (leg.bus?.samples ?? []).filter((x) => x.t >= fast.t - 30_000 && x.t <= fast.endT + 30_000);
  const first: ActiveLeg = {
    ...leg,
    bus: undefined,
    track: { ...EMPTY_TRACK, distanceM: before, mocked, ...(leg.track.hops ? { hops: leg.track.hops } : {}) },
    spans: clip(allSpans, -Infinity, fast.t),
    accumMs: spanMs(clip(allSpans, -Infinity, fast.t)),
    runningSince: null,
    finalSteps: walkSteps(before),
    closed: true,
    handover: false,
    transitDismissed: false,
  };
  const rest = leg.track.rejectedM - fast.rejectedM;

  if (open && stillOnBoard) {
    // Ancora sul mezzo: il tratto dei mezzi pubblici diventa quello corrente e continua.
    const runningSpans = (leg.spans ?? []).filter(([, b]) => b > fast.t);
    const ride: ActiveLeg = {
      ...newLeg('tpl', now, leg.stepBase != null && steps != null ? leg.stepBase + (first.finalSteps ?? 0) : null),
      track: { ...leg.track, distanceM: leg.track.distanceM - before + fast.rejectedM + fast.extraM, rejectedM: Math.max(0, rest), hops: fast.hops, fast: undefined },
      spans: clip(runningSpans, fast.t, Infinity),
      accumMs: spanMs(clip(runningSpans, fast.t, Infinity)),
      runningSince: leg.runningSince != null ? Math.max(leg.runningSince, fast.t) : null,
      backgrounded: leg.backgrounded,
      ...(leg.bus ? { bus: leg.bus } : {}),
    };
    return [first, ride];
  }

  const rideSpans = clip(allSpans, fast.t, fast.endT);
  const ride: ActiveLeg = {
    ...newLeg('tpl', now, null),
    track: { ...EMPTY_TRACK, distanceM: transitM, mocked, hops: fast.hops },
    spans: rideSpans,
    accumMs: spanMs(rideSpans),
    runningSince: null,
    finalSteps: null,
    closed: true,
    backgrounded: leg.backgrounded,
    ...((seen.length > 0 || windowSamples.length > 0) ? { bus: { samples: windowSamples, sightings: seen } } : {}),
  };
  const afterTrack: TrackState = { ...leg.track, distanceM: after, rejectedM: Math.max(0, rest), hops: undefined, fast: undefined };
  if (open) {
    const done = clip(leg.spans ?? [], fast.endT, Infinity);
    const second: ActiveLeg = {
      ...leg,
      bus: leg.bus ? { samples: leg.bus.samples.filter((x) => x.t >= fast.endT), sightings: [] } : undefined,
      track: afterTrack,
      spans: done,
      accumMs: spanMs(done),
      runningSince: leg.runningSince != null ? Math.max(leg.runningSince, fast.endT) : null,
      stepBase: leg.stepBase != null && first.finalSteps != null ? leg.stepBase + first.finalSteps : leg.stepBase,
      handover: false,
      transitDismissed: false,
    };
    return [first, ride, second];
  }
  const tail = clip(allSpans, fast.endT, Infinity);
  const second: ActiveLeg = { ...leg, bus: undefined, track: afterTrack, spans: tail, accumMs: spanMs(tail), finalSteps: walkSteps(after), transitDismissed: false };
  return [first, ride, second];
}

/**
 * Riattribuisce ai mezzi pubblici i pezzi troppo veloci dei tratti a piedi o
 * in bici. `which`: 'metro' solo quelli riconosciuti dalle stazioni (sicuri),
 * 'tutti' anche gli altri (quando l'utente conferma di essere stato su un mezzo).
 */
/**
 * `which`: 'metro' solo i viaggi in metro riconosciuti dalle stazioni; 'bus'
 * anche quelli che seguono le fermate di una linea; 'tutti' anche gli altri,
 * quando l'utente conferma di essere stato su un mezzo.
 */
export function splitTransit(trip: ActiveTrip, now: number, which: 'metro' | 'bus' | 'tutti'): ActiveTrip {
  let changed = false;
  const legs: ActiveLeg[] = [];
  trip.legs.forEach((leg, i) => {
    const own = transitSpan(leg);
    // Un bus lento non lascia pezzi "troppo veloci": lo si cerca dalle fermate.
    const viaStops = which !== 'metro' && !leg.transitDismissed && (!own || !isMetroSpan(own)) && !(own && spanBus(leg, own)) ? legBusSpan(leg) : null;
    const fast = viaStops ?? own;
    const wanted = fast && (viaStops || isMetroSpan(fast) || (which === 'tutti' && !leg.transitDismissed) || (which === 'bus' && !!spanBus(leg, fast)));
    if (!fast || !wanted) {
      legs.push(leg);
      return;
    }
    changed = true;
    const last = i === trip.legs.length - 1;
    const onBoard = last && !leg.closed && which === 'tutti' && !isMetroSpan(fast) && now - fast.endT < STILL_ON_BOARD_MS;
    legs.push(...splitLeg(trip, leg, fast, now, onBoard));
  });
  return changed ? { ...trip, legs } : trip;
}

/**
 * Alla chiusura del tragitto: accredita l'ultimo pezzo del tratto aperto (chi
 * esce dalla metro e chiude subito ha proprio lì il viaggio) e riattribuisce
 * i pezzi veloci ai mezzi pubblici.
 */
export function settleTransit(trip: ActiveTrip, now: number, which: 'metro' | 'bus' | 'tutti'): ActiveTrip {
  const leg = currentLeg(trip);
  const closedTrack = trip.paused || leg.closed ? leg.track : closeTrack(leg.track, getMode(leg.mode).maxSegmentMs, bridgeFor(leg.mode), fastBridgeFor(leg.mode));
  const ready = closedTrack === leg.track ? trip : replaceCurrent(trip, { ...leg, track: closedTrack });
  return splitTransit(ready, now, which);
}
