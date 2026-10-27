/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CHAIN_GAP_MS,
  COMMUTE_BONUS,
  TRIP_CAP,
  capUsedBefore,
  dayKey,
  evaluateLeg,
  scoreTrip,
  streak,
  summarizeDay,
  type LegInput,
  type Trip,
} from './scoring';

const leg = (mode: LegInput['mode'], km: number, extra: Partial<LegInput> = {}): LegInput => ({
  mode,
  gpsM: km * 1000,
  rejectedM: 0,
  seconds: 600,
  steps: null,
  ...extra,
});

const FIRST = { commute: true, bonusAlreadyToday: false };
const PLAIN = { commute: false, bonusAlreadyToday: false };

test('esempio di riferimento: 12 + 25 + 8 + bonus 10 = 55', () => {
  const score = scoreTrip(
    [
      leg('piedi', 1.2, { seconds: 900, steps: 1600 }),
      leg('tpl', 6.4, { seconds: 900 }),
      leg('piedi', 0.8, { seconds: 600, steps: 1100 }),
    ],
    FIRST,
  );
  assert.deepEqual(score.legs.map((l) => l.points), [12, 25, 8]);
  assert.deepEqual(score.legs.map((l) => l.status), ['verificato', 'dichiarato', 'verificato']);
  assert.equal(score.bonus, 10);
  assert.equal(score.total, 55);
  assert.equal(Math.round(score.carFreeMeters), 8400);
});

test('punti per km di ogni mezzo', () => {
  const expected: Record<string, number> = { piedi: 10, bici: 8, ebike: 6, tpl: 4, treno: 3, carsharing: 2, autoel: 1, auto: 0 };
  for (const [mode, pts] of Object.entries(expected)) {
    const result = evaluateLeg(leg(mode as LegInput['mode'], 1, { seconds: 3600 }));
    assert.equal(result.rawPoints, pts, mode);
  }
});

test('i punti si arrotondano per difetto', () => {
  assert.equal(scoreTrip([leg('piedi', 0.99, { seconds: 800 })], PLAIN).total, 9);
  assert.equal(scoreTrip([leg('tpl', 6.4, { seconds: 900 })], PLAIN).total, 25);
});

test('spezzare il percorso in tratti non cambia il totale', () => {
  const whole = scoreTrip([leg('piedi', 1, { seconds: 800 })], PLAIN).total;
  const pieces = scoreTrip(Array.from({ length: 20 }, () => leg('piedi', 0.05, { seconds: 40 })), PLAIN);
  assert.equal(whole, 10);
  assert.equal(pieces.total, 10);
  assert.equal(pieces.legs.reduce((sum, l) => sum + l.points, 0), 10);
});

test('spezzarlo in tragitti separati può solo far perdere punti', () => {
  // 1 km in venti tragitti da 50 m: ognuno vale mezzo punto, cioè zero.
  const each = scoreTrip([leg('piedi', 0.05, { seconds: 40 })], PLAIN).total;
  assert.equal(each, 0);
});

test("chi cambia mezzo non perde un punto a ogni cambio", () => {
  // 9,6 + 9,6 = 19,2 → 19 (non 9 + 9 = 18).
  const score = scoreTrip([leg('piedi', 0.96, { seconds: 700 }), leg('piedi', 0.96, { seconds: 700 })], PLAIN);
  assert.equal(score.total, 19);
  assert.deepEqual(score.legs.map((l) => l.points), [10, 9]);
});

test('il tetto di 60 punti vale sulla somma dei tratti', () => {
  const score = scoreTrip([leg('treno', 15, { seconds: 900 }), leg('bici', 5, { seconds: 1200 })], PLAIN);
  assert.deepEqual(score.legs.map((l) => l.rawPoints), [45, 40]);
  assert.deepEqual(score.legs.map((l) => l.points), [45, 15]);
  assert.equal(score.legPoints, TRIP_CAP);
});

test('100 km di treno non valgono più di 60 punti', () => {
  assert.equal(scoreTrip([leg('treno', 100, { seconds: 3600 })], PLAIN).total, 60);
});

const trip = (day: string, total: number, bonus = 0, startedAt = 0, endedAt = 0): Trip => ({
  id: `${day}-${total}-${startedAt}`,
  day,
  startedAt,
  endedAt,
  commute: bonus > 0,
  legs: [{ mode: 'piedi', meters: 1000, seconds: 700, steps: 1300, status: 'verificato', note: '', rawPoints: 10, points: 10 }],
  legPoints: total - bonus,
  bonus,
  total,
  meters: 1000,
  carFreeMeters: 1000,
  capUsed: 0,
});

