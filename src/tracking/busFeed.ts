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
import { activeTripStore } from './store';
import { addSightings, currentLeg } from './tripState';

export const FEED_URL = 'https://romamobilita.it/sites/default/files/rome_rtgtfs_vehicle_positions_feed.pb';
const EVERY_MS = 55_000;
const TIMEOUT_MS = 15_000;
/** Almeno 7 km/h negli ultimi 30 secondi. */
const MOVING_MS = 2;

let lastPoll = 0;
let busy = false;

export function pollBuses(now: number): void {
  if (busy || now - lastPoll < EVERY_MS) return;
  const trip = activeTripStore.get();
  if (!trip || trip.paused) return;
  const leg = currentLeg(trip);
  const samples = leg.bus?.samples ?? [];
  if (leg.mode !== 'tpl' || samples.length < 2) return;
  const last = samples[samples.length - 1];
  if (now - last.t > 30_000) return;
  const earlier = [...samples].reverse().find((s) => last.t - s.t >= 25_000);
  if (!earlier || haversineM(earlier, last) / ((last.t - earlier.t) / 1000) < MOVING_MS) return;

  lastPoll = now;
  busy = true;
  (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(FEED_URL, { signal: controller.signal });
      if (!response.ok) return;
      const buffer = new Uint8Array(await response.arrayBuffer());
      const box = { minLat: last.lat - 0.01, maxLat: last.lat + 0.01, minLon: last.lon - 0.013, maxLon: last.lon + 0.013 };
      const vehicles = readVehicles(buffer, box);
      const current = activeTripStore.get();
      if (!current) return;
      const found = sightings(vehicles, currentLeg(current).bus?.samples ?? samples, Date.now());
      if (found.length > 0) activeTripStore.update((t) => addSightings(t, found));
    } catch {
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
