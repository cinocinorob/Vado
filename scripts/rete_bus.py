"""Estrae le linee di bus e tram di Roma dai dati aperti (formato GTFS).

Uso:
    python3 scripts/rete_bus.py <gtfs.zip> <cartella di uscita>

Scrive nella cartella di uscita:
    bus.json         fermate e linee, da copiare in src/data/bus-roma.json
    rapporto-bus.txt ciò che è stato letto e le scelte fatte

Per ogni linea (route_type 3 bus, 0 tram) e direzione si tengono le sequenze
di fermate più usate dalle corse (al massimo due), con la distanza di ogni
fermata dall'inizio misurata lungo il tracciato disegnato (shapes.txt).
Così l'app può dire quanti metri ci sono tra due fermate della stessa corsa
senza scaricare nulla.

Formato compatto, per tenere piccolo il file:
    stops: [[nome, lat*1e5, lon*1e5], ...]
    lines: [{"n": "64", "r": id della linea, "t": 3, "c": "colore", "p": [{"h": capolinea, "s": [indici], "d": [metri]}]}]

Solo libreria standard di Python.
"""

from __future__ import annotations

import json
import math
import os
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rete_metro import Shape, haversine, pretty, rows  # noqa: E402

TYPES = {"3": 3, "0": 0}
MIN_SHARE = 0.10
MAX_PATTERNS_PER_DIRECTION = 2


def main() -> None:
    source, out_dir = sys.argv[1], sys.argv[2]
    report: list[str] = []
    say = report.append

    with zipfile.ZipFile(source) as archive:
        routes = {r["route_id"]: r for r in rows(archive, "routes.txt") if r.get("route_type") in TYPES}
        say(f"Linee di bus e tram: {len(routes)}")
        trips: dict[str, tuple[str, str, str, str]] = {}
        for r in rows(archive, "trips.txt"):
            if r.get("route_id") in routes:
                trips[r["trip_id"]] = (r["route_id"], r.get("direction_id", ""), r.get("shape_id", ""), r.get("trip_headsign", ""))
        say(f"Corse: {len(trips)}")

        sequences: dict[str, list[tuple[int, str]]] = defaultdict(list)
        for r in rows(archive, "stop_times.txt"):
            t = r.get("trip_id")
            if t in trips:
                sequences[t].append((int(r["stop_sequence"]), r["stop_id"]))

        counts: dict[tuple[str, str], Counter] = defaultdict(Counter)
        info: dict[tuple[str, tuple[str, ...]], tuple[str, str]] = {}
        for t, items in sequences.items():
            route_id, direction, shape_id, headsign = trips[t]
            seq = tuple(s for _, s in sorted(items))
            if len(seq) < 2:
                continue
            counts[(route_id, direction)][seq] += 1
            info.setdefault((route_id, seq), (shape_id, headsign))

        chosen: dict[str, list[tuple[str, tuple[str, ...]]]] = defaultdict(list)
        for (route_id, direction), counter in counts.items():
            total = sum(counter.values())
            for seq, n in counter.most_common(MAX_PATTERNS_PER_DIRECTION):
                if n / total >= MIN_SHARE:
                    chosen[route_id].append((direction, seq))
        used = {s for pats in chosen.values() for _, seq in pats for s in seq}
        stops_raw = {r["stop_id"]: r for r in rows(archive, "stops.txt") if r["stop_id"] in used}
        wanted = {info[(rid, seq)][0] for rid, pats in chosen.items() for _, seq in pats if info[(rid, seq)][0]}
        pts: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
        for r in rows(archive, "shapes.txt"):
            if r.get("shape_id") in wanted:
                pts[r["shape_id"]].append((int(r["shape_pt_sequence"]), float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))
        shapes = {sid: Shape([(a, b) for _, a, b in sorted(p)]) for sid, p in pts.items() if len(p) >= 2}
        say(f"Fermate usate: {len(stops_raw)}; tracciati: {len(shapes)} su {len(wanted)}")

    pos = {sid: (float(r["stop_lat"]), float(r["stop_lon"])) for sid, r in stops_raw.items()}
    order = sorted(stops_raw)
    index = {sid: i for i, sid in enumerate(order)}
    stops_out = [[pretty(stops_raw[s].get("stop_name", s)), round(pos[s][0] * 1e5), round(pos[s][1] * 1e5)] for s in order]

    fallback = 0
    lines_out = []
    for route_id in sorted(chosen, key=lambda r: (routes[r].get("route_short_name") or r)):
        route = routes[route_id]
        patterns = []
        for _, seq in sorted(chosen[route_id]):
            shape_id, headsign = info[(route_id, seq)]
            shape = shapes.get(shape_id)
            straight = [0.0]
            for a, b in zip(seq, seq[1:]):
                straight.append(straight[-1] + haversine(pos[a], pos[b]))
            dist = straight
            if shape:
                cum, start, ok = [], 0, True
                for s in seq:
                    meters, start, off = shape.locate(pos[s], start)
                    if off > 150:
                        ok = False
                        break
                    cum.append(meters)
                cum = [c - cum[0] for c in cum] if ok and cum else []
                # Il tracciato deve essere coerente: crescente e non più corto della linea d'aria.
                if ok and all(b >= a for a, b in zip(cum, cum[1:])) and cum[-1] >= straight[-1] * 0.98 and cum[-1] <= straight[-1] * 2.5:
                    dist = cum
                else:
                    fallback += 1
            else:
                fallback += 1
            patterns.append({"h": pretty(headsign or stops_raw[seq[-1]].get("stop_name", "")), "s": [index[s] for s in seq], "d": [round(d) for d in dist]})
        lines_out.append({"n": route.get("route_short_name") or route_id, "r": route_id, "t": TYPES[route["route_type"]], "c": route.get("route_color", ""), "p": patterns})

    say(f"Linee scritte: {len(lines_out)}; sequenze con distanza in linea d'aria: {fallback}")
    data = {"downloaded": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "stops": stops_out, "lines": lines_out}
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "bus.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(os.path.join(out_dir, "bus.json"))
    say(f"Dimensione di bus.json: {size / 1024:.0f} KB")
    sample = [l for l in lines_out if l["n"] in ("64", "8", "H", "170")]
    for l in sample:
        for p in l["p"]:
            say(f"  {l['n']} → {p['h']}: {len(p['s'])} fermate, {p['d'][-1] / 1000:.1f} km; da {stops_out[p['s'][0]][0]} a {stops_out[p['s'][-1]][0]}")
    with open(os.path.join(out_dir, "rapporto-bus.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
