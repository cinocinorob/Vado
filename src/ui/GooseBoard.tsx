/**
 * Tabellone delle sfide, come il gioco dell'oca: un percorso a serpentina di
 * caselle dalla partenza al traguardo, con una pedina per partecipante sulla
 * casella che corrisponde al suo avanzamento. Si vede a colpo d'occhio chi è
 * davanti e di quante caselle.
 */
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';

import type { TreeBadge } from '../core/plant';
import { useEased } from './motion';
import { SHAPES } from './shapes';
import { C, F } from './theme';
import { TreeAvatar } from './TreeAvatar';

export type BoardPlayer = {
  id: string;
  /** Nome già pronto da mostrare ("Tu", "Flavia", "Squadra A"). */
  name: string;
  me: boolean;
  tree?: TreeBadge | null;
  /** Avanzamento da 0 a 1 (1 = traguardo). */
  ratio: number;
  /** Testo accanto al nome: "34 punti", "12,5 km". */
  detail: string;
  /** Per le squadre: lettera al posto dell'albero. */
  badge?: string;
};

const COLS = 5;
const ROWS = 4;
export const SQUARES = COLS * ROWS;
const GAP = 6;
/** Caselle "fortunate", solo per dare ritmo al tabellone. */
const STARS = new Set([4, 9, 13, 17]);
const TINTS = [C.limeSoft, C.mint, C.coralSoft, '#F1EEE4'];

/** Riga e colonna della casella i: si parte in basso a sinistra e si sale a serpentina. */
function cell(i: number): { row: number; col: number } {
  const rowFromBottom = Math.floor(i / COLS);
  const inRow = i % COLS;
  const col = rowFromBottom % 2 === 0 ? inRow : COLS - 1 - inRow;
  return { row: ROWS - 1 - rowFromBottom, col };
}

export function squareOf(ratio: number): number {
  return Math.max(0, Math.min(SQUARES - 1, Math.floor(Math.max(0, Math.min(1, ratio)) * (SQUARES - 1) + 1e-9)));
}

function Flag({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 21V4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M6 4h11l-2.5 3.5L17 11H6z" fill={color} />
    </Svg>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" fill={color} />
    </Svg>
  );
}

function Pawn({ player, size, tile, h, offset }: { player: BoardPlayer; size: number; tile: number; h: number; offset: number }) {
  // La pedina avanza casella dopo casella all'apertura.
  const shown = useEased(squareOf(player.ratio), 1100);
  const square = Math.round(shown);
  const { row, col } = cell(square);
  const x = col * (tile + GAP) + tile / 2 - size / 2 + offset;
  const y = row * (h + GAP) + h / 2 - size / 2 - (player.me ? 4 : 0);
  return (
    <View style={[styles.pawn, { left: x, top: y, width: size, height: size, zIndex: player.me ? 3 : 2 }]} pointerEvents="none">
      <View style={[styles.pawnShadow, { width: size * 0.7, left: size * 0.15, top: size - 4 }]} />
      {player.badge ? (
        <View style={[styles.team, { width: size, height: size, borderRadius: size / 2, backgroundColor: player.me ? C.lime : C.strong }]}>
          <Text style={[styles.teamText, { color: player.me ? C.ink : C.onStrong, fontSize: size * 0.42 }]}>{player.badge}</Text>
        </View>
      ) : (
        <TreeAvatar badge={player.tree} me={player.me} size={size} />
      )}
    </View>
  );
}

