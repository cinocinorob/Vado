"""Scarica due volte il flusso in tempo reale delle posizioni dei mezzi di Roma
e dice cosa contiene: quanti mezzi, ogni quanto si aggiorna, quanto pesa.

Uso: python3 scripts/prova_tempo_reale.py <url> <cartella di uscita>

Decodifica a mano il formato GTFS-Realtime (protobuf), senza librerie.
"""

from __future__ import annotations

import json
import os
import struct
import sys
import time
import urllib.request


def varint(buf: bytes, i: int) -> tuple[int, int]:
    shift = result = 0
    while True:
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, i
        shift += 7


def fields(buf: bytes):
    i = 0
    while i < len(buf):
        key, i = varint(buf, i)
        number, kind = key >> 3, key & 7
        if kind == 0:
            value, i = varint(buf, i)
        elif kind == 1:
            value = buf[i : i + 8]
            i += 8
        elif kind == 2:
            length, i = varint(buf, i)
            value = buf[i : i + length]
            i += length
        elif kind == 5:
            value = buf[i : i + 4]
            i += 4
        else:
            raise ValueError(f"tipo {kind}")
        yield number, kind, value


def vehicles(buf: bytes):
    header_time = None
    out = []
    for n, _, v in fields(buf):
        if n == 1:
            for hn, _, hv in fields(v):
                if hn == 3:
                    header_time = hv
        if n == 2:
            veh = {}
            for en, _, ev in fields(v):
                if en == 4:  # vehicle
                    for vn, _, vv in fields(ev):
                        if vn == 1:  # trip
                            for tn, _, tv in fields(vv):
                                if tn == 1:
                                    veh["trip"] = tv.decode()
                                if tn == 5:
                                    veh["route"] = tv.decode()
                        if vn == 2:  # position
                            for pn, _, pv in fields(vv):
                                if pn == 1:
                                    veh["lat"] = struct.unpack("<f", pv)[0]
                                if pn == 2:
                                    veh["lon"] = struct.unpack("<f", pv)[0]
                                if pn == 5:
                                    veh["speed"] = struct.unpack("<f", pv)[0]
                        if vn == 5:
                            veh["t"] = vv
                        if vn == 8:  # VehicleDescriptor
                            for dn, _, dv in fields(vv):
                                if dn == 1:
                                    veh["id"] = dv.decode()
            if veh:
                out.append(veh)
    return header_time, out


def main() -> None:
    url, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    lines = []
    snaps = []
    for k in range(3):
        start = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": "Vado-prova"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
            modified = r.headers.get("Last-Modified")
        took = time.time() - start
        header, vs = vehicles(data)
        ages = sorted(int(header or 0) - v["t"] for v in vs if "t" in v)
        snaps.append({v.get("id"): v for v in vs})
        lines.append(
            f"download {k + 1}: {len(data) / 1024:.0f} KB in {took:.1f} s, mezzi {len(vs)}, ora del flusso {header}, "
            f"Last-Modified {modified}, età mediana delle posizioni {ages[len(ages) // 2] if ages else '?'} s"
        )
        if k == 0:
            with open(os.path.join(out_dir, "esempio-mezzi.json"), "w") as f:
                json.dump(vs[:40], f, indent=1)
        if k < 2:
            time.sleep(30)
    moved = sum(1 for vid, v in snaps[1].items() if vid in snaps[0] and (snaps[0][vid].get("lat"), snaps[0][vid].get("lon")) != (v.get("lat"), v.get("lon")))
    lines.append(f"mezzi con posizione cambiata in 30 s: {moved} su {len(snaps[1])}")
    with open(os.path.join(out_dir, "tempo-reale.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
