/** Pezzi di interfaccia per classifica, leghe e sfide. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  challengeRule,
  challengeState,
  gapPhrase,
  modePhrase,
  timeLeft,
  zoneFor,
  type Challenge,
  type Ranked,
  type Tier,
  type Zone,
} from '../core/social';
import type { TreeBadge } from '../core/plant';
import { CrownIcon, TrashIcon, TrendIcon } from './Icons';
import { TreeAvatar } from './TreeAvatar';
import { C, F, card } from './theme';

/** L'avatar è l'albero scelto dalla persona, cresciuto quanto la sua pianta. */
export function Avatar({ me = false, size = 36, tree }: { id: string; name: string; me?: boolean; size?: number; tree?: TreeBadge | null }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <TreeAvatar badge={tree} me={me} size={size} />
    </View>
  );
}

/** Selettore a due o tre voci. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((option, i) => {
        const active = option.id === value;
        const first = i === 0;
        const last = i === options.length - 1;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={[
              styles.segment,
              { borderTopLeftRadius: first ? 22 : 8, borderBottomLeftRadius: first ? 22 : 8, borderTopRightRadius: last ? 22 : 8, borderBottomRightRadius: last ? 22 : 8 },
              active && styles.segmentActive,
            ]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      {icon}
      <Text style={[styles.chipText, active && { color: C.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const TIER_COLOR: Record<Tier, string> = {
  Bronzo: '#D08A5B',
  Argento: '#C9D3DA',
  Oro: '#F2C94C',
  Platino: '#9FE3E0',
  Diamante: '#B9A7FF',
};

/** Scudetto del livello. */
export function TierBadge({ tier, size = 18 }: { tier: Tier; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: TIER_COLOR[tier], transform: [{ rotate: '45deg' }] }} />;
}

const PODIUM = [
  { place: 2, height: 72, avatar: 56, number: 34 },
  { place: 1, height: 96, avatar: 64, number: 44 },
  { place: 3, height: 54, avatar: 56, number: 30 },
] as const;

