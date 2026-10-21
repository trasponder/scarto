# SCARTO

Un’arena tattica 1 contro 1. Ogni scatto lascia un’eco: due secondi dopo, la copia ripete l’attacco. Puoi scambiarti con lei una sola volta, conservando il conto alla rovescia e la direzione originale. Vince il primo a 5 round.

## Gioca subito con il progetto scaricato

Il pacchetto ZIP include già l’interfaccia compilata in `standalone/public`. Per giocare non serve compilare il progetto, né installare un motore grafico.

1. Installa Node.js 22.13 o successivo, se non è già presente.
2. Estrai tutto lo ZIP, mantenendo insieme le cartelle `core` e `standalone`.
3. Apri un terminale nella cartella `standalone` ed esegui:

```sh
npm install
npm start
```

4. Apri `http://localhost:3000` nel browser del computer che esegue il server.
5. Scegli **Sfida un amico** per creare una stanza, oppure **Allenati contro il computer**.

È necessario eseguire il server su un solo computer. Il secondo giocatore usa soltanto il browser.

## Due computer sulla stessa rete locale

Sul computer che avvia il server, trova il suo indirizzo IP di rete locale (per esempio con `ipconfig` su Windows). Entrambi i giocatori devono aprire `http://IP_DEL_SERVER:3000`. Il firewall deve consentire al server Node di ricevere connessioni sulla porta 3000.

Un giocatore crea la stanza; l’altro apre il link d’invito oppure sceglie **Entra in una stanza** e inserisce il codice di 6 caratteri. Il countdown parte quando sono presenti entrambi. Il link deve usare l’indirizzo raggiungibile dall’altro computer: `localhost` indica sempre il computer di chi lo apre.

## Giocare attraverso Internet

Due reti diverse richiedono un server Node pubblicamente raggiungibile. Esegui `standalone/server.mjs` su un servizio che supporti processi Node persistenti e WebSocket. Il server ascolta su `0.0.0.0`; legge `PORT` e `HOST` dall’ambiente (porta predefinita: 3000). Un eventuale proxy HTTPS deve inoltrare anche gli upgrade WebSocket su `/ws`. Il client sceglie automaticamente `wss` con HTTPS. Il codice stanza identifica una partita; da solo non rende raggiungibile un server che si trova in una rete privata.

La versione pubblicata con Sites usa invece un backend Worker/D1 e sincronizzazione HTTP reale. Il server calcola tutta la simulazione a 60 tick al secondo; i client inviano input e ricevono snapshot circa ogni 50 ms, compatibilmente con la latenza. Non è un WebSocket mascherato e non usa localStorage per comunicare fra giocatori. Il client interpola la visualizzazione senza modificare lo stato autorevole.

Il sito appena creato ha accesso privato. Un invitato deve avere anche accesso al sito: il solo codice stanza non aggira i permessi della piattaforma. Il pacchetto Node indipendente non richiede account ai giocatori.

## Difficoltà del computer

Prima di avviare l’allenamento puoi scegliere **Facile**, **Normale** o **Difficile**. La scelta viene ricordata su questo browser e rimane la stessa nella rivincita. Il livello iniziale è Normale.

- **Facile:** decisioni ogni 400 ms, mira meno precisa, schivate e scambi meno tempestivi.
- **Normale:** decisioni circa ogni 233 ms, precisione e anticipazione intermedie.
- **Difficile:** decisioni circa ogni 117 ms; conserva l’IA della prima versione.

Velocità, forza delle respinte, ricariche e ritardo dell’eco rimangono identici per tutti. Questi livelli descrivono il comportamento: non sono una garanzia che ogni singolo duello sia più facile o più difficile.

Per trasferire il progetto nel tuo repository consulta **GITHUB.md**. Dalla radice sono disponibili `pnpm build:game`, `pnpm start:game` e `pnpm test:game` per la versione indipendente.

## Comandi e regole

| Comando | Azione |
| --- | --- |
| WASD oppure frecce | Movimento, velocità diagonale normalizzata |
| Mouse | Direzione dello scatto |
| Spazio | Scatto; ricarica di 3 secondi |
| R | Scambio con l’eco in attesa; un solo utilizzo per eco |
| Esc | Pausa/ripresa nell’allenamento |

L’eco appare all’origine dello scatto. Si attiva esattamente 120 tick dopo la creazione, a 60 Hz. La linea tratteggiata e l’arco indicano traiettoria e conto alla rovescia. Scambiare sposta realmente entrambi: il personaggio va dove si trovava l’eco e l’eco va nella vecchia posizione del personaggio. L’eco conserva direzione e momento di attivazione.

