# VP-01 · Le quattro viste del portale restano SECURITY DEFINER

*Decisione scritta il 05/08/2026, su rilievo della mappa giro-2
(«decisione non scritta: un agente futuro "risolve il lint" e spegne
il portale»).*

Le quattro viste pubbliche sono **il meccanismo di lettura del portale
clienti**: `definer` per scelta, con colonne SCELTE A MANO e filtro
`portale_attivo`. Il linter Supabase le segnala a livello ERROR: **il
segnale è accettato per decisione** — non si «risolve».

Chi tocca queste viste deve: (1) leggere questo file; (2) mantenere le
due proprietà (colonne esplicite, filtro portale_attivo); (3) mai
convertirle a invoker né spegnerle per zittire il lint. Qualsiasi
evoluzione passa da una nuova decisione datata.
