import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Elenco unico delle rotte pubbliche (prefissi). Aggiungerne una è una scelta
 * deliberata: la guardia G13 verifica che questo array sia ESATTAMENTE quello
 * atteso, così una nuova rotta pubblica rompe un test invece di passare inosservata.
 *   • /login, /registrati, /auth — il flusso di accesso del gestionale;
 *   • /ottica — la vetrina pubblica del negozio (portale), aperta agli anonimi;
 *   • /informativa — l'informativa privacy delle prenotazioni.
 */
export const ROTTE_PUBBLICHE = ["/login", "/registrati", "/auth", "/ottica", "/informativa"] as const;

/**
 * Rotte pubbliche a corrispondenza ESATTA (non prefisso). La radice «/» deve
 * essere pubblica — un anonimo ci trova la landing Limpidia, non il modulo di
 * accesso — ma «/» come prefisso combacerebbe con tutto, aprendo il gestionale.
 * Quindi vive qui, confrontata per uguaglianza. La guardia G13 la sorveglia.
 */
export const ROTTE_PUBBLICHE_ESATTE = ["/"] as const;

/**
 * Middleware: tiene fresca la sessione Supabase e protegge le rotte.
 * Pubbliche: vedi ROTTE_PUBBLICHE. Tutto il resto richiede login.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Importante: nessuna logica tra createServerClient e getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    (ROTTE_PUBBLICHE_ESATTE as readonly string[]).includes(path) ||
    ROTTE_PUBBLICHE.some((r) => path.startsWith(r));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("da", path);
    return NextResponse.redirect(url);
  }

  if (user && (path.startsWith("/login") || path.startsWith("/registrati"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
