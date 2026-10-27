/** Schermata "Classifica": leghe (a livelli e con invito) e sfide. */
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  PROMOTED,
  RELEGATED,
  TIERS,
  rankEntries,
  timeLeft,
  weekLabel,
  type Challenge,
  type Ranked,
  type Zone,
} from '../core/social';
import { challengeProgress, monthlyAt, type ChallengeRun } from '../core/challenges';
import type { SpeciesId, TreeBadge } from '../core/plant';
import { monthStart } from '../core/social';
import { candyOpen } from '../core/halloween';
import { myTree, social, type CandyEntry, type LeagueBoard, type LeagueSummary, type Profile } from '../social';
import { recordWins } from '../social/history';
import { leagueToOpen } from '../social/selection';
import type { PeriodEntry } from '../social/types';
import { loadTrips } from '../storage/trips';
import { loadTree, saveTree } from '../storage/tree';
import { useActiveTrip } from '../tracking/store';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { PlusIcon, ShareIcon } from '../ui/Icons';
import { Mascot } from '../ui/Mascot';
import { HeroBlock } from '../ui/Hero';
import { Divider, GUTTER, GhostButton, PLACEHOLDER, Panel, PrimaryButton, Screen, input, text } from '../ui/parts';
import { WavyBar } from '../ui/Wavy';
import { Avatar, ChallengeCard, ShowcaseMini, Chip, Podium, RankRow, Segmented, TierBadge, ZONE_DOWN, ZONE_UP, zonesFor } from '../ui/social';
import { C, F } from '../ui/theme';
import { TreePicker } from '../ui/TreeAvatar';
import { Candy } from '../ui/Halloween';

type Section = 'leghe' | 'sfide';

/** L'ora corrente, letta solo in risposta a un tocco o a un ritorno sulla schermata. */
const clock = () => Date.now();

const OUTCOME_TEXT: Record<Zone, (from: string, to: string) => string> = {
  sale: (_from, to) => `Settimana scorsa sei salito in ${to}.`,
  scende: (_from, to) => `Settimana scorsa sei sceso in ${to}.`,
  resta: (from) => `Settimana scorsa sei rimasto in ${from}.`,
};

