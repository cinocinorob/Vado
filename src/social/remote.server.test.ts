/// <reference types="node" />
/**
 * Prova della sorgente vera contro un server: più persone, ognuna con il suo
 * "telefono", che creano leghe, entrano con il codice, fanno punti e si sfidano.
 *
 * Serve un server con supabase/schema.sql applicato. Il suo indirizzo arriva
 * dalla variabile VADO_TEST_SERVER (e la chiave, se serve, da VADO_TEST_KEY):
 * senza, la prova viene saltata. La lancia .github/workflows/server.yml.
 * Alla fine cancella tutti i profili che ha creato.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, test } from 'node:test';

import type { ModeId } from '../core/modes';
import type { TreeBadge } from '../core/plant';
import type { Trip } from '../core/scoring';
import { challengeState, weekStart } from '../core/social';
import { remoteSource, type RemoteSource } from './remote';

const SERVER = process.env.VADO_TEST_SERVER;
const KEY = process.env.VADO_TEST_KEY || null;
const skip = SERVER ? false : 'nessun server indicato in VADO_TEST_SERVER';

let counter = 0;

function trip(points: number, endedAt: number, mode: ModeId = 'piedi'): Trip {
  counter += 1;
  return {
    id: `prova-${endedAt.toString(36)}-${counter}`,
    day: new Date(endedAt).toISOString().slice(0, 10),
    startedAt: endedAt - 600_000,
    endedAt,
    commute: false,
    legs: [{ mode, meters: 1000, seconds: 600, steps: null, status: 'dichiarato', note: '', rawPoints: points, points }],
    legPoints: points,
    bonus: 0,
    total: points,
    meters: 1000,
    carFreeMeters: 1000,
    capUsed: 0,
  };
}

type Phone = { source: RemoteSource; trips: Trip[]; tree: { current: TreeBadge | null } };

const phones: Phone[] = [];

/** Un telefono nuovo: memoria vuota, nessun tragitto, chiave segreta sua. */
function phone(): Phone {
  const memory = new Map<string, string>();
  const trips: Trip[] = [];
  const tree: { current: TreeBadge | null } = { current: null };
  const source = remoteSource({
    rest: SERVER ?? '',
    key: KEY,
    storage: {
      get: async (key) => memory.get(key) ?? null,
      set: async (key, value) => void memory.set(key, value),
      remove: async (key) => void memory.delete(key),
    },
    loadTrips: async () => trips,
    loadTree: async () => tree.current,
    newSecret: async () => randomBytes(32).toString('hex'),
  });
  const created = { source, trips, tree };
  phones.push(created);
  return created;
}

function value<T>(result: { ok: true; value: T } | { ok: false; problem: string }): T {
  assert.ok(result.ok, result.ok ? '' : result.problem);
  return result.value;
}

function problem<T>(result: { ok: true; value: T } | { ok: false; problem: string }): string {
  assert.equal(result.ok, false);
  return result.ok ? '' : result.problem;
}

after(async () => {
  // Qualunque cosa sia successa, sul server non devono restare i profili di prova.
  for (const p of phones) await p.source.reset().catch(() => undefined);
});

