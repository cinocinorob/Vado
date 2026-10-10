# Vado — prototipo

App che premia gli spostamenti sostenibili: scegli il mezzo, avvii il tragitto, a fine percorso ricevi i punti.
"Vado" è un nome provvisorio.

Questa versione misura davvero: distanza dal GPS, passi dal sensore del telefono, punti calcolati con le regole
decise insieme. Tutti i dati restano sul telefono.

## Cosa c'è e cosa manca

| C'è | Manca |
|---|---|
| Schermata Oggi: punti, obiettivo da 80, serie di giorni, tragitti | Classifica (servono account e un server) |
| Nuovo tragitto: 8 mezzi, interruttore casa-lavoro | Mappa vera sotto il percorso |
| Tragitto in corso: percorso disegnato, punti che maturano, pausa, cambio mezzo | CO₂ evitata (servono fattori di emissione con fonte) |
| Riepilogo con lo stato di ogni tratto e le medaglie appena prese | Trasparenze sfocate del mockup |
| Medaglie: nove, con avanzamento | Riconoscimento automatico del mezzo |
| Connessione Salute: passi e attività registrate da altre app | Versione iPhone del collegamento (Apple Salute) |
| Rilevamento a schermo spento, con notifica fissa | |
| Controlli anti-imbroglio di base | |
| Schermata Riservatezza | |

## Installarla sul telefono, senza PC

Il codice sta in un repository GitHub. A ogni modifica GitHub costruisce da solo l'app e la pubblica come file
scaricabile (la ricetta è in `.github/workflows/apk.yml`). Dal telefono:

1. Apri la pagina **Releases** del repository e tocca **vado.apk**.
2. A download finito tocca il file. La prima volta Android chiede di consentire a Chrome di installare app:
   consenti e torna indietro.
3. Se compare l'avviso di Play Protect ("app non riconosciuta"), scegli di installare comunque: è normale per
   un'app non ancora pubblicata sullo store.

Per aggiornare si ripete dal punto 1: la nuova versione si installa sopra la precedente e i dati restano.

La costruzione richiede circa 25 minuti. Lo stato si vede nella scheda **Actions** del repository: spunta
verde riuscita, croce rossa fallita.

Prima di pubblicare, GitHub **prova l'app su un telefono Android simulato** (Android 16): la apre, avvia un
tragitto a piedi concedendo i permessi dalle finestre di sistema, simula una camminata di 210 metri di cui 84 ad
app nascosta, termina, apre le medaglie e collega Connessione Salute. Se l'app si chiude da sola o la distanza
misurata è sbagliata, la versione non viene pubblicata. Le schermate dell'ultima prova stanno nel ramo
`diagnostica` del repository. La prova è in `scripts/prova_emulatore.py`.

Il telefono simulato non ha contapassi e non ha attività in Connessione Salute: passi veri, precisione del GPS su
strada e importazione delle attività si verificano solo sul telefono.

## Come fare la prova

Sei prove brevi. Per ognuna annota il valore dell'app e quello reale.

1. **Camminata su distanza nota, telefono in mano.** Misura circa 1 km su una mappa e percorrilo. Atteso: distanza
   tra il 90% e il 105% di quella vera, stato "Verificato".
2. **Stessa camminata, telefono in tasca a schermo spento.** Atteso: stessa distanza. Guarda anche lo stato: se è
   "Dichiarato" con la nota "Passi non contati a schermo spento", il telefono non conta i passi ad app chiusa.
3. **Fermo per 5 minuti** con il tragitto avviato. Atteso: distanza a zero o di pochi metri.
4. **In auto da passeggero, dichiarando "A piedi".** Atteso: "Non valido", zero punti.
5. **In auto da passeggero, dichiarando "Bici".** Qui l'esito non è garantito: nel traffico lento l'app non
   distingue un'auto da una bici. Serve a capire quanto spesso succede.

