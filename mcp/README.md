# VISTA MCP — l'ottico artificiale (v0)

Server MCP che permette a un'AI (Claude Desktop, o Claude in un container)
di **lavorare sul gestionale come un operatore del negozio**: cercare
clienti, aprire buste con caparra, ordinare LAC, battere vendite, fissare
appuntamenti. Modulo a sé stante: zero import dal codice dell'app.

## Sicurezza — il principio che regge tutto

L'AI **non è un superutente**: si logga con email+password di un utente
dedicato (consigliato ruolo `addetto`, es. "Claude Operatore") usando la
**anon key** → la RLS si applica come per chiunque. MAI la service role.
I tool rispettano il contratto: numeri solo dalla RPC `prossimo_numero`,
transizioni solo dalla mappa (stato riletto prima di scrivere),
Σ pagamenti = totale, scarico magazzino solo via movimenti.

**Fuori dalla v0** (si fanno in UI): chiusura di cassa, consegna+incasso
da busta, resi, incamero caparra.

## Creare l'utente dedicato

1. Supabase → Authentication → Add user: `claude.operatore@tuodominio.it`
   con password robusta (revocabile in ogni momento).
2. SQL Editor (sostituisci l'UUID con quello dell'utente appena creato):
```sql
insert into public.utenti (id, azienda_id, email, nome, ruolo)
select '<UUID_AUTH_UTENTE>', id, 'claude.operatore@tuodominio.it',
       'Claude Operatore', 'addetto'
from public.aziende order by created_at limit 1;
```

## Claude Desktop — claude_desktop_config.json

```json
{
  "mcpServers": {
    "vista": {
      "command": "npx",
      "args": ["-y", "tsx", "/PERCORSO/Gestionale/mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://xxxx.supabase.co",
        "SUPABASE_ANON_KEY": "eyJ...",
        "VISTA_EMAIL": "claude.operatore@tuodominio.it",
        "VISTA_PASSWORD": "********"
      }
    }
  }
}
```
Prerequisito: `cd mcp && npm install` (una volta). Poi riavvia Claude
Desktop e chiedi: *"Simula una mattinata in negozio: entra una cliente
nuova per un controllo, poi..."* — i 17 tool fanno il resto.

## I 17 tool

Lettura: `situazione`, `cerca_clienti`, `scheda_cliente`,
`cerca_prodotti`, `buste_in_corso`, `giornata_cassa`, `agenda`.
Scrittura: `crea_cliente`, `crea_prescrizione` (pretende il consenso
sanitario come la 4d), `crea_appuntamento`, `esito_appuntamento`,
`crea_busta` (acconto ⇒ metodo obbligatorio, regola 4c), `avanza_busta`,
`crea_ordine_lac`, `avanza_ordine_lac` (consegna ⇒ scarico),
`vendita_veloce` (Σ pagamenti = totale), `movimento_cassa`.
