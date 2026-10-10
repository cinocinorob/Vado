/**
 * Il blocco lime in cima alle schermate principali: arriva fino ai bordi e
 * sotto la barra di stato, con il bordo a inchiostro e gli angoli tondi in basso.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BORDER, C, F } from './theme';

export function HeroBlock({ caption, title, right, children }: { caption: string; title: string; right?: ReactNode; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.block, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Etichetta scura appoggiata un po' storta, come un adesivo. */
export function StickerChip({ children, label, tilt = 3 }: { children: ReactNode; label?: string; tilt?: number }) {
  return (
    <View style={[styles.chip, { transform: [{ rotate: `${tilt}deg` }] }]} accessible={!!label} accessibilityLabel={label}>
      {children}
    </View>
  );
}

export const chipText = { fontFamily: F.bold, fontSize: 13, color: C.onInk } as const;

const styles = StyleSheet.create({
  block: {
    backgroundColor: C.lime,
    borderBottomWidth: BORDER,
    borderColor: C.ink,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingHorizontal: 20,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  caption: { fontFamily: F.semi, fontSize: 13, color: 'rgba(11, 31, 42, 0.78)' },
  title: { fontFamily: F.displayBold, fontSize: 34, lineHeight: 40, color: C.ink },
  chip: {
    height: 38,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 19,
    backgroundColor: C.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
