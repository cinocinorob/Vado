/** Pezzi di interfaccia condivisi tra le schermate. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MODES, getMode, type ModeId } from '../core/modes';
import type { LegResult, LegStatus } from '../core/scoring';
import { distance, duration } from './format';
import { AlertIcon, ModeIcon, ShieldIcon, StarIcon } from './Icons';
import { C, F } from './theme';

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }, style]}>{children}</View>
  );
}

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

export function ProgressBar({ value, max, label, detail }: { value: number; max: number; label: string; detail: string }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${label}: ${detail}`}>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barLabel}>{detail}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
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
  const color = status === 'verificato' ? C.lime : status === 'anomalo' ? C.coral : C.text;
  return (
    <View style={styles.statusChip}>
      {status === 'verificato' ? <ShieldIcon size={14} color={color} /> : null}
      {status === 'anomalo' ? <AlertIcon size={14} color={color} /> : null}
      <Text style={[styles.statusText, { color }]}>{STATUS_TEXT[status]}</Text>
    </View>
  );
}

/** Una riga per tratto: mezzo, distanza, stato e punti. */
export function LegRow({ leg, showStatus = false, caption }: { leg: LegResult; showStatus?: boolean; caption?: string }) {
  const mode = getMode(leg.mode);
  const detail = [distance(leg.meters), duration(leg.seconds), leg.steps != null && leg.mode === 'piedi' ? `${leg.steps} passi` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <ModeIcon mode={leg.mode} size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{mode.short}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
        {caption ? <Text style={styles.rowDetail}>{caption}</Text> : null}
        {showStatus ? <StatusChip status={leg.status} /> : null}
        {showStatus && leg.note ? <Text style={styles.rowDetail}>{leg.note}</Text> : null}
      </View>
      <Text style={[styles.rowPoints, leg.status === 'anomalo' && { color: C.coral }]}>+{leg.points}</Text>
    </View>
  );
}

export function BonusRow({ points }: { points: number }) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: C.limeSoft }]}>
        <StarIcon size={20} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>Bonus casa-lavoro</Text>
        <Text style={styles.rowDetail}>Tragitto abituale completato</Text>
      </View>
      <Text style={styles.rowPoints}>+{points}</Text>
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
            style={[styles.tile, active && styles.tileActive]}
          >
            <View style={styles.tileTop}>
              <ModeIcon mode={mode.id} size={26} color={active ? C.lime : C.text} />
              <Text style={[styles.tilePoints, mode.ptPerKm === 0 && { color: C.dim }]}>{mode.ptPerKm} pt/km</Text>
            </View>
            <Text style={[styles.tileLabel, active && { fontFamily: F.bold }]}>{mode.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, disabled, tone = 'lime' }: { label: string; onPress: () => void; icon?: ReactNode; disabled?: boolean; tone?: 'lime' | 'coral' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor: tone === 'lime' ? C.lime : C.coral, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {icon}
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon, style }: { label: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {icon}
      <Text style={styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

export const text = StyleSheet.create({
  caption: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  body: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.dim },
  h2: { fontFamily: F.display, fontSize: 18, color: C.text },
  value: { fontFamily: F.display, fontSize: 24, color: C.text },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.dim },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  panel: { backgroundColor: C.panel, borderColor: C.panelBorder, borderWidth: 1, borderRadius: 24, padding: 16 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginBottom: 16 },
  headerText: { flex: 1 },
  caption: { fontFamily: F.medium, fontSize: 13, color: C.dim },
  title: { fontFamily: F.display, fontSize: 34, lineHeight: 40, color: C.text },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  barLabel: { fontFamily: F.medium, fontSize: 12.5, color: 'rgba(255, 255, 255, 0.78)' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: C.faint, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: C.lime },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  statusText: { fontFamily: F.semi, fontSize: 12.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 6 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: F.semi, fontSize: 15, color: C.text },
  rowDetail: { fontFamily: F.body, fontSize: 12.5, color: C.dim },
  rowPoints: { fontFamily: F.display, fontSize: 18, color: C.lime },
  divider: { height: 1, backgroundColor: C.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48.5%',
    flexGrow: 1,
    height: 84,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 2,
    justifyContent: 'space-between',
  },
  tileActive: { backgroundColor: C.limeSoft, borderColor: C.lime },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tilePoints: { fontFamily: F.display, fontSize: 14, color: C.lime },
  tileLabel: { fontFamily: F.semi, fontSize: 15, color: C.text },
  primary: { height: 60, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryLabel: { fontFamily: F.display, fontSize: 20, color: C.ink },
  ghost: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
  },
  ghostLabel: { fontFamily: F.semi, fontSize: 16, color: C.text },
});
