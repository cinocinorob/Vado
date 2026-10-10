/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  IMPORT_DAYS,
  appName,
  importSessions,
  mergeHealthSteps,
  stepsInWindows,
  type HealthSession,
  type StepSample,
} from './health';
import { TRIP_CAP, dayKey, evaluateLeg, scoreTrip, type LegInput, type Trip } from './scoring';

const MIN = 60_000;
const NOW = new Date(2026, 9, 10, 18, 0, 0).getTime();
const FROM = NOW - IMPORT_DAYS * 24 * 60 * MIN;
const OPTS = { now: NOW, from: FROM };

const sample = (startMin: number, endMin: number, count: number, extra: Partial<StepSample> = {}): StepSample => ({
  start: startMin * MIN,
  end: endMin * MIN,
  count,
  origin: 'telefono',
  manual: false,
  ...extra,
});

// ---------- passi ----------

test('passi: senza dati il risultato è "non si sa", non zero', () => {
  assert.equal(stepsInWindows([], [[0, 10 * MIN]]), null);
  assert.equal(stepsInWindows([sample(20, 21, 100)], [[0, 10 * MIN]]), null);
});

test('passi: si sommano i campioni dentro l\'intervallo', () => {
  const samples = [sample(0, 1, 100), sample(1, 2, 110), sample(2, 3, 90), sample(30, 31, 500)];
  assert.equal(stepsInWindows(samples, [[0, 10 * MIN]]), 300);
});

test('passi: un campione a cavallo viene diviso in proporzione', () => {
  assert.equal(stepsInWindows([sample(0, 2, 200)], [[1 * MIN, 10 * MIN]]), 100);
});

test('passi: un campione lungo a cavallo non viene attribuito', () => {
  // Un totale giornaliero non dice quando sono stati fatti i passi.
  assert.equal(stepsInWindows([sample(0, 24 * 60, 10_000)], [[600 * MIN, 630 * MIN]]), null);
  // Ma se sta tutto dentro l'intervallo vale per intero.
  assert.equal(stepsInWindows([sample(10, 50, 3000)], [[0, 60 * MIN]]), 3000);
});

test('passi: due sorgenti che contano gli stessi passi non si sommano', () => {
  const samples = [sample(0, 5, 500), sample(0, 5, 540, { origin: 'orologio' })];
  assert.equal(stepsInWindows(samples, [[0, 10 * MIN]]), 540);
});

test('passi: le voci inserite a mano non contano', () => {
  assert.equal(stepsInWindows([sample(0, 5, 5000, { manual: true })], [[0, 10 * MIN]]), null);
  assert.equal(stepsInWindows([sample(0, 5, 5000, { manual: true }), sample(0, 5, 400)], [[0, 10 * MIN]]), 400);
});

test('passi: la pausa di un tragitto resta fuori', () => {
  const samples = [sample(0, 5, 500), sample(5, 10, 800), sample(10, 15, 450)];
  assert.equal(stepsInWindows(samples, [[0, 5 * MIN], [10 * MIN, 15 * MIN]]), 950);
});

test('passi: un campione non viene mai contato più del suo totale', () => {
  assert.equal(stepsInWindows([sample(0, 10, 1000)], [[0, 6 * MIN], [4 * MIN, 10 * MIN]]), 1000);
});

const walk = (extra: Partial<LegInput> = {}): LegInput => ({ mode: 'piedi', gpsM: 1000, rejectedM: 0, seconds: 720, steps: null, ...extra });

test('passi di Connessione Salute: confermano un tratto che l\'app non riusciva a confermare', () => {
  // Telefono in tasca: l'app ha contato solo 200 passi e sa che il conteggio è parziale.
  const before = walk({ steps: 200, stepsComplete: false });
  assert.equal(evaluateLeg(before).status, 'dichiarato');
  assert.equal(evaluateLeg(mergeHealthSteps(before, 1350)).status, 'verificato');
});

