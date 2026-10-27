/**
 * Sorgente vera per classifica, leghe e sfide: parla con il server.
 *
 * Il telefono si fa riconoscere con una chiave segreta generata a caso alla
 * scelta del soprannome e mai mostrata: niente email, niente password. Se si
 * disinstalla l'app la chiave si perde, e con lei il profilo.
 *
 * Al server arrivano il soprannome e, per ogni tragitto che ha dato punti,
 * l'ora di fine, i punti e il mezzo principale. Mai posizioni, distanze o
 * nomi di stazioni. Le regole (chi vince, chi sale) restano quelle di
 * core/social.ts: il server somma i punti, l'app li interpreta.
 *
 * Qui non c'è nulla di specifico di React Native: memoria, tragitti e
 * generatore della chiave arrivano da fuori, così lo stesso codice gira nelle
 * prove automatiche contro un server di prova.
 */
import type { ModeId } from '../core/modes';
import { STAGES, isSpecies, type TreeBadge } from '../core/plant';
import type { Trip } from '../core/scoring';
import {
  TARGET_MAX_DAYS,
  challengeProblem,
  cleanNickname,
  monthEnd,
  monthName,
  monthStart,
  normalizeCode,
  parseShowcase,
  rankEntries,
  weekEnd,
  weekStart,
  type Challenge,
  type Challenger,
  type Entry,
} from '../core/social';
import { candyMeters, candySeason } from '../core/halloween';
import { decodeRecovery, encodeRecovery } from '../core/recovery';
import type { CandyEntry, PeriodEntry, LeagueBoard, LeagueSummary, MonthlyChallenge, NewChallenge, Person, Profile, Result, SocialSource } from './types';

export type RemoteConfig = {
  /** Indirizzo delle funzioni, senza barra finale. */
  rest: string;
  /** Chiave pubblica del progetto; null per un server di prova che non la chiede. */
  key: string | null;
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  loadTrips(): Promise<Trip[]>;
  /** L'avatar da mostrare agli altri: albero scelto e crescita. null se non c'è ancora un albero scelto. */
  loadTree?(): Promise<TreeBadge | null>;
  /** La vetrina da mostrare agli altri, come "maratoneta:2,podio:1". */
  loadShowcase?(): Promise<string>;
  /** Chiave segreta nuova: almeno 32 caratteri imprevedibili. */
  newSecret(): Promise<string>;
  fetch?: typeof fetch;
};

const KEY = 'vado.server.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHLY_TARGET = 600;
/** I tragitti più vecchi non servono a nessuna classifica in corso. */
const PUSH_WINDOW_MS = 45 * DAY_MS;
const TIMEOUT_MS = 12_000;
/** Aprendo più schermate di fila non si rimandano i tragitti a ogni lettura. */
const SYNC_EVERY_MS = 5_000;

export const OFFLINE = 'Non riesco a raggiungere il server. Controlla la connessione e riprova.';
const NOT_READY = 'Il server della classifica non è ancora pronto.';

/** Le risposte del server quando rifiuta qualcosa, in parole. */
const PROBLEMS: Record<string, string> = {
  'non-registrato': 'Il tuo profilo non esiste più sul server. Scegli di nuovo un soprannome.',
  'segreto-non-valido': 'Non riesco a creare il profilo su questo telefono.',
  'testo-non-valido': 'Il testo è troppo corto o troppo lungo.',
  'lega-inesistente': 'Nessuna lega ha questo codice. Controlla di averlo scritto giusto.',
  'gia-dentro': 'Sei già in questa lega.',
  'troppe-leghe': 'Puoi stare al massimo in 8 leghe.',
  'lega-piena': 'Questa lega è al completo: 50 persone.',
  'avversari-non-validi': 'Puoi sfidare solo i compagni di lega.',
  'squadre-troppo-piccole': 'Per le squadre servono almeno quattro persone.',
  'troppe-sfide': 'Hai già 12 sfide in corso: aspetta che ne finisca una.',
  'dati-non-validi': 'Il server non ha accettato i dati.',
};

const UNKNOWN_CODE = 'Nessun profilo corrisponde a questo codice. Controlla di averlo copiato tutto, dal telefono dove avevi il profilo.';

class ServerError extends Error {
  constructor(
    readonly code: string,
    readonly problem: string,
  ) {
    super(code);
  }
}

