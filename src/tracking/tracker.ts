/**
 * Collegamento con i sensori del telefono: posizione e contapassi.
 *
 * Due modi di rilevare la posizione:
 *  - "servizio": un servizio Android in primo piano, con notifica fissa, che
 *    continua a schermo spento. Parte solo da un'azione dell'utente (Avvia) e
 *    si ferma con Termina. Non richiede il permesso di posizione "sempre".
 *    Disponibile solo nelle build vere dell'app, non in Expo Go.
 *  - "schermo": rilevamento finché l'app è aperta; lo schermo viene tenuto
 *    acceso. È il ripiego per Expo Go, iOS e web.
 *
 * I passi arrivano dal sensore del telefono. Ad app in secondo piano le
 * letture si fermano. Al rientro il sensore consegna il totale aggiornato, ma
 * non è garantito che abbia contato anche nel frattempo: dipende dal telefono.
 * Per questo il tratto viene segnato come "passato in secondo piano" e finché
 * non arriva una lettura nuova il numero vecchio non viene usato.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import { AppState, PermissionsAndroid, Platform, type NativeEventSubscription } from 'react-native';

import type { Fix } from '../core/geo';
import type { ModeId } from '../core/modes';
import { capUsedBefore, dayKey, scoreTrip, summarizeDay, type Trip } from '../core/scoring';
import { withHealthSteps } from '../health/sync';
import { loadTrips, saveTrip } from '../storage/trips';
import { activeTripStore } from './store';
import {
  afterRestart,
  applyFixes,
  applySteps,
  enterBackground,
  pauseTrip,
  resumeTrip,
  startTrip,
  switchMode,
  toLegInputs,
} from './tripState';

const LOCATION_TASK = 'vado-tragitto';
const KEEP_AWAKE_TAG = 'vado-tragitto';

const LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  timeInterval: 3000,
  distanceInterval: 3,
};

function toFix(location: Location.LocationObject): Fix {
  return {
    lat: location.coords.latitude,
    lon: location.coords.longitude,
    t: location.timestamp,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    mocked: location.mocked === true,
    seenAt: Date.now(),
  };
}

// Va definito all'avvio del programma, non dentro un componente: è il punto
// in cui Android consegna le posizioni raccolte dal servizio in primo piano.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const fixes = data.locations.map(toFix);
  activeTripStore.update((trip) => applyFixes(trip, fixes));
});

/** Il servizio in primo piano esiste solo su Android e non dentro Expo Go. */
function serviceAvailable(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

let watcher: Location.LocationSubscription | null = null;
let stepWatcher: { remove: () => void } | null = null;
let appStateWatcher: NativeEventSubscription | null = null;
let serviceRunning = false;

/** Quanto si aspetta, al rientro nell'app, una lettura aggiornata dei passi. */
const FRESH_STEPS_WAIT_MS = 2500;

/**
 * La notifica fissa del servizio è ciò che rende visibile il rilevamento a
 * schermo spento. Da Android 13 va chiesto il permesso; se viene negato il
 * servizio funziona lo stesso, ma senza notifica nella tendina.
 */
async function askNotifications(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Permesso non dichiarato (per esempio dentro Expo Go): si prosegue.
  }
}

/** Tiene traccia di quando l'app va in secondo piano, per i passi. */
function watchAppState(): void {
  appStateWatcher?.remove();
  appStateWatcher = AppState.addEventListener('change', (state) => {
    if (state === 'background') activeTripStore.update(enterBackground, true);
  });
}

/** Aspetta, per poco, che arrivi una lettura dei passi successiva al rientro nell'app. */
async function freshSteps(): Promise<void> {
  const stale = () => {
    const trip = activeTripStore.get();
    return !!trip && trip.stepsUsable && trip.stepsStale;
  };
  const deadline = Date.now() + FRESH_STEPS_WAIT_MS;
  while (stale() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function startLocation(): Promise<boolean> {
  if (serviceAvailable()) {
    await askNotifications();
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        ...LOCATION_OPTIONS,
        foregroundService: {
          notificationTitle: 'Vado: tragitto in corso',
          notificationBody: "Sto misurando la distanza. Apri l'app per terminare.",
          notificationColor: '#0B1F2A',
          // Se l'app viene chiusa dall'elenco delle app recenti il rilevamento
          // si ferma: nessuna posizione raccolta senza che l'utente lo veda.
          killServiceOnDestroy: true,
        },
      });
      serviceRunning = true;
      return true;
    } catch {
      // Si ripiega sul rilevamento ad app aperta.
    }
  }
  watcher = await Location.watchPositionAsync(LOCATION_OPTIONS, (location) => {
    activeTripStore.update((trip) => applyFixes(trip, [toFix(location)]));
  });
  await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
  return false;
}

async function stopSensors(): Promise<void> {
  watcher?.remove();
  watcher = null;
  stepWatcher?.remove();
  stepWatcher = null;
  appStateWatcher?.remove();
  appStateWatcher = null;
  await deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
  if (serviceRunning || serviceAvailable()) {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
    } catch {
      // Il servizio non era attivo: niente da fermare.
    }
    serviceRunning = false;
  }
}

