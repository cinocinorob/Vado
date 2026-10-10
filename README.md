# Vado — prototipo

App che premia gli spostamenti sostenibili: scegli il mezzo, avvii il tragitto, a fine percorso ricevi i punti.
"Vado" è un nome provvisorio.

Questa versione misura davvero: distanza dal GPS, passi dal sensore del telefono, punti calcolati con le regole
decise insieme. Tutti i dati restano sul telefono.

## Cosa c'è e cosa manca

| C'è | Manca |
|---|---|
| Schermata Oggi: punti, obiettivo da 80, serie di giorni, tragitti | Classifica (servono account e un server) |
| Nuovo tragitto: 8 mezzi, interruttore casa-lavoro | Medaglie |
| Tragitto in corso: percorso disegnato, punti che maturano, pausa, cambio mezzo | Mappa vera sotto il percorso |
| Riepilogo con lo stato di ogni tratto | CO₂ evitata (servono fattori di emissione con fonte) |
| Rilevamento a schermo spento, con notifica fissa | Trasparenze sfocate del mockup |
| Controlli anti-imbroglio di base | Riconoscimento automatico del mezzo |

## Installarla sul telefono, senza PC

Il codice sta in un repository GitHub. A ogni modifica GitHub costruisce da solo l'app e la pubblica come file
scaricabile (la ricetta è in `.github/workflows/apk.yml`). Dal telefono:

1. Apri la pagina **Releases** del repository e tocca **vado.apk**.
2. A download finito tocca il file. La prima volta Android chiede di consentire a Chrome di installare app:
   consenti e torna indietro.
3. Se compare l'avviso di Play Protect ("app non riconosciuta"), scegli di installare comunque: è normale per
   un'app non ancora pubblicata sullo store.

Per aggiornare si ripete dal punto 1: la nuova versione si installa sopra la precedente e i dati restano.

La prima costruzione richiede circa 20 minuti. Lo stato si vede nella scheda **Actions** del repository: spunta
verde riuscita, croce rossa fallita.

## Come fare la prova

Cinque prove brevi. Per ognuna annota il valore dell'app e quello reale.

1. **Camminata su distanza nota, telefono in mano.** Misura circa 1 km su una mappa e percorrilo. Atteso: distanza
   tra il 90% e il 105% di quella vera, stato "Verificato".
2. **Stessa camminata, telefono in tasca a schermo spento.** Atteso: stessa distanza. Guarda anche lo stato: se è
   "Dichiarato" con la nota "Passi non contati a schermo spento", il telefono non conta i passi ad app chiusa.
3. **Fermo per 5 minuti** con il tragitto avviato. Atteso: distanza a zero o di pochi metri.
4. **In auto da passeggero, dichiarando "A piedi".** Atteso: "Non valido", zero punti.
5. **In auto da passeggero, dichiarando "Bici".** Qui l'esito non è garantito: nel traffico lento l'app non
   distingue un'auto da una bici. Serve a capire quanto spesso succede.

Se un risultato è lontano dall'atteso, quello è il dato utile: dice quale soglia va corretta.

## Regole del punteggio

Stanno in due file e si cambiano lì:

- `src/core/modes.ts` — mezzi, punti per km, velocità massime credibili.
- `src/core/scoring.ts` — tetto, bonus, obiettivo, controlli.

In sintesi:

- **Punti per km:** a piedi 10, bici 8, bici elettrica 6, mezzi pubblici 4, treno 3, car sharing 2, auto elettrica 1,
  auto a benzina 0. Si arrotonda per difetto, una volta sola sul totale del tragitto.
- **Tetto di 60 punti per tragitto.** Due tragitti separati da meno di 30 minuti contano come uno solo, altrimenti
  basterebbe premere Termina e Avvia per azzerare il tetto.
- **Bonus casa-lavoro di +10**, una volta al giorno, per tragitti di almeno 500 m senza auto privata.
- **La distanza viene solo dal GPS.** I passi la confermano o la limitano (al massimo 1,5 m per passo), ma non la
  creano: altrimenti basterebbe agitare il telefono.

Stato di un tratto:

- **Verificato:** a piedi, quando i passi contati bastano a spiegare la distanza.
- **Dichiarato:** vale ciò che dichiari; si controlla solo che la velocità sia compatibile con il mezzo.
- **Non valido:** i dati contraddicono il mezzo (troppo veloce, troppo pochi passi, posizione simulata da
  un'altra app). Zero punti e niente bonus.

## Come viene misurata la distanza

Il GPS oscilla anche da fermi e in città si sposta di lato per i riflessi sui palazzi. Il filtro in
`src/core/geo.ts` liscia le posizioni, conta uno spostamento solo se supera l'incertezza dichiarata e se è
confermato dalla lettura successiva, e chiede un indizio di movimento vero (la velocità misurata dal ricevitore).

Le soglie sono state scelte con un simulatore (`src/core/testing/gpsSimulator.ts`), non su strada. Su percorsi
simulati di 2 km il filtro tende a **sottostimare** del 5–10% tra gli isolati, perché taglia gli angoli, e non ha
mai sovrastimato oltre il 15%. Sui tratti di poche centinaia di metri l'errore è più ampio. Le prove qui sopra
servono a sostituire queste stime con misure vere.

Dopo ogni modifica: `npm test` (60 controlli automatici) e `npm run typecheck`. GitHub li esegue comunque prima di
costruire l'app, e si ferma se falliscono.

## Limiti noti

- **Auto dichiarata come bici o come mezzo pubblico.** È il punto debole principale. Con il solo GPS, nel traffico
  lento non si distinguono. La soluzione è il riconoscimento dell'attività fatto dal telefono (in bici, in
  veicolo, a piedi), che richiede un componente aggiuntivo non ancora presente.