test('leghe, punti e sfide tra persone vere', { skip }, async () => {
  const now = Date.now();
  const tag = now.toString(36).slice(-4);
  const [a, b, c, d] = [phone(), phone(), phone(), phone()];

  // --- profili ---
  assert.equal(await a.source.profile(), null);
  const robbie = value(await a.source.setNickname(`  Robbie   ${tag} `));
  assert.equal(robbie.nickname, `Robbie ${tag}`);
  const flavia = value(await b.source.setNickname(`Flavia ${tag}`));
  const terzo = value(await c.source.setNickname(`Terzo ${tag}`));
  const quarta = value(await d.source.setNickname(`Quarta ${tag}`));
  assert.equal(new Set([robbie.id, flavia.id, terzo.id, quarta.id]).size, 4);
  assert.deepEqual(await a.source.profile(), robbie);
  // Cambiare soprannome non crea un secondo profilo.
  const renamed = value(await a.source.setNickname(`Robbie ${tag}`));
  assert.equal(renamed.id, robbie.id);
  assert.match(problem(await a.source.setNickname('x')), /da 2 a 20/);

  // --- una lega, creata da uno e raggiunta dall'altra con il codice ---
  assert.deepEqual(await a.source.leagues(now), []);
  const league = value(await a.source.createLeague('  Casa   nostra '));
  assert.equal(league.name, 'Casa nostra');
  assert.match(league.code ?? '', /^[A-HJ-NP-Z2-9]{6}$/);
  assert.deepEqual(await a.source.leagues(now), [league]);
  assert.equal(a.source.problem(), null);

  assert.match(problem(await b.source.joinLeague('ZZZZZZ')), /Nessuna lega/);
  assert.match(problem(await b.source.joinLeague('abc')), /6 caratteri/);
  // Il codice si può scrivere anche in minuscolo e con uno spazio in mezzo.
  const code = league.code ?? '';
  const joined = value(await b.source.joinLeague(`${code.slice(0, 3).toLowerCase()} ${code.slice(3)}`));
  assert.deepEqual(joined, league);
  assert.match(problem(await b.source.joinLeague(code)), /già in questa lega/);

  // --- chi non è nella lega non la vede ---
  assert.equal(await c.source.board(league.id, now), null);
  assert.deepEqual(await c.source.rivals(now), []);
  assert.deepEqual(await a.source.rivals(now), [{ id: flavia.id, name: flavia.nickname, tree: null }]);

  // --- i punti di ognuno arrivano agli altri ---
  const recent = Math.max(weekStart(now) + 1000, now - 3_600_000);
  a.trips.push(trip(30, recent, 'piedi'), trip(20, recent + 1000, 'tpl'));
  b.trips.push(trip(45, recent + 2000, 'bici'));
  // L'avatar: Flavia ha scelto l'ulivo, è a piantina e ha già due alberi nel bosco.
  b.tree.current = { species: 'ulivo', stage: 'piantina', trees: 2 };
  await a.source.sync(now);
  await b.source.sync(now);
  // Rimandare gli stessi tragitti non raddoppia nulla.
  await a.source.sync(now + 10_000);

  const mine = await a.source.board(league.id, now);
  assert.ok(mine);
  assert.equal(mine.kind, 'invito');
  assert.equal(mine.code, league.code);
  const byId = new Map(mine.entries.map((e) => [e.id, e]));
  assert.equal(byId.size, 2);
  assert.equal(byId.get(robbie.id)?.points, 50);
  assert.equal(byId.get(robbie.id)?.me, true);
  assert.equal(byId.get(robbie.id)?.mainMode, 'piedi');
  assert.deepEqual(byId.get(flavia.id)?.tree, { species: 'ulivo', stage: 'piantina', trees: 2 });
  assert.equal(byId.get(robbie.id)?.tree, null);
  assert.deepEqual((await a.source.rivals(now))[0].tree, { species: 'ulivo', stage: 'piantina', trees: 2 });

  // --- caramelle: metri senza auto inviati con i punti (ogni tragitto di prova fa 1 km) ---
  const sweets = await a.source.candies(league.id, recent + 5000);
  assert.ok(sweets);
  const sweetById = new Map((sweets ?? []).map((e) => [e.id, e.candies]));
  // Le caramelle contano solo dal 15 al 31 ottobre: fuori stagione possono essere zero.
  assert.ok((sweetById.get(robbie.id) ?? -1) >= 0);

  // --- un tragitto cancellato sul telefono sparisce anche dalla classifica ---
  const removedTrip = a.trips.pop();
  assert.ok(removedTrip);
  await a.source.forget([removedTrip.id], now + 20_000);
  const afterRemoval = await a.source.board(league.id, now);
  assert.equal(afterRemoval?.entries.find((e) => e.id === robbie.id)?.points, 50 - removedTrip.total);
  // Rimesso il tragitto, i punti tornano (serve per il resto della prova).
  a.trips.push(removedTrip);
  await a.source.sync(now + 30_000);
  assert.equal((await a.source.board(league.id, now))?.entries.find((e) => e.id === robbie.id)?.points, 50);
  assert.equal(byId.get(flavia.id)?.points, 45);
  assert.equal(byId.get(flavia.id)?.me, false);
  assert.equal(byId.get(flavia.id)?.name, flavia.nickname);
  assert.equal(byId.get(flavia.id)?.mainMode, 'bici');
  assert.equal(typeof byId.get(flavia.id)?.previousRank, 'number');

  const hers = await b.source.board(league.id, now);
  assert.ok(hers);
  assert.equal(hers.entries.find((e) => e.me)?.id, flavia.id);
  assert.equal(hers.entries.find((e) => e.id === robbie.id)?.points, 50);

  // --- sfida a traguardo: contano solo i punti fatti dopo l'inizio ---
  const duel = value(await a.source.createChallenge({ title: 'Testa a testa', kind: 'traguardo', target: 40, days: 0, teams: false, opponents: [flavia.id] }, now));
  assert.equal(duel.people.length, 2);
  assert.equal(duel.people[0].me, true);
  assert.deepEqual(duel.people.map((p) => p.points), [0, 0]);
  assert.ok(Math.abs(duel.startsAt - Date.now()) < 120_000, 'la sfida parte adesso, secondo il server');

  const later = Date.now() + 5000;
  a.trips.push(trip(25, later, 'piedi'));
  b.trips.push(trip(45, later + 1, 'bici'));
  await a.source.sync(later);
  await b.source.sync(later);

  const forHim = (await a.source.challenges(later)).find((x) => x.id === duel.id);
  const forHer = (await b.source.challenges(later)).find((x) => x.id === duel.id);
  assert.ok(forHim && forHer);
  assert.equal(forHim.people.find((p) => p.me)?.points, 25);
  assert.equal(forHim.people.find((p) => !p.me)?.points, 45);
  assert.equal(forHim.people.find((p) => p.me)?.reachedAt, null);
  assert.equal(forHim.people.find((p) => !p.me)?.reachedAt, later + 1);
  // Le regole dell'app, applicate ai dati del server: ha vinto lei, per tutti e due.
  assert.equal(challengeState(forHim, later + 5000).status, 'conclusa');
  assert.equal(challengeState(forHim, later + 5000).won, false);
  assert.equal(challengeState(forHer, later + 5000).won, true);

  // --- si sfidano solo i compagni di lega ---
  assert.match(problem(await a.source.createChallenge({ title: 'Con un estraneo', kind: 'tempo', target: 0, days: 7, teams: false, opponents: [terzo.id] }, now)), /compagni di lega/);

  // --- sfida a squadre in quattro ---
  value(await c.source.joinLeague(code));
  value(await d.source.joinLeague(code));
  const squads = value(await a.source.createChallenge({ title: 'Due contro due', kind: 'tempo', target: 0, days: 7, teams: true, opponents: [flavia.id, terzo.id, quarta.id] }, now));
  assert.equal(squads.teams, true);
  const team = new Map(squads.people.map((p) => [p.id, p.team]));
  assert.deepEqual([team.get(robbie.id), team.get(flavia.id), team.get(terzo.id), team.get(quarta.id)], [0, 1, 0, 1]);
  assert.equal(Math.round((squads.endsAt - squads.startsAt) / 86_400_000), 7);
  assert.equal((await d.source.challenges(later)).length, 1);

  // --- chi non l'ha creata ne esce; chi l'ha creata la cancella per tutti ---
  await d.source.removeChallenge(squads.id);
  assert.equal((await d.source.challenges(later)).length, 0);
  assert.equal((await a.source.challenges(later)).find((x) => x.id === squads.id)?.people.length, 3);
  await a.source.removeChallenge(squads.id);
  assert.equal((await c.source.challenges(later)).some((x) => x.id === squads.id), false);

  // --- sfida del mese ---
  const month = await a.source.monthly(later);
  assert.ok(month.points >= 25, String(month.points));
  assert.ok(month.people >= 2);
  assert.equal(month.target, 600);

  // --- uscire dalla lega ---
  await b.source.leaveLeague(league.id);
  assert.deepEqual(await b.source.leagues(later), []);
  const after = await a.source.board(league.id, later);
  assert.equal(after?.entries.some((e) => e.id === flavia.id), false);
  assert.equal(after?.entries.length, 3);

  // --- le tabelle non si leggono da fuori, e senza chiave segreta giusta non si entra ---
  const headers: Record<string, string> = KEY ? { apikey: KEY } : {};
  for (const table of ['users', 'leagues', 'scores', 'members']) {
    const direct = await fetch(`${SERVER}/${table}?select=*`, { headers });
    assert.notEqual(direct.status, 200, `la tabella ${table} risponde a una lettura diretta`);
  }
  const forged = await fetch(`${SERVER}/rpc/vado_leagues`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: 'x'.repeat(64) }),
  });
  assert.equal(forged.status, 400);
  assert.match(await forged.text(), /non-registrato/);

  // --- cambio di telefono: il codice di recupero riporta profilo, leghe e punti ---
  const recovery = await a.source.recoveryCode();
  assert.ok(recovery, 'il codice di recupero manca');
  const newPhone = phone();
  const back = value(await newPhone.source.recover(recovery));
  assert.equal(back.id, robbie.id);
  assert.deepEqual((await newPhone.source.leagues(later)).map((l) => l.id), [league.id]);
  assert.equal((await newPhone.source.board(league.id, later))?.entries.find((e) => e.me)?.points, 75);
  // Un codice di un profilo che non esiste non sostituisce quello presente.
  const stranger = await newPhone.source.recover(recovery.replace(/^[A-HJ-NP-Z2-9]/, (c) => (c === 'A' ? 'B' : 'A')));
  assert.equal(stranger.ok, false);
  assert.equal((await newPhone.source.profile())?.id, robbie.id);

  // --- cancellare il profilo ---
  const secret = await a.source.secret();
  assert.ok(secret);
  await a.source.reset();
  assert.equal(await a.source.profile(), null);
  const gone = await fetch(`${SERVER}/rpc/vado_me`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret }),
  });
  assert.match(await gone.text(), /non-registrato/);
  // La lega resta agli altri due.
  assert.equal((await c.source.board(league.id, later))?.entries.length, 2);
});
