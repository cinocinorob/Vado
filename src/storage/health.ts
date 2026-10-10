/**
 * Impostazioni del collegamento a Connessione Salute, salvate solo sul telefono.
 * Qui non finisce nessun dato di salute: solo se il collegamento è attivo e
 * da quando importare le attività.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vado.salute.v1';

export type HealthSettings = {
  /** L'utente ha collegato Connessione Salute da dentro l'app. */
  enabled: boolean;
  /** Le attività iniziate prima di questo istante non vengono importate. */
  importFrom: number;
};

const OFF: HealthSettings = { enabled: false, importFrom: 0 };

export async function loadHealthSettings(): Promise<HealthSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<HealthSettings>) : null;
    return parsed ? { enabled: parsed.enabled === true, importFrom: Number(parsed.importFrom) || 0 } : OFF;
  } catch {
    return OFF;
  }
}

export async function saveHealthSettings(settings: HealthSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}
