/**
 * Partecipanti di esempio per l'anteprima di classifica, leghe e sfide.
 *
 * Non sono persone: sono nomi inventati con punti calcolati da una formula.
 * La formula è fissa (stesso nome, stesso giorno → stessi punti), così la
 * classifica non cambia a caso tra un'apertura e l'altra, e i punti crescono
 * durante la settimana come farebbero quelli di una persona vera: un paio di
 * tragitti al giorno, meno nel fine settimana, qualche giorno saltato.
 *
 * Tutto questo sparisce quando la sorgente dei dati sarà un server.
 */
import type { ModeId } from '../core/modes';
import type { Tier } from '../core/social';

export type Bot = {
  id: string;
  name: string;
  /** Punti in una settimana tipica. */
  pace: number;
  mode: ModeId;
};

const B = (name: string, pace: number, mode: ModeId): Bot => ({ id: `es-${name.toLowerCase().replace(/[^a-z]/g, '')}`, name, pace, mode });

export const BOTS: readonly Bot[] = [
  B('Giulia R.', 410, 'bici'),
  B('Marco T.', 385, 'tpl'),
  B('Sara L.', 350, 'piedi'),
  B('Luca P.', 300, 'bici'),
  B('Elena M.', 270, 'tpl'),
  B('Paolo D.', 245, 'piedi'),
  B('Chiara B.', 230, 'ebike'),
  B('Andrea F.', 215, 'treno'),
  B('Martina G.', 200, 'tpl'),
  B('Davide C.', 190, 'bici'),
  B('Francesca N.', 175, 'piedi'),
  B('Simone V.', 165, 'tpl'),
  B('Alessia Z.', 150, 'treno'),
  B('Matteo S.', 140, 'ebike'),
  B('Federica A.', 130, 'piedi'),
  B('Riccardo E.', 120, 'tpl'),
  B('Valentina O.', 110, 'bici'),
  B('Stefano I.', 100, 'carsharing'),
  B('Ilaria U.', 92, 'piedi'),
  B('Giorgio H.', 85, 'tpl'),
  B('Beatrice Q.', 78, 'treno'),
  B('Tommaso K.', 70, 'bici'),
  B('Noemi W.', 62, 'tpl'),
  B('Pietro J.', 55, 'piedi'),
  B('Camilla Y.', 48, 'carsharing'),
  B('Emanuele X.', 40, 'tpl'),
  B('Arianna De.', 34, 'piedi'),
  B('Nicola Ma.', 28, 'autoel'),
  B('Greta Lo.', 22, 'tpl'),
  B('Fabio Ru.', 15, 'autoel'),
];

const BY_ID = new Map(BOTS.map((b) => [b.id, b]));
export const getBot = (id: string): Bot | undefined => BY_ID.get(id);
export const isBot = (id: string): boolean => BY_ID.has(id);

/** Numero tra 0 e 1 che dipende solo dal testo dato (FNV-1a, poi una rimescolata). */
export function chance(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Più si sale di livello, più i compagni di gruppo fanno punti. */
const TIER_SCALE: Record<Tier, number> = { Bronzo: 0.55, Argento: 0.8, Oro: 1, Platino: 1.25, Diamante: 1.5 };
export const tierScale = (tier: Tier): number => TIER_SCALE[tier];

type BotTrip = { t: number; points: number };

function dayStamp(dayStart: number): string {
  const d = new Date(dayStart);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** I tragitti di un partecipante di esempio in un giorno: mattina e sera, a volte nessuno. */
export function botTrips(bot: Bot, dayStart: number, scale = 1): BotTrip[] {
  const key = `${bot.id}|${dayStamp(dayStart)}`;
  const weekday = new Date(dayStart).getDay();
  const weekend = weekday === 0 || weekday === 6;
  // Qualche giorno senza tragitti: più spesso nel fine settimana.
  if (chance(`${key}|salta`) < (weekend ? 0.45 : 0.12)) return [];
  // 5 giorni pieni e 2 a metà: la settimana tipica vale `pace`.
  const daily = ((bot.pace * scale) / 6) * (weekend ? 0.5 : 1);
  const trips: BotTrip[] = [];
  const slots: [string, number, number][] = [
    ['mattina', 7 * 60, 150],
    ['sera', 17 * 60, 150],
  ];
  for (const [slot, from, span] of slots) {
    const points = Math.min(60, Math.round((daily / 2) * (0.5 + chance(`${key}|${slot}|punti`))));
    if (points <= 0) continue;
    const minute = from + Math.floor(chance(`${key}|${slot}|ora`) * span);
    const at = new Date(dayStart);
    at.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    trips.push({ t: at.getTime(), points });
  }
  return trips;
}

function eachDay(from: number, to: number, visit: (dayStart: number) => void): void {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  // Tetto di sicurezza: nessun periodo dell'app supera i due mesi.
  for (let i = 0; i < 70 && d.getTime() < to; i++) {
    visit(d.getTime());
    d.setDate(d.getDate() + 1);
  }
}

/** Punti fatti da un partecipante di esempio in [from, to). */
export function botPoints(bot: Bot, from: number, to: number, scale = 1): number {
  let sum = 0;
  eachDay(from, to, (day) => {
    for (const trip of botTrips(bot, day, scale)) {
      if (trip.t >= from && trip.t < to) sum += trip.points;
    }
  });
  return sum;
}

/** Quando un partecipante di esempio ha raggiunto `target` punti partendo da `from`; null se non entro `to`. */
export function botReachedAt(bot: Bot, from: number, to: number, target: number, scale = 1): number | null {
  let sum = 0;
  let reached: number | null = null;
  eachDay(from, to, (day) => {
    if (reached != null) return;
    for (const trip of botTrips(bot, day, scale)) {
      if (trip.t < from || trip.t >= to) continue;
      sum += trip.points;
      if (sum >= target) {
        reached = trip.t;
        return;
      }
    }
  });
  return reached;
}

/** Sceglie `count` partecipanti di esempio; la scelta dipende solo da `seed`. */
export function pickBots(seed: string, count: number, exclude: ReadonlySet<string> = new Set()): Bot[] {
  return BOTS.filter((b) => !exclude.has(b.id))
    .map((bot) => ({ bot, order: chance(`${seed}|${bot.id}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, count)
    .map((x) => x.bot);
}
