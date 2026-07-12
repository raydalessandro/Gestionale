import type { Config } from "tailwindcss";

/**
 * Palette VISTA Gestionale — carta e inchiostro, ottone come accento.
 * Gli stati (verde/ambra/blu/rosso) riprendono i colori già usati
 * nelle pipeline della demo (STATI_LAC / STATI_BUSTA).
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
        carta: "#FAF7F2",
        inchiostro: "#1C1714",
        ottone: { DEFAULT: "#A67C42", soft: "#EFE4D3", scuro: "#8A6533" },
        linea: "#E7DFD2",
        soft: "#6B5D50",
        faint: "#B9AA97",
        verde: { DEFAULT: "#127E7A", soft: "#E2F0EE" },
        ambra: { DEFAULT: "#C98A2B", soft: "#F7EEDD" },
        blu: { DEFAULT: "#5B6DA8", soft: "#E7EAF6" },
        rosso: { DEFAULT: "#B0483F", soft: "#F6E4E2" },
      },
      fontFamily: {
        ui: ["var(--font-ui)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
