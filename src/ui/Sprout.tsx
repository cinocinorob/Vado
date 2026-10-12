/**
 * Il germoglio di Vado e gli alberi del bosco. Disegni originali del progetto,
 * area 96×96.
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { Health, SpeciesId, Stage } from '../core/plant';

const INK = '#1A1D14';
const WHITE = '#FFFFFF';

const TONES: Record<Health, { leaf: string; leafLight: string; body: string; stem: string }> = {
  forma: { leaf: '#7BD389', leafLight: '#9BE09F', body: '#2E9C7E', stem: '#2E9C7E' },
  pausa: { leaf: '#7BD389', leafLight: '#9BE09F', body: '#2E9C7E', stem: '#2E9C7E' },
  sete: { leaf: '#A9C98A', leafLight: '#B8D49C', body: '#5E9C7E', stem: '#4E9476' },
  appassita: { leaf: '#B9A577', leafLight: '#C7B488', body: '#7F8F6A', stem: '#8C9A6E' },
};

/** Gradi di cui si piegano le foglie. */
const DROOP: Record<Health, number> = { forma: 0, pausa: 0, sete: 22, appassita: 58 };

function Leaf({ x, y, side, size, color, droop }: { x: number; y: number; side: -1 | 1; size: number; color: string; droop: number }) {
  const s = size;
  const d = `M${x} ${y}C${x + side * 8 * s} ${y} ${x + side * 16 * s} ${y - 6 * s} ${x + side * 16 * s} ${y - 16 * s}C${x + side * 4 * s} ${y - 16 * s} ${x} ${y - 10 * s} ${x} ${y}Z`;
  return <Path d={d} fill={color} transform={droop ? `rotate(${side * droop} ${x} ${y})` : undefined} />;
}

function Face({ cx, cy, health, scale = 1 }: { cx: number; cy: number; health: Health; scale?: number }) {
  const g = 6 * scale;
  const r = 4.8 * scale;
  const mouth = 7 * scale;
  if (health === 'appassita') {
    return (
      <G>
        <Path d={`M${cx - g - 3} ${cy}h6M${cx + g - 3} ${cy}h6`} stroke={WHITE} strokeWidth={2.6} strokeLinecap="round" />
        <Path d={`M${cx - mouth / 2} ${cy + 10 * scale}q${mouth / 2} -${mouth * 0.4} ${mouth} 0`} fill="none" stroke={WHITE} strokeWidth={2.2} strokeLinecap="round" />
      </G>
    );
  }
  if (health === 'pausa') {
    return (
      <G>
        <Path d={`M${cx - g - 4} ${cy}q4 3 8 0M${cx + g - 4} ${cy}q4 3 8 0`} fill="none" stroke={WHITE} strokeWidth={2.4} strokeLinecap="round" />
        <Path d={`M${cx - mouth / 2} ${cy + 8 * scale}q${mouth / 2} ${mouth * 0.35} ${mouth} 0`} fill="none" stroke={WHITE} strokeWidth={2.2} strokeLinecap="round" />
      </G>
    );
  }
  const look = health === 'sete' ? 0 : 1;
  return (
    <G>
      <Circle cx={cx - g} cy={cy} r={r} fill={WHITE} />
      <Circle cx={cx + g} cy={cy} r={r} fill={WHITE} />
      <Circle cx={cx - g + look} cy={cy + (health === 'sete' ? 1.5 : 0.6)} r={r * 0.45} fill={INK} />
      <Circle cx={cx + g + look} cy={cy + (health === 'sete' ? 1.5 : 0.6)} r={r * 0.45} fill={INK} />
      {health === 'sete' ? (
        <Path d={`M${cx - mouth / 2} ${cy + 10 * scale}q${mouth / 2} -${mouth * 0.4} ${mouth} 0`} fill="none" stroke={WHITE} strokeWidth={2.2} strokeLinecap="round" />
      ) : (
        <Path d={`M${cx - mouth / 2} ${cy + 8 * scale}q${mouth / 2} ${mouth * 0.45} ${mouth} 0`} fill="none" stroke={WHITE} strokeWidth={2.4} strokeLinecap="round" />
      )}
    </G>
  );
}

