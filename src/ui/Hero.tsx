/**
 * La testata delle schermate principali: data o didascalia, titolo grande e,
 * sotto, un blocco colorato con gli angoli molto tondi.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, R } from './theme';

export function PageTitle({ caption, title, right }: { caption: string; title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.caption}>{caption}</Text>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function HeroBlock({
  caption,
  title,
  right,
  children,
  color = C.hero,
  style,
}: {
  caption: string;
  title: string;
  right?: ReactNode;
  children?: ReactNode;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View>
      <PageTitle caption={caption} title={title} right={right} />
      {children ? <View style={[styles.block, { backgroundColor: color }, style]}>{children}</View> : null}
    </View>
  );
}

/** Etichetta scura a pillola. */
export function StickerChip({ children, label }: { children: ReactNode; label?: string; tilt?: number }) {
  return (
    <View style={styles.chip} accessible={!!label} accessibilityLabel={label}>
      {children}
    </View>
  );
}

export const chipText = { fontFamily: F.bold, fontSize: 13, color: C.onStrong } as const;

const styles = StyleSheet.create({
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 20 },
  caption: { fontFamily: F.medium, fontSize: 14, color: C.dim },
  title: { fontFamily: F.displayBold, fontSize: 42, lineHeight: 48, letterSpacing: -1, color: C.text },
  block: { marginTop: 16, marginHorizontal: 16, borderRadius: R.hero, padding: 20, overflow: 'hidden' },
  chip: { height: 36, paddingLeft: 10, paddingRight: 14, borderRadius: 18, backgroundColor: C.strong, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
