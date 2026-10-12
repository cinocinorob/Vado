/** Riepilogo a fine tragitto: punti, tratti e perché valgono quanto valgono. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newlyUnlocked, type BadgeState } from '../core/badges';
import { formatCo2, totalCo2, treeTime, tripCo2 } from '../core/co2';
import { plantState, speciesName, type SpeciesId, type Stage } from '../core/plant';
import { TRIP_CAP, type Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { duration, km } from '../ui/format';
import Svg, { Path } from 'react-native-svg';

import { Group, SectionTitle } from '../ui/expressive';
import { HeroBlock } from '../ui/Hero';
import { Medal } from '../ui/Medal';
import { BonusRow, Header, LegRow, PrimaryButton, Screen, text } from '../ui/parts';
import { SHAPES } from '../ui/shapes';
import { Sprout, Tree } from '../ui/Sprout';
import { C, F, R } from '../ui/theme';

type Growth = { text: string; stage: Stage; tree: SpeciesId | null };

/** Cosa è cambiato nel germoglio con questo tragitto: un albero nuovo o un passo di crescita. */
function growthBetween(before: Trip[], after: Trip[], at: number): Growth | null {
  const a = plantState(before, at);
  const b = plantState(after, at);
  if (b.forest.length > a.forest.length) {
    const tree = b.forest[b.forest.length - 1];
    return { text: `Un albero nuovo nel tuo bosco: ${speciesName(tree)}. E nasce un seme nuovo.`, stage: b.stage, tree };
  }
  if (b.stage !== a.stage) {
    return { text: `Il tuo ${a.stage} è diventato ${b.stage}.`, stage: b.stage, tree: null };
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

  useEffect(() => {
    let alive = true;
    loadTrips().then((all) => {
      if (!alive) return;
      const found = all.find((t) => t.id === id) ?? null;
      setTrip(found);
      // Le medaglie che questo tragitto ha fatto scattare.
      if (found) {
        const before = all.filter((t) => t.id !== found.id);
        setMedals(newlyUnlocked(before, [found], found.endedAt));
        setGrowth(growthBetween(before, all, found.endedAt));
        setTotalG(totalCo2(all));
      }
    });
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
            <View key={medal.id} style={styles.prize} accessible accessibilityLabel={`Nuova medaglia: ${medal.name}. ${medal.goal}`}>
              <View style={styles.halo}>
                <Svg width={200} height={200} viewBox="0 0 96 96" style={StyleSheet.absoluteFill}>
                  <Path d={SHAPES.cookie12} fill={C.card} transform="rotate(11 48 48)" />
                </Svg>
                <View>
                  <Medal id={medal.id} look="sbloccata" size={156} label={`Medaglia ${medal.name}`} />
                </View>
              </View>
              <View style={styles.prizeChip}>
                <Text style={styles.prizeCaption}>Nuova medaglia</Text>
              </View>
              <Text style={styles.prizeName}>{medal.name}</Text>
              <Text style={styles.prizeGoal}>{medal.goal}</Text>
            </View>
          ))}

          {growth ? (
            <View style={styles.growth}>
              {growth.tree ? <Tree species={growth.tree} size={72} /> : <Sprout size={72} stage={growth.stage} />}
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

          <SectionTitle title="Tratti" />
          <Group>
            {[
              ...trip.legs.map((leg, i) => <LegRow key={i} leg={leg} showStatus />),
              ...(trip.bonus > 0 ? [<BonusRow key="bonus" points={trip.bonus} />] : []),
            ]}
          </Group>

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

const styles = StyleSheet.create({
  scroll: { paddingBottom: 116 },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  heroPoints: { fontFamily: F.displayBold, fontSize: 96, lineHeight: 104, letterSpacing: -3, color: C.ink },
  heroLabel: { fontFamily: F.semi, fontSize: 18, color: C.ink, marginTop: -6 },
  heroDetail: { fontFamily: F.medium, fontSize: 14, color: C.onLime, marginTop: 4 },
  prize: { backgroundColor: C.lime, borderRadius: R.hero, alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20 },
  halo: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  prizeChip: { height: 30, paddingHorizontal: 14, borderRadius: 15, backgroundColor: C.ink, justifyContent: 'center', marginTop: 10 },
  prizeCaption: { fontFamily: F.bold, fontSize: 13, color: C.lime },
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
