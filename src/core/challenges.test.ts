/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { WEEKLY, challengeProgress, completedChallenges, measure, monthlyAt, weeklyAt } from './challenges';
import { dayKey, type LegResult, type Trip } from './scoring';

function trip(end: number, legs: [LegResult['mode'], number][]): Trip {
  const ls = legs.map(([mode, km]) => ({ mode, meters: km * 1000, seconds: 600, steps: null, status: 'verificato' as const, note: '', rawPoints: 10, points: 10 }));
  return {
    id: `${end}-${legs.length}`, day: dayKey(end), startedAt: end - 600000, endedAt: end, commute: false, legs: ls,
    legPoints: 10 * ls.length, bonus: 0, total: 10 * ls.length, meters: 0, carFreeMeters: 0, capUsed: 0,
  };
}
const at = (m: number, d: number) => new Date(2026, m, d, 12).getTime();

test('misure: km senza auto, mezzi, giorni senza auto', () => {
  const trips = [trip(at(9, 19), [['piedi', 2], ['tpl', 6]]), trip(at(9, 20), [['auto', 10]]), trip(at(9, 20), [['bici', 3]]), trip(at(9, 21), [['bici', 4]])];
  assert.equal(measure('km', trips), 15);
  assert.equal(measure('km-bici', trips), 7);
  assert.equal(measure('mezzi', trips), 1);
  // Il 20 c'è anche l'auto: non conta.
  assert.equal(measure('giorni', trips), 2);
});

test('sfida della settimana: cambia ogni lunedì e si completa con i tragitti di quella settimana', () => {
  const a = weeklyAt([], at(9, 19));
  const b = weeklyAt([], at(9, 26));
  assert.notEqual(a.id, b.id);
  assert.equal(weeklyAt([], at(9, 25)).id, a.id);
  assert.equal(new Date(a.from).getDay(), 1);
  const def = WEEKLY.find((w) => w.id === a.id)!;
  assert.ok(def);
  const m = monthlyAt([], at(9, 19));
  assert.equal(m.title, 'Ottobre da paura');
  const lots = [trip(at(9, 2), [['piedi', 60]]), trip(at(9, 3), [['bici', 70]])];
  assert.equal(monthlyAt(lots, at(9, 19)).done, true);
  assert.ok(completedChallenges(lots, at(10, 5)).some((r) => r.id === 'm-10'));
  assert.equal(challengeProgress({ metric: 'km', value: 12.57, target: 20 }), '12,5 di 20 km');
  assert.equal(challengeProgress({ metric: 'punti', value: 1250, target: 1200 }), '1.250 di 1.200 punti');
});
