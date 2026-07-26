import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Informativa privacy — prenotazioni",
  robots: { index: true, follow: true },
};

/**
 * Informativa privacy del portale (G7). Minima ma reale: una spunta che rimanda
 * al nulla è peggio che non averla. Server component, nessuna interattività.
 */
export default function InformativaPage() {
  return (
    <main className="mx-auto max-w-[640px] px-5 py-10">
      <h1 className="font-lim-display text-2xl font-bold text-lim-inchiostro">
        Informativa privacy — prenotazioni
      </h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-lim-inchiostro">
        <p>
          Quando prenoti da questa pagina, Limpidia raccoglie i dati che scrivi —
          nome, telefono e, se lo lasci, l'email — <strong>per gestire la tua
          richiesta di appuntamento</strong> e metterla in contatto con il negozio
          che hai scelto.
        </p>
        <p>
          <strong>Il negozio che scegli vedrà</strong> il tuo nome, il tuo
          recapito e i dettagli della prenotazione: gli servono per prepararsi e
          per confermarti l'appuntamento. Nessun altro negozio vede questa
          richiesta.
        </p>
        <p>
          Accettare questa informativa <strong>non è un consenso commerciale</strong>:
          non stai autorizzando l'invio di promozioni. Quello è un'altra cosa,
          separata, che il negozio ti chiederà eventualmente in seguito.
        </p>
        <p>
          Puoi chiedere in ogni momento di vedere, correggere o cancellare i tuoi
          dati scrivendo al negozio o a Limpidia. Le date delle prenotazioni
          restano registrate come storico, salvo tua richiesta di cancellazione.
        </p>
      </div>
      <p className="mt-8 text-[14px]">
        <Link href=".." className="font-semibold text-lim-ambra underline">
          ← Torna alla prenotazione
        </Link>
      </p>
    </main>
  );
}
