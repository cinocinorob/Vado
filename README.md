# Vado — prototipo

App che premia gli spostamenti sostenibili: scegli il mezzo, avvii il tragitto, a fine percorso ricevi i punti.
"Vado" è un nome provvisorio.

Questa versione misura davvero: distanza dal GPS, passi dal sensore del telefono, punti calcolati con le regole
decise insieme. Tragitti e posizioni restano sul telefono; al server va solo ciò che serve alla classifica.

## Cosa c'è e cosa manca

| C'è | Manca |
|---|---|
| Schermata Oggi: punti, obiettivo da 80, serie di giorni, tragitti | Mappa vera sotto il percorso |
| Nuovo tragitto: 8 mezzi, interruttore casa-lavoro | CO₂ evitata (servono fattori di emissione con fonte) |
| Tragitto in corso: percorso disegnato, punti che maturano, pausa, cambio mezzo | Tema scuro (la grafica è solo chiara) |
| Riepilogo con lo stato di ogni tratto e le medaglie appena prese | Riconoscimento automatico del mezzo |
| Medaglie: nove, con avanzamento | |
| Metro di Roma: distanza calcolata sulla rete, anche registrata a posteriori | Metro di altre città; bus e treni in galleria |
| Connessione Salute: passi e attività registrate da altre app | Versione iPhone del collegamento (Apple Salute) |
| Classifica, leghe con invito e sfide tra persone vere | Lega a livelli automatica; segnalazione di soprannomi e nomi offensivi |
| Rilevamento a schermo spento, con notifica fissa | |
| Controlli anti-imbroglio di base | |
| Schermata Riservatezza | |

## Grafica

Lo stile si chiama "Adesivi": fondo chiaro, blocco lime in cima alle schermate principali, schede bianche con bordo
spesso color inchiostro e ombra piena (senza sfumatura), mascotte e medaglie disegnate come figurine. Colori,
caratteri e forme stanno in `src/ui/theme.ts`; i pezzi riusati in `src/ui/parts.tsx` e `src/ui/Hero.tsx`.

Regola per i testi: sul chiaro si scrive in inchiostro. Lime e corallo sono riempimenti, non colori di testo su
bianco (il contrasto non basta); il lime come testo compare solo su fondo inchiostro.

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
app nascosta, termina, apre le medaglie, entra in classifica con un soprannome e collega Connessione Salute. Se l'app si chiude da sola o la distanza
misurata è sbagliata, la versione non viene pubblicata. Le schermate dell'ultima prova stanno nel ramo
`diagnostica` del repository. La prova è in `scripts/prova_emulatore.py`.

Il telefono simulato non ha contapassi e non ha attività in Connessione Salute: passi veri, precisione del GPS su
strada e importazione delle attività si verificano solo sul telefono.

## Come fare la prova

Otto prove brevi. Per ognuna annota il valore dell'app e quello reale.

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

7. **Metro con il tragitto avviato.** Prima di scendere scegli "Metro, bus, tram" e premi Avvia; termina quando
   sei risalito e hai fatto qualche passo all'aperto. Atteso: nel riepilogo una riga "Metro" con le due stazioni
   giuste e i chilometri della rete. Se invece compare "Mezzi pubblici" senza stazioni, annota a che distanza
   dall'ingresso hai avviato e dopo quanto tempo dall'uscita hai terminato.
8. **Metro a posteriori.** Fai un viaggio senza avviare nulla. All'uscita apri Vado, tocca "Ho preso la metro" e
   scegli la stazione di partenza. Atteso: la stazione di arrivo è quella giusta. Annota quanti secondi ci mette a
   riconoscerla e se sbaglia stazione.

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

## Classifica, leghe e sfide

Si gareggia sui punti, tra persone vere. Le regole stanno in `src/core/social.ts`:

- **Classifica settimanale**, dal lunedì alla domenica. A parità di punti la posizione è la stessa.
- **Leghe con invito:** chi crea la lega riceve un codice di 6 caratteri (senza O, 0, I, 1, che si confondono) da
  mandare agli altri, che lo inseriscono da "Nuova lega". Fino a 50 persone per lega, 8 leghe a testa.
- **Sfide**, sul modello di Samsung Health: "Primo al traguardo" (100, 250 o 500 punti; vince chi arriva per primo)
  e "Chi fa di più" (3, 7 o 14 giorni; vince chi ha più punti), individuali o a due squadre, fino a 10 persone,
  solo tra compagni di lega. In più la sfida del mese: 600 punti entro fine mese.