test('passi di Connessione Salute: un numero basso non toglie mai punti', () => {
  // L'app aveva un conteggio completo e sufficiente; Connessione Salute è in ritardo.
  const complete = walk({ steps: 1400, stepsComplete: true });
  assert.deepEqual(mergeHealthSteps(complete, 300), complete);
  // L'app non aveva passi: quelli di Connessione Salute sono un minimo, niente anomalia.
  const merged = mergeHealthSteps(walk(), 100);
  assert.equal(merged.stepsComplete, false);
  const result = evaluateLeg(merged);
  assert.equal(result.status, 'dichiarato');
  assert.equal(result.rawPoints, 10);
});

test('passi di Connessione Salute: non riguardano gli altri mezzi', () => {
  const bike: LegInput = { mode: 'bici', gpsM: 3000, rejectedM: 0, seconds: 720, steps: null };
  assert.deepEqual(mergeHealthSteps(bike, 900), bike);
  assert.deepEqual(mergeHealthSteps(walk({ steps: 10 }), null), walk({ steps: 10 }));
});

// ---------- attività ----------

let counter = 0;
function session(extra: Partial<HealthSession> = {}): HealthSession {
  counter += 1;
  const start = extra.start ?? NOW - 5 * 60 * MIN;
  return {
    id: `s${counter}`,
    origin: 'com.strava',
    start,
    end: start + 30 * MIN,
    exerciseType: 79,
    manual: false,
    distanceM: 2500,
    steps: 3400,
    ...extra,
  };
}

function liveTrip(startedAt: number, minutes: number, legPoints = 20): Trip {
  const score = scoreTrip([{ mode: 'piedi', gpsM: legPoints * 100, rejectedM: 0, seconds: minutes * 60, steps: legPoints * 150 }], {
    commute: false,
    bonusAlreadyToday: true,
  });
  return { ...score, id: `live${startedAt}`, day: dayKey(startedAt), startedAt, endedAt: startedAt + minutes * MIN, commute: false };
}

test('una camminata registrata da un\'altra app diventa un tragitto a piedi', () => {
  const { trips, skipped } = importSessions([session()], [], OPTS);
  assert.equal(skipped.length, 0);
  assert.equal(trips.length, 1);
  const [trip] = trips;
  assert.equal(trip.source, 'salute');
  assert.equal(trip.sourceApp, 'com.strava');
  assert.equal(trip.total, 25);
  assert.equal(trip.bonus, 0);
  assert.equal(trip.legs[0].mode, 'piedi');
  assert.equal(trip.legs[0].status, 'verificato');
});

test('un giro in bici vale 8 punti al chilometro, come dichiarato', () => {
  const { trips } = importSessions([session({ exerciseType: 8, distanceM: 5000, steps: null })], [], OPTS);
  assert.equal(trips[0].legs[0].mode, 'bici');
  assert.equal(trips[0].total, 40);
  assert.equal(trips[0].legs[0].status, 'dichiarato');
});

test('palestra, nuoto e cyclette non sono spostamenti', () => {
  for (const exerciseType of [9, 57, 70, 74, 83]) {
    const { trips, skipped } = importSessions([session({ exerciseType })], [], OPTS);
    assert.equal(trips.length, 0);
    assert.equal(skipped[0].reason, 'tipo');
  }
});

test('le attività inserite a mano non danno punti', () => {
  const { trips, skipped } = importSessions([session({ manual: true })], [], OPTS);
  assert.equal(trips.length, 0);
  assert.equal(skipped[0].reason, 'manuale');
});

test('senza distanza, troppo corta, troppo vecchia, non conclusa: niente', () => {
  const cases: [Partial<HealthSession>, string][] = [
    [{ distanceM: null }, 'senza-distanza'],
    [{ distanceM: 0 }, 'senza-distanza'],
    [{ distanceM: 150 }, 'corta'],
    [{ start: FROM - 60 * MIN }, 'vecchia'],
    [{ start: NOW - 10 * MIN }, 'non-conclusa'],
  ];
  for (const [extra, reason] of cases) {
    const { trips, skipped } = importSessions([session(extra)], [], OPTS);
    assert.equal(trips.length, 0, reason);
    assert.equal(skipped[0].reason, reason);
  }
});

