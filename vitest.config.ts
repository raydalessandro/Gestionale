import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Config Vitest per la rete di sicurezza VISTA.
 *
 * I livelli si selezionano dal path in CLI (vedi script package.json):
 *   • L1 unit + L4 guardie → `vitest run tests/unit`   (script `test`)
 *   • L2 contratto         → `vitest run tests/contratto` (script `test:contratto`)
 *
 * L1/L4 girano ovunque (nessuna rete). L2 richiede le env del progetto
 * Supabase di test (TEST_SUPABASE_*) e non deve girare in locale senza di esse.
 */
export default defineConfig({
  // Rispecchia l'alias di tsconfig ("@/*" → radice progetto) senza plugin extra.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Il contratto parla con la rete: serve respiro. L'unit resta comunque veloce.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Un file per volta a livello contratto eviterebbe rumore fra tenant;
    // gli unit sono puri e possono restare paralleli. Vitest isola per file.
    reporters: "default",
  },
});