type State = {
  secret: string | null;
  profile: Profile | null;
  /** Tragitti già inviati al server. */
  pushed: string[];
  /** Ultimo avatar inviato, per non rimandarlo uguale. */
  tree?: string;
  /** Ultima vetrina inviata. */
  showcase?: string;
  /** I tragitti già inviati hanno anche i metri (per le caramelle). */
  metersSent?: boolean;
  /** Tragitti cancellati sul telefono da togliere anche dal server. */
  removed?: string[];
};

const EMPTY: State = { secret: null, profile: null, pushed: [] };

type TreeRow = { species?: unknown; stage?: unknown; trees?: unknown } | null | undefined;
type BoardRow = { id: string; name: string; me: boolean; points: number; before: number; mode: string | null; tree?: TreeRow; showcase?: string };
type ChallengeRow = Omit<Challenge, 'people'> & {
  people: { id: string; name: string; me: boolean; team: 0 | 1; points: number; mode: string | null; reachedAt: number | null; tree?: TreeRow; showcase?: string }[];
};

/** L'avatar come arriva dal server; null se manca o non è valido (server non ancora aggiornato). */
export function toTree(row: TreeRow): TreeBadge | null {
  if (!row || !isSpecies(row.species)) return null;
  const stage = STAGES[Number(row.stage)] ?? 'seme';
  const trees = Math.max(0, Math.floor(Number(row.trees) || 0));
  return { species: row.species, stage, trees };
}

/** Il mezzo che ha dato più punti in un tragitto. */
function tripMode(trip: Trip): ModeId | null {
  let best: ModeId | null = null;
  let top = 0;
  for (const leg of trip.legs) {
    if (leg.points > top) {
      best = leg.mode;
      top = leg.points;
    }
  }
  return best;
}

export type RemoteSource = SocialSource & {
  /** Solo per le prove: la chiave segreta di questo telefono. */
  secret(): Promise<string | null>;
};

