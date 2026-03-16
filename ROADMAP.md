# MyAlphaPics — Product Roadmap

*Created: 2026-03-02*

## Vision
A personalized learning network where family photos, social connections, and classroom communities make alphabet learning deeply personal and engaging.

## Immediate Fixes (Landing Page)
- [ ] Remove "Coming Soon!" section — app is live
- [ ] Replace dead Google Play button with "Try It Free" → app.myalphapics.com
- [ ] Update "Get Started" header button to point to the app
- [ ] Email ~100 waitlist signups: "It's live, try it now"
- [ ] First-run onboarding — new visitors shouldn't land on an empty app

## Speed Optimization (Done 2026-03-02)
- [x] `.htaccess` cache headers (1 year images, 1 month CSS/JS)
- [x] Converted `index.php` → `index.html` (removed PHP overhead)
- [x] Lazy loading on all below-fold images
- [x] Removed unused Google Fonts preconnect
- [x] Deferred non-critical CSS (AOS, Glightbox, Swiper, main.css)
- [x] Inlined critical CSS for header + hero
- [x] Enabled HTTP/2 via WHM (mod_http2) — benefits all 32 sites
- [x] Lighthouse mobile score: 91

## Product Features

### 1. Grandparent Gift Model
- Grandparents buy a "gift pack" — pre-loaded with photos they take/upload
- "G is for Grandma" with her actual photo, ready to go
- Grandparents are the real spenders on kid stuff — gives them a way to participate from afar
- Standalone purchase: "Send an alphabet gift to your grandchild" ($9.99-14.99)
- They upload photos, record celebration videos, it shows up in the child's app

### 2. Parent-Created Celebration Videos
- Replace generic celebrations with short videos from family members
- "Way to go! You learned the letter D!" recorded by Dad
- Massively increases emotional engagement and stickiness
- Already in feature set from Flutter version — needs emphasis as selling point

### 3. Social Photo Network (with Consent)
- Parents opt-in to share a child's photo for a specific letter
- "B is for Billy" — Billy's parents approve, other kids in the network can use Billy's photo
- Permission model is critical — parent explicitly approves each photo for sharing
- Creates network effects: more kids = richer photo library = more value for everyone
- Solves the cold-start problem — new users don't start with an empty app

### 4. Preschool/Classroom Program
- Teacher creates a class → adds all kids' photos (with parent consent)
- Every kid learns classmates' names: "J is for Jayden" with Jayden's actual photo
- Solves a real problem — learning classmates' names at start of year
- Pricing: per-classroom license, annual
- Marketing: approach preschools directly, or parents request it
- Teachers become evangelists → parents of 20 kids all hear about the app

## Pricing Model

| Tier | Price | What |
|------|-------|------|
| **Free** | $0 | Basic games, your own photos only |
| **Family** | $9.99 one-time | All games, adaptive mode, reports, celebration videos |
| **Gift Pack** | $9.99-14.99 | Grandparent sends pre-loaded alphabet to grandchild |
| **Classroom** | $49-99/year | Teacher account, class roster, shared photos with consent |

## Network Effect Flywheel
```
Preschool adopts → 20 families exposed →
Parents buy Family tier → Grandparents buy Gift Packs →
Parents share photos → App gets richer → More value for everyone
```

## Technical Implications
- Gift Pack & Classroom require a server/account system (currently all local IndexedDB)
- Social photo sharing needs: user accounts, consent management, image hosting
- Payment integration: Stripe Checkout (simplest path)
- Could phase it: Family tier (local only, feature gate) first, then add network features
