# MyAlphaPics Deployment

## What's Done ✅

1. **Build errors fixed:**
   - `reports/page.tsx`: Wrapped `item.lastViewed` and `selectedLetter.lastAttempt` with `new Date()` for `formatDate()`
   - 5 game pages (`animation`, `choose2`, `choose3`, `choose4`, `single`): Wrapped `useSearchParams()` in `<Suspense>` boundaries

2. **Static export configured:** `output: "export"` in `next.config.ts` — all 16 pages export as static HTML

3. **Deployed to server:**
   - Static files at `/var/www/myalphapics` on `167.71.91.81`
   - Nginx config at `/etc/nginx/sites-available/myalphapics` (symlinked to sites-enabled)
   - Listening on port 80 for `app.myalphapics.com`

4. **BitHustle untouched** — existing config verified and left alone

## What's Left (Marshall) 🔧

### 1. DNS Record (Required)
Add an **A record** for your domain:
```
app.myalphapics.com → 167.71.91.81
```

### 2. SSL Certificate (After DNS propagates)
SSH into the server and run:
```bash
ssh root@167.71.91.81
certbot --nginx -d app.myalphapics.com
```

## Redeployment

```powershell
cd C:\projects\myalphapics-web
npm run build
scp -r out/* root@167.71.91.81:/var/www/myalphapics/
```
