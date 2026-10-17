/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { backupName, buildBackup, newTrips, parseBackup } from './backup';
import type { Trip } from './scoring';

function trip(id: string, endedAt: number): Trip {
  return {
    id,
    day: '2026-10-12',
    startedAt: endedAt - 600_000,
    endedAt,
    commute: false,
    legs: [{ mode: 'piedi', meters: 800, seconds: 600, steps: 1000, status: 'verificato', note: '', rawPoints: 8, points: 8 }],
    legPoints: 8,
    bonus: 0,
    total: 8,
    meters: 800,
    carFreeMeters: 800,
    capUsed: 0,
  };
}

const NOW = new Date(2026, 9, 12, 11, 0).getTime();

test('il file si rilegge identico, con il codice di recupero', () => {
  const trips = [trip('b', NOW - 1000), trip('a', NOW - 5000)];
  const text = JSON.stringify(buildBackup(trips, 'K7MQ2X-ABCDEF', NOW));
  const parsed = parseBackup(text);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.trips.map((t) => t.id), ['a', 'b']);
  assert.equal(parsed.recovery, 'K7MQ2X-ABCDEF');
  assert.equal(parsed.ignored, 0);
});

test('senza profilo della classifica il codice è assente', () => {
  const parsed = parseBackup(JSON.stringify(buildBackup([trip('a', NOW)], null, NOW)));
  assert.ok(parsed.ok);
  assert.equal(parsed.recovery, null);
});

test('file sbagliati: un messaggio che dice cosa non va', () => {
  assert.match((parseBackup('ciao') as { problem: string }).problem, /non è un backup/);
  assert.match((parseBackup('{"app":"altra","trips":[]}') as { problem: string }).problem, /non è un backup/);
  assert.match((parseBackup('{"app":"vado","version":99,"trips":[]}') as { problem: string }).problem, /più recente/);
});

test('le righe rovinate vengono saltate e contate, le altre si recuperano', () => {
  const parsed = parseBackup(JSON.stringify({ app: 'vado', version: 1, trips: [trip('a', NOW), { id: 3 }, null], recovery: null }));
  assert.ok(parsed.ok);
  assert.equal(parsed.trips.length, 1);
  assert.equal(parsed.ignored, 2);
});

test('si aggiungono solo i tragitti che mancano: rimettere lo stesso file non raddoppia nulla', () => {
  const phone = [trip('a', NOW - 9000)];
  const file = [trip('a', NOW - 9000), trip('b', NOW - 1000), trip('b', NOW - 1000)];
  assert.deepEqual(newTrips(phone, file).map((t) => t.id), ['b']);
  assert.deepEqual(newTrips([...phone, trip('b', NOW - 1000)], file), []);
});

test('nome del file con la data', () => {
  assert.equal(backupName(NOW), 'vado-backup-2026-10-12.json');
});

test('il backup porta anche albero, bosco e pause', () => {
  const plant = { species: 'ulivo' as const, history: ['pino' as const], pauses: [{ from: '2026-10-10', to: '2026-10-12' }] };
  const text = JSON.stringify(buildBackup([], null, Date.now(), plant));
  const parsed = parseBackup(text);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.ok && parsed.plant, plant);
  const old = parseBackup(JSON.stringify(buildBackup([], null, Date.now())));
  assert.equal(old.ok && old.plant, null);
});
