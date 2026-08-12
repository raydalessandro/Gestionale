import { describe, it, expect } from "vitest";
import matriceReale from "@/docs/regole/permessi.json";
import {
  valutaPermesso,
  type Matrice,
  type ProfiloGrezzo,
} from "@/lib/permessi";

/**
 * L1 · TDD unit — **contratto C2** (`docs/fasi/contratti-B1.md`), una riga per
 * ogni caso della tabella fail-closed. `valutaPermesso` è PURA apposta: qui non
 * c'è né database né sessione, solo la decisione.
 *
 * La regola sovrana di C2 è una sola: **se qualcosa non torna, si NEGA**. Mai
 * «provo», mai default-allow. Ogni test qui sotto è un modo diverso in cui
 * «qualcosa non torna».
 *
 * NOTA sull'ordine dei controlli (differenza rilevata, vedi report-test.md):
 * la tabella C2 elenca `policy_non_disponibile` per ultimo, ma l'implementazione
 * lo valuta per PRIMO (una policy illeggibile nega tutto, anche il non
 * autenticato). Il verdetto è identico — NEGATO in entrambi i casi — cambia solo
 * il `motivo` riportato quando DUE condizioni sono vere insieme. I test qui
 * isolano un caso per volta, così restano validi comunque; l'unico test che
 * fotografa la precedenza lo dichiara esplicitamente.
 */

/* ── Fixture ─────────────────────────────────────────────────────────────── */

const MATRICE: Matrice = matriceReale as unknown as Matrice;

/** Profilo valido di partenza: titolare attivo di un'azienda. */
const TITOLARE: ProfiloGrezzo = {
  id: "11111111-1111-1111-1111-111111111111",
  azienda_id: "22222222-2222-2222-2222-222222222222",
  ruolo: "titolare",
  attivo: true,
};

const profilo = (over: Partial<ProfiloGrezzo> = {}): ProfiloGrezzo => ({ ...TITOLARE, ...over });

