/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayKey, scoreTrip, type LegInput, type Trip } from './scoring';
import {
  TIER_GROUP_SIZE,
  challengeProblem,
  challengeRule,
  challengeState,
  cleanNickname,
  gapPhrase,
  initials,
  inviteCode,
  isoWeek,
  mainMode,
  monthEnd,
  monthStart,
  normalizeCode,
  pointsBetween,
  rankEntries,
  reachedAt,
  rollTier,
  tierAfter,
  timeLeft,
  weekEnd,
  weekKey,
  weekLabel,
  weekStart,
  zoneFor,
  type Challenge,
  type Challenger,
  type Entry,
} from './social';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
// Sabato 10 ottobre 2026.
const NOW = at(2026, 10, 10, 18);

let counter = 0;
function trip(endedAt: number, legs: [LegInput['mode'], number][]): Trip {
  const inputs: LegInput[] = legs.map(([mode, km]) => ({
    mode,
    gpsM: km * 1000,
    rejectedM: 0,
    seconds: (km / (mode === 'piedi' ? 5 : 20)) * 3600,
    steps: mode === 'piedi' ? Math.round(km * 1400) : null,
  }));
  const score = scoreTrip(inputs, { commute: false, bonusAlreadyToday: true });
  counter += 1;
  return { ...score, id: `t${counter}`, day: dayKey(endedAt), startedAt: endedAt - HOUR, endedAt, commute: false };
}

// ---------- tempo ----------

test('la settimana va da lunedì a domenica', () => {
  assert.equal(weekStart(NOW), at(2026, 10, 5, 0));
  assert.equal(weekEnd(NOW), at(2026, 10, 12, 0));
  // Di domenica sera si è ancora nella stessa settimana; di lunedì mattina nella nuova.
  assert.equal(weekStart(at(2026, 10, 11, 23)), at(2026, 10, 5, 0));
  assert.equal(weekStart(at(2026, 10, 12, 0)), at(2026, 10, 12, 0));
});

test('numero della settimana secondo ISO 8601', () => {
  assert.deepEqual(isoWeek(NOW), { year: 2026, week: 41 });
  // Il 1° gennaio 2027 è un venerdì: appartiene ancora alla settimana 53 del 2026.
  assert.deepEqual(isoWeek(at(2027, 1, 1)), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek(at(2027, 1, 4)), { year: 2027, week: 1 });
  // Il 29 dicembre 2025 è un lunedì: è già la settimana 1 del 2026.
  assert.deepEqual(isoWeek(at(2025, 12, 29)), { year: 2026, week: 1 });
  assert.equal(weekKey(NOW), '2026-S41');
});

test('la settimana del cambio dell\'ora dura comunque fino al lunedì a mezzanotte', () => {
  // Ora solare: domenica 25 ottobre 2026.
  const inside = at(2026, 10, 22);
  assert.equal(weekStart(inside), at(2026, 10, 19, 0));
  assert.equal(weekEnd(inside), at(2026, 10, 26, 0));
});

test('etichetta della settimana, anche a cavallo di due mesi', () => {
  assert.equal(weekLabel(NOW), 'Settimana 41 · 5–11 ottobre');
  assert.equal(weekLabel(at(2026, 10, 1)), 'Settimana 40 · 28 settembre–4 ottobre');
});

test('inizio e fine del mese', () => {
  assert.equal(monthStart(NOW), at(2026, 10, 1, 0));
  assert.equal(monthEnd(NOW), at(2026, 11, 1, 0));
  assert.equal(monthEnd(at(2026, 12, 15)), at(2027, 1, 1, 0));
});

test('tempo che manca', () => {
  assert.equal(timeLeft(NOW + 30 * 60_000, NOW), "meno di un'ora");
  assert.equal(timeLeft(NOW + 5 * HOUR, NOW), '5 ore');
  assert.equal(timeLeft(NOW + 30 * HOUR, NOW), '2 giorni');
  assert.equal(timeLeft(NOW + DAY, NOW), '1 giorno');
  assert.equal(timeLeft(NOW - 1, NOW), 'conclusa');
});

// ---------- punti dell'utente ----------

