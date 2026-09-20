# Limbus Calculator Rebuild: Design

Date: 2026-09-20
Status: approved in discussion, awaiting spec review

## 1. Problem

The current project is a random-roll clash simulator for identity-vs-identity
fights. It has no users because it is not deployed, it can only clash sinners
against sinners (the game's real fights are against Abnormalities), its damage
math undercounts multi-coin skills, its skill-effect handling is regex over
prose, and all UI state lives in one root component. The formula layer
(`formula/`) is small, tested, and sourced, and is the one part worth keeping.

## 2. Goals

1. **Clash odds calculator.** Pick my unit and skill, pick the enemy unit
   (or part) and skill, get an exact win probability and a damage distribution.
   No random rolls in the primary result.
2. **Refraction Railway planner.** Pick a station on the live Line, pick a
   team of 12 identities, and see how every skill matches up against every
   enemy part: win chance, median damage, sin coverage, rough turns-to-kill.
3. **Maintainable.** Three packages with clear boundaries, committed
   normalized data, one-command data refresh, CI that typechecks, tests, and
   validates data, and a deployed site on every push to `main`.

## 3. Non-goals (v1)

- Turn-by-turn encounter simulation with boss AI, targeting, or scripted
  phase mechanics. The wiki documents these only as prose.
- Evade skills, multi-target attack weight, E.G.O skills, ally-targeted
  effects, Sinking/Tremor resolution. All v2 candidates.
- Any backend. The site is static.
- Preserving the coin-flip reveal animation as the primary result view.

## 4. Repository layout

npm workspaces at the root. Node 22+, TypeScript strict everywhere.

```
package.json                 workspaces: packages/*, apps/*
packages/engine/             pure TS, no DOM, no I/O
packages/data/               scraper + schema + committed JSON output
apps/web/                    Vite + React 19 + Tailwind 4, static site
docs/superpowers/specs/      this document and successors
.github/workflows/ci.yml     typecheck, engine tests, data validation
.github/workflows/deploy.yml build apps/web and publish to GitHub Pages
```

Root `README.md` explains the three packages, how to refresh data, and how to
run the site locally.

The existing `formula/` directory moves into `packages/engine/src/` module by
module. Modules that survive unchanged in intent: `damage`, `resistance`,
`offenseDefenseAdvantage`, `parryBonus`, `criticalModifier`, `uptieResolver`,
`unbreakableCoin`. `clash.ts` (random simulator) is kept only as a test oracle
under `packages/engine/test/`. `skillEffectGrants.ts` is replaced by the
structured effect model in Section 5.3. The existing `ui/` app is deleted once
`apps/web` reaches parity on the clash screen.

## 5. Data package

### 5.1 Sources

- Identities: `limbuscompany.wiki.gg`, pages using the `IDPage` template,
  enumerated via `Category:Identities` (existing scraper, existing parser).
- Enemies: `limbuscompany.wiki.gg`, `<Name>/Enemy` subpages using the
  `ABPage` template (201 pages at time of writing). Enumerated from the wiki's
  `Module:EnBox/data` Lua table, which maps every numeric enemy ID to
  `{ name, faction, image, risk, page }`.
- Railway: the live Line page (currently `Line 6: Maru no Uchi no Sanzu no
  Kawa`) whose "Encounter Details" table lists sections, waves, and
  `{{EnBox|<id>}}` references per wave.

All fetches go through the MediaWiki API (`action=parse&prop=wikitext`) with
the existing rate-limit and retry handling. The wikitext parser in
`data/scraper/wikitext.mjs` is ported to TypeScript and shared by both
scrapers.

### 5.2 Normalized schema

One `Unit` shape for sinners and enemy parts, so the engine never branches on
unit kind.

```ts
type Sin = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy'
type DamageType = 'slash' | 'pierce' | 'blunt'

interface Unit {
  id: string                       // identity: wiki title; enemy: `${enemyId}:${partIndex}`
  kind: 'identity' | 'enemy'
  name: string
  group?: string                   // sinner name, or enemy display name for parts
  level: number                    // identities: default from current level cap, editable
  hp: number
  hpGrowth: number
  speed: { min: number; max: number }
  defenseMod: number
  resistances: {
    damageType: Record<DamageType, number>   // multiplier: 0.5 Ineff .. 2 Fatal
    sin: Record<Sin, number>                 // identities: all 1 (sinners have none)
  }
  staggerThresholds: number[]      // fractions of max HP, descending
  skills: Skill[]
  passives: Passive[]
}

interface Skill {
  id: string
  name: string
  slot: 'skill1' | 'skill2' | 'skill3' | 'defense' | 'enemy'
  variant?: string
  sin: Sin
  damageType: DamageType | 'guard' | 'evade' | 'none'
  offenseLevelMod: number          // atkmod / skill offense level modifier
  basePower: number
  coinPower: number
  coinCount: number
  unbreakableCoins: number[]       // indices of unbreakable coins
  attackWeight: number
  uptie: Partial<Record<1 | 2 | 3 | 4, Partial<Pick<Skill, 'basePower' | 'coinPower' | 'effects'>>>>
  effects: Effect[]                // Section 5.3
  rawText: { skill: string; coins: string[] }   // always kept for display
}
```

Resistance words are mapped in the scraper: Ineffective 0.5, Endured 0.75,
Normal 1, Weak 1.5 (identities never have Weak, but enemies do), Fatal 2.
Enemy ABPage values are already numeric multipliers and pass through.

Output files, committed:

```
packages/data/out/identities.json
packages/data/out/enemies.json
packages/data/out/railway.json      { line, stations[{ section, station, name, waves[[enemyId...]] }] }
packages/data/out/failures.json     units that failed to parse, with reason
packages/data/out/meta.json         { scrapedAt, wikiRevisionCounts, effectParseCoverage }
```

Images are not committed. The scraper writes them to `packages/data/images/`
(gitignored); the deploy workflow uploads them alongside the built site.

### 5.3 Structured effects

```ts
interface Effect {
  trigger: 'on-use' | 'combat-start' | 'clash-win' | 'clash-lose' | 'on-hit'
         | 'heads-hit' | 'tails-hit' | 'on-crit' | 'attack-end' | 'passive'
  scope: 'skill' | { coin: number }
  condition?: Condition             // e.g. { stat: 'poise', side: 'self', op: '>=', value: 5 }
  op: Operation
  source: string                    // the sentence this came from
}

type Operation =
  | { kind: 'coinPower'; delta: number }
  | { kind: 'basePower'; delta: number }
  | { kind: 'clashPower'; delta: number }
  | { kind: 'damagePercent'; delta: number }
  | { kind: 'applyStatus'; target: 'self' | 'target'; status: string; potency?: number; count?: number }
  | { kind: 'unparsed' }            // kept so coverage can be measured
```

The parser handles the phrasings that cover the bulk of skill text: flat
`Coin Power +N`, `Base Power +N`, `Final Power +N`, `+N% damage`, the
`At N+ <Status> on self` and `If target has N+ <Status>` conditions, and
`Gain/Inflict N <Status> [Count] [next turn]`. Everything else becomes
`{ kind: 'unparsed' }` with its source sentence. `meta.json` records the share
of effects that parsed; the data test suite snapshots that number and fails
if it drops.

## 6. Engine package

### 6.1 Inputs

```ts
interface Combatant {
  unit: Unit
  skill: Skill
  uptie: 1 | 2 | 3 | 4
  level: number
  sanity: number                    // -45..45, enemies fixed at 0
  status: Record<string, { potency: number; count: number }>
  manual: { coinPower: number; basePower: number; clashPower: number; damagePercent: number }
}
```

`resolveCombatant(c)` applies uptie overrides, evaluates every parsed
`Effect` whose trigger is `on-use`, `passive`, or `combat-start` against the
entered status, adds manual overrides, and returns flat numbers:
`basePower`, `coinPower`, `coinCount`, `unbreakable`, `headsChance`,
`offenseLevel`, `defenseLevel`, `damagePercent`, `critChance`.

### 6.2 Clash chain

State `(a, b)` = breakable coins remaining per side. Per round, side A's power
is `baseA + levelBonusA + coinPowerA * H_A` with `H_A ~ Binomial(liveA, pA)`
where `liveA` counts breakable plus unbreakable coins; same for B. From the
two power distributions compute `pWin`, `pLose`, `pTie` for the round. Ties
leave the state unchanged, so:

```
P_win(a, b) = (pWin * P_win(a, b-1) + pLose * P_win(a-1, b)) / (1 - pTie)
E_parry(a, b) = pTie / (1 - pTie) + conditional continuation
```

Absorbing states: `a = 0` (B wins) and `b = 0` (A wins). If `pTie = 1` for a
state the clash is a guaranteed draw. The chain also produces the
distribution of the winner's remaining coins (breakable + unbreakable), which
the damage stage consumes. Level bonus is the existing rule: the higher
offense level gains `floor(diff / 3)` clash power, the lower side gains
nothing.

Guard clash: a clashable guard's final power is `base + coinPower * heads +
floor(max(defLevel - offLevel, 0) / 3)`; on a guard loss the attacker's final
power is reduced by the guard's final power before damage. Modeled as a
one-round chain with the same binomial machinery.

### 6.3 Damage distribution

For a winner with `k` coins left attacking one-sided: coin `i` (1-based) has
roll `base + coinPower * H_i` where `H_i ~ Binomial(i, p)` counts heads on
coins 1..i. This is the accumulation rule the current code gets wrong. For each
coin, enumerate `H_i`, apply `computeFinalDamage` with:

- `sinResistance`: from the defender's `resistances.sin[skill.sin]`
  via the existing piecewise `resistanceModifier`
- `damageTypeResistance`: from `resistances.damageType[skill.damageType]`,
  set to Fatal once a stagger threshold has been crossed by earlier coins
- `offenseDefenseAdvantage(attacker.offenseLevel, defender.defenseLevel)`
- `parryBonus(E_parry)`
- `critical`: Poise-derived crit chance as a mixture
- dynamic modifiers: `damagePercent` from effects and manual input

Combining coins yields the total-damage distribution (coins are dependent
through the shared heads sequence, so enumerate the full heads sequence: at
most 2^5 outcomes per `k`, weighted by the coin-count distribution from 6.2).

Outputs:

```ts
interface ClashReport {
  win: number; lose: number; draw: number
  coinsLeft: number[]                     // probability by count, for the winner
  parryRoundsExpected: number
  damage: { mean: number; p10: number; p50: number; p90: number; max: number
            perCoin: { mean: number }[]; histogram: [value, prob][] }
  staggerChance: number[]                 // per threshold
  breakdown: { label: string; value: number; source: string }[]
}
```

`unopposedReport` is the same damage stage with `k = coinCount` and no clash.

### 6.4 Railway planner queries

```ts
matchupGrid(team: Combatant[], wave: Unit[]): Cell[][]
```

Each cell runs `clashReport` for (my skill, enemy skill) for the enemy part's
primary attack skill, and `unopposedReport` for damage into that part. It also
returns the sin/damage-type multiplier so the UI can render coverage, and
`turnsToKill = ceil(part.hp / damage.mean)` for the best skill.

All engine functions are pure and synchronous; the grid for 12 identities x 3
skills x 8 parts is a few thousand chain evaluations and runs in well under a
second, computed in a Web Worker in the web app.

## 7. Web app

Vite + React 19 + Tailwind 4, TypeScript strict. State per screen in a small
store (Zustand) rather than root-component `useState`; the team roster and
last used settings persist to `localStorage`. Engine calls run in a Web
Worker so the UI never blocks.

Visual direction follows `PRODUCT.md`: corporate-noir ledger, tabular
numerals, restraint. Must work at phone width.

### 7.1 Clash Calculator (`/`)

- Two combatant cards: unit picker (identities and enemy parts in one
  searchable list, grouped), skill picker, level, uptie, SP, status stacks
  with potency/count, manual overrides, and a collapsible list of the skill's
  raw effect text with parsed effects marked and unparsed ones highlighted.
- Verdict panel: win % as the lead number, draw %, a damage band (p10 to p90,
  median emphasized), a per-coin table, stagger chance, and a breakdown
  table listing every modifier with its value and source.
- "Roll once" button: samples one outcome from the computed distribution and
  shows a coin-by-coin reveal. Secondary, never the default view.
- URL encodes the full setup so a matchup is shareable.

### 7.2 Railway Planner (`/railway`)

- Station picker across the live Line, waves listed with enemy portraits.
- Team builder: 12 identity slots with uptie and level, persisted.
- Grid: rows are my skills (grouped by identity), columns are enemy parts.
  Cell shows win % and median damage, colored by win %. A coverage strip
  above the grid shows the enemy's sin and damage-type multipliers against
  each of my skills. A per-part turns-to-kill line sits under the grid.
- Clicking a cell opens the Clash Calculator preloaded with that pairing.

### 7.3 Deploy

`deploy.yml` builds `apps/web`, copies `packages/data/images/` into the build
output, and publishes to GitHub Pages on push to `main`. Data JSON is bundled
as static assets and fetched at startup.

## 8. Testing

- Engine: unit tests per module; closed-form cases for 1v1 and 2v1 coin
  clashes; property test that `win + lose + draw = 1`; a Monte Carlo
  cross-check that runs the legacy random simulator 200k times and asserts
  the exact chain agrees within 0.5 percentage points; a regression test for
  coin accumulation using a hand-worked 3-coin example.
- Data: schema validation with a JSON schema generated from the TS types;
  parser fixtures for each supported effect phrasing; the checked-in Line 6
  scrape as a fixture; coverage snapshot test.
- Web: `tsc --noEmit` and lint in CI. No browser tests in v1.

## 9. Migration order

1. Workspace scaffold, CI, README. Move `formula/` into `packages/engine`
   with tests passing.
2. Data package: port parser, add enemy and railway scrapers, schema,
   commit first data set.
3. Engine: clash chain, damage distribution, resolveCombatant, reports.
4. Web: Clash Calculator to parity with the old app, then delete `ui/`.
5. Web: Railway Planner. Deploy.

## 10. Open risks

- Wiki template drift breaks the scrapers. Mitigation: failures file and a
  CI job that fails when the parsed unit count drops by more than 5%.
- Stagger-within-one-attack behavior (whether the Fatal multiplier applies to
  the remaining coins of the same skill) needs confirmation against the wiki
  Battles page before 6.3 is finalized; the engine exposes it as a flag.
- Enemy pages omit some Railway-specific buffs applied by the Line (for
  example the Butterfly's resistance modification). These are surfaced as
  manual overrides in v1.
