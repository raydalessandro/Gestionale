# Consegna · Design limpidia.it — modo di lavorare

Questo documento vale per ogni lavoro di design sulla repo `raydalessandro/Gestionale`. Diventerà il punto di ingresso fisso; per ora si legge all'inizio di ogni sessione.

**Regola sopra tutte: non si mergia mai su `main`.** Tu lasci rami pronti, la verifica e il merge li fa Ray. Sempre.

---

## 1 · Cosa possiedi

- `components/**` — tutti i componenti, del portale e del gestionale
- `public/**` — SVG, icone, immagini
- I token di colore e tipografia in `tailwind.config.ts` (**si aggiunge, non si modifica** quello che c'è)
- Le pagine di **solo contenuto**: home, come funziona, per gli ottici, condizioni

## 2 · Cosa non si tocca mai

- `supabase/**` — nessuna migrazione, nessuno schema. **Mai**, per nessun motivo
- `lib/**` — logica e letture dei dati
- `proxy.ts`, `app/layout.tsx`
- `app/(app)/**` a livello di **logica**: le pagine del gestionale si ristilizzano dai componenti, non riscrivendo le pagine
- `app/(portale)/ottica/[slug]/**` — la pagina negozio e il percorso di prenotazione **esistono, funzionano e sono collegati ai dati veri**. Si ristilizzano dai componenti. Non si riscrivono

Il prototipo `.tsx` è **riferimento visivo**, non sorgente. Dal prototipo si prende quello che nel repo non esiste; il resto è già stato costruito e collegato.

## 3 · I tre tipi di lavoro

**A · Design puro.** Componenti, SVG, token, ristilizzazione di pagine esistenti senza cambiare flussi. Ramo, preview, PR. È il caso più frequente e non richiede niente da noi.

**B · Pagine nuove di solo contenuto.** Home, come funziona, per gli ottici. Le scrivi tu per intero.

**C · Cose che hanno bisogno di dati.** Voci nuove, tabelle, campi che oggi non esistono, elenchi che vanno riempiti dal database.

Qui **non scrivi la migrazione e non tocchi `supabase/`**. Lasci nel ramo un documento in `docs/design/` che dice: cosa serve, dove va mostrato, che forma ha il dato, e un esempio. Noi verifichiamo se serve davvero una migrazione, la scriviamo, la applichiamo al database di test, facciamo girare la CI, e solo con la CI verde si va su `main`.

Se in una pagina ti serve un dato che non c'è, **mettilo con dati finti evidenti** e segnalalo nel documento. Non inventare tabelle.

## 4 · Il ramo

- Nome: `design/<cosa>` — per esempio `design/home`, `design/componenti-portale`
- Si parte sempre da `main` **aggiornato**. Mai da una copia vecchia
- **Un ramo per modulo.** Home, portale pubblico, agenda, clienti, ordini, magazzino, cassa: uno ciascuno. Dieci o quindici rami non sono un problema — anzi: ognuno si rivede in pochi minuti, mentre uno che tocca tutto resta fermo giorni
- Puoi lanciare la CI sul tuo ramo quando vuoi
- Puoi guardare le anteprime Vercel: ogni ramo ne genera una, non serve passare da `main`

## 5 · Cosa lasciare nel ramo

1. Il codice
2. Se ricade nel caso C, il documento in `docs/design/`
3. Nella descrizione della PR: **l'indirizzo dell'anteprima**, cosa hai cambiato, e cosa hai lasciato indietro di proposito

## 6 · Il commento di ritorno

Ogni ramo si apre con **un commento sulla PR** — non un file: così non intasa la repo e lo ritroviamo ripercorrendo i rami.

Due voci, separate.

**Scritta dall'agente IA**, in cinque righe:

- Cosa era chiaro e cosa ha dovuto indovinare
- Dove ha dovuto leggere codice esistente per capire una convenzione che nessuno aveva scritto
- Cosa ha lasciato indietro e perché
- Se qualcosa nella repo lo ha rallentato: struttura, nomi, file che non si capisce a cosa servono

**Scritta dalla persona**, altre cinque:

- Se la consegna era chiara o ambigua, e su cosa
- Cosa avrebbe voluto trovare già pronto
- Se il flusso — ramo, anteprima, CI, PR — è comodo o macchinoso, e dove
- Cosa cambierebbe nel modo di lavorare

Serve a una cosa sola: quando costruiremo l'agente fisso della repo, lo scriveremo **ripercorrendo questi commenti**, non a memoria. Ogni attrito segnalato adesso è una riga di istruzioni in meno da indovinare dopo.

Meglio un commento scomodo che uno gentile. Se una cosa è confusa, va scritto che è confusa.

---

## 7 · Paletti di modello

Non sono preferenze, sono vincoli del progetto.

1. **Nessuna classifica.** Niente «migliore corrispondenza», punteggi, posizioni sponsorizzate. Gli ottici in elenco si ordinano per città o alfabeticamente. Un ottico che sospetta una classifica non entra nella rete
2. **Nessun prezzo.** Non ci sono e non si promettono
3. **Il QR della vetrina porta sempre e solo sulla pagina di quel negozio**, mai su un elenco
4. **«Ottici vicino a me» oggi non esiste.** Non ci sono coordinate: si può fare l'elenco per città, non la ricerca per distanza. Non disegnare mappe con distanze
5. **Sul materiale di un negozio il marchio Limpidia è piccolo, in bianco o in nero, mai in ambra.** Lì siamo ospiti
6. **Contrasto verificato**: testo bianco su un colore almeno 4,5 a 1. Le insegne dei negozi possono essere chiarissime

## 8 · Prima di aprire la PR

- [ ] Parte da `main` aggiornato
- [ ] Nessun file in `supabase/` o `lib/` modificato
- [ ] L'anteprima si apre e si guarda **da telefono**
- [ ] Le pagine esistenti che hai ristilizzato fanno ancora le stesse cose
- [ ] I token esistenti non sono stati modificati, solo aggiunti
- [ ] Se serve un dato che non c'è, c'è il documento in `docs/design/`
- [ ] C'è il commento di ritorno, entrambe le voci

---

## In sintesi

Tu produci lavoro finito, non specifiche. Noi verifichiamo, facciamo la parte database se serve, e mergiamo. Tu hai libertà completa dentro il perimetro; fuori dal perimetro **si scrive un documento, non si scrive codice**.
