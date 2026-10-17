/**
 * Lettura minima del flusso GTFS-Realtime delle posizioni dei mezzi
 * (formato protobuf), senza librerie: si estraggono solo id del mezzo,
 * linea, posizione e ora. Funzione pura.
 */

export type Vehicle = { id: string; routeId: string; lat: number; lon: number; t: number };

type Field = { n: number; kind: number; int: number; bytes: Uint8Array | null };

function* fields(buf: Uint8Array): Generator<Field> {
  let i = 0;
  const varint = () => {
    let result = 0;
    let mul = 1;
    for (;;) {
      const b = buf[i++];
      result += (b & 0x7f) * mul;
      if (b < 0x80) return result;
      mul *= 128;
    }
  };
  while (i < buf.length) {
    const key = varint();
    const n = Math.floor(key / 8);
    const kind = key & 7;
    if (kind === 0) yield { n, kind, int: varint(), bytes: null };
    else if (kind === 1) {
      yield { n, kind, int: 0, bytes: buf.subarray(i, i + 8) };
      i += 8;
    } else if (kind === 2) {
      const len = varint();
      yield { n, kind, int: 0, bytes: buf.subarray(i, i + len) };
      i += len;
    } else if (kind === 5) {
      yield { n, kind, int: 0, bytes: buf.subarray(i, i + 4) };
      i += 4;
    } else throw new Error(`protobuf: tipo ${kind}`);
  }
}

const text = (b: Uint8Array | null) => (b ? String.fromCharCode(...b) : '');
const float = (b: Uint8Array | null) => (b && b.length === 4 ? new DataView(b.buffer, b.byteOffset, 4).getFloat32(0, true) : NaN);

/** I mezzi del flusso, eventualmente solo quelli dentro un riquadro (per non tenere in memoria tutta Roma). */
export function readVehicles(buf: Uint8Array, box?: { minLat: number; maxLat: number; minLon: number; maxLon: number }): Vehicle[] {
  const out: Vehicle[] = [];
  for (const entity of fields(buf)) {
    if (entity.n !== 2 || !entity.bytes) continue;
    for (const ef of fields(entity.bytes)) {
      if (ef.n !== 4 || !ef.bytes) continue;
      const v: Vehicle = { id: '', routeId: '', lat: NaN, lon: NaN, t: 0 };
      for (const vf of fields(ef.bytes)) {
        if (vf.n === 1 && vf.bytes) for (const tf of fields(vf.bytes)) if (tf.n === 5) v.routeId = text(tf.bytes);
        if (vf.n === 2 && vf.bytes)
          for (const pf of fields(vf.bytes)) {
            if (pf.n === 1) v.lat = float(pf.bytes);
            if (pf.n === 2) v.lon = float(pf.bytes);
          }
        if (vf.n === 5 && vf.kind === 0) v.t = vf.int * 1000;
        if (vf.n === 8 && vf.bytes) for (const df of fields(vf.bytes)) if (df.n === 1) v.id = text(df.bytes);
      }
      if (!v.id || !Number.isFinite(v.lat) || !Number.isFinite(v.lon)) continue;
      if (box && (v.lat < box.minLat || v.lat > box.maxLat || v.lon < box.minLon || v.lon > box.maxLon)) continue;
      out.push(v);
    }
  }
  return out;
}
