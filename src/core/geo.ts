/**
 * Accumulo della distanza da una sequenza di posizioni GPS.
 *
 * Il GPS sbaglia in tre modi: oscilla attorno a un punto fermo (distanza
 * gonfiata), ogni tanto salta lontano (distanza inventata) e in città si
 * sposta di lato per i riflessi sui palazzi. Le difese, in ordine:
 *
 *  1. Cancello: una posizione troppo lontana dalla precedente per essere
 *     stata raggiunta nel tempo trascorso viene tenuta da parte. Se la
 *     successiva la conferma era vera, altrimenti si butta.
 *  2. Lisciatura: ogni posizione viene mediata con le precedenti, pesandola
 *     con l'incertezza dichiarata (filtro di Kalman a una variabile per asse).
 *  3. Soglia: uno spostamento conta solo se supera l'incertezza.
 *  4. Conferma: anche la posizione successiva deve restare lontana dal
 *     riferimento. Un punto isolato che "torna indietro" è un errore.
 *  5. Riscontro: serve un indizio di movimento vero, cioè la velocità
 *     misurata dal ricevitore su due letture di fila, oppure uno spostamento
 *     nettamente più grande dell'incertezza.
 *
 * I metri percorsi a velocità impossibile per il mezzo dichiarato non vengono
 * accreditati ma contati a parte: è il dato su cui si basa il controllo.
 *
 * I valori delle soglie sono stati scelti con una simulazione (geo.sim.test.ts)
 * e vanno ricalibrati con le prove su strada.
 */

export type Fix = {
  lat: number;
  lon: number;
  /** Millisecondi dall'epoca. */
  t: number;
  /** Raggio di incertezza orizzontale in metri, se noto. */
  accuracy: number | null;
  /** Velocità istantanea in m/s misurata dal ricevitore; null o 0 se non nota. */
  speed?: number | null;
  /** Posizione generata da un'app di simulazione (solo Android). */
  mocked?: boolean;
  /** Istante in cui l'app ha ricevuto la posizione, secondo l'orologio del telefono. */
  seenAt?: number;
};

type Estimate = { lat: number; lon: number; variance: number; t: number };

export type TrackState = {
  /** Metri accreditati. */
  distanceM: number;
  /** Metri percorsi a velocità non credibile per il mezzo dichiarato. */
  rejectedM: number;
  /** Ultimo punto confermato, usato come riferimento. */
  last: Fix | null;
  /** Punto lontano dal riferimento in attesa di conferma dal successivo. */
  pending: Fix | null;
  /** Posizione lisciata corrente. */
  estimate: Estimate | null;
  /** Ultima posizione grezza accettata: il termine di paragone del cancello. */
  lastRaw: Fix | null;
  /** Posizione troppo lontana dalla precedente, in attesa di conferma o smentita. */
  suspect: Fix | null;
  /** Numero di posizioni utilizzabili ricevute. */
  accepted: number;
  /** Numero di posizioni simulate ricevute. */
  mocked: number;
  /**
   * Tratti in cui la distanza non viene dalla linea d'aria tra due posizioni
   * ma da un calcolo esterno (per esempio la rete della metro). Solo nomi e
   * metri, nessuna coordinata. I metri sono già compresi in distanceM.
   */
  hops?: TrackHop[];
};

export type TrackHop = { label: string; lines: string; meters: number };

/**
 * Chiamata quando due posizioni confermate di fila sono lontane tra loro:
 * può dire che quel tratto vale una distanza diversa dalla linea d'aria
 * (sottoterra il GPS non arriva, ma la rete della metro si conosce).
 * Null per lasciare la linea d'aria.
 */
export type Bridge = (from: Fix, to: Fix, straightM: number) => TrackHop | null;

export const EMPTY_TRACK: TrackState = {
  distanceM: 0,
  rejectedM: 0,
  last: null,
  pending: null,
  estimate: null,
  lastRaw: null,
  suspect: null,
  accepted: 0,
  mocked: 0,
};

/** Oltre questa incertezza la posizione non viene usata. */
export const MAX_ACCURACY_M = 40;
/** Spostamento minimo per contare un tratto. */
export const MIN_STEP_M = 10;
/** Oltre questa velocità è un salto del GPS, non un movimento. */
export const GLITCH_MS = 100;
/** Velocità misurata sopra la quale il telefono si sta davvero muovendo. */
export const MOVING_MS = 0.5;
/** Senza riscontro di velocità lo spostamento deve superare la soglia di questo fattore. */
export const BIG_MOVE_FACTOR = 2.5;
/** Alla chiusura di un tratto si accredita anche l'ultimo pezzo, se supera questi metri. */
export const CLOSE_MIN_M = 5;
/**
 * Velocità oltre la quale uno spostamento tra due letture è un errore del
 * ricevitore e non un viaggio, qualunque sia il mezzo (270 km/h).
 */
