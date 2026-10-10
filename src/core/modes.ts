/**
 * Tabella dei mezzi di trasporto.
 *
 * `ptPerKm` è una scelta di progetto: l'ordine segue le emissioni per
 * chilometro, i valori esatti no. Si cambia qui e in nessun altro posto.
 *
 * `maxSegmentMs` è la velocità massima credibile per un singolo tratto GPS:
 * i tratti più veloci non vengono accreditati (vedi geo.ts).
 * `maxAvgKmh` è la velocità media massima credibile sull'intero tratto.
 */
export type ModeId =
  | 'piedi'
  | 'bici'
  | 'ebike'
  | 'tpl'
  | 'treno'
  | 'carsharing'
  | 'autoel'
  | 'auto';

export type Mode = {
  id: ModeId;
  label: string;
  /** Etichetta breve per le righe di elenco. */
  short: string;
  ptPerKm: number;
  maxSegmentMs: number;
  maxAvgKmh: number;
  /** Auto privata: esclude il bonus casa-lavoro e i "km senza auto". */
  privateCar: boolean;
};

export const MODES: readonly Mode[] = [
  { id: 'piedi', label: 'A piedi', short: 'A piedi', ptPerKm: 10, maxSegmentMs: 6, maxAvgKmh: 12, privateCar: false },
  { id: 'bici', label: 'Bici', short: 'Bici', ptPerKm: 8, maxSegmentMs: 12.5, maxAvgKmh: 30, privateCar: false },
  { id: 'ebike', label: 'Bici elettrica', short: 'Bici elettrica', ptPerKm: 6, maxSegmentMs: 12.5, maxAvgKmh: 35, privateCar: false },
  { id: 'tpl', label: 'Metro, bus, tram', short: 'Mezzi pubblici', ptPerKm: 4, maxSegmentMs: 33, maxAvgKmh: 70, privateCar: false },
  { id: 'treno', label: 'Treno', short: 'Treno', ptPerKm: 3, maxSegmentMs: 90, maxAvgKmh: 300, privateCar: false },
  { id: 'carsharing', label: 'Car sharing', short: 'Car sharing', ptPerKm: 2, maxSegmentMs: 55, maxAvgKmh: 150, privateCar: false },
  { id: 'autoel', label: 'Auto elettrica', short: 'Auto elettrica', ptPerKm: 1, maxSegmentMs: 55, maxAvgKmh: 150, privateCar: true },
  { id: 'auto', label: 'Auto a benzina', short: 'Auto', ptPerKm: 0, maxSegmentMs: 55, maxAvgKmh: 150, privateCar: true },
];

const BY_ID = new Map(MODES.map((m) => [m.id, m]));

export function getMode(id: ModeId): Mode {
  const mode = BY_ID.get(id);
  if (!mode) throw new Error(`Mezzo sconosciuto: ${id}`);
  return mode;
}
