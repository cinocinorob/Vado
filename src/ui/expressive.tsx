/** Pezzi della grafica Expressive usati da più schermate. */
import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatCo2, treeTime } from '../core/co2';
import type { PlantState, SpeciesId } from '../core/plant';
import { dayKey } from '../core/scoring';
import { km } from './format';
import { SHAPES, type ShapeId } from './shapes';
import { Sprout } from './Sprout';
import { C, F, R } from './theme';

/**
 * Elenco a gruppo: righe bianche staccate di pochi pixel, angoli grandi solo
 * in cima e in fondo al gruppo.
 */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ gap: 3 }, style]}>
      {items.map((child, i) => (
        <View
          key={child.key ?? i}
          style={[
            styles.groupRow,
            {
              borderTopLeftRadius: i === 0 ? R.row : R.inner,
              borderTopRightRadius: i === 0 ? R.row : R.inner,
              borderBottomLeftRadius: i === items.length - 1 ? R.row : R.inner,
              borderBottomRightRadius: i === items.length - 1 ? R.row : R.inner,
            },
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

/** Pulsante a toni, piccolo, per le azioni accanto ai titoli. */
export function TonalButton({ label, onPress, icon, accessibilityLabel }: { label: string; onPress: () => void; icon?: ReactNode; accessibilityLabel?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.tonal, pressed && { opacity: 0.8 }]}
    >
      {icon}
      <Text style={styles.tonalLabel}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

const WEEK = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const WEEK_SHAPES: ShapeId[] = ['cookie9', 'clover4', 'sunny', 'flower8', 'cookie6', 'hept', 'cookie12'];

/** Gli ultimi sette giorni: una forma diversa per giorno, piena se il giorno ha punti. */
export function WeekStrip({ activeDays, now }: { activeDays: ReadonlySet<string>; now: number }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return { key: dayKey(d.getTime()), label: i === 6 ? 'Oggi' : WEEK[d.getDay()] };
  });
  const count = days.filter((d) => activeDays.has(d.key)).length;
  return (
    <View style={styles.week} accessible accessibilityLabel={`Ultimi 7 giorni: ${count} con punti`}>
      {days.map((day, i) => {
        const done = activeDays.has(day.key);
        const today = i === 6;
        const fill = done ? (today ? C.strong : C.lime) : C.faint;
        return (
          <View key={day.key} style={styles.weekDay}>
            <Svg width={34} height={34} viewBox="0 0 96 96">
              <Path d={SHAPES[WEEK_SHAPES[i]]} fill={fill} />
              {done ? (
                <Path d="M30 50l12 12 24-26" fill="none" stroke={today ? C.onStrong : C.ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </Svg>
            <Text style={[styles.weekLabel, today && styles.weekToday]}>{day.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Scheda verde acqua con la CO₂ evitata, l'equivalenza con l'albero e il germoglio. */
export function Co2Card({ grams, meters, title, plant, onPress }: { grams: number; meters: number; title: string; plant: PlantState & { species?: SpeciesId }; onPress?: () => void }) {
  const body =
    grams > 0
      ? `con ${km(meters)} senza auto. Un albero adulto ci mette ${treeTime(grams)} ad assorbirla.`
      : 'Ogni km a piedi, in bici o con i mezzi evita circa 167 g di CO₂ rispetto all’auto.';
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.co2, pressed && { opacity: 0.9 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.co2Title}>{title}</Text>
        <Text style={styles.co2Value}>{formatCo2(grams)}</Text>
        <Text style={styles.co2Body}>{body}</Text>
      </View>
      <View style={styles.co2Plant}>
        <Sprout size={84} stage={plant.stage} health={plant.health} species={plant.species} label="Il tuo germoglio" crop />
      </View>
    </Pressable>
  );
}

/** Forma piena con un contenuto al centro (iniziali, numeri, icone). */
export function ShapeBadge({ shape, color, size, children }: { shape: ShapeId; color: string; size: number; children?: ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
        <Path d={SHAPES[shape]} fill={color} />
      </Svg>
      {/* Dentro una View: nel browser un disegno non posizionato finirebbe sotto la forma. */}
      <View>{children}</View>
    </View>
  );
}


const styles = StyleSheet.create({
  groupRow: { backgroundColor: C.card, paddingHorizontal: 16, overflow: 'hidden' },
  tonal: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.tonal, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tonalLabel: { fontFamily: F.semi, fontSize: 13, color: C.text },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, paddingHorizontal: 4, marginTop: 8 },
  sectionTitle: { fontFamily: F.bold, fontSize: 17, color: C.text },
  week: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.card, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 6 },
  weekDay: { flex: 1, alignItems: 'center', gap: 6 },
  weekLabel: { fontFamily: F.medium, fontSize: 12, color: C.dim },
  weekToday: { fontFamily: F.bold, color: C.text },
  co2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.mint,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 10,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 10,
  },
  co2Title: { fontFamily: F.semi, fontSize: 13, color: C.onMintDim },
  co2Value: { fontFamily: F.displayBold, fontSize: 34, lineHeight: 40, color: C.onMint, marginTop: 2 },
  co2Body: { fontFamily: F.medium, fontSize: 13.5, lineHeight: 19, color: C.onMintDim, marginTop: 2 },
  co2Plant: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255, 255, 255, 0.7)', alignItems: 'center', justifyContent: 'center' },
});
