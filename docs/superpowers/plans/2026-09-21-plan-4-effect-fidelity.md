# Effect Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The engine applies every parsed skill effect at the moment the game applies it (before the clash, on the clash result, coin by coin, at attack end), models Rupture ticks, reports the statuses each side is left with, and the web app marks each effect line truthfully.

**Architecture:** A new `statusState` module owns status arithmetic (grants, consumption, conditions, stack modifiers, path averaging). `resolveCombatant` becomes a prepare step that builds a working status pair for both sides and sorts every parsed line into flat numbers, standing conditions, per-coin effects, clash-branch grants and attack-end grants. The damage walk carries a per-path copy of the status pair, attacks with the coins that survived the clash, re-evaluates standing conditions before each coin, ticks Rupture on landing, applies the coin's grants, and averages the leftover statuses into the summary. The report applies clash-win and clash-lose grants per branch. The web app gains two effect-mark categories and an "After this skill" block.

**Tech Stack:** TypeScript 7 strict, Vitest 4, npm workspaces (`packages/engine` = `@limbus/engine`, `apps/web` = `@limbus/web`), React 19, Tailwind 4, Zustand 5.

**Spec:** `docs/superpowers/specs/2026-09-21-effect-fidelity-design.md`

## Global Constraints

- No change to `packages/data`, its outputs, or the output gate (spec §2).
- The 166 existing engine tests keep passing; only the `params()` helper in `packages/engine/test/damageDistribution.test.ts` and the status inputs of five tests in that file change shape (they move Poise and Crit Damage Up from loose fields into `status`), never their expected numbers (spec §8).
- A combatant with no parsed coin effects and no statuses yields byte-identical `DamageSummary` numbers to the pre-change engine: mean, percentiles, max, histogram, stagger chances and the sum of the per-coin means (Task 1 pins these with a golden file; it must pass after every later task). Only the placement of per-coin means changes, by design (spec §6: they are indexed by original coin, so a partial clash win fills the highest indices).
- Every rule taken from the wiki or the community guide is cited in a code comment where it is applied (spec §4): Rupture `https://limbuscompany.wiki.gg/wiki/Rupture`; Poise `https://limbuscompany.wiki.gg/wiki/Poise`; status arithmetic `https://limbuscompany.wiki.gg/wiki/Status_Effects` and namu.wiki; standing conditions and lowest-first coin breaks `https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251` (community source, say so).
- Status arithmetic (spec §4): a potency grant adds potency and, if the status was absent, sets count to 1; a count grant adds count and, if the status was absent, sets potency to 1; both clamp to [0, 99]; grants never remove a status; consumption (Rupture tick, Poise crit) decrements count and removes the status at 0.
- Standing conditions (spec §4, §5): untagged conditional flat-number lines are evaluated against the working status after all pre-clash grants, and again before every coin. Same-trigger grants accumulate in any order; conditional grants are evaluated together against the state after every unconditional grant.
- Surviving coins (spec §5.3): every Unbreakable coin plus the highest-indexed breakable coins; a broken coin contributes neither its roll nor its effects; reports index by original coin.
- Rupture tick (spec §5.3.3): fixed damage equal to potency, unscaled by any modifier, counted toward totals, per-coin means and stagger lines; count −1.
- Naming in this plan is binding: `StatusState`, `SidePair`, `StatusAfter`, `grant`, `consume`, `conditionHolds`, `stackModifiers`, `critChanceOf`, `averagePairs`, `mixStatusAfter`, `survivingCoins`, `flat`, `conditionalBonuses`, `coinEffects`, `grants`, `statusAfterPrepare`, `unbreakableCoinIndices`, `effectsPerCoin`, `effectsPending`, `attackEndGrants`, `statusAfter`, `winBranch`.
- Commit messages end with `Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t`.

## File structure

| File | Responsibility |
|---|---|
| `packages/engine/test/golden.test.ts`, `packages/engine/test/golden/reports.json` | Pre-change report numbers on effect-free fixtures; the regression net. |
| `packages/engine/src/statusState.ts` | Status arithmetic: clone, grant, consume, conditions, stack modifiers, crit chance, path averaging, mixing. |
| `packages/engine/src/statusEffects.ts` | Registry gains `poise` (slot `poise`); `rupture` moves to slot `ailment-rupture`. |
| `packages/engine/src/types.ts` | `StatusState`, `SidePair`, `StatusAfter`; `ResolvedCombatant` and `DamageSummary` gain their new fields. |
| `packages/engine/src/resolveCombatant.ts` | Prepare: working status pair, line sorting, prepare-time totals. |
| `packages/engine/src/damageDistribution.ts` | The stateful walk, `survivingCoins`, sampler, mixing. |
| `packages/engine/src/report.ts` | Builds `AttackParams` from the prepare output; clash-win/lose grants per branch. |
| `packages/engine/README.md` | Rules, citations, community-source flags. |
| `apps/web/src/lib/effectStatus.ts`, `apps/web/src/components/EffectList.tsx`, `apps/web/src/components/CombatantCard.tsx` | Effect marks with the new categories. |
| `apps/web/src/lib/statusAfter.ts`, `apps/web/src/components/VerdictPanel.tsx`, `apps/web/src/components/RollOnce.tsx`, `apps/web/src/components/StatusEditor.tsx` | "After this skill" block, per-coin Rupture and grants, registry-driven status options. |

## Rulings

The spec leaves these open; this plan decides them, and executors follow them:

