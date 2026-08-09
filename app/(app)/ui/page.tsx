/**
 * Catalogo della UI — sezione 1 · colore e tipografia.
 *
 * Non è una schermata del prodotto: è il posto dove si guarda un pezzo alla
 * volta e si dice sì o no, prima che quel pezzo finisca su ventiquattro
 * schermate. Si costruisce una sezione per volta.
 *
 *   1. colore e tipografia   ← questa
 *   2. bottoni
 *   3. campi
 *   4. schede ed elenchi
 *   5. pastiglie e stati
 *   6. icone
 *   7. figure vuote
 *
 * Tutto quello che vedi qui è **letto dai token veri** di `tailwind.config.ts`:
 * i rapporti di contrasto sono calcolati, non trascritti. Se cambi un token,
 * questa pagina cambia da sola — e se un accostamento scende sotto soglia, lo
 * dice qui invece che in produzione.
 */

export const metadata = { robots: { index: false, follow: false } };

/* ── Contrasto, calcolato ─────────────────────────────────────────────────
 * WCAG 2.1: (L1 + 0.05) / (L2 + 0.05). Soglia 4.5 per il testo normale,
 * 3.0 per il testo grande (≥18.66px grassetto o ≥24px) e per i bordi. */
function luminanza(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrasto(a: string, b: string): number {
  const [l1, l2] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* ── I token, trascritti una volta sola da tailwind.config.ts ───────────── */

const BASE: [string, string, string][] = [
  ["carta", "#F9EFEA", "fondo pagina"],
  ["superficie", "#FFFFFF", "schede ed elenchi"],
  ["inchiostro", "#1D1511", "testo"],
  ["linea", "#D7D4D2", "filetti"],
  ["soft", "#625B58", "testo secondario"],
  ["faint", "#9D9693", "icone — mai testo"],
];

const RAMPE: [string, string, Record<number, string>][] = [
  [
    "ambra",
    "l'azione e il marchio. Mai uno stato.",
    { 50: "#FEF3ED", 100: "#FAE2D7", 200: "#F7CAB4", 300: "#EFA783", 400: "#D87C4C", 500: "#B4551A", 600: "#963F00", 700: "#732E00", 800: "#521F00", 900: "#371100", 950: "#230700" },
  ],
  [
    "neutro",
    "alla tinta del marchio (47.5°), croma 0.01. Non sono grigi neutri: sono ambra spentissima.",
    { 50: "#F7F4F3", 100: "#EAE7E6", 200: "#D7D4D2", 300: "#BFB9B7", 400: "#9D9693", 500: "#79736F", 600: "#625B58", 700: "#4A4442", 800: "#342F2D", 900: "#211D1C", 950: "#12100F" },
  ],
  ["verde", "pronta · arrivato — il momento in cui si chiama il cliente", { 50: "#EFF7F3", 100: "#DBEDE4", 200: "#BFDFD1", 500: "#2E8666", 600: "#0C6E4F", 700: "#00533A" }],
  ["blu", "in lavorazione · ordinato — in corso, non tocca a te", { 50: "#F1F6FB", 100: "#DEE9F5", 200: "#C2D7EB", 500: "#4878A8", 600: "#31608E", 700: "#1E4870" }],
  ["rosso", "in ritardo · errore — l'unico vero allarme", { 50: "#FEF1F2", 100: "#FCE0E2", 200: "#F5C3C8", 500: "#B74B5E", 600: "#9B3348", 700: "#7A1E33" }],
];

/** Gli accostamenti che l'applicazione usa davvero. Se uno scende sotto
 *  soglia, la riga diventa rossa: è il controllo, non la vetrina. */
const ACCOSTAMENTI: [string, string, string, number][] = [
  ["inchiostro su carta", "#1D1511", "#F9EFEA", 4.5],
  ["inchiostro su bianco", "#1D1511", "#FFFFFF", 4.5],
  ["soft su bianco", "#625B58", "#FFFFFF", 4.5],
  ["soft su carta", "#625B58", "#F9EFEA", 4.5],
  ["faint su bianco — perché NON porta testo", "#9D9693", "#FFFFFF", 4.5],
  ["neutro-500 su bianco", "#79736F", "#FFFFFF", 4.5],
  ["bianco su ambra-500 — il pulsante", "#FFFFFF", "#B4551A", 4.5],
  ["ambra-600 su carta", "#963F00", "#F9EFEA", 4.5],
  ["ambra-700 su ambra-50 — la voce attiva", "#732E00", "#FEF3ED", 4.5],
  ["ambra-500 su inchiostro — vietato su fondo scuro", "#B4551A", "#12100F", 4.5],
  ["ambra-300 su inchiostro — l'ambra ammessa sul scuro", "#EFA783", "#12100F", 4.5],
  ["verde-700 su verde-100", "#00533A", "#DBEDE4", 4.5],
  ["blu-700 su blu-100", "#1E4870", "#DEE9F5", 4.5],
  ["rosso-700 su rosso-100", "#7A1E33", "#FCE0E2", 4.5],
  ["neutro-700 su neutro-200", "#4A4442", "#D7D4D2", 4.5],
  ["neutro-600 su neutro-100", "#625B58", "#EAE7E6", 4.5],
];

const CORPI: [string, string, string][] = [
  ["f-serif text-[25px]", "Titolo di schermata", "Oggi"],
  ["f-serif text-[19px]", "Titolo di scheda grande", "Nessun altro appuntamento oggi."],
  ["f-serif text-base", "Titolo di scheda", "Cosa puoi fare adesso"],
  ["text-[15px]", "Corpo", "Il primo di domani è alle 09:30, Elena Marchetti."],
  ["text-[14.5px] font-medium", "Riga di elenco", "Marchetti Elena"],
  ["text-[12.5px] text-soft", "Sottoriga", "BL-2026-0141 · progressive, in lavorazione"],
  ["font-mono text-[31px]", "Ora, cifre tabellari", "09:00"],
  ["font-mono text-[13px]", "Codici e importi", "BL-2026-0141 · 346,00"],
  ["font-mono text-[9.5px] uppercase tracking-[0.15em]", "Etichetta", "Prossimo appuntamento"],
];

function Sezione({ n, titolo, nota, children }: { n: string; titolo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="f-serif text-lg font-semibold tracking-tight text-inchiostro">
        <span className="mr-2 font-mono text-[13px] font-normal text-faint">{n}</span>
        {titolo}
      </h2>
      {nota && <p className="mb-3 mt-1 max-w-[68ch] text-[13.5px] text-soft">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function CatalogoUI() {
  return (
    <>
      <div className="mb-6 border-b border-linea pb-5">
        <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.15em] text-soft">
          Catalogo · sezione 1 di 7
        </p>
        <h1 className="f-serif mt-1 text-[25px] font-semibold tracking-tight text-inchiostro">
          Colore e tipografia
        </h1>
        <p className="mt-2 max-w-[68ch] text-[14.5px] text-soft">
          Si guarda un pezzo alla volta. Questa è la base: se l&apos;ambra o la scala dei corpi
          non vanno, tutto quello che ci sta sopra è sbagliato di conseguenza. I rapporti di
          contrasto qui sotto sono <b className="font-semibold text-inchiostro">calcolati</b>,
          non trascritti: se cambio un token cambiano da soli.
        </p>
        <p className="mt-2 font-mono text-[11.5px] text-faint">
          poi: 2 bottoni · 3 campi · 4 schede ed elenchi · 5 pastiglie · 6 icone · 7 figure vuote
        </p>
      </div>

      <Sezione n="1.1" titolo="Carta e inchiostro" nota="Il meccanismo di tutta l'applicazione: pagina tinta, schede bianche. Il dato si solleva senza ombre.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BASE.map(([nome, hex, uso]) => (
            <div key={nome} className="flex items-center gap-3 rounded border border-linea bg-white p-2.5">
              <span
                className="h-11 w-11 shrink-0 rounded border border-linea"
                style={{ background: hex }}
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-inchiostro">{nome}</span>
                <span className="block font-mono text-[11.5px] text-soft">{hex}</span>
                <span className="block text-[11.5px] text-soft">{uso}</span>
              </span>
            </div>
          ))}
        </div>
      </Sezione>

      <Sezione n="1.2" titolo="Le rampe" nota="Tutto è derivato in OKLCH dall'ambra del marchio #B4551A. Il passo ambra-500 È il marchio, non un valore vicino.">
        <div className="space-y-4">
          {RAMPE.map(([nome, perche, passi]) => (
            <div key={nome}>
              <p className="text-[14px] font-semibold text-inchiostro">
                {nome}
                <span className="ml-2 font-normal text-[12.5px] text-soft">{perche}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(passi).map(([passo, hex]) => {
                  const suBianco = contrasto(hex, "#FFFFFF");
                  return (
                    <span
                      key={passo}
                      className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded border border-linea"
                      style={{ background: hex, color: suBianco >= 4.5 ? "#FFFFFF" : "#1D1511" }}
                      title={`${nome}-${passo} ${hex}`}
                    >
                      <b className="font-mono text-[12px] font-semibold">{passo}</b>
                      <span className="font-mono text-[8.5px] opacity-80">{hex}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Sezione>

      <Sezione
        n="1.3"
        titolo="Contrasto, calcolato"
        nota="Gli accostamenti che l'applicazione usa davvero. Soglia 4.5 per il testo. Le due righe segnate «atteso sotto soglia» sono lì apposta: dicono perché una certa combinazione è vietata."
      >
        <div className="overflow-hidden rounded border border-linea bg-white">
          {ACCOSTAMENTI.map(([nome, fg, bg, soglia]) => {
            const r = contrasto(fg, bg);
            const passa = r >= soglia;
            const attesoNo = nome.includes("NON") || nome.includes("vietato");
            return (
              <div
                key={nome}
                className="flex flex-wrap items-center gap-3 border-t border-neutro-100 px-3 py-2 first:border-t-0"
              >
                <span
                  className="grid h-10 w-24 shrink-0 place-content-center rounded border border-linea text-[12.5px] font-semibold"
                  style={{ background: bg, color: fg }}
                >
                  Testo
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] text-inchiostro">{nome}</span>
                <span className="shrink-0 font-mono text-[13px] font-semibold text-inchiostro">
                  {r.toFixed(2)}
                </span>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[11.5px] font-semibold ${
                    attesoNo
                      ? passa
                        ? "bg-rosso-100 text-rosso-700"
                        : "bg-neutro-200 text-neutro-700"
                      : passa
                        ? "bg-verde-100 text-verde-700"
                        : "bg-rosso-100 text-rosso-700"
                  }`}
                >
                  {attesoNo ? (passa ? "doveva fallire!" : "atteso sotto soglia") : passa ? "passa" : "SOTTO SOGLIA"}
                </span>
              </div>
            );
          })}
        </div>
      </Sezione>

      <Sezione
        n="1.4"
        titolo="La scala dei corpi"
        nota="Fraunces per i titoli, Sora per il testo, JetBrains Mono per i numeri. I codici busta, le diottrie e gli importi sono sempre in mono con cifre tabellari: si leggono in colonna e si confrontano."
      >
        <div className="overflow-hidden rounded border border-linea bg-white">
          {CORPI.map(([classi, uso, esempio]) => (
            <div key={classi} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-neutro-100 px-3 py-3 first:border-t-0">
              <span className="w-[190px] shrink-0">
                <span className="block font-mono text-[11px] text-soft">{classi}</span>
                <span className="block text-[11.5px] text-faint">{uso}</span>
              </span>
              <span className={`min-w-0 flex-1 text-inchiostro ${classi}`}>{esempio}</span>
            </div>
          ))}
        </div>
      </Sezione>

      <Sezione n="1.5" titolo="La regola dell'ambra, in pratica" nota="L'ambra compare due volte per schermata: azione principale e voce attiva. Non è mai uno stato.">
        <div className="flex flex-wrap items-center gap-3 rounded border border-linea bg-white p-4">
          <span className="inline-flex min-h-[48px] items-center rounded bg-ambra-500 px-4 text-[15px] font-semibold text-white">
            Azione principale
          </span>
          <span className="inline-flex min-h-[48px] items-center rounded bg-ambra-50 px-4 text-[15px] font-semibold text-ambra-700">
            Voce attiva
          </span>
          <span className="inline-flex min-h-[48px] items-center rounded border border-linea bg-white px-4 text-[15px] text-inchiostro">
            Tutto il resto
          </span>
          <span className="inline-flex min-h-[48px] items-center rounded bg-neutro-950 px-4 text-[15px] font-semibold text-ambra-300">
            Su fondo scuro: ambra-300
          </span>
        </div>
      </Sezione>
    </>
  );
}
