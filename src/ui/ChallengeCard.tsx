/** Le due sfide personali in corso: della settimana e del mese. */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { challengeProgress, type ChallengeRun } from '../core/challenges';
import { timeLeft } from '../core/social';
import type { TreeBadge } from '../core/plant';
import { MiniTrack } from './GooseBoard';
import { C, F, R } from './theme';

function Row({ label, run, now, last, tree }: { label: string; run: ChallengeRun; now: number; last?: boolean; tree?: TreeBadge | null }) {
  const pace = (now - run.from) / Math.max(1, run.to - run.from);
  const ahead = run.ratio >= pace;
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]} accessible accessibilityLabel={`${label}: ${run.title}, ${run.goal}. ${challengeProgress(run)}${run.done ? ', completata' : ''}`}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.left}>{run.done ? 'Completata' : `ancora ${timeLeft(run.to, now)}`}</Text>
      </View>
      <Text style={styles.title}>{run.title}</Text>
      <Text style={styles.goal}>{run.goal}</Text>
      <View style={{ marginTop: 8 }}>
        <MiniTrack ratio={run.ratio} pace={pace} tree={tree} done={run.done} />
      </View>
      <Text style={styles.progress}>
        {challengeProgress(run)}
        {run.done ? '' : ahead ? ' · sei in anticipo sul ritmo' : ' · sei indietro sul ritmo'}
      </Text>
    </View>
  );
}

export function PersonalChallenges({ week, month, now, onPress, tree }: { week: ChallengeRun; month: ChallengeRun; now: number; onPress?: () => void; tree?: TreeBadge | null }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={styles.card}>
      <Row label="Sfida della settimana" run={week} now={now} tree={tree} />
      <Row label="Sfida del mese" run={month} now={now} tree={tree} last />
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
