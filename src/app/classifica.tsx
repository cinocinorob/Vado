/** Schermata "Classifica": leghe (a livelli e con invito) e sfide. */
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

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
import type { SpeciesId, TreeBadge } from '../core/plant';
import { myTree, social, type LeagueBoard, type LeagueSummary, type MonthlyChallenge, type Profile } from '../social';
import { leagueToOpen } from '../social/selection';
import { loadTree, saveTree } from '../storage/tree';
import { useActiveTrip } from '../tracking/store';
import { BottomNav, NAV_SPACE } from '../ui/BottomNav';
import { PlusIcon, ShareIcon } from '../ui/Icons';
import { Mascot } from '../ui/Mascot';
import { HeroBlock } from '../ui/Hero';
import { Divider, GUTTER, GhostButton, PLACEHOLDER, Panel, PrimaryButton, ProgressBar, Screen, input, text } from '../ui/parts';
import { ChallengeCard, Chip, Podium, RankRow, Segmented, TierBadge, ZONE_DOWN, ZONE_UP, zonesFor } from '../ui/social';
import { C, F } from '../ui/theme';
import { TreePicker } from '../ui/TreeAvatar';

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
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [monthly, setMonthly] = useState<MonthlyChallenge | null>(null);
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
    const [nextBoard, nextChallenges, nextMonthly] = await Promise.all([
      id ? social.board(id, at) : Promise.resolve(null),
      social.challenges(at),
      social.monthly(at),
    ]);
    setLeagues(list);
    setLeagueId(id);
    setBoard(nextBoard);
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
    setProblem(social.problem());
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
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} colors={[C.ink]} tintColor={C.ink} />}
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
                <Podium ranked={ranked} />
                {rest.length > 0 ? (
                  <Panel style={styles.list}>
                    {rest.map((entry, i) => (
                      <Fragment key={entry.id}>
                        {i > 0 && !entry.me && !rest[i - 1].me ? <Divider /> : null}
                        <RankRow entry={entry} ranked={ranked} zone={zones.get(entry.id)} />
                      </Fragment>
                    ))}
                  </Panel>
                ) : null}
                {ranked.length <= 3 ? <MeOnPodium ranked={ranked} /> : null}
                {board.kind === 'livelli' ? <ZoneLegend /> : null}
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
            {monthly ? (
              <Panel style={styles.monthly}>
                <View style={styles.monthlyHead}>
                  <Mascot size={60} tilt={-6} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tierTitle} accessibilityRole="header">
                      {monthly.title}
                    </Text>
                    <Text style={text.small}>
                      {monthly.target} punti entro fine mese · mancano {timeLeft(monthly.endsAt, now)}
                    </Text>
                  </View>
                </View>
                <ProgressBar
                  value={monthly.points}
                  max={monthly.target}
                  label={monthly.points >= monthly.target ? 'Traguardo raggiunto' : 'I tuoi punti del mese'}
                  detail={`${monthly.points} di ${monthly.target}`}
                />
                <Text style={text.small}>
                  {monthly.people === 1
                    ? 'Questo mese sei il primo a fare punti.'
                    : `${monthly.reached} su ${monthly.people} persone attive questo mese ci sono già arrivate.`}
                </Text>
              </Panel>
            ) : null}

            {challenges.length === 0 ? (
              <Panel>
                <Text style={[text.body, { textAlign: 'center' }]}>Nessuna sfida in corso. Lanciane una ai compagni di lega.</Text>
              </Panel>
            ) : (
              challenges.map((challenge) => (
                <ChallengeCard key={challenge.id} challenge={{ ...challenge, people: challenge.people.map(withMine) }} now={now} onRemove={() => remove(challenge.id)} />
              ))
            )}

            <PrimaryButton label="Nuova sfida" onPress={() => router.push('/sfida-nuova')} icon={<PlusIcon size={20} color={C.lime} />} />
          </>
        )}
        </View>
      </ScrollView>

      <BottomNav current="classifica" tripActive={!!active} />
    </Screen>
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
  codeValue: { fontFamily: F.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: 6, color: C.ink },
  leave: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  monthly: { gap: 12 },
  monthlyHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nickname: { gap: 14 },
  empty: { alignItems: 'center', gap: 12 },
  recoverLink: { fontFamily: F.bold, fontSize: 13.5, lineHeight: 19, color: C.text, textDecorationLine: 'underline' },
  problem: { fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: C.alert },
});
