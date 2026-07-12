"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Field, inputCls, Errore } from "@/components/ui";

export default function RegistratiPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [confermaEmail, setConfermaEmail] = useState(false);

  async function registrati(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setErrore(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrore(
        error.message.includes("already registered")
          ? "Questa email è già registrata: prova ad accedere."
          : error.message
      );
      setInvio(false);
      return;
    }

    // Se la conferma email è disattivata, la sessione arriva subito.
    if (data.session) {
      router.push("/benvenuto");
      router.refresh();
      return;
    }

    setConfermaEmail(true);
    setInvio(false);
  }

  if (confermaEmail) {
    return (
      <Card>
        <h1 className="f-serif mb-2 text-xl font-semibold text-inchiostro">
          Controlla la posta 📬
        </h1>
        <p className="text-sm text-soft">
          Ti abbiamo inviato un link di conferma a{" "}
          <strong className="text-inchiostro">{email}</strong>. Aprilo e
          completeremo insieme la configurazione del negozio.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="f-serif mb-1 text-xl font-semibold text-inchiostro">
        Crea il tuo negozio
      </h1>
      <p className="mb-4 text-sm text-soft">
        Un account, il tuo negozio, i tuoi dati. Due minuti.
      </p>
      <form onSubmit={registrati} className="space-y-4">
        <Errore msg={errore} />
        <Field label="Il tuo nome">
          <input
            type="text"
            required
            className={inputCls}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Maria Rossi"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@ottica.it"
          />
        </Field>
        <Field label="Password" hint="Minimo 8 caratteri.">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <button
          type="submit"
          disabled={invio}
          className="w-full rounded-xl bg-ottone px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ottone-scuro disabled:opacity-50"
        >
          {invio ? "Un attimo…" : "Crea account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-soft">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-ottone-scuro hover:underline">
          Accedi
        </Link>
      </p>
    </Card>
  );
}
