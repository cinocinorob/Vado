/**
 * Il contratto tra le schermate di classifica, leghe e sfide e la sorgente
 * dei dati. Oggi la sorgente è quella di esempio (demo.ts), che vive solo sul
 * telefono; quando ci sarà un server basterà scriverne una seconda con le
 * stesse funzioni, senza toccare le schermate.
 */
import type { Challenge, ChallengeKind, Entry, Tier, TierState } from '../core/social';

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

export type Person = { id: string; name: string };

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

export type Result<T> = { ok: true; value: T } | { ok: false; problem: string };

export interface SocialSource {
  /** Vero se gli altri partecipanti non sono persone reali. */
  readonly demo: boolean;
  profile(): Promise<Profile | null>;
  setNickname(name: string): Promise<Result<Profile>>;
  leagues(now: number): Promise<LeagueSummary[]>;
  board(leagueId: string, now: number): Promise<LeagueBoard | null>;
  createLeague(name: string): Promise<Result<LeagueSummary>>;
  joinLeague(code: string): Promise<Result<LeagueSummary>>;
  leaveLeague(leagueId: string): Promise<void>;
  /** Persone che si possono sfidare: i compagni delle proprie leghe. */
  rivals(now: number): Promise<Person[]>;
  challenges(now: number): Promise<Challenge[]>;
  createChallenge(input: NewChallenge, now: number): Promise<Result<Challenge>>;
  removeChallenge(id: string): Promise<void>;
  monthly(now: number): Promise<MonthlyChallenge>;
}
