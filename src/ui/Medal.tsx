/**
 * I disegni delle medaglie: la mascotte in nove versioni, come nel mockup.
 * Disegni originali del progetto. Area 96×96.
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { BadgeId } from '../core/badges';
import { MascotShapes } from './Mascot';

const INK = '#0B1F2A';
const LIME = '#C8F560';
const CORAL = '#FF8A65';
const TEAL = '#1F5266';
const WHITE = '#FFFFFF';

/** Bordo bianco da adesivo e fondo colorato. */
function Sticker({ color, children }: { color: string; children: ReactNode }) {
  return (
    <G>
      <Circle cx={48} cy={48} r={45} fill={WHITE} stroke={INK} strokeWidth={3} />
      <Circle cx={48} cy={48} r={37.5} fill={color} />
      {children}
    </G>
  );
}

/** Occhi e sorriso, centrati su (cx, cy). */
function Face({ cx, cy, smile = WHITE, r = 6 }: { cx: number; cy: number; smile?: string; r?: number }) {
  return (
    <G>
      <Circle cx={cx - 7} cy={cy} r={r} fill={WHITE} />
      <Circle cx={cx + 7} cy={cy} r={r} fill={WHITE} />
      <Circle cx={cx - 5.5} cy={cy + 1} r={r * 0.43} fill={INK} />
      <Circle cx={cx + 8.5} cy={cy + 1} r={r * 0.43} fill={INK} />
      <Path d={`M${cx - 5} ${cy + 11}q5 4 10 0`} fill="none" stroke={smile} strokeWidth={2.4} strokeLinecap="round" />
    </G>
  );
}

function Feet({ y, color = INK, cx = 48 }: { y: number; color?: string; cx?: number }) {
  return (
    <G>
      <Rect x={cx - 13} y={y} width={11} height={6} rx={3} fill={color} />
      <Rect x={cx + 2} y={y} width={11} height={6} rx={3} fill={color} />
    </G>
  );
}

