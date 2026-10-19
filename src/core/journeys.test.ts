/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JOURNEYS, journeyById, journeyRun } from './journeys';
import { dayKey, type Trip } from './scoring';

function walk(end: number, km: number): Trip {
  return {
    id: String(end), day: dayKey(end), startedAt: end - 600000, endedAt: end, commute: false,
    legs: [{ mode: 'piedi', meters: km * 1000, seconds: 600, steps: null, status: 'verificato', note: '', rawPoints: 1, points: 1 }],
    legPoints: 1, bonus: 0, total: 1, meters: km * 1000, carFreeMeters: km * 1000, capUsed: 0,
  };
}

test('percorsi: tappe in ordine, avanzamento dai km senza auto dopo la partenza', () => {
  for (const j of JOURNEYS) {
    assert.equal(j.stages[0].km, 0);
    for (let i = 1; i < j.stages.length; i++) assert.ok(j.stages[i].km > j.stages[i - 1].km, `${j.id} ${i}`);
  }
  const colli = journeyById('colli')!;
  const start = 1_000_000;
  const before = walk(start - 1, 50);
  const r = journeyRun(colli, [before, walk(start + 10, 4), walk(start + 20, 2)], start);
  assert.equal(r.km, 6);
  assert.equal(r.reached, 4);
  assert.equal(r.next?.name, 'Esquilino');
  assert.equal(r.done, false);
  const d = journeyRun(colli, [walk(start + 10, 6), walk(start + 20, 5)], start);
  assert.equal(d.done, true);
  assert.equal(d.doneAt, start + 20);
  assert.equal(d.next, null);
  assert.equal(d.km, 10);
});
