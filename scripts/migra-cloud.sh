#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────────────────────
# Porta un progetto Supabase CLOUD a schema, dalla strada che registra.
#
# È `scripts/applica-migrazioni.ts` più le due cinture che servono quando il
# bersaglio è remoto e la mano è umana:
#
#   1. l'URI si DIGITA, non si passa come argomento: non compare a schermo, non
#      entra nella history della shell, non transita da nessun modello. È il
#      patto della libreria di strumenti — i valori vivono sul computer di chi
#      lancia, gli script li leggono, chi orchestra invoca lo script.
#   2. il REF del progetto si verifica PRIMA di connettersi. Puntare il
#      bersaglio sbagliato è l'unico errore di questa procedura che non si può
#      correggere dopo: qui non è una raccomandazione, è un cancello.
#
# Uso:
#   sh scripts/migra-cloud.sh prod     # vista-gestionale (anteprima E produzione)
#   sh scripts/migra-cloud.sh test     # gestionale-test  (solo la CI)
#
# L'URI si prende da Supabase → progetto → Connect → Direct connection,
# sostituendo `[YOUR-PASSWORD]` con la password del database. Se la rete non ha
# IPv6 la connessione diretta non risolve: si usa l'URI del Session pooler, che
# per questo script è equivalente.
#
# Nessun valore vive in questo file né in alcun file del repository.
# Il «perché» e i due runbook completi: `scripts/LEGGIMI.md`.
# Chi punta dove, e i nomi dei segreti: `docs/ambienti.md`.
# ─────────────────────────────────────────────────────────────────────────────
set -e

BERSAGLIO="$1"
case "$BERSAGLIO" in
  prod) REF=uijfhhctrgirglmkrgoo; NOME="vista-gestionale — ANTEPRIMA E PRODUZIONE" ;;
  test) REF=ktjzsjvmutfqnxbatisa; NOME="gestionale-test — solo la CI" ;;
  *)    printf 'uso: sh scripts/migra-cloud.sh prod|test\n' >&2; exit 2 ;;
esac

printf '\nBersaglio: %s\n' "$NOME"
printf 'Ref atteso nell URI: %s\n\n' "$REF"
printf 'Incolla l URI e premi Invio (non comparira a schermo): '
stty -echo 2>/dev/null || true
read -r URI
stty echo 2>/dev/null || true
printf '\n'

# ── cintura 1 · l'URI dev'essere compilato ───────────────────────────────────
case "$URI" in
  "")
    printf 'Nessun URI ricevuto. Non ho lanciato nulla.\n' >&2
    exit 1 ;;
  *YOUR-PASSWORD*|*"["*)
    printf 'Nell URI ce ancora il segnaposto della password. Non ho lanciato nulla.\n' >&2
    exit 1 ;;
esac

# ── cintura 2 · dev'essere IL progetto che hai chiesto ───────────────────────
case "$URI" in
  *"$REF"*) : ;;
  *)
    printf 'STOP: l URI non contiene il ref %s del progetto "%s".\n' "$REF" "$BERSAGLIO" >&2
    printf 'Bersaglio sbagliato o URI di un altro progetto. Non ho lanciato nulla.\n' >&2
    exit 1 ;;
esac

# ── si applica ───────────────────────────────────────────────────────────────
# `MARCA_AMBIENTE_TEST=1` scrive la riga ('test') in `public.ambiente`, che è il
# cancello positivo di `svuota_dati_di_test()`. Vive SOLO nel ramo `test`, ed è
# la ragione per cui questo script prende un bersaglio per nome invece di un
# URI e basta: così la marcatura non è una variabile che qualcuno può ricordarsi
# di aggiungere — o dimenticarsi di togliere.
if [ "$BERSAGLIO" = test ]; then
  SUPABASE_DB_URL="$URI" MARCA_AMBIENTE_TEST=1 npm run db:applica-migrazioni
else
  SUPABASE_DB_URL="$URI" npm run db:applica-migrazioni
fi

unset URI
printf '\nFatto. Verifica il registro stampato qui sopra: deve arrivare alla migrazione piu recente del repo.\n'
