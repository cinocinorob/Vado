/**
 * Rete della metropolitana: stazioni, linee e distanze lungo il tracciato.
 *
 * Sottoterra il GPS non arriva, quindi la distanza di un viaggio in metro non
 * si può misurare: si calcola. Bastano la stazione di ingresso e quella di
 * uscita; i metri vengono dalla rete, non dalla linea d'aria.
 *
 * Qui ci sono solo funzioni pure. I dati di una città stanno in un file a
 * parte (per Roma src/data/metro-roma.json, prodotto da scripts/rete_metro.py
 * a partire dai dati aperti di Roma Servizi per la Mobilità).
 */
import { haversineM, type Fix } from './geo';

export type Station = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Sigle delle linee che fermano qui. */
  lines: string[];
};

export type Line = {
  id: string;
  name: string;
  /** Colore ufficiale della linea, se i dati lo riportano. */
  color: string | null;
  /** Stazioni in ordine, da un capolinea all'altro. */
  stations: string[];
};

/** Il contenuto del file dei dati: [da, a, metri, linee separate da "/"]. */
export type NetworkData = {
  source: string;
  sourceUrl: string;
  downloaded: string;
  lines: Line[];
  stations: Station[];
  edges: [string, string, number, string][];
};

type Link = { to: string; meters: number; lines: string[] };

export type Network = {
  data: NetworkData;
  stations: Map<string, Station>;
  links: Map<string, Link[]>;
};

export function buildNetwork(data: NetworkData): Network {
  const stations = new Map(data.stations.map((s) => [s.id, s]));
  const links = new Map<string, Link[]>(data.stations.map((s) => [s.id, []]));
  for (const [a, b, meters, lines] of data.edges) {
    const served = lines.split('/');
    links.get(a)?.push({ to: b, meters, lines: served });
    links.get(b)?.push({ to: a, meters, lines: served });
  }
  return { data, stations, links };
}

/** La stazione più vicina a un punto, se entro `maxM` metri. */
export function nearestStation(
  network: Network,
  point: { lat: number; lon: number },
  maxM: number,
): { station: Station; meters: number } | null {
  let best: { station: Station; meters: number } | null = null;
  for (const station of network.data.stations) {
    const meters = haversineM(point, station);
    if (meters <= maxM && (!best || meters < best.meters)) best = { station, meters };
  }
  return best;
}

/** Un pezzo di viaggio fatto senza cambiare treno. */
export type Ride = { line: string; from: Station; to: Station; stops: number; meters: number };

export type Route = {
  from: Station;
  to: Station;
  /** Metri lungo il tracciato. */
  meters: number;
  /** Fermate percorse, arrivo compreso. */
  stops: number;
  /** Un elemento per ogni treno preso: più di uno significa un cambio. */
  rides: Ride[];
};

/**
 * Il percorso più corto tra due stazioni (algoritmo di Dijkstra: la rete ha
 * poche decine di nodi, non serve altro). Null se non sono collegate.
 */
export function routeBetween(network: Network, fromId: string, toId: string): Route | null {
  const from = network.stations.get(fromId);
  const to = network.stations.get(toId);
  if (!from || !to || fromId === toId) return null;

  const best = new Map<string, number>([[fromId, 0]]);
  const previous = new Map<string, { from: string; link: Link }>();
  const done = new Set<string>();
  for (;;) {
    let current: string | null = null;
    for (const [id, meters] of best) {
      if (!done.has(id) && (current === null || meters < (best.get(current) ?? Infinity))) current = id;
    }
    if (current === null) return null;
    if (current === toId) break;
    done.add(current);
    const base = best.get(current) ?? 0;
    for (const link of network.links.get(current) ?? []) {
      const meters = base + link.meters;
      if (meters < (best.get(link.to) ?? Infinity)) {
        best.set(link.to, meters);
        previous.set(link.to, { from: current, link });
      }
    }
  }

  const hops: { from: string; link: Link }[] = [];
  for (let id = toId; id !== fromId; ) {
    const step = previous.get(id);
    if (!step) return null;
    hops.unshift(step);
    id = step.from;
  }

  // Si resta sullo stesso treno finché almeno una linea serve tutte le tratte:
  // sul tronco comune a due linee non si conta un cambio che non c'è.
  const rides: Ride[] = [];
  let lines: string[] = [];
  let start = from;
  let meters = 0;
  let stops = 0;
  const close = (end: Station) => rides.push({ line: lines[0], from: start, to: end, stops, meters });
  for (const { from: at, link } of hops) {
    const shared = lines.filter((l) => link.lines.includes(l));
    if (stops > 0 && shared.length === 0) {
      const change = network.stations.get(at);
      if (!change) return null;
      close(change);
      start = change;
      meters = 0;
      stops = 0;
      lines = [...link.lines];
    } else {
      lines = stops === 0 ? [...link.lines] : shared;
    }
    meters += link.meters;
    stops += 1;
  }
  close(to);

  return { from, to, meters: best.get(toId) ?? 0, stops: hops.length, rides };
}

