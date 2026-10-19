/**
 * Sfide personali: una per settimana e una al mese, uguali per tutti, che
 * cambiano da sole. Funzioni pure: lo stato si ricalcola ogni volta dai
 * tragitti, quindi anche lo storico delle sfide completate non va salvato.
 */
import { legCo2 } from './co2';
import { getMode, type ModeId } from './modes';
import type { Trip } from './scoring';
import { monthStart, weekStart } from './social';

export type Metric = 'km' | 'km-piedi' | 'km-bici' | 'mezzi' | 'giorni' | 'punti' | 'tragitti' | 'co2';

export type ChallengeDef = { id: string; title: string; goal: string; metric: Metric; target: number };

/** Tratto valido che sostituisce l'auto. */
const good = (leg: Trip['legs'][number]) => legCo2(leg) > 0;
const MIN_M = 500;

function kmOf(trips: readonly Trip[], modes?: ModeId[]): number {
  let m = 0;
  for (const t of trips) for (const l of t.legs) if (good(l) && (!modes || modes.includes(l.mode))) m += l.meters;
  return m / 1000;
}

export function measure(metric: Metric, trips: readonly Trip[]): number {
  switch (metric) {
    case 'km':
      return kmOf(trips);
    case 'km-piedi':
      return kmOf(trips, ['piedi']);
    case 'km-bici':
      return kmOf(trips, ['bici', 'ebike']);
    case 'mezzi':
      return trips.filter((t) => t.legs.some((l) => good(l) && (l.mode === 'tpl' || l.mode === 'treno') && l.meters >= MIN_M)).length;
    case 'tragitti':
      return trips.filter((t) => t.legs.some((l) => good(l) && l.meters >= MIN_M)).length;
    case 'giorni': {
      const ok = new Set<string>();
      const bad = new Set<string>();
      for (const t of trips) {
        if (t.legs.some((l) => getMode(l.mode).privateCar && l.meters > 0)) bad.add(t.day);
        else if (t.legs.some((l) => good(l) && l.meters >= MIN_M)) ok.add(t.day);
      }
      return [...ok].filter((d) => !bad.has(d)).length;
    }
    case 'punti':
      return trips.reduce((s, t) => s + t.total, 0);
    case 'co2':
      return trips.reduce((s, t) => s + t.legs.reduce((x, l) => x + legCo2(l), 0), 0) / 1000;
  }
}

/** Le sfide della settimana: si va in ordine, una a settimana. */
export const WEEKLY: readonly ChallengeDef[] = [
  { id: 's-km20', title: 'Venti senza auto', goal: '20 km senza auto', metric: 'km', target: 20 },
  { id: 's-mezzi5', title: 'Pendolare pubblico', goal: '5 viaggi con i mezzi', metric: 'mezzi', target: 5 },
  { id: 's-piedi15', title: 'Gambe in spalla', goal: '15 km a piedi', metric: 'km-piedi', target: 15 },
  { id: 's-giorni5', title: 'Cinque su sette', goal: '5 giorni senza auto', metric: 'giorni', target: 5 },
  { id: 's-punti300', title: 'Trecento', goal: '300 punti', metric: 'punti', target: 300 },
  { id: 's-bici20', title: 'Pedala', goal: '20 km in bici', metric: 'km-bici', target: 20 },
  { id: 's-trag10', title: 'Dieci uscite', goal: '10 tragitti senza auto', metric: 'tragitti', target: 10 },
  { id: 's-co2', title: 'Aria pulita', goal: '4 kg di CO₂ evitata', metric: 'co2', target: 4 },
];

