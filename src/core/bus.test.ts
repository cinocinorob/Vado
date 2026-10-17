/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrivalsNear, busRide, buildBusNetwork, departures, stopsNear, type BusData } from './bus';
import { boardedVehicle, phoneAt, sightings, type Sample } from './busMatch';
import { readVehicles } from './gtfsrt';

const DATA: BusData = {
  downloaded: '2026-10-17',
  stops: [
    ['Termini', 4190100, 1250150],
    ['Nazionale', 4190000, 1249500],
    ['Venezia', 4189600, 1248250],
    ['San Pietro', 4190200, 1245800],
  ],
  lines: [
    { n: '64', r: '64', t: 3, p: [{ h: 'San Pietro', s: [0, 1, 2, 3], d: [0, 700, 1900, 4100] }, { h: 'Termini', s: [3, 2, 1, 0], d: [0, 2200, 3400, 4100] }] },
    { n: '8', r: '8', t: 0, p: [{ h: 'Casaletto', s: [2, 3], d: [0, 2500] }] },
  ],
};
const net = buildBusNetwork(DATA);

test('bus: fermate vicine, linee in arrivo e metri lungo il percorso', () => {
  const near = stopsNear(net, 41.902, 12.458, 400);
  assert.equal(near[0].stop.name, 'San Pietro');
  const arrivals = arrivalsNear(net, near);
  assert.deepEqual(arrivals.map((a) => net.patterns[a.pattern].line), ['8', '64']);
  const a64 = arrivals.find((a) => net.patterns[a.pattern].line === '64');
  assert.ok(a64);
  const from = departures(net, a64);
  assert.deepEqual(from.map((d) => d.stop.name), ['Venezia', 'Nazionale', 'Termini']);
  const ride = busRide(net, a64, 0);
  assert.deepEqual(ride, { line: '64', tram: false, from: 'Termini', to: 'San Pietro', meters: 4100, stops: 3 });
  assert.equal(busRide(net, arrivals[0], 0).tram, true);
});

/** Un messaggio protobuf costruito a mano, come lo manda Roma Mobilità. */
function encode(vehicles: { id: string; route: string; lat: number; lon: number; t: number }[]): Uint8Array {
  const bytes: number[] = [];
  const varint = (n: number, out: number[]) => {
    while (n >= 0x80) {
      out.push((n % 128) | 0x80);
      n = Math.floor(n / 128);
    }
    out.push(n);
  };
  const ld = (n: number, body: number[], out: number[]) => {
    varint(n * 8 + 2, out);
    varint(body.length, out);
    out.push(...body);
  };
  const str = (s: string) => [...s].map((c) => c.charCodeAt(0));
  const f32 = (n: number, x: number, out: number[]) => {
    varint(n * 8 + 5, out);
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, x, true);
    out.push(...b);
  };
  ld(1, [...[0x0a, 3], ...str('2.0')], bytes);
  for (const v of vehicles) {
    const trip: number[] = [];
    ld(5, str(v.route), trip);
    const pos: number[] = [];
    f32(1, v.lat, pos);
    f32(2, v.lon, pos);
    const desc: number[] = [];
    ld(1, str(v.id), desc);
    const veh: number[] = [];
    ld(1, trip, veh);
    ld(2, pos, veh);
    varint(5 * 8, veh);
    varint(v.t, veh);
    ld(8, desc, veh);
    const ent: number[] = [];
    ld(1, str('e' + v.id), ent);
    ld(4, veh, ent);
    ld(2, ent, bytes);
  }
  return Uint8Array.from(bytes);
}

test('tempo reale: lettura del flusso e riconoscimento del bus su cui si viaggia', () => {
  const t0 = 1_792_256_000;
  // Il telefono va da Termini verso Venezia in 5 minuti.
  const samples: Sample[] = Array.from({ length: 31 }, (_, i) => ({ t: (t0 + i * 10) * 1000, lat: 41.901 - i * 0.00005, lon: 12.5015 - i * 0.00063 }));
  const at = (s: number) => phoneAt(samples, (t0 + s) * 1000);
  assert.ok(at(150));
  assert.equal(phoneAt(samples, (t0 + 1000) * 1000), null);

  const all = [];
  for (const s of [30, 120, 210, 290]) {
    const p = at(s)!;
    const feed = encode([
      { id: '4521', route: '64', lat: p.lat + 0.0002, lon: p.lon, t: t0 + s },
      // Un altro bus lontano.
      { id: '7777', route: '170', lat: 41.85, lon: 12.47, t: t0 + s },
    ]);
    const vehicles = readVehicles(feed, { minLat: 41.8, maxLat: 42, minLon: 12.4, maxLon: 12.6 });
    assert.equal(vehicles.length, 2);
    assert.equal(vehicles[0].routeId, '64');
    all.push(...sightings(vehicles, samples, (t0 + s + 20) * 1000));
  }
  const bus = boardedVehicle(all);
  assert.ok(bus);
  assert.equal(bus.id, '4521');
  assert.equal(bus.routeId, '64');

  // Fermi alla fermata con il bus accanto: niente.
  const still: Sample[] = samples.map((s) => ({ ...s, lat: 41.901, lon: 12.5015 }));
  const parked = [30, 120, 210, 290].flatMap((s) =>
    sightings(readVehicles(encode([{ id: '9', route: '64', lat: 41.9011, lon: 12.5015, t: t0 + s }])), still, (t0 + s + 20) * 1000),
  );
  assert.equal(parked.length, 4);
  assert.equal(boardedVehicle(parked), null);
});