- A coin's contribution to accumulated heads power is the Coin Power in force when that coin flipped; a bonus that switches on at coin 2 does not rewrite coin 1's contribution. With constant Coin Power this equals `coinPower × heads`, so it is regression-neutral.
- A coin whose roll a guard fully absorbed still lands: its hit-trigger effects fire and Rupture ticks.
- `effectsPending` holds clash-win, clash-lose and attack-end lines only. A pre-clash grant of an inert status (Charge, Bleed, …) is applied to the working status and shown in "After this skill", so it is marked applied, not pending. This narrows the spec's §6 wording, which put inert grants under pending; applied is the truthful mark because the status does change.
- Skill-level `on-crit` `damagePercent` lines (the parser's crit-only damage, 5 in the data) and per-coin `on-crit` lines apply on the crit branch of each coin. Skill-level hit-trigger grants (1 in the data) are copied onto every coin.
- Clash-win flat ops (`[Clash Win] +20% damage`, 6 lines) join the winner's per-coin bonuses on the win branch. Clash-lose flat ops (9 lines) change a skill that never attacks; they are listed as pending and not applied.
- Conditional `clashPower` lines are evaluated once at prepare (the clash is decided before any coin lands).
- `critChance` on `ResolvedCombatant` keeps its existing definition (potency × 5%, ignoring count) for the breakdown; the walk gates on count via `critChanceOf`.
- `AttackParams` loses `critChance`, `poiseCount`, `coinRollBonus` and `critOnlyModifier` (all derived from `status` per coin) and gains `coinCount` and `attackEndGrants` in addition to the spec's fields.

---

### Task 1: Golden regression fixture

**Files:**
- Create: `packages/engine/test/golden.test.ts`
- Create: `packages/engine/test/golden/reports.json` (generated)

**Interfaces:**
- Consumes: `clashReport`, `unopposedReport` from `packages/engine/src/report.ts` (pre-change).
- Produces: a test every later task must keep green.

- [ ] **Step 1: Write the golden test with a write mode**

```ts
// packages/engine/test/golden.test.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { clashReport, unopposedReport } from '../src/report'
import type { ClashReport, DamageSummary, UnopposedReport } from '../src/types'
import { makeCombatant, makeSkill, makeUnit } from './fixtures'

const GOLDEN = fileURLToPath(new URL('./golden/reports.json', import.meta.url))
const flatSin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }

/** Effect-free, status-free combatants that exercise every pre-change code path. */
const cases = {
  chain: () => [
    makeCombatant({ sanity: 20, skill: makeSkill({ basePower: 4, coinPower: 3, coinCount: 2 }) }),
    makeCombatant({ sanity: -10, unit: makeUnit({ id: 'b', hp: 120, staggerThresholds: [0.7, 0.4], skills: [makeSkill({ basePower: 3, coinPower: 4, coinCount: 3 })] }) }),
  ],
  unbreakable: () => [
    makeCombatant({ skill: makeSkill({ coinCount: 3, unbreakableCoins: [0] }) }),
    makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ coinCount: 2 })] }) }),
  ],
  guard: () => [
    makeCombatant({ skill: makeSkill({ basePower: 5, coinPower: 3, coinCount: 2 }) }),
    makeCombatant({ unit: makeUnit({ id: 'g', skills: [makeSkill({ damageType: 'guard', basePower: 6, coinPower: 2, coinCount: 1 })] }) }),
  ],
  resist: () => [
    makeCombatant({ level: 50, skill: makeSkill({ sin: 'wrath', damageType: 'slash', coinCount: 2 }) }),
    makeCombatant({ level: 40, unit: makeUnit({ id: 'r', resistances: { damageType: { slash: 2, pierce: 1, blunt: 1 }, sin: { ...flatSin, wrath: 0.5 } }, skills: [makeSkill({ coinCount: 2 })] }) }),
  ],
  lowhp: () => [
    makeCombatant({ skill: makeSkill({ coinCount: 3 }) }),
    makeCombatant({ currentHp: 30, unit: makeUnit({ id: 'l', hp: 100, staggerThresholds: [0.7, 0.4], skills: [makeSkill({ coinCount: 1 })] }) }),
  ],
} as const

/** Per-coin means move to original coin indices in Plan 4, so only their sum is pinned. */
function pickSummary(s: DamageSummary) {
  const { mean, p10, p50, p90, max, perCoinMean, histogram, staggerChance } = s
  return { mean, p10, p50, p90, max, perCoinTotal: perCoinMean.reduce((x, y) => x + y, 0), histogram, staggerChance }
}
function pickClash(r: ClashReport) {
  const { win, lose, draw, coinsLeftIfWin, coinsLeftIfLose, parryRoundsExpected, breakdown } = r
  return { win, lose, draw, coinsLeftIfWin, coinsLeftIfLose, parryRoundsExpected, breakdown, damageDealt: pickSummary(r.damageDealt), damageTaken: pickSummary(r.damageTaken) }
}
function pickUnopposed(r: UnopposedReport) {
  return { breakdown: r.breakdown, damage: pickSummary(r.damage) }
}

function compute() {
  const out: Record<string, unknown> = {}
  for (const [name, make] of Object.entries(cases)) {
    const [a, b] = make()
    out[`${name}:clash`] = pickClash(clashReport(a, b))
    out[`${name}:unopposed`] = pickUnopposed(unopposedReport(a, b))
  }
  return JSON.parse(JSON.stringify(out)) as Record<string, unknown>
}

describe('golden reports', () => {
  it('match the pre-change engine on effect-free fixtures', () => {
    const actual = compute()
    if (process.env.GOLDEN_WRITE) {
      mkdirSync(fileURLToPath(new URL('./golden/', import.meta.url)), { recursive: true })
      writeFileSync(GOLDEN, JSON.stringify(actual, null, 2) + '\n')
    }
    expect(existsSync(GOLDEN)).toBe(true)
    const expected = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Record<string, unknown>
    expect(actual).toEqual(expected)
  })
})
```

- [ ] **Step 2: Run it to see it fail (no golden file yet)**

Run: `cd packages/engine && npx vitest run test/golden.test.ts`
Expected: FAIL on `expect(existsSync(GOLDEN)).toBe(true)`.

- [ ] **Step 3: Generate the golden file from the unchanged engine**

Run: `cd packages/engine && GOLDEN_WRITE=1 npx vitest run test/golden.test.ts`
Expected: PASS, and `packages/engine/test/golden/reports.json` exists with ten keys (`chain:clash`, `chain:unopposed`, …).

- [ ] **Step 4: Run it again without the flag**

Run: `cd packages/engine && npx vitest run test/golden.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/test/golden.test.ts packages/engine/test/golden/reports.json
git commit -m "Pin pre-change report numbers on effect-free fixtures

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 2: Status state module and registry entries

**Files:**
- Create: `packages/engine/src/statusState.ts`
- Create: `packages/engine/test/statusState.test.ts`
- Modify: `packages/engine/src/types.ts` (add three types after `StatusValue`)
- Modify: `packages/engine/src/statusEffects.ts` (`EffectSlot` union, registry entries)
- Modify: `packages/engine/src/index.ts` (export the new module)

**Interfaces:**
- Consumes: `calculateDynamicModifier`, `getEffectById`, `isEffectApplicable`, `sumCoinPowerBonus`, `sumCoinRollBonus`, `AttackShape`, `EffectStack` from `statusEffects.ts`; `Condition`, `Operation`, `StatusValue` from `types.ts`.
- Produces (used by Tasks 3 to 5):

```ts
export type StatusState = Record<string, StatusValue>            // in types.ts
export interface SidePair { self: StatusState; target: StatusState } // in types.ts
export interface StatusAfter { self: StatusState; target: StatusState; varies: string[] } // in types.ts
export type Owner = 'self' | 'target'
export type GrantOp = Extract<Operation, { kind: 'applyStatus' }>
export const MAX_STATUS = 99
export function cloneState(s: StatusState): StatusState
export function clonePair(p: SidePair): SidePair
export function other(o: Owner): Owner
export function grant(pair: SidePair, op: GrantOp, owner: Owner): void
export function consume(state: StatusState, id: string): void
export function conditionHolds(c: Condition, pair: SidePair, owner: Owner): boolean
export interface StackModifiers { coinRollBonus: number; coinPowerBonus: number; attackerDynamic: number; targetDynamic: number; critOnly: number }
export function stackModifiers(pair: SidePair, attack?: AttackShape): StackModifiers
export function critChanceOf(state: StatusState): number
export function averagePairs(paths: { pair: SidePair; prob: number }[]): StatusAfter
export function mixStatusAfter(parts: { weight: number; after: StatusAfter }[]): StatusAfter
```

- [ ] **Step 1: Add the shared types**

In `packages/engine/src/types.ts`, directly after `export interface StatusValue { potency: number; count: number }`:

```ts
/** Every status on one side, keyed by registry id (or the raw id the scraper emitted). */
export type StatusState = Record<string, StatusValue>

/** Working statuses of the two sides of one attack or one prepare: `self` is the side whose lines are being applied. */
export interface SidePair { self: StatusState; target: StatusState }

/**
 * Expected leftover statuses after an attack, weighted like the histogram. `varies` lists
 * `"self:<id>"` / `"target:<id>"` entries whose value differs between paths; an id absent on
 * some paths counts as potency 0, count 0 on those paths.
 */
export interface StatusAfter { self: StatusState; target: StatusState; varies: string[] }
```

- [ ] **Step 2: Write the failing tests**

```ts
// packages/engine/test/statusState.test.ts
import { describe, expect, it } from 'vitest'
import { averagePairs, conditionHolds, consume, critChanceOf, grant, mixStatusAfter, stackModifiers } from '../src/statusState'
import type { SidePair, StatusState } from '../src/types'

const pair = (self: StatusState = {}, target: StatusState = {}): SidePair => ({ self: { ...self }, target: { ...target } })

describe('grant', () => {
  it('a potency grant to an absent status sets count 1', () => {
    const p = pair()
    grant(p, { kind: 'applyStatus', target: 'target', status: 'rupture', potency: 3 }, 'self')
    expect(p.target.rupture).toEqual({ potency: 3, count: 1 })
    expect(p.self).toEqual({})
  })
  it('a count grant to an absent status sets potency 1', () => {
    const p = pair()
    grant(p, { kind: 'applyStatus', target: 'self', status: 'poise', count: 2 }, 'self')
    expect(p.self.poise).toEqual({ potency: 1, count: 2 })
  })
  it('adds to a present status and clamps at 99', () => {
    const p = pair({ bleed: { potency: 95, count: 1 } })
    grant(p, { kind: 'applyStatus', target: 'self', status: 'bleed', potency: 10 }, 'self')
    grant(p, { kind: 'applyStatus', target: 'self', status: 'bleed', count: 200 }, 'self')
    expect(p.self.bleed).toEqual({ potency: 99, count: 99 })
  })
  it('routes by owner: the opponent\'s "target" grant lands on self', () => {
    const p = pair()
    grant(p, { kind: 'applyStatus', target: 'target', status: 'fragile', potency: 2 }, 'target')
    expect(p.self.fragile).toEqual({ potency: 2, count: 1 })
  })
  it('never removes: a count grant onto a zero-count status keeps its potency', () => {
    const p = pair({ poise: { potency: 20, count: 0 } })
    grant(p, { kind: 'applyStatus', target: 'self', status: 'poise', count: 2 }, 'self')
    expect(p.self.poise).toEqual({ potency: 20, count: 2 })
  })
})

describe('consume', () => {
  it('decrements count and removes the status at 0', () => {
    const s: StatusState = { rupture: { potency: 5, count: 2 } }
    consume(s, 'rupture')
    expect(s.rupture).toEqual({ potency: 5, count: 1 })
    consume(s, 'rupture')
    expect(s.rupture).toBeUndefined()
  })
  it('ignores an absent status', () => {
    const s: StatusState = {}
    consume(s, 'poise')
    expect(s).toEqual({})
  })
})

describe('conditionHolds', () => {
  const c = { stat: 'poise', side: 'self' as const, field: 'potency' as const, op: '>=' as const, value: 5 }
  it('reads the owner side for "self" and the other side for "target"', () => {
    expect(conditionHolds(c, pair({ poise: { potency: 5, count: 1 } }), 'self')).toBe(true)
    expect(conditionHolds(c, pair({}, { poise: { potency: 5, count: 1 } }), 'target')).toBe(true)
    expect(conditionHolds(c, pair({}, { poise: { potency: 5, count: 1 } }), 'self')).toBe(false)
  })
  it('treats an absent status as 0 and supports every operator', () => {
    const at = (op: '>=' | '>' | '<=' | '<' | '==', value: number) => conditionHolds({ ...c, op, value }, pair({ poise: { potency: 4, count: 1 } }), 'self')
    expect(at('>', 3)).toBe(true)
    expect(at('<=', 4)).toBe(true)
    expect(at('<', 4)).toBe(false)
    expect(at('==', 4)).toBe(true)
    expect(conditionHolds({ ...c, op: '<=', value: 0 }, pair(), 'self')).toBe(true)
  })
})

describe('stackModifiers', () => {
  it('splits attacker and target contributions and applies scoped gating', () => {
    const p = pair(
      { 'damage-up': { potency: 1, count: 0 }, 'power-up': { potency: 2, count: 0 }, 'coin-boost': { potency: 1, count: 0 }, 'crit-damage-up': { potency: 2, count: 0 }, 'power-up-pride': { potency: 1, count: 0 } },
      { fragile: { potency: 2, count: 0 }, 'fragile-slash': { potency: 3, count: 0 } },
    )
    const m = stackModifiers(p, { damageType: 'blunt', sin: 'wrath' })
    expect(m.attackerDynamic).toBeCloseTo(0.1)
    expect(m.targetDynamic).toBeCloseTo(0.2)
    expect(m.coinRollBonus).toBe(2)
    expect(m.coinPowerBonus).toBe(1)
    expect(m.critOnly).toBeCloseTo(0.2)
    const slash = stackModifiers(p, { damageType: 'slash', sin: 'pride' })
    expect(slash.targetDynamic).toBeCloseTo(0.5)
    expect(slash.coinRollBonus).toBe(3)
  })
  it('counts every scoped variant with no attack known', () => {
    expect(stackModifiers(pair({}, { 'fragile-slash': { potency: 3, count: 0 } })).targetDynamic).toBeCloseTo(0.3)
  })
})

describe('critChanceOf', () => {
  it('is potency x 5% while count is positive, capped at 1', () => {
    expect(critChanceOf({ poise: { potency: 6, count: 2 } })).toBeCloseTo(0.3)
    expect(critChanceOf({ poise: { potency: 40, count: 1 } })).toBe(1)
    expect(critChanceOf({ poise: { potency: 20, count: 0 } })).toBe(0)
    expect(critChanceOf({})).toBe(0)
  })
})

describe('averagePairs', () => {
  it('weights values by probability, treats absence as 0 and flags ids that vary', () => {
    const a = averagePairs([
      { pair: pair({ poise: { potency: 1, count: 1 } }, { rupture: { potency: 3, count: 1 } }), prob: 0.25 },
      { pair: pair({}, { rupture: { potency: 3, count: 1 } }), prob: 0.75 },
    ])
    expect(a.self.poise).toEqual({ potency: 0.25, count: 0.25 })
    expect(a.target.rupture).toEqual({ potency: 3, count: 1 })
    expect(a.varies).toEqual(['self:poise'])
  })
  it('normalizes by total mass and returns empty sides for no paths', () => {
    const a = averagePairs([{ pair: pair({ charge: { potency: 2, count: 4 } }), prob: 0.5 }])
    expect(a.self.charge).toEqual({ potency: 2, count: 4 })
    expect(averagePairs([])).toEqual({ self: {}, target: {}, varies: [] })
  })
})

describe('mixStatusAfter', () => {
  it('averages parts by weight and flags ids whose expectation differs between parts', () => {
    const m = mixStatusAfter([
      { weight: 0.5, after: { self: { poise: { potency: 2, count: 2 } }, target: {}, varies: [] } },
      { weight: 0.5, after: { self: { poise: { potency: 4, count: 2 } }, target: { bleed: { potency: 1, count: 1 } }, varies: ['target:bleed'] } },
    ])
    expect(m.self.poise).toEqual({ potency: 3, count: 2 })
    expect(m.target.bleed).toEqual({ potency: 0.5, count: 0.5 })
    expect(m.varies.sort()).toEqual(['self:poise', 'target:bleed'])
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd packages/engine && npx vitest run test/statusState.test.ts`
Expected: FAIL, module `../src/statusState` not found.

- [ ] **Step 4: Write the module**

```ts
// packages/engine/src/statusState.ts
import { calculateDynamicModifier, getEffectById, isEffectApplicable, sumCoinPowerBonus, sumCoinRollBonus, type AttackShape, type EffectStack } from './statusEffects'
import type { Condition, Operation, SidePair, StatusAfter, StatusState } from './types'

export type Owner = 'self' | 'target'
export type GrantOp = Extract<Operation, { kind: 'applyStatus' }>

/** Every two-value status caps at 99 potency and 99 count (https://limbuscompany.wiki.gg/wiki/Status_Effects). */
export const MAX_STATUS = 99
/** Registry slot whose stacks belong to the side being hit (Fragile/Protection and their typed variants). */
const TARGET_SIDE_SLOT = 'dynamic-additive-fragile-protection'

export function cloneState(s: StatusState): StatusState {
  const out: StatusState = {}
  for (const [id, v] of Object.entries(s)) out[id] = { potency: v.potency, count: v.count }
  return out
}

export function clonePair(p: SidePair): SidePair {
  return { self: cloneState(p.self), target: cloneState(p.target) }
}

export function other(o: Owner): Owner {
  return o === 'self' ? 'target' : 'self'
}

const clamp = (n: number): number => Math.min(MAX_STATUS, Math.max(0, n))

/**
 * Apply one status grant. `owner` is the side whose line this is; `op.target` is relative to it.
 * Granting potency to an absent status gives it count 1, granting count gives it potency 1
 * (namu.wiki/w/Limbus Company/키워드: "아무것도 없을 때 부여를 하면 횟수 1, 횟수 증가를 하면 위력 1로
 * 적용된다"). Values clamp to [0, 99]. A grant never removes a status: only consumption does.
 */
export function grant(pair: SidePair, op: GrantOp, owner: Owner): void {
  const state = pair[op.target === 'self' ? owner : other(owner)]
  const cur = state[op.status]
  if (!cur) {
    state[op.status] = { potency: clamp(op.potency ?? 1), count: clamp(op.count ?? 1) }
    return
  }
  if (op.potency !== undefined) cur.potency = clamp(cur.potency + op.potency)
  if (op.count !== undefined) cur.count = clamp(cur.count + op.count)
}

/** One use of a counted status: count −1, and the status disappears when its count reaches 0. */
export function consume(state: StatusState, id: string): void {
  const cur = state[id]
  if (!cur) return
  cur.count -= 1
  if (cur.count <= 0) delete state[id]
}

/** A condition on the owner's line, read against the working pair. An absent status reads as 0. */
export function conditionHolds(c: Condition, pair: SidePair, owner: Owner): boolean {
  const actual = pair[c.side === 'self' ? owner : other(owner)][c.stat]?.[c.field] ?? 0
  switch (c.op) {
    case '>=': return actual >= c.value
    case '>': return actual > c.value
    case '<=': return actual <= c.value
    case '<': return actual < c.value
    case '==': return actual === c.value
  }
}

export interface StackModifiers {
  /** Power Up family: added to every coin roll. */
  coinRollBonus: number
  /** Coin Boost / Coin Drop: added to Coin Power itself. */
  coinPowerBonus: number
  /** Damage Up/Down on the attacker (`pair.self`). */
  attackerDynamic: number
  /** Fragile/Protection on the target (`pair.target`). */
  targetDynamic: number
  /** Crit Damage Up on the attacker: added on top of `attackerDynamic` on a critical hit. */
  critOnly: number
}

/**
 * What the registry stacks of both sides contribute to the attacker's (`pair.self`) coins against
 * the target (`pair.target`). Bucketed by registry slot: every Fragile/Protection variant belongs
 * to the side being hit; ids missing from the registry fall to the attacker side and contribute 0.
 * Scoped variants (Fragile (Slash), Damage Up (Pride), ...) only count for a matching attack; with
 * no attack known every variant counts. The [-1, 1] clamps inside calculateDynamicModifier apply
 * per side, never to the pooled sum.
 */
export function stackModifiers(pair: SidePair, attack?: AttackShape): StackModifiers {
  const toStacks = (s: StatusState): EffectStack[] => Object.entries(s).map(([effectId, v]) => ({ effectId, stacks: v.potency }))
  const attackerStacks = toStacks(pair.self).filter(s => getEffectById(s.effectId)?.slot !== TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, attack))
  const targetStacks = toStacks(pair.target).filter(s => getEffectById(s.effectId)?.slot === TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, attack))
  const attackerDynamic = calculateDynamicModifier(attackerStacks, false)
  return {
    coinRollBonus: sumCoinRollBonus(attackerStacks),
    coinPowerBonus: sumCoinPowerBonus(attackerStacks),
    attackerDynamic,
    targetDynamic: calculateDynamicModifier(targetStacks, false),
    critOnly: calculateDynamicModifier(attackerStacks, true) - attackerDynamic,
  }
}

/** Poise: crit chance = potency × 5% while count > 0, capped at 100% (https://limbuscompany.wiki.gg/wiki/Poise). */
export function critChanceOf(state: StatusState): number {
  const p = state.poise
  return p && p.count > 0 ? Math.min(1, p.potency * 0.05) : 0
}

interface Acc { potency: number; count: number; seen: Set<string> }

function accumulate(acc: Map<string, Acc>, state: StatusState, ids: Set<string>, prob: number): void {
  for (const id of ids) {
    const v = state[id]
    const a = acc.get(id) ?? { potency: 0, count: 0, seen: new Set<string>() }
    a.potency += (v?.potency ?? 0) * prob
    a.count += (v?.count ?? 0) * prob
    a.seen.add(v ? `${v.potency},${v.count}` : 'absent')
    acc.set(id, a)
  }
}

function finish(acc: Map<string, Acc>, mass: number, side: Owner, varies: string[]): StatusState {
  const out: StatusState = {}
  for (const [id, a] of acc) {
    out[id] = { potency: a.potency / mass, count: a.count / mass }
    if (a.seen.size > 1) varies.push(`${side}:${id}`)
  }
  return out
}

/** Expected statuses over enumerated paths, weighted by `prob` and normalized by their total mass. */
export function averagePairs(paths: { pair: SidePair; prob: number }[]): StatusAfter {
  const live = paths.filter(p => p.prob > 0)
  const mass = live.reduce((s, p) => s + p.prob, 0)
  if (mass <= 0) return { self: {}, target: {}, varies: [] }
  const ids = { self: new Set<string>(), target: new Set<string>() }
  for (const { pair } of live) {
    for (const id of Object.keys(pair.self)) ids.self.add(id)
    for (const id of Object.keys(pair.target)) ids.target.add(id)
  }
  const acc = { self: new Map<string, Acc>(), target: new Map<string, Acc>() }
  for (const { pair, prob } of live) {
    accumulate(acc.self, pair.self, ids.self, prob)
    accumulate(acc.target, pair.target, ids.target, prob)
  }
  const varies: string[] = []
  return { self: finish(acc.self, mass, 'self', varies), target: finish(acc.target, mass, 'target', varies), varies }
}

/** Combine already-averaged leftovers by weight (for mixing over coins-left counts). */
export function mixStatusAfter(parts: { weight: number; after: StatusAfter }[]): StatusAfter {
  const live = parts.filter(p => p.weight > 0)
  const mass = live.reduce((s, p) => s + p.weight, 0)
  if (mass <= 0) return { self: {}, target: {}, varies: [] }
  const varies = new Set<string>()
  const mix = (side: Owner): StatusState => {
    const ids = new Set<string>()
    for (const { after } of live) for (const id of Object.keys(after[side])) ids.add(id)
    const out: StatusState = {}
    for (const id of ids) {
      let potency = 0
      let count = 0
      const seen = new Set<string>()
      for (const { weight, after } of live) {
        const v = after[side][id]
        potency += (v?.potency ?? 0) * weight
        count += (v?.count ?? 0) * weight
        seen.add(v ? `${v.potency},${v.count}` : 'absent')
      }
      out[id] = { potency: potency / mass, count: count / mass }
      if (seen.size > 1) varies.add(`${side}:${id}`)
    }
    return out
  }
  const self = mix('self')
  const target = mix('target')
  for (const { after } of live) for (const v of after.varies) varies.add(v)
  return { self, target, varies: [...varies] }
}
```

- [ ] **Step 5: Add the registry entries**

In `packages/engine/src/statusEffects.ts`:

Extend the `EffectSlot` union (after the `"coin-power-additive"` member, before `"counter"`):

```ts
    /** Poise: crit chance and count consumed per crit; read by the attack walk, not by sumSlot. */
    | "poise"
    /** Rupture: fixed damage on every hit while count lasts; read by the attack walk, not by sumSlot. */
    | "ailment-rupture"
```

Insert as the first entry of `statusEffects`:

```ts
    {
        id: "poise",
        name: "Poise",
        slot: "poise",
        formulaStatus: "verified",
        description:
            "Crit chance = Potency x 5%; each critical hit consumes 1 Count and deals x1.2 damage (https://limbuscompany.wiki.gg/wiki/Poise). " +
            "Read by the attack walk coin by coin; contributes nothing to calculateDynamicModifier.",
    },
```

Replace the existing `rupture` entry with:

```ts
    {
        id: "rupture",
        name: "Rupture",
        slot: "ailment-rupture",
        formulaStatus: "verified",
        description:
            "\"When hit by an attack, take fixed damage by the effect's Potency. Then, reduce its Count by 1.\" (https://limbuscompany.wiki.gg/wiki/Rupture). " +
            "Applied by the attack walk as unscaled fixed damage per landing coin; deliberately kept out of calculateDynamicModifier.",
    },
```

Add to `packages/engine/src/index.ts`, after `export * from './statusEffects'`:

```ts
export * from './statusState'
```

- [ ] **Step 6: Run the new tests and the whole engine suite**

Run: `cd packages/engine && npx vitest run && npm run typecheck`
Expected: statusState tests PASS; all previous tests PASS (the registry change adds entries; `sumSlot` ignores the new slots); typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/statusState.ts packages/engine/test/statusState.test.ts packages/engine/src/types.ts packages/engine/src/statusEffects.ts packages/engine/src/index.ts
git commit -m "Add status state arithmetic and register Poise and Rupture

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 3: Prepare step in resolveCombatant

**Files:**
- Modify: `packages/engine/src/types.ts` (`ResolvedCombatant`)
- Modify: `packages/engine/src/resolveCombatant.ts` (rewrite)
- Modify: `packages/engine/test/resolveCombatant.test.ts` (append tests)

**Interfaces:**
- Consumes: Task 2's `statusState` exports.
- Produces: `ResolvedCombatant` with these new fields (Tasks 4 to 7 read them):

```ts
  effectsPerCoin: string[]
  effectsPending: string[]
  flat: { basePower: number; coinPower: number; damagePercent: number }
  conditionalBonuses: Effect[]
  coinEffects: Effect[][]
  grants: { clashWin: Effect[]; clashLose: Effect[]; attackEnd: Effect[] }
  statusAfterPrepare: SidePair
  unbreakableCoinIndices: number[]
```

Existing fields keep their meaning as prepare-time totals (`coinPower` includes Coin Boost stacks and standing conditions that hold at prepare).

- [ ] **Step 1: Extend the type**

In `packages/engine/src/types.ts`, inside `ResolvedCombatant`, after `effectsUnparsed: string[]`:

```ts
  /** Parsed per-coin lines (and skill-level hit-trigger grants, which act on every coin): applied by the attack walk. */
  effectsPerCoin: string[]
  /** Parsed skill-level lines that act only on the clash result or at attack end. */
  effectsPending: string[]
  /** Skill + uptie + manual + unconditional pre-clash flat ops. Stacks and standing conditions are added per coin by the walk. */
  flat: { basePower: number; coinPower: number; damagePercent: number }
  /** Skill-level flat ops the walk re-evaluates before every coin: conditional lines and crit-only damage lines. */
  conditionalBonuses: Effect[]
  /** Parsed effects by 0-based coin index at the resolved uptie; length = coinCount. */
  coinEffects: Effect[][]
  /** Skill-level lines by the moment they fire; the report applies clashWin/clashLose per branch, the walk applies attackEnd. */
  grants: { clashWin: Effect[]; clashLose: Effect[]; attackEnd: Effect[] }
  /** Working statuses after every pre-clash grant of both sides: `self` is this combatant, `target` the opponent. */
  statusAfterPrepare: SidePair
  /** Distinct in-range 0-based Unbreakable coin indices, ascending. */
  unbreakableCoinIndices: number[]
```

- [ ] **Step 2: Write the failing tests**

Add `import type { Effect } from '../src/types'` at the top of `packages/engine/test/resolveCombatant.test.ts`, then append:

```ts
describe('resolveCombatant prepare', () => {
  const poiseAtLeast5 = { stat: 'poise', side: 'self' as const, field: 'potency' as const, op: '>=' as const, value: 5 }
  const gainPoise = (potency: number): Effect => effect({ kind: 'applyStatus', target: 'self', status: 'poise', potency }, { source: `[On Use] Gain ${potency} Poise` })
  const bonusAtPoise: Effect = effect({ kind: 'coinPower', delta: 1 }, { condition: poiseAtLeast5, source: 'At 5+ Poise, Coin Power +1' })

  it('evaluates standing conditions after on-use grants, whatever the line order', () => {
    for (const effects of [[bonusAtPoise, gainPoise(5)], [gainPoise(5), bonusAtPoise]]) {
      const r = resolveCombatant(makeCombatant({ skill: makeSkill({ effects }) }))
      expect(r.coinPower).toBe(4)
      expect(r.flat.coinPower).toBe(3)
      expect(r.statusAfterPrepare.self.poise).toEqual({ potency: 5, count: 1 })
      expect(r.effectsApplied).toEqual(expect.arrayContaining([bonusAtPoise.source, gainPoise(5).source]))
      expect(r.conditionalBonuses).toEqual([bonusAtPoise])
    }
  })
  it('keeps a standing condition that does not hold in conditionalBonuses but out of the totals and the applied list', () => {
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ effects: [bonusAtPoise, gainPoise(4)] }) }))
    expect(r.coinPower).toBe(3)
    expect(r.conditionalBonuses).toEqual([bonusAtPoise])
    expect(r.effectsApplied).toEqual([gainPoise(4).source])
  })
  it('a count grant before the roll lets an entered zero-count Poise crit', () => {
    const skill = makeSkill({ effects: [effect({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })] })
    const r = resolveCombatant(makeCombatant({ skill, status: { poise: { potency: 20, count: 0 } } }))
    expect(r.poiseCount).toBe(2)
    expect(r.critChance).toBe(1)
    expect(r.statusAfterPrepare.self.poise).toEqual({ potency: 20, count: 2 })
  })
  it('target-directed pre-clash grants land on the opponent from either side of the resolve', () => {
    const inflict = effect({ kind: 'applyStatus', target: 'target', status: 'fragile', potency: 2 })
    const a = makeCombatant({ skill: makeSkill({ effects: [inflict] }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b' }) })
    expect(resolveCombatant(a, b).statusAfterPrepare.target.fragile).toEqual({ potency: 2, count: 1 })
    expect(resolveCombatant(b, a).statusAfterPrepare.self.fragile).toEqual({ potency: 2, count: 1 })
    expect(resolveCombatant(b, a).dynamicAsTarget).toBeCloseTo(0.2)
    expect(resolveCombatant(a, b).dynamicAsTarget).toBe(0)
  })
  it('conditional grants see every unconditional grant but not each other', () => {
    const chargeAtPoise = effect({ kind: 'applyStatus', target: 'self', status: 'charge', count: 1 }, { condition: poiseAtLeast5, source: 'At 5+ Poise gain 1 Charge' })
    const poiseAtCharge = effect({ kind: 'applyStatus', target: 'self', status: 'poise', potency: 5 }, { condition: { stat: 'charge', side: 'self', field: 'count', op: '>=', value: 1 }, source: 'At 1+ Charge gain 5 Poise' })
    const withGrant = resolveCombatant(makeCombatant({ skill: makeSkill({ effects: [chargeAtPoise, gainPoise(5)] }) }))
    expect(withGrant.statusAfterPrepare.self.charge).toEqual({ potency: 1, count: 1 })
    const circular = resolveCombatant(makeCombatant({ skill: makeSkill({ effects: [chargeAtPoise, poiseAtCharge] }) }))
    expect(circular.statusAfterPrepare.self).toEqual({})
  })
  it('a target condition with no opponent is false, even one an absent status would satisfy', () => {
    const cond = { stat: 'rupture', side: 'target' as const, field: 'potency' as const, op: '<=' as const, value: 3 }
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ effects: [effect({ kind: 'coinPower', delta: 1 }, { condition: cond })] }) }))
    expect(r.coinPower).toBe(3)
  })
  it('collects per-coin lines by coin index and lists them as per-coin', () => {
    const c0 = effect({ kind: 'applyStatus', target: 'target', status: 'rupture', potency: 3 }, { trigger: 'on-hit', scope: { coin: 0 }, source: '[On Hit] Inflict 3 Rupture' })
    const c1 = effect({ kind: 'damagePercent', delta: 0.1 }, { scope: { coin: 1 }, source: 'Deal +10% damage' })
    const past = effect({ kind: 'coinPower', delta: 9 }, { scope: { coin: 7 }, source: 'ghost coin' })
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ coinCount: 2, effects: [c0, c1, past] }) }))
    expect(r.coinEffects).toEqual([[c0], [c1]])
    expect(r.effectsPerCoin).toEqual([c0.source, c1.source, past.source])
    expect(r.effectsUnparsed).toEqual([])
    expect(r.coinPower).toBe(3)
  })
  it('copies skill-level hit-trigger grants onto every coin', () => {
    const hit = effect({ kind: 'applyStatus', target: 'target', status: 'bleed', potency: 1 }, { trigger: 'on-hit', source: '[On Hit] Inflict 1 Bleed' })
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ coinCount: 2, effects: [hit] }) }))
    expect(r.coinEffects).toEqual([[hit], [hit]])
    expect(r.effectsPerCoin).toEqual([hit.source])
  })
  it('sorts clash-win, clash-lose and attack-end lines into grants and lists them as pending', () => {
    const win = effect({ kind: 'applyStatus', target: 'self', status: 'poise', potency: 4 }, { trigger: 'clash-win', source: '[Clash Win] Gain 4 Poise' })
    const winDamage = effect({ kind: 'damagePercent', delta: 0.2 }, { trigger: 'clash-win', source: '[Clash Win] +20% damage' })
    const lose = effect({ kind: 'applyStatus', target: 'target', status: 'bind', potency: 1 }, { trigger: 'clash-lose', source: '[Clash Lose] Inflict 1 Bind' })
    const end = effect({ kind: 'applyStatus', target: 'self', status: 'charge', count: 2 }, { trigger: 'attack-end', source: '[Attack End] Gain 2 Charge' })
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ effects: [win, winDamage, lose, end] }) }))
    expect(r.grants).toEqual({ clashWin: [win, winDamage], clashLose: [lose], attackEnd: [end] })
    expect(r.effectsPending).toEqual([win.source, winDamage.source, lose.source, end.source])
    expect(r.effectsApplied).toEqual([])
    expect(r.damagePercent).toBe(0)
    expect(r.statusAfterPrepare.self).toEqual({})
  })
  it('routes crit-only skill damage into conditionalBonuses and the per-coin list, not the totals', () => {
    const critDamage = effect({ kind: 'damagePercent', delta: 0.3 }, { trigger: 'on-crit', source: '+30% damage on crit' })
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ effects: [critDamage] }) }))
    expect(r.conditionalBonuses).toEqual([critDamage])
    expect(r.effectsPerCoin).toEqual([critDamage.source])
    expect(r.damagePercent).toBe(0)
  })
  it('flat excludes stacks that the totals include', () => {
    const r = resolveCombatant(makeCombatant({ status: { 'coin-boost': { potency: 1, count: 0 }, 'power-up': { potency: 2, count: 0 } } }))
    expect(r.flat).toEqual({ basePower: 4, coinPower: 3, damagePercent: 0 })
    expect(r.coinPower).toBe(4)
    expect(r.coinRollBonus).toBe(2)
  })
  it('lists unbreakable coin indices distinct, in range and ascending', () => {
    const r = resolveCombatant(makeCombatant({ skill: makeSkill({ coinCount: 3, unbreakableCoins: [2, 0, 0, 9, -1] }) }))
    expect(r.unbreakableCoinIndices).toEqual([0, 2])
    expect(r.unbreakableCoins).toBe(2)
  })
  it('a combatant without a skill still prepares its statuses and takes the opponent\'s grants', () => {
    const inflict = effect({ kind: 'applyStatus', target: 'target', status: 'fragile', potency: 1 })
    const part = makeCombatant({ skill: undefined, status: { protection: { potency: 1, count: 0 } } })
    const foe = makeCombatant({ unit: makeUnit({ id: 'f' }), skill: makeSkill({ effects: [inflict] }) })
    const r = resolveCombatant(part, foe)
    expect(r.statusAfterPrepare.self).toEqual({ protection: { potency: 1, count: 0 }, fragile: { potency: 1, count: 1 } })
    expect(r.coinEffects).toEqual([])
    expect(r.dynamicAsTarget).toBeCloseTo(0)
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cd packages/engine && npx vitest run test/resolveCombatant.test.ts`
Expected: FAIL (new fields undefined).

- [ ] **Step 4: Rewrite resolveCombatant**

Replace the whole of `packages/engine/src/resolveCombatant.ts` with:

```ts
import { clonePair, conditionHolds, grant, stackModifiers, type GrantOp, type Owner } from './statusState'
import type { Combatant, Condition, Effect, EffectTrigger, ResolvedCombatant, SidePair, Skill, UptieTier } from './types'

/** Triggers that fire before the clash. Their grants land on the working status at prepare. */
const PRE_CLASH = new Set<EffectTrigger>(['on-use', 'combat-start', 'passive'])
/** Per-coin triggers. A skill-level grant with one of these acts on every coin. */
const HIT = new Set<EffectTrigger>(['on-hit', 'heads-hit', 'tails-hit', 'on-crit'])

type FlatOp = Extract<Effect['op'], { kind: 'coinPower' | 'basePower' | 'clashPower' | 'damagePercent' }>
type GrantLine = Effect & { op: GrantOp }
type FlatLine = Effect & { op: FlatOp }
const isGrant = (e: Effect): e is GrantLine => e.op.kind === 'applyStatus'
const isFlat = (e: Effect): e is FlatLine =>
  e.op.kind === 'coinPower' || e.op.kind === 'basePower' || e.op.kind === 'clashPower' || e.op.kind === 'damagePercent'

function ownLines(c: Combatant, skill: Skill | undefined): Effect[] {
  return [...(skill?.effects ?? []), ...c.unit.passives.flatMap(p => p.effects)]
}

/**
 * Prepare one side for a clash: apply every pre-clash grant of both sides to a working status
 * pair, then read this side's flat numbers off it. Untagged conditional lines are standing
 * conditions: they are evaluated against the status after those grants, not in text order
 * ("Skill Effect Order Clarification" in the community guide
 * https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251, not the wiki), and the
 * attack walk re-evaluates them before every coin.
 */
export function resolveCombatant(self: Combatant, opponent?: Combatant): ResolvedCombatant {
  const skill = self.skill ? applyUptie(self.skill, self.uptie) : undefined
  const oppSkill = opponent?.skill ? applyUptie(opponent.skill, opponent.uptie) : undefined
  const mine = ownLines(self, skill)
  const theirs = opponent ? ownLines(opponent, oppSkill) : []
  const pair: SidePair = clonePair({ self: self.status, target: opponent?.status ?? {} })
  const coinCount = skill?.coinCount ?? 0

  const effectsApplied: string[] = []
  const effectsUnparsed: string[] = []
  const effectsPerCoin: string[] = []
  const effectsPending: string[] = []
  const conditionalBonuses: Effect[] = []
  const coinEffects: Effect[][] = Array.from({ length: coinCount }, () => [])
  const grants: ResolvedCombatant['grants'] = { clashWin: [], clashLose: [], attackEnd: [] }
  const flat = {
    basePower: (skill?.basePower ?? 0) + self.manual.basePower,
    coinPower: (skill?.coinPower ?? 0) + self.manual.coinPower,
    damagePercent: self.manual.damagePercent,
  }
  let clashPowerBonus = self.manual.clashPower

  // Target-side conditions are false with no opponent, even ones an absent status would satisfy.
  const holds = (c: Condition, owner: Owner): boolean => (c.side === 'target' && !opponent ? false : conditionHolds(c, pair, owner))

  const addFlat = (op: FlatOp, into: { basePower: number; coinPower: number; damagePercent: number }): void => {
    switch (op.kind) {
      case 'coinPower': into.coinPower += op.delta; break
      case 'basePower': into.basePower += op.delta; break
      case 'clashPower': clashPowerBonus += op.delta; break
      case 'damagePercent': into.damagePercent += op.delta; break
    }
  }

  const preGrants: GrantLine[] = []
  const standing: FlatLine[] = []
  for (const e of mine) {
    if (e.op.kind === 'unparsed') { effectsUnparsed.push(e.source); continue }
    if (e.scope !== 'skill') {
      if (e.scope.coin < coinCount) coinEffects[e.scope.coin].push(e)
      effectsPerCoin.push(e.source)
      continue
    }
    if (HIT.has(e.trigger) && isGrant(e)) {
      for (const coin of coinEffects) coin.push(e)
      effectsPerCoin.push(e.source)
      continue
    }
    if (e.trigger === 'clash-win') { grants.clashWin.push(e); effectsPending.push(e.source); continue }
    if (e.trigger === 'clash-lose') { grants.clashLose.push(e); effectsPending.push(e.source); continue }
    if (e.trigger === 'attack-end' && isGrant(e)) { grants.attackEnd.push(e); effectsPending.push(e.source); continue }
    if (e.trigger === 'on-crit' && e.op.kind === 'damagePercent') {
      // The parser's crit-only damage: it acts on the crit branch of each coin.
      conditionalBonuses.push(e)
      effectsPerCoin.push(e.source)
      continue
    }
    if (!PRE_CLASH.has(e.trigger)) continue
    if (isGrant(e)) { preGrants.push(e); continue }
    if (!isFlat(e)) continue
    if (e.condition) { standing.push(e); continue }
    addFlat(e.op, flat)
    effectsApplied.push(e.source)
  }

  // Grants accumulate in any order, so unconditional ones of both sides land first. Conditional
  // grants are then judged together against that state: none of them sees another's effect.
  const theirPreGrants = theirs.filter((e): e is GrantLine => e.scope === 'skill' && PRE_CLASH.has(e.trigger) && isGrant(e))
  const conditionalGrants: [GrantLine, Owner][] = []
  const sides: [GrantLine[], Owner][] = [[preGrants, 'self'], [theirPreGrants, 'target']]
  for (const [list, owner] of sides) {
    for (const e of list) {
      if (e.condition) { conditionalGrants.push([e, owner]); continue }
      grant(pair, e.op, owner)
      if (owner === 'self') effectsApplied.push(e.source)
    }
  }
  const decided = conditionalGrants.map(([e, owner]) => [e, owner, holds(e.condition!, owner)] as const)
  for (const [e, owner, ok] of decided) {
    if (!ok) continue
    grant(pair, e.op, owner)
    if (owner === 'self') effectsApplied.push(e.source)
  }

  // Standing conditions at prepare: the clash uses these totals; the walk re-evaluates them per coin.
  const totals = { ...flat }
  for (const e of standing) {
    if (e.op.kind !== 'clashPower') conditionalBonuses.push(e)
    if (!holds(e.condition!, 'self')) continue
    addFlat(e.op, totals)
    effectsApplied.push(e.source)
  }

  const myAttack = skill ? { damageType: skill.damageType, sin: skill.sin } : undefined
  const theirAttack = oppSkill ? { damageType: oppSkill.damageType, sin: oppSkill.sin } : undefined
  const m = stackModifiers(pair, myAttack)
  const asTarget = stackModifiers({ self: pair.target, target: pair.self }, theirAttack).targetDynamic
  const poise = pair.self.poise ?? { potency: 0, count: 0 }
  const sanity = Math.min(45, Math.max(-45, self.sanity))
  const unbreakableCoinIndices = skill ? unbreakableIndices(skill) : []

  return {
    basePower: totals.basePower,
    // Coin Boost / Coin Drop modify Coin Power itself, so they land after effects and manual overrides.
    coinPower: totals.coinPower + m.coinPowerBonus,
    coinCount,
    unbreakableCoins: unbreakableCoinIndices.length,
    headsChance: (50 + sanity) / 100,
    offenseLevel: self.level + (skill?.offenseLevelMod ?? 0),
    defenseLevel: self.level + self.unit.defenseMod,
    clashPowerBonus,
    damagePercent: totals.damagePercent,
    coinRollBonus: m.coinRollBonus,
    critChance: Math.min(1, poise.potency * 0.05),
    poiseCount: poise.count,
    dynamicAsAttacker: m.attackerDynamic,
    critOnlyModifier: m.critOnly,
    dynamicAsTarget: asTarget,
    maxHp: self.unit.hp,
    currentHp: self.currentHp ?? self.unit.hp,
    sin: skill?.sin ?? 'wrath',
    damageType: skill?.damageType ?? 'none',
    effectsApplied,
    effectsUnparsed,
    effectsPerCoin,
    effectsPending,
    flat,
    conditionalBonuses,
    coinEffects,
    grants,
    statusAfterPrepare: pair,
    unbreakableCoinIndices,
  }
}

/**
 * Unbreakable coins are 0-based indices into the skill's coins. Scraped data can repeat an index
 * or point past the last coin, so only distinct in-range integers count - otherwise the clash
 * chain would size its coin pool from indices that name no real coin.
 */
function unbreakableIndices(skill: Skill): number[] {
  const seen = new Set<number>()
  for (const i of skill.unbreakableCoins) {
    if (Number.isInteger(i) && i >= 0 && i < skill.coinCount) seen.add(i)
  }
  return [...seen].sort((x, y) => x - y)
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
```

- [ ] **Step 5: Run the engine suite and typecheck**

Run: `cd packages/engine && npx vitest run && npm run typecheck`
Expected: every test PASS, including `golden.test.ts` and every pre-existing `resolveCombatant` test; typecheck clean. Nothing in `AttackParams` changes in this task, so `report.ts` and `damageDistribution.ts` compile untouched.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/resolveCombatant.ts packages/engine/test/resolveCombatant.test.ts
git commit -m "Prepare combatants: working status pair, standing conditions, per-coin and pending lines

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 4: The stateful attack walk

**Files:**
- Modify: `packages/engine/src/damageDistribution.ts` (rewrite)
- Modify: `packages/engine/src/types.ts` (`DamageSummary.statusAfter`)
- Modify: `packages/engine/src/report.ts` (`attackContext` only, so the package compiles and the golden test still passes)
- Modify: `packages/engine/test/damageDistribution.test.ts` (helper shape, five status inputs, new tests)

**Interfaces:**
- Consumes: Task 2's `statusState`; Task 3's `ResolvedCombatant` fields.
- Produces:

```ts
export interface AttackParams {
  coins: number; coinCount: number; unbreakableCoins: number[]
  basePower: number; coinPower: number; headsChance: number; critModifier: number
  sinResistance: number; damageTypeResistance: number; offenseDefenseAdvantage: number; parryBonus: number
  dynamicModifier: number
  status: SidePair; attackerSkill?: AttackShape
  coinEffects: Effect[][]; conditionalBonuses: Effect[]; attackEndGrants: Effect[]
  defenderMaxHp: number; defenderCurrentHp: number; staggerThresholds: number[]; staggerMidAttack: boolean
  powerReduction?: number
}
export interface SampledCoin { index: number; heads: boolean; crit: boolean; roll: number; damage: number; rupture: number; staggered: boolean; grants: string[] }
export interface SampledAttack { coins: SampledCoin[]; total: number; thresholdsCrossed: number; statusAfter: SidePair }
export function survivingCoins(coinCount: number, coins: number, unbreakable: number[]): number[]
export function attackDamageDistribution(p: AttackParams): DamageSummary   // DamageSummary gains statusAfter: StatusAfter
export function sampleAttack(p: AttackParams, rng?: () => number): SampledAttack
export function mixDistributions(parts: { weight: number; summary: DamageSummary }[]): DamageSummary
```

`perCoinMean` now has length `coinCount` and is indexed by original coin (a coin that broke contributes 0).

- [ ] **Step 1: Extend `DamageSummary`**

In `packages/engine/src/types.ts`, inside `DamageSummary` after `staggerChance: number[]`:

```ts
  /** Expected statuses on both sides after the attack (`self` = attacker, `target` = defender). */
  statusAfter: StatusAfter
```

- [ ] **Step 2: Update the test helper and the five status inputs**

In `packages/engine/test/damageDistribution.test.ts`, replace the imports and the `params` helper with:

```ts
import { describe, expect, it } from 'vitest'
import { attackDamageDistribution, mixDistributions, sampleAttack, survivingCoins, type AttackParams } from '../src/damageDistribution'
import type { Effect, SidePair } from '../src/types'

function params(over: Partial<AttackParams> = {}): AttackParams {
  const coins = over.coins ?? 3
  return {
    coins, coinCount: coins, unbreakableCoins: [], basePower: 4, coinPower: 3, headsChance: 0.5, critModifier: 0.2,
    sinResistance: 0, damageTypeResistance: 0, offenseDefenseAdvantage: 0, parryBonus: 0,
    dynamicModifier: 0, status: { self: {}, target: {} }, coinEffects: [], conditionalBonuses: [], attackEndGrants: [],
    defenderMaxHp: 1000, defenderCurrentHp: 1000, staggerThresholds: [], staggerMidAttack: true, ...over,
  }
}
/** Poise on the attacker: potency 20 is a certain crit. */
const poise = (potency: number, count: number, extra: SidePair['self'] = {}): SidePair => ({ self: { poise: { potency, count }, ...extra }, target: {} })
const grantOn = (coin: number, trigger: Effect['trigger'], target: 'self' | 'target', status: string, value: { potency?: number; count?: number }, source = `${trigger} ${status}`): Effect =>
  ({ trigger, scope: { coin }, op: { kind: 'applyStatus', target, status, ...value }, source })
```

Then change exactly these existing argument lists (expected numbers stay):

- `params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 1 })` → `params({ coins: 1, headsChance: 1, status: poise(20, 1) })`
- `params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 0 })` → `params({ coins: 1, headsChance: 1, status: poise(20, 0) })`
- `params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 1, critOnlyModifier: 0.5 })` → `params({ coins: 1, headsChance: 1, status: poise(20, 1, { 'crit-damage-up': { potency: 5, count: 0 } }) })`
- `params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 0, critOnlyModifier: 0.5 })` → `params({ coins: 1, headsChance: 1, status: poise(20, 0, { 'crit-damage-up': { potency: 5, count: 0 } }) })`
- `params({ coins: 3, critChance: 0.5, poiseCount: 2, critModifier: 0.2 })` → `params({ coins: 3, status: poise(10, 2), critModifier: 0.2 })`

- [ ] **Step 3: Write the failing tests**

Append to `packages/engine/test/damageDistribution.test.ts`:

```ts
describe('survivingCoins', () => {
  it('keeps the highest-indexed breakable coins: breakable coins break lowest first', () => {
    expect(survivingCoins(3, 2, [])).toEqual([1, 2])
    expect(survivingCoins(3, 3, [])).toEqual([0, 1, 2])
    expect(survivingCoins(3, 0, [])).toEqual([])
  })
  it('always keeps Unbreakable coins', () => {
    expect(survivingCoins(3, 2, [0])).toEqual([0, 2])
    expect(survivingCoins(4, 2, [1, 3])).toEqual([1, 3])
    expect(survivingCoins(3, 1, [2, 2, 9])).toEqual([2])
  })
  it('a skill whose coins are all Unbreakable breaks like a breakable one', () => {
    expect(survivingCoins(2, 1, [0, 1])).toEqual([1])
  })
})

