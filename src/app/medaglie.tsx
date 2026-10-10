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
import { HeroBlock } from '../ui/Hero';
import { GUTTER, Panel, ProgressBar, Screen, text } from '../ui/parts';
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
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock caption={`${unlocked} di ${badges.length} sbloccate`} title="Medaglie">
          {next ? (
            <View style={styles.next}>
              <Medal id={next.id} look="sbloccata" size={104} label={`Medaglia ${next.name}`} />
              <View style={styles.nextText}>
                <View style={styles.nextChip}>
                  <Text style={styles.nextCaption}>Prossima medaglia</Text>
                </View>
                <Text style={styles.nextName} accessibilityRole="header">
                  {next.name}
                </Text>
                <Text style={styles.nextGoal}>{next.goal}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.next}>
              <View style={styles.nextText}>
                <Text style={styles.nextName}>Le hai prese tutte</Text>
                <Text style={styles.nextGoal}>Nove su nove. Ne arriveranno di nuove.</Text>
              </View>
            </View>
          )}
          {next ? <ProgressBar value={next.value} max={next.target} label="Avanzamento" detail={progressLabel(next)} /> : null}
        </HeroBlock>

        <View style={styles.body}>
          <Panel style={styles.album}>
            {badges.map((badge) => (
              <View key={badge.id} style={styles.cell}>
                <Medal id={badge.id} look={look(badge)} label={medalLabel(badge)} />
                <View style={styles.cellText}>
                  <Text style={styles.cellName} numberOfLines={1} adjustsFontSizeToFit>
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
          </Panel>

          <Text style={[text.small, styles.rule]}>
            Contano solo i tratti validi. Per le medaglie a numero di tragitti servono almeno 500 metri con quel mezzo.
          </Text>
        </View>
      </ScrollView>

      <BottomNav current="medaglie" tripActive={!!active} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 16 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, marginBottom: 14 },
  nextText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  nextChip: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.ink, justifyContent: 'center' },
  nextCaption: { fontFamily: F.bold, fontSize: 12, color: C.lime },
  nextName: { fontFamily: F.displayBold, fontSize: 24, lineHeight: 28, color: C.ink },
  nextGoal: { fontFamily: F.semi, fontSize: 13.5, lineHeight: 18, color: C.ink },
  album: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, paddingHorizontal: 6, paddingVertical: 18 },
  cell: { width: '33.33%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  cellText: { alignItems: 'center', alignSelf: 'stretch' },
  cellName: { fontFamily: F.bold, fontSize: 13, lineHeight: 17, color: C.text, textAlign: 'center' },
  cellGoal: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: C.dim, textAlign: 'center' },
  cellProgress: { fontFamily: F.bold, fontSize: 12, lineHeight: 16, color: C.teal, textAlign: 'center' },
  rule: { textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 },
});
