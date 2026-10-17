/** Pezzi di interfaccia condivisi tra le schermate. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODES, getMode, type ModeId } from '../core/modes';
import type { LegResult, LegStatus } from '../core/scoring';
import { ROMA } from '../data/metro';
import { distance, duration } from './format';
import { AlertIcon, ModeIcon, ShieldIcon, StarIcon } from './Icons';
import Svg, { Path } from 'react-native-svg';

import { SHAPES } from './shapes';
import { BORDER, C, F, R, card } from './theme';
import { WavyBar } from './Wavy';

/**
 * Contenitore di una schermata.
 * @param bleed il contenuto arriva fino ai bordi e sotto la barra di stato (per le schermate con il blocco lime in cima)
 */
export function Screen({ children, style, bleed = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; bleed?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, bleed ? styles.bleed : { paddingTop: insets.top + 12 }, { paddingBottom: insets.bottom }, style]}>
      {children}
      {/* Striscia fissa dietro l'ora e le icone di sistema: scorrendo, il contenuto non ci passa sotto. */}
      {bleed && <View pointerEvents="none" style={[styles.statusStrip, { height: insets.top }]} />}
    </View>
  );
}

/** Margine laterale del contenuto nelle schermate "bleed". */
export const GUTTER = 20;

/** Scheda bianca, senza bordo, con angoli molto tondi. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Header({ caption, title, left, right }: { caption: string; title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {left}
      <View style={styles.headerText}>
        <Text style={styles.caption}>{caption}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** Pulsante tondo per chiudere una schermata aperta sopra un'altra. */
export function RoundButton({ onPress, label, children }: { onPress: () => void; label: string; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function ProgressBar({ value, max, label, detail, color = C.text, track }: { value: number; max: number; label: string; detail: string; color?: string; track?: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${label}: ${detail}`}>
      <WavyBar ratio={ratio} color={color} track={track} height={18} stroke={6} />
      <View style={styles.barLabels}>
        <Text style={[styles.barLabel, { color }]}>{label}</Text>
        <Text style={[styles.barLabel, { color }]}>{detail}</Text>
      </View>
    </View>
  );
}

const STATUS_TEXT: Record<LegStatus, string> = {
  verificato: 'Verificato',
  dichiarato: 'Dichiarato',
  anomalo: 'Non valido',
};

export function StatusChip({ status }: { status: LegStatus }) {
  const color = status === 'verificato' ? C.teal : status === 'anomalo' ? C.alert : C.dim;
  return (
    <View style={styles.statusChip}>
      {status === 'verificato' ? <ShieldIcon size={14} color={color} /> : null}
      {status === 'anomalo' ? <AlertIcon size={14} color={color} /> : null}
      <Text style={[styles.statusText, { color }]}>{STATUS_TEXT[status]}</Text>
    </View>
  );
}

/** Colore del bollino di ogni mezzo: aiuta a riconoscerlo prima di leggere. */
const MODE_TONE: Record<ModeId, string> = {
  piedi: C.lime,
  bici: '#B9DDF7',
  ebike: '#B9DDF7',
  tpl: C.coral,
  treno: '#FFE07A',
  carsharing: C.coralSoft,
  autoel: C.tonal,
  auto: C.tonal,
};

/** Bollino a biscotto con l'icona del mezzo. */
export function ModeBadge({ mode, size = 40 }: { mode: ModeId; size?: number }) {
  return (
    <View style={[styles.badge, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
        <Path d={SHAPES.cookie9} fill={MODE_TONE[mode]} />
      </Svg>
      {/* Dentro una View: nel browser un disegno non posizionato finirebbe sotto la forma. */}
      <View>
        <ModeIcon mode={mode} size={size * 0.5} color={C.ink} />
      </View>
    </View>
  );
}

/** Etichetta dei punti: inchiostro su lime. */
export function PointsChip({ points, invalid = false }: { points: number; invalid?: boolean }) {
  return (
    <View style={[styles.points, invalid && { backgroundColor: C.coralSoft }]}>
      <Text style={[styles.pointsText, invalid && { color: C.alert }]}>+{points}</Text>
    </View>
  );
}

/** Una riga per tratto: mezzo, distanza, stato e punti. */
/** Il bollino di una linea della metro, con il suo colore ufficiale. */
export function LineBadge({ line, size = 30 }: { line: string; size?: number }) {
  const color = ROMA.data.lines.find((l) => l.id === line)?.color ?? C.teal;
  // Testo scuro sui colori chiari, bianco sugli altri (luminanza percepita).
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  return (
    <View
      style={[styles.lineBadge, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
      accessibilityLabel={`Linea ${line}`}
    >
      <Text style={[styles.lineBadgeText, { fontSize: size * (line.length > 1 ? 0.4 : 0.5), color: light ? C.ink : C.onInk }]}>{line}</Text>
    </View>
  );
}

export function LegRow({ leg, showStatus = false, caption, co2 }: { leg: LegResult; showStatus?: boolean; caption?: string; co2?: string }) {
  const mode = getMode(leg.mode);
  const detail = [distance(leg.meters), duration(leg.seconds), leg.steps != null && leg.mode === 'piedi' ? `${leg.steps} passi` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <ModeBadge mode={leg.mode} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{leg.route ? 'Metro' : mode.short}</Text>
        {leg.route ? <Text style={styles.rowRoute}>{leg.route}</Text> : null}
        <Text style={styles.rowDetail}>{detail}</Text>
        {caption ? <Text style={styles.rowDetail}>{caption}</Text> : null}
        {co2 ? <Text style={styles.rowCo2}>{co2}</Text> : null}
        {showStatus ? <StatusChip status={leg.status} /> : null}
        {showStatus && leg.note ? <Text style={styles.rowDetail}>{leg.note}</Text> : null}
      </View>
      <PointsChip points={leg.points} invalid={leg.status === 'anomalo'} />
    </View>
  );
}

export function BonusRow({ points }: { points: number }) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { width: 40, height: 40, borderRadius: 14, backgroundColor: C.strong }]}>
        <StarIcon size={20} color={C.onStrong} filled />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Bonus casa-lavoro</Text>
        <Text style={styles.rowDetail}>Tragitto abituale completato</Text>
      </View>
      <PointsChip points={points} />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/** Griglia dei mezzi a due colonne, con i punti per chilometro. */
export function ModeGrid({ selected, onSelect }: { selected: ModeId; onSelect: (mode: ModeId) => void }) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Mezzo di trasporto">
      {MODES.map((mode) => {
        const active = mode.id === selected;
        return (
          <Pressable
            key={mode.id}
            onPress={() => onSelect(mode.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${mode.label}, ${mode.ptPerKm} punti per chilometro`}
            style={[styles.tile, active ? styles.tileActive : null]}
          >
            <View style={styles.tileTop}>
              <ModeIcon mode={mode.id} size={26} color={active ? C.ink : C.text} />
              <Text style={[styles.tilePoints, active && { color: C.ink }, mode.ptPerKm === 0 && { color: C.dim }]}>{mode.ptPerKm} pt/km</Text>
            </View>
            <Text style={[styles.tileLabel, active && { fontFamily: F.bold, color: C.ink }]}>{mode.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pulsante principale: pieno, a pillola. "lime" è il pulsante scuro con la scritta lime. */
export function PrimaryButton({ label, onPress, icon, disabled, tone = 'lime' }: { label: string; onPress: () => void; icon?: ReactNode; disabled?: boolean; tone?: 'lime' | 'coral' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: tone === 'lime' ? C.strong : C.coral, opacity: disabled ? 0.55 : 1 },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.primaryLabel, { color: tone === 'lime' ? C.onStrong : C.onCoral }]}>{label}</Text>
    </Pressable>
  );
}

/** Pulsante secondario: superficie a toni. */
export function GhostButton({ label, onPress, icon, style }: { label: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed, style]}
    >
      {icon}
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

/** Interruttore in stile Material 3: binario scuro e pomello lime quando è acceso. */
export function Toggle({ value, onChange, label, disabled = false }: { value: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff, disabled && { opacity: 0.45 }]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

export const text = StyleSheet.create({
  caption: { fontFamily: F.semi, fontSize: 13, color: C.dim },
  body: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.dim },
  h2: { fontFamily: F.bold, fontSize: 18, color: C.text },
  value: { fontFamily: F.displayBold, fontSize: 26, color: C.text },
  small: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 17, color: C.dim },
});

