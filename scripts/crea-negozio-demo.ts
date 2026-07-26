/**
 * ⚠️  SCRIPT DI SVILUPPO — NON va MAI importato da codice dell'applicazione.
 *
 * Dà un TITOLARE al negozio dimostrativo «Ottica Aurora» (slug 'ottica-demo'),
 * cosa che il seed SQL non può fare: `auth.users` è gestito da GoTrue e la rpc
 * di onboarding richiede `auth.uid()`, cioè una registrazione vera. Qui, con la
 * chiave di SERVIZIO, creiamo l'utente auth (email confermata) e la riga in
 * `public.utenti` con ruolo 'titolare'.
 *
 * Idempotente: se l'utente esiste già, non fa nulla e lo dice.
 * La chiave di servizio si legge dall'AMBIENTE e non viene MAI scritta su file.
 * Le credenziali dimostrative stanno in docs/credenziali-demo.md, non nel codice.
 *
 * Uso:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/crea-negozio-demo.ts
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SLUG = "ottica-demo";
const EMAIL = "titolare.aurora@example.com";
const PASSWORD = "AuroraDemo-2026!";
const NOME = "Aurora Bianchi";

async function main(): Promise<void> {
  if (!URL || !SERVICE) {
    console.error(
      "Mancano SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY nell'ambiente. " +
        "Passale come variabili d'ambiente (mai su file versionato)."
    );
    process.exit(1);
  }

  const svc = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1 · L'azienda deve esistere (applica prima il seed).
  const { data: az, error: eAz } = await svc
    .from("aziende")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (eAz || !az) {
    console.error(`Azienda '${SLUG}' non trovata: applica prima supabase/seed/seed_demo.sql.`);
    process.exit(1);
  }
  const aziendaId = az.id as string;

  // 2 · Utente auth — idempotente per email.
  const { data: lista, error: eList } = await svc.auth.admin.listUsers({ perPage: 200 });
  if (eList) {
    console.error(`listUsers fallita: ${eList.message}`);
    process.exit(1);
  }
  const esistente = lista.users.find((u) => u.email === EMAIL);

  let userId: string;
  if (esistente) {
    userId = esistente.id;
    console.log(`Utente auth ${EMAIL} già presente (${userId}): non lo ricreo.`);
  } else {
    const { data: creato, error: eCreate } = await svc.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: NOME },
    });
    if (eCreate || !creato.user) {
      console.error(`createUser fallita: ${eCreate?.message ?? "utente nullo"}`);
      process.exit(1);
    }
    userId = creato.user.id;
    console.log(`Utente auth creato: ${EMAIL} (${userId}).`);
  }

  // 3 · Riga in public.utenti — idempotente sull'id.
  const { data: giaUtente } = await svc.from("utenti").select("id").eq("id", userId).maybeSingle();
  if (giaUtente) {
    console.log("Riga in public.utenti già presente: niente da fare.");
  } else {
    const { error: eUt } = await svc.from("utenti").insert({
      id: userId,
      azienda_id: aziendaId,
      email: EMAIL,
      nome: NOME,
      ruolo: "titolare",
    });
    if (eUt) {
      console.error(`insert in utenti fallita: ${eUt.message}`);
      process.exit(1);
    }
    console.log(`Titolare collegato a '${SLUG}'. Accesso: ${EMAIL} (password in docs/credenziali-demo.md).`);
  }

  console.log("Fatto.");
}

void main();
