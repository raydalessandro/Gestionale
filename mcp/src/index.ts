#!/usr/bin/env node
/**
 * VISTA MCP — l'ottico artificiale (v0)
 * ─────────────────────────────────────
 * Opera sul gestionale come un OPERATORE AUTENTICATO: login email+password
 * di un utente dedicato (ruolo consigliato: addetto), anon key, RLS attiva.
 * MAI service role. I tool rispettano il contratto di dominio:
 *   · numeri BL-/OL-/VE- SOLO dalla RPC prossimo_numero
 *   · transizioni di stato SOLO dalla mappa (stato riletto prima di scrivere)
 *   · Σ pagamenti = totale, sempre
 *   · scarico magazzino SOLO via movimenti (il trigger fa la giacenza)
 * Fuori dalla v0 (si fanno in UI): chiusura di cassa, consegna+incasso da
 * busta, resi, incamero caparra.
 *
 * Env richieste: SUPABASE_URL, SUPABASE_ANON_KEY, VISTA_EMAIL, VISTA_PASSWORD
 * (lazy: tools/list funziona anche senza; il login avviene al primo tool).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/* ── Contratto: vocabolario immutabile (docs/fasi) ─────────────────── */
const TRANS_BUSTA: Record<string, string[]> = {
  preventivo: ["lavorazione", "annullata"],
  lavorazione: ["arrivata", "annullata"],
  arrivata: ["pronta", "annullata"],
  pronta: ["consegnata", "annullata"],
};
const TRANS_LAC: Record<string, string[]> = {
  da_ordinare: ["ordinato", "annullato"],
  ordinato: ["arrivato", "annullato"],
  arrivato: ["consegnato", "annullato"],
};

/* ── Connessione pigra: login al primo tool ────────────────────────── */
let _sb: SupabaseClient | null = null;
let _ctx: { azienda_id: string; utente_id: string; nome: string } | null = null;

async function db() {
  if (_sb && _ctx) return { sb: _sb, ctx: _ctx };
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const email = process.env.VISTA_EMAIL;
  const password = process.env.VISTA_PASSWORD;
  if (!url || !anon || !email || !password)
    throw new Error(
      "Configurazione mancante: servono SUPABASE_URL, SUPABASE_ANON_KEY, VISTA_EMAIL, VISTA_PASSWORD."
    );
  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
  const { data: auth, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !auth.user) throw new Error("Login fallito: " + (error?.message ?? "credenziali?"));
  const { data: u, error: e2 } = await sb
    .from("utenti")
    .select("id, azienda_id, nome")
    .eq("id", auth.user.id)
    .single();
  if (e2 || !u) throw new Error("Utente autenticato ma assente dal gestionale.");
  _sb = sb;
  _ctx = { azienda_id: u.azienda_id, utente_id: u.id, nome: u.nome };
  return { sb: _sb, ctx: _ctx };
}

/* ── Utilità ───────────────────────────────────────────────────────── */
const r2 = (n: number) => Math.round(n * 100) / 100;
const oggi = () => new Date().toISOString().slice(0, 10);
const J = (x: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(x, null, 1) }] });
function fail(msg: string): never { throw new Error(msg); }
const pulisci = (s: string) => s.replace(/[%,()]/g, " ").trim();

async function nuovoNumero(sb: SupabaseClient, p: "BL" | "OL" | "VE") {
  const { data, error } = await sb.rpc("prossimo_numero", { p_prefisso: p });
  if (error || !data) fail("RPC prossimo_numero fallita: " + (error?.message ?? "?"));
  return data as string;
}
async function scarico(
  sb: SupabaseClient, ctx: NonNullable<typeof _ctx>,
  righe: { prodotto_id?: string | null; quantita: number }[], riferimento: string
) {
  const mov = righe
    .filter((r) => r.prodotto_id)
    .map((r) => ({
      azienda_id: ctx.azienda_id, prodotto_id: r.prodotto_id, utente_id: ctx.utente_id,
      tipo: "scarico", quantita: -Math.abs(r.quantita), riferimento,
    }));
  if (!mov.length) return 0;
  const { error } = await sb.from("movimenti_magazzino").insert(mov);
  if (error) fail("Scarico magazzino fallito: " + error.message);
  return mov.length;
}

