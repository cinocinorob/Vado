/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { weekEnd, weekStart } from '../core/social';
import { BOTS, botPoints, botReachedAt, botTrips, chance, pickBots } from './bots';

const NOW = new Date(2026, 9, 10, 18).getTime();
const DAY = 24 * 3600_000;

test('partecipanti di esempio: nomi e identificativi unici', () => {
  assert.equal(new Set(BOTS.map((b) => b.id)).size, BOTS.length);
  assert.equal(new Set(BOTS.map((b) => b.name)).size, BOTS.length);
  assert.ok(BOTS.length >= 25);
});

test('stesso nome e stesso giorno danno sempre gli stessi punti', () => {
  const day = new Date(2026, 9, 7).getTime();
  assert.deepEqual(botTrips(BOTS[0], day), botTrips(BOTS[0], day));
  assert.equal(chance('abc'), chance('abc'));
  assert.notEqual(chance('abc'), chance('abd'));
});

test('i punti crescono nel tempo e non superano mai il tetto per tragitto', () => {
  const from = weekStart(NOW);
  for (const bot of BOTS) {
    let previous = 0;
    for (let t = from; t <= weekEnd(NOW); t += 6 * 3600_000) {
      const points = botPoints(bot, from, t);
      assert.ok(points >= previous, bot.name);
      previous = points;
    }
    for (let d = 0; d < 7; d++) {
      for (const trip of botTrips(bot, from + d * DAY, 1.5)) assert.ok(trip.points > 0 && trip.points <= 60);
    }
  }
});

test('in media una settimana vale circa il ritmo dichiarato', () => {
  // Su 20 settimane la media di ogni partecipante sta tra il 60% e il 130% del suo ritmo.
  for (const bot of BOTS.slice(0, 12)) {
    let total = 0;
    for (let w = 0; w < 20; w++) {
      const start = weekStart(NOW - w * 7 * DAY);
      total += botPoints(bot, start, weekEnd(start));
    }
    const ratio = total / 20 / bot.pace;
    assert.ok(ratio > 0.6 && ratio < 1.3, `${bot.name}: ${ratio.toFixed(2)}`);
  }
});

test('il momento in cui si raggiunge un traguardo è coerente con i punti', () => {
  const from = NOW - 10 * DAY;
  for (const bot of BOTS.slice(0, 10)) {
    const reached = botReachedAt(bot, from, NOW, 100);
    if (reached == null) {
      assert.ok(botPoints(bot, from, NOW) < 100, bot.name);
    } else {
      assert.ok(botPoints(bot, from, reached) < 100, bot.name);
      assert.ok(botPoints(bot, from, reached + 1) >= 100, bot.name);
    }
  }
});

test('la scelta dei partecipanti dipende solo dal seme', () => {
  const a = pickBots('2026-S41|Bronzo', 19).map((b) => b.id);
  assert.deepEqual(a, pickBots('2026-S41|Bronzo', 19).map((b) => b.id));
  assert.notDeepEqual(a, pickBots('2026-S42|Bronzo', 19).map((b) => b.id));
  assert.equal(a.length, 19);
  assert.equal(new Set(a).size, 19);
  const without = pickBots('x', 5, new Set(a));
  assert.ok(without.every((b) => !a.includes(b.id)));
});
