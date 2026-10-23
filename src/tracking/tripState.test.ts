/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Fix } from '../core/geo';
import { routeBetween } from '../core/metro';
import type { ModeId } from '../core/modes';
import { scoreTrip } from '../core/scoring';
import { ROMA } from '../data/metro';
import {
  afterRestart,
  applyFixes,
  applySteps,
  currentLeg,
  dismissTransit,
  enterBackground,
  forDraft,
  legSpans,
  legSteps,
  pauseTrip,
  pendingTransit,
  resumeTrip,
  settleTransit,
  splitTransit,
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

// --- Metro: il GPS sparisce tra due stazioni ---

const T0 = 1_000_000;

function atStation(id: string, offsetM: number, t: number): Fix {
  const s = ROMA.stations.get(id);
  assert.ok(s, id);
  return { lat: s.lat + offsetM / 111_195, lon: s.lon, t, accuracy: 10, speed: 0 };
}

/** Fermo all'ingresso di una stazione, poi niente per `minutes`, poi fermo all'uscita di un'altra. */
function underground(from: string, to: string, minutes: number): Fix[] {
  return [
    ...Array.from({ length: 5 }, (_, i) => atStation(from, 40, T0 + i * 3000)),
    ...Array.from({ length: 5 }, (_, i) => atStation(to, -50, T0 + minutes * 60_000 + i * 3000)),
  ];
}

test('con i mezzi pubblici il tratto sottoterra vale i metri della rete ed è verificato', () => {
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);
  const end = T0 + 26 * 60_000;
  const trip = applyFixes(startTrip({ mode: 'tpl', commute: false, now: T0, stepsUsable: false, gpsUsable: true, background: true }), underground('flaminio', 'eur-fermi', 25));
  const [input] = toLegInputs(trip, end, true);
  assert.equal(Math.round(input.gpsM), route.meters);
  assert.deepEqual(input.hops?.map((h) => h.label), ['Flaminio → EUR Fermi']);

  const score = scoreTrip([input], { commute: false, bonusAlreadyToday: false });
  assert.equal(score.legs[0].status, 'verificato');
  assert.equal(score.legs[0].route, 'Flaminio → EUR Fermi');
  assert.match(score.legs[0].note, /Linea A, cambio a Termini, linea B/);
  assert.equal(score.total, Math.floor((route.meters / 1000) * 4));
});

test('con un altro mezzo lo stesso buco resta in linea d’aria', () => {
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);
  const trip = applyFixes(startTrip({ mode: 'carsharing', commute: false, now: T0, stepsUsable: false, gpsUsable: true, background: true }), underground('flaminio', 'eur-fermi', 25));
  const [input] = toLegInputs(trip, T0 + 26 * 60_000, true);
  assert.equal(input.hops, undefined);
  assert.ok(input.gpsM < route.meters - 1000);
});

test('i nomi delle stazioni restano nella bozza su disco, le coordinate no', () => {
  const trip = applyFixes(startTrip({ mode: 'tpl', commute: false, now: T0, stepsUsable: false, gpsUsable: true, background: true }), underground('termini', 'laurentina', 25));
  const draft = forDraft(trip, T0 + 26 * 60_000);
  const text = JSON.stringify(draft);
  assert.match(text, /Termini → Laurentina/);
  assert.doesNotMatch(text, /41\.\d{3}|12\.\d{3}/);
});

/** Una camminata verso nord a partire da una stazione, una posizione ogni tre secondi. */
function walkFrom(id: string, startM: number, meters: number, t0: number): Fix[] {
  const s = ROMA.stations.get(id);
  assert.ok(s, id);
  const n = Math.round(meters / 4.2);
  return Array.from({ length: n + 1 }, (_, i) => ({
    lat: s.lat + (startM + i * 4.2) / 111_195,
    lon: s.lon,
    t: t0 + i * 3000,
    accuracy: 8,
    speed: 1.4,
  }));
}

const START = { commute: false, stepsUsable: false, gpsUsable: true, background: true };

