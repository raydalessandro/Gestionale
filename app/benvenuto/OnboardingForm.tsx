"use client";

import { useActionState, useState } from "react";
import { completaOnboarding } from "@/lib/actions";
import { slugify } from "@/lib/utils";
import { Card, Field, inputCls, Errore } from "@/components/ui";

export default function OnboardingForm({
  nomeSuggerito,
}: {
  nomeSuggerito: string;
}) {
  const [stato, azione, inCorso] = useActionState(completaOnboarding, null);
  const [nomeAzienda, setNomeAzienda] = useState("");
  const [slug, setSlug] = useState("");
  const [slugToccato, setSlugToccato] = useState(false);

  function onNomeAzienda(v: string) {
    setNomeAzienda(v);
    if (!slugToccato) setSlug(slugify(v));
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="f-serif mb-1 text-xl font-semibold text-inchiostro">
        Benvenuto 👋
      </h1>
      <p className="mb-4 text-sm text-soft">
        Ultimo passo: diamo un nome al negozio. Lo slug sarà il suo indirizzo
        su sito e app (si può affinare dopo).
      </p>
      <form action={azione} className="space-y-4">
        <Errore msg={stato?.errore} />
        <Field label="Nome del negozio">
          <input
            name="nome_azienda"
            type="text"
            required
            className={inputCls}
            value={nomeAzienda}
            onChange={(e) => onNomeAzienda(e.target.value)}
            placeholder="Ottica Aurora"
          />
        </Field>
        <Field label="Slug" hint="Solo minuscole, numeri e trattini. Es: ottica-aurora">
          <input
            name="slug"
            type="text"
            required
            pattern="[a-z0-9-]{3,40}"
            className={`${inputCls} f-mono`}
            value={slug}
            onChange={(e) => {
              setSlugToccato(true);
              setSlug(e.target.value);
            }}
            placeholder="ottica-aurora"
          />
        </Field>
        <Field label="Il tuo nome">
          <input
            name="nome_utente"
            type="text"
            required
            className={inputCls}
            defaultValue={nomeSuggerito}
            placeholder="Maria Rossi"
          />
        </Field>
        <button
          type="submit"
          disabled={inCorso}
          className="w-full rounded-xl bg-ottone px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50"
        >
          {inCorso ? "Creo il negozio…" : "Apri il gestionale"}
        </button>
      </form>
    </Card>
  );
}
