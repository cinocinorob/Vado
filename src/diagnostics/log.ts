/**
 * Registro di diagnostica: cosa è successo durante i tragitti, per capire
 * sul telefono vero perché un tratto è stato contato in un certo modo.
 *
 * Contiene solo eventi e numeri (metri, secondi, quante posizioni), mai
 * coordinate. Resta sul telefono; l'utente può condividerlo dalla pagina
 * Diagnostica.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vado.diagnostica.v1';
const MAX_LINES = 800;
const SAVE_DELAY_MS = 3000;

export type DiagLine = { t: number; text: string };

let lines: DiagLine[] | null = null;
let loading: Promise<DiagLine[]> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function ensure(): Promise<DiagLine[]> {
  if (lines) return lines;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        lines = Array.isArray(parsed) ? parsed.filter((l): l is DiagLine => !!l && typeof l.t === 'number' && typeof l.text === 'string') : [];
      } catch {
        lines = [];
      }
      return lines;
    })();
  }
  return loading;
}

function scheduleSave(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    if (lines) AsyncStorage.setItem(KEY, JSON.stringify(lines)).catch(() => undefined);
  }, SAVE_DELAY_MS);
}

/** Annota un evento. Non blocca e non fallisce mai. */
export function diag(text: string, t = Date.now()): void {
  ensure()
    .then((list) => {
      list.push({ t, text });
      if (list.length > MAX_LINES) list.splice(0, list.length - MAX_LINES);
      scheduleSave();
    })
    .catch(() => undefined);
}

export async function loadDiag(): Promise<DiagLine[]> {
  return [...(await ensure())];
}

export async function clearDiag(): Promise<void> {
  lines = [];
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "27/10 23:41:05". */
export function stamp(t: number): string {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function diagText(list: readonly DiagLine[], header: string): string {
  return [header, ...list.map((l) => `${stamp(l.t)}  ${l.text}`)].join('\n');
}
