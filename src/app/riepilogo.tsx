/** Riepilogo a fine tragitto: punti, tratti e perché valgono quanto valgono. */
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newlyUnlocked, type BadgeState } from '../core/badges';
import { TRIP_CAP, type Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { duration, km } from '../ui/format';
import { Mascot } from '../ui/Mascot';
import { Medal } from '../ui/Medal';
import { BonusRow, Divider, Header, LegRow, Panel, PrimaryButton, Screen, text } from '../ui/parts';
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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header caption="Tragitto concluso" title="Riepilogo" />

        <View style={styles.hero}>
          <Mascot size={92} />
          <View>
            <View style={styles.heroLine}>
              <Text style={styles.heroPoints}>+{trip.total}</Text>
              <Text style={styles.heroLabel}>punti</Text>
            </View>
            <Text style={text.small}>
              {km(trip.meters)} · {duration(seconds)}
            </Text>
          </View>
        </View>

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
            <Medal id={medal.id} look="sbloccata" size={72} label={`Medaglia ${medal.name}`} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.medalCaption}>Nuova medaglia</Text>
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
          <Text style={[text.body, { color: C.coral }]}>
            Un tratto non è stato conteggiato perché i dati non corrispondono al mezzo scelto.
          </Text>
        ) : null}
        {trip.commute && trip.bonus === 0 && !invalid ? (
          <Text style={text.body}>
            Il bonus casa-lavoro non è scattato: vale una volta al giorno, per tragitti di almeno 500 metri senza auto privata.
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.cta, { bottom: insets.bottom + 16 }]}>
        <PrimaryButton label="Fine" onPress={() => router.dismissTo('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: 110 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 8 },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroPoints: { fontFamily: F.displayBold, fontSize: 72, lineHeight: 76, color: C.lime },
  heroLabel: { fontFamily: F.semi, fontSize: 17, color: C.text },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.limeSoft, borderColor: C.lime },
  medalCaption: { fontFamily: F.semi, fontSize: 12.5, color: C.lime },
  medalName: { fontFamily: F.display, fontSize: 20, lineHeight: 24, color: C.text },
  cta: { position: 'absolute', left: 20, right: 20 },
});
