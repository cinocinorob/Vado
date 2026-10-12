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
import { Group, SectionTitle } from '../ui/expressive';
import { HeroBlock } from '../ui/Hero';
import { ProgressBar, Screen, text } from '../ui/parts';
import { WavyBar } from '../ui/Wavy';
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

  const earned = badges.filter((b) => b.unlocked);
  const todo = badges.filter((b) => !b.unlocked && b.id !== next?.id).sort((x, y) => y.ratio - x.ratio);
  const missing = next ? remaining(next) : '';

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock caption={`${unlocked} di ${badges.length} sbloccate`} title="Medaglie" color={C.coralSoft}>
          {next ? (
            <>
              <View style={styles.next}>
                <Medal id={next.id} look="sbloccata" size={108} label={`Medaglia ${next.name}`} />
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
              <ProgressBar value={next.value} max={next.target} label={progressLabel(next)} detail={missing} color={C.onCoral} track="rgba(58, 19, 6, 0.16)" />
            </>
          ) : (
            <View style={styles.nextText}>
              <Text style={styles.nextName}>Le hai prese tutte</Text>
              <Text style={styles.nextGoal}>Nove su nove. Ne arriveranno di nuove.</Text>
            </View>
          )}
        </HeroBlock>

        <View style={styles.body}>
          <SectionTitle title="Le tue medaglie" />
          <View style={styles.shelf}>
            {earned.length === 0 ? (
              <Text style={[text.body, { padding: 8 }]}>Ancora nessuna: la prima arriva con il primo tragitto a piedi.</Text>
            ) : (
              earned.map((badge) => (
                <View key={badge.id} style={styles.cell}>
                  <Medal id={badge.id} look="sbloccata" size={80} label={medalLabel(badge)} />
                  <Text style={styles.cellName} numberOfLines={2}>
                    {badge.name}
                  </Text>
                </View>
              ))
            )}
          </View>

          {todo.length > 0 ? (
            <>
              <SectionTitle title="Da conquistare" />
              <Group>
                {todo.map((badge) => (
                  <View key={badge.id} style={styles.row}>
                    <Medal id={badge.id} look={look(badge)} size={54} label={medalLabel(badge)} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{badge.name}</Text>
                      {badge.value > 0 ? <WavyBar ratio={badge.ratio} height={14} stroke={4.5} style={styles.rowBar} /> : null}
                      <Text style={text.small}>{badge.value > 0 ? progressLabel(badge) : badge.goal}</Text>
                    </View>
                  </View>
                ))}
              </Group>
            </>
          ) : null}

          <Text style={[text.small, styles.rule]}>
            Contano solo i tratti validi. Per le medaglie a numero di tragitti servono almeno 500 metri con quel mezzo.
          </Text>
        </View>
      </ScrollView>

      <BottomNav current="medaglie" tripActive={!!active} />
    </Screen>
  );
}

/** "ne mancano 11 km", "ne manca 1". */
function remaining(badge: BadgeState): string {
  const left = badge.target - badge.value;
  const n = badge.unit === 'km' ? Math.ceil(left * 10) / 10 : Math.ceil(left);
  const value = String(n).replace('.', ',');
  const unit = badge.unit === 'km' ? ' km' : badge.unit === 'giorni' ? (n === 1 ? ' giorno' : ' giorni') : '';
  return `${n === 1 && badge.unit !== 'km' ? 'ne manca' : 'ne mancano'} ${value}${unit}`;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  nextText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  nextChip: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.ink, justifyContent: 'center' },
  nextCaption: { fontFamily: F.bold, fontSize: 12, color: C.coralSoft },
  nextName: { fontFamily: F.displayBold, fontSize: 27, lineHeight: 32, color: C.onCoral },
  nextGoal: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.onCoralDim },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: 32, paddingVertical: 16, paddingHorizontal: 6, rowGap: 14 },
  cell: { width: '33.33%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  cellName: { fontFamily: F.bold, fontSize: 13, lineHeight: 17, color: C.text, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowText: { flex: 1, gap: 3 },
  rowName: { fontFamily: F.bold, fontSize: 15, color: C.text },
  rowBar: { width: '80%' },
  rule: { textAlign: 'center', paddingHorizontal: 12, lineHeight: 18, marginTop: 6 },
});
