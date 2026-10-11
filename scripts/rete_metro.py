"""Estrae la rete della metropolitana dai dati aperti di una città (formato GTFS).

Uso:
    python3 scripts/rete_metro.py <gtfs.zip> <cartella di uscita>

Scrive due file nella cartella di uscita:
    metro.json     stazioni, linee e distanze lungo il tracciato, da copiare
                   in src/data/metro-roma.json
    rapporto.txt   ciò che è stato letto e ogni scelta fatta, da controllare
                   a occhio prima di usare i dati

Cosa viene estratto:
  - le linee di tipo "metropolitana" (route_type 1);
  - per ogni linea le sequenze di fermate davvero percorse dalle corse;
  - le stazioni: le banchine con lo stesso nome o vicinissime tra loro
    diventano una stazione sola, così un cambio di linea non costa metri;
  - la distanza tra stazioni consecutive misurata lungo il tracciato
    disegnato (shapes.txt). Se il tracciato manca o dà un risultato non
    credibile si usa la linea d'aria, e il rapporto lo segnala.

Solo libreria standard di Python: gira ovunque senza installare nulla.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
import io
import json
import math
import re
import statistics
import sys
import unicodedata
import zipfile
from collections import Counter, defaultdict

SUBWAY = "1"
# Banchine di linee diverse entro questa distanza sono la stessa stazione.
MERGE_M = 200.0
# Sequenze usate da pochissime corse (rientri in deposito) vengono ignorate.
MIN_PATTERN_SHARE = 0.02

R = 6371008.8


def haversine(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(h)))


def rows(archive: zipfile.ZipFile, name: str):
    """Righe di un file del pacchetto, come dizionari. Vuoto se il file non c'è."""
    if name not in archive.namelist():
        return
    with archive.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        for row in csv.DictReader(text):
            yield {(k or "").strip(): (v or "").strip() for k, v in row.items()}