const server = new McpServer({ name: "vista-mcp", version: "0.1.0" });

/* ════ LETTURA ═══════════════════════════════════════════════════════ */

server.tool("situazione", "Colpo d'occhio del negozio: buste per stato, ordini LAC in corso, appuntamenti e incasso di oggi.", {}, async () => {
  const { sb, ctx } = await db();
  const [b, l, a, v] = await Promise.all([
    sb.from("ordini_occhiali").select("stato").eq("azienda_id", ctx.azienda_id).not("stato", "in", '("consegnata","annullata")'),
    sb.from("ordini_lac").select("stato").eq("azienda_id", ctx.azienda_id).not("stato", "in", '("consegnato","annullato")'),
    sb.from("appuntamenti").select("id", { count: "exact", head: true }).eq("azienda_id", ctx.azienda_id).gte("inizio", oggi()).lt("inizio", oggi() + "T23:59:59").eq("stato", "prenotato"),
    sb.from("vendite").select("totale").eq("azienda_id", ctx.azienda_id).eq("stato", "emessa").gte("data_vendita", oggi()),
  ]);
  const perStato = (rows: { stato: string }[] | null) =>
    (rows ?? []).reduce<Record<string, number>>((m, r) => ((m[r.stato] = (m[r.stato] ?? 0) + 1), m), {});
  return J({
    operatore: ctx.nome,
    buste_in_corso: perStato(b.data),
    lac_in_corso: perStato(l.data),
    appuntamenti_oggi: a.count ?? 0,
    vendite_oggi: { numero: v.data?.length ?? 0, incasso: r2((v.data ?? []).reduce((s, x) => s + Number(x.totale), 0)) },
  });
});

server.tool("cerca_clienti", "Cerca clienti per nome, cognome o telefono.", { q: z.string().min(2) }, async ({ q }) => {
  const { sb, ctx } = await db();
  const { data, error } = await sb.from("clienti")
    .select("id, nome, cognome, telefono, email, canale_preferito, consenso_marketing, consenso_dati_sanitari")
    .eq("azienda_id", ctx.azienda_id)
    .or(`nome.ilike.%${pulisci(q)}%,cognome.ilike.%${pulisci(q)}%,telefono.ilike.%${pulisci(q)}%`)
    .limit(10);
  if (error) fail(error.message);
  return J(data);
});

server.tool("scheda_cliente", "Scheda completa: anagrafica, ultime prescrizioni, buste e ordini LAC aperti.", { cliente_id: z.string().uuid() }, async ({ cliente_id }) => {
  const { sb, ctx } = await db();
  const [c, rx, b, l] = await Promise.all([
    sb.from("clienti").select("*").eq("id", cliente_id).eq("azienda_id", ctx.azienda_id).single(),
    sb.from("prescrizioni").select("id, tipo, data_visita, od_sfero, od_cilindro, od_asse, os_sfero, os_cilindro, os_asse, addizione, od_dnp, os_dnp").eq("cliente_id", cliente_id).order("data_visita", { ascending: false }).limit(3),
    sb.from("ordini_occhiali").select("numero, stato, totale, acconto, data_promessa").eq("cliente_id", cliente_id).not("stato", "in", '("consegnata","annullata")'),
    sb.from("ordini_lac").select("numero, stato, totale, data_consegna").eq("cliente_id", cliente_id).order("created_at", { ascending: false }).limit(3),
  ]);
  if (c.error) fail("Cliente non trovato.");
  return J({ cliente: c.data, prescrizioni: rx.data, buste_aperte: b.data, ordini_lac: l.data });
});

