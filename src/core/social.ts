/**
 * Regole di classifica, leghe e sfide. Funzioni pure: non sanno da dove
 * arrivano i punti degli altri (oggi da dati di esempio, domani da un server).
 *
 * Si gareggia sempre e solo sui punti, quelli calcolati da scoring.ts.
 *
 * - Classifica: settimanale, dal lunedì alla domenica.
 * - Leghe con invito: un gruppo in cui si entra con un codice.
 * - Lega a livelli: gruppi formati dall'app; a fine settimana i primi salgono
 *   di livello e gli ultimi scendono.
 * - Sfide, sul modello di Samsung Health: "primo al traguardo" (vince chi
 *   arriva per primo a un numero di punti) e "chi fa di più" (vince chi ne fa
 *   di più in un tempo fissato), individuali o a due squadre, fino a 10 persone.
 */
import type { ModeId } from './modes';
import type { TreeBadge } from './plant';
import type { Trip } from './scoring';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// ---------- tempo ----------

/** Lunedì alle 00:00 (ora del telefono) della settimana che contiene `now`. */
export function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // getDay: 0 domenica … 6 sabato. Si torna indietro fino a lunedì.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** Lunedì successivo alle 00:00. Si passa dal calendario, così il cambio dell'ora non sposta il confine. */
export function weekEnd(now: number): number {
  const d = new Date(weekStart(now));
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

/** Numero della settimana secondo ISO 8601 (la settimana 1 contiene il primo giovedì dell'anno). */
export function isoWeek(now: number): { year: number; week: number } {
  const d = new Date(weekStart(now));
  d.setDate(d.getDate() + 3); // giovedì della stessa settimana
  const year = d.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return { year, week };
}

/** Chiave stabile della settimana, per esempio "2026-S41". */
export function weekKey(now: number): string {
  const { year, week } = isoWeek(now);
  return `${year}-S${String(week).padStart(2, '0')}`;
}

/** "Settimana 41 · 5–11 ottobre", "Settimana 40 · 28 settembre–4 ottobre". */
export function weekLabel(now: number): string {
  const start = new Date(weekStart(now));
  const end = new Date(weekEnd(now) - 1);
  const range =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
      : `${start.getDate()} ${MONTHS[start.getMonth()]}–${end.getDate()} ${MONTHS[end.getMonth()]}`;
  return `Settimana ${isoWeek(now).week} · ${range}`;
}

export function monthStart(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function monthEnd(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

export function monthName(now: number): string {
  return MONTHS[new Date(now).getMonth()];
}

/** "tra 3 giorni", "domani", "oggi", "tra 5 ore". */
export function timeLeft(until: number, now: number): string {
  const ms = until - now;
  if (ms <= 0) return 'conclusa';
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return 'meno di un\'ora';
  if (hours < 24) {
    const h = Math.floor(hours);
    return h === 1 ? '1 ora' : `${h} ore`;
  }
  const days = Math.ceil(ms / DAY_MS);
  return days === 1 ? '1 giorno' : `${days} giorni`;
}

// ---------- punti dell'utente ----------

/** Punti dei tragitti conclusi in [from, to). Conta l'istante di fine, come nella schermata Oggi. */
export function pointsBetween(trips: Trip[], from: number, to: number): number {
  let sum = 0;
  for (const trip of trips) {
    if (trip.endedAt >= from && trip.endedAt < to) sum += trip.total;
  }
  return sum;
}

/** Istante in cui i punti accumulati da `from` hanno raggiunto `target`; null se non ancora. */
export function reachedAt(trips: Trip[], from: number, to: number, target: number): number | null {
  if (target <= 0) return from;
  let sum = 0;
  for (const trip of [...trips].sort((a, b) => a.endedAt - b.endedAt)) {
    if (trip.endedAt < from || trip.endedAt >= to) continue;
    sum += trip.total;
    if (sum >= target) return trip.endedAt;
  }
  return null;
}

/** Il mezzo che ha portato più punti nel periodo ("Soprattutto in bici"); null se non ci sono punti. */
export function mainMode(trips: Trip[], from: number, to: number): ModeId | null {
  const byMode = new Map<ModeId, number>();
  for (const trip of trips) {
    if (trip.endedAt < from || trip.endedAt >= to) continue;
    for (const leg of trip.legs) {
      if (leg.points > 0) byMode.set(leg.mode, (byMode.get(leg.mode) ?? 0) + leg.points);
    }
  }
  let best: ModeId | null = null;
  let top = 0;
  for (const [mode, points] of byMode) {
    if (points > top) {
      best = mode;
      top = points;
    }
  }
  return best;
}

const MODE_PHRASE: Record<ModeId, string> = {
  piedi: 'Soprattutto a piedi',
  bici: 'Soprattutto in bici',
  ebike: 'Soprattutto in bici elettrica',
  tpl: 'Soprattutto con i mezzi',
  treno: 'Soprattutto in treno',
  carsharing: 'Soprattutto in car sharing',
  autoel: 'Soprattutto in auto elettrica',
  auto: 'Soprattutto in auto',
};

export const modePhrase = (mode: ModeId | null | undefined): string => (mode ? MODE_PHRASE[mode] : 'Ancora nessun punto');

// ---------- graduatoria ----------

export type Entry = {
  id: string;
  name: string;
  points: number;
  /** È l'utente di questo telefono. */
  me?: boolean;
  mainMode?: ModeId | null;
  /** L'albero scelto e la sua crescita, per l'avatar. */
  tree?: TreeBadge | null;
  /** Posizione nella rilevazione precedente, per la freccia su/giù. */
  previousRank?: number;
};

export type Trend = 'su' | 'giu' | 'stabile';

export type Ranked = Entry & {
  /** Posizione, da 1. A parità di punti la posizione è la stessa (1, 2, 2, 4). */
  rank: number;
  trend: Trend | null;
};

export function rankEntries(entries: Entry[]): Ranked[] {
  const sorted = [...entries].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'it') || a.id.localeCompare(b.id));
  const ranked: Ranked[] = [];
  sorted.forEach((entry, i) => {
    const rank = i > 0 && sorted[i - 1].points === entry.points ? ranked[i - 1].rank : i + 1;
    const trend: Trend | null =
      entry.previousRank == null ? null : rank < entry.previousRank ? 'su' : rank > entry.previousRank ? 'giu' : 'stabile';
    ranked.push({ ...entry, rank, trend });
  });
  return ranked;
}

/** Iniziali per il cerchio accanto al nome: "Giulia R." → "GR", "marco" → "MA". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

/** La riga sotto il nome dell'utente: quanto manca a chi gli sta davanti. */
export function gapPhrase(ranked: Ranked[], id: string): string {
  const me = ranked.find((r) => r.id === id);
  if (!me) return '';
  if (me.rank === 1) {
    const others = ranked.filter((r) => r.id !== id);
    if (others.length === 0) return 'Per ora ci sei solo tu';
    const lead = me.points - Math.max(...others.map((r) => r.points));
    return lead === 0 ? 'In testa a pari merito' : `In testa con ${lead} ${lead === 1 ? 'punto' : 'punti'} di vantaggio`;
  }
  if (me.rank > 3) {
    const third = ranked.filter((r) => r.rank <= 3).reduce((min, r) => Math.min(min, r.points), Infinity);
    const gap = third - me.points;
    return `${gap} ${gap === 1 ? 'punto' : 'punti'} dal podio`;
  }
  const ahead = ranked.filter((r) => r.points > me.points).reduce((min, r) => Math.min(min, r.points), Infinity);
  if (!Number.isFinite(ahead)) return 'A pari merito con chi hai accanto';
  const gap = ahead - me.points;
  return `${gap} ${gap === 1 ? 'punto' : 'punti'} da chi hai davanti`;
}

// ---------- lega a livelli ----------

export const TIERS = ['Bronzo', 'Argento', 'Oro', 'Platino', 'Diamante'] as const;
export type Tier = (typeof TIERS)[number];

/** Persone in un gruppo della lega a livelli. */
export const TIER_GROUP_SIZE = 20;
/** I primi di ogni gruppo salgono di livello. */
export const PROMOTED = 5;
/** Gli ultimi scendono. */
export const RELEGATED = 5;

export type Zone = 'sale' | 'resta' | 'scende';

/**
 * Cosa succede a fine settimana a chi è in una certa posizione.
 * Senza punti non si sale mai, nemmeno arrivando tra i primi di un gruppo
 * fermo: salire deve voler dire essersi mossi. Dal primo livello non si
 * scende e dall'ultimo non si sale.
 */
export function zoneFor(rank: number, groupSize: number, tier: Tier, points: number): Zone {
  const index = TIERS.indexOf(tier);
  const promoted = Math.min(PROMOTED, Math.max(0, groupSize - RELEGATED));
  if (index < TIERS.length - 1 && points > 0 && rank <= promoted) return 'sale';
  if (index > 0 && rank > groupSize - RELEGATED) return 'scende';
  return 'resta';
}

export function tierAfter(tier: Tier, zone: Zone): Tier {
  const index = TIERS.indexOf(tier);
  if (zone === 'sale') return TIERS[Math.min(TIERS.length - 1, index + 1)];
  if (zone === 'scende') return TIERS[Math.max(0, index - 1)];
  return tier;
}

export type TierState = {
  tier: Tier;
  /** Settimana a cui si riferisce `tier`. */
  week: string;
  /** Esito dell'ultima settimana conclusa, da mostrare una volta. */
  lastOutcome?: { week: string; zone: Zone; rank: number; from: Tier };
};

/**
 * Passaggio alla settimana nuova. `finalRank` e `finalPoints` sono quelli con
 * cui l'utente ha chiuso la settimana in `state.week`. Se sono passate più
 * settimane senza aprire l'app, per quelle saltate si resta dove si è.
 */
export function rollTier(state: TierState, currentWeek: string, finalRank: number, finalPoints: number, groupSize = TIER_GROUP_SIZE): TierState {
  if (state.week === currentWeek) return state;
  const zone = zoneFor(finalRank, groupSize, state.tier, finalPoints);
  return {
    tier: tierAfter(state.tier, zone),
    week: currentWeek,
    lastOutcome: { week: state.week, zone, rank: finalRank, from: state.tier },
  };
}

// ---------- sfide ----------

/** "traguardo": vince chi arriva per primo a `target` punti. "tempo": vince chi ne fa di più entro la fine. */
export type ChallengeKind = 'traguardo' | 'tempo';

/** Massimo di partecipanti a una sfida, chi la crea compreso. */
export const CHALLENGE_MAX_PEOPLE = 10;
export const TARGET_CHOICES = [100, 250, 500] as const;
export const DURATION_CHOICES_DAYS = [3, 7, 14] as const;
/** Una sfida a traguardo non resta aperta per sempre. */
export const TARGET_MAX_DAYS = 30;

export type Challenger = Entry & {
  /** Per le sfide a traguardo: quando ha raggiunto il traguardo. */
  reachedAt?: number | null;
  /** Per le sfide a squadre. */
  team?: 0 | 1;
};

export type Challenge = {
  id: string;
  title: string;
  kind: ChallengeKind;
  /** Punti da raggiungere (solo "traguardo"). */
  target: number;
  startsAt: number;
  endsAt: number;
  /** Due squadre: conta la somma dei punti di ciascuna. */
  teams: boolean;
  people: Challenger[];
};

export type Side = {
  /** Nome del partecipante o della squadra. */
  name: string;
  points: number;
  ids: string[];
  me: boolean;
  reachedAt: number | null;
};

export type ChallengeState = {
  status: 'in-attesa' | 'in-corso' | 'conclusa';
  /** I contendenti, già ordinati: partecipanti oppure le due squadre. */
  sides: (Side & { rank: number; ratio: number })[];
  /** Vincitori; più di uno in caso di pari merito, nessuno se nessuno ha fatto punti. */
  winners: string[];
  /** L'utente è tra i vincitori. */
  won: boolean;
  /** Istante in cui la sfida si è chiusa (o si chiuderà). */
  closesAt: number;
};

export const TEAM_NAMES = ['Squadra lime', 'Squadra corallo'] as const;

function sidesOf(challenge: Challenge): Side[] {
  if (!challenge.teams) {
    return challenge.people.map((p) => ({ name: p.name, points: p.points, ids: [p.id], me: p.me === true, reachedAt: p.reachedAt ?? null }));
  }
  return ([0, 1] as const).map((team) => {
    const members = challenge.people.filter((p) => (p.team ?? 0) === team);
    return {
      name: TEAM_NAMES[team],
      points: members.reduce((sum, p) => sum + p.points, 0),
      ids: members.map((p) => p.id),
      me: members.some((p) => p.me),
      // Per le squadre il traguardo vale sulla somma: lo decide chi fornisce i dati.
      reachedAt: members.reduce<number | null>((min, p) => (p.reachedAt != null && (min == null || p.reachedAt < min) ? p.reachedAt : min), null),
    };
  });
}

/**
 * Stato di una sfida all'istante `now`.
 *
 * Traguardo: si chiude appena qualcuno ci arriva (vince chi ci è arrivato
 * prima; stesso istante = pari merito). Se alla scadenza non ci è arrivato
 * nessuno vince chi ha più punti. Tempo: si chiude alla scadenza e vince chi
 * ha più punti. Con zero punti non vince nessuno.
 */
export function challengeState(challenge: Challenge, now: number): ChallengeState {
  const sides = sidesOf(challenge);
  const top = Math.max(0, ...sides.map((s) => s.points));
  const scale = challenge.kind === 'traguardo' ? challenge.target : top;

  let closesAt = challenge.endsAt;
  let winners: Side[] = [];
  let closed = now >= challenge.endsAt;

  if (challenge.kind === 'traguardo') {
    const arrived = sides.filter((s) => s.reachedAt != null && s.reachedAt <= now);
    if (arrived.length > 0) {
      const first = Math.min(...arrived.map((s) => s.reachedAt as number));
      winners = arrived.filter((s) => s.reachedAt === first);
      closesAt = Math.min(first, challenge.endsAt);
      closed = true;
    }
  }
  if (closed && winners.length === 0 && top > 0) winners = sides.filter((s) => s.points === top);

  const order = [...sides].sort((a, b) => {
    // Chi è arrivato al traguardo sta davanti, in ordine di arrivo.
    const ra = a.reachedAt ?? Infinity;
    const rb = b.reachedAt ?? Infinity;
    if (challenge.kind === 'traguardo' && ra !== rb) return ra - rb;
    return b.points - a.points || a.name.localeCompare(b.name, 'it');
  });
  const ranked: ChallengeState['sides'] = [];
  order.forEach((side, i) => {
    const previous = order[i - 1];
    const tie = i > 0 && previous.points === side.points && (previous.reachedAt ?? null) === (side.reachedAt ?? null);
    ranked.push({
      ...side,
      rank: tie ? ranked[i - 1].rank : i + 1,
      ratio: scale > 0 ? Math.min(1, side.points / scale) : 0,
    });
  });

  const winnerIds = winners.flatMap((w) => w.ids);
  return {
    status: now < challenge.startsAt ? 'in-attesa' : closed ? 'conclusa' : 'in-corso',
    sides: ranked,
    winners: winnerIds,
    won: winners.some((w) => w.me),
    closesAt,
  };
}

/** Una riga che riassume la sfida: "Primo a 250 punti", "Chi fa più punti in 7 giorni". */
export function challengeRule(challenge: Challenge): string {
  const who = challenge.teams ? 'La prima squadra' : 'Il primo';
  if (challenge.kind === 'traguardo') return `${who} a ${challenge.target} punti`;
  const days = Math.round((challenge.endsAt - challenge.startsAt) / DAY_MS);
  return `${challenge.teams ? 'La squadra che' : 'Chi'} fa più punti in ${days} ${days === 1 ? 'giorno' : 'giorni'}`;
}

/** Controlli sui dati di una sfida nuova; restituisce il problema o null. */
export function challengeProblem(input: { title: string; kind: ChallengeKind; target: number; days: number; people: number; teams: boolean }): string | null {
  if (input.title.trim().length < 2) return 'Dai un nome alla sfida.';
  if (input.people < 2) return 'Scegli almeno un avversario.';
  if (input.people > CHALLENGE_MAX_PEOPLE) return `Al massimo ${CHALLENGE_MAX_PEOPLE} persone, te compreso.`;
  if (input.teams && input.people < 4) return 'Per le squadre servono almeno quattro persone.';
  if (input.kind === 'traguardo' && !(input.target > 0)) return 'Scegli il traguardo.';
  if (input.kind === 'tempo' && !(input.days > 0)) return 'Scegli la durata.';
  return null;
}

// ---------- leghe con invito ----------

/** Lettere e cifre che non si confondono leggendole ad alta voce (niente O/0, I/1). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

/** Codice d'invito da un numero casuale tra 0 e 1 fornito da chi chiama. */
export function inviteCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return code;
}

/** Ripulisce ciò che l'utente ha scritto: maiuscole, niente spazi o trattini. Null se non può essere un codice. */
export function normalizeCode(text: string): string | null {
  const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** Soprannome accettabile: da 2 a 20 caratteri visibili. Restituisce il nome ripulito o null. */
export function cleanNickname(text: string): string | null {
  const name = text.replace(/\s+/g, ' ').trim();
  return name.length >= 2 && name.length <= 20 ? name : null;
}
