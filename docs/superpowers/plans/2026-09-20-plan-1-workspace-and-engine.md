# Plan 1 of 3: Workspace Scaffold and Probability Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repo into an npm workspace and build `packages/engine`, a pure TypeScript package that computes exact clash win probabilities and damage distributions for Limbus Company skills.

**Architecture:** The engine models a clash as a Markov chain over (my breakable coins, their breakable coins) where each round's outcome comes from two shifted binomial distributions. Damage is an exact enumeration over the winner's heads sequence, applying the existing sourced damage formula per coin with cumulative coin power. `resolveCombatant` turns a unit, skill, and player-entered state into flat numbers first, so the chain and the damage stage never see game text.

**Tech Stack:** Node 22+, npm workspaces, TypeScript 7 strict, Vitest. No runtime dependencies in the engine.

**Spec:** `docs/superpowers/specs/2026-09-20-limbus-calculator-rebuild-design.md` (Sections 4, 6, 8, and steps 1 and 3 of Section 9). Plan 2 covers `packages/data`; Plan 3 covers `apps/web` and deploy.

## Global Constraints

- Node 22 or newer; TypeScript `strict: true`, `noUnusedLocals`, `noUnusedParameters` everywhere.
- `packages/engine` has zero runtime dependencies and never touches the DOM, filesystem, or network.
- Every engine export is a pure, synchronous function over plain data.
- Existing sourced modules are moved, not rewritten: `damage`, `resistance`, `offenseDefenseAdvantage`, `parryBonus`, `criticalModifier`, `uptieResolver`, `unbreakableCoin`, `statusEffects`.
- The legacy random simulator (`clash.ts`), `fixedDamageAilment.ts`, and `skillEffectGrants.ts` move under `packages/engine/src/legacy/` untouched. They keep the old `ui/` app compiling until Plan 3 deletes it, and `legacy/clash.ts` is the Monte Carlo test oracle. Nothing new may import from `legacy/`.
- Commit after every task. Commit messages end with `Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV`.
- Test command: `npm test -w @limbus/engine` (runs `vitest run`). Typecheck: `npm run typecheck -w @limbus/engine`.

---

## File Structure

```
package.json                                  root: workspaces, shared scripts
tsconfig.base.json                            shared compiler options
.github/workflows/ci.yml                      install, typecheck, test
README.md                                     what the packages are, how to run
packages/engine/package.json                  @limbus/engine
packages/engine/tsconfig.json                 extends base, includes src + test
packages/engine/vitest.config.ts
packages/engine/src/index.ts                  public exports
packages/engine/src/types.ts                  Unit, Skill, Effect, Combatant, reports
packages/engine/src/damage.ts                 moved from formula/
packages/engine/src/resistance.ts             moved
packages/engine/src/offenseDefenseAdvantage.ts moved
packages/engine/src/parryBonus.ts             moved
packages/engine/src/criticalModifier.ts       moved
packages/engine/src/uptieResolver.ts          moved
packages/engine/src/unbreakableCoin.ts        moved
packages/engine/src/statusEffects.ts          moved
packages/engine/src/legacy/clash.ts           moved, test oracle only
packages/engine/src/legacy/fixedDamageAilment.ts   moved
packages/engine/src/legacy/skillEffectGrants.ts    moved
packages/engine/src/binomial.ts               binomialPmf
packages/engine/src/clashChain.ts             roundOutcome, clashChain
packages/engine/src/damageDistribution.ts     attackDamageDistribution, mixDistributions
packages/engine/src/resolveCombatant.ts       resolveCombatant
packages/engine/src/report.ts                 clashReport, unopposedReport
packages/engine/src/matchup.ts                matchupGrid
packages/engine/test/*.test.ts                one test file per new module
packages/engine/test/fixtures.ts              shared sample Unit/Skill builders
```

Moved modules keep their existing `*.test.ts` files beside them in `src/` (Vitest picks up both `src/**/*.test.ts` and `test/**/*.test.ts`).

---

### Task 1: Workspace scaffold and formula move

**Files:**
- Create: `package.json` (replace root), `tsconfig.base.json`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/vitest.config.ts`, `.github/workflows/ci.yml`, `README.md`
- Move: `formula/*.ts` to `packages/engine/src/` and `packages/engine/src/legacy/`
- Modify: `ui/vite.config.ts:11`, `ui/tsconfig.app.json:20`
- Delete: `tsconfig.json` (root), `tsconfig.tsbuildinfo`, `formula/`

**Interfaces:**
- Produces: package `@limbus/engine` whose `src/index.ts` re-exports every module. Later tasks add exports to it.

- [ ] **Step 1: Replace the root package.json with a workspace manifest**

```json
{
  "name": "limbus-calculator",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json at the root**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": []
  }
}
```

- [ ] **Step 3: Create the engine package files**

`packages/engine/package.json`:

```json
{
  "name": "@limbus/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`packages/engine/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

`packages/engine/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.test.ts', 'test/**/*.test.ts'] },
})
```

- [ ] **Step 4: Move the formula modules with git mv**

```bash
mkdir -p packages/engine/src/legacy
for m in damage resistance offenseDefenseAdvantage parryBonus criticalModifier uptieResolver unbreakableCoin statusEffects; do
  git mv formula/$m.ts packages/engine/src/$m.ts
  git mv formula/$m.test.ts packages/engine/src/$m.test.ts
done
for m in clash fixedDamageAilment skillEffectGrants; do
  git mv formula/$m.ts packages/engine/src/legacy/$m.ts
  git mv formula/$m.test.ts packages/engine/src/legacy/$m.test.ts
done
git mv formula/index.ts packages/engine/src/index.ts
git rm -q tsconfig.json
rm -f tsconfig.tsbuildinfo
rmdir formula
```

- [ ] **Step 5: Fix the index and legacy imports**

Replace `packages/engine/src/index.ts` with:

```ts
export * from './resistance'
export * from './offenseDefenseAdvantage'
export * from './parryBonus'
export * from './criticalModifier'
export * from './damage'
export * from './uptieResolver'
export * from './statusEffects'
export * from './unbreakableCoin'
// Legacy: kept for the old ui/ app and as a Monte Carlo test oracle. Removed in Plan 3.
export * from './legacy/clash'
export * from './legacy/fixedDamageAilment'
export * from './legacy/skillEffectGrants'
```

`legacy/skillEffectGrants.ts` and `legacy/fixedDamageAilment.ts` may import sibling modules. Run `grep -n "from './" packages/engine/src/legacy/*.ts` and rewrite any import of a non-legacy module (for example `'./statusEffects'`) to `'../statusEffects'`.

- [ ] **Step 6: Point the old UI at the new location**

In `ui/vite.config.ts` change the alias line to:

```ts
'@formula': path.resolve(__dirname, '../packages/engine/src'),
```

In `ui/tsconfig.app.json` change the paths entry to:

```json
"@formula/*": ["../packages/engine/src/*"]
```

- [ ] **Step 7: Add the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [main, master]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 8: Write the README**

`README.md`:

```markdown
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
```

- [ ] **Step 9: Install, typecheck, and run the moved tests**

Run: `npm install && npm run typecheck && npm test`
Expected: typecheck clean; Vitest reports 11 test files, 100 tests passed under `@limbus/engine`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold npm workspace and move formula into packages/engine

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 2: Engine types

**Files:**
- Create: `packages/engine/src/types.ts`, `packages/engine/test/fixtures.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Produces: every type below. Plan 2's data package imports `Unit`, `Skill`, `Effect` from `@limbus/engine` and must emit JSON matching them.

- [ ] **Step 1: Write types.ts**

```ts
export type Sin = 'wrath' | 'lust' | 'sloth' | 'gluttony' | 'gloom' | 'pride' | 'envy'
export type DamageType = 'slash' | 'pierce' | 'blunt'
export type SkillDamageType = DamageType | 'guard' | 'evade' | 'none'
export type UptieTier = 1 | 2 | 3 | 4

export interface Resistances {
  damageType: Record<DamageType, number>
  sin: Record<Sin, number>
}

export interface Passive {
  name: string
  text: string
  effects: Effect[]
}

export interface Unit {
  id: string
  kind: 'identity' | 'enemy'
  name: string
  group?: string
  level: number
  hp: number
  hpGrowth: number
  speed: { min: number; max: number }
  defenseMod: number
  resistances: Resistances
  /** Fractions of max HP, descending, e.g. [0.7, 0.4]. */
  staggerThresholds: number[]
  skills: Skill[]
  passives: Passive[]
}

export type EffectTrigger =
  | 'on-use' | 'combat-start' | 'clash-win' | 'clash-lose' | 'on-hit'
  | 'heads-hit' | 'tails-hit' | 'on-crit' | 'attack-end' | 'passive'

export interface Condition {
  stat: string
  side: 'self' | 'target'
  field: 'potency' | 'count'
  op: '>=' | '>' | '<=' | '<' | '=='
  value: number
}

