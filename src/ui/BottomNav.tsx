/** Barra in basso: le sezioni dell'app e il pulsante per iniziare un tragitto. */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeIcon, MedalIcon, PlayIcon, TrophyIcon } from './Icons';
import { C, F } from './theme';

export type Section = 'oggi' | 'classifica' | 'medaglie';

/** Spazio da lasciare in fondo alle schermate che mostrano la barra. */
export const NAV_SPACE = 120;

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
        style={({ pressed }) => [styles.play, { opacity: pressed ? 0.85 : 1 }]}
      >
        <PlayIcon size={26} />
      </Pressable>
    </View>
  );
}

function Tab({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: (color: string) => React.ReactNode }) {
  const color = active ? C.lime : 'rgba(255, 255, 255, 0.8)';
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
  nav: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: {
    flex: 1,
    height: 64,
    padding: 6,
    borderRadius: 32,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 26 },
  tabActive: { backgroundColor: C.limeSoft },
  tabLabel: { fontFamily: F.semi, fontSize: 11.5 },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
});
