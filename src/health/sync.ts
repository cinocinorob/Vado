/**
 * Collegamento a Connessione Salute: stato, importazione delle attività e
 * passi per i tragitti. Mette insieme la lettura (connect.ts), le regole
 * (core/health.ts) e ciò che resta salvato sul telefono (storage/).
 */
import { IMPORT_DAYS, importSessions, mergeHealthSteps, tripIdFor } from '../core/health';
import type { LegInput, Trip } from '../core/scoring';
import { loadHealthSettings, saveHealthSettings } from '../storage/health';
import { loadTrips, saveTrips } from '../storage/trips';
import { legSpans, type ActiveTrip } from '../tracking/tripState';
import { healthAccess, healthStatus, readSessions, requestHealthAccess, stepsDuring, stepsToday, type HealthStatus } from './connect';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Chiudere un tragitto non deve mai restare appeso ad aspettare Connessione Salute. */
const FINISH_WAIT_MS = 3000;

export type HealthState = {
  status: HealthStatus;
  /** Collegata dall'utente e con almeno un permesso ancora concesso. */
  connected: boolean;
  /** Passi di oggi; null se non collegata o senza permesso per i passi. */
  todaySteps: number | null;
  /** Tragitti aggiunti dall'ultima sincronizzazione. */
  imported: Trip[];
};

const OFFLINE = (status: HealthStatus): HealthState => ({ status, connected: false, todaySteps: null, imported: [] });

let running: Promise<HealthState> | null = null;

async function sync(now: number): Promise<HealthState> {
  const status = await healthStatus();
  if (status !== 'disponibile') return OFFLINE(status);

  const settings = await loadHealthSettings();
  if (!settings.enabled) return OFFLINE(status);

  const access = await healthAccess();
  if (!access.steps && !access.sessions) {
    // I permessi sono stati tolti dalle impostazioni del telefono.
    await saveHealthSettings({ ...settings, enabled: false });
    return OFFLINE(status);
  }

  const todaySteps = access.steps ? await stepsToday(now) : null;

  let imported: Trip[] = [];
  try {
    const from = Math.max(settings.importFrom, now - IMPORT_DAYS * DAY_MS);
    const existing = await loadTrips();
    const known = new Set(existing.map((t) => t.id));
    const sessions = await readSessions(from, now, access, (id) => known.has(tripIdFor(id)));
    imported = importSessions(sessions, existing, { now, from }).trips;
    await saveTrips(imported);
  } catch {
    // Lettura non riuscita: si riproverà alla prossima apertura.
  }
  return { status, connected: true, todaySteps, imported };
}

/** Stato del collegamento; se è attivo importa anche le attività nuove. */
export function refreshHealth(now: number): Promise<HealthState> {
  if (!running) {
    running = sync(now).finally(() => {
      running = null;
    });
  }
  return running;
}

/** Chiede i permessi all'utente e, se ne concede almeno uno, attiva il collegamento. */
export async function connectHealth(now: number): Promise<HealthState> {
  const status = await healthStatus();
  if (status !== 'disponibile') return OFFLINE(status);
  const access = await requestHealthAccess();
  if (!access.steps && !access.sessions) return OFFLINE(status);
  const previous = await loadHealthSettings();
  await saveHealthSettings({ enabled: true, importFrom: Math.max(previous.importFrom, now - IMPORT_DAYS * DAY_MS) });
  return refreshHealth(now);
}

/** L'app smette di leggere. I permessi si tolgono dalle impostazioni di Connessione Salute. */
export async function disconnectHealth(): Promise<void> {
  const settings = await loadHealthSettings();
  await saveHealthSettings({ ...settings, enabled: false });
}

/** Dopo "Azzera i dati": le attività già passate non devono rientrare. */
export async function forgetImportedBefore(now: number): Promise<void> {
  const settings = await loadHealthSettings();
  await saveHealthSettings({ ...settings, importFrom: now });
}

/**
 * A fine tragitto: aggiunge ai tratti a piedi i passi di Connessione Salute,
 * letti per i minuti esatti in cui il tratto era in movimento.
 */
export async function withHealthSteps(trip: ActiveTrip, inputs: LegInput[], now: number): Promise<LegInput[]> {
  if (!inputs.some((input) => input.mode === 'piedi')) return inputs;
  const work = (async () => {
    const settings = await loadHealthSettings();
    if (!settings.enabled || !(await healthAccess()).steps) return inputs;
    const merged: LegInput[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const leg = trip.legs[i];
      const steps = inputs[i].mode === 'piedi' && leg ? await stepsDuring(legSpans(leg, now)) : null;
      merged.push(mergeHealthSteps(inputs[i], steps));
    }
    return merged;
  })().catch(() => inputs);
  const timeout = new Promise<LegInput[]>((resolve) => setTimeout(() => resolve(inputs), FINISH_WAIT_MS));
  return Promise.race([work, timeout]);
}
