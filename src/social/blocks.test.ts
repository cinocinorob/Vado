import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BLOCKED_NAME, mask, withBlocks } from './blocks';
import type { SocialSource } from './types';

test('blocco: nasconde nome, avatar e vetrina ma non i punti', () => {
  const blocked = new Set(['x']);
  const e = { id: 'x', name: 'Insulto', points: 40, tree: { species: 'ulivo', stage: 'seme', trees: 0 }, showcase: [{ id: 'podio', level: 1 }] };
  assert.deepEqual(mask(e, blocked), { id: 'x', name: BLOCKED_NAME, points: 40, tree: null, showcase: [] });
  assert.equal(mask({ id: 'y', name: 'Amica' }, blocked).name, 'Amica');
  // Se stessi non ci si può bloccare.
  assert.equal(mask({ id: 'x', name: 'Io', me: true }, blocked).name, 'Io');
});

test('blocco: chi è bloccato non compare tra gli sfidabili né tra i compagni di viaggio', async () => {
  const base = {
    demo: false,
    problem: () => null,
    rivals: async () => [{ id: 'x', name: 'Insulto' }, { id: 'y', name: 'Amica' }],
    travellers: async () => [{ id: 'x', name: 'Insulto', journey: 'colli', km: 3, startedAt: 0 }],
  } as unknown as SocialSource;
  const source = withBlocks(base, async () => new Set(['x']));
  assert.deepEqual((await source.rivals(0)).map((p) => p.id), ['y']);
  assert.deepEqual(await source.travellers(0), []);
});
