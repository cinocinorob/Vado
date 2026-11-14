/**
 * Avviso di versione nuova. L'app installata conosce il proprio numero di
 * build (scritto al momento della compilazione) e lo confronta con quello
 * dell'ultima versione pubblicata. Funzioni pure.
 */
export type Latest = { build: number; apk: string };

/** Legge il piccolo file pubblicato accanto all'app; null se non è valido. */
export function parseLatest(value: unknown): Latest | null {
  if (!value || typeof value !== 'object') return null;
  const { build, apk } = value as { build?: unknown; apk?: unknown };
  if (typeof build !== 'number' || !Number.isInteger(build) || build <= 0) return null;
  if (typeof apk !== 'string' || !apk.startsWith('https://github.com/')) return null;
  return { build, apk };
}

/** Vero solo se si conosce il proprio numero e quello pubblicato è più alto. */
export function isNewer(local: number, latest: Latest | null): boolean {
  return !!latest && Number.isInteger(local) && local > 0 && latest.build > local;
}