def plain(text: str) -> str:
    """Nome senza accenti, punteggiatura e sigle di linea, per confrontare."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c)).upper()
    text = re.sub(r"\((M[A-Z0-9]*|METRO[^)]*)\)", " ", text)
    text = re.sub(r"\bS\.\s*", "SAN ", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    return text.strip()


SMALL_WORDS = {"di", "del", "della", "dei", "degli", "delle", "da", "a", "e", "in", "al", "la", "le", "il", "lo"}


def pretty(text: str) -> str:
    """Nome da mostrare: senza sigle di linea, con le maiuscole a posto."""
    text = re.sub(r"\((M[A-Za-z0-9]*|[Mm]etro[^)]*)\)", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" -")
    words = []
    for i, word in enumerate(text.split(" ")):
        low = word.lower()
        if i > 0 and low in SMALL_WORDS:
            words.append(low)
        elif "'" in word:
            head, tail = word.split("'", 1)
            words.append(head.capitalize() + "'" + tail.capitalize())
        elif "." in word and len(word) <= 3:
            words.append(word.capitalize())
        else:
            words.append("-".join(part.capitalize() for part in word.split("-")))
    return " ".join(words)


# Nomi che nei dati di Roma sono abbreviati o scritti senza accenti. La chiave
# è il nome ripulito (vedi `plain`), il valore quello da mostrare.
NAMES = {
    "CINECITTA": "Cinecittà",
    "SAN GIOVANNI": "San Giovanni",
    "SAN AGNESE ANNIBALIANO": "Sant'Agnese - Annibaliano",
    "CONCA D ORO": "Conca d'Oro",
    "SAN M DEL SOCCORSO": "Santa Maria del Soccorso",
    "TIBURTINA F SAN": "Tiburtina",
    "METRONIA": "Porta Metronia",
    "PORTA METRONIA": "Porta Metronia",
    "COLOSSEO FORI IMPERIALI": "Colosseo",
    "EUR MAGLIANA": "EUR Magliana",
    "EUR PALASPORT": "EUR Palasport",
    "EUR FERMI": "EUR Fermi",
}


def display(text: str) -> str:
    return NAMES.get(plain(text)) or pretty(text)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", plain(text).lower()).strip("-")


def line_id(short: str, long: str) -> str:
    """Sigla breve della linea: "MEA" diventa "A", "MEB1" diventa "B1"."""
    for candidate in (short, long):
        match = re.fullmatch(r"(?:ME|M|METRO\s*)([A-Z][0-9]?)", candidate.upper().strip())
        if match:
            return match.group(1)
    return short or long


class Shape:
    """Tracciato disegnato di una corsa, con le distanze progressive."""

    def __init__(self, points: list[tuple[float, float]]):
        self.points = points
        lat0 = math.radians(points[0][0])
        self.kx = math.cos(lat0) * 111195.0
        self.ky = 111195.0
        self.xy = [(lon * self.kx, lat * self.ky) for lat, lon in points]
        self.cum = [0.0]
        for i in range(1, len(self.xy)):
            dx = self.xy[i][0] - self.xy[i - 1][0]
            dy = self.xy[i][1] - self.xy[i - 1][1]
            self.cum.append(self.cum[-1] + math.hypot(dx, dy))

    def locate(self, point: tuple[float, float], start: int) -> tuple[float, int, float]:
        """Punto del tracciato più vicino, cercando da `start` in avanti.

        Restituisce (metri dall'inizio, indice del segmento, distanza dal tracciato).
        """
        px, py = point[1] * self.kx, point[0] * self.ky
        best = (float("inf"), start, 0.0)
        for i in range(start, len(self.xy) - 1):
            ax, ay = self.xy[i]
            bx, by = self.xy[i + 1]
            dx, dy = bx - ax, by - ay
            length2 = dx * dx + dy * dy
            t = 0.0 if length2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
            off = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if off < best[0] - 1e-6:
                best = (off, i, self.cum[i] + t * math.sqrt(length2))
        return best[2], best[1], best[0]


def main() -> None:
    source, out_dir = sys.argv[1], sys.argv[2]
    report: list[str] = []
    say = report.append

    with zipfile.ZipFile(source) as archive:
        say("File nel pacchetto: " + ", ".join(sorted(archive.namelist())))
        feed = next(iter(rows(archive, "feed_info.txt")), {})
        say("feed_info: " + json.dumps(feed, ensure_ascii=False))

        type_count: Counter[str] = Counter()
        routes: dict[str, dict] = {}
        for row in rows(archive, "routes.txt"):
            type_count[row.get("route_type", "")] += 1
            if row.get("route_type") == SUBWAY:
                routes[row["route_id"]] = row
            elif row.get("route_type") in ("0", "2"):
                say(f"  non inclusa (tipo {row.get('route_type')}): {row.get('route_id')} | {row.get('route_short_name')} | {row.get('route_long_name')}")
        say("Linee per tipo: " + json.dumps(type_count))
        for route in routes.values():
            say(f"Metro: {route['route_id']} | {route.get('route_short_name')} | {route.get('route_long_name')} | colore {route.get('route_color')}")
        if not routes:
            raise SystemExit("Nessuna linea di tipo metropolitana nel pacchetto")

        trips: dict[str, tuple[str, str, str]] = {}
        for row in rows(archive, "trips.txt"):
            if row.get("route_id") in routes:
                trips[row["trip_id"]] = (row["route_id"], row.get("shape_id", ""), row.get("direction_id", ""))
        say(f"Corse della metro: {len(trips)}")

        sequences: dict[str, list[tuple[int, str]]] = defaultdict(list)
        for row in rows(archive, "stop_times.txt"):
            trip = row.get("trip_id")
            if trip in trips:
                sequences[trip].append((int(row["stop_sequence"]), row["stop_id"]))

        # Sequenze distinte di fermate per linea, con quante corse le usano.
        patterns: dict[str, Counter] = defaultdict(Counter)
        pattern_shape: dict[tuple[str, tuple[str, ...]], str] = {}
        for trip, items in sequences.items():
            route_id, shape_id, _ = trips[trip]
            stops_seq = tuple(stop for _, stop in sorted(items))
            patterns[route_id][stops_seq] += 1
            if shape_id:
                pattern_shape.setdefault((route_id, stops_seq), shape_id)

        used_stops = {stop for counter in patterns.values() for seq in counter for stop in seq}
        stops: dict[str, dict] = {}
        for row in rows(archive, "stops.txt"):
            if row["stop_id"] in used_stops:
                stops[row["stop_id"]] = row
        say(f"Banchine usate dalla metro: {len(stops)}")

        wanted_shapes = set(pattern_shape.values())
        shape_points: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
        for row in rows(archive, "shapes.txt"):
            if row.get("shape_id") in wanted_shapes:
                shape_points[row["shape_id"]].append((int(row["shape_pt_sequence"]), float(row["shape_pt_lat"]), float(row["shape_pt_lon"])))
        shapes = {
            shape_id: Shape([(lat, lon) for _, lat, lon in sorted(points)])
            for shape_id, points in shape_points.items()
            if len(points) >= 2
        }
        say(f"Tracciati disegnati trovati: {len(shapes)} su {len(wanted_shapes)} richiesti")

    position = {stop_id: (float(row["stop_lat"]), float(row["stop_lon"])) for stop_id, row in stops.items()}

    # Coppie di banchine consecutive in qualche corsa: non vanno mai fuse.
    adjacent: set[frozenset[str]] = set()
    for counter in patterns.values():
        for seq in counter:
            for a, b in zip(seq, seq[1:]):
                adjacent.add(frozenset((a, b)))

    # Unione delle banchine in stazioni.
    parent = {stop_id: stop_id for stop_id in stops}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    ids = sorted(stops)
    for i, a in enumerate(ids):
        for b in ids[i + 1 :]:
            if frozenset((a, b)) in adjacent:
                continue
            d = haversine(position[a], position[b])
            same_name = plain(stops[a]["stop_name"]) == plain(stops[b]["stop_name"])
            if (same_name and d <= 600) or d <= MERGE_M:
                parent[find(a)] = find(b)

    groups: dict[str, list[str]] = defaultdict(list)
    for stop_id in ids:
        groups[find(stop_id)].append(stop_id)

    route_line = {route_id: line_id(route.get("route_short_name", ""), route.get("route_long_name", "")) for route_id, route in routes.items()}

    station_of: dict[str, str] = {}
    stations: dict[str, dict] = {}
    for members in groups.values():
        names = Counter(display(stops[m]["stop_name"]) for m in members)
        name = names.most_common(1)[0][0]
        station_id = slug(name)
        suffix = 2
        while station_id in stations:
            station_id = f"{slug(name)}-{suffix}"
            suffix += 1
        lat = statistics.fmean(position[m][0] for m in members)
        lon = statistics.fmean(position[m][1] for m in members)
        spread = max(haversine((lat, lon), position[m]) for m in members)
        stations[station_id] = {"id": station_id, "name": name, "lat": round(lat, 6), "lon": round(lon, 6), "lines": set()}
        for m in members:
            station_of[m] = station_id
        raw_names = sorted({stops[m]["stop_name"] for m in members})
        say(f"Stazione {station_id}: {name} | banchine {len(members)} | raggio {spread:.0f} m | nomi originali {raw_names}")

    # Tratte tra stazioni consecutive, con la distanza lungo il tracciato.
    edge_values: dict[tuple[str, str], list[float]] = defaultdict(list)
    edge_lines: dict[tuple[str, str], set[str]] = defaultdict(set)
    lines: list[dict] = []
    for route_id, counter in sorted(patterns.items(), key=lambda item: route_line[item[0]]):
        line = route_line[route_id]
        top = counter.most_common(1)[0][1]
        say(f"Linea {line} ({route_id}): {len(counter)} sequenze diverse, la più usata da {top} corse")
        kept = [(seq, n) for seq, n in counter.most_common() if n >= max(1, top * MIN_PATTERN_SHARE)]
        for seq, n in kept:
            shape = shapes.get(pattern_shape.get((route_id, seq), ""))
            cursor = 0
            along: list[float | None] = []
            for stop_id in seq:
                if not shape:
                    along.append(None)
                    continue
                meters, cursor, off = shape.locate(position[stop_id], cursor)
                along.append(meters if off <= 150 else None)
            total = 0.0
            fallbacks = 0
            for i in range(len(seq) - 1):
                a, b = seq[i], seq[i + 1]
                straight = haversine(position[a], position[b])
                meters = None
                if along[i] is not None and along[i + 1] is not None:
                    meters = along[i + 1] - along[i]
                if meters is None or meters < straight * 0.98 or meters > straight * 2.2 + 150:
                    meters = straight
                    fallbacks += 1
                total += meters
                sa, sb = station_of[a], station_of[b]
                if sa == sb:
                    continue
                key = (sa, sb) if sa < sb else (sb, sa)
                edge_values[key].append(meters)
                edge_lines[key].add(line)
                stations[sa]["lines"].add(line)
                stations[sb]["lines"].add(line)
            first, last = stations[station_of[seq[0]]]["name"], stations[station_of[seq[-1]]]["name"]
            say(f"  {n:5d} corse | {len(seq):2d} fermate | {total / 1000:6.2f} km | {first} → {last} | tratte in linea d'aria: {fallbacks}")

        # Elenco delle stazioni da mostrare: la sequenza più lunga tra quelle tenute.
        longest = max(kept, key=lambda item: (len(item[0]), item[1]))[0]
        ordered: list[str] = []
        for stop_id in longest:
            station_id = station_of[stop_id]
            if station_id not in ordered:
                ordered.append(station_id)
        route = routes[route_id]
        color = route.get("route_color", "")
        lines.append(
            {
                "id": line,
                "name": f"Linea {line}",
                "color": f"#{color.upper()}" if re.fullmatch(r"[0-9A-Fa-f]{6}", color) else None,
                "stations": ordered,
            }
        )

    edges = []
    for key in sorted(edge_values):
        values = edge_values[key]
        meters = statistics.median(values)
        if max(values) - min(values) > 80:
            say(f"Tratta {key[0]} – {key[1]}: valori diversi tra le corse, {min(values):.0f}–{max(values):.0f} m, uso {meters:.0f}")
        edges.append([key[0], key[1], round(meters), "/".join(sorted(edge_lines[key]))])

    station_list = [
        {**station, "lines": sorted(station["lines"])} for station in sorted(stations.values(), key=lambda s: s["id"]) if station["lines"]
    ]
    result = {
        "source": feed.get("feed_publisher_name") or "Roma Servizi per la Mobilità",
        "sourceUrl": feed.get("feed_publisher_url") or "https://romamobilita.it/it/tecnologie/open-data",
        "downloaded": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "lines": lines,
        "stations": station_list,
        "edges": edges,
    }
    say(f"Totale: {len(lines)} linee, {len(station_list)} stazioni, {len(edges)} tratte")
    for line in lines:
        say(f"Linea {line['id']} | {line['name']} | {line['color']} | {len(line['stations'])} stazioni: " + ", ".join(stations[s]["name"] for s in line["stations"]))

    with open(f"{out_dir}/metro.json", "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
    with open(f"{out_dir}/rapporto.txt", "w", encoding="utf-8") as handle:
        handle.write("\n".join(report) + "\n")
    print("\n".join(report))


if __name__ == "__main__":
    main()