export type Operation =
  | { kind: 'coinPower'; delta: number }
  | { kind: 'basePower'; delta: number }
  | { kind: 'clashPower'; delta: number }
  | { kind: 'damagePercent'; delta: number }
  | { kind: 'applyStatus'; target: 'self' | 'target'; status: string; potency?: number; count?: number }
  | { kind: 'unparsed' }

export interface Effect {
  trigger: EffectTrigger
  scope: 'skill' | { coin: number }
  condition?: Condition
  op: Operation
  source: string
}

export interface SkillUptieOverride {
  basePower?: number
  coinPower?: number
  effects?: Effect[]
}

export interface Skill {
  id: string
  name: string
  slot: 'skill1' | 'skill2' | 'skill3' | 'defense' | 'enemy'
  variant?: string
  sin: Sin
  damageType: SkillDamageType
  offenseLevelMod: number
  basePower: number
  coinPower: number
  coinCount: number
  /** 0-based indices of coins that are Unbreakable. */
  unbreakableCoins: number[]
  attackWeight: number
  /** Overrides keyed by the tier they start applying at; an override applies from its tier upward until a higher tier overrides it. */
  uptie: Partial<Record<UptieTier, SkillUptieOverride>>
  effects: Effect[]
  rawText: { skill: string; coins: string[] }
}

export interface StatusValue { potency: number; count: number }

export interface ManualOverrides {
  coinPower: number
  basePower: number
  clashPower: number
  damagePercent: number
}

export interface Combatant {
  unit: Unit
  skill: Skill
  uptie: UptieTier
  level: number
  /** -45..45. Enemies are always 0. */
  sanity: number
  status: Record<string, StatusValue>
  manual: ManualOverrides
  /** Current HP; defaults to max when omitted. */
  currentHp?: number
}

export interface ResolvedCombatant {
  basePower: number
  coinPower: number
  coinCount: number
  unbreakableCoins: number
  headsChance: number
  offenseLevel: number
  defenseLevel: number
  clashPowerBonus: number
  damagePercent: number
  coinRollBonus: number
  critChance: number
  poiseCount: number
  /** Damage Up/Down etc. contributed when this combatant attacks. */
  dynamicAsAttacker: number
  /** Fragile/Protection etc. contributed when this combatant is hit. */
  dynamicAsTarget: number
  maxHp: number
  currentHp: number
  sin: Sin
  damageType: SkillDamageType
  effectsApplied: string[]
  effectsUnparsed: string[]
}

export interface DamageSummary {
  mean: number
  p10: number
  p50: number
  p90: number
  max: number
  perCoinMean: number[]
  histogram: [number, number][]
  staggerChance: number[]
}

export interface BreakdownLine { label: string; value: number; source: string }

export interface ClashReport {
  win: number
  lose: number
  draw: number
  coinsLeftIfWin: number[]
  coinsLeftIfLose: number[]
  parryRoundsExpected: number
  /** Damage A deals to B, conditional on A winning. */
  damageDealt: DamageSummary
  /** Damage B deals to A, conditional on B winning. */
  damageTaken: DamageSummary
  breakdown: BreakdownLine[]
}

export interface UnopposedReport {
  damage: DamageSummary
  breakdown: BreakdownLine[]
}

export interface MatchupCell {
  attackerSkillId: string
  targetUnitId: string
  targetSkillId: string
  win: number
  medianDamage: number
  meanDamage: number
  sinMultiplier: number
  damageTypeMultiplier: number
}

export interface MatchupGrid {
  rows: { unitId: string; skillId: string }[]
  columns: { unitId: string; skillId: string; turnsToKill: number }[]
  cells: MatchupCell[][]
}

export const EMPTY_MANUAL: ManualOverrides = { coinPower: 0, basePower: 0, clashPower: 0, damagePercent: 0 }

export const ALL_SINS: Sin[] = ['wrath', 'lust', 'sloth', 'gluttony', 'gloom', 'pride', 'envy']
```

- [ ] **Step 2: Write test/fixtures.ts**

```ts
import type { Combatant, Skill, Unit, Effect } from '../src/types'
import { EMPTY_MANUAL } from '../src/types'

const flatSin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }

export function makeSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: 'skill-a', name: 'Test Skill', slot: 'skill1', sin: 'wrath', damageType: 'slash',
    offenseLevelMod: 0, basePower: 4, coinPower: 3, coinCount: 2, unbreakableCoins: [],
    attackWeight: 1, uptie: {}, effects: [], rawText: { skill: '', coins: [] }, ...over,
  }
}

export function makeUnit(over: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-a', kind: 'identity', name: 'Test Unit', level: 45, hp: 100, hpGrowth: 0,
    speed: { min: 3, max: 6 }, defenseMod: 0,
    resistances: { damageType: { slash: 1, pierce: 1, blunt: 1 }, sin: { ...flatSin } },
    staggerThresholds: [], skills: [makeSkill()], passives: [], ...over,
  }
}

export function makeCombatant(over: Partial<Combatant> = {}): Combatant {
  const unit = over.unit ?? makeUnit()
  return { unit, skill: over.skill ?? unit.skills[0], uptie: 4, level: unit.level, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL }, ...over }
}

export function effect(op: Effect['op'], extra: Partial<Effect> = {}): Effect {
  return { trigger: 'on-use', scope: 'skill', op, source: 'fixture', ...extra }
}
```

- [ ] **Step 3: Export types from index.ts**

Add to `packages/engine/src/index.ts`:

```ts
export * from './types'
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck -w @limbus/engine`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/engine
git commit -m "Add engine domain types and test fixtures

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 3: Binomial distribution

**Files:**
- Create: `packages/engine/src/binomial.ts`, `packages/engine/test/binomial.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Produces: `binomialPmf(n: number, p: number): number[]` where `result[k]` is P(exactly k heads in n flips), length `n + 1`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { binomialPmf } from '../src/binomial'

