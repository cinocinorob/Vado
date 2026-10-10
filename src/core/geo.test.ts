/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_TRACK, addFix, breakTrack, closeTrack, haversineM, withoutCoordinates, type Fix, type TrackState } from './geo';

// Roma, zona Termini.
const LAT = 41.901;
const LON = 12.501;
const M_PER_DEG_LAT = 111_195;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT * Math.PI) / 180);
const WALK = 6; // m/s massimi per "a piedi"
const TRANSIT = 33;

function run(fixes: Fix[], maxMs: number, start: TrackState = EMPTY_TRACK): TrackState {
  return fixes.reduce((state, fix) => addFix(state, fix, maxMs).state, start);
}

type LineOpts = { everyS?: number; accuracy?: number; t0?: number; lat0?: number; reportSpeed?: boolean };

/** Posizioni lungo un meridiano a velocità costante. */
function line(meters: number, speed: number, opts: LineOpts = {}): Fix[] {
  const { everyS = 3, accuracy = 8, t0 = 0, lat0 = LAT, reportSpeed = true } = opts;
  const fixes: Fix[] = [];
  const n = Math.round(meters / (speed * everyS));
  for (let i = 0; i <= n; i++) {
    fixes.push({
      lat: lat0 + (i * speed * everyS) / M_PER_DEG_LAT,
      lon: LON,
      t: t0 + i * everyS * 1000,
      accuracy,
      speed: reportSpeed ? speed : 0,
    });
  }
  return fixes;
}

/** Posizioni sparse attorno a un punto fermo, con velocità misurata nulla. */
function jitter(count: number, amplitudeM: number, accuracy: number): Fix[] {
  return Array.from({ length: count }, (_, i) => ({
    lat: LAT + (Math.cos(i * 2.3) * amplitudeM) / M_PER_DEG_LAT,
    lon: LON + (Math.sin(i * 1.7) * amplitudeM) / M_PER_DEG_LON,
    t: i * 3000,
    accuracy,
    speed: 0,
  }));
}

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual.toFixed(1)} non è entro ${tolerance} da ${expected}`);

test('haversine: 0,001 gradi di latitudine sono circa 111 m', () => {
  near(haversineM({ lat: LAT, lon: LON }, { lat: LAT + 0.001, lon: LON }), 111.2, 0.5);
});

test("camminata di 1 km a 1,4 m/s: distanza entro il 2%", () => {
  const state = closeTrack(run(line(1000, 1.4), WALK), WALK);
  near(state.distanceM, 1000, 20);
  assert.equal(state.rejectedM, 0);
});

test('fermo con il GPS che oscilla di 4 m: distanza zero', () => {
  const state = closeTrack(run(jitter(100, 4, 10), WALK), WALK);
  assert.equal(state.distanceM, 0);
});

test('fermo con segnale scarso (errori fino a 12 m): distanza zero', () => {
  const state = closeTrack(run(jitter(200, 12, 25), WALK), WALK);
  assert.equal(state.distanceM, 0);
});

test('posizioni troppo imprecise vengono ignorate', () => {
  const state = run(line(500, 1.4, { accuracy: 60 }), WALK);
  assert.equal(state.distanceM, 0);
  assert.equal(state.accepted, 0);
});

test('un salto isolato del GPS viene scartato senza lasciare traccia', () => {
  const walk = line(300, 1.4);
  const end = walk[walk.length - 1];
  const glitch: Fix = { lat: LAT + 0.02, lon: LON, t: end.t + 3000, accuracy: 10, speed: 1.4 }; // ~2,2 km in 3 s
  const back = line(300, 1.4, { t0: end.t + 6000, lat0: end.lat });
  const state = closeTrack(run([...walk, glitch, ...back], WALK), WALK);
  near(state.distanceM, 600, 20);
  assert.equal(state.rejectedM, 0);
});

test('auto dichiarata come camminata: quasi tutto scartato', () => {
  const state = run(line(4000, 12), WALK); // 43 km/h
  assert.ok(state.distanceM < 60, String(state.distanceM));
  assert.ok(state.rejectedM > 3800, String(state.rejectedM));
});

test('la stessa auto dichiarata come auto viene accreditata', () => {
  const state = closeTrack(run(line(4000, 12), 55), 55);
  near(state.distanceM, 4000, 60);
  assert.equal(state.rejectedM, 0);
});

test('senza velocità misurata la camminata conta lo stesso, con un po\' di ritardo', () => {
  const state = closeTrack(run(line(1000, 1.4, { reportSpeed: false }), WALK), WALK);
  assert.ok(state.distanceM > 900 && state.distanceM <= 1005, String(state.distanceM));
});

test('galleria: il tratto senza segnale viene contato in linea retta', () => {
  const before = line(600, 9);
  const last = before[before.length - 1];
  // Due minuti senza segnale, poi si riemerge 1 080 m più avanti.
  const after = line(600, 9, { t0: last.t + 120_000, lat0: last.lat + 1080 / M_PER_DEG_LAT });
  const state = closeTrack(run([...before, ...after], TRANSIT), TRANSIT);
  near(state.distanceM, 600 + 1080 + 600, 60);
});

test('la pausa non conta la strada fatta nel frattempo', () => {
  const first = closeTrack(run(line(300, 1.4), WALK), WALK);
  const paused = breakTrack(first);
  // Si riprende 1 km più in là, 10 minuti dopo.
  const resumed = closeTrack(
    run(line(300, 1.4, { t0: 900_000, lat0: LAT + 1000 / M_PER_DEG_LAT }), WALK, paused),
    WALK,
  );
  near(resumed.distanceM, 600, 25);
});

test('la chiusura accredita l\'ultimo pezzo solo se c\'è movimento', () => {
  const moving = run(line(104, 1.4), WALK);
  assert.ok(closeTrack(moving, WALK).distanceM > moving.distanceM);
  const idle = run(jitter(40, 4, 10), WALK);
  assert.equal(closeTrack(idle, WALK).distanceM, 0);
});

test('le posizioni simulate vengono contate e non producono distanza', () => {
  const fake = line(500, 1.4).map((fix) => ({ ...fix, mocked: true }));
  const state = run(fake, WALK);
  assert.equal(state.distanceM, 0);
  assert.equal(state.mocked, fake.length);
});

test('lo stato senza coordinate conserva i totali', () => {
  const state = run(line(500, 1.4), WALK);
  const stripped = withoutCoordinates(state);
  assert.equal(stripped.distanceM, state.distanceM);
  assert.equal(JSON.stringify(stripped).includes('lat'), false);
});
