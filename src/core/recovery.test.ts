/// <reference types="node" />
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';

import { decodeRecovery, encodeRecovery } from './recovery';

test('andata e ritorno: la chiave torna identica, per cento chiavi a caso', () => {
  for (let i = 0; i < 100; i++) {
    const secret = randomBytes(32).toString('hex');
    const code = encodeRecovery(secret);
    assert.ok(code);
    assert.match(code, /^([A-HJ-NP-Z2-9]{6}-){8}[A-HJ-NP-Z2-9]{6}$/);
    assert.deepEqual(decodeRecovery(code), { ok: true, secret });
  }
});

test('si può scrivere in minuscolo, senza trattini o con spazi', () => {
  const secret = 'ab'.repeat(32);
  const code = encodeRecovery(secret) ?? '';
  assert.deepEqual(decodeRecovery(code.toLowerCase()), { ok: true, secret });
  assert.deepEqual(decodeRecovery(code.replace(/-/g, '')), { ok: true, secret });
  assert.deepEqual(decodeRecovery(` ${code.replace(/-/g, ' ')} `), { ok: true, secret });
});

test('un errore di battitura viene scoperto prima di chiedere al server', () => {
  const code = encodeRecovery('0f'.repeat(32)) ?? '';
  const chars = [...code];
  const i = chars.findIndex((c) => c !== '-');
  chars[i] = chars[i] === 'A' ? 'B' : 'A';
  const result = decodeRecovery(chars.join(''));
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.problem, /errore di battitura/);
  // Due caratteri scambiati.
  const plain = code.replace(/-/g, '');
  const swapped = plain[1] + plain[0] + plain.slice(2);
  if (swapped !== plain) assert.equal(decodeRecovery(swapped).ok, false);
});

test('codice incompleto o con caratteri impossibili: lo si dice chiaramente', () => {
  const code = encodeRecovery('12'.repeat(32)) ?? '';
  assert.match((decodeRecovery(code.slice(0, 20)) as { problem: string }).problem, /54 caratteri/);
  assert.match((decodeRecovery(`0${code.slice(1)}`) as { problem: string }).problem, /0, 1, O e I/);
  assert.equal(decodeRecovery('').ok, false);
});

test('una chiave che non è di 64 cifre esadecimali non ha codice', () => {
  assert.equal(encodeRecovery('s'.repeat(64)), null);
  assert.equal(encodeRecovery('ab'), null);
});
