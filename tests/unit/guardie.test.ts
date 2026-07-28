import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { FONTI, FONTI_MANUALI } from "@/lib/database.types";
import { ETICHETTE_FONTE } from "@/lib/utils";

/**
 * L4 · Guardie statiche — leggono il sorgente dell'app e falliscono se
 * ricompaiono i tre errori che il contratto vieta. Economiche, brutali,
 * efficaci: nessuna rete, girano sempre insieme all'unit.
 *
 * NB (scelta documentata): in lib/utils.ts vive una vecchia `generaNumero()`
 * legacy. La sua DEFINIZIONE è tollerata (è morta finché nessuno la chiama):
 * queste guardie controllano gli USI in lib/actions.ts e in app/, dove la
 * numerazione deve passare SOLO dalla rpc `prossimo_numero`.
 */

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function leggi(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Tutti i file .ts/.tsx sotto una cartella (ricorsivo), esclusi i test. */
function sorgenti(rel: string): string[] {
  const base = join(ROOT, rel);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      const s = statSync(p);
      if (s.isDirectory()) {
        if (nome === "node_modules" || nome === ".next") continue;
        walk(p);
      } else if (/\.(ts|tsx)$/.test(nome)) {
        out.push(p);
      }
    }
  };
  walk(base);
  return out;
}

/**
 * Estrae il testo di ogni chiamata `.metodo({ ... })` bilanciando le graffe,
 * così una guardia può guardare DENTRO il payload e non farsi ingannare da
 * altre graffe sulla riga. Ritorna i corpi (contenuto fra { e } inclusi).
 */
function corpiChiamata(src: string, metodo: string): string[] {
  const corpi: string[] = [];
  const needle = `.${metodo}(`;
  let i = 0;
  while ((i = src.indexOf(needle, i)) !== -1) {
    // trova la prima { dopo la parentesi (se il primo argomento è un oggetto)
    let j = i + needle.length;
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] !== "{") {
      i += needle.length;
      continue;
    }
    let depth = 0;
    let k = j;
    for (; k < src.length; k++) {
      if (src[k] === "{") depth++;
      else if (src[k] === "}") {
        depth--;
        if (depth === 0) {
          k++;
          break;
        }
      }
    }
    corpi.push(src.slice(j, k));
    i = k;
  }
  return corpi;
}

