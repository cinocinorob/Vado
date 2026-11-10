/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ALL_MISSIONS_XP, MISSION_XP, levelOf, levelTitle, missionXp, missionsOf, perfectDays, streakState, totalXp, xpNeed } from './game';
import { dayKey, type LegResult, type Trip } from './scoring';

const at = (d: number, h = 12) => new Date(2026, 10, d, h).getTime();

function leg(mode: LegResult['mode'], meters: number): LegResult {
  return { mode, meters, seconds: 600, steps: null, status: 'verificato', note: '', rawPoints: 0, points: 0 };
}
function trip(end: number, legs: LegResult[], total: number): Trip {
  const carFree = legs.filter((l) => l.mode !== 'auto' && l.mode !== 'autoel' && l.mode !== 'carsharing').reduce((s, l) => s + l.meters, 0);
  return {
    id: `t${end}-${Math.random()}`, day: dayKey(end), startedAt: end - 600_000, endedAt: end, commute: false, legs,
    legPoints: total, bonus: 0, total, meters: carFree, carFreeMeters: carFree, capUsed: 0,
  };
}
const walk = (d: number, km = 2, total = 20, h = 12) => trip(at(d, h), [leg('piedi', km * 1000)], total);

test('missioni: tre al giorno, stabili per il giorno, una facile una media una difficile', () => {
  const a = missionsOf([], '2026-11-10');
  const b = missionsOf([], '2026-11-10');
  assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((m) => m.id)).size, 3);
  assert.ok(a.every((m) => !m.done && m.value === 0));
  // In un mese le missioni cambiano.
  const seen = new Set<string>();
  for (let d = 1; d <= 30; d++) missionsOf([], dayKey(at(d))).forEach((m) => seen.add(m.id));
  assert.ok(seen.size >= 9, String(seen.size));
});

test('missioni: una giornata piena le completa tutte e dà il bonus', () => {
  const day = dayKey(at(10));
  const big = [trip(at(10, 8), [leg('piedi', 4000), leg('tpl', 5000)], 45), walk(10, 2, 20, 13), walk(10, 1, 10, 18)];
  const all = missionsOf(big, day);
  assert.ok(all.every((m) => m.done), JSON.stringify(all.map((m) => [m.id, m.value])));
  assert.equal(missionXp(all), 3 * MISSION_XP + ALL_MISSIONS_XP);
  assert.equal(perfectDays(big), 1);
  // I tragitti di un altro giorno non contano.
  assert.ok(missionsOf(big, dayKey(at(11))).every((m) => !m.done));
  // L'auto non completa nulla.
  assert.ok(missionsOf([trip(at(12), [leg('auto', 20000)], 0)], dayKey(at(12))).every((m) => !m.done));
});

test('livello: soglie crescenti, titolo ogni 5 livelli, XP = punti + missioni', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(99).level, 1);
  assert.equal(levelOf(100).level, 2);
  assert.equal(levelOf(100 + 140).level, 3);
  assert.equal(xpNeed(3), 180);
  const l = levelOf(150);
  assert.deepEqual([l.into, l.need], [50, 140]);
  assert.equal(levelTitle(1), 'Pedone');
  assert.equal(levelTitle(6), 'Camminatore');
  assert.equal(levelTitle(99), 'Leggenda verde');
  const list = [walk(10, 2, 20)];
  assert.equal(totalXp(list), 20 + missionXp(missionsOf(list, dayKey(at(10)))));
  assert.equal(totalXp([]), 0);
});

test('serie: 7 giorni danno un salvaserie, che copre da solo un giorno saltato', () => {
  const week = [1, 2, 3, 4, 5, 6, 7].map((d) => walk(d));
  const s = streakState(week, at(7, 20));
  assert.deepEqual([s.days, s.freezes], [7, 1]);
  // Salto l'8, il 9 ho di nuovo un tragitto: la serie continua e il salvaserie è usato.
  const saved = streakState([...week, walk(9)], at(9, 20));
  assert.deepEqual([saved.days, saved.freezes, saved.frozen], [9, 0, ['2026-11-08']]);
  assert.equal(saved.savedYesterday, true);
  // Il giorno dopo il salto, prima di muoversi: la serie è ancora viva.
  const morning = streakState(week, at(9, 8));
  assert.deepEqual([morning.days, morning.freezes], [8, 0]);
  // Due giorni saltati con un solo salvaserie: la serie riparte.
  const lost = streakState([...week, walk(10)], at(10, 20));
  assert.equal(lost.days, 1);
});

test('serie: senza salvaserie un giorno saltato spezza; oggi vuoto non spezza; massimo 2', () => {
  assert.equal(streakState([walk(1), walk(2)], at(3, 9)).days, 2);
  assert.equal(streakState([walk(1), walk(2)], at(4, 9)).days, 0);
  assert.equal(streakState([], at(4)).days, 0);
  const month = Array.from({ length: 28 }, (_, i) => walk(i + 1));
  const s = streakState(month, at(28, 20));
  assert.deepEqual([s.days, s.freezes, s.toNextFreeze], [28, 2, 0]);
  assert.equal(streakState([walk(1), walk(2), walk(3)], at(3, 20)).toNextFreeze, 4);
});