- **Accesso:** solo un soprannome, nessuna registrazione.
- **Lega a livelli** (Bronzo … Diamante, gruppi da 20, primi 5 su e ultimi 5 giù): le regole ci sono e sono
  provate, ma non è accesa. Con poche persone i gruppi resterebbero vuoti; si riaccende quando gli utenti bastano.

### Il server

Un progetto [Supabase](https://supabase.com) nella regione `eu-central-1` (Francoforte, Unione Europea). Tutto ciò che serve a crearlo è in `supabase/schema.sql`: si incolla
nel pannello di Supabase (SQL Editor → Run) e si può rilanciare senza perdere dati.

- Le tabelle stanno in uno schema non raggiungibile da fuori. L'app chiama solo le funzioni `vado_...`, che
  riconoscono il telefono da una chiave segreta casuale (creata alla scelta del soprannome, mai mostrata; sul
  server se ne conserva solo l'impronta) e restituiscono solo le leghe e le sfide di chi chiama.
- **Cosa arriva al server:** soprannome, leghe, sfide e, per ogni tragitto che ha dato punti, l'ora di fine, i
  punti e il mezzo principale. Mai posizioni, distanze o nomi di stazioni. I compagni di lega vedono il totale,
  non i singoli tragitti.
- Indirizzo e chiave pubblica del progetto sono in `src/social/config.ts`. La chiave pubblica è fatta per stare
  dentro un'app; quella segreta del progetto non va mai messa nel codice.
- L'app parla con il server in `src/social/remote.ts`. Se la rete manca mostra gli ultimi dati buoni con un
  avviso; i punti dei tragitti nuovi partono quando si apre l'app o la classifica.
- La sorgente di esempio con i partecipanti inventati (`src/social/demo.ts`, `bots.ts`) resta nel codice per le
  prove delle schermate, ma l'app non la usa più.

Prove: `src/social/remote.server.test.ts` fa creare leghe, entrare con il codice, fare punti e sfidarsi a quattro
persone simulate. "Prova del server" (scheda Actions) la lancia su un banco di prova, cioè un database e un
servizio avviati apposta, a ogni modifica; spuntando "reale" la lancia anche sul progetto vero, e alla fine
cancella i profili che ha creato. Anche la prova sul telefono simulato usa il progetto vero: crea il profilo
"ProvaCI" e una lega, fa entrare "AmicaCI" e poi cancella tutto.

Limiti da conoscere:

- **Punti dichiarati dal telefono.** Un'app modificata può mandarne di falsi. Il server rifiuta quelli
  impossibili (più di 70 per tragitto, tragitti nel futuro), non quelli falsi ma plausibili.
- **Cambio telefono o disinstallazione:** senza il codice di recupero (o un file di backup) il profilo si perde.
- **Piano gratuito di Supabase:** il progetto può essere messo in pausa dopo una settimana di attività scarsa e
  va riattivato a mano dal pannello.
- **Contenuti scritti dagli utenti** (soprannomi, nomi di leghe e sfide): per il Play Store servono un modo per
  segnalarli e uno per bloccare chi li scrive. Non ci sono ancora.

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

## Metro

Sottoterra il GPS non arriva, quindi la distanza di un viaggio in metro non si può misurare: si calcola sulla rete,
dalla stazione di ingresso a quella di uscita, cambi di linea compresi. Due modi:

1. **Dentro un tragitto avviato** con "Metro, bus, tram". Quando le posizioni spariscono vicino a una stazione
   (entro 300 m) e ricompaiono vicino a un'altra, dopo almeno 45 secondi e a una velocità da treno (al massimo
   80 km/h), quel tratto vale i metri della rete invece della linea d'aria. Nel riepilogo compare come "Metro",
   con i nomi delle due stazioni, e risulta "Verificato" se copre almeno metà del tratto. Se una delle condizioni
   manca, resta la linea d'aria come prima. Nessun limite al numero di viaggi. Vale anche se all'uscita arriva una
   sola posizione e si preme subito Termina, e se si torna "A piedi" quando si è ancora sottoterra: in quel caso
   il viaggio e il suo tempo vengono messi sul tratto dei mezzi pubblici, non sulla camminata.
2. **A posteriori**, con "Ho preso la metro" nella schermata Oggi, per chi ha dimenticato di avviare. La stazione
   di arrivo è quella dove ci si trova (entro 400 m, letta una volta dalla posizione), quella di partenza si
   sceglie dall'elenco. Poiché la partenza è solo dichiarata: al massimo **2 viaggi al giorno**, niente
   registrazione nei 10 minuti dopo un tragitto con i mezzi pubblici già contato, e il tratto resta "Dichiarato".
   Punti pieni, con il tetto di 60 per tragitto.

La rete (74 stazioni, linee A, B, B1 e C, distanze lungo il tracciato) sta in `src/data/metro-roma.json` e viene
dai dati aperti di Roma Servizi per la Mobilità. Si rigenera lanciando a mano "Aggiorna la rete della metro" dalla
scheda Actions: lo script `scripts/rete_metro.py` scarica i dati, estrae le linee di metropolitana e lascia il
risultato e un rapporto nel ramo `dati-rete`, da controllare e copiare. Le lunghezze ottenute corrispondono a quelle
pubblicate (A 18,4 km, B 18,1 km).

Non ancora verificato su strada: quanto spesso il telefono dà una posizione valida entro 300 m dalla stazione
subito prima di scendere e subito dopo essere risaliti. Le soglie sono in `src/core/metro.ts`.

## Backup e cambio telefono

Dalla schermata Oggi, "Backup e cambio telefono":

- **Crea il backup:** un file JSON con tutti i tragitti e il codice di recupero della classifica, passato al
  foglio di condivisione di Android (Drive, una chat, un'email). Vado non ne tiene copia.
- **Scegli il file:** sul telefono nuovo i tragitti del file si aggiungono a quelli presenti (mai sovrascritti,
  rimettere lo stesso file non raddoppia nulla); se sul telefono non c'è un profilo della classifica, torna anche
  quello.
- **Codice di recupero:** 54 caratteri in 9 gruppi da 6 (stesse lettere dei codici delle leghe, più due di
  controllo che scoprono gli errori di battitura). Ridà soprannome, leghe e punti su un altro telefono. È la
  chiave segreta del telefono scritta in un altro modo: chi lo ha può usare il profilo.

Il backup automatico di Android (dati delle app su Google Drive) non è disattivato, ma per Vado non è stato
verificato: il file e il codice sono la strada provata. Regole in `src/core/backup.ts` e `src/core/recovery.ts`.

## Come viene misurata la distanza

Il GPS oscilla anche da fermi e in città si sposta di lato per i riflessi sui palazzi. Il filtro in
`src/core/geo.ts` liscia le posizioni, conta uno spostamento solo se supera l'incertezza dichiarata e se è
confermato dalla lettura successiva, e chiede un indizio di movimento vero (la velocità misurata dal ricevitore).

All'avvio di un tragitto il telefono può consegnare per prima una posizione vecchia, tenuta in memoria da prima.
Se la successiva risulta più fresca di almeno 20 secondi, la prima viene scartata e non diventa il punto di
partenza: altrimenti la strada tra le due verrebbe contata, o farebbe scartare il tratto per velocità eccessiva.

Le soglie sono state scelte con un simulatore (`src/core/testing/gpsSimulator.ts`), non su strada. Su percorsi
simulati di 2 km il filtro tende a **sottostimare** del 5–10% tra gli isolati, perché taglia gli angoli, e non ha
mai sovrastimato oltre il 15%. Sui tratti di poche centinaia di metri l'errore è più ampio. Le prove qui sopra
servono a sostituire queste stime con misure vere.

Dopo ogni modifica: `npm test` (187 controlli automatici, più la prova del server), `npm run typecheck` e `npm run lint`. GitHub li esegue
comunque prima di costruire l'app, e si ferma se falliscono.

## Limiti noti

- **Auto dichiarata come bici o come mezzo pubblico.** È il punto debole principale. Con il solo GPS, nel traffico
  lento non si distinguono. La soluzione è il riconoscimento dell'attività fatto dal telefono (in bici, in
  veicolo, a piedi), che richiede un componente aggiuntivo non ancora presente.
- **Bonus casa-lavoro:** oggi basta l'interruttore. Per verificarlo davvero bisognerebbe salvare la zona di casa e
  di lavoro, cosa che per ora si è scelto di non fare.
- **Passi a schermo spento:** dipende dal telefono. Se non vengono contati, il tratto a piedi resta "Dichiarato"
  invece che "Verificato", ma i punti ci sono.
- **Metro:** la distanza viene dalla rete solo a Roma e solo se le posizioni prima e dopo sono vicine a una
  stazione (vedi "Metro"). Altrimenti il tratto senza segnale viene contato in linea retta, quindi sottostimato.
  Due stazioni a meno di 400 m in linea d'aria (per esempio Termini e Repubblica) restano in linea retta.
- **Metro registrata a posteriori:** la stazione di partenza è una dichiarazione. Il limite di due al giorno
  contiene l'abuso, non lo impedisce.
- **Linea C in superficie:** nel tratto esterno il GPS funziona e la distanza viene misurata, non calcolata.
- **Soste lunghe con segnale scarso:** il GPS può aggiungere qualche decina di metri. A piedi lo impediscono i passi.
- **Se chiudi l'app dall'elenco delle app recenti** il rilevamento si ferma. Alla riapertura il tragitto viene
  recuperato, ma la strada fatta nel frattempo non è contata.
- **iPhone:** il progetto è lo stesso, ma il rilevamento a schermo spento su iOS non è ancora configurato.
- **Icona e schermata di avvio** sono quelle di esempio.

## Riservatezza

- Nello storico finiscono solo distanza, tempo, passi, mezzo e punti. Per le attività importate anche il nome
  dell'app che le aveva registrate. Per i viaggi in metro anche i nomi delle stazioni di ingresso e di uscita: è
  l'unico dato sui luoghi che resta scritto.
- "Ho preso la metro" legge la posizione una volta sola, per riconoscere la stazione, e non la salva.
- Le coordinate esistono solo in memoria mentre il tragitto è aperto: non vengono mai scritte sul telefono, nemmeno
  nella bozza che serve a recuperare un tragitto interrotto.
- Il percorso è disegnato senza mappa, quindi nessun servizio esterno riceve la posizione.
- Da Connessione Salute si leggono passi, attività e distanza; nessun dato di salute viene copiato fuori dal
  telefono.
- Lasciano il telefono solo i dati della classifica, e solo dopo aver scelto un soprannome: vedi "Il server".
  Dalla schermata Riservatezza si può cancellare il profilo dal server.
- La schermata Riservatezza dell'app dice le stesse cose all'utente.

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
8. **Modulo "Sicurezza dei dati":** va dichiarato ciò che la classifica manda al server (soprannome, punti e ora
   dei tragitti con punti, leghe e sfide), che è cifrato in transito e che si può cancellare dall'app. Google
   chiede anche un indirizzo web da cui chiedere la cancellazione senza reinstallare l'app.
9. **Scheda dello store:** icona, schermate, descrizione. Verificare che il nome scelto sia libero.
10. **Condizioni d'uso dei dati della metro.** La pagina dei dati aperti di Roma Servizi per la Mobilità non indica
    una licenza: dice che i dati vanno usati "a titolo di supporto al viaggio". Prima di pubblicare va chiesto per
    iscritto se l'uso in un'app come questa è ammesso e come citare la fonte. L'app la cita già nella schermata
    Riservatezza.

Riferimenti:
- [Livello API richiesto da Google Play](https://developer.android.com/google/play/requirements/target-sdk)
- [Requisiti di test per i nuovi account personali](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Servizi in primo piano: cosa dichiarare](https://support.google.com/googleplay/android-developer/answer/13392821)
- [Posizione in background: quando serve la dichiarazione](https://support.google.com/googleplay/android-developer/answer/9799150)
- [Connessione Salute: requisiti di Google Play](https://support.google.com/googleplay/android-developer/answer/12991134)
- [Connessione Salute: conteggio dei passi del telefono](https://developer.android.com/health-and-fitness/health-connect/features/steps)
- [Roma Servizi per la Mobilità: dati aperti](https://romamobilita.it/it/tecnologie/open-data)

## Cartelle

```
src/core/       regole pure: mezzi, punteggio, medaglie, classifica e sfide, filtro GPS, metro, Connessione Salute
src/data/       la rete della metro di Roma
src/metro/      lettura della posizione per "Ho preso la metro"
src/tracking/   tragitto in corso: stato, sensori, bozza su disco
src/health/     lettura da Connessione Salute e importazione delle attività
src/social/     classifica, leghe e sfide: collegamento al server (e sorgente di esempio per le prove)
supabase/       istruzioni che creano tabelle e funzioni del server
src/storage/    storico dei tragitti e impostazioni, sul telefono
src/ui/         colori, caratteri, icone, mascotte, medaglie, componenti
src/app/        le schermate: Oggi, Nuovo tragitto, In corso, Riepilogo, Classifica, Medaglie, Riservatezza…
scripts/        la prova automatica su telefono simulato
.github/        la ricetta con cui GitHub costruisce, prova e pubblica l'app
```
