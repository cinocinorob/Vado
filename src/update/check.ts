/**
 * Controlla se è uscita una versione più nuova dell'app. Una sola richiesta
 * per apertura, a un file pubblico su GitHub: non parte nessun dato
 * dell'utente. Se la rete manca non succede niente.
 */
import { isNewer, parseLatest, type Latest } from '../core/update';

const URL = 'https://github.com/cinocinorob/Vado/releases/download/ultima/versione.json';

/** Numero di questa build, scritto dalla compilazione; 0 nelle prove di sviluppo. */
export const BUILD = Number(process.env.EXPO_PUBLIC_BUILD ?? 0) || 0;

let pending: Promise<Latest | null> | null = null;

async function fetchLatest(): Promise<Latest | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), 8000);
  try {
    const answer = await fetch(`${URL}?t=${Date.now()}`, { signal: stop.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!answer.ok) return null;
    return parseLatest(await answer.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** La versione più nuova, se c'è; null se questa è già l'ultima o non si sa. */
export function newerVersion(): Promise<Latest | null> {
  if (BUILD <= 0) return Promise.resolve(null);
  pending ??= fetchLatest().then((latest) => {
    // Se non si è riusciti a saperlo, alla prossima schermata si riprova.
    if (!latest) pending = null;
    return latest;
  });
  return pending.then((latest) => (isNewer(BUILD, latest) ? latest : null));
}
