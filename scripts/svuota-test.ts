/**
 * ⚠️  SCRIPT DI INFRASTRUTTURA — NON va MAI importato dall'app.
 *
 * Chiama `svuota_dati_di_test()` sul progetto di TEST, con la service role key.
 * La CI lo esegue PRIMA del lavoro di contratto: se un giro fallisce a metà, il
 * successivo parte pulito lo stesso.
 *
 * La funzione si rifiuta di girare se `public.ambiente` non contiene 'test',
 * quindi puntarla per sbaglio alla produzione non cancella nulla.
 *
 * Uso (env dal segreto, mai da file):
 *   TEST_SUPABASE_URL=… TEST_SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/svuota-test.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error("Mancano TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await svc.rpc("svuota_dati_di_test");
if (error) {
  console.error(`svuota_dati_di_test fallita: ${error.message}`);
  process.exit(1);
}
console.log("Residuo delle prove ripulito (svuota_dati_di_test).");