server.tool("cerca_prodotti", "Catalogo con giacenza. Filtra per testo e/o tipo (lac, soluzione, montatura, sole, lente, accessorio, servizio).", {
  q: z.string().optional(),
  tipo: z.enum(["lac", "soluzione", "montatura", "sole", "lente", "accessorio", "servizio"]).optional(),
}, async ({ q, tipo }) => {
  const { sb, ctx } = await db();
  let query = sb.from("prodotti").select("id, tipo, marca, nome, sku, prezzo, giacenza, ricambio_giorni").eq("azienda_id", ctx.azienda_id).eq("attivo", true);
  if (tipo) query = query.eq("tipo", tipo);
  if (q) query = query.or(`nome.ilike.%${pulisci(q)}%,marca.ilike.%${pulisci(q)}%,sku.ilike.%${pulisci(q)}%`);
  const { data, error } = await query.limit(12);
  if (error) fail(error.message);
  return J(data);
});

server.tool("buste_in_corso", "Tutte le buste non ancora consegnate né annullate.", {}, async () => {
  const { sb, ctx } = await db();
  const { data, error } = await sb.from("ordini_occhiali")
    .select("numero, stato, totale, acconto, acconto_metodo, data_promessa, clienti(nome, cognome)")
    .eq("azienda_id", ctx.azienda_id).not("stato", "in", '("consegnata","annullata")')
    .order("created_at", { ascending: false }).limit(20);
  if (error) fail(error.message);
  return J(data);
});

server.tool("giornata_cassa", "La giornata di oggi: vendite, caparre incassate, movimenti di cassa.", {}, async () => {
  const { sb, ctx } = await db();
  const [v, acc, m] = await Promise.all([
    sb.from("vendite").select("numero, totale, pagamenti, stato").eq("azienda_id", ctx.azienda_id).gte("data_vendita", oggi()),
    sb.from("ordini_occhiali").select("numero, acconto, acconto_metodo").eq("azienda_id", ctx.azienda_id).gte("acconto_incassato_il", oggi()),
    sb.from("movimenti_cassa").select("tipo, importo, motivo").eq("azienda_id", ctx.azienda_id).gte("created_at", oggi()),
  ]);
  return J({ vendite: v.data, caparre_incassate_oggi: acc.data, movimenti: m.data });
});

server.tool("agenda", "Appuntamenti di un giorno (default: oggi).", { giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }, async ({ giorno }) => {
  const { sb, ctx } = await db();
  const g = giorno ?? oggi();
  const { data, error } = await sb.from("appuntamenti")
    .select("id, tipo, inizio, durata_minuti, stato, riferimento, clienti(nome, cognome, telefono)")
    .eq("azienda_id", ctx.azienda_id).gte("inizio", g).lt("inizio", g + "T23:59:59").order("inizio");
  if (error) fail(error.message);
  return J(data);
});

/* ════ SCRITTURA — le stesse regole del banco ════════════════════════ */

server.tool("crea_cliente", "Nuova scheda cliente. Il consenso marketing, se dato, viene datato ora.", {
  nome: z.string().min(1), cognome: z.string().min(1),
  telefono: z.string().optional(), email: z.string().email().optional(),
  data_nascita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  canale_preferito: z.enum(["telefono", "whatsapp", "sms", "email", "cartaceo"]).optional(),
  consenso_marketing: z.boolean().optional(),
  note: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data, error } = await sb.from("clienti").insert({
    azienda_id: ctx.azienda_id, nome: a.nome, cognome: a.cognome,
    telefono: a.telefono ?? null, email: a.email ?? null, data_nascita: a.data_nascita ?? null,
    canale_preferito: a.canale_preferito ?? null, fonte: "banco",
    consenso_marketing: a.consenso_marketing ?? false,
    data_consenso: a.consenso_marketing ? new Date().toISOString() : null,
    note: a.note ?? null,
  }).select("id, nome, cognome").single();
  if (error) fail(error.message);
  return J({ creato: data });
});

