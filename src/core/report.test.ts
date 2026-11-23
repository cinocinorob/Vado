import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REPORT_MARGIN_MS, linesFor, reportText } from './report';
import type { Trip } from './scoring';

const T0 = new Date(2026, 10, 23, 8, 0, 0).getTime();

const trip: Trip = {
  id: 't1',
  day: '2026-11-23',
  startedAt: T0,
  endedAt: T0 + 20 * 60 * 1000,
  commute: true,
  legs: [{ mode: 'piedi', meters: 1500, seconds: 1200, steps: 1900, status: 'dichiarato', note: '', rawPoints: 15, points: 15 }],
  legPoints: 15,
  bonus: 10,
  total: 25,
  meters: 1500,
  carFreeMeters: 1500,
  capUsed: 0,
};

test('segnalazione: prende solo le righe del tragitto, con il margine', () => {
  const lines = [
    { t: T0 - REPORT_MARGIN_MS - 1, text: 'prima' },
    { t: T0 - 1000, text: 'avvio' },
    { t: T0 + 5 * 60 * 1000, text: 'durante' },
    { t: trip.endedAt + REPORT_MARGIN_MS + 1, text: 'dopo' },
  ];
  assert.deepEqual(
    linesFor(lines, trip).map((l) => l.text),
    ['avvio', 'durante'],
  );
});

test('segnalazione: il testo dice cosa ha contato l\'app e cosa era davvero', () => {
  const text = reportText(trip, 'bus', 'Ero sul 64', [{ t: T0 + 60000, text: 'Nessuna posizione per 40 s' }], 'Vado 0.9.0');
  assert.match(text, /A piedi · 1500 m · 20 min · 1900 passi · dichiarato · 15 punti/);
  assert.match(text, /Mezzo vero secondo l'utente: Bus/);
  assert.match(text, /Nota dell'utente: Ero sul 64/);
  assert.match(text, /Nessuna posizione per 40 s/);
  assert.doesNotMatch(text, /\d+\.\d{4,}/, 'nessun numero che somigli a una coordinata');
});
