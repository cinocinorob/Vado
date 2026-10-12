/** L'avatar della classifica (l'albero scelto, a che punto è) e la scelta dell'albero. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SPECIES, type SpeciesId, type TreeBadge } from '../core/plant';
import { ShapeBadge } from './expressive';
import { Sprout, Tree } from './Sprout';
import { C, F } from './theme';

/**
 * Chi ha già fatto crescere almeno un albero appare con l'albero completo e il
 * numero di alberi; gli altri con la pianta di adesso. Senza dati (server non
 * aggiornato, albero non scelto) si vede un seme.
 */
export function TreeAvatar({ badge, me = false, size = 40 }: { badge?: TreeBadge | null; me?: boolean; size?: number }) {
  const grown = !!badge && badge.trees > 0;
  return (
    <View style={{ width: size, height: size }}>
      <ShapeBadge shape="cookie12" color={me ? C.lime : C.mint} size={size}>
        <Sprout size={size * 0.9} stage={badge?.stage ?? 'seme'} species={badge?.species} grown={grown} />
      </ShapeBadge>
      {grown ? (
        <View style={[styles.count, { minWidth: size * 0.42, height: size * 0.42, borderRadius: size * 0.21 }]}>
          <Text style={[styles.countText, { fontSize: Math.max(10, size * 0.24) }]}>{badge.trees}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Cinque alberi di Roma tra cui scegliere. */
export function TreePicker({ value, onChange }: { value: SpeciesId | null; onChange: (species: SpeciesId) => void }) {
  return (
    <View style={styles.picker} accessibilityRole="radiogroup" accessibilityLabel="Il tuo albero">
      {SPECIES.map((s) => {
        const active = s.id === value;
        return (
          <Pressable
            key={s.id}
            onPress={() => onChange(s.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.name}
            style={[styles.option, active && styles.optionOn]}
          >
            <Tree species={s.id} size={50} />
            <Text style={[styles.optionText, active && styles.optionTextOn]} numberOfLines={1}>
              {s.id === 'pino' ? 'Pino' : s.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  count: { position: 'absolute', right: -2, bottom: -2, paddingHorizontal: 3, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: F.displayBold, color: C.lime, includeFontPadding: false },
  picker: { flexDirection: 'row', gap: 4 },
  option: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderRadius: 20, backgroundColor: C.tonal },
  optionOn: { backgroundColor: C.lime },
  optionText: { fontFamily: F.medium, fontSize: 11.5, color: C.dim },
  optionTextOn: { fontFamily: F.bold, color: C.ink },
});
