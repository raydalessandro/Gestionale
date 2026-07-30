import type { Config } from "tailwindcss";

/**
 * Palette Limpidia — un marchio, un accento.
 *
 * Tutto è derivato in OKLCH dall'ambra del marchio #B4551A (L 0.559 · C 0.141 · h 47.5°).
 * Il passo `ambra-500` È il marchio, non un valore vicino.
 * Anche i neutri stanno a 47.5° con croma ~0.01: ogni grigio dell'applicazione
 * è ambra spentissima, ed è questo che tiene insieme la pagina.
 *
 * REGOLE (non sono stile, sono struttura):
 *   · l'ambra è l'AZIONE e il marchio. Non è mai uno stato.
 *   · su fondo scuro si usa ambra-300: ambra-500 su inchiostro fa 3.84, sotto soglia.
 *   · neutro-500 non può portare testo (4.13). Bordi e icone soltanto.
 *   · si colora il lavoro da fare, non lo stato in sé: preventivo e consegnata
 *     restano grigi perché non chiedono niente a nessuno.
 *
 * Contrasti verificati:
 *   inchiostro su carta 15.9 · inchiostro su scheda 18.0 · bianco su ambra-500 4.94
 *   ambra-600 su carta 6.17 · ambra-300 su inchiostro 9.51 · neutro-600 su carta 5.88
 *
 * `ottone` non c'è più: era l'accento di un prodotto che non esiste. Le 89
 * occorrenze nel repo sono state riscritte in ambra in questo stesso ramo, così
 * il token non resta a galleggiare senza nessuno che lo usi.
 */
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── carta e inchiostro ──────────────────────────────────
        carta: "#F9EFEA",        // fondo pagina
        inchiostro: "#1D1511",   // testo
        linea: "#D7D4D2",
        soft: "#625B58",
        faint: "#9D9693",

        // ── l'accento: il marchio ───────────────────────────────
        ambra: {
          50: "#FEF3ED",  100: "#FAE2D7", 200: "#F7CAB4", 300: "#EFA783",
          400: "#D87C4C", 500: "#B4551A", 600: "#963F00", 700: "#732E00",
          800: "#521F00", 900: "#371100", 950: "#230700",
          DEFAULT: "#B4551A", soft: "#FEF3ED", scuro: "#732E00",
        },

        // ── neutri, alla tinta del marchio ──────────────────────
        neutro: {
          50: "#F7F4F3",  100: "#EAE7E6", 200: "#D7D4D2", 300: "#BFB9B7",
          400: "#9D9693", 500: "#79736F", 600: "#625B58", 700: "#4A4442",
          800: "#342F2D", 900: "#211D1C", 950: "#12100F",
        },

        // ── stati. Solo dove c'è lavoro da fare. ────────────────
        // Il passo 200 esiste per i filetti: 100 su bianco non si vede,
        // 500 su bianco è un bordo che urla. Non porta mai testo.
        // pronta / arrivato — è il momento in cui si chiama il cliente
        verde: { 50: "#EFF7F3", 100: "#DBEDE4", 200: "#BFDFD1", 500: "#2E8666",
                 600: "#0C6E4F", 700: "#00533A",
                 DEFAULT: "#0C6E4F", soft: "#DBEDE4" },
        // in lavorazione / ordinato — in corso, non tocca a te
        blu:   { 50: "#F1F6FB", 100: "#DEE9F5", 200: "#C2D7EB", 500: "#4878A8",
                 600: "#31608E", 700: "#1E4870",
                 DEFAULT: "#31608E", soft: "#DEE9F5" },
        // in ritardo / errore — l'unico vero allarme
        rosso: { 50: "#FEF1F2", 100: "#FCE0E2", 200: "#F5C3C8", 500: "#B74B5E",
                 600: "#9B3348", 700: "#7A1E33",
                 DEFAULT: "#9B3348", soft: "#FCE0E2" },

        // ── portale ─────────────────────────────────────────────
        // Stessi valori del gestionale: un marchio, una palette.
        // I nomi `lim-*` restano per non rompere le pagine esistenti.
        lim: {
          inchiostro: "#1D1511",
          carta: "#F9EFEA",
          ambra: "#B4551A",
          ambraScura: "#732E00",
          ambraSoft: "#FEF3ED",
          linea: "#D7D4D2",
          soft: "#625B58",
          faint: "#9D9693",
        },
      },

      // ── spigoli: «Netta». Tutto a 5px, niente di più tondo. ───
      borderRadius: {
        DEFAULT: "5px",
        sm: "3px",
        md: "5px",
        lg: "6px",
        xl: "8px",
        "2xl": "10px",
      },

      fontFamily: {
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
        "lim-display": ["var(--font-lim-display)", "system-ui", "sans-serif"],
        "lim-testo": ["var(--font-lim-testo)", "system-ui", "sans-serif"],
      },

      // ── movimento ───────────────────────────────────────────
      // Dentro il gestionale: solo conferma, mai decorazione.
      transitionDuration: { scatto: "110ms", fuoco: "240ms" },
    },
  },
  plugins: [],
} satisfies Config;
