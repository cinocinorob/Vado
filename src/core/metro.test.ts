/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROMA } from '../data/metro';
import { EMPTY_TRACK, addFix, type Bridge, type Fix } from './geo';
import { STATION_RADIUS_M, metroHop, nearestStation, rideSeconds, routeBetween, routeLabel, routeLines, type Station } from './metro';

const M_PER_DEG_LAT = 111_195;

function station(id: string): Station {
  const found = ROMA.stations.get(id);
  assert.ok(found, `stazione ${id} assente dai dati`);
  return found;
}

/** Un punto a `meters` metri a nord della stazione. */
function near(id: string, meters: number, t: number, accuracy = 10): Fix {
  const s = station(id);
  return { lat: s.lat + meters / M_PER_DEG_LAT, lon: s.lon, t, accuracy, speed: 0 };
}

function lineLength(lineId: string): number {
  const line = ROMA.data.lines.find((l) => l.id === lineId);
  assert.ok(line);
  const route = routeBetween(ROMA, line.stations[0], line.stations[line.stations.length - 1]);
  assert.ok(route);
  return route.meters;
}

test('i dati di Roma: quattro linee, ogni stazione collegata', () => {
  assert.deepEqual(ROMA.data.lines.map((l) => l.id), ['A', 'B', 'B1', 'C']);
  assert.equal(ROMA.data.stations.length, 74);
  for (const line of ROMA.data.lines) {
    for (const id of line.stations) assert.ok(ROMA.stations.has(id), `${id} nella linea ${line.id} ma non tra le stazioni`);
  }
  for (const s of ROMA.data.stations) {
    if (s.id !== 'termini') assert.ok(routeBetween(ROMA, 'termini', s.id), `${s.name} non raggiungibile da Termini`);
  }
});

test('le lunghezze delle linee corrispondono a quelle note', () => {
  // Valori pubblicati: A 18,4 km, B (Rebibbia–Laurentina) 18,2 km. La C è arrivata al Colosseo a fine 2025.
  assert.ok(Math.abs(lineLength('A') - 18_400) < 400, `A: ${lineLength('A')}`);
  assert.ok(Math.abs(lineLength('B') - 18_200) < 400, `B: ${lineLength('B')}`);
  assert.ok(lineLength('C') > 19_000 && lineLength('C') < 21_500, `C: ${lineLength('C')}`);
});

test('nessuna tratta più corta di 300 m o più lunga di 3 km', () => {
  for (const [a, b, meters] of ROMA.data.edges) {
    assert.ok(meters >= 300 && meters <= 3000, `${a} – ${b}: ${meters} m`);
  }
});

test('Flaminio → EUR Fermi: linea A, cambio a Termini, linea B', () => {
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);
  assert.equal(routeLabel(route), 'Flaminio → EUR Fermi');
  assert.equal(routeLines(route), 'Linea A, cambio a Termini, linea B');
  assert.equal(route.stops, 14);
  assert.equal(route.rides.length, 2);
  assert.equal(route.rides[0].stops + route.rides[1].stops, 14);
  assert.equal(Math.round(route.rides[0].meters + route.rides[1].meters), Math.round(route.meters));
  assert.ok(route.meters > 10_000 && route.meters < 13_000, String(route.meters));
  // Più lungo della linea d'aria: è il motivo per cui serve la rete.
  const straight = Math.hypot((station('flaminio').lat - station('eur-fermi').lat) * M_PER_DEG_LAT, 0);
  assert.ok(route.meters > straight);
});

test('sul tronco comune a B e B1 non si conta un cambio che non esiste', () => {
  const direct = routeBetween(ROMA, 'laurentina', 'jonio');
  assert.ok(direct);
  assert.equal(direct.rides.length, 1);
  assert.equal(direct.rides[0].line, 'B1');

  const trunk = routeBetween(ROMA, 'piramide', 'policlinico');
  assert.ok(trunk);
  assert.equal(trunk.rides.length, 1);

  const change = routeBetween(ROMA, 'rebibbia', 'jonio');
  assert.ok(change);
  assert.equal(routeLines(change), 'Linea B, cambio a Bologna, linea B1');
});

