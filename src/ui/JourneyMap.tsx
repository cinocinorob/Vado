/**
 * La mappa di un percorso virtuale: una strada che serpeggia tra colline e
 * alberi, le tappe come segnaposti e le pedine di chi lo sta facendo, come
 * le sfide "Insieme" di Samsung Health. Il tratto già fatto da te è colorato.
 */
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Polyline, Rect, Stop } from 'react-native-svg';

import type { Stage } from '../core/journeys';
import type { TreeBadge } from '../core/plant';
import { useEased } from './motion';
import { C, F } from './theme';
import { TreeAvatar } from './TreeAvatar';

export type MapTraveller = { id: string; name: string; me: boolean; tree?: TreeBadge | null; km: number };

type Pt = { x: number; y: number };

const ROW_H = 96;
const PAD_X = 58;
const PAD_Y = 44;

/** La strada: righe orizzontali alternate unite da curve, campionata in punti. */
function road(width: number, rows: number): Pt[] {
  const pts: Pt[] = [];
  const left = PAD_X;
  const right = width - PAD_X;
  const r = ROW_H / 2;
  for (let row = 0; row < rows; row++) {
    const y = PAD_Y + row * ROW_H;
    const ltr = row % 2 === 0;
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      // Una leggera ondulazione rende la strada meno rigida.
      const x = ltr ? left + (right - left) * k : right - (right - left) * k;
      pts.push({ x, y: y + Math.sin(k * Math.PI * 2) * 6 * (ltr ? 1 : -1) });
    }
    if (row < rows - 1) {
      // Curva a mezzo cerchio verso la riga successiva.
      const cx = ltr ? right : left;
      for (let i = 1; i < 16; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 16;
        pts.push({ x: cx + (ltr ? 1 : -1) * Math.cos(a) * r * 0.9, y: y + r + Math.sin(a) * r });
      }
    }
  }
  return pts;
}

function cumulative(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return out;
}

/** Il punto della strada a una frazione della sua lunghezza. */
function at(pts: Pt[], cum: number[], frac: number): Pt {
  const total = cum[cum.length - 1];
  const target = Math.max(0, Math.min(1, frac)) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (target - cum[i - 1]) / seg;
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
}

/** I punti della strada fino a una frazione, per colorare il tratto fatto. */
function upTo(pts: Pt[], cum: number[], frac: number): Pt[] {
  const total = cum[cum.length - 1];
  const target = Math.max(0, Math.min(1, frac)) * total;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length && cum[i] <= target; i++) out.push(pts[i]);
  out.push(at(pts, cum, frac));
  return out;
}