/** Stile dei campi di testo, uguale in tutte le schermate. */
export const input = {
  height: 56,
  borderRadius: 18,
  paddingHorizontal: 16,
  backgroundColor: C.card,
  borderColor: C.outline,
  borderWidth: BORDER,
  fontFamily: F.medium,
  fontSize: 17,
  color: C.text,
} as const;

export const PLACEHOLDER = C.dim;

const styles = StyleSheet.create({
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  bleed: { paddingHorizontal: 0 },
  panel: { ...card, borderRadius: R.card, padding: 16 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 16 },
  headerText: { flex: 1 },
  caption: { fontFamily: F.medium, fontSize: 14, color: C.dim },
  title: { fontFamily: F.displayBold, fontSize: 36, lineHeight: 42, letterSpacing: -0.8, color: C.text },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.tonal, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  pressedSmall: { transform: [{ scale: 0.97 }] },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  barLabel: { fontFamily: F.semi, fontSize: 13 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusText: { fontFamily: F.bold, fontSize: 12.5 },
  badge: { alignItems: 'center', justifyContent: 'center' },
  points: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: C.lime, justifyContent: 'center' },
  pointsText: { fontFamily: F.displayBold, fontSize: 14, color: C.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 7 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: F.semi, fontSize: 15, color: C.text },
  rowRoute: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.text },
  lineBadge: { alignItems: 'center', justifyContent: 'center' },
  lineBadgeText: { fontFamily: F.displayBold },
  rowDetail: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.dim },
  rowCo2: { fontFamily: F.semi, fontSize: 12.5, lineHeight: 17, color: C.teal },
  divider: { height: 1, backgroundColor: C.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48.5%',
    flexGrow: 1,
    height: 84,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: C.card,
    justifyContent: 'space-between',
  },
  tileActive: { backgroundColor: C.lime, borderRadius: 32 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tilePoints: { fontFamily: F.bold, fontSize: 14, color: C.text },
  tileLabel: { fontFamily: F.medium, fontSize: 15, color: C.text },
  toggle: { width: 56, height: 34, borderRadius: 17, padding: 4, justifyContent: 'center', borderWidth: 2 },
  toggleOn: { backgroundColor: C.strong, borderColor: C.strong, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: C.tonal, borderColor: C.outline, alignItems: 'flex-start' },
  knob: { borderRadius: 14 },
  knobOn: { width: 24, height: 24, backgroundColor: C.onStrong },
  knobOff: { width: 16, height: 16, marginLeft: 2, backgroundColor: C.outline },
  primary: {
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: { fontFamily: F.bold, fontSize: 17 },
  ghost: {
    height: 54,
    borderRadius: 27,
    backgroundColor: C.tonal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghostLabel: { fontFamily: F.semi, fontSize: 16, color: C.text },
});