describe('the stateful walk', () => {
  it('Poise gained on coin 1 lets coin 2 crit: 7 + (0.95 x 10 + 0.05 x 12)', () => {
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, coinEffects: [[grantOn(0, 'on-hit', 'self', 'poise', { potency: 1 })], []] }))
    expect(d.mean).toBeCloseTo(17.1, 10)
    expect(d.perCoinMean[0]).toBe(7)
    expect(d.perCoinMean[1]).toBeCloseTo(10.1, 10)
    // On the crit path the single Poise count is consumed and the status disappears.
    expect(d.statusAfter.self.poise.potency).toBeCloseTo(0.95, 10)
    expect(d.statusAfter.self.poise.count).toBeCloseTo(0.95, 10)
    expect(d.statusAfter.varies).toEqual(['self:poise'])
  })
  it('a standing condition switches on mid-attack once its status is granted', () => {
    const bonus: Effect = { trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 }, op: { kind: 'coinPower', delta: 1 }, source: 'At 5+ Poise, Coin Power +1' }
    // Coin 1: no Poise, roll 4 + 3 = 7. It grants 5 Poise. Coin 2: bonus on, coin power 4, roll 4 + 3 + 4 = 11; crit 25%: 13.
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, conditionalBonuses: [bonus], coinEffects: [[grantOn(0, 'on-hit', 'self', 'poise', { potency: 5 })], []] }))
    expect(d.mean).toBeCloseTo(7 + 0.75 * 11 + 0.25 * 13, 10)
    // Already satisfied before the attack (Poise 5 entered, count 0 so no crit): both coins get +1: 8 + 12.
    const before = attackDamageDistribution(params({ coins: 2, headsChance: 1, conditionalBonuses: [bonus], status: poise(5, 0) }))
    expect(before.mean).toBe(20)
  })
  it('a per-coin Coin Power op raises only that coin\'s heads contribution', () => {
    const op: Effect = { trigger: 'on-use', scope: { coin: 1 }, op: { kind: 'coinPower', delta: 2 }, source: 'Coin Power +2' }
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, coinEffects: [[], [op]] }))
    expect(d.perCoinMean).toEqual([7, 12])
  })
  it('a broken coin contributes neither roll nor effects; an Unbreakable one survives', () => {
    const rupture = grantOn(0, 'on-hit', 'target', 'rupture', { potency: 3 })
    const broke = attackDamageDistribution(params({ coins: 2, coinCount: 3, headsChance: 1, coinEffects: [[rupture], [], []] }))
    expect(broke.perCoinMean).toEqual([0, 7, 10])
    expect(broke.mean).toBe(17)
    expect(broke.statusAfter.target.rupture).toBeUndefined()
    const kept = attackDamageDistribution(params({ coins: 2, coinCount: 3, headsChance: 1, unbreakableCoins: [0], coinEffects: [[rupture], [], []] }))
    // Coin 1 (index 0) rolls 7 and inflicts Rupture 3; coin 3 rolls 10 and ticks it: 13.
    expect(kept.perCoinMean).toEqual([7, 0, 13])
    expect(kept.mean).toBe(20)
    expect(kept.statusAfter.target.rupture).toBeUndefined()
  })
  it('entered Rupture adds its potency once per hit until its count runs out', () => {
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, status: { self: {}, target: { rupture: { potency: 5, count: 1 } } } }))
    expect(d.perCoinMean).toEqual([12, 10])
    expect(d.statusAfter.target.rupture).toBeUndefined()
  })
  it('Rupture inflicted on coin 1 ticks on coin 2; a count grant keeps it alive', () => {
    const inflict = grantOn(0, 'on-hit', 'target', 'rupture', { potency: 3 })
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, coinEffects: [[inflict], []] }))
    expect(d.perCoinMean).toEqual([7, 13])
    expect(d.statusAfter.target.rupture).toBeUndefined()
    const withCount = attackDamageDistribution(params({ coins: 2, headsChance: 1, coinEffects: [[inflict, grantOn(0, 'on-hit', 'target', 'rupture', { count: 1 })], []] }))
    expect(withCount.statusAfter.target.rupture).toEqual({ potency: 3, count: 1 })
  })
  it('the Rupture tick is unscaled: Fatal doubles the coin, not the tick', () => {
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, damageTypeResistance: 1, status: { self: {}, target: { rupture: { potency: 5, count: 1 } } } }))
    expect(d.mean).toBe(19)
  })
  it('the tick counts toward stagger lines', () => {
    // Line at 20 - 0.7 x 20 = 6. The coin alone deals 4 (tails, roll 4); with Rupture 3 the total 7 crosses.
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 0, defenderMaxHp: 20, defenderCurrentHp: 20, staggerThresholds: [0.7], status: { self: {}, target: { rupture: { potency: 3, count: 1 } } } }))
    expect(d.staggerChance).toEqual([1])
  })
  it('Fragile inflicted mid-attack raises the coins after it', () => {
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, coinEffects: [[grantOn(0, 'on-hit', 'target', 'fragile', { potency: 2 })], []] }))
    expect(d.perCoinMean).toEqual([7, 12])
  })
  it('heads-hit, tails-hit and on-crit grants follow the branch', () => {
    const effects = [[
      grantOn(0, 'heads-hit', 'self', 'charge', { count: 1 }),
      grantOn(0, 'tails-hit', 'self', 'sinking', { potency: 1 }),
      grantOn(0, 'on-crit', 'self', 'tremor', { potency: 1 }),
    ]]
    const d = attackDamageDistribution(params({ coins: 1, coinEffects: effects, status: poise(10, 1) }))
    expect(d.statusAfter.self.charge).toEqual({ potency: 0.5, count: 0.5 })
    expect(d.statusAfter.self.sinking).toEqual({ potency: 0.5, count: 0.5 })
    expect(d.statusAfter.self.tremor).toEqual({ potency: 0.5, count: 0.5 })
    expect(d.statusAfter.varies.sort()).toEqual(['self:charge', 'self:poise', 'self:sinking', 'self:tremor'])
  })
  it('a conditional per-coin grant is judged against the status as the coin lands', () => {
    const gated = grantOn(0, 'on-hit', 'target', 'bleed', { potency: 2 })
    gated.condition = { stat: 'rupture', side: 'target', field: 'potency', op: '>=', value: 1 }
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[gated]] }))
    expect(d.statusAfter.target.bleed).toBeUndefined()
    const met = attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[gated]], status: { self: {}, target: { rupture: { potency: 1, count: 5 } } } }))
    expect(met.statusAfter.target.bleed).toEqual({ potency: 2, count: 1 })
  })
  it('an inert status changes no damage but is reported', () => {
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[grantOn(0, 'on-hit', 'target', 'bleed', { potency: 2 })]] }))
    expect(d.mean).toBe(7)
    expect(d.statusAfter.target.bleed).toEqual({ potency: 2, count: 1 })
    expect(d.statusAfter.varies).toEqual([])
  })
  it('grants clamp at 99', () => {
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[grantOn(0, 'on-hit', 'target', 'bleed', { potency: 10 })]], status: { self: {}, target: { bleed: { potency: 95, count: 1 } } } }))
    expect(d.statusAfter.target.bleed).toEqual({ potency: 99, count: 1 })
  })
  it('attack-end grants land after the last coin and only if a coin attacked', () => {
    const end: Effect = { trigger: 'attack-end', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'poise', potency: 2 }, source: '[Attack End] Gain 2 Poise' }
    expect(attackDamageDistribution(params({ coins: 1, attackEndGrants: [end] })).statusAfter.self.poise).toEqual({ potency: 2, count: 1 })
    expect(attackDamageDistribution(params({ coins: 0, attackEndGrants: [end] })).statusAfter.self.poise).toBeUndefined()
  })
  it('crit-only per-coin damage applies on the crit branch: 7 x 1.2 x 1.5 = 12', () => {
    const critDamage: Effect = { trigger: 'on-crit', scope: { coin: 0 }, op: { kind: 'damagePercent', delta: 0.5 }, source: '+50% on crit' }
    expect(attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[critDamage]], status: poise(20, 1) })).mean).toBe(12)
    expect(attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[critDamage]] })).mean).toBe(7)
  })
  it('zero coins leaves the statuses as they came', () => {
    const d = attackDamageDistribution(params({ coins: 0, status: { self: { poise: { potency: 3, count: 1 } }, target: {} } }))
    expect(d.statusAfter).toEqual({ self: { poise: { potency: 3, count: 1 } }, target: {}, varies: [] })
  })
  it('the sampler walks the same path: rupture, grants and leftovers match', () => {
    const rupture = grantOn(0, 'on-hit', 'target', 'rupture', { potency: 3 }, 'inflict rupture')
    const p = params({ coins: 2, coinCount: 3, headsChance: 1, unbreakableCoins: [0], coinEffects: [[rupture], [], []] })
    const s = sampleAttack(p, () => 0)
    expect(s.coins.map(c => c.index)).toEqual([0, 2])
    expect(s.coins.map(c => c.damage)).toEqual([7, 10])
    expect(s.coins.map(c => c.rupture)).toEqual([0, 3])
    expect(s.coins[0].grants).toEqual(['inflict rupture'])
    expect(s.total).toBe(20)
    expect(s.statusAfter.target.rupture).toBeUndefined()
  })
  it('the sampler consumes Poise on a crit exactly like the enumeration', () => {
    const p = params({ coins: 2, headsChance: 1, coinEffects: [[grantOn(0, 'on-hit', 'self', 'poise', { potency: 1 })], []] })
    // rng: coin 1 heads (0), coin 2 heads (0), coin 2 crit draw 0.01 < 0.05.
    const seq = [0, 0, 0.01]
    let i = 0
    const s = sampleAttack(p, () => seq[i++])
    expect(s.coins.map(c => c.damage)).toEqual([7, 12])
    expect(s.coins[1].crit).toBe(true)
    expect(s.statusAfter.self.poise).toBeUndefined()
  })
})

