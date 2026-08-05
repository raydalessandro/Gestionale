# Checkpoint — Rotte del portale e inventario delle viste

Fino a oggi il portale si raggiungeva solo se conoscevi a memoria uno slug, e la
radice del dominio apriva il modulo di accesso di un gestionale. Questa consegna
piccola rende il progetto **guardabile**: una porta d'ingresso sensata e i modi
per tornare indietro. Non è una consegna di grafica — la landing vera per gli
ottici è un lavoro a parte.

## 1 · La radice

`app/page.tsx` (che faceva `redirect("/dashboard")`) è stato **sostituito** da
`app/(portale)/page.tsx`, servito dal gruppo di rotte del portale (font Limpidia,
robots index):

- **Con sessione** → `redirect("/dashboard")`, come prima.
- **Senza sessione** → una landing pubblica: il logotipo, una riga su cosa è
  Limpidia, e **«Sei un ottico? Accedi»** verso `/login`.

Volutamente scarna: **niente** elenco di negozi, ricerca per zona o cifre
inventate. L'aggregatore è spento per decisione, e una pagina che promette una
ricerca inesistente è peggio di una pagina scarna.

La radice è pubblica in `proxy.ts` come **corrispondenza esatta** (`/`), non
prefisso — un prefisso `/` aprirebbe tutta l'app. Vive nel nuovo array
`ROTTE_PUBBLICHE_ESATTE`, e la **guardia G13** è aggiornata di conseguenza,
deliberatamente. Un anonimo su `/dashboard` resta rimandato a `/login`.

> **Nota di rotta (corretta qui):** `/informativa` non era nella lista bianca del
> proxy — un anonimo che dal percorso di prenotazione apriva l'informativa
> privacy veniva rimbalzato su `/login`. Aggiunta a `ROTTE_PUBBLICHE`
> (deliberatamente, sotto G13). È un difetto di G7 chiuso qui.

## 2 · Tornare indietro

- Sul percorso di prenotazione, il collegamento «indietro» al passo 1 ora porta
  il **nome del negozio** (`‹ Ottica Aurora`), non un generico «Al negozio».
- In fondo alla pagina negozio, la firma limpidia ora **rimanda alla radice**
  (`limpidia.it`), piccola e monocromatica in nero — **mai in ambra**: sul
  materiale del negozio siamo ospiti.

## 3 · Metadati per la condivisione

La pagina negozio arricchisce la descrizione Open Graph con **città e servizi**
(`Ottica Aurora a … — Visita, Applicazione LAC.`), così l'anteprima su WhatsApp
— un canale vero — dice dove e cosa. **Senza immagine** per ora: è nei debiti
dichiarati, con scadenza «prima del primo negozio reale»
(`docs/agenti/TODO-ray.md §4`).

## 4 · Inventario delle viste (nell'anteprima)

**Portale, pubblico e anonimo** (`gestionale-git-portale-rotte-checkpoint-…vercel.app`)
- `/` — la landing pubblica (logo + «Sei un ottico? Accedi»).
- `/ottica/ottica-vista-demo` — negozio a insegna **scura** (#243447): testata,
  orari, servizi, slot liberi, firma limpidia.it.
- `/ottica/ottica-demo` — **Ottica Aurora**, insegna **chiara** (#F0E6D2).
- `/ottica/ottica-vista-demo/prenota?da=qr` — il percorso di prenotazione (5
  passi); l'invio scrive la richiesta (012/013 applicate).
- `/informativa` — l'informativa privacy (ora raggiungibile da anonimo).

**Gestionale, con accesso** (login richiesto)
- `/login` · `/dashboard` · `/agenda` · `/clienti` · e i moduli attivi
  (ordini, magazzino, cassa, richiami) dalla Sidebar.

**Non ancora esistente** (dillo, così non lo si cerca)
- La **vista dell'ottico sulle richieste** — l'inbox che mostra le prenotazioni
  `in_attesa` e dà i tasti accetta/rifiuta — arriva in **G8**. Oggi le richieste
  esistono nel DB e compaiono grezze in agenda (vedi fase G7-bis).

## 5 · Credenziali di Ottica Aurora

Inviate per il canale privato (chat), non scritte qui: il repository è pubblico.
Lo script `crea-negozio-demo.ts` non era mai stato lanciato su questo database —
il titolare Aurora è stato creato (email confermata, ruolo titolare su
`ottica-demo`). Servono a verificare che gli elenchi clienti dei due negozi
siano separati.

## Criterio di accettazione

Apro il dominio dell'anteprima dal telefono e trovo qualcosa di sensato invece
di un modulo di accesso; e ho in mano un elenco di indirizzi con scritto accanto
cosa dovrei vederci.