L’uscita avviene quando il centro del personaggio supera il bordo di un raggio (il corpo ha lasciato il perimetro). Si può uscire anche muovendosi o scattando senza essere colpiti. Scatti simultanei si respingono a vicenda. In caso di doppia uscita nello stesso sottopasso non si assegna un punto. Tra i round si azzerano eco, velocità, scatti, ricariche e stordimenti. I comandi premuti durante il countdown non si accodano al via.

La rivincita online richiede il consenso di entrambi. Dopo 8 secondi senza heartbeat il server sospende la partita; se i due client tornano, riprende con un countdown. Uscire tramite il pulsante chiude la stanza. Ricaricare la pagina non recupera automaticamente il posto: occorre creare una nuova stanza. I dati delle stanze scadono dopo 3 ore di inattività; sul server Node sono in memoria e un riavvio li cancella.

## Architettura

- `core/engine.mjs`: simulazione deterministica, collisioni a due sottopassi, IA e parametri in `CONFIG`.
- `core/rooms.mjs`: stanze, sessioni, heartbeat, input sequenziali e rivincite.
- `core/renderer.mjs`: rendering Canvas, echi, traiettorie, effetti, adattamento della finestra senza deformare la fisica.
- `core/sound.mjs`: effetti originali sintetizzati con Web Audio, senza asset esterni.
- `components/Scarto.tsx`: schermate, comandi, HUD e ciclo client.
- `app/api/room/route.ts`: API autorevole Worker/D1; revisioni compare-and-swap impediscono di sovrascrivere input concorrenti.
- `standalone/server.mjs`: server Node HTTP/WebSocket con la stessa simulazione e gli stessi contratti.
- `standalone/public`: interfaccia compilata, pronta per essere servita dal server Node.
- `db/schema.ts`, `drizzle/`: schema e migrazione del backend ospitato.
- `tests/`: test di simulazione, stanze e due client WebSocket reali.

Sono configurabili velocità, durata dello scatto, forza della respinta, attrito, raggio, dimensioni dell’arena, ricarica, ritardo dell’eco e punteggio obiettivo. I tempi sono espressi in tick; `tickRate` rimane 60. Gli indicatori dell’interfaccia corrispondono alle regole 2 s/3 s del prototipo: se cambi quelle regole, aggiorna anche HUD e testi.

## Modificare l’interfaccia

Per lavorare sui sorgenti completi, dalla radice installa le dipendenze dichiarate in `package.json` usando pnpm. Il lockfile è `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
node standalone/build.mjs
```

Questo ricompila l’interfaccia indipendente in `standalone/public`. Avviala come descritto sopra. Per l’anteprima Worker/D1 e il deploy Sites, usa gli script e il manifest presenti nel progetto. Le migrazioni locali e quelle ospitate sono separate; non creare tabelle durante una richiesta.

## Verifiche

Dalla radice, dopo aver installato le dipendenze:

```sh
node --test tests/engine.test.mjs tests/rooms.test.mjs tests/difficulty.test.mjs tests/network.test.mjs
node node_modules/typescript/bin/tsc --noEmit
```

In alternativa, dopo `npm install` nella cartella `standalone`, esegui `npm test` da quella cartella. I test non hanno bisogno di un browser o di un database remoto.

Il test WebSocket avvia un server temporaneo e due connessioni indipendenti. Verifica stanze piene, token errati, attivazione dell’eco, scambio senza ripristino dei timer, snapshot identici, cinque round, consenso alla rivincita e uscita del rivale. Dura circa 25 secondi.

Il controllo HTTP opzionale `tests/http.integration.mjs` si esegue contro un server raggiungibile impostando `SCARTO_TEST_URL` sull’origine desiderata. Esegue due ingressi concorrenti e aggiornamenti simultanei; il supervisore di anteprima gestito non espone la porta al processo di test del terminale. La verifica Worker/D1 in questa consegna è stata svolta con due schede del browser.

## Stato e limiti

Le meccaniche richieste, il multiplayer reale e il computer sono implementati. La simulazione è autorevole sul server in entrambe le varianti. Nella variante ospitata l’HTTP introduce più latenza e carico delle connessioni WebSocket del pacchetto Node: è una soluzione da prototipo, senza una prova di carico su molti giocatori. Non c’è predizione locale né compensazione della latenza.

Le partite non hanno un limite di tempo: 3–5 minuti è un obiettivo di ritmo, non una durata garantita. Giocatori molto difensivi possono prolungarle. Non ci sono matchmaking, spettatori, account di gioco, classifiche o mappe aggiuntive. Il computer è deterministico, con reazione limitata; non è un modello addestrato. La qualità del bilanciamento e il divertimento richiedono partite fra persone: i test tecnici non li dimostrano.
