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
    // Allowlist DOCUMENTATA e TEMPORANEA (consegna B1, Era 2). Le cinque azioni
    // dei contratti C1/C3/C4 sono uscite dall'elenco: la «UI minima» del §4 è
    // agganciata (sezione Permessi in scheda cliente, blocco assicurazione e
    // P.IVA in ClienteForm) e ora le copre l'E2E di M1.
    // Restano queste due, e per una ragione scritta nella consegna stessa: il
    // §4 le chiede come FUNZIONI, il §7 vieta «UI oltre il minimo degli E2E».
    // La loro schermata è di un altro modulo — oculisti = M2 (prima ricetta),
    // parametri = M10 (impostazioni di negozio) — e arriverà con quello.
    // La guardia resta severa su QUALSIASI altra action fantasma.
    const IN_ATTESA_UI_B1 = new Set([
      "creaOculistaAlVolo", // M2 · si aggancia alla prima ricetta
      "scriviParametro", // M10 · si aggancia alle impostazioni di negozio
    ]);

    const src = leggi("lib/actions.ts");
    const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)/g;
    const actionsFile = join(ROOT, "lib/actions.ts");
    const fantasma: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const nome = m[1];
      if (IN_ATTESA_UI_B1.has(nome)) continue;
      if (!referencedElsewhere(nome, actionsFile, tuttoIlCodice)) fantasma.push(nome);
    }
    expect(
      fantasma,
      `server action mai referenziate (e non nell'allowlist B1): ${fantasma.join(", ")}`
    ).toEqual([]);

    // L'allowlist non deve diventare una discarica: ogni nome elencato deve
    // ESISTERE davvero come export, altrimenti sta coprendo un refuso.
    const esportate = new Set(Array.from(src.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g)).map((x) => x[1]));
    const inesistenti = [...IN_ATTESA_UI_B1].filter((n) => !esportate.has(n));
    expect(
      inesistenti,
      `nomi nell'allowlist B1 che non esistono più in lib/actions.ts: ${inesistenti.join(", ")}`
    ).toEqual([]);
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