export default function Classifica() {
  const active = useActiveTrip();
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [section, setSection] = useState<Section>('leghe');
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [board, setBoard] = useState<LeagueBoard | null>(null);
  const [sweets, setSweets] = useState<CandyEntry[] | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [monthly, setMonthly] = useState<ChallengeRun | null>(null);
  const [monthBoard, setMonthBoard] = useState<PeriodEntry[] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  /** Il proprio avatar si prende dal telefono: è sempre aggiornato, anche prima che arrivi al server. */
  const [mine, setMine] = useState<TreeBadge | null>(null);

  useFocusEffect(
    useCallback(() => {
      myTree()
        .then(setMine)
        .catch(() => undefined);
    }, []),
  );

  const refresh = useCallback(async (wanted: string | null) => {
    const at = clock();
    setNow(at);
    const who = await social.profile();
    setProfile(who);
    if (!who) {
      setLoaded(true);
      return;
    }
    const list = await social.leagues(at);
    const id = wanted && list.some((l) => l.id === wanted) ? wanted : (list[0]?.id ?? null);
    const [nextBoard, nextChallenges, trips, nextMonthBoard] = await Promise.all([
      id ? social.board(id, at) : Promise.resolve(null),
      social.challenges(at),
      loadTrips(),
      id ? social.periodBoard(id, monthStart(at), at).catch(() => null) : Promise.resolve(null),
    ]);
    const nextMonthly = monthlyAt(trips, at);
    setMonthBoard(nextMonthBoard);
    // Le vittorie (settimane chiuse in lega, sfide finite) si annotano qui, in sottofondo.
    recordWins(at, nextChallenges).catch(() => undefined);
    setLeagues(list);
    setLeagueId(id);
    setBoard(nextBoard);
    setSweets(id && candyOpen(at) ? await social.candies(id, at) : null);
    setChallenges(nextChallenges);
    setMonthly(nextMonthly);
    setConfirmLeave(false);
    // Se il server non ha risposto si vedono gli ultimi dati buoni, con un avviso.
    setProblem(social.problem());
    setLoaded(true);
  }, []);

  async function pull() {
    setPulling(true);
    await refresh(leagueId).catch(() => undefined);
    setPulling(false);
  }

  // A ogni ritorno sulla schermata: dati aggiornati, e se è appena stata
  // creata una lega si apre quella.
  useFocusEffect(
    useCallback(() => {
      const opened = leagueToOpen.take();
      refresh(opened ?? leagueId).catch(() => setLoaded(true));
      // leagueId è volutamente fuori dalle dipendenze: cambiare lega non deve ricaricare tutto due volte.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh]),
  );

  async function select(id: string) {
    setLeagueId(id);
    setConfirmLeave(false);
    setBoard(await social.board(id, clock()));
    setSweets(candyOpen(clock()) ? await social.candies(id, clock()) : null);
    setProblem(social.problem());
  }

  /** Pressione lunga su un altro partecipante: segnala il soprannome. */
  function report(entry: Ranked) {
    if (entry.name === 'Soprannome nascosto') return;
    Alert.alert(
      `Segnalare "${entry.name}"?`,
      'Se il soprannome è offensivo o inappropriato. Con due segnalazioni di persone diverse viene nascosto a tutti finché non lo cambia.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Segnala',
          style: 'destructive',
          onPress: async () => {
            const result = await social.report(entry.id);
            Alert.alert(result.ok ? 'Segnalazione inviata' : 'Non inviata', result.ok ? (result.value.hidden ? 'Il soprannome ora è nascosto.' : 'Grazie: se lo segnala anche qualcun altro, viene nascosto.') : result.problem);
            if (result.ok) refresh(leagueId).catch(() => undefined);
          },
        },
      ],
    );
  }

  async function invite() {
    if (!board?.code) return;
    try {
      await Share.share({ message: `Entra nella mia lega "${board.name}" su Vado con il codice ${board.code}` });
    } catch {
      // Condivisione non disponibile o annullata: il codice resta scritto sullo schermo.
    }
  }

  async function leave() {
    if (!board || board.kind !== 'invito') return;
    if (!confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    await social.leaveLeague(board.id);
    await refresh(null);
  }

  async function remove(id: string) {
    await social.removeChallenge(id);
    setChallenges(await social.challenges(clock()));
  }

  if (!loaded) {
    return (
      <Screen bleed>
        <HeroBlock caption={weekLabel(now)} title="Classifica" />
        <BottomNav current="classifica" tripActive={!!active} />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen bleed>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <HeroBlock caption={weekLabel(now)} title="Classifica" />
          <View style={styles.body}>
            <Nickname onDone={() => refresh(null)} />
          </View>
        </ScrollView>
        <BottomNav current="classifica" tripActive={!!active} />
      </Screen>
    );
  }

  const withMine = <T extends { me?: boolean; tree?: TreeBadge | null }>(e: T): T => (e.me && mine ? { ...e, tree: mine } : e);
  const ranked = board ? rankEntries(board.entries.map(withMine)) : [];
  const zones = zonesFor(ranked, board?.tier);
  const rest = ranked.slice(3);
  const nextTier = board?.tier ? TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(board.tier) + 1)] : null;
  const lowerTier = board?.tier ? TIERS[Math.max(0, TIERS.indexOf(board.tier) - 1)] : null;

  return (
    <Screen bleed>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} colors={[C.text]} tintColor={C.text} />}
      >
        <HeroBlock
          caption={weekLabel(now)}
          title="Classifica"
          color={C.bg}
          style={styles.heroTabs}
          right={
            section === 'leghe' && board?.kind === 'invito' ? (
              <Pressable
                onPress={invite}
                accessibilityRole="button"
                accessibilityLabel="Invita con il codice della lega"
                style={({ pressed }) => [styles.invite, pressed && { opacity: 0.8 }]}
              >
                <ShareIcon size={18} />
                <Text style={styles.inviteText}>Invita</Text>
              </Pressable>
            ) : null
          }
        >
          <View style={styles.sections}>
            <Segmented
              label="Sezione"
              value={section}
              onChange={setSection}
              options={[
                { id: 'leghe', label: 'Leghe' },
                { id: 'sfide', label: 'Sfide' },
              ]}
            />
          </View>
        </HeroBlock>

        <View style={styles.body}>
        {social.demo ? (
          <View style={styles.demo} accessibilityRole="alert">
            <Text style={styles.demoText}>
              Anteprima: gli altri partecipanti sono di esempio, i tuoi punti sono veri. Le persone reali arrivano quando colleghiamo il
              server.
            </Text>
          </View>
        ) : null}

        {problem ? (
          <View style={styles.demo} accessibilityRole="alert">
            <Text style={styles.demoText}>{problem} Quello che vedi può non essere aggiornato: trascina verso il basso per riprovare.</Text>
          </View>
        ) : null}

        {section === 'leghe' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBleed}>
              {leagues.map((league) => (
                <Chip
                  key={league.id}
                  label={league.kind === 'livelli' ? `Lega ${league.name}` : league.name}
                  active={league.id === leagueId}
                  onPress={() => select(league.id)}
                  icon={league.tier ? <TierBadge tier={league.tier} size={14} /> : undefined}
                />
              ))}
              <Chip label="Nuova lega" onPress={() => router.push('/lega-nuova')} icon={<PlusIcon size={16} />} />
            </ScrollView>

            {leagues.length === 0 ? (
              <Panel style={styles.empty}>
                <Mascot size={84} tilt={-6} />
                <Text style={styles.tierTitle} accessibilityRole="header">
                  Ancora nessuna lega
                </Text>
                <Text style={[text.body, { textAlign: 'center' }]}>
                  Creane una e manda il codice a chi vuoi sfidare, oppure entra in quella di un amico con il suo codice.
                </Text>
                <View style={{ alignSelf: 'stretch' }}>
                  <PrimaryButton label="Crea o entra in una lega" onPress={() => router.push('/lega-nuova')} />
                </View>
              </Panel>
            ) : null}

            {board?.kind === 'livelli' && board.tier ? (
              <Panel style={styles.tier}>
                <View style={styles.tierHead}>
                  <TierBadge tier={board.tier} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierTitle} accessibilityRole="header">
                      Lega {board.tier}
                    </Text>
                    <Text style={text.small}>
                      {ranked.length} partecipanti · finisce tra {timeLeft(board.endsAt, now)}
                    </Text>
                  </View>
                </View>
                <Text style={text.small}>
                  {nextTier && nextTier !== board.tier ? `I primi ${PROMOTED} con almeno un punto salgono in ${nextTier}. ` : 'Sei al livello più alto. '}
                  {lowerTier && lowerTier !== board.tier ? `Gli ultimi ${RELEGATED} scendono in ${lowerTier}.` : 'Dal Bronzo non si scende.'}
                </Text>
                {board.outcome ? (
                  <Text style={[text.small, { color: C.teal, fontFamily: F.bold }]}>
                    {OUTCOME_TEXT[board.outcome.zone](board.outcome.from, board.tier)} Eri {board.outcome.rank}º.
                  </Text>
                ) : null}
              </Panel>
            ) : null}

            {board ? (
              <>
                <Podium ranked={ranked} onReport={report} />
                {rest.length > 0 ? (
                  <Panel style={styles.list}>
                    {rest.map((entry, i) => (
                      <Fragment key={entry.id}>
                        {i > 0 && !entry.me && !rest[i - 1].me ? <Divider /> : null}
                        <RankRow entry={entry} ranked={ranked} zone={zones.get(entry.id)} onReport={report} />
                      </Fragment>
                    ))}
                  </Panel>
                ) : null}
                {ranked.length <= 3 ? <MeOnPodium ranked={ranked} /> : null}
                {sweets && sweets.length > 0 ? <Sweets entries={sweets} mine={mine} /> : null}
                {board.kind === 'livelli' ? <ZoneLegend /> : null}
                {ranked.length > 1 ? <Text style={[text.small, { textAlign: 'center' }]}>Tieni premuto un nome per segnalare un soprannome offensivo.</Text> : null}
              </>
            ) : null}

            {board?.kind === 'invito' ? (
              <Panel style={styles.code}>
                <Text style={text.small}>Codice d&apos;invito</Text>
                <Text style={styles.codeValue} selectable accessibilityLabel={`Codice d'invito: ${board.code?.split('').join(' ')}`}>
                  {board.code}
                </Text>
                <Text style={text.small}>
                  {ranked.length === 1
                    ? 'Per ora ci sei solo tu. Manda il codice a chi vuoi invitare: lo inserisce da "Nuova lega".'
                    : 'Chi lo inserisce da "Nuova lega" entra in questa classifica.'}
                </Text>
                <GhostButton label="Condividi il codice" onPress={invite} icon={<ShareIcon size={18} />} />
                <Pressable onPress={leave} accessibilityRole="button" style={styles.leave} hitSlop={6}>
                  <Text style={[text.small, confirmLeave && { color: C.alert, fontFamily: F.bold }]}>{confirmLeave ? 'Tocca di nuovo per uscire dalla lega' : 'Esci dalla lega'}</Text>
                </Pressable>
              </Panel>
            ) : null}
          </>
        ) : (
          <>
            {monthly ? <MonthPanel run={monthly} entries={monthBoard} league={board?.name ?? null} now={now} /> : null}

            {challenges.length === 0 ? (
              <Panel>
                <Text style={[text.body, { textAlign: 'center' }]}>Nessuna sfida in corso. Lanciane una ai compagni di lega.</Text>
              </Panel>
            ) : (
              challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={{ ...challenge, people: challenge.people.map(withMine) }} now={now} onRemove={() => remove(challenge.id)} />
              ))
            )}

            <PrimaryButton label="Nuova sfida" onPress={() => router.push('/sfida-nuova')} icon={<PlusIcon size={20} color={C.onStrong} />} />
          </>
        )}
        </View>
      </ScrollView>

      <BottomNav current="classifica" tripActive={!!active} />
    </Screen>
  );
}

