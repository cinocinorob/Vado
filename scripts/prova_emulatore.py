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

Uso: prova_emulatore.py <file.apk> <cartella-risultati>
"""
import math
import re
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
out.mkdir(parents=True, exist_ok=True)
shots = 0


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


def nodes() -> list[dict]:
    """Elementi visibili sullo schermo, con testo e posizione."""
    for _ in range(5):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False)
        xml = adb("exec-out", "cat", "/sdcard/ui.xml", check=False)
        try:
            root = ET.fromstring(xml)
        except ET.ParseError:
            time.sleep(1)
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


def wait_for(label: str, seconds: int = 60, where: str = "") -> dict:
    deadline = time.time() + seconds
    while time.time() < deadline:
        node = find(label)
        if node:
            return node
        check_alive(where or f"aspettando «{label}»")
        time.sleep(1)
    fail(f"«{label}» non è comparso entro {seconds} s")
    raise AssertionError


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


def shown_distance() -> float | None:
    """Distanza mostrata nella schermata del tragitto, in metri."""
    for node in nodes():
        for value in (node["text"], node["desc"]):
            match = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s(km|m)", value.strip())
            if match:
                number = float(match.group(1).replace(",", "."))
                return number * 1000 if match.group(2) == "km" else number
    return None


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
    wait_for("Termina", 40, "dopo i permessi")
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
    wait_for("Termina", 40, "al rientro")
    time.sleep(3)
    screenshot("rientro")
    second = shown_distance()
    log(f"percorsi davvero {walked:.0f} m, l'app ne mostra {second}")

    log("termino il tragitto")
    tap_label("Termina")
    wait_for("Riepilogo", 40, "alla chiusura")
    screenshot("riepilogo")
    summary = visible_text()
    log(f"riepilogo: {summary}")

    tap_label("Fine")
    wait_for("Inizia un tragitto", 30, "tornando a Oggi")
    screenshot("oggi-dopo")
    check_alive("alla fine")

    (out / "logcat.txt").write_text(adb("logcat", "-d", check=False))

    problems = []
    if not foreground:
        problems.append("il servizio in primo piano non risultava attivo ad app nascosta")
    if first is None or first < walked * 0.25:
        problems.append(f"distanza con app aperta troppo bassa: {first} m")
    if second is None or first is None or second <= first:
        problems.append(f"la distanza non è cresciuta ad app nascosta: {first} → {second} m")
    if second is not None and second > walked * 1.3:
        problems.append(f"distanza gonfiata: {second} m su {walked:.0f} m veri")
    if problems:
        for problem in problems:
            log(f"PROBLEMA: {problem}")
        sys.exit(1)
    log("RIUSCITA: nessuna chiusura, distanza misurata con app aperta e nascosta")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # qualsiasi imprevisto deve lasciare traccia
        fail(f"errore imprevisto: {error}")
