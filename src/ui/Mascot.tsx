/** La mascotte in versione adesivo "Primo passo". Disegno originale del progetto. */
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Solo le forme, da inserire dentro un altro <Svg> (area 96×96).
 * @param disc colore del disco dietro la mascotte: va scelto diverso dal fondo su cui la si appoggia
 */
export function MascotShapes({ disc = '#C8F560' }: { disc?: string }) {
  return (
    <G>
      {/* Bordo bianco da adesivo, con il contorno a inchiostro che lo stacca dai fondi chiari. */}
      <Circle cx={48} cy={48} r={45} fill="#FFFFFF" stroke="#0B1F2A" strokeWidth={3} />
      <Circle cx={48} cy={48} r={37.5} fill={disc} />
      <Path d="M15 44h7M13 52h9M16 60h6" fill="none" stroke="#0B1F2A" strokeWidth={2.6} strokeLinecap="round" />
      <Ellipse cx={50} cy={48} rx={21} ry={22} fill="#0B1F2A" />
      <Circle cx={45} cy={44} r={6} fill="#FFFFFF" />
      <Circle cx={59} cy={44} r={6} fill="#FFFFFF" />
      <Circle cx={47} cy={45} r={2.6} fill="#0B1F2A" />
      <Circle cx={61} cy={45} r={2.6} fill="#0B1F2A" />
      <Path d="M47 56q5 4 10 0" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      <Rect x={33} y={68} width={13} height={6} rx={3} fill="#0B1F2A" transform="rotate(-20 39 71)" />
      <Rect x={53} y={69} width={13} height={6} rx={3} fill="#0B1F2A" />
    </G>
  );
}

export function Mascot({ size = 96, disc, tilt = 0 }: { size?: number; disc?: string; tilt?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      accessibilityLabel="Mascotte di Vado"
      style={tilt ? { transform: [{ rotate: `${tilt}deg` }] } : undefined}
    >
      <MascotShapes disc={disc} />
    </Svg>
  );
}

/** La mascotte "staccata dal foglio": inclinata e con l'ombra piena sotto. */
export function StickerMascot({ size = 140, disc, tilt = 8 }: { size?: number; disc?: string; tilt?: number }) {
  const lift = Math.round(size * 0.045);
  return (
    <View style={{ width: size, height: size + lift, transform: [{ rotate: `${tilt}deg` }] }}>
      <View
        style={{ position: 'absolute', left: size * 0.016, top: size * 0.016 + lift, width: size * 0.968, height: size * 0.968, borderRadius: size / 2, backgroundColor: '#0B1F2A' }}
      />
      {/* Posizionata come l'ombra, altrimenti nel browser l'ombra le finisce davanti. */}
      <View style={{ position: 'absolute', left: 0, top: 0 }}>
        <Mascot size={size} disc={disc} />
      </View>
    </View>
  );
}
