/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Fix } from '../core/geo';
import type { ModeId } from '../core/modes';
import { scoreTrip } from '../core/scoring';
import {
  afterRestart,
  applyFixes,
  applySteps,
  currentLeg,
  enterBackground,
  forDraft,
  legSpans,
  legSteps,
  pauseTrip,
  resumeTrip,
  startTrip,
  switchMode,
  toLegInputs,
  type ActiveTrip,
} from './tripState';

const M_PER_DEG_LAT = 111_195;
const LON = 12.501;
const FIRST = { commute: true, bonusAlreadyToday: false };

/** Simula il movimento verso nord e tiene il conto di posizione e orologio. */
class Sim {
  lat = 41.901;
  t = 1_000_000;
  move(trip: ActiveTrip, meters: number, speed: number, mocked = false): ActiveTrip {
    const fixes: Fix[] = [];
    const n = Math.round(meters / (speed * 3));
    for (let i = 0; i < n; i++) {
      this.lat += (speed * 3) / M_PER_DEG_LAT;
      this.t += 3000;
      fixes.push({ lat: this.lat, lon: LON, t: this.t, accuracy: 8, speed, mocked });
    }
    return applyFixes(trip, fixes);
  }
}

function begin(sim: Sim, mode: ModeId = 'piedi'): ActiveTrip {
  const trip = startTrip({ mode, commute: true, now: sim.t, stepsUsable: true, gpsUsable: true, background: true });
  // Posizione di partenza + prima lettura del contapassi (Android parte da 1).
  return applySteps(applyFixes(trip, [{ lat: sim.lat, lon: LON, t: sim.t, accuracy: 8, speed: 0 }]), 1);
}

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual.toFixed(1)} non è entro ${tolerance} da ${expected}`);

test('tragitto a tre tratti: piedi, mezzi, piedi', () => {
  const sim = new Sim();
  let trip = begin(sim);

  trip = sim.move(trip, 1210, 1.4);
  trip = applySteps(trip, 1601);
  trip = switchMode(trip, 'tpl', sim.t);
  trip = sim.move(trip, 6410, 9);
  trip = applySteps(trip, 1640); // qualche passo sul mezzo
  trip = switchMode(trip, 'piedi', sim.t);
  trip = sim.move(trip, 810, 1.4);
  trip = applySteps(trip, 2740);

  const inputs = toLegInputs(trip, sim.t, true);
  assert.deepEqual(inputs.map((l) => l.mode), ['piedi', 'tpl', 'piedi']);
  assert.deepEqual(inputs.map((l) => l.steps), [1600, 39, 1100]);
  near(inputs[0].gpsM, 1210, 30);
  near(inputs[1].gpsM, 6410, 80);
  near(inputs[2].gpsM, 810, 30);
  // La somma dei tratti non perde strada nei cambi di mezzo.
  near(inputs[0].gpsM + inputs[1].gpsM + inputs[2].gpsM, 8430, 40);

  const score = scoreTrip(inputs, FIRST);
  assert.deepEqual(score.legs.map((l) => l.status), ['verificato', 'dichiarato', 'verificato']);
  assert.deepEqual(score.legs.map((l) => l.points), [12, 25, 8]);
  assert.equal(score.total, 55);
});

test('in pausa non contano né la strada né i passi né il tempo', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 300, 1.4);
  trip = applySteps(trip, 401);
  const secondsBefore = toLegInputs(trip, sim.t)[0].seconds;

  trip = pauseTrip(trip, sim.t);
  trip = sim.move(trip, 500, 1.4); // ignorato
  trip = applySteps(trip, 1100); // 699 passi in pausa
  assert.equal(legSteps(trip, currentLeg(trip)), 400);
  assert.equal(toLegInputs(trip, sim.t)[0].seconds, secondsBefore);

  trip = resumeTrip(trip, sim.t);
  trip = sim.move(trip, 300, 1.4);
  trip = applySteps(trip, 1500);

  const [leg] = toLegInputs(trip, sim.t, true);
  assert.equal(leg.steps, 800);
  near(leg.gpsM, 600, 30);
  near(leg.seconds, secondsBefore + 300 / 1.4, 10);
});

test('auto dichiarata come camminata: zero punti', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 5000, 12);
  trip = applySteps(trip, 20);
  const score = scoreTrip(toLegInputs(trip, sim.t, true), FIRST);
  assert.equal(score.legs[0].status, 'anomalo');
  assert.equal(score.total, 0);
});

test('posizioni simulate: il tratto risulta non valido', () => {
  const sim = new Sim();
  let trip = begin(sim, 'bici');
  trip = sim.move(trip, 3000, 5, true);
  const [leg] = toLegInputs(trip, sim.t, true);
  assert.ok((leg.mocked ?? 0) > 0);
  assert.equal(scoreTrip([leg], FIRST).legs[0].status, 'anomalo');
});

test('senza letture del contapassi i passi sono "non noti", non zero', () => {
  const sim = new Sim();
  let trip = startTrip({ mode: 'piedi', commute: false, now: sim.t, stepsUsable: true, gpsUsable: true, background: false });
  trip = sim.move(trip, 1000, 1.4);
  const [leg] = toLegInputs(trip, sim.t, true);
  assert.equal(leg.steps, null);
  assert.equal(scoreTrip([leg], { commute: false, bonusAlreadyToday: false }).legs[0].status, 'dichiarato');
});

test('telefono in tasca: al rientro il numero vecchio dei passi non viene usato', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 100, 1.4);
  trip = applySteps(trip, 141);

  trip = enterBackground(trip);
  trip = sim.move(trip, 920, 1.4); // il servizio continua a ricevere le posizioni
  // Rientro nell'app: finché non arriva una lettura, i passi non si conoscono.
  assert.equal(legSteps(trip, currentLeg(trip)), null);
  const stale = scoreTrip(toLegInputs(trip, sim.t, true), FIRST).legs[0];
  assert.equal(stale.status, 'dichiarato');
  assert.equal(stale.points, 10);

  // Caso buono: il telefono ha contato anche a schermo spento.
  const counted = scoreTrip(toLegInputs(applySteps(trip, 1390), sim.t, true), FIRST).legs[0];
  assert.equal(counted.status, 'verificato');
  assert.equal(counted.steps, 1389);

  // Caso sfortunato: ha contato solo i passi fatti ad app aperta. Non è una
  // prova contro l'utente, perché il tratto è passato in secondo piano.
  const missed = toLegInputs(applySteps(trip, 150), sim.t, true)[0];
  assert.equal(missed.stepsComplete, false);
  const judged = scoreTrip([missed], FIRST).legs[0];
  assert.equal(judged.status, 'dichiarato');
  assert.equal(judged.points, 10);
});

test('lo stesso numero basso di passi, ad app sempre aperta, è invece una prova', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 1000, 1.4);
  trip = applySteps(trip, 150);
  const [leg] = toLegInputs(trip, sim.t, true);
  assert.equal(leg.stepsComplete, true);
  assert.equal(scoreTrip([leg], FIRST).legs[0].status, 'anomalo');
});

test('cambio di mezzo con i passi non aggiornati: il tratto chiuso resta senza passi', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 400, 1.4);
  trip = enterBackground(trip);
  trip = switchMode(trip, 'tpl', sim.t);
  trip = applySteps(trip, 600); // arriva dopo: non deve finire nel tratto già chiuso
  trip = sim.move(trip, 2000, 9);
  trip = switchMode(trip, 'piedi', sim.t);
  trip = sim.move(trip, 300, 1.4);
  trip = applySteps(trip, 1030);
  assert.deepEqual(toLegInputs(trip, sim.t, true).map((l) => l.steps), [null, 0, 430]);
});

test("dopo un riavvio dell'app i passi non vengono più usati", () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 400, 1.4);
  trip = applySteps(trip, 500);
  const before = toLegInputs(trip, sim.t)[0].seconds;
  // La bozza era stata salvata 2 secondi prima della chiusura; l'app riparte dopo un minuto.
  trip = afterRestart(forDraft(trip, sim.t - 2000), sim.t + 60_000);
  sim.t += 60_000;
  assert.equal(toLegInputs(trip, sim.t)[0].seconds, before - 2);
  assert.equal(trip.stepsLost, true);
  sim.lat += 300 / M_PER_DEG_LAT; // strada fatta ad app chiusa: non contata
  trip = sim.move(trip, 400, 1.4);
  const [leg] = toLegInputs(trip, sim.t, true);
  assert.equal(leg.steps, null);
  near(leg.gpsM, 800, 50);
});

test('la bozza scritta su disco non contiene coordinate', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 600, 1.4);
  assert.ok(trip.path.length > 5);
  const draft = forDraft(trip, sim.t);
  const text = JSON.stringify(draft);
  assert.equal(/"lat"|"lon"/.test(text), false, text.slice(0, 200));
  assert.equal(text.includes('41.9'), false);
  // I totali però restano.
  assert.equal(currentLeg(draft).track.distanceM, currentLeg(trip).track.distanceM);
});

test('il percorso da disegnare non cresce senza limite', () => {
  const sim = new Sim();
  let trip = begin(sim, 'treno');
  trip = sim.move(trip, 200_000, 40);
  assert.ok(trip.path.length <= 400, String(trip.path.length));
  assert.ok(trip.path.length > 100, String(trip.path.length));
});

test('gli intervalli di movimento di un tratto escludono le pause e si chiudono al cambio di mezzo', () => {
  const t0 = 1_000_000;
  let trip = startTrip({ mode: 'piedi', commute: false, now: t0, stepsUsable: false, gpsUsable: true, background: true });
  assert.deepEqual(legSpans(currentLeg(trip), t0 + 60_000), [[t0, t0 + 60_000]]);

  trip = pauseTrip(trip, t0 + 60_000);
  assert.deepEqual(legSpans(currentLeg(trip), t0 + 90_000), [[t0, t0 + 60_000]]);

  trip = resumeTrip(trip, t0 + 120_000);
  trip = switchMode(trip, 'tpl', t0 + 180_000);
  assert.deepEqual(legSpans(trip.legs[0], t0 + 999_000), [
    [t0, t0 + 60_000],
    [t0 + 120_000, t0 + 180_000],
  ]);
  assert.deepEqual(legSpans(currentLeg(trip), t0 + 200_000), [[t0 + 180_000, t0 + 200_000]]);
});

test('dopo un riavvio il tempo ad app chiusa resta fuori dagli intervalli', () => {
  const t0 = 1_000_000;
  let trip = startTrip({ mode: 'piedi', commute: false, now: t0, stepsUsable: false, gpsUsable: true, background: true });
  trip = afterRestart(forDraft(trip, t0 + 30_000), t0 + 600_000);
  assert.deepEqual(legSpans(currentLeg(trip), t0 + 660_000), [
    [t0, t0 + 30_000],
    [t0 + 600_000, t0 + 660_000],
  ]);
});
