#!/usr/bin/env python3
"""
Prova automatica dell'app su un telefono Android simulato.

Viene eseguita da GitHub dopo la costruzione dell'app (vedi
.github/workflows/apk.yml). Installa il file, apre l'app, avvia un tragitto a
piedi concedendo i permessi dalle finestre di sistema come farebbe una persona,
simula una camminata, manda l'app in secondo piano, la riapre e termina.

Se l'app si chiude da sola in un punto qualsiasi la prova fallisce, e la nuova
versione non viene pubblicata. Schermate e registro di sistema finiscono nella
cartella indicata, per capire cosa è successo.

Uso: prova_emulatore.py <file.apk> <cartella-risultati> [salute]
"""
import json
import math
import re
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = "app.vado.prototipo"
PERMISSION_BUTTONS = (
    "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
    "com.android.permissioncontroller:id/permission_allow_button",
)
# Punto di partenza della camminata simulata (Roma, piazza del Popolo) e passo.
START = (41.9109, 12.4763)
WALK_MS = 1.4

apk = sys.argv[1]
out = Path(sys.argv[2])
# Terzo argomento "salute": prova anche il collegamento a Connessione Salute.
WITH_HEALTH = len(sys.argv) > 3 and sys.argv[3] == "salute"
out.mkdir(parents=True, exist_ok=True)
shots = 0


class Tee:
    """Scrive sia sullo schermo sia nel registro salvato tra i risultati."""

    def __init__(self, stream, path: Path):
        self.stream = stream
        self.file = open(path, "w", buffering=1)

    def write(self, data: str) -> int:
        self.file.write(data)
        return self.stream.write(data)

    def flush(self) -> None:
        self.file.flush()
        self.stream.flush()


sys.stdout = Tee(sys.stdout, out / "registro.txt")


def annotate(level: str, message: str) -> None:
    """Riga che GitHub mostra in evidenza nella pagina dell'esecuzione."""
    flat = message.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print(f"::{level}::{flat}", flush=True)


def adb(*args: str, check: bool = True, timeout: int = 120) -> str:
    result = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=timeout)
    if check and result.returncode != 0:
        raise RuntimeError(f"adb {' '.join(args)}: {result.stderr.strip() or result.stdout.strip()}")
    return result.stdout


def log(message: str) -> None:
    print(f"[prova {time.strftime('%H:%M:%S')}] {message}", flush=True)


def screenshot(name: str) -> None:
    global shots
    shots += 1
    path = out / f"{shots:02d}-{name}.png"
    with open(path, "wb") as handle:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=handle, timeout=60)


