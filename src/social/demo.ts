/**
 * Sorgente di esempio per classifica, leghe e sfide.
 *
 * Tutto resta sul telefono: il soprannome, le leghe create, le sfide. Gli
 * altri partecipanti sono inventati (vedi bots.ts); i punti dell'utente sono
 * quelli veri dei suoi tragitti. Serve a vedere e provare le schermate prima
 * di collegare un server: da qui non parte nessun dato.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Trip } from '../core/scoring';
import {
  CHALLENGE_MAX_PEOPLE,
  TARGET_MAX_DAYS,
  TIER_GROUP_SIZE,
  challengeProblem,
  cleanNickname,
  inviteCode,
  mainMode,
  monthEnd,
  monthName,
  monthStart,
  normalizeCode,
  pointsBetween,
  rankEntries,
  reachedAt,
  rollTier,
  weekEnd,
  weekKey,
  weekStart,
  type Challenge,
  type Challenger,
  type Entry,
  type TierState,
} from '../core/social';
import { loadTrips } from '../storage/trips';
import { BOTS, botPoints, botReachedAt, getBot, pickBots, tierScale, type Bot } from './bots';
import type { LeagueBoard, LeagueSummary, MonthlyChallenge, NewChallenge, Person, Profile, Result, SocialSource } from './types';

const KEY = 'vado.sociale.v1';
const ME = 'io';
const TIER_LEAGUE = 'livelli';
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHLY_TARGET = 600;

type StoredLeague = { id: string; name: string; code: string; members: string[]; createdAt: number };
type StoredChallenge = {
  id: string;
  title: string;
  kind: Challenge['kind'];
  target: number;
  startsAt: number;
  endsAt: number;
  teams: boolean;
  opponents: string[];
};

type Stored = {
  nickname: string | null;
  tier: TierState | null;
  leagues: StoredLeague[];
  challenges: StoredChallenge[];
  /** Le leghe e le sfide di esempio sono già state create una volta. */
  seeded: boolean;
};

const EMPTY: Stored = { nickname: null, tier: null, leagues: [], challenges: [], seeded: false };

