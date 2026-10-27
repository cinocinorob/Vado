/**
 * Il contratto tra le schermate di classifica, leghe e sfide e la sorgente
 * dei dati. Le sorgenti sono due: quella vera, che parla con il server
 * (remote.ts), e quella di esempio con partecipanti inventati (demo.ts), che
 * vive solo sul telefono e serve per le prove delle schermate.
 */
import type { TreeBadge } from '../core/plant';
import type { Challenge, ChallengeKind, Entry, Showcase, Tier, TierState } from '../core/social';

export type Profile = {
  id: string;
  nickname: string;
};

export type LeagueKind =
  /** Gruppi formati dall'app, con promozioni e retrocessioni settimanali. */
  | 'livelli'
  /** Gruppo in cui si entra con un codice. */
  | 'invito';

export type LeagueSummary = {
  id: string;
  kind: LeagueKind;
  name: string;
  /** Solo per la lega a livelli. */
  tier?: Tier;
  /** Solo per le leghe con invito. */
  code?: string;
};

export type LeagueBoard = LeagueSummary & {
  /** Partecipanti con i punti della settimana in corso. */
  entries: Entry[];
  /** Fine della settimana. */
  endsAt: number;
  /** Esito della settimana scorsa nella lega a livelli, da mostrare una volta. */
  outcome?: TierState['lastOutcome'];
};

export type Person = { id: string; name: string; tree?: TreeBadge | null };

export type NewChallenge = {
  title: string;
  kind: ChallengeKind;
  /** Punti del traguardo (solo "traguardo"). */
  target: number;
  /** Durata in giorni (solo "tempo"). */
  days: number;
  teams: boolean;
  /** Avversari, senza l'utente. */
  opponents: string[];
};

export type MonthlyChallenge = {
  title: string;
  target: number;
  points: number;
  endsAt: number;
  /** Quanti partecipanti hanno già raggiunto il traguardo, e su quanti. */
  reached: number;
  people: number;
};

/** Punti e km senza auto di un partecipante in un periodo (la sfida del mese). */
export type PeriodEntry = { id: string; name: string; me: boolean; tree: TreeBadge | null; showcase: Showcase[]; points: number; km: number };

/** Caramelle di Halloween di un partecipante della lega. */
export type CandyEntry = { id: string; name: string; me: boolean; tree: TreeBadge | null; candies: number };

export type Result<T> = { ok: true; value: T } | { ok: false; problem: string };

export interface SocialSource {
  /** Vero se gli altri partecipanti non sono persone reali. */
  readonly demo: boolean;
  /** L'ultimo problema di collegamento, se l'ultima lettura non è andata a buon fine. */
  problem(): string | null;
  /** Manda al server i punti dei tragitti nuovi, così gli altri li vedono. */
  sync(now: number): Promise<void>;
  /** Cancella il profilo, qui e sul server. */
  reset(): Promise<void>;
  /** Toglie dal server i punti di tragitti cancellati sul telefono. */
  forget(ids: string[], now: number): Promise<void>;
  /** Classifica di una lega su un periodo; null se non disponibile. */
  periodBoard(leagueId: string, from: number, to: number): Promise<PeriodEntry[] | null>;
  /** Classifica delle caramelle di Halloween in una lega; null se non disponibile. */
  candies(leagueId: string, now: number): Promise<CandyEntry[] | null>;
  /** Codice da annotare per ritrovare il profilo su un altro telefono; null se non c'è un profilo. */
  recoveryCode(): Promise<string | null>;
  /** Ritrova un profilo dal suo codice di recupero. Sostituisce quello eventualmente presente su questo telefono. */
  recover(code: string): Promise<Result<Profile>>;
  profile(): Promise<Profile | null>;
  setNickname(name: string): Promise<Result<Profile>>;
  leagues(now: number): Promise<LeagueSummary[]>;
  board(leagueId: string, now: number): Promise<LeagueBoard | null>;
  createLeague(name: string): Promise<Result<LeagueSummary>>;
  joinLeague(code: string): Promise<Result<LeagueSummary>>;
  leaveLeague(leagueId: string): Promise<void>;
  /** Segnala il soprannome di un compagno di lega (offensivo, inappropriato). */
  report(userId: string): Promise<Result<{ hidden: boolean }>>;
  /** Persone che si possono sfidare: i compagni delle proprie leghe. */
  rivals(now: number): Promise<Person[]>;
  challenges(now: number): Promise<Challenge[]>;
  createChallenge(input: NewChallenge, now: number): Promise<Result<Challenge>>;
  removeChallenge(id: string): Promise<void>;
  monthly(now: number): Promise<MonthlyChallenge>;
}
