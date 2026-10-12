/**
 * CO₂ evitata. Funzioni pure.
 *
 * Metodo ISPRA per le emissioni evitate da chi lascia l'auto privata: i km
 * fatti con un mezzo alternativo, moltiplicati per l'emissione media di
 * un'autovettura del parco italiano (banca dati ISPRA dei fattori di
 * emissione medi del trasporto stradale, 167,1 g di CO₂ per km).
 *
 * Semplificazione dichiarata, la stessa del metodo ISPRA: per mezzi pubblici e
 * treno non si sottrae la CO₂ del mezzo, quindi per loro la stima è per
 * eccesso. Car sharing e auto (anche elettrica) non contano: restano auto.
 *
 * Equivalenza con gli alberi: un albero adulto assorbe circa 22 kg di CO₂
 * l'anno (stima divulgativa dell'Agenzia europea dell'ambiente). È un ordine
 * di grandezza: secondo specie, età e clima si va da circa 10 a oltre 20 kg.
 */
import type { ModeId } from './modes';
import type { LegResult, Trip } from './scoring';

/** Grammi di CO₂ per km di un'auto media italiana (ISPRA). */
export const CAR_G_PER_KM = 167.1;
/** Grammi di CO₂ che un albero adulto assorbe in un anno. */
export const TREE_G_PER_YEAR = 22000;
export const TREE_G_PER_DAY = TREE_G_PER_YEAR / 365;

/** Mezzi che sostituiscono l'auto senza esserlo. */
const REPLACES_CAR: ReadonlySet<ModeId> = new Set<ModeId>(['piedi', 'bici', 'ebike', 'tpl', 'treno']);

/** Grammi evitati da un tratto: zero se non valido o fatto in auto. */
export function legCo2(leg: Pick<LegResult, 'mode' | 'meters' | 'status'>): number {
  if (leg.status === 'anomalo' || leg.meters <= 0 || !REPLACES_CAR.has(leg.mode)) return 0;
  return (leg.meters / 1000) * CAR_G_PER_KM;
}

export function tripCo2(trip: Pick<Trip, 'legs'>): number {
  return trip.legs.reduce((sum, leg) => sum + legCo2(leg), 0);
}

export function totalCo2(trips: Pick<Trip, 'legs'>[]): number {
  return trips.reduce((sum, trip) => sum + tripCo2(trip), 0);
}

const comma = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

/** "200 g", "1,4 kg", "38 kg". Mai "0 g" per un valore positivo. */
export function formatCo2(grams: number): string {
  if (grams <= 0) return '0 g';
  if (grams < 995) return `${Math.max(10, Math.round(grams / 10) * 10)} g`;
  const kg = grams / 1000;
  if (kg < 99.95) return `${comma(Math.round(kg * 10) / 10, 1).replace(/,0$/, '')} kg`;
  return `${Math.round(kg).toLocaleString('it-IT')} kg`;
}

/** Quanto ci mette un albero adulto ad assorbirli: "meno di un giorno", "18 giorni", "5 mesi", "1 anno e 9 mesi". */
export function treeTime(grams: number): string {
  const days = grams / TREE_G_PER_DAY;
  if (days < 1) return 'meno di un giorno';
  const d = Math.round(days);
  if (d < 60) return d === 1 ? '1 giorno' : `${d} giorni`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} mesi`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = years === 1 ? '1 anno' : `${years} anni`;
  if (rest === 0) return y;
  return `${y} e ${rest === 1 ? '1 mese' : `${rest} mesi`}`;
}
