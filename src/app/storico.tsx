/** Schermata "Storico": punti per settimana, totali dei mesi e il giorno migliore. */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCo2, treeTime } from '../core/co2';
import { bestDay, months, weeks } from '../core/history';
import { monthName } from '../core/social';
import type { Trip } from '../core/scoring';
import { loadTrips } from '../storage/trips';
import { Group, SectionTitle } from '../ui/expressive';
import { dateLabel, km } from '../ui/format';
import { CloseIcon, ShareIcon } from '../ui/Icons';
import { ShareSheet, type ShareData } from '../ui/ShareCard';
import { usePlant } from '../ui/usePlant';
import { GhostButton, Header, RoundButton, Screen, text } from '../ui/parts';
import { C, F, R } from '../ui/theme';

const BAR_H = 150;

function weekLabel(start: number): string {
  const d = new Date(start);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function Storico() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [sharing, setSharing] = useState<ShareData | null>(null);

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

  const w = weeks(trips, now, 8);
  const m = months(trips, now, 6).reverse();
  const top = Math.max(1, ...w.map((p) => p.points));
  const best = bestDay(trips);
  const thisWeek = w[w.length - 1];
  const plant = usePlant(trips, now);

  function shareWeek() {
    setSharing({
      caption: 'La mia settimana',
      big: km(thisWeek.carFreeMeters),
      bigLabel: 'senza auto',
      stats: [
        { label: 'CO₂ evitata', value: formatCo2(thisWeek.co2) },
        { label: 'punti', value: String(thisWeek.points) },
      ],
      note: thisWeek.co2 > 0 ? `Un albero adulto ci mette ${treeTime(thisWeek.co2)} ad assorbirla.` : undefined,
      plant: { stage: plant.stage, health: plant.health, species: plant.species },
    });
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header
          caption="Settimane e mesi"
          title="Storico"
          left={
            <RoundButton onPress={() => router.back()} label="Chiudi">
              <CloseIcon size={20} />
            </RoundButton>
          }
        />

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Punti per settimana</Text>
          <Text style={styles.chartValue}>{thisWeek.points} questa settimana</Text>
          <View style={styles.chart} accessible accessibilityLabel={`Punti delle ultime 8 settimane: ${w.map((p) => p.points).join(', ')}`}>
            {w.map((p, i) => {
              const h = p.points > 0 ? Math.max(6, (p.points / top) * BAR_H) : 4;
              const current = i === w.length - 1;
              return (
                <View key={p.start} style={styles.barCol}>
                  <Text style={styles.barValue}>{p.points > 0 ? p.points : ''}</Text>
                  <View style={[styles.bar, { height: h, backgroundColor: current ? C.strong : p.points > 0 ? C.lime : C.tonal }]} />
                  <Text style={[styles.barLabel, current && { fontFamily: F.bold, color: C.text }]}>{weekLabel(p.start)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {thisWeek.carFreeMeters > 0 ? <GhostButton label="Condividi la settimana" icon={<ShareIcon size={18} />} onPress={shareWeek} /> : null}

        <SectionTitle title="Mesi" />
        <Group>
          {m.map((p) => (
            <View key={p.start} style={styles.month}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthName}>
                  {monthName(p.start).charAt(0).toUpperCase() + monthName(p.start).slice(1)} {new Date(p.start).getFullYear()}
                </Text>
                <Text style={text.small}>
                  {p.trips === 0 ? 'Nessun tragitto' : `${p.trips} ${p.trips === 1 ? 'tragitto' : 'tragitti'} · ${km(p.carFreeMeters)} senza auto · ${formatCo2(p.co2)} di CO₂`}
                </Text>
              </View>
              <Text style={styles.monthPoints}>{p.points}</Text>
            </View>
          ))}
        </Group>

        {best ? (
          <View style={styles.best}>
            <Text style={styles.bestLabel}>Il tuo giorno migliore</Text>
            <Text style={styles.bestValue}>{best.points} punti</Text>
            <Text style={styles.bestDay}>{dayText(best.day)}</Text>
          </View>
        ) : null}
      </ScrollView>
      <ShareSheet data={sharing} onClose={() => setSharing(null)} />
    </Screen>
  );
}

function dayText(day: string): string {
  const [y, mo, d] = day.split('-').map(Number);
  return dateLabel(new Date(y, mo - 1, d, 12).getTime());
}

const styles = StyleSheet.create({
  scroll: { gap: 10, paddingBottom: 40 },
  chartCard: { backgroundColor: C.card, borderRadius: R.hero, padding: 18 },
  chartTitle: { fontFamily: F.semi, fontSize: 13, color: C.dim },
  chartValue: { fontFamily: F.displayBold, fontSize: 26, lineHeight: 32, color: C.text },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14, height: BAR_H + 40 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '100%', borderRadius: 10 },
  barValue: { fontFamily: F.semi, fontSize: 11, color: C.dim },
  barLabel: { fontFamily: F.medium, fontSize: 11, color: C.dim },
  month: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 62, paddingVertical: 10 },
  monthName: { fontFamily: F.semi, fontSize: 15.5, color: C.text },
  monthPoints: { fontFamily: F.displayBold, fontSize: 22, color: C.text },
  best: { backgroundColor: C.coralSoft, borderRadius: R.card, padding: 18, marginTop: 6 },
  bestLabel: { fontFamily: F.semi, fontSize: 13, color: C.onCoralDim },
  bestValue: { fontFamily: F.displayBold, fontSize: 30, lineHeight: 36, color: C.onCoral },
  bestDay: { fontFamily: F.medium, fontSize: 14, color: C.onCoralDim },
});
