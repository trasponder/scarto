# SCARTO — Relazione di consegna

21 ottobre 2026. Aggiornamento 1.1: tre difficoltà CPU e istruzioni GitHub. Prototipo giocabile per browser desktop, con sorgenti modificabili.

## Realizzato

- Arena 2D, movimento, mira col mouse, scatto con respinta, ricarica di 3 secondi.
- Eco visibile a entrambi, traiettoria e countdown; attivazione esattamente dopo 2 secondi di simulazione.
- Scambio reale di posizione una sola volta per eco, senza cambiare direzione, momento di attivazione o ricarica dello scatto.
- Collisioni a sottopassi, respinte, uscite, doppia uscita senza punto, reset dei round e vittoria a 5.
- Stanze private a codice/link, due giocatori reali, punteggio e stati condivisi, attesa e gestione dell’uscita, rivincita con due voti.
- Simulazione autorevole sul server: backend Worker/D1 per il sito; server Node/WebSocket per l’esecuzione indipendente.
- Selezione Facile / Normale / Difficile prima dell’allenamento, preferenza ricordata e livello indicato in partita. Difficile conserva il comportamento precedente; le regole fisiche restano uguali per tutti.
- Avversario CPU con posizionamento, attacchi, schivate delle traiettorie, attenzione ai bordi e utilizzo dello scambio.
- Interfaccia in italiano, effetti Canvas e audio sintetizzato, mute, istruzioni, pausa dell’allenamento e schermo intero.

## Verifiche superate

34 test automatici su fisica, tempi, scambio, sicurezza delle sessioni, ordine degli input, gestione delle stanze e rete. Nessun test fallito. Il test di rete usa un server Node in ascolto e due connessioni WebSocket indipendenti: completa 5 round, confronta centinaia di snapshot identici, verifica eco e scambio, esegue la rivincita e chiude la stanza. Il risultato integrale è in `TEST-RESULTS.txt`.

Verificata anche la distribuzione indipendente: pagina e asset compilati restituiti dal server Node, due ingressi concorrenti, 24 aggiornamenti simultanei con revisioni distinte, rifiuto delle sessioni errate e dei payload malformati, propagazione della chiusura.

Controllo TypeScript senza errori. Compilazione dell’interfaccia indipendente riuscita. Compilazione Worker/Vinext riuscita durante lo sviluppo; l’archivio di pubblicazione viene ricompilato dal medesimo stato dei sorgenti.

Nell’aggiornamento è stato verificato che Difficile mantiene lo stato e gli input precedenti su 12.000 tick. Nel browser sono stati controllati selezione Facile / Normale / Difficile, indicazione del livello durante il duello e memorizzazione dopo il ricaricamento.

Nel browser sono stati verificati schermata iniziale, avvio contro CPU, ingresso di due schede nella stessa stanza Worker/D1, countdown, comandi, uscita dal perimetro, punto assegnato a entrambi, avvio del round successivo e messaggio al giocatore rimasto quando il rivale esce. L’anteprima è stata controllata visivamente su una finestra desktop. Non è stata effettuata una prova con due persone fisicamente su due reti Internet distinte né una prova di carico.

## Limiti dichiarati

La versione Sites appena creata è privata: l’invitato deve essere autorizzato ad aprire anche il sito. La versione indipendente Node non richiede account di gioco. Per utilizzarla da reti diverse occorre un server raggiungibile da Internet; il README distingue questa situazione dalla LAN.

La variante Sites usa sincronizzazione HTTP con intervallo nominale di 50 ms, soggetto alla latenza. La variante Node usa WebSocket. Entrambe mantengono l’autorità sul server, ma non includono predizione locale né compensazione della latenza. Non sono state fatte promesse sulle prestazioni con molte stanze simultanee.

Ricaricare la pagina non ripristina il posto nella stanza. Un’interruzione temporanea della connessione può recuperarsi; la chiusura esplicita della stanza richiede invece una nuova partita. Il server Node conserva le stanze in memoria e un riavvio le elimina.

3–5 minuti è una durata desiderata, non un limite imposto. Non sono aggiunti timer di morte improvvisa, mappe alternative, account, classifiche o matchmaking. Le meccaniche fondamentali richieste sono conservate; sono esplicitate soltanto le regole di parità e degli scatti simultanei. Il bilanciamento numerico è iniziale e il divertimento richiede playtesting umano.

## Passi successivi utili

Provare il gioco con due persone e osservare durata dei round, frequenza di utilizzo dello scambio e facilità di recuperare dopo una respinta. Da questi risultati regolare forza, attrito e dimensione dell’arena. Per un servizio aperto a molti giocatori, privilegiare il server WebSocket e aggiungere misurazioni di latenza e gestione della riconnessione dopo un ricaricamento.