/** I primi tre, con il primo al centro. Con meno di tre partecipanti i gradini restano vuoti. */
export function Podium({ ranked }: { ranked: Ranked[] }) {
  return (
    <View style={styles.podium}>
      {PODIUM.map((step) => {
        const entry = ranked[step.place - 1];
        const first = step.place === 1;
        return (
          <View key={step.place} style={styles.podiumColumn}>
            {entry ? (
              <View
                style={styles.podiumPerson}
                accessible
                accessibilityLabel={`${entry.rank}º posto: ${entry.me ? 'tu' : entry.name}, ${entry.points} punti`}
              >
                {first ? <CrownIcon /> : null}
                <Avatar id={entry.id} name={entry.name} me={entry.me} size={step.avatar} tree={entry.tree} />
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.me ? 'Tu' : entry.name}
                </Text>
                <Text style={styles.podiumPoints}>{entry.points}</Text>
              </View>
            ) : null}
            <View style={[styles.podiumStep, { height: step.height }, first && { backgroundColor: C.lime }, step.place === 3 && { backgroundColor: C.coralSoft }]}>
              <Text style={[styles.podiumNumber, { fontSize: step.number }]}>{step.place}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const ZONE_TEXT: Record<Exclude<Zone, 'resta'>, string> = { sale: 'Sale di livello', scende: 'Scende di livello' };
/** Verde scuro e corallo scuro: si distinguono anche per luminosità, non solo per tinta. */
export const ZONE_UP = '#1E7A41';
export const ZONE_DOWN = C.alert;

/** Una riga della classifica. */
export function RankRow({ entry, ranked, zone }: { entry: Ranked; ranked: Ranked[]; zone?: Zone }) {
  const detail = entry.me ? gapPhrase(ranked, entry.id) : modePhrase(entry.mainMode);
  const zoneText = zone && zone !== 'resta' ? ZONE_TEXT[zone] : null;
  return (
    <View
      style={[styles.row, entry.me && styles.rowMe]}
      accessible
      accessibilityLabel={`${entry.rank}º: ${entry.me ? 'tu' : entry.name}, ${entry.points} punti${zoneText ? `, ${zoneText.toLowerCase()}` : ''}`}
    >
      <Text style={[styles.rowRank, entry.me && { color: C.ink }]}>{entry.rank}</Text>
      <Avatar id={entry.id} name={entry.name} me={entry.me} tree={entry.tree} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, entry.me && { color: C.ink }]} numberOfLines={1}>
          {entry.me ? 'Tu' : entry.name}
        </Text>
        <Text style={[styles.rowDetail, entry.me && { color: C.ink }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {zone === 'sale' ? <View style={[styles.zoneDot, { backgroundColor: ZONE_UP }]} /> : null}
      {zone === 'scende' ? <View style={[styles.zoneDot, { backgroundColor: ZONE_DOWN }]} /> : null}
      <Text style={[styles.rowPoints, entry.me && { color: C.ink }]}>{entry.points}</Text>
      <View style={styles.rowTrend}>{entry.trend ? <TrendIcon trend={entry.trend} /> : null}</View>
    </View>
  );
}

/** Zona di ogni posizione nella lega a livelli; senza livello nessuna zona. */
export function zonesFor(ranked: Ranked[], tier: Tier | undefined): Map<string, Zone> {
  const zones = new Map<string, Zone>();
  if (!tier) return zones;
  for (const entry of ranked) zones.set(entry.id, zoneFor(entry.rank, ranked.length, tier, entry.points));
  return zones;
}

/** Barra di avanzamento con il cerchio del partecipante in punta, come una gara su un rettilineo. */
function Track({ ratio, id, name, me, label, points, tree }: { ratio: number; id: string; name: string; me: boolean; label: string; points: number; tree?: TreeBadge | null }) {
  const percent = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={styles.track} accessible accessibilityLabel={`${label}: ${points} punti`}>
      <View style={styles.trackHead}>
        <Text style={styles.trackName} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.trackPoints}>{points}</Text>
      </View>
      <View style={styles.trackLine}>
        <View style={styles.trackRail} />
        <View style={[styles.trackFill, { right: `${100 - percent}%`, backgroundColor: me ? C.coral : '#B9DDF7' }]} />
        {/* Il cerchio resta dentro la corsia anche a 0% e a 100%. */}
        <View style={[styles.trackRunner, { left: `${percent}%` }]}>
          <View style={styles.trackRunnerInner}>
            <Avatar id={id} name={name} me={me} size={30} tree={tree} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function ChallengeCard({ challenge, now, onRemove }: { challenge: Challenge; now: number; onRemove?: () => void }) {
  const state = challengeState(challenge, now);
  const over = state.status === 'conclusa';
  const winnerNames = challenge.teams
    ? state.sides.filter((s) => s.ids.some((id) => state.winners.includes(id))).map((s) => s.name)
    : challenge.people.filter((p) => state.winners.includes(p.id)).map((p) => (p.me ? 'tu' : p.name));

  let verdict: string;
  if (!over) verdict = `Finisce tra ${timeLeft(challenge.endsAt, now)}`;
  else if (state.winners.length === 0) verdict = 'Conclusa senza punti: nessun vincitore';
  else if (state.won && winnerNames.length === 1) verdict = challenge.teams ? 'Ha vinto la tua squadra' : 'Hai vinto';
  else if (state.won) verdict = 'Pari merito: sei tra i vincitori';
  else verdict = `${winnerNames.length === 1 ? 'Ha vinto' : 'Hanno vinto'} ${winnerNames.join(' e ')}`;

  return (
    <View style={[styles.card, over && state.won && { borderWidth: 3, borderColor: C.lime }]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {challenge.title}
          </Text>
          <Text style={styles.cardRule}>{challengeRule(challenge)}</Text>
        </View>
        {onRemove && over ? (
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Elimina la sfida ${challenge.title}`} hitSlop={10} style={styles.cardRemove}>
            <TrashIcon size={18} color={C.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tracks}>
        {state.sides.map((side) => {
          const person = challenge.people.find((p) => p.id === side.ids[0]);
          return (
            <Track
              key={side.ids.join('+') || side.name}
              ratio={side.ratio}
              id={challenge.teams ? side.name : (person?.id ?? side.name)}
              name={side.name}
              me={side.me && !challenge.teams}
              label={challenge.teams ? `${side.name}${side.me ? ' (la tua)' : ''}` : side.me ? 'Tu' : side.name}
              points={side.points}
              tree={challenge.teams ? null : person?.tree}
            />
          );
        })}
      </View>

      <Text style={styles.cardVerdict}>{verdict}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarText: { fontFamily: F.displayBold, color: C.ink },

  segmented: { height: 48, flexDirection: 'row', gap: 2 },
  segment: { flex: 1, backgroundColor: C.tonal, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: C.strong },
  segmentText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  segmentTextActive: { color: C.onStrong },

  chip: {
    backgroundColor: C.tonal,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 200,
    marginBottom: 4,
  },
  chipActive: { backgroundColor: C.lime },
  chipText: { fontFamily: F.semi, fontSize: 14, color: C.text },

  podium: { height: 256, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  podiumColumn: { flex: 1, alignItems: 'center', gap: 6 },
  podiumPerson: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  podiumName: { fontFamily: F.bold, fontSize: 14, lineHeight: 18, color: C.text, maxWidth: '100%' },
  podiumPoints: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 22, color: C.text },
  podiumStep: { backgroundColor: C.tonal, alignSelf: 'stretch', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, alignItems: 'center', justifyContent: 'center' },
  podiumNumber: { fontFamily: F.displayBold, color: C.text },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 8, borderRadius: 16 },
  rowMe: { backgroundColor: C.lime, marginVertical: 2 },
  rowRank: { width: 22, fontFamily: F.displayBold, fontSize: 16, color: C.text, textAlign: 'center' },
  rowText: { flex: 1 },
  rowName: { fontFamily: F.bold, fontSize: 15, lineHeight: 19, color: C.text },
  rowDetail: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 16, color: C.dim },
  rowPoints: { fontFamily: F.displayBold, fontSize: 17, color: C.text, minWidth: 34, textAlign: 'right' },
  rowTrend: { width: 16, alignItems: 'center' },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },

  card: { ...card, borderRadius: 28, padding: 18, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 22, color: C.text },
  cardRule: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.dim },
  cardRemove: { backgroundColor: C.tonal, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardVerdict: { fontFamily: F.bold, fontSize: 13.5, color: C.text },

  tracks: { gap: 12 },
  track: { gap: 6 },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  trackName: { flex: 1, fontFamily: F.bold, fontSize: 13.5, color: C.text },
  trackPoints: { fontFamily: F.displayBold, fontSize: 15, color: C.text },
  trackLine: { height: 30, justifyContent: 'center', marginHorizontal: 15 },
  trackRail: { position: 'absolute', left: -15, right: -15, height: 12, borderRadius: 6, backgroundColor: C.tonal },
  trackFill: { position: 'absolute', left: -15, height: 12, borderRadius: 6 },
  trackRunner: { position: 'absolute', width: 0, height: 30, alignItems: 'center' },
  trackRunnerInner: { width: 30, height: 30 },
});