describe('binomialPmf', () => {
  it('returns [1] for zero coins', () => {
    expect(binomialPmf(0, 0.5)).toEqual([1])
  })
  it('matches hand values for 2 fair coins', () => {
    const pmf = binomialPmf(2, 0.5)
    expect(pmf).toHaveLength(3)
    expect(pmf[0]).toBeCloseTo(0.25)
    expect(pmf[1]).toBeCloseTo(0.5)
    expect(pmf[2]).toBeCloseTo(0.25)
  })
  it('matches C(3,1) p (1-p)^2 for p = 0.77', () => {
    expect(binomialPmf(3, 0.77)[1]).toBeCloseTo(3 * 0.77 * 0.23 * 0.23, 10)
  })
  it('sums to 1 for 6 coins at p = 0.17', () => {
    const total = binomialPmf(6, 0.17).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 12)
  })
  it('is degenerate at p = 1', () => {
    expect(binomialPmf(3, 1)).toEqual([0, 0, 0, 1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w @limbus/engine -- binomial`
Expected: FAIL, cannot find module `../src/binomial`.

- [ ] **Step 3: Implement**

```ts
/** P(exactly k heads in n independent flips with heads chance p), for k = 0..n. */
export function binomialPmf(n: number, p: number): number[] {
  const pmf = new Array<number>(n + 1).fill(0)
  let choose = 1
  for (let k = 0; k <= n; k++) {
    pmf[k] = choose * Math.pow(p, k) * Math.pow(1 - p, n - k)
    choose = (choose * (n - k)) / (k + 1)
  }
  return pmf
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w @limbus/engine -- binomial`
Expected: 5 passed.

- [ ] **Step 5: Export and commit**

Add `export * from './binomial'` to `src/index.ts`.

```bash
git add packages/engine
git commit -m "Add binomial pmf

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 4: Clash chain

**Files:**
- Create: `packages/engine/src/clashChain.ts`, `packages/engine/test/clashChain.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `binomialPmf` (Task 3), `simulateClash` from `src/legacy/clash.ts` (test only).
- Produces:

```ts
export interface ClashSide {
  basePower: number
  coinPower: number
  breakableCoins: number
  unbreakableCoins: number
  headsChance: number
  offenseLevel: number
  clashPowerBonus: number
}
export interface RoundOutcome { win: number; lose: number; tie: number }
export interface ChainResult {
  win: number; lose: number; draw: number
  coinsLeftIfWin: number[]
  coinsLeftIfLose: number[]
  parryRoundsExpected: number
}
export function clashPowerLevelBonus(myLevel: number, otherLevel: number): number
export function roundOutcome(a: ClashSide, aLive: number, b: ClashSide, bLive: number, aBonus: number, bBonus: number): RoundOutcome
export function clashChain(a: ClashSide, b: ClashSide): ChainResult
```

Rules encoded (spec 6.2): both sides flip all live coins (breakable + unbreakable) each round; power = base + level bonus + clash bonus + coinPower × heads; the lower power loses one breakable coin; equal power is a parry round that changes nothing; a side with no breakable coins left has lost. If a skill starts with zero breakable coins (all Unbreakable), its unbreakable coins are treated as breakable for the win condition, matching the legacy simulator. `coinsLeftIfWin[k]` is the joint probability that A wins with exactly k live coins left, so it sums to `win`; same for B in `coinsLeftIfLose`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { clashChain, clashPowerLevelBonus, roundOutcome, type ClashSide } from '../src/clashChain'
import { simulateClash } from '../src/legacy/clash'

function side(over: Partial<ClashSide> = {}): ClashSide {
  return { basePower: 4, coinPower: 3, breakableCoins: 2, unbreakableCoins: 0, headsChance: 0.5, offenseLevel: 45, clashPowerBonus: 0, ...over }
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('clashPowerLevelBonus', () => {
  it('gives floor(diff/3) to the higher side only', () => {
    expect(clashPowerLevelBonus(50, 44)).toBe(2)
    expect(clashPowerLevelBonus(44, 50)).toBe(0)
    expect(clashPowerLevelBonus(47, 45)).toBe(0)
  })
})

describe('roundOutcome', () => {
  it('is a certain win when A always exceeds B', () => {
    const o = roundOutcome(side({ basePower: 10, coinPower: 0 }), 1, side({ basePower: 3, coinPower: 0 }), 1, 0, 0)
    expect(o).toEqual({ win: 1, lose: 0, tie: 0 })
  })
  it('one fair coin each with base 0 coin power 1: tie half the time', () => {
    const o = roundOutcome(side({ basePower: 0, coinPower: 1 }), 1, side({ basePower: 0, coinPower: 1 }), 1, 0, 0)
    expect(o.win).toBeCloseTo(0.25)
    expect(o.lose).toBeCloseTo(0.25)
    expect(o.tie).toBeCloseTo(0.5)
  })
  it('negative coin power: heads lowers power', () => {
    const o = roundOutcome(side({ basePower: 10, coinPower: -4, headsChance: 1 }), 1, side({ basePower: 8, coinPower: 0 }), 1, 0, 0)
    expect(o.lose).toBe(1)
  })
})

describe('clashChain', () => {
  it('1 coin vs 1 coin fair symmetric: 50/50, one expected parry round', () => {
    const r = clashChain(side({ basePower: 0, coinPower: 1, breakableCoins: 1 }), side({ basePower: 0, coinPower: 1, breakableCoins: 1 }))
    expect(r.win).toBeCloseTo(0.5)
    expect(r.lose).toBeCloseTo(0.5)
    expect(r.draw).toBeCloseTo(0)
    expect(r.parryRoundsExpected).toBeCloseTo(1)
    expect(r.coinsLeftIfWin[1]).toBeCloseTo(0.5)
  })
  it('certain win keeps all coins and no parry', () => {
    const r = clashChain(side({ basePower: 9, coinPower: 0, breakableCoins: 1 }), side({ basePower: 3, coinPower: 0, breakableCoins: 2 }))
    expect(r.win).toBe(1)
    expect(r.coinsLeftIfWin).toEqual([0, 1])
    expect(r.parryRoundsExpected).toBe(0)
  })
  it('guaranteed tie every round is a draw', () => {
    const r = clashChain(side({ basePower: 5, coinPower: 0, breakableCoins: 1 }), side({ basePower: 5, coinPower: 0, breakableCoins: 1 }))
    expect(r.draw).toBe(1)
  })
  it('win + lose + draw = 1 and coin distributions sum to win/lose', () => {
    const r = clashChain(side({ breakableCoins: 3, unbreakableCoins: 1 }), side({ basePower: 6, coinPower: 2, breakableCoins: 2, headsChance: 0.77 }))
    expect(r.win + r.lose + r.draw).toBeCloseTo(1, 12)
    expect(r.coinsLeftIfWin.reduce((x, y) => x + y, 0)).toBeCloseTo(r.win, 12)
    expect(r.coinsLeftIfLose.reduce((x, y) => x + y, 0)).toBeCloseTo(r.lose, 12)
  })
  it('unbreakable coins keep flipping and are never lost', () => {
    const r = clashChain(side({ breakableCoins: 1, unbreakableCoins: 2 }), side({ breakableCoins: 1 }))
    // A can only ever end with 1 breakable + 2 unbreakable = 3 live coins when it wins.
    expect(r.coinsLeftIfWin[3]).toBeCloseTo(r.win, 12)
  })
  it('all-unbreakable skill uses its coins as breakable for the win condition', () => {
    const r = clashChain(side({ breakableCoins: 0, unbreakableCoins: 2 }), side({ breakableCoins: 1 }))
    expect(r.win).toBeGreaterThan(0)
  })
  it('agrees with the legacy random simulator within 0.5 points', () => {
    const a = side({ basePower: 3, coinPower: 4, breakableCoins: 2, headsChance: 0.6, offenseLevel: 50 })
    const b = side({ basePower: 5, coinPower: 2, breakableCoins: 3, headsChance: 0.5, offenseLevel: 44 })
    const exact = clashChain(a, b)
    const rng = mulberry32(12345)
    const n = 200_000
    let wins = 0
    let parry = 0
    for (let i = 0; i < n; i++) {
      const s = simulateClash(
        { basePower: a.basePower, coinPower: a.coinPower, coinCount: a.breakableCoins, level: a.offenseLevel, sanityPoints: 10 },
        { basePower: b.basePower, coinPower: b.coinPower, coinCount: b.breakableCoins, level: b.offenseLevel, sanityPoints: 0 },
        rng,
      )
      if (s.winner === 'a') wins++
      parry += s.parryRounds
    }
    expect(Math.abs(wins / n - exact.win)).toBeLessThan(0.005)
    expect(Math.abs(parry / n - exact.parryRoundsExpected)).toBeLessThan(0.02)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- clashChain`
Expected: FAIL, cannot find module `../src/clashChain`.

- [ ] **Step 3: Implement**

```ts
import { binomialPmf } from './binomial'

export interface ClashSide {
  basePower: number
  coinPower: number
  breakableCoins: number
  unbreakableCoins: number
  headsChance: number
  offenseLevel: number
  clashPowerBonus: number
}

export interface RoundOutcome { win: number; lose: number; tie: number }

export interface ChainResult {
  win: number
  lose: number
  draw: number
  coinsLeftIfWin: number[]
  coinsLeftIfLose: number[]
  parryRoundsExpected: number
}

/** The higher Offense Level gains 1 Clash Power per 3 levels of difference, rounded down. The lower side gains nothing. */
export function clashPowerLevelBonus(myLevel: number, otherLevel: number): number {
  return Math.max(0, Math.floor((myLevel - otherLevel) / 3))
}

/** One clash round: both sides flip every live coin; compare base + bonus + coinPower * heads. */
export function roundOutcome(a: ClashSide, aLive: number, b: ClashSide, bLive: number, aBonus: number, bBonus: number): RoundOutcome {
  const pa = binomialPmf(aLive, a.headsChance)
  const pb = binomialPmf(bLive, b.headsChance)
  let win = 0, lose = 0, tie = 0
  for (let ha = 0; ha <= aLive; ha++) {
    const powerA = a.basePower + aBonus + a.coinPower * ha
    for (let hb = 0; hb <= bLive; hb++) {
      const powerB = b.basePower + bBonus + b.coinPower * hb
      const pr = pa[ha] * pb[hb]
      if (powerA > powerB) win += pr
      else if (powerA < powerB) lose += pr
      else tie += pr
    }
  }
  return { win, lose, tie }
}

const TIE_EPSILON = 1e-12

/** Exact clash resolution as a Markov chain over (A breakable coins, B breakable coins). */
export function clashChain(a: ClashSide, b: ClashSide): ChainResult {
  const aSide = normalizeCoins(a)
  const bSide = normalizeCoins(b)
  const aBonus = clashPowerLevelBonus(aSide.offenseLevel, bSide.offenseLevel) + aSide.clashPowerBonus
  const bBonus = clashPowerLevelBonus(bSide.offenseLevel, aSide.offenseLevel) + bSide.clashPowerBonus
  const maxA = aSide.breakableCoins + aSide.unbreakableCoins
  const maxB = bSide.breakableCoins + bSide.unbreakableCoins
  const memo = new Map<string, ChainResult>()

  const blank = (): ChainResult => ({
    win: 0, lose: 0, draw: 0,
    coinsLeftIfWin: new Array<number>(maxA + 1).fill(0),
    coinsLeftIfLose: new Array<number>(maxB + 1).fill(0),
    parryRoundsExpected: 0,
  })

  function solve(x: number, y: number): ChainResult {
    const key = `${x},${y}`
    const cached = memo.get(key)
    if (cached) return cached
    const r = blank()
    if (x === 0 && y === 0) {
      r.draw = 1
    } else if (y === 0) {
      r.win = 1
      r.coinsLeftIfWin[x + aSide.unbreakableCoins] = 1
    } else if (x === 0) {
      r.lose = 1
      r.coinsLeftIfLose[y + bSide.unbreakableCoins] = 1
    } else {
      const o = roundOutcome(aSide, x + aSide.unbreakableCoins, bSide, y + bSide.unbreakableCoins, aBonus, bBonus)
      if (o.tie >= 1 - TIE_EPSILON) {
        r.draw = 1
      } else {
        const denom = 1 - o.tie
        const onWin = solve(x, y - 1)
        const onLose = solve(x - 1, y)
        const mix = (pick: (c: ChainResult) => number) => (o.win * pick(onWin) + o.lose * pick(onLose)) / denom
        r.win = mix(c => c.win)
        r.lose = mix(c => c.lose)
        r.draw = mix(c => c.draw)
        for (let k = 0; k <= maxA; k++) r.coinsLeftIfWin[k] = mix(c => c.coinsLeftIfWin[k])
        for (let k = 0; k <= maxB; k++) r.coinsLeftIfLose[k] = mix(c => c.coinsLeftIfLose[k])
        r.parryRoundsExpected = o.tie / denom + mix(c => c.parryRoundsExpected)
      }
    }
    memo.set(key, r)
    return r
  }

  return solve(aSide.breakableCoins, bSide.breakableCoins)
}

/** A skill whose coins are all Unbreakable still has to lose a clash somehow: treat them as breakable for the win condition. */
function normalizeCoins(s: ClashSide): ClashSide {
  if (s.breakableCoins > 0 || s.unbreakableCoins === 0) return s
  return { ...s, breakableCoins: s.unbreakableCoins, unbreakableCoins: 0 }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- clashChain`
Expected: 10 passed. The Monte Carlo test takes a few seconds.

- [ ] **Step 5: Export and commit**

Add `export * from './clashChain'` to `src/index.ts`.

```bash
git add packages/engine
git commit -m "Add exact clash chain with Monte Carlo cross-check

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 5: Damage distribution

**Files:**
- Create: `packages/engine/src/damageDistribution.ts`, `packages/engine/test/damageDistribution.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `computeFinalDamage` from `src/damage.ts`, `staggerDamageTypeResistanceModifier` from `src/resistance.ts`, `DamageSummary` from `src/types.ts`.
- Produces:

```ts
export interface AttackParams {
  coins: number
  basePower: number
  coinPower: number
  coinRollBonus: number
  headsChance: number
  critChance: number
  poiseCount: number
  critModifier: number
  sinResistance: number
  damageTypeResistance: number
  offenseDefenseAdvantage: number
  parryBonus: number
  dynamicModifier: number
  defenderMaxHp: number
  defenderCurrentHp: number
  staggerThresholds: number[]
  staggerMidAttack: boolean
}
export function attackDamageDistribution(p: AttackParams): DamageSummary
export function mixDistributions(parts: { weight: number; summary: DamageSummary }[]): DamageSummary
```

Rules (spec 6.3): coin i's roll is `basePower + coinRollBonus + coinPower × (heads among coins 1..i)`. Each coin is a heads/tails flip and, while `poiseCount > 0`, an independent crit flip with `critChance`; a crit adds `critModifier` to the static sum and spends one poise count. Cumulative damage is compared against the defender's absolute stagger lines (`currentHp - threshold × maxHp`); once one is crossed and `staggerMidAttack` is true, later coins in the same attack use `staggerDamageTypeResistanceModifier(thresholdsCrossed)` instead of the normal damage-type term. `staggerChance[t]` is the probability the attack crosses threshold `t`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { attackDamageDistribution, mixDistributions, type AttackParams } from '../src/damageDistribution'

function params(over: Partial<AttackParams> = {}): AttackParams {
  return {
    coins: 3, basePower: 4, coinPower: 3, coinRollBonus: 0, headsChance: 0.5,
    critChance: 0, poiseCount: 0, critModifier: 0.2,
    sinResistance: 0, damageTypeResistance: 0, offenseDefenseAdvantage: 0, parryBonus: 0,
    dynamicModifier: 0, defenderMaxHp: 1000, defenderCurrentHp: 1000,
    staggerThresholds: [], staggerMidAttack: true, ...over,
  }
}

describe('attackDamageDistribution', () => {
  it('accumulates coin power across heads: 4+3 coins all heads is 7 + 10 + 13 = 30', () => {
    const d = attackDamageDistribution(params({ headsChance: 1 }))
    expect(d.mean).toBe(30)
    expect(d.max).toBe(30)
    expect(d.perCoinMean).toEqual([7, 10, 13])
  })
  it('two fair coins: outcomes 8, 11, 14, 17 each at 25%, mean 12.5', () => {
    const d = attackDamageDistribution(params({ coins: 2 }))
    expect(d.mean).toBeCloseTo(12.5)
    const map = new Map(d.histogram)
    expect(map.get(8)).toBeCloseTo(0.25)
    expect(map.get(11)).toBeCloseTo(0.25)
    expect(map.get(14)).toBeCloseTo(0.25)
    expect(map.get(17)).toBeCloseTo(0.25)
    expect(d.p10).toBe(8)
    expect(d.p50).toBe(11)
    expect(d.p90).toBe(17)
  })
  it('applies resistances through computeFinalDamage', () => {
    // one coin, always heads: roll 7; Fatal sin (+1) => 14
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, sinResistance: 1 }))
    expect(d.mean).toBe(14)
  })
  it('crits add the critical modifier while poise count lasts', () => {
    // one coin always heads, always crit: 7 * 1.2 = 8.4 -> 8
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 1 }))
    expect(d.mean).toBe(8)
    const none = attackDamageDistribution(params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 0 }))
    expect(none.mean).toBe(7)
  })
  it('crossing a stagger line makes later coins use the stagger multiplier', () => {
    // 3 coins always heads: 7, 10, 13. Threshold at 70% of 20 HP => line at 20 - 14 = 6 damage.
    // Coin 1 (7) crosses it, so coins 2 and 3 get damageTypeResistance +1: 20 and 26. Total 53.
    const d = attackDamageDistribution(params({ headsChance: 1, defenderMaxHp: 20, defenderCurrentHp: 20, staggerThresholds: [0.7] }))
    expect(d.mean).toBe(53)
    expect(d.staggerChance).toEqual([1])
    const off = attackDamageDistribution(params({ headsChance: 1, defenderMaxHp: 20, defenderCurrentHp: 20, staggerThresholds: [0.7], staggerMidAttack: false }))
    expect(off.mean).toBe(30)
    expect(off.staggerChance).toEqual([1])
  })
  it('zero coins deals nothing', () => {
    const d = attackDamageDistribution(params({ coins: 0 }))
    expect(d.mean).toBe(0)
    expect(d.histogram).toEqual([[0, 1]])
  })
})

