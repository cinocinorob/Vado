/**
 * File di backup: i tragitti e, se c'è, il codice di recupero della classifica.
 *
 * Il file è testo (JSON) e resta dove lo mette l'utente: Drive, WhatsApp,
 * email. Riaprendolo su un altro telefono i tragitti vengono aggiunti a quelli
 * presenti (mai sovrascritti), e il profilo della classifica torna se su quel
 * telefono non ce n'è già uno.
 *
 * Funzioni pure, verificate in backup.test.ts.
 */
import { isSpecies, type Pause, type SpeciesId } from './plant';
import type { Trip } from './scoring';

export const BACKUP_VERSION = 1;

export type Backup = {
  app: 'vado';
  version: number;
  exportedAt: string;
  trips: Trip[];
  /** Codice di recupero della classifica, se l'utente aveva un profilo. */
  recovery: string | null;
  /** Il germoglio: albero scelto, specie degli alberi del bosco e pause. Dalla versione 1 dell'app con il bosco. */
  plant?: Extra;
  /** Percorsi virtuali, vittorie e vetrina delle medaglie. */
  progress?: Progress;
};

export type Progress = {
  journeys: { current: { id: string; startedAt: number } | null; done: { id: string; startedAt: number; doneAt: number }[] };
  wins: {
    leagues: { league: string; leagueId: string; week: number; rank: number; people: number; points: number }[];
    duels: { id: string; title: string; won: boolean; endsAt: number }[];
  };
  showcase: string[] | null;
};

export type Extra = { species: SpeciesId | null; history: SpeciesId[]; pauses: Pause[] };

export function buildBackup(trips: Trip[], recovery: string | null, now: number, plant?: Extra, progress?: Progress): Backup {
  const sorted = [...trips].sort((a, b) => a.endedAt - b.endedAt);
  return {
    app: 'vado',
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    trips: sorted,
    recovery,
    ...(plant ? { plant } : {}),
    ...(progress ? { progress } : {}),
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 200;
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj).filter((x): x is Record<string, unknown> => !!x) : []);

/** Legge la parte "progress" di un backup scartando le righe rovinate. */
export function readProgress(value: unknown): Progress | null {
  const v = obj(value);
  if (!v) return null;
  const j = obj(v.journeys);
  const w = obj(v.wins);
  const cur = obj(j?.current);
  return {
    journeys: {
      current: cur && str(cur.id) && num(cur.startedAt) ? { id: cur.id, startedAt: cur.startedAt } : null,
      done: list(j?.done)
        .filter((d) => str(d.id) && num(d.startedAt) && num(d.doneAt))
        .map((d) => ({ id: d.id as string, startedAt: d.startedAt as number, doneAt: d.doneAt as number })),
    },
    wins: {
      leagues: list(w?.leagues)
        .filter((l) => str(l.league) && str(l.leagueId) && num(l.week) && num(l.rank) && num(l.people) && num(l.points))
        .map((l) => ({ league: l.league as string, leagueId: l.leagueId as string, week: l.week as number, rank: l.rank as number, people: l.people as number, points: l.points as number })),
      duels: list(w?.duels)
        .filter((d) => str(d.id) && str(d.title) && typeof d.won === 'boolean' && num(d.endsAt))
        .map((d) => ({ id: d.id as string, title: d.title as string, won: d.won as boolean, endsAt: d.endsAt as number })),
    },
    showcase: Array.isArray(v.showcase) ? v.showcase.filter(str).slice(0, 3) : null,
  };
}

/** Unisce i progressi del file a quelli del telefono: niente si perde, niente si duplica. */
export function mergeProgress(here: Progress, file: Progress): Progress {
  const byKey = <T,>(a: T[], b: T[], key: (x: T) => string) => {
    const seen = new Set(a.map(key));
    return [...a, ...b.filter((x) => !seen.has(key(x)))];
  };
  return {
    journeys: {
      current: here.journeys.current ?? file.journeys.current,
      done: byKey(here.journeys.done, file.journeys.done, (d) => `${d.id}:${d.doneAt}`),
    },
    wins: {
      leagues: byKey(here.wins.leagues, file.wins.leagues, (l) => `${l.leagueId}:${l.week}`),
      duels: byKey(here.wins.duels, file.wins.duels, (d) => d.id),
    },
    showcase: here.showcase ?? file.showcase,
  };
}

/** Nome del file: "vado-backup-2026-10-12.json". */
export function backupName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `vado-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Un tragitto letto da un file ha la forma minima che serve alle schermate? */
function isTrip(value: unknown): value is Trip {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === 'string' &&
    t.id.length > 0 &&
    typeof t.day === 'string' &&
    typeof t.startedAt === 'number' &&
    typeof t.endedAt === 'number' &&
    typeof t.total === 'number' &&
    typeof t.meters === 'number' &&
    Array.isArray(t.legs)
  );
}

export type Parsed = { ok: true; trips: Trip[]; recovery: string | null; ignored: number; plant: Extra | null; progress: Progress | null } | { ok: false; problem: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function readExtra(value: unknown): Extra | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const pauses = Array.isArray(v.pauses)
    ? v.pauses.filter((p): p is Pause => !!p && typeof p.from === 'string' && DAY.test(p.from) && (p.to === null || (typeof p.to === 'string' && DAY.test(p.to))))
    : [];
  return {
    species: isSpecies(v.species) ? v.species : null,
    history: Array.isArray(v.history) ? v.history.filter(isSpecies) : [],
    pauses: pauses.map((p) => ({ from: p.from, to: p.to })),
  };
}

export function parseBackup(text: string): Parsed {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'Questo file non è un backup di Vado: non riesco a leggerlo.' };
  }
  const backup = data as Partial<Backup> | null;
  if (!backup || typeof backup !== 'object' || backup.app !== 'vado' || !Array.isArray(backup.trips)) {
    return { ok: false, problem: 'Questo file non è un backup di Vado.' };
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    return { ok: false, problem: "Il backup viene da una versione più recente di Vado: aggiorna l'app e riprova." };
  }
  const trips = backup.trips.filter(isTrip);
  return {
    ok: true,
    trips,
    recovery: typeof backup.recovery === 'string' && backup.recovery.length > 0 ? backup.recovery : null,
    ignored: backup.trips.length - trips.length,
    plant: readExtra(backup.plant),
    progress: readProgress(backup.progress),
  };
}

/** I tragitti del file che sul telefono non ci sono ancora. Quelli già presenti restano come sono. */
export function newTrips(existing: Trip[], incoming: Trip[]): Trip[] {
  const known = new Set(existing.map((t) => t.id));
  const added: Trip[] = [];
  for (const trip of incoming) {
    if (known.has(trip.id)) continue;
    known.add(trip.id);
    added.push(trip);
  }
  return added;
}