/** La sfida del mese: il proprio avanzamento e, se c'è una lega, la classifica del mese. */
function MonthPanel({ run, entries, league, now }: { run: ChallengeRun; entries: PeriodEntry[] | null; league: string | null; now: number }) {
  const byKm = run.metric.startsWith('km') || run.metric === 'co2';
  const list = (entries ?? []).filter((e) => e.points > 0 || e.km > 0 || e.me).sort((a, b) => (byKm ? b.km - a.km : b.points - a.points)).slice(0, 10);
  const value = (e: PeriodEntry) => (byKm ? `${String(Math.floor(e.km * 10) / 10).replace('.', ',')} km` : `${e.points} punti`);
  return (
    <Panel style={styles.monthly}>
      <View style={styles.monthlyHead}>
        <Mascot size={60} tilt={-6} />
        <View style={{ flex: 1 }}>
          <Text style={text.small}>Sfida del mese</Text>
          <Text style={styles.tierTitle} accessibilityRole="header">
            {run.title}
          </Text>
          <Text style={text.small}>
            {run.goal} · {run.done ? 'completata' : `mancano ${timeLeft(run.to, now)}`}
          </Text>
        </View>
      </View>
      <WavyBar ratio={run.ratio} color={run.done ? C.teal : C.text} height={18} stroke={6} />
      <Text style={text.small}>{challengeProgress(run)}</Text>
      {league && list.length > 1 ? (
        <View style={{ gap: 2 }}>
          <Divider />
          <Text style={[text.small, { fontFamily: F.bold, marginTop: 6 }]}>
            Questo mese in {league}, per {byKm ? 'km senza auto' : 'punti'}
          </Text>
          {list.map((e, i) => (
            <View key={e.id} style={styles.monthRow} accessible accessibilityLabel={`${i + 1}º: ${e.me ? 'tu' : e.name}, ${value(e)}`}>
              <Text style={[styles.monthRank, e.me && { color: C.text }]}>{i + 1}</Text>
              <Avatar id={e.id} name={e.name} me={e.me} tree={e.tree} />
              <Text style={[styles.monthName, e.me && { fontFamily: F.bold }]} numberOfLines={1}>
                {e.me ? 'Tu' : e.name}
              </Text>
              <ShowcaseMini items={e.showcase} size={18} />
              <Text style={styles.monthValue}>{value(e)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

/** Con tre partecipanti o meno la lista sotto il podio è vuota: una riga dice comunque all'utente dov'è. */
function MeOnPodium({ ranked }: { ranked: Ranked[] }) {
  const me = ranked.find((r) => r.me);
  if (!me) return null;
  return (
    <Panel style={styles.list}>
      <RankRow entry={me} ranked={ranked} />
    </Panel>
  );
}

function ZoneLegend() {
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: ZONE_UP }]} />
        <Text style={text.small}>Sale di livello</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: ZONE_DOWN }]} />
        <Text style={text.small}>Scende di livello</Text>
      </View>
    </View>
  );
}

/** "Dolcetto o scherzetto": la lega ordinata per caramelle (km senza auto dal 15 al 31 ottobre). */
function Sweets({ entries, mine }: { entries: CandyEntry[]; mine: TreeBadge | null }) {
  const sorted = [...entries].sort((a, b) => b.candies - a.candies || a.name.localeCompare(b.name, 'it'));
  return (
    <View style={styles.sweets}>
      <View style={styles.sweetsHead}>
        <Candy size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sweetsTitle}>Dolcetto o scherzetto</Text>
          <Text style={styles.sweetsBody}>Un km senza auto, una caramella. Vince chi ne ha di più il 31 ottobre.</Text>
        </View>
      </View>
      {sorted.map((e, i) => (
        <View key={e.id} style={styles.sweetRow}>
          <Text style={styles.sweetRank}>{i + 1}</Text>
          <Avatar id={e.id} name={e.name} me={e.me} size={34} tree={e.me && mine ? mine : e.tree} />
          <Text style={styles.sweetName} numberOfLines={1}>
            {e.me ? 'Tu' : e.name}
          </Text>
          <Text style={styles.sweetCount}>{e.candies}</Text>
        </View>
      ))}
    </View>
  );
}

