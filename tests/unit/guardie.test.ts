import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

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