// ────────────────────────────────────────────────────────────────────────────
// L4o · S0 · Bonifica (Era 2, migrazione 020)
//
// La 020 toglie privilegi: il suo rischio non è «non funziona», è «funziona
// troppo» e spegne il portale pubblico. Queste guardie leggono l'SQL vero e
// difendono le quattro invarianti che non devono più muoversi:
//   • VP-01 · le viste del portale non si revocano MAI ad anon (e restano
//     definer: una vista security_invoker romperebbe il portale col grant
//     ancora al suo posto — cioè in silenzio);
//   • il marker della 019 resta irraggiungibile (RLS senza policy, zero grant);
//   • le funzioni-trigger sono tolte anche a PUBLIC (il solo revoke ad anon non
//     bastava: EXECUTE è di PUBLIC per default e anon lo ereditava);
//   • nessuna policy dello schema resta su PUBLIC;
//   • il registro delle migrazioni copre TUTTA la storia fino alla 020 (confronto
//     col filesystem: se qualcuno aggiunge una migrazione ≤ 020 senza registrarla,
//     il riapplico smette di essere idempotente).
// Gated con `skipIf(!existsSync(020))` come L4i/L4l/L4m/L4n: enforca sul branch
// della consegna e in CI dopo il merge, salta pulita sui checkpoint paralleli.
// ────────────────────────────────────────────────────────────────────────────
const M020 = "supabase/migrazioni/020_bonifica.sql";
describe.skipIf(!existsSync(join(ROOT, M020)))("L4o · guardie bonifica S0 (020)", () => {
  const VISTE_PORTALE = [
    "negozi_pubblici",
    "orari_pubblici",
    "chiusure_pubbliche",
    "servizi_pubblici",
  ];
  const FUNZIONI_TRIGGER = [
    "assicura_coerenza_tenant",
    "crea_sala_default",
    "assegna_sala_appuntamento",
  ];

  /**
   * Via i commenti `--`: queste guardie devono leggere il CODICE, non la prosa.
   * La 020 spiega a parole proprio le scorciatoie che vieta (es. «revoke … on all
   * tables in schema public»): scandire i commenti la farebbe accusare di sé stessa.
   */
  function spoglio(sql: string): string {
    return sql.replace(/--[^\n]*/g, "");
  }

  /** schema.sql + tutte le migrazioni, come coppie (path relativo, SQL senza commenti). */
  function tuttoSQL(): { file: string; sql: string }[] {
    const files = [
      "supabase/schema.sql",
      ...readdirSync(join(ROOT, "supabase/migrazioni"))
        .filter((n) => n.endsWith(".sql"))
        .sort()
        .map((n) => `supabase/migrazioni/${n}`),
    ];
    return files.map((f) => ({ file: f, sql: spoglio(leggi(f)) }));
  }

  /** Il corpo eseguibile della 020 (senza commenti). */
  function sql020(): string {
    return spoglio(leggi(M020));
  }

  it("G21 · la 020 blinda `_riparazioni_dati`: RLS attiva, zero grant, nessuna policy", () => {
    const sql = sql020();
    expect(
      /alter table public\._riparazioni_dati\s+enable row level security/i.test(sql),
      "senza RLS attiva il marker resterebbe raggiungibile"
    ).toBe(true);
    expect(
      /revoke all on public\._riparazioni_dati from anon/i.test(sql),
      "il marker non va lasciato ad anon"
    ).toBe(true);
    expect(
      /revoke all on public\._riparazioni_dati from authenticated/i.test(sql),
      "nemmeno il negozio deve poterlo cancellare (ri-armerebbe la 019)"
    ).toBe(true);
    // RLS SENZA policy: se qualcuno gliene scrive una, il marker torna toccabile.
    for (const { file, sql: s } of tuttoSQL()) {
      expect(
        /create policy[^;]*on public\._riparazioni_dati/i.test(s),
        `${file}: nessuna policy deve esistere su _riparazioni_dati (solo il service role)`
      ).toBe(false);
    }
  });

  it("G21b · VP-01 · la revoca ad anon non tocca MAI le quattro viste del portale", () => {
    const sql = sql020();

    // 1) il ciclo di revoca è ristretto alle sole tabelle ordinarie/partizionate:
    //    il filtro e la revoca devono stare nello STESSO blocco (non basta che il
    //    file nomini relkind da qualche parte).
    expect(
      /relkind in \('r','p'\)[\s\S]{0,300}revoke all on public\.%I from anon/i.test(sql),
      "il ciclo deve filtrare relkind in ('r','p'): in PostgreSQL «all tables» comprende le viste"
    ).toBe(true);

    // 2) la scorciatoia che spegnerebbe il portale non deve comparire in NESSUNA
    //    migrazione: `revoke ... on all tables in schema public ... from anon`.
    for (const { file, sql: s } of tuttoSQL()) {
      expect(
        /revoke[\s\S]{0,80}on all tables in schema public[\s\S]{0,60}from[^;]*\banon\b/i.test(s),
        `${file}: «revoke on all tables in schema public from anon» porterebbe via anche le viste del portale (VP-01)`
      ).toBe(false);
    }

    // 3) nessuna migrazione revoca esplicitamente le viste ad anon…
    for (const { file, sql: s } of tuttoSQL()) {
      for (const v of VISTE_PORTALE) {
        expect(
          new RegExp(`revoke[^;]*\\bpublic\\.${v}\\b[^;]*from[^;]*\\banon\\b`, "i").test(s),
          `${file}: ${v} deve restare leggibile da anon (VP-01)`
        ).toBe(false);
      }
    }

    // 4) …e ognuna conserva il proprio grant ad anon da qualche parte.
    const tutto = tuttoSQL()
      .map((x) => x.sql)
      .join("\n");
    for (const v of VISTE_PORTALE) {
      expect(
        new RegExp(`grant select on public\\.${v}\\s+to anon`, "i").test(tutto),
        `manca il grant select ad anon su ${v} (VP-01)`
      ).toBe(true);
    }

    // 5) le viste restano DEFINER. Con security_invoker=true il grant resterebbe
    //    al suo posto (la guardia (f) della 020 passerebbe) ma anon, che non ha
    //    più le tabelle sotto, vedrebbe zero righe: portale spento in silenzio.
    for (const { file, sql: s } of tuttoSQL()) {
      expect(
        /security_invoker\s*=\s*true/i.test(s),
        `${file}: le viste del portale devono restare security_invoker = false (definer)`
      ).toBe(false);
    }

    // 6) la 020 tiene la propria guardia rumorosa sulle quattro viste.
    for (const v of VISTE_PORTALE) {
      expect(sql.includes(`'${v}'`), `la guardia VP-01 della 020 deve nominare ${v}`).toBe(true);
    }
    expect(/VP-01 VIOLATA/.test(sql), "la guardia VP-01 deve fallire rumorosamente").toBe(true);
  });

  it("G21c · le funzioni-trigger sono revocate anche a PUBLIC (non solo ad anon)", () => {
    const sql = sql020();
    for (const f of FUNZIONI_TRIGGER) {
      const re = new RegExp(
        `revoke execute on function public\\.${f}\\(\\)\\s*from[^;]*;`,
        "i"
      );
      const m = sql.match(re);
      expect(m, `manca la revoca di EXECUTE su ${f}`).toBeTruthy();
      // Il punto verbalizzato in PR: senza `public` la revoca è INEFFICACE
      // (EXECUTE è concesso a PUBLIC per default e anon lo eredita).
      expect(
        /\bpublic\b/.test(m![0].split("from")[1]),
        `${f}: revocare solo ad anon non basta — EXECUTE va tolto anche a PUBLIC`
      ).toBe(true);
      expect(
        /\banon\b/.test(m![0].split("from")[1]),
        `${f}: la revoca deve nominare esplicitamente anon`
      ).toBe(true);
      // authenticated NON va revocato qui (conserva il suo grant esplicito).
      expect(
        /\bauthenticated\b/.test(m![0].split("from")[1]),
        `${f}: authenticated conserva il proprio grant (la revoca non lo nomina)`
      ).toBe(false);
    }
  });

  it("G21d · nessuna policy dello schema resta su PUBLIC (tutte `to authenticated`)", () => {
    // Vale l'ULTIMA definizione di ogni policy (file in ordine): la `risorse` della
    // 014 era su PUBLIC, la 020 la ricrea su authenticated → è quella che conta.
    const ultima = new Map<string, { file: string; corpo: string }>();
    for (const { file, sql } of tuttoSQL()) {
      const re = /create policy\s+"([^"]+)"\s+on\s+(public\.\w+)([\s\S]*?);/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) {
        ultima.set(`${m[2]}|${m[1]}`, { file, corpo: m[3] });
      }
    }
    expect(ultima.size, "lo schema deve avere delle policy").toBeGreaterThan(20);
    for (const [chiave, { file, corpo }] of ultima) {
      expect(
        /\bto\s+authenticated\b/i.test(corpo),
        `${file}: la policy ${chiave} non è ristretta a authenticated (resterebbe su PUBLIC)`
      ).toBe(true);
    }
  });

  it("G21f · VP-01 · il codice del portale tocca SOLO le quattro viste e le due RPC", () => {
    // L'altra metà di VP-01: dopo la 020 `anon` non ha NIENTE sulle tabelle. Se
    // qualcuno aggiungesse un `.from("aziende")` nel portale, il marciapiede
    // prenderebbe un 42501 in produzione. Qui diventa rosso subito.
    const RPC_AMMESSE = new Set(["slot_liberi", "crea_prenotazione"]);
    const file = [...sorgenti("lib/portale"), ...sorgenti("app/(portale)")];
    expect(file.length, "il portale deve avere dei sorgenti da ispezionare").toBeGreaterThan(0);

    for (const f of file) {
      const src = readFileSync(f, "utf8");
      const rel = f.slice(ROOT.length);
      for (const m of src.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
        expect(
          VISTE_PORTALE.includes(m[1]),
          `${rel}: il portale legge \`${m[1]}\` — dopo la 020 anon non ha privilegi sulle tabelle, si possono usare solo le quattro viste`
        ).toBe(true);
      }
      for (const m of src.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)) {
        expect(
          RPC_AMMESSE.has(m[1]),
          `${rel}: il portale invoca la RPC \`${m[1]}\` — anon esegue solo slot_liberi e crea_prenotazione (security definer)`
        ).toBe(true);
      }
    }
  });

  it("G21e · il registro `_infra_migrazioni` nasce prima della revoca e copre tutta la storia ≤ 020", () => {
    const sql = sql020();

    // 1) creato PRIMA del ciclo (b): altrimenti anon se lo terrebbe leggibile.
    const creazione = sql.search(/create table if not exists public\._infra_migrazioni/i);
    const ciclo = sql.search(/revoke all on public\.%I from anon/i);
    expect(creazione, "la 020 deve creare il registro").toBeGreaterThanOrEqual(0);
    expect(ciclo, "la 020 deve contenere il ciclo di revoca").toBeGreaterThanOrEqual(0);
    expect(
      creazione < ciclo,
      "il registro va creato PRIMA del ciclo di revoca, così anche lui perde anon"
    ).toBe(true);

    // 2) struttura attesa (la stessa dello script di provisioning).
    expect(/nome\s+text\s+primary key/i.test(sql), "il registro ha `nome` come chiave").toBe(true);
    expect(/applied_at\s+timestamptz/i.test(sql), "il registro timbra `applied_at`").toBe(true);

    // 3) il backfill copre 001 + OGNI migrazione presente sul filesystem fino
    //    alla 020 inclusa. Le migrazioni successive si registrano da sé (la
    //    strada che registra: scripts/applica-migrazioni.ts) e non sono richieste
    //    qui — trade-off documentato nel report.
    const registrate = new Set(
      Array.from(sql.matchAll(/\('(\d{3}_[a-z0-9_]+)'\)/g)).map((m) => m[1])
    );
    expect(registrate.has("001_schema_base"), "manca 001_schema_base nel backfill").toBe(true);
    const attese = readdirSync(join(ROOT, "supabase/migrazioni"))
      .filter((n) => n.endsWith(".sql"))
      .map((n) => n.replace(/\.sql$/, ""))
      .filter((n) => n <= "020_bonifica")
      .sort();
    for (const n of attese) {
      expect(registrate.has(n), `il backfill della 020 non registra ${n}`).toBe(true);
    }
    expect(registrate.size, "il backfill deve valere 20 righe (001 + 002…020)").toBe(
      attese.length + 1
    );
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4p · GUARDIE B1 · FONDAMENTA (021 + contratti C1-C4)
 *
 * La 021 è la migrazione più «di contratto» dell'Era 2: non aggiunge una
 * schermata, aggiunge INVARIANTI. Quelli veri si collaudano contro il DB (L2,
 * tests/contratto/b1-*.test.ts); qui restano i pezzi che, se si rompessero, lo
 * farebbero **in silenzio** e nessun test di prodotto diventerebbe rosso:
 *
 *   • G22  — le colonne-CACHE dei consensi non si scrivono a mano (C3: «la cache
 *            non si scrive MAI direttamente, solo l'azione del mastro»). È un
 *            RATCHET: i punti legacy noti sono elencati, uno NUOVO è rosso;
 *   • G22b — le azioni B1 chiamano `richiedi()` IN TESTA (C2: l'enforcement è
 *            nell'azione, la UI che nasconde un bottone è cortesia);
 *   • G22c — solo `lib/permessi.ts` legge `docs/regole/permessi.json` (C2: «le
 *            azioni non leggono MAI permessi.json da sole»);
 *   • G23  — i quattro CHECK di C3 esistono per nome nella 021;
 *   • G23b — C4: il check anti-self + l'indice funzionale least/greatest
 *            LIMITATO ai tipi familiari (se perdesse la `where`, il tutore non
 *            potrebbe più coesistere; se perdesse least/greatest, l'inversa
 *            passerebbe);
 *   • G24  — le cinque tabelle nuove: RLS attiva, policy `to authenticated`,
 *            revoke ad anon;
 *   • G25  — ogni funzione della 021 è `security INVOKER` (una `definer` per
 *            sbaglio scavalcherebbe la RLS e aprirebbe il tenant) e ha il suo
 *            `grant execute to authenticated` esplicito (le default privileges
 *            del punto 0 tolgono EXECUTE a PUBLIC: senza grant la funzione
 *            nasce non chiamabile);
 *   • G26  — `registra_consenso` prende il LOCK prima di inserire e riallinea la
 *            cache nella stessa funzione (è tutto C3 in tre righe);
 *   • G27  — la mappa C1 nomina ogni campo, e `fonte` NON è fra gli assegnati.
 * ════════════════════════════════════════════════════════════════════════ */
const M021 = "supabase/migrazioni/021_fondamenta.sql";
describe.skipIf(!existsSync(join(ROOT, M021)))("L4p · guardie B1 fondamenta (021)", () => {
  const sql021 = () => leggi(M021);

  /** Il corpo di una funzione della 021, dal `create ... function` al `$$;`. */
  function corpoFunzione(nome: string): string {
    const sql = sql021();
    const i = sql.indexOf(`create or replace function public.${nome}(`);
    expect(i, `la 021 deve definire ${nome}`).toBeGreaterThanOrEqual(0);
    const resto = sql.slice(i);
    const fine = resto.indexOf("$$;");
    expect(fine, `corpo di ${nome} non terminato`).toBeGreaterThan(0);
    return resto.slice(0, fine);
  }

  const FUNZIONI_021 = [
    "registra_consenso",
    "revoca_marketing",
    "crea_relazione",
    "elimina_relazione",
    "crea_oculista_al_volo",
    "anonimizza_cliente",
  ] as const;

  const TABELLE_021 = [
    "assicurazioni",
    "oculisti",
    "parametri",
    "consensi",
    "clienti_relazioni",
  ] as const;

  /* ── C3 · la cache non si scrive a mano ───────────────────────────────── */

  it("G22 · le colonne-cache dei consensi si scrivono SOLO dai punti noti (ratchet)", () => {
    // RATCHET DOCUMENTATO (vedi report-test.md §B1 · «ganci richiesti»).
    // Il ratchet ha STRETTO di un dente: `clienteDaForm` non scrive più la cache
    // marketing (la spunta «Consenso marketing» è uscita da `ClienteForm` con la
    // UI minima B1), quindi esce dall'elenco e rientrarci sarebbe rosso — era il
    // punto peggiore dei tre, perché su «aggiorna» poteva SPEGNERE il consenso
    // senza nessun evento nel mastro.
    // Restano due punti legacy della Fase 4d, che C3 vieta: `registraConsensi`
    // (il banner, ormai solo sanitario) e `creaPrescrizione` (la cache sanitaria,
    // che per C3 non dovrebbe nemmeno esistere: «per dati_sanitari NESSUNA
    // cache, si legge dal mastro per prescrizione»). Non è compito dei test
    // rimuoverli: è compito di questa guardia impedire che ne nasca un TERZO
    // mentre si aspetta la migrazione del flusso sanitario sul mastro.
    const NOTI = ["registraConsensi", "creaPrescrizione"];
    const CACHE = /\b(consenso_marketing|consenso_canali|data_consenso|consenso_dati_sanitari|consenso_sanitario_il)\s*[:=]/;

    const src = leggi("lib/actions.ts");
    // Spezzo il file in blocchi «una funzione ciascuno» sulle intestazioni.
    const intestazioni = [...src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/gm)];
    expect(intestazioni.length, "lib/actions.ts deve contenere delle funzioni").toBeGreaterThan(10);

    const scrittori: string[] = [];
    for (const [i, m] of intestazioni.entries()) {
      const da = m.index!;
      const a = i + 1 < intestazioni.length ? intestazioni[i + 1].index! : src.length;
      const blocco = src.slice(da, a);
      // Solo le SCRITTURE: `x: valore` dentro un payload o un assegnamento.
      // Le LETTURE (`.select("… consenso_marketing …")`, `cliente.consenso_marketing`)
      // non hanno né `:` né `=` subito dopo il nome e non entrano.
      if (CACHE.test(blocco)) scrittori.push(m[1]);
    }

    const nuovi = scrittori.filter((f) => !NOTI.includes(f));
    expect(
      nuovi,
      `C3: la cache dei consensi si scrive SOLO dall'azione del mastro. ` +
        `Nuovi punti di scrittura diretta: ${nuovi.join(", ")}`
    ).toEqual([]);
  });

  it("G22b · ogni azione B1 chiama `richiedi()` in TESTA (C2: l'enforcement è nell'azione)", () => {
    const AZIONI_B1 = [
      "registraConsenso",
      "revocaMarketing",
      "creaRelazione",
      "eliminaRelazione",
      "anonimizzaCliente",
      "creaOculistaAlVolo",
      "scriviParametro",
    ];
    const src = leggi("lib/actions.ts");
    const senzaGuardia: string[] = [];
    const tardive: string[] = [];
    for (const nome of AZIONI_B1) {
      const i = src.indexOf(`export async function ${nome}`);
      expect(i, `l'azione ${nome} deve esistere in lib/actions.ts`).toBeGreaterThanOrEqual(0);
      const resto = src.slice(i);
      const fine = resto.indexOf("\nexport ", 1);
      const corpo = fine > 0 ? resto.slice(0, fine) : resto;

      const posRichiedi = corpo.search(/await\s+richiedi\(/);
      if (posRichiedi < 0) {
        senzaGuardia.push(nome);
        continue;
      }
      // «In testa» = prima di qualunque contatto col database.
      const posDb = corpo.search(/await\s+createClient\(|\.rpc\(|\.from\(/);
      if (posDb >= 0 && posDb < posRichiedi) tardive.push(nome);
    }
    expect(senzaGuardia, `azioni B1 senza richiedi(): ${senzaGuardia.join(", ")}`).toEqual([]);
    expect(
      tardive,
      `azioni B1 che toccano il DB PRIMA di richiedi(): ${tardive.join(", ")}`
    ).toEqual([]);
  });

  it("G22c · solo lib/permessi.ts legge `permessi.json` (le azioni non se lo leggono da sole)", () => {
    const colpevoli: string[] = [];
    for (const f of [...sorgenti("lib"), ...sorgenti("app"), ...sorgenti("components")]) {
      if (rel(f) === "lib/permessi.ts") continue;
      const src = readFileSync(f, "utf8");
      if (/regole\/permessi\.json/.test(src)) colpevoli.push(rel(f));
    }
    expect(
      colpevoli,
      `C2: la policy si legge SOLO dall'helper. Letture dirette in: ${colpevoli.join(", ")}`
    ).toEqual([]);
  });

  /* ── C3 · i CHECK a DB ─────────────────────────────────────────────────── */

  it("G23 · i quattro CHECK di C3 esistono per nome nella 021", () => {
    const sql = sql021();
    for (const vincolo of [
      "consensi_sanitario_per_rx",
      "consensi_marketing_senza_rx",
      "consensi_dato_marketing_canali",
      "consensi_revoca_senza_canali",
    ]) {
      expect(
        new RegExp(`constraint\\s+${vincolo}\\s+check`, "i").test(sql),
        `manca il CHECK ${vincolo} (contratto C3)`
      ).toBe(true);
    }
    // Il perimetro dei canali è quello del vocabolario M1 §2, non uno a piacere.
    expect(
      /canali\s*<@\s*array\['email','cellulare','cartaceo'\]/i.test(sql.replace(/\s+/g, " ")),
      "il perimetro dei canali deve restare {email, cellulare, cartaceo}"
    ).toBe(true);
    // I due vocabolari chiusi del mastro.
    expect(/tipo in \('marketing','dati_sanitari'\)/i.test(sql)).toBe(true);
    expect(/azione in \('dato','revocato'\)/i.test(sql)).toBe(true);
    expect(/modalita\s+text\s+check \(modalita in \('penna','digitale'\)\)/i.test(sql)).toBe(true);
  });

  it("G23b · C4: check anti-self + indice funzionale least/greatest LIMITATO ai familiari", () => {
    const sql = sql021();
    expect(
      /check \(cliente_id <> relativo_id\)/i.test(sql),
      "manca il check anti-self su clienti_relazioni (C4)"
    ).toBe(true);

    const m = sql.match(/create unique index if not exists uq_relazione_familiare_per_coppia[\s\S]*?;/i);
    expect(m, "manca l'indice unico funzionale della coppia (C4)").toBeTruthy();
    const blocco = m![0].replace(/\s+/g, " ");
    expect(
      /least\(cliente_id, relativo_id\)/i.test(blocco) && /greatest\(cliente_id, relativo_id\)/i.test(blocco),
      "senza least/greatest la relazione INVERSA passerebbe: la doppia tornerebbe possibile"
    ).toBe(true);
    expect(
      /azienda_id/i.test(blocco),
      "l'indice deve restare per-negozio (azienda_id in testa)"
    ).toBe(true);
    // La `where` è ciò che rende il tutore_legale una categoria a parte.
    expect(
      /where tipo in \('padre','madre','figlio','fratello','sorella'\)/i.test(blocco),
      "senza la `where` sui soli familiari, tutore_legale non potrebbe più coesistere (C4)"
    ).toBe(true);
    expect(
      /tutore_legale/i.test(blocco),
      "tutore_legale NON deve comparire fra i tipi dell'indice di coppia"
    ).toBe(false);
  });

  /* ── Sicurezza delle tabelle e delle funzioni nuove ───────────────────── */

  it("G24 · le 5 tabelle della 021 hanno RLS attiva, policy `to authenticated` e revoke ad anon", () => {
    const sql = sql021();
    const compatta = sql.replace(/\s+/g, " ").toLowerCase();
    const senzaRls: string[] = [];
    const senzaRevoke: string[] = [];
    const senzaPolicy: string[] = [];
    for (const t of TABELLE_021) {
      if (!compatta.includes(`alter table public.${t} enable row level security`)) senzaRls.push(t);
      if (!compatta.includes(`revoke all on public.${t}`) || !new RegExp(`revoke all on public\\.${t}\\s+from anon`, "i").test(sql)) {
        senzaRevoke.push(t);
      }
      const p = sql.match(new RegExp(`create policy\\s+"[^"]+"\\s+on public\\.${t}([\\s\\S]*?);`, "i"));
      if (!p || !/\bto authenticated\b/i.test(p[1])) senzaPolicy.push(t);
    }
    expect(senzaRls, `tabelle 021 senza RLS: ${senzaRls.join(", ")}`).toEqual([]);
    expect(senzaRevoke, `tabelle 021 senza revoke ad anon: ${senzaRevoke.join(", ")}`).toEqual([]);
    expect(
      senzaPolicy,
      `tabelle 021 senza policy ristretta ad authenticated: ${senzaPolicy.join(", ")}`
    ).toEqual([]);
  });

  it("G24b · le `alter default privileges` del punto 0 chiudono tabelle e funzioni FUTURE", () => {
    const sql = sql021().replace(/\s+/g, " ").toLowerCase();
    expect(
      sql.includes("alter default privileges in schema public revoke all on tables from anon"),
      "senza questa riga ogni tabella futura nascerebbe leggibile da anon"
    ).toBe(true);
    expect(
      /alter default privileges in schema public revoke all on functions from public, anon/.test(sql),
      "le funzioni future devono perdere EXECUTE anche a PUBLIC (anon lo eredita)"
    ).toBe(true);
  });

  it("G25 · ogni funzione della 021 è `security INVOKER` e ha il suo grant esplicito", () => {
    const sql = sql021();
    for (const f of FUNZIONI_021) {
      const corpo = corpoFunzione(f);
      expect(
        /security\s+invoker/i.test(corpo),
        `${f}: deve restare security INVOKER — una definer scavalcherebbe la RLS e con lei il tenant`
      ).toBe(true);
      expect(
        /security\s+definer/i.test(corpo),
        `${f}: è diventata security DEFINER: il tenant non sarebbe più protetto dalla RLS`
      ).toBe(false);
      expect(
        new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from public, anon`, "i").test(sql),
        `${f}: manca la revoca di EXECUTE a public/anon`
      ).toBe(true);
      expect(
        new RegExp(`grant\\s+execute on function public\\.${f}\\([^)]*\\) to authenticated`, "i").test(sql),
        `${f}: manca il grant execute ad authenticated (con le default privileges del punto 0 sarebbe inchiamabile)`
      ).toBe(true);
    }
  });

  it("G26 · `registra_consenso`: LOCK, poi evento, poi cache — nella stessa funzione (C3)", () => {
    const corpo = corpoFunzione("registra_consenso");
    const lock = corpo.search(/from public\.clienti where id = p_cliente_id for update/i);
    const insert = corpo.search(/insert into public\.consensi/i);
    const cache = corpo.search(/update public\.clienti/i);
    expect(lock, "manca il `select … for update` della riga cliente (C3)").toBeGreaterThanOrEqual(0);
    expect(insert, "manca l'insert dell'evento").toBeGreaterThan(0);
    expect(cache, "manca il riallineamento della cache").toBeGreaterThan(0);
    expect(lock < insert, "il lock deve precedere l'evento").toBe(true);
    expect(insert < cache, "la cache si aggiorna DOPO l'evento").toBe(true);
    // La cache vale SOLO per il marketing: per i sanitari si legge il mastro.
    expect(
      /if p_tipo = 'marketing' then/i.test(corpo),
      "la cache deve restare condizionata al marketing (per i dati sanitari nessuna cache)"
    ).toBe(true);
    // Nessun confronto di timestamp: la semantica dell'«ultima riga» è il lock.
    expect(
      /order by\s+avvenuto_il|max\(avvenuto_il\)/i.test(corpo),
      "C3 vieta esplicitamente i confronti di timestamp: l'ordine lo dà il lock"
    ).toBe(false);
  });

  it("G27 · la mappa C1 è completa e `fonte` NON viene toccata", () => {
    const corpo = corpoFunzione("anonimizza_cliente");
    // L'UPDATE su `clienti`: dal `update public.clienti set` al `where id =`.
    const i = corpo.search(/update public\.clienti set/i);
    expect(i, "anonimizza_cliente deve aggiornare clienti").toBeGreaterThanOrEqual(0);
    const mappa = corpo.slice(i, corpo.indexOf("where id = p_cliente_id", i));

    const CAMPI_C1 = [
      "nome", "cognome", "secondo_nome", "codice_fiscale", "data_nascita", "sesso",
      "email", "telefono", "telefono_casa", "telefono_lavoro",
      "indirizzo", "indirizzo2", "cap", "citta", "provincia", "nazione",
      "note", "dati_fatturazione", "canale_preferito",
      "assicurazione_id", "azienda_convenzionata_id", "tutore_legale", "lingua",
      "tags", "non_contattare", "consenso_marketing", "consenso_canali",
      "consenso_dati_sanitari", "consenso_sanitario_il", "anonimizzato_il",
    ];
    const mancanti = CAMPI_C1.filter((c) => !new RegExp(`\\b${c}\\s*=`, "i").test(mappa));
    expect(mancanti, `campi della mappa C1 non trattati: ${mancanti.join(", ")}`).toEqual([]);

    // Le costanti dichiarate dal contratto, non un testo a piacere.
    expect(/nome\s*=\s*'Cliente'/i.test(mappa), "nome → 'Cliente'").toBe(true);
    expect(/cognome\s*=\s*'Anonimizzato-'/i.test(mappa), "cognome → 'Anonimizzato-' + id").toBe(true);
    expect(/non_contattare\s*=\s*true/i.test(mappa), "i flag si spengono in senso RESTRITTIVO").toBe(true);
    // `fonte` RESTA: se qualcuno la mettesse a null, si perderebbe la statistica.
    expect(
      /\bfonte\s*=/i.test(mappa),
      "C1: `fonte` RESTA (statistica aziendale, non identifica): non va assegnata"
    ).toBe(false);

    // Le relazioni si CANCELLANO (de-anonimizzano per prossimità)…
    expect(
      /delete from public\.clienti_relazioni/i.test(corpo),
      "C1: le relazioni si cancellano"
    ).toBe(true);
    // …ma i consensi NO: sono fatti storici su un'identità ormai anonima.
    expect(
      /delete from public\.consensi/i.test(corpo),
      "C1: le righe del mastro SI CONSERVANO (solo documento_ref → NULL)"
    ).toBe(false);
    expect(/update public\.consensi set documento_ref = null/i.test(corpo)).toBe(true);
    // E i FATTI non si cancellano mai.
    for (const fatto of ["vendite", "ordini_occhiali", "ordini_lac", "movimenti_magazzino", "chiusure_cassa"]) {
      expect(
        new RegExp(`delete from public\\.${fatto}`, "i").test(corpo),
        `C1: ${fatto} è un FATTO aziendale, non si cancella mai`
      ).toBe(false);
    }
    // L'unico campo personale della vendita.
    expect(/update public\.vendite set cf_cliente = null/i.test(corpo)).toBe(true);
  });

  it("G27b · l'unicità dei telefoni resta PARZIALE (l'anonimo esce dalla dedup)", () => {
    const sql = sql021().replace(/\s+/g, " ");
    expect(
      /create unique index if not exists uq_persone_telefono_reale on public\.persone \(telefono_normalizzato\) where telefono_normalizzato <> ''/i.test(sql),
      "senza l'unicità PARZIALE il SECONDO cliente anonimizzato collidere­bbe sul telefono vuoto"
    ).toBe(true);
    expect(
      /alter table public\.persone alter column telefono_grezzo drop not null/i.test(sql),
      "telefono_grezzo deve poter diventare NULL (C1: la riga esce dalla dedup)"
    ).toBe(true);
  });

  it("G28 · la 021 registra sé stessa nel registro delle migrazioni", () => {
    const sql = sql021();
    expect(
      /insert into public\._infra_migrazioni \(nome\) values \('021_fondamenta'\)/i.test(sql),
      "regola permanente della 020: ogni migrazione registra sé stessa"
    ).toBe(true);
  });

  it("G28b · la 021 resta ADDITIVA: nessun drop di tabella o di colonna", () => {
    const sql = sql021();
    expect(/drop table/i.test(sql), "nessun drop table").toBe(false);
    expect(/drop column/i.test(sql), "nessun drop column").toBe(false);
    expect(/\brename to\b/i.test(sql), "nessun rename").toBe(false);
    // L'UNICA cancellazione fisica ammessa dalla 021 è quella delle RELAZIONI
    // (anagrafe, non un fatto: C4 + C1). Se comparisse un `delete from` su
    // qualunque altra tabella, sarebbe un fatto aziendale che se ne va.
    const bersagli = new Set(
      Array.from(sql.matchAll(/delete\s+from\s+public\.(\w+)/gi)).map((m) => m[1].toLowerCase())
    );
    expect(
      [...bersagli].sort(),
      `la 021 cancella righe da tabelle diverse da clienti_relazioni: ${[...bersagli].join(", ")}`
    ).toEqual(["clienti_relazioni"]);
    // I `drop policy if exists` / `drop trigger if exists` / `drop constraint` di
    // ricreazione sono leciti (modifiche di vincolo, non perdita di dati).
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * L4q · IL CONTRATTO UI ↔ E2E DI M1 (consegna B1, secondo giro)
 *
 * Da quando la «UI minima» del §4 è agganciata, gli E2E di
 * `e2e/m1-anagrafiche.spec.ts` non sono più la lettura della spec: sono un
 * CONTRATTO con etichette e ruoli veri. Quel contratto però si rompe solo in
 * CI, dentro il job `contratto-e2e`, che gira con i segreti e ci mette minuti.
 * Queste guardie lo controllano nel job `build`, in millisecondi, e dicono a
 * chi ha rinominato un'etichetta CHE COSA ha rotto.
 *
 * Trade-off dichiarato (report §B1): sono guardie di TESTO. Un rinomino
 * legittimo («Registra consenso» → «Raccogli consenso») le fa diventare rosse
 * anche se il prodotto è migliore. È voluto: quel rinomino deve passare per
 * l'E2E e per la spec, non avvenire di soppiatto. La riparazione è di una
 * riga qui + una riga nello spec — e il messaggio d'errore lo dice.
 * ════════════════════════════════════════════════════════════════════════ */
describe("L4q · contratto UI ↔ E2E di M1 (B1)", () => {
  const PERMESSI = "components/PermessiCliente.tsx";
  const FORM = "components/ClienteForm.tsx";
  const SCHEDA = "app/(app)/clienti/[id]/page.tsx";

  it("G29 · la scheda cliente monta la sezione «Permessi» (senza, cinque E2E muoiono)", () => {
    expect(existsSync(join(ROOT, PERMESSI)), `manca ${PERMESSI}`).toBe(true);
    const scheda = leggi(SCHEDA);
    expect(
      /import\s*\{[^}]*PermessiCliente[^}]*\}\s*from\s*["']@\/components\/PermessiCliente["']/.test(scheda),
      "la scheda cliente deve importare PermessiCliente"
    ).toBe(true);
    expect(/<PermessiCliente\b/.test(scheda), "…e renderizzarlo").toBe(true);
  });

  it("G29b · le etichette su cui poggiano gli E2E M1 esistono nel sorgente", () => {
    // Nome → file che deve contenerlo. Sono esattamente le stringhe usate dai
    // `getByRole`/`getByLabel` di e2e/m1-anagrafiche.spec.ts e di _helpers.ts.
    const ATTESE: [string, string][] = [
      // S2/S3 · il mastro dei consensi (C3)
      ["Registra consenso", PERMESSI],
      ["Salva consenso", PERMESSI],
      ["Revoca comunicazioni", PERMESSI],
      ["Conferma revoca", PERMESSI],
      ["Modalità", PERMESSI],
      // S4 · relazioni (C4)
      ["Aggiungi relazione", PERMESSI],
      ["Persona collegata", PERMESSI],
      ["Tipo di relazione", PERMESSI],
      ["Collega", PERMESSI],
      // S6 · eliminazione definitiva (C1)
      ["Eliminazione definitiva", PERMESSI],
      ["Scrivi ELIMINA per confermare", PERMESSI],
      ["Anonimizza definitivamente", PERMESSI],
      // S1/S5 · sconti e fatturazione (M1 §2 e §4)
      ["Assicurazione", FORM],
      ["Ragione sociale", FORM],
      ["CF / P.IVA azienda", FORM],
      ["Codice SDI", FORM],
      ["Scala / appartamento", FORM],
      ["Secondo nome", FORM],
    ];
    const mancanti: string[] = [];
    for (const [testo, file] of ATTESE) {
      if (!leggi(file).includes(testo)) mancanti.push(`«${testo}» in ${file}`);
    }
    expect(
      mancanti,
      `etichette rinominate senza aggiornare e2e/m1-anagrafiche.spec.ts: ${mancanti.join(" · ")}`
    ).toEqual([]);
  });

  it("G29c · i tre canali del consenso sono {Email, Cellulare, Cartaceo}, come il CHECK a DB", () => {
    // Il perimetro dei canali è sigillato a DB (G23). Se la UI ne offrisse un
    // quarto, l'insert fallirebbe al banco e l'E2E S2 pescherebbe un'etichetta
    // che non c'è: meglio scoprirlo qui.
    const src = leggi(PERMESSI);
    const blocco = src.slice(src.indexOf("const CANALI"), src.indexOf("] as const", src.indexOf("const CANALI")));
    const ids = Array.from(blocco.matchAll(/id:\s*"([a-z]+)"/g)).map((m) => m[1]);
    expect(ids.sort()).toEqual(["cartaceo", "cellulare", "email"]);
    for (const label of ["Email", "Cellulare", "Cartaceo"]) {
      expect(blocco.includes(`label: "${label}"`), `manca l'etichetta ${label}`).toBe(true);
    }
  });

  it("G29d · UNA sola riga «Marketing: …» in tutta la UI (C3: una cache, un posto)", () => {
    // È insieme un invariante di prodotto e la condizione perché l'E2E possa
    // asserire senza ambiguità (strict mode): se due componenti stampassero
    // «Marketing: …», il locatore ne troverebbe due e S2/S3 morirebbero con un
    // errore che non spiega niente.
    const stampano = [...sorgenti("app"), ...sorgenti("components")].filter((f) =>
      /Marketing:/.test(readFileSync(f, "utf8"))
    );
    expect(
      stampano.map(rel),
      `la riga «Marketing: …» deve stare in un posto solo (la sezione Permessi): ${stampano.map(rel).join(", ")}`
    ).toEqual([PERMESSI]);
  });

  it("G29f · la riga «Assicurazione: …» si stampa SEMPRE («da rilevare» è uno stato)", () => {
    // M1 §2 ha TRE stati, non due: `null` = da rilevare · voce NESSUNA =
    // chiesto, non ne ha · altra voce = quella. Fino al 06/08 il blocco era
    // dietro `{(assicurazione || fatt) && …}`, quindi il primo stato era
    // INVISIBILE e l'E2E S5 (1/2) poteva solo constatare l'assenza della riga.
    // Ora la riga c'è sempre e lo scenario asserisce i tre stati in positivo:
    // questa guardia impedisce che la condizione torni e lo renda di nuovo muto.
    const src = leggi(SCHEDA);
    expect(
      src.includes('"da rilevare"'),
      "la scheda deve stampare «da rilevare» quando assicurazione_id è null"
    ).toBe(true);
    expect(
      /\(\s*assicurazione\s*\|\|\s*fatt\s*\)/.test(src),
      "RATCHET: la riga assicurazione non torna dietro una condizione (M1 §2, tre stati visibili)"
    ).toBe(false);
  });

  it("G29e · il consenso marketing NON è più un campo di form (C3: la cache non si spunta)", () => {
    const colpevoli: string[] = [];
    for (const f of [...sorgenti("app"), ...sorgenti("components")]) {
      const src = readFileSync(f, "utf8");
      // Un input/checkbox chiamato come la colonna-cache: è il modo esatto in
      // cui il consenso rientrerebbe dalla finestra (e in cui `aggiornaCliente`
      // tornerebbe a spegnerlo senza un evento nel mastro).
      if (/name=["'](consenso_marketing|consenso_canali|data_consenso)["']/.test(src)) {
        colpevoli.push(rel(f));
      }
    }
    expect(
      colpevoli,
      `C3: il marketing si raccoglie SOLO dal mastro (registra_consenso). Campi di form in: ${colpevoli.join(", ")}`
    ).toEqual([]);
  });
});