server.tool("crea_prescrizione", "Nuova prescrizione. Se il cliente non ha il consenso sanitario, va confermato QUI (consenso_sanitario_confermato=true): la data del consenso viene registrata sulla scheda — come al banco.", {
  cliente_id: z.string().uuid(),
  tipo: z.enum(["occhiali", "lac"]),
  uso: z.enum(["lontano", "vicino", "progressivo", "bifocale", "office"]).default("lontano"),
  esaminatore: z.string().default("Operatore AI"),
  od_sfero: z.number().optional(), od_cilindro: z.number().optional(), od_asse: z.number().int().min(0).max(180).optional(),
  os_sfero: z.number().optional(), os_cilindro: z.number().optional(), os_asse: z.number().int().min(0).max(180).optional(),
  addizione: z.number().optional(), od_dnp: z.number().min(20).max(45).optional(), os_dnp: z.number().min(20).max(45).optional(),
  od_raggio: z.number().optional(), od_diametro: z.number().optional(),
  os_raggio: z.number().optional(), os_diametro: z.number().optional(),
  consenso_sanitario_confermato: z.boolean().default(false),
  note: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data: cli, error: ec } = await sb.from("clienti").select("id, consenso_dati_sanitari").eq("id", a.cliente_id).eq("azienda_id", ctx.azienda_id).single();
  if (ec || !cli) fail("Cliente non trovato.");
  if (!cli.consenso_dati_sanitari) {
    if (!a.consenso_sanitario_confermato)
      fail("Il cliente non ha il consenso ai dati sanitari: raccoglierlo e ripetere con consenso_sanitario_confermato=true.");
    const { error: eu } = await sb.from("clienti").update({ consenso_dati_sanitari: new Date().toISOString() }).eq("id", cli.id);
    if (eu) fail("Registrazione consenso fallita: " + eu.message);
  }
  const { data, error } = await sb.from("prescrizioni").insert({
    azienda_id: ctx.azienda_id, cliente_id: a.cliente_id, utente_id: ctx.utente_id,
    tipo: a.tipo, uso: a.uso, origine: "interna", esaminatore: a.esaminatore,
    data_visita: new Date().toISOString(), validita_mesi: 12,
    od_sfero: a.od_sfero ?? null, od_cilindro: a.od_cilindro ?? null, od_asse: a.od_asse ?? null,
    os_sfero: a.os_sfero ?? null, os_cilindro: a.os_cilindro ?? null, os_asse: a.os_asse ?? null,
    addizione: a.addizione ?? null, od_dnp: a.od_dnp ?? null, os_dnp: a.os_dnp ?? null,
    od_raggio: a.od_raggio ?? null, od_diametro: a.od_diametro ?? null,
    os_raggio: a.os_raggio ?? null, os_diametro: a.os_diametro ?? null,
    note: a.note ?? null,
  }).select("id, tipo, data_visita").single();
  if (error) fail(error.message);
  return J({ creata: data });
});

server.tool("crea_appuntamento", "Fissa un appuntamento in agenda.", {
  cliente_id: z.string().uuid(),
  tipo: z.enum(["controllo_vista", "consegna", "ritiro_lac", "prima_applicazione_lac", "altro"]),
  inizio: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  durata_minuti: z.number().int().positive().default(30),
  riferimento: z.string().optional(), note: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data, error } = await sb.from("appuntamenti").insert({
    azienda_id: ctx.azienda_id, cliente_id: a.cliente_id, utente_id: ctx.utente_id,
    tipo: a.tipo, inizio: a.inizio, durata_minuti: a.durata_minuti,
    stato: "prenotato", riferimento: a.riferimento ?? null, note: a.note ?? null,
  }).select("id, tipo, inizio").single();
  if (error) fail(error.message);
  return J({ creato: data });
});

