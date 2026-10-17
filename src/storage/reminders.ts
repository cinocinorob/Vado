/** Quali promemoria sono accesi, salvati solo sul telefono. Tutti accesi all'inizio. */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vado.promemoria.v1';

export type Reminders = { forgot: boolean; thirsty: boolean; overtaken: boolean };

const DEFAULTS: Reminders = { forgot: true, thirsty: true, overtaken: true };

export async function loadReminders(): Promise<Reminders> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Reminders>) : {};
    return {
      forgot: parsed.forgot !== false,
      thirsty: parsed.thirsty !== false,
      overtaken: parsed.overtaken !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveReminders(value: Reminders): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}

const STANDINGS = 'vado.promemoria.classifica.v1';

export async function loadStandings(): Promise<Record<string, { id: string; name: string; points: number; me?: boolean }[]>> {
  try {
    const raw = await AsyncStorage.getItem(STANDINGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveStandings(value: Record<string, { id: string; name: string; points: number; me?: boolean }[]>): Promise<void> {
  await AsyncStorage.setItem(STANDINGS, JSON.stringify(value));
}
