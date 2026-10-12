/**
 * Codice di recupero del profilo della classifica.
 *
 * Il telefono si fa riconoscere dal server con una chiave segreta di 32 byte
 * (64 cifre esadecimali). Per portarla su un altro telefono la si scrive con
 * le stesse 32 lettere e cifre dei codici delle leghe (niente O, 0, I, 1, che
 * si confondono), in 9 gruppi da 6: 52 caratteri per la chiave più 2 di
 * controllo, che scoprono subito un errore di battitura.
 *
 * Funzioni pure, verificate in recovery.test.ts.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DATA_CHARS = 52;
const GROUP = 6;

function check(values: number[]): [number, number] {
  let h = 0;
  for (const v of values) h = (h * 31 + v + 7) % 1021;
  return [h >> 5, h & 31];
}

/** "K7MQ2X-ABCDEF-…" dalla chiave in esadecimale; null se la chiave non è di 64 cifre esadecimali. */
export function encodeRecovery(secret: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(secret)) return null;
  const values: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < 64; i += 2) {
    buffer = (buffer << 8) | parseInt(secret.slice(i, i + 2), 16);
    bits += 8;
    while (bits >= 5) {
      values.push((buffer >> (bits - 5)) & 31);
      bits -= 5;
      buffer &= (1 << bits) - 1;
    }
  }
  // 256 bit non sono un multiplo di 5: l'ultimo carattere porta 1 bit e quattro zeri.
  values.push((buffer << (5 - bits)) & 31);
  const all = [...values, ...check(values)];
  const text = all.map((v) => ALPHABET[v]).join('');
  return text.match(new RegExp(`.{1,${GROUP}}`, 'g'))?.join('-') ?? text;
}

export type Decoded = { ok: true; secret: string } | { ok: false; problem: string };

/** La chiave in esadecimale da ciò che l'utente ha scritto o incollato: maiuscole o minuscole, con o senza trattini e spazi. */
export function decodeRecovery(text: string): Decoded {
  const clean = text.toUpperCase().replace(/[\s\-_.]/g, '');
  if (clean.length === 0) return { ok: false, problem: 'Scrivi o incolla il codice di recupero.' };
  const wrong = [...clean].find((c) => !ALPHABET.includes(c));
  if (wrong) {
    const hint = '01OI'.includes(wrong) ? ' Nel codice non ci sono mai 0, 1, O e I.' : '';
    return { ok: false, problem: `Il carattere "${wrong}" non può stare in un codice di recupero.${hint}` };
  }
  if (clean.length !== DATA_CHARS + 2) {
    return { ok: false, problem: `Il codice ha ${DATA_CHARS + 2} caratteri, qui ce ne sono ${clean.length}. Controlla di averlo copiato tutto.` };
  }
  const values = [...clean].map((c) => ALPHABET.indexOf(c));
  const data = values.slice(0, DATA_CHARS);
  const [a, b] = check(data);
  if (values[DATA_CHARS] !== a || values[DATA_CHARS + 1] !== b || (data[DATA_CHARS - 1] & 15) !== 0) {
    return { ok: false, problem: 'Il codice contiene un errore di battitura: ricontrollalo carattere per carattere.' };
  }
  let hex = '';
  let buffer = 0;
  let bits = 0;
  for (const v of data) {
    buffer = (buffer << 5) | v;
    bits += 5;
    if (bits >= 8) {
      hex += ((buffer >> (bits - 8)) & 255).toString(16).padStart(2, '0');
      bits -= 8;
      buffer &= (1 << bits) - 1;
    }
  }
  return { ok: true, secret: hex.slice(0, 64) };
}
