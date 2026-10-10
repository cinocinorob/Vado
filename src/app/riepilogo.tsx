/** Riepilogo a fine tragitto: punti, tratti e perché valgono quanto valgono. */
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newlyUnlocked, type BadgeState } from '../core/badges';
import { TRIP_CAP, type Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { duration, km } from '../ui/format';
import { HeroBlock } from '../ui/Hero';
import { StickerMascot } from '../ui/Mascot';
import { Medal } from '../ui/Medal';
import { BonusRow, Divider, GUTTER, Header, LegRow, Panel, PrimaryButton, Screen, text } from '../ui/parts';
import { C, F } from '../ui/theme';

export default function Riepilogo() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [medals, setMedals] = useState<BadgeState[]>([]);

  useEffect(() => {
    let alive = true;
    loadTrips().then((all) => {
      if (!alive) return;
      const found = all.find((t) => t.id === id) ?? null;
      setTrip(found);
      // Le medaglie che questo tragitto ha fatto scattare.
      if (found) setMedals(newlyUnlocked(all.filter((t) => t.id !== found.id), [found], found.endedAt));
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

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock caption="Tragitto concluso" title="Riepilogo">
          <View style={styles.hero}>
            <View>
              <View style={styles.heroLine}>
                <Text style={styles.heroPoints}>+{trip.total}</Text>
                <Text style={styles.heroLabel}>punti</Text>
              </View>
              <Text style={styles.heroDetail}>
                {km(trip.meters)} in {duration(seconds)}
              </Text>
            </View>
            <StickerMascot size={116} disc={C.coral} />
          </View>
        </HeroBlock>

        <View style={styles.body}>
        <Panel>
          {trip.legs.map((leg, i) => (
            <Fragment key={i}>
              {i > 0 ? <Divider /> : null}
              <LegRow leg={leg} showStatus />
            </Fragment>
          ))}
          {trip.bonus > 0 ? (
            <>
              <Divider />
              <BonusRow points={trip.bonus} />
            </>
          ) : null}
        </Panel>

        {medals.map((medal) => (
          <Panel key={medal.id} style={styles.medal}>
            <Medal id={medal.id} look="sbloccata" size={76} label={`Medaglia ${medal.name}`} />
            <View style={{ flex: 1, gap: 3, alignItems: 'flex-start' }}>
              <View style={styles.medalChip}>
                <Text style={styles.medalCaption}>Nuova medaglia</Text>
              </View>
              <Text style={styles.medalName}>{medal.name}</Text>
              <Text style={text.small}>{medal.goal}</Text>
            </View>
          </Panel>
        ))}

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
  body: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 18 },
  hero: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroPoints: { fontFamily: F.displayBold, fontSize: 92, lineHeight: 94, letterSpacing: -2, color: C.ink },
  heroLabel: { fontFamily: F.display, fontSize: 20, color: C.ink },
  heroDetail: { fontFamily: F.bold, fontSize: 14, color: C.ink, marginBottom: 6 },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.lime, transform: [{ rotate: '-1.5deg' }] },
  medalChip: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.ink, justifyContent: 'center' },
  medalCaption: { fontFamily: F.bold, fontSize: 12, color: C.lime },
  medalName: { fontFamily: F.displayBold, fontSize: 20, lineHeight: 24, color: C.text },
  cta: { position: 'absolute', left: 20, right: 20 },
});
