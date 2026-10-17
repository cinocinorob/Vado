/**
 * Widget per la schermata Home di Android: anello dei punti di oggi, CO₂
 * evitata e il pulsante Parti. Disegnato con i componenti di
 * react-native-android-widget, non con quelli dell'app.
 */
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { waveArc } from '../ui/shapes';

export type WidgetData = { points: number; goal: number; co2: string; halloween: boolean };

type HexColor = `#${string}`;

function ring(ratio: number, ink: string, track: string, over: string): string {
  const first = Math.min(1, Math.max(0, ratio));
  const extra = Math.min(1, Math.max(0, ratio - 1));
  const arc = (frac: number, color: string) =>
    frac > 0 ? `<path d="${waveArc(110, 90, frac)}" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220"><circle cx="110" cy="110" r="90" fill="none" stroke="${track}" stroke-width="11"/>${arc(first, ink)}${arc(extra, over)}</svg>`;
}

export function OggiWidget({ points, goal, co2, halloween }: WidgetData) {
  const hero: HexColor = halloween ? '#FF8A2A' : '#C8F560';
  const ink: HexColor = '#1A1D14';
  const over = halloween ? '#B98CFF' : '#FF8A65';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hero, borderRadius: 28, padding: 12, flexDirection: 'row', alignItems: 'center' }}
    >
      <FlexWidget style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
        <SvgWidget svg={ring(points / goal, ink, 'rgba(26,29,20,0.14)', over)} style={{ width: 96, height: 96 }} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, marginLeft: 12, flexDirection: 'column', justifyContent: 'center' }}>
        <TextWidget text={`${points}`} style={{ fontSize: 34, fontWeight: '900', color: ink }} />
        <TextWidget text={`di ${goal} punti oggi`} style={{ fontSize: 13, color: ink }} />
        <TextWidget text={`${co2} di CO₂ evitata`} style={{ fontSize: 12, color: ink, marginTop: 2 }} />
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'vado://nuovo' }}
          style={{ marginTop: 8, backgroundColor: ink, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center' }}
        >
          <TextWidget text="▶ Parti" style={{ fontSize: 14, fontWeight: '700', color: hero }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
