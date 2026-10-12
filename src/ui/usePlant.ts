/** Lo stato del germoglio per le schermate: pause e albero scelto letti dal telefono, calcolo dai tragitti. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_SPECIES, forestOf, plantState, type Pause, type PlantState, type SpeciesId } from '../core/plant';
import type { Trip } from '../core/scoring';
import { loadPauses } from '../storage/pause';
import { NO_TREE, loadTree, recordForest, type TreeSettings } from '../storage/tree';

export function usePauses(): [Pause[], (next: Pause[]) => void] {
  const [pauses, setPauses] = useState<Pause[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadPauses().then((loaded) => {
        if (alive) setPauses(loaded);
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  return [pauses, setPauses];
}

export function useTreeSettings(): [TreeSettings, (next: TreeSettings) => void] {
  const [tree, setTree] = useState<TreeSettings>(NO_TREE);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadTree().then((loaded) => {
        if (alive) setTree(loaded);
      });
      return () => {
        alive = false;
      };
    }, []),
  );
  return [tree, setTree];
}

export type MyPlant = PlantState & {
  /** L'albero scelto, o quello predefinito se non è stato ancora scelto. */
  species: SpeciesId;
  chosen: boolean;
  /** Specie di ogni albero del bosco. */
  forest: SpeciesId[];
};

export function usePlant(trips: Trip[], now: number, pausesOverride?: Pause[]): MyPlant & { setTree: (next: TreeSettings) => void } {
  const [pauses] = usePauses();
  const [tree, setTree] = useTreeSettings();
  const state = plantState(trips, now, pausesOverride ?? pauses);

  // Gli alberi appena completati si segnano nel bosco con la specie di adesso.
  useEffect(() => {
    if (state.trees > tree.history.length) {
      recordForest(state.trees).then(setTree).catch(() => undefined);
    }
  }, [state.trees, tree.history.length, setTree]);

  return {
    ...state,
    species: tree.species ?? DEFAULT_SPECIES,
    chosen: tree.species !== null,
    forest: forestOf(state.trees, tree.history, tree.species),
    setTree,
  };
}
