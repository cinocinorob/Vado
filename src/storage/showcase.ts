/** La vetrina: le medaglie scelte da mostrare in classifica (al massimo tre), e il contesto delle medaglie. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { badgeStates, type BadgeContext, type BadgeState } from '../core/badges';
import { showcaseText } from '../core/social';
import type { Trip } from '../core/scoring';
import { loadJourneys } from './journey';
import { loadWins, podiums } from './wins';

const KEY = 'vado.vetrina.v1';

/** null: scelta automatica (le tre medaglie di grado più alto). */
export async function loadChosen(): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string').slice(0, 3) : null;
  } catch {
    return null;
  }
}

export async function saveChosen(ids: string[] | null): Promise<void> {
  if (ids === null) await AsyncStorage.removeItem(KEY);
  else await AsyncStorage.setItem(KEY, JSON.stringify(ids.slice(0, 3)));
}

export async function loadBadgeContext(): Promise<BadgeContext> {
  const [wins, journeys] = await Promise.all([loadWins(), loadJourneys()]);
  return { podiums: podiums(wins), journeys: journeys.done.length };
}

/** Le medaglie in vetrina: quelle scelte (se le hai), altrimenti le tre di grado più alto. */
export function pickShowcase(states: BadgeState[], chosen: string[] | null): BadgeState[] {
  const owned = states.filter((b) => b.unlocked);
  if (chosen && chosen.length > 0) return chosen.map((id) => owned.find((b) => b.id === id)).filter((b): b is BadgeState => !!b);
  return [...owned].sort((a, b) => b.level - a.level || b.tiers.length - a.tiers.length).slice(0, 3);
}

export async function showcaseFor(trips: Trip[], now: number): Promise<string> {
  const [chosen, ctx] = await Promise.all([loadChosen(), loadBadgeContext()]);
  return showcaseText(pickShowcase(badgeStates(trips, now, ctx), chosen).map((b) => ({ id: b.id, level: b.level })));
}
