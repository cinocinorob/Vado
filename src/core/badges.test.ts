/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BADGES, badgeStates, carFreeStreaks, newlyUnlocked, nextBadge, progressLabel, type BadgeId } from './badges';
import { dayKey, scoreTrip, type LegInput, type Trip } from './scoring';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 10, 18, 0, 0).getTime();

let counter = 0;

/** Un tragitto concluso `daysAgo` giorni fa, con i tratti indicati. */
function trip(daysAgo: number, legs: [LegInput['mode'], number][], extra: { commute?: boolean; invalid?: boolean } = {}): Trip {
  const startedAt = NOW - daysAgo * DAY - 3600_000;
  const inputs: LegInput[] = legs.map(([mode, km]) => ({
    mode,
    gpsM: km * 1000,
    rejectedM: 0,
    // Ritmo sempre credibile per il mezzo: 5 km/h a piedi, 15 in bici, 30 il resto.
    seconds: (km / (mode === 'piedi' ? 5 : mode === 'bici' || mode === 'ebike' ? 15 : 30)) * 3600,
    steps: mode === 'piedi' ? Math.round(km * 1400) : null,
    mocked: extra.invalid ? 1 : 0,
  }));
  const score = scoreTrip(inputs, { commute: extra.commute ?? false, bonusAlreadyToday: false });
  counter += 1;
  return { ...score, id: `t${counter}`, day: dayKey(startedAt), startedAt, endedAt: startedAt + 1800_000, commute: extra.commute ?? false };
}

const state = (trips: Trip[], id: BadgeId) => badgeStates(trips, NOW).find((b) => b.id === id)!;

test('senza tragitti nessuna medaglia è sbloccata', () => {
  const states = badgeStates([], NOW);
  assert.equal(states.length, BADGES.length);
  assert.ok(states.every((b) => !b.unlocked && b.value === 0 && b.ratio === 0));
});

test('Primo passo: basta un tragitto a piedi di almeno 200 m', () => {
  assert.equal(state([trip(0, [['piedi', 0.15]])], 'primo-passo').unlocked, false);
  assert.equal(state([trip(0, [['piedi', 0.25]])], 'primo-passo').unlocked, true);
});

test('un tratto non valido non conta', () => {
  assert.equal(state([trip(0, [['piedi', 1]], { invalid: true })], 'primo-passo').unlocked, false);
  assert.equal(state([trip(0, [['piedi', 5]], { invalid: true })], 'maratoneta').value, 0);
});

test('le medaglie a numero di tragitti ignorano i tratti sotto i 500 m', () => {
  const short = Array.from({ length: 10 }, (_, i) => trip(i, [['tpl', 0.3]]));
  assert.equal(state(short, 're-della-metro').value, 0);
  const real = Array.from({ length: 10 }, (_, i) => trip(i, [['tpl', 3]]));
  assert.equal(state(real, 're-della-metro').unlocked, true);
});

test('Due ruote somma bici e bici elettrica; Scossa conta solo i tragitti in elettrica', () => {
  const trips = [trip(1, [['bici', 30]]), trip(2, [['ebike', 19.9]])];
  assert.equal(state(trips, 'due-ruote').unlocked, false);
  assert.equal(progressLabel(state(trips, 'due-ruote')), '49,9 di 50 km');
  assert.equal(state([...trips, trip(3, [['bici', 0.2]])], 'due-ruote').unlocked, true);
  assert.equal(state(trips, 'scossa').value, 1);
});

test('Maratoneta e Capotreno sommano i chilometri validi', () => {
  const trips = [trip(1, [['piedi', 4], ['treno', 60], ['piedi', 2]]), trip(2, [['treno', 45]])];
  assert.equal(Math.round(state(trips, 'maratoneta').value * 10) / 10, 6);
  assert.equal(state(trips, 'capotreno').unlocked, true);
});

test("Pendolare d'oro conta i tragitti casa-lavoro senza auto, anche due al giorno", () => {
  const trips = [
    trip(0, [['tpl', 5]], { commute: true }),
    trip(0, [['tpl', 5]], { commute: true }),
    trip(1, [['autoel', 8]], { commute: true }),
    trip(1, [['bici', 4]]),
  ];
  assert.equal(state(trips, 'pendolare-doro').value, 2);
});

test('Sette su sette: sette giorni di fila con un tragitto senza auto', () => {
  const six = Array.from({ length: 6 }, (_, i) => trip(i, [['piedi', 1]]));
  assert.equal(state(six, 'sette-su-sette').value, 6);
  assert.equal(state(six, 'sette-su-sette').unlocked, false);
  const seven = [...six, trip(6, [['bici', 2]])];
  assert.equal(state(seven, 'sette-su-sette').unlocked, true);
});

test('Sette su sette: un giorno con l\'auto privata interrompe la serie', () => {
  const trips = Array.from({ length: 7 }, (_, i) => trip(i, [['piedi', 1]]));
  trips.push(trip(3, [['auto', 10]]));
  assert.deepEqual(carFreeStreaks(trips, NOW), { best: 3, current: 3 });
  assert.equal(state(trips, 'sette-su-sette').unlocked, false);
});

test('Sette su sette: la serie in corso vale anche se oggi non c\'è ancora un tragitto', () => {
  const trips = Array.from({ length: 4 }, (_, i) => trip(i + 1, [['piedi', 1]]));
  assert.equal(carFreeStreaks(trips, NOW).current, 4);
  // Saltato anche ieri: la serie riparte da zero.
  const older = Array.from({ length: 4 }, (_, i) => trip(i + 2, [['piedi', 1]]));
  assert.equal(carFreeStreaks(older, NOW).current, 0);
});

test('Sette su sette: una volta presa resta, anche se la serie si interrompe', () => {
  const old = Array.from({ length: 7 }, (_, i) => trip(i + 20, [['piedi', 1]]));
  assert.equal(carFreeStreaks(old, NOW).current, 0);
  assert.equal(state(old, 'sette-su-sette').unlocked, true);
});

test('la prossima medaglia è quella più vicina al traguardo', () => {
  assert.equal(nextBadge(badgeStates([], NOW))?.id, 'primo-passo');
  const trips = [trip(0, [['piedi', 1]]), trip(1, [['carsharing', 5]]), trip(2, [['carsharing', 5]]), trip(3, [['carsharing', 5]])];
  // Primo passo è presa; car sharing è a 3 su 5, più avanti di tutte le altre.
  assert.equal(nextBadge(badgeStates(trips, NOW))?.id, 'in-condivisione');
});

test('medaglie appena sbloccate da un nuovo tragitto', () => {
  const before = [trip(1, [['tpl', 5]])];
  const unlocked = newlyUnlocked(before, [trip(0, [['piedi', 1]])], NOW);
  assert.deepEqual(unlocked.map((b) => b.id), ['primo-passo']);
  assert.deepEqual(newlyUnlocked([...before, trip(0, [['piedi', 1]])], [trip(0, [['piedi', 1]])], NOW), []);
});

test('etichette di avanzamento', () => {
  const trips = Array.from({ length: 14 }, (_, i) => trip(i, [['tpl', 5]], { commute: true }));
  assert.equal(progressLabel(state(trips, 'pendolare-doro')), '14 di 20');
  assert.equal(progressLabel(state([trip(0, [['treno', 12.34]])], 'capotreno')), '12,3 di 100 km');
  assert.equal(progressLabel(state([trip(0, [['piedi', 1]]), trip(1, [['piedi', 1]])], 'sette-su-sette')), '2 di 7 giorni');
});