/** "Flaminio → EUR Fermi". */
export function routeLabel(route: Route): string {
  return `${route.from.name} → ${route.to.name}`;
}

/** "Linea A, cambio a Termini, linea B". */
export function routeLines(route: Route): string {
  const text = route.rides.map((ride, i) => (i === 0 ? `Linea ${ride.line}` : `cambio a ${ride.from.name}, linea ${ride.line}`)).join(', ');
  return text;
}

// --- Dentro un tragitto avviato: il GPS sparisce tra due stazioni ---

/** Una posizione è "alla stazione" se dista meno di così dal suo centro. */
export const STATION_RADIUS_M = 300;
/** Sotto questa distanza in linea d'aria non può essere un viaggio in metro. */
export const HOP_MIN_M = 400;
/** Tempo minimo senza posizioni valide perché si possa parlare di un tratto sottoterra. */
export const HOP_MIN_S = 45;
/** Velocità massima di un treno della metro, fermate comprese (80 km/h). */
export const HOP_MAX_MS = 22;

export type Hop = {
  /** "Flaminio → EUR Fermi", solo nomi: nessuna coordinata. */
  label: string;
  /** "Linea A, cambio a Termini, linea B". */
  lines: string;
  /** Metri da accreditare al posto della linea d'aria. */
  meters: number;
};

/**
 * Due posizioni consecutive lontane tra loro, senza nulla in mezzo: se la
 * prima è a una stazione e la seconda a un'altra, e il tempo trascorso è
 * compatibile con un treno, il tratto è stato fatto in metro e vale la
 * distanza lungo la rete.
 *
 * Restituisce null in tutti gli altri casi, e allora resta la linea d'aria.
 */
export function metroHop(network: Network, from: Fix, to: Fix, straightM: number): Hop | null {
  const seconds = (to.t - from.t) / 1000;
  if (straightM < HOP_MIN_M || seconds < HOP_MIN_S) return null;
  const a = nearestStation(network, from, STATION_RADIUS_M);
  const b = nearestStation(network, to, STATION_RADIUS_M);
  if (!a || !b || a.station.id === b.station.id) return null;
  const route = routeBetween(network, a.station.id, b.station.id);
  if (!route) return null;
  // Un percorso sulla rete molto più lungo della linea d'aria non è credibile
  // per chi è partito e arrivato proprio lì.
  if (route.meters > straightM * 3 + 1500) return null;
  if (route.meters / seconds > HOP_MAX_MS) return null;
  // Mai meno di quanto si accreditava prima, cioè la linea d'aria.
  return { label: routeLabel(route), lines: routeLines(route), meters: Math.max(route.meters, straightM) };
}

// --- A posteriori: "Ho preso la metro" ---

/** Quanti tragitti in metro si possono dichiarare a posteriori in un giorno. */
export const DECLARED_PER_DAY = 2;
/** Per dichiarare bisogna essere entro questa distanza dalla stazione di uscita. */
export const ARRIVAL_RADIUS_M = 400;
/** Una posizione più incerta di così non basta a dire a quale stazione si è. */
export const ARRIVAL_MAX_ACCURACY_M = 150;
/** Velocità commerciale della metro, fermate comprese (30 km/h), per stimare la durata. */
export const RIDE_MS = 8.33;
/** Tempo stimato per un cambio di linea. */
export const CHANGE_S = 240;
/** Dopo un tragitto con i mezzi pubblici, per questo tempo non se ne dichiara un altro. */
export const DECLARED_GAP_MS = 10 * 60 * 1000;

/** Durata stimata del viaggio: serve solo a collocarlo nel tempo. */
export function rideSeconds(route: Route): number {
  return Math.round(route.meters / RIDE_MS + (route.rides.length - 1) * CHANGE_S);
}
