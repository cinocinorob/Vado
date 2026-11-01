/**
 * Schermata "Percorsi": viaggi virtuali che avanzano con i km fatti senza auto.
 * La mappa mostra anche i compagni di lega sullo stesso percorso, come le
 * sfide "Insieme" di Samsung Health; ogni tappa raggiunta apre una cartolina.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { JOURNEYS, journeyById, journeyLength, journeyRun, type Journey } from '../core/journeys';
import type { Trip } from '../core/scoring';
import { social, type Traveller } from '../social';
import { loadJourneys, NO_JOURNEY, saveJourneys, settleJourney, type JourneyState } from '../storage/journey';
import { loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { SectionTitle } from '../ui/expressive';
import { dateLabel } from '../ui/format';
import { PageTitle } from '../ui/Hero';
import { JourneyMap, type MapTraveller } from '../ui/JourneyMap';
import { buzz } from '../ui/motion';
import { PrimaryButton, Screen, text } from '../ui/parts';
import { C, F, R } from '../ui/theme';
import { TreeAvatar } from '../ui/TreeAvatar';
import { usePlant } from '../ui/usePlant';
import { WavyBar } from '../ui/Wavy';

const clock = () => Date.now();

function kmText(n: number): string {
  const v = n < 100 ? Math.floor(n * 10) / 10 : Math.floor(n);
  return `${String(v).replace('.', ',')} km`;
}

/** Un colore per ogni viaggio, per riconoscerli a colpo d'occhio. */
const TINT: Record<string, string> = { colli: C.limeSoft, tevere: C.mint, appia: C.coralSoft, francigena: '#F3E3B5' };