describe('mixDistributions statusAfter', () => {
  it('mixes leftovers by weight', () => {
    const one = attackDamageDistribution(params({ coins: 1, headsChance: 1, coinEffects: [[grantOn(0, 'on-hit', 'target', 'bleed', { potency: 2 })]] }))
    const none = attackDamageDistribution(params({ coins: 0 }))
    const m = mixDistributions([{ weight: 0.5, summary: one }, { weight: 0.5, summary: none }])
    expect(m.statusAfter.target.bleed).toEqual({ potency: 1, count: 0.5 })
    expect(m.statusAfter.varies).toEqual(['target:bleed'])
  })
})
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `cd packages/engine && npx vitest run test/damageDistribution.test.ts`
Expected: FAIL (`survivingCoins` missing, `statusAfter` undefined, status ignored).

- [ ] **Step 5: Rewrite the walk**

Replace the whole of `packages/engine/src/damageDistribution.ts` with:

```ts
import { computeFinalDamage } from './damage'
import { staggerDamageTypeResistanceModifier } from './resistance'
import type { AttackShape } from './statusEffects'
import { averagePairs, clonePair, conditionHolds, consume, critChanceOf, grant, mixStatusAfter, stackModifiers, type StackModifiers } from './statusState'
import type { DamageSummary, Effect, SidePair, StatusAfter } from './types'

export interface AttackParams {
  /** How many coins attack: the survivors of the clash (all of them when unopposed). */
  coins: number
  /** Coins the skill has; `coins <= coinCount`. */
  coinCount: number
  /** 0-based indices of Unbreakable coins. */
  unbreakableCoins: number[]
  /** Skill + uptie + manual + unconditional effects. Stacks and standing conditions are added per coin from `status`. */
  basePower: number
  coinPower: number
  headsChance: number
  critModifier: number
  sinResistance: number
  damageTypeResistance: number
  offenseDefenseAdvantage: number
  parryBonus: number
  /** Flat damage % from manual overrides and unconditional effects. Damage Up / Fragile stacks are read from `status` per coin. */
  dynamicModifier: number
  /** Statuses at the start of the attack: `self` is the attacker, `target` the defender. Never mutated. */
  status: SidePair
  /** The attacking skill's shape, for type- and sin-scoped stacks. */
  attackerSkill?: AttackShape
  /** Parsed effects by original coin index. */
  coinEffects: Effect[][]
  /** Skill-level flat ops re-evaluated before every coin (standing conditions, crit-only damage, clash-win bonuses). */
  conditionalBonuses: Effect[]
  /** Skill-level grants applied once after the last coin, if any coin attacked. */
  attackEndGrants: Effect[]
  defenderMaxHp: number
  defenderCurrentHp: number
  /**
   * Fractions of max HP in descending order, same convention as `Unit.staggerThresholds`
   * (e.g. `[0.7, 0.4]`). The sequential crossing walk below assumes this ordering: descending
   * thresholds produce ascending absolute damage lines, which is what lets it advance a single
   * forward pointer through `staggerLines` instead of re-scanning on every coin.
   */
  staggerThresholds: number[]
  staggerMidAttack: boolean
  /**
   * Flat power a lost guard clash strips from this attack (spec 6.2). Absorbed by the earliest
   * coins first: a coin whose whole roll is absorbed deals 0, the remainder carries to the next.
   * Default 0.
   */
  powerReduction?: number
}

interface Walk {
  /** Position in the surviving-coin list. */
  pos: number
  /** Coin Power banked by every heads so far, each at the Coin Power in force when it flipped. */
  powerFromHeads: number
  total: number
  thresholdsCrossed: number
  reductionLeft: number
  prob: number
  status: SidePair
}

export interface SampledCoin {
  /** Original coin index (a coin that broke in the clash is absent). */
  index: number
  heads: boolean
  crit: boolean
  roll: number
  damage: number
  /** Fixed damage added by the Rupture tick on this hit. */
  rupture: number
  staggered: boolean
  /** Sources of the grants this coin applied. */
  grants: string[]
}
export interface SampledAttack { coins: SampledCoin[]; total: number; thresholdsCrossed: number; statusAfter: SidePair }

/**
 * Coins that attack after a clash, ascending by original index: every Unbreakable coin plus the
 * highest-indexed breakable coins, because breakable coins break lowest first ("coins break from
 * lowest to highest": community guide https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251,
 * not the wiki). A skill whose coins are all Unbreakable clashes as if they were breakable (see
 * clashChain's normalizeCoins), so it loses them the same way.
 */
export function survivingCoins(coinCount: number, coins: number, unbreakable: number[]): number[] {
  const all = Array.from({ length: coinCount }, (_, i) => i)
  if (coins >= coinCount) return all
  const u = new Set(unbreakable.filter(i => Number.isInteger(i) && i >= 0 && i < coinCount))
  if (u.size === coinCount) u.clear()
  const breakable = all.filter(i => !u.has(i))
  const keep = Math.max(0, coins - u.size)
  const kept = new Set([...u, ...breakable.slice(breakable.length - keep)])
  const out = all.filter(i => kept.has(i))
  return out.length > coins ? out.slice(out.length - coins) : out
}

/** Absolute damage lines for the stagger thresholds, and how many already sit behind current HP. */
function staggerLinesFor(p: AttackParams): { lines: number[]; alreadyCrossed: number } {
  const lines = p.staggerThresholds.map(t => p.defenderCurrentHp - t * p.defenderMaxHp)
  // A line at or below 0 sits behind the defender's current HP: that stagger threshold was broken
  // before this attack began. Seed the walk past those lines so every coin already benefits from
  // the stagger multiplier, and leave their staggerChance at 0 - this attack did not cause them.
  // staggerThresholds is descending, so the already-crossed lines are the leading ones.
  let alreadyCrossed = 0
  while (alreadyCrossed < lines.length && lines[alreadyCrossed] <= 0) alreadyCrossed++
  return { lines, alreadyCrossed }
}

/**
 * Takes as much of `left` as this coin's roll can absorb. `absorbed` means the whole roll went, so
 * the coin deals nothing - including a roll of 0 or below, which must not slip past the reduction
 * and pick up the 1-damage floor. `used` is clamped at 0 so a negative roll cannot credit power
 * back into the pool and leave more reduction for the coins behind it.
 */
function absorb(roll: number, left: number): { roll: number; left: number; absorbed: boolean } {
  const used = Math.max(0, Math.min(roll, left))
  return { roll: roll - used, left: left - used, absorbed: left > 0 && roll - used <= 0 }
}

/** Damage of one coin given its (possibly reduced) roll, the dynamic modifier in force, and the walk state before it. */
function coinDamage(p: AttackParams, coinRoll: number, crit: boolean, thresholdsCrossed: number, absorbed: boolean, dynamic: number): number {
  if (absorbed) return 0
  const staggered = p.staggerMidAttack && thresholdsCrossed > 0
  return computeFinalDamage({
    coinRoll,
    staticModifiers: {
      sinResistance: p.sinResistance,
      damageTypeResistance: staggered ? staggerDamageTypeResistanceModifier(thresholdsCrossed) : p.damageTypeResistance,
      offenseDefenseAdvantage: p.offenseDefenseAdvantage,
      parryBonus: p.parryBonus,
      critical: crit ? p.critModifier : 0,
    },
    dynamicModifiers: { skillEffects: 0, buffs: dynamic },
  })
}

/** Which per-coin triggers fire on this branch. Anything not tied to the flip or the crit fires on every landing coin. */
function fires(trigger: Effect['trigger'], heads: boolean, crit: boolean): boolean {
  switch (trigger) {
    case 'heads-hit': return heads
    case 'tails-hit': return !heads
    case 'on-crit': return crit
    default: return true
  }
}

interface Bonus { basePower: number; coinPower: number; damagePercent: number }

/** Standing conditions and this coin's own flat ops, judged against the status as the coin is about to flip. */
function coinBonuses(p: AttackParams, coin: number, status: SidePair, heads: boolean, crit: boolean): Bonus {
  const b: Bonus = { basePower: 0, coinPower: 0, damagePercent: 0 }
  for (const e of [...p.conditionalBonuses, ...(p.coinEffects[coin] ?? [])]) {
    if (e.op.kind !== 'coinPower' && e.op.kind !== 'basePower' && e.op.kind !== 'damagePercent') continue
    if (!fires(e.trigger, heads, crit)) continue
    if (e.condition && !conditionHolds(e.condition, status, 'self')) continue
    b[e.op.kind] += e.op.delta
  }
  return b
}

/**
 * The coin lands. Rupture: "When hit by an attack, take fixed damage by the effect's Potency. Then,
 * reduce its Count by 1." (https://limbuscompany.wiki.gg/wiki/Rupture). A crit consumes one Poise
 * count (https://limbuscompany.wiki.gg/wiki/Poise). Returns the tick's fixed damage.
 */
function land(status: SidePair, crit: boolean): number {
  const r = status.target.rupture
  let rupture = 0
  if (r && r.count >= 1) {
    rupture = r.potency
    consume(status.target, 'rupture')
  }
  if (crit) consume(status.self, 'poise')
  return rupture
}

/** This coin's grants, judged together against the status after the coin landed, then applied. */
function coinGrants(p: AttackParams, coin: number, status: SidePair, heads: boolean, crit: boolean): string[] {
  const before = clonePair(status)
  const applied: string[] = []
  for (const e of p.coinEffects[coin] ?? []) {
    if (e.op.kind !== 'applyStatus') continue
    if (!fires(e.trigger, heads, crit)) continue
    if (e.condition && !conditionHolds(e.condition, before, 'self')) continue
    grant(status, e.op, 'self')
    applied.push(e.source)
  }
  return applied
}

function attackEnd(p: AttackParams, status: SidePair): SidePair {
  if (p.attackEndGrants.length === 0) return status
  const out = clonePair(status)
  for (const e of p.attackEndGrants) {
    if (e.op.kind !== 'applyStatus') continue
    if (e.condition && !conditionHolds(e.condition, status, 'self')) continue
    grant(out, e.op, 'self')
  }
  return out
}

interface Step { roll: number; damage: number; rupture: number; grants: string[]; staggered: boolean; crossedNow: number[]; next: Walk }

/** One coin on one branch: bonuses, roll, damage, landing, grants, stagger lines. */
function step(p: AttackParams, lines: number[], coin: number, heads: boolean, crit: boolean, w: Walk, prob: number, m: StackModifiers): Step {
  const status = clonePair(w.status)
  const b = coinBonuses(p, coin, status, heads, crit)
  // A heads banks the Coin Power in force when it flipped; a bonus that switches on later does not rewrite it.
  const coinPowerNow = p.coinPower + m.coinPowerBonus + b.coinPower
  const powerFromHeads = w.powerFromHeads + (heads ? coinPowerNow : 0)
  const { roll, left, absorbed } = absorb(p.basePower + b.basePower + m.coinRollBonus + powerFromHeads, w.reductionLeft)
  const staggered = p.staggerMidAttack && w.thresholdsCrossed > 0
  // Stacks summed first so an unchanged status reproduces the pre-change engine's floating-point result exactly.
  const dynamic = (m.attackerDynamic + m.targetDynamic) + (p.dynamicModifier + b.damagePercent) + (crit ? m.critOnly : 0)
  const damage = coinDamage(p, roll, crit, w.thresholdsCrossed, absorbed, dynamic)
  // An absorbed coin still lands: its hit effects fire and Rupture ticks.
  const rupture = land(status, crit)
  const grants = coinGrants(p, coin, status, heads, crit)
  const total = w.total + damage + rupture
  let crossed = w.thresholdsCrossed
  const crossedNow: number[] = []
  while (crossed < lines.length && total >= lines[crossed]) {
    crossedNow.push(crossed)
    crossed++
  }
  return {
    roll, damage, rupture, grants, staggered, crossedNow,
    next: { pos: w.pos + 1, powerFromHeads, total, thresholdsCrossed: crossed, reductionLeft: left, prob, status },
  }
}

function start(p: AttackParams, alreadyCrossed: number): Walk {
  return { pos: 0, powerFromHeads: 0, total: 0, thresholdsCrossed: alreadyCrossed, reductionLeft: p.powerReduction ?? 0, prob: 1, status: clonePair(p.status) }
}

/** Exact distribution of total damage for a one-sided attack, enumerating every heads/crit sequence of the surviving coins. */
export function attackDamageDistribution(p: AttackParams): DamageSummary {
  const survivors = survivingCoins(p.coinCount, p.coins, p.unbreakableCoins)
  const histogram = new Map<number, number>()
  const perCoinMean = new Array<number>(p.coinCount).fill(0)
  const staggerChance = new Array<number>(p.staggerThresholds.length).fill(0)
  const { lines, alreadyCrossed } = staggerLinesFor(p)
  const terminal: { pair: SidePair; prob: number }[] = []

  const stack: Walk[] = [start(p, alreadyCrossed)]
  while (stack.length > 0) {
    const w = stack.pop()!
    if (w.pos === survivors.length) {
      histogram.set(w.total, (histogram.get(w.total) ?? 0) + w.prob)
      terminal.push({ pair: survivors.length > 0 ? attackEnd(p, w.status) : w.status, prob: w.prob })
      continue
    }
    const coin = survivors[w.pos]
    const m = stackModifiers(w.status, p.attackerSkill)
    const critChance = critChanceOf(w.status.self)
    for (const heads of [true, false]) {
      const pHeads = heads ? p.headsChance : 1 - p.headsChance
      if (pHeads === 0) continue
      for (const crit of [true, false]) {
        const pCrit = crit ? critChance : 1 - critChance
        if (pCrit === 0) continue
        const prob = w.prob * pHeads * pCrit
        const s = step(p, lines, coin, heads, crit, w, prob, m)
        perCoinMean[coin] += (s.damage + s.rupture) * prob
        for (const k of s.crossedNow) staggerChance[k] += prob
        stack.push(s.next)
      }
    }
  }
  return summarize(histogram, perCoinMean, staggerChance, averagePairs(terminal))
}

/** One random path through the same walk `attackDamageDistribution` enumerates (for "Roll once"). */
export function sampleAttack(p: AttackParams, rng: () => number = Math.random): SampledAttack {
  const survivors = survivingCoins(p.coinCount, p.coins, p.unbreakableCoins)
  const { lines, alreadyCrossed } = staggerLinesFor(p)
  let w = start(p, alreadyCrossed)
  const coins: SampledCoin[] = []
  for (const coin of survivors) {
    const m = stackModifiers(w.status, p.attackerSkill)
    const critChance = critChanceOf(w.status.self)
    const heads = rng() < p.headsChance
    // Draw for the crit only while a Poise count is left, as the pre-change sampler did.
    const crit = (w.status.self.poise?.count ?? 0) > 0 && rng() < critChance
    const s = step(p, lines, coin, heads, crit, w, 1, m)
    coins.push({ index: coin, heads, crit, roll: s.roll, damage: s.damage, rupture: s.rupture, staggered: s.staggered, grants: s.grants })
    w = s.next
  }
  return { coins, total: w.total, thresholdsCrossed: w.thresholdsCrossed - alreadyCrossed, statusAfter: survivors.length > 0 ? attackEnd(p, w.status) : w.status }
}

/**
 * Combine several conditional distributions into one by weight.
 *
 * `perCoinMean[i]` is the unconditional contribution of coin i - the mean damage coin i adds
 * across every outcome, not conditional on reaching that coin - so parts with fewer coins are
 * zero-padded and `sum(perCoinMean)` equals `mean`. Weights need not sum to 1: `summarize`
 * normalizes everything by the total mass it is handed.
 */
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
  const statusAfter = mixStatusAfter(parts.map(x => ({ weight: x.weight, after: x.summary.statusAfter })))
  return summarize(histogram, perCoinMean, staggerChance, statusAfter)
}

function summarize(histogram: Map<number, number>, perCoinMean: number[], staggerChance: number[], statusAfter: StatusAfter): DamageSummary {
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
    statusAfter,
  }
}
```

