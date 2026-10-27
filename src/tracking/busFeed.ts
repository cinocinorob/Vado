/**
 * Durante un tratto con i mezzi pubblici, ogni minuto circa, si scarica il
 * flusso delle posizioni dei bus di Roma (circa 100 KB) e si cercano i mezzi
 * accanto al telefono. Il confronto avviene sul telefono: la posizione
 * dell'utente non viene mandata a nessuno.
 *
 * Si scarica solo se ci si sta muovendo a velocità da mezzo: chi aspetta alla
 * fermata o è in metro (senza segnale) non consuma dati.
 */
import { haversineM } from '../core/geo';
import { readVehicles } from '../core/gtfsrt';
import { sightings } from '../core/busMatch';
import { diag } from '../diagnostics/log';
import { activeTripStore } from './store';
import { BUS_MODES, addSightings, currentLeg } from './tripState';

export const FEED_URL = 'https://romamobilita.it/sites/default/files/rome_rtgtfs_vehicle_positions_feed.pb';
const EVERY_MS = 55_000;
const TIMEOUT_MS = 15_000;
/** Almeno 7 km/h negli ultimi 30 secondi. */
const MOVING_MS = 2;
/** Con il tratto "A piedi" si cerca il bus solo sopra i 13 km/h: più veloce di una corsa. */
const ON_FOOT_FAST_MS = 3.6;

let lastPoll = 0;
let busy = false;

export function pollBuses(now: number): void {
  if (busy || now - lastPoll < EVERY_MS) return;
  const trip = activeTripStore.get();
  if (!trip || trip.paused) return;
  const leg = currentLeg(trip);
  const samples = leg.bus?.samples ?? [];
  if (!BUS_MODES.includes(leg.mode) || samples.length < 2) return;
  const last = samples[samples.length - 1];
  if (now - last.t > 30_000) return;
  const earlier = [...samples].reverse().find((s) => last.t - s.t >= 25_000);
  const speed = earlier ? haversineM(earlier, last) / ((last.t - earlier.t) / 1000) : 0;
  if (!earlier || speed < (leg.mode === 'tpl' ? MOVING_MS : ON_FOOT_FAST_MS)) return;

  lastPoll = now;
  busy = true;
  (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(FEED_URL, { signal: controller.signal });
      if (!response.ok) {
        diag(`Bus in tempo reale: il flusso risponde ${response.status}`);
        return;
      }
      const buffer = new Uint8Array(await response.arrayBuffer());
      const box = { minLat: last.lat - 0.01, maxLat: last.lat + 0.01, minLon: last.lon - 0.013, maxLon: last.lon + 0.013 };
      const vehicles = readVehicles(buffer, box);
      const current = activeTripStore.get();
      if (!current) return;
      const found = sightings(vehicles, currentLeg(current).bus?.samples ?? samples, Date.now());
      diag(`Bus in tempo reale: ${vehicles.length} mezzi nella zona, ${found.length} accanto al telefono${found.length ? ` (linee ${[...new Set(found.map((f) => f.routeId))].join(', ')})` : ''}`);
      if (found.length > 0) activeTripStore.update((t) => addSightings(t, found));
    } catch {
      diag('Bus in tempo reale: flusso non raggiungibile');
      // Rete assente o flusso non raggiungibile: il tratto resta "dichiarato".
    } finally {
      clearTimeout(timer);
      busy = false;
    }
  })();
}

export function resetBusPolling(): void {
  lastPoll = 0;
}
