/** Le due sfide personali in corso: della settimana e del mese. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { challengeProgress, type ChallengeRun } from '../core/challenges';
import { timeLeft } from '../core/social';
import { WavyBar } from './Wavy';
import { C, F, R } from './theme';

function Row({ label, run, now, last }: { label: string; run: ChallengeRun; now: number; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]} accessible accessibilityLabel={`${label}: ${run.title}, ${run.goal}. ${challengeProgress(run)}${run.done ? ', completata' : ''}`}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.left}>{run.done ? 'Completata' : `ancora ${timeLeft(run.to, now)}`}</Text>
      </View>
      <Text style={styles.title}>{run.title}</Text>
      <Text style={styles.goal}>{run.goal}</Text>
      <WavyBar ratio={run.ratio} color={run.done ? C.teal : C.text} height={16} stroke={5} style={{ marginTop: 6 }} />
      <Text style={styles.progress}>{challengeProgress(run)}</Text>
    </View>
  );
}

export function PersonalChallenges({ week, month, now, onPress }: { week: ChallengeRun; month: ChallengeRun; now: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={styles.card}>
      <Row label="Sfida della settimana" run={week} now={now} />
      <Row label="Sfida del mese" run={month} now={now} last />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.card, paddingHorizontal: 18, paddingVertical: 6 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: F.semi, fontSize: 12.5, color: C.dim },
  left: { fontFamily: F.medium, fontSize: 12.5, color: C.dim },
  title: { fontFamily: F.bold, fontSize: 17, color: C.text, marginTop: 2 },
  goal: { fontFamily: F.medium, fontSize: 13.5, color: C.dim },
  progress: { fontFamily: F.semi, fontSize: 12.5, color: C.text, marginTop: 4 },
});
