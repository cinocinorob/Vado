/** Barra di navigazione in basso (Material 3) e il pulsante per iniziare un tragitto. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeIcon, MedalIcon, PlayIcon, TrophyIcon } from './Icons';
import { C, F } from './theme';

export type Section = 'oggi' | 'classifica' | 'medaglie';

const BAR = 80;
const FAB = 64;

/** Spazio da lasciare in fondo alle schermate che mostrano la barra e il pulsante. */
export const NAV_SPACE = BAR + FAB + 40;

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
      <Pressable
        onPress={() => router.push(tripActive ? '/in-corso' : '/nuovo')}
        accessibilityRole="button"
        accessibilityLabel={tripActive ? 'Riapri il tragitto in corso' : 'Inizia un tragitto'}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + BAR + 16 }, tripActive && styles.fabActive, pressed && styles.pressed]}
      >
        <PlayIcon size={24} color={tripActive ? C.lime : C.onCoral} />
        <Text style={[styles.fabLabel, tripActive && { color: C.lime }]}>{tripActive ? 'In corso' : 'Parti'}</Text>
      </Pressable>
      <View style={[styles.bar, { height: BAR + insets.bottom, paddingBottom: insets.bottom }]} accessibilityRole="tablist">
        <Tab label="Oggi" active={current === 'oggi'} onPress={() => go('oggi')} icon={(color) => <HomeIcon size={22} color={color} />} />
        <Tab label="Classifica" active={current === 'classifica'} onPress={() => go('classifica')} icon={(color) => <TrophyIcon size={22} color={color} />} />
        <Tab label="Medaglie" active={current === 'medaglie'} onPress={() => go('medaglie')} icon={(color) => <MedalIcon size={22} color={color} />} />
      </View>
    </>
  );
}

function Tab({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: (color: string) => React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} style={styles.tab}>
      <View style={[styles.indicator, active && styles.indicatorOn]}>{icon(active ? C.ink : C.text)}</View>
      <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.navBg, flexDirection: 'row', paddingTop: 12 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  indicator: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  indicatorOn: { backgroundColor: C.lime },
  tabLabel: { fontFamily: F.medium, fontSize: 12, color: C.dim },
  tabLabelOn: { fontFamily: F.bold, color: C.text },
  fab: {
    position: 'absolute',
    right: 16,
    height: FAB,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 22,
    backgroundColor: C.coral,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 4,
    boxShadow: '0px 6px 16px 0px rgba(58, 19, 6, 0.22)',
    zIndex: 2,
  },
  fabActive: { backgroundColor: C.deep },
  fabLabel: { fontFamily: F.bold, fontSize: 16, color: C.onCoral },
  pressed: { transform: [{ scale: 0.96 }] },
});
