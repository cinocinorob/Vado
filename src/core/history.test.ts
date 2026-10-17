/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bestDay, months, weeks } from './history';
import { dayKey, type Trip } from './scoring';

function trip(end: number, points: number): Trip {
  return {
    id: String(end), day: dayKey(end), startedAt: end - 600000, endedAt: end, commute: false,
    legs: [{ mode: 'piedi', meters: 1000, seconds: 600, steps: null, status: 'verificato', note: '', rawPoints: points, points }],
    legPoints: points, bonus: 0, total: points, meters: 1000, carFreeMeters: 1000, capUsed: 0,
  };
}
const at = (m: number, d: number) => new Date(2026, m, d, 12).getTime();

test('storico: settimane da lunedì e mesi, dal più vecchio al corrente', () => {
  const now = at(9, 17); // sabato 17 ottobre
  const trips = [trip(at(9, 12), 10), trip(at(9, 17), 20), trip(at(9, 11), 5), trip(at(8, 20), 7)];
  const w = weeks(trips, now, 3);
  assert.equal(w.length, 3);
  assert.equal(new Date(w[2].start).getDate(), 12);
  assert.equal(w[2].points, 30);
  assert.equal(w[1].points, 5);
  assert.equal(w[2].trips, 2);
  const m = months(trips, now, 2);
  assert.deepEqual(m.map((p) => p.points), [7, 35]);
  assert.deepEqual(bestDay(trips), { day: dayKey(at(9, 17)), points: 20 });
  assert.equal(bestDay([]), null);
});