test('uscito dalla metro, una sola posizione e subito Termina: vale comunque la rete', () => {
  const route = routeBetween(ROMA, 'termini', 'colosseo');
  assert.ok(route);
  let trip = startTrip({ ...START, mode: 'tpl', now: T0 });
  trip = applyFixes(trip, [atStation('termini', 40, T0), atStation('termini', 41, T0 + 3000)]);
  // Cento secondi senza posizioni, poi una sola lettura all'uscita.
  trip = applyFixes(trip, [atStation('colosseo', -40, T0 + 110_000)]);
  assert.equal(currentLeg(trip).track.distanceM, 0);

  const [input] = toLegInputs(trip, T0 + 112_000, true);
  assert.deepEqual(input.hops?.map((h) => h.label), ['Termini → Colosseo']);
  // Mai meno della linea d'aria tra le due posizioni, che qui supera di poco la rete.
  assert.ok(input.gpsM >= route.meters && input.gpsM < route.meters + 100, String(input.gpsM));
});

test('a piedi, metro, a piedi, cambiando mezzo sottoterra: la metro va al tratto dei mezzi', () => {
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);
  const ride = 25 * 60_000;

  // Cammino fino all'ingresso di Flaminio.
  let trip = startTrip({ ...START, mode: 'piedi', now: T0 });
  const approach = walkFrom('flaminio', -260, 220, T0);
  trip = applyFixes(trip, approach);
  const enter = approach[approach.length - 1].t + 20_000;
  // Sulla banchina, senza segnale, passo ai mezzi pubblici.
  trip = switchMode(trip, 'tpl', enter);
  // Un minuto prima di uscire, ancora sottoterra, torno "a piedi".
  const leave = enter + ride - 60_000;
  trip = switchMode(trip, 'piedi', leave);
  assert.equal(currentLeg(trip).handover, true);
  // Fuori da EUR Fermi cammino per 300 metri.
  const after = walkFrom('eur-fermi', 30, 300, enter + ride);
  trip = applyFixes(trip, after);
  const end = after[after.length - 1].t + 2000;

  assert.equal(currentLeg(trip).handover, false);
  const [walkIn, metro, walkOut] = toLegInputs(trip, end, true);
  assert.ok(walkIn.gpsM > 180 && walkIn.gpsM < 240, String(walkIn.gpsM));
  assert.deepEqual(metro.hops?.map((h) => h.label), ['Flaminio → EUR Fermi']);
  assert.ok(metro.gpsM >= route.meters && metro.gpsM < route.meters + 100, String(metro.gpsM));
  // Il tempo del viaggio sta sul tratto della metro: la velocità media resta da treno.
  assert.ok(metro.seconds > 24 * 60 && metro.seconds < 27 * 60, String(metro.seconds));
  // La camminata dopo l'uscita non eredita il salto: niente metri scartati.
  assert.equal(walkOut.rejectedM, 0);
  assert.ok(walkOut.gpsM > 250 && walkOut.gpsM < 320, String(walkOut.gpsM));
  assert.ok(walkOut.seconds < 5 * 60, String(walkOut.seconds));

  const score = scoreTrip([walkIn, metro, walkOut], { commute: false, bonusAlreadyToday: false });
  assert.deepEqual(score.legs.map((l) => l.status === 'anomalo'), [false, false, false]);
  assert.equal(score.legs[1].route, 'Flaminio → EUR Fermi');
  assert.equal(score.legs[1].status, 'verificato');
});

test('cambio di mezzo in superficie, con il segnale: nessun passaggio di consegne', () => {
  let trip = startTrip({ ...START, mode: 'tpl', now: T0 });
  const ride = walkFrom('termini', 0, 120, T0);
  trip = applyFixes(trip, ride);
  const change = ride[ride.length - 1].t + 1000;
  trip = switchMode(trip, 'piedi', change);
  const walk = walkFrom('termini', 124, 200, change + 2000);
  trip = applyFixes(trip, walk);

  assert.equal(currentLeg(trip).handover, false);
  const [before, after] = toLegInputs(trip, walk[walk.length - 1].t + 1000, true);
  assert.equal(before.hops, undefined);
  assert.ok(before.gpsM > 90 && before.gpsM < 130, String(before.gpsM));
  assert.ok(after.gpsM > 170 && after.gpsM < 215, String(after.gpsM));
});

