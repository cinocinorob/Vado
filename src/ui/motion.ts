/**
 * Piccoli movimenti: numeri e anelli che si riempiono, vibrazioni leggere ai
 * traguardi. Si spengono se il telefono chiede di ridurre le animazioni.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    reduceMotion = on;
  })
  .catch(() => undefined);

/** Un valore che va verso `target` in `duration` ms, con una frenata morbida. */
export function useEased(target: number, duration = 700): number {
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    let begin: number | null = null;
    let frame = 0;
    const step = (t: number) => {
      if (begin === null) begin = t;
      const k = reduceMotion ? 1 : Math.min(1, (t - begin) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = start + (target - start) * eased;
      from.current = next;
      setValue(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export function buzz(kind: 'tocco' | 'fatto' | 'premio'): void {
  if (Platform.OS === 'web') return;
  const run =
    kind === 'tocco'
      ? Haptics.selectionAsync()
      : kind === 'fatto'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  run.catch(() => undefined);
}
