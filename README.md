# Limbus Calculator

Exact clash odds and damage math for Limbus Company, plus a Refraction Railway planner.

## Packages

- `packages/engine`: pure TypeScript probability engine. No I/O. See `packages/engine/README.md`.
- `packages/data`: wiki scrapers and the committed normalized game data. See `packages/data/README.md`.
- `apps/web`: the site. Vite + React + Tailwind, static, engine runs in a Web Worker.

## Run the site locally

    npm install
    npm run scrape:images -w @limbus/data   # once; downloads portraits and icons (about 45 minutes, git-ignored)
    npm run dev -w @limbus/web              # copies packages/data/out and images into apps/web/public, serves on http://localhost:5173

Without the image download the site works with blank portraits and icons.

## Refresh the data

    npm run scrape -w @limbus/data          # identities + live Railway line + enemies (about 5 minutes)
    npm run scrape:images -w @limbus/data   # new portraits and icons only
    npm test -w @limbus/data                # output gate: counts, ids, coverage floor, image manifest
    git add packages/data/out && git commit

A scrape that would shrink the committed counts by more than 5% refuses to write; pass `--force` only when the drop is real.

## Check everything

    npm run typecheck
    npm run lint
    npm test
    npm run build -w @limbus/web

## Deploy

`.github/workflows/deploy.yml` publishes `apps/web` to GitHub Pages on every push to `main` or `master`. Set the repository's Pages source to "GitHub Actions" once. Images are cached in Actions by the hash of `packages/data/out/images.json`; the first run after a manifest change downloads them. For a user or organization page set `VITE_BASE` to `/` in the workflow.

Design: `docs/superpowers/specs/2026-09-20-limbus-calculator-rebuild-design.md`.
