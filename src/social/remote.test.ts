/// <reference types="node" />
/** Comportamento della sorgente vera quando il server non c'è o risponde male. Nessuna rete: le risposte sono finte. */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OFFLINE, remoteSource } from './remote';

type Reply = { status: number; body: unknown } | 'rete';

function harness(replies: (name: string, params: Record<string, unknown>) => Reply) {
  const memory = new Map<string, string>();
  const calls: { name: string; params: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const source = remoteSource({
    rest: 'https://esempio.invalid/rest/v1',
    key: 'sb_publishable_prova',
    storage: {
      get: async (key) => memory.get(key) ?? null,
      set: async (key, value) => void memory.set(key, value),
      remove: async (key) => void memory.delete(key),
    },
    loadTrips: async () => [],
    newSecret: async () => 's'.repeat(64),
    fetch: (async (url: string, init: { body: string; headers: Record<string, string> }) => {
      const name = url.split('/rpc/')[1];
      const params = JSON.parse(init.body) as Record<string, unknown>;
      calls.push({ name, params, headers: init.headers });
      const reply = replies(name, params);
      if (reply === 'rete') throw new TypeError('Network request failed');
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }) as unknown as typeof fetch,
  });
  return { source, calls, memory };
}

const REGISTERED = { status: 200, body: { id: 'u1', nickname: 'Robbie' } };

test('la chiave pubblica va nell’intestazione apikey, la segreta resta fuori dall’indirizzo', async () => {
  const { source, calls } = harness(() => REGISTERED);
  const result = await source.setNickname('Robbie');
  assert.deepEqual(result, { ok: true, value: { id: 'u1', nickname: 'Robbie' } });
  assert.equal(calls[0].name, 'vado_register');
  assert.equal(calls[0].headers.apikey, 'sb_publishable_prova');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls[0].params.p_secret, 's'.repeat(64));
});

test('senza rete: il soprannome non viene dato per salvato', async () => {
  const { source } = harness(() => 'rete');
  assert.deepEqual(await source.setNickname('Robbie'), { ok: false, problem: OFFLINE });
  assert.equal(await source.profile(), null);
});

test('se la risposta alla registrazione si perde, il secondo tentativo usa la stessa chiave', async () => {
  let attempt = 0;
  const { source, calls } = harness(() => (attempt++ === 0 ? 'rete' : REGISTERED));
  await source.setNickname('Robbie');
  await source.setNickname('Robbie');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].params.p_secret, calls[1].params.p_secret);
});

test('senza rete in lettura: restano gli ultimi dati buoni, con l’avviso', async () => {
  let online = true;
  const { source } = harness((name) => {
    if (!online) return 'rete';
    if (name === 'vado_register') return REGISTERED;
    if (name === 'vado_leagues') return { status: 200, body: [{ id: 'l1', name: 'Casa', code: 'ABC234' }] };
    return { status: 200, body: null };
  });
  await source.setNickname('Robbie');
  const first = await source.leagues(1000);
  assert.equal(first.length, 1);
  assert.equal(source.problem(), null);

  online = false;
  assert.deepEqual(await source.leagues(100_000), first);
  assert.equal(source.problem(), OFFLINE);

  online = true;
  await source.leagues(200_000);
  assert.equal(source.problem(), null);
});

test('funzioni non ancora create sul server: lo si dice chiaramente', async () => {
  const { source } = harness(() => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function' } }));
  const result = await source.setNickname('Robbie');
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.problem, /non è ancora pronto/);
});

test('profilo cancellato dal server: si torna alla scelta del soprannome', async () => {
  let deleted = false;
  const { source } = harness((name) => {
    if (name === 'vado_register') return REGISTERED;
    return deleted ? { status: 400, body: { code: 'P0001', message: 'non-registrato' } } : { status: 200, body: [] };
  });
  await source.setNickname('Robbie');
  assert.ok(await source.profile());
  deleted = true;
  await source.leagues(1000);
  assert.equal(await source.profile(), null);
});

test('un rifiuto del server arriva come frase, non come sigla', async () => {
  const { source } = harness((name) => (name === 'vado_register' ? REGISTERED : { status: 400, body: { code: 'P0001', message: 'lega-inesistente' } }));
  await source.setNickname('Robbie');
  const result = await source.joinLeague('ABC234');
  assert.deepEqual(result, { ok: false, problem: 'Nessuna lega ha questo codice. Controlla di averlo scritto giusto.' });
});
