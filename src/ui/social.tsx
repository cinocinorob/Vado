/** Pezzi di interfaccia per classifica, leghe e sfide. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  challengeRule,
  challengeState,
  gapPhrase,
  initials,
  modePhrase,
  timeLeft,
  zoneFor,
  type Challenge,
  type Ranked,
  type Tier,
  type Zone,
} from '../core/social';
import { CrownIcon, TrashIcon, TrendIcon } from './Icons';
import { BORDER, C, F, card, shadow } from './theme';

/** Colori dei cerchi con le iniziali: fissi per nome, così ognuno resta riconoscibile. */
const TONES = ['#A5DDEB', C.coral, '#FFD35C', C.coralSoft, '#D9CCFF'] as const;

function toneFor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return TONES[sum % TONES.length];
}

export function Avatar({ id, name, me = false, size = 36 }: { id: string; name: string; me?: boolean; size?: number }) {
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: me ? C.lime : toneFor(id), borderWidth: size >= 50 ? BORDER : 2.5 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{me ? 'TU' : initials(name)}</Text>
    </View>
  );
}

/** Selettore a due o tre voci. */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={[styles.segment, active && styles.segmentActive]}
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
      style={[styles.chip, active ? [styles.chipActive, shadow(3)] : null]}
    >
      {icon}
      <Text style={styles.chipText} numberOfLines={1}>
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
  return <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: TIER_COLOR[tier], borderWidth: 2.5, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />;
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
                <Avatar id={entry.id} name={entry.name} me={entry.me} size={step.avatar} />
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.me ? 'Tu' : entry.name}
                </Text>
                <Text style={styles.podiumPoints}>{entry.points}</Text>
              </View>
            ) : null}
            <View style={[styles.podiumStep, { height: step.height }, first && { backgroundColor: C.lime }]}>
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
      <Text style={styles.rowRank}>{entry.rank}</Text>
      <Avatar id={entry.id} name={entry.name} me={entry.me} />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.me ? 'Tu' : entry.name}
        </Text>
        <Text style={[styles.rowDetail, entry.me && { color: C.ink }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {zone === 'sale' ? <View style={[styles.zoneDot, { backgroundColor: ZONE_UP }]} /> : null}
      {zone === 'scende' ? <View style={[styles.zoneDot, { backgroundColor: ZONE_DOWN }]} /> : null}
      <Text style={styles.rowPoints}>{entry.points}</Text>
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
function Track({ ratio, id, name, me, label, points }: { ratio: number; id: string; name: string; me: boolean; label: string; points: number }) {
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
        <View style={[styles.trackFill, { right: `${100 - percent}%`, backgroundColor: me ? C.coral : '#A5DDEB' }]} />
        {/* Il cerchio resta dentro la corsia anche a 0% e a 100%. */}
        <View style={[styles.trackRunner, { left: `${percent}%` }]}>
          <View style={styles.trackRunnerInner}>
            <Avatar id={id} name={name} me={me} size={30} />
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
    <View style={[styles.card, over && state.won && { backgroundColor: C.lime }]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {challenge.title}
          </Text>
          <Text style={styles.cardRule}>{challengeRule(challenge)}</Text>
        </View>
        {onRemove && over ? (
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Elimina la sfida ${challenge.title}`} hitSlop={10} style={styles.cardRemove}>
            <TrashIcon size={18} color={C.ink} />
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
            />
          );
        })}
      </View>

      <Text style={styles.cardVerdict}>{verdict}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderColor: C.ink },
  avatarText: { fontFamily: F.displayBold, color: C.ink },

  segmented: { ...card, height: 54, padding: 4, borderRadius: 27, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: C.ink },
  segmentText: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  segmentTextActive: { color: C.lime },

  chip: {
    ...card,
    borderWidth: 2.5,
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
  chipText: { fontFamily: F.bold, fontSize: 14, color: C.ink },

  podium: { height: 256, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  podiumColumn: { flex: 1, alignItems: 'center', gap: 6 },
  podiumPerson: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  podiumName: { fontFamily: F.bold, fontSize: 14, lineHeight: 18, color: C.text, maxWidth: '100%' },
  podiumPoints: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 22, color: C.text },
  podiumStep: { ...card, alignSelf: 'stretch', borderRadius: 18, alignItems: 'center', justifyContent: 'center', ...shadow(5) },
  podiumNumber: { fontFamily: F.displayBold, color: C.text },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 8, borderRadius: 16 },
  rowMe: { backgroundColor: C.lime, borderColor: C.ink, borderWidth: 2.5, marginVertical: 2 },
  rowRank: { width: 22, fontFamily: F.displayBold, fontSize: 16, color: C.text, textAlign: 'center' },
  rowText: { flex: 1 },
  rowName: { fontFamily: F.bold, fontSize: 15, lineHeight: 19, color: C.text },
  rowDetail: { fontFamily: F.medium, fontSize: 12.5, lineHeight: 16, color: C.dim },
  rowPoints: { fontFamily: F.displayBold, fontSize: 17, color: C.text, minWidth: 34, textAlign: 'right' },
  rowTrend: { width: 16, alignItems: 'center' },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },

  card: { ...card, borderRadius: 24, padding: 16, gap: 14, ...shadow(5) },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 22, color: C.text },
  cardRule: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.dim },
  cardRemove: { ...card, borderWidth: 2.5, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  cardVerdict: { fontFamily: F.bold, fontSize: 13.5, color: C.text },

  tracks: { gap: 12 },
  track: { gap: 6 },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  trackName: { flex: 1, fontFamily: F.bold, fontSize: 13.5, color: C.text },
  trackPoints: { fontFamily: F.displayBold, fontSize: 15, color: C.text },
  trackLine: { height: 30, justifyContent: 'center', marginHorizontal: 15 },
  trackRail: { position: 'absolute', left: -15, right: -15, height: 14, borderRadius: 7, backgroundColor: C.card, borderColor: C.ink, borderWidth: 2.5 },
  trackFill: { position: 'absolute', left: -15, height: 14, borderTopLeftRadius: 7, borderBottomLeftRadius: 7, borderColor: C.ink, borderWidth: 2.5 },
  trackRunner: { position: 'absolute', width: 0, height: 30, alignItems: 'center' },
  trackRunnerInner: { width: 30, height: 30 },
});
