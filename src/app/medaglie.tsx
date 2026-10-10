/** Schermata "Medaglie": cosa hai già sbloccato e cosa manca alla prossima. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { badgeStates, nextBadge, progressLabel, type BadgeState } from '../core/badges';
import type { Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { useActiveTrip } from '../tracking/store';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { Medal, type MedalLook } from '../ui/Medal';
import { Header, Panel, Screen, text } from '../ui/parts';
import { C, F } from '../ui/theme';

function look(badge: BadgeState): MedalLook {
  if (badge.unlocked) return 'sbloccata';
  return badge.value > 0 ? 'in-corso' : 'bloccata';
}

function medalLabel(badge: BadgeState): string {
  if (badge.unlocked) return `Medaglia ${badge.name}, sbloccata`;
  return badge.value > 0 ? `Medaglia ${badge.name}, in corso: ${progressLabel(badge)}` : `Medaglia ${badge.name}, bloccata`;
}

export default function Medaglie() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const active = useActiveTrip();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setNow(Date.now());
      loadTrips().then((loaded) => {
        if (alive) setTrips(loaded);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const badges = badgeStates(trips, now);
  const unlocked = badges.filter((b) => b.unlocked).length;
  const next = nextBadge(badges);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header caption={`${unlocked} di ${badges.length} sbloccate`} title="Medaglie" />

        {next ? (
          <Panel style={styles.next}>
            <Medal id={next.id} look="sbloccata" size={96} label={`Medaglia ${next.name}`} />
            <View style={styles.nextText}>
              <Text style={styles.nextCaption}>Prossima medaglia</Text>
              <Text style={styles.nextName} accessibilityRole="header">
                {next.name}
              </Text>
              <Text style={text.small}>{next.goal}</Text>
              <View
                style={styles.nextProgress}
                accessibilityRole="progressbar"
                accessibilityLabel={`Avanzamento: ${progressLabel(next)}`}
              >
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${next.ratio * 100}%` }]} />
                </View>
                <Text style={styles.nextValue}>{progressLabel(next)}</Text>
              </View>
            </View>
          </Panel>
        ) : (
          <Panel style={styles.next}>
            <View style={styles.nextText}>
              <Text style={styles.nextName}>Le hai prese tutte</Text>
              <Text style={text.small}>Nove su nove. Ne arriveranno di nuove.</Text>
            </View>
          </Panel>
        )}

        <View style={styles.grid}>
          {badges.map((badge) => (
            <View key={badge.id} style={styles.cell}>
              <Medal id={badge.id} look={look(badge)} label={medalLabel(badge)} />
              <View style={styles.cellText}>
                <Text style={[styles.cellName, !badge.unlocked && { color: 'rgba(255, 255, 255, 0.85)' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {badge.name}
                </Text>
                {!badge.unlocked && badge.value > 0 ? (
                  <Text style={styles.cellProgress}>{progressLabel(badge)}</Text>
                ) : (
                  <Text style={styles.cellGoal}>{badge.goal}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <Text style={[text.small, styles.rule]}>
          Contano solo i tratti validi. Per le medaglie a numero di tragitti servono almeno 500 metri con quel mezzo.
        </Text>
      </ScrollView>

      <BottomNav current="medaglie" tripActive={!!active} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, paddingBottom: NAV_SPACE },
  next: { minHeight: 132, flexDirection: 'row', alignItems: 'center', gap: 14 },
  nextText: { flex: 1, gap: 4 },
  nextCaption: { fontFamily: F.semi, fontSize: 12.5, color: C.lime },
  nextName: { fontFamily: F.display, fontSize: 20, lineHeight: 24, color: C.text },
  nextProgress: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.faint, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.lime },
  nextValue: { fontFamily: F.semi, fontSize: 12.5, color: C.text },
  grid: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  cell: { width: '33.33%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  cellText: { alignItems: 'center', alignSelf: 'stretch' },
  cellName: { fontFamily: F.semi, fontSize: 13, lineHeight: 17, color: C.text, textAlign: 'center' },
  cellGoal: { fontFamily: F.body, fontSize: 12, lineHeight: 16, color: C.dim, textAlign: 'center' },
  cellProgress: { fontFamily: F.semi, fontSize: 12, lineHeight: 16, color: C.lime, textAlign: 'center' },
  rule: { textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 },
});