test('cambio sottoterra e uscita lontano dalle stazioni: linea d’aria ai mezzi, camminata pulita', () => {
  let trip = startTrip({ ...START, mode: 'tpl', now: T0 });
  trip = applyFixes(trip, [atStation('termini', 40, T0), atStation('termini', 41, T0 + 3000)]);
  trip = switchMode(trip, 'piedi', T0 + 60_000);
  // Ricompaio dieci minuti dopo a 3 km, lontano da ogni stazione (in bus, per esempio).
  const s = ROMA.stations.get('termini');
  assert.ok(s);
  const far = Array.from({ length: 12 }, (_, i) => ({ lat: s.lat + (3000 + i * 4.2) / 111_195, lon: s.lon + 0.03, t: T0 + 600_000 + i * 3000, accuracy: 8, speed: 1.4 }));
  trip = applyFixes(trip, far);

  const [transit, walk] = toLegInputs(trip, T0 + 640_000, true);
  assert.equal(transit.hops, undefined);
  assert.ok(transit.gpsM > 3000, String(transit.gpsM));
  assert.equal(walk.rejectedM, 0);
  assert.ok(walk.gpsM < 60, String(walk.gpsM));
});

// ---------- mezzo pubblico dimenticato ----------

test('metro con il tratto ancora "A piedi": riconosciuta dalle stazioni e spostata ai mezzi pubblici', () => {
  const route = routeBetween(ROMA, 'flaminio', 'eur-fermi');
  assert.ok(route);
  const ride = 25 * 60_000;
  let trip = startTrip({ ...START, mode: 'piedi', now: T0 });
  const approach = walkFrom('flaminio', -260, 220, T0);
  trip = applyFixes(trip, approach);
  const out = approach[approach.length - 1].t + ride;
  const after = walkFrom('eur-fermi', 30, 300, out);
  trip = applyFixes(trip, after);
  const end = after[after.length - 1].t + 2000;

  // Senza riattribuzione il tratto a piedi sarebbe scartato.
  const plain = scoreTrip(toLegInputs(trip, end, true), { commute: false, bonusAlreadyToday: false });
  assert.equal(plain.legs[0].status, 'anomalo');

  const fixed = settleTransit(trip, end, 'metro');
  const inputs = toLegInputs(fixed, end, true);
  assert.deepEqual(inputs.map((l) => l.mode), ['piedi', 'tpl', 'piedi']);
  const [walkIn, metro, walkOut] = inputs;
  assert.ok(walkIn.gpsM > 150 && walkIn.gpsM < 240, String(walkIn.gpsM));
  assert.deepEqual(metro.hops?.map((h) => h.label), ['Flaminio → EUR Fermi']);
  assert.ok(metro.gpsM >= route.meters - 10 && metro.gpsM < route.meters + 300, `${metro.gpsM} / ${route.meters}`);
  assert.ok(metro.seconds > 24 * 60 && metro.seconds < 26 * 60, String(metro.seconds));
  assert.equal(walkOut.rejectedM, 0);
  assert.ok(walkOut.gpsM > 200 && walkOut.gpsM < 320, String(walkOut.gpsM));
  const score = scoreTrip(inputs, { commute: false, bonusAlreadyToday: false });
  assert.deepEqual(score.legs.map((l) => l.status === 'anomalo'), [false, false, false]);
  assert.equal(score.legs[1].route, 'Flaminio → EUR Fermi');
  // Un viaggio in metro riconosciuto non richiede domande.
  assert.equal(pendingTransit(trip), null);
  // Già durante il tragitto: il tratto corrente torna "A piedi" dopo la metro.
  const live = splitTransit(trip, end, 'metro');
  assert.equal(live.legs.length, 3);
  assert.equal(currentLeg(live).mode, 'piedi');
  assert.equal(currentLeg(live).closed, false);
});

