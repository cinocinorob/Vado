/// <reference types="node" />
/**
 * Prove statistiche del filtro GPS su percorsi simulati con errori realistici.
 *
 * I limiti qui sotto fotografano il comportamento attuale con un margine: se
 * una modifica al filtro li supera, è peggiorato qualcosa. Sono misure su un
 * simulatore, non su strada.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { EMPTY_TRACK, addFix, closeTrack, type Fix, type TrackState } from './geo';
import { getMode, type ModeId } from './modes';
import { evaluateLeg } from './scoring';
import { CANYON, CITY, OPEN_SKY, observe, rng, route, still, summary, withoutSpeed } from './testing/gpsSimulator';

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);

function track(fixes: Fix[], mode: ModeId): TrackState {
  const max = getMode(mode).maxSegmentMs;
  return closeTrack(fixes.reduce((state, fix) => addFix(state, fix, max).state, EMPTY_TRACK), max);
}

const errorPct = (measured: number, real: number) => ((measured - real) / real) * 100;

test("fermo per 30 minuti: l'oscillazione del GPS aggiunge poca strada", () => {
  const meters = (noise: typeof CITY) => summary(SEEDS.map((s) => track(observe(still(1800), 3, noise, s), 'tpl').distanceM));
  const open = meters(OPEN_SKY);
  const city = meters(CITY);
  const canyon = meters(CANYON);
  assert.ok(open.p90 <= 10, `cielo aperto p90 ${open.p90.toFixed(0)} m`);
  assert.ok(city.median <= 120, `città mediana ${city.median.toFixed(0)} m`);
  assert.ok(canyon.median <= 400, `vie strette mediana ${canyon.median.toFixed(0)} m`);
});

test('camminata rettilinea di 2 km: errore contenuto, mai gonfiata oltre il 15%', () => {
  for (const [name, noise, maxOver] of [['città', CITY, 12], ['vie strette', CANYON, 15]] as const) {
    const errors = summary(
      SEEDS.map((s) => {
        const real = route(2000, () => 1.4);
        return errorPct(track(observe(real.points, 3, noise, s), 'piedi').distanceM, real.meters);
      }),
    );
    assert.ok(errors.median > -3 && errors.median < 7, `${name}: mediana ${errors.median.toFixed(1)}%`);
    assert.ok(errors.max <= maxOver, `${name}: massimo ${errors.max.toFixed(1)}%`);
  }
});

test('camminata di 2 km tra gli isolati: il filtro taglia gli angoli, quindi sottostima', () => {
  for (const [name, noise, floor] of [['città', CITY, -9], ['vie strette', CANYON, -15]] as const) {
    const errors = summary(
      SEEDS.map((s) => {
        const real = route(2000, () => 1.4, { block: 80 });
        return errorPct(track(observe(real.points, 3, noise, s), 'piedi').distanceM, real.meters);
      }),
    );
    assert.ok(errors.median >= floor && errors.median <= 1, `${name}: mediana ${errors.median.toFixed(1)}%`);
  }
});

test('una camminata onesta, anche breve e con segnale scarso, non risulta mai "non valida"', () => {
  for (const noise of [CITY, CANYON, withoutSpeed(CITY), withoutSpeed(CANYON)]) {
    for (const meters of [250, 2000]) {
      const invalid = SEEDS.filter((s) => {
        const real = route(meters, () => 1.4, { block: 80 });
        const t = track(observe(real.points, 3, noise, s), 'piedi');
        const leg = evaluateLeg({
          mode: 'piedi',
          gpsM: t.distanceM,
          rejectedM: t.rejectedM,
          seconds: real.seconds,
          steps: Math.round(real.meters / 0.72),
        });
        return leg.status === 'anomalo';
      });
      assert.equal(invalid.length, 0, `${meters} m: ${invalid.length} su ${SEEDS.length}`);
    }
  }
});

test('una pedalata onesta di 5 km con i semafori non risulta mai "non valida"', () => {
  for (const [name, noise] of [['città', CITY], ['vie strette', CANYON]] as const) {
    const errors: number[] = [];
    let invalid = 0;
    for (const s of SEEDS) {
      const r = rng(s + 5);
      let v = 5;
      const real = route(5000, () => (v = Math.max(3, Math.min(r() < 0.03 ? 11 : 9, v + (r() - 0.5) * 2))), {
        block: 300,
        stopEveryM: 500,
        stopS: 30,
      });
      const t = track(observe(real.points, 3, noise, s), 'bici');
      errors.push(errorPct(t.distanceM, real.meters));
      const leg = evaluateLeg({ mode: 'bici', gpsM: t.distanceM, rejectedM: t.rejectedM, seconds: real.seconds, steps: null });
      if (leg.status === 'anomalo') invalid += 1;
    }
    const e = summary(errors);
    assert.equal(invalid, 0, `${name}: ${invalid} non valide`);
    assert.ok(e.median >= -10 && e.median <= 3, `${name}: mediana ${e.median.toFixed(1)}%`);
  }
});

/** Auto in città: velocità che varia tra 0 e 50 km/h, 5 km. */
function carTrip(seed: number) {
  const r = rng(seed);
  let v = 0;
  return route(5000, () => (v = Math.max(0, Math.min(14, v + (r() - 0.45) * 4))), { block: 400 });
}

test("auto in città dichiarata come camminata: sempre non valida", () => {
  const caught = SEEDS.filter((s) => {
    const real = carTrip(s);
    const t = track(observe(real.points, 3, CITY, s + 1), 'piedi');
    return evaluateLeg({ mode: 'piedi', gpsM: t.distanceM, rejectedM: t.rejectedM, seconds: real.seconds, steps: 40 }).status === 'anomalo';
  });
  assert.equal(caught.length, SEEDS.length);
});

test('auto in città dichiarata come bici: scoperta nella gran parte dei casi, non in tutti', () => {
  const caught = SEEDS.filter((s) => {
    const real = carTrip(s);
    const t = track(observe(real.points, 3, CITY, s + 1), 'bici');
    return evaluateLeg({ mode: 'bici', gpsM: t.distanceM, rejectedM: t.rejectedM, seconds: real.seconds, steps: null }).status === 'anomalo';
  });
  // Limite noto: nel traffico lento un'auto e una bici hanno la stessa velocità.
  assert.ok(caught.length >= SEEDS.length * 0.8, `${caught.length} su ${SEEDS.length}`);
});

test('treno, 40 km a 126 km/h: errore sotto il 5% anche senza velocità misurata', () => {
  for (const noise of [CITY, withoutSpeed(CANYON)]) {
    const errors = summary(
      SEEDS.slice(0, 15).map((s) => {
        const real = route(40_000, () => 35, { block: 8000 });
        return errorPct(track(observe(real.points, 3, noise, s), 'treno').distanceM, real.meters);
      }),
    );
    assert.ok(Math.abs(errors.median) < 5 && errors.min > -6 && errors.max < 5, JSON.stringify(errors));
  }
});
