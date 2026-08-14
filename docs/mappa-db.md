# Mappa del database — generata, non scritta

*Estratta il 2026-08-14 da un Postgres locale con schema + migrazioni fino a `026_catalogo_magazzino_correzioni.sql`.*
*Per rigenerarla: `bash scripts/db-locale.sh && python3 scripts/mappa-db.py`.*

## Le tabelle (41)

[_infra_migrazioni](#_infra_migrazioni) · [_riparazioni_dati](#_riparazioni_dati) · [ambiente](#ambiente) · [appuntamenti](#appuntamenti) · [assicurazioni](#assicurazioni) · [aziende](#aziende) · [blocchi_slot](#blocchi_slot) · [bolle_attese](#bolle_attese) · [bolle_attese_righe](#bolle_attese_righe) · [causali_magazzino](#causali_magazzino) · [chiusure](#chiusure) · [chiusure_cassa](#chiusure_cassa) · [clienti](#clienti) · [clienti_relazioni](#clienti_relazioni) · [consensi](#consensi) · [contatori](#contatori) · [fermi](#fermi) · [lac_modelli](#lac_modelli) · [lista_attesa](#lista_attesa) · [metodi_pagamento](#metodi_pagamento) · [movimenti_cassa](#movimenti_cassa) · [movimenti_magazzino](#movimenti_magazzino) · [negozi_servizi](#negozi_servizi) · [oculisti](#oculisti) · [orari_apertura](#orari_apertura) · [ordini_lac](#ordini_lac) · [ordini_occhiali](#ordini_occhiali) · [parametri](#parametri) · [persone](#persone) · [persone_riferimento_registro](#persone_riferimento_registro) · [pratiche_difetto](#pratiche_difetto) · [prenotazioni](#prenotazioni) · [prescrizioni](#prescrizioni) · [prescrizioni_lac](#prescrizioni_lac) · [prodotti](#prodotti) · [resi](#resi) · [richiami](#richiami) · [risorse](#risorse) · [servizi](#servizi) · [utenti](#utenti) · [vendite](#vendite)

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
  - ✓ tipo = ANY (ARRAY['controllo_vista'::text, 'consegna'::text, 'ritiro_lac'::text, 'prima_applicazione_lac'::text, 'altro'::text])
  - ✓ (durata_minuti >= 5) AND (durata_minuti <= 240)
  - ✓ stato = ANY (ARRAY['in_attesa'::text, 'prenotato'::text, 'completato'::text, 'mancato'::text, 'annullato'::text])
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (risorsa_id) → risorse(id)
  - → (utente_id) → utenti(id) ON DELETE SET NULL

### assicurazioni

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `nome` text **NOT NULL**
- `attivo` boolean **NOT NULL** · default true
  - ⊙ UNIQUE (nome)

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

### bolle_attese

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `fornitore` text **NOT NULL**
- `origine_busta_id` uuid
- `origine_lac_id` uuid
- `riferimento_interno` text
- `numero_bolla` text
- `lettera_vettura` text
- `stato` text **NOT NULL** · default 'attesa'
- `note` text
- `chiusa_il` timestamp with time zone
- `chiusura_nota` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ (chiusa_il IS NULL) = (chiusura_nota IS NULL)
  - ✓ NOT ((origine_busta_id IS NOT NULL) AND (origine_lac_id IS NOT NULL))
  - ✓ stato = ANY (ARRAY['attesa'::text, 'caricata'::text, 'annullata'::text])
  - → (origine_busta_id) → ordini_occhiali(id) ON DELETE SET NULL
  - → (origine_lac_id) → ordini_lac(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### bolle_attese_righe

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `bolla_id` uuid **NOT NULL**
- `prodotto_id` uuid
- `descrizione` text **NOT NULL**
- `upc` text
- `q_attesa` integer **NOT NULL**
- `q_caricata` integer **NOT NULL** · default 0
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ q_caricata >= 0
  - ✓ q_attesa > 0
  - → (bolla_id) → bolle_attese(id) ON DELETE CASCADE
  - → (prodotto_id) → prodotti(id) ON DELETE SET NULL

### causali_magazzino

- `codice` text **NOT NULL**
- `descrizione` text **NOT NULL**
- `recupera_costo` boolean **NOT NULL**
- `attiva` boolean **NOT NULL** · default true
- `created_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ (codice = lower(codice)) AND (codice ~ '^[a-z0-9_]+$'::text)

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
- `assicurazione_id` uuid
- `azienda_convenzionata_id` uuid
- `dati_fatturazione` jsonb
- `consenso_canali` text[]
- `anonimizzato_il` timestamp with time zone

  Vincoli:
  - ✓ canale_preferito = ANY (ARRAY['telefono'::text, 'whatsapp'::text, 'sms'::text, 'email'::text, 'cartaceo'::text])
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'import'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - ✓ sesso = ANY (ARRAY['M'::text, 'F'::text])
  - → (azienda_convenzionata_id) → clienti(id) ON DELETE SET NULL
  - → (assicurazione_id) → assicurazioni(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### clienti_relazioni

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid **NOT NULL**
- `relativo_id` uuid **NOT NULL**
- `tipo` text **NOT NULL**
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ cliente_id <> relativo_id
  - ✓ tipo = ANY (ARRAY['tutore_legale'::text, 'padre'::text, 'madre'::text, 'figlio'::text, 'fratello'::text, 'sorella'::text])
  - → (relativo_id) → clienti(id) ON DELETE CASCADE
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - ⊙ UNIQUE (cliente_id, relativo_id, tipo)

### consensi

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `cliente_id` uuid **NOT NULL**
- `tipo` text **NOT NULL**
- `prescrizione_id` uuid
- `azione` text **NOT NULL**
- `canali` text[]
- `modalita` text
- `versione_informativa` text
- `documento_ref` uuid
- `utente_id` uuid
- `avvenuto_il` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ modalita = ANY (ARRAY['penna'::text, 'digitale'::text])
  - ✓ azione = ANY (ARRAY['dato'::text, 'revocato'::text])
  - ✓ (NOT ((azione = 'dato'::text) AND (tipo = 'marketing'::text))) OR ((canali IS NOT NULL) AND (cardinality(canali) >= 1) AND (canali <@ ARRAY['email'::text, 'cellulare'::text, 'cartaceo'::text]) AND (modalita IS NOT NULL))
  - ✓ (tipo <> 'marketing'::text) OR (prescrizione_id IS NULL)
  - ✓ (tipo <> 'dati_sanitari'::text) OR ((prescrizione_id IS NOT NULL) AND (canali IS NULL))
  - ✓ (azione <> 'revocato'::text) OR (canali IS NULL)
  - ✓ tipo = ANY (ARRAY['marketing'::text, 'dati_sanitari'::text])
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (prescrizione_id) → prescrizioni(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE CASCADE

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
  - ✓ quantita > 0
  - ✓ stato = ANY (ARRAY['attivo'::text, 'ritirato'::text, 'annullato'::text])
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (prodotto_id) → prodotti(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL

### lac_modelli

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `fornitore` text **NOT NULL**
- `nome` text **NOT NULL**
- `tipologia` text **NOT NULL**
- `sottotipo` text
- `geometria` text
- `durata` text **NOT NULL**
- `pezzi_per_confezione` integer **NOT NULL** · default 1
- `bc_disponibili` numeric[] **NOT NULL** · default '{}'::numeric[]
- `dia_disponibili` numeric[] **NOT NULL** · default '{}'::numeric[]
- `parametri_schema` jsonb **NOT NULL** · default '{}'
- `producibilita` jsonb **NOT NULL** · default '{}'
- `upc_mappa` jsonb **NOT NULL** · default '{}'
- `campioni` boolean **NOT NULL** · default false
- `attivo` boolean **NOT NULL** · default true
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ pezzi_per_confezione > 0
  - ✓ durata = ANY (ARRAY['giornaliera'::text, 'quindicinale'::text, 'mensile'::text, 'trimestrale'::text, 'semestrale'::text, 'annuale'::text, 'convenzionale'::text])
  - ✓ (sottotipo IS NULL) OR (sottotipo = ANY (ARRAY['sclerale'::text, 'ortocheratologia'::text, 'cheratocono'::text, 'ibrida'::text, 'altro'::text]))
  - ✓ tipologia = ANY (ARRAY['monofocale'::text, 'multifocale'::text, 'rigida'::text, 'semirigida'::text, 'specialistica'::text])
  - ✓ (geometria IS NULL) OR (geometria = ANY (ARRAY['sferica'::text, 'torica'::text]))
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - ⊙ UNIQUE (azienda_id, fornitore, nome)

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
  - → (persona_id) → persone(id) ON DELETE CASCADE
  - → (servizio_codice) → servizi(codice) ON DELETE RESTRICT

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
  - ✓ tipo = ANY (ARRAY['prelievo'::text, 'spesa'::text, 'versamento_cassaforte'::text, 'versamento_banca'::text, 'incamero_caparra'::text])
  - ✓ importo > (0)::numeric
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

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
- `causale_codice` text
- `valore_costo` numeric(12,2)
- `valore_prezzo` numeric(12,2)

  Vincoli:
  - ✓ tipo = ANY (ARRAY['carico'::text, 'scarico'::text, 'ordine_cliente'::text, 'rettifica'::text, 'reso_fornitore'::text, 'danno'::text, 'uso_interno'::text])
  - ✓ CHECK (((valore_costo IS NULL) OR (valore_costo >= (0)::numeric))) NOT VALID
  - ✓ CHECK (((causale_codice IS NULL) OR (tipo = ANY (ARRAY['scarico'::text, 'rettifica'::text, 'reso_fornitore'::text, 'danno'::text, 'uso_interno'::text])))) NOT VALID
  - ✓ ((tipo = 'carico'::text) AND (quantita > 0)) OR ((tipo = 'rettifica'::text) AND (quantita <> 0)) OR ((tipo = ANY (ARRAY['scarico'::text, 'ordine_cliente'::text, 'reso_fornitore'::text, 'danno'::text, 'uso_interno'::text])) AND (quantita < 0))
  - ✓ CHECK (((valore_prezzo IS NULL) OR (valore_prezzo >= (0)::numeric))) NOT VALID
  - ✓ quantita <> 0
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (prodotto_id) → prodotti(id) ON DELETE CASCADE
  - → (causale_codice) → causali_magazzino(codice)

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

### oculisti

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `nome` text **NOT NULL**
- `studio` text
- `citta` text
- `note` text
- `attivo` boolean **NOT NULL** · default true
- `created_at` timestamp with time zone **NOT NULL** · default now()
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

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
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - ✓ garanzia_tipo = ANY (ARRAY['servizio'::text, 'polizza'::text])
  - ✓ lente_tipo = ANY (ARRAY['monofocale'::text, 'progressiva'::text, 'bifocale'::text, 'office'::text])
  - ✓ stato = ANY (ARRAY['preventivo'::text, 'lavorazione'::text, 'arrivata'::text, 'pronta'::text, 'consegnata'::text, 'annullata'::text])
  - ✓ tipo_lavoro = ANY (ARRAY['occhiale_completo'::text, 'solo_lenti'::text, 'solo_montatura'::text, 'montatura_cliente'::text])
  - → (ispezionata_da) → utenti(id) ON DELETE SET NULL
  - → (prescrizione_id) → prescrizioni(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - ⊙ UNIQUE (azienda_id, numero)

### parametri

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `chiave` text **NOT NULL**
- `valore` jsonb **NOT NULL**
- `updated_at` timestamp with time zone **NOT NULL** · default now()
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - ⊙ UNIQUE (azienda_id, chiave)

### persone

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `telefono_grezzo` text
- `telefono_normalizzato` text · default normalizza_telefono(telefono_grezzo)
- `nome` text **NOT NULL**
- `email` text
- `auth_user_id` uuid
- `ottico_di_riferimento` uuid
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()
  - → (ottico_di_riferimento) → aziende(id) ON DELETE SET NULL
  - → (auth_user_id) → auth.users(id) ON DELETE SET NULL

### persone_riferimento_registro

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `persona_id` uuid **NOT NULL**
- `da_azienda_id` uuid
- `a_azienda_id` uuid **NOT NULL**
- `prenotazione_id` uuid
- `utente_id` uuid
- `quando` timestamp with time zone **NOT NULL** · default now()
  - → (persona_id) → persone(id) ON DELETE RESTRICT
  - → (da_azienda_id) → aziende(id) ON DELETE SET NULL
  - → (a_azienda_id) → aziende(id) ON DELETE RESTRICT
  - → (prenotazione_id) → prenotazioni(id) ON DELETE SET NULL
  - → (utente_id) → utenti(id) ON DELETE SET NULL

### pratiche_difetto

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `prodotto_id` uuid
- `cliente_id` uuid
- `origine_busta_id` uuid
- `fornitore` text **NOT NULL**
- `upc` text
- `riferimento_busta` text
- `proprieta` text **NOT NULL**
- `descrizione` text **NOT NULL**
- `foto_refs` text[] **NOT NULL** · default '{}'[]
- `stato` text **NOT NULL** · default 'aperta'
- `esito` text
- `accordi_note` text
- `aperta_il` timestamp with time zone **NOT NULL** · default now()
- `chiusa_il` timestamp with time zone
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ proprieta = ANY (ARRAY['cliente'::text, 'esposizione'::text])
  - ✓ stato = ANY (ARRAY['aperta'::text, 'riconosciuta'::text, 'respinta'::text, 'chiusa'::text])
  - ✓ (esito IS NULL) OR (stato = ANY (ARRAY['riconosciuta'::text, 'respinta'::text, 'chiusa'::text]))
  - ✓ (stato = 'chiusa'::text) = (chiusa_il IS NOT NULL)
  - ✓ (esito IS NULL) OR (esito = ANY (ARRAY['sostituzione'::text, 'rimborso'::text, 'respinto'::text]))
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (origine_busta_id) → ordini_occhiali(id) ON DELETE SET NULL
  - → (prodotto_id) → prodotti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE

### prenotazioni

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `persona_id` uuid
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
  - ✓ fonte = ANY (ARRAY['banco'::text, 'app'::text, 'convenzione'::text, 'import'::text, 'qr_vetrina'::text, 'sito_negozio'::text, 'portale'::text])
  - ✓ durata_minuti > 0
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (persona_id) → persone(id) ON DELETE RESTRICT
  - → (servizio_codice) → servizi(codice) ON DELETE RESTRICT
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (appuntamento_id) → appuntamenti(id) ON DELETE SET NULL

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
- `ha_occhiali` boolean **NOT NULL** · default false
- `ha_lac` boolean **NOT NULL** · default false
- `plano` boolean **NOT NULL** · default false
- `data_scadenza` date
- `scadenza_modificata` boolean **NOT NULL** · default false
- `oculista_id` uuid
- `derivata_da` uuid
- `tipologia_od` text
- `tipologia_os` text
- `od_add` numeric(4,2)
- `os_add` numeric(4,2)
- `od_visus` text
- `os_visus` text
- `notazione` text
- `speciali` text[] **NOT NULL** · default '{}'[]
- `speciali_note` text
- `od_invariato` boolean **NOT NULL** · default false
- `os_invariato` boolean **NOT NULL** · default false
- `appaiamento` boolean **NOT NULL** · default false

  Vincoli:
  - ✓ (od_asse >= 0) AND (od_asse <= 180)
  - ✓ (od_dnp IS NULL) OR ((od_dnp >= (20)::numeric) AND (od_dnp <= (45)::numeric))
  - ✓ (os_dnp IS NULL) OR ((os_dnp >= (20)::numeric) AND (os_dnp <= (45)::numeric))
  - ✓ origine = ANY (ARRAY['interna'::text, 'esterna'::text, 'lenti_precedenti'::text, 'check_up'::text, 'lenti_cliente'::text, 'ricetta_oculistica'::text, 'prescrizione_precedente'::text])
  - ✓ (uso IS NULL) OR (uso = ANY (ARRAY['lontano'::text, 'vicino'::text, 'progressivo'::text, 'bifocale'::text, 'office'::text, 'intermedio'::text, 'progressiva'::text, 'trifocale'::text, 'mista'::text]))
  - ✓ (od_prisma_base IS NULL) OR (od_prisma_base = ANY (ARRAY['alto'::text, 'basso'::text, 'nasale'::text, 'temporale'::text, 'interna'::text, 'esterna'::text, 'superiore'::text, 'inferiore'::text]))
  - ✓ (os_prisma_base IS NULL) OR (os_prisma_base = ANY (ARRAY['alto'::text, 'basso'::text, 'nasale'::text, 'temporale'::text, 'interna'::text, 'esterna'::text, 'superiore'::text, 'inferiore'::text]))
  - ✓ CHECK ((((tipologia_od IS NULL) OR (tipologia_od = ANY (ARRAY['lontano'::text, 'vicino'::text, 'intermedio'::text, 'bifocale'::text, 'progressiva'::text, 'office'::text, 'trifocale'::text]))) AND ((tipologia_os IS NULL) OR (tipologia_os = ANY (ARRAY['lontano'::text, 'vicino'::text, 'intermedio'::text, 'bifocale'::text, 'progressiva'::text, 'office'::text, 'trifocale'::text]))))) NOT VALID
  - ✓ CHECK (((od_prisma IS NULL) = (od_prisma_base IS NULL))) NOT VALID
  - ✓ CHECK (((os_prisma IS NULL) = (os_prisma_base IS NULL))) NOT VALID
  - ✓ CHECK (((notazione IS NULL) OR (notazione = ANY (ARRAY['tabo'::text, 'internazionale'::text])))) NOT VALID
  - ✓ (os_asse >= 0) AND (os_asse <= 180)
  - ✓ tipo = ANY (ARRAY['occhiali'::text, 'lac'::text])
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (derivata_da) → prescrizioni(id) ON DELETE SET NULL
  - → (oculista_id) → oculisti(id) ON DELETE SET NULL

### prescrizioni_lac

- `id` uuid **NOT NULL** · default uuid_generate_v4()
- `azienda_id` uuid **NOT NULL**
- `prescrizione_id` uuid **NOT NULL**
- `occhio` text **NOT NULL**
- `tipologia` text **NOT NULL**
- `sottotipo` text
- `geometria` text
- `fornitore` text
- `modello` text
- `prodotto_id` uuid
- `sfero` numeric(4,2)
- `cilindro` numeric(4,2)
- `asse` smallint
- `addizione` numeric(4,2)
- `bc` numeric(4,2)
- `dia` numeric(4,2)
- `extra` jsonb **NOT NULL** · default '{}'
- `visus` text **NOT NULL**
- `dominante` boolean **NOT NULL** · default false
- `note` text
- `created_at` timestamp with time zone **NOT NULL** · default now()
- `updated_at` timestamp with time zone **NOT NULL** · default now()

  Vincoli:
  - ✓ (sottotipo IS NULL) OR (sottotipo = ANY (ARRAY['sclerale'::text, 'ortocheratologia'::text, 'cheratocono'::text, 'ibrida'::text, 'altro'::text]))
  - ✓ tipologia = ANY (ARRAY['monofocale'::text, 'multifocale'::text, 'rigida'::text, 'semirigida'::text, 'specialistica'::text])
  - ✓ occhio = ANY (ARRAY['od'::text, 'os'::text])
  - ✓ (geometria IS NULL) OR (geometria = ANY (ARRAY['sferica'::text, 'torica'::text]))
  - ✓ (asse IS NULL) OR ((asse >= 0) AND (asse <= 180))
  - → (prescrizione_id) → prescrizioni(id) ON DELETE CASCADE
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (prodotto_id) → prodotti(id) ON DELETE SET NULL
  - ⊙ UNIQUE (prescrizione_id, occhio)

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
- `modello_id` uuid

  Vincoli:
  - ✓ tipo = ANY (ARRAY['lac'::text, 'soluzione'::text, 'montatura'::text, 'sole'::text, 'lente'::text, 'accessorio'::text, 'servizio'::text])
  - ✓ (ricambio_giorni IS NULL) OR (ricambio_giorni > 0)
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (modello_id) → lac_modelli(id) ON DELETE SET NULL

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
  - ✓ tipo = ANY (ARRAY['denaro'::text, 'gestionale'::text])
  - ✓ importo > (0)::numeric
  - ✓ causale = ANY (ARRAY['soddisfatti_rimborsati'::text, 'errore_checkup'::text, 'errore_ricetta'::text, 'mancato_adattamento_progressive'::text, 'modifica_wo'::text, 'insoddisfazione_estetica'::text, 'insoddisfazione_funzionalita'::text, 'difetto_fabbricazione'::text])
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (busta_id) → ordini_occhiali(id) ON DELETE SET NULL
  - → (vendita_id) → vendite(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
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
  - ✓ tipo = ANY (ARRAY['controllo_vista'::text, 'lac_esaurimento'::text, 'ritiro_sollecito'::text, 'fermo_scadenza'::text, 'promessa_ritardo'::text, 'generico'::text])
  - ✓ esito = ANY (ARRAY['appuntamento_fissato'::text, 'richiamare'::text, 'non_risponde'::text, 'non_interessato'::text, 'gestito'::text])
  - ✓ canale = ANY (ARRAY['telefono'::text, 'whatsapp'::text, 'sms'::text, 'email'::text, 'di_persona'::text])
  - → (cliente_id) → clienti(id) ON DELETE CASCADE
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL

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
  - ✓ tipo = ANY (ARRAY['appuntamento'::text, 'richiesta'::text])
  - ✓ durata_predefinita_minuti > 0
  - ✓ ((tipo = 'appuntamento'::text) AND (durata_predefinita_minuti IS NOT NULL) AND (durata_predefinita_minuti > 0)) OR ((tipo = 'richiesta'::text) AND (durata_predefinita_minuti IS NULL))

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
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (id) → auth.users(id) ON DELETE CASCADE
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
  - → (cliente_id) → clienti(id) ON DELETE SET NULL
  - → (azienda_id) → aziende(id) ON DELETE CASCADE
  - → (utente_id) → utenti(id) ON DELETE SET NULL
  - → (busta_id) → ordini_occhiali(id) ON DELETE SET NULL
  - → (ordine_lac_id) → ordini_lac(id) ON DELETE SET NULL
  - ⊙ UNIQUE (azienda_id, numero)

## Le viste

- `chiusure_pubbliche`
- `negozi_pubblici`
- `orari_pubblici`
- `servizi_pubblici`

## Le funzioni (RPC)

- `anonimizza_cliente(p_cliente_id uuid)` → void
- `anonimizza_persone_del_cliente(p_cliente_id uuid)` → integer · *security definer*
- `applica_movimento_magazzino()` → trigger
- `appuntamento_intervallo(inizio timestamp with time zone, durata_minuti integer)` → tstzrange
- `assegna_sala_appuntamento()` → trigger · *security definer*
- `assicura_coerenza_tenant()` → trigger · *security definer*
- `assicura_tenant_riga_bolla_b3()` → trigger · *security definer*
- `blocca_modifica()` → trigger
- `cliente_per_telefono(p_telefono text)` → TABLE(id uuid, nome text, cognome text) · *security definer*
- `coerenza_negozio_servizio()` → trigger
- `coerenza_prenotazione_tipo()` → trigger
- `coerenza_registro_riferimento()` → trigger · *security definer*
- `crea_azienda_con_titolare(p_nome_azienda text, p_slug text, p_nome_utente text)` → uuid · *security definer*
- `crea_oculista_al_volo(p_nome text, p_studio text, p_citta text)` → uuid
- `crea_prenotazione(p_slug text, p_servizio text, p_inizio timestamp with time zone, p_nome text, p_telefono text, p_email text, p_per_conto_di text, p_note text, p_fonte text, p_chiave_richiesta text, p_lista_attesa boolean)` → TABLE(id uuid, codice text, inizio timestamp with time zone, durata_minuti integer) · *security definer*
- `crea_relazione(p_cliente_id uuid, p_relativo_id uuid, p_tipo text, p_note text)` → uuid
- `crea_sala_default()` → trigger · *security definer*
- `diag_intervallo_immutabile()` → TABLE(volatile_immutabile boolean, corpo_minuti boolean) · *security definer*
- `diag_normalizza_telefono()` → TABLE(volatile_immutabile boolean, corpo_ok boolean) · *security definer*
- `elimina_relazione(p_id uuid)` → void
- `get_azienda_id()` → uuid · *security definer*
- `guarda_quantita_riga_bolla_b3()` → trigger
- `guida_stato_bolla_attesa_b3()` → trigger
- `guida_stato_pratica_difetto_b3()` → trigger
- `normalizza_telefono(p text)` → text
- `prendi_persona_come_cliente(p_prenotazione_id uuid, p_cliente_id uuid)` → uuid · *security definer*
- `prossimo_numero(p_prefisso text)` → text · *security definer*
- `recupera_costo(p_causale text)` → boolean · *security definer*
- `registra_consenso(p_cliente_id uuid, p_tipo text, p_azione text, p_canali text[], p_modalita text, p_prescrizione_id uuid, p_versione text, p_documento_ref uuid)` → uuid
- `revoca_marketing(p_cliente_id uuid, p_modalita text)` → uuid
- `ricevi_riga_bolla(p_riga_id uuid, p_quantita integer, p_utente_id uuid)` → uuid
- `slot_liberi(p_slug text, p_servizio text, p_giorno date)` → SETOF timestamp with time zone · *security definer*
- `svuota_dati_di_test()` → void · *security definer*
- `tocca_updated_at()` → trigger

## I trigger

- `appuntamenti` ← `trg_appuntamenti_updated`
- `appuntamenti` ← `trg_sala_appuntamento`
- `appuntamenti` ← `trg_tenant`
- `aziende` ← `trg_aziende_updated`
- `aziende` ← `trg_sala_default`
- `bolle_attese` ← `trg_bolle_attese_updated`
- `bolle_attese` ← `trg_guida_stato_bolle_attese_b3`
- `bolle_attese` ← `trg_tenant_bolle_attese_b3`
- `bolle_attese_righe` ← `trg_bolle_attese_righe_updated`
- `bolle_attese_righe` ← `trg_guarda_quantita_bolle_attese_righe_b3`
- `bolle_attese_righe` ← `trg_tenant_bolle_attese_righe_b3`
- `chiusure_cassa` ← `trg_tenant`
- `clienti` ← `trg_clienti_updated`
- `clienti` ← `trg_tenant`
- `clienti_relazioni` ← `trg_tenant`
- `consensi` ← `trg_tenant`
- `fermi` ← `trg_fermi_updated`
- `fermi` ← `trg_tenant`
- `lac_modelli` ← `trg_lac_modelli_updated`
- `metodi_pagamento` ← `trg_metodi_updated`
- `movimenti_cassa` ← `trg_tenant`
- `movimenti_magazzino` ← `trg_movimenti_applica`
- `movimenti_magazzino` ← `trg_tenant`
- `negozi_servizi` ← `trg_coerenza_negozio_servizio`
- `ordini_lac` ← `trg_ordini_lac_updated`
- `ordini_lac` ← `trg_tenant`
- `ordini_occhiali` ← `trg_buste_updated`
- `ordini_occhiali` ← `trg_tenant`
- `parametri` ← `trg_parametri_updated`
- `persone_riferimento_registro` ← `trg_coerenza_registro`
- `persone_riferimento_registro` ← `trg_registro_append_only`
- `pratiche_difetto` ← `trg_guida_stato_pratiche_difetto_b3`
- `pratiche_difetto` ← `trg_pratiche_difetto_updated`
- `pratiche_difetto` ← `trg_tenant_pratiche_difetto_b3`
- `prenotazioni` ← `trg_coerenza_prenotazione_tipo`
- `prenotazioni` ← `trg_coerenza_prenotazioni`
- `prenotazioni` ← `trg_prenotazioni_no_delete`
- `prescrizioni` ← `trg_prescrizioni_updated`
- `prescrizioni` ← `trg_tenant`
- `prescrizioni` ← `trg_tenant_prescrizioni_b2`
- `prescrizioni_lac` ← `trg_prescrizioni_lac_updated`
- `prescrizioni_lac` ← `trg_tenant_prescrizioni_lac_b2`
- `prodotti` ← `trg_prodotti_updated`
- `prodotti` ← `trg_tenant_prodotti_b3`
- `resi` ← `trg_resi_updated`
- `resi` ← `trg_tenant`
- `richiami` ← `trg_richiami_updated`
- `richiami` ← `trg_tenant`
- `utenti` ← `trg_utenti_updated`
- `vendite` ← `trg_tenant`
- `vendite` ← `trg_vendite_updated`