test('il tetto non si aggira premendo Termina e Avvia', () => {
  const MIN = 60_000;
  // Treno spezzato in tre: 0–20 min, 22–40 min, 41–60 min.
  const first = trip('2026-10-10', 60, 0, 0, 20 * MIN);
  assert.equal(capUsedBefore([first], 22 * MIN), 60);
  const second = scoreTrip([leg('treno', 30, { seconds: 1080 })], { ...PLAIN, capUsed: capUsedBefore([first], 22 * MIN) });
  assert.equal(second.total, 0);
  assert.equal(second.capUsed, 60);

  // Un tragitto parziale lascia il resto del tetto a quello successivo.
  const partial = trip('2026-10-10', 45, 0, 0, 20 * MIN);
  const next = scoreTrip([leg('bici', 5, { seconds: 1200 })], { ...PLAIN, capUsed: capUsedBefore([partial], 25 * MIN) });
  assert.equal(next.legPoints, 15);
});

test('dopo mezz\'ora di sosta il tetto riparte da capo', () => {
  const morning = trip('2026-10-10', 60, 0, 0, 1_200_000);
  assert.equal(capUsedBefore([morning], 1_200_000 + CHAIN_GAP_MS + 1), 0);
  assert.equal(capUsedBefore([morning], 1_200_000 + CHAIN_GAP_MS), 60);
});

test('la catena di tragitti ravvicinati si somma, quella interrotta no', () => {
  const MIN = 60_000;
  const a = trip('2026-10-10', 20, 0, 0, 10 * MIN);
  const b = trip('2026-10-10', 20, 0, 15 * MIN, 30 * MIN);
  const old = trip('2026-10-10', 30, 0, -200 * MIN, -100 * MIN);
  assert.equal(capUsedBefore([old, a, b], 35 * MIN), 40);
  // Il bonus non consuma il tetto.
  const withBonus = trip('2026-10-10', 30, 10, 0, 10 * MIN);
  assert.equal(capUsedBefore([withBonus], 12 * MIN), 20);
});

test('il bonus casa-lavoro si prende una sola volta al giorno', () => {
  assert.equal(scoreTrip([leg('bici', 3)], { commute: true, bonusAlreadyToday: true }).bonus, 0);
  assert.equal(scoreTrip([leg('bici', 3)], FIRST).bonus, COMMUTE_BONUS);
});

test("niente bonus con l'auto privata, nemmeno elettrica", () => {
  assert.equal(scoreTrip([leg('autoel', 8)], FIRST).bonus, 0);
  assert.equal(scoreTrip([leg('piedi', 0.6, { steps: 800 }), leg('auto', 8)], FIRST).bonus, 0);
  assert.equal(scoreTrip([leg('carsharing', 8)], FIRST).bonus, COMMUTE_BONUS);
});

test('niente bonus sotto i 500 metri', () => {
  assert.equal(scoreTrip([leg('piedi', 0.3, { steps: 420 })], FIRST).bonus, 0);
});

test('a piedi: passi sufficienti = verificato', () => {
  const result = evaluateLeg(leg('piedi', 1, { seconds: 720, steps: 1400 }));
  assert.equal(result.status, 'verificato');
  assert.equal(result.meters, 1000);
  assert.equal(result.note, '');
});

test('a piedi: i passi limitano la distanza accreditata dal GPS', () => {
  // 1000 m di GPS ma solo 400 passi: al massimo 400 × 1,5 = 600 m.
  const result = evaluateLeg(leg('piedi', 1, { steps: 400 }));
  assert.equal(result.status, 'verificato');
  assert.equal(result.meters, 600);
  assert.equal(result.rawPoints, 6);
});

test('a piedi: pochissimi passi per la distanza = non valido', () => {
  const result = evaluateLeg(leg('piedi', 2, { seconds: 1500, steps: 200 }));
  assert.equal(result.status, 'anomalo');
  assert.equal(result.rawPoints, 0);
});

test('a piedi: passi contati solo in parte non vengono usati contro l\'utente', () => {
  const partial = evaluateLeg(leg('piedi', 2, { seconds: 1500, steps: 200, stepsComplete: false }));
  assert.equal(partial.status, 'dichiarato');
  assert.equal(partial.meters, 2000);
  assert.equal(partial.rawPoints, 20);
  // Se però bastano già quelli contati, il tratto è verificato.
  const enough = evaluateLeg(leg('piedi', 2, { seconds: 1500, steps: 1400, stepsComplete: false }));
  assert.equal(enough.status, 'verificato');
});