6. **Connessione Salute.** Nella schermata Oggi tocca "Collega" e concedi i tre permessi. Atteso: il riquadro dice
   "Collegata" e compare il numero dei passi di oggi. Se usi un'app che registra le attività (Strava, Fitbit,
   Garmin…) e l'hai collegata a Connessione Salute, le camminate e le corse degli ultimi 7 giorni compaiono come
   tragitti "Registrato da …". Annota quante ne arrivano e quante te ne aspettavi.

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

## Medaglie

Sono nove e si calcolano ogni volta dallo storico dei tragitti (`src/core/badges.ts`): non esiste un elenco
salvato che possa andare fuori sincronia.

| Medaglia | Come si prende |
|---|---|
| Primo passo | Un tragitto a piedi di almeno 200 m |
| Re della metro | 10 tragitti con i mezzi pubblici |
| Due ruote | 50 km in bici, elettrica compresa |
| Sette su sette | 7 giorni di fila con un tragitto senza auto privata e nessuno in auto privata |
| Pendolare d'oro | 20 tragitti casa-lavoro senza auto privata |
| Scossa | 10 tragitti in bici elettrica |
| Capotreno | 100 km in treno |
| In condivisione | 5 tragitti in car sharing |
| Maratoneta | 42 km a piedi |

Contano solo i tratti validi. Per le medaglie a numero di tragitti il tratto con quel mezzo deve essere di almeno
500 m, altrimenti basterebbe premere Avvia e Termina dieci volte.

## Connessione Salute

Connessione Salute (Health Connect) è il deposito di Android in cui le app di salute e fitness mettono i propri
dati. L'app la legge solo se la colleghi dalla schermata Oggi, e solo mentre è aperta. Chiede tre permessi di
lettura: passi, attività, distanza. Non scrive nulla.

Serve a due cose (regole in `src/core/health.ts`):

1. **Passi per i tratti a piedi.** A fine tragitto l'app chiede i passi fatti nei minuti esatti del tratto e tiene
   il numero più alto tra il suo e quello di Connessione Salute. Può solo aiutare: Connessione Salute scrive i
   passi a blocchi, con circa un minuto di ritardo, quindi un suo numero basso non toglie mai punti.
2. **Attività registrate altrove.** Camminate, corse, escursioni e giri in bici degli ultimi 7 giorni diventano
   tragitti, con le stesse regole: 10 punti per km a piedi, 8 in bici, tetto di 60, controlli su passi e velocità.
   Niente bonus casa-lavoro.

Non vengono importate: le attività inserite a mano, quelle senza distanza o sotto i 200 m, quelle che non sono
spostamenti (palestra, nuoto, cyclette, tapis roulant) e quelle che coincidono per più del 20% della durata con un
tragitto già presente, così la stessa uscita non conta due volte.

Limiti:

- L'app non può verificare ciò che un'altra app ha scritto. Escludere le voci inserite a mano chiude l'imbroglio
  più facile, non tutti.
- Il conteggio dei passi fatto dal telefono dentro Connessione Salute parte solo dopo che un'app ha ottenuto il
  permesso di leggerli: il primo giorno i passi sono parziali.
- Le attività arrivano se l'app che le registra (Strava, Fitbit, Garmin, Samsung Health…) è a sua volta collegata
  a Connessione Salute e scrive anche la distanza.

## Come viene misurata la distanza

Il GPS oscilla anche da fermi e in città si sposta di lato per i riflessi sui palazzi. Il filtro in
`src/core/geo.ts` liscia le posizioni, conta uno spostamento solo se supera l'incertezza dichiarata e se è
confermato dalla lettura successiva, e chiede un indizio di movimento vero (la velocità misurata dal ricevitore).

Le soglie sono state scelte con un simulatore (`src/core/testing/gpsSimulator.ts`), non su strada. Su percorsi
simulati di 2 km il filtro tende a **sottostimare** del 5–10% tra gli isolati, perché taglia gli angoli, e non ha
mai sovrastimato oltre il 15%. Sui tratti di poche centinaia di metri l'errore è più ampio. Le prove qui sopra
servono a sostituire queste stime con misure vere.

Dopo ogni modifica: `npm test` (101 controlli automatici), `npm run typecheck` e `npm run lint`. GitHub li esegue
comunque prima di costruire l'app, e si ferma se falliscono.

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

