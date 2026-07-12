import Link from "next/link";
import { Search, UserPlus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  PageHeader,
  ButtonLink,
  Badge,
  tintaFonte,
  Vuoto,
  inputCls,
} from "@/components/ui";
import { ETICHETTE_FONTE } from "@/lib/utils";

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clienti")
    .select("id, nome, cognome, telefono, email, citta, fonte")
    .order("cognome")
    .order("nome")
    .limit(100);

  if (q && q.trim() !== "") {
    const term = q.trim().replace(/[%,]/g, "");
    query = query.or(
      `nome.ilike.%${term}%,cognome.ilike.%${term}%,telefono.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  const { data: clienti } = await query;

  return (
    <>
      <PageHeader
        titolo="Clienti"
        sotto="L'anagrafica del negozio: da qui partono prescrizioni e ordini."
        azione={
          <ButtonLink href="/clienti/nuovo" variante="accent">
            <UserPlus size={16} /> Nuovo cliente
          </ButtonLink>
        }
      />

      <form className="relative mb-4" action="/clienti" method="get">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Cerca per nome, telefono, email…"
          className={`${inputCls} !pl-10`}
        />
      </form>

      {clienti && clienti.length > 0 ? (
        <Card className="divide-y divide-linea !p-0">
          {clienti.map((c) => (
            <Link
              key={c.id}
              href={`/clienti/${c.id}`}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-carta"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-inchiostro">
                  {c.cognome} {c.nome}
                </p>
                <p className="truncate text-xs text-soft">
                  {[c.telefono, c.email, c.citta].filter(Boolean).join(" · ") ||
                    "Nessun contatto"}
                </p>
              </div>
              <Badge tinta={tintaFonte(c.fonte)}>
                {ETICHETTE_FONTE[c.fonte] ?? c.fonte}
              </Badge>
              <ChevronRight size={16} className="shrink-0 text-faint" />
            </Link>
          ))}
        </Card>
      ) : q ? (
        <Vuoto
          titolo="Nessun risultato"
          testo={`Nessun cliente corrisponde a "${q}". Prova con meno lettere, o crealo al volo.`}
          azione={
            <ButtonLink href="/clienti/nuovo" variante="ghost">
              <UserPlus size={16} /> Nuovo cliente
            </ButtonLink>
          }
        />
      ) : (
        <Vuoto
          titolo="Ancora nessun cliente"
          testo="Aggiungi il primo: bastano nome e cognome, il resto si completa strada facendo."
          azione={
            <ButtonLink href="/clienti/nuovo" variante="ghost">
              <UserPlus size={16} /> Aggiungi il primo cliente
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
