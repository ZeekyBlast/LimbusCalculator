# Limbus Calculator

Exact clash odds and damage math for Limbus Company, plus a Refraction Railway planner.

## Packages

- `packages/engine`: pure TypeScript probability engine. No I/O.
- `packages/data`: wiki scraper and normalized game data (Plan 2).
- `apps/web`: the site (Plan 3).
- `ui/`: the previous prototype, kept until `apps/web` replaces it.

## Develop

    npm install
    npm run typecheck
    npm test

Design: `docs/superpowers/specs/2026-09-20-limbus-calculator-rebuild-design.md`.