const GROUND = <Path d="M14 84H82" stroke="#8B6B4A" strokeWidth={5} strokeLinecap="round" />;

/** Solo le forme, da mettere dentro un <Svg viewBox="0 0 96 96">. */
/** Dove sta la chioma di ogni albero, per metterci la faccia. */
const CANOPY: Record<SpeciesId, { x: number; y: number; scale: number }> = {
  pino: { x: 48, y: 32, scale: 1 },
  cipresso: { x: 48, y: 46, scale: 0.8 },
  leccio: { x: 48, y: 42, scale: 1.1 },
  ulivo: { x: 48, y: 36, scale: 1 },
  platano: { x: 48, y: 34, scale: 1.05 },
};

/**
 * L'albero scelto con la faccia: da piccolo (piantina) o completo. Sete e
 * appassimento lo piegano e lo sbiadiscono.
 */
function TreeWithFace({ species, young, health, ground }: { species: SpeciesId; young: boolean; health: Health; ground: boolean }) {
  const c = CANOPY[species];
  const tilt = health === 'sete' ? -7 : health === 'appassita' ? -16 : 0;
  // La piantina è l'albero in piccolo, appoggiato a terra.
  const size = young ? 'translate(48 84) scale(0.78) translate(-48 -84)' : '';
  return (
    <G>
      {ground ? GROUND : null}
      <G transform={`${size} rotate(${tilt} 48 84)`} opacity={health === 'appassita' ? 0.55 : 1}>
        {TREES[species]}
        <Face cx={c.x} cy={c.y} health={health} scale={c.scale} />
      </G>
      {health === 'sete' ? <Path d="M74 46c-2 3-2 6 0 7s3-4 0-7z" fill="#7FC4E8" /> : null}
      {health === 'pausa' ? <Path d="M70 18h7l-7 8h7M80 8h5l-5 6h5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </G>
  );
}

export function SproutShapes({
  stage,
  health = 'forma',
  ground = true,
  species,
  grown = false,
}: {
  stage: Stage;
  health?: Health;
  ground?: boolean;
  /** Con la specie, la piantina è già l'albero scelto in piccolo. */
  species?: SpeciesId;
  /** L'albero completo (per chi ne ha già fatto crescere almeno uno, in classifica). */
  grown?: boolean;
}) {
  if (species && (grown || stage === 'piantina')) {
    return <TreeWithFace species={species} young={!grown} health={health} ground={ground} />;
  }
  const t = TONES[health];
  const droop = DROOP[health];
  let plant: ReactNode;
  if (stage === 'seme') {
    plant = (
      <G>
        <Ellipse cx={48} cy={70} rx={16} ry={13} fill={health === 'appassita' ? '#9A7B60' : '#B07A4F'} />
        <Face cx={48} cy={68} health={health} scale={0.85} />
      </G>
    );
  } else if (stage === 'germoglio') {
    plant = (
      <G>
        <Path d="M48 84V56" stroke={t.stem} strokeWidth={5} strokeLinecap="round" />
        <Leaf x={48} y={60} side={-1} size={1} color={t.leaf} droop={droop} />
        <Leaf x={48} y={56} side={1} size={1} color={t.leaf} droop={droop} />
        <Ellipse cx={48} cy={72} rx={13} ry={11} fill={t.body} />
        <Face cx={48} cy={70} health={health} scale={0.8} />
      </G>
    );
  } else {
    plant = (
      <G>
        <Path d="M48 84V40" stroke={t.stem} strokeWidth={5} strokeLinecap="round" />
        <Leaf x={48} y={50} side={-1} size={1.25} color={t.leaf} droop={droop} />
        <Leaf x={48} y={44} side={1} size={1.25} color={t.leaf} droop={droop} />
        <Path d="M48 30C44 26 44 18 48 12C52 18 52 26 48 30Z" fill={t.leafLight} transform={droop ? `rotate(${droop} 48 30)` : undefined} />
        <Ellipse cx={48} cy={68} rx={16} ry={14} fill={t.body} />
        <Face cx={48} cy={66} health={health} />
      </G>
    );
  }
  // Il seme e il germoglio stanno in basso nel disegno: si ingrandiscono e si
  // centrano, così nelle forme piccole (avatar, schede) si vedono bene.
  const frame = stage === 'seme' ? 'translate(48 50) scale(1.5) translate(-48 -70)' : stage === 'germoglio' ? 'translate(48 50) scale(1.25) translate(-48 -64)' : 'translate(0 -2)';
  return (
    <G transform={frame}>
      {ground ? GROUND : null}
      {plant}
      {health === 'sete' ? <Path d="M70 56c-2 3-2 6 0 7s3-4 0-7z" fill="#7FC4E8" /> : null}
      {health === 'pausa' ? <Path d="M66 30h7l-7 8h7M76 20h5l-5 6h5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </G>
  );
}

export function Sprout({
  size = 96,
  stage,
  health = 'forma',
  species,
  grown,
  label,
}: {
  size?: number;
  stage: Stage;
  health?: Health;
  species?: SpeciesId;
  grown?: boolean;
  label?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel={label} accessible={!!label}>
      <SproutShapes stage={stage} health={health} species={species} grown={grown} />
    </Svg>
  );
}

/** L'albero completo con la faccia, per i momenti di festa. */
export function TreeFace({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      {GROUND}
      <Path d="M48 84V58" stroke="#7A5233" strokeWidth={9} strokeLinecap="round" />
      <Circle cx={48} cy={40} r={26} fill="#2E9C7E" />
      <Circle cx={28} cy={50} r={16} fill="#2E9C7E" />
      <Circle cx={68} cy={50} r={16} fill="#2E9C7E" />
      <Circle cx={40} cy={28} r={8} fill="#4FB892" />
      <Face cx={48} cy={44} health="forma" scale={1.15} />
    </Svg>
  );
}

const TREES: Record<SpeciesId, ReactNode> = {
  pino: (
    <G>
      <Path d="M48 84V42M48 52l-10-8M48 48l12-8" stroke="#7A5233" strokeWidth={5} strokeLinecap="round" />
      <Path d="M14 40C14 26 30 20 48 20C66 20 82 26 82 40C70 46 26 46 14 40Z" fill="#2E7D5E" />
    </G>
  ),
  cipresso: (
    <G>
      <Path d="M48 84V74" stroke="#7A5233" strokeWidth={6} strokeLinecap="round" />
      <Path d="M48 8C60 26 62 56 56 76H40C34 56 36 26 48 8Z" fill="#1F6B4F" />
    </G>
  ),
  leccio: (
    <G>
      <Path d="M48 84V60" stroke="#7A5233" strokeWidth={7} strokeLinecap="round" />
      <Circle cx={48} cy={40} r={24} fill="#2B6E4A" />
      <Circle cx={30} cy={52} r={13} fill="#2B6E4A" />
      <Circle cx={66} cy={52} r={13} fill="#2B6E4A" />
    </G>
  ),
  ulivo: (
    <G>
      <Path d="M48 84C46 72 52 66 46 56M46 62l10-8" fill="none" stroke="#7A6A55" strokeWidth={6} strokeLinecap="round" />
      <Ellipse cx={38} cy={42} rx={18} ry={12} fill="#9DB39A" />
      <Ellipse cx={60} cy={38} rx={18} ry={13} fill="#8FA88C" />
      <Ellipse cx={50} cy={28} rx={14} ry={10} fill="#A9BFA6" />
    </G>
  ),
  platano: (
    <G>
      <Path d="M48 84V54M48 62l-12-10M48 58l12-10" stroke="#9C8B6E" strokeWidth={6} strokeLinecap="round" />
      <Path d="M20 46C14 30 30 14 48 16C68 14 84 30 76 46C68 56 28 56 20 46Z" fill="#5FA05A" />
      <Circle cx={36} cy={32} r={6} fill="#76B56F" />
    </G>
  ),
};

export function Tree({ species, size = 64, label }: { species: SpeciesId; size?: number; label?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel={label} accessible={!!label}>
      {GROUND}
      {TREES[species]}
    </Svg>
  );
}
