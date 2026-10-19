/**
 * Schermata "Medaglie", la bacheca: medaglie a gradi, la vetrina da mostrare
 * in classifica, le sfide personali e lo storico delle vittorie.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TIER_NAMES, badgeStates, nextBadge, progressLabel, type BadgeContext, type BadgeState } from '../core/badges';
import { challengeProgress, completedChallenges, monthlyAt, weeklyAt } from '../core/challenges';
import { isHalloweenSeason } from '../core/look';
import type { Trip } from '../core/scoring';
import { journeyById } from '../core/journeys';
import { social } from '../social';
import { loadJourneys, NO_JOURNEY, type JourneyState } from '../storage/journey';
import { loadBadgeContext, loadChosen, pickShowcase, saveChosen } from '../storage/showcase';
import { loadTrips } from '../storage/trips';
import { loadWins, NO_WINS, type Wins } from '../storage/wins';
import { useActiveTrip } from '../tracking/store';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { PersonalChallenges } from '../ui/ChallengeCard';
import { Group, SectionTitle } from '../ui/expressive';
import { HeroBlock } from '../ui/Hero';
import { Medal, TIER_COLORS, type MedalLook } from '../ui/Medal';
import { buzz } from '../ui/motion';
import { ProgressBar, Screen, text } from '../ui/parts';
import { C, F, R } from '../ui/theme';
import { WavyBar } from '../ui/Wavy';

const clock = () => Date.now();

function look(badge: BadgeState): MedalLook {
  if (badge.unlocked) return 'sbloccata';
  return badge.value > 0 ? 'in-corso' : 'bloccata';
}

function medalLabel(badge: BadgeState): string {
  const tier = badge.level > 0 && badge.tiers.length > 1 ? `, grado ${TIER_NAMES[badge.level - 1].toLowerCase()}` : '';
  if (badge.unlocked) return `Medaglia ${badge.name}${tier}`;
  return badge.value > 0 ? `Medaglia ${badge.name}, in corso: ${progressLabel(badge)}` : `Medaglia ${badge.name}, bloccata`;
}

function weekText(ts: number): string {
  const d = new Date(ts);
  return `settimana del ${d.getDate()}/${d.getMonth() + 1}`;
}

export default function Medaglie() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ctx, setCtx] = useState<BadgeContext>({ podiums: 0, journeys: 0 });
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [wins, setWins] = useState<Wins>(NO_WINS);
  const [journeys, setJourneys] = useState<JourneyState>(NO_JOURNEY);
  const [now, setNow] = useState(() => Date.now());
  const active = useActiveTrip();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setNow(Date.now());
      Promise.all([loadTrips(), loadBadgeContext(), loadChosen(), loadWins(), loadJourneys()]).then(([t, c, ch, w, j]) => {
        if (!alive) return;
        setTrips(t);
        setCtx(c);
        setChosen(ch);
        setWins(w);
        setJourneys(j);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const all = badgeStates(trips, now, ctx);
  // Le medaglie a tempo non contano nel totale: compaiono quando si possono prendere o quando le hai.
  const badges = all.filter((b) => !b.seasonal);
  const seasonal = all.filter((b) => b.seasonal && (b.unlocked || isHalloweenSeason(now)));
  const unlocked = badges.filter((b) => b.unlocked).length;
  const next = nextBadge(badges);
  const earned = [...badges.filter((b) => b.unlocked), ...seasonal.filter((b) => b.unlocked)];
  const todo = badges.filter((b) => !b.complete && b.id !== next?.id).sort((x, y) => Number(x.unlocked) - Number(y.unlocked) || y.ratio - x.ratio);
  const timed = seasonal.filter((b) => !b.unlocked);
  const showcase = pickShowcase(all, chosen);
  const missing = next ? remaining(next) : '';

  const leagueWins = wins.leagues.filter((l) => l.rank > 0 && l.people >= 2);
  const medalsOf = [1, 2, 3].map((r) => leagueWins.filter((l) => l.rank === r).length);
  const done = completedChallenges(trips, now);
  const duelsWon = wins.duels.filter((d) => d.won).length;

  async function toggleShowcase(id: string) {
    buzz('tocco');
    const current: string[] = showcase.map((b) => b.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-3);
    setChosen(next);
    await saveChosen(next);
    social.sync(clock()).catch(() => undefined);
  }

  return (
    <Screen bleed>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <HeroBlock caption={`${unlocked} di ${badges.length} sbloccate`} title="Medaglie" color={C.coralSoft}>
          {next ? (
            <>
              <View style={styles.next}>
                <Medal id={next.id} look="sbloccata" size={108} level={next.level} label={`Medaglia ${next.name}`} />
                <View style={styles.nextText}>
                  <View style={styles.nextChip}>
                    <Text style={styles.nextCaption}>
                      {next.level > 0 ? `Verso il grado ${TIER_NAMES[next.level].toLowerCase()}` : 'Prossima medaglia'}
                    </Text>
                  </View>
                  <Text style={styles.nextName} accessibilityRole="header">
                    {next.name}
                  </Text>
                  <Text style={styles.nextGoal}>{next.goalText}</Text>
                </View>
              </View>
              <ProgressBar value={next.value} max={next.target} label={progressLabel(next)} detail={missing} color={C.onCoral} track="rgba(58, 19, 6, 0.16)" />
            </>
          ) : (
            <View style={styles.nextText}>
              <Text style={styles.nextName}>Tutte all&apos;oro</Text>
              <Text style={styles.nextGoal}>Hai preso ogni grado di ogni medaglia.</Text>
            </View>
          )}
        </HeroBlock>

        <View style={styles.body}>
          <SectionTitle title="Sfide in corso" />
          <PersonalChallenges week={weeklyAt(trips, now)} month={monthlyAt(trips, now)} now={now} />

          <SectionTitle title="La tua vetrina" />
          <View style={styles.showcase}>
            {showcase.length === 0 ? (
              <Text style={[text.body, { padding: 6 }]}>Qui vanno le tre medaglie che gli altri vedono accanto al tuo nome in classifica.</Text>
            ) : (
              showcase.map((b) => (
                <View key={b.id} style={styles.cell}>
                  <Medal id={b.id} look="sbloccata" size={72} level={b.level} label={medalLabel(b)} />
                  <Text style={styles.cellName} numberOfLines={2}>
                    {b.name}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Text style={[text.small, styles.hint]}>Tocca una medaglia qui sotto per metterla o toglierla dalla vetrina.</Text>

          <SectionTitle title="Le tue medaglie" />
          <View style={styles.shelf}>
            {earned.length === 0 ? (
              <Text style={[text.body, { padding: 8 }]}>Ancora nessuna: la prima arriva con il primo tragitto a piedi.</Text>
            ) : (
              earned.map((badge) => {
                const inShowcase = showcase.some((s) => s.id === badge.id);
                return (
                  <Pressable
                    key={badge.id}
                    style={[styles.cell, inShowcase && styles.cellOn]}
                    onPress={() => toggleShowcase(badge.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: inShowcase }}
                    accessibilityLabel={`${medalLabel(badge)}${inShowcase ? ', in vetrina' : ''}`}
                  >
                    <Medal id={badge.id} look="sbloccata" size={76} level={badge.level} label={medalLabel(badge)} />
                    <Text style={styles.cellName} numberOfLines={2}>
                      {badge.name}
                    </Text>
                    {badge.tiers.length > 1 ? (
                      <View style={styles.tiers}>
                        {badge.tiers.map((_, i) => (
                          <View key={i} style={[styles.tierDot, { backgroundColor: i < badge.level ? TIER_COLORS[i] : C.faint }]} />
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })
            )}
          </View>

          {todo.length > 0 ? (
            <>
              <SectionTitle title="Da conquistare" />
              <Group>
                {todo.map((badge) => (
                  <View key={badge.id} style={styles.row}>
                    <Medal id={badge.id} look={look(badge)} size={54} level={badge.level} label={medalLabel(badge)} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>
                        {badge.name}
                        {badge.level > 0 ? ` · ${TIER_NAMES[badge.level].toLowerCase()}` : ''}
                      </Text>
                      {badge.value > 0 ? <WavyBar ratio={badge.ratio} height={14} stroke={4.5} style={styles.rowBar} /> : null}
                      <Text style={text.small}>{badge.value > 0 ? `${progressLabel(badge)} · ${badge.goalText}` : badge.goalText}</Text>
                    </View>
                  </View>
                ))}
              </Group>
            </>
          ) : null}

          {timed.length > 0 ? (
            <>
              <SectionTitle title="Medaglia a tempo" />
              <Group>
                {timed.map((badge) => (
                  <View key={badge.id} style={styles.row}>
                    <Medal id={badge.id} look="in-corso" size={54} label={medalLabel(badge)} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{badge.name}</Text>
                      <Text style={text.small}>{badge.goalText}. Si prende solo quella sera.</Text>
                    </View>
                  </View>
                ))}
              </Group>
            </>
          ) : null}

          <SectionTitle title="Vittorie" />
          <View style={styles.wins}>
            <View style={styles.podiumRow}>
              {['1º', '2º', '3º'].map((label, i) => (
                <View key={label} style={styles.podiumCell}>
                  <View style={[styles.podiumDot, { backgroundColor: TIER_COLORS[2 - i] }]}>
                    <Text style={styles.podiumNum}>{label}</Text>
                  </View>
                  <Text style={styles.podiumCount}>{medalsOf[i]}</Text>
                  <Text style={text.small}>{medalsOf[i] === 1 ? 'settimana' : 'settimane'}</Text>
                </View>
              ))}
            </View>
            <Text style={[text.small, { textAlign: 'center' }]}>
              Sfide con gli amici vinte: {duelsWon} su {wins.duels.length} · sfide personali completate: {done.length} · percorsi finiti: {journeys.done.length}
            </Text>
          </View>
          {leagueWins.length + done.length + journeys.done.length > 0 ? (
            <Group>
              {[
                ...leagueWins.map((l) => ({ at: l.week + 7 * 864e5, title: `${l.rank}º in ${l.league}`, detail: `${weekText(l.week)} · ${l.points} punti`, key: `l${l.leagueId}${l.week}` })),
                ...done.map((d) => ({ at: d.to, title: d.title, detail: `${d.id.startsWith('s-') ? 'Sfida della settimana' : 'Sfida del mese'} · ${challengeProgress(d)}`, key: `c${d.id}${d.from}` })),
                ...wins.duels.filter((d) => d.won).map((d) => ({ at: d.endsAt, title: `Vinta: ${d.title}`, detail: 'Sfida con gli amici', key: `d${d.id}` })),
                ...journeys.done.map((j) => ({ at: j.doneAt, title: journeyById(j.id)?.name ?? j.id, detail: 'Percorso virtuale completato', key: `j${j.id}${j.doneAt}` })),
              ]
                .sort((a, b) => b.at - a.at)
                .slice(0, 12)
                .map((w) => (
                  <View key={w.key} style={styles.winRow}>
                    <Text style={styles.rowName}>{w.title}</Text>
                    <Text style={text.small}>{w.detail}</Text>
                  </View>
                ))}
            </Group>
          ) : null}

          <Text style={[text.small, styles.rule]}>
            Contano solo i tratti validi. Per le medaglie a numero di tragitti servono almeno 500 metri senza auto. Le vittorie in lega si
            registrano quando apri la classifica.
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
  const decimals = badge.unit === 'km' || badge.unit === 'kg';
  const n = decimals ? Math.ceil(left * 10) / 10 : Math.ceil(left);
  const value = String(n).replace('.', ',');
  const unit = badge.unit === 'km' ? ' km' : badge.unit === 'kg' ? ' kg' : badge.unit === 'giorni' ? (n === 1 ? ' giorno' : ' giorni') : '';
  return `${n === 1 && !decimals ? 'ne manca' : 'ne mancano'} ${value}${unit}`;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  nextText: { flex: 1, gap: 4, alignItems: 'flex-start' },
  nextChip: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: C.strong, justifyContent: 'center' },
  nextCaption: { fontFamily: F.bold, fontSize: 12, color: C.onStrong },
  nextName: { fontFamily: F.displayBold, fontSize: 27, lineHeight: 32, color: C.onCoral },
  nextGoal: { fontFamily: F.medium, fontSize: 14, lineHeight: 19, color: C.onCoralDim },
  showcase: { flexDirection: 'row', backgroundColor: C.card, borderRadius: R.card, paddingVertical: 14, paddingHorizontal: 6, minHeight: 80 },
  hint: { textAlign: 'center' },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: C.card, borderRadius: 32, paddingVertical: 12, paddingHorizontal: 6, rowGap: 8 },
  cell: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 20 },
  cellOn: { backgroundColor: C.tonal },
  cellName: { fontFamily: F.bold, fontSize: 13, lineHeight: 17, color: C.text, textAlign: 'center' },
  tiers: { flexDirection: 'row', gap: 4 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowText: { flex: 1, gap: 3 },
  rowName: { fontFamily: F.bold, fontSize: 15, color: C.text },
  rowBar: { width: '80%' },
  wins: { backgroundColor: C.card, borderRadius: R.card, padding: 16, gap: 12 },
  podiumRow: { flexDirection: 'row' },
  podiumCell: { flex: 1, alignItems: 'center', gap: 2 },
  podiumDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  podiumNum: { fontFamily: F.displayBold, fontSize: 15, color: C.ink },
  podiumCount: { fontFamily: F.displayBold, fontSize: 24, color: C.text },
  winRow: { paddingVertical: 10, gap: 2 },
  rule: { textAlign: 'center', paddingHorizontal: 12, lineHeight: 18, marginTop: 6 },
});
