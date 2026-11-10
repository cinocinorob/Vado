/**
 * Il "gioco" attorno ai tragitti: missioni del giorno, esperienza e livello,
 * serie con i salvaserie. Funzioni pure: tutto si ricalcola dallo storico dei
 * tragitti, quindi niente va fuori sincronia e il backup dei tragitti basta.
 *
 * L'esperienza (XP) è separata dai punti della classifica: le missioni danno
 * XP, non punti, così in lega conta solo quanto ci si è mossi davvero.
 */
import { measure, type Metric } from './challenges';
import { dayKey, type Trip } from './scoring';

// ---------- missioni del giorno ----------

export type MissionDef = { id: string; title: string; metric: Metric | 'presto'; target: number; unit: string };
export type Mission = MissionDef & { value: number; done: boolean; ratio: number };

/** XP per ogni missione completata, e in più per averle fatte tutte e tre. */
export const MISSION_XP = 20;
export const ALL_MISSIONS_XP = 40;

/** Facile: basta un tragitto qualsiasi senza auto. */
const EASY: readonly MissionDef[] = [
  { id: 'un-tragitto', title: 'Fai un tragitto senza auto', metric: 'tragitti', target: 1, unit: 'tragitti' },
  { id: 'un-km', title: 'Fai 1 km senza auto', metric: 'km', target: 1, unit: 'km' },
  { id: 'venti-punti', title: 'Arriva a 20 punti', metric: 'punti', target: 20, unit: 'punti' },
];
/** Media: una giornata normale di spostamenti. */
const MEDIUM: readonly MissionDef[] = [
  { id: 'tre-km', title: 'Fai 3 km senza auto', metric: 'km', target: 3, unit: 'km' },
  { id: 'due-tragitti', title: 'Fai 2 tragitti senza auto', metric: 'tragitti', target: 2, unit: 'tragitti' },
  { id: 'piedi', title: 'Cammina per 1,5 km', metric: 'km-piedi', target: 1.5, unit: 'km' },
  { id: 'mezzi', title: 'Prendi un mezzo pubblico', metric: 'mezzi', target: 1, unit: 'viaggi' },
  { id: 'mezzo-kg', title: 'Evita 500 g di CO₂', metric: 'co2', target: 0.5, unit: 'kg' },
];
/** Difficile: richiede di impegnarsi. */
const HARD: readonly MissionDef[] = [
  { id: 'sei-km', title: 'Fai 6 km senza auto', metric: 'km', target: 6, unit: 'km' },
  { id: 'sessanta', title: 'Arriva a 60 punti', metric: 'punti', target: 60, unit: 'punti' },
  { id: 'tre-piedi', title: 'Cammina per 3 km', metric: 'km-piedi', target: 3, unit: 'km' },
  { id: 'presto', title: 'Parti prima delle 9', metric: 'presto', target: 1, unit: 'tragitti' },
  { id: 'tre-tragitti', title: 'Fai 3 tragitti senza auto', metric: 'tragitti', target: 3, unit: 'tragitti' },
];

/** Un numero stabile a partire dal giorno: tutti hanno le stesse missioni lo stesso giorno. */
function seed(day: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

function valueOf(def: MissionDef, trips: readonly Trip[]): number {
  if (def.metric === 'presto') {
    return trips.filter((t) => t.carFreeMeters > 0 && new Date(t.startedAt).getHours() < 9).length;
  }
  return measure(def.metric, trips);
}

/** Le tre missioni di un giorno (una facile, una media, una difficile) con l'avanzamento. */
export function missionsOf(trips: readonly Trip[], day: string): Mission[] {
  const mine = trips.filter((t) => t.day === day);
  const picks = [EASY[seed(day, 1) % EASY.length], MEDIUM[seed(day, 2) % MEDIUM.length], HARD[seed(day, 3) % HARD.length]];
  return picks.map((def) => {
    const value = valueOf(def, mine);
    return { ...def, value, done: value >= def.target - 1e-9, ratio: Math.min(1, value / def.target) };
  });
}

/** XP delle missioni di un giorno. */
export function missionXp(missions: readonly Mission[]): number {
  const done = missions.filter((m) => m.done).length;
  return done * MISSION_XP + (done === missions.length && done > 0 ? ALL_MISSIONS_XP : 0);
}

/** "1,2 di 3 km", "1 di 2". */
export function missionProgress(m: Mission): string {
  const n = (v: number) => String(m.unit === 'km' || m.unit === 'kg' ? Math.floor(Math.min(v, m.target) * 10) / 10 : Math.min(Math.floor(v), m.target)).replace('.', ',');
  const unit = m.unit === 'km' || m.unit === 'kg' || m.unit === 'punti' ? ` ${m.unit}` : '';
  return `${n(m.value)} di ${n(m.target)}${unit}`;
}

// ---------- esperienza e livello ----------

export type Level = {
  level: number;
  title: string;
  /** XP totali. */
  xp: number;
  /** XP dentro il livello corrente e quanti ne servono per il prossimo. */
  into: number;
  need: number;
  ratio: number;
};

const TITLES = ['Pedone', 'Camminatore', 'Pendolare', 'Esploratore', 'Viaggiatore', 'Maestro dei mezzi', 'Leggenda verde'];

/** XP per passare dal livello `level` al successivo: 100, 140, 180… */
export const xpNeed = (level: number): number => 100 + 40 * (level - 1);

/** Titolo del livello: cambia ogni 5 livelli. */
export const levelTitle = (level: number): string => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 5))];