describe("C2 · la tabella fail-closed dell'helper permessi (8 righe)", () => {
  it("C2/1 · non autenticato → NEGATO `non_autenticato`", () => {
    const esito = valutaPermesso("vendite", profilo(), MATRICE, false);
    expect(esito.ok).toBe(false);
    expect(esito).toMatchObject({ ok: false, motivo: "non_autenticato" });
  });

  it("C2/2 · autenticato ma senza riga in `utenti` → NEGATO `profilo_mancante`", () => {
    const esito = valutaPermesso("vendite", null, MATRICE, true);
    expect(esito).toMatchObject({ ok: false, motivo: "profilo_mancante" });
  });

  it("C2/3 · `utenti.attivo = false` → NEGATO `utente_disattivato`", () => {
    const esito = valutaPermesso("vendite", profilo({ attivo: false }), MATRICE, true);
    expect(esito).toMatchObject({ ok: false, motivo: "utente_disattivato" });
    // Anche su un permesso aperto a TUTTI i ruoli: il disattivato non passa mai.
    expect(MATRICE.matrice["vendite"]["addetto"]).toBe(true);
  });

  it("C2/4 · ruolo non presente in permessi.json → NEGATO `ruolo_sconosciuto`", () => {
    const esito = valutaPermesso("vendite", profilo({ ruolo: "stagista" }), MATRICE, true);
    expect(esito).toMatchObject({ ok: false, motivo: "ruolo_sconosciuto" });
    expect(MATRICE.ruoli).not.toContain("stagista");
  });

  it("C2/5 · permesso non presente in matrice → NEGATO `permesso_inesistente` (MAI default-allow)", () => {
    // Il permesso è INVENTATO qui, adesso: è esattamente il caso «permesso nuovo
    // che qualcuno ha scritto nell'azione e dimenticato nella policy».
    const inventato = "vola_sulla_luna_col_carrello";
    expect(Object.keys(MATRICE.matrice)).not.toContain(inventato);
    const esito = valutaPermesso(inventato, profilo(), MATRICE, true);
    expect(esito).toMatchObject({ ok: false, motivo: "permesso_inesistente" });
    // Nemmeno al titolare: i permessi nuovi non nascono aperti a nessuno.
    for (const ruolo of MATRICE.ruoli) {
      expect(valutaPermesso(inventato, profilo({ ruolo }), MATRICE, true).ok).toBe(false);
    }
  });

  it("C2/5b · un permesso ereditato da Object.prototype non è un permesso", () => {
    // `matrice["toString"]` esiste sulla catena dei prototipi: senza
    // hasOwnProperty, un'azione che chiedesse «toString» otterrebbe un oggetto
    // truthy e passerebbe al controllo successivo. Deve restare inesistente.
    for (const chiave of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      const esito = valutaPermesso(chiave, profilo(), MATRICE, true);
      expect(esito, `«${chiave}» non è un permesso`).toMatchObject({
        ok: false,
        motivo: "permesso_inesistente",
      });
    }
  });

  it("C2/6 · matrice[permesso][ruolo] ≠ true → NEGATO `non_autorizzato`", () => {
    // Caso vero della policy: l'addetto non fa rettifiche d'inventario.
    expect(MATRICE.matrice["rettifiche_inventario"]["addetto"]).toBe(false);
    const esito = valutaPermesso(
      "rettifiche_inventario",
      profilo({ ruolo: "addetto" }),
      MATRICE,
      true
    );
    expect(esito).toMatchObject({ ok: false, motivo: "non_autorizzato" });
  });

  it("C2/7 · policy illeggibile (matrice null) → NEGATO `policy_non_disponibile`", () => {
    expect(valutaPermesso("vendite", profilo(), null, true)).toMatchObject({
      ok: false,
      motivo: "policy_non_disponibile",
    });
    // Anche una matrice «guscio» (oggetto presente, `matrice` mancante) è una
    // policy non disponibile: è il parse riuscito a metà.
    const guscio = { ruoli: ["titolare"] } as unknown as Matrice;
    expect(valutaPermesso("vendite", profilo(), guscio, true)).toMatchObject({
      ok: false,
      motivo: "policy_non_disponibile",
    });
  });

  it("C2/8 · caso OK → ritorna il contesto verificato {utente_id, azienda_id, ruolo}", () => {
    const esito = valutaPermesso("anonimizzazione", profilo(), MATRICE, true);
    expect(esito.ok).toBe(true);
    if (!esito.ok) return; // narrowing
    expect(esito.contesto).toEqual({
      utente_id: TITOLARE.id,
      azienda_id: TITOLARE.azienda_id,
      ruolo: "titolare",
    });
    // Il contesto NON porta con sé altro: l'azione filtra su azienda_id e basta.
    expect(Object.keys(esito.contesto).sort()).toEqual(["azienda_id", "ruolo", "utente_id"]);
  });
});

describe("C2 · le sfumature del «≠ true» (la casella deve valere esattamente true)", () => {
  /** Matrice sintetica: serve per i valori che la policy vera non contiene. */
  const sintetica = (casella: unknown): Matrice => ({
    ruoli: ["titolare", "responsabile", "ottico", "addetto"],
    matrice: { prova: { titolare: casella } },
  });

  it("una casella `false` NEGA", () => {
    expect(valutaPermesso("prova", profilo(), sintetica(false), true)).toMatchObject({
      ok: false,
      motivo: "non_autorizzato",
    });
  });

  it("una casella MANCANTE nega esattamente come una casella false", () => {
    const senzaRiga: Matrice = {
      ruoli: ["titolare", "responsabile", "ottico", "addetto"],
      // la riga esiste ma non nomina il titolare: silenzio = diniego.
      matrice: { prova: { addetto: true } },
    };
    expect(valutaPermesso("prova", profilo(), senzaRiga, true)).toMatchObject({
      ok: false,
      motivo: "non_autorizzato",
    });
  });

  it('un valore "truthy" non-true NON basta (la stringa "true", 1, {} …)', () => {
    for (const truthy of ["true", "TRUE", "sì", 1, {}, [], "1"]) {
      const esito = valutaPermesso("prova", profilo(), sintetica(truthy), true);
      expect(esito, `il valore ${JSON.stringify(truthy)} non deve autorizzare`).toMatchObject({
        ok: false,
        motivo: "non_autorizzato",
      });
    }
    // …e il booleano vero, invece, passa: la prova che il test non è vacuo.
    expect(valutaPermesso("prova", profilo(), sintetica(true), true).ok).toBe(true);
  });

  it("una casella `null`/`undefined` nega (nessuna interpretazione benevola)", () => {
    expect(valutaPermesso("prova", profilo(), sintetica(null), true).ok).toBe(false);
    expect(valutaPermesso("prova", profilo(), sintetica(undefined), true).ok).toBe(false);
  });

  it("una riga di permesso `null` è un permesso INESISTENTE, non un diniego di ruolo", () => {
    const rigaNulla = {
      ruoli: ["titolare"],
      matrice: { prova: null },
    } as unknown as Matrice;
    expect(valutaPermesso("prova", profilo(), rigaNulla, true)).toMatchObject({
      ok: false,
      motivo: "permesso_inesistente",
    });
  });
});

