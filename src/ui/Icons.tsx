/** Icone disegnate a tratto, le stesse del mockup. */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { ModeId } from '../core/modes';
import { C } from './theme';

type IconProps = { size?: number; color?: string };

function Stroke({ size = 24, color = C.text, width = 2.2, children }: IconProps & { width?: number; children: React.ReactNode }) {
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

export function PlayIcon({ size = 24, color = C.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5l11 7-11 7V5z" />
    </Svg>
  );
}

export function PauseIcon({ size = 18, color = C.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x={6} y={5} width={4} height={14} rx={1.5} />
      <Rect x={14} y={5} width={4} height={14} rx={1.5} />
    </Svg>
  );
}

export function StopIcon({ size = 18, color = C.text }: IconProps) {
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
      <Path d="M12 2.5c1.2 3.2 5.5 5.4 5.5 10.4a5.5 5.5 0 0 1-11 0c0-2.1.8-3.6 2.2-5 .3 1.6 1.2 2.5 2 2.8 0-3.2.4-5.8 1.3-8.2z" />
      <Path d="M12 11.5c.6 1.6 2.6 2.7 2.6 5.1a2.6 2.6 0 0 1-5.2 0c0-1.3.6-2.2 1.4-2.9.2.7.6 1.1 1 1.3 0-1.4 0-2.4.2-3.5z" fill="#FFD23F" />
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8z" />
    </Stroke>
  );
}

export function MedalIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx={12} cy={15} r={5} />
      <Path d="M8.5 3l2.2 7.2M15.5 3l-2.2 7.2" />
      <Path d="M7 3h10" />
    </Stroke>
  );
}

/** Sentiero con partenza e arrivo. */
export function RouteIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx={6} cy={19} r={2} />
      <Path d="M8 19h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
      <Path d="M18 2.5v5l3-2.5z" />
    </Stroke>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      <Path d="M7.5 12.5h2.5l1.5-2.5 2 4.5 1.2-2h1.8" />
    </Stroke>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Stroke width={2.2} {...props}>
      <Path d="M9 6l6 6-6 6" />
    </Stroke>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <Path d="M8 6H5a3 3 0 0 0 3 4" />
      <Path d="M16 6h3a3 3 0 0 1-3 4" />
      <Path d="M12 13v4" />
      <Path d="M8 20h8" />
    </Stroke>
  );
}

/** Freccia di tendenza: su, giù o stabile. */
export function TrendIcon({ trend, size = 16 }: { trend: 'su' | 'giu' | 'stabile'; size?: number }) {
  if (trend === 'stabile') {
    return (
      <Stroke size={size} color="rgba(26, 29, 20, 0.45)" width={2.6}>
        <Path d="M6 12h12" />
      </Stroke>
    );
  }
  return (
    <Stroke size={size} color={trend === 'su' ? '#1E7A41' : '#B83A17'} width={2.8}>
      <Path d={trend === 'su' ? 'M12 19V6M6.5 11.5L12 6l5.5 5.5' : 'M12 5v13M6.5 12.5L12 18l5.5-5.5'} />
    </Stroke>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Stroke width={2.4} {...props}>
      <Path d="M12 5v14M5 12h14" />
    </Stroke>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 15V4" />
      <Path d="M8 8l4-4 4 4" />
      <Path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </Stroke>
  );
}

export function CrownIcon({ size = 30, color = '#FFD35C' }: IconProps) {
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 34 27" fill={color} stroke="#1A1D14" strokeWidth={2.6} strokeLinejoin="round">
      <Path d="M5 24L3 9l8 6 6-11 6 11 8-6-2 15z" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Stroke width={2.6} {...props}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Stroke>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M5 7h14" />
      <Path d="M9 7V4.5h6V7" />
      <Path d="M7 7l1 13h8l1-13" />
    </Stroke>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Stroke width={2} {...props}>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      <Circle cx={12} cy={12} r={6.5} />
    </Stroke>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Stroke width={2.2} {...props}>
      <Path d="M5 20V11M12 20V5M19 20v-6" />
    </Stroke>
  );
}