test('punti del periodo: conta l\'istante di fine del tragitto', () => {
  const trips = [trip(at(2026, 10, 4, 23), [['piedi', 2]]), trip(at(2026, 10, 5, 8), [['piedi', 1]]), trip(at(2026, 10, 9, 8), [['bici', 2]])];
  assert.equal(pointsBetween(trips, weekStart(NOW), weekEnd(NOW)), 10 + 16);
  assert.equal(pointsBetween(trips, weekStart(NOW) - 7 * DAY, weekStart(NOW)), 20);
});

test('quando è stato raggiunto un traguardo', () => {
  const trips = [trip(NOW - 3 * DAY, [['piedi', 3]]), trip(NOW - 2 * DAY, [['piedi', 3]]), trip(NOW - DAY, [['piedi', 3]])];
  assert.equal(reachedAt(trips, NOW - 4 * DAY, NOW, 50), NOW - 2 * DAY);
  assert.equal(reachedAt(trips, NOW - 4 * DAY, NOW, 91), null);
  // I punti fatti prima dell'inizio non contano.
  assert.equal(reachedAt(trips, NOW - 2.5 * DAY, NOW, 50), NOW - DAY);
});

test('il mezzo che ha portato più punti', () => {
  const trips = [trip(NOW - DAY, [['piedi', 1], ['tpl', 6]]), trip(NOW - 2 * DAY, [['tpl', 5]])];
  assert.equal(mainMode(trips, NOW - 7 * DAY, NOW), 'tpl');
  assert.equal(mainMode([], NOW - 7 * DAY, NOW), null);
});

// ---------- graduatoria ----------

const entry = (id: string, points: number, extra: Partial<Entry> = {}): Entry => ({ id, name: id, points, ...extra });

test('graduatoria: a parità di punti la posizione è la stessa', () => {
  const ranked = rankEntries([entry('d', 10), entry('a', 30), entry('c', 20), entry('b', 20), entry('e', 0)]);
  assert.deepEqual(ranked.map((r) => [r.id, r.rank]), [['a', 1], ['b', 2], ['c', 2], ['d', 4], ['e', 5]]);
});

test('graduatoria: freccia rispetto alla posizione precedente', () => {
  const ranked = rankEntries([entry('a', 30, { previousRank: 2 }), entry('b', 20, { previousRank: 1 }), entry('c', 10, { previousRank: 3 }), entry('d', 5)]);
  assert.deepEqual(ranked.map((r) => r.trend), ['su', 'giu', 'stabile', null]);
});

test('iniziali', () => {
  assert.equal(initials('Giulia R.'), 'GR');
  assert.equal(initials('marco'), 'MA');
  assert.equal(initials('  Anna Maria  Bianchi '), 'AB');
  assert.equal(initials(''), '?');
});

test('quanto manca a chi sta davanti', () => {
  const ranked = rankEntries([entry('a', 412), entry('b', 388), entry('c', 351), entry('io', 326), entry('e', 298)]);
  assert.equal(gapPhrase(ranked, 'io'), '25 punti dal podio');
  assert.equal(gapPhrase(ranked, 'b'), '24 punti da chi hai davanti');
  assert.equal(gapPhrase(ranked, 'a'), 'In testa con 24 punti di vantaggio');
  assert.equal(gapPhrase(rankEntries([entry('io', 0)]), 'io'), 'Per ora ci sei solo tu');
  assert.equal(gapPhrase(rankEntries([entry('io', 5), entry('x', 5)]), 'io'), 'In testa a pari merito');
  assert.equal(gapPhrase(rankEntries([entry('a', 9), entry('io', 8)]), 'io'), '1 punto da chi hai davanti');
});

// ---------- lega a livelli ----------

test('lega a livelli: i primi 5 salgono, gli ultimi 5 scendono', () => {
  assert.equal(zoneFor(1, 20, 'Argento', 300), 'sale');
  assert.equal(zoneFor(5, 20, 'Argento', 120), 'sale');
  assert.equal(zoneFor(6, 20, 'Argento', 119), 'resta');
  assert.equal(zoneFor(15, 20, 'Argento', 20), 'resta');
  assert.equal(zoneFor(16, 20, 'Argento', 10), 'scende');
});