server.tool("esito_appuntamento", "Registra l'esito di un appuntamento prenotato.", {
  appuntamento_id: z.string().uuid(),
  esito: z.enum(["completato", "mancato", "annullato"]),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data: app, error: e1 } = await sb.from("appuntamenti").select("id, stato").eq("id", a.appuntamento_id).eq("azienda_id", ctx.azienda_id).single();
  if (e1 || !app) fail("Appuntamento non trovato.");
  if (app.stato !== "prenotato") fail(`L'appuntamento è già '${app.stato}'.`);
  const { data: upd, error } = await sb.from("appuntamenti").update({ stato: a.esito }).eq("id", app.id).eq("stato", "prenotato").select("id");
  if (error) fail(error.message);
  if (!upd?.length) fail("L'appuntamento è cambiato nel frattempo: rileggi e riprova.");
  return J({ aggiornato: { id: app.id, stato: a.esito } });
});

server.tool("crea_busta", "Apre una busta lavoro (occhiali). Numero dalla RPC. Se c'è acconto, il metodo è OBBLIGATORIO e l'incasso viene datato ora (regola 4c).", {
  cliente_id: z.string().uuid(), prescrizione_id: z.string().uuid().optional(),
  tipo_lavoro: z.enum(["occhiale_completo", "solo_montatura", "solo_lenti"]).default("occhiale_completo"),
  montatura_marca: z.string().optional(), montatura_modello: z.string().optional(),
  montatura_colore: z.string().optional(), montatura_calibro: z.string().optional(),
  prezzo_montatura: z.number().nonnegative().default(0),
  lente_tipo: z.string().optional(), lente_indice: z.string().optional(),
  trattamenti: z.array(z.string()).default([]),
  prezzo_lenti: z.number().nonnegative().default(0),
  garanzia: z.string().optional(), garanzia_tipo: z.enum(["servizio", "polizza"]).optional(),
  prezzo_extra: z.number().nonnegative().default(0),
  acconto: z.number().nonnegative().default(0),
  acconto_metodo: z.string().optional(),
  stato_iniziale: z.enum(["preventivo", "lavorazione"]).default("preventivo"),
  data_promessa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  od_dnp: z.number().min(20).max(45).optional(), os_dnp: z.number().min(20).max(45).optional(),
  note: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  if (a.acconto > 0 && !a.acconto_metodo) fail("Acconto > 0: il metodo di pagamento è obbligatorio (contratto 4c).");
  const totale = r2(a.prezzo_montatura + a.prezzo_lenti + a.prezzo_extra);
  if (a.acconto > totale) fail("L'acconto supera il totale.");
  const num = await nuovoNumero(sb, "BL");
  const stato = a.acconto > 0 ? "lavorazione" : a.stato_iniziale;
  const { data, error } = await sb.from("ordini_occhiali").insert({
    azienda_id: ctx.azienda_id, cliente_id: a.cliente_id, prescrizione_id: a.prescrizione_id ?? null,
    numero: num, fonte: "banco", stato, tipo_lavoro: a.tipo_lavoro,
    montatura_marca: a.montatura_marca ?? null, montatura_modello: a.montatura_modello ?? null,
    montatura_colore: a.montatura_colore ?? null, montatura_calibro: a.montatura_calibro ?? null,
    prezzo_montatura: a.prezzo_montatura, lente_tipo: a.lente_tipo ?? null, lente_indice: a.lente_indice ?? null,
    trattamenti: a.trattamenti, prezzo_lenti: a.prezzo_lenti,
    garanzia: a.garanzia ?? null, garanzia_tipo: a.garanzia_tipo ?? null, prezzo_extra: a.prezzo_extra,
    totale, acconto: a.acconto,
    acconto_metodo: a.acconto > 0 ? a.acconto_metodo : null,
    acconto_incassato_il: a.acconto > 0 ? new Date().toISOString() : null,
    data_promessa: a.data_promessa ?? null,
    od_dnp: a.od_dnp ?? null, os_dnp: a.os_dnp ?? null,
    note: a.note ?? null,
  }).select("numero, stato, totale, acconto").single();
  if (error) fail(error.message);
  return J({ busta: data });
});

