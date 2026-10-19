/** Riepilogo a fine tragitto: punti, tratti e perché valgono quanto valgono. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TIER_NAMES, goalFor, newlyUnlocked, type BadgeState } from '../core/badges';
import { monthlyAt, weeklyAt, type ChallengeRun } from '../core/challenges';
import { journeyById, journeyRun, type Stage as JourneyStage } from '../core/journeys';
import { formatCo2, totalCo2, treeTime, tripCo2 } from '../core/co2';
import { DEFAULT_SPECIES, plantState, speciesName, type SpeciesId, type Stage } from '../core/plant';
import { TRIP_CAP, type Trip } from '../core/scoring';
import { loadJourneys, settleJourney } from '../storage/journey';
import { loadBadgeContext } from '../storage/showcase';
import { loadTree } from '../storage/tree';
import { loadTrips } from '../storage/trips';
import { duration, km } from '../ui/format';
import Svg, { Path } from 'react-native-svg';

import { Group, SectionTitle } from '../ui/expressive';
import { HeroBlock } from '../ui/Hero';
import { Medal } from '../ui/Medal';
import { buzz } from '../ui/motion';
import { BonusRow, Header, LegRow, PrimaryButton, Screen, text } from '../ui/parts';
import { SHAPES } from '../ui/shapes';
import { Sprout, Tree } from '../ui/Sprout';
import { C, F, R } from '../ui/theme';

/** La medaglia entra con un piccolo rimbalzo. */
function Pop({ style, children }: { style: StyleProp<ViewStyle>; children: ReactNode }) {
  const [scale] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
  }, [scale]);
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

type Growth = { text: string; stage: Stage; tree: SpeciesId | null; species?: SpeciesId };

/** Cosa è cambiato nel germoglio con questo tragitto: un albero nuovo o un passo di crescita. */
function growthBetween(before: Trip[], after: Trip[], at: number, species: SpeciesId): Growth | null {
  const a = plantState(before, at);
  const b = plantState(after, at);
  if (b.trees > a.trees) {
    const tree = species;
    return { text: `Un albero nuovo nel tuo bosco: ${speciesName(tree)}. E nasce un seme nuovo.`, stage: b.stage, tree };
  }
  if (b.stage !== a.stage) {
    const what = b.stage === 'piantina' ? `piantina di ${speciesName(species).toLowerCase()}` : b.stage;
    return { text: `Il tuo ${a.stage} è diventato ${what}.`, stage: b.stage, tree: null, species };
  }
  return null;
}

