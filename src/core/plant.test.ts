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

test('Halloween: caramelle dal 15 al 31 ottobre, un km senza auto ciascuna', async () => {
  const { candies, candyOpen } = await import('./halloween');
  const { isHalloweenSeason, resolveLook, isWitchingHour } = await import('./look');
  const at = (m: number, d: number, h = 12) => new Date(2026, m, d, h).getTime();
  const t = (end: number, legs: LegResult[]): Trip => ({ ...trip(dayKey(end), legs), startedAt: end - 600000, endedAt: end });
  const list = [
    t(at(9, 14), [leg('piedi', 5000)]),
    t(at(9, 16), [leg('piedi', 1500), leg('tpl', 2600)]),
    t(at(9, 20), [leg('auto', 9000)]),
    t(at(9, 21), [leg('carsharing', 3000), leg('bici', 900)]),
    t(at(10, 1), [leg('piedi', 3000)]),
  ];
  assert.equal(candies(list, at(9, 25)), 5);
  assert.equal(candyOpen(at(9, 31, 23)), true);
  assert.equal(candyOpen(at(10, 1)), false);
  assert.equal(isHalloweenSeason(at(9, 17)), true);
  assert.equal(isHalloweenSeason(at(10, 2)), true);
  assert.equal(isHalloweenSeason(at(10, 3)), false);
  assert.equal(resolveLook('auto', at(9, 17), false), 'halloween');
  assert.equal(resolveLook('auto', at(10, 20), true), 'scuro');
  assert.equal(resolveLook('chiaro', at(9, 17), true), 'chiaro');
  assert.equal(isWitchingHour(at(9, 31, 18)), true);
  assert.equal(isWitchingHour(at(9, 31, 12)), false);
});

test('Natale: stagione dal 1° dicembre al 6 gennaio, medaglia tra la Vigilia e Santo Stefano', async () => {
  const { isChristmasSeason, resolveLook } = await import('./look');
  const { badgeStates, seasonOpen } = await import('./badges');
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
  assert.equal(isChristmasSeason(at(2026, 11, 1)), true);
  assert.equal(isChristmasSeason(at(2027, 0, 6)), true);
  assert.equal(isChristmasSeason(at(2027, 0, 7)), false);
  assert.equal(isChristmasSeason(at(2026, 10, 30)), false);
  assert.equal(resolveLook('auto', at(2026, 11, 10), false), 'natale');
  assert.equal(resolveLook('auto', at(2026, 10, 10), true), 'scuro');
  assert.equal(seasonOpen('natale-senza-auto', at(2026, 11, 10)), true);
  assert.equal(seasonOpen('natale-senza-auto', at(2026, 6, 10)), false);
  const t = (end: number, legs: LegResult[]): Trip => ({ ...trip(dayKey(end), legs), startedAt: end - 600000, endedAt: end, carFreeMeters: 1500 });
  const get = (list: Trip[]) => badgeStates(list, at(2026, 11, 27)).find((b) => b.id === 'natale-senza-auto');
  assert.equal(get([t(at(2026, 11, 23), [leg('piedi', 1500)])])?.unlocked, false);
  assert.equal(get([t(at(2026, 11, 25), [leg('piedi', 1500)])])?.unlocked, true);
  assert.equal(get([t(at(2026, 11, 25), [leg('auto', 9000)])])?.unlocked, false);
});

test('riepilogo settimanale: lunedì alle 9, km, punti e confronto con la settimana prima', async () => {
  const { weeklyRecap } = await import('./reminders');
  const at = (d: number, h = 12) => new Date(2026, 9, d, h).getTime();
  const mk = (end: number, meters: number, total: number): Trip => ({ ...trip(dayKey(end), [leg('piedi', meters)]), startedAt: end - 600000, endedAt: end, carFreeMeters: meters, total });
  const list = [mk(at(20), 4000, 40), mk(at(22), 2500, 25), mk(at(14), 5000, 50)];
  const r = weeklyRecap(list, at(23));
  assert.ok(r);
  assert.equal(new Date(r.when).getDay(), 1);
  assert.equal(new Date(r.when).getDate(), 26);
  assert.equal(new Date(r.when).getHours(), 9);
  assert.equal(r.title, 'La tua settimana: 6,5 km senza auto');
  assert.match(r.body, /^65 punti in 2 giorni/);
  assert.match(r.body, /30% in più/);
  assert.equal(weeklyRecap(list, at(29)), null);
});
