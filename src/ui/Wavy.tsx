/** Indicatori di avanzamento ondulati, come quelli di Android 16 e successivi. */
import { useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useEased } from './motion';
import { waveArc, waveLine } from './shapes';
import { C } from './theme';

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Anello: binario piatto e tratto ondulato fino al valore. Oltre il 100% parte
 * un secondo giro in un altro colore, come gli anelli di Attività di Apple.
 */
export function WavyRing({
  size,
  ratio,
  color = C.text,
  overColor = C.over,
  track = C.faint,
  stroke = 9,
}: {
  size: number;
  ratio: number;
  color?: string;
  overColor?: string;
  track?: string;
  stroke?: number;
}) {
  const r = 90;
  // L'anello si riempie quando compare e quando cambia.
  const shown = useEased(ratio, 900);
  const first = clamp(shown);
  const over = clamp(shown - 1);
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Circle cx={110} cy={110} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {first > 0 ? <Path d={waveArc(110, r, first)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {over > 0 ? <Path d={waveArc(110, r, over)} fill="none" stroke={overColor} strokeWidth={stroke + 1} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
}

/** Barra: tratto ondulato fino al valore, poi binario piatto con il punto di arrivo. */
export function WavyBar({
  ratio,
  color = C.text,
  track = C.faint,
  height = 16,
  stroke = 5,
  style,
}: {
  ratio: number;
  color?: string;
  track?: string;
  height?: number;
  stroke?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const frac = clamp(ratio);
  const y = height / 2;
  const end = width - stroke / 2;
  const x1 = Math.max(stroke / 2, end * frac);
  const amp = Math.min(3, height / 2 - stroke / 2 - 0.5);
  return (
    <View style={[{ height }, style]} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {frac < 1 ? <Path d={`M${Math.min(end, x1 + 8)} ${y} H${end}`} stroke={track} strokeWidth={stroke} strokeLinecap="round" /> : null}
          {frac > 0 ? <Path d={waveLine(stroke / 2, x1, y, amp, 13)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" /> : null}
          {frac < 1 ? <Circle cx={end} cy={y} r={stroke / 2} fill={color} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}