test('uscito dalla metro con il tratto "A piedi" e chiuso subito: la metro conta lo stesso', () => {
  let trip = startTrip({ ...START, mode: 'piedi', now: T0 });
  const approach = walkFrom('termini', -200, 160, T0);
  trip = applyFixes(trip, approach);
  const out = approach[approach.length - 1].t + 9 * 60_000;
  trip = applyFixes(trip, [atStation('san-giovanni', -40, out)]);
  const fixed = settleTransit(trip, out + 2000, 'metro');
  const inputs = toLegInputs(fixed, out + 2000, true);
  assert.deepEqual(inputs.map((l) => l.mode), ['piedi', 'tpl', 'piedi']);
  assert.ok((inputs[1].hops?.length ?? 0) === 1);
  const score = scoreTrip(inputs, { commute: false, bonusAlreadyToday: false });
  assert.ok(score.legs.every((l) => l.status !== 'anomalo'));
});

test('bus con il tratto "A piedi": si chiede, e se confermato i km veloci vanno ai mezzi pubblici', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 500, 1.4);
  trip = applySteps(trip, 700);
  trip = sim.move(trip, 3000, 8);
  trip = sim.move(trip, 300, 1.4);
  trip = applySteps(trip, 1150);
  const end = sim.t + 1000;

  const plain = scoreTrip(toLegInputs(trip, end, true), FIRST);
  assert.equal(plain.legs[0].status, 'anomalo');
  const pending = pendingTransit(trip);
  assert.ok(pending, 'il pezzo veloce va segnalato');
  near(pending.fast.rejectedM, 3000, 250);

  // "No": niente cambia e non si chiede più.
  const no = dismissTransit(trip);
  assert.equal(pendingTransit(no), null);
  assert.equal(settleTransit(no, end, 'tutti').legs.length, 1);

  // "Sì": tre tratti, nessuno scartato, il tempo del bus sta sul bus.
  const yes = settleTransit(trip, end, 'tutti');
  const inputs = toLegInputs(yes, end, true);
  assert.deepEqual(inputs.map((l) => l.mode), ['piedi', 'tpl', 'piedi']);
  near(inputs[0].gpsM, 500, 60);
  near(inputs[1].gpsM, 3000, 150);
  near(inputs[2].gpsM, 300, 60);
  near(inputs[1].seconds, 3000 / 8, 30);
  // I passi vanno ai due pezzi a piedi, in proporzione.
  assert.equal((inputs[0].steps ?? 0) + (inputs[2].steps ?? 0), 1149);
  const score = scoreTrip(inputs, FIRST);
  assert.deepEqual(score.legs.map((l) => l.status), ['verificato', 'dichiarato', 'verificato']);
});

test('ancora sul bus quando si conferma: il tratto dei mezzi pubblici resta aperto e continua', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 400, 1.4);
  trip = applySteps(trip, 560);
  trip = sim.move(trip, 2000, 8);
  trip = splitTransit(trip, sim.t + 1000, 'tutti');
  assert.deepEqual(trip.legs.map((l) => [l.mode, l.closed]), [['piedi', true], ['tpl', false]]);
  trip = sim.move(trip, 1000, 8);
  const inputs = toLegInputs(trip, sim.t + 1000, true);
  near(inputs[1].gpsM, 3000, 200);
  assert.equal(inputs[1].rejectedM, 0);
  assert.ok(scoreTrip(inputs, FIRST).legs.every((l) => l.status !== 'anomalo'));
});

test('un salto isolato del GPS a piedi non viene scambiato per un mezzo pubblico', () => {
  const sim = new Sim();
  let trip = begin(sim);
  trip = sim.move(trip, 1500, 1.4);
  assert.equal(pendingTransit(trip), null);
  assert.equal(splitTransit(trip, sim.t, 'tutti').legs.length, 1);
});
