/** L'albero scelto e la memoria del bosco, salvati solo sul telefono (e il nome dell'albero al server della classifica). */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSpecies, type SpeciesId } from '../core/plant';

const KEY = 'vado.albero.v1';

export type TreeSettings = {
  /** null finché l'utente non sceglie. */
  species: SpeciesId | null;
  /** Specie di ogni albero del bosco, nell'ordine in cui è cresciuto. */
  history: SpeciesId[];
};

export const NO_TREE: TreeSettings = { species: null, history: [] };

export async function loadTree(): Promise<TreeSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<TreeSettings>) : null;
    if (!parsed) return NO_TREE;
    return {
      species: isSpecies(parsed.species) ? parsed.species : null,
      history: Array.isArray(parsed.history) ? parsed.history.filter(isSpecies) : [],
    };
  } catch {
    return NO_TREE;
  }
}

export async function saveTree(settings: TreeSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

export async function clearTree(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/**
 * Registra la specie degli alberi appena completati (quelli oltre la memoria),
 * con l'albero scelto adesso. Restituisce le impostazioni aggiornate.
 */
export async function recordForest(trees: number): Promise<TreeSettings> {
  const current = await loadTree();
  if (current.history.length >= trees) return current;
  const history = [...current.history];
  while (history.length < trees) history.push(current.species ?? 'pino');
  const next = { ...current, history };
  await saveTree(next);
  return next;
}
