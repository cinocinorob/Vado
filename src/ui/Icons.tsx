/** Icone disegnate a tratto, le stesse del mockup. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { ModeId } from '../core/modes';

type IconProps = { size?: number; color?: string };

function Stroke({ size = 24, color = '#FFFFFF', width = 2, children }: IconProps & { width?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  );
}

const CAR = (
  <>
    <Path d="M4 17v-3.5L6.5 9h11l2.5 4.5V17" />
    <Path d="M3 17h18" />
    <Path d="M4.5 13.5h15" />
    <Path d="M7.5 20v-3M16.5 20v-3" />
  </>
);

export function ModeIcon({ mode, ...props }: IconProps & { mode: ModeId }) {
  switch (mode) {
    case 'piedi':
      return (
        <Stroke {...props}>
          <Circle cx={13} cy={4.5} r={2} />
          <Path d="M9.5 9.5L13 8l2.5 3.5 3 1.5" />
          <Path d="M13 8l-1 6 3 3 1 4.5" />
          <Path d="M12 14l-2 3.5L7 21" />
          <Path d="M9.5 9.5L8 13" />
        </Stroke>
      );
    case 'bici':
      return (
        <Stroke {...props}>
          <Circle cx={6} cy={16} r={3.5} />
          <Circle cx={18} cy={16} r={3.5} />
          <Path d="M6 16l3.5-7.5H15L18 16" />
          <Path d="M9.5 8.5L13 16H6" />
          <Path d="M8 6h3M15 8.5l-1-3h2.5" />
        </Stroke>
      );
    case 'ebike':
      return (
        <Stroke {...props}>
          <Path d="M13 2L5 14h6l-1 8 8-12h-6l1-8z" />
        </Stroke>
      );
    case 'tpl':
      return (
        <Stroke {...props}>
          <Rect x={5} y={3} width={14} height={14} rx={3} />
          <Path d="M5 11h14" />
          <Path d="M9 14h.01M15 14h.01" />
          <Path d="M8 21l2-4M16 21l-2-4" />
        </Stroke>
      );
    case 'treno':
      return (
        <Stroke {...props}>
          <Rect x={6} y={3} width={12} height={13} rx={2.5} />
          <Path d="M6 10h12" />
          <Path d="M9.5 13h.01M14.5 13h.01" />
          <Path d="M8.5 20l1.5-4M15.5 20L14 16" />
          <Path d="M4 20.5h16" />
        </Stroke>
      );
    case 'carsharing':
      return (
        <Stroke {...props}>
          {CAR}
          <Circle cx={9.5} cy={4.5} r={1.4} />
          <Circle cx={14.5} cy={4.5} r={1.4} />
        </Stroke>
      );
    case 'autoel':
      return (
        <Stroke {...props}>
          {CAR}
          <Path d="M13 1.5l-2.2 2.4h2.6l-2.2 2.4" />
        </Stroke>
      );
    case 'auto':
      return <Stroke {...props}>{CAR}</Stroke>;
  }
}

export function PlayIcon({ size = 24, color = '#0B1F2A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5l11 7-11 7V5z" />
    </Svg>
  );
}

export function PauseIcon({ size = 18, color = '#FFFFFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={6} y={5} width={4} height={14} rx={1.5} />
      <Rect x={14} y={5} width={4} height={14} rx={1.5} />
    </Svg>
  );
}

export function StopIcon({ size = 18, color = '#0B1F2A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={6} y={6} width={12} height={12} rx={2.5} />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke width={2.4} {...props}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Stroke>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <Stroke width={2.2} {...props}>
      <Path d="M4 8h14l-3-3" />
      <Path d="M20 16H6l3 3" />
    </Stroke>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <Path d="M8.5 12l2.5 2.5 4.5-5" />
    </Stroke>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 4l9 16H3l9-16z" />
      <Path d="M12 10v4M12 17h.01" />
    </Stroke>
  );
}

export function StarIcon({ size = 20, color = '#C8F560', filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.4l6-.8L12 3z" />
    </Svg>
  );
}

export function FlameIcon({ size = 18, color = '#FF8A65' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5.3 1.2 1 1.8 1.5 2 0-2.5.3-5 1-7z" />
    </Svg>
  );
}
