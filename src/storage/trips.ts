/**
 * Storico dei tragitti conclusi, salvato solo sul telefono.
 *
 * Si salvano distanza, tempo, passi, mezzo e punti. Le coordinate del
 * percorso non vengono mai scritte: da questi dati non si ricava né dove
 * abiti né dove lavori.
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

export async function getTrip(id: string): Promise<Trip | null> {
  return (await loadTrips()).find((t) => t.id === id) ?? null;
}

export async function clearTrips(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
