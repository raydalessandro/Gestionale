#!/usr/bin/env python3
"""Genera docs/mappa-db.md dal Postgres locale (scripts/db-locale.sh prima).
Regola di casa: la mappa si genera, non si scrive."""
import subprocess, re, datetime, glob, os
PGBIN = sorted(glob.glob('/usr/lib/postgresql/*/bin'))[-1]
def q(sql):
    r = subprocess.run(['su','postgres','-c', f"{PGBIN}/psql -h /tmp -p 5433 -U postgres -d limpidia -tA -F '\x1f' -c \"{sql}\""],
                       capture_output=True, text=True)
    return [x.split('\x1f') for x in r.stdout.strip().split('\n') if x]
def corto(d):
    if not d: return ''
    d = d.replace('::text','').replace("'{}'::jsonb","'{}'").replace("'{}'::text[]","'{}'")
    return ' · default ' + (d[:38] + '…' if len(d) > 40 else d)
oggi = datetime.date.today().isoformat()
mig = sorted(os.path.basename(f) for f in glob.glob('supabase/migrazioni/0*.sql'))
out = [f"# Mappa del database — generata, non scritta\n",
       f"*Estratta il {oggi} da un Postgres locale con schema + migrazioni fino a `{mig[-1]}`.*",
       "*Per rigenerarla: `bash scripts/db-locale.sh && python3 scripts/mappa-db.py`.*\n"]
tabelle = [r[0] for r in q("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='public' and relkind='r' order by 1")]
cols = q("SELECT c.relname, a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull, coalesce(pg_get_expr(d.adbin,d.adrelid),'') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum")
cons = q("SELECT conrelid::regclass::text, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY 1,2")
out.append(f"## Le tabelle ({len(tabelle)})\n")
out.append(' · '.join(f"[{t}](#{t})" for t in tabelle) + "\n")
for t in tabelle:
    out.append(f"### {t}\n")
    for _, nome, tipo, nn, dflt in [c for c in cols if c[0] == t]:
        req = ' **NOT NULL**' if nn == 't' else ''
        out.append(f"- `{nome}` {tipo}{req}{corto(dflt)}")
    ck = [c[2] for c in cons if c[0] == t and c[1] == 'c']
    fk = [c[2] for c in cons if c[0] == t and c[1] == 'f']
    un = [c[2] for c in cons if c[0] == t and c[1] == 'u']
    if ck:
        out.append("\n  Vincoli:")
        for c in ck:
            c = re.sub(r'^CHECK \(\((.*)\)\)$', r'\1', c)
            out.append(f"  - ✓ {c}")
    for c in fk: out.append(f"  - → {c.replace('FOREIGN KEY ','').replace('REFERENCES ','→ ')}")
    for c in un: out.append(f"  - ⊙ {c}")
    out.append("")
viste = q("select viewname from pg_views where schemaname='public' order by 1")
if viste and viste[0][0]:
    out.append("## Le viste\n")
    for v in viste: out.append(f"- `{v[0]}`")
    out.append("")
fun = q("SELECT p.proname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid), p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend dep WHERE dep.objid=p.oid AND dep.deptype='e') ORDER BY 1")
out.append("## Le funzioni (RPC)\n")
for nome, args, ret, sd in fun:
    out.append(f"- `{nome}({args})` → {ret}" + (" · *security definer*" if sd == 't' else ""))
trg = q("SELECT tgrelid::regclass::text, tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace) ORDER BY 1,2")
out.append("\n## I trigger\n")
for t, n in trg: out.append(f"- `{t}` ← `{n}`")
open('docs/mappa-db.md','w').write('\n'.join(out) + '\n')

# ── verifica regole consultabili (docs/regole) contro il db reale ──
import json
try:
    reg = json.load(open('docs/regole/grammatica-dati.json'))
    dichiarate = set(reg['tabelle'].keys())
    reali = set(tabelle)
    orfane = sorted(dichiarate - reali)
    scoperte = sorted(reali - dichiarate)
    if orfane:   print('⚠ regole: tabelle dichiarate ma ASSENTI nel db:', ', '.join(orfane))
    if scoperte: print('⚠ regole: tabelle nel db NON ancora classificate:', ', '.join(scoperte))
    if not orfane and not scoperte: print('regole/grammatica-dati.json: classificazione allineata al db ✓')
except FileNotFoundError:
    pass
print(f"docs/mappa-db.md: {len(tabelle)} tabelle, {len(fun)} funzioni, {len(trg)} trigger, {sum(1 for _ in out)} righe")