server.tool("avanza_busta", "Fa avanzare una busta: preventivo→lavorazione→arrivata→pronta (o annullata). La CONSEGNA è fuori dai poteri dell'AI: il saldo si batte in UI con 'Consegna e incassa' (regola 4c).", {
  numero: z.string().regex(/^BL-/), nuovo_stato: z.enum(["lavorazione", "arrivata", "pronta", "annullata"]),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data: b, error: e1 } = await sb.from("ordini_occhiali").select("id, stato").eq("azienda_id", ctx.azienda_id).eq("numero", a.numero).single();
  if (e1 || !b) fail("Busta non trovata.");
  const ok = TRANS_BUSTA[b.stato]?.includes(a.nuovo_stato);
  if (!ok) fail(`Transizione non ammessa: ${b.stato} → ${a.nuovo_stato}.`);
  const { data: upd, error } = await sb.from("ordini_occhiali")
    .update({ stato: a.nuovo_stato }).eq("id", b.id).eq("stato", b.stato).select("id");
  if (error) fail(error.message);
  if (!upd?.length) fail("Lo stato è cambiato nel frattempo: rileggi la busta e riprova.");
  return J({ busta: { numero: a.numero, stato: a.nuovo_stato } });
});

server.tool("crea_ordine_lac", "Apre un ordine LAC (numero dalla RPC, stato da_ordinare). Le righe con prodotto_id verranno scaricate dal magazzino alla consegna.", {
  cliente_id: z.string().uuid(), prescrizione_id: z.string().uuid().optional(),
  righe: z.array(z.object({
    prodotto_id: z.string().uuid().optional(),
    descrizione: z.string(), occhio: z.enum(["OD", "OS"]).optional(),
    quantita: z.number().int().positive(), prezzo: z.number().nonnegative(),
    parametri: z.record(z.any()).optional(),
  })).min(1),
  note: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  const totale = r2(a.righe.reduce((s, r) => s + r.quantita * r.prezzo, 0));
  const num = await nuovoNumero(sb, "OL");
  const { data, error } = await sb.from("ordini_lac").insert({
    azienda_id: ctx.azienda_id, cliente_id: a.cliente_id, prescrizione_id: a.prescrizione_id ?? null,
    numero: num, fonte: "banco", stato: "da_ordinare",
    righe: a.righe.map((r) => ({ ...r, prodotto_id: r.prodotto_id ?? null, occhio: r.occhio ?? null })),
    totale, acconto: 0, note: a.note ?? null,
  }).select("numero, stato, totale").single();
  if (error) fail(error.message);
  return J({ ordine: data });
});

server.tool("avanza_ordine_lac", "Fa avanzare un ordine LAC: da_ordinare→ordinato→arrivato→consegnato (o annullato). Alla consegna scarica il magazzino via movimenti.", {
  numero: z.string().regex(/^OL-/), nuovo_stato: z.enum(["ordinato", "arrivato", "consegnato", "annullato"]),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data: o, error: e1 } = await sb.from("ordini_lac").select("id, stato, righe").eq("azienda_id", ctx.azienda_id).eq("numero", a.numero).single();
  if (e1 || !o) fail("Ordine non trovato.");
  if (!TRANS_LAC[o.stato]?.includes(a.nuovo_stato)) fail(`Transizione non ammessa: ${o.stato} → ${a.nuovo_stato}.`);
  const patch: Record<string, unknown> = { stato: a.nuovo_stato };
  if (a.nuovo_stato === "consegnato") patch.data_consegna = new Date().toISOString();
  const { data: upd, error } = await sb.from("ordini_lac").update(patch).eq("id", o.id).eq("stato", o.stato).select("id");
  if (error) fail(error.message);
  if (!upd?.length) fail("Lo stato è cambiato nel frattempo: rileggi l'ordine e riprova.");
  let scaricate = 0;
  if (a.nuovo_stato === "consegnato")
    scaricate = await scarico(sb, ctx, (o.righe as { prodotto_id?: string; quantita: number }[]) ?? [], a.numero);
  return J({ ordine: { numero: a.numero, stato: a.nuovo_stato }, righe_scaricate: scaricate });
});

