/** Schermata "Nuovo tragitto": scelta del mezzo e avvio. */
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMode, type ModeId } from '../core/modes';
import { COMMUTE_BONUS, TRIP_CAP } from '../core/scoring';
import { startTracking } from '../tracking/tracker';
import { CloseIcon, PlayIcon, ShieldIcon } from '../ui/Icons';
import { Header, ModeGrid, Panel, PrimaryButton, RoundButton, Screen, Toggle, text } from '../ui/parts';
import { C, F } from '../ui/theme';

export default function NuovoTragitto() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ModeId>('piedi');
  const [commute, setCommute] = useState(true);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const bonusPossible = !getMode(mode).privateCar;

  async function start() {
    setStarting(true);
    setProblem(null);
    const result = await startTracking(mode, commute && bonusPossible);
    setStarting(false);
    if (result.ok) router.replace('/in-corso');
    else setProblem(result.message);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Scegli come ti muovi"
          title="Nuovo tragitto"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <ModeGrid selected={mode} onSelect={setMode} />

        <Panel style={styles.commute}>
          <View style={{ flex: 1 }}>
            <Text style={styles.commuteTitle}>Tragitto casa-lavoro</Text>
            <Text style={text.small}>
              {bonusPossible ? `Bonus +${COMMUTE_BONUS}, una volta al giorno` : "Nessun bonus con l'auto privata"}
            </Text>
          </View>
          <Toggle value={commute && bonusPossible} onChange={() => setCommute((v) => !v)} label="Tragitto casa-lavoro" disabled={!bonusPossible} />
        </Panel>

        <Panel style={styles.info}>
          <ShieldIcon size={22} color={C.teal} />
          <Text style={[text.small, { flex: 1, lineHeight: 18 }]}>
            {mode === 'piedi'
              ? 'A piedi i passi contati dal telefono confermano il tragitto.'
              : mode === 'tpl'
                ? 'In metro il GPS non arriva: la distanza viene calcolata sulla rete, dalla stazione dove scendi sottoterra a quella dove risali. Su bus e tram viene misurata.'
                : 'Per questo mezzo vale la tua dichiarazione: controlliamo solo che la velocità sia compatibile.'}{' '}
            Massimo {TRIP_CAP} punti per tragitto. La posizione viene usata solo durante il tragitto, anche a schermo
            spento, per misurare la distanza. Il percorso non viene salvato.
          </Text>
        </Panel>

        {problem ? (
          <Text style={styles.problem} accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
        <PrimaryButton label={starting ? 'Avvio…' : 'Avvia'} icon={<PlayIcon size={22} />} onPress={start} disabled={starting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 116 },
  commute: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, paddingVertical: 12 },
  commuteTitle: { fontFamily: F.bold, fontSize: 15, color: C.text },
  info: { flexDirection: 'row', gap: 12, borderRadius: 20, paddingVertical: 12, backgroundColor: C.limeSoft },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
  cta: { position: 'absolute', left: 20, right: 20 },
});
