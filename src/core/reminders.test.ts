/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { overtakers, thirstyAt } from './reminders';
import { dayKey, type Trip } from './scoring';

const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
function trip(end: number, mode: Trip['legs'][number]['mode'] = 'piedi'): Trip {
  return {
    id: String(end), day: dayKey(end), startedAt: end - 600000, endedAt: end, commute: false,
    legs: [{ mode, meters: 1000, seconds: 600, steps: null, status: 'verificato', note: '', rawPoints: 10, points: 10 }],
    legPoints: 10, bonus: 0, total: 10, meters: 1000, carFreeMeters: 1000, capUsed: 0,
  };
}

test('pianta assetata: alle 18 del secondo giorno dopo l\'ultimo tragitto senza auto', () => {
  const now = at(17, 9);
  assert.equal(thirstyAt([trip(at(17, 8))], now, [], dayKey(now)), at(19, 18));
  assert.equal(thirstyAt([trip(at(17, 8)), trip(at(17, 8) + 1800000, 'auto')], now, [], dayKey(now)), at(19, 18));
  assert.equal(thirstyAt([], now, [], dayKey(now)), null);
  assert.equal(thirstyAt([trip(at(10, 8))], now, [], dayKey(now)), null);
  assert.equal(thirstyAt([trip(at(17, 8))], now, [{ from: dayKey(now), to: null }], dayKey(now)), null);
});

test('sorpassi: chi era dietro e ora è davanti', () => {
  const before = [
    { id: 'me', name: 'Tu', points: 50, me: true },
    { id: 'f', name: 'Flavia', points: 40 },
    { id: 'p', name: 'Paolo', points: 70 },
  ];
  assert.deepEqual(overtakers(before, [{ ...before[0] }, { ...before[1], points: 55 }, { ...before[2] }]), ['Flavia']);
  assert.deepEqual(overtakers(before, before), []);
  assert.deepEqual(overtakers(before, [{ ...before[0], points: 80 }, { ...before[1], points: 60 }, before[2]]), []);
});
