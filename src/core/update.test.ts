import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isNewer, parseLatest } from './update';

const APK = 'https://github.com/cinocinorob/Vado/releases/download/ultima/vado.apk';

test('versione: il file pubblicato si legge solo se è fatto bene', () => {
  assert.deepEqual(parseLatest({ build: 120, apk: APK }), { build: 120, apk: APK });
  assert.equal(parseLatest({ build: '120', apk: APK }), null);
  assert.equal(parseLatest({ build: 120, apk: 'https://altrove.example/vado.apk' }), null);
  assert.equal(parseLatest(null), null);
  assert.equal(parseLatest('Not Found'), null);
});

test('versione: avvisa solo se quella pubblicata è più alta', () => {
  assert.equal(isNewer(119, { build: 120, apk: APK }), true);
  assert.equal(isNewer(120, { build: 120, apk: APK }), false);
  assert.equal(isNewer(121, { build: 120, apk: APK }), false);
});

test('versione: senza numero proprio (app di sviluppo) non avvisa mai', () => {
  assert.equal(isNewer(0, { build: 120, apk: APK }), false);
  assert.equal(isNewer(Number.NaN, { build: 120, apk: APK }), false);
  assert.equal(isNewer(119, null), false);
});
