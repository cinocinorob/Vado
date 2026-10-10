/** La mascotte in versione adesivo "Primo passo". Disegno originale del progetto. */
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Solo le forme, da inserire dentro un altro <Svg> (area 96×96). */
export function MascotShapes() {
  return (
    <G>
      <Circle cx={48} cy={48} r={46} fill="#FFFFFF" />
      <Circle cx={48} cy={48} r={39} fill="#C8F560" />
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

export function Mascot({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityLabel="Mascotte di Vado">
      <MascotShapes />
    </Svg>
  );
}
