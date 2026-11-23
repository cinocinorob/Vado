/**
 * Persone bloccate. Chi blocchi non sparisce dalla classifica (i punti
 * restano, la posizione degli altri non cambia), ma per te diventa "Persona
 * bloccata": niente soprannome, avatar né medaglie in vetrina. Non la vedi
 * tra i compagni di viaggio e non la puoi sfidare. Resta solo su questo
 * telefono e si può annullare dalle impostazioni.
 */
import type { SocialSource } from './types';

export const BLOCKED_NAME = 'Persona bloccata';

export type Blocked = { id: string; name: string };

type Masked = { id: string; name: string; me?: boolean; tree?: unknown; showcase?: unknown };

/** Toglie i tratti riconoscibili a chi è bloccato. */
export function mask<T extends Masked>(entry: T, blocked: ReadonlySet<string>): T {
  if (entry.me || !blocked.has(entry.id)) return entry;
  const out = { ...entry, name: BLOCKED_NAME };
  if ('tree' in out) out.tree = null;
  if ('showcase' in out) out.showcase = [];
  return out;
}

/** La stessa sorgente, con le persone bloccate nascoste dove compaiono. */
export function withBlocks(source: SocialSource, blockedIds: () => Promise<ReadonlySet<string>>): SocialSource {
  return {
    ...source,
    get demo() {
      return source.demo;
    },
    problem: () => source.problem(),
    async board(leagueId, now) {
      const [board, blocked] = await Promise.all([source.board(leagueId, now), blockedIds()]);
      return board ? { ...board, entries: board.entries.map((e) => mask(e, blocked)) } : board;
    },
    async periodBoard(leagueId, from, to) {
      const [list, blocked] = await Promise.all([source.periodBoard(leagueId, from, to), blockedIds()]);
      return list ? list.map((e) => mask(e, blocked)) : list;
    },
    async candies(leagueId, now) {
      const [list, blocked] = await Promise.all([source.candies(leagueId, now), blockedIds()]);
      return list ? list.map((e) => mask(e, blocked)) : list;
    },
    async rivals(now) {
      const [list, blocked] = await Promise.all([source.rivals(now), blockedIds()]);
      return list.filter((p) => !blocked.has(p.id));
    },
    async travellers(now) {
      const [list, blocked] = await Promise.all([source.travellers(now), blockedIds()]);
      return list ? list.filter((p) => !blocked.has(p.id)) : list;
    },
    async challenges(now) {
      const [list, blocked] = await Promise.all([source.challenges(now), blockedIds()]);
      return list.map((c) => ({ ...c, people: c.people.map((p) => mask(p, blocked)) }));
    },
  };
}