export function remoteSource(config: RemoteConfig): RemoteSource {
  const send = config.fetch ?? fetch;
  let lastProblem: string | null = null;
  let lastSync = 0;
  let syncing: Promise<void> | null = null;
  /** Ultime risposte buone, da mostrare se la rete manca. */
  const cache = new Map<string, unknown>();

  async function load(): Promise<State> {
    try {
      const raw = await config.storage.get(KEY);
      return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<State>) } : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  const save = (state: State) => config.storage.set(KEY, JSON.stringify(state));

  /** Chiama una funzione del server. Lancia ServerError con una frase già pronta per l'utente. */
  async function call<T>(name: string, params: Record<string, unknown>, options: { probe?: boolean } = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await send(`${config.rest}/rpc/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.key ? { apikey: config.key } : {}) },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
    } catch {
      throw new ServerError('rete', OFFLINE);
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text().catch(() => '');
    if (response.ok) {
      lastProblem = null;
      return (text ? JSON.parse(text) : null) as T;
    }
    let code = `http-${response.status}`;
    try {
      const body = JSON.parse(text) as { code?: string; message?: string };
      // P0001: rifiuto deciso da una funzione, con il motivo nel messaggio.
      if (body.code === 'P0001' && body.message) code = body.message;
      // La funzione non esiste: sul server non sono ancora state create.
      else if (body.code === 'PGRST202' || response.status === 404) code = 'non-pronto';
    } catch {
      // Risposta non leggibile: resta il codice HTTP.
    }
    // Con `probe` si sta solo provando una chiave (codice di recupero): se è sbagliata, il profilo di questo telefono non c'entra.
    if (code === 'non-registrato' && !options.probe) {
      // Il profilo è stato cancellato dal server: qui si torna alla scelta del soprannome.
      const state = await load();
      await save({ ...state, profile: null, pushed: [], tree: undefined, showcase: undefined });
    }
    throw new ServerError(code, code === 'non-pronto' ? NOT_READY : (PROBLEMS[code] ?? `Il server ha risposto con un errore (${code}).`));
  }

  /** Come `call`, per chi ha già un profilo. */
  async function mine<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
    const { secret, profile } = await load();
    if (!secret || !profile) throw new ServerError('non-registrato', PROBLEMS['non-registrato']);
    return call<T>(name, { p_secret: secret, ...params });
  }

  /** Lettura: se il server non risponde si mostra l'ultima risposta buona, e resta l'avviso. */
  async function read<T>(key: string, fallback: T, work: () => Promise<T>): Promise<T> {
    try {
      const value = await work();
      cache.set(key, value);
      return value;
    } catch (error) {
      lastProblem = error instanceof ServerError ? error.problem : OFFLINE;
      return cache.has(key) ? (cache.get(key) as T) : fallback;
    }
  }

  /** Modifica: il problema torna a chi ha chiesto, che lo mostra accanto al pulsante. */
  async function write<T>(work: () => Promise<T>): Promise<Result<T>> {
    try {
      return { ok: true, value: await work() };
    } catch (error) {
      return { ok: false, problem: error instanceof ServerError ? error.problem : OFFLINE };
    }
  }

  async function pushTrips(now: number): Promise<void> {
    const state = await load();
    if (!state.secret || !state.profile) return;
    const trips = await config.loadTrips();
    // La prima volta con i metri si rimandano tutti i tragitti recenti: il server aggiorna solo quelli senza.
    const sent = new Set(state.metersSent ? state.pushed : []);
    const fresh = trips.filter((t) => t.total > 0 && t.endedAt >= now - PUSH_WINDOW_MS && !sent.has(t.id));
    if (fresh.length === 0) return;
    await call('vado_push_scores', {
      p_secret: state.secret,
      p_scores: fresh.map((t) => ({ id: t.id, at: new Date(t.endedAt).toISOString(), points: t.total, mode: tripMode(t), meters: Math.round(candyMeters(t)) })),
    });
    // Si ricordano solo i tragitti che esistono ancora e sono abbastanza recenti da poter essere rimandati.
    const alive = new Set(trips.filter((t) => t.endedAt >= now - PUSH_WINDOW_MS).map((t) => t.id));
    const pushed = [...new Set([...state.pushed.filter((id) => alive.has(id)), ...fresh.map((t) => t.id)])];
    await save({ ...(await load()), pushed, metersSent: true });
  }

  /** Manda la vetrina se è cambiata. Come per l'albero, un server non aggiornato non è un problema. */
  async function pushShowcase(): Promise<void> {
    if (!config.loadShowcase) return;
    try {
      const state = await load();
      if (!state.secret || !state.profile) return;
      const text = await config.loadShowcase();
      if (text === state.showcase) return;
      await call('vado_set_showcase', { p_secret: state.secret, p_showcase: text });
      await save({ ...(await load()), showcase: text });
    } catch {
      // Riprova alla prossima sincronizzazione.
    }
  }

  /** Toglie dal server i punti dei tragitti cancellati. Se il server non è aggiornato, riprova la volta dopo. */
  async function pushRemovals(): Promise<void> {
    const state = await load();
    if (!state.secret || !state.profile || !state.removed?.length) return;
    try {
      await call('vado_remove_scores', { p_secret: state.secret, p_ids: state.removed });
      await save({ ...(await load()), removed: [] });
    } catch {
      // Resta in coda.
    }
  }

  /**
   * Manda l'avatar se è cambiato. Un errore qui non diventa un avviso: un
   * server non ancora aggiornato (senza vado_set_tree) deve continuare a
   * funzionare per tutto il resto.
   */
  async function pushTree(): Promise<void> {
    if (!config.loadTree) return;
    try {
      const state = await load();
      if (!state.secret || !state.profile) return;
      const tree = await config.loadTree();
      if (!tree) return;
      const key = `${tree.species}:${STAGES.indexOf(tree.stage)}:${tree.trees}`;
      if (key === state.tree) return;
      await call('vado_set_tree', { p_secret: state.secret, p_tree: tree.species, p_stage: STAGES.indexOf(tree.stage), p_trees: tree.trees });
      await save({ ...(await load()), tree: key });
    } catch {
      // Riprova alla prossima sincronizzazione.
    }
  }

  function sync(now: number, force = false): Promise<void> {
    if (syncing) return syncing;
    if (!force && now - lastSync < SYNC_EVERY_MS) return Promise.resolve();
    syncing = pushRemovals()
      .then(() => pushTrips(now))
      .then(() => pushTree())
      .then(() => pushShowcase())
      .then(() => {
        lastSync = now;
      })
      .catch((error: unknown) => {
        lastProblem = error instanceof ServerError ? error.problem : OFFLINE;
      })
      .finally(() => {
        syncing = null;
      });
    return syncing;
  }

  const summary = (league: { id: string; name: string; code: string }): LeagueSummary => ({ id: league.id, kind: 'invito', name: league.name, code: league.code });

  function toChallenge(row: ChallengeRow): Challenge {
    const people: Challenger[] = row.people.map((p) => ({
      id: p.id,
      name: p.name,
      points: p.points,
      me: p.me,
      mainMode: (p.mode as ModeId | null) ?? null,
      reachedAt: p.reachedAt,
      team: p.team,
      tree: toTree(p.tree),
      showcase: parseShowcase(p.showcase),
    }));
    // L'utente per primo, come nelle schermate.
    people.sort((a, b) => Number(b.me === true) - Number(a.me === true));
    return { id: row.id, title: row.title, kind: row.kind, target: row.target, startsAt: row.startsAt, endsAt: row.endsAt, teams: row.teams, people };
  }

  return {
    demo: false,

    problem: () => lastProblem,

    async secret(): Promise<string | null> {
      return (await load()).secret;
    },

    async profile(): Promise<Profile | null> {
      return (await load()).profile;
    },

    async setNickname(name: string): Promise<Result<Profile>> {
      const nickname = cleanNickname(name);
      if (!nickname) return { ok: false, problem: 'Il soprannome deve avere da 2 a 20 caratteri.' };
      return write(async () => {
        const state = await load();
        const secret = state.secret ?? (await config.newSecret());
        // La chiave va salvata prima di usarla: se la risposta si perde, al
        // prossimo tentativo si ritrova lo stesso profilo invece di crearne un altro.
        if (!state.secret) await save({ ...state, secret });
        const profile = await call<Profile>('vado_register', { p_secret: secret, p_nickname: nickname });
        await save({ ...(await load()), secret, profile, tree: undefined, showcase: undefined });
        return profile;
      });
    },

    sync: (now: number) => sync(now, true),

    async forget(ids: string[], now: number): Promise<void> {
      const state = await load();
      const gone = new Set(ids);
      await save({ ...state, pushed: state.pushed.filter((id) => !gone.has(id)), removed: [...new Set([...(state.removed ?? []), ...ids])].slice(-500) });
      await sync(now, true);
    },

    async periodBoard(leagueId: string, from: number, to: number): Promise<PeriodEntry[] | null> {
      try {
        const rows = await mine<{ id: string; name: string; me: boolean; tree?: TreeRow; showcase?: string; points: number; meters: number }[] | null>(
          'vado_period_board',
          { p_league: leagueId, p_from: new Date(from).toISOString(), p_to: new Date(to).toISOString() },
        );
        return rows
          ? rows.map((r) => ({ id: r.id, name: r.name, me: r.me, tree: toTree(r.tree), showcase: parseShowcase(r.showcase), points: Number(r.points) || 0, km: (Number(r.meters) || 0) / 1000 }))
          : null;
      } catch {
        return null;
      }
    },

    async candies(leagueId: string, now: number): Promise<CandyEntry[] | null> {
      const { from, to } = candySeason(now);
      try {
        const rows = await mine<{ id: string; name: string; me: boolean; tree?: TreeRow; candies: number }[] | null>('vado_candies', {
          p_league: leagueId,
          p_from: new Date(from).toISOString(),
          p_to: new Date(to).toISOString(),
        });
        return rows ? rows.map((r) => ({ id: r.id, name: r.name, me: r.me, tree: toTree(r.tree), candies: Math.floor(Number(r.candies) || 0) })) : null;
      } catch {
        // Server non ancora aggiornato o rete assente: la scheda non compare.
        return null;
      }
    },

    async leagues(now: number): Promise<LeagueSummary[]> {
      await sync(now);
      return read('leghe', [], async () => (await mine<{ id: string; name: string; code: string }[]>('vado_leagues')).map(summary));
    },

    async board(leagueId: string, now: number): Promise<LeagueBoard | null> {
      await sync(now);
      const from = weekStart(now);
      const endsAt = weekEnd(now);
      return read(`lega:${leagueId}:${from}`, null, async () => {
        const row = await mine<{ id: string; name: string; code: string; entries: BoardRow[] } | null>('vado_board', {
          p_league: leagueId,
          p_from: new Date(from).toISOString(),
          // Fino a fine settimana e non "fino a adesso": gli orologi dei telefoni non sono identici.
          p_to: new Date(endsAt).toISOString(),
          p_before: new Date(Math.max(from, now - DAY_MS)).toISOString(),
        });
        if (!row) return null;
        const earlier = new Map(rankEntries(row.entries.map((e) => ({ id: e.id, name: e.name, points: e.before }))).map((r) => [r.id, r.rank]));
        const entries: Entry[] = row.entries.map((e) => ({
          id: e.id,
          name: e.name,
          points: e.points,
          me: e.me,
          mainMode: (e.mode as ModeId | null) ?? null,
          tree: toTree(e.tree),
          showcase: parseShowcase(e.showcase),
          previousRank: earlier.get(e.id),
        }));
        return { ...summary(row), entries, endsAt };
      });
    },

    async createLeague(name: string): Promise<Result<LeagueSummary>> {
      const clean = name.replace(/\s+/g, ' ').trim();
      if (clean.length < 2 || clean.length > 24) return { ok: false, problem: 'Il nome della lega deve avere da 2 a 24 caratteri.' };
      return write(async () => summary(await mine('vado_create_league', { p_name: clean })));
    },

    async joinLeague(text: string): Promise<Result<LeagueSummary>> {
      const code = normalizeCode(text);
      if (!code) return { ok: false, problem: 'Il codice ha 6 caratteri, lettere e cifre.' };
      return write(async () => summary(await mine('vado_join_league', { p_code: code })));
    },

    async leaveLeague(leagueId: string): Promise<void> {
      await write(() => mine('vado_leave_league', { p_league: leagueId }));
      for (const key of [...cache.keys()]) if (key.startsWith(`lega:${leagueId}:`)) cache.delete(key);
    },

    async report(userId: string): Promise<Result<{ hidden: boolean }>> {
      const result = await write(async () => await mine<{ hidden: boolean }>('vado_report', { p_target: userId }));
      if (result.ok) for (const key of [...cache.keys()]) if (key.startsWith('lega:')) cache.delete(key);
      return result.ok ? { ok: true, value: { hidden: !!result.value?.hidden } } : result;
    },

    async rivals(): Promise<Person[]> {
      return read('avversari', [], async () =>
        (await mine<{ id: string; name: string; tree?: TreeRow }[]>('vado_rivals')).map((p) => ({ id: p.id, name: p.name, tree: toTree(p.tree) })),
      );
    },

    async challenges(now: number): Promise<Challenge[]> {
      await sync(now);
      return read('sfide', [], async () => (await mine<ChallengeRow[]>('vado_challenges')).map(toChallenge));
    },

    async createChallenge(input: NewChallenge, now: number): Promise<Result<Challenge>> {
      const invalid = challengeProblem({ ...input, people: input.opponents.length + 1 });
      if (invalid) return { ok: false, problem: invalid };
      await sync(now);
      return write(async () =>
        toChallenge(
          await mine<ChallengeRow>('vado_create_challenge', {
            p_title: input.title.replace(/\s+/g, ' ').trim().slice(0, 40),
            p_kind: input.kind,
            p_target: input.kind === 'traguardo' ? input.target : 0,
            p_days: input.kind === 'tempo' ? input.days : TARGET_MAX_DAYS,
            p_teams: input.teams,
            p_opponents: input.opponents,
          }),
        ),
      );
    },

    async removeChallenge(id: string): Promise<void> {
      await write(() => mine('vado_remove_challenge', { p_challenge: id }));
    },

    async monthly(now: number): Promise<MonthlyChallenge> {
      await sync(now);
      const endsAt = monthEnd(now);
      const base = { title: `Sfida di ${monthName(now)}`, target: MONTHLY_TARGET, endsAt };
      return read('mese', { ...base, points: 0, reached: 0, people: 1 }, async () => {
        const row = await mine<{ points: number; reached: number; people: number }>('vado_monthly', {
          p_from: new Date(monthStart(now)).toISOString(),
          p_to: new Date(endsAt).toISOString(),
          p_target: MONTHLY_TARGET,
        });
        return { ...base, ...row };
      });
    },

    async recoveryCode(): Promise<string | null> {
      const { secret, profile } = await load();
      return secret && profile ? encodeRecovery(secret) : null;
    },

    async recover(code: string): Promise<Result<Profile>> {
      const decoded = decodeRecovery(code);
      if (!decoded.ok) return { ok: false, problem: decoded.problem };
      try {
        const profile = await call<Profile>('vado_me', { p_secret: decoded.secret }, { probe: true });
        // I tragitti di questo telefono ripartono tutti: il server scarta quelli che ha già.
        await save({ secret: decoded.secret, profile, pushed: [] });
        cache.clear();
        lastSync = 0;
        return { ok: true, value: profile };
      } catch (error) {
        if (error instanceof ServerError && error.code === 'non-registrato') return { ok: false, problem: UNKNOWN_CODE };
        return { ok: false, problem: error instanceof ServerError ? error.problem : OFFLINE };
      }
    },

    async reset(): Promise<void> {
      const state = await load();
      if (state.secret && state.profile) {
        // Se il server non risponde il profilo resta là, ma senza chiave non è più raggiungibile da nessuno.
        await call('vado_delete_account', { p_secret: state.secret }).catch(() => undefined);
      }
      cache.clear();
      lastProblem = null;
      lastSync = 0;
      await config.storage.remove(KEY);
    },
  };
}
