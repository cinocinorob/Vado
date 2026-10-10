/**
 * Contenitore del tragitto in corso, con bozza su disco.
 *
 * La bozza serve solo a non perdere il tragitto se il sistema chiude l'app:
 * viene cancellata alla fine, non entra mai nello storico e non contiene
 * coordinate (vedi forDraft).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { forDraft, type ActiveTrip } from './tripState';

const DRAFT_KEY = 'vado.tragitto-in-corso.v1';
const SAVE_EVERY_MS = 5000;

let current: ActiveTrip | null = null;
const listeners = new Set<() => void>();
let lastSave = 0;

function persist(force: boolean) {
  const now = Date.now();
  if (!force && now - lastSave < SAVE_EVERY_MS) return;
  lastSave = now;
  const job = current
    ? AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(forDraft(current, now)))
    : AsyncStorage.removeItem(DRAFT_KEY);
  // Il salvataggio della bozza è una rete di sicurezza: se fallisce si prosegue.
  job.catch(() => undefined);
}

export const activeTripStore = {
  get: () => current,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Sostituisce lo stato. `force` scrive subito la bozza su disco. */
  set(next: ActiveTrip | null, force = false) {
    if (next === current) return;
    current = next;
    persist(force || next === null);
    listeners.forEach((l) => l());
  },
  update(fn: (trip: ActiveTrip) => ActiveTrip, force = false) {
    if (current) activeTripStore.set(fn(current), force);
  },
  async loadDraft(): Promise<ActiveTrip | null> {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as ActiveTrip) : null;
    } catch {
      return null;
    }
  },
};

export function useActiveTrip(): ActiveTrip | null {
  return useSyncExternalStore(activeTripStore.subscribe, activeTripStore.get, activeTripStore.get);
}