export default function Riepilogo() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [medals, setMedals] = useState<BadgeState[]>([]);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [totalG, setTotalG] = useState(0);
  const [stages, setStages] = useState<{ journey: string; stages: JourneyStage[]; finished: boolean } | null>(null);
  const [won, setWon] = useState<ChallengeRun[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [all, tree, journeys] = await Promise.all([loadTrips(), loadTree(), loadJourneys()]);
      const found = all.find((t) => t.id === id) ?? null;
      // Il percorso virtuale: le tappe raggiunte con questo tragitto, e se è finito lo si archivia.
      let journeyNews: { journey: string; stages: JourneyStage[]; finished: boolean } | null = null;
      let finished = false;
      if (found && journeys.current) {
        const j = journeyById(journeys.current.id);
        if (j) {
          const before = all.filter((t) => t.id !== found.id);
          const a = journeyRun(j, before, journeys.current.startedAt);
          const b = journeyRun(j, all, journeys.current.startedAt);
          finished = b.done && !a.done;
          if (b.reached > a.reached) journeyNews = { journey: j.name, stages: j.stages.slice(a.reached, b.reached), finished };
        }
      }
      if (finished) await settleJourney(all);
      const ctx = await loadBadgeContext();
      if (!alive) return;
      setTrip(found);
      // Le medaglie (o i gradi) che questo tragitto ha fatto scattare.
      if (found) {
        const before = all.filter((t) => t.id !== found.id);
        const unlocked = newlyUnlocked(before, [found], found.endedAt, { ...ctx, journeys: ctx.journeys - (finished ? 1 : 0) });
        setMedals(unlocked);
        buzz(unlocked.length > 0 ? 'premio' : 'fatto');
        setGrowth(growthBetween(before, all, found.endedAt, tree.species ?? DEFAULT_SPECIES));
        setTotalG(totalCo2(all));
        setStages(journeyNews);
        const at = found.endedAt;
        setWon([weeklyAt, monthlyAt].map((f) => [f(before, at), f(all, at)] as const).filter(([a, b]) => b.done && !a.done).map(([, b]) => b));
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id]);

  if (trip === undefined) return <Screen>{null}</Screen>;

  if (trip === null) {
    return (
      <Screen>
        <Header caption="Riepilogo" title="Tragitto non trovato" />
        <PrimaryButton label="Torna a Oggi" onPress={() => router.dismissTo('/')} />
      </Screen>
    );
  }

  const seconds = trip.legs.reduce((sum, l) => sum + l.seconds, 0);
  const capped = trip.legs.reduce((sum, l) => sum + l.rawPoints, 0) > trip.legPoints;
  const invalid = trip.legs.some((l) => l.status === 'anomalo');
  const co2 = tripCo2(trip);

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock caption="Tragitto concluso" title="Riepilogo">
          <Text style={styles.heroPoints}>+{trip.total}</Text>
          <Text style={styles.heroLabel}>punti</Text>
          <Text style={styles.heroDetail}>
            {km(trip.meters)} in {duration(seconds)}
          </Text>
        </HeroBlock>

        <View style={styles.body}>
          {medals.map((medal) => (
            <View key={medal.id} style={styles.prize} accessible accessibilityLabel={`${prizeCaption(medal)}: ${medal.name}. ${goalFor(medal, medal.tiers[medal.level - 1])}`}>
              <Pop style={styles.halo}>
                <Svg width={200} height={200} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
                  <Path d={SHAPES.cookie12} fill={C.card} transform="rotate(11 48 48)" />
                </Svg>
                <View>
                  <Medal id={medal.id} look="sbloccata" size={156} level={medal.level} label={`Medaglia ${medal.name}`} />
                </View>
              </Pop>
              <View style={styles.prizeChip}>
                <Text style={styles.prizeCaption}>{prizeCaption(medal)}</Text>
              </View>
              <Text style={styles.prizeName}>{medal.name}</Text>
              <Text style={styles.prizeGoal}>{goalFor(medal, medal.tiers[medal.level - 1])}</Text>
            </View>
          ))}

          <SectionTitle title="Tratti" />
          <Group>
            {[
              ...trip.legs.map((leg, i) => <LegRow key={i} leg={leg} showStatus />),
              ...(trip.bonus > 0 ? [<BonusRow key="bonus" points={trip.bonus} />] : []),
            ]}
          </Group>

          {growth ? (
            <View style={styles.growth}>
              {growth.tree ? <Tree species={growth.tree} size={72} /> : <Sprout size={72} stage={growth.stage} species={growth.species} />}
              <Text style={styles.growthText}>{growth.text}</Text>
            </View>
          ) : null}

          {co2 > 0 ? (
            <View style={styles.co2}>
              <Text style={styles.co2Label}>CO₂ evitata</Text>
              <Text style={styles.co2Value}>{formatCo2(co2)}</Text>
              <View style={styles.co2Facts}>
                <Text style={[styles.co2Fact, styles.co2First]}>Un albero adulto ci mette {treeTime(co2)} ad assorbirla</Text>
                {totalG > co2 ? (
                  <Text style={[styles.co2Fact, styles.co2Last]}>
                    Da quando usi Vado: {formatCo2(totalG)}, {treeTime(totalG)} di lavoro di un albero
                  </Text>
                ) : null}
              </View>
              <Text style={styles.co2Note}>Stima: 167 g di CO₂ per ogni km che avresti fatto in auto (media italiana, ISPRA).</Text>
            </View>
          ) : null}

          {won.map((run) => (
            <View key={run.id} style={styles.won} accessible>
              <Text style={styles.wonCaption}>{run.id.startsWith('s-') ? 'Sfida della settimana completata' : 'Sfida del mese completata'}</Text>
              <Text style={styles.wonTitle}>{run.title}</Text>
              <Text style={styles.wonGoal}>{run.goal}</Text>
            </View>
          ))}

          {stages && stages.stages.length > 0 ? (
            <View style={styles.postcard} accessible>
              <Text style={styles.postCaption}>
                {stages.journey}: {stages.finished ? 'arrivato!' : stages.stages.length > 1 ? `${stages.stages.length} tappe nuove` : 'nuova tappa'}
              </Text>
              <Text style={styles.postTitle}>{stages.stages[stages.stages.length - 1].name}</Text>
              <Text style={styles.postText}>{stages.stages[stages.stages.length - 1].card}</Text>
              {stages.stages.length > 1 ? <Text style={styles.postMore}>Le altre cartoline sono in Percorsi.</Text> : null}
            </View>
          ) : null}

          {capped ? (
            <Text style={text.body}>
              Hai raggiunto il tetto di {TRIP_CAP} punti per tragitto
              {(trip.capUsed ?? 0) > 0 ? ', contando quello concluso da meno di mezz\'ora' : ''}.
            </Text>
          ) : null}
          {invalid ? (
            <Text style={[text.body, { color: C.alert, fontFamily: F.bold }]}>
              Un tratto non è stato conteggiato perché i dati non corrispondono al mezzo scelto.
            </Text>
          ) : null}
          {trip.commute && trip.bonus === 0 && !invalid ? (
            <Text style={text.body}>
              Il bonus casa-lavoro non è scattato: vale una volta al giorno, per tragitti di almeno 500 metri senza auto privata.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
        <PrimaryButton label="Fine" onPress={() => router.dismissTo('/')} />
      </View>
    </Screen>
  );
}