const ART: Record<BadgeId, ReactNode> = {
  'primo-passo': <MascotShapes />,

  // Corona.
  're-della-metro': (
    <Sticker color={TEAL}>
      <Ellipse cx={48} cy={52} rx={21} ry={22} fill={LIME} />
      <Path d="M35 34l3-12 6 7 4-10 4 10 6-7 3 12z" fill={CORAL} />
      <Face cx={48} cy={49} smile={INK} />
      <Feet y={73} color={LIME} />
    </Sticker>
  ),

  // Casco e ruote.
  'due-ruote': (
    <Sticker color={CORAL}>
      <Ellipse cx={48} cy={48} rx={21} ry={22} fill={INK} />
      <Path d="M27 40a21 16 0 0 1 42 0z" fill={LIME} />
      <Path d="M40 27v13M48 25v15M56 27v13" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <Face cx={48} cy={50} r={5.5} />
      <Circle cx={37} cy={76} r={6.5} fill={CORAL} stroke={INK} strokeWidth={3} />
      <Circle cx={59} cy={76} r={6.5} fill={CORAL} stroke={INK} strokeWidth={3} />
    </Sticker>
  ),

  // Foglia e stelline.
  'sette-su-sette': (
    <Sticker color={LIME}>
      <Path d="M20 30l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" fill={INK} />
      <Path d="M76 29l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill={INK} />
      <Path d="M75 60l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z" fill={INK} />
      <Ellipse cx={48} cy={50} rx={21} ry={22} fill={INK} />
      <Path d="M48 30c0-8 5-12 13-12 0 8-5 12-13 12z" fill={TEAL} />
      <Face cx={48} cy={47} />
      <Feet y={71} />
    </Sticker>
  ),

  // Cravatta e valigetta.
  'pendolare-doro': (
    <Sticker color={CORAL}>
      <Ellipse cx={44} cy={48} rx={21} ry={22} fill={INK} />
      <Face cx={44} cy={44} />
      <Path d="M44 61l-2.5 3 2.5 7 2.5-7z" fill={CORAL} />
      <Feet y={69} cx={44} />
      <Path d="M66 54v-3.5h9V54" fill="none" stroke={LIME} strokeWidth={2.4} strokeLinejoin="round" />
      <Rect x={62} y={54} width={17} height={13} rx={2.5} fill={LIME} />
      <Path d="M62 60h17" fill="none" stroke={INK} strokeWidth={1.6} />
    </Sticker>
  ),

  // Fulmine.
  scossa: (
    <Sticker color={TEAL}>
      <Ellipse cx={43} cy={50} rx={21} ry={22} fill={LIME} />
      <Face cx={43} cy={47} smile={INK} />
      <Feet y={71} color={LIME} cx={43} />
      <Path d="M76 24L63 46h8l-3 16 14-23h-8z" fill={CORAL} stroke={WHITE} strokeWidth={2} strokeLinejoin="round" />
    </Sticker>
  ),

  // Berretto da ferroviere.
  capotreno: (
    <Sticker color={LIME}>
      <Ellipse cx={48} cy={52} rx={21} ry={22} fill={INK} />
      <Path d="M29 36c2-13 36-13 38 0z" fill={TEAL} />
      <Rect x={27} y={34} width={42} height={6} rx={3} fill={CORAL} />
      <Path d="M33 40h34l6 4H39z" fill={TEAL} />
      <Circle cx={48} cy={28} r={3} fill={LIME} />
      <Face cx={48} cy={51} r={5.5} />
      <Feet y={73} />
    </Sticker>
  ),

  // Due amici.
  'in-condivisione': (
    <Sticker color={TEAL}>
      <Ellipse cx={35} cy={52} rx={15} ry={16} fill={LIME} />
      <Circle cx={30.5} cy={49} r={4.2} fill={WHITE} />
      <Circle cx={39.5} cy={49} r={4.2} fill={WHITE} />
      <Circle cx={31.5} cy={49.8} r={1.8} fill={INK} />
      <Circle cx={40.5} cy={49.8} r={1.8} fill={INK} />
      <Path d="M31.5 57q3.5 3 7 0" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <Rect x={26} y={67} width={8} height={5} rx={2.5} fill={LIME} />
      <Rect x={36} y={67} width={8} height={5} rx={2.5} fill={LIME} />
      <Ellipse cx={62} cy={46} rx={15} ry={16} fill={CORAL} />
      <Circle cx={57.5} cy={43} r={4.2} fill={WHITE} />
      <Circle cx={66.5} cy={43} r={4.2} fill={WHITE} />
      <Circle cx={56.5} cy={43.8} r={1.8} fill={INK} />
      <Circle cx={65.5} cy={43.8} r={1.8} fill={INK} />
      <Path d="M58.5 51q3.5 3 7 0" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <Rect x={53} y={61} width={8} height={5} rx={2.5} fill={CORAL} />
      <Rect x={63} y={61} width={8} height={5} rx={2.5} fill={CORAL} />
    </Sticker>
  ),

  // Fascia sulla fronte e medaglia al collo.
  maratoneta: (
    <Sticker color={CORAL}>
      <Path d="M13 42h8M11 50h10M14 58h7" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <Ellipse cx={50} cy={48} rx={21} ry={22} fill={INK} />
      <Path d="M30 40q20-8 40 0v5q-20-8-40 0z" fill={LIME} />
      <Path d="M70 41l9-4-2 6 5 3-10 1z" fill={LIME} />
      <Face cx={50} cy={49} r={5.5} />
      <Path d="M42 62l8 9 8-9" fill="none" stroke={LIME} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={50} cy={73} r={5} fill={LIME} stroke={WHITE} strokeWidth={1.6} />
      <Rect x={33} y={72} width={11} height={6} rx={3} fill={INK} transform="rotate(-20 38 75)" />
      <Rect x={57} y={73} width={11} height={6} rx={3} fill={INK} />
    </Sticker>
  ),
};

/** Sagoma con il lucchetto, per le medaglie non ancora iniziate. */
const LOCKED = (
  <G>
    <Circle cx={48} cy={48} r={45} fill={WHITE} stroke={INK} strokeOpacity={0.45} strokeWidth={2.5} strokeDasharray="5 6" />
    <Circle cx={48} cy={48} r={37.5} fill={INK} fillOpacity={0.07} />
    <Ellipse cx={48} cy={48} rx={21} ry={22} fill={INK} fillOpacity={0.12} />
    <Rect x={35} y={69} width={11} height={6} rx={3} fill={INK} fillOpacity={0.12} />
    <Rect x={50} y={69} width={11} height={6} rx={3} fill={INK} fillOpacity={0.12} />
    <Rect x={40} y={46} width={16} height={13} rx={3} fill={WHITE} stroke={INK} strokeWidth={2.4} />
    <Path d="M43 46v-4a5 5 0 0 1 10 0v4" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
  </G>
);

/** Inclinazione da adesivo, diversa per ogni medaglia. */
const TILT: Record<BadgeId, number> = {
  'primo-passo': -6,
  're-della-metro': 5,
  'due-ruote': -4,
  'sette-su-sette': 4,
  'pendolare-doro': -6,
  scossa: 5,
  capotreno: -5,
  'in-condivisione': 4,
  maratoneta: -4,
};

export type MedalLook = 'sbloccata' | 'in-corso' | 'bloccata';

export function Medal({ id, look, size = 76, label }: { id: BadgeId; look: MedalLook; size?: number; label: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      opacity={look === 'in-corso' ? 0.6 : 1}
      accessibilityRole="image"
      accessibilityLabel={label}
      style={look === 'sbloccata' ? { transform: [{ rotate: `${TILT[id]}deg` }] } : undefined}
    >
      {look === 'bloccata' ? LOCKED : ART[id]}
    </Svg>
  );
}