export default function Percorsi() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [state, setState] = useState<JourneyState>(NO_JOURNEY);
  const [ready, setReady] = useState(false);
  const [friends, setFriends] = useState<Traveller[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const active = useActiveTrip();
  const plant = usePlant(trips, now);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setNow(Date.now());
      loadTrips().then(async (t) => {
        const { state: s } = await settleJourney(t);
        if (!alive) return;
        setTrips(t);
        setState(s);
        setReady(true);
        // I compagni arrivano dopo, se c'è rete e un profilo in classifica.
        const people = (await social.profile().catch(() => null)) ? await social.travellers(clock()).catch(() => null) : null;
        if (alive) setFriends(people);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const current = state.current ? journeyById(state.current.id) : null;
  const run = current && state.current ? journeyRun(current, trips, state.current.startedAt) : null;
  const myTree = { species: plant.species, stage: plant.stage, trees: plant.trees };

  async function start(journey: Journey) {
    const go = async () => {
      buzz('fatto');
      const next: JourneyState = { ...(await loadJourneys()), current: { id: journey.id, startedAt: clock() } };
      await saveJourneys(next);
      setState(next);
      social.sync(clock()).catch(() => undefined);
    };
    if (run && run.km > 0) {
      Alert.alert('Cambiare percorso?', `Lasci ${current?.name} a ${kmText(run.km)}: se lo riprendi, riparte da capo.`, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Cambia', onPress: go },
      ]);
    } else await go();
  }

  const sameRoad = current ? (friends ?? []).filter((f) => f.journey === current.id) : [];
  const elsewhere = (friends ?? []).filter((f) => f.journey !== current?.id && journeyById(f.journey));
  const travellers: MapTraveller[] = current && run ? [{ id: 'me', name: 'Tu', me: true, tree: myTree, km: run.km }, ...sameRoad.map((f) => ({ id: f.id, name: f.name, me: false, tree: f.tree, km: f.km }))] : [];
  const ranking = [...travellers].sort((a, b) => b.km - a.km);
  const others = JOURNEYS.filter((j) => j.id !== current?.id);
  const total = current ? journeyLength(current) : 1;

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <PageTitle caption="Viaggi con i km senza auto" title="Percorsi" />

        <View style={styles.body}>
          {current && run ? (
            <>
              <View style={[styles.hero, { backgroundColor: TINT[current.id] ?? C.mint }]}>
                <Text style={styles.heroName} accessibilityRole="header">
                  {current.name}
                </Text>
                <Text style={styles.heroSub}>{current.subtitle}</Text>
                <View style={styles.heroRow}>
                  <Text style={styles.heroKm}>{kmText(run.km)}</Text>
                  <Text style={styles.heroOf}>di {kmText(total)}</Text>
                </View>
                <WavyBar ratio={run.km / total} color={C.ink} track="rgba(26, 29, 20, 0.14)" height={18} stroke={6} />
                <View style={styles.nextChip}>
                  <Text style={styles.nextText}>{run.next ? `Prossima tappa: ${run.next.name}, tra ${kmText(run.next.km - run.km)}` : 'Arrivato!'}</Text>
                </View>
              </View>

              <View style={styles.mapCard}>
                <JourneyMap stages={current.stages} total={total} travellers={travellers} seed={current.id.length * 17} />
              </View>

              <SectionTitle title={sameRoad.length > 0 ? 'In viaggio con te' : 'Insieme'} />
              {sameRoad.length > 0 ? (
                <View style={styles.together}>
                  {ranking.map((t, i) => (
                    <View key={t.id} style={[styles.racer, t.me && styles.racerMe]} accessible accessibilityLabel={`${i + 1}º: ${t.name}, ${kmText(t.km)}`}>
                      <Text style={[styles.racerRank, t.me && { color: C.ink }]}>{i + 1}</Text>
                      <TreeAvatar badge={t.tree} me={t.me} size={38} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.racerHead}>
                          <Text style={[styles.racerName, t.me && { color: C.ink }]} numberOfLines={1}>
                            {t.name}
                          </Text>
                          <Text style={[styles.racerKm, t.me && { color: C.ink }]}>{kmText(t.km)}</Text>
                        </View>
                        <View style={[styles.racerTrack, t.me && { backgroundColor: 'rgba(26, 29, 20, 0.12)' }]}>
                          <View style={[styles.racerFill, { width: `${Math.min(100, (t.km / total) * 100)}%`, backgroundColor: t.me ? C.ink : C.teal }]} />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.empty}>
                  <Text style={text.body}>
                    {friends === null
                      ? 'Entra in una lega dalla Classifica: qui vedrai sulla mappa i compagni che fanno il tuo stesso percorso.'
                      : 'Nessun compagno di lega è su questo percorso. Diglielo: dalla loro scheda Percorsi possono partire anche loro.'}
                  </Text>
                </View>
              )}

              {elsewhere.length > 0 ? (
                <>
                  <SectionTitle title="Compagni su altri percorsi" />
                  <View style={styles.together}>
                    {elsewhere.map((f) => {
                      const j = journeyById(f.journey);
                      if (!j) return null;
                      return (
                        <View key={f.id} style={styles.racer}>
                          <TreeAvatar badge={f.tree} size={38} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.racerName} numberOfLines={1}>
                              {f.name}
                            </Text>
                            <Text style={text.small}>
                              {j.name} · {kmText(f.km)} di {kmText(journeyLength(j))}
                            </Text>
                          </View>
                          <Pressable onPress={() => start(j)} accessibilityRole="button" accessibilityLabel={`Unisciti a ${f.name} su ${j.name}`} style={({ pressed }) => [styles.join, pressed && { opacity: 0.8 }]}>
                            <Text style={styles.joinText}>Unisciti</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <SectionTitle title={`Tappe: ${run.reached} di ${current.stages.length}`} />
              <View style={styles.cards}>
                {current.stages.map((stage, i) => {
                  const reached = i < run.reached;
                  return (
                    <View
                      key={stage.name}
                      style={[styles.postcard, reached ? styles.postcardOn : null]}
                      accessible
                      accessibilityLabel={`${stage.name}, chilometro ${stage.km}${reached ? `. ${stage.card}` : ', ancora da raggiungere'}`}
                    >
                      <View style={styles.postHead}>
                        <View style={[styles.stamp, reached && { backgroundColor: C.lime }]}>
                          <Text style={[styles.stampText, reached && { color: C.ink }]}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.stageName, !reached && { color: C.dim }]} numberOfLines={1}>
                          {stage.name}
                        </Text>
                        <Text style={text.small}>km {String(stage.km).replace('.', ',')}</Text>
                      </View>
                      {reached ? <Text style={styles.cardText}>{stage.card}</Text> : <Text style={text.small}>Cartolina chiusa: si apre quando arrivi.</Text>}
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={[styles.hero, { backgroundColor: C.mint }]}>
              <Text style={styles.heroName}>Scegli un viaggio</Text>
              <Text style={styles.heroSub}>
                Ogni km a piedi, in bici o con i mezzi ti porta avanti sulla mappa. A ogni tappa si apre una cartolina, e i compagni di lega
                sullo stesso percorso li vedi accanto a te.
              </Text>
            </View>
          )}

          {ready ? (
            <>
              <SectionTitle title={current ? 'Altri viaggi' : 'Viaggi'} />
              <View style={styles.choices}>
                {others.map((j) => {
                  const times = state.done.filter((d) => d.id === j.id).length;
                  const company = (friends ?? []).filter((f) => f.journey === j.id).length;
                  return (
                    <View key={j.id} style={[styles.choice, { backgroundColor: TINT[j.id] ?? C.card }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.choiceName}>{j.name}</Text>
                        <Text style={styles.choiceSub}>
                          {j.subtitle} · {kmText(journeyLength(j))}
                          {times > 0 ? ` · fatto ${times === 1 ? 'una volta' : `${times} volte`}` : ''}
                          {company > 0 ? ` · ${company === 1 ? '1 compagno' : `${company} compagni`} in viaggio` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => start(j)} accessibilityRole="button" accessibilityLabel={`Parti per ${j.name}`} style={({ pressed }) => [styles.go, pressed && { opacity: 0.8 }]}>
                        <Text style={styles.goText}>Parti</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {state.done.length > 0 ? (
            <>
              <SectionTitle title="Viaggi completati" />
              <View style={styles.together}>
                {[...state.done]
                  .sort((a, b) => b.doneAt - a.doneAt)
                  .map((d) => (
                    <View key={`${d.id}${d.doneAt}`} style={styles.racer}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.racerName}>{journeyById(d.id)?.name ?? d.id}</Text>
                        <Text style={text.small}>Arrivato {dateLabel(d.doneAt).toLowerCase()}</Text>
                      </View>
                    </View>
                  ))}
              </View>
            </>
          ) : null}

          {!current && ready ? <PrimaryButton label={`Parti per ${JOURNEYS[0].name}`} onPress={() => start(JOURNEYS[0])} /> : null}

          <Text style={[text.small, styles.rule]}>
            Contano i km validi fatti senza auto dal giorno in cui parti, gli stessi della CO₂ evitata. Ognuno avanza con i suoi km da
            quando è partito. Le distanze sono indicative.
          </Text>
        </View>
      </ScrollView>

      <BottomNav current="percorsi" tripActive={!!active} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  hero: { borderRadius: R.hero, padding: 20, gap: 6, overflow: 'hidden' },
  heroName: { fontFamily: F.displayBold, fontSize: 28, lineHeight: 33, color: C.ink },
  heroSub: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.ink, opacity: 0.75 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  heroKm: { fontFamily: F.displayBold, fontSize: 40, lineHeight: 46, letterSpacing: -1, color: C.ink },
  heroOf: { fontFamily: F.semi, fontSize: 16, color: C.ink, opacity: 0.7 },
  nextChip: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: C.ink, justifyContent: 'center' },
  nextText: { fontFamily: F.bold, fontSize: 13, color: '#FFFFFF' },
  mapCard: { backgroundColor: C.card, borderRadius: R.card, padding: 8 },
  together: { backgroundColor: C.card, borderRadius: R.card, padding: 8, gap: 4 },
  racer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 18 },
  racerMe: { backgroundColor: C.lime },
  racerRank: { width: 18, fontFamily: F.displayBold, fontSize: 15, color: C.dim, textAlign: 'center' },
  racerHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  racerName: { fontFamily: F.bold, fontSize: 15, color: C.text, flexShrink: 1 },
  racerKm: { fontFamily: F.bold, fontSize: 14, color: C.text },
  racerTrack: { height: 6, borderRadius: 3, backgroundColor: C.faint, overflow: 'hidden' },
  racerFill: { height: 6, borderRadius: 3 },
  join: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.tonal, justifyContent: 'center' },
  joinText: { fontFamily: F.bold, fontSize: 13.5, color: C.text },
  empty: { backgroundColor: C.card, borderRadius: R.card, padding: 16 },
  cards: { gap: 8 },
  postcard: { backgroundColor: C.card, borderRadius: 20, padding: 14, gap: 6, borderWidth: 2, borderColor: 'transparent' },
  postcardOn: { borderColor: C.lime, borderStyle: 'dashed' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stamp: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.tonal, alignItems: 'center', justifyContent: 'center' },
  stampText: { fontFamily: F.displayBold, fontSize: 13, color: C.dim },
  stageName: { flex: 1, fontFamily: F.bold, fontSize: 16, color: C.text },
  cardText: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, color: C.text },
  choices: { gap: 8 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: R.card },
  choiceName: { fontFamily: F.displayBold, fontSize: 18, color: C.ink },
  choiceSub: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.ink, opacity: 0.75 },
  go: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.ink, justifyContent: 'center' },
  goText: { fontFamily: F.bold, fontSize: 14, color: '#FFFFFF' },
  rule: { textAlign: 'center', paddingHorizontal: 12, lineHeight: 18, marginTop: 6 },
});