test('tra San Giovanni e Colosseo si va con la C, senza passare da Termini', () => {
  const route = routeBetween(ROMA, 'san-giovanni', 'colosseo');
  assert.ok(route);
  assert.equal(routeLines(route), 'Linea C');
  assert.equal(route.stops, 2);
});

test('il percorso è lo stesso nei due versi', () => {
  const out = routeBetween(ROMA, 'battistini', 'pantano');
  const back = routeBetween(ROMA, 'pantano', 'battistini');
  assert.ok(out && back);
  assert.equal(out.meters, back.meters);
  assert.equal(out.stops, back.stops);
});

test('stazione uguale o sconosciuta: nessun percorso', () => {
  assert.equal(routeBetween(ROMA, 'termini', 'termini'), null);
  assert.equal(routeBetween(ROMA, 'termini', 'inesistente'), null);
});

test('la stazione più vicina, solo entro il raggio', () => {
  assert.equal(nearestStation(ROMA, near('termini', 120, 0), STATION_RADIUS_M)?.station.id, 'termini');
  assert.equal(nearestStation(ROMA, near('termini', 320, 0), STATION_RADIUS_M)?.station.id, undefined);
  // Piazza Venezia: nessuna stazione entro 300 m.
  assert.equal(nearestStation(ROMA, { lat: 41.8958, lon: 12.4826 }, STATION_RADIUS_M), null);
});

test('durata stimata: 30 km/h più quattro minuti per ogni cambio', () => {
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);
  assert.equal(rideSeconds(route), Math.round(route.meters / 8.33 + 240));
});

test('posizioni sparite a una stazione e ricomparse a un’altra: vale la rete', () => {
  const from = near('flaminio', 60, 0);
  const to = near('eur-fermi', -80, 25 * 60_000);
  const hop = metroHop(ROMA, from, to, 9000);
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(hop && route);
  assert.equal(hop.label, 'Flaminio → EUR Fermi');
  assert.equal(hop.meters, route.meters);
});

test('non è metro: troppo veloce, troppo vicino, lontano dalle stazioni, stessa stazione', () => {
  // 11 km in due minuti.
  assert.equal(metroHop(ROMA, near('flaminio', 0, 0), near('eur-fermi', 0, 120_000), 9000), null);
  // Spostamento breve.
  assert.equal(metroHop(ROMA, near('flaminio', 0, 0), near('flaminio', 250, 600_000), 250), null);
  // Arrivo a 600 m dalla stazione.
  assert.equal(metroHop(ROMA, near('flaminio', 0, 0), near('eur-fermi', 600, 25 * 60_000), 9000), null);
  // Posizioni fitte: nessun buco.
  assert.equal(metroHop(ROMA, near('flaminio', 0, 0), near('spagna', 0, 20_000), 600), null);
});

test('mai meno della linea d’aria', () => {
  const hop = metroHop(ROMA, near('termini', 250, 0), near('repubblica', -250, 300_000), 900);
  assert.ok(hop);
  assert.equal(hop.meters, 900);
});

test('dentro il tracciato: il salto sottoterra viene accreditato con i metri della rete', () => {
  const bridge: Bridge = (from, to, straightM) => metroHop(ROMA, from, to, straightM);
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);

  // Fermo all'ingresso di Flaminio, poi 25 minuti senza posizioni, poi fermo all'uscita di EUR Fermi.
  const fixes: Fix[] = [
    ...Array.from({ length: 5 }, (_, i) => near('flaminio', 40, i * 3000)),
    ...Array.from({ length: 5 }, (_, i) => near('eur-fermi', -50, 25 * 60_000 + i * 3000)),
  ];
  const withNetwork = fixes.reduce((state, fix) => addFix(state, fix, 33, bridge).state, EMPTY_TRACK);
  const straightOnly = fixes.reduce((state, fix) => addFix(state, fix, 33).state, EMPTY_TRACK);

  assert.equal(withNetwork.hops?.length, 1);
  assert.equal(withNetwork.hops?.[0].label, 'Flaminio → EUR Fermi');
  assert.equal(Math.round(withNetwork.distanceM), route.meters);
  // Senza la rete resta la linea d'aria, più corta.
  assert.equal(straightOnly.hops, undefined);
  assert.ok(straightOnly.distanceM > 8000 && straightOnly.distanceM < route.meters - 1000, String(straightOnly.distanceM));
});
