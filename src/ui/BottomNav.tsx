/** Barra in basso: le sezioni dell'app e il pulsante per iniziare un tragitto. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { HomeIcon, MedalIcon, PlayIcon, TrophyIcon } from './Icons';
import { BORDER, C, F, card, shadow } from './theme';

export type Section = 'oggi' | 'classifica' | 'medaglie';

/** Spazio da lasciare in fondo alle schermate che mostrano la barra. */
export const NAV_SPACE = 126;

export function BottomNav({ current, tripActive }: { current: Section; tripActive: boolean }) {
  const insets = useSafeAreaInsets();

  function go(section: Section) {
    if (section === current) return;
    // "Oggi" è la base: le altre sezioni le stanno sopra e si chiudono tornando.
    if (section === 'oggi') router.dismissTo('/');
    // Da una sezione all'altra si sostituisce, così "indietro" torna sempre a Oggi.
    else if (current === 'oggi') router.push(`/${section}`);
    else router.replace(`/${section}`);
  }

  return (
    <>
      {/* Il contenuto che scorre sfuma nel fondo prima di arrivare sotto la barra. */}
      <View pointerEvents="none" style={[styles.fade, { height: insets.bottom + 16 + 66 + 44 }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`sfumatura-${current}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.bg} stopOpacity={0} />
              <Stop offset="0.5" stopColor={C.bg} stopOpacity={0.9} />
              <Stop offset="1" stopColor={C.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#sfumatura-${current})`} />
        </Svg>
      </View>
      <View style={[styles.nav, { bottom: insets.bottom + 16 }]} accessibilityRole="tablist">
        <View style={styles.pill}>
          <Tab label="Oggi" active={current === 'oggi'} onPress={() => go('oggi')} icon={(color) => <HomeIcon size={22} color={color} />} />
          <Tab label="Classifica" active={current === 'classifica'} onPress={() => go('classifica')} icon={(color) => <TrophyIcon size={22} color={color} />} />
          <Tab label="Medaglie" active={current === 'medaglie'} onPress={() => go('medaglie')} icon={(color) => <MedalIcon size={22} color={color} />} />
        </View>
        <Pressable
          onPress={() => router.push(tripActive ? '/in-corso' : '/nuovo')}
          accessibilityRole="button"
          accessibilityLabel={tripActive ? 'Riapri il tragitto in corso' : 'Inizia un tragitto'}
          style={({ pressed }) => [styles.play, pressed ? [shadow(1), { transform: [{ translateY: 4 }] }] : shadow(5)]}
        >
          <PlayIcon size={26} />
        </Pressable>
      </View>
    </>
  );
}

function Tab({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: (color: string) => React.ReactNode }) {
  const color = active ? C.lime : C.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.tab, active && styles.tabActive]}
    >
      {icon(color)}
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  nav: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { ...card, flex: 1, height: 66, padding: 5, borderRadius: 33, flexDirection: 'row', gap: 4, ...shadow(5) },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 26 },
  tabActive: { backgroundColor: C.ink },
  tabLabel: { fontFamily: F.bold, fontSize: 11.5 },
  play: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: C.coral,
    borderColor: C.ink,
    borderWidth: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