async function load(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Stored>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

async function save(state: Stored): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

const newId = (prefix: string, now: number) => `${prefix}${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Alla prima apertura: una lega e due sfide di esempio, per non mostrare schermate vuote. */
function seed(state: Stored, now: number): Stored {
  if (state.seeded) return state;
  const colleagues = pickBots('lega-colleghi', 7).map((b) => b.id);
  const leagues: StoredLeague[] = [{ id: 'es-colleghi', name: 'Colleghi', code: 'VADQ26', members: colleagues, createdAt: now }];
  const challenges: StoredChallenge[] = [
    {
      id: 'es-settimana',
      title: 'Settimana dei colleghi',
      kind: 'tempo',
      target: 0,
      startsAt: weekStart(now),
      endsAt: weekEnd(now),
      teams: false,
      opponents: colleagues.slice(0, 4),
    },
    {
      id: 'es-traguardo',
      title: 'Testa a testa',
      kind: 'traguardo',
      target: 250,
      startsAt: now - 2 * DAY_MS,
      endsAt: now - 2 * DAY_MS + TARGET_MAX_DAYS * DAY_MS,
      teams: false,
      opponents: colleagues.slice(4, 5),
    },
  ];
  return { ...state, leagues, challenges, seeded: true };
}

/** Compagni di gruppo della lega a livelli per una data settimana. */
function tierMates(week: string, tier: TierState['tier']): Bot[] {
  return pickBots(`${week}|${tier}`, TIER_GROUP_SIZE - 1);
}

function myEntry(trips: Trip[], nickname: string | null, from: number, to: number): Entry {
  return { id: ME, name: nickname ?? 'Tu', points: pointsBetween(trips, from, to), me: true, mainMode: mainMode(trips, from, to) };
}

function botEntry(bot: Bot, from: number, to: number, scale = 1): Entry {
  return { id: bot.id, name: bot.name, points: botPoints(bot, from, to, scale), mainMode: bot.mode };
}

/** Aggiunge a ogni riga la posizione che aveva 24 ore prima, per la freccia. */
function withTrend(now: Entry[], before: Entry[]): Entry[] {
  const earlier = new Map(rankEntries(before).map((r) => [r.id, r.rank]));
  return now.map((entry) => ({ ...entry, previousRank: earlier.get(entry.id) }));
}

/** Aggiorna il livello se è iniziata una settimana nuova. */
function rolled(state: Stored, trips: Trip[], now: number): Stored {
  const week = weekKey(now);
  if (!state.tier) return { ...state, tier: { tier: 'Bronzo', week } };
  if (state.tier.week === week) return state;
  // Graduatoria finale della settimana in cui l'utente era rimasto.
  const from = weekStart(now) - 7 * DAY_MS;
  const to = weekStart(now);
  const scale = tierScale(state.tier.tier);
  const final = rankEntries([myEntry(trips, state.nickname, from, to), ...tierMates(state.tier.week, state.tier.tier).map((b) => botEntry(b, from, to, scale))]);
  const mine = final.find((r) => r.id === ME);
  return { ...state, tier: rollTier(state.tier, week, mine?.rank ?? TIER_GROUP_SIZE, mine?.points ?? 0) };
}

async function ready(now: number): Promise<{ state: Stored; trips: Trip[] }> {
  const trips = await loadTrips();
  const before = await load();
  const state = rolled(seed(before, now), trips, now);
  if (state !== before) await save(state);
  return { state, trips };
}

const summary = (league: StoredLeague): LeagueSummary => ({ id: league.id, kind: 'invito', name: league.name, code: league.code });

function toChallenge(stored: StoredChallenge, state: Stored, trips: Trip[], now: number): Challenge {
  const until = Math.min(now, stored.endsAt);
  const me: Challenger = {
    ...myEntry(trips, state.nickname, stored.startsAt, until),
    reachedAt: stored.kind === 'traguardo' ? reachedAt(trips, stored.startsAt, until, stored.target) : null,
    team: 0,
  };
  const others: Challenger[] = stored.opponents
    .map((id) => getBot(id))
    .filter((bot): bot is Bot => !!bot)
    .map((bot, i) => ({
      ...botEntry(bot, stored.startsAt, until),
      reachedAt: stored.kind === 'traguardo' ? botReachedAt(bot, stored.startsAt, until, stored.target) : null,
      // Squadre alternate, con l'utente nella prima.
      team: (i % 2 === 0 ? 1 : 0) as 0 | 1,
    }));
  return { id: stored.id, title: stored.title, kind: stored.kind, target: stored.target, startsAt: stored.startsAt, endsAt: stored.endsAt, teams: stored.teams, people: [me, ...others] };
}

export const demoSource: SocialSource = {
  demo: true,

  async profile(): Promise<Profile | null> {
    const { nickname } = await load();
    return nickname ? { id: ME, nickname } : null;
  },

  async setNickname(name: string): Promise<Result<Profile>> {
    const nickname = cleanNickname(name);
    if (!nickname) return { ok: false, problem: 'Il soprannome deve avere da 2 a 20 caratteri.' };
    await save({ ...(await load()), nickname });
    return { ok: true, value: { id: ME, nickname } };
  },

  async leagues(now: number): Promise<LeagueSummary[]> {
    const { state } = await ready(now);
    const tier = state.tier?.tier ?? 'Bronzo';
    return [{ id: TIER_LEAGUE, kind: 'livelli', name: tier, tier }, ...state.leagues.map(summary)];
  },

  async board(leagueId: string, now: number): Promise<LeagueBoard | null> {
    const { state, trips } = await ready(now);
    const from = weekStart(now);
    const endsAt = weekEnd(now);
    const yesterday = Math.max(from, now - DAY_MS);

    if (leagueId === TIER_LEAGUE) {
      const tier = state.tier?.tier ?? 'Bronzo';
      const scale = tierScale(tier);
      const mates = tierMates(weekKey(now), tier);
      const entries = withTrend(
        [myEntry(trips, state.nickname, from, now), ...mates.map((b) => botEntry(b, from, now, scale))],
        [myEntry(trips, state.nickname, from, yesterday), ...mates.map((b) => botEntry(b, from, yesterday, scale))],
      );
      const outcome = state.tier?.lastOutcome;
      return { id: TIER_LEAGUE, kind: 'livelli', name: tier, tier, entries, endsAt, outcome };
    }

    const league = state.leagues.find((l) => l.id === leagueId);
    if (!league) return null;
    const members = league.members.map((id) => getBot(id)).filter((b): b is Bot => !!b);
    const entries = withTrend(
      [myEntry(trips, state.nickname, from, now), ...members.map((b) => botEntry(b, from, now))],
      [myEntry(trips, state.nickname, from, yesterday), ...members.map((b) => botEntry(b, from, yesterday))],
    );
    return { ...summary(league), entries, endsAt };
  },

  async createLeague(name: string): Promise<Result<LeagueSummary>> {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 24) return { ok: false, problem: 'Il nome della lega deve avere da 2 a 24 caratteri.' };
    const state = await load();
    if (state.leagues.length >= 8) return { ok: false, problem: 'Puoi stare al massimo in 8 leghe.' };
    const now = Date.now();
    // Una lega appena creata è vuota: gli amici entrano con il codice.
    const league: StoredLeague = { id: newId('l', now), name: clean, code: inviteCode(Math.random), members: [], createdAt: now };
    await save({ ...state, leagues: [...state.leagues, league] });
    return { ok: true, value: summary(league) };
  },

  async joinLeague(text: string): Promise<Result<LeagueSummary>> {
    const code = normalizeCode(text);
    if (!code) return { ok: false, problem: 'Il codice ha 6 caratteri, lettere e cifre.' };
    const state = await load();
    const existing = state.leagues.find((l) => l.code === code);
    if (existing) return { ok: false, problem: `Sei già nella lega "${existing.name}".` };
    if (state.leagues.length >= 8) return { ok: false, problem: 'Puoi stare al massimo in 8 leghe.' };
    const now = Date.now();
    // Senza server non esiste un elenco di leghe vere: qualunque codice valido
    // apre una lega di esempio, sempre la stessa per lo stesso codice.
    const league: StoredLeague = {
      id: newId('l', now),
      name: `Lega ${code}`,
      code,
      members: pickBots(`codice|${code}`, 9).map((b) => b.id),
      createdAt: now,
    };
    await save({ ...state, leagues: [...state.leagues, league] });
    return { ok: true, value: summary(league) };
  },

  async leaveLeague(leagueId: string): Promise<void> {
    const state = await load();
    await save({ ...state, leagues: state.leagues.filter((l) => l.id !== leagueId) });
  },

  async rivals(now: number): Promise<Person[]> {
    const { state } = await ready(now);
    const ids = new Set<string>();
    for (const league of state.leagues) league.members.forEach((id) => ids.add(id));
    // Chi non ha ancora compagni di lega può comunque provare una sfida.
    const bots = ids.size > 0 ? BOTS.filter((b) => ids.has(b.id)) : pickBots('avversari', 6);
    return bots.map((b) => ({ id: b.id, name: b.name }));
  },

  async challenges(now: number): Promise<Challenge[]> {
    const { state, trips } = await ready(now);
    return state.challenges.map((c) => toChallenge(c, state, trips, now)).sort((a, b) => b.startsAt - a.startsAt);
  },

  async createChallenge(input: NewChallenge, now: number): Promise<Result<Challenge>> {
    const problem = challengeProblem({ ...input, people: input.opponents.length + 1 });
    if (problem) return { ok: false, problem };
    const { state, trips } = await ready(now);
    if (state.challenges.length >= 12) return { ok: false, problem: 'Hai già 12 sfide: eliminane una conclusa.' };
    const days = input.kind === 'tempo' ? input.days : TARGET_MAX_DAYS;
    const stored: StoredChallenge = {
      id: newId('s', now),
      title: input.title.replace(/\s+/g, ' ').trim().slice(0, 40),
      kind: input.kind,
      target: input.kind === 'traguardo' ? input.target : 0,
      startsAt: now,
      endsAt: now + days * DAY_MS,
      teams: input.teams,
      opponents: input.opponents.slice(0, CHALLENGE_MAX_PEOPLE - 1),
    };
    await save({ ...state, challenges: [...state.challenges, stored] });
    return { ok: true, value: toChallenge(stored, state, trips, now) };
  },

  async removeChallenge(id: string): Promise<void> {
    const state = await load();
    await save({ ...state, challenges: state.challenges.filter((c) => c.id !== id) });
  },

  async monthly(now: number): Promise<MonthlyChallenge> {
    const trips = await loadTrips();
    const from = monthStart(now);
    const reached = BOTS.filter((b) => botPoints(b, from, now) >= MONTHLY_TARGET).length;
    return {
      title: `Sfida di ${monthName(now)}`,
      target: MONTHLY_TARGET,
      points: pointsBetween(trips, from, now),
      endsAt: monthEnd(now),
      reached,
      people: BOTS.length + 1,
    };
  },
};

/** Cancella soprannome, leghe e sfide (per "Azzera i dati di prova"). */
export async function resetDemo(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
