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
  ruolo: "titolare" | "optometrista" | "staff";
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

export type Fonte = "banco" | "sito" | "app" | "convenzione" | "import";

export type ClienteRow = {
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
  consenso_marketing: boolean;
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
  validita_mesi: number;
  attiva: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type ProdottoRow = {
  id: string;
  azienda_id: string;
  tipo: "lac" | "soluzione" | "montatura" | "lente" | "accessorio" | "servizio";
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
  stato: "prenotato" | "completato" | "mancato" | "annullato";
  riferimento: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
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
  fonte: Exclude<Fonte, "import">;
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
  fonte: Exclude<Fonte, "import">;
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
  prezzo_extra: number;
  sconto: number;
  totale: number;
  acconto: number;
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
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