export function levelOf(xp: number): Level {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (left >= xpNeed(level)) {
    left -= xpNeed(level);
    level += 1;
  }
  const need = xpNeed(level);
  return { level, title: levelTitle(level), xp: Math.max(0, Math.floor(xp)), into: left, need, ratio: left / need };
}

/** XP totali: i punti di tutti i tragitti più le missioni completate, giorno per giorno. */
export function totalXp(trips: readonly Trip[]): number {
  const points = trips.reduce((sum, t) => sum + t.total, 0);
  const days = new Set(trips.map((t) => t.day));
  let bonus = 0;
  for (const day of days) bonus += missionXp(missionsOf(trips, day));
  return points + bonus;
}

/** Giorni in cui sono state completate tutte e tre le missioni. */
export function perfectDays(trips: readonly Trip[]): number {
  let count = 0;
  for (const day of new Set(trips.map((t) => t.day))) {
    if (missionsOf(trips, day).every((m) => m.done)) count += 1;
  }
  return count;
}

// ---------- serie e salvaserie ----------

/** Ogni 7 giorni attivi di fila si guadagna un salvaserie; se ne tengono al massimo 2. */
export const FREEZE_EVERY = 7;
export const FREEZE_MAX = 2;

export type StreakState = {
  /** Giorni di fila, compresi quelli coperti da un salvaserie. */
  days: number;
  /** Salvaserie disponibili adesso. */
  freezes: number;
  /** Giorni saltati e coperti da un salvaserie nella serie in corso. */
  frozen: string[];
  /** Ieri è stato coperto da un salvaserie: da dire all'utente. */
  savedYesterday: boolean;
  /** Giorni attivi che mancano al prossimo salvaserie. */
  toNextFreeze: number;
};

function addDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n, 12).getTime());
}

/**
 * La serie con i salvaserie. Un giorno senza punti non spezza la serie se c'è
 * un salvaserie: lo consuma da solo. Oggi, finché non è finito, non conta
 * come giorno saltato.
 */
export function streakState(trips: readonly Trip[], now: number): StreakState {
  const active = new Set(trips.filter((t) => t.total > 0).map((t) => t.day));
  const today = dayKey(now);
  const empty: StreakState = { days: 0, freezes: 0, frozen: [], savedYesterday: false, toNextFreeze: FREEZE_EVERY };
  if (active.size === 0) return empty;
  let day = [...active].sort()[0];
  let days = 0;
  let run = 0;
  let freezes = 0;
  let frozen: string[] = [];
  // Giorno per giorno dal primo tragitto a ieri; oggi si aggiunge in fondo.
  for (let guard = 0; day < today && guard < 4000; guard++, day = addDay(day, 1)) {
    if (active.has(day)) {
      days += 1;
      run += 1;
      if (run % FREEZE_EVERY === 0 && freezes < FREEZE_MAX) freezes += 1;
    } else if (days > 0 && freezes > 0) {
      freezes -= 1;
      days += 1;
      frozen.push(day);
    } else {
      days = 0;
      run = 0;
      frozen = [];
    }
  }
  if (active.has(today)) {
    days += 1;
    run += 1;
    if (run % FREEZE_EVERY === 0 && freezes < FREEZE_MAX) freezes += 1;
  }
  // Una serie fatta solo di giorni coperti non è una serie.
  if (days > 0 && days === frozen.length) return { ...empty, freezes };
  return {
    days,
    freezes,
    frozen,
    savedYesterday: frozen.includes(addDay(today, -1)),
    toNextFreeze: freezes >= FREEZE_MAX ? 0 : FREEZE_EVERY - (run % FREEZE_EVERY),
  };
}