describe('mixDistributions', () => {
  it('weights histograms and recomputes summary stats', () => {
    const a = attackDamageDistribution(params({ coins: 1, headsChance: 1 })) // 7
    const b = attackDamageDistribution(params({ coins: 1, headsChance: 0 })) // 4
    const m = mixDistributions([{ weight: 0.25, summary: a }, { weight: 0.75, summary: b }])
    expect(m.mean).toBeCloseTo(0.25 * 7 + 0.75 * 4)
    expect(m.p50).toBe(4)
    expect(m.max).toBe(7)
    expect(m.perCoinMean[0]).toBeCloseTo(4.75)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- damageDistribution`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import { computeFinalDamage } from './damage'
import { staggerDamageTypeResistanceModifier } from './resistance'
import type { DamageSummary } from './types'

export interface AttackParams {
  coins: number
  basePower: number
  coinPower: number
  coinRollBonus: number
  headsChance: number
  critChance: number
  poiseCount: number
  critModifier: number
  sinResistance: number
  damageTypeResistance: number
  offenseDefenseAdvantage: number
  parryBonus: number
  dynamicModifier: number
  defenderMaxHp: number
  defenderCurrentHp: number
  staggerThresholds: number[]
  staggerMidAttack: boolean
}

interface Walk {
  coinIndex: number
  headsSoFar: number
  total: number
  thresholdsCrossed: number
  poiseCount: number
  prob: number
}

/** Exact distribution of total damage for a one-sided attack with `coins` coins, enumerating every heads/crit sequence. */
export function attackDamageDistribution(p: AttackParams): DamageSummary {
  const histogram = new Map<number, number>()
  const perCoinMean = new Array<number>(p.coins).fill(0)
  const staggerChance = new Array<number>(p.staggerThresholds.length).fill(0)
  const staggerLines = p.staggerThresholds.map(t => p.defenderCurrentHp - t * p.defenderMaxHp)

  const stack: Walk[] = [{ coinIndex: 0, headsSoFar: 0, total: 0, thresholdsCrossed: 0, poiseCount: p.poiseCount, prob: 1 }]
  while (stack.length > 0) {
    const w = stack.pop()!
    if (w.coinIndex === p.coins) {
      histogram.set(w.total, (histogram.get(w.total) ?? 0) + w.prob)
      continue
    }
    const critChance = w.poiseCount > 0 ? Math.min(1, p.critChance) : 0
    for (const heads of [true, false]) {
      const pHeads = heads ? p.headsChance : 1 - p.headsChance
      if (pHeads === 0) continue
      for (const crit of [true, false]) {
        const pCrit = crit ? critChance : 1 - critChance
        if (pCrit === 0) continue
        const prob = w.prob * pHeads * pCrit
        const headsSoFar = w.headsSoFar + (heads ? 1 : 0)
        const coinRoll = p.basePower + p.coinRollBonus + p.coinPower * headsSoFar
        const staggered = p.staggerMidAttack && w.thresholdsCrossed > 0
        const damage = computeFinalDamage({
          coinRoll,
          staticModifiers: {
            sinResistance: p.sinResistance,
            damageTypeResistance: staggered ? staggerDamageTypeResistanceModifier(w.thresholdsCrossed) : p.damageTypeResistance,
            offenseDefenseAdvantage: p.offenseDefenseAdvantage,
            parryBonus: p.parryBonus,
            critical: crit ? p.critModifier : 0,
          },
          dynamicModifiers: { skillEffects: 0, buffs: p.dynamicModifier },
        })
        perCoinMean[w.coinIndex] += damage * prob
        const total = w.total + damage
        let crossed = w.thresholdsCrossed
        while (crossed < staggerLines.length && total >= staggerLines[crossed]) {
          staggerChance[crossed] += prob
          crossed++
        }
        stack.push({
          coinIndex: w.coinIndex + 1,
          headsSoFar,
          total,
          thresholdsCrossed: crossed,
          poiseCount: crit ? w.poiseCount - 1 : w.poiseCount,
          prob,
        })
      }
    }
  }
  return summarize(histogram, perCoinMean, staggerChance)
}

/** Combine several conditional distributions into one by weight. Weights should sum to 1. */
export function mixDistributions(parts: { weight: number; summary: DamageSummary }[]): DamageSummary {
  const histogram = new Map<number, number>()
  const coins = Math.max(0, ...parts.map(x => x.summary.perCoinMean.length))
  const perCoinMean = new Array<number>(coins).fill(0)
  const thresholds = Math.max(0, ...parts.map(x => x.summary.staggerChance.length))
  const staggerChance = new Array<number>(thresholds).fill(0)
  for (const { weight, summary } of parts) {
    if (weight === 0) continue
    for (const [value, prob] of summary.histogram) histogram.set(value, (histogram.get(value) ?? 0) + prob * weight)
    summary.perCoinMean.forEach((m, i) => { perCoinMean[i] += m * weight })
    summary.staggerChance.forEach((c, i) => { staggerChance[i] += c * weight })
  }
  return summarize(histogram, perCoinMean, staggerChance)
}

function summarize(histogram: Map<number, number>, perCoinMean: number[], staggerChance: number[]): DamageSummary {
  const entries = [...histogram.entries()].sort((x, y) => x[0] - y[0])
  if (entries.length === 0) entries.push([0, 1])
  const mass = entries.reduce((s, [, pr]) => s + pr, 0)
  const mean = entries.reduce((s, [v, pr]) => s + v * pr, 0) / mass
  const percentile = (q: number): number => {
    let acc = 0
    for (const [v, pr] of entries) {
      acc += pr / mass
      if (acc >= q - 1e-12) return v
    }
    return entries[entries.length - 1][0]
  }
  return {
    mean,
    p10: percentile(0.1),
    p50: percentile(0.5),
    p90: percentile(0.9),
    max: entries[entries.length - 1][0],
    perCoinMean: perCoinMean.map(m => m / mass),
    histogram: entries.map(([v, pr]) => [v, pr / mass] as [number, number]),
    staggerChance: staggerChance.map(c => c / mass),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- damageDistribution`
Expected: 7 passed.

- [ ] **Step 5: Export and commit**

Add `export * from './damageDistribution'` to `src/index.ts`.

```bash
git add packages/engine
git commit -m "Add exact damage distribution with cumulative coin power and stagger

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 6: Resolve combatant

**Files:**
- Create: `packages/engine/src/resolveCombatant.ts`, `packages/engine/test/resolveCombatant.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `Combatant`, `ResolvedCombatant`, `Effect`, `Condition`, `Skill`, `UptieTier` from `types.ts`; `calculateDynamicModifier`, `sumCoinRollBonus`, `EffectStack` from `statusEffects.ts`. The old `resolveUptie` helper is not used (the new `Skill.uptie` shape is a per-tier override map, resolved here) and stays exported only for the legacy UI.
- Produces: `resolveCombatant(self: Combatant, opponent?: Combatant): ResolvedCombatant`.

Rules (spec 6.1):
- Uptie: walk tiers 1..4 in order, applying each override at or below `self.uptie`; a later (higher) tier replaces an earlier one. An override's `effects` replaces the skill's `effects` entirely.
- Effects with trigger `on-use`, `passive`, or `combat-start` and scope `skill` are evaluated, from the skill and from every unit passive. A condition reads `self.status` or `opponent.status` by `stat` and `field`; a missing status reads as 0; a missing opponent makes `target` conditions false. Ops `coinPower`, `basePower`, `clashPower`, `damagePercent` add their delta and record the source in `effectsApplied`. `applyStatus` is skipped. `unparsed` sources go to `effectsUnparsed` regardless of trigger.
- `headsChance = (50 + clamp(sanity, -45, 45)) / 100`.
- `offenseLevel = level + skill.offenseLevelMod`; `defenseLevel = level + unit.defenseMod`.
- Status stacks feed the existing registry with `potency` as the stack count. `dynamicAsTarget` uses only ids `fragile` and `protection`; `dynamicAsAttacker` uses every other id.
- `critChance = min(1, poise.potency × 0.05)`, `poiseCount = poise.count`.
- `unbreakableCoins = skill.unbreakableCoins.length`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { resolveCombatant } from '../src/resolveCombatant'
import { effect, makeCombatant, makeSkill, makeUnit } from './fixtures'

describe('resolveCombatant', () => {
  it('maps flat stats, sanity, and levels', () => {
    const c = makeCombatant({ sanity: 27, level: 50, skill: makeSkill({ offenseLevelMod: 3 }), unit: makeUnit({ defenseMod: -2, skills: [makeSkill()] }) })
    const r = resolveCombatant(c)
    expect(r.basePower).toBe(4)
    expect(r.coinPower).toBe(3)
    expect(r.coinCount).toBe(2)
    expect(r.headsChance).toBeCloseTo(0.77)
    expect(r.offenseLevel).toBe(53)
    expect(r.defenseLevel).toBe(48)
    expect(r.maxHp).toBe(100)
    expect(r.currentHp).toBe(100)
  })
  it('clamps sanity to [-45, 45]', () => {
    expect(resolveCombatant(makeCombatant({ sanity: 99 })).headsChance).toBeCloseTo(0.95)
    expect(resolveCombatant(makeCombatant({ sanity: -99 })).headsChance).toBeCloseTo(0.05)
  })
  it('applies uptie overrides from their tier upward until a higher tier overrides', () => {
    const skill = makeSkill({ basePower: 3, coinPower: 3, uptie: { 2: { basePower: 2 }, 3: { coinPower: 5, basePower: 3 } } })
    expect(resolveCombatant(makeCombatant({ skill, uptie: 1 })).basePower).toBe(3)
    expect(resolveCombatant(makeCombatant({ skill, uptie: 2 })).basePower).toBe(2)
    expect(resolveCombatant(makeCombatant({ skill, uptie: 2 })).coinPower).toBe(3)
    expect(resolveCombatant(makeCombatant({ skill, uptie: 3 })).basePower).toBe(3)
    expect(resolveCombatant(makeCombatant({ skill, uptie: 3 })).coinPower).toBe(5)
    expect(resolveCombatant(makeCombatant({ skill, uptie: 4 })).coinPower).toBe(5)
  })
  it('applies unconditional on-use coin power and base power effects', () => {
    const skill = makeSkill({ effects: [effect({ kind: 'coinPower', delta: 1 }), effect({ kind: 'basePower', delta: 2 })] })
    const r = resolveCombatant(makeCombatant({ skill }))
    expect(r.coinPower).toBe(4)
    expect(r.basePower).toBe(6)
    expect(r.effectsApplied).toHaveLength(2)
  })
  it('evaluates self conditions against entered status', () => {
    const cond = { stat: 'poise', side: 'self' as const, field: 'potency' as const, op: '>=' as const, value: 5 }
    const skill = makeSkill({ effects: [effect({ kind: 'coinPower', delta: 1 }, { condition: cond })] })
    expect(resolveCombatant(makeCombatant({ skill, status: { poise: { potency: 5, count: 2 } } })).coinPower).toBe(4)
    expect(resolveCombatant(makeCombatant({ skill, status: { poise: { potency: 4, count: 2 } } })).coinPower).toBe(3)
    expect(resolveCombatant(makeCombatant({ skill })).coinPower).toBe(3)
  })
  it('evaluates target conditions against the opponent, false without one', () => {
    const cond = { stat: 'rupture', side: 'target' as const, field: 'potency' as const, op: '>' as const, value: 0 }
    const skill = makeSkill({ effects: [effect({ kind: 'clashPower', delta: 2 }, { condition: cond })] })
    const foe = makeCombatant({ status: { rupture: { potency: 3, count: 1 } } })
    expect(resolveCombatant(makeCombatant({ skill }), foe).clashPowerBonus).toBe(2)
    expect(resolveCombatant(makeCombatant({ skill })).clashPowerBonus).toBe(0)
  })
  it('ignores triggers other than on-use, passive, combat-start and records unparsed ops', () => {
    const skill = makeSkill({ effects: [
      effect({ kind: 'coinPower', delta: 9 }, { trigger: 'on-hit' }),
      effect({ kind: 'unparsed' }, { source: 'Reuse the final Coin' }),
    ] })
    const r = resolveCombatant(makeCombatant({ skill }))
    expect(r.coinPower).toBe(3)
    expect(r.effectsUnparsed).toEqual(['Reuse the final Coin'])
  })
  it('applies passive effects from the unit', () => {
    const unit = makeUnit({ passives: [{ name: 'P', text: 'x', effects: [effect({ kind: 'damagePercent', delta: 0.1 }, { trigger: 'passive' })] }] })
    expect(resolveCombatant(makeCombatant({ unit })).damagePercent).toBeCloseTo(0.1)
  })
  it('adds manual overrides', () => {
    const r = resolveCombatant(makeCombatant({ manual: { coinPower: 1, basePower: 1, clashPower: 1, damagePercent: 0.1 } }))
    expect(r.coinPower).toBe(4)
    expect(r.basePower).toBe(5)
    expect(r.clashPowerBonus).toBe(1)
    expect(r.damagePercent).toBeCloseTo(0.1)
  })
  it('derives crit chance and dynamic modifiers from status', () => {
    const r = resolveCombatant(makeCombatant({ status: {
      poise: { potency: 6, count: 2 },
      fragile: { potency: 2, count: 0 },
      'damage-up': { potency: 1, count: 0 },
    } }))
    expect(r.critChance).toBeCloseTo(0.3)
    expect(r.poiseCount).toBe(2)
    expect(r.dynamicAsTarget).toBeCloseTo(0.2)
    expect(r.dynamicAsAttacker).toBeCloseTo(0.1)
  })
  it('counts unbreakable coins from the skill', () => {
    expect(resolveCombatant(makeCombatant({ skill: makeSkill({ coinCount: 3, unbreakableCoins: [2] }) })).unbreakableCoins).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- resolveCombatant`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import { calculateDynamicModifier, sumCoinRollBonus, type EffectStack } from './statusEffects'
import type { Combatant, Condition, Effect, ResolvedCombatant, Skill, UptieTier } from './types'

const ACTIVE_TRIGGERS = new Set<Effect['trigger']>(['on-use', 'passive', 'combat-start'])
const TARGET_SIDE_IDS = new Set(['fragile', 'protection'])

export function resolveCombatant(self: Combatant, opponent?: Combatant): ResolvedCombatant {
  const skill = applyUptie(self.skill, self.uptie)
  let basePower = skill.basePower + self.manual.basePower
  let coinPower = skill.coinPower + self.manual.coinPower
  let clashPowerBonus = self.manual.clashPower
  let damagePercent = self.manual.damagePercent
  const effectsApplied: string[] = []
  const effectsUnparsed: string[] = []

  const candidates = [...skill.effects, ...self.unit.passives.flatMap(p => p.effects)]
  for (const e of candidates) {
    if (e.op.kind === 'unparsed') { effectsUnparsed.push(e.source); continue }
    if (!ACTIVE_TRIGGERS.has(e.trigger) || e.scope !== 'skill') continue
    if (e.condition && !holds(e.condition, self, opponent)) continue
    switch (e.op.kind) {
      case 'coinPower': coinPower += e.op.delta; break
      case 'basePower': basePower += e.op.delta; break
      case 'clashPower': clashPowerBonus += e.op.delta; break
      case 'damagePercent': damagePercent += e.op.delta; break
      case 'applyStatus': continue
    }
    effectsApplied.push(e.source)
  }

  const stacks: EffectStack[] = Object.entries(self.status).map(([effectId, v]) => ({ effectId, stacks: v.potency }))
  const targetStacks = stacks.filter(s => TARGET_SIDE_IDS.has(s.effectId))
  const attackerStacks = stacks.filter(s => !TARGET_SIDE_IDS.has(s.effectId))
  const poise = self.status['poise'] ?? { potency: 0, count: 0 }
  const sanity = Math.min(45, Math.max(-45, self.sanity))

  return {
    basePower,
    coinPower,
    coinCount: skill.coinCount,
    unbreakableCoins: skill.unbreakableCoins.length,
    headsChance: (50 + sanity) / 100,
    offenseLevel: self.level + skill.offenseLevelMod,
    defenseLevel: self.level + self.unit.defenseMod,
    clashPowerBonus,
    damagePercent,
    coinRollBonus: sumCoinRollBonus(attackerStacks),
    critChance: Math.min(1, poise.potency * 0.05),
    poiseCount: poise.count,
    dynamicAsAttacker: calculateDynamicModifier(attackerStacks, false),
    dynamicAsTarget: calculateDynamicModifier(targetStacks, false),
    maxHp: self.unit.hp,
    currentHp: self.currentHp ?? self.unit.hp,
    sin: skill.sin,
    damageType: skill.damageType,
    effectsApplied,
    effectsUnparsed,
  }
}

function applyUptie(skill: Skill, tier: UptieTier): Skill {
  let out = { ...skill }
  for (const t of [1, 2, 3, 4] as UptieTier[]) {
    if (t > tier) break
    const o = skill.uptie[t]
    if (!o) continue
    if (o.basePower !== undefined) out = { ...out, basePower: o.basePower }
    if (o.coinPower !== undefined) out = { ...out, coinPower: o.coinPower }
    if (o.effects !== undefined) out = { ...out, effects: o.effects }
  }
  return out
}

function holds(c: Condition, self: Combatant, opponent?: Combatant): boolean {
  const owner = c.side === 'self' ? self : opponent
  if (!owner) return false
  const actual = owner.status[c.stat]?.[c.field] ?? 0
  switch (c.op) {
    case '>=': return actual >= c.value
    case '>': return actual > c.value
    case '<=': return actual <= c.value
    case '<': return actual < c.value
    case '==': return actual === c.value
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- resolveCombatant`
Expected: 11 passed.

- [ ] **Step 5: Export and commit**

Add `export * from './resolveCombatant'` to `src/index.ts`.

```bash
git add packages/engine
git commit -m "Add resolveCombatant: uptie, effects, status, manual overrides to flat numbers

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 7: Reports

**Files:**
- Create: `packages/engine/src/report.ts`, `packages/engine/test/report.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `resolveCombatant`, `clashChain`, `ClashSide`, `attackDamageDistribution`, `mixDistributions`, `AttackParams`, `resistanceModifier`, `offenseDefenseAdvantage`, `parryRoundBonus`, `criticalDamageModifier`, types.
- Produces:

```ts
export interface ReportOptions { staggerMidAttack?: boolean }
export function clashReport(a: Combatant, b: Combatant, options?: ReportOptions): ClashReport
export function unopposedReport(attacker: Combatant, target: Combatant, options?: ReportOptions): UnopposedReport
export function damageMultipliers(attacker: ResolvedCombatant, target: Combatant): { sin: number; damageType: number }
```

Rules: `damageDealt` mixes `attackDamageDistribution` over every `k` in `coinsLeftIfWin` with weight `coinsLeftIfWin[k] / win` (a zero-coin summary when `win` is 0). `damageTaken` does the same with B attacking A over `coinsLeftIfLose / lose`. The sin multiplier is `target.unit.resistances.sin[attacker.sin]`; the damage-type multiplier is `target.unit.resistances.damageType[attacker.damageType]` when that is slash, pierce, or blunt, else 1. Both feed `resistanceModifier`. `parryBonus = parryRoundBonus(parryRoundsExpected)`. `dynamicModifier = attacker.dynamicAsAttacker + target.dynamicAsTarget + attacker.damagePercent`. `critModifier = criticalDamageModifier()`. The breakdown lists every term for the A-attacks-B case with its source string.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { clashReport, unopposedReport } from '../src/report'
import { makeCombatant, makeSkill, makeUnit } from './fixtures'

describe('unopposedReport', () => {
  it('uses all coins and the target resistances', () => {
    const attacker = makeCombatant({ sanity: 45, skill: makeSkill({ coinCount: 1, sin: 'wrath', damageType: 'slash' }) })
    const target = makeCombatant({ unit: makeUnit({ resistances: { damageType: { slash: 2, pierce: 1, blunt: 1 }, sin: { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 } } }) })
    const r = unopposedReport(attacker, target)
    // heads 95%: roll 7 or 4; Fatal slash => +1 => 14 or 8
    expect(r.damage.max).toBe(14)
    expect(r.damage.mean).toBeCloseTo(0.95 * 14 + 0.05 * 8)
    expect(r.breakdown.find(l => l.label === 'Damage type resistance')?.value).toBe(1)
  })
})

describe('clashReport', () => {
  it('reports probabilities that sum to 1 and conditional damage for both sides', () => {
    const a = makeCombatant({ unit: makeUnit({ id: 'a' }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ basePower: 3, coinPower: 4, coinCount: 3 })] }) })
    const r = clashReport(a, b)
    expect(r.win + r.lose + r.draw).toBeCloseTo(1, 12)
    expect(r.damageDealt.mean).toBeGreaterThan(0)
    expect(r.damageTaken.mean).toBeGreaterThan(0)
    expect(r.coinsLeftIfWin.reduce((x, y) => x + y, 0)).toBeCloseTo(r.win, 12)
  })
  it('certain win gives a zero damageTaken summary', () => {
    const a = makeCombatant({ skill: makeSkill({ basePower: 30, coinPower: 0, coinCount: 1 }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b' }) })
    const r = clashReport(a, b)
    expect(r.win).toBe(1)
    expect(r.damageTaken.mean).toBe(0)
    expect(r.damageDealt.mean).toBe(30)
  })
  it('folds expected parry rounds into the parry bonus line', () => {
    const a = makeCombatant({ skill: makeSkill({ basePower: 0, coinPower: 1, coinCount: 1 }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ basePower: 0, coinPower: 1, coinCount: 1 })] }) })
    const r = clashReport(a, b)
    expect(r.parryRoundsExpected).toBeCloseTo(1)
    expect(r.breakdown.find(l => l.label === 'Parry bonus')?.value).toBeCloseTo(0.03)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- report`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import { clashChain, type ClashSide } from './clashChain'
import { criticalDamageModifier } from './criticalModifier'
import { attackDamageDistribution, mixDistributions, type AttackParams } from './damageDistribution'
import { offenseDefenseAdvantage } from './offenseDefenseAdvantage'
import { parryRoundBonus } from './parryBonus'
import { resistanceModifier } from './resistance'
import { resolveCombatant } from './resolveCombatant'
import type { BreakdownLine, ClashReport, Combatant, DamageSummary, ResolvedCombatant, UnopposedReport } from './types'

export interface ReportOptions { staggerMidAttack?: boolean }

export function damageMultipliers(attacker: ResolvedCombatant, target: Combatant): { sin: number; damageType: number } {
  const dt = attacker.damageType
  return {
    sin: target.unit.resistances.sin[attacker.sin],
    damageType: dt === 'slash' || dt === 'pierce' || dt === 'blunt' ? target.unit.resistances.damageType[dt] : 1,
  }
}

export function clashReport(a: Combatant, b: Combatant, options: ReportOptions = {}): ClashReport {
  const ra = resolveCombatant(a, b)
  const rb = resolveCombatant(b, a)
  const chain = clashChain(toSide(ra), toSide(rb))
  const parryBonus = parryRoundBonus(chain.parryRoundsExpected)
  const dealt = conditionalDamage(ra, rb, b, chain.coinsLeftIfWin, chain.win, parryBonus, options)
  const taken = conditionalDamage(rb, ra, a, chain.coinsLeftIfLose, chain.lose, parryBonus, options)
  return {
    win: chain.win,
    lose: chain.lose,
    draw: chain.draw,
    coinsLeftIfWin: chain.coinsLeftIfWin,
    coinsLeftIfLose: chain.coinsLeftIfLose,
    parryRoundsExpected: chain.parryRoundsExpected,
    damageDealt: dealt.summary,
    damageTaken: taken.summary,
    breakdown: dealt.breakdown,
  }
}

export function unopposedReport(attacker: Combatant, target: Combatant, options: ReportOptions = {}): UnopposedReport {
  const ra = resolveCombatant(attacker, target)
  const rt = resolveCombatant(target, attacker)
  const weights = new Array<number>(ra.coinCount + 1).fill(0)
  weights[ra.coinCount] = 1
  const { summary, breakdown } = conditionalDamage(ra, rt, target, weights, 1, 0, options)
  return { damage: summary, breakdown }
}

function toSide(r: ResolvedCombatant): ClashSide {
  return {
    basePower: r.basePower,
    coinPower: r.coinPower,
    breakableCoins: r.coinCount - r.unbreakableCoins,
    unbreakableCoins: r.unbreakableCoins,
    headsChance: r.headsChance,
    offenseLevel: r.offenseLevel,
    clashPowerBonus: r.clashPowerBonus,
  }
}

function conditionalDamage(
  attacker: ResolvedCombatant,
  target: ResolvedCombatant,
  targetCombatant: Combatant,
  coinWeights: number[],
  totalWeight: number,
  parryBonus: number,
  options: ReportOptions,
): { summary: DamageSummary; breakdown: BreakdownLine[] } {
  const mult = damageMultipliers(attacker, targetCombatant)
  const base: Omit<AttackParams, 'coins'> = {
    basePower: attacker.basePower,
    coinPower: attacker.coinPower,
    coinRollBonus: attacker.coinRollBonus,
    headsChance: attacker.headsChance,
    critChance: attacker.critChance,
    poiseCount: attacker.poiseCount,
    critModifier: criticalDamageModifier(),
    sinResistance: resistanceModifier(mult.sin),
    damageTypeResistance: resistanceModifier(mult.damageType),
    offenseDefenseAdvantage: offenseDefenseAdvantage(attacker.offenseLevel, target.defenseLevel),
    parryBonus,
    dynamicModifier: attacker.dynamicAsAttacker + target.dynamicAsTarget + attacker.damagePercent,
    defenderMaxHp: target.maxHp,
    defenderCurrentHp: target.currentHp,
    staggerThresholds: targetCombatant.unit.staggerThresholds,
    staggerMidAttack: options.staggerMidAttack ?? true,
  }
  const breakdown: BreakdownLine[] = [
    { label: 'Base power', value: attacker.basePower, source: 'skill + uptie + effects + manual' },
    { label: 'Coin power', value: attacker.coinPower, source: 'skill + uptie + effects + manual' },
    { label: 'Heads chance', value: attacker.headsChance, source: '50 + SP, clamped to [-45, 45]' },
    { label: 'Sin resistance', value: base.sinResistance, source: `x${mult.sin} ${attacker.sin} on target` },
    { label: 'Damage type resistance', value: base.damageTypeResistance, source: `x${mult.damageType} ${attacker.damageType} on target` },
    { label: 'Offense-defense advantage', value: base.offenseDefenseAdvantage, source: `offense ${attacker.offenseLevel} vs defense ${target.defenseLevel}` },
    { label: 'Parry bonus', value: parryBonus, source: 'expected parry rounds x 0.03' },
    { label: 'Dynamic modifier', value: base.dynamicModifier, source: 'Damage Up/Down, Fragile/Protection, damage % effects' },
    { label: 'Crit chance', value: attacker.critChance, source: 'Poise potency x 5%' },
  ]
  const parts = coinWeights
    .map((w, coins) => ({ weight: totalWeight > 0 ? w / totalWeight : 0, coins }))
    .filter(p => p.weight > 0)
    .map(p => ({ weight: p.weight, summary: attackDamageDistribution({ ...base, coins: p.coins }) }))
  const summary = parts.length > 0 ? mixDistributions(parts) : attackDamageDistribution({ ...base, coins: 0 })
  return { summary, breakdown }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- report`
Expected: 4 passed.

- [ ] **Step 5: Export and commit**

Add `export * from './report'` to `src/index.ts`.

```bash
git add packages/engine
git commit -m "Add clashReport and unopposedReport with modifier breakdown

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 8: Matchup grid

**Files:**
- Create: `packages/engine/src/matchup.ts`, `packages/engine/test/matchup.test.ts`
- Modify: `packages/engine/src/index.ts`

**Interfaces:**
- Consumes: `clashReport`, `unopposedReport`, `damageMultipliers`, `ReportOptions` (Task 7), `resolveCombatant` (Task 6), `EMPTY_MANUAL` and types (Task 2).
- Produces:

```ts
export function primaryAttackSkill(unit: Unit): Skill | undefined
export function enemyCombatant(unit: Unit, skill: Skill): Combatant
export function matchupGrid(team: Combatant[], wave: Unit[], options?: ReportOptions): MatchupGrid
```

Rules (spec 6.4): rows are every attack skill of every team member (skills whose `damageType` is slash, pierce, or blunt and whose slot is not `defense`), keeping the member's uptie, level, sanity, status, and manual values. Columns are every unit in `wave` paired with its primary attack skill: the attack skill with the highest `attackWeight`, first on ties. Units with no attack skill are skipped. Each cell runs `clashReport(row, column)` for `win`, and `unopposedReport(row, column)` for `meanDamage` and `medianDamage`, plus the two multipliers. `turnsToKill` for a column is `ceil(unit.hp / bestMean)` over that column's cells, or `Infinity` when every mean is 0. Enemy combatants use uptie 4, the unit's level, sanity 0, no status, no manual.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { enemyCombatant, matchupGrid, primaryAttackSkill } from '../src/matchup'
import { makeCombatant, makeSkill, makeUnit } from './fixtures'

describe('primaryAttackSkill', () => {
  it('picks the highest attack weight attack skill, first on ties', () => {
    const u = makeUnit({ skills: [
      makeSkill({ id: 'guard', damageType: 'guard', attackWeight: 9 }),
      makeSkill({ id: 's1', attackWeight: 1 }),
      makeSkill({ id: 's2', attackWeight: 3 }),
      makeSkill({ id: 's3', attackWeight: 3 }),
    ] })
    expect(primaryAttackSkill(u)?.id).toBe('s2')
  })
  it('returns undefined without attack skills', () => {
    expect(primaryAttackSkill(makeUnit({ skills: [makeSkill({ damageType: 'evade' })] }))).toBeUndefined()
  })
})

describe('enemyCombatant', () => {
  it('uses unit level, uptie 4, zero sanity', () => {
    const u = makeUnit({ kind: 'enemy', level: 60 })
    const c = enemyCombatant(u, u.skills[0])
    expect(c.level).toBe(60)
    expect(c.uptie).toBe(4)
    expect(c.sanity).toBe(0)
  })
})

describe('matchupGrid', () => {
  it('builds rows per attack skill and columns per enemy with turns to kill', () => {
    const me = makeCombatant({ unit: makeUnit({ id: 'me', skills: [
      makeSkill({ id: 'a1', slot: 'skill1' }),
      makeSkill({ id: 'a2', slot: 'skill2', basePower: 30, coinPower: 0, coinCount: 1 }),
      makeSkill({ id: 'def', slot: 'defense', damageType: 'guard' }),
    ] }) })
    const foe = makeUnit({ id: 'foe', kind: 'enemy', level: 60, hp: 90, skills: [makeSkill({ id: 'f1' })] })
    const grid = matchupGrid([me], [foe])
    expect(grid.rows.map(r => r.skillId)).toEqual(['a1', 'a2'])
    expect(grid.columns).toHaveLength(1)
    expect(grid.columns[0].unitId).toBe('foe')
    expect(grid.columns[0].turnsToKill).toBe(3) // 90 / 30
    expect(grid.cells).toHaveLength(2)
    expect(grid.cells[1][0].win).toBe(1)
    expect(grid.cells[1][0].meanDamage).toBe(30)
    expect(grid.cells[0][0].sinMultiplier).toBe(1)
  })
  it('skips enemies without attack skills', () => {
    const me = makeCombatant()
    const grid = matchupGrid([me], [makeUnit({ id: 'x', skills: [makeSkill({ damageType: 'guard' })] })])
    expect(grid.columns).toHaveLength(0)
    expect(grid.cells[0]).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- matchup`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement**

```ts
import { clashReport, damageMultipliers, unopposedReport, type ReportOptions } from './report'
import { resolveCombatant } from './resolveCombatant'
import { EMPTY_MANUAL, type Combatant, type MatchupCell, type MatchupGrid, type Skill, type Unit } from './types'

function isAttack(skill: Skill): boolean {
  return skill.slot !== 'defense' && (skill.damageType === 'slash' || skill.damageType === 'pierce' || skill.damageType === 'blunt')
}

export function primaryAttackSkill(unit: Unit): Skill | undefined {
  let best: Skill | undefined
  for (const s of unit.skills) {
    if (!isAttack(s)) continue
    if (!best || s.attackWeight > best.attackWeight) best = s
  }
  return best
}

export function enemyCombatant(unit: Unit, skill: Skill): Combatant {
  return { unit, skill, uptie: 4, level: unit.level, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } }
}

export function matchupGrid(team: Combatant[], wave: Unit[], options: ReportOptions = {}): MatchupGrid {
  const rowCombatants = team.flatMap(member =>
    member.unit.skills.filter(isAttack).map(skill => ({ ...member, skill })),
  )
  const columnCombatants = wave.flatMap(unit => {
    const skill = primaryAttackSkill(unit)
    return skill ? [enemyCombatant(unit, skill)] : []
  })

  const cells: MatchupCell[][] = rowCombatants.map(row =>
    columnCombatants.map(col => {
      const clash = clashReport(row, col, options)
      const hit = unopposedReport(row, col, options)
      const mult = damageMultipliers(resolveCombatant(row, col), col)
      return {
        attackerSkillId: row.skill.id,
        targetUnitId: col.unit.id,
        targetSkillId: col.skill.id,
        win: clash.win,
        medianDamage: hit.damage.p50,
        meanDamage: hit.damage.mean,
        sinMultiplier: mult.sin,
        damageTypeMultiplier: mult.damageType,
      }
    }),
  )

  const columns = columnCombatants.map((col, j) => {
    const bestMean = Math.max(0, ...cells.map(r => r[j].meanDamage))
    return { unitId: col.unit.id, skillId: col.skill.id, turnsToKill: bestMean > 0 ? Math.ceil(col.unit.hp / bestMean) : Infinity }
  })

  return {
    rows: rowCombatants.map(r => ({ unitId: r.unit.id, skillId: r.skill.id })),
    columns,
    cells,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- matchup`
Expected: 5 passed.

- [ ] **Step 5: Export, run the whole suite, commit**

Add `export * from './matchup'` to `src/index.ts`.

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all engine tests pass (100 legacy plus the new files).

```bash
git add packages/engine
git commit -m "Add matchupGrid for Railway planner queries

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

### Task 9: Engine README

**Files:**
- Create: `packages/engine/README.md`
- Modify: `README.md`

- [ ] **Step 1: Write packages/engine/README.md**

```markdown
# @limbus/engine

Pure functions for Limbus Company clash and damage math. No I/O, no DOM.

## Entry points

- `resolveCombatant(self, opponent?)`: unit + skill + player-entered state to flat numbers.
- `clashChain(a, b)`: exact win/lose/draw and coins-left distribution for a clash.
- `attackDamageDistribution(params)`: exact total-damage distribution for a one-sided attack.
- `clashReport(a, b)` / `unopposedReport(a, b)`: the above combined, with a modifier breakdown.
- `matchupGrid(team, wave)`: every attack skill on my team against every enemy unit.

## Sources

- Damage formula: https://blog.limbus.wiki/docs/damage_formula/
- Clash and coin mechanics: https://limbuscompany.wiki.gg/wiki/Battles

## Known simplifications (v1)

- Parry bonus uses the expected parry round count, not its distribution.
- The 99-parry-round draw cap is not modeled; only a guaranteed tie yields a draw.
- Stagger mid-attack is on by default; pass `{ staggerMidAttack: false }` to disable.
- Evade skills, guard clashes, multi-target attack weight, and ally-targeted effects are not modeled.
```

- [ ] **Step 2: Link it from the root README**

Change the engine bullet in `README.md` to: ``- `packages/engine`: pure TypeScript probability engine. No I/O. See `packages/engine/README.md`.``

- [ ] **Step 3: Commit**

```bash
git add README.md packages/engine/README.md
git commit -m "Document engine entry points and v1 simplifications

Claude-Session: https://claude.ai/code/session_01FvgGGd6FLsTjHLzoVdP7YV"
```

---

## Self-review notes

- Spec 6.2 guard clash ("attack versus a clashable guard") is not in this plan. It needs the data package to mark guard skills and the UI to expose them, so it is scheduled as an engine addition inside Plan 3.
- Spec 6.4's Web Worker requirement belongs to the web app (Plan 3). The engine stays synchronous.
- Type names used across tasks: `ClashSide`, `ChainResult` (Task 4); `AttackParams`, `DamageSummary` (Task 5, types); `ResolvedCombatant` fields `dynamicAsAttacker`, `dynamicAsTarget`, `coinRollBonus`, `poiseCount`, `critChance` (Task 2, used in Tasks 6 and 7); `damageMultipliers` and `ReportOptions` (Task 7, used in Task 8). Checked consistent.