test('i passi non creano mai distanza: senza GPS zero metri', () => {
  const result = evaluateLeg(leg('piedi', 0, { steps: 5000 }));
  assert.equal(result.meters, 0);
  assert.equal(result.rawPoints, 0);
});

test('a piedi: senza contapassi resta "dichiarato"', () => {
  const result = evaluateLeg(leg('piedi', 1, { seconds: 720 }));
  assert.equal(result.status, 'dichiarato');
  assert.equal(result.rawPoints, 10);
});

test('corsa a 14 km/h: valida solo se i passi la confermano', () => {
  const verified = evaluateLeg(leg('piedi', 3.5, { seconds: 900, steps: 3000 }));
  assert.equal(verified.status, 'verificato');
  assert.equal(verified.rawPoints, 35);
  const unverified = evaluateLeg(leg('piedi', 3.5, { seconds: 900 }));
  assert.equal(unverified.status, 'anomalo');
});

test('auto dichiarata come camminata: tratti scartati = non valido', () => {
  // Il filtro GPS ha scartato quasi tutto perché troppo veloce per "a piedi".
  const result = evaluateLeg({ mode: 'piedi', gpsM: 80, rejectedM: 4000, seconds: 400, steps: 30 });
  assert.equal(result.status, 'anomalo');
  assert.equal(result.rawPoints, 0);
});

test('posizione simulata da un\'altra app = non valido', () => {
  const result = evaluateLeg(leg('bici', 5, { seconds: 1200, mocked: 3 }));
  assert.equal(result.status, 'anomalo');
  assert.equal(result.rawPoints, 0);
});

test('velocità media troppo alta per il mezzo = non valido', () => {
  // 10 km in bici in 10 minuti = 60 km/h.
  assert.equal(evaluateLeg(leg('bici', 10, { seconds: 600 })).status, 'anomalo');
});

test('un tratto non valido annulla il bonus', () => {
  const score = scoreTrip([leg('bici', 10, { seconds: 600 }), leg('piedi', 1, { steps: 1400 })], FIRST);
  assert.equal(score.bonus, 0);
  assert.deepEqual(score.legs.map((l) => l.points), [0, 10]);
});

test('riepilogo del giorno', () => {
  const summary = summarizeDay([trip('2026-10-10', 20, 10), trip('2026-10-10', 12), trip('2026-10-09', 30)], '2026-10-10');
  assert.equal(summary.points, 32);
  assert.equal(summary.carFreeMeters, 2000);
  assert.equal(summary.steps, 2600);
  assert.equal(summary.bonusAwarded, true);
  assert.equal(summary.trips.length, 2);
});

test('serie di giorni consecutivi', () => {
  const now = new Date(2026, 9, 10, 16, 0).getTime();
  assert.equal(dayKey(now), '2026-10-10');
  const trips = [trip('2026-10-10', 5), trip('2026-10-09', 5), trip('2026-10-08', 5), trip('2026-10-06', 5)];
  assert.equal(streak(trips, now), 3);
  // Oggi ancora a zero: la serie di ieri resta in piedi.
  assert.equal(streak(trips.slice(1), now), 2);
  // Un giorno con zero punti non conta.
  assert.equal(streak([trip('2026-10-10', 0)], now), 0);
  assert.equal(streak([], now), 0);
});

test('bus riconosciuto in tempo reale: tratto verificato con la linea', () => {
  const leg = evaluateLeg({ mode: 'tpl', gpsM: 3000, rejectedM: 0, seconds: 900, steps: null, bus: { line: '64' } });
  assert.equal(leg.status, 'verificato');
  assert.equal(leg.route, 'Bus 64');
  assert.match(leg.note, /tempo reale/);
});

test('tratto brevissimo un po\' troppo veloce: non diventa "non valido", vale la distanza credibile', () => {
  const r = evaluateLeg({ mode: 'piedi', gpsM: 44, rejectedM: 0, seconds: 11, steps: null });
  assert.notEqual(r.status, 'anomalo');
  assert.ok(r.meters <= Math.floor((11 * 12) / 3.6));
  const long = evaluateLeg({ mode: 'piedi', gpsM: 900, rejectedM: 0, seconds: 120, steps: null });
  assert.equal(long.status, 'anomalo');
});
