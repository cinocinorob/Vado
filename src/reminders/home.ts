/**
 * "Stai uscendo di casa": un recinto virtuale attorno a casa. Quando il
 * telefono ne esce, Android sveglia l'app e arriva una notifica che apre
 * "Nuovo tragitto". Il tragitto non parte da solo: Android non permette di
 * avviare il rilevamento della posizione dal secondo piano, e una partenza
 * sbagliata (in auto) darebbe punti falsi.
 *
 * Richiede il permesso di posizione "Consenti sempre". Le coordinate di casa
 * restano solo sul telefono.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { activeTripStore } from '../tracking/store';

const TASK = 'vado-casa';
const KEY = 'vado.casa.v1';
const RADIUS_M = 150;
/** Al massimo un avviso ogni due ore (chi esce e rientra subito non viene disturbato). */
const QUIET_MS = 2 * 60 * 60 * 1000;

type HomeState = { on: boolean; lastNotice: number };

async function load(): Promise<HomeState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<HomeState>) : {};
    return { on: parsed.on === true, lastNotice: Number(parsed.lastNotice) || 0 };
  } catch {
    return { on: false, lastNotice: 0 };
  }
}

async function save(state: HomeState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export async function homeReminderOn(): Promise<boolean> {
  return (await load()).on;
}

export type HomeResult = { ok: true } | { ok: false; problem: string };

/** Accende l'avviso usando la posizione di adesso come casa. */
export async function enableHomeReminder(): Promise<HomeResult> {
  if (Platform.OS !== 'android') return { ok: false, problem: 'Disponibile solo su Android.' };
  try {
    if (!(await Location.requestForegroundPermissionsAsync()).granted) {
      return { ok: false, problem: 'Serve il permesso di posizione.' };
    }
    if (!(await Location.requestBackgroundPermissionsAsync()).granted) {
      return {
        ok: false,
        problem: 'Serve la posizione "Consenti sempre": nelle impostazioni del telefono, Vado → Autorizzazioni → Posizione → Consenti sempre. Poi riprova.',
      };
    }
    const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false });
    if ((here.coords.accuracy ?? 999) > 80) return { ok: false, problem: 'La posizione è ancora incerta: riprova tra qualche secondo, vicino a una finestra.' };
    await Location.startGeofencingAsync(TASK, [
      { identifier: 'casa', latitude: here.coords.latitude, longitude: here.coords.longitude, radius: RADIUS_M, notifyOnEnter: false, notifyOnExit: true },
    ]);
    await save({ on: true, lastNotice: 0 });
    return { ok: true };
  } catch {
    return { ok: false, problem: 'Non sono riuscito ad accendere l’avviso. Riprova.' };
  }
}

export async function disableHomeReminder(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(TASK)) await Location.stopGeofencingAsync(TASK);
  } catch {
    // Già spento.
  }
  await save({ on: false, lastNotice: 0 });
}

TaskManager.defineTask<{ eventType: Location.GeofencingEventType }>(TASK, async ({ data, error }) => {
  if (error || data?.eventType !== Location.GeofencingEventType.Exit) return;
  const state = await load();
  const now = Date.now();
  if (!state.on || now - state.lastNotice < QUIET_MS || activeTripStore.get()) return;
  await save({ ...state, lastNotice: now });
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Stai uscendo di casa', body: 'Vai a piedi, in bici o con i mezzi? Tocca per avviare il tragitto.', data: { path: '/nuovo' } },
    trigger: { channelId: 'promemoria' },
  });
});