- [ ] **Step 6: Wire `attackContext` to the new params**

In `packages/engine/src/report.ts`, replace the `params` object literal inside `attackContext` with:

```ts
  const params: AttackContext['params'] = {
    coinCount: attacker.coinCount,
    unbreakableCoins: attacker.unbreakableCoinIndices,
    basePower: attacker.flat.basePower,
    coinPower: attacker.flat.coinPower,
    headsChance: attacker.headsChance,
    critModifier: criticalDamageModifier(),
    sinResistance: resistanceModifier(mult.sin),
    damageTypeResistance: resistanceModifier(mult.damageType),
    offenseDefenseAdvantage: offenseDefenseAdvantage(attacker.offenseLevel, target.defenseLevel),
    parryBonus,
    dynamicModifier: attacker.flat.damagePercent,
    status: attacker.statusAfterPrepare,
    attackerSkill: { damageType: attacker.damageType, sin: attacker.sin },
    coinEffects: attacker.coinEffects,
    conditionalBonuses: attacker.conditionalBonuses,
    attackEndGrants: attacker.grants.attackEnd,
    defenderMaxHp: target.maxHp,
    defenderCurrentHp: target.currentHp,
    staggerThresholds: targetCombatant.unit.staggerThresholds,
    staggerMidAttack: options.staggerMidAttack ?? true,
  }
```

