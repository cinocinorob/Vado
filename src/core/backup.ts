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
import type { Trip } from './scoring';

export const BACKUP_VERSION = 1;

export type Backup = {
  app: 'vado';
  version: number;
  exportedAt: string;
  trips: Trip[];
  /** Codice di recupero della classifica, se l'utente aveva un profilo. */
  recovery: string | null;
};

export function buildBackup(trips: Trip[], recovery: string | null, now: number): Backup {
  const sorted = [...trips].sort((a, b) => a.endedAt - b.endedAt);
  return { app: 'vado', version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), trips: sorted, recovery };
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

export type Parsed = { ok: true; trips: Trip[]; recovery: string | null; ignored: number } | { ok: false; problem: string };

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
