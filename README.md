# prosintesi-dashboard

Dashboard di controllo per il progetto **Saturata**.

## Features

- **Login protetto** (password hashata, sessione in memoria)
- **KPI in tempo reale**: lead oggi, totali, agenti attivi, non assegnati
- **Tabella Lead**: filtra per servizio, stato, ricerca testuale
- **Tabella Agenti**: attiva/disattiva, modifica max lead/giorno
- **Responsive**: funziona anche da mobile

## Deploy su Cloudflare Pages

1. Crea una nuova repo su GitHub: `Proxy158/prosintesi-dashboard`
2. Carica questi 3 file nella root:
   - `index.html`
   - `app.js`
   - `style.css`
3. Vai su [Cloudflare Pages](https://dash.cloudflare.com) → **Create a project**
4. Connetti la repo `prosintesi-dashboard`
5. Framework preset: **None**
6. Build command: *(vuoto)*
7. Deploy

La dashboard sarà disponibile su un URL tipo `https://prosintesi-dashboard.pages.dev`

## Cambiare la password

La password di default è: `saturata2026`

Per cambiarla:
1. Genera lo SHA-256 della nuova password (puoi usare [questo tool](https://emn178.github.io/online-tools/sha256.html))
2. Sostituisci la riga in `app.js`:
   ```js
   const ADMIN_HASH = '...';
   ```
3. Commit e redeploy

## Note sicurezza

Questa è una dashboard MVP. Per una sicurezza di livello produzione:
- Abilita **Supabase Auth** con email/password
- Aggiungi **RLS policies** sulle tabelle (lettura solo per utenti autenticati)
- Usa una **Edge Function** intermediaria invece della Anon Key diretta

## Collegamento al Form Partner

Il form "Diventa Partner" (`index-diventa-partner.html`) può essere caricato nella stessa repo in una sottocartella `/diventa-partner/` e linkato dalla dashboard.

---
**Generato il 26 Luglio 2026 — Fase 2 Saturata**