and change the 'Dynamic modifier' breakdown line so it still shows the prepare-time total:

```ts
    { label: 'Dynamic modifier', value: attacker.dynamicAsAttacker + target.dynamicAsTarget + attacker.damagePercent, source: 'Damage Up/Down, Fragile/Protection, damage % effects' },
```

Nothing else in `report.ts` changes in this task. Task 5 adds the clash-branch grants.

- [ ] **Step 7: Run the engine suite and typecheck**

Run: `cd packages/engine && npx vitest run && npm run typecheck`
Expected: every test PASS. `golden.test.ts` must pass unchanged: if it fails, the walk is not regression-neutral and the fix belongs here (check the summation order in `step`, the `powerFromHeads` accumulation, and that `perCoinMean` has length `coinCount`, which for every golden case equals the coins the mix pads to). `report.test.ts` must pass unchanged.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/damageDistribution.ts packages/engine/src/types.ts packages/engine/src/report.ts packages/engine/test/damageDistribution.test.ts
git commit -m "Walk the attack with a working status: surviving coins, standing conditions, Rupture ticks, per-coin grants

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 5: Clash-branch grants, sampler pass-through and engine docs

**Files:**
- Modify: `packages/engine/src/report.ts`
- Modify: `packages/engine/test/report.test.ts` (append tests)
- Modify: `packages/engine/README.md`