function prizeCaption(medal: BadgeState): string {
  if (medal.tiers.length <= 1) return 'Nuova medaglia';
  return medal.level === 1 ? 'Nuova medaglia: bronzo' : `Grado ${TIER_NAMES[medal.level - 1].toLowerCase()}`;
}

const styles = StyleSheet.create({
  won: { backgroundColor: C.coral, borderRadius: R.card, padding: 18, gap: 2 },
  wonCaption: { fontFamily: F.semi, fontSize: 13, color: C.onCoralDim },
  wonTitle: { fontFamily: F.displayBold, fontSize: 24, lineHeight: 29, color: C.onCoral },
  wonGoal: { fontFamily: F.medium, fontSize: 14, color: C.onCoralDim },
  postcard: { backgroundColor: C.card, borderRadius: 18, borderWidth: 2, borderColor: C.teal, borderStyle: 'dashed', padding: 18, gap: 4 },
  postCaption: { fontFamily: F.semi, fontSize: 13, color: C.teal },
  postTitle: { fontFamily: F.displayBold, fontSize: 24, lineHeight: 29, color: C.text },
  postMore: { fontFamily: F.semi, fontSize: 13, color: C.dim, marginTop: 4 },
  postText: { fontFamily: F.medium, fontSize: 14.5, lineHeight: 21, color: C.text },
  scroll: { paddingBottom: 116 },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  heroPoints: { fontFamily: F.displayBold, fontSize: 96, lineHeight: 104, letterSpacing: -3, color: C.ink },
  heroLabel: { fontFamily: F.semi, fontSize: 18, color: C.ink, marginTop: -6 },
  heroDetail: { fontFamily: F.medium, fontSize: 14, color: C.onLime, marginTop: 4 },
  prize: { backgroundColor: C.lime, borderRadius: R.hero, alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20 },
  halo: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  prizeChip: { height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: C.strong, justifyContent: 'center', marginTop: 10 },
  prizeCaption: { fontFamily: F.bold, fontSize: 13, color: C.onStrong },
  prizeName: { fontFamily: F.displayBold, fontSize: 34, lineHeight: 40, color: C.ink, textAlign: 'center', marginTop: 10 },
  prizeGoal: { fontFamily: F.medium, fontSize: 16, color: C.onLime, textAlign: 'center', marginTop: 4 },
  growth: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.card, padding: 12, paddingRight: 18 },
  growthText: { flex: 1, fontFamily: F.bold, fontSize: 15, lineHeight: 21, color: C.text },
  co2: { backgroundColor: C.mint, borderRadius: 36, padding: 20 },
  co2Label: { fontFamily: F.semi, fontSize: 13, color: C.onMintDim },
  co2Value: { fontFamily: F.displayBold, fontSize: 40, lineHeight: 46, color: C.onMint },
  co2Facts: { gap: 3, marginTop: 12 },
  co2Fact: { backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14, fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.onMint },
  co2First: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  co2Last: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  co2Note: { fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.onMintDim, marginTop: 12 },
  cta: { position: 'absolute', left: 20, right: 20 },
});