/** Le sfide del mese, una per mese dell'anno (gennaio = 0). */
export const MONTHLY: readonly ChallengeDef[] = [
  { id: 'm-01', title: 'Ripartenza', goal: '15 giorni senza auto', metric: 'giorni', target: 15 },
  { id: 'm-02', title: 'Febbraio a piedi', goal: '60 km a piedi', metric: 'km-piedi', target: 60 },
  { id: 'm-03', title: 'Marzo dei mezzi', goal: '25 viaggi con i mezzi', metric: 'mezzi', target: 25 },
  { id: 'm-04', title: 'Aprile in bici', goal: '80 km in bici', metric: 'km-bici', target: 80 },
  { id: 'm-05', title: 'Maggio verde', goal: '20 kg di CO₂ evitata', metric: 'co2', target: 20 },
  { id: 'm-06', title: 'Giugno in movimento', goal: '1.200 punti', metric: 'punti', target: 1200 },
  { id: 'm-07', title: 'Estate leggera', goal: '100 km senza auto', metric: 'km', target: 100 },
  { id: 'm-08', title: 'Agosto per strada', goal: '40 tragitti senza auto', metric: 'tragitti', target: 40 },
  { id: 'm-09', title: 'Si torna in città', goal: '20 giorni senza auto', metric: 'giorni', target: 20 },
  { id: 'm-10', title: 'Ottobre da paura', goal: '120 km senza auto', metric: 'km', target: 120 },
  { id: 'm-11', title: 'Novembre a piedi', goal: '100 km a piedi', metric: 'km-piedi', target: 100 },
  { id: 'm-12', title: 'Dicembre dei mezzi', goal: '30 viaggi con i mezzi', metric: 'mezzi', target: 30 },
];

/** Numero della settimana dal 5 gennaio 2026 (un lunedì), per far girare le sfide. */
function weekNumber(start: number): number {
  return Math.round((start - new Date(2026, 0, 5).getTime()) / (7 * 24 * 3600 * 1000));
}

export type ChallengeRun = ChallengeDef & { from: number; to: number; value: number; done: boolean; ratio: number };

function run(def: ChallengeDef, trips: readonly Trip[], from: number, to: number): ChallengeRun {
  const value = measure(def.metric, trips.filter((t) => t.endedAt >= from && t.endedAt < to));
  const done = value >= def.target - 1e-6;
  return { ...def, from, to, value, done, ratio: Math.min(1, value / def.target) };
}

function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function weeklyAt(trips: readonly Trip[], now: number): ChallengeRun {
  const from = weekStart(now);
  const n = ((weekNumber(from) % WEEKLY.length) + WEEKLY.length) % WEEKLY.length;
  return run(WEEKLY[n], trips, from, addDays(from, 7));
}

export function monthlyAt(trips: readonly Trip[], now: number): ChallengeRun {
  const from = monthStart(now);
  const d = new Date(from);
  return run(MONTHLY[d.getMonth()], trips, from, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime());
}

/** Sfide della settimana e del mese già concluse e completate, dalla più recente. */
export function completedChallenges(trips: readonly Trip[], now: number): ChallengeRun[] {
  if (trips.length === 0) return [];
  const first = Math.min(...trips.map((t) => t.endedAt));
  const out: ChallengeRun[] = [];
  for (let w = addDays(weekStart(now), -7); w >= weekStart(first); w = addDays(w, -7)) {
    const r = weeklyAt(trips, w);
    if (r.done) out.push(r);
  }
  for (let m = monthStart(now) - 1; m >= monthStart(first); m = monthStart(m) - 1) {
    const r = monthlyAt(trips, m);
    if (r.done) out.push(r);
  }
  return out.sort((a, b) => b.to - a.to);
}

/** "12,5 di 20 km", "3 di 5 viaggi". */
export function challengeProgress(r: Pick<ChallengeRun, 'metric' | 'value' | 'target'>): string {
  const num = (n: number) => (Number.isInteger(n) ? String(n) : (Math.floor(n * 10) / 10).toFixed(1).replace('.', ',')).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const unit: Record<Metric, string> = {
    km: 'km', 'km-piedi': 'km', 'km-bici': 'km', mezzi: 'viaggi', giorni: 'giorni', punti: 'punti', tragitti: 'tragitti', co2: 'kg',
  };
  const v = r.metric.startsWith('km') || r.metric === 'co2' ? Math.floor(r.value * 10) / 10 : Math.floor(r.value);
  return `${num(v)} di ${num(r.target)} ${unit[r.metric]}`;
}
