/** Le pause del germoglio ("Sono in pausa"), salvate solo sul telefono. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Pause } from '../core/plant';

const KEY = 'vado.pausa.v1';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function loadPauses(): Promise<Pause[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is Pause => !!p && typeof p.from === 'string' && DAY.test(p.from) && (p.to === null || (typeof p.to === 'string' && DAY.test(p.to))))
      .map((p) => ({ from: p.from, to: p.to }));
  } catch {
    return [];
  }
}

export async function savePauses(pauses: Pause[]): Promise<void> {
  // Le pause più vecchie di un anno non servono più a niente.
  await AsyncStorage.setItem(KEY, JSON.stringify(pauses.slice(-50)));
}

export async function clearPauses(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
