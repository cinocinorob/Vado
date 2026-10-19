/**
 * Storico delle vittorie in classifica: piazzamenti di fine settimana nelle
 * leghe e sfide con gli amici concluse. Il server tiene i punti solo per 70
 * giorni, quindi lo storico vive sul telefono (e nel backup).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vado.vittorie.v1';

export type LeagueResult = { league: string; leagueId: string; week: number; rank: number; people: number; points: number };
export type DuelResult = { id: string; title: string; won: boolean; endsAt: number };
export type Wins = { leagues: LeagueResult[]; duels: DuelResult[] };

export const NO_WINS: Wins = { leagues: [], duels: [] };

export async function loadWins(): Promise<Wins> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Partial<Wins>) : {};
    return { leagues: Array.isArray(p.leagues) ? p.leagues : [], duels: Array.isArray(p.duels) ? p.duels : [] };
  } catch {
    return NO_WINS;
  }
}

export async function saveWins(w: Wins): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ leagues: w.leagues.slice(-500), duels: w.duels.slice(-500) }));
}

export const podiums = (w: Wins) => w.leagues.filter((l) => l.rank <= 3 && l.people >= 2).length;