server.tool("vendita_veloce", "Vendita da banco: righe con aliquota (4/22/esente) e flag DM, pagamenti che DEVONO pareggiare il totale, numero dalla RPC, scarico automatico per le righe con prodotto_id.", {
  cliente_id: z.string().uuid().optional(),
  cf_cliente: z.string().optional(), doc_numero: z.string().optional(),
  righe: z.array(z.object({
    descrizione: z.string(), quantita: z.number().int().positive(),
    prezzo_unitario: z.number().nonnegative(), sconto: z.number().nonnegative().default(0),
    aliquota: z.enum(["4", "22", "esente"]), dm: z.boolean().default(false),
    prodotto_id: z.string().uuid().optional(),
  })).min(1),
  pagamenti: z.array(z.object({ nome: z.string(), importo: z.number().positive() })).min(1),
  note: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  const totale = r2(a.righe.reduce((s, r) => s + r.quantita * r.prezzo_unitario - r.sconto, 0));
  const pagato = r2(a.pagamenti.reduce((s, p) => s + p.importo, 0));
  if (totale !== pagato) fail(`Σ pagamenti (${pagato}) ≠ totale (${totale}): la vendita non si registra.`);
  const iva = r2(a.righe.reduce((s, r) => {
    const lordo = r.quantita * r.prezzo_unitario - r.sconto;
    if (r.aliquota === "esente") return s;
    const al = Number(r.aliquota);
    return s + (lordo - lordo / (1 + al / 100));
  }, 0));
  const num = await nuovoNumero(sb, "VE");
  const { data, error } = await sb.from("vendite").insert({
    azienda_id: ctx.azienda_id, numero: num, cliente_id: a.cliente_id ?? null, utente_id: ctx.utente_id,
    righe: a.righe.map((r) => ({ ...r, prodotto_id: r.prodotto_id ?? null })),
    pagamenti: a.pagamenti, totale, iva_totale: iva,
    doc_numero: a.doc_numero ?? null, doc_data: a.doc_numero ? oggi() : null,
    cf_cliente: a.cf_cliente ?? null, origine: "cassa", stato: "emessa", note: a.note ?? null,
  }).select("numero, totale").single();
  if (error) fail(error.message);
  const scaricate = await scarico(sb, ctx, a.righe.map((r) => ({ prodotto_id: r.prodotto_id, quantita: r.quantita })), num);
  return J({ vendita: data, righe_scaricate: scaricate });
});

server.tool("movimento_cassa", "Registra un prelievo o una spesa di cassa (importo positivo, motivo obbligatorio).", {
  tipo: z.enum(["prelievo", "spesa"]), importo: z.number().positive(),
  motivo: z.string().min(2), riferimento: z.string().optional(),
}, async (a) => {
  const { sb, ctx } = await db();
  const { data, error } = await sb.from("movimenti_cassa").insert({
    azienda_id: ctx.azienda_id, utente_id: ctx.utente_id,
    tipo: a.tipo, importo: a.importo, motivo: a.motivo, riferimento: a.riferimento ?? null,
  }).select("tipo, importo, motivo").single();
  if (error) fail(error.message);
  return J({ registrato: data });
});

/* ── Avvio ─────────────────────────────────────────────────────────── */
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[vista-mcp] pronto (login pigro al primo tool).");
