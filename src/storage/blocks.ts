/** Elenco delle persone bloccate, solo su questo telefono. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Blocked } from '../social/blocks';

const KEY = 'vado.bloccati.v1';

export async function loadBlocked(): Promise<Blocked[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((b): b is Blocked => !!b && typeof b.id === 'string' && typeof b.name === 'string') : [];
  } catch {
    return [];
  }
}

export async function blockPerson(person: Blocked): Promise<void> {
  const list = await loadBlocked();
  if (list.some((b) => b.id === person.id)) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([...list, person]));
}

export async function unblockPerson(id: string): Promise<void> {
  const list = await loadBlocked();
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((b) => b.id !== id)));
}

export async function blockedIds(): Promise<ReadonlySet<string>> {
  return new Set((await loadBlocked()).map((b) => b.id));
}
