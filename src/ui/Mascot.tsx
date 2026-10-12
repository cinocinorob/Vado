/**
 * La mascotte di Vado: il germoglio. Questi nomi restano per le schermate che
 * mostrano la mascotte "di repertorio"; dove serve lo stato vero della pianta
 * dell'utente si usa direttamente <Sprout>.
 */
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import type { Health, Stage } from '../core/plant';
import { SHAPES } from './shapes';
import { SproutShapes } from './Sprout';

/** Solo le forme, da inserire dentro un altro <Svg> (area 96×96), su un fondo a biscotto. */
export function MascotShapes({ disc = '#CDEFE6', stage = 'piantina', health = 'forma' }: { disc?: string; stage?: Stage; health?: Health }) {
  return (
    <G>
      <Path d={SHAPES.cookie12} fill={disc} />
      <G transform="translate(12 11) scale(0.75)">
        <SproutShapes stage={stage} health={health} ground={false} />
      </G>
    </G>
  );
}

export function Mascot({ size = 96, disc, stage, health, tilt = 0 }: { size?: number; disc?: string; stage?: Stage; health?: Health; tilt?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="Il germoglio di Vado" style={tilt ? { transform: [{ rotate: `${tilt}deg` }] } : undefined}>
      <MascotShapes disc={disc} stage={stage} health={health} />
    </Svg>
  );
}

/** Versione più grande per i blocchi in cima alle schermate. */
export function StickerMascot({ size = 140, disc, stage, health, tilt = 0 }: { size?: number; disc?: string; stage?: Stage; health?: Health; tilt?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <Mascot size={size} disc={disc} stage={stage} health={health} tilt={tilt} />
    </View>
  );
}