function startSteps(): void {
  stepWatcher?.remove();
  stepWatcher = Pedometer.watchStepCount(({ steps }) => {
    activeTripStore.update((trip) => applySteps(trip, steps));
  });
}

async function askLocation(): Promise<boolean> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

async function askSteps(): Promise<boolean> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return false;
    const { granted } = await Pedometer.requestPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}

export type StartResult = { ok: true } | { ok: false; message: string };

/** Avvia un tragitto. Va chiamato da un tocco dell'utente, con l'app aperta. */
export async function startTracking(mode: ModeId, commute: boolean): Promise<StartResult> {
  if (activeTripStore.get()) return { ok: true };

  const gpsUsable = await askLocation();
  // Il permesso per i passi si chiede solo quando serve: a piedi.
  const stepsUsable = mode === 'piedi' ? await askSteps() : false;

  // La distanza viene solo dalla posizione: senza, non c'è nulla da misurare.
  if (!gpsUsable) {
    return {
      ok: false,
      message:
        'La distanza si misura con la posizione. Concedi il permesso "Mentre usi l\'app" dalle impostazioni del telefono e riprova.',
    };
  }

  let background = false;
  try {
    background = await startLocation();
  } catch {
    await stopSensors();
    return { ok: false, message: 'Non riesco ad accedere alla posizione. Controlla che il GPS sia acceso.' };
  }

  activeTripStore.set(startTrip({ mode, commute, now: Date.now(), stepsUsable, gpsUsable, background }), true);
  if (stepsUsable) startSteps();
  watchAppState();
  return { ok: true };
}

export async function changeMode(mode: ModeId): Promise<void> {
  const trip = activeTripStore.get();
  // Passando a piedi a metà tragitto si attiva il contapassi, se non lo è già.
  if (trip && mode === 'piedi' && !trip.stepsUsable && !trip.stepsLost && (await askSteps())) {
    activeTripStore.update((t) => ({ ...t, stepsUsable: true }));
    startSteps();
  }
  // I passi del tratto che si chiude vanno letti aggiornati.
  await freshSteps();
  activeTripStore.update((t) => switchMode(t, mode, Date.now()), true);
}

export function pauseTracking(): void {
  activeTripStore.update((trip) => pauseTrip(trip, Date.now()), true);
}

export function resumeTracking(): void {
  activeTripStore.update((trip) => resumeTrip(trip, Date.now()), true);
}

/** Chiude il tragitto, calcola i punti e lo salva nello storico. */
export async function finishTracking(): Promise<Trip | null> {
  if (!activeTripStore.get()) return null;

  // Chi tira fuori il telefono dalla tasca e preme subito Termina ha diritto
  // al conteggio dei passi aggiornato: lo si aspetta un attimo.
  await freshSteps();
  const active = activeTripStore.get();
  if (!active) return null;

  const now = Date.now();
  const trips = await loadTrips();
  const day = dayKey(now);
  // Se Connessione Salute è collegata, i suoi passi possono confermare i
  // tratti a piedi che il contapassi dell'app non ha coperto.
  const inputs = await withHealthSteps(active, toLegInputs(active, now, true), now);
  const score = scoreTrip(inputs, {
    commute: active.commute,
    bonusAlreadyToday: summarizeDay(trips, day).bonusAwarded,
    capUsed: capUsedBefore(trips, active.startedAt),
  });
  const trip: Trip = {
    ...score,
    id: active.id,
    day,
    startedAt: active.startedAt,
    endedAt: now,
    commute: active.commute,
  };

  await saveTrip(trip);
  await stopSensors();
  activeTripStore.set(null);
  return trip;
}

/** Annulla il tragitto senza salvarlo. */
export async function discardTracking(): Promise<void> {
  await stopSensors();
  activeTripStore.set(null);
}

/**
 * All'apertura dell'app: se c'era un tragitto in corso lo recupera e fa
 * ripartire i sensori. Il tratto fatto ad app chiusa non viene contato.
 */
export async function restoreTracking(): Promise<boolean> {
  if (activeTripStore.get()) return true;
  const draft = await activeTripStore.loadDraft();
  if (activeTripStore.get()) return true;
  if (!draft) {
    // Nessun tragitto aperto: se un rilevamento è rimasto registrato (app
    // chiusa a forza, telefono riavviato) lo si spegne. Nessuna posizione
    // viene raccolta fuori da un tragitto.
    await stopSensors();
    return false;
  }

  const gpsUsable = draft.gpsUsable && (await Location.getForegroundPermissionsAsync().catch(() => null))?.granted === true;
  let background = false;
  try {
    if (gpsUsable) background = await startLocation();
  } catch {
    // Senza posizione il tragitto resta recuperato e si può terminare.
  }
  activeTripStore.set({ ...afterRestart(draft, Date.now()), gpsUsable, background }, true);
  watchAppState();
  return true;
}
