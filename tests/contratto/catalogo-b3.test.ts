import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creaProdotto, creaTenant, haEnv, pulisci, type Tenant } from "./_helpers";

/**
 * B3 · Contratto catalogo e magazzino.
 *
 * I fatti provano il DDL, non la UI: una bolla attesa non può alterare lo stock;
 * il carico reale sì. Il valore economico è sempre una doppia istantanea e le
 * FK cross-tenant devono fermarsi nel database con 23514.
 */
describe.skipIf(!haEnv())("B3 · Catalogo & Magazzino", () => {
  let A: Tenant;
  let B: Tenant;
  let prodottoA: string;
  let prodottoB: string;
  let modelloA: string;

  beforeAll(async () => {
    A = await creaTenant("b3a");
    B = await creaTenant("b3b");
    prodottoA = await creaProdotto(A, { nome: "LAC B3 A", costo: 9.5, prezzo: 20 });
    prodottoB = await creaProdotto(B, { nome: "LAC B3 B" });

    const { data, error } = await A.cli
      .from("lac_modelli")
      .insert({
        azienda_id: A.aziendaId,
        fornitore: "CooperVision",
        nome: "Biofinity B3",
        tipologia: "monofocale",
        durata: "mensile",
        pezzi_per_confezione: 6,
        producibilita: { sfero: { regole: [{ min: -12, max: 6, step: 0.25 }] } },
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`modello B3: ${error?.message ?? "id nullo"}`);
    modelloA = data.id as string;
  });

  afterAll(pulisci);

  it("vincola durata e unicità del modello, quindi lega la variante solo al suo tenant", async () => {
    const { error: durataErrata } = await A.cli.from("lac_modelli").insert({
      azienda_id: A.aziendaId,
      fornitore: "CooperVision",
      nome: "Durata non ammessa",
      tipologia: "monofocale",
      durata: "settimanale",
    });
    expect(durataErrata?.code).toBe("23514");

    const { error: duplicato } = await A.cli.from("lac_modelli").insert({
      azienda_id: A.aziendaId,
      fornitore: "CooperVision",
      nome: "Biofinity B3",
      tipologia: "monofocale",
      durata: "mensile",
    });
    expect(duplicato?.code).toBe("23505");

    const { error: collega } = await A.cli.from("prodotti").update({ modello_id: modelloA }).eq("id", prodottoA);
    expect(collega).toBeNull();

    const { error: tenantErrato } = await B.cli.from("prodotti").update({ modello_id: modelloA }).eq("id", prodottoB);
    expect(tenantErrato?.code).toBe("23514");
    const { data: b } = await B.cli.from("prodotti").select("modello_id").eq("id", prodottoB).single();
    expect(b!.modello_id).toBeNull();
  });

  it("crea una bolla manuale atomica senza movimento o variazione di giacenza", async () => {
    const { data: bollaId, error } = await A.cli.rpc("crea_bolla_attesa_manuale", {
      p_fornitore: "CooperVision",
      p_prodotto_id: prodottoA,
      p_quantita: 4,
      p_numero_bolla: "MAN-027",
      p_lettera_vettura: "LDV-027",
      p_riferimento_interno: "RIF-027",
    });
    expect(error).toBeNull();
    expect(bollaId).toEqual(expect.any(String));

    const { data: bolla, error: erroreLettura } = await A.cli
      .from("bolle_attese")
      .select("fornitore, numero_bolla, lettera_vettura, riferimento_interno, stato, bolle_attese_righe(prodotto_id, q_attesa, q_caricata)")
      .eq("id", bollaId!)
      .single();
    expect(erroreLettura).toBeNull();
    expect(bolla).toMatchObject({
      fornitore: "CooperVision",
      numero_bolla: "MAN-027",
      lettera_vettura: "LDV-027",
      riferimento_interno: "RIF-027",
      stato: "attesa",
      bolle_attese_righe: [{ prodotto_id: prodottoA, q_attesa: 4, q_caricata: 0 }],
    });

    const { data: prodotto } = await A.cli.from("prodotti").select("giacenza").eq("id", prodottoA).single();
    const { count: movimenti } = await A.cli
      .from("movimenti_magazzino")
      .select("id", { count: "exact", head: true })
      .eq("prodotto_id", prodottoA);
    expect(prodotto!.giacenza).toBe(0);
    expect(movimenti).toBe(0);
  });

  it("ricevimento parziale ed eccesso: la bolla non muove stock, il carico reale sì", async () => {
    const { data: bolla, error: eBolla } = await A.cli
      .from("bolle_attese")
      .insert({ azienda_id: A.aziendaId, fornitore: "CooperVision", riferimento_interno: "OL-B3" })
      .select("id")
      .single();
    expect(eBolla).toBeNull();

    const { data: riga, error: eRiga } = await A.cli
      .from("bolle_attese_righe")
      .insert({
        bolla_id: bolla!.id,
        prodotto_id: prodottoA,
        descrizione: "Biofinity B3",
        q_attesa: 2,
      })
      .select("id, q_attesa, q_caricata")
      .single();
    expect(eRiga).toBeNull();
    expect(riga).toMatchObject({ q_attesa: 2, q_caricata: 0 });

    const { data: prima } = await A.cli.from("prodotti").select("giacenza").eq("id", prodottoA).single();
    expect(prima!.giacenza).toBe(0);

    const { error: ricevi } = await A.cli.rpc("ricevi_riga_bolla", {
      p_riga_id: riga!.id,
      p_quantita: 3,
      p_utente_id: A.userId,
    });
    expect(ricevi).toBeNull();

    const { data: rigaDopo } = await A.cli.from("bolle_attese_righe").select("q_attesa, q_caricata").eq("id", riga!.id).single();
    expect(rigaDopo).toEqual({ q_attesa: 2, q_caricata: 3 });
    const { data: bollaDopo } = await A.cli.from("bolle_attese").select("stato").eq("id", bolla!.id).single();
    expect(bollaDopo).toEqual({ stato: "caricata" });
    const { data: dopo } = await A.cli.from("prodotti").select("giacenza").eq("id", prodottoA).single();
    expect(dopo!.giacenza).toBe(3);
    const { data: movimento } = await A.cli
      .from("movimenti_magazzino")
      .select("tipo, quantita, valore_costo, valore_prezzo")
      .eq("prodotto_id", prodottoA)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(movimento).toEqual({ tipo: "carico", quantita: 3, valore_costo: 9.5, valore_prezzo: 20 });
  });

  it("nega aggiornamenti diretti a quantità ricevuta e stato caricata", async () => {
    const { data: bolla } = await A.cli
      .from("bolle_attese")
      .insert({ azienda_id: A.aziendaId, fornitore: "Guardia B3" })
      .select("id")
      .single();
    const { data: riga } = await A.cli
      .from("bolle_attese_righe")
      .insert({ bolla_id: bolla!.id, prodotto_id: prodottoA, descrizione: "Guardia B3", q_attesa: 1 })
      .select("id")
      .single();

    const { error: quantitaDiretta } = await A.cli
      .from("bolle_attese_righe")
      .update({ q_caricata: 1 })
      .eq("id", riga!.id);
    expect(quantitaDiretta?.code).toBe("23514");

    const { error: statoDiretto } = await A.cli
      .from("bolle_attese")
      .update({ stato: "caricata" })
      .eq("id", bolla!.id);
    expect(statoDiretto?.code).toBe("23514");
  });

  it("registra la causale economica e le due istantanee sullo scarico", async () => {
    const { data: causale } = await A.cli
      .from("causali_magazzino")
      .select("codice, recupera_costo")
      .eq("codice", "reso_fornitore")
      .single();
    expect(causale).toEqual({ codice: "reso_fornitore", recupera_costo: true });

    const { data: movimento, error } = await A.cli
      .from("movimenti_magazzino")
      .insert({
        azienda_id: A.aziendaId,
        prodotto_id: prodottoA,
        tipo: "reso_fornitore",
        quantita: -1,
        causale_codice: "reso_fornitore",
        valore_costo: 9.5,
        valore_prezzo: 20,
        riferimento: "Reso B3",
      })
      .select("causale_codice, valore_costo, valore_prezzo")
      .single();
    expect(error).toBeNull();
    expect(movimento).toEqual({ causale_codice: "reso_fornitore", valore_costo: 9.5, valore_prezzo: 20 });
  });

  it("rifiuta una riga bolla che punta a un prodotto dell'altro tenant", async () => {
    const { data: bolla } = await A.cli
      .from("bolle_attese")
      .insert({ azienda_id: A.aziendaId, fornitore: "Fornitore B3" })
      .select("id")
      .single();
    const { error } = await A.cli.from("bolle_attese_righe").insert({
      bolla_id: bolla!.id,
      prodotto_id: prodottoB,
      descrizione: "Prodotto di altro tenant",
      q_attesa: 1,
    });
    expect(error?.code).toBe("23514");
  });
});
