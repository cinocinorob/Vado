/**
 * Storico dei tragitti conclusi, salvato solo sul telefono.
 *
 * Si salvano distanza, tempo, passi, mezzo e punti. Le coordinate del
 * percorso non vengono mai scritte. Per i viaggi in metro si salvano anche i
 * nomi delle stazioni di ingresso e di uscita, mostrati nel riepilogo: è
 * l'unico dato sui luoghi che resta scritto, ed è spiegato nella schermata
 * Riservatezza.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Trip } from '../core/scoring';

const KEY = 'vado.tragitti.v1';

export async function loadTrips(): Promise<Trip[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Trip[]) : [];
  } catch {
    return [];
  }
}

export async function saveTrip(trip: Trip): Promise<void> {
  const trips = await loadTrips();
  await AsyncStorage.setItem(KEY, JSON.stringify([...trips.filter((t) => t.id !== trip.id), trip]));
}

/** Aggiunge più tragitti in una volta (per esempio quelli importati). Quelli cancellati a mano non rientrano. */
export async function saveTrips(incoming: Trip[]): Promise<void> {
  const deleted = await loadDeleted();
  const added = incoming.filter((t) => !deleted.has(t.id));
  if (added.length === 0) return;
  const ids = new Set(added.map((t) => t.id));
  const trips = await loadTrips();
  await AsyncStorage.setItem(KEY, JSON.stringify([...trips.filter((t) => !ids.has(t.id)), ...added]));
}

export async function getTrip(id: string): Promise<Trip | null> {
  return (await loadTrips()).find((t) => t.id === id) ?? null;
}

export async function clearTrips(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(DELETED_KEY);
}

/** Tragitti cancellati a mano: servono perché un'attività importata non torni alla lettura successiva. */
const DELETED_KEY = 'vado.tragitti.cancellati.v1';

async function loadDeleted(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DELETED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Cancella un tragitto dallo storico. */
export async function deleteTrip(id: string): Promise<void> {
  const trips = await loadTrips();
  await AsyncStorage.setItem(KEY, JSON.stringify(trips.filter((t) => t.id !== id)));
  const deleted = [...(await loadDeleted()), id].slice(-500);
  await AsyncStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
}