- Nello storico finiscono solo distanza, tempo, passi, mezzo e punti. Per le attività importate anche il nome
  dell'app che le aveva registrate.
- Le coordinate esistono solo in memoria mentre il tragitto è aperto: non vengono mai scritte sul telefono, nemmeno
  nella bozza che serve a recuperare un tragitto interrotto.
- Il percorso è disegnato senza mappa, quindi nessun servizio esterno riceve la posizione.
- Da Connessione Salute si leggono passi, attività e distanza; nessun dato di salute viene copiato fuori dal
  telefono.
- Nessun dato lascia il telefono. La schermata Riservatezza dell'app dice le stesse cose all'utente.

## Verso il Play Store

Già a posto nel progetto:

- **Livello Android richiesto:** l'app punta ad Android 16 (API 36), obbligatorio per le nuove app dal 31 agosto 2026.
- **Permessi al minimo:** posizione solo durante l'uso, attività fisica per i passi, notifiche per l'avviso fisso,
  servizio in primo piano di tipo "posizione", tre letture da Connessione Salute. Il permesso di posizione
  "sempre" è escluso esplicitamente.
- **Avvio al riavvio del telefono** (`RECEIVE_BOOT_COMPLETED`): lo richiede il componente che consegna le
  posizioni all'app. Senza, l'app si chiudeva alla prima posizione ricevuta. L'app non fa nulla al riavvio: se
  trova un rilevamento rimasto registrato senza un tragitto aperto, lo spegne.
- **Android minimo:** 8.0 (API 26), richiesto da Connessione Salute.

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
5. **Informativa sulla privacy** su una pagina web pubblica, che parli di posizione, passi e dati di Connessione
   Salute: cosa si legge, a che scopo, dove resta, come si cancella.
6. **Dichiarazione per Connessione Salute** in Play Console: per ogni permesso richiesto (passi, attività,
   distanza) va indicato a cosa serve. Il caso d'uso previsto da Google è "Rewards" (app che incoraggiano
   abitudini sane). Due vincoli da tenere presenti per il modello di guadagno: i dati di salute **non possono
   essere usati per la pubblicità né ceduti a terzi**.
7. **Collegamento dall'informativa di Connessione Salute.** Quando l'utente tocca "informativa sulla privacy"
   nella schermata dei permessi di Connessione Salute, Android apre l'app: oggi si apre su Oggi, deve aprirsi
   sulla schermata Riservatezza. Serve un piccolo componente nativo, non ancora scritto.
8. **Modulo "Sicurezza dei dati":** oggi nessun dato lascia il telefono. Andrà aggiornato quando arriveranno
   account e classifica.
9. **Scheda dello store:** icona, schermate, descrizione. Verificare che il nome scelto sia libero.

Riferimenti:
- [Livello API richiesto da Google Play](https://developer.android.com/google/play/requirements/target-sdk)
- [Requisiti di test per i nuovi account personali](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Servizi in primo piano: cosa dichiarare](https://support.google.com/googleplay/android-developer/answer/13392821)
- [Posizione in background: quando serve la dichiarazione](https://support.google.com/googleplay/android-developer/answer/9799150)
- [Connessione Salute: requisiti di Google Play](https://support.google.com/googleplay/android-developer/answer/12991134)
- [Connessione Salute: conteggio dei passi del telefono](https://developer.android.com/health-and-fitness/health-connect/features/steps)

## Cartelle

```
src/core/       regole pure: mezzi, punteggio, medaglie, filtro GPS, Connessione Salute, simulatore per i test
src/tracking/   tragitto in corso: stato, sensori, bozza su disco
src/health/     lettura da Connessione Salute e importazione delle attività
src/storage/    storico dei tragitti e impostazioni, sul telefono
src/ui/         colori, caratteri, icone, mascotte, medaglie, componenti
src/app/        le schermate: Oggi, Nuovo tragitto, In corso, Riepilogo, Medaglie, Riservatezza
scripts/        la prova automatica su telefono simulato
.github/        la ricetta con cui GitHub costruisce, prova e pubblica l'app
```
