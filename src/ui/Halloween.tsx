/** Decorazioni e scheda "Dolcetto o scherzetto" del tema Halloween. Disegni originali. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { C, F, R } from './theme';

/** Luna e pipistrelli, da appoggiare dietro un blocco colorato. */
export function Bats({ width = 150, height = 90, color = C.ink }: { width?: number; height?: number; color?: string }) {
  const bat = 'M0 0c3-3 6-3 8 0c1-2 3-3 5-2c-1 1-1 2 0 3c2-2 5-2 7 0c-3 0-5 2-6 4c-2-2-5-2-7 0c-2-2-5-2-7 0c-1-2-3-4-6-4c2-2 5-2 7 0c1-1 1-2 0-3c2-1 4 0 5 2z';
  return (
    <Svg width={width} height={height} viewBox="0 0 150 90" pointerEvents="none">
      <Circle cx={22} cy={22} r={15} fill="#FFF3C4" opacity={0.9} />
      <Circle cx={30} cy={17} r={13.5} fill={C.hero} />
      <G fill={color} opacity={0.75}>
        <Path d={bat} transform="translate(52 14) scale(0.9)" />
        <Path d={bat} transform="translate(84 34) scale(0.6)" />
      </G>
    </Svg>
  );
}

/** Caramella incartata. */
export function Candy({ size = 40, color = '#FF8A2A' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M8 14l8 6-8 6-4-6zM40 14l-8 6 8 6 4-6z" fill="#B98CFF" transform="translate(0 4)" />
      <Circle cx={24} cy={24} r={11} fill={color} />
      <Path d="M17 20c4 6 10 6 14 0M17 28c4-6 10-6 14 0" stroke="#FFF3C4" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function CandyCard({ count, open, onPress }: { count: number; open: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
      <Candy size={56} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Dolcetto o scherzetto</Text>
        <Text style={styles.value}>
          {count} {count === 1 ? 'caramella' : 'caramelle'}
        </Text>
        <Text style={styles.body}>
          {open ? 'Ogni km senza auto fino al 31 ottobre vale una caramella. Chi ne raccoglie di più nella lega vince.' : 'La raccolta è finita il 31 ottobre.'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.deep,
    borderTopLeftRadius: 10,
    borderTopRightRadius: R.card,
    borderBottomLeftRadius: R.card,
    borderBottomRightRadius: R.card,
    padding: 16,
  },
  title: { fontFamily: F.semi, fontSize: 13, color: '#FFC48A' },
  value: { fontFamily: F.displayBold, fontSize: 28, lineHeight: 34, color: '#FFF3C4' },
  body: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.onInkDim },
});