export function GooseBoard({ players, finishLabel }: { players: BoardPlayer[]; finishLabel?: string }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const tile = width > 0 ? (width - GAP * (COLS - 1)) / COLS : 0;
  const h = tile * 0.8;
  const height = ROWS * h + (ROWS - 1) * GAP;
  const pawn = Math.max(26, Math.min(40, tile * 0.56));

  // Pedine sulla stessa casella: un po' sfalsate, chi è "tu" davanti.
  const bySquare = new Map<number, BoardPlayer[]>();
  for (const p of [...players].sort((a, b) => Number(a.me) - Number(b.me))) {
    const sq = squareOf(p.ratio);
    bySquare.set(sq, [...(bySquare.get(sq) ?? []), p]);
  }
  const offsetOf = (p: BoardPlayer) => {
    const group = bySquare.get(squareOf(p.ratio)) ?? [];
    const i = group.indexOf(p);
    const spread = Math.min(tile * 0.5, (group.length - 1) * 12);
    return group.length > 1 ? -spread / 2 + (spread * i) / (group.length - 1) : 0;
  };

  const centers = Array.from({ length: SQUARES }, (_, i) => {
    const { row, col } = cell(i);
    return `${col * (tile + GAP) + tile / 2},${row * (h + GAP) + h / 2}`;
  }).join(' ');

  const ranked = [...players].sort((a, b) => b.ratio - a.ratio);
  const summary = ranked.map((p, i) => `${i + 1}º ${p.name}, casella ${squareOf(p.ratio) + 1} di ${SQUARES}`).join('; ');

  return (
    <View>
      <View style={{ height: height || 1 }} onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={`Tabellone: ${summary}`}>
        {width > 0 ? (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              <Polyline points={centers} fill="none" stroke={C.faint} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
            </Svg>
            {Array.from({ length: SQUARES }, (_, i) => {
              const { row, col } = cell(i);
              const start = i === 0;
              const finish = i === SQUARES - 1;
              const bg = start ? C.strong : finish ? C.lime : TINTS[i % TINTS.length];
              return (
                <View
                  key={i}
                  style={[
                    styles.square,
                    {
                      left: col * (tile + GAP),
                      top: row * (h + GAP),
                      width: tile,
                      height: h,
                      backgroundColor: bg,
                      borderRadius: finish || start ? h / 2.4 : 14,
                    },
                  ]}
                >
                  {start ? (
                    <Text style={[styles.label, { color: C.onStrong }]}>Via</Text>
                  ) : finish ? (
                    <Flag size={Math.min(26, h * 0.5)} color={C.ink} />
                  ) : STARS.has(i) ? (
                    <Star size={Math.min(20, h * 0.4)} color="rgba(26, 29, 20, 0.28)" />
                  ) : (
                    <Text style={styles.number}>{i + 1}</Text>
                  )}
                </View>
              );
            })}
            {players.map((p) => (
              <Pawn key={p.id} player={p} size={p.me ? pawn + 6 : pawn} tile={tile} h={h} offset={offsetOf(p)} />
            ))}
          </>
        ) : null}
      </View>
      <View style={styles.legend}>
        {ranked.map((p, i) => (
          <View key={p.id} style={[styles.legendRow, p.me && styles.legendMe]}>
            <Text style={[styles.legendRank, p.me && { color: C.ink }]}>{i + 1}</Text>
            <Text style={[styles.legendName, p.me && { color: C.ink }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[styles.legendDetail, p.me && { color: C.ink }]}>{p.detail}</Text>
            <View style={[styles.legendSquare, p.me && { backgroundColor: 'rgba(26, 29, 20, 0.12)' }]}>
              <Text style={[styles.legendSquareText, p.me && { color: C.ink }]}>
                {squareOf(p.ratio) === SQUARES - 1 ? 'arrivo' : `casella ${squareOf(p.ratio) + 1}`}
              </Text>
            </View>
          </View>
        ))}
        {finishLabel ? <Text style={styles.finish}>Traguardo: {finishLabel}</Text> : null}
      </View>
    </View>
  );
}

/** Piccolo emblema a biscotto, per i titoli delle schede delle sfide. */
export function BoardBadge({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Path d={SHAPES.cookie12} fill={C.lime} />
      <Circle cx={34} cy={60} r={7} fill={C.ink} />
      <Circle cx={48} cy={42} r={7} fill={C.ink} opacity={0.6} />
      <Circle cx={62} cy={60} r={7} fill={C.ink} opacity={0.35} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  square: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: F.bold, fontSize: 12, color: 'rgba(26, 29, 20, 0.45)' },
  label: { fontFamily: F.displayBold, fontSize: 14 },
  pawn: { position: 'absolute' },
  pawnShadow: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: 'rgba(0, 0, 0, 0.22)' },
  team: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  teamText: { fontFamily: F.displayBold },
  legend: { marginTop: 12, gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 14 },
  legendMe: { backgroundColor: C.lime },
  legendRank: { width: 18, fontFamily: F.displayBold, fontSize: 15, color: C.dim, textAlign: 'center' },
  legendName: { flex: 1, fontFamily: F.bold, fontSize: 15, color: C.text },
  legendDetail: { fontFamily: F.semi, fontSize: 13.5, color: C.dim },
  legendSquare: { paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: C.tonal, justifyContent: 'center' },
  legendSquareText: { fontFamily: F.semi, fontSize: 11.5, color: C.text },
  finish: { fontFamily: F.medium, fontSize: 12.5, color: C.dim, textAlign: 'center', marginTop: 6 },
  trackTile: { position: 'absolute', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pace: { position: 'absolute', alignItems: 'center' },
  paceTick: { width: 2, height: 10, borderRadius: 1, backgroundColor: C.dim },
});

const TRACK = 10;

/**
 * Le sfide personali: una fila di caselle con la propria pedina e un segno
 * piccolo dove si dovrebbe essere a questo punto del periodo, per vedere
 * subito se si è avanti o indietro.
 */
export function MiniTrack({ ratio, pace, tree, done }: { ratio: number; pace: number; tree?: TreeBadge | null; done: boolean }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const gap = 4;
  const tile = width > 0 ? (width - gap * (TRACK - 1)) / TRACK : 0;
  const shown = useEased(Math.max(0, Math.min(1, ratio)), 1000);
  const square = Math.min(TRACK - 1, Math.floor(shown * (TRACK - 1) + 1e-9));
  const paceSquare = Math.min(TRACK - 1, Math.floor(Math.max(0, Math.min(1, pace)) * (TRACK - 1) + 1e-9));
  const pawn = Math.max(24, Math.min(34, tile * 1.15));
  return (
    <View style={{ height: pawn + 18 }} onLayout={onLayout}>
      {width > 0 ? (
        <>
          {Array.from({ length: TRACK }, (_, i) => {
            const finish = i === TRACK - 1;
            const passed = i <= square;
            return (
              <View
                key={i}
                style={[
                  styles.trackTile,
                  {
                    left: i * (tile + gap),
                    top: pawn / 2,
                    width: tile,
                    height: 16,
                    backgroundColor: finish ? C.lime : passed ? (done ? C.teal : C.coral) : C.faint,
                  },
                ]}
              >
                {finish ? <Flag size={12} color={C.ink} /> : null}
              </View>
            );
          })}
          {!done && pace > 0 && pace < 1 ? (
            <View style={[styles.pace, { left: paceSquare * (tile + gap) + tile / 2 - 1, top: pawn / 2 + 18 }]}>
              <View style={styles.paceTick} />
            </View>
          ) : null}
          <View style={[styles.pawn, { left: square * (tile + gap) + tile / 2 - pawn / 2, top: pawn / 2 + 8 - pawn, width: pawn, height: pawn }]} pointerEvents="none">
            <TreeAvatar badge={tree} me size={pawn} />
          </View>
        </>
      ) : null}
    </View>
  );
}
