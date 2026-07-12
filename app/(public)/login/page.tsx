"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, Field, inputCls, Errore } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(
    searchParams.get("errore") === "link"
      ? "Il link non è più valido: accedi con email e password."
      : null
  );
  const [invio, setInvio] = useState(false);

  async function accedi(e: React.FormEvent) {
    e.preventDefault();
    setInvio(true);
    setErrore(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrore(
        error.message.includes("Invalid login")
          ? "Email o password non corretti."
          : error.message
      );
      setInvio(false);
      return;
    }

    router.push(searchParams.get("da") ?? "/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <h1 className="f-serif mb-4 text-xl font-semibold text-inchiostro">
        Accedi
      </h1>
      <form onSubmit={accedi} className="space-y-4">
        <Errore msg={errore} />
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
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <button
          type="submit"
          disabled={invio}
          className="w-full rounded-xl bg-inchiostro px-4 py-2.5 text-sm font-semibold text-carta transition-colors hover:bg-black disabled:opacity-50"
        >
          {invio ? "Un attimo…" : "Entra nel gestionale"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-soft">
        Prima volta qui?{" "}
        <Link href="/registrati" className="font-semibold text-ottone-scuro hover:underline">
          Crea il tuo negozio
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
