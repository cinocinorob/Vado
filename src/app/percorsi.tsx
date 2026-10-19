/**
 * Schermata "Percorsi": viaggi virtuali che avanzano con i km fatti senza auto.
 * Ogni tappa raggiunta sblocca una cartolina.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JOURNEYS, journeyById, journeyLength, journeyRun, type Journey } from '../core/journeys';
import type { Trip } from '../core/scoring';
import { loadJourneys, NO_JOURNEY, saveJourneys, settleJourney, type JourneyState } from '../storage/journey';
import { loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { Group, SectionTitle } from '../ui/expressive';
import { dateLabel } from '../ui/format';
import { HeroBlock } from '../ui/Hero';
import { buzz } from '../ui/motion';
import { PrimaryButton, Screen, text } from '../ui/parts';
import { C, F, R } from '../ui/theme';
import { WavyBar } from '../ui/Wavy';

const clock = () => Date.now();

function kmText(n: number): string {
  const v = n < 100 ? Math.floor(n * 10) / 10 : Math.floor(n);
  return `${String(v).replace('.', ',')} km`;
}

export default function Percorsi() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [state, setState] = useState<JourneyState>(NO_JOURNEY);
  const [ready, setReady] = useState(false);
  const active = useActiveTrip();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      loadTrips().then(async (t) => {
        const { state: s } = await settleJourney(t);
        if (!alive) return;
        setTrips(t);
        setState(s);
        setReady(true);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const current = state.current ? journeyById(state.current.id) : null;
  const run = current && state.current ? journeyRun(current, trips, state.current.startedAt) : null;

  async function start(journey: Journey) {
    const go = async () => {
      buzz('fatto');
      const next: JourneyState = { ...(await loadJourneys()), current: { id: journey.id, startedAt: clock() } };
      await saveJourneys(next);
      setState(next);
    };
    if (run && run.km > 0) {
      Alert.alert('Cambiare percorso?', `Lasci ${current?.name} a ${kmText(run.km)}: se lo riprendi, riparte da capo.`, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Cambia', onPress: go },
      ]);
    } else await go();
  }

  const others = JOURNEYS.filter((j) => j.id !== current?.id);

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock caption="Viaggi con i km senza auto" title="Percorsi" color={C.mint}>
          {current && run ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.heroName} accessibilityRole="header">
                {current.name}
              </Text>
              <Text style={styles.heroSub}>{current.subtitle}</Text>
              <Text style={styles.heroKm}>
                {kmText(run.km)} <Text style={styles.heroOf}>di {kmText(journeyLength(current))}</Text>
              </Text>
              <WavyBar ratio={run.km / journeyLength(current)} color={C.onMint} track="rgba(4, 36, 29, 0.16)" height={18} stroke={6} />
              <Text style={styles.heroSub}>
                {run.next ? `Prossima tappa: ${run.next.name}, tra ${kmText(run.next.km - run.km)}` : 'Arrivato!'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={styles.heroName}>Scegli un viaggio</Text>
              <Text style={styles.heroSub}>
                Ogni km a piedi, in bici o con i mezzi ti porta avanti sulla mappa. A ogni tappa si apre una cartolina.
              </Text>
            </View>
          )}
        </HeroBlock>

        <View style={styles.body}>
          {current && run ? (
            <>
              <SectionTitle title={`Tappe: ${run.reached} di ${current.stages.length}`} />
              <View style={styles.path}>
                {current.stages.map((stage, i) => {
                  const reached = i < run.reached;
                  const last = i === current.stages.length - 1;
                  return (
                    <View key={stage.name} style={styles.stage} accessible accessibilityLabel={`${stage.name}, chilometro ${stage.km}${reached ? `. ${stage.card}` : ', ancora da raggiungere'}`}>
                      <View style={styles.rail}>
                        <View style={[styles.dot, reached ? styles.dotOn : null, i === run.reached ? styles.dotNext : null]} />
                        {!last ? <View style={[styles.line, i + 1 < run.reached ? styles.lineOn : null]} /> : null}
                      </View>
                      <View style={styles.stageText}>
                        <View style={styles.stageHead}>
                          <Text style={[styles.stageName, !reached && { color: C.dim }]}>{stage.name}</Text>
                          <Text style={text.small}>km {stage.km}</Text>
                        </View>
                        {reached ? (
                          <View style={styles.card}>
                            <Text style={styles.cardText}>{stage.card}</Text>
                          </View>
                        ) : (
                          <Text style={text.small}>Cartolina chiusa</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {ready ? (
            <>
              <SectionTitle title={current ? 'Altri viaggi' : 'Viaggi'} />
              <Group>
                {others.map((j) => {
                  const times = state.done.filter((d) => d.id === j.id).length;
                  return (
                    <View key={j.id} style={styles.option}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.optionName}>{j.name}</Text>
                        <Text style={text.small}>
                          {j.subtitle} · {kmText(journeyLength(j))}
                          {times > 0 ? ` · fatto ${times === 1 ? 'una volta' : `${times} volte`}` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => start(j)} accessibilityRole="button" accessibilityLabel={`Parti per ${j.name}`} style={({ pressed }) => [styles.go, pressed && { opacity: 0.8 }]}>
                        <Text style={styles.goText}>Parti</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Group>
            </>
          ) : null}

          {state.done.length > 0 ? (
            <>
              <SectionTitle title="Viaggi completati" />
              <Group>
                {[...state.done]
                  .sort((a, b) => b.doneAt - a.doneAt)
                  .map((d) => (
                    <View key={`${d.id}${d.doneAt}`} style={styles.option}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.optionName}>{journeyById(d.id)?.name ?? d.id}</Text>
                        <Text style={text.small}>Arrivato {dateLabel(d.doneAt).toLowerCase()}</Text>
                      </View>
                    </View>
                  ))}
              </Group>
            </>
          ) : null}

          {!current && ready ? <PrimaryButton label={`Parti per ${JOURNEYS[0].name}`} onPress={() => start(JOURNEYS[0])} /> : null}

          <Text style={[text.small, styles.rule]}>
            Contano i km validi fatti senza auto dal giorno in cui parti, gli stessi della CO₂ evitata. Le distanze sono indicative.
          </Text>
        </View>
      </ScrollView>

      <BottomNav current="percorsi" tripActive={!!active} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  heroName: { fontFamily: F.displayBold, fontSize: 28, lineHeight: 33, color: C.onMint },
  heroSub: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.onMintDim },
  heroKm: { fontFamily: F.displayBold, fontSize: 36, lineHeight: 42, color: C.onMint, marginTop: 6 },
  heroOf: { fontFamily: F.semi, fontSize: 16, color: C.onMintDim },
  path: { backgroundColor: C.card, borderRadius: R.card, paddingVertical: 14, paddingHorizontal: 14 },
  stage: { flexDirection: 'row', gap: 12 },
  rail: { width: 18, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: C.faint, backgroundColor: C.card, marginTop: 2 },
  dotOn: { backgroundColor: C.teal, borderColor: C.teal },
  dotNext: { borderColor: C.teal },
  line: { flex: 1, width: 3, backgroundColor: C.faint, marginVertical: 2, borderRadius: 2 },
  lineOn: { backgroundColor: C.teal },
  stageText: { flex: 1, paddingBottom: 16, gap: 4 },
  stageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stageName: { fontFamily: F.bold, fontSize: 16, color: C.text },
  card: { backgroundColor: C.tonal, borderRadius: 16, padding: 12 },
  cardText: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.text },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  optionName: { fontFamily: F.bold, fontSize: 15, color: C.text },
  go: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.lime, justifyContent: 'center' },
  goText: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  rule: { textAlign: 'center', paddingHorizontal: 12, lineHeight: 18, marginTop: 6 },
});
