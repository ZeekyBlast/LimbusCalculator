# Limbus Calculator

Exact clash odds and damage math for Limbus Company, plus a Refraction Railway planner.

## Packages

- `packages/engine`: pure TypeScript probability engine. No I/O. See `packages/engine/README.md`.
- `packages/data`: wiki scrapers and the committed normalized game data. See `packages/data/README.md`.
- `apps/web`: the site (Plan 3).
- `ui/`: the previous prototype, kept until `apps/web` replaces it.

## Develop

    npm install
    npm run typecheck
    npm test

Design: `docs/superpowers/specs/2026-09-20-limbus-calculator-rebuild-design.md`.