test('la stessa attività non viene importata due volte', () => {
  const s = session();
  const first = importSessions([s], [], OPTS);
  const second = importSessions([s], first.trips, OPTS);
  assert.equal(second.trips.length, 0);
  assert.equal(second.skipped[0].reason, 'gia-importata');
});

test('un\'attività che coincide con un tragitto misurato dall\'app è un doppione', () => {
  const start = NOW - 3 * 60 * MIN;
  const existing = [liveTrip(start, 30)];
  const { trips, skipped } = importSessions([session({ start: start + 2 * MIN })], existing, OPTS);
  assert.equal(trips.length, 0);
  assert.equal(skipped[0].reason, 'doppione');
});

test('la stessa uscita registrata da due app conta una volta sola', () => {
  const start = NOW - 4 * 60 * MIN;
  const { trips, skipped } = importSessions(
    [session({ start, origin: 'com.strava' }), session({ start: start + MIN, origin: 'com.fitbit.FitbitMobile' })],
    [],
    OPTS,
  );
  assert.equal(trips.length, 1);
  assert.equal(skipped[0].reason, 'doppione');
});

test('una camminata con troppo pochi passi non è valida', () => {
  const { trips } = importSessions([session({ distanceM: 3000, steps: 400 })], [], OPTS);
  assert.equal(trips[0].legs[0].status, 'anomalo');
  assert.equal(trips[0].total, 0);
});

test('senza dati sui passi vale la dichiarazione, ma con il limite di velocità', () => {
  const slow = importSessions([session({ steps: null })], [], OPTS).trips[0];
  assert.equal(slow.legs[0].status, 'dichiarato');
  assert.equal(slow.total, 25);
  // 10 km in mezz'ora "a piedi" senza passi: non credibile.
  const fast = importSessions([session({ steps: null, distanceM: 10_000 })], [], OPTS).trips[0];
  assert.equal(fast.legs[0].status, 'anomalo');
});

test('in sedia a rotelle i passi non vengono usati', () => {
  const { trips } = importSessions([session({ exerciseType: 82, steps: 12 })], [], OPTS);
  assert.equal(trips[0].legs[0].status, 'dichiarato');
  assert.equal(trips[0].total, 25);
});

test('il tetto per tragitto vale anche per le attività importate', () => {
  const run = session({ exerciseType: 56, distanceM: 15_000, steps: 16_000, start: NOW - 6 * 60 * MIN });
  run.end = run.start + 90 * MIN;
  assert.equal(importSessions([run], [], OPTS).trips[0].total, TRIP_CAP);
});

test('due attività una dopo l\'altra condividono il tetto, come due tragitti', () => {
  const start = NOW - 6 * 60 * MIN;
  const a = session({ start, distanceM: 4000, steps: 5500 });
  a.end = start + 45 * MIN;
  const b = session({ start: a.end + 5 * MIN, distanceM: 4000, steps: 5500 });
  b.end = b.start + 45 * MIN;
  const { trips } = importSessions([b, a], [], OPTS);
  assert.deepEqual(trips.map((t) => t.total), [40, 20]);
  assert.equal(trips[1].capUsed, 40);
});

test('nomi delle app di origine', () => {
  assert.equal(appName('com.strava'), 'Strava');
  assert.equal(appName('android'), 'questo telefono');
  assert.equal(appName('com.android.healthconnect.phone.jd5bdd37e1a8'), 'questo telefono');
  assert.equal(appName('com.esempio.sconosciuta'), 'com.esempio.sconosciuta');
  assert.equal(appName(undefined), 'Connessione Salute');
});