const str = (pts: Pt[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

function Scenery({ width, height, seed }: { width: number; height: number; seed: number }) {
  // Alberelli e cespugli in posizioni fisse (dipendono solo dal percorso), nei margini delle curve.
  const items: { x: number; y: number; s: number; kind: number }[] = [];
  let r = seed;
  const rand = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  for (let i = 0; i < Math.round(height / 40); i++) {
    const row = Math.floor(rand() * Math.max(1, Math.round((height - PAD_Y) / ROW_H)));
    const y = PAD_Y + row * ROW_H + ROW_H / 2 + (rand() - 0.5) * 14;
    const x = PAD_X + 30 + rand() * (width - 2 * PAD_X - 60);
    items.push({ x, y, s: 0.7 + rand() * 0.6, kind: Math.floor(rand() * 3) });
  }
  return (
    <G>
      {items.map((t, i) =>
        t.kind === 0 ? (
          <G key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
            <Rect x={-1.5} y={2} width={3} height={7} rx={1} fill="#8B6B4A" opacity={0.6} />
            <Circle cx={0} cy={0} r={7} fill={C.mint} opacity={0.75} />
          </G>
        ) : t.kind === 1 ? (
          <G key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
            <Path d="M0 -10L7 6H-7Z" fill={C.teal} opacity={0.55} />
          </G>
        ) : (
          <Ellipse key={i} cx={t.x} cy={t.y + 4} rx={10 * t.s} ry={4 * t.s} fill={C.limeSoft} opacity={0.35} />
        ),
      )}
    </G>
  );
}

function Pawn({ p, pos, size, z }: { p: MapTraveller; pos: Pt; size: number; z: number }) {
  return (
    <View pointerEvents="none" style={[styles.pawn, { left: pos.x - size / 2, top: pos.y - size + 4, width: size, zIndex: z }]}>
      <View style={[styles.pawnRing, { width: size, height: size, borderRadius: size / 2, borderColor: p.me ? C.lime : '#FFFFFF' }]}>
        <TreeAvatar badge={p.tree} me={p.me} size={size - 6} />
      </View>
      <View style={[styles.pin, { borderTopColor: p.me ? C.lime : '#FFFFFF' }]} />
      <View style={[styles.tag, p.me && { backgroundColor: C.lime }]}>
        <Text style={[styles.tagText, p.me && { color: C.ink }]} numberOfLines={1}>
          {p.name}
        </Text>
      </View>
    </View>
  );
}

export function JourneyMap({
  stages,
  total,
  travellers,
  seed = 7,
}: {
  stages: readonly Stage[];
  total: number;
  travellers: MapTraveller[];
  seed?: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const rows = stages.length <= 7 ? 3 : 4;
  const height = PAD_Y * 2 + (rows - 1) * ROW_H + 8;
  const me = travellers.find((t) => t.me);
  const mine = useEased(me ? Math.min(1, me.km / total) : 0, 1400);

  if (width === 0) return <View style={{ height }} onLayout={onLayout} />;

  const pts = road(width, rows);
  const cum = cumulative(pts);
  const done = upTo(pts, cum, mine);
  const reachedKm = me?.km ?? 0;

  // Chi è più avanti sta sotto, "tu" sopra a tutti.
  const order = [...travellers].sort((a, b) => Number(a.me) - Number(b.me) || a.km - b.km);

  return (
    <View style={{ height }} onLayout={onLayout}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.mint} stopOpacity={0.14} />
            <Stop offset="1" stopColor={C.lime} stopOpacity={0.06} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} rx={28} fill="url(#ground)" />
        <Scenery width={width} height={height} seed={seed} />
        {/* La strada: bordo, asfalto, linea di mezzeria. */}
        <Polyline points={str(pts)} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={str(pts)} fill="none" stroke={C.tonal} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={str(pts)} fill="none" stroke={C.faint} strokeWidth={2} strokeDasharray="6 8" strokeLinecap="round" />
        {/* Il tratto fatto. */}
        {done.length > 1 ? (
          <Polyline points={str(done)} fill="none" stroke={C.lime} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {/* Le tappe. */}
        {stages.map((s, i) => {
          const p = at(pts, cum, s.km / total);
          const reached = reachedKm >= s.km - 1e-9;
          const last = i === stages.length - 1;
          return (
            <G key={s.name}>
              <Circle cx={p.x} cy={p.y} r={last ? 13 : 10} fill={reached ? C.lime : C.card} stroke={reached ? C.ink : C.outline} strokeWidth={2.5} />
              {last ? (
                <Path d={`M${p.x - 3} ${p.y + 6}V${p.y - 7}h8l-2 3 2 3h-8`} fill={C.ink} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
              ) : (
                <Circle cx={p.x} cy={p.y} r={3.5} fill={reached ? C.ink : C.outline} />
              )}
            </G>
          );
        })}
      </Svg>
      {/* Nomi delle tappe, sotto il segnaposto. */}
      {stages.map((s, i) => {
        const p = at(pts, cum, s.km / total);
        const reached = reachedKm >= s.km - 1e-9;
        return (
          <Text
            key={s.name}
            numberOfLines={1}
            style={[
              styles.stage,
              { left: Math.max(2, Math.min(width - 92, p.x - 45)), top: p.y + 14 },
              reached && { color: C.text, fontFamily: F.bold },
              i === 0 && { textAlign: 'left' },
            ]}
          >
            {s.name}
          </Text>
        );
      })}
      {order.map((t, i) => (
        <Pawn key={t.id} p={t} pos={at(pts, cum, t.me ? mine : Math.min(1, t.km / total))} size={t.me ? 42 : 34} z={10 + i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { position: 'absolute', width: 90, fontFamily: F.medium, fontSize: 11, color: C.dim, textAlign: 'center' },
  pawn: { position: 'absolute', alignItems: 'center' },
  pawnRing: { borderWidth: 3, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pin: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  tag: { position: 'absolute', top: -18, paddingHorizontal: 6, height: 16, borderRadius: 8, backgroundColor: C.strong, maxWidth: 80, justifyContent: 'center' },
  tagText: { fontFamily: F.bold, fontSize: 10, color: C.onStrong },
});
