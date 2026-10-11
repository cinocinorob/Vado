/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROMA } from '../data/metro';
import { canDeclare, declaredTrip } from './declared';
import { routeBetween } from './metro';
import { TRIP_CAP, dayKey, type Trip } from './scoring';

// Un lunedì mattina qualunque, ora locale.
const NOW = new Date(2026, 9, 12, 9, 0, 0).getTime();

function route(from: string, to: string) {
  const found = routeBetween(ROMA, from, to);
  assert.ok(found);
  return found;
}

test('viaggio dichiarato: metri dalla rete, punti dei mezzi pubblici, partenza dichiarata', () => {
  const r = route('flaminio', 'eur-fermi');
  const trip = declaredTrip(r, { now: NOW, commute: false, trips: [] });
  assert.equal(trip.source, 'metro');
  assert.equal(trip.day, dayKey(NOW));
  assert.equal(trip.endedAt, NOW);
  assert.ok(trip.startedAt < NOW);
  assert.equal(trip.legs.length, 1);
  const leg = trip.legs[0];
  assert.equal(leg.mode, 'tpl');
  assert.equal(leg.meters, r.meters);
  assert.equal(leg.status, 'dichiarato');
  assert.equal(leg.route, 'Flaminio → EUR Fermi');
  assert.match(leg.note, /partenza dichiarata/);
  assert.equal(trip.total, Math.floor((r.meters / 1000) * 4));
  assert.equal(trip.carFreeMeters, r.meters);
  assert.equal(trip.bonus, 0);
});

test('il bonus casa-lavoro vale anche qui, una volta al giorno', () => {
  const first = declaredTrip(route('flaminio', 'eur-fermi'), { now: NOW, commute: true, trips: [] });
  assert.equal(first.bonus, 10);
  const second = declaredTrip(route('eur-fermi', 'flaminio'), { now: NOW + 9 * 3600_000, commute: true, trips: [first] });
  assert.equal(second.bonus, 0);
});

test('il tetto per tragitto resta: anche il viaggio più lungo non supera i 60 punti', () => {
  const trip = declaredTrip(route('battistini', 'pantano'), { now: NOW, commute: false, trips: [] });
  assert.ok(trip.legs[0].rawPoints > TRIP_CAP, String(trip.legs[0].rawPoints));
  assert.equal(trip.legPoints, TRIP_CAP);
});

test('due viaggi dichiarati al giorno, non di più; il giorno dopo si riparte', () => {
  const first = declaredTrip(route('flaminio', 'eur-fermi'), { now: NOW, commute: false, trips: [] });
  const evening = NOW + 9 * 3600_000;
  const afterOne = canDeclare([first], evening);
  assert.deepEqual(afterOne, { ok: true, left: 1 });
  const second = declaredTrip(route('eur-fermi', 'flaminio'), { now: evening, commute: false, trips: [first] });
  const afterTwo = canDeclare([first, second], evening + 3600_000);
  assert.equal(afterTwo.ok, false);
  assert.deepEqual(canDeclare([first, second], NOW + 24 * 3600_000), { ok: true, left: 2 });
});

test('subito dopo un tragitto con i mezzi pubblici non si dichiara lo stesso viaggio', () => {
  const measured: Trip = { ...declaredTrip(route('termini', 'cavour'), { now: NOW, commute: false, trips: [] }), source: undefined };
  assert.equal(canDeclare([measured], NOW + 5 * 60_000).ok, false);
  assert.equal(canDeclare([measured], NOW + 11 * 60_000).ok, true);
});

test('un tragitto a piedi appena concluso non blocca la registrazione', () => {
  const walk: Trip = {
    ...declaredTrip(route('termini', 'cavour'), { now: NOW, commute: false, trips: [] }),
    source: undefined,
    legs: [{ mode: 'piedi', meters: 600, seconds: 480, steps: 800, status: 'verificato', note: '', rawPoints: 6, points: 6 }],
  };
  assert.equal(canDeclare([walk], NOW + 60_000).ok, true);
});
