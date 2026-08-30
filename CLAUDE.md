# Project: MyAlphaPics

## Overview
Kids' alphabet learning app — teaches ABCs using family photos. 8 game modes, text-to-speech, adaptive difficulty. Converted from Flutter Android to Next.js PWA. All data stored locally (no server/DB needed).

~100 organic waitlist signups. Long-tail SEO working: "teach ABCs with family pictures" = #1 on Google.

**Status:** Production, active.

## Location
- **Local:** `C:\projects\myalphapics-web`
- **App:** https://app.myalphapics.com (DO droplet 167.71.91.81, static export via Nginx)
- **Landing/Marketing:** https://myalphapics.com (cPanel 172.96.177.199)
- **Payments:** Stripe on cPanel ($19.95 one-time unlock)

## Tech Stack
- **Framework:** Next.js 16 (static export)
- **Language:** TypeScript
- **Storage:** IndexedDB via Dexie.js (all data local, no server)
- **Audio:** Pre-generated ElevenLabs MP3s via AudioContext (speech), AudioContext (sound effects)
- **Animations:** canvas-confetti
- **PWA:** Service worker, installable on Android/iOS

## Getting Started
```bash
cd C:\projects\myalphapics-web
npm install

# No .env needed — fully client-side app
npm run dev  # port 3001 (BitHustle uses 3000)

# For production build (static export):
npm run build
# Output in out/ directory, deploy via SCP to server
```

## Commands
- **Dev:** `npm run dev` (port 3001)
- **Build:** `npm run build` (static export)
- **Start:** `npm start`
- **Lint:** `npm run lint`
- **Deploy:** SCP `out/` directory to DO droplet Nginx root for app.myalphapics.com

## Project Structure
```
src/
├── app/
│   ├── components/     # Shared UI components
│   ├── manage/         # Photo management per letter
│   │   └── counting/   # Counting sets, count-to limit, Photo Count scenes
│   ├── play/           # Game modes
│   │   ├── abcsong/    # ABC Song mode
│   │   ├── adaptive/   # Adaptive difficulty
│   │   ├── animation/  # Letter animations
│   │   ├── choose2/    # Choose from 2
│   │   ├── choose3/    # Choose from 3
│   │   ├── choose4/    # Choose from 4
│   │   ├── namegame/   # Name the letter
│   │   ├── single/     # Single letter practice
│   │   ├── smart/      # Smart Practice (mastery-based)
│   │   └── words/      # Word learning
│   ├── reports/        # Progress reports
│   ├── seed/           # Demo seed data for screenshots
│   └── settings/       # App settings
└── lib/                # Dexie DB, utilities
```

## Architecture & Patterns
- **Fully client-side** — no server, no API calls, no user accounts
- IndexedDB (Dexie.js) for all persistence (photos, progress, settings)
- Static export (`next export`) with `images: { unoptimized: true }`
- `trailingSlash: true` required for subdirectory pages in static export
- Service worker: network-first for code, cache-first for assets
- Activation gate: 6-digit code verified against server-side PHP on cPanel

## Numbers Modes
- Seven counting/number games plus their own Smart Practice ladder
  (`src/lib/numbersSession.ts`, a sibling of `adaptiveSession.ts` so the letters
  ladder is untouched).
- The countable photo pool is **derived**, not authored: curated sets if any,
  else letters with custom photos, else profile photos, else bundled clipart.
  Parents add nothing to start counting. See `getCountingPool()` in `db.ts`.
- Dexie v5 adds `numberMastery`, `countGroups`, `countItems`, `countScenes`.
  Purely additive — no upgrade function, no data migration.
- Game registry lives in `src/lib/games.ts`; the picker and `GameSwitcher` both
  read it (they used to keep separate copies that drifted).
- Audio: 74 new bundled clips. See VOICE.md — they must be generated before
  these modes have sound.

## Adaptive Mastery System
- 5 difficulty levels per letter
- Session state in sessionStorage, mastery in IndexedDB
- "Smart Practice" selects letters needing work

## Known Issues / TODOs
- **iOS PWA speech:** SOLVED — `speechSynthesis` is dead in standalone mode, replaced
  with pre-generated audio. See VOICE.md. Every game screen needs a tap gate:
  navigation destroys the AudioContext and `resume()` defers rather than failing.
- Next.js `<Link>`/`router.push` RSC navigation broken in static exports — use plain `<a>` tags
- Service worker: `cache.put` crashes on HEAD requests — filter to GET only

## Notes
- Dev port is 3001 (BitHustle uses 3000)
- Audio unlock: AudioGate shows itself when a locked speak() is attempted
- Voice corpus: `node scripts/generate-audio.mjs` (needs ELEVENLABS_API_KEY)
- Celebration system: front-loaded frequency curve, personalized with child photos
- Speed control: Relaxed/Normal/Quick modes
