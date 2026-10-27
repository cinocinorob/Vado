/** Decorazioni del tema di Natale: neve e una stella sul blocco principale di Oggi. */
import Svg, { Circle, G, Path } from 'react-native-svg';

function Flake({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <G transform={`translate(${x} ${y})`} stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round">
      <Path d={`M0 ${-r}V${r}M${-r * 0.87} ${-r / 2}L${r * 0.87} ${r / 2}M${-r * 0.87} ${r / 2}L${r * 0.87} ${-r / 2}`} />
    </G>
  );
}

export function Snow({ width = 150, height = 90 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 150 90" pointerEvents="none">
      <Path d="M22 8l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L22 24.5l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z" fill="#FFE27A" />
      <G opacity={0.9}>
        <Flake x={58} y={16} r={6} />
        <Flake x={92} y={36} r={4.5} />
        <Flake x={46} y={58} r={3.5} />
      </G>
      <Circle cx={120} cy={14} r={2} fill="#FFFFFF" opacity={0.8} />
      <Circle cx={72} cy={76} r={1.6} fill="#FFFFFF" opacity={0.7} />
      <Circle cx={10} cy={46} r={1.8} fill="#FFFFFF" opacity={0.7} />
    </Svg>
  );
}
