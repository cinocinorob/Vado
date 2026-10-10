/** Formattazione all'italiana, senza dipendere dalle impostazioni del telefono. */

const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MONTHS = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function dateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** 850 → "850 m", 1234 → "1,2 km". */
export function distance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Sempre in chilometri, per i riepiloghi: 8400 → "8,4 km". */
export function km(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** 45 → "45 s", 660 → "11 min", 3900 → "1 h 05". */
export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Cronometro: 75 → "1:15", 3725 → "1:02:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Velocità media in km/h con una cifra decimale; "–" se non calcolabile. */
export function speed(meters: number, seconds: number): string {
  if (seconds < 5 || meters < 10) return '–';
  return `${((meters / seconds) * 3.6).toFixed(1).replace('.', ',')} km/h`;
}

export function integer(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