describe("C2 · precedenza dei controlli e coerenza con la policy vera", () => {
  it("con la policy illeggibile si nega ANCHE il non autenticato (policy_non_disponibile vince)", () => {
    // Fotografia dell'implementazione (vedi nota in testa): il verdetto è
    // comunque NEGATO, cambia solo quale riga di C2 viene riportata.
    const esito = valutaPermesso("vendite", null, null, false);
    expect(esito.ok).toBe(false);
    expect(esito).toMatchObject({ motivo: "policy_non_disponibile" });
  });

  it("il disattivato viene negato PRIMA che si guardi il ruolo o il permesso", () => {
    const esito = valutaPermesso(
      "permesso_che_non_esiste",
      profilo({ ruolo: "marziano", attivo: false }),
      MATRICE,
      true
    );
    expect(esito).toMatchObject({ ok: false, motivo: "utente_disattivato" });
  });

  it("l'anonimizzazione (C1) è concessa a titolare/responsabile e NEGATA a ottico/addetto", () => {
    for (const ruolo of ["titolare", "responsabile"]) {
      expect(valutaPermesso("anonimizzazione", profilo({ ruolo }), MATRICE, true).ok).toBe(true);
    }
    for (const ruolo of ["ottico", "addetto"]) {
      const esito = valutaPermesso("anonimizzazione", profilo({ ruolo }), MATRICE, true);
      expect(esito, `${ruolo} non deve poter anonimizzare`).toMatchObject({
        ok: false,
        motivo: "non_autorizzato",
      });
    }
  });

  it("`anagrafiche_consensi` (il permesso del mastro C3/C4) è aperto ai quattro ruoli", () => {
    for (const ruolo of MATRICE.ruoli) {
      expect(
        valutaPermesso("anagrafiche_consensi", profilo({ ruolo }), MATRICE, true).ok,
        `${ruolo} deve poter raccogliere consensi al banco`
      ).toBe(true);
    }
  });

  it("`prescrizioni` è aperto ai quattro ruoli: l'esaminatore è un filtro, non un divieto", () => {
    for (const ruolo of MATRICE.ruoli) {
      expect(
        valutaPermesso("prescrizioni", profilo({ ruolo }), MATRICE, true).ok,
        `${ruolo} deve poter salvare la scheda Rx M2`
      ).toBe(true);
    }
  });

  it("ogni riga della policy vera nomina TUTTI i ruoli dichiarati (nessun silenzio implicito)", () => {
    // Guardia di coerenza sulla policy: una casella mancante nega (test sopra),
    // ma il diniego dev'essere una SCELTA scritta, non una dimenticanza.
    const buchi: string[] = [];
    for (const [permesso, riga] of Object.entries(MATRICE.matrice)) {
      for (const ruolo of MATRICE.ruoli) {
        if (typeof (riga as Record<string, unknown>)[ruolo] !== "boolean") {
          buchi.push(`${permesso}.${ruolo}`);
        }
      }
    }
    expect(buchi, `caselle non dichiarate in permessi.json: ${buchi.join(", ")}`).toEqual([]);
  });
});
