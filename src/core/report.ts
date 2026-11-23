/**
 * Segnalazione di un tragitto contato male: un testo da condividere con chi
 * sviluppa l'app. Contiene il tragitto come l'ha valutato l'app, il mezzo
 * vero indicato dall'utente, la sua nota e le righe del registro di
 * diagnostica di quel periodo. Nessuna coordinata. Funzioni pure.
 */
import { getMode } from './modes';
import type { Trip } from './scoring';

export type ReportTruth = 'piedi' | 'bici' | 'bus' | 'tram' | 'metro' | 'treno' | 'auto' | 'misto';

export const TRUTHS: readonly { id: ReportTruth; label: string }[] = [
  { id: 'piedi', label: 'A piedi' },
  { id: 'bici', label: 'Bici' },
  { id: 'bus', label: 'Bus' },
  { id: 'tram', label: 'Tram' },
  { id: 'metro', label: 'Metro' },
  { id: 'treno', label: 'Treno' },
  { id: 'auto', label: 'Auto' },
  { id: 'misto', label: 'Più mezzi' },
];

/** Margine attorno al tragitto per prendere anche gli eventi dell'avvio e della chiusura. */
export const REPORT_MARGIN_MS = 10 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** Le righe del registro che cadono nel tragitto, con un margine prima e dopo. */
export function linesFor<T extends { t: number }>(lines: readonly T[], trip: Pick<Trip, 'startedAt' | 'endedAt'>): T[] {
  return lines.filter((l) => l.t >= trip.startedAt - REPORT_MARGIN_MS && l.t <= trip.endedAt + REPORT_MARGIN_MS);
}

export function reportText(
  trip: Trip,
  truth: ReportTruth | null,
  note: string,
  lines: readonly { t: number; text: string }[],
  header: string,
): string {
  const legs = trip.legs.map((leg, i) => {
    const mins = Math.round(leg.seconds / 60);
    const parts = [
      `${i + 1}. ${getMode(leg.mode).short}`,
      `${Math.round(leg.meters)} m`,
      `${mins} min`,
      leg.steps == null ? 'passi n.d.' : `${leg.steps} passi`,
      leg.status,
      `${leg.points} punti`,
    ];
    if (leg.route) parts.push(leg.route);
    if (leg.note) parts.push(leg.note);
    return `   ${parts.join(' · ')}`;
  });
  const own = linesFor(lines, trip);
  return [
    'SEGNALAZIONE DI UN TRAGITTO CONTATO MALE',
    header,
    '',
    `Tragitto: ${clock(trip.startedAt)} → ${clock(trip.endedAt)}${trip.source ? ` (origine: ${trip.source})` : ''}`,
    `Come l'ha contato l'app: ${Math.round(trip.meters)} m, ${trip.total} punti`,
    ...legs,
    `Mezzo vero secondo l'utente: ${truth ? (TRUTHS.find((x) => x.id === truth)?.label ?? truth) : 'non indicato'}`,
    `Nota dell'utente: ${note.trim() || '(nessuna)'}`,
    '',
    `Registro di diagnostica del periodo (${own.length} righe):`,
    ...(own.length ? own.map((l) => `${clock(l.t)}  ${l.text}`) : ['(vuoto: il tragitto non è stato misurato dall\'app o il registro è stato azzerato)']),
  ].join('\n');
}
