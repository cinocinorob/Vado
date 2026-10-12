/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CAR_G_PER_KM, formatCo2, legCo2, totalCo2, treeTime, tripCo2 } from './co2';
import { PAUSE_MAX_DAYS, activePause, addDays, endPause, forestOf, pauseDaysLeft, plantState, startPause, type Pause } from './plant';
import { dayKey, type LegResult, type Trip } from './scoring';

const NOW = new Date(2026, 9, 12, 9, 0, 0).getTime();
const TODAY = dayKey(NOW);

function leg(mode: LegResult['mode'], meters: number, status: LegResult['status'] = 'verificato'): LegResult {
  return { mode, meters, seconds: 600, steps: null, status, note: '', rawPoints: 0, points: 0 };
}
function trip(day: string, legs: LegResult[]): Trip {
  return {
    id: `${day}-${Math.random()}`, day, startedAt: 0, endedAt: 0, commute: false, legs,
    legPoints: 0, bonus: 0, total: 0, meters: 0, carFreeMeters: 0, capUsed: 0,
  };
}
/** Un tragitto a piedi che evita esattamente `kg` di CO₂. */
const walk = (day: string, kg: number) => trip(day, [leg('piedi', (kg * 1000 * 1000) / CAR_G_PER_KM)]);

test('CO₂: 167,1 g per km senza auto; auto, car sharing e tratti non validi non contano', () => {
  assert.equal(legCo2(leg('piedi', 1000)), CAR_G_PER_KM);
  assert.equal(legCo2(leg('tpl', 6400)), 6.4 * CAR_G_PER_KM);
  assert.equal(legCo2(leg('carsharing', 5000)), 0);
  assert.equal(legCo2(leg('autoel', 5000)), 0);
  assert.equal(legCo2(leg('auto', 5000)), 0);
  assert.equal(legCo2(leg('bici', 5000, 'anomalo')), 0);
  const t = trip(TODAY, [leg('piedi', 1200), leg('tpl', 6400), leg('piedi', 800)]);
  assert.ok(Math.abs(tripCo2(t) - 8.4 * CAR_G_PER_KM) < 1e-9);
  assert.equal(totalCo2([t, t]), 2 * tripCo2(t));
});

test('CO₂: scritta leggibile, mai zero per un valore positivo', () => {
  assert.equal(formatCo2(0), '0 g');
  assert.equal(formatCo2(3), '10 g');
  assert.equal(formatCo2(200.5), '200 g');
  assert.equal(formatCo2(1069), '1,1 kg');
  assert.equal(formatCo2(1403), '1,4 kg');
  assert.equal(formatCo2(2000), '2 kg');
  assert.equal(formatCo2(38400), '38,4 kg');
  assert.equal(formatCo2(123456), '123 kg');
});

test('alberi: tempo che ci mette un albero adulto (22 kg l\'anno)', () => {
  assert.equal(treeTime(10), 'meno di un giorno');
  assert.equal(treeTime(1069), '18 giorni');
  assert.equal(treeTime(1403), '23 giorni');
  assert.equal(treeTime(5500), '3 mesi');
  assert.equal(treeTime(22000), '1 anno');
  assert.equal(treeTime(38000), '1 anno e 9 mesi');
  assert.equal(treeTime(44000), '2 anni');
});

test('germoglio: cresce per soglie, a 22 kg va nel bosco e riparte da seme', () => {
  assert.equal(plantState([], NOW).stage, 'seme');
  assert.equal(plantState([walk(TODAY, 2.9)], NOW).stage, 'seme');
  assert.equal(plantState([walk(TODAY, 3)], NOW).stage, 'germoglio');
  assert.equal(plantState([walk(TODAY, 12)], NOW).stage, 'piantina');
  const one = plantState([walk(TODAY, 12), walk(TODAY, 10)], NOW);
  assert.equal(one.trees, 1);
  assert.equal(one.stage, 'seme');
  assert.ok(one.cycleG < 1);
  const many = plantState([walk(TODAY, 22 * 6 + 4)], NOW);
  assert.equal(many.trees, 6);
  assert.equal(many.stage, 'germoglio');
});

test('bosco: gli alberi già cresciuti restano della specie di allora', () => {
  assert.deepEqual(forestOf(0, [], 'ulivo'), []);
  assert.deepEqual(forestOf(3, ['pino', 'leccio'], 'ulivo'), ['pino', 'leccio', 'ulivo']);
  assert.deepEqual(forestOf(2, [], null), ['pino', 'pino']);
  // Se i tragitti sono stati azzerati, la memoria in più non conta.
  assert.deepEqual(forestOf(1, ['cipresso', 'leccio'], 'ulivo'), ['cipresso']);
});

test('germoglio: in forma, ha sete dopo 3 giorni fermi, appassita dopo 6; un tragitto lo riprende', () => {
  const ago = (n: number) => addDays(TODAY, -n);
  assert.equal(plantState([walk(TODAY, 1)], NOW).health, 'forma');
  assert.equal(plantState([walk(ago(1), 1)], NOW).health, 'forma');
  assert.equal(plantState([walk(ago(3), 1)], NOW).health, 'forma');
  assert.equal(plantState([walk(ago(4), 1)], NOW).health, 'sete');
  assert.equal(plantState([walk(ago(6), 1)], NOW).health, 'sete');
  assert.equal(plantState([walk(ago(7), 1)], NOW).health, 'appassita');
  const back = plantState([walk(ago(30), 5), walk(TODAY, 0.1)], NOW);
  assert.equal(back.health, 'forma');
  // La crescita non torna indietro.
  assert.equal(back.stage, 'germoglio');
  // Chi non ha mai fatto un tragitto ha un seme in forma.
  assert.equal(plantState([], NOW).health, 'forma');
});

test('pausa: congela l\'aspetto, i giorni in pausa non contano, dura al massimo 14 giorni', () => {
  const ago = (n: number) => addDays(TODAY, -n);
  const trips = [walk(ago(10), 1)];
  const open = startPause([], ago(8));
  assert.equal(plantState(trips, NOW, open).health, 'pausa');
  assert.ok(activePause(open, TODAY));
  assert.equal(pauseDaysLeft(open[0], TODAY), PAUSE_MAX_DAYS - 8);
  // Chiusa oggi: gli ultimi 8 giorni erano in pausa, resta solo 1 giorno fermo prima.
  const closed = endPause(open, TODAY);
  assert.equal(closed[0].to, ago(1));
  const s = plantState(trips, NOW, closed);
  assert.equal(s.idleDays, 1);
  assert.equal(s.health, 'forma');
  // Una pausa dimenticata finisce da sola dopo 14 giorni.
  const old: Pause[] = [{ from: ago(20), to: null }];
  assert.equal(activePause(old, TODAY), null);
  const t2 = [walk(ago(21), 1)];
  assert.equal(plantState(t2, NOW, old).idleDays, 20 - PAUSE_MAX_DAYS);
  // Avviarla due volte non crea doppioni.
  assert.equal(startPause(open, TODAY).length, 1);
});
