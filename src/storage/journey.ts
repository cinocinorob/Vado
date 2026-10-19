/** Il percorso virtuale in corso e quelli completati, salvati solo sul telefono. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { journeyById, journeyRun } from '../core/journeys';
import type { Trip } from '../core/scoring';

const KEY = 'vado.percorsi.v1';

export type JourneyState = {
  current: { id: string; startedAt: number } | null;
  done: { id: string; startedAt: number; doneAt: number }[];
};

export const NO_JOURNEY: JourneyState = { current: null, done: [] };

export async function loadJourneys(): Promise<JourneyState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<JourneyState>) : {};
    return {
      current: p.current && typeof p.current.id === 'string' && typeof p.current.startedAt === 'number' ? p.current : null,
      done: Array.isArray(p.done) ? p.done.filter((d) => typeof d?.id === 'string' && typeof d?.doneAt === 'number') : [],
    };
  } catch {
    return NO_JOURNEY;
  }
}

export async function saveJourneys(state: JourneyState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/**
 * Se il percorso in corso è finito lo sposta tra quelli completati.
 * Restituisce lo stato aggiornato e il percorso appena finito, se c'è.
 */
export async function settleJourney(trips: readonly Trip[]): Promise<{ state: JourneyState; finished: string | null }> {
  const state = await loadJourneys();
  const cur = state.current;
  const journey = cur ? journeyById(cur.id) : null;
  if (!cur || !journey) return { state, finished: null };
  const run = journeyRun(journey, trips, cur.startedAt);
  if (!run.done || run.doneAt === null) return { state, finished: null };
  const next: JourneyState = { current: null, done: [...state.done, { id: cur.id, startedAt: cur.startedAt, doneAt: run.doneAt }] };
  await saveJourneys(next);
  return { state: next, finished: cur.id };
}