def nodes(attempts: int = 3) -> list[dict]:
    """Elementi visibili sullo schermo, con testo e posizione.

    Lo strumento di Android che elenca gli elementi aspetta che lo schermo
    stia fermo per un secondo. Nella schermata del tragitto il cronometro
    cambia ogni secondo, quindi lì la lettura riesce solo ogni tanto: in quel
    caso si restituisce un elenco vuoto, mai il risultato di una lettura
    precedente.
    """
    for _ in range(attempts):
        adb("shell", "rm", "-f", "/sdcard/ui.xml", check=False)
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False)
        xml = adb("exec-out", "cat", "/sdcard/ui.xml", check=False)
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            continue
        found = []
        for node in root.iter("node"):
            match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
            if not match:
                continue
            x1, y1, x2, y2 = map(int, match.groups())
            found.append(
                {
                    "text": node.get("text", ""),
                    "desc": node.get("content-desc", ""),
                    "id": node.get("resource-id", ""),
                    "package": node.get("package", ""),
                    "center": ((x1 + x2) // 2, (y1 + y2) // 2),
                }
            )
        return found
    return []


def finish_button() -> dict | None:
    """Il pulsante "Termina", riconosciuto dal colore invece che dal testo.

    Nella schermata del tragitto l'elenco degli elementi non è affidabile (vedi
    nodes), ma il pulsante è l'unica area color corallo larga: si cerca quella
    nella parte bassa dello schermo e se ne restituisce il centro.

    Anche il pulsante tondo per iniziare un tragitto è corallo, ma è stretto
    (circa un sesto dello schermo): per questo contano solo le righe in cui il
    corallo copre almeno un quarto della larghezza, e ne servono parecchie.
    """
    raw = subprocess.run(["adb", "exec-out", "screencap"], capture_output=True, timeout=60).stdout
    if len(raw) < 16:
        return None
    width, height = struct.unpack_from("<II", raw, 0)
    header = len(raw) - width * height * 4
    if width <= 0 or height <= 0 or header < 12:
        return None
    step = 12
    wide_row = (width // step) // 4
    xs, ys, rows = [], [], 0
    for y in range(int(height * 0.6), height, step):
        row = []
        for x in range(0, width, step):
            o = header + (y * width + x) * 4
            r, g, b = raw[o], raw[o + 1], raw[o + 2]
            # Corallo dell'app: #FF8A65.
            if r > 235 and 120 < g < 158 and 85 < b < 120:
                row.append(x)
        if len(row) >= wide_row:
            rows += 1
            xs.extend(row)
            ys.extend([y] * len(row))
    # Un pulsante largo e alto: almeno sei righe della griglia.
    if rows < 6:
        return None
    return {"center": (sum(xs) // len(xs), sum(ys) // len(ys))}


def wait_for_trip_screen(seconds: int, where: str) -> dict:
    deadline = time.time() + seconds
    while time.time() < deadline:
        button = finish_button()
        if button:
            return button
        check_alive(where)
        time.sleep(2)
    fail(f"la schermata del tragitto non è comparsa entro {seconds} s ({where})")
    raise AssertionError


def find(label: str, exact: bool = False) -> dict | None:
    for node in nodes():
        for value in (node["text"], node["desc"]):
            if (value == label) if exact else (label in value):
                return node
    return None


def visible_text() -> str:
    return " | ".join(v for n in nodes() for v in (n["text"], n["desc"]) if v)


def crashed() -> str | None:
    """Restituisce il registro dell'errore se l'app si è chiusa da sola."""
    crash = adb("logcat", "-b", "crash", "-d", check=False)
    if PACKAGE in crash or "FATAL EXCEPTION" in crash:
        return crash
    return None


def alive() -> bool:
    return adb("shell", "pidof", PACKAGE, check=False).strip() != ""


def fail(reason: str) -> None:
    log(f"FALLITA: {reason}")
    screenshot("errore")
    crash = adb("logcat", "-b", "crash", "-d", check=False)
    annotate("error", f"Prova fallita: {reason}\n{crash[-3500:]}")
    print("----- registro degli arresti -----")
    print(crash[-12000:] or "(vuoto)")
    print("----- ultimi errori dell'app -----")
    errors = adb("logcat", "-d", "-t", "4000", check=False)
    wanted = [l for l in errors.splitlines() if re.search(r"ReactNative|expo|Expo|AndroidRuntime|vado|Hermes|\bE/|\sE\s", l)]
    print("\n".join(wanted[-250:]))
    print("----- testo sullo schermo -----")
    print(visible_text())
    (out / "logcat.txt").write_text(adb("logcat", "-d", check=False))
    sys.exit(1)


def check_alive(where: str) -> None:
    crash = crashed()
    if crash:
        fail(f"l'app si è chiusa da sola ({where})")
    if not alive():
        fail(f"l'app non è più in esecuzione ({where})")


def wait_for(label: str, seconds: int = 60, where: str = "", exact: bool = False, required: bool = True) -> dict | None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        node = find(label, exact)
        if node:
            return node
        check_alive(where or f"aspettando «{label}»")
        time.sleep(1)
    if required:
        fail(f"«{label}» non è comparso entro {seconds} s")
    return None


def scroll_to(label: str, exact: bool = False, swipes: int = 6) -> dict | None:
    """Scorre la schermata verso il basso finché l'elemento non è visibile."""
    for _ in range(swipes):
        node = find(label, exact)
        # Sotto questa altezza l'elemento è coperto dalla barra in basso.
        if node and node["center"][1] < 1900:
            return node
        adb("shell", "input", "swipe", "540", "1500", "540", "900", "400")
        time.sleep(1.5)
    return find(label, exact)


def tap(node: dict) -> None:
    x, y = node["center"]
    adb("shell", "input", "tap", str(x), str(y))


def tap_label(label: str, seconds: int = 60) -> None:
    tap(wait_for(label, seconds))
    time.sleep(1.5)


def answer_permission_dialogs(seconds: int = 25) -> list[str]:
    """Tocca "Consenti" nelle finestre di sistema, finché ne compaiono."""
    answered = []
    quiet_since = time.time()
    deadline = time.time() + seconds
    while time.time() < deadline and time.time() - quiet_since < 8:
        current = nodes()
        button = next((n for wanted in PERMISSION_BUTTONS for n in current if n["id"] == wanted), None)
        if button:
            title = next((n["text"] for n in current if n["id"].endswith("permission_message")), "?")
            log(f"finestra di permesso: {title!r}")
            screenshot("permesso")
            tap(button)
            answered.append(title)
            quiet_since = time.time()
            time.sleep(2)
            check_alive(f"dopo aver concesso: {title}")
        elif any("Termina" in n["text"] or "Termina" in n["desc"] for n in current):
            break
        else:
            time.sleep(1)
            check_alive("durante la richiesta dei permessi")
    return answered


def position(meters: float) -> tuple[float, float]:
    """Punto a `meters` metri a nord-est della partenza."""
    lat0, lon0 = START
    north = east = meters / math.sqrt(2)
    return lat0 + north / 111_195, lon0 + east / (111_195 * math.cos(math.radians(lat0)))


walked = 0.0


def walk(seconds: int) -> None:
    """Simula una camminata a passo costante, una posizione al secondo."""
    global walked
    knots = WALK_MS * 1.94384
    for _ in range(seconds):
        walked += WALK_MS
        lat, lon = position(walked)
        adb("emu", "geo", "fix", f"{lon:.7f}", f"{lat:.7f}", "20", "12", f"{knots:.2f}", check=False)
        time.sleep(1)


def distance_near(texts: list[str], label: str) -> float | None:
    """Il numero scritto subito prima di `label`, in metri ("205 m", "1,2 km")."""
    for i, value in enumerate(texts):
        if value == label and i > 0:
            match = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s(km|m)", texts[i - 1].strip())
            if match:
                number = float(match.group(1).replace(",", "."))
                return number * 1000 if match.group(2) == "km" else number
    return None


def shown_distance() -> float | None:
    """Distanza mostrata nella schermata del tragitto; None se la lettura non riesce."""
    texts = [n["text"] or n["desc"] for n in nodes(attempts=1) if n["text"] or n["desc"]]
    return distance_near(texts, "Distanza")


def summary_distance() -> float | None:
    """Distanza del tratto nella schermata di riepilogo ("205 m · 4 min")."""
    for node in nodes():
        for value in (node["text"], node["desc"]):
            match = re.match(r"(\d+(?:[.,]\d+)?)\s(km|m) · ", value)
            if match:
                number = float(match.group(1).replace(",", "."))
                meters = number * 1000 if match.group(2) == "km" else number
                # La riga del tratto è in metri sotto il chilometro: è la più precisa.
                if match.group(2) == "m" or meters >= 1000:
                    return meters
    return None


def check_leaderboard() -> str:
    """Apre la classifica, sceglie un soprannome, guarda leghe e sfide, torna a Oggi."""
    log("apro la classifica")
    tap_label("Classifica")
    field = wait_for("Soprannome", 30, "aprendo la classifica", exact=True, required=False)
    if not field:
        screenshot("classifica-senza-soprannome")
        return "campo del soprannome non trovato: " + visible_text()[:300]
    tap(field)
    time.sleep(1.5)
    adb("shell", "input", "text", "Prova")
    time.sleep(1)
    # Invio dalla tastiera: equivale a "Entra in classifica" anche se la tastiera copre il pulsante.
    adb("shell", "input", "keyevent", "66")
    league = wait_for("Lega Bronzo", 40, "dopo il soprannome", required=False)
    check_alive("dopo il soprannome")
    screenshot("classifica-leghe")
    if not league:
        return "la lega a livelli non compare: " + visible_text()[:300]
    board_text = visible_text()
    log(f"classifica: {board_text[:700]}")
    if "Anteprima" not in board_text:
        return "manca l'avviso che i partecipanti sono di esempio"

    tap(wait_for("Sfide", 20, "aprendo le sfide", exact=True))
    time.sleep(2)
    challenges = wait_for("Sfida di", 30, "aprendo le sfide", required=False)
    check_alive("aprendo le sfide")
    screenshot("classifica-sfide")
    if not challenges:
        return "la sfida del mese non compare: " + visible_text()[:300]
    log(f"sfide: {visible_text()[:700]}")

    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    wait_for("Tragitti di oggi", 30, "tornando a Oggi dalla classifica")
    return "ok"


def connect_health() -> str:
    """Collega Connessione Salute dalla schermata Oggi e legge i passi di oggi."""
    log("collego Connessione Salute")
    button = scroll_to("Collega", exact=True)
    if not button:
        screenshot("salute-assente")
        return "riquadro non trovato: " + visible_text()[:300]
    screenshot("salute-prima")
    tap(button)
    time.sleep(3)
    check_alive("aprendo i permessi di Connessione Salute")
    screenshot("salute-permessi")
    log(f"schermata dei permessi: {visible_text()[:600]}")

    # La prima volta Connessione Salute si presenta: si prosegue.
    intro = wait_for("Get started", 8, "nella presentazione di Connessione Salute", exact=True, required=False)
    if intro:
        tap(intro)
        time.sleep(3)
        check_alive("dopo la presentazione di Connessione Salute")
        screenshot("salute-permessi")
        log(f"dopo la presentazione: {visible_text()[:600]}")

    # Schermata di sistema: prima "Consenti tutto", poi "Consenti".
    everything = wait_for("Allow all", 20, "nei permessi di Connessione Salute", required=False)
    if everything:
        tap(everything)
        time.sleep(1.5)
    allow = wait_for("Allow", 10, "nei permessi di Connessione Salute", exact=True, required=False)
    if not allow:
        screenshot("salute-senza-consenti")
        return "pulsante Consenti non trovato"
    tap(allow)
    time.sleep(3)
    check_alive("dopo aver concesso i permessi di Connessione Salute")

    connected = wait_for("Collegata", 40, "dopo il collegamento", required=False)
    scroll_to("Gestisci i permessi")
    screenshot("salute-dopo")
    log(f"dopo il collegamento: {visible_text()[:900]}")
    if not connected:
        return "permessi concessi ma il riquadro non dice Collegata"
    # Il conteggio dei passi sta in alto: si torna su prima di cercarlo.
    for _ in range(4):
        if find("passi oggi"):
            return "collegata"
        adb("shell", "input", "swipe", "540", "900", "540", "1500", "400")
        time.sleep(1.5)
    screenshot("salute-senza-passi")
    return "collegata, ma manca il conteggio dei passi di oggi"


def station_fix(station_id: str, north_m: float = 0.0) -> None:
    """Mette il telefono simulato a una stazione della metro (o poco più a nord)."""
    network = json.loads(Path("src/data/metro-roma.json").read_text(encoding="utf-8"))
    station = next(s for s in network["stations"] if s["id"] == station_id)
    lat = station["lat"] + north_m / 111195.0
    adb("emu", "geo", "fix", f"{station['lon']:.7f}", f"{lat:.7f}", "20", "12", "0", check=False)


def check_metro() -> str:
    """La metro, nei due modi: registrata a posteriori e riconosciuta dentro un tragitto avviato."""
    log("metro a posteriori: sono all'uscita di EUR Fermi")
    for _ in range(4):
        station_fix("eur-fermi", 60)
        time.sleep(1)
    button = scroll_to("Ho preso la metro")
    if not button:
        screenshot("metro-senza-pulsante")
        return "pulsante Ho preso la metro non trovato: " + visible_text()[:300]
    tap(button)
    arrived = wait_for("EUR Fermi", 45, "cercando la stazione di arrivo", required=False)
    check_alive("cercando la stazione di arrivo")
    screenshot("metro-arrivo")
    if not arrived:
        return "stazione di arrivo non riconosciuta: " + visible_text()[:400]
    line = wait_for("Linea A", 15, "scegliendo la linea", exact=True, required=False)
    if not line:
        return "linee non trovate: " + visible_text()[:300]
    tap(line)
    time.sleep(1.5)
    departure = scroll_to("Flaminio", exact=True, swipes=10)
    if not departure:
        screenshot("metro-senza-partenza")
        return "stazione di partenza non trovata: " + visible_text()[:400]
    tap(departure)
    time.sleep(2.5)
    save = wait_for("Registra il viaggio", 20, "dopo la scelta della partenza", required=False)
    screenshot("metro-scelta")
    if not save:
        return "pulsante Registra il viaggio non trovato: " + visible_text()[:400]
    tap(save)
    wait_for("Riepilogo", 40, "registrando il viaggio in metro")
    time.sleep(1)
    declared = visible_text()
    screenshot("metro-dichiarato")
    log(f"metro a posteriori: {declared[:500]}")
    if "Flaminio → EUR Fermi" not in declared:
        return "il riepilogo non riporta Flaminio → EUR Fermi"
    if "partenza dichiarata" not in declared:
        return "il riepilogo non dice che la partenza è dichiarata"
    tap_label("Fine")
    wait_for("Inizia un tragitto", 30, "tornando a Oggi dopo la metro")

    log("metro dentro un tragitto: entro a Termini, esco al Colosseo")
    for _ in range(3):
        station_fix("termini", 40)
        time.sleep(1)
    tap_label("Inizia un tragitto")
    wait_for("Avvia", 30)
    tap(wait_for("Metro, bus, tram", 15, "scegliendo i mezzi pubblici"))
    time.sleep(1)
    tap_label("Avvia")
    wait_for_trip_screen(60, "avviando il tragitto in metro")
    for _ in range(8):
        station_fix("termini", 40)
        time.sleep(1)
    # Sottoterra: per cento secondi non arriva nessuna posizione nuova.
    time.sleep(100)
    check_alive("sottoterra")
    for _ in range(12):
        station_fix("colosseo", -40)
        time.sleep(1)
    finish = wait_for_trip_screen(30, "all'uscita dalla metro")
    screenshot("metro-in-corso")
    tap(finish)
    wait_for("Riepilogo", 60, "chiudendo il tragitto in metro")
    time.sleep(1)
    tracked = visible_text()
    screenshot("metro-avviato")
    log(f"metro dentro un tragitto: {tracked[:500]}")
    if "Termini → Colosseo" not in tracked:
        return "il tragitto avviato non riporta Termini → Colosseo: " + tracked[:300]
    tap_label("Fine")
    wait_for("Inizia un tragitto", 30, "tornando a Oggi dopo il tragitto in metro")
    return "ok"


def main() -> None:
    log("installo l'app")
    adb("install", "-r", apk, timeout=300)
    adb("shell", "cmd", "location", "set-location-enabled", "true", check=False)
    lat, lon = START
    adb("emu", "geo", "fix", f"{lon:.7f}", f"{lat:.7f}", "20", "12", "0", check=False)
    adb("logcat", "-c", check=False)

    log("apro l'app")
    adb("shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1")
    wait_for("Inizia un tragitto", 90, "all'apertura")
    screenshot("oggi")

    log("apro Nuovo tragitto")
    tap_label("Inizia un tragitto")
    wait_for("Avvia", 30)
    screenshot("nuovo-tragitto")

    log("premo Avvia e rispondo alle richieste di permesso")
    tap_label("Avvia")
    answered = answer_permission_dialogs()
    log(f"permessi concessi: {len(answered)}")
    check_alive("dopo i permessi")
    # Da qui il cronometro cambia ogni secondo e l'elenco degli elementi non è
    # affidabile: la schermata si riconosce dal pulsante "Termina".
    wait_for_trip_screen(60, "dopo i permessi")
    screenshot("in-corso")

    log("cammino per 90 secondi con l'app aperta")
    walk(90)
    check_alive("durante la camminata")
    screenshot("camminata")
    first = shown_distance()
    log(f"percorsi davvero {walked:.0f} m, l'app ne mostra {first}")

    log("mando l'app in secondo piano e cammino altri 60 secondi")
    adb("shell", "input", "keyevent", "KEYCODE_HOME")
    time.sleep(2)
    services = adb("shell", "dumpsys", "activity", "services", PACKAGE, check=False)
    foreground = "isForeground=true" in services
    log(f"servizio in primo piano attivo: {foreground}")
    walk(60)
    check_alive("in secondo piano")
    screenshot("secondo-piano")

    log("riapro l'app")
    adb("shell", "monkey", "-p", PACKAGE, "-c", "android.intent.category.LAUNCHER", "1")
    finish = wait_for_trip_screen(40, "al rientro")
    time.sleep(4)
    check_alive("al rientro")
    screenshot("rientro")
    second = shown_distance()
    log(f"percorsi davvero {walked:.0f} m, l'app ne mostra {second}")

    log("termino il tragitto")
    tap(finish)
    wait_for("Riepilogo", 60, "alla chiusura")
    time.sleep(1)
    screenshot("riepilogo")
    total = summary_distance()
    summary = visible_text()
    log(f"riepilogo: distanza {total} m | {summary}")

    tap_label("Fine")
    wait_for("Inizia un tragitto", 30, "tornando a Oggi")
    screenshot("oggi-dopo")

    log("apro le medaglie")
    tap_label("Medaglie")
    wait_for("sbloccate", 30, "aprendo le medaglie")
    screenshot("medaglie")
    medals = visible_text()
    log(f"medaglie: {medals}")
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    wait_for("Tragitti di oggi", 30, "tornando a Oggi dalle medaglie")

    board = check_leaderboard()
    metro = check_metro()
    health = connect_health() if WITH_HEALTH else "non provata"
    check_alive("alla fine")

    (out / "logcat.txt").write_text(adb("logcat", "-d", check=False))

    problems = []
    if not foreground:
        problems.append("il servizio in primo piano non risultava attivo ad app nascosta")
    if total is None:
        problems.append("distanza non trovata nel riepilogo")
    else:
        # 60 dei 150 secondi di camminata sono ad app nascosta: se in quel
        # tempo non si misurasse nulla, il totale non supererebbe il 60%.
        if total < walked * 0.75:
            problems.append(f"distanza troppo bassa: {total:.0f} m su {walked:.0f} m veri (ad app nascosta non si misura?)")
        if total > walked * 1.25:
            problems.append(f"distanza gonfiata: {total:.0f} m su {walked:.0f} m veri")
    if first is not None and second is not None and second <= first:
        problems.append(f"la distanza non è cresciuta ad app nascosta: {first} → {second} m")
    if "Primo passo" not in medals or "1 di 9" not in medals:
        problems.append("la medaglia Primo passo non risulta sbloccata")
    measured = (
        f"percorsi {walked:.0f} m, misurati {total} m (app aperta {first}, dopo il secondo piano {second}); "
        f"permessi: {answered}; classifica: {board}; metro: {metro}; Connessione Salute: {health}"
    )
    if board != "ok":
        problems.append(f"classifica: {board}")
    if metro != "ok":
        problems.append(f"metro: {metro}")
    if WITH_HEALTH and health != "collegata":
        problems.append(f"Connessione Salute non collegata: {health}")
    if problems:
        for problem in problems:
            log(f"PROBLEMA: {problem}")
        annotate("error", "Prova fallita: " + "; ".join(problems) + "\n" + measured)
        sys.exit(1)
    log("RIUSCITA: " + measured)
    annotate("notice", "Prova riuscita: " + measured)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # qualsiasi imprevisto deve lasciare traccia
        fail(f"errore imprevisto: {error}")
