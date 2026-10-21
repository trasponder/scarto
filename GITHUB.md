# Portare SCARTO sul tuo GitHub

Puoi conservare e sviluppare il progetto nel tuo repository GitHub. Lo ZIP aggiornato include sorgenti, test, interfaccia compilata e server indipendente; non contiene la cartella `.git` del repository usato dal sito.

## Caricare il progetto

1. Crea su GitHub un repository vuoto, con la visibilità che preferisci. Non aggiungere un README iniziale: quello del gioco è già incluso.
2. Estrai lo ZIP. La cartella con `package.json`, `README.md`, `core`, `components` e `standalone` è la radice del progetto.
3. Carica il contenuto di quella cartella nel repository, senza limitarti a caricare lo ZIP come unico file. Puoi usare GitHub Desktop oppure Git.

Con Git, dalla radice estratta:

```sh
git init
git add .
git commit -m "Add SCARTO with AI difficulty levels"
git branch -M main
git remote add origin https://github.com/TUO_UTENTE/TUO_REPOSITORY.git
git push -u origin main
```

Sostituisci `TUO_UTENTE` e `TUO_REPOSITORY` con quelli del repository appena creato. Non devi eseguire questi comandi nel checkout del sito pubblicato: usa la copia estratta dallo ZIP.

Il manifest `.openai/hosting.json` esportato nello ZIP omette l’identità del sito originale. I sorgenti nel tuo repository saranno quindi indipendenti dalla pubblicazione Sites esistente. Caricare il codice su GitHub non modifica né aggiorna automaticamente quel sito.

## Avviare una copia clonata dal repository

Il `.gitignore` esclude gli asset compilati: la copia clonata va compilata una volta. Dalla radice, con Node.js 22.13+ e pnpm disponibili:

```sh
pnpm install --frozen-lockfile
pnpm build:game
pnpm start:game
```

Apri `http://localhost:3000`. Per controllare le meccaniche e la rete esegui `pnpm test:game`.

Nel pacchetto ZIP gli asset sono già compilati. Se vuoi solo giocare dalla copia estratta, puoi seguire la procedura breve `npm install` / `npm start` nella cartella `standalone`, come descritto nel README.

## Repository e sito giocabile

GitHub ospita i sorgenti. Per rendere il multiplayer accessibile su Internet occorre eseguire il server Node su un servizio raggiungibile dai giocatori. GitHub Pages ospita file statici e non esegue il server Node/WebSocket: da solo non offre il multiplayer di SCARTO.

La modalità CPU può essere distribuita come applicazione statica con un’apposita configurazione, ma questo pacchetto mantiene il gioco completo con il suo server. Non include un deployment GitHub Pages automatico.

Riferimenti ufficiali: [creare un repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository) e [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
