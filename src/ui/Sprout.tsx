/**
 * Il germoglio di Vado e gli alberi del bosco. Disegni originali del progetto,
 * area 96×96: corpi tondi e morbidi, occhi grandi con il riflesso, guance
 * rosa. Ogni forma ha un'ombra dal basso e un riflesso in alto per dare volume.
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { Health, SpeciesId, Stage } from '../core/plant';
import { HALLOWEEN_ON } from './theme';

const INK = '#1F2A22';
const WHITE = '#FFFFFF';
const CHEEK = '#FF8FA3';

/** Cappello da strega, appoggiato sulla testa e un po' inclinato. */
function WitchHat({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(16) scale(${scale})`}>
      <Ellipse cx={0} cy={0} rx={13} ry={3.4} fill="#2A1838" />
      <Path d="M-8 -1L-2.5 -21Q0 -27 4.5 -23.5L10 -18.5L5.5 -16.5L7.5 -1Z" fill="#2A1838" />
      <Path d="M-7.6 -4.2h15.2" stroke="#FF8A2A" strokeWidth={2.8} />
      <Circle cx={10} cy={-18.5} r={1.8} fill="#FFD23F" />
    </G>
  );
}

type Tone = { body: string; shade: string; leaf: string; leafShade: string; stem: string };

const TONES: Record<Health, Tone> = {
  forma: { body: '#3FBF8F', shade: '#2C9A72', leaf: '#8BE08F', leafShade: '#5FC46C', stem: '#2C9A72' },
  pausa: { body: '#3FBF8F', shade: '#2C9A72', leaf: '#8BE08F', leafShade: '#5FC46C', stem: '#2C9A72' },
  sete: { body: '#79B58F', shade: '#5E9876', leaf: '#B5D49A', leafShade: '#97BC7E', stem: '#5E9876' },
  appassita: { body: '#A7A37C', shade: '#8A8763', leaf: '#CDB57E', leafShade: '#B39A64', stem: '#8A8763' },
};

const SEED: Record<Health, { body: string; shade: string }> = {
  forma: { body: '#D49460', shade: '#B0723F' },
  pausa: { body: '#D49460', shade: '#B0723F' },
  sete: { body: '#C79B76', shade: '#A57B57' },
  appassita: { body: '#B09A84', shade: '#8F7A65' },
};

/** Gradi di cui si piegano le foglie. */
const DROOP: Record<Health, number> = { forma: 0, pausa: 0, sete: 22, appassita: 58 };

/** Una forma con volume: base scura, la stessa più chiara spostata in alto, un riflesso. */
function Soft({ d, light, dark, shine }: { d: string; light: string; dark: string; shine: { x: number; y: number } }) {
  return (
    <G>
      <Path d={d} fill={dark} />
      <Path d={d} fill={light} transform="translate(-1.4 -2.6)" />
      <Ellipse cx={shine.x} cy={shine.y} rx={6} ry={3} fill={WHITE} opacity={0.4} transform={`rotate(-24 ${shine.x} ${shine.y})`} />
    </G>
  );
}

function Blob({ cx, cy, rx, ry, light, dark }: { cx: number; cy: number; rx: number; ry: number; light: string; dark: string }) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={dark} />
      <Ellipse cx={cx - 1.2} cy={cy - 2.4} rx={rx * 0.95} ry={ry * 0.9} fill={light} />
      <Ellipse cx={cx - rx * 0.42} cy={cy - ry * 0.5} rx={rx * 0.22} ry={ry * 0.14} fill={WHITE} opacity={0.5} transform={`rotate(-28 ${cx - rx * 0.42} ${cy - ry * 0.5})`} />
    </G>
  );
}

function Leaf({ x, y, side, size, tone, droop }: { x: number; y: number; side: -1 | 1; size: number; tone: Tone; droop: number }) {
  const s = size;
  const tipX = x + side * 18 * s;
  const tipY = y - 12 * s;
  const d = `M${x} ${y}C${x + side * 4 * s} ${y + 4 * s} ${tipX + side * 2 * s} ${y + 2 * s} ${tipX} ${tipY}C${x + side * 10 * s} ${tipY - 6 * s} ${x - side * 1 * s} ${y - 8 * s} ${x} ${y}Z`;
  return (
    <G transform={droop ? `rotate(${side * droop} ${x} ${y})` : undefined}>
      <Path d={d} fill={tone.leaf} />
      <Path d={`M${x + side * 2 * s} ${y - 1 * s}Q${x + side * 10 * s} ${y - 4 * s} ${tipX - side * 2 * s} ${tipY + 2 * s}`} fill="none" stroke={tone.leafShade} strokeWidth={1.6} strokeLinecap="round" />
    </G>
  );
}

/** Occhi, guance e bocca. `scale` 1 è la faccia di un corpo largo una quarantina di unità. */
function Face({ cx, cy, health, scale = 1, hat = true }: { cx: number; cy: number; health: Health; scale?: number; hat?: boolean }) {
  const g = 8 * scale;
  const mouth = 5 * scale;
  const cheeks = (
    <G opacity={health === 'appassita' ? 0.25 : 0.6}>
      <Ellipse cx={cx - g - 4.5 * scale} cy={cy + 5 * scale} rx={3.6 * scale} ry={2.3 * scale} fill={CHEEK} />
      <Ellipse cx={cx + g + 4.5 * scale} cy={cy + 5 * scale} rx={3.6 * scale} ry={2.3 * scale} fill={CHEEK} />
    </G>
  );
  let eyes: ReactNode;
  let mouthPath: ReactNode;
  const sw = 2.1 * scale;
  if (health === 'appassita' || health === 'pausa') {
    // Occhi chiusi: tristi se appassita, beati se in pausa.
    const curve = health === 'pausa' ? 2.6 : -2.6;
    eyes = (
      <Path
        d={`M${cx - g - 3.4 * scale} ${cy}q${3.4 * scale} ${curve * scale} ${6.8 * scale} 0M${cx + g - 3.4 * scale} ${cy}q${3.4 * scale} ${curve * scale} ${6.8 * scale} 0`}
        fill="none"
        stroke={INK}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    );
  } else {
    const rx = 3.4 * scale;
    const ry = 4.3 * scale;
    const dy = health === 'sete' ? 0.8 * scale : 0;
    eyes = (
      <G>
        {[-g, g].map((dx) => (
          <G key={dx}>
            <Ellipse cx={cx + dx} cy={cy + dy} rx={rx} ry={ry} fill={HALLOWEEN_ON ? '#2A1838' : INK} />
            <Circle cx={cx + dx + 1.2 * scale} cy={cy + dy - 1.6 * scale} r={1.35 * scale} fill={HALLOWEEN_ON ? '#FFE45C' : WHITE} />
            <Circle cx={cx + dx - 1.1 * scale} cy={cy + dy + 1.6 * scale} r={0.6 * scale} fill={WHITE} opacity={0.85} />
          </G>
        ))}
      </G>
    );
  }
  const my = cy + 6 * scale;
  if (health === 'sete' || health === 'appassita') {
    // Bocca ondulata: un po' di fatica.
    mouthPath = (
      <Path
        d={`M${cx - mouth} ${my + 1.2 * scale}q${mouth / 2} ${-1.6 * scale} ${mouth} 0t${mouth} 0`}
        fill="none"
        stroke={INK}
        strokeWidth={sw * 0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  } else {
    // Sorriso a "w", da gattino.
    mouthPath = (
      <Path
        d={`M${cx - mouth} ${my}q${mouth / 2} ${2.6 * scale} ${mouth} 0q${mouth / 2} ${2.6 * scale} ${mouth} 0`}
        fill="none"
        stroke={INK}
        strokeWidth={sw * 0.85}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return (
    <G>
      {cheeks}
      {eyes}
      {mouthPath}
      {HALLOWEEN_ON && hat ? <WitchHat x={cx + 11 * scale} y={cy - 15 * scale} scale={0.6 * scale} /> : null}
    </G>
  );
}

const SHADOW = <Ellipse cx={48} cy={87} rx={22} ry={3.6} fill="#000000" opacity={0.16} />;

/** Gocciolina di sudore (sete) e "Zz" (pausa). */
function Extras({ health, x, y }: { health: Health; x: number; y: number }) {
  if (health === 'sete') return <Path d={`M${x} ${y}c-2.4 3.4-2.4 6.4 0 7.4s2.4-4 0-7.4z`} fill="#7FC4E8" />;
  if (health === 'pausa') {
    return (
      <Path
        d={`M${x - 4} ${y}h6l-6 7h6M${x + 6} ${y - 10}h4.5l-4.5 5.5h4.5`}
        fill="none"
        stroke="#5B6CFF"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return null;
}

/** Dove sta la faccia sulla chioma di ogni albero. */
const CANOPY: Record<SpeciesId, { x: number; y: number; scale: number }> = {
  pino: { x: 48, y: 33, scale: 1 },
  cipresso: { x: 48, y: 46, scale: 0.78 },
  leccio: { x: 48, y: 42, scale: 1.1 },
  ulivo: { x: 48, y: 38, scale: 0.95 },
  platano: { x: 48, y: 36, scale: 1.05 },
};

const TRUNK = '#9A6A43';
const TRUNK_DARK = '#7A5233';

function Trunk({ from, to, width }: { from: number; to: number; width: number }) {
  return (
    <G>
      <Path d={`M48 ${to}V${from}`} stroke={TRUNK_DARK} strokeWidth={width} strokeLinecap="round" />
      <Path d={`M47 ${to - 1}V${from + 2}`} stroke={TRUNK} strokeWidth={width * 0.55} strokeLinecap="round" />
    </G>
  );
}

const TREES: Record<SpeciesId, ReactNode> = {
  pino: (
    <G>
      <Trunk from={44} to={84} width={7} />
      <Path d="M48 56l-9-8M48 52l10-8" stroke={TRUNK_DARK} strokeWidth={4} strokeLinecap="round" />
      <Soft d="M12 42C12 23 30 15 48 15C66 15 84 23 84 42C76 50 20 50 12 42Z" light="#3AA77A" dark="#27805C" shine={{ x: 28, y: 25 }} />
    </G>
  ),
  cipresso: (
    <G>
      <Trunk from={74} to={84} width={7} />
      <Soft d="M48 6C63 22 66 56 58 78C52 80 44 80 38 78C30 56 33 22 48 6Z" light="#2F9467" dark="#1F6B4F" shine={{ x: 42, y: 24 }} />
    </G>
  ),
  leccio: (
    <G>
      <Trunk from={58} to={84} width={8} />
      <Blob cx={29} cy={52} rx={14} ry={13} light="#3C8F62" dark="#2B6E4A" />
      <Blob cx={67} cy={52} rx={14} ry={13} light="#3C8F62" dark="#2B6E4A" />
      <Blob cx={48} cy={40} rx={26} ry={25} light="#3C8F62" dark="#2B6E4A" />
    </G>
  ),
  ulivo: (
    <G>
      <Path d="M48 84C45 72 53 66 47 56M47 63l10-8" fill="none" stroke="#7A6A55" strokeWidth={6} strokeLinecap="round" />
      <Blob cx={34} cy={44} rx={17} ry={13} light="#AFC4AB" dark="#8FA88C" />
      <Blob cx={62} cy={42} rx={18} ry={14} light="#AFC4AB" dark="#8FA88C" />
      <Blob cx={48} cy={34} rx={22} ry={17} light="#BCD0B8" dark="#99B396" />
    </G>
  ),
  platano: (
    <G>
      <Trunk from={52} to={84} width={7} />
      <Path d="M48 62l-12-10M48 58l12-10" stroke="#9C8B6E" strokeWidth={4.5} strokeLinecap="round" />
      <Soft d="M18 46C10 30 28 12 48 14C70 12 86 30 78 46C70 58 26 58 18 46Z" light="#6DB765" dark="#4E914A" shine={{ x: 30, y: 24 }} />
    </G>
  ),
};

/**
 * L'albero scelto con la faccia: da piccolo (piantina) o completo. Sete e
 * appassimento lo piegano e lo sbiadiscono.
 */
function TreeWithFace({ species, young, health, ground }: { species: SpeciesId; young: boolean; health: Health; ground: boolean }) {
  const c = CANOPY[species];
  const tilt = health === 'sete' ? -7 : health === 'appassita' ? -16 : 0;
  // La piantina è l'albero in piccolo, appoggiato a terra.
  const size = young ? 'translate(48 86) scale(0.8) translate(-48 -86)' : '';
  return (
    <G>
      {ground ? SHADOW : null}
      <G transform={`${size} rotate(${tilt} 48 84)`} opacity={health === 'appassita' ? 0.6 : 1}>
        {TREES[species]}
        <Face cx={c.x} cy={c.y} health={health} scale={c.scale} />
      </G>
      <Extras health={health} x={76} y={health === 'pausa' ? 22 : 40} />
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
  /** L'ombra a terra. */
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
    const s = SEED[health];
    plant = (
      <G>
        <Path d="M48 47c0-5 2-8 6-9" fill="none" stroke={t.stem} strokeWidth={3} strokeLinecap="round" />
        <Leaf x={53} y={39} side={1} size={0.45} tone={t} droop={droop} />
        <Blob cx={48} cy={66} rx={23} ry={20} light={s.body} dark={s.shade} />
        <Face cx={48} cy={65} health={health} scale={1} />
      </G>
    );
  } else if (stage === 'germoglio') {
    plant = (
      <G>
        <Path d="M48 48V36" stroke={t.stem} strokeWidth={4} strokeLinecap="round" />
        <Leaf x={48} y={37} side={-1} size={0.9} tone={t} droop={droop} />
        <Leaf x={48} y={35} side={1} size={0.9} tone={t} droop={droop} />
        <Blob cx={48} cy={65} rx={23} ry={20} light={t.body} dark={t.shade} />
        <Face cx={48} cy={64} health={health} scale={1} />
      </G>
    );
  } else {
    plant = (
      <G>
        <Path d="M48 50V18" stroke={t.stem} strokeWidth={4} strokeLinecap="round" />
        <Leaf x={48} y={40} side={-1} size={1.05} tone={t} droop={droop} />
        <Leaf x={48} y={31} side={1} size={1.05} tone={t} droop={droop} />
        <Path d="M48 20C43.5 15 44 8 48 3C52 8 52.5 15 48 20Z" fill={t.leaf} transform={droop ? `rotate(${droop} 48 20)` : undefined} />
        <Blob cx={48} cy={67} rx={25} ry={20} light={t.body} dark={t.shade} />
        <Face cx={48} cy={66} health={health} scale={1.05} />
      </G>
    );
  }
  return (
    <G opacity={health === 'appassita' ? 0.9 : 1}>
      {ground ? SHADOW : null}
      {plant}
      <Extras health={health} x={76} y={health === 'pausa' ? 34 : 50} />
    </G>
  );
}

/** Inquadratura stretta attorno alla faccia, per gli avatar piccoli. */
function cropBox(stage: Stage, species?: SpeciesId, grown?: boolean): string {
  const box = (cy: number, r: number) => `${48 - r} ${cy - r} ${2 * r} ${2 * r}`;
  if (species && (grown || stage === 'piantina')) {
    const faceY = grown ? CANOPY[species].y : 86 - (86 - CANOPY[species].y) * 0.8;
    return grown ? box(faceY + 6, 36) : box(faceY + 4, 32);
  }
  if (stage === 'seme') return box(60, 30);
  if (stage === 'germoglio') return box(56, 33);
  return box(46, 43);
}

export function Sprout({
  size = 96,
  stage,
  health = 'forma',
  species,
  grown,
  label,
  ground = true,
  crop = false,
}: {
  size?: number;
  stage: Stage;
  health?: Health;
  species?: SpeciesId;
  grown?: boolean;
  label?: string;
  ground?: boolean;
  /** Inquadratura stretta sulla faccia, per gli avatar. */
  crop?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox={crop ? cropBox(stage, species, grown) : '0 0 96 96'} accessibilityLabel={label} accessible={!!label}>
      <SproutShapes stage={stage} health={health} species={species} grown={grown} ground={ground} />
    </Svg>
  );
}

/** L'albero completo con la faccia, per i momenti di festa. */
export function TreeFace({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <TreeWithFace species="leccio" young={false} health="forma" ground />
    </Svg>
  );
}

export function Tree({ species, size = 64, label }: { species: SpeciesId; size?: number; label?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel={label} accessible={!!label}>
      {SHADOW}
      {TREES[species]}
    </Svg>
  );
}
