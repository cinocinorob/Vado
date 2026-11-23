/**
 * "Segnala un tragitto sbagliato": il mezzo vero, una nota e il registro di
 * quel tragitto, in un testo da condividere. Niente coordinate.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRUTHS, linesFor, reportText, type ReportTruth } from '../core/report';
import type { Trip } from '../core/scoring';
import { diagHeader } from '../diagnostics/header';
import { diag, loadDiag, type DiagLine } from '../diagnostics/log';
import { loadTrips } from '../storage/trips';
import { CloseIcon, ShareIcon } from '../ui/Icons';
import { Header, Panel, PrimaryButton, RoundButton, Screen, input, text, PLACEHOLDER } from '../ui/parts';
import { Chip } from '../ui/social';
import { C, F } from '../ui/theme';

export default function Segnala() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [lines, setLines] = useState<DiagLine[]>([]);
  const [truth, setTruth] = useState<ReportTruth | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    Promise.all([loadTrips(), loadDiag()])
      .then(([all, log]) => {
        setTrip(all.find((t) => t.id === id) ?? null);
        setLines(log);
      })
      .catch(() => setTrip(null));
  }, [id]);

  async function share() {
    if (!trip) return;
    diag(`Segnalazione del tragitto delle ${new Date(trip.startedAt).toTimeString().slice(0, 5)}: mezzo vero ${truth ?? 'non indicato'}`);
    await Share.share({ message: reportText(trip, truth, note, lines, diagHeader()) }).catch(() => undefined);
  }

  const own = trip ? linesFor(lines, trip).length : 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Header
          caption="Aiutaci a correggere l'app"
          title="Tragitto sbagliato"
          right={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} color={C.text} />
            </RoundButton>
          }
        />
        {trip === null ? <Text style={text.body}>Tragitto non trovato.</Text> : null}
        {trip ? (
          <>
            <Text style={text.body}>
              Dicci come ti sei mosso davvero. Il testo che condividi contiene il tragitto come l&apos;ha contato l&apos;app e {own} righe del registro di
              quel periodo: tempi, metri, precisione del segnale. Nessuna posizione.
            </Text>
            <Text style={styles.label}>Come ti sei mosso davvero?</Text>
            <View style={styles.chips}>
              {TRUTHS.map((t) => (
                <Chip key={t.id} label={t.label} active={truth === t.id} onPress={() => setTruth(t.id)} />
              ))}
            </View>
            <Text style={styles.label}>Cosa è andato storto?</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Per esempio: ero sul 64 da Termini a San Pietro, l'ha contato a piedi"
              placeholderTextColor={PLACEHOLDER}
              multiline
              maxLength={400}
              style={[input, styles.note]}
              accessibilityLabel="Cosa è andato storto"
            />
            <Panel style={styles.info}>
              <Text style={[text.small, { lineHeight: 18 }]}>
                Toccando il pulsante scegli tu dove mandarlo (per esempio in chat). Il tragitto e i punti non cambiano.
              </Text>
            </Panel>
          </>
        ) : null}
      </ScrollView>
      {trip ? (
        <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
          <PrimaryButton label="Condividi la segnalazione" icon={<ShareIcon size={20} color={C.ink} />} onPress={share} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, paddingBottom: 120 },
  label: { fontFamily: F.bold, fontSize: 16, color: C.text, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { height: 110, paddingTop: 14, textAlignVertical: 'top' },
  info: { borderRadius: 20, paddingVertical: 12, backgroundColor: C.limeSoft },
  cta: { position: 'absolute', left: 20, right: 20 },
});
