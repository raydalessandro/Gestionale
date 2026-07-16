# Report — Agente Manuale Utente

*Checkpoint: Fasi 1–4 + interfasi 4b/4c/4d (v0.5.1).*

## Capitoli (`docs/manuale-utente/`)

Giro v0.5.1 — toccati sette file per le tre interfasi (4b anagrafiche, 4c
caparra in cassa, 4d consensi). Bottoni/campi citati alla lettera dalla UI
reale; gli errori della sezione "Se qualcosa non torna" presi dalle stringhe di
`lib/actions.ts` e dai componenti.

- **00 benvenuto** — riga di changelog v0.5.1; rafforzato D3 ("il tuo nome
  resta scritto su tutto quello che registri").
- **01 clienti** *(4b + 4d)* — form in 4 sezioni (Identità/Recapiti/Indirizzo/
  Privacy e note) con tutti i campi nuovi (secondo nome, tre telefoni,
  "Canale preferito", "Non contattare per promozioni", scala/appartamento,
  nazione, tutore legale); vitali in testata (età, badge "Tutore: <nome>",
  "Non contattare", recapito preferito evidenziato); consensi A6 — banner
  "Registra consensi" / "Salva consensi" con data retrodatabile, due righe
  leggibili "Marketing/Dati sanitari".
- **02 prescrizioni** *(4b + 4d)* — riga DNP (solo occhiali) e la sua stampa in
  busta; gate consenso dati sanitari alla prima prescrizione (spunta
  obbligatoria una sola volta).
- **04 buste** *(4c + D1)* — "Metodo della caparra" obbligatorio con acconto
  (creazione busta e "Conferma ordine"); "Tipo di garanzia" servizio/polizza;
  ricevuta caparra col metodo; consegna "Consegna e incassa" con Cassa attiva;
  sezione "Acconto e saldo" riscritta (scontrino non più "futuro").
- **05 magazzino** *(4b + B3 + D2)* — tipo "Occhiale da sole"; parametri
  montatura/sole (calibro/ponte/asta, colore codice+nome, materiale; calibro in
  lista); campo "Ricambio" LAC; nota B3 (LAC estetiche → Accessorio); citato il
  percorso "Consegna e incassa" tra gli scarichi automatici.
- **06 agenda e richiami** *(4b)* — "Non contattare" nasconde le proposte
  commerciali (accanto al consenso marketing) e mette il badge sulle operative;
  canale preferito precompilato in "Registra esito".
- **07 cassa** *(4c + B2 + C6)* — contanti attesi e chiusura con la stessa
  formula (caparre di oggi incluse col metodo); quattro contatori caparre
  (emesse/scontate/rese/incamerate) + riga "senza metodo registrato"; guardrail
  annullo (solo in giornata/pre-chiusura, vendita-da-ordine → reso); avviso
  riallineamento su giornata chiusa; garanzia servizio 22% / polizza esente in
  consegna; riscritta la frase B2 sulla tracciabilità (dispositivi medici
  detraibili anche in contanti). Nessuna nota transitoria "caparre di oggi come
  causale" da rimuovere: non era presente nel testo attuale.
- **90 FAQ** — nuove domande (registrare i consensi, contanti e detrazione DM,
  LAC estetiche, annullo vs reso) e ritocco delle esistenti (metodo caparra,
  scarti in chiusura, riallineamento su giornata chiusa).
- **99 glossario** — nuove voci (Canale preferito, Consenso dati sanitari, DNP,
  Garanzia tipo, Metodo della caparra, Non contattare, Occhiale da sole,
  Ricambio LAC, Tutore legale, Avvisato); aggiornate Aliquota, DM, Metodo di
  pagamento (B2), Proposta, Reso, Riallineamento; D4 chiarito ("avvisato" è
  un'annotazione, non uno stato).

Perimetro rispettato: niente stampa fiscale reale, invio Sistema TS, blocco
assicurazione/convenzioni (Fase 5), montatura-da-catalogo in busta (A7, mini-fase
a parte), enforcement ruoli.

## Incoerenze UI↔spec (segnalate, non corrette)

1. **03 ordini-lac fermo a v0.3.** Il capitolo LAC descrive ancora "Consegna"
   come passo finale e non cita "Consegna e incassa", che il codice offre anche
   per gli ordini LAC (`AzioniOrdine.tsx` → `LinkConsegnaIncassa` quando
   `incassaHref` è presente). Gap ereditato dalla Fase 4, fuori dalle tre
   interfasi di questo giro: da allineare al prossimo passaggio sul cap. 03.
2. ~~**Scheda cliente, riga "Dati sanitari".**~~ **NON è un bug.**
   `app/(app)/clienti/[id]/page.tsx` formatta la data con
   `fmtData(cliente.consenso_sanitario_il ?? cliente.consenso_dati_sanitari)`.
   L'agente temeva un booleano, ma `consenso_dati_sanitari` è a DB una
   `timestamptz` (verificato): il `??` restituisce sempre una stringa data o
   null, che `fmtData` gestisce. La 4d imposta comunque `consenso_sanitario_il`
   insieme al flag, atomicamente. Nessuna correzione necessaria.
3. **Doppio punto d'ingresso del consenso marketing.** In `ClienteForm` resta
   la spunta "Consenso marketing" nella sezione Privacy e note, mentre il banner
   `BannerConsensi` gestisce marketing+sanitario con data. Coerente con la spec
   (form alla creazione, banner come promemoria), ma al banco convivono due
   modi di dare lo stesso consenso: documentati entrambi, da confermare che non
   confonda.
4. *(Storiche, ancora valide)* Ingranaggio "Impostazioni" in `/cassa` solo
   icona senza etichetta; movimenti di cassa nel riquadro della home Cassa, non
   in rotta dedicata (entrambi coerenti con §3.2 Fase 4).

## Dubbi di merito per gli ottici

- I quattro contatori caparre (emesse/scontate/rese/incamerate) usano il
  vocabolario che usate voi a fine giornata? "Scontate" per le caparre scalate
  in consegna è chiaro?
- "Metodo della caparra" obbligatorio con l'acconto: rallenta il banco o è
  giusto così?
- Il "Tipo di garanzia" servizio/polizza copre i vostri casi reali (ERGO,
  Otticare…)? Il default "Servizio del negozio" è quello più frequente da voi?
- Il "Canale preferito" e la spunta "Non contattare" sono i comandi che vi
  aspettereste per gestire chi non vuole promozioni?
- La DNP in prescrizione: la registrate voi al banco o arriva già dal
  laboratorio? Vale la pena averla anche in busta stampata?
- Il ricambio LAC (giornaliere/quindicinali/mensili/trimestrali) copre tutti i
  vostri prodotti (trimestrali a parte, ci sono annuali/rigide)?
- Consenso dati sanitari alla prima prescrizione: la formulazione della spunta
  è adeguata per l'informativa che fate firmare?

Screenshot rinviati al freeze pre-MIDO (Fase 7).
