/**
 * Registra le vittorie: a ogni apertura della classifica si guardano le
 * settimane concluse delle proprie leghe (fino a 8 indietro, finché il server
 * ha i punti) e le sfide con gli amici finite. Ogni risultato si registra una
 * volta sola.
 */
import { challengeState, rankEntries, weekStart, type Challenge } from '../core/social';
import { loadWins, saveWins, type Wins } from '../storage/wins';
import { social } from './index';

const WEEK = 7 * 24 * 3600 * 1000;
const LOOK_BACK_WEEKS = 8;

export async function recordWins(now: number, challenges: Challenge[]): Promise<Wins> {
  const wins = await loadWins();
  const seen = new Set(wins.leagues.map((l) => `${l.leagueId}:${l.week}`));
  const duels = new Set(wins.duels.map((d) => d.id));
  let changed = false;

  for (const c of challenges) {
    const state = challengeState(c, now);
    if (state.status === 'conclusa' && !duels.has(c.id)) {
      wins.duels.push({ id: c.id, title: c.title, won: state.won, endsAt: state.closesAt });
      changed = true;
    }
  }

  if (await social.profile()) {
    const thisWeek = weekStart(now);
    for (const league of await social.leagues(now)) {
      for (let k = 1; k <= LOOK_BACK_WEEKS; k++) {
        const week = thisWeek - k * WEEK;
        // Ora legale e solare: si riallinea al lunedì vero.
        const start = weekStart(week + 12 * 3600 * 1000);
        if (seen.has(`${league.id}:${start}`)) continue;
        const board = await social.board(league.id, start + 3 * 24 * 3600 * 1000);
        if (!board) break;
        const ranked = rankEntries(board.entries);
        const me = ranked.find((e) => e.me);
        wins.leagues.push({
          league: league.name,
          leagueId: league.id,
          week: start,
          // 0: non c'erano punti, la settimana non conta.
          rank: me && me.points > 0 ? me.rank : 0,
          people: ranked.filter((e) => e.points > 0).length,
          points: me?.points ?? 0,
        });
        seen.add(`${league.id}:${start}`);
        changed = true;
      }
    }
  }
  if (changed) await saveWins(wins);
  return wins;
}
