/**
 * Tipi del database — specchio di supabase/schema.sql.
 * Scritti a mano per ora; quando il progetto Supabase è vivo si possono
 * rigenerare con `supabase gen types typescript`, la shape resta questa.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ── Righe ─────────────────────────────────────────────────────────── */

export type AziendaRow = {
  id: string;
  slug: string;
  nome: string;
  ragione_sociale: string | null;
  partita_iva: string | null;
  email: string;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  brand: Json;
  logo_url: string | null;
  nome_pubblico: string | null;
  tagline: string | null;
  stato_abbonamento: "trial" | "attivo" | "sospeso" | "cancellato";
  moduli_attivi: string[];
  data_scadenza: string | null;
  created_at: string;
  updated_at: string;
}

export type UtenteRow = {
  id: string;
  azienda_id: string;
  email: string;
  nome: string;
  ruolo: "titolare" | "responsabile" | "ottico" | "addetto";
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

/** Vocabolario `fonte` — deve restare allineato al check SQL della migrazione 008
 *  (`clienti.fonte`). L'ordine è quello del check, così il confronto è a occhio.
 *  Unica fonte di verità: tipo, etichette, tinte e form derivano tutti da qui. */
export const FONTI = [
  "banco",
  "app",
  "convenzione",
  "import",
  "qr_vetrina",
  "sito_negozio",
  "portale",
] as const;

export type Fonte = (typeof FONTI)[number];

/** Vocabolario `fonte` degli ordini: come quello dei clienti, meno `import`
 *  (un ordine non si importa). Allineato al check SQL della migrazione 009. */
export type FonteOrdine = Exclude<Fonte, "import">;

/** Le sole fonti che un umano può scegliere a mano. Le altre le assegna il sistema. */
export const FONTI_MANUALI = ["banco", "convenzione", "import"] as const;

export type ClienteRow = {
  // B1 (021): additive. `consenso_marketing`/`consenso_canali` sono CACHE del
  // mastro (C3) — non si scrivono mai direttamente.
  assicurazione_id?: string | null;
  azienda_convenzionata_id?: string | null;
  dati_fatturazione?: Json | null;
  consenso_canali?: string[] | null;
  anonimizzato_il?: string | null;
  id: string;
  azienda_id: string;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  codice_fiscale: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  fonte: Fonte;
  secondo_nome: string | null;
  sesso: "M" | "F" | null;
  indirizzo2: string | null;
  nazione: string | null;
  telefono_casa: string | null;
  telefono_lavoro: string | null;
  lingua: string | null;
  tutore_legale: string | null;
  canale_preferito: "telefono" | "whatsapp" | "sms" | "email" | "cartaceo" | null;
  non_contattare: boolean;
  consenso_marketing: boolean;
  consenso_sanitario_il: string | null;
  data_consenso: string | null;
  consenso_dati_sanitari: string | null;
  note: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type PrismaBase = "alto" | "basso" | "nasale" | "temporale";

export type PrescrizioneRow = {
  id: string;
  azienda_id: string;
  cliente_id: string;
  tipo: "occhiali" | "lac";
  data_visita: string;
  utente_id: string | null;
  origine: "interna" | "esterna" | "lenti_precedenti";
  esaminatore: string | null;
  uso: "lontano" | "vicino" | "progressivo" | "bifocale" | "office" | null;
  od_sfero: number | null;
  od_cilindro: number | null;
  od_asse: number | null;
  os_sfero: number | null;
  os_cilindro: number | null;
  os_asse: number | null;
  addizione: number | null;
  od_prisma: number | null;
  od_prisma_base: PrismaBase | null;
  os_prisma: number | null;
  os_prisma_base: PrismaBase | null;
  od_raggio: number | null;
  od_diametro: number | null;
  os_raggio: number | null;
  os_diametro: number | null;
  od_dnp: number | null;
  os_dnp: number | null;
  validita_mesi: number;
  attiva: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ProdottoRow = {
  id: string;
  azienda_id: string;
  tipo: "lac" | "soluzione" | "montatura" | "sole" | "lente" | "accessorio" | "servizio";
  marca: string | null;
  nome: string;
  descrizione: string | null;
  sku: string | null;
  prezzo: number;
  visibile_sito: boolean;
  attivo: boolean;
  parametri: Json;
  giacenza: number;
  scorta_minima: number;
  ricambio_giorni: number | null;
  costo: number | null;
  fornitore: string | null;
  created_at: string;
  updated_at: string;
}

export type MovimentoMagazzinoRow = {
  id: string;
  azienda_id: string;
  prodotto_id: string;
  utente_id: string | null;
  tipo:
    | "carico"
    | "scarico"
    | "ordine_cliente"
    | "rettifica"
    | "reso_fornitore"
    | "danno"
    | "uso_interno";
  quantita: number;
  riferimento: string | null;
  note: string | null;
  created_at: string;
}

export type FermoRow = {
  id: string;
  azienda_id: string;
  prodotto_id: string;
  cliente_id: string;
  utente_id: string | null;
  quantita: number;
  stato: "attivo" | "ritirato" | "annullato";
  scade_il: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type AppuntamentoRow = {
  id: string;
  azienda_id: string;
  cliente_id: string | null;
  utente_id: string | null;
  tipo:
    | "controllo_vista"
    | "consegna"
    | "ritiro_lac"
    | "prima_applicazione_lac"
    | "altro";
  inizio: string;
  durata_minuti: number;
  // `in_attesa` (013): lo slot è impegnato da una richiesta del portale non
  // ancora confermata dall'ottico. Occupa l'agenda ma è graficamente distinto.
  stato: "in_attesa" | "prenotato" | "completato" | "mancato" | "annullato";
  // `fonte` (008 · DB-05): la porta da cui è entrata questa prenotazione (portale,
  // qr_vetrina, banco…). Diverso da clienti.fonte (prima acquisizione del cliente).
  fonte: Fonte;
  // `risorsa_id` (013→014): la sala/poltrona in cui sta l'appuntamento. Dalla 014
  // è OBBLIGATORIA (FK a `risorse`): ogni negozio ha almeno una sala e un trigger
  // la assegna quando l'inserimento non la passa (es. l'agenda del gestionale).
  risorsa_id: string;
  riferimento: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Le sale (risorse) di un negozio — l'appuntamento sta in una sala (014). */
export type RisorsaRow = {
  id: string;
  azienda_id: string;
  nome: string;
  ordine: number;
  attiva: boolean;
  created_at: string;
}

/** La RICHIESTA di prenotazione (la pratica; lo slot è l'appuntamento collegato).
 *  `inizio`/`durata_minuti`/`appuntamento_id` sono nullable dalla 017 (i servizi
 *  di tipo `richiesta` non occupano slot). Il contatto è COPIATO qui: il gestionale
 *  legge la prenotazione, mai `persone`. */
export type PrenotazioneRow = {
  id: string;
  azienda_id: string;
  /** NULL dopo lo SGANCIO dell'anonimizzazione (C1 voce 6): il fatto resta,
   *  il filo verso l'identità di piattaforma no. Non presumerlo valorizzato. */
  persona_id: string | null;
  cliente_id: string | null;
  appuntamento_id: string | null;
  servizio_codice: string;
  inizio: string | null;
  durata_minuti: number | null;
  stato: "in_attesa" | "accettata" | "rifiutata" | "annullata";
  fonte: Fonte;
  per_conto_di: string | null;
  contatto_nome: string;
  contatto_telefono: string;
  contatto_email: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Catalogo globale dei servizi (010/017), in sola lettura dal gestionale. */
export type ServizioRow = {
  codice: string;
  nome: string;
  tipo: "appuntamento" | "richiesta";
  durata_predefinita_minuti: number | null;
  ordine: number;
  attivo: boolean;
}

export type RichiamoRow = {
  id: string;
  azienda_id: string;
  cliente_id: string;
  utente_id: string | null;
  tipo:
    | "controllo_vista"
    | "lac_esaurimento"
    | "ritiro_sollecito"
    | "fermo_scadenza"
    | "promessa_ritardo"
    | "generico";
  da_fare_il: string;
  canale: "telefono" | "whatsapp" | "sms" | "email" | "di_persona" | null;
  esito:
    | "appuntamento_fissato"
    | "richiamare"
    | "non_risponde"
    | "non_interessato"
    | "gestito"
    | null;
  fatto_il: string | null;
  riferimento: string | null;
  valore: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape documentata di ordini_lac.righe (vedi schema.sql). */
export type RigaOrdineLac = {
  prodotto_id?: string | null;
  descrizione: string;
  occhio?: "OD" | "OS" | null;
  parametri?: {
    sfero?: number | null;
    cilindro?: number | null;
    asse?: number | null;
    raggio?: number | null;
    diametro?: number | null;
    addizione?: number | null;
  };
  quantita: number;
  prezzo: number;
}

export type OrdineLacRow = {
  id: string;
  azienda_id: string;
  cliente_id: string | null;
  prescrizione_id: string | null;
  numero: string;
  fonte: FonteOrdine;
  stato: "da_ordinare" | "ordinato" | "arrivato" | "consegnato" | "annullato";
  righe: Json;
  totale: number;
  acconto: number;
  data_arrivo_prevista: string | null;
  data_consegna: string | null;
  avvisato_il: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type OrdineOcchialiRow = {
  id: string;
  azienda_id: string;
  cliente_id: string | null;
  prescrizione_id: string | null;
  numero: string;
  fonte: FonteOrdine;
  stato: "preventivo" | "lavorazione" | "arrivata" | "pronta" | "consegnata" | "annullata";
  tipo_lavoro: "occhiale_completo" | "solo_lenti" | "solo_montatura" | "montatura_cliente";
  montatura_marca: string | null;
  montatura_modello: string | null;
  montatura_colore: string | null;
  montatura_calibro: string | null;
  montatura_upc: string | null;
  prezzo_montatura: number;
  lente_tipo: "monofocale" | "progressiva" | "bifocale" | "office" | null;
  lente_materiale: string | null;
  lente_indice: string | null;
  trattamenti: string[];
  prezzo_lenti: number;
  od_dnp: number | null;
  os_dnp: number | null;
  od_altezza: number | null;
  os_altezza: number | null;
  garanzia: string | null;
  garanzia_tipo: "servizio" | "polizza" | null;
  prezzo_extra: number;
  sconto: number;
  totale: number;
  acconto: number;
  acconto_metodo: string | null;
  acconto_incassato_il: string | null;
  saldo: number;
  laboratorio: string | null;
  data_promessa: string | null;
  ispezionata_da: string | null;
  ispezionata_il: string | null;
  avvisato_il: string | null;
  caparra_incamerata_il: string | null;
  data_consegna: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Helper generici Insert/Update ─────────────────────────────────── */

type Auto = "id" | "created_at" | "updated_at";
/** Riga di vendita (shape documentata di vendite.righe — vedi 005). */
export type RigaVendita = {
  prodotto_id?: string | null;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  sconto: number;
  aliquota: "4" | "22" | "esente";
  dm: boolean;
};

/** Pagamento di vendita (shape documentata di vendite.pagamenti). */
export type PagamentoVendita = {
  metodo_id?: string | null;
  nome: string;
  importo: number;
};

export type MetodoPagamentoRow = {
  id: string;
  azienda_id: string;
  nome: string;
  tipo: "contanti" | "elettronico" | "buono" | "bonifico" | "assicurazione" | "caparra" | "altro";
  tracciabile: boolean;
  attivo: boolean;
  ordine: number;
  created_at: string;
  updated_at: string;
}

export type VenditaRow = {
  id: string;
  azienda_id: string;
  numero: string;
  cliente_id: string | null;
  utente_id: string | null;
  busta_id: string | null;
  ordine_lac_id: string | null;
  righe: Json;
  pagamenti: Json;
  totale: number;
  iva_totale: number;
  doc_numero: string | null;
  doc_data: string | null;
  fattura_numero: string | null;
  cf_cliente: string | null;
  opposizione_ts: boolean;
  origine: "cassa" | "riallineamento";
  data_vendita: string;
  stato: "emessa" | "annullata";
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ResoRow = {
  id: string;
  azienda_id: string;
  vendita_id: string | null;
  busta_id: string | null;
  cliente_id: string | null;
  utente_id: string | null;
  numero: string;
  tipo: "denaro" | "gestionale";
  causale:
    | "soddisfatti_rimborsati"
    | "errore_checkup"
    | "errore_ricetta"
    | "mancato_adattamento_progressive"
    | "modifica_wo"
    | "insoddisfazione_estetica"
    | "insoddisfazione_funzionalita"
    | "difetto_fabbricazione";
  importo: number;
  metodo_rimborso: string | null;
  righe: Json;
  doc_numero: string | null;
  doc_data: string | null;
  doc_origine_numero: string | null;
  doc_origine_data: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ChiusuraCassaRow = {
  id: string;
  azienda_id: string;
  data: string;
  fondo_apertura: number;
  contanti_contati: number;
  fondo_chiusura: number;
  versamento: number;
  z_numero: string | null;
  riepilogo: Json;
  note: string | null;
  chiusa_da: string | null;
  created_at: string;
}

export type MovimentoCassaRow = {
  id: string;
  azienda_id: string;
  utente_id: string | null;
  tipo: "prelievo" | "spesa" | "versamento_cassaforte" | "versamento_banca" | "incamero_caparra";
  importo: number;
  motivo: string;
  riferimento: string | null;
  created_at: string;
}

type Ins<R> = Omit<Partial<R>, Auto> & { id?: string };
type Upd<R> = Omit<Partial<R>, Auto>;

/** Patch tipizzati per le update delle server action ordini. */
export type OrdineLacUpdate = Upd<OrdineLacRow>;
export type OrdineOcchialiUpdate = Upd<OrdineOcchialiRow>;

/* ── Database (la shape che supabase-js si aspetta) ────────────────── */

export type Database = {
  public: {
    Tables: {
      aziende: { Row: AziendaRow; Insert: Ins<AziendaRow>; Update: Upd<AziendaRow>; Relationships: [] };
      utenti: { Row: UtenteRow; Insert: Ins<UtenteRow> & { id: string }; Update: Upd<UtenteRow>; Relationships: [] };
      clienti: { Row: ClienteRow; Insert: Ins<ClienteRow>; Update: Upd<ClienteRow>; Relationships: [] };
      prescrizioni: { Row: PrescrizioneRow; Insert: Ins<PrescrizioneRow>; Update: Upd<PrescrizioneRow>; Relationships: [] };
      prodotti: { Row: ProdottoRow; Insert: Ins<ProdottoRow>; Update: Upd<ProdottoRow>; Relationships: [] };
      movimenti_magazzino: { Row: MovimentoMagazzinoRow; Insert: Omit<Partial<MovimentoMagazzinoRow>, "id" | "created_at"> & { id?: string }; Update: never; Relationships: [] };
      fermi: { Row: FermoRow; Insert: Ins<FermoRow>; Update: Upd<FermoRow>; Relationships: [] };
      appuntamenti: { Row: AppuntamentoRow; Insert: Ins<AppuntamentoRow>; Update: Upd<AppuntamentoRow>; Relationships: [] };
      prenotazioni: { Row: PrenotazioneRow; Insert: Ins<PrenotazioneRow>; Update: Upd<PrenotazioneRow>; Relationships: [] };
      servizi: { Row: ServizioRow; Insert: never; Update: never; Relationships: [] };
      consensi: { Row: ConsensoRow; Insert: Ins<ConsensoRow>; Update: Upd<ConsensoRow>; Relationships: [] };
      clienti_relazioni: { Row: ClienteRelazioneRow; Insert: Ins<ClienteRelazioneRow>; Update: Upd<ClienteRelazioneRow>; Relationships: [] };
      oculisti: { Row: OculistaRow; Insert: Ins<OculistaRow>; Update: Upd<OculistaRow>; Relationships: [] };
      parametri: { Row: ParametroRow; Insert: Ins<ParametroRow>; Update: Upd<ParametroRow>; Relationships: [] };
      assicurazioni: { Row: AssicurazioneRow; Insert: Ins<AssicurazioneRow>; Update: Upd<AssicurazioneRow>; Relationships: [] };
      risorse: { Row: RisorsaRow; Insert: Ins<RisorsaRow>; Update: Upd<RisorsaRow>; Relationships: [] };
      richiami: { Row: RichiamoRow; Insert: Ins<RichiamoRow>; Update: Upd<RichiamoRow>; Relationships: [] };
      metodi_pagamento: { Row: MetodoPagamentoRow; Insert: Ins<MetodoPagamentoRow>; Update: Upd<MetodoPagamentoRow>; Relationships: [] };
      vendite: { Row: VenditaRow; Insert: Ins<VenditaRow>; Update: Upd<VenditaRow>; Relationships: [] };
      resi: { Row: ResoRow; Insert: Ins<ResoRow>; Update: Upd<ResoRow>; Relationships: [] };
      chiusure_cassa: { Row: ChiusuraCassaRow; Insert: Omit<Ins<ChiusuraCassaRow>, "versamento">; Update: never; Relationships: [] };
      movimenti_cassa: { Row: MovimentoCassaRow; Insert: Omit<Partial<MovimentoCassaRow>, "id" | "created_at"> & { id?: string }; Update: never; Relationships: [] };
      ordini_lac: { Row: OrdineLacRow; Insert: Ins<OrdineLacRow>; Update: Upd<OrdineLacRow>; Relationships: [] };
      ordini_occhiali: { Row: OrdineOcchialiRow; Insert: Ins<OrdineOcchialiRow>; Update: Upd<OrdineOcchialiRow>; Relationships: [] };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_azienda_id: { Args: Record<PropertyKey, never>; Returns: string };
      crea_azienda_con_titolare: {
        Args: { p_nome_azienda: string; p_slug: string; p_nome_utente: string };
        Returns: string;
      };
      prossimo_numero: { Args: { p_prefisso: string }; Returns: string };
      // G8 (018): il percorso di scrittura verso persone/registro (ID-01).
      cliente_per_telefono: {
        Args: { p_telefono: string };
        Returns: { id: string; nome: string; cognome: string }[];
      };
      // B1 (021): i contratti che pretendono una transazione.
      registra_consenso: {
        Args: {
          p_cliente_id: string; p_tipo: string; p_azione: string;
          p_canali?: string[] | null; p_modalita?: string | null;
          p_prescrizione_id?: string | null; p_versione?: string | null; p_documento_ref?: string | null;
        };
        Returns: string;
      };
      revoca_marketing: { Args: { p_cliente_id: string; p_modalita?: string | null }; Returns: string };
      crea_relazione: {
        Args: { p_cliente_id: string; p_relativo_id: string; p_tipo: string; p_note?: string | null };
        Returns: string;
      };
      crea_oculista_al_volo: {
        Args: { p_nome: string; p_studio?: string | null; p_citta?: string | null };
        Returns: string;
      };
      anonimizza_cliente: { Args: { p_cliente_id: string }; Returns: undefined };
      elimina_relazione: { Args: { p_id: string }; Returns: undefined };
      prendi_persona_come_cliente: {
        Args: { p_prenotazione_id: string; p_cliente_id?: string | null };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}


/* ── B1 · Fondamenta (Era 2, migrazione 021) ─────────────────────────── */

/** Libro mastro dei consensi (M1 §4, contratto C3). Eventi immutabili. */
export type ConsensoRow = {
  id: string;
  azienda_id: string;
  cliente_id: string;
  tipo: "marketing" | "dati_sanitari";
  prescrizione_id: string | null;
  azione: "dato" | "revocato";
  canali: string[] | null;
  modalita: "penna" | "digitale" | null;
  versione_informativa: string | null;
  documento_ref: string | null;
  utente_id: string | null;
  avvenuto_il: string;
}

/** Relazione fra clienti (C4): UNA riga, letta nei due versi. */
export type ClienteRelazioneRow = {
  id: string;
  azienda_id: string;
  cliente_id: string;
  relativo_id: string;
  tipo: "tutore_legale" | "padre" | "madre" | "figlio" | "fratello" | "sorella";
  note: string | null;
  created_at: string;
}

export type OculistaRow = {
  id: string;
  azienda_id: string;
  nome: string;
  studio: string | null;
  citta: string | null;
  note: string | null;
  attivo: boolean;
  created_at: string;
}

/** Le politiche di negozio in chiave/valore (M10 §4). */
export type ParametroRow = {
  id: string;
  azienda_id: string;
  chiave: string;
  valore: Json;
  updated_at: string;
}

/** Registro globale delle assicurazioni: la voce NESSUNA è semantica (M1 §2). */
export type AssicurazioneRow = {
  id: string;
  nome: string;
  attivo: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PORTALE — tipi della vetrina pubblica (G4).
 * La vista `negozi_pubblici` (migrazione 008) espone SOLO le colonne di vetrina
 * dei negozi con portale_attivo=true. Nessun dato riservato (id, p.iva, email,
 * telefono, abbonamento) la attraversa. Questi tipi vivono qui in fondo per non
 * disturbare il blocco `Database` generato.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Chiavi del branding white-label, come da default jsonb di `aziende.brand`. */
export const CHIAVI_BRAND = [
  "primary",
  "accent",
  "accentSoft",
  "surface",
  "textSoft",
  "textFaint",
] as const;
export type ChiaveBrand = (typeof CHIAVI_BRAND)[number];

/** Brand grezzo dal DB: jsonb controllato dal tenant → ogni valore è NON fidato. */
export type BrandGrezzo = Partial<Record<ChiaveBrand, unknown>>;

/** Brand validato: ogni chiave è un colore `#rrggbb`/`#rgb` sicuro (vedi lib/portale/brand.ts). */
export type BrandNegozio = Record<ChiaveBrand, string>;

/** Riga della vista pubblica `negozi_pubblici`. */
export type NegozioPubblicoRow = {
  slug: string;
  nome_pubblico: string;
  tagline: string | null;
  logo_url: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  brand: BrandGrezzo | null;
};

/* Portale G5 — righe delle viste pubbliche di orari/servizi/chiusure (mig 010). */

/** Riga di `orari_pubblici`. `apre`/`chiude` sono `time` → "HH:MM:SS". */
export type OrarioPubblicoRow = {
  slug: string;
  giorno: number; // 0=domenica … 6=sabato
  apre: string;
  chiude: string;
};

/** Riga di `chiusure_pubbliche` — SENZA `motivo` (fatto interno del negozio). */
export type ChiusuraPubblicaRow = {
  slug: string;
  dal: string; // date "YYYY-MM-DD"
  al: string;
};

/**
 * Riga di `servizi_pubblici`. `durata_minuti` = deroga del negozio o predefinita
 * per i servizi su appuntamento; **null** per i servizi di tipo `richiesta` (017).
 */
export type ServizioPubblicoRow = {
  slug: string;
  codice: string;
  etichetta: string;
  durata_minuti: number | null;
  ordine: number;
  tipo: "appuntamento" | "richiesta";
};
