/** Lo stato del germoglio per le schermate: pause lette dal telefono, calcolo dai tragitti. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { plantState, type Pause } from '../core/plant';
import type { Trip } from '../core/scoring';
import { loadPauses } from '../storage/pause';

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

export function usePlant(trips: Trip[], now: number) {
  const [pauses] = usePauses();
  return plantState(trips, now, pauses);
}
