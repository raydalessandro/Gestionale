/**
 * ⚠️  SCRIPT DI SVILUPPO / INFRASTRUTTURA — NON va MAI importato dall'app.
 *
 * Porta un progetto Postgres/Supabase VUOTO fino a schema, in ordine:
 * `supabase/schema.sql` (la base, "001") e poi tutte le `supabase/migrazioni/*.sql`.
 * Serve adesso per il progetto di test, ma serve ogni volta che qualcuno dovrà
 * ricostruire un ambiente da zero — cosa che succederà.
 *
 * Idempotente: tiene un registro `public._infra_migrazioni` e SALTA ciò che è già
 * applicato. Si ferma alla PRIMA migrazione che fallisce e dice QUALE, senza
 * proseguire. Stampa alla fine l'elenco applicato.
 *
 * Uso:
 *   SUPABASE_DB_URL='postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
 *     [MARCA_AMBIENTE_TEST=1] npx tsx scripts/applica-migrazioni.ts
 *
 * La connessione (col relativo segreto) si legge SOLO dall'ambiente: nessuna
 * credenziale finisce in un file. MARCA_AMBIENTE_TEST=1 scrive la riga ('test')
 * in `public.ambiente`, che abilita `svuota_dati_di_test()`: fallo SOLO sul
 * progetto di TEST, MAI in produzione.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DB = process.env.SUPABASE_DB_URL;

async function main(): Promise<void> {
  if (!DB) {
    console.error(
      "Manca SUPABASE_DB_URL (la stringa di connessione postgres del progetto).\n" +
        "La trovi in Supabase → Project Settings → Database → Connection string (URI)."
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `create table if not exists public._infra_migrazioni (
         nome text primary key, applied_at timestamptz not null default now())`
    );

    const migDir = join(ROOT, "supabase", "migrazioni");
    const passi = [
      { nome: "001_schema_base", path: join(ROOT, "supabase", "schema.sql") },
      ...readdirSync(migDir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => ({ nome: f.replace(/\.sql$/, ""), path: join(migDir, f) })),
    ];

    const applicate: string[] = [];
    for (const { nome, path } of passi) {
      const gia = await client.query("select 1 from public._infra_migrazioni where nome = $1", [nome]);
      if (gia.rowCount) continue;

      const sql = readFileSync(path, "utf8");
      try {
        await client.query("begin");
        await client.query(sql);
        // Dalla 021 ogni file si auto-registra per restare applicabile anche
        // fuori da questo runner. Il secondo insert del canale autorizzato è
        // quindi deliberatamente idempotente, nella medesima transazione.
        await client.query("insert into public._infra_migrazioni (nome) values ($1) on conflict (nome) do nothing", [nome]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback").catch(() => undefined);
        console.error(`\n✗ Migrazione FALLITA: ${nome}\n  ${(e as Error).message}`);
        console.error("Mi fermo qui: le successive NON sono state applicate.");
        process.exit(1);
      }
      applicate.push(nome);
    }

    if (process.env.MARCA_AMBIENTE_TEST === "1") {
      await client.query("create table if not exists public.ambiente (nome text primary key)");
      await client.query("insert into public.ambiente (nome) values ('test') on conflict do nothing");
      console.log("Ambiente marcato 'test' → svuota_dati_di_test() abilitata su questo progetto.");
    }

    console.log(
      applicate.length
        ? `Applicate ora (${applicate.length}):\n  ${applicate.join("\n  ")}`
        : "Nulla da applicare: il progetto è già allineato."
    );
    const tot = await client.query("select nome from public._infra_migrazioni order by nome");
    console.log(`\nMigrazioni sul progetto (${tot.rowCount}):\n  ${tot.rows.map((r) => r.nome).join("\n  ")}`);
  } finally {
    await client.end();
  }
}

void main();