/** Prima di entrare in classifica serve un soprannome: è l'unica cosa che gli altri vedranno. */
function Nickname({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [species, setSpecies] = useState<SpeciesId | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTree()
        .then((t) => setSpecies(t.species))
        .catch(() => undefined);
    }, []),
  );

  async function save() {
    setSaving(true);
    if (species) await saveTree({ ...(await loadTree()), species });
    const result = await social.setNickname(name);
    setSaving(false);
    if (result.ok) onDone();
    else setProblem(result.problem);
  }

  return (
    <Panel style={styles.nickname}>
      <View style={styles.monthlyHead}>
        <Mascot size={68} tilt={-6} />
        <View style={{ flex: 1 }}>
          <Text style={styles.tierTitle} accessibilityRole="header">
            Scegli un soprannome
          </Text>
          <Text style={text.small}>È il nome con cui compari in classifica e nelle sfide. Niente registrazione, niente email.</Text>
        </View>
      </View>
      <TextInput
        value={name}
        onChangeText={(value) => {
          setName(value);
          setProblem(null);
        }}
        placeholder="Per esempio Robbie"
        placeholderTextColor={PLACEHOLDER}
        maxLength={20}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="Soprannome"
        style={input}
      />
      <Text style={styles.pickTitle}>Il tuo albero</Text>
      <Text style={text.small}>È il tuo avatar: cresce con il tuo germoglio, e gli altri lo vedono in classifica.</Text>
      <TreePicker value={species} onChange={setSpecies} />
      {problem ? (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      <PrimaryButton label={saving ? 'Salvo…' : 'Entra in classifica'} onPress={save} disabled={saving} />
      {!social.demo ? (
        <Pressable onPress={() => router.push('/backup')} accessibilityRole="link" hitSlop={6}>
          <Text style={styles.recoverLink}>Avevi già un profilo su un altro telefono? Ritrovalo con il codice di recupero</Text>
        </Pressable>
      ) : null}
      <Text style={text.small}>
        {social.demo
          ? "Il soprannome resta su questo telefono finché la classifica è in anteprima. Se disinstalli l'app o cambi telefono, il profilo si perde."
          : "Il soprannome e i punti dei tuoi tragitti vengono salvati sul server di Vado, così i compagni di lega li vedono. Nessuna posizione lascia il telefono. Per cambiare telefono senza perdere il profilo usa il codice di recupero, nella schermata Backup."}
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: NAV_SPACE },
  body: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 18 },
  sections: { marginTop: 14 },
  heroTabs: { padding: 0, marginTop: 14 },
  sweets: { backgroundColor: C.deep, borderRadius: 28, padding: 16, gap: 8 },
  sweetsHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sweetsTitle: { fontFamily: F.bold, fontSize: 17, color: '#FFF3C4' },
  sweetsBody: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.onInkDim },
  sweetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  sweetRank: { width: 20, fontFamily: F.displayBold, fontSize: 16, color: C.onInk },
  sweetName: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.onInk },
  sweetCount: { fontFamily: F.displayBold, fontSize: 18, color: '#FFC48A' },
  pickTitle: { fontFamily: F.bold, fontSize: 15, color: C.text, marginTop: 4 },
  invite: { backgroundColor: C.tonal, height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  inviteText: { fontFamily: F.bold, fontSize: 14, color: C.text },
  demo: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.coralSoft },
  demoText: { fontFamily: F.semi, fontSize: 12.5, lineHeight: 18, color: C.text },
  chipsBleed: { marginHorizontal: -GUTTER, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: GUTTER, paddingBottom: 4 },
  tier: { gap: 10, borderRadius: 22 },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 4 },
  tierTitle: { fontFamily: F.displayBold, fontSize: 18, lineHeight: 22, color: C.text },
  list: { paddingVertical: 10, paddingHorizontal: 8 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  code: { gap: 10, alignItems: 'stretch' },
  codeValue: { fontFamily: F.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: 6, color: C.text },
  leave: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  monthly: { gap: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  monthRank: { width: 20, fontFamily: F.bold, fontSize: 14, color: C.dim, textAlign: 'center' },
  monthName: { flex: 1, fontFamily: F.medium, fontSize: 15, color: C.text },
  monthValue: { fontFamily: F.bold, fontSize: 14, color: C.text },
  monthlyHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nickname: { gap: 14 },
  empty: { alignItems: 'center', gap: 12 },
  recoverLink: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 19, color: C.text, textDecorationLine: 'underline' },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
});