test('lega a livelli: senza punti non si sale, dal Bronzo non si scende, dal Diamante non si sale', () => {
  assert.equal(zoneFor(1, 20, 'Bronzo', 0), 'resta');
  assert.equal(zoneFor(20, 20, 'Bronzo', 0), 'resta');
  assert.equal(zoneFor(1, 20, 'Diamante', 900), 'resta');
  assert.equal(zoneFor(18, 20, 'Diamante', 10), 'scende');
});

test('lega a livelli: in un gruppo piccolo nessuno sale e scende insieme', () => {
  // Con 6 persone: scendono le ultime 5, quindi può salire solo la prima.
  assert.equal(zoneFor(1, 6, 'Argento', 50), 'sale');
  assert.equal(zoneFor(2, 6, 'Argento', 40), 'scende');
  assert.equal(TIER_GROUP_SIZE, 20);
});

test('lega a livelli: cambio di livello a fine settimana', () => {
  assert.equal(tierAfter('Bronzo', 'sale'), 'Argento');
  assert.equal(tierAfter('Diamante', 'sale'), 'Diamante');
  assert.equal(tierAfter('Bronzo', 'scende'), 'Bronzo');
  const start = { tier: 'Bronzo' as const, week: '2026-S40' };
  assert.deepEqual(rollTier(start, '2026-S40', 1, 500), start);
  const promoted = rollTier(start, '2026-S41', 3, 210);
  assert.equal(promoted.tier, 'Argento');
  assert.deepEqual(promoted.lastOutcome, { week: '2026-S40', zone: 'sale', rank: 3, from: 'Bronzo' });
  const relegated = rollTier({ tier: 'Oro', week: '2026-S40' }, '2026-S41', 19, 4);
  assert.equal(relegated.tier, 'Argento');
});

// ---------- sfide ----------

const person = (id: string, points: number, extra: Partial<Challenger> = {}): Challenger => ({ id, name: id, points, ...extra });

function challenge(extra: Partial<Challenge>): Challenge {
  return { id: 'c1', title: 'Sfida', kind: 'tempo', target: 0, startsAt: NOW - 2 * DAY, endsAt: NOW + 5 * DAY, teams: false, people: [], ...extra };
}

test('sfida a tempo: in corso finché non scade, poi vince chi ha più punti', () => {
  const c = challenge({ people: [person('io', 80, { me: true }), person('a', 120), person('b', 40)] });
  const running = challengeState(c, NOW);
  assert.equal(running.status, 'in-corso');
  assert.deepEqual(running.winners, []);
  assert.deepEqual(running.sides.map((s) => [s.name, s.rank]), [['a', 1], ['io', 2], ['b', 3]]);
  assert.equal(running.sides[1].ratio, 80 / 120);

  const over = challengeState(c, c.endsAt);
  assert.equal(over.status, 'conclusa');
  assert.deepEqual(over.winners, ['a']);
  assert.equal(over.won, false);
});

test('sfida a tempo: pari merito e nessun punto', () => {
  const tie = challengeState(challenge({ people: [person('io', 50, { me: true }), person('a', 50)] }), NOW + 6 * DAY);
  assert.deepEqual(tie.winners.sort(), ['a', 'io']);
  assert.equal(tie.won, true);
  const empty = challengeState(challenge({ people: [person('io', 0, { me: true }), person('a', 0)] }), NOW + 6 * DAY);
  assert.deepEqual(empty.winners, []);
  assert.equal(empty.status, 'conclusa');
});

test('sfida a traguardo: si chiude appena il primo arriva', () => {
  const c = challenge({
    kind: 'traguardo',
    target: 100,
    people: [person('io', 104, { me: true, reachedAt: NOW - HOUR }), person('a', 131, { reachedAt: NOW - 30 * 60_000 }), person('b', 60)],
  });
  const state = challengeState(c, NOW);
  assert.equal(state.status, 'conclusa');
  // "a" ha più punti, ma ci è arrivato dopo.
  assert.deepEqual(state.winners, ['io']);
  assert.equal(state.won, true);
  assert.equal(state.closesAt, NOW - HOUR);
  assert.deepEqual(state.sides.map((s) => s.name), ['io', 'a', 'b']);
  assert.equal(state.sides[0].ratio, 1);
  assert.equal(state.sides[2].ratio, 0.6);
});