export const TELEPORT_MS = 75;

/**
 * All'avvio il telefono può consegnare per prima una posizione vecchia, tenuta
 * in memoria da prima: se la successiva arriva "più fresca" di almeno questo
 * tempo, la prima era una copia e non il punto di partenza.
 */
export const STALE_FIRST_MS = 20_000;

const R = 6371008.8;
const M_PER_DEG_LAT = 111_195;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Distanza in metri tra due punti (formula dell'emisenoverso). */
export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * La prima posizione era vecchia? Si confronta quanto tempo è passato, per
 * ognuna, tra la misura e la consegna all'app: così non serve che l'orologio
 * del telefono sia giusto, basta che sia lo stesso per entrambe. Una consegna
 * in ritardo della seconda (app in secondo piano) non fa scattare nulla.
 */
function firstWasStale(first: Fix, next: Fix): boolean {
  if (first.seenAt == null || next.seenAt == null) return false;
  return first.seenAt - first.t - (next.seenAt - next.t) > STALE_FIRST_MS;
}

const knownSpeed = (fix: Fix) => (fix.speed != null && fix.speed > 0 ? fix.speed : null);
const isMoving = (fix: Fix) => (knownSpeed(fix) ?? 0) >= MOVING_MS;

/** Quanto può cambiare la posizione vera in un secondo quando non si sa nulla, in metri. */
export const BASE_AGILITY_MS = 2;

/**
 * Quanto può cambiare la posizione vera in un secondo, in metri: più è alto,
 * meno il filtro liscia. Parte basso (telefono fermo o a passo d'uomo) e sale
 * solo con la velocità misurata dal ricevitore. Provato e scartato: farlo
 * salire anche quando la posizione si allontana dalla stima, perché così il
 * filtro insegue proprio i salti che deve ignorare.
 */
function agility(fix: Fix, maxSegmentMs: number): number {
  return Math.min(maxSegmentMs, Math.max(BASE_AGILITY_MS, (knownSpeed(fix) ?? 0) * 1.5));
}

/** Media la nuova posizione con la stima precedente, pesandola con l'incertezza. */
function smooth(previous: Estimate | null, fix: Fix, accuracy: number, maxSegmentMs: number): Estimate {
  if (!previous || fix.t <= previous.t) {
    return { lat: fix.lat, lon: fix.lon, variance: accuracy ** 2, t: fix.t };
  }
  const dt = Math.max(0.5, (fix.t - previous.t) / 1000);
  const predicted = previous.variance + (agility(fix, maxSegmentMs) * dt) ** 2;
  const gain = predicted / (predicted + accuracy ** 2);
  return {
    lat: previous.lat + gain * (fix.lat - previous.lat),
    lon: previous.lon + gain * (fix.lon - previous.lon),
    variance: (1 - gain) * predicted,
    t: fix.t,
  };
}

/**
 * Aggiunge una posizione al tracciato.
 * @param maxSegmentMs velocità massima credibile per il mezzo, in m/s
 * @param bridge se presente, decide quanto vale un tratto senza posizioni in mezzo
 * @returns il nuovo stato e il punto appena accreditato, se c'è (per il disegno)
 */
export function addFix(
  state: TrackState,
  raw: Fix,
  maxSegmentMs: number,
  bridge?: Bridge,
): { state: TrackState; credited: Fix | null } {
  if (raw.mocked) {
    return { state: { ...state, mocked: state.mocked + 1 }, credited: null };
  }
  if (raw.accuracy == null || raw.accuracy > MAX_ACCURACY_M) {
    return { state, credited: null };
  }
  if (state.estimate && raw.t <= state.estimate.t) return { state, credited: null };

  // Il riferimento è ancora la primissima posizione ricevuta, e si scopre che
  // era vecchia: si riparte da questa, senza contare la strada tra le due.
  if (state.last && state.lastRaw && state.last.t === state.lastRaw.t && firstWasStale(state.lastRaw, raw)) {
    state = { ...state, last: null, pending: null, estimate: null, lastRaw: null, suspect: null };
  }

  // Cancello: fin dove ci si può essere spostati, al massimo, dall'ultima posizione?
  // Il limite non dipende dal mezzo dichiarato: serve a scartare gli errori del
  // ricevitore, non a giudicare l'utente (quello lo fa il controllo di velocità).
  let previous = state.estimate;
  if (state.lastRaw) {
    const accuracy = raw.accuracy;
    const limit = Math.max(TELEPORT_MS, maxSegmentMs * 1.5);
    const reach = (from: Fix) => Math.max(3 * accuracy, limit * ((raw.t - from.t) / 1000) + accuracy);
    if (haversineM(state.lastRaw, raw) > reach(state.lastRaw)) {
      const agrees = state.suspect && raw.t > state.suspect.t && haversineM(state.suspect, raw) <= reach(state.suspect);
      if (!agrees) {
        return { state: { ...state, suspect: raw }, credited: null };
      }
      // Due posizioni di fila lontane dalla precedente ma coerenti tra loro:
      // lo spostamento è vero. La stima riparte da qui.
      previous = null;
    }
  }

  const estimate = smooth(previous, raw, raw.accuracy, maxSegmentMs);
  const fix: Fix = { ...raw, lat: estimate.lat, lon: estimate.lon };
  const base: TrackState = { ...state, estimate, lastRaw: raw, suspect: null, accepted: state.accepted + 1 };

  if (!base.last) {
    return { state: { ...base, last: fix, pending: null }, credited: fix };
  }

  const threshold = Math.max(MIN_STEP_M, raw.accuracy);
  if (haversineM(base.last, fix) < threshold) {
    // Di nuovo vicino al riferimento: l'eventuale punto in attesa era un errore.
    return { state: { ...base, pending: null }, credited: null };
  }
  if (!base.pending) {
    return { state: { ...base, pending: fix }, credited: null };
  }

  // Due posizioni di fila lontane dal riferimento. Prima di contare serve un
  // riscontro: velocità misurata su entrambe, oppure uno spostamento netto.
  const confirmed = base.pending;
  const d = haversineM(base.last, confirmed);
  const corroborated = (isMoving(confirmed) && isMoving(fix)) || d >= BIG_MOVE_FACTOR * threshold;
  if (!corroborated) {
    return { state: { ...base, pending: fix }, credited: null };
  }

  const dt = (confirmed.t - base.last.t) / 1000;
  const speed = dt > 0 ? d / dt : Infinity;
  const stillFar = haversineM(confirmed, fix) >= threshold;
  const next: TrackState = { ...base, last: confirmed, pending: stillFar ? fix : null };

  if (speed > GLITCH_MS) {
    // Salto: si riparte dal nuovo punto senza contare nulla.
    return { state: next, credited: null };
  }
  if (speed > maxSegmentMs) {
    return { state: { ...next, rejectedM: state.rejectedM + d }, credited: null };
  }
  const hop = bridge ? bridge(base.last, confirmed, d) : null;
  if (hop && dt > 0 && hop.meters / dt <= maxSegmentMs) {
    return {
      state: { ...next, distanceM: state.distanceM + hop.meters, hops: [...(state.hops ?? []), hop] },
      credited: confirmed,
    };
  }
  return { state: { ...next, distanceM: state.distanceM + d }, credited: confirmed };
}

/**
 * Chiude un tratto accreditando l'ultimo pezzo, dal riferimento alla posizione
 * lisciata corrente, che altrimenti andrebbe perso. Vale con lo stesso
 * riscontro richiesto durante il tragitto: il telefono si stava muovendo
 * all'ultima lettura, oppure lo spostamento è netto.
 * @param bridge come in addFix: decide quanto vale un pezzo senza posizioni in mezzo
 */
export function closeTrack(state: TrackState, maxSegmentMs: number, bridge?: Bridge): TrackState {
  const { last, estimate, lastRaw } = state;
  if (!last || !estimate || !lastRaw) return state;
  const d = haversineM(last, estimate);
  const dt = (estimate.t - last.t) / 1000;
  const corroborated = isMoving(lastRaw) || d >= BIG_MOVE_FACTOR * Math.max(MIN_STEP_M, lastRaw.accuracy ?? 0);
  if (d < CLOSE_MIN_M || dt <= 0 || d / dt > maxSegmentMs || !corroborated) return state;
  const end: Fix = { lat: estimate.lat, lon: estimate.lon, t: estimate.t, accuracy: Math.sqrt(estimate.variance) };
  // Chi esce dalla metro e chiude subito: l'ultimo pezzo è proprio il viaggio sottoterra.
  const hop = bridge ? bridge(last, end, d) : null;
  if (hop && hop.meters / dt <= maxSegmentMs) {
    return { ...state, distanceM: state.distanceM + hop.meters, hops: [...(state.hops ?? []), hop], last: end, pending: null };
  }
  return { ...state, distanceM: state.distanceM + d, last: end, pending: null };
}

/** Dopo una pausa il tratto non percorso "in gara" non va contato. */
export function breakTrack(state: TrackState): TrackState {
  return { ...state, last: null, pending: null, estimate: null, lastRaw: null, suspect: null };
}

/** Toglie le coordinate dallo stato, per poterlo scrivere su disco. */
export function withoutCoordinates(state: TrackState): TrackState {
  return { ...state, last: null, pending: null, estimate: null, lastRaw: null, suspect: null };
}

export { M_PER_DEG_LAT };
