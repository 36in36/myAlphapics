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
npm run deploy
```

That builds, copies `out/` to the droplet, then reads
`https://app.myalphapics.com/version.json` back and checks the build id matches
what was just built. It either says "Deploy confirmed" or tells you what it
found instead — no more guessing whether the browser is showing the new build
or a cached old one.

`node scripts/deploy.mjs --dry` prints the scp command without running it.
`--no-verify` skips the check.

The long way, if you'd rather do it by hand:

```powershell
npm run build
scp -r out/* root@167.71.91.81:/var/www/myalphapics/
```

Note that `npm run build` alone changes nothing on the server — it only writes
the `out/` folder locally. The copy is what makes the site change.

## Checking what's deployed

`https://app.myalphapics.com/version.json` reports the running version, git
SHA, build time, service worker cache name, and bundled voice clip count.
Stamped automatically by `scripts/stamp-version.mjs` on every build.
