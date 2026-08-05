# Mappa del database — generata, non scritta

*Estratta il 2026-08-05 da un Postgres locale con schema + migrazioni fino a `020_bonifica.sql`.*
*Per rigenerarla: `bash scripts/db-locale.sh && python3 scripts/mappa-db.py`.*

## Le tabelle (30)

[_infra_migrazioni](#_infra_migrazioni) · [_riparazioni_dati](#_riparazioni_dati) · [ambiente](#ambiente) · [appuntamenti](#appuntamenti) · [aziende](#aziende) · [blocchi_slot](#blocchi_slot) · [chiusure](#chiusure) · [chiusure_cassa](#chiusure_cassa) · [clienti](#clienti) · [contatori](#contatori) · [fermi](#fermi) · [lista_attesa](#lista_attesa) · [metodi_pagamento](#metodi_pagamento) · [movimenti_cassa](#movimenti_cassa) · [movimenti_magazzino](#movimenti_magazzino) · [negozi_servizi](#negozi_servizi) · [orari_apertura](#orari_apertura) · [ordini_lac](#ordini_lac) · [ordini_occhiali](#ordini_occhiali) · [persone](#persone) · [persone_riferimento_registro](#persone_riferimento_registro) · [prenotazioni](#prenotazioni) · [prescrizioni](#prescrizioni) · [prodotti](#prodotti) · [resi](#resi) · [richiami](#richiami) · [risorse](#risorse) · [servizi](#servizi) · [utenti](#utenti) · [vendite](#vendite)

### _infra_migrazioni

- `nome` text **NOT NULL**
- `applied_at` timestamp with time zone **NOT NULL** · default now()

### _riparazioni_dati

- `chiave` text **NOT NULL**
- `quando` timestamp with time zone **NOT NULL** · default now()

### ambiente

- `nome` text **NOT NULL**

### appuntamenti

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid
- `utente_id` uuid
- `tipo` text **NOT NULL** · default 'controllo_vista'
- `inizio` timestamp with time zone **NOT NULL**
- `durata_minuti` integer **NOT NULL** · default 20
- `stato` text **NOT NULL** · default 'prenotato'
- `riferimento` text
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `fonte` text **NOT NULL** · default 'banco'
- `risorsa_id` uuid **NOT NULL**

  Vincoli:
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'import'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - ✓ stato = ANY (ARRAY['in_attesa'::text, 'prenotato'::text, 'completato'::text, 'mancato'::text, 'annullato'::text])
  - ✓ tipo = ANY (ARRAY['controllo_vista'::text, 'consegna'::text, 'ritiro_lac'::text, 'prima_applicazione_lac'::text, 'altro'::text])
  - ✓ (durata_minuti >= 5) AND (durata_minuti <= 240)
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (risorsa_id) → risorse(id)
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### aziende

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `slug` text **NOT NULL**
- `nome` text **NOT NULL**
- `ragione_sociale` text
- `partita_iva` text
- `email` text **NOT NULL**
- `telefono` text
- `indirizzo` text
- `citta` text
- `cap` text
- `provincia` text
- `brand` jsonb **NOT NULL** · default '{"accent": "#A67C42", "primary": "#1C…
- `logo_url` text
- `nome_pubblico` text
- `tagline` text
- `stato_abbonamento` text **NOT NULL** · default 'trial'
- `moduli_attivi` text[] **NOT NULL** · default ARRAY['dashboard', 'clienti', 'prescri…
- `data_scadenza` timestamp with time zone
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `portale_attivo` boolean **NOT NULL** · default false

  Vincoli:
  - ✓ stato_abbonamento = ANY (ARRAY['trial'::text, 'attivo'::text, 'sospeso'::text, 'cancellato'::text])
  - ⊙ UNIQUE (slug)

### blocchi_slot

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `inizio` timestamp with time zone **NOT NULL**
- `fine` timestamp with time zone **NOT NULL**
- `motivo` text

  Vincoli:
  - ✓ fine > inizio
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### chiusure

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `dal` date **NOT NULL**
- `al` date **NOT NULL**
- `motivo` text

  Vincoli:
  - ✓ al >= dal
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### chiusure_cassa

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `data` date **NOT NULL**
- `fondo_apertura` numeric(10,2) **NOT NULL**
- `contanti_contati` numeric(10,2) **NOT NULL**
- `fondo_chiusura` numeric(10,2) **NOT NULL**
- `versamento` numeric(10,2) · default (contanti_contati - fondo_chiusura)
- `z_numero` text
- `riepilogo` jsonb **NOT NULL** · default '{}'
- `note` text
- `chiusa_da` uuid
- `created_at` timestamp with time zone **NOT NULL** · default now()
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (chiusa_da) → utenti(id) ON DELETE SET NULL
  - ⊙ UNIQUE (azienda_id, data)

### clienti

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `nome` text **NOT NULL**
- `cognome` text **NOT NULL**
- `data_nascita` date
- `codice_fiscale` text
- `email` text
- `telefono` text
- `indirizzo` text
- `citta` text
- `cap` text
- `provincia` text
- `fonte` text **NOT NULL** · default 'banco'
- `consenso_marketing` boolean **NOT NULL** · default false
- `data_consenso` timestamp with time zone
- `note` text
- `tags` text[] **NOT NULL** · default '{}'[]
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `consenso_dati_sanitari` timestamp with time zone
- `secondo_nome` text
- `sesso` text
- `indirizzo2` text
- `nazione` text
- `telefono_casa` text
- `telefono_lavoro` text
- `lingua` text
- `tutore_legale` text
- `canale_preferito` text
- `non_contattare` boolean **NOT NULL** · default false
- `consenso_sanitario_il` timestamp with time zone

  Vincoli:
  - ✓ sesso = ANY (ARRAY['M'::text, 'F'::text])
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'import'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - ✓ canale_preferito = ANY (ARRAY['telefono'::text, 'whatsapp'::text, 'sms'::text, 'email'::text, 'cartaceo'::text])
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### contatori

- `azienda_id` uuid **NOT NULL**
- `chiave` text **NOT NULL**
- `valore` integer **NOT NULL** · default 0
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### fermi

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `prodotto_id` uuid **NOT NULL**
- `cliente_id` uuid **NOT NULL**
- `utente_id` uuid
- `quantita` integer **NOT NULL**
- `stato` text **NOT NULL** · default 'attivo'
- `scade_il` date
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ stato = ANY (ARRAY['attivo'::text, 'ritirato'::text, 'annullato'::text])
  - ✓ quantita > 0
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (prodotto_id) → prodotti(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE CASCADE

### lista_attesa

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `persona_id` uuid **NOT NULL**
- `azienda_id` uuid **NOT NULL**
- `servizio_codice` text **NOT NULL**
- `giorno_preferito` date
- `stato` text **NOT NULL** · default 'in_attesa'
- `created_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ stato = ANY (ARRAY['in_attesa'::text, 'avvisata'::text, 'chiusa'::text])
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (servizio_codice) → servizi(codice) ON DELETE RESTRICT
  - → (persona_id) → persone(id) ON DELETE CASCADE

### metodi_pagamento

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `nome` text **NOT NULL**
- `tipo` text **NOT NULL**
- `tracciabile` boolean **NOT NULL** · default true
- `attivo` boolean **NOT NULL** · default true
- `ordine` smallint **NOT NULL** · default 0
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ tipo = ANY (ARRAY['contanti'::text, 'elettronico'::text, 'buono'::text, 'bonifico'::text, 'assicurazione'::text, 'caparra'::text, 'altro'::text])
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - ⊙ UNIQUE (azienda_id, nome)

### movimenti_cassa

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `utente_id` uuid
- `tipo` text **NOT NULL**
- `importo` numeric(10,2) **NOT NULL**
- `motivo` text **NOT NULL**
- `riferimento` text
- `created_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ importo > (0)::numeric
  - ✓ tipo = ANY (ARRAY['prelievo'::text, 'spesa'::text, 'versamento_cassaforte'::text, 'versamento_banca'::text, 'incamero_caparra'::text])
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL

### movimenti_magazzino

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `prodotto_id` uuid **NOT NULL**
- `utente_id` uuid
- `tipo` text **NOT NULL**
- `quantita` integer **NOT NULL**
- `riferimento` text
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ tipo = ANY (ARRAY['carico'::text, 'scarico'::text, 'ordine_cliente'::text, 'rettifica'::text, 'reso_fornitore'::text, 'danno'::text, 'uso_interno'::text])
  - ✓ quantita <> 0
  - ✓ ((tipo = 'carico'::text) AND (quantita > 0)) OR ((tipo = 'rettifica'::text) AND (quantita <> 0)) OR ((tipo = ANY (ARRAY['scarico'::text, 'ordine_cliente'::text, 'reso_fornitore'::text, 'danno'::text, 'uso_interno'::text])) AND (quantita < 0))
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (prodotto_id) → prodotti(id) ON DELETE CASCADE
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### negozi_servizi

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `servizio_codice` text **NOT NULL**
- `durata_minuti` integer
- `attivo` boolean **NOT NULL** · default true
- `created_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ durata_minuti > 0
  - → (servizio_codice) → servizi(codice) ON DELETE RESTRICT
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - ⊙ UNIQUE (azienda_id, servizio_codice)

### orari_apertura

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `giorno` integer **NOT NULL**
- `apre` time without time zone **NOT NULL**
- `chiude` time without time zone **NOT NULL**

  Vincoli:
  - ✓ chiude > apre
  - ✓ (giorno >= 0) AND (giorno <= 6)
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### ordini_lac

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid
- `prescrizione_id` uuid
- `numero` text **NOT NULL**
- `fonte` text **NOT NULL** · default 'banco'
- `stato` text **NOT NULL** · default 'da_ordinare'
- `righe` jsonb **NOT NULL** · default '[]'::jsonb
- `totale` numeric(10,2) **NOT NULL** · default 0
- `acconto` numeric(10,2) **NOT NULL** · default 0
- `data_arrivo_prevista` date
- `data_consegna` timestamp with time zone
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `avvisato_il` timestamp with time zone

  Vincoli:
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - ✓ stato = ANY (ARRAY['da_ordinare'::text, 'ordinato'::text, 'arrivato'::text, 'consegnato'::text, 'annullato'::text])
  - → (prescrizione_id) → prescrizioni(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - ⊙ UNIQUE (azienda_id, numero)

### ordini_occhiali

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid
- `prescrizione_id` uuid
- `numero` text **NOT NULL**
- `fonte` text **NOT NULL** · default 'banco'
- `stato` text **NOT NULL** · default 'lavorazione'
- `montatura_marca` text
- `montatura_modello` text
- `montatura_colore` text
- `montatura_calibro` text
- `montatura_upc` text
- `prezzo_montatura` numeric(10,2) **NOT NULL** · default 0
- `lente_tipo` text
- `lente_materiale` text
- `lente_indice` text
- `trattamenti` text[] **NOT NULL** · default '{}'[]
- `prezzo_lenti` numeric(10,2) **NOT NULL** · default 0
- `od_dnp` numeric(4,1)
- `os_dnp` numeric(4,1)
- `od_altezza` numeric(4,1)
- `os_altezza` numeric(4,1)
- `garanzia` text
- `prezzo_extra` numeric(10,2) **NOT NULL** · default 0
- `sconto` numeric(10,2) **NOT NULL** · default 0
- `totale` numeric(10,2) **NOT NULL** · default 0
- `acconto` numeric(10,2) **NOT NULL** · default 0
- `saldo` numeric(10,2) · default (totale - acconto)
- `laboratorio` text
- `data_promessa` date
- `data_consegna` timestamp with time zone
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `tipo_lavoro` text **NOT NULL** · default 'occhiale_completo'
- `ispezionata_da` uuid
- `ispezionata_il` timestamp with time zone
- `avvisato_il` timestamp with time zone
- `caparra_incamerata_il` timestamp with time zone
- `acconto_metodo` text
- `acconto_incassato_il` timestamp with time zone
- `garanzia_tipo` text

  Vincoli:
  - ✓ lente_tipo = ANY (ARRAY['monofocale'::text, 'progressiva'::text, 'bifocale'::text, 'office'::text])
  - ✓ tipo_lavoro = ANY (ARRAY['occhiale_completo'::text, 'solo_lenti'::text, 'solo_montatura'::text, 'montatura_cliente'::text])
  - ✓ stato = ANY (ARRAY['preventivo'::text, 'lavorazione'::text, 'arrivata'::text, 'pronta'::text, 'consegnata'::text, 'annullata'::text])
  - ✓ garanzia_tipo = ANY (ARRAY['servizio'::text, 'polizza'::text])
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - → (prescrizione_id) → prescrizioni(id) ON DELETE SET NULL
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (ispezionata_da) → utenti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - ⊙ UNIQUE (azienda_id, numero)

### persone

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `telefono_grezzo` text **NOT NULL**
- `telefono_normalizzato` text · default normalizza_telefono(telefono_grezzo)
- `nome` text **NOT NULL**
- `email` text
- `auth_user_id` uuid
- `ottico_di_riferimento` uuid
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
  - → (auth_user_id) → auth.users(id) ON DELETE SET NULL
  - → (ottico_di_riferimento) → aziende(id) ON DELETE SET NULL
  - ⊙ UNIQUE (telefono_normalizzato)

### persone_riferimento_registro

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `persona_id` uuid **NOT NULL**
- `da_azienda_id` uuid
- `a_azienda_id` uuid **NOT NULL**
- `prenotazione_id` uuid
- `utente_id` uuid
- `quando` timestamp with time zone **NOT NULL** · default now()
  - → (a_azienda_id) → aziende(id) ON DELETE RESTRICT
  - → (persona_id) → persone(id) ON DELETE RESTRICT
  - → (da_azienda_id) → aziende(id) ON DELETE SET NULL
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (prenotazione_id) → prenotazioni(id) ON DELETE SET NULL

### prenotazioni

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `persona_id` uuid **NOT NULL**
- `cliente_id` uuid
- `appuntamento_id` uuid
- `servizio_codice` text **NOT NULL**
- `inizio` timestamp with time zone
- `durata_minuti` integer
- `stato` text **NOT NULL** · default 'in_attesa'
- `fonte` text **NOT NULL** · default 'portale'
- `per_conto_di` text
- `contatto_nome` text **NOT NULL**
- `contatto_telefono` text **NOT NULL**
- `contatto_email` text
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `codice` text
- `chiave_richiesta` text
- `informativa_accettata_at` timestamp with time zone

  Vincoli:
  - ✓ stato = ANY (ARRAY['in_attesa'::text, 'accettata'::text, 'rifiutata'::text, 'annullata'::text])
  - ✓ durata_minuti > 0
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'import'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - → (servizio_codice) → servizi(codice) ON DELETE RESTRICT
  - → (appuntamento_id) → appuntamenti(id) ON DELETE SET NULL
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (persona_id) → persone(id) ON DELETE RESTRICT
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### prescrizioni

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid **NOT NULL**
- `tipo` text **NOT NULL**
- `data_visita` date **NOT NULL** · default CURRENT_DATE
- `utente_id` uuid
- `origine` text **NOT NULL** · default 'interna'
- `esaminatore` text
- `uso` text
- `od_sfero` numeric(4,2)
- `od_cilindro` numeric(4,2)
- `od_asse` smallint
- `os_sfero` numeric(4,2)
- `os_cilindro` numeric(4,2)
- `os_asse` smallint
- `addizione` numeric(3,2)
- `od_prisma` numeric(4,2)
- `od_prisma_base` text
- `os_prisma` numeric(4,2)
- `os_prisma_base` text
- `od_raggio` numeric(4,2)
- `od_diametro` numeric(4,2)
- `os_raggio` numeric(4,2)
- `os_diametro` numeric(4,2)
- `validita_mesi` smallint **NOT NULL** · default 12
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `attiva` boolean **NOT NULL** · default true
- `od_dnp` numeric(4,1)
- `os_dnp` numeric(4,1)

  Vincoli:
  - ✓ tipo = ANY (ARRAY['occhiali'::text, 'lac'::text])
  - ✓ origine = ANY (ARRAY['interna'::text, 'esterna'::text, 'lenti_precedenti'::text])
  - ✓ (od_dnp IS NULL) OR ((od_dnp >= (20)::numeric) AND (od_dnp <= (45)::numeric))
  - ✓ (os_dnp IS NULL) OR ((os_dnp >= (20)::numeric) AND (os_dnp <= (45)::numeric))
  - ✓ os_prisma_base = ANY (ARRAY['alto'::text, 'basso'::text, 'nasale'::text, 'temporale'::text])
  - ✓ od_prisma_base = ANY (ARRAY['alto'::text, 'basso'::text, 'nasale'::text, 'temporale'::text])
  - ✓ (os_asse >= 0) AND (os_asse <= 180)
  - ✓ (od_asse >= 0) AND (od_asse <= 180)
  - ✓ uso = ANY (ARRAY['lontano'::text, 'vicino'::text, 'progressivo'::text, 'bifocale'::text, 'office'::text])
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### prodotti

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `tipo` text **NOT NULL**
- `marca` text
- `nome` text **NOT NULL**
- `descrizione` text
- `sku` text
- `prezzo` numeric(10,2) **NOT NULL** · default 0
- `visibile_sito` boolean **NOT NULL** · default false
- `attivo` boolean **NOT NULL** · default true
- `parametri` jsonb **NOT NULL** · default '{}'
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `giacenza` integer **NOT NULL** · default 0
- `scorta_minima` integer **NOT NULL** · default 0
- `costo` numeric(10,2)
- `fornitore` text
- `ricambio_giorni` integer

  Vincoli:
  - ✓ (ricambio_giorni IS NULL) OR (ricambio_giorni > 0)
  - ✓ tipo = ANY (ARRAY['lac'::text, 'soluzione'::text, 'montatura'::text, 'sole'::text, 'lente'::text, 'accessorio'::text, 'servizio'::text])
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### resi

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `vendita_id` uuid
- `cliente_id` uuid
- `utente_id` uuid
- `numero` text **NOT NULL**
- `tipo` text **NOT NULL**
- `causale` text **NOT NULL**
- `importo` numeric(10,2) **NOT NULL**
- `metodo_rimborso` text
- `righe` jsonb **NOT NULL** · default '[]'::jsonb
- `doc_numero` text
- `doc_data` date
- `doc_origine_numero` text
- `doc_origine_data` date
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
- `busta_id` uuid

  Vincoli:
  - ✓ causale = ANY (ARRAY['soddisfatti_rimborsati'::text, 'errore_checkup'::text, 'errore_ricetta'::text, 'mancato_adattamento_progressive'::text, 'modifica_wo'::text, 'insoddisfazione_estetica'::text, 'insoddisfazione_funzionalita'::text, 'difetto_fabbricazione'::text])
  - ✓ tipo = ANY (ARRAY['denaro'::text, 'gestionale'::text])
  - ✓ importo > (0)::numeric
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (busta_id) → ordini_occhiali(id) ON DELETE SET NULL
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (vendita_id) → vendite(id) ON DELETE SET NULL
  - ⊙ UNIQUE (azienda_id, numero)

### richiami

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid **NOT NULL**
- `utente_id` uuid
- `tipo` text **NOT NULL**
- `da_fare_il` date **NOT NULL** · default CURRENT_DATE
- `canale` text
- `esito` text
- `fatto_il` timestamp with time zone
- `riferimento` text
- `valore` numeric(10,2)
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ canale = ANY (ARRAY['telefono'::text, 'whatsapp'::text, 'sms'::text, 'email'::text, 'di_persona'::text])
  - ✓ esito = ANY (ARRAY['appuntamento_fissato'::text, 'richiamare'::text, 'non_risponde'::text, 'non_interessato'::text, 'gestito'::text])
  - ✓ tipo = ANY (ARRAY['controllo_vista'::text, 'lac_esaurimento'::text, 'ritiro_sollecito'::text, 'fermo_scadenza'::text, 'promessa_ritardo'::text, 'generico'::text])
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### risorse

- `id` uuid **NOT NULL** · default gen_random_uuid()
- `azienda_id` uuid **NOT NULL**
- `nome` text **NOT NULL**
- `ordine` integer **NOT NULL** · default 1
- `attiva` boolean **NOT NULL** · default true
- `created_at` timestamp with time zone **NOT NULL** · default now()
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### servizi

- `codice` text **NOT NULL**
- `etichetta` text **NOT NULL**
- `durata_predefinita_minuti` integer
- `ordine` integer **NOT NULL** · default 0
- `tipo` text **NOT NULL** · default 'appuntamento'

  Vincoli:
  - ✓ ((tipo = 'appuntamento'::text) AND (durata_predefinita_minuti IS NOT NULL) AND (durata_predefinita_minuti > 0)) OR ((tipo = 'richiesta'::text) AND (durata_predefinita_minuti IS NULL))
  - ✓ tipo = ANY (ARRAY['appuntamento'::text, 'richiesta'::text])
  - ✓ durata_predefinita_minuti > 0

### utenti

- `id` uuid **NOT NULL**
- `azienda_id` uuid **NOT NULL**
- `email` text **NOT NULL**
- `nome` text **NOT NULL**
- `ruolo` text **NOT NULL** · default 'addetto'
- `attivo` boolean **NOT NULL** · default true
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ ruolo = ANY (ARRAY['titolare'::text, 'responsabile'::text, 'ottico'::text, 'addetto'::text])
  - → (id) → auth.users(id) ON DELETE CASCADE
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - ⊙ UNIQUE (email)

### vendite

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `numero` text **NOT NULL**
- `cliente_id` uuid
- `utente_id` uuid
- `busta_id` uuid
- `ordine_lac_id` uuid
- `righe` jsonb **NOT NULL** · default '[]'::jsonb
- `pagamenti` jsonb **NOT NULL** · default '[]'::jsonb
- `totale` numeric(10,2) **NOT NULL**
- `iva_totale` numeric(10,2) **NOT NULL** · default 0
- `doc_numero` text
- `doc_data` date
- `fattura_numero` text
- `cf_cliente` text
- `opposizione_ts` boolean **NOT NULL** · default false
- `origine` text **NOT NULL** · default 'cassa'
- `data_vendita` timestamp with time zone **NOT NULL** · default now()
- `stato` text **NOT NULL** · default 'emessa'
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ totale >= (0)::numeric
  - ✓ origine = ANY (ARRAY['cassa'::text, 'riallineamento'::text])
  - ✓ stato = ANY (ARRAY['emessa'::text, 'annullata'::text])
  - → (ordine_lac_id) → ordini_lac(id) ON DELETE SET NULL
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (busta_id) → ordini_occhiali(id) ON DELETE SET NULL
  - ⊙ UNIQUE (azienda_id, numero)

## Le viste

- `chiusure_pubbliche`
- `negozi_pubblici`
- `orari_pubblici`
- `servizi_pubblici`

## Le funzioni (RPC)

- `applica_movimento_magazzino()` → trigger
- `appuntamento_intervallo(inizio timestamp with time zone, durata_minuti integer)` → tstzrange
- `assegna_sala_appuntamento()` → trigger · *security definer*
- `assicura_coerenza_tenant()` → trigger · *security definer*
- `blocca_modifica()` → trigger
- `cliente_per_telefono(p_telefono text)` → TABLE(id uuid, nome text, cognome text) · *security definer*
- `coerenza_negozio_servizio()` → trigger
- `coerenza_prenotazione_tipo()` → trigger
- `coerenza_registro_riferimento()` → trigger · *security definer*
- `crea_azienda_con_titolare(p_nome_azienda text, p_slug text, p_nome_utente text)` → uuid · *security definer*
- `crea_prenotazione(p_slug text, p_servizio text, p_inizio timestamp with time zone, p_nome text, p_telefono text, p_email text, p_per_conto_di text, p_note text, p_fonte text, p_chiave_richiesta text, p_lista_attesa boolean)` → TABLE(id uuid, codice text, inizio timestamp with time zone, durata_minuti integer) · *security definer*
- `crea_sala_default()` → trigger · *security definer*
- `diag_intervallo_immutabile()` → TABLE(volatile_immutabile boolean, corpo_minuti boolean) · *security definer*
- `diag_normalizza_telefono()` → TABLE(volatile_immutabile boolean, corpo_ok boolean) · *security definer*
- `get_azienda_id()` → uuid · *security definer*
- `normalizza_telefono(p text)` → text
- `prendi_persona_come_cliente(p_prenotazione_id uuid, p_cliente_id uuid)` → uuid · *security definer*
- `prossimo_numero(p_prefisso text)` → text · *security definer*
- `slot_liberi(p_slug text, p_servizio text, p_giorno date)` → SETOF timestamp with time zone · *security definer*
- `svuota_dati_di_test()` → void · *security definer*
- `tocca_updated_at()` → trigger

## I trigger

- `appuntamenti` ← `trg_appuntamenti_updated`
- `appuntamenti` ← `trg_sala_appuntamento`
- `appuntamenti` ← `trg_tenant`
- `aziende` ← `trg_aziende_updated`
- `aziende` ← `trg_sala_default`
- `chiusure_cassa` ← `trg_tenant`
- `clienti` ← `trg_clienti_updated`
- `fermi` ← `trg_fermi_updated`
- `fermi` ← `trg_tenant`
- `metodi_pagamento` ← `trg_metodi_updated`
- `movimenti_cassa` ← `trg_tenant`
- `movimenti_magazzino` ← `trg_movimenti_applica`
- `movimenti_magazzino` ← `trg_tenant`
- `negozi_servizi` ← `trg_coerenza_negozio_servizio`
- `ordini_lac` ← `trg_ordini_lac_updated`
- `ordini_lac` ← `trg_tenant`
- `ordini_occhiali` ← `trg_buste_updated`
- `ordini_occhiali` ← `trg_tenant`
- `persone_riferimento_registro` ← `trg_coerenza_registro`
- `persone_riferimento_registro` ← `trg_registro_append_only`
- `prenotazioni` ← `trg_coerenza_prenotazione_tipo`
- `prenotazioni` ← `trg_coerenza_prenotazioni`
- `prenotazioni` ← `trg_prenotazioni_no_delete`
- `prescrizioni` ← `trg_prescrizioni_updated`
- `prescrizioni` ← `trg_tenant`
- `prodotti` ← `trg_prodotti_updated`
- `resi` ← `trg_resi_updated`
- `resi` ← `trg_tenant`
- `richiami` ← `trg_richiami_updated`
- `richiami` ← `trg_tenant`
- `utenti` ← `trg_utenti_updated`
- `vendite` ← `trg_tenant`
- `vendite` ← `trg_vendite_updated`
