/**
 * Lettura da Connessione Salute (Health Connect), il deposito di Android in
 * cui le app di salute e fitness mettono i propri dati.
 *
 * L'app chiede solo tre permessi di lettura (passi, attività, distanza) e non
 * scrive nulla. Legge solo mentre è aperta. Le regole su cosa farne stanno in
 * core/health.ts; qui c'è soltanto il colloquio con il telefono.
 *
 * Esiste solo su Android: altrove ogni funzione risponde "non disponibile".
 */
import { Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import { EXERCISE_MODES, stepsInWindows, type HealthSession, type StepSample } from '../core/health';

export type HealthStatus =
  /** Il telefono non ha Connessione Salute (o non è Android). */
  | 'non-disponibile'
  /** C'è, ma va aggiornata dal Play Store. */
  | 'da-aggiornare'
  | 'disponibile';

const READ: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Distance' },
];

/** RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY */
const MANUAL_ENTRY = 3;
/** Tetto di sicurezza alle pagine lette in una richiesta. */
const MAX_PAGES = 20;

let ready = false;

export async function healthStatus(): Promise<HealthStatus> {
  if (Platform.OS !== 'android') return 'non-disponibile';
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'disponibile';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'da-aggiornare';
    return 'non-disponibile';
  } catch {
    // Componente non presente in questa versione dell'app (per esempio Expo Go).
    return 'non-disponibile';
  }
}

async function ensureReady(): Promise<boolean> {
  if (ready) return true;
  if ((await healthStatus()) !== 'disponibile') return false;
  try {
    ready = await initialize();
  } catch {
    ready = false;
  }
  return ready;
}

const has = (granted: { accessType: string; recordType: string }[], recordType: string) =>
  granted.some((p) => p.accessType === 'read' && p.recordType === recordType);

export type HealthAccess = { steps: boolean; sessions: boolean; distance: boolean };

const NO_ACCESS: HealthAccess = { steps: false, sessions: false, distance: false };

/** Quali letture l'utente ha concesso. Può cambiare in ogni momento dalle impostazioni. */
export async function healthAccess(): Promise<HealthAccess> {
  if (!(await ensureReady())) return NO_ACCESS;
  try {
    const granted = await getGrantedPermissions();
    return { steps: has(granted, 'Steps'), sessions: has(granted, 'ExerciseSession'), distance: has(granted, 'Distance') };
  } catch {
    return NO_ACCESS;
  }
}

/** Mostra la schermata di sistema in cui l'utente sceglie cosa far leggere all'app. */
export async function requestHealthAccess(): Promise<HealthAccess> {
  if (!(await ensureReady())) return NO_ACCESS;
  try {
    const granted = await requestPermission(READ);
    return { steps: has(granted, 'Steps'), sessions: has(granted, 'ExerciseSession'), distance: has(granted, 'Distance') };
  } catch {
    return NO_ACCESS;
  }
}

export function openHealthSettings(): void {
  if (Platform.OS !== 'android') return;
  try {
    openHealthConnectSettings();
  } catch {
    // Nessuna schermata da aprire: si resta dove si è.
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Campioni di passi che toccano l'intervallo, di tutte le sorgenti. */
export async function readStepSamples(from: number, to: number): Promise<StepSample[]> {
  if (to <= from || !(await ensureReady())) return [];
  const samples: StepSample[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await readRecords('Steps', {
      timeRangeFilter: { operator: 'between', startTime: iso(from), endTime: iso(to) },
      pageSize: 1000,
      pageToken,
    });
    for (const record of result.records) {
      samples.push({
        start: Date.parse(record.startTime),
        end: Date.parse(record.endTime),
        count: record.count,
        origin: record.metadata?.dataOrigin ?? '',
        manual: record.metadata?.recordingMethod === MANUAL_ENTRY,
      });
    }
    pageToken = result.pageToken || undefined;
    if (!pageToken) break;
  }
  return samples;
}

/** Passi negli intervalli indicati; null se non c'è alcun dato o la lettura non riesce. */
export async function stepsDuring(windows: [number, number][]): Promise<number | null> {
  const real = windows.filter(([from, to]) => to > from);
  if (real.length === 0) return null;
  try {
    const from = Math.min(...real.map((w) => w[0]));
    const to = Math.max(...real.map((w) => w[1]));
    return stepsInWindows(await readStepSamples(from, to), real);
  } catch {
    return null;
  }
}

/** Passi di oggi secondo Connessione Salute, già senza doppioni tra sorgenti. */
export async function stepsToday(now: number): Promise<number | null> {
  if (!(await ensureReady())) return null;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  try {
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: iso(midnight.getTime()), endTime: iso(now) },
    });
    return typeof result.COUNT_TOTAL === 'number' ? result.COUNT_TOTAL : 0;
  } catch {
    return null;
  }
}

async function distanceDuring(from: number, to: number, origin: string): Promise<number | null> {
  const timeRangeFilter = { operator: 'between' as const, startTime: iso(from), endTime: iso(to) };
  try {
    // Prima la distanza scritta dalla stessa app che ha registrato l'attività.
    if (origin) {
      const own = await aggregateRecord({ recordType: 'Distance', timeRangeFilter, dataOriginFilter: [origin] });
      if (own.DISTANCE?.inMeters > 0) return own.DISTANCE.inMeters;
    }
    const any = await aggregateRecord({ recordType: 'Distance', timeRangeFilter });
    return any.DISTANCE?.inMeters > 0 ? any.DISTANCE.inMeters : null;
  } catch {
    return null;
  }
}

/**
 * Attività registrate nell'intervallo, con distanza e passi.
 * @param skip identificativi già importati: per quelli non si rileggono distanza e passi
 */
export async function readSessions(from: number, to: number, access: HealthAccess, skip: (id: string) => boolean): Promise<HealthSession[]> {
  if (to <= from || !access.sessions || !(await ensureReady())) return [];
  const sessions: HealthSession[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime: iso(from), endTime: iso(to) },
      pageSize: 200,
      pageToken,
    });
    for (const record of result.records) {
      const id = record.metadata?.id;
      if (!id) continue;
      const start = Date.parse(record.startTime);
      const end = Date.parse(record.endTime);
      const manual = record.metadata?.recordingMethod === MANUAL_ENTRY;
      const origin = record.metadata?.dataOrigin ?? '';
      const session: HealthSession = { id, origin, start, end, exerciseType: record.exerciseType, manual, distanceM: null, steps: null };
      // Le letture in più si fanno solo per le attività che possono dare punti.
      if (!skip(id) && !manual && record.exerciseType in EXERCISE_MODES && end > start) {
        session.distanceM = access.distance ? await distanceDuring(start, end, origin) : null;
        session.steps = access.steps && EXERCISE_MODES[record.exerciseType] === 'piedi' ? await stepsDuring([[start, end]]) : null;
      }
      sessions.push(session);
    }
    pageToken = result.pageToken || undefined;
    if (!pageToken) break;
  }
  return sessions;
}
