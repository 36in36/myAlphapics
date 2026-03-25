# myalphapics-web

## Value Hypothesis
Children can learn the alphabet faster and more engagingly with personalized family photos in interactive games than with generic flashcards or stock-image educational apps

## Features
- **game-modes** (w:5) — 8 interactive learning games with resume support
- **adaptive-learning** (w:5) — AI-driven Smart Practice selecting weakest letters across 5 progressive levels
- **photo-management** (w:4) — Upload/manage personalized family photos for each letter
- **pwa** (w:4) — Offline installable progressive web app with service worker
- **progress-tracking** (w:3) — 3-tab reports dashboard (exposure, interaction, mastery)
- **celebrations** (w:3) — Confetti, personalized praise, sound effects, frequency-curved scheduling
- **settings** (w:2) — Child name, profile photos, game speed, word bank
- **activation** (w:1) — 6-digit code gate verifying against remote API

## Do NOT Build
<!-- Add things here that should never be built, to prevent drift -->

## Configuration
- Project config: `config/rhino.yml`
- Assertions: `config/evals/beliefs.yml`
- Plans: `.claude/plans/`

## Notes
Global `~/.claude/CLAUDE.md` provides rhino-os methodology (measurement, learning loop, commands).
This file is project-specific — value hypothesis, features, and constraints for this codebase.
