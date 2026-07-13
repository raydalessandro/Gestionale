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
