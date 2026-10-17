/**
 * Bus e tram: fermate, linee e distanze lungo il percorso. Funzioni pure.
 *
 * Servono a "Ho preso il bus": la fermata di arrivo viene dalla posizione,
 * la linea e la fermata di partenza le sceglie l'utente, e i metri sono quelli
 * lungo il percorso della linea tra le due fermate.
 */
import { haversineM } from './geo';

export type BusData = {
  downloaded: string;
  /** [nome, lat·1e5, lon·1e5] */
  stops: [string, number, number][];
  lines: { n: string; r?: string; t: 0 | 3; c?: string; p: { h: string; s: number[]; d: number[] }[] }[];
};

export type BusStop = { index: number; name: string; lat: number; lon: number };
export type BusPattern = { line: string; routeId: string; tram: boolean; headsign: string; stops: number[]; meters: number[] };
export type BusNetwork = {
  downloaded: string;
  stops: BusStop[];
  patterns: BusPattern[];
  /** Per ogni fermata: (pattern, posizione nella sequenza). */
  at: [number, number][][];
};

export function buildBusNetwork(data: BusData): BusNetwork {
  // Le sigle tra parentesi restano maiuscole: "Termini (MA-MB-FS)", non "(ma-Mb-Fs)".
  const tidy = (name: string) => name.replace(/\(([A-Za-z]{1,3}(?:-[A-Za-z]{1,3})*)\)/g, (_, codes: string) => `(${codes.toUpperCase()})`);
  const stops = data.stops.map(([name, lat, lon], index) => ({ index, name: tidy(name), lat: lat / 1e5, lon: lon / 1e5 }));
  const patterns: BusPattern[] = [];
  for (const line of data.lines) {
    for (const p of line.p) {
      patterns.push({ line: line.n, routeId: line.r ?? line.n, tram: line.t === 0, headsign: tidy(p.h), stops: p.s, meters: p.d });
    }
  }
  const at: [number, number][][] = stops.map(() => []);
  patterns.forEach((p, pi) => p.stops.forEach((s, pos) => at[s].push([pi, pos])));
  return { downloaded: data.downloaded, stops, patterns, at };
}

/** Fermate entro `radius` metri, dalla più vicina. */
export function stopsNear(net: BusNetwork, lat: number, lon: number, radius: number): { stop: BusStop; meters: number }[] {
  const out: { stop: BusStop; meters: number }[] = [];
  // Filtro veloce sul riquadro prima della distanza vera.
  const dLat = radius / 111000;
  const dLon = radius / (111000 * Math.cos((lat * Math.PI) / 180));
  for (const stop of net.stops) {
    if (Math.abs(stop.lat - lat) > dLat || Math.abs(stop.lon - lon) > dLon) continue;
    const m = haversineM({ lat, lon }, { lat: stop.lat, lon: stop.lon });
    if (m <= radius) out.push({ stop, meters: m });
  }
  return out.sort((a, b) => a.meters - b.meters);
}

/** Una linea che passa da una fermata di arrivo, con almeno una fermata prima. */
export type Arrival = { pattern: number; pos: number; stop: BusStop };

/** Le linee con cui si può essere arrivati in una delle fermate vicine: una per linea e capolinea, dalla fermata più vicina. */
export function arrivalsNear(net: BusNetwork, near: { stop: BusStop }[]): Arrival[] {
  const seen = new Set<string>();
  const out: Arrival[] = [];
  for (const { stop } of near) {
    for (const [pi, pos] of net.at[stop.index]) {
      if (pos === 0) continue;
      const p = net.patterns[pi];
      const key = `${p.line}→${p.headsign}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ pattern: pi, pos, stop });
    }
  }
  return out.sort((a, b) => lineOrder(net.patterns[a.pattern].line, net.patterns[b.pattern].line));
}

function lineOrder(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'it', { numeric: true });
}

/** Fermate da cui si può essere partiti per arrivare in `arrival`, dalla più vicina all'arrivo. */
export function departures(net: BusNetwork, arrival: Arrival): { pos: number; stop: BusStop; meters: number }[] {
  const p = net.patterns[arrival.pattern];
  const out = [];
  for (let pos = arrival.pos - 1; pos >= 0; pos--) {
    out.push({ pos, stop: net.stops[p.stops[pos]], meters: p.meters[arrival.pos] - p.meters[pos] });
  }
  return out;
}

export type BusRide = { line: string; tram: boolean; from: string; to: string; meters: number; stops: number };

export function busRide(net: BusNetwork, arrival: Arrival, fromPos: number): BusRide {
  const p = net.patterns[arrival.pattern];
  return {
    line: p.line,
    tram: p.tram,
    from: net.stops[p.stops[fromPos]].name,
    to: net.stops[p.stops[arrival.pos]].name,
    meters: Math.max(0, p.meters[arrival.pos] - p.meters[fromPos]),
    stops: arrival.pos - fromPos,
  };
}

/** Velocità media di un bus a Roma, fermate comprese (circa 15 km/h). */
export const BUS_MS = 4.2;

export function busLabel(ride: Pick<BusRide, 'line' | 'tram'>): string {
  return `${ride.tram ? 'Tram' : 'Bus'} ${ride.line}`;
}

/** Nome della linea dall'identificativo usato nel flusso in tempo reale. */
export function lineName(net: BusNetwork, routeId: string): string | null {
  const p = net.patterns.find((x) => x.routeId === routeId);
  return p ? p.line : null;
}