describe("L4 · guardie statiche sul codice applicativo", () => {
  it("G1 · lib/actions.ts non cancella righe di dominio (nessun .delete()) ", () => {
    const src = leggi("lib/actions.ts");
    expect(src).not.toMatch(/\.delete\s*\(/);
  });

  it("G2 · nessun file in lib/ scrive `giacenza` dentro un .update({...})", () => {
    const offensivi: string[] = [];
    for (const file of sorgenti("lib")) {
      const src = readFileSync(file, "utf8");
      for (const corpo of corpiChiamata(src, "update")) {
        if (/\bgiacenza\b/.test(corpo)) {
          offensivi.push(file.replace(ROOT, ""));
        }
      }
    }
    expect(offensivi, `giacenza aggiornata a mano in: ${offensivi.join(", ")}`).toEqual([]);
  });

  it("G3 · la legacy generaNumero() non è usata in lib/actions.ts né in app/", () => {
    const bersagli = ["lib/actions.ts", ...sorgenti("app").map((p) => p.replace(ROOT, ""))];
    const usi: string[] = [];
    for (const rel of bersagli) {
      const src = leggi(rel.replace(/^\//, ""));
      // Uso = chiamata o import del simbolo (non la sua definizione in utils.ts).
      if (/\bgeneraNumero\s*\(/.test(src) || /\bimport\b[^;]*\bgeneraNumero\b/.test(src)) {
        usi.push(rel);
      }
    }
    expect(usi, `generaNumero usata in: ${usi.join(", ")}`).toEqual([]);
  });

  it("G4 · nessun numero ordine BL-/OL- costruito in JS (interpolazione o concatenazione)", () => {
    const bersagli = [
      "lib/actions.ts",
      ...sorgenti("lib").map((p) => p.replace(ROOT, "").replace(/^\//, "")),
      ...sorgenti("app").map((p) => p.replace(ROOT, "").replace(/^\//, "")),
    ];
    const offensivi: string[] = [];
    // Costruzione = prefisso seguito da interpolazione `${` o da concatenazione + .
    const costruzione = /["'`](?:BL|OL)-\s*(?:\$\{|"?\s*\+)/;
    const interpolTemplate = /\b(?:BL|OL)-\$\{/;
    for (const rel of [...new Set(bersagli)]) {
      const src = leggi(rel);
      if (costruzione.test(src) || interpolTemplate.test(src)) {
        offensivi.push(rel);
      }
    }
    expect(offensivi, `numero ordine costruito in JS in: ${offensivi.join(", ")}`).toEqual([]);
  });

  it("G4b · (positiva) la numerazione passa dalla rpc prossimo_numero", () => {
    const src = leggi("lib/actions.ts");
    expect(src).toMatch(/rpc\(\s*["']prossimo_numero["']/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4b · GUARDIE DI COERENZA — colpiscono funzioni fantasma, bottoni mancati e
 * codice morto: componenti mai importati, pagine di moduli attivi irraggiungibili,
 * server action mai referenziate, moduli attivi senza capitolo di manuale.
 *
 * Filosofia: leggono il sorgente (nessuna rete) e scattano sui casi VERI. Dove
 * un controllo simbolo-per-simbolo sarebbe troppo aggressivo, il trade-off è
 * documentato e la guardia è resa tollerante ai falsi positivi noti (primitive
 * del design-system in ui.tsx, mappe di costanti UPPER_CASE, moduli il cui
 * capitolo di manuale è ancora in carico all'agente manuali).
 * ════════════════════════════════════════════════════════════════════════ */

const rel = (p: string) => p.replace(ROOT, "").replace(/^\//, "");

/** Identificatori esportati (function/const/class, anche default). */
function exportNames(src: string): string[] {
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

/** Il simbolo `name` compare in qualche file diverso da `self`? */
function referencedElsewhere(name: string, self: string, files: string[]): boolean {
  const re = new RegExp(`\\b${name}\\b`);
  for (const f of files) {
    if (f === self) continue;
    if (re.test(readFileSync(f, "utf8"))) return true;
  }
  return false;
}

/** Qualche file importa dal modulo che definisce `file` (default import, anche rinominato)? */
function fileImportedSomewhere(file: string, files: string[]): boolean {
  const base = file.replace(ROOT, "").replace(/^\//, "").replace(/\.(ts|tsx)$/, "");
  // base es. "components/WizardVendita" → cerco un import che finisca con quel path.
  const re = new RegExp(`from\\s+["']@?/?${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
  for (const f of files) {
    if (f === file) continue;
    if (re.test(readFileSync(f, "utf8"))) return true;
  }
  return false;
}

describe("L4b · guardie di coerenza (codice morto, orfani, fantasmi)", () => {
  const compFiles = sorgenti("components");
  const tuttoIlCodice = [...sorgenti("app"), ...sorgenti("components"), ...sorgenti("lib")];

  it("G5 · nessun file in components/ è morto (almeno un export usato altrove)", () => {
    const morti: string[] = [];
    for (const f of compFiles) {
      const nomi = exportNames(readFileSync(f, "utf8"));
      const vivo =
        fileImportedSomewhere(f, tuttoIlCodice) ||
        nomi.some((n) => referencedElsewhere(n, f, tuttoIlCodice));
      if (!vivo) morti.push(rel(f));
    }
    expect(morti, `componenti-file mai importati (codice morto): ${morti.join(", ")}`).toEqual([]);
  });

  it("G6 · ogni componente React esportato (PascalCase) è renderizzato/importato da qualche parte", () => {
    // Trade-off documentato: si escludono le primitive del design-system in
    // components/ui.tsx (esistono anche se non ancora usate) e le costanti
    // UPPER_CASE (non sono componenti). Restano i componenti-bottone veri: uno
    // costruito e mai agganciato a una pagina qui scatta.
    const orfani: string[] = [];
    for (const f of compFiles) {
      if (f.endsWith("/ui.tsx")) continue;
      for (const nome of exportNames(readFileSync(f, "utf8"))) {
        if (!/^[A-Z]/.test(nome)) continue; // solo Componenti
        if (/^[A-Z0-9_]+$/.test(nome)) continue; // salta le COSTANTI
        const usato =
          referencedElsewhere(nome, f, tuttoIlCodice) || fileImportedSomewhere(f, tuttoIlCodice);
        if (!usato) orfani.push(`${rel(f)}→${nome}`);
      }
    }
    expect(orfani, `componenti esportati mai usati: ${orfani.join(", ")}`).toEqual([]);
  });

  it("G7 · nessuna pagina di un modulo attivo è orfana (raggiungibile via link/redirect)", () => {
    const modSrc = leggi("lib/modules.ts");
    const oggetti = modSrc.match(/\{[^}]*\}/g) ?? [];
    const hrefAttivi = oggetti
      .filter((o) => /attivo:\s*true/.test(o))
      .map((o) => o.match(/href:\s*"([^"]+)"/)?.[1])
      .filter((h): h is string => Boolean(h));

    // Solo le pagine sotto app/(app)/<modulo>/ (come da ordine di lavoro).
    const pagine = sorgenti("app").filter(
      (f) => /page\.tsx$/.test(f) && rel(f).startsWith("app/(app)/")
    );
    const routeOf = (f: string) => {
      let r = rel(f).replace(/^app\//, "").replace(/\/page\.tsx$/, "");
      r = r.replace(/\([^)]*\)\/?/g, ""); // via i route-group
      return "/" + r.replace(/^\/+/, "");
    };
    const tuttoTesto = tuttoIlCodice.map((f) => readFileSync(f, "utf8")).join("\n");

    const orfane: string[] = [];
    for (const f of pagine) {
      const route = routeOf(f);
      const modulo = hrefAttivi.find((h) => route === h || route.startsWith(h + "/"));
      if (!modulo) continue; // pagina fuori dai moduli attivi: non compete a questa guardia
      if (route === modulo) continue; // indice del modulo: raggiungibile dalla Sidebar

      const segs = route.split("/");
      const dyn = segs.findIndex((s) => s.startsWith("["));
      // Prefisso statico fino al primo segmento dinamico (i dettagli si linkano
      // con `${id}`), oppure la route intera se non ha segmenti dinamici.
      const needle = dyn === -1 ? route : segs.slice(0, dyn).join("/") + "/";
      const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      if (!re.test(tuttoTesto)) orfane.push(`${route} (cerco: ${needle})`);
    }
    expect(orfane, `pagine di moduli attivi non raggiungibili: ${orfane.join(", ")}`).toEqual([]);
  });

  it("G8 · nessuna server action fantasma in lib/actions.ts (ogni export è referenziato)", () => {
    const src = leggi("lib/actions.ts");
    const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)/g;
    const actionsFile = join(ROOT, "lib/actions.ts");
    const fantasma: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const nome = m[1];
      if (!referencedElsewhere(nome, actionsFile, tuttoIlCodice)) fantasma.push(nome);
    }
    expect(fantasma, `server action mai referenziate: ${fantasma.join(", ")}`).toEqual([]);
  });

  it("G9 · ogni modulo attivo ha un capitolo di manuale (allineamento con l'agente manuali)", () => {
    // Mappa modulo → parole-chiave che ne identificano il capitolo nel nome file.
    const SINONIMI: Record<string, string[]> = {
      dashboard: ["benvenuto", "dashboard", "home"],
      clienti: ["clienti"],
      prescrizioni: ["prescrizioni"],
      ordini: ["ordini", "buste"],
      magazzino: ["magazzino"],
      agenda: ["agenda"],
      richiami: ["richiami"],
      cassa: ["cassa", "vendite", "vendita"],
    };
    // Allowlist DOCUMENTATA: capitoli ancora in carico all'agente manuali (Fasi
    // 3–4). È un gancio reale, non un falso positivo → vedi report-test.md. La
    // guardia resta verde su questi, ma scatta su QUALSIASI nuovo modulo attivo
    // senza capitolo e non elencato qui.
    // I capitoli di agenda/richiami/cassa ora esistono: la guardia li verifica.
    // Aggiungere qui SOLO moduli attivi il cui capitolo è temporaneamente in
    // carico all'agente manuali (allowlist esplicita, si svuota appena scritto).
    const IN_CARICO_MANUALI = new Set<string>([]);

    const modSrc = leggi("lib/modules.ts");
    const oggetti = modSrc.match(/\{[^}]*\}/g) ?? [];
    const attivi = oggetti
      .filter((o) => /attivo:\s*true/.test(o))
      .map((o) => o.match(/id:\s*"([^"]+)"/)?.[1])
      .filter((id): id is string => Boolean(id));

    const capitoli = readdirSync(join(ROOT, "docs/manuale-utente")).join("\n").toLowerCase();
    const scoperti: string[] = [];
    for (const id of attivi) {
      if (IN_CARICO_MANUALI.has(id)) continue;
      const kw = SINONIMI[id] ?? [id];
      if (!kw.some((k) => capitoli.includes(k))) scoperti.push(id);
    }
    expect(
      scoperti,
      `moduli attivi senza capitolo di manuale (né in allowlist): ${scoperti.join(", ")}`
    ).toEqual([]);
  });

  it("G10 · una sola formula di quadratura: i consumatori importano lib/cassa-calcoli, non la ricalcolano", () => {
    // Audit A3 (Fase 4c): chiusura serale e homepage /cassa devono usare la
    // STESSA formula pura di lib/cassa-calcoli, così il numero non litiga mai
    // con se stesso. Guardia: i tre consumatori noti importano `sistemaPerMetodo`
    // da cassa-calcoli e nessuno reimplementa a mano l'esclusione della voce
    // 'Caparra' (il tranello classico dell'audit).
    const consumatori = [
      "app/(app)/cassa/page.tsx",
      "app/(app)/cassa/chiusura/page.tsx",
      "lib/actions.ts",
    ];
    const senzaImport: string[] = [];
    const reimplementano: string[] = [];
    for (const rel of consumatori) {
      const src = leggi(rel);
      if (!/from\s+["']@\/lib\/cassa-calcoli["']/.test(src)) senzaImport.push(rel);
      if (!/\bsistemaPerMetodo\b/.test(src)) senzaImport.push(rel);
      // reimplementazione = confronto letterale con la voce 'Caparra' fuori dal modulo pure
      if (/["'`]caparra["'`]\s*(?:===|==|\.includes|\.toLowerCase)/i.test(src)) {
        reimplementano.push(rel);
      }
    }
    expect(senzaImport, `consumatori che non usano cassa-calcoli: ${senzaImport.join(", ")}`).toEqual([]);
    expect(
      reimplementano,
      `consumatori che reimplementano l'esclusione 'Caparra' a mano: ${reimplementano.join(", ")}`
    ).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4c · GUARDIA ANTI-REGRESSIONE NEXT 16 (rename middleware → proxy)
 *
 * Rischio catastrofico e SILENZIOSO di Next 16: se qualcuno reintroduce
 * `middleware.ts` o rinomina l'export, Next 16 (che cerca l'export `proxy`)
 * smette di eseguire la protezione delle rotte SENZA alcun errore: nessun test
 * di prodotto diventa rosso, ma l'app resta aperta a chiunque. Questa guardia è
 * l'unica sentinella su quel rename: legge i file alla radice e scatta se la
 * forma corretta (proxy.ts + export proxy + matcher + 3 rotte pubbliche) viene
 * meno. È deliberatamente severa sui path.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4c · guardia anti-regressione sul rename proxy (Next 16)", () => {
  it("G11 · proxy.ts esiste alla radice e middleware.ts NON esiste (Next 16)", () => {
    const haProxy = existsSync(join(ROOT, "proxy.ts"));
    // Copre sia .ts sia .js: entrambi verrebbero raccolti da Next come
    // middleware, quindi entrambi sono vietati dopo il codemod.
    const haMiddleware =
      existsSync(join(ROOT, "middleware.ts")) || existsSync(join(ROOT, "middleware.js"));
    expect(haProxy, "manca proxy.ts alla radice: Next 16 non protegge più le rotte").toBe(true);
    expect(
      haMiddleware,
      "è ricomparso middleware.ts/js: Next 16 lo ignora e la protezione rotte salta in silenzio"
    ).toBe(false);
  });

  it("G11b · proxy.ts esporta la funzione `proxy` (l'export che Next 16 cerca)", () => {
    const src = leggi("proxy.ts");
    // `export [default] [async] function proxy(` — la firma richiesta da Next 16.
    expect(
      /export\s+(?:default\s+)?(?:async\s+)?function\s+proxy\s*\(/.test(src),
      "proxy.ts non esporta più `function proxy(`: Next 16 non aggancia il middleware"
    ).toBe(true);
    // Difesa esplicita contro il ritorno all'export legacy `middleware`.
    expect(
      /export\s+(?:default\s+)?(?:async\s+)?function\s+middleware\s*\(/.test(src),
      "proxy.ts esporta ancora `function middleware(`: export legacy, Next 16 lo ignora"
    ).toBe(false);
  });

  it("G11c · proxy.ts mantiene il matcher e le tre rotte pubbliche (protezione invariata)", () => {
    const src = leggi("proxy.ts");
    // Il matcher deve restare: senza, il middleware non gira su nessuna rotta.
    expect(/\bmatcher\b/.test(src), "manca il `matcher` in proxy.ts").toBe(true);
    // Le tre e SOLE rotte pubbliche restano tali: se una sparisse, verrebbe
    // protetta (utenti bloccati fuori); il rischio inverso — renderne pubblica
    // una nuova — non è oggetto di questa guardia.
    for (const rotta of ["/login", "/registrati", "/auth"]) {
      expect(
        src.includes(`"${rotta}"`),
        `rotta pubblica ${rotta} non più elencata in proxy.ts`
      ).toBe(true);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4d · GUARDIE VOCABOLARIO `fonte` (G3 + G3-bis)
 *
 * Il vocabolario `fonte` vive in posti che DEVONO combaciare:
 *   • i check SQL delle migrazioni 008/009 (la verità del DB), su QUATTRO
 *     colonne: clienti, appuntamenti, ordini_lac, ordini_occhiali;
 *   • la costante FONTI in lib/database.types.ts (la verità del codice);
 *   • le mappe derivate (etichette, tinte, form).
 * Se divergono in silenzio, il DB rifiuta un valore che l'app mostra, o l'app
 * mostra un'etichetta grezza per un valore che il DB accetta. Queste guardie
 * legano i posti: aggiungere una fonte senza aggiornarli tutti diventa rosso.
 * G12b/G12c non leggono file — confrontano i valori importati, così scattano
 * anche su un refuso nelle chiavi. G12e è la sentinella sul CONTO delle colonne:
 * una quinta colonna `fonte` senza guardia la fa diventare rossa.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4d · guardie vocabolario fonte", () => {
  /** Estrae la lista `fonte in ('a','b',…)` di un check da un file di migrazione. */
  function fontiDalCheck(nomeVincolo: string, file = "supabase/migrazioni/008_sicurezza_tenant.sql"): string[] {
    const sql = leggi(file);
    const re = new RegExp(
      `constraint\\s+${nomeVincolo}\\s+check\\s*\\(\\s*fonte\\s+in\\s*\\(([^)]*)\\)`,
      "i"
    );
    const m = sql.match(re);
    if (!m) throw new Error(`check ${nomeVincolo} non trovato in ${file}`);
    return m[1]
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
  }

  it("G12 · FONTI (codice) combacia col check SQL di clienti e appuntamenti (008)", () => {
    // Ordine compreso: il commento in database.types.ts promette «stesso ordine
    // del check», così il confronto a occhio in review è affidabile.
    const daClienti = fontiDalCheck("clienti_fonte_check");
    const daAppuntamenti = fontiDalCheck("appuntamenti_fonte_check");
    expect(daClienti, "clienti_fonte_check ≠ FONTI").toEqual([...FONTI]);
    expect(daAppuntamenti, "appuntamenti_fonte_check ≠ FONTI").toEqual([...FONTI]);
    // 'sito' è stato ritirato: non deve ricomparire nel vocabolario.
    expect(FONTI as readonly string[]).not.toContain("sito");
  });

  it("G12b · ETICHETTE_FONTE ha esattamente le chiavi di FONTI (nessuna in più, nessuna in meno)", () => {
    const chiavi = Object.keys(ETICHETTE_FONTE).sort();
    expect(chiavi, "le chiavi di ETICHETTE_FONTE non combaciano con FONTI").toEqual(
      [...FONTI].sort()
    );
    // Nessuna etichetta vuota: ogni fonte ha un nome «da banco».
    for (const f of FONTI) {
      expect(ETICHETTE_FONTE[f]?.length, `etichetta vuota per ${f}`).toBeGreaterThan(0);
    }
  });

  it("G12c · FONTI_MANUALI è un sottoinsieme di FONTI e non include le fonti di sistema", () => {
    for (const f of FONTI_MANUALI) {
      expect(FONTI as readonly string[], `${f} manuale non è in FONTI`).toContain(f);
    }
    // Le fonti assegnate dal sistema non devono essere scegliibili a mano.
    for (const sistema of ["qr_vetrina", "sito_negozio", "portale", "app"]) {
      expect(
        FONTI_MANUALI as readonly string[],
        `${sistema} è di sistema: non deve stare fra le fonti manuali`
      ).not.toContain(sistema);
    }
  });

  it("G12d · il check SQL degli ordini (009) è FONTI meno 'import'", () => {
    // Gli ordini non si importano: il vocabolario è FonteOrdine = Exclude<Fonte,'import'>.
    const attese = [...FONTI].filter((f) => f !== "import");
    const M09 = "supabase/migrazioni/009_fonte_ordini.sql";
    const daLac = fontiDalCheck("ordini_lac_fonte_check", M09);
    const daOcchiali = fontiDalCheck("ordini_occhiali_fonte_check", M09);
    expect(daLac, "ordini_lac_fonte_check ≠ FONTI∖import").toEqual(attese);
    expect(daOcchiali, "ordini_occhiali_fonte_check ≠ FONTI∖import").toEqual(attese);
    // 'sito' ritirato anche qui: non deve ricomparire.
    expect(daLac).not.toContain("sito");
    expect(daOcchiali).not.toContain("sito");
  });

  it("G12f · il check `fonte` delle prenotazioni (011) è l'intero vocabolario FONTI", () => {
    // La prenotazione può entrare da qualunque porta: vocabolario pieno.
    const sql = leggi("supabase/migrazioni/011_prenotazioni.sql");
    const m = sql.match(/check\s*\(\s*fonte\s+in\s*\(([^)]*)\)/i);
    expect(m, "check fonte delle prenotazioni non trovato in 011").toBeTruthy();
    const valori = m![1]
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    expect(valori, "prenotazioni.fonte ≠ FONTI").toEqual([...FONTI]);
  });

  it("G12e · ogni colonna `fonte` con un check nel DB è coperta da una guardia (conto delle colonne)", () => {
    // La lezione di G3-bis: il conto delle colonne `fonte` non deve più vivere
    // nella memoria di qualcuno. Scandaglio schema.sql + tutte le migrazioni,
    // trovo ogni `check (fonte in (...))` e ne ricavo la tabella (dal più vicino
    // `create/alter table public.<tab>` che lo precede). L'insieme trovato deve
    // combaciare ESATTAMENTE con quello asserito da G12 (clienti, appuntamenti),
    // G12d (ordini) e G12f (prenotazioni). Una colonna nuova senza guardia
    // allarga l'insieme trovato → rosso: costringe ad aggiungere la guardia.
    const GUARDATE = ["appuntamenti", "clienti", "ordini_lac", "ordini_occhiali", "prenotazioni"];

    const filesSql = [
      "supabase/schema.sql",
      ...readdirSync(join(ROOT, "supabase/migrazioni"))
        .filter((n) => n.endsWith(".sql"))
        .map((n) => `supabase/migrazioni/${n}`),
    ];

    const trovate = new Set<string>();
    const reCheck = /check\s*\(\s*fonte\s+in\s*\(/gi;
    const reTab = /(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi;
    for (const f of filesSql) {
      const src = leggi(f);
      let m: RegExpExecArray | null;
      while ((m = reCheck.exec(src))) {
        const before = src.slice(0, m.index);
        let t: RegExpExecArray | null;
        let ultima: string | undefined;
        reTab.lastIndex = 0;
        while ((t = reTab.exec(before))) ultima = t[1];
        if (ultima) trovate.add(ultima);
      }
    }

    expect(
      [...trovate].sort(),
      `colonne 'fonte' con check nel DB diverse da quelle guardate: ` +
        `trovate=[${[...trovate].sort().join(", ")}] guardate=[${GUARDATE.join(", ")}]. ` +
        `Se ne è nata una nuova, aggiungi la sua guardia (come G12/G12d) e mettila qui.`
    ).toEqual(GUARDATE);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4e · GUARDIE PORTALE PUBBLICO (G4)
 *
 * Il portale apre al pubblico la prima pagina del progetto. Tre invarianti che,
 * se si rompono in silenzio, fanno danni opposti e gravi:
 *   • G13  — l'elenco delle rotte pubbliche è ESATTAMENTE quello atteso: una
 *            rotta pubblica in più (o in meno) è una scelta di sicurezza, non
 *            un `||` che nessuno nota;
 *   • G13b — il portale dichiara `index: true` mentre il resto dell'app resta
 *            `index: false`: senza, la vetrina nasce invisibile (o, al contrario,
 *            si aprirebbe l'intera app all'indicizzazione);
 *   • G13c — i token Tailwind del gestionale hanno ANCORA i valori di prima,
 *            valore per valore, e lo spazio `lim` esiste separato.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4e · guardie portale pubblico", () => {
  // Estrae un array letterale `NOME = [ ... ]` da proxy.ts come lista di stringhe.
  const arrayLetterale = (src: string, nome: string): string[] => {
    const m = src.match(new RegExp(`${nome}\\s*=\\s*\\[([^\\]]*)\\]`));
    expect(m, `${nome} non trovato o non è un array letterale in proxy.ts`).toBeTruthy();
    return m![1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  };

  it("G13 · ROTTE_PUBBLICHE (prefissi) è esattamente [/login,/registrati,/auth,/ottica,/informativa]", () => {
    const src = leggi("proxy.ts");
    // Prefissi pubblici: aggiungerne uno è una scelta di sicurezza deliberata.
    // `/informativa` è pubblica (Checkpoint): l'anonimo che prenota la deve poter aprire.
    expect(arrayLetterale(src, "ROTTE_PUBBLICHE"), "l'elenco dei prefissi pubblici è cambiato").toEqual([
      "/login",
      "/registrati",
      "/auth",
      "/ottica",
      "/informativa",
    ]);
    // La radice «/» è pubblica per corrispondenza ESATTA, non come prefisso (un
    // prefisso «/» aprirebbe tutta l'app). Vive in un array a parte, sorvegliato.
    expect(arrayLetterale(src, "ROTTE_PUBBLICHE_ESATTE"), "l'elenco delle rotte esatte è cambiato").toEqual(["/"]);
    // Difesa esplicita: la vecchia catena di || scritta a mano non deve tornare.
    expect(
      /isPublic\s*=\s*\n?\s*path\.startsWith\([^)]*\)\s*\|\|/.test(src),
      "il controllo pubblico è tornato a una catena di || scritta a mano"
    ).toBe(false);
  });

  it("G13b · il portale dichiara index:true, la radice resta index:false", () => {
    const portale = leggi("app/(portale)/layout.tsx");
    const radice = leggi("app/layout.tsx");
    // normalizzo gli spazi per non dipendere dalla formattazione.
    const compatta = (s: string) => s.replace(/\s+/g, "");
    expect(
      compatta(portale).includes("robots:{index:true,follow:true}"),
      "il layout del portale non sovrascrive più robots a index:true"
    ).toBe(true);
    expect(
      compatta(radice).includes("robots:{index:false,follow:false}"),
      "il layout radice non è più index:false: rischio di indicizzare tutta l'app"
    ).toBe(true);
  });

  it("G13c · i token Tailwind preesistenti sono invariati e lo spazio `lim` esiste", () => {
    const src = leggi("tailwind.config.ts");
    const compatta = src.replace(/\s+/g, "");
    // Ogni token del gestionale, valore per valore: se qualcuno ne cambia uno,
    // rompe qui (la consegna vieta di toccarli «nemmeno una virgola»).
    const attesi: [string, string][] = [
      ["carta", "#FAF7F2"],
      ["inchiostro", "#1C1714"],
      ["linea", "#E7DFD2"],
      ["soft", "#6B5D50"],
      ["faint", "#B9AA97"],
    ];
    for (const [nome, val] of attesi) {
      expect(compatta.includes(`${nome}:"${val}"`), `token ${nome} cambiato o mancante`).toBe(true);
    }
    // ottone e gli stati (oggetti con DEFAULT/soft/scuro)
    for (const frag of [
      'ottone:{DEFAULT:"#A67C42"',
      'soft:"#EFE4D3"',
      'scuro:"#8A6533"',
      'verde:{DEFAULT:"#127E7A",soft:"#E2F0EE"}',
      'ambra:{DEFAULT:"#C98A2B",soft:"#F7EEDD"}',
      'blu:{DEFAULT:"#5B6DA8",soft:"#E7EAF6"}',
      'rosso:{DEFAULT:"#B0483F",soft:"#F6E4E2"}',
    ]) {
      expect(compatta.includes(frag), `frammento token cambiato o mancante: ${frag}`).toBe(true);
    }
    // Lo spazio di nomi separato del portale esiste e ha valori Limpidia (diversi).
    expect(compatta.includes('lim:{'), "manca lo spazio colori `lim` del portale").toBe(true);
    expect(compatta.includes('carta:"#F2F2F0"'), "lim.carta (Limpidia) mancante").toBe(true);
    expect(compatta.includes('inchiostro:"#171512"'), "lim.inchiostro (Limpidia) mancante").toBe(true);
    // Prova che i due spazi NON collidono: carta gestionale ≠ carta Limpidia.
    expect("#FAF7F2").not.toBe("#F2F2F0");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4f · GUARDIE PORTALE — orari/servizi/chiusure (G5, migrazione 010)
 *
 * Supabase concede `select` ad anon per default su ogni tabella nuova: se la 010
 * non revocasse esplicitamente, orari/servizi/chiusure nascerebbero leggibili da
 * chiunque. Queste guardie leggono il file di migrazione e scattano se salta la
 * chiusura (RLS + revoke) o se la vista delle chiusure torna a esporre il motivo.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4f · guardie portale orari/servizi (010)", () => {
  const M010 = "supabase/migrazioni/010_orari_servizi.sql";
  // Le tabelle create dalla 010: tutte con RLS attiva e select revocata ad anon.
  const TABELLE_010 = ["servizi", "negozi_servizi", "orari_apertura", "chiusure", "blocchi_slot"];

  it("G14 · ogni tabella nuova della 010 ha RLS attiva e revoke select ad anon", () => {
    const sql = leggi(M010);
    const compatta = sql.replace(/\s+/g, " ").toLowerCase();
    const senzaRls: string[] = [];
    const senzaRevoke: string[] = [];
    for (const t of TABELLE_010) {
      if (!compatta.includes(`alter table public.${t} enable row level security`)) senzaRls.push(t);
      if (!compatta.includes(`revoke select on public.${t} from anon`)) senzaRevoke.push(t);
    }
    expect(senzaRls, `tabelle senza RLS: ${senzaRls.join(", ")}`).toEqual([]);
    expect(senzaRevoke, `tabelle senza revoke ad anon: ${senzaRevoke.join(", ")}`).toEqual([]);
    // blocchi_slot non deve avere una vista pubblica (i buchi non si mostrano).
    expect(
      /create\s+(or\s+replace\s+)?view\s+public\.\w*blocch/i.test(sql),
      "blocchi_slot non deve avere una vista pubblica"
    ).toBe(false);
  });

  it("G14b · la vista chiusure_pubbliche NON espone la colonna `motivo`", () => {
    const sql = leggi(M010);
    // isolo il corpo della vista chiusure_pubbliche (dal create al ; successivo).
    const m = sql.match(/create\s+or\s+replace\s+view\s+public\.chiusure_pubbliche[\s\S]*?;/i);
    expect(m, "vista chiusure_pubbliche non trovata nella 010").toBeTruthy();
    expect(
      /\bmotivo\b/i.test(m![0]),
      "chiusure_pubbliche espone `motivo`: è un fatto interno del negozio, non della vetrina"
    ).toBe(false);
    // ma le colonne di vetrina ci sono.
    for (const col of ["slug", "dal", "al"]) {
      expect(m![0].toLowerCase().includes(col), `chiusure_pubbliche non espone ${col}`).toBe(true);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4g · GUARDIE PORTALE — prenotazioni e persone (G6, migrazione 011)
 *
 * La parte più delicata del portale: `persone` è di Limpidia e NESSUNO la legge
 * (nemmeno l'ottico), il registro dei riferimenti è append-only, e slot_liberi
 * è l'unico modo per cui l'anon calcola gli slot senza leggere le tabelle. Se
 * una di queste regole salta in silenzio, si apre un buco su dati di identità.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4g · guardie portale prenotazioni/persone (011)", () => {
  const M011 = "supabase/migrazioni/011_prenotazioni.sql";
  const TABELLE = ["persone", "prenotazioni", "persone_riferimento_registro", "lista_attesa"];

  it("G15 · le 4 tabelle nuove hanno RLS attiva e revoke select ad anon", () => {
    const sql = leggi(M011).replace(/\s+/g, " ").toLowerCase();
    const senzaRls: string[] = [];
    const senzaRevoke: string[] = [];
    for (const t of TABELLE) {
      if (!sql.includes(`alter table public.${t} enable row level security`)) senzaRls.push(t);
      if (!sql.includes(`revoke select on public.${t} from anon`)) senzaRevoke.push(t);
    }
    expect(senzaRls, `senza RLS: ${senzaRls.join(", ")}`).toEqual([]);
    expect(senzaRevoke, `senza revoke anon: ${senzaRevoke.join(", ")}`).toEqual([]);
  });

  it("G15b · persone e il registro NON hanno policy di lettura (nessuno legge, solo security definer)", () => {
    const sql = leggi(M011);
    // `create policy ... on public.persone` con confine di parola (non _registro)
    expect(
      /create\s+policy[\s\S]*?on\s+public\.persone(?![_\w])/i.test(sql),
      "persone ha una policy: DEVE restare senza policy (ci arrivano solo le funzioni security definer)"
    ).toBe(false);
    expect(
      /create\s+policy[\s\S]*?on\s+public\.persone_riferimento_registro/i.test(sql),
      "il registro ha una policy: DEVE restare senza policy"
    ).toBe(false);
    // prenotazioni e lista_attesa invece la policy ce l'hanno.
    expect(/create\s+policy[\s\S]*?on\s+public\.prenotazioni/i.test(sql)).toBe(true);
    expect(/create\s+policy[\s\S]*?on\s+public\.lista_attesa/i.test(sql)).toBe(true);
  });

  it("G15c · slot_liberi è security definer ed eseguibile da anon (l'unico ponte)", () => {
    const sql = leggi(M011).toLowerCase();
    expect(/create\s+or\s+replace\s+function\s+public\.slot_liberi[\s\S]*?security\s+definer/i.test(leggi(M011)))
      .toBe(true);
    expect(
      sql.includes("grant execute on function public.slot_liberi"),
      "manca il grant execute di slot_liberi ad anon"
    ).toBe(true);
    expect(/grant\s+execute\s+on\s+function\s+public\.slot_liberi[^;]*\banon\b/i.test(leggi(M011))).toBe(true);
  });

  it("G15d · niente cancellazione fisica: prenotazioni no-delete, registro append-only", () => {
    const sql = leggi(M011);
    // trigger before delete su prenotazioni
    expect(
      /before\s+delete\s+on\s+public\.prenotazioni/i.test(sql),
      "manca il trigger che vieta la delete su prenotazioni"
    ).toBe(true);
    // trigger before update OR delete sul registro
    expect(
      /before\s+update\s+or\s+delete\s+on\s+public\.persone_riferimento_registro/i.test(sql),
      "il registro non è protetto append-only (before update or delete)"
    ).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4h · GUARDIE SCRITTURA PRENOTAZIONE (G7 · migrazione 012)
 *
 * La prima SCRITTURA del portale. `crea_prenotazione` è SECURITY DEFINER ed
 * eseguibile da anon: se il BROWSER la chiamasse direttamente, il rate limit
 * (che vive solo nell'azione server) sarebbe aggirabile e avremmo un modulo di
 * spam col nostro marchio. L'invariante d'architettura: la RPC di scrittura si
 * INVOCA solo da un file server (`"use server"`), mai da un componente client né
 * dal modulo di sola lettura degli slot. La guardia distingue l'INVOCAZIONE
 * (`rpc("crea_prenotazione"…)`) dalla semplice menzione in un commento — così i
 * commenti che spiegano «il browser non la chiama mai» non la fanno scattare.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4h · guardia scrittura prenotazione (012)", () => {
  // L'INVOCAZIONE vera e propria: `.rpc("crea_prenotazione"` (virgolette singole
  // o doppie, spazi tollerati). NON matcha una menzione in un commento.
  const RE_INVOCA = /\.rpc\(\s*["']crea_prenotazione["']/;

  it("G16 · `crea_prenotazione` si INVOCA solo da un file server (\"use server\"), mai da un client", () => {
    const files = [...sorgenti("app"), ...sorgenti("components"), ...sorgenti("lib")];
    const violazioni: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!RE_INVOCA.test(src)) continue;
      const isServer = /^\s*["']use server["'];?/m.test(src);
      const isClient = /^\s*["']use client["'];?/m.test(src);
      // deve stare in un modulo server e MAI in un componente client.
      if (isClient || !isServer) violazioni.push(rel(f));
    }
    expect(
      violazioni,
      `crea_prenotazione invocata fuori da un file server (o da un client): ${violazioni.join(", ")}`
    ).toEqual([]);
  });

  it("G16b · l'azione server della prenotazione esiste, è \"use server\" e invoca la RPC", () => {
    const azioni = leggi("app/(portale)/ottica/[slug]/prenota/azioni.ts");
    expect(/^\s*["']use server["'];?/m.test(azioni), "azioni.ts non è più \"use server\"").toBe(true);
    expect(RE_INVOCA.test(azioni), "azioni.ts non invoca più crea_prenotazione").toBe(true);
    // e la porta d'ingresso dal browser è la server action, non la RPC.
    expect(azioni).toMatch(/export\s+async\s+function\s+inviaPrenotazione/);
  });

  it("G16c · il percorso guidato (client) chiama inviaPrenotazione e NON invoca la RPC di scrittura", () => {
    const wiz = leggi("app/(portale)/ottica/[slug]/prenota/WizardPrenota.tsx");
    expect(/^\s*["']use client["'];?/m.test(wiz), "WizardPrenota non è più un client component").toBe(true);
    expect(wiz.includes("inviaPrenotazione"), "il wizard non passa più dall'azione server").toBe(true);
    expect(RE_INVOCA.test(wiz), "il wizard invoca crea_prenotazione dal browser (rate limit aggirabile!)").toBe(false);
    // il modulo di SOLA LETTURA degli slot non deve scrivere.
    const slot = leggi("lib/portale/slot.ts");
    expect(RE_INVOCA.test(slot), "lib/portale/slot.ts invoca la RPC di scrittura: è di sola lettura").toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4i · GUARDIE AGENDA UNICA (G17 · migrazione 013)
 *
 * La 013 accentra la decisione «lo slot è occupato?» su UN posto solo:
 * `appuntamenti` È LO SLOT, `prenotazioni` è la pratica. Il rischio silenzioso è
 * la RECIDIVA: se `slot_liberi` tornasse a interrogare `prenotazioni`, o se
 * l'EXCLUDE di appuntamenti perdesse lo stato `in_attesa` o il per-risorsa, si
 * riaprirebbe la doppia-agenda (portale e banco che si calpestano) senza che un
 * test di prodotto diventi rosso. Queste guardie leggono la 013 e la blindano.
 * ════════════════════════════════════════════════════════════════════════ */
// Enforce dove la 013 è nel working tree (il suo branch e la CI dopo il merge).
// Su un checkpoint parallelo che non la porta ancora, si salta pulito (npm test
// resta verde): l'enforcement rientra da solo appena il file è presente.
const M013 = "supabase/migrazioni/013_agenda_unica.sql";
describe.skipIf(!existsSync(join(ROOT, M013)))("L4i · guardie agenda unica (013)", () => {

  /** Corpo della funzione slot_liberi definita nella 013 (dal create al $$;). */
  function corpoSlotLiberi013(): string {
    const sql = leggi(M013);
    const start = sql.indexOf("create or replace function public.slot_liberi");
    expect(start, "la 013 deve ridefinire slot_liberi").toBeGreaterThanOrEqual(0);
    const rest = sql.slice(start);
    const end = rest.indexOf("$$;");
    expect(end, "corpo di slot_liberi non terminato").toBeGreaterThan(0);
    return rest.slice(0, end);
  }

  it("G17 · la nuova slot_liberi (013) NON nomina più `prenotazioni` (un posto solo)", () => {
    const corpo = corpoSlotLiberi013();
    expect(
      /\bprenotazioni\b/i.test(corpo),
      "slot_liberi torna a interrogare prenotazioni: la doppia-agenda è di nuovo aperta"
    ).toBe(false);
    // ma continua a guardare gli appuntamenti occupanti (in_attesa incluso).
    expect(/\bappuntamenti\b/i.test(corpo), "slot_liberi deve guardare appuntamenti").toBe(true);
    expect(
      /in_attesa[^)]*prenotato[^)]*completato/i.test(corpo),
      "gli stati occupanti in slot_liberi devono includere in_attesa/prenotato/completato"
    ).toBe(true);
  });

  it("G17b · la 013 dichiara `appuntamenti.risorsa_id uuid` e lo stato `in_attesa`", () => {
    const sql = leggi(M013);
    expect(
      /add column if not exists risorsa_id uuid/i.test(sql),
      "manca l'aggiunta di appuntamenti.risorsa_id uuid"
    ).toBe(true);
    // il check di stato deve elencare in_attesa fra i valori ammessi.
    const m = sql.match(/appuntamenti_stato_check\s+check\s*\(\s*stato\s+in\s*\(([^)]*)\)/i);
    expect(m, "check di stato appuntamenti non trovato nella 013").toBeTruthy();
    const stati = m![1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
    expect(stati, "in_attesa deve entrare fra gli stati di appuntamenti").toContain("in_attesa");
  });

  it("G17c · l'EXCLUDE di appuntamenti è per-risorsa (coalesce) e sugli stati occupanti", () => {
    const sql = leggi(M013);
    // Isolo l'INTERO statement `add constraint … exclude … ;` (fino al primo `;`):
    // nel corpo dell'EXCLUDE non ci sono punti e virgola, così la cattura è netta.
    const m = sql.match(/add constraint appuntamenti_niente_sovrapposizioni\s+exclude[\s\S]*?;/i);
    expect(m, "vincolo appuntamenti_niente_sovrapposizioni non trovato nella 013").toBeTruthy();
    const blocco = m![0];
    expect(
      /coalesce\(\s*risorsa_id\s*,\s*azienda_id\s*\)/i.test(blocco),
      "l'EXCLUDE deve essere per-risorsa (coalesce(risorsa_id, azienda_id))"
    ).toBe(true);
    expect(
      /where\s*\(\s*stato\s+in\s*\(\s*'in_attesa'\s*,\s*'prenotato'\s*,\s*'completato'\s*\)/i.test(blocco),
      "l'EXCLUDE deve valere solo sugli stati occupanti in_attesa/prenotato/completato"
    ).toBe(true);
  });

  it("G17d · `prenotazioni` smette di governare gli slot: EXCLUDE rimosso, appuntamento_id NOT NULL", () => {
    const sql = leggi(M013);
    expect(
      /drop constraint if exists prenotazioni_niente_sovrapposizioni/i.test(sql),
      "la 013 deve rimuovere l'EXCLUDE di prenotazioni (non governa più lo slot)"
    ).toBe(true);
    expect(
      /alter column appuntamento_id set not null/i.test(sql),
      "prenotazioni.appuntamento_id deve diventare NOT NULL (ogni pratica ha il suo slot)"
    ).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4l · GUARDIE LE SALE (G18 · migrazione 014)
 *
 * La 014 porta `risorsa_id` a prima classe: l'appuntamento è di una SALA, la
 * sala è del negozio. I due pezzi che la 013 aveva appena riscritto (l'EXCLUDE
 * di `appuntamenti` e `slot_liberi`) cambiano di nuovo, e stavolta la «cucitura»
 * `coalesce(risorsa_id, azienda_id)` sparisce perché `risorsa_id` è ora NOT NULL.
 * I rischi silenziosi che queste guardie blindano:
 *   • la tabella `risorse` nasce leggibile da anon (Supabase concede select di
 *     default): senza il `revoke`, le sale di un negozio sarebbero pubbliche;
 *   • il trigger `crea_sala_default` salta e un negozio nasce senza sala → il
 *     NOT NULL su `appuntamenti.risorsa_id` romperebbe ogni creazione;
 *   • l'EXCLUDE torna per-azienda (o riappare il coalesce) riaprendo il falso
 *     «occupato» quando un'altra sala è libera;
 *   • `slot_liberi` smette di consultare `risorse` (torna a decidere per negozio).
 *
 * Gated su `existsSync(014)`: enforca sul branch/CI che porta la 014, salta
 * pulito altrove. NON tocca il blocco L4i/G17 della 013 (che legge la 013, dove
 * il `coalesce` è storia e resta com'è).
 *
 * Trade-off documentato (vedi report-test.md): `slot_liberi` continua a usare un
 * `coalesce(ns.durata_minuti, s.durata_predefinita_minuti)` LEGITTIMO per la
 * durata del servizio. La guardia G18e non vieta ogni `coalesce`, ma solo quello
 * PER-RISORSA della 013 (`coalesce(risorsa_id, …)`): è quello l'invariante che
 * cambia, non il coalesce innocuo sulla durata.
 * ════════════════════════════════════════════════════════════════════════ */
const M014 = "supabase/migrazioni/014_sale.sql";
describe.skipIf(!existsSync(join(ROOT, M014)))("L4l · guardie le sale (014)", () => {
  const sql = () => leggi(M014);

  it("G18 · la tabella `risorse` esiste con RLS attiva e revoke select ad anon", () => {
    const s = sql();
    const compatta = s.replace(/\s+/g, " ").toLowerCase();
    expect(
      /create table if not exists public\.risorse/i.test(s),
      "manca la tabella public.risorse"
    ).toBe(true);
    expect(
      compatta.includes("alter table public.risorse enable row level security"),
      "risorse senza RLS: le sale di un negozio resterebbero fuori dall'isolamento"
    ).toBe(true);
    expect(
      compatta.includes("revoke select on public.risorse from anon"),
      "risorse: manca `revoke select … from anon` (Supabase concede select di default)"
    ).toBe(true);
  });

  it("G18b · ogni negozio nasce con la sua sala: crea_sala_default AFTER INSERT ON aziende", () => {
    const s = sql();
    expect(
      /create or replace function public\.crea_sala_default/i.test(s),
      "manca la funzione crea_sala_default"
    ).toBe(true);
    // isolo lo statement del trigger (dal create trigger al ;) e verifico che sia
    // after insert on aziende ed esegua crea_sala_default.
    const m = s.match(/create trigger\s+\w+\s+after insert on public\.aziende[\s\S]*?;/i);
    expect(m, "manca il trigger AFTER INSERT ON aziende").toBeTruthy();
    expect(
      /crea_sala_default/i.test(m![0]),
      "il trigger su aziende non esegue crea_sala_default"
    ).toBe(true);
  });

  it("G18c · appuntamenti.risorsa_id diventa NOT NULL con FK verso risorse", () => {
    const s = sql();
    expect(
      /alter table public\.appuntamenti alter column risorsa_id set not null/i.test(s),
      "risorsa_id non diventa NOT NULL nella 014"
    ).toBe(true);
    expect(
      /foreign key\s*\(\s*risorsa_id\s*\)\s*references public\.risorse/i.test(s),
      "manca la FK appuntamenti.risorsa_id → risorse"
    ).toBe(true);
    // la coppia (risorsa_id, risorse) entra nel trigger di coerenza tenant (008).
    const t = s.match(/create trigger trg_tenant[\s\S]*?assicura_coerenza_tenant\([\s\S]*?\);/i);
    expect(t, "la 014 deve ridichiarare trg_tenant su appuntamenti").toBeTruthy();
    expect(
      /'risorsa_id'\s*,\s*'risorse'/i.test(t![0]),
      "la coppia ('risorsa_id','risorse') non è nel trigger di coerenza tenant"
    ).toBe(true);
  });

  it("G18d · l'EXCLUDE appuntamenti_niente_sovrapposizioni è per-risorsa e SENZA coalesce", () => {
    const s = sql();
    const m = s.match(/add constraint appuntamenti_niente_sovrapposizioni\s+exclude[\s\S]*?;/i);
    expect(m, "vincolo appuntamenti_niente_sovrapposizioni non trovato nella 014").toBeTruthy();
    const blocco = m![0];
    expect(
      /risorsa_id\s+with\s*=/i.test(blocco),
      "l'EXCLUDE deve essere per-risorsa (risorsa_id with =)"
    ).toBe(true);
    // il coalesce della 013 sparisce: risorsa_id è ora NOT NULL, niente cucitura.
    expect(
      /coalesce\(/i.test(blocco),
      "la 014 toglie il coalesce dall'EXCLUDE (risorsa_id è NOT NULL)"
    ).toBe(false);
    expect(
      /where\s*\(\s*stato\s+in\s*\(\s*'in_attesa'\s*,\s*'prenotato'\s*,\s*'completato'\s*\)/i.test(blocco),
      "l'EXCLUDE deve valere solo sugli stati occupanti in_attesa/prenotato/completato"
    ).toBe(true);
  });

  it("G18e · slot_liberi (014) nomina `risorse` e non usa più `coalesce(risorsa_id, …)`", () => {
    const s = sql();
    const start = s.indexOf("create or replace function public.slot_liberi");
    expect(start, "la 014 deve ridefinire slot_liberi").toBeGreaterThanOrEqual(0);
    const rest = s.slice(start);
    const end = rest.indexOf("$$;");
    expect(end, "corpo di slot_liberi non terminato").toBeGreaterThan(0);
    const corpo = rest.slice(0, end);
    expect(
      /\brisorse\b/i.test(corpo),
      "slot_liberi deve consultare `risorse` (libero se ALMENO UNA sala attiva è libera)"
    ).toBe(true);
    // Trade-off: resta il coalesce LEGITTIMO sulla durata; sparisce solo quello
    // per-risorsa della 013 (coalesce(risorsa_id, azienda_id)).
    expect(
      /coalesce\(\s*risorsa_id/i.test(corpo),
      "slot_liberi non deve più usare coalesce(risorsa_id, azienda_id): risorsa_id è NOT NULL"
    ).toBe(false);
  });

  it("G18f · crea_prenotazione (014) sceglie una sala attiva (`from public.risorse`)", () => {
    const s = sql();
    const start = s.indexOf("create or replace function public.crea_prenotazione");
    expect(start, "la 014 deve ridefinire crea_prenotazione").toBeGreaterThanOrEqual(0);
    const corpo = s.slice(start);
    expect(
      /from\s+public\.risorse/i.test(corpo),
      "crea_prenotazione deve scegliere una sala da public.risorse (prima attiva libera)"
    ).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4m · GUARDIE «PRENDI COME CLIENTE» (G19 · migrazione 018)
 *
 * La 018 apre l'UNICO percorso di scrittura verso `persone` e
 * `persone_riferimento_registro` — due tabelle con RLS attiva SENZA policy
 * (ID-01 della 011: «ci arrivano solo le funzioni security definer»). Il rischio
 * silenzioso: se `prendi_persona_come_cliente` (che gira coi privilegi
 * dell'owner e BYPASSA quella RLS) finisse invocabile dal browser — direttamente
 * o via un grant ad `anon` — chiunque potrebbe scrivere nel registro dei
 * passaggi e reintestarsi persone altrui, aggirando le guardie che vivono DENTRO
 * la funzione. Queste guardie tengono il percorso di scrittura dietro l'azione
 * server e la funzione revocata ad anon.
 *
 * Gated su `existsSync(018)`: enforca dove la 018 è nel working tree (il suo
 * branch e la CI dopo il merge), salta pulito altrove.
 * ════════════════════════════════════════════════════════════════════════ */
const M018 = "supabase/migrazioni/018_prendi_come_cliente.sql";
describe.skipIf(!existsSync(join(ROOT, M018)))("L4m · guardie prendi come cliente (018)", () => {
  // L'INVOCAZIONE della funzione di scrittura (non una menzione in un commento).
  const RE_INVOCA = /\.rpc\(\s*["']prendi_persona_come_cliente["']/;

  it("G19 · `prendi_persona_come_cliente` si INVOCA solo da un file server (\"use server\"), mai da un client", () => {
    const files = [...sorgenti("app"), ...sorgenti("components"), ...sorgenti("lib")];
    const violazioni: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!RE_INVOCA.test(src)) continue;
      const isServer = /^\s*["']use server["'];?/m.test(src);
      const isClient = /^\s*["']use client["'];?/m.test(src);
      if (isClient || !isServer) violazioni.push(rel(f));
    }
    expect(
      violazioni,
      `prendi_persona_come_cliente invocata fuori da un file server (o da un client): ${violazioni.join(", ")}`
    ).toEqual([]);
  });

  it("G19b · l'azione server `prendiComeCliente` esiste, è \"use server\" e passa dalla RPC", () => {
    const azioni = leggi("lib/actions.ts");
    expect(/^\s*["']use server["'];?/m.test(azioni), "lib/actions.ts non è più \"use server\"").toBe(true);
    expect(azioni).toMatch(/export\s+async\s+function\s+prendiComeCliente/);
    expect(RE_INVOCA.test(azioni), "la scrittura passa dalla funzione definer").toBe(true);
  });

  it("G19c · le azioni dell'agenda (client) chiamano l'azione, NON la RPC di scrittura", () => {
    const comp = leggi("components/AzioniAgenda.tsx");
    expect(/^\s*["']use client["'];?/m.test(comp), "AzioniAgenda non è più un client component").toBe(true);
    expect(comp.includes("prendiComeCliente"), "il componente passa dall'azione server").toBe(true);
    expect(
      RE_INVOCA.test(comp),
      "il client invoca la RPC di scrittura verso persone/registro (RLS aggirabile!)"
    ).toBe(false);
  });

  it("G19d · la 018 tiene la scrittura security definer e revocata ad anon", () => {
    const sql = leggi(M018);
    // le due funzioni sono security definer (bypassano la RLS di persone/registro)
    expect(
      /create or replace function public\.prendi_persona_come_cliente[\s\S]*?security definer/i.test(sql),
      "prendi_persona_come_cliente deve essere security definer"
    ).toBe(true);
    // e NON eseguibili da anon (solo authenticated): il browser passa dall'azione.
    expect(
      /revoke\s+execute\s+on\s+function\s+public\.prendi_persona_come_cliente[\s\S]*?from\s+anon/i.test(sql),
      "prendi_persona_come_cliente deve revocare execute ad anon"
    ).toBe(true);
    expect(
      /revoke\s+execute\s+on\s+function\s+public\.cliente_per_telefono[\s\S]*?from\s+anon/i.test(sql),
      "cliente_per_telefono deve revocare execute ad anon (dati clienti)"
    ).toBe(true);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4n · GUARDIE FUSO EUROPE/ROME (G20 · migrazione 019, TODO §6)
 *
 * Un orario di lavoro è un'ora di PARETE italiana. Costruirlo con
 * `new Date(\`${data}T${ora}\`)` lo interpreta nel fuso del PROCESSO: su Vercel
 * (UTC) «10:00» diventa mezzogiorno a Roma, mentre il portale scrive le 10:00 di
 * Roma → stessa ora scritta, due istanti diversi, e SI ROMPE SOLO IN PRODUZIONE
 * (in locale il fuso di sistema è italiano, i test di prodotto restano verdi).
 * Queste guardie leggono il sorgente e impediscono la recidiva silenziosa:
 * `creaAppuntamento` deve ancorare a Europe/Rome (`istanteRomaISO`), e l'agenda
 * deve LEGGERE l'ora in Europe/Rome (non uno slice UTC).
 *
 * Gated su `existsSync(019)`: enforca sul branch e in CI dopo il merge, salta
 * pulito sui checkpoint paralleli.
 * ════════════════════════════════════════════════════════════════════════ */
const M019 = "supabase/migrazioni/019_fuso_appuntamenti_banco.sql";
describe.skipIf(!existsSync(join(ROOT, M019)))("L4n · guardie fuso Europe/Rome (019)", () => {
  /** Corpo della funzione `creaAppuntamento` in lib/actions.ts (dalla firma alla
   *  successiva `export ... function`). */
  function corpoCreaAppuntamento(): string {
    const src = leggi("lib/actions.ts");
    const start = src.indexOf("export async function creaAppuntamento");
    expect(start, "lib/actions.ts deve esporre creaAppuntamento").toBeGreaterThanOrEqual(0);
    const rest = src.slice(start + 1);
    const nextExport = rest.indexOf("\nexport ");
    return rest.slice(0, nextExport === -1 ? rest.length : nextExport);
  }

  it("G20 · creaAppuntamento àncora l'istante con istanteRomaISO (non naïve dal fuso del processo)", () => {
    const corpo = corpoCreaAppuntamento();
    expect(
      /istanteRomaISO\s*\(/.test(corpo),
      "creaAppuntamento deve costruire l'istante con istanteRomaISO(data, ora)"
    ).toBe(true);
    // Nessun `new Date(`...T...`)` costruito da data+ora (la riga 1119 di un tempo):
    // vietato un template literal con la T fra due interpolazioni dentro new Date.
    expect(
      /new\s+Date\(\s*`[^`]*\$\{[^}]*\}T\$\{[^}]*\}[^`]*`\s*\)/.test(corpo),
      "creaAppuntamento NON deve costruire l'istante con new Date(`${data}T${ora}`) (naïve, fuso del processo)"
    ).toBe(false);
  });

  it("G20b · l'agenda LEGGE l'ora in Europe/Rome (oraDi/oraFine), non con uno slice UTC", () => {
    const ui = leggi("components/AgendaUI.tsx");
    // Il formatter dell'ora deve dichiarare timeZone Europe/Rome.
    expect(
      /timeZone:\s*["']Europe\/Rome["']/.test(ui),
      "AgendaUI deve formattare l'ora con timeZone Europe/Rome"
    ).toBe(true);
    // oraDi NON deve tornare a `.toISOString().slice(11, 16)` (ora UTC del processo).
    const start = ui.indexOf("export function oraDi");
    expect(start, "AgendaUI deve esporre oraDi").toBeGreaterThanOrEqual(0);
    const corpoOraDi = ui.slice(start, start + 200);
    expect(
      /toISOString\(\)\.slice\(\s*11/.test(corpoOraDi),
      "oraDi NON deve leggere l'ora da uno slice UTC (mostrerebbe l'ora sbagliata in produzione)"
    ).toBe(false);
  });

  it("G20c · la 019 è una riparazione-dati idempotente e mirata (marker, solo banco, non seed-g6)", () => {
    const sql = leggi(M019);
    expect(sql.includes("_riparazioni_dati"), "manca il marker di idempotenza").toBe(true);
    expect(/where\s+chiave\s*=\s*'019_fuso_appuntamenti_banco'/i.test(sql), "manca la guardia sul marker").toBe(true);
    expect(/fonte\s*=\s*'banco'/i.test(sql), "il backfill deve toccare SOLO fonte='banco'").toBe(true);
    expect(/'seed-g6'/.test(sql), "il backfill deve escludere le righe seed-g6 (già corrette)").toBe(true);
    expect(
      /at time zone 'UTC'\)\s*at time zone 'Europe\/Rome'/i.test(sql),
      "la trasformazione deve reinterpretare l'orologio come Europe/Rome"
    ).toBe(true);
  });
});