**Interfaces:**
- Consumes: `ResolvedCombatant.grants`, `statusAfterPrepare`, `conditionalBonuses`; `grant`, `clonePair`, `GrantOp` from `statusState`.
- Produces: `attackContext(attacker, target, targetCombatant, parryBonus, options, branch?: Branch)`, `winBranch(winner, loser): Branch`; `report.damageDealt.statusAfter` holds the win-branch leftovers with `self` = A and `target` = B, `report.damageTaken.statusAfter` the lose-branch leftovers with `self` = B and `target` = A (spec §6); `sampleClash(...).attack.statusAfter` likewise from the winner's view.

- [ ] **Step 1: Write the failing tests**

Add `import type { Effect } from '../src/types'` at the top of `packages/engine/test/report.test.ts`, then append:

```ts
describe('clash-branch grants', () => {
  // Charge is inert, so its leftover is the same on every path; Poise would be consumed on crit paths.
  const winCharge: Effect = { trigger: 'clash-win', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'charge', potency: 2 }, source: '[Clash Win] Gain 2 Charge' }
  const winDamage: Effect = { trigger: 'clash-win', scope: 'skill', op: { kind: 'damagePercent', delta: 0.5 }, source: '[Clash Win] +50% damage' }
  const loseBind: Effect = { trigger: 'clash-lose', scope: 'skill', op: { kind: 'applyStatus', target: 'target', status: 'bind', potency: 1 }, source: '[Clash Lose] Inflict 1 Bind' }

  it('applies the winner\'s clash-win grants to the win branch only', () => {
    const a = makeCombatant({ skill: makeSkill({ coinCount: 1, effects: [winCharge] }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ coinCount: 1, effects: [winCharge] })] }) })
    const r = clashReport(a, b)
    expect(r.damageDealt.statusAfter.self.charge).toEqual({ potency: 2, count: 1 })
    expect(r.damageDealt.statusAfter.target.charge).toBeUndefined()
    expect(r.damageTaken.statusAfter.self.charge).toEqual({ potency: 2, count: 1 })
    expect(r.damageTaken.statusAfter.target.charge).toBeUndefined()
  })
  it('a clash-win grant changes damageDealt, and the unopposed report ignores it', () => {
    const critWin: Effect = { trigger: 'clash-win', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'poise', potency: 20 }, source: '[Clash Win] Gain 20 Poise' }
    const a = makeCombatant({ sanity: 45, skill: makeSkill({ basePower: 30, coinPower: 0, coinCount: 1, effects: [critWin] }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b' }) })
    const r = clashReport(a, b)
    expect(r.win).toBe(1)
    // Certain crit at 20 Poise: 30 x 1.2 = 36.
    expect(r.damageDealt.mean).toBe(36)
    expect(unopposedReport(a, b).damage.mean).toBe(30)
    expect(unopposedReport(a, b).damage.statusAfter.self.poise).toBeUndefined()
  })
  it('clash-win flat ops raise the winner\'s damage on the win branch', () => {
    const a = makeCombatant({ sanity: 45, skill: makeSkill({ basePower: 30, coinPower: 0, coinCount: 1, effects: [winDamage] }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b' }) })
    expect(clashReport(a, b).damageDealt.mean).toBe(45)
    expect(unopposedReport(a, b).damage.mean).toBe(30)
  })
  it('the loser\'s clash-lose grants land on the winner\'s branch', () => {
    const a = makeCombatant({ skill: makeSkill({ basePower: 30, coinPower: 0, coinCount: 1 }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ coinCount: 1, effects: [loseBind] })] }) })
    const r = clashReport(a, b)
    expect(r.win).toBe(1)
    expect(r.damageDealt.statusAfter.self.bind).toEqual({ potency: 1, count: 1 })
  })
  it('leftovers carry the prepared statuses and the per-coin grants through the mix', () => {
    const inflict: Effect = { trigger: 'on-hit', scope: { coin: 0 }, op: { kind: 'applyStatus', target: 'target', status: 'bleed', potency: 2 }, source: '[On Hit] Inflict 2 Bleed' }
    const a = makeCombatant({ sanity: 45, skill: makeSkill({ basePower: 30, coinPower: 0, coinCount: 1, effects: [inflict] }), status: { charge: { potency: 3, count: 1 } } })
    const b = makeCombatant({ unit: makeUnit({ id: 'b' }) })
    const r = clashReport(a, b)
    expect(r.damageDealt.statusAfter.self.charge).toEqual({ potency: 3, count: 1 })
    expect(r.damageDealt.statusAfter.target.bleed).toEqual({ potency: 2, count: 1 })
  })
  it('sampleClash reports the sampled leftovers from the winner\'s view', () => {
    const a = makeCombatant({ sanity: 45, skill: makeSkill({ basePower: 30, coinPower: 0, coinCount: 1, effects: [winCharge] }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b' }) })
    const s = sampleClash(a, b, {}, () => 0)
    expect(s.outcome).toBe('win')
    expect(s.attack?.statusAfter.self.charge).toEqual({ potency: 2, count: 1 })
    expect(s.attack?.coins[0].index).toBe(0)
  })
  it('a guard clash applies the attacker\'s clash-win grants when the guard loses', () => {
    const a = makeCombatant({ sanity: 45, skill: makeSkill({ basePower: 20, coinPower: 3, coinCount: 1, effects: [winCharge] }) })
    const guard = makeCombatant({ unit: makeUnit({ id: 'g', skills: [makeSkill({ damageType: 'guard', basePower: 4, coinPower: 2, coinCount: 1 })] }) })
    const r = clashReport(a, guard)
    expect(r.win).toBe(1)
    expect(r.damageDealt.statusAfter.self.charge).toEqual({ potency: 2, count: 1 })
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd packages/engine && npx vitest run test/report.test.ts`
Expected: the new `clash-branch grants` tests FAIL (no grants applied); everything else PASS.

- [ ] **Step 3: Apply the grants per branch in report.ts**

In `packages/engine/src/report.ts`:

Replace the `import type { ... } from './types'` line and add the statusState import:

```ts
import { clonePair, grant, type GrantOp } from './statusState'
import type { BreakdownLine, ClashReport, Combatant, DamageSummary, Effect, ResolvedCombatant, SidePair, Skill, UnopposedReport } from './types'
```

Add after `damageMultipliers`:

```ts
/** The statuses and extra bonuses a branch attacks with. */
export interface Branch { pair: SidePair; bonuses: Effect[] }

const isGrant = (e: Effect): e is Effect & { op: GrantOp } => e.op.kind === 'applyStatus'

/**
 * The branch where `winner` won the clash: the winner's [Clash Win] lines and the loser's
 * [Clash Lose] lines land on the winner's prepared pair (`self` = winner). Grants update the
 * statuses; the winner's flat ops join its per-coin bonuses. The loser's flat ops change a skill
 * that never attacks and are ignored.
 */
export function winBranch(winner: ResolvedCombatant, loser: ResolvedCombatant): Branch {
  const pair = clonePair(winner.statusAfterPrepare)
  for (const e of winner.grants.clashWin) if (isGrant(e)) grant(pair, e.op, 'self')
  for (const e of loser.grants.clashLose) if (isGrant(e)) grant(pair, e.op, 'target')
  return { pair, bonuses: [...winner.conditionalBonuses, ...winner.grants.clashWin.filter(e => !isGrant(e))] }
}

/** No clash happened: the prepared statuses as they are. */
function noBranch(attacker: ResolvedCombatant): Branch {
  return { pair: attacker.statusAfterPrepare, bonuses: attacker.conditionalBonuses }
}
```

Change the signature of `attackContext` to take the branch, defaulting to the prepared statuses:

```ts
export function attackContext(attacker: ResolvedCombatant, target: ResolvedCombatant, targetCombatant: Combatant, parryBonus: number, options: ReportOptions, branch: Branch = noBranch(attacker)): AttackContext {
```

and inside it use `status: branch.pair` and `conditionalBonuses: branch.bonuses` in the params literal (replacing `attacker.statusAfterPrepare` and `attacker.conditionalBonuses`).

Change `conditionalDamage` to accept and forward a branch:

```ts
function conditionalDamage(
  attacker: ResolvedCombatant,
  target: ResolvedCombatant,
  targetCombatant: Combatant,
  coinWeights: number[],
  totalWeight: number,
  parryBonus: number,
  options: ReportOptions,
  branch: Branch = noBranch(attacker),
): { summary: DamageSummary; breakdown: BreakdownLine[] } {
  const { params, breakdown } = attackContext(attacker, target, targetCombatant, parryBonus, options, branch)
```

In `clashReport`'s chain path, pass the branches:

```ts
  const dealt = conditionalDamage(ra, rb, b, chain.coinsLeftIfWin, chain.win, parryBonus, options, winBranch(ra, rb))
  const taken = conditionalDamage(rb, ra, a, chain.coinsLeftIfLose, chain.lose, parryBonus, options, winBranch(rb, ra))
```

In `guardClash`, build the attacker's context with the win branch:

```ts
  const ctx = attackContext(ra, rg, guard, parryRoundBonus(parryRoundsExpected), options, winBranch(ra, rg))
```

(`guardCtx` and `noDamage` keep the default branch.) In `sampleClash`:

```ts
  const ctx = attackContext(rw, rl, loser, parryRoundBonus(report.parryRoundsExpected), options, winBranch(rw, rl))
```

`unopposedReport` is unchanged: it uses the default branch, so clash grants never apply there.

- [ ] **Step 4: Run the engine suite and typecheck**

Run: `cd packages/engine && npx vitest run && npm run typecheck`
Expected: all PASS, golden included.

- [ ] **Step 5: Update the engine README**

In `packages/engine/README.md`:

Under `## Sources`, add:

```markdown
- Rupture: https://limbuscompany.wiki.gg/wiki/Rupture ("When hit by an attack, take fixed damage by the effect's Potency. Then, reduce its Count by 1.")
- Poise: https://limbuscompany.wiki.gg/wiki/Poise (crit chance = Potency x 5%, one Count per crit, x1.2 damage)
- Status arithmetic: https://limbuscompany.wiki.gg/wiki/Status_Effects and namu.wiki/w/Limbus Company/키워드 (a potency grant to an absent status sets count 1; a count grant sets potency 1; cap 99)
- Effect resolution order (community guide, not the wiki): https://steamcommunity.com/sharedfiles/filedetails/?id=3003880251, "Skill Effect Order Clarification" and "The Order of Actions & Triggers"
```

Replace the bullet `- Per-coin effects (\`scope: { coin: n }\`) are listed as unhandled and not applied.` with:

```markdown
- Effects are applied when the game applies them: pre-clash grants and unconditional flat ops at prepare; [Clash Win] / [Clash Lose] lines on that branch; per-coin lines coin by coin with [Heads Hit] / [Tails Hit] / [On Crit] gating; [Attack End] after the last coin. Rupture ticks as unscaled fixed damage on every landing coin; Poise, Fragile, Damage Up and the coin-roll statuses are read from the working status before each coin.
- Two rules come from a community guide rather than the wiki and are flagged as such in the code: untagged conditional lines are standing conditions re-evaluated after grants and before every coin (not resolved in text order), and breakable coins break lowest first, so a partial clash win attacks with the highest-indexed breakable coins plus every Unbreakable one; a broken coin's effects never fire.
- Every coin of a one-sided attack lands: on-hit grants assume no evasion.
- Statuses without in-attack arithmetic (Bleed, Burn, Sinking, Tremor, Charge, Bind, …) are updated by grants and reported in `statusAfter`, never applied.
- A coin's contribution to accumulated heads power is the Coin Power in force when it flipped; a standing condition that switches on mid-attack does not rewrite earlier coins.
- A coin whose roll a guard fully absorbed still lands: its hit effects fire and Rupture ticks.
- [Clash Lose] flat ops are listed but not applied (the losing skill never attacks).
```

Add to `## Entry points`:

```markdown
- `resolveCombatant` returns `statusAfterPrepare` (both sides after every pre-clash grant), `coinEffects`, `conditionalBonuses`, `grants` and the effect-line lists `effectsApplied` / `effectsPerCoin` / `effectsPending` / `effectsUnparsed`.
- Every `DamageSummary` carries `statusAfter`: expected statuses on both sides after the attack (`self` = attacker), with `varies` naming the ids that differ between paths. `damageDealt.statusAfter` is the win branch from A's view; `damageTaken.statusAfter` the lose branch from B's view. `perCoinMean` is indexed by original coin; a coin that broke in the clash contributes 0.
```

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/report.ts packages/engine/test/report.test.ts packages/engine/README.md
git commit -m "Apply clash-win and clash-lose lines per branch; document the effect rules and their sources

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 6: Effect marks in the web app

**Files:**
- Modify: `apps/web/src/lib/effectStatus.ts`
- Modify: `apps/web/test/effectStatus.test.ts`
- Modify: `apps/web/src/components/EffectList.tsx`
- Modify: `apps/web/src/components/CombatantCard.tsx:31-32` and the summary line at `:109`
- Modify: `apps/web/test/verdict.test.ts:5` (the hand-built `DamageSummary` fixture gains `statusAfter`)

**Interfaces:**
- Consumes: `ResolvedCombatant.effectsApplied`, `effectsPerCoin`, `effectsPending`, `effectsUnparsed`.
- Produces:

```ts
export type EffectStatus = 'applied' | 'per-coin' | 'pending' | 'inactive' | 'unparsed'
export interface EffectMark { status: EffectStatus; coin?: number }   // coin: 0-based, only for per-coin lines with coin scope
export function effectStatus(effect: Effect, resolved: ResolvedCombatant): EffectMark
```

- [ ] **Step 1: Rewrite the test**

Replace `apps/web/test/effectStatus.test.ts` with:

```ts
import { resolveCombatant, EMPTY_MANUAL, type Effect } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { effectStatus } from '../src/lib/effectStatus.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

const applied: Effect = { trigger: 'on-use', scope: 'skill', op: { kind: 'coinPower', delta: 1 }, source: 'Coin Power +1' }
const gated: Effect = { trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 }, op: { kind: 'basePower', delta: 1 }, source: 'At 5+ Poise, Base Power +1' }
const unparsed: Effect = { trigger: 'on-hit', scope: 'skill', op: { kind: 'unparsed' }, source: 'Something the parser does not know' }
const perCoin: Effect = { trigger: 'on-hit', scope: { coin: 1 }, op: { kind: 'applyStatus', target: 'target', status: 'rupture', potency: 1 }, source: '[On Hit] Inflict 1 Rupture' }
const grantNow: Effect = { trigger: 'on-use', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'charge', count: 3 }, source: '[On Use] Gain 3 Charge' }
const later: Effect = { trigger: 'clash-win', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'poise', potency: 2 }, source: '[Clash Win] Gain 2 Poise' }
const critDamage: Effect = { trigger: 'on-crit', scope: 'skill', op: { kind: 'damagePercent', delta: 0.2 }, source: '+20% damage on crit' }

describe('effectStatus', () => {
  const unit = makeUnit({ skills: [makeSkill({ effects: [applied, gated, unparsed, perCoin, grantNow, later, critDamage] })] })
  const resolved = resolveCombatant({ unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } })
  it('marks applied, unparsed and inactive lines', () => {
    expect(effectStatus(applied, resolved)).toEqual({ status: 'applied' })
    expect(effectStatus(unparsed, resolved)).toEqual({ status: 'unparsed' })
    expect(effectStatus(gated, resolved)).toEqual({ status: 'inactive' })
  })
  it('marks per-coin lines with their coin, and per-coin skill lines without one', () => {
    expect(effectStatus(perCoin, resolved)).toEqual({ status: 'per-coin', coin: 1 })
    expect(effectStatus(critDamage, resolved)).toEqual({ status: 'per-coin' })
  })
  it('marks pre-clash grants applied and clash-result grants pending', () => {
    expect(effectStatus(grantNow, resolved)).toEqual({ status: 'applied' })
    expect(effectStatus(later, resolved)).toEqual({ status: 'pending' })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd apps/web && npx vitest run test/effectStatus.test.ts`
Expected: FAIL (`effectStatus` returns a string, not an object).

- [ ] **Step 3: Rewrite effectStatus.ts**

```ts
// apps/web/src/lib/effectStatus.ts
import type { Effect, ResolvedCombatant } from '@limbus/engine'

export type EffectStatus = 'applied' | 'per-coin' | 'pending' | 'inactive' | 'unparsed'

/** How the engine treats one effect line, and for a coin-scoped line which coin (0-based). */
export interface EffectMark { status: EffectStatus; coin?: number }

export function effectStatus(effect: Effect, resolved: ResolvedCombatant): EffectMark {
  if (resolved.effectsUnparsed.includes(effect.source)) return { status: 'unparsed' }
  if (resolved.effectsPerCoin.includes(effect.source)) {
    return effect.scope === 'skill' ? { status: 'per-coin' } : { status: 'per-coin', coin: effect.scope.coin }
  }
  if (resolved.effectsPending.includes(effect.source)) return { status: 'pending' }
  if (resolved.effectsApplied.includes(effect.source)) return { status: 'applied' }
  return { status: 'inactive' }
}
```

- [ ] **Step 4: Update EffectList and the card summary**

In `apps/web/src/components/EffectList.tsx`, replace the `effectStatus` import, `MARK` and `Line` with:

```tsx
import { effectStatus, type EffectMark, type EffectStatus } from '../lib/effectStatus.ts'

const MARK: Record<EffectStatus, { dot: string; body: string }> = {
  applied: { dot: 'bg-gold-bright', body: 'text-bone' },
  'per-coin': { dot: 'bg-gold-bright', body: 'text-bone' },
  pending: { dot: 'bg-gold-dim', body: 'text-bone-dim' },
  inactive: { dot: 'bg-bone-faint', body: 'text-bone-dim' },
  unparsed: { dot: 'bg-paper-edge', body: 'text-bone-faint' },
}

function markText(mark: EffectMark): string {
  switch (mark.status) {
    case 'applied': return 'applied'
    case 'per-coin': return mark.coin === undefined ? 'applied per coin' : `applied on coin ${mark.coin + 1}`
    case 'pending': return 'applied later'
    case 'inactive': return 'not active'
    case 'unparsed': return 'not modeled'
  }
}

function Line({ effect, resolved }: { effect: Effect; resolved: ResolvedCombatant }) {
  const mark = effectStatus(effect, resolved)
  const look = MARK[mark.status]
  const scope = effect.scope === 'skill' ? '' : `Coin ${effect.scope.coin + 1}: `
  return (
    <li className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm">
      <span className={`mt-1.5 h-2 w-2 rounded-full ${look.dot}`} aria-hidden />
      <span className={look.body}>{scope}{effect.source}</span>
      <span className="text-xs text-bone-faint">{markText(mark)}</span>
    </li>
  )
}
```

In `apps/web/src/components/CombatantCard.tsx`, replace lines 31–32 with:

```tsx
  const applied = (resolved?.effectsApplied.length ?? 0) + (resolved?.effectsPerCoin.length ?? 0)
  const pending = resolved?.effectsPending.length ?? 0
  const notModeled = resolved?.effectsUnparsed.length ?? 0
```

and the summary span (line 109) with:

```tsx
                    <span className="text-xs text-bone-dim"><span className="text-gold-bright">{applied} applied</span>{pending > 0 && <> · {pending} later</>}{notModeled > 0 && <> · {notModeled} not modeled</>}</span>
```

In `apps/web/test/verdict.test.ts`, line 5, add `statusAfter: { self: {}, target: {}, varies: [] }` to the summary fixture:

```ts
const summary = (over: Partial<DamageSummary>): DamageSummary => ({ mean: 0, p10: 0, p50: 0, p90: 0, max: 0, perCoinMean: [], histogram: [[0, 1]], staggerChance: [], statusAfter: { self: {}, target: {}, varies: [] }, ...over })
```

- [ ] **Step 5: Run the web suite, typecheck and lint**

Run: `cd apps/web && npx vitest run && npm run typecheck && npm run lint`
Expected: all PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/effectStatus.ts apps/web/test/effectStatus.test.ts apps/web/src/components/EffectList.tsx apps/web/src/components/CombatantCard.tsx apps/web/test/verdict.test.ts
git commit -m "Mark effect lines as applied per coin or applied later

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 7: "After this skill", per-coin Rupture in Roll once, registry-driven status options

**Files:**
- Create: `apps/web/src/lib/statusAfter.ts`
- Create: `apps/web/test/statusAfter.test.ts`
- Modify: `apps/web/src/components/VerdictPanel.tsx`
- Modify: `apps/web/src/components/RollOnce.tsx`
- Modify: `apps/web/src/components/StatusEditor.tsx:6`

**Interfaces:**
- Consumes: `DamageSummary.statusAfter`, `SampledCoin.index/rupture/grants`, `getEffectById` and `statusEffects` from `@limbus/engine`.
- Produces:

```ts
export interface StatusRow { id: string; name: string; potency: string; count: string; varies: boolean }
export function statusRows(state: StatusState, varies: string[], side: 'self' | 'target'): StatusRow[]
```

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/test/statusAfter.test.ts
import { describe, expect, it } from 'vitest'
import { statusRows } from '../src/lib/statusAfter.ts'

describe('statusRows', () => {
  it('names ids from the registry, formats whole numbers plainly and fractions to one decimal, and flags varies', () => {
    const rows = statusRows({ rupture: { potency: 3, count: 1 }, poise: { potency: 1.5, count: 0.5 }, 'strider-mao': { potency: 2, count: 1 } }, ['self:poise'], 'self')
    expect(rows).toEqual([
      { id: 'poise', name: 'Poise', potency: '1.5', count: '0.5', varies: true },
      { id: 'rupture', name: 'Rupture', potency: '3', count: '1', varies: false },
      { id: 'strider-mao', name: 'strider-mao', potency: '2', count: '1', varies: false },
    ])
  })
  it('only flags varies for its own side', () => {
    expect(statusRows({ bleed: { potency: 1, count: 1 } }, ['self:bleed'], 'target')[0].varies).toBe(false)
  })
  it('is empty for an empty state', () => {
    expect(statusRows({}, [], 'self')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd apps/web && npx vitest run test/statusAfter.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the helper**

```ts
// apps/web/src/lib/statusAfter.ts
import { getEffectById, type StatusState } from '@limbus/engine'

export interface StatusRow { id: string; name: string; potency: string; count: string; varies: boolean }

const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(1))

/** Rows for the "After this skill" block, sorted by display name. `varies` entries are `"<side>:<id>"`. */
export function statusRows(state: StatusState, varies: string[], side: 'self' | 'target'): StatusRow[] {
  return Object.entries(state)
    .map(([id, v]) => ({ id, name: getEffectById(id)?.name ?? id, potency: fmt(v.potency), count: fmt(v.count), varies: varies.includes(`${side}:${id}`) }))
    .sort((x, y) => x.name.localeCompare(y.name))
}
```

- [ ] **Step 4: Run the test**

Run: `cd apps/web && npx vitest run test/statusAfter.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the block to VerdictPanel**

In `apps/web/src/components/VerdictPanel.tsx`, add the import:

```tsx
import { statusRows, type StatusRow } from '../lib/statusAfter.ts'
```

Add this component above `VerdictPanel`:

```tsx
function AfterSkill({ name, rows }: { name: string; rows: StatusRow[] }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-bone-dim">{name}</div>
      {rows.length === 0 ? <div className="text-sm text-bone-faint">No statuses</div> : (
        <ul className="mt-1 grid gap-0.5 text-sm">
          {rows.map(r => (
            <li key={r.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{r.name}{r.varies && <span className="ml-1 text-xs text-bone-faint">varies</span>}</span>
              <span className="num shrink-0 text-bone">{r.potency} <span className="text-bone-faint">×</span> {r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Inside `VerdictPanel`, after the `const coinsLeft = …` line:

```tsx
  const after = report.damageDealt.statusAfter
  const afterA = statusRows(after.self, after.varies, 'self')
  const afterB = statusRows(after.target, after.varies, 'target')
```

and insert, directly after the `<DamageBand summary={report.damageTaken} … />` line and before the `<p className="text-xs text-bone-faint">Max HP …` paragraph:

```tsx
        <div className="border-t border-paper-edge pt-4">
          <div className="text-sm text-bone-dim">After this skill, if {a.unit.name} wins</div>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <AfterSkill name={a.unit.name} rows={afterA} />
            <AfterSkill name={b.unit.name} rows={afterB} />
          </div>
          <p className="mt-2 text-xs text-bone-faint">Potency × count, averaged over every way the coins can land. "Varies" means it differs between outcomes.</p>
        </div>
```

- [ ] **Step 6: Show Rupture and grants in Roll once**

In `apps/web/src/components/RollOnce.tsx`, replace the coin `<li>` (the one keyed by `i` inside `sample.attack.coins.map`) with:

```tsx
                <li key={c.index} className={`coin-flip w-[84px] rounded-lg border p-2 text-center ${c.heads ? 'border-gold/60 bg-gold/10' : 'border-paper-edge bg-ink'}`} style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="text-[11px] text-bone-faint">Coin {c.index + 1}</div>
                  <div className={`text-[11px] ${c.heads ? 'text-gold-bright' : 'text-bone-dim'}`}>{c.heads ? 'Heads' : 'Tails'}{c.crit ? ' · crit' : ''}</div>
                  <div className="num text-xl leading-tight">{num(c.damage)}</div>
                  {c.rupture > 0 && <div className="num text-[11px] text-blood-bright">+{num(c.rupture)} rupture</div>}
                  <div className="num text-[11px] text-bone-faint">roll {c.roll}</div>
                  {c.grants.length > 0 && <div className="mt-1 text-[10px] leading-tight text-bone-dim">{c.grants.join(' · ')}</div>}
                </li>
```

(The Total tile keeps `w-[72px]`.)

- [ ] **Step 7: Drop the hand-written Poise option**

In `apps/web/src/components/StatusEditor.tsx`, replace line 6 with:

```tsx
const OPTIONS: { id: string; name: string }[] = statusEffects.map(e => ({ id: e.id, name: e.name }))
```

and the doc comment above the component with `/** Potency / count per status stack. Every option comes from the engine registry; Poise drives crit chance, Rupture ticks on hit. */`.

- [ ] **Step 8: Run the whole workspace**

Run: `npm test && npm run typecheck && npm run lint` (repo root)
Expected: engine, data and web suites PASS; typecheck and lint clean.

- [ ] **Step 9: Look at it once**

Run `npm run dev -w @limbus/web`, open the clash screen, and pick two identities whose skills carry per-coin grants (any identity with "[On Hit] Inflict … Rupture"). Check: the effect list shows "applied on coin N" and "applied later" marks; the verdict slab shows the "After this skill" block with both names; Roll once shows a coin index and, with Rupture entered on the target in the status editor, a "+N rupture" line. Stop the server afterwards.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/statusAfter.ts apps/web/test/statusAfter.test.ts apps/web/src/components/VerdictPanel.tsx apps/web/src/components/RollOnce.tsx apps/web/src/components/StatusEditor.tsx
git commit -m "Show what a skill leaves behind, per-coin Rupture in Roll once, registry-driven status options

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

## Self-review

**Spec coverage.** §5.1 prepare → Task 3; §5.2 clash branch → Task 5; §5.3 walk (survivors, standing conditions, dynamic from stacks, Rupture tick, Poise consumption, per-coin grants by trigger) → Task 4; §5.4 attack end → Task 4; §6 shapes (`statusAfterPrepare`, `coinEffects`, `effectsPerCoin`, `effectsPending`, `AttackParams.status/coinEffects/conditionalBonuses/unbreakableCoins/attackerSkill`, `DamageSummary.statusAfter`, `SampledCoin.rupture/grants`, registry `poise`/`rupture`) → Tasks 2 to 5; §7 marks, "After this skill", Roll once, status editor → Tasks 6 and 7; §8 tests → Task 3 (Poise before the roll, standing condition at prepare), Task 4 (Poise mid-attack, standing condition per coin, surviving coins, Rupture entered/inflicted/unscaled, per-coin power op, caps, inert, sampler) and Task 5 (clash-win grant, unopposed ignores it); regression → Task 1's golden; §9 README flags → Task 5.

**Deviations from the spec** are all listed under "Rulings" above.

**Type consistency.** `SidePair`/`StatusState`/`StatusAfter` live in `types.ts` (Task 2) and are imported by `statusState.ts`, `resolveCombatant.ts`, `damageDistribution.ts`, `report.ts`. `grant(pair, op, owner)` has the same signature in Tasks 2, 3, 4, 5. `ResolvedCombatant.grants.attackEnd` feeds `AttackParams.attackEndGrants` (Task 4 step 6). `winBranch` returns `{ pair, bonuses }`, consumed by `attackContext`'s `branch` parameter (Task 5). `SampledCoin.index` is read by `RollOnce` (Task 7). `effectsPerCoin`/`effectsPending` are produced in Task 3 and read in Task 6. The web `StatusEditor` and `statusAfter.ts` import `StatusState`, `statusEffects` and `getEffectById` from `@limbus/engine`, which re-exports `types.ts` and `statusEffects.ts`.