- **Bonus casa-lavoro:** oggi basta l'interruttore. Per verificarlo davvero bisognerebbe salvare la zona di casa e
  di lavoro, cosa che per ora si è scelto di non fare.
- **Passi a schermo spento:** dipende dal telefono. Se non vengono contati, il tratto a piedi resta "Dichiarato"
  invece che "Verificato", ma i punti ci sono.
- **Metro in galleria:** sotto terra il GPS non funziona. Il tratto senza segnale viene contato in linea retta tra
  l'ultimo punto prima e il primo dopo, quindi sottostimato.
- **Soste lunghe con segnale scarso:** il GPS può aggiungere qualche decina di metri. A piedi lo impediscono i passi.
- **Se chiudi l'app dall'elenco delle app recenti** il rilevamento si ferma. Alla riapertura il tragitto viene
  recuperato, ma la strada fatta nel frattempo non è contata.
- **iPhone:** il progetto è lo stesso, ma il rilevamento a schermo spento su iOS non è ancora configurato.
- **Icona e schermata di avvio** sono quelle di esempio.

## Riservatezza

- Nello storico finiscono solo distanza, tempo, passi, mezzo e punti.
- Le coordinate esistono solo in memoria mentre il tragitto è aperto: non vengono mai scritte sul telefono, nemmeno
  nella bozza che serve a recuperare un tragitto interrotto.
- Il percorso è disegnato senza mappa, quindi nessun servizio esterno riceve la posizione.
- Nessun dato lascia il telefono.

## Verso il Play Store

Già a posto nel progetto:

- **Livello Android richiesto:** l'app punta ad Android 16 (API 36), obbligatorio per le nuove app dal 31 agosto 2026.
- **Permessi al minimo:** posizione solo durante l'uso, attività fisica per i passi, notifiche per l'avviso fisso,
  servizio in primo piano di tipo "posizione". Il permesso di posizione "sempre" è escluso esplicitamente.

Da fare prima del primo caricamento:

1. **Nome del pacchetto definitivo.** Ora è `app.vado.prototipo` (in `app.json`, voci `android.package` e
   `ios.bundleIdentifier`). Dopo il primo caricamento su Play non si può più cambiare.
2. **Chiave di firma definitiva.** I file costruiti da GitHub sono firmati con una chiave di prova uguale per
   tutti: vanno bene per provare, non per lo store. Per la pubblicazione serve una chiave propria, tenuta segreta.
3. **Account sviluppatore Google Play** (25 $ una tantum). Un account personale nuovo deve fare un test chiuso con
   almeno 12 tester per 14 giorni di fila prima di poter pubblicare. Play Console si usa anche dal browser del
   telefono.
4. **Dichiarazione del servizio in primo piano** in Play Console (Contenuti dell'app): descrizione della funzione
   e un breve video che mostra l'avvio del tragitto. Google può chiedere anche la dichiarazione sulla posizione
   in background, perché il rilevamento continua ad app non visibile: va verificato al momento dell'invio.
5. **Informativa sulla privacy** su una pagina web pubblica, che parli di posizione e passi.
6. **Modulo "Sicurezza dei dati":** oggi nessun dato lascia il telefono. Andrà aggiornato quando arriveranno
   account e classifica.
7. **Scheda dello store:** icona, schermate, descrizione. Verificare che il nome scelto sia libero.

Riferimenti:
- [Livello API richiesto da Google Play](https://developer.android.com/google/play/requirements/target-sdk)
- [Requisiti di test per i nuovi account personali](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Servizi in primo piano: cosa dichiarare](https://support.google.com/googleplay/android-developer/answer/13392821)
- [Posizione in background: quando serve la dichiarazione](https://support.google.com/googleplay/android-developer/answer/9799150)

## Cartelle

```
src/core/       regole pure: mezzi, punteggio, filtro GPS, simulatore per i test
src/tracking/   tragitto in corso: stato, sensori, bozza su disco
src/storage/    storico dei tragitti sul telefono
src/ui/         colori, caratteri, icone, mascotte, componenti
src/app/        le quattro schermate
.github/        la ricetta con cui GitHub costruisce l'app
```
