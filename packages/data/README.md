# @limbus/data

Scrapes limbuscompany.wiki.gg into the engine's `Unit` schema and commits the result under `out/`.

## Commands

    npm run scrape -w @limbus/data              # identities + live Railway line + enemies
    npm run scrape:identities -w @limbus/data   # add --limit=N for a quick check
    npm run scrape:railway -w @limbus/data
    npm run scrape:images -w @limbus/data       # portraits and skill icons into images/ (git-ignored)
    npm run fixtures -w @limbus/data            # refresh test fixtures from the wiki

Runs take a few minutes: one request per second, User-Agent `LimbusCalculator-DataScraper/0.2`.

## Outputs (committed)

- `out/identities.json`: `Unit[]`, one per Identity, stored at the level cap (`meta.levelCap`).
- `out/enemies.json`: `Unit[]`, one per enemy PART. `id` is `<enemyId>:<partIndex>`, `group` is the enemy name.
- `out/railway.json`: the live line: `stations`, `sections[].waves[].enemyIds|reinforcementIds`.
- `out/failures.json`: pages or ids that did not parse, with reasons, plus warnings.
- `out/meta.json`: scrape time, counts, and `effectParseCoverage`.
- `out/images.json`: wiki filename -> local path under `images/` (or `null` if the wiki has no such file).

## Data contract notes

- HP: `hp` is the max HP at `level` (the wiki's `hp + hpgrowth * level`). For another level L use `hp + hpGrowth * (L - level)`.
- Stagger thresholds are descending fractions of max HP.
- Resistances are multipliers: 0.5 Ineffective, 0.75 Endured, 1 Normal, 1.5 Weak, 2 Fatal. Identities have all sin resistances at 1.
- `Skill.uptie` follows the engine convention (an override applies from its tier upward). The wiki's lower-tier params are converted in `src/normalize/uptie.ts`.
- Effects: `src/effects/parse.ts` handles flat power changes, percentage damage, `At N+ Stat` / `If target has N+ Stat` conditions, and `Gain|Inflict N Stat [Count]` grants. Everything else is `{ kind: 'unparsed' }` with the original sentence in `source`; the coverage ratio in `meta.json` is gated by `test/output.test.ts`.
- Enemy blocks are located by the `id` param when present, otherwise by the section heading named in `Module:EnBox/data`.

## Updating for a new Railway line

Change `RAILWAY_LINE_PAGE` in `src/cli.ts`, run `npm run scrape:railway -w @limbus/data`, then `scrape:images`, and commit `out/`.
