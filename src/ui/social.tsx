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
import { C, F } from './theme';

/** Colori dei cerchi con le iniziali: fissi per nome, così ognuno resta riconoscibile. */
const TONES = [C.teal, C.coral, '#3B6E82', '#8FB8C8', '#E0A458'] as const;

function toneFor(id: string): string {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return TONES[sum % TONES.length];
}

export function Avatar({ id, name, me = false, size = 34, ring = false }: { id: string; name: string; me?: boolean; size?: number; ring?: boolean }) {
  const background = me ? C.lime : toneFor(id);
  const dark = me || background === C.coral || background === '#8FB8C8' || background === '#E0A458';
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
        ring && { borderWidth: 3, borderColor: C.text },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36, color: dark ? C.ink : C.text }]}>{me ? 'TU' : initials(name)}</Text>
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
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon}
      <Text style={[styles.chipText, active && { color: C.ink, fontFamily: F.bold }]} numberOfLines={1}>
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
  return <View style={{ width: size, height: size, borderRadius: size / 3, backgroundColor: TIER_COLOR[tier], borderWidth: 2, borderColor: C.text, transform: [{ rotate: '45deg' }] }} />;
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
                <Avatar id={entry.id} name={entry.name} me={entry.me} size={step.avatar} ring />
                <Text style={styles.podiumName} numberOfLines={1}>
                  {entry.me ? 'Tu' : entry.name}
                </Text>
                <Text style={[styles.podiumPoints, first && { color: C.lime }]}>{entry.points}</Text>
              </View>
            ) : null}
            <View style={[styles.podiumStep, { height: step.height }]}>
              <Text style={[styles.podiumNumber, { fontSize: step.number }, first && { color: C.lime, fontFamily: F.displayBold }]}>{step.place}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const ZONE_TEXT: Record<Exclude<Zone, 'resta'>, string> = { sale: 'Sale di livello', scende: 'Scende di livello' };

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
      <Text style={[styles.rowRank, entry.me && { color: C.lime }]}>{entry.rank}</Text>
      <Avatar id={entry.id} name={entry.name} me={entry.me} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, entry.me && { fontFamily: F.bold }]} numberOfLines={1}>
          {entry.me ? 'Tu' : entry.name}
        </Text>
        <Text style={[styles.rowDetail, entry.me && { color: 'rgba(255, 255, 255, 0.8)' }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {zone === 'sale' ? <View style={[styles.zoneDot, { backgroundColor: C.lime }]} /> : null}
      {zone === 'scende' ? <View style={[styles.zoneDot, { backgroundColor: C.coral }]} /> : null}
      <Text style={[styles.rowPoints, entry.me && { color: C.lime }]}>{entry.points}</Text>
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
        <Text style={[styles.trackName, me && { color: C.lime, fontFamily: F.bold }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.trackPoints, me && { color: C.lime }]}>{points}</Text>
      </View>
      <View style={styles.trackLine}>
        <View style={styles.trackRail} />
        <View style={[styles.trackFill, { width: `${percent}%`, backgroundColor: me ? C.lime : 'rgba(255, 255, 255, 0.45)' }]} />
        {/* Il cerchio resta dentro la corsia anche a 0% e a 100%. */}
        <View style={[styles.trackRunner, { left: `${percent}%` }]}>
          <View style={styles.trackRunnerInner}>
            <Avatar id={id} name={name} me={me} size={26} ring />
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
    <View style={[styles.card, over && state.won && { borderColor: C.lime }]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {challenge.title}
          </Text>
          <Text style={styles.cardRule}>{challengeRule(challenge)}</Text>
        </View>
        {onRemove && over ? (
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Elimina la sfida ${challenge.title}`} hitSlop={10} style={styles.cardRemove}>
            <TrashIcon size={18} color={C.dim} />
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

      <Text style={[styles.cardVerdict, over && state.won && { color: C.lime }]}>{verdict}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: F.display },

  segmented: {
    height: 52,
    padding: 4,
    borderRadius: 26,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segment: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: C.lime },
  segmentText: { fontFamily: F.semi, fontSize: 14, color: 'rgba(255, 255, 255, 0.85)' },
  segmentTextActive: { fontFamily: F.bold, color: C.ink },

  chip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: C.lime, borderColor: C.lime },
  chipText: { fontFamily: F.semi, fontSize: 14, color: C.text },

  podium: { height: 250, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  podiumColumn: { flex: 1, alignItems: 'center', gap: 6 },
  podiumPerson: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  podiumName: { fontFamily: F.semi, fontSize: 14, lineHeight: 18, color: C.text, maxWidth: '100%' },
  podiumPoints: { fontFamily: F.display, fontSize: 18, lineHeight: 22, color: C.text },
  podiumStep: {
    alignSelf: 'stretch',
    borderRadius: 18,
    backgroundColor: C.panel,
    borderColor: C.panelBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumNumber: { fontFamily: F.display, color: C.text },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 8, borderRadius: 14 },
  rowMe: { backgroundColor: C.limeSoft },
  rowRank: { width: 22, fontFamily: F.display, fontSize: 16, color: C.text, textAlign: 'center' },
  rowText: { flex: 1 },
  rowName: { fontFamily: F.semi, fontSize: 15, lineHeight: 19, color: C.text },
  rowDetail: { fontFamily: F.body, fontSize: 12.5, lineHeight: 16, color: C.dim },
  rowPoints: { fontFamily: F.display, fontSize: 17, color: C.text, minWidth: 34, textAlign: 'right' },
  rowTrend: { width: 16, alignItems: 'center' },
  zoneDot: { width: 8, height: 8, borderRadius: 4 },

  card: { backgroundColor: C.panel, borderColor: C.panelBorder, borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontFamily: F.display, fontSize: 18, lineHeight: 22, color: C.text },
  cardRule: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.dim },
  cardRemove: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  cardVerdict: { fontFamily: F.semi, fontSize: 13.5, color: C.text },

  tracks: { gap: 12 },
  track: { gap: 6 },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  trackName: { flex: 1, fontFamily: F.semi, fontSize: 13.5, color: C.text },
  trackPoints: { fontFamily: F.display, fontSize: 15, color: C.text },
  trackLine: { height: 26, justifyContent: 'center', marginHorizontal: 13 },
  trackRail: { position: 'absolute', left: -13, right: -13, height: 8, borderRadius: 4, backgroundColor: C.faint },
  trackFill: { position: 'absolute', left: -13, height: 8, borderRadius: 4, marginRight: 0 },
  trackRunner: { position: 'absolute', width: 0, height: 26, alignItems: 'center' },
  trackRunnerInner: { width: 26, height: 26 },
});