test('sfida a traguardo: prima dell\'arrivo è in corso; alla scadenza vince chi è più avanti', () => {
  const c = challenge({ kind: 'traguardo', target: 250, people: [person('io', 90, { me: true }), person('a', 140)] });
  assert.equal(challengeState(c, NOW).status, 'in-corso');
  const expired = challengeState(c, c.endsAt + 1);
  assert.equal(expired.status, 'conclusa');
  assert.deepEqual(expired.winners, ['a']);
});

test('sfida a traguardo: un arrivo futuro non chiude la sfida adesso', () => {
  const c = challenge({ kind: 'traguardo', target: 100, people: [person('io', 60, { me: true }), person('a', 100, { reachedAt: NOW + HOUR })] });
  assert.equal(challengeState(c, NOW).status, 'in-corso');
});

test('sfida non ancora iniziata', () => {
  const c = challenge({ startsAt: NOW + DAY, endsAt: NOW + 4 * DAY, people: [person('io', 0, { me: true }), person('a', 0)] });
  assert.equal(challengeState(c, NOW).status, 'in-attesa');
});

test('sfida a squadre: conta la somma dei punti', () => {
  const c = challenge({
    teams: true,
    people: [person('io', 30, { me: true, team: 0 }), person('a', 90, { team: 0 }), person('b', 70, { team: 1 }), person('c', 40, { team: 1 })],
  });
  const state = challengeState(c, c.endsAt);
  assert.deepEqual(state.sides.map((s) => [s.name, s.points]), [['Squadra lime', 120], ['Squadra corallo', 110]]);
  assert.deepEqual(state.winners.sort(), ['a', 'io']);
  assert.equal(state.won, true);
});

test('regola della sfida in una riga', () => {
  assert.equal(challengeRule(challenge({ kind: 'traguardo', target: 250 })), 'Il primo a 250 punti');
  assert.equal(challengeRule(challenge({ startsAt: NOW, endsAt: NOW + 7 * DAY })), 'Chi fa più punti in 7 giorni');
  assert.equal(challengeRule(challenge({ teams: true, startsAt: NOW, endsAt: NOW + 3 * DAY })), 'La squadra che fa più punti in 3 giorni');
});

test('controlli su una sfida nuova', () => {
  const ok = { title: 'Ufficio', kind: 'tempo' as const, target: 0, days: 7, people: 3, teams: false };
  assert.equal(challengeProblem(ok), null);
  assert.ok(challengeProblem({ ...ok, title: ' ' }));
  assert.ok(challengeProblem({ ...ok, people: 1 }));
  assert.ok(challengeProblem({ ...ok, people: 11 }));
  assert.ok(challengeProblem({ ...ok, teams: true, people: 3 }));
  assert.ok(challengeProblem({ ...ok, kind: 'traguardo', target: 0 }));
  assert.equal(challengeProblem({ ...ok, kind: 'traguardo', target: 250, days: 0 }), null);
});

// ---------- inviti e soprannomi ----------

test('codice d\'invito: sei caratteri che non si confondono', () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 200; i++) {
    const code = inviteCode(random);
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(normalizeCode(code), code);
  }
  assert.equal(inviteCode(() => 0.999999999), 'AAAAAA'.replace(/A/g, '9'));
});

test('codice scritto dall\'utente', () => {
  assert.equal(normalizeCode(' ab3-k9z '), 'AB3K9Z');
  assert.equal(normalizeCode('AB3K9'), null);
  // La O e lo zero non esistono nei codici.
  assert.equal(normalizeCode('ABO0K9'), null);
});

test('soprannome', () => {
  assert.equal(cleanNickname('  Robbie   81 '), 'Robbie 81');
  assert.equal(cleanNickname('R'), null);
  assert.equal(cleanNickname('x'.repeat(21)), null);
});
