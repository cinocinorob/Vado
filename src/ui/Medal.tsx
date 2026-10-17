/**
 * Le medaglie: ognuna ha la sua forma (in stile Material 3 Expressive), il suo
 * colore e un pittogramma. Disegni originali del progetto, area 96×96.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import type { BadgeId } from '../core/badges';
import { SHAPES, type ShapeId } from './shapes';
import { C, F } from './theme';

const INK = '#1A1D14';

/** Pittogramma disegnato in un'area 24×24, ingrandito al centro della forma. */
function Picto({ children }: { children: ReactNode }) {
  return (
    <G transform="translate(24 24) scale(2)" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </G>
  );
}

/** `art` è un pittogramma; `number` un numero scritto al centro (in Roboto, come il resto dell'app). */
type Look = { shape: ShapeId; color: string; art?: ReactNode; number?: string; numberSize?: number };

const LOOKS: Record<BadgeId, Look> = {
  'primo-passo': {
    shape: 'cookie9',
    color: '#C8F560',
    art: (
      <Picto>
        <Path d="M7 4h5v8l6 3a2 2 0 0 1 1 1.7V19H5V6a2 2 0 0 1 2-2z" />
        <Path d="M5 16h14" />
      </Picto>
    ),
  },
  're-della-metro': {
    shape: 'sunny',
    color: '#7FD8C6',
    art: (
      <Picto>
        <Path d="M4 17l1.5-9 4 4L12 6l2.5 6 4-4L20 17z" />
        <Path d="M5 20h14" />
      </Picto>
    ),
  },
  'due-ruote': {
    shape: 'clover4',
    color: '#B9DDF7',
    art: (
      <Picto>
        <Path d="M2 16a4 4 0 1 0 8 0a4 4 0 1 0-8 0M14 16a4 4 0 1 0 8 0a4 4 0 1 0-8 0" />
        <Path d="M6 16l4-8h5l3 8M10 8H8M12 16l3-8" />
      </Picto>
    ),
  },
  'sette-su-sette': { shape: 'hept', color: '#FF8A65', number: '7', numberSize: 0.46 },
  'pendolare-doro': {
    shape: 'flower8',
    color: '#FFE07A',
    art: (
      <Picto>
        <Path d="M4 8h16v11H4z" />
        <Path d="M9 8V5h6v3M4 13h16" />
      </Picto>
    ),
  },
  scossa: {
    shape: 'burst',
    color: '#FFE07A',
    art: (
      <Picto>
        <Path d="M13 2L5 14h6l-1 8 8-12h-6z" />
      </Picto>
    ),
  },
  capotreno: {
    shape: 'pill',
    color: '#7FD8C6',
    art: (
      <Picto>
        <Path d="M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z" />
        <Path d="M4 11h16M8 15h.01M16 15h.01M8 18l-2 3M16 18l2 3" />
      </Picto>
    ),
  },
  'in-condivisione': {
    shape: 'cookie6',
    color: '#E3D7FF',
    art: (
      <Picto>
        <Path d="M5 15l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 15v3H5z" />
        <Path d="M8 18v2M16 18v2M5 15h14M9 4l3-2 3 2" />
      </Picto>
    ),
  },
  maratoneta: { shape: 'pent', color: '#FFB59E', number: '42', numberSize: 0.34 },
  // Luna e pipistrello.
  'notte-streghe': {
    shape: 'burst',
    color: '#C9B3FF',
    art: (
      <Picto>
        <Path d="M15 3a8 8 0 1 0 6 12 7 7 0 0 1-6-12z" />
        <Path d="M3 9l2-2 1.5 1.5L8 7l1.5 1.5L11 7l2 2-2.5.5L10 11 8 10l-2 1-.5-1.5z" />
      </Picto>
    ),
  },
};

export type MedalLook = 'sbloccata' | 'in-corso' | 'bloccata';

export function Medal({ id, look, size = 76, label }: { id: BadgeId; look: MedalLook; size?: number; label: string }) {
  const { shape, color, art, number, numberSize = 0.4 } = LOOKS[id];
  const inkOpacity = look === 'sbloccata' ? 1 : look === 'in-corso' ? 0.55 : 0.3;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
        <Path d={SHAPES[shape]} fill={look === 'bloccata' ? C.tonal : color} opacity={look === 'in-corso' ? 0.5 : 1} />
        {art ? <G opacity={inkOpacity}>{art}</G> : null}
      </Svg>
      {number ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={{ fontFamily: F.displayBold, fontSize: size * numberSize, color: INK, opacity: inkOpacity, includeFontPadding: false }}>{number}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
