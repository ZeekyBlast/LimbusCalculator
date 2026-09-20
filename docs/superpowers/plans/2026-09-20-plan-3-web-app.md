# Plan 3: Web App, Engine Additions, Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the static site: a Clash Calculator at `/` and a Railway Planner at `/railway`, running the exact engine in a Web Worker over the committed data, deployed to GitHub Pages, with the old `ui/` prototype deleted.

**Architecture:** `apps/web` is a Vite 8 + React 19 + Tailwind 4 single-page app with two routes served by a 40-line path router (no router library). Game data is copied from `packages/data/out` into `public/data` before dev and build and fetched once at startup; images come from `public/images` the same way. Zustand stores hold the clash setup (mirrored into the URL for sharing) and the persisted 12-slot team; every engine call for a report or a grid goes through a typed Web Worker client so the UI never blocks. Three engine additions land first because the UI depends on them: type/sin gating of scoped buffs moves out of `legacy/` (and `legacy/` is retired), `Combatant.skill` becomes optional so skill-less enemy parts get grid columns, and spec 6.2's guard clash plus an exact one-path sampler for "Roll once" are added to the report layer.

**Tech Stack:** TypeScript strict, Vite 8, React 19, Tailwind 4 (`@tailwindcss/vite`), Zustand 5 (`persist` middleware), Vitest (root devDependency), oxlint, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-20-limbus-calculator-rebuild-design.md` (Sections 4, 6.2 guard clash, 6.4 worker, 7, 7.1, 7.2, 7.3, 8 web, 9 steps 4 and 5, 10). Plan 1 deferred spec 6.2 guard clash and the Web Worker to this plan; Plan 1's final review deferred making `Combatant.skill` optional and moving `isEffectApplicable` out of `legacy/`. `PRODUCT.md` is the visual authority.

## Global Constraints

- Node `>=22.18` (root `engines`); TypeScript strict everywhere; npm workspaces `packages/*` and `apps/*`.
- `apps/web` runtime dependencies are exactly `@limbus/engine`, `react`, `react-dom`, `zustand`. No router library, no chart library, no UI kit.
- The engine stays pure and synchronous. In the web app every `clashReport`, `unopposedReport`, and `matchupGrid` call runs in the Web Worker via `EngineClient`; only `sampleClash` (one cheap random path) runs on the main thread.
- Nothing may import from `packages/engine/src/legacy/`; that directory is deleted in Task 1. The random simulator survives only as `packages/engine/test/legacyClashOracle.ts`.
- Data JSON is fetched at startup from `${import.meta.env.BASE_URL}data/<name>.json`; images from `${import.meta.env.BASE_URL}images/<encodeURIComponent(localPath)>` where `localPath` comes from `images.json`. Neither `apps/web/public/data/` nor `apps/web/public/images/` is committed.
- Visual direction (`PRODUCT.md`): dark corporate-noir ledger. Tokens `--color-ink #0b0b0d`, `--color-paper #1c1a17`, `--color-paper-light #262320`, `--color-gold #c9a227`, `--color-gold-bright #e8c766`, `--color-blood #8c1c1c`, `--color-blood-bright #b8332f`, `--color-bone #e4dfd3`, `--color-bone-dim #a8a196`; fonts Big Shoulders Display (display), IBM Plex Sans (body), IBM Plex Mono (numbers, `font-variant-numeric: tabular-nums`). Every numeric readout uses the `ledger-number` class. Animation only on the coin flip and the verdict stamp, both disabled under `prefers-reduced-motion: reduce`. Every screen works at 390 px wide with a 16 px gutter and no horizontal page scroll.
- Correctness is the product: every displayed number comes from an engine result or the data files. Unparsed effects are shown as unparsed, never silently dropped.
- Every commit message ends with `Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t`.
- Commands: `npm run typecheck` (root, all workspaces), `npm test` (root), `npm run lint -w @limbus/web`, `npm run build -w @limbus/web`, `npm run dev -w @limbus/web`.

## Facts the tasks rely on

- Engine public API (`packages/engine/src/index.ts`): `resolveCombatant(self, opponent?)`, `clashReport(a, b, options?)`, `unopposedReport(attacker, target, options?)`, `matchupGrid(team, wave, options?)`, `primaryAttackSkill(unit)`, `enemyCombatant(unit, skill)`, `damageMultipliers(resolved, target)`, `attackDamageDistribution(params)`, `mixDistributions(parts)`, `binomialPmf(n, p)` (length `n + 1`), `parryRoundBonus(rounds)`, `resistanceModifier(x)`, `offenseDefenseAdvantage(off, def)`, `criticalDamageModifier()`, `statusEffects` registry (`StatusEffect { id, name, ... slot }`), `getEffectById(id)`, `calculateDynamicModifier`, `EMPTY_MANUAL`, `ALL_SINS`, and the types in `types.ts` (`Unit`, `Skill`, `Combatant`, `ResolvedCombatant`, `ClashReport`, `UnopposedReport`, `DamageSummary`, `MatchupGrid`, `MatchupCell`, `UptieTier`, `StatusValue`, `ManualOverrides`, `ReportOptions { staggerMidAttack?: boolean }`).
- `ClashReport` fields: `win, lose, draw, coinsLeftIfWin: number[], coinsLeftIfLose: number[], parryRoundsExpected, damageDealt: DamageSummary, damageTaken: DamageSummary, breakdown: BreakdownLine[]`. `DamageSummary`: `mean, p10, p50, p90, max, perCoinMean: number[], histogram: [value, prob][], staggerChance: number[]`.
- `resolveCombatant` returns `effectsApplied: string[]` and `effectsUnparsed: string[]` (effect `source` sentences). Per-coin effects are reported as unparsed.
- Status ids in the registry: `fragile, protection, damage-up, damage-down, crit-damage-up, power-up, attack-power-up, coin-boost, coin-drop, sinking, bleed, burn, rupture, fragile-slash, fragile-pierce, fragile-blunt, fragile-envy, fragile-gloom, fragile-pride, fragile-lust, damage-up-slash, damage-up-blunt, damage-up-gluttony, damage-up-envy, damage-up-pierce, power-up-slash, power-up-blunt, power-up-envy, power-up-pride, power-up-pierce, attack-power-down, defense-power-up, defense-power-down, haste, bind, paralyze, charge, offense-level-up-grant, offense-level-down, defense-level-up-grant, defense-level-down`. `poise` is read directly from `Combatant.status['poise']` for crit chance and is not in the registry.
- Fragile/Protection variants carry registry slot `dynamic-additive-fragile-protection` and belong to the side being hit.
- Data files (`packages/data/out/`): `identities.json` `Unit[]` (187, `kind: 'identity'`, `group` = sinner, `level` 60), `enemies.json` `Unit[]` (39 parts, id `<enemyId>:<partIndex>`, `group` = enemy name, three parts have `skills: []`), `railway.json` `{ title, start, stations[{number,name}], sections[{number,name,stationNumbers,waves[{number,enemyIds,reinforcementIds}]}], enemyIds }`, `meta.json` `{ scrapedAt, levelCap, railwayLine, identityCount, enemyUnitCount, effectParseCoverage{total,parsed,ratio} }`, `images.json` `Record<wikiFilename, localPath | null>`, `failures.json`. Portraits are `unit.portrait`; skill icons are `skill.icon + '.png'`. Railway enemy id `9553` has no unit (documented in `failures.json`).
- `packages/data/images/` holds 1116 downloaded files (292 MB) and is git-ignored; CI has to download them (46 minutes) or restore them from a cache keyed on `images.json`.
- The old prototype `ui/` (31 tracked files) and its scraper `data/scraper/*.mjs` (12 tracked files) are outside the workspaces; root typecheck and tests ignore them. `.gitignore` still carries their entries `data/generated/`, `data/raw/`, `ui/public/gamedata`.
- Sin colors used for badges (not from the wiki): wrath `#c8452b`, lust `#e07a2c`, sloth `#d9b53a`, gluttony `#5aa64a`, gloom `#3fa1a6`, pride `#3b6fc4`, envy `#8e4bb5`.

---

## File Structure

```
packages/engine/src/statusEffects.ts           + SCOPED_STATUS, AttackShape, isEffectApplicable
packages/engine/src/resolveCombatant.ts        scoped gating; skill optional
packages/engine/src/types.ts                   Combatant.skill?; nullable target skill in MatchupCell/MatchupGrid
packages/engine/src/matchup.ts                 columns for skill-less parts
packages/engine/src/damageDistribution.ts      powerReduction, shared coin step, sampleAttack
packages/engine/src/report.ts                  attackContext, guard clash, sampleClash
packages/engine/src/index.ts                   legacy exports removed
packages/engine/test/legacyClashOracle.ts      moved from src/legacy/clash.ts (Monte Carlo oracle)
packages/engine/test/legacyClashOracle.test.ts moved from src/legacy/clash.test.ts
packages/engine/README.md                      guard model, sampler, gating documented
apps/web/package.json                          @limbus/web
apps/web/tsconfig.json
apps/web/vite.config.ts                        react + tailwind plugins, base from VITE_BASE, vitest include
apps/web/index.html                            fonts, root div
apps/web/scripts/sync-data.mjs                 packages/data/out -> public/data, images -> public/images
apps/web/src/main.tsx
apps/web/src/App.tsx                           header nav, route switch, data loading
apps/web/src/index.css                         tokens, ledger-number, stamp, coin-flip, reduced motion
apps/web/src/lib/router.ts                     parseRoute, href, navigate, useRoute
apps/web/src/lib/data.ts                       GameData, indexData, loadGameData, useGameData
apps/web/src/lib/images.ts                     imageUrl, portraitUrl, skillIconUrl
apps/web/src/lib/format.ts                     pct, num, signed
apps/web/src/lib/engineMessages.ts             EngineRequest/EngineResponse, handleRequest
apps/web/src/lib/engine.worker.ts              worker entry
apps/web/src/lib/engineClient.ts               EngineClient, engine()
apps/web/src/lib/useEngine.ts                  useClashReport, useMatchupGrid
apps/web/src/lib/setup.ts                      SideSetup, ClashSetup, defaults, toCombatant
apps/web/src/lib/setupCodec.ts                 encodeSetup, decodeSetup
apps/web/src/stores/clashStore.ts              clash setup (persisted last setup)
apps/web/src/stores/teamStore.ts               12 team slots (persisted)
apps/web/src/components/Badges.tsx             SinBadge, DamageTypeBadge, Stamp
apps/web/src/components/UnitPicker.tsx         searchable grouped combobox
apps/web/src/components/SkillPicker.tsx
apps/web/src/components/StatusEditor.tsx
apps/web/src/components/ManualEditor.tsx
apps/web/src/components/EffectList.tsx         raw text with parsed/unparsed marks
apps/web/src/components/CombatantCard.tsx
apps/web/src/components/VerdictPanel.tsx
apps/web/src/components/RollOnce.tsx
apps/web/src/components/StationPicker.tsx
apps/web/src/components/TeamBuilder.tsx
apps/web/src/components/MatchupGridView.tsx
apps/web/src/screens/ClashScreen.tsx
apps/web/src/screens/RailwayScreen.tsx
apps/web/test/fixtures.ts                      makeUnit/makeSkill/makeData for web tests
apps/web/test/*.test.ts                        router, data, engineMessages, engineClient, setupCodec, clashStore, teamStore
.github/workflows/ci.yml                       + lint + web build
.github/workflows/deploy.yml                   Pages deploy with image cache
.gitignore                                     web public data/images; old entries removed
README.md                                      three packages, refresh data, run locally, deploy
ui/, data/                                     deleted
```

---

### Task 1: Retire `legacy/`, move type/sin gating of scoped buffs into the engine proper

**Files:**
- Move: `packages/engine/src/legacy/clash.ts` -> `packages/engine/test/legacyClashOracle.ts`; `packages/engine/src/legacy/clash.test.ts` -> `packages/engine/test/legacyClashOracle.test.ts`
- Delete: `packages/engine/src/legacy/fixedDamageAilment.ts`, `packages/engine/src/legacy/fixedDamageAilment.test.ts`, `packages/engine/src/legacy/skillEffectGrants.ts`, `packages/engine/src/legacy/skillEffectGrants.test.ts`
- Modify: `packages/engine/src/index.ts`, `packages/engine/src/statusEffects.ts`, `packages/engine/src/resolveCombatant.ts`, `packages/engine/test/clashChain.test.ts`
- Test: `packages/engine/src/statusEffects.test.ts`, `packages/engine/test/resolveCombatant.test.ts`

**Interfaces:**
- Produces: `SCOPED_STATUS`, `AttackShape { damageType: SkillDamageType; sin: Sin }`, `isEffectApplicable(effectId: string, attack?: AttackShape): boolean` exported from `statusEffects.ts` (and the barrel). `resolveCombatant` gates attacker-side scoped stacks by the combatant's own skill and target-side Fragile variants by the opponent's skill.
- Side effect: the old `ui/` app stops compiling (it imported the legacy modules). It is outside the workspaces, so root typecheck and tests are unaffected; Task 11 deletes it.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/src/statusEffects.test.ts` (add `isEffectApplicable` to the import list):

```ts
describe("isEffectApplicable", () => {
    it("always applies an unscoped status", () => {
        expect(isEffectApplicable("fragile", { damageType: "slash", sin: "wrath" })).toBe(true);
        expect(isEffectApplicable("fragile")).toBe(true);
    });
    it("gates damage-type variants by the attacking skill's damage type", () => {
        expect(isEffectApplicable("fragile-slash", { damageType: "slash", sin: "wrath" })).toBe(true);
        expect(isEffectApplicable("fragile-slash", { damageType: "pierce", sin: "wrath" })).toBe(false);
        expect(isEffectApplicable("damage-up-blunt", { damageType: "guard", sin: "wrath" })).toBe(false);
    });
    it("gates sin variants by the attacking skill's sin", () => {
        expect(isEffectApplicable("power-up-pride", { damageType: "slash", sin: "pride" })).toBe(true);
        expect(isEffectApplicable("power-up-pride", { damageType: "slash", sin: "envy" })).toBe(false);
    });
    it("applies every scoped variant when the attack is unknown", () => {
        expect(isEffectApplicable("fragile-envy")).toBe(true);
    });
});
```

Append to `packages/engine/test/resolveCombatant.test.ts`:

```ts
describe('type and sin scoped status', () => {
  it('counts damage-up-slash only when the skill is slash', () => {
    const status = { 'damage-up-slash': { potency: 2, count: 1 } }
    const slash = resolveCombatant(makeCombatant({ status, skill: makeSkill({ damageType: 'slash' }) }))
    const pierce = resolveCombatant(makeCombatant({ status, skill: makeSkill({ damageType: 'pierce' }) }))
    expect(slash.dynamicAsAttacker).toBeCloseTo(0.2)
    expect(pierce.dynamicAsAttacker).toBe(0)
  })
  it('counts fragile-pierce on the target only when the opponent attacks with pierce', () => {
    const target = makeCombatant({ status: { 'fragile-pierce': { potency: 3, count: 1 } } })
    const pierce = makeCombatant({ unit: makeUnit({ id: 'x' }), skill: makeSkill({ damageType: 'pierce' }) })
    const slash = makeCombatant({ unit: makeUnit({ id: 'x' }), skill: makeSkill({ damageType: 'slash' }) })
    expect(resolveCombatant(target, pierce).dynamicAsTarget).toBeCloseTo(0.3)
    expect(resolveCombatant(target, slash).dynamicAsTarget).toBe(0)
    expect(resolveCombatant(target).dynamicAsTarget).toBeCloseTo(0.3)
  })
  it('gates sin variants by the skill sin', () => {
    const status = { 'power-up-pride': { potency: 1, count: 1 } }
    expect(resolveCombatant(makeCombatant({ status, skill: makeSkill({ sin: 'pride' }) })).coinRollBonus).toBe(1)
    expect(resolveCombatant(makeCombatant({ status, skill: makeSkill({ sin: 'wrath' }) })).coinRollBonus).toBe(0)
  })
})
```

If a per-stack value in the registry differs from 0.1 (Fragile/Damage Up) or 1 (Power Up), correct the numeric literal to `potency x perStackValue` from `statusEffects.ts` and say so in the report; never weaken the zero-side assertions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- statusEffects resolveCombatant`
Expected: FAIL, `isEffectApplicable` is not exported; the pierce/wrath cases report non-zero values.

- [ ] **Step 3: Move the oracle, delete the rest of `legacy/`**

```bash
cd packages/engine
git mv src/legacy/clash.ts test/legacyClashOracle.ts
git mv src/legacy/clash.test.ts test/legacyClashOracle.test.ts
git rm -q src/legacy/fixedDamageAilment.ts src/legacy/fixedDamageAilment.test.ts src/legacy/skillEffectGrants.ts src/legacy/skillEffectGrants.test.ts
```

In `test/legacyClashOracle.test.ts` change the imports to `from "./legacyClashOracle"` and `from "../src/damage"`. In `test/legacyClashOracle.ts` fix any relative import into `src/` to start with `../src/` (it has none today besides its own types; check with `grep -n "^import" test/legacyClashOracle.ts`). In `test/clashChain.test.ts` change `import { simulateClash } from '../src/legacy/clash'` to `import { simulateClash } from './legacyClashOracle'`.

Replace the legacy block in `src/index.ts` (the lines from the `// Legacy:` comment through `export * from './legacy/skillEffectGrants'`) with nothing, so the barrel reads:

```ts
export * from './resistance'
export * from './offenseDefenseAdvantage'
export * from './parryBonus'
export * from './criticalModifier'
export * from './damage'
export * from './uptieResolver'
export * from './statusEffects'
export * from './unbreakableCoin'
export * from './clashChain'
export * from './types'
export * from './binomial'
export * from './damageDistribution'
export * from './resolveCombatant'
export * from './report'
export * from './matchup'
```

- [ ] **Step 4: Add the scoped-status table to `statusEffects.ts`**

Add near the top (after the existing imports, adding `import type { DamageType, Sin, SkillDamageType } from "./types";`):

```ts
/** Type- and sin-scoped status variants: they contribute only when the attacking skill matches. */
export const SCOPED_STATUS: Readonly<Record<string, { damageType: DamageType } | { sin: Sin }>> = Object.freeze({
    "fragile-slash": { damageType: "slash" },
    "fragile-pierce": { damageType: "pierce" },
    "fragile-blunt": { damageType: "blunt" },
    "fragile-envy": { sin: "envy" },
    "fragile-gloom": { sin: "gloom" },
    "fragile-pride": { sin: "pride" },
    "fragile-lust": { sin: "lust" },
    "damage-up-slash": { damageType: "slash" },
    "damage-up-blunt": { damageType: "blunt" },
    "damage-up-pierce": { damageType: "pierce" },
    "damage-up-gluttony": { sin: "gluttony" },
    "damage-up-envy": { sin: "envy" },
    "power-up-slash": { damageType: "slash" },
    "power-up-blunt": { damageType: "blunt" },
    "power-up-pierce": { damageType: "pierce" },
    "power-up-envy": { sin: "envy" },
    "power-up-pride": { sin: "pride" },
});

export interface AttackShape {
    damageType: SkillDamageType;
    sin: Sin;
}

/**
 * True unless `effectId` is a scoped variant whose damage type or sin differs from the attacking
 * skill. With no attack known (a combatant resolved without an opponent) every variant applies.
 */
export function isEffectApplicable(effectId: string, attack?: AttackShape): boolean {
    const scope = SCOPED_STATUS[effectId];
    if (!scope || !attack) return true;
    return "damageType" in scope ? scope.damageType === attack.damageType : scope.sin === attack.sin;
}
```

- [ ] **Step 5: Gate the stacks in `resolveCombatant.ts`**

Change the import line to `import { calculateDynamicModifier, getEffectById, isEffectApplicable, sumCoinPowerBonus, sumCoinRollBonus, type EffectStack } from './statusEffects'`, and replace the two `targetStacks` / `attackerStacks` lines with:

```ts
  // Scoped variants (Fragile (Slash), Damage Up (Pride), ...) only count for a matching attack:
  // the attacker's own stacks against its own skill, the Fragile family against the opponent's.
  const myAttack = { damageType: skill.damageType, sin: skill.sin }
  const theirAttack = opponent ? { damageType: opponent.skill.damageType, sin: opponent.skill.sin } : undefined
  const targetStacks = stacks.filter(s => getEffectById(s.effectId)?.slot === TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, theirAttack))
  const attackerStacks = stacks.filter(s => getEffectById(s.effectId)?.slot !== TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, myAttack))
```

- [ ] **Step 6: Run the engine suite and typecheck**

Run: `npm run typecheck -w @limbus/engine && npm test -w @limbus/engine`
Expected: typecheck clean; all tests pass (160 previous minus the deleted legacy tests, plus the 7 new ones; the oracle test file still runs from `test/`). The Monte Carlo agreement tests in `clashChain.test.ts` still pass.

- [ ] **Step 7: Commit**

```bash
git add -A packages/engine
git commit -m "Retire engine legacy modules; gate type- and sin-scoped status by the attacking skill

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 2: Optional skill on `Combatant`; grid columns for skill-less enemy parts

**Files:**
- Modify: `packages/engine/src/types.ts`, `packages/engine/src/resolveCombatant.ts`, `packages/engine/src/report.ts`, `packages/engine/src/matchup.ts`
- Test: `packages/engine/test/resolveCombatant.test.ts`, `packages/engine/test/report.test.ts`, `packages/engine/test/matchup.test.ts`, `packages/engine/test/types.test.ts` (only if it constructs `MatchupCell` literals)

**Interfaces:**
- Produces: `Combatant.skill?: Skill`. `MatchupCell.targetSkillId: string | null`, `MatchupCell.win: number | null`; `MatchupGrid.columns[].skillId: string | null`. `enemyCombatant(unit, skill: Skill | undefined)`. `clashReport` throws `Error('clashReport: both combatants need a skill')` when either side has none; `unopposedReport` throws `Error('unopposedReport: the attacker needs a skill')` and accepts a skill-less target.
- Consumed by: web Tasks 6, 7, 10 (skill-less enemy parts appear as columns with unopposed damage only).

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/resolveCombatant.test.ts`:

```ts
describe('combatant without a skill', () => {
  it('resolves to a zero-coin, non-damaging shape with manual overrides still applied', () => {
    const c = makeCombatant({ skill: undefined, manual: { coinPower: 0, basePower: 2, clashPower: 0, damagePercent: 0 } })
    const r = resolveCombatant(c)
    expect(r.coinCount).toBe(0)
    expect(r.unbreakableCoins).toBe(0)
    expect(r.basePower).toBe(2)
    expect(r.coinPower).toBe(0)
    expect(r.damageType).toBe('none')
    expect(r.offenseLevel).toBe(c.level)
    expect(r.defenseLevel).toBe(c.level)
    expect(r.effectsApplied).toEqual([])
  })
})
```

`makeCombatant` in `test/fixtures.ts` currently does `skill: over.skill ?? unit.skills[0]`; change it to respect an explicit `undefined`: `skill: 'skill' in over ? over.skill : unit.skills[0]`.

Append to `packages/engine/test/report.test.ts`:

```ts
describe('skill-less combatants', () => {
  it('clashReport refuses a side without a skill', () => {
    const a = makeCombatant()
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [] }), skill: undefined })
    expect(() => clashReport(a, b)).toThrow(/both combatants need a skill/)
  })
  it('unopposedReport hits a skill-less target and refuses a skill-less attacker', () => {
    const a = makeCombatant({ sanity: 45, skill: makeSkill({ coinCount: 1 }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [] }), skill: undefined })
    expect(unopposedReport(a, b).damage.max).toBe(7)
    expect(() => unopposedReport(b, a)).toThrow(/attacker needs a skill/)
  })
})
```

Append to `packages/engine/test/matchup.test.ts` inside `describe('matchupGrid', ...)`:

```ts
  it('keeps a column for an enemy part with no attack skill: null clash, real unopposed damage', () => {
    const team = [makeCombatant({ sanity: 45 })]
    const part = makeUnit({ id: 'part', kind: 'enemy', hp: 50, skills: [] })
    const g = matchupGrid(team, [part])
    expect(g.columns).toHaveLength(1)
    expect(g.columns[0].skillId).toBeNull()
    expect(g.cells[0][0].win).toBeNull()
    expect(g.cells[0][0].targetSkillId).toBeNull()
    expect(g.cells[0][0].meanDamage).toBeGreaterThan(0)
    expect(Number.isFinite(g.columns[0].turnsToKill)).toBe(true)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- resolveCombatant report matchup`
Expected: FAIL. Type errors on `skill: undefined` and `toBeNull` expectations; `clashReport` does not throw the named message.

- [ ] **Step 3: Types**

In `packages/engine/src/types.ts`:

```ts
export interface Combatant {
  unit: Unit
  /** Absent for an enemy part with no skills: it can be hit but cannot clash or attack. */
  skill?: Skill
  uptie: UptieTier
  level: number
  /** -45..45. Enemies are always 0. */
  sanity: number
  status: Record<string, StatusValue>
  manual: ManualOverrides
  /** Current HP; defaults to max when omitted. */
  currentHp?: number
}

export interface MatchupCell {
  attackerSkillId: string
  targetUnitId: string
  /** null when the target part has no attack skill: the cell carries unopposed damage only. */
  targetSkillId: string | null
  /** Clash win chance, or null when there is nothing to clash against. */
  win: number | null
  medianDamage: number
  meanDamage: number
  sinMultiplier: number
  damageTypeMultiplier: number
}

export interface MatchupGrid {
  rows: { unitId: string; skillId: string }[]
  columns: { unitId: string; skillId: string | null; turnsToKill: number }[]
  cells: MatchupCell[][]
}
```

- [ ] **Step 4: `resolveCombatant` with an optional skill**

Replace the body of `resolveCombatant` in `packages/engine/src/resolveCombatant.ts` with:

```ts
export function resolveCombatant(self: Combatant, opponent?: Combatant): ResolvedCombatant {
  const skill = self.skill ? applyUptie(self.skill, self.uptie) : undefined
  let basePower = (skill?.basePower ?? 0) + self.manual.basePower
  let coinPower = (skill?.coinPower ?? 0) + self.manual.coinPower
  let clashPowerBonus = self.manual.clashPower
  let damagePercent = self.manual.damagePercent
  const effectsApplied: string[] = []
  const effectsUnparsed: string[] = []

  const candidates = [...(skill?.effects ?? []), ...self.unit.passives.flatMap(p => p.effects)]
  for (const e of candidates) {
    if (e.op.kind === 'unparsed') { effectsUnparsed.push(e.source); continue }
    // Per-coin effects need the coin index the enumeration is on, which this flat resolve has no
    // room for. Surface them as unhandled rather than silently dropping them, whatever the trigger.
    if (e.scope !== 'skill') { effectsUnparsed.push(e.source); continue }
    if (!ACTIVE_TRIGGERS.has(e.trigger)) continue
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
  // Bucket by registry slot, not by id: every Fragile/Protection variant belongs to the side being
  // hit. Ids missing from the registry fall to the attacker side and contribute 0 there anyway.
  // Scoped variants (Fragile (Slash), Damage Up (Pride), ...) only count for a matching attack:
  // the attacker's own stacks against its own skill, the Fragile family against the opponent's.
  const myAttack = skill ? { damageType: skill.damageType, sin: skill.sin } : undefined
  const theirAttack = opponent?.skill ? { damageType: opponent.skill.damageType, sin: opponent.skill.sin } : undefined
  const targetStacks = stacks.filter(s => getEffectById(s.effectId)?.slot === TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, theirAttack))
  const attackerStacks = stacks.filter(s => getEffectById(s.effectId)?.slot !== TARGET_SIDE_SLOT && isEffectApplicable(s.effectId, myAttack))
  // Coin Boost / Coin Drop modify Coin Power itself, so they land after effects and manual overrides.
  coinPower += sumCoinPowerBonus(attackerStacks)
  const poise = self.status['poise'] ?? { potency: 0, count: 0 }
  const sanity = Math.min(45, Math.max(-45, self.sanity))

  // The [-1, 1] clamps inside calculateDynamicModifier apply per side: the attacker's Damage
  // Up/Down is clamped separately from the target's Fragile/Protection, never as one pooled sum.
  // That only diverges from clamping the pool once a single side exceeds the clamp on its own.
  const dynamicAsAttacker = calculateDynamicModifier(attackerStacks, false)
  const dynamicAsTarget = calculateDynamicModifier(targetStacks, false)
  const critOnlyModifier = calculateDynamicModifier(attackerStacks, true) - dynamicAsAttacker

  return {
    basePower,
    coinPower,
    coinCount: skill?.coinCount ?? 0,
    unbreakableCoins: skill ? countUnbreakableCoins(skill) : 0,
    headsChance: (50 + sanity) / 100,
    offenseLevel: self.level + (skill?.offenseLevelMod ?? 0),
    defenseLevel: self.level + self.unit.defenseMod,
    clashPowerBonus,
    damagePercent,
    coinRollBonus: sumCoinRollBonus(attackerStacks),
    critChance: Math.min(1, poise.potency * 0.05),
    poiseCount: poise.count,
    dynamicAsAttacker,
    critOnlyModifier,
    dynamicAsTarget,
    maxHp: self.unit.hp,
    currentHp: self.currentHp ?? self.unit.hp,
    sin: skill?.sin ?? 'wrath',
    damageType: skill?.damageType ?? 'none',
    effectsApplied,
    effectsUnparsed,
  }
}
```

(`applyUptie`, `countUnbreakableCoins`, and `holds` are unchanged.)

- [ ] **Step 5: Guards in `report.ts`, columns in `matchup.ts`**

At the top of `clashReport` in `packages/engine/src/report.ts` add:

```ts
  if (!a.skill || !b.skill) throw new Error('clashReport: both combatants need a skill')
```

At the top of `unopposedReport` add:

```ts
  if (!attacker.skill) throw new Error('unopposedReport: the attacker needs a skill')
```

Replace `enemyCombatant`, the `columnCombatants` construction, the cell body, and the `columns` mapping in `packages/engine/src/matchup.ts`:

```ts
export function enemyCombatant(unit: Unit, skill: Skill | undefined): Combatant {
  return { unit, skill, uptie: 4, level: unit.level, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } }
}

export function matchupGrid(team: Combatant[], wave: Unit[], options: ReportOptions = {}): MatchupGrid {
  const rowCombatants = team.flatMap(member =>
    member.unit.skills.filter(isAttack).map(skill => ({ ...member, skill })),
  )
  // A part with no attack skill still takes damage, so it keeps a column; its clash cells are null.
  const columnCombatants = wave.map(unit => enemyCombatant(unit, primaryAttackSkill(unit)))

  const cells: MatchupCell[][] = rowCombatants.map(row =>
    columnCombatants.map(col => {
      const clash = col.skill ? clashReport(row, col, options) : undefined
      const hit = unopposedReport(row, col, options)
      const mult = damageMultipliers(resolveCombatant(row, col), col)
      return {
        attackerSkillId: row.skill.id,
        targetUnitId: col.unit.id,
        targetSkillId: col.skill?.id ?? null,
        win: clash ? clash.win : null,
        medianDamage: hit.damage.p50,
        meanDamage: hit.damage.mean,
        sinMultiplier: mult.sin,
        damageTypeMultiplier: mult.damageType,
      }
    }),
  )

  const columns = columnCombatants.map((col, j) => {
    const bestMean = Math.max(0, ...cells.map(r => r[j].meanDamage))
    return { unitId: col.unit.id, skillId: col.skill?.id ?? null, turnsToKill: bestMean > 0 ? Math.ceil(col.unit.hp / bestMean) : Infinity }
  })

  return {
    rows: rowCombatants.map(r => ({ unitId: r.unit.id, skillId: r.skill.id })),
    columns,
    cells,
  }
}
```

`rowCombatants` spread `{ ...member, skill }` keeps `skill: Skill` for rows; if TypeScript complains about `row.skill.id` being possibly undefined, type the row list as `(Combatant & { skill: Skill })[]`.

- [ ] **Step 6: Run the engine suite and typecheck**

Run: `npm run typecheck -w @limbus/engine && npm test -w @limbus/engine`
Expected: clean and green. Fix any test that constructed `MatchupCell` literals without `targetSkillId: null` typing.

- [ ] **Step 7: Commit**

```bash
git add -A packages/engine
git commit -m "Allow skill-less combatants; keep grid columns for enemy parts with no attack

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 3: Damage stage: shared coin step, power reduction, exact one-path sampler

**Files:**
- Modify: `packages/engine/src/damageDistribution.ts`
- Test: `packages/engine/test/damageDistribution.test.ts`

**Interfaces:**
- Produces: `AttackParams.powerReduction?: number` (flat power stripped from the attack, absorbed by the earliest coins first; default 0). `SampledCoin { heads: boolean; crit: boolean; roll: number; damage: number; staggered: boolean }`, `SampledAttack { coins: SampledCoin[]; total: number; thresholdsCrossed: number }`, `sampleAttack(p: AttackParams, rng?: () => number): SampledAttack`, one random path through exactly the walk `attackDamageDistribution` enumerates.
- Consumed by: Task 4 (guard clash, `sampleClash`) and web Task 9 (Roll once).

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/damageDistribution.test.ts` (add `sampleAttack` to the import):

```ts
/** Deterministic LCG so sampling tests are reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32 }
}

describe('powerReduction', () => {
  it('absorbs the earliest coins first: 9 off rolls 7 and 10 leaves 0 and 8', () => {
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, powerReduction: 9 }))
    expect(d.histogram).toEqual([[8, 1]])
    expect(d.perCoinMean).toEqual([0, 8])
  })
  it('a partial absorption leaves the remainder of the coin: 3 off rolls 7 and 10 is 4 + 10', () => {
    const d = attackDamageDistribution(params({ coins: 2, headsChance: 1, powerReduction: 3 }))
    expect(d.mean).toBe(14)
  })
  it('zero reduction is the unchanged distribution', () => {
    expect(attackDamageDistribution(params({ powerReduction: 0 }))).toEqual(attackDamageDistribution(params()))
  })
})

describe('sampleAttack', () => {
  it('all heads reproduces the walk maximum coin by coin', () => {
    const s = sampleAttack(params({ headsChance: 0.5 }), () => 0)
    expect(s.coins.map(c => c.heads)).toEqual([true, true, true])
    expect(s.coins.map(c => c.damage)).toEqual([7, 10, 13])
    expect(s.total).toBe(30)
  })
  it('all tails with a reduction shows absorbed coins as zero damage', () => {
    const s = sampleAttack(params({ coins: 2, powerReduction: 9 }), () => 0.99)
    expect(s.coins.map(c => c.roll)).toEqual([0, 0])
    expect(s.coins.map(c => c.damage)).toEqual([0, 0])
    expect(s.total).toBe(0)
  })
  it('every sampled total lies in the exact distribution support', () => {
    const p = params({ coins: 3, critChance: 0.5, poiseCount: 2, critModifier: 0.2 })
    const support = new Set(attackDamageDistribution(p).histogram.map(([v]) => v))
    const rng = lcg(7)
    for (let i = 0; i < 300; i++) expect(support.has(sampleAttack(p, rng).total)).toBe(true)
  })
  it('counts thresholds this attack crosses', () => {
    const s = sampleAttack(params({ headsChance: 1, defenderMaxHp: 100, defenderCurrentHp: 100, staggerThresholds: [0.9, 0.7] }), () => 0)
    expect(s.thresholdsCrossed).toBe(2)
    // The second coin crosses the first line; only the coin after it attacks a staggered target.
    expect(s.coins[1].staggered).toBe(false)
    expect(s.coins[2].staggered).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- damageDistribution`
Expected: FAIL, `sampleAttack` is not exported and `powerReduction` is ignored.

- [ ] **Step 3: Implement**

In `packages/engine/src/damageDistribution.ts` add to `AttackParams` (after `staggerMidAttack`):

```ts
  /**
   * Flat power a lost guard clash strips from this attack (spec 6.2). Absorbed by the earliest
   * coins first: a coin whose whole roll is absorbed deals 0, the remainder carries to the next.
   * Default 0.
   */
  powerReduction?: number
```

Add `reductionLeft: number` to the `Walk` interface, and add these helpers below it:

```ts
export interface SampledCoin { heads: boolean; crit: boolean; roll: number; damage: number; staggered: boolean }
export interface SampledAttack { coins: SampledCoin[]; total: number; thresholdsCrossed: number }

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

/** Takes as much of `left` as this coin's roll can absorb. `absorbed` means the whole roll went. */
function absorb(roll: number, left: number): { roll: number; left: number; absorbed: boolean } {
  const used = Math.min(roll, left)
  return { roll: roll - used, left: left - used, absorbed: used > 0 && roll - used <= 0 }
}

/** Damage of one coin given its (possibly reduced) roll and the walk state before it. */
function coinDamage(p: AttackParams, coinRoll: number, crit: boolean, thresholdsCrossed: number, absorbed: boolean): number {
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
    dynamicModifiers: { skillEffects: 0, buffs: p.dynamicModifier + (crit ? p.critOnlyModifier : 0) },
  })
}
```

Rewrite `attackDamageDistribution` to use them:

```ts
export function attackDamageDistribution(p: AttackParams): DamageSummary {
  const histogram = new Map<number, number>()
  const perCoinMean = new Array<number>(p.coins).fill(0)
  const staggerChance = new Array<number>(p.staggerThresholds.length).fill(0)
  const { lines: staggerLines, alreadyCrossed } = staggerLinesFor(p)

  const stack: Walk[] = [{ coinIndex: 0, headsSoFar: 0, total: 0, thresholdsCrossed: alreadyCrossed, poiseCount: p.poiseCount, reductionLeft: p.powerReduction ?? 0, prob: 1 }]
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
        const { roll, left, absorbed } = absorb(p.basePower + p.coinRollBonus + p.coinPower * headsSoFar, w.reductionLeft)
        const damage = coinDamage(p, roll, crit, w.thresholdsCrossed, absorbed)
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
          reductionLeft: left,
          prob,
        })
      }
    }
  }
  return summarize(histogram, perCoinMean, staggerChance)
}

/** One random path through the same walk `attackDamageDistribution` enumerates (for "Roll once"). */
export function sampleAttack(p: AttackParams, rng: () => number = Math.random): SampledAttack {
  const { lines: staggerLines, alreadyCrossed } = staggerLinesFor(p)
  let crossed = alreadyCrossed
  let headsSoFar = 0
  let total = 0
  let poiseCount = p.poiseCount
  let reductionLeft = p.powerReduction ?? 0
  const coins: SampledCoin[] = []
  for (let i = 0; i < p.coins; i++) {
    const heads = rng() < p.headsChance
    const crit = poiseCount > 0 && rng() < Math.min(1, p.critChance)
    if (heads) headsSoFar++
    const { roll, left, absorbed } = absorb(p.basePower + p.coinRollBonus + p.coinPower * headsSoFar, reductionLeft)
    reductionLeft = left
    const staggered = p.staggerMidAttack && crossed > 0
    const damage = coinDamage(p, roll, crit, crossed, absorbed)
    total += damage
    while (crossed < staggerLines.length && total >= staggerLines[crossed]) crossed++
    if (crit) poiseCount--
    coins.push({ heads, crit, roll, damage, staggered })
  }
  return { coins, total, thresholdsCrossed: crossed - alreadyCrossed }
}
```

The walk consumes `rng()` for heads first and for crit second on every coin, and skips the crit draw when `poiseCount` is 0, so `() => 0` is "all heads, all crits when possible" and `() => 0.99` is "all tails, no crits".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- damageDistribution`
Expected: all pass, including the pre-existing accumulation and stagger tests (the refactor must not change any existing expectation).

- [ ] **Step 5: Full engine check and commit**

Run: `npm run typecheck -w @limbus/engine && npm test -w @limbus/engine`

```bash
git add packages/engine
git commit -m "Add guard power reduction and an exact one-path sampler to the damage stage

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 4: Guard clash (spec 6.2) and `sampleClash`

**Files:**
- Modify: `packages/engine/src/report.ts`, `packages/engine/README.md`
- Test: `packages/engine/test/report.test.ts`

**Interfaces:**
- Produces: `attackContext(attacker: ResolvedCombatant, target: ResolvedCombatant, targetCombatant: Combatant, parryBonus: number, options: ReportOptions): { params: Omit<AttackParams, 'coins' | 'powerReduction'>; breakdown: BreakdownLine[] }`; `clashReport` takes the guard path when exactly one side's skill has `damageType === 'guard'` and the other is an attack (`slash | pierce | blunt`); `ClashSample { outcome: 'win' | 'lose' | 'draw'; coinsLeft: number; guardReduction: number; attack?: SampledAttack }`; `sampleClash(a: Combatant, b: Combatant, options?: ReportOptions, rng?: () => number, report?: ClashReport): ClashSample`.
- Guard model (spec 6.2): one round. Attacker power `base + coinPower * heads + clashPowerBonus + floor(max(offense - guardDefense, 0) / 3)`; guard power `base + coinPower * heads + clashPowerBonus + floor(max(guardDefense - offense, 0) / 3)`; heads binomial over every coin of each skill. Ties re-roll (conditioning on a decided round; `parryRoundsExpected = tie / (1 - tie)`); a round that can only tie is a guaranteed draw. If the guard wins the attack lands nothing. If the attacker wins, the attack runs with all its coins and `powerReduction` equal to the guard's final power, mixed over the guard-power distribution conditional on the attacker winning. The guard deals no damage.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/test/report.test.ts` (import `sampleClash` too):

```ts
describe('guard clash (spec 6.2)', () => {
  // Attacker: 1 coin, base 5, coin 3, heads 50% -> power 5 or 8. Guard: 1 coin, base 4, coin 2 -> 4 or 6.
  // Same level both sides so neither gets a level bonus. Attacker wins on (5,4), (8,4), (8,6): 75%.
  const attacker = makeCombatant({ skill: makeSkill({ id: 'atk', basePower: 5, coinPower: 3, coinCount: 1 }) })
  const guard = makeCombatant({ unit: makeUnit({ id: 'g' }), skill: makeSkill({ id: 'grd', damageType: 'guard', basePower: 4, coinPower: 2, coinCount: 1 }) })

  it('resolves in one round with the guard power distribution conditional on losing', () => {
    const r = clashReport(attacker, guard)
    expect(r.win).toBeCloseTo(0.75)
    expect(r.lose).toBeCloseTo(0.25)
    expect(r.draw).toBe(0)
    expect(r.parryRoundsExpected).toBe(0)
    expect(r.coinsLeftIfWin).toEqual([0, 1])
    // Given the attacker won: guard power 4 with 2/3, 6 with 1/3. Attack roll 5 or 8 each 50%.
    // Reduced rolls: (5-4=1, 8-4=4) and (5-6 -> absorbed 0, 8-6=2). Mean = 2/3*2.5 + 1/3*1 = 2.
    expect(r.damageDealt.mean).toBeCloseTo(2)
    expect(r.damageTaken.mean).toBe(0)
    expect(r.breakdown.find(l => l.label === 'Guard reduction')?.value).toBeCloseTo(4 * 2 / 3 + 6 / 3)
  })
  it('mirrors the report when the guard is side A', () => {
    const r = clashReport(guard, attacker)
    expect(r.win).toBeCloseTo(0.25)
    expect(r.lose).toBeCloseTo(0.75)
    expect(r.damageDealt.mean).toBe(0)
    expect(r.damageTaken.mean).toBeCloseTo(2)
  })
  it('reports a guaranteed draw when every outcome ties', () => {
    const a = makeCombatant({ skill: makeSkill({ basePower: 4, coinPower: 0, coinCount: 1 }) })
    const g = makeCombatant({ unit: makeUnit({ id: 'g' }), skill: makeSkill({ damageType: 'guard', basePower: 4, coinPower: 0, coinCount: 1 }) })
    const r = clashReport(a, g)
    expect(r.draw).toBe(1)
    expect(r.win).toBe(0)
    expect(r.damageDealt.histogram).toEqual([[0, 1]])
  })
  it('leaves guard versus guard on the ordinary chain', () => {
    const g1 = makeCombatant({ skill: makeSkill({ damageType: 'guard', coinCount: 2 }) })
    const g2 = makeCombatant({ unit: makeUnit({ id: 'g2' }), skill: makeSkill({ damageType: 'guard', coinCount: 1 }) })
    const r = clashReport(g1, g2)
    expect(r.win + r.lose + r.draw).toBeCloseTo(1)
    expect(r.coinsLeftIfWin.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1)
  })
})

describe('sampleClash', () => {
  const a = makeCombatant({ sanity: 45, skill: makeSkill({ coinCount: 2 }) })
  const b = makeCombatant({ unit: makeUnit({ id: 'b' }), skill: makeSkill({ coinCount: 1 }) })
  const seq = (values: number[]) => { let i = 0; return () => values[Math.min(i++, values.length - 1)] }

  it('maps the first draw onto win, lose, draw in that order', () => {
    const report = clashReport(a, b)
    expect(sampleClash(a, b, {}, seq([report.win / 2]), report).outcome).toBe('win')
    expect(sampleClash(a, b, {}, seq([report.win + report.lose / 2]), report).outcome).toBe('lose')
    expect(sampleClash(a, b, {}, seq([0.999999]), report).outcome).toBe(report.draw > 0 ? 'draw' : 'lose')
  })
  it('samples coins left from the report distribution and one attack path of that length', () => {
    const report = clashReport(a, b)
    const s = sampleClash(a, b, {}, seq([0, 0.999999, 0, 0, 0, 0]), report)
    expect(s.outcome).toBe('win')
    expect(s.coinsLeft).toBe(report.coinsLeftIfWin.length - 1)
    expect(s.attack?.coins).toHaveLength(s.coinsLeft)
    expect(s.attack?.total).toBe(s.attack?.coins.reduce((t, c) => t + c.damage, 0))
  })
  it('returns no attack on a draw or when the winner cannot attack', () => {
    const guard = makeCombatant({ unit: makeUnit({ id: 'g' }), skill: makeSkill({ damageType: 'guard', basePower: 99, coinCount: 1 }) })
    const s = sampleClash(a, guard, {}, seq([0.999999]))
    expect(s.outcome).toBe('lose')
    expect(s.attack).toBeUndefined()
  })
  it('carries the sampled guard power into the attack on a lost guard clash', () => {
    const attacker = makeCombatant({ skill: makeSkill({ basePower: 5, coinPower: 3, coinCount: 1 }) })
    const guard = makeCombatant({ unit: makeUnit({ id: 'g' }), skill: makeSkill({ damageType: 'guard', basePower: 4, coinPower: 2, coinCount: 1 }) })
    const s = sampleClash(attacker, guard, {}, seq([0, 0, 0.9, 0, 0]))
    expect(s.outcome).toBe('win')
    expect([4, 6]).toContain(s.guardReduction)
    expect(s.attack?.coins[0].roll).toBe(8 - s.guardReduction)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/engine -- report`
Expected: FAIL, `sampleClash` missing; the guard case runs the multi-round chain and reports non-zero `damageTaken`.

- [ ] **Step 3: Implement in `report.ts`**

Replace the file's contents with:

```ts
import { binomialPmf } from './binomial'
import { clashChain, type ClashSide } from './clashChain'
import { criticalDamageModifier } from './criticalModifier'
import { attackDamageDistribution, mixDistributions, sampleAttack, type AttackParams, type SampledAttack } from './damageDistribution'
import { offenseDefenseAdvantage } from './offenseDefenseAdvantage'
import { parryRoundBonus } from './parryBonus'
import { resistanceModifier } from './resistance'
import { resolveCombatant } from './resolveCombatant'
import type { BreakdownLine, ClashReport, Combatant, DamageSummary, ResolvedCombatant, Skill, UnopposedReport } from './types'

export interface ReportOptions { staggerMidAttack?: boolean }

export interface AttackContext {
  params: Omit<AttackParams, 'coins' | 'powerReduction'>
  breakdown: BreakdownLine[]
}

export interface ClashSample {
  outcome: 'win' | 'lose' | 'draw'
  /** Coins the winner attacks with (0 on a draw). */
  coinsLeft: number
  /** Guard final power taken off the attack when the loser guarded; 0 otherwise. */
  guardReduction: number
  /** Absent on a draw or when the winner's skill cannot attack (guard, evade, none). */
  attack?: SampledAttack
}

export function damageMultipliers(attacker: ResolvedCombatant, target: Combatant): { sin: number; damageType: number } {
  const dt = attacker.damageType
  return {
    sin: target.unit.resistances.sin[attacker.sin],
    damageType: dt === 'slash' || dt === 'pierce' || dt === 'blunt' ? target.unit.resistances.damageType[dt] : 1,
  }
}

function isAttackSkill(skill: Skill | undefined): boolean {
  const dt = skill?.damageType
  return dt === 'slash' || dt === 'pierce' || dt === 'blunt'
}

function isGuard(skill: Skill | undefined): boolean {
  return skill?.damageType === 'guard'
}

export function clashReport(a: Combatant, b: Combatant, options: ReportOptions = {}): ClashReport {
  if (!a.skill || !b.skill) throw new Error('clashReport: both combatants need a skill')
  if (isGuard(b.skill) && isAttackSkill(a.skill)) {
    const g = guardClash(a, b, options)
    return {
      win: g.attackerWins, lose: g.guardWins, draw: g.draw,
      coinsLeftIfWin: oneHot(g.attackerCoins), coinsLeftIfLose: oneHot(g.guardCoins),
      parryRoundsExpected: g.parryRoundsExpected,
      damageDealt: g.attackDamage, damageTaken: g.noDamage, breakdown: g.breakdown,
    }
  }
  if (isGuard(a.skill) && isAttackSkill(b.skill)) {
    const g = guardClash(b, a, options)
    return {
      win: g.guardWins, lose: g.attackerWins, draw: g.draw,
      coinsLeftIfWin: oneHot(g.guardCoins), coinsLeftIfLose: oneHot(g.attackerCoins),
      parryRoundsExpected: g.parryRoundsExpected,
      damageDealt: g.noDamage, damageTaken: g.attackDamage, breakdown: g.breakdown,
    }
  }
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
  if (!attacker.skill) throw new Error('unopposedReport: the attacker needs a skill')
  const ra = resolveCombatant(attacker, target)
  const rt = resolveCombatant(target, attacker)
  const weights = new Array<number>(ra.coinCount + 1).fill(0)
  weights[ra.coinCount] = 1
  const { summary, breakdown } = conditionalDamage(ra, rt, target, weights, 1, 0, options)
  return { damage: summary, breakdown }
}

/**
 * One random outcome of the clash: who won, how many coins they attack with, and one exact path
 * through the damage stage. Pass the report you already computed to skip recomputing it.
 */
export function sampleClash(a: Combatant, b: Combatant, options: ReportOptions = {}, rng: () => number = Math.random, report: ClashReport = clashReport(a, b, options)): ClashSample {
  const u = rng()
  const outcome: ClashSample['outcome'] = u < report.win ? 'win' : u < report.win + report.lose ? 'lose' : 'draw'
  if (outcome === 'draw') return { outcome, coinsLeft: 0, guardReduction: 0 }
  const [winner, loser] = outcome === 'win' ? [a, b] : [b, a]
  const coinsLeft = sampleIndex(outcome === 'win' ? report.coinsLeftIfWin : report.coinsLeftIfLose, rng())
  if (!isAttackSkill(winner.skill)) return { outcome, coinsLeft, guardReduction: 0 }
  const rw = resolveCombatant(winner, loser)
  const rl = resolveCombatant(loser, winner)
  const guardReduction = isGuard(loser.skill) ? sampleWeighted(guardRound(rw, rl).reductionIfAttackerWins, rng()) : 0
  const ctx = attackContext(rw, rl, loser, parryRoundBonus(report.parryRoundsExpected), options)
  return { outcome, coinsLeft, guardReduction, attack: sampleAttack({ ...ctx.params, coins: coinsLeft, powerReduction: guardReduction }, rng) }
}

/** Everything the damage stage needs except the coin count, plus the modifier breakdown. */
export function attackContext(attacker: ResolvedCombatant, target: ResolvedCombatant, targetCombatant: Combatant, parryBonus: number, options: ReportOptions): AttackContext {
  const mult = damageMultipliers(attacker, targetCombatant)
  const params: AttackContext['params'] = {
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
    critOnlyModifier: attacker.critOnlyModifier,
    defenderMaxHp: target.maxHp,
    defenderCurrentHp: target.currentHp,
    staggerThresholds: targetCombatant.unit.staggerThresholds,
    staggerMidAttack: options.staggerMidAttack ?? true,
  }
  const breakdown: BreakdownLine[] = [
    { label: 'Base power', value: attacker.basePower, source: 'skill + uptie + effects + manual' },
    { label: 'Coin power', value: attacker.coinPower, source: 'skill + uptie + effects + manual' },
    { label: 'Heads chance', value: attacker.headsChance, source: '50 + SP, clamped to [-45, 45]' },
    { label: 'Sin resistance', value: params.sinResistance, source: `x${mult.sin} ${attacker.sin} on target` },
    { label: 'Damage type resistance', value: params.damageTypeResistance, source: `x${mult.damageType} ${attacker.damageType} on target` },
    { label: 'Offense-defense advantage', value: params.offenseDefenseAdvantage, source: `offense ${attacker.offenseLevel} vs defense ${target.defenseLevel}` },
    { label: 'Parry bonus', value: parryBonus, source: 'expected parry rounds x 0.03' },
    { label: 'Dynamic modifier', value: params.dynamicModifier, source: 'Damage Up/Down, Fragile/Protection, damage % effects' },
    { label: 'Crit chance', value: attacker.critChance, source: 'Poise potency x 5%' },
  ]
  return { params, breakdown }
}

function toSide(r: ResolvedCombatant): ClashSide {
  return {
    basePower: r.basePower,
    coinPower: r.coinPower,
    breakableCoins: Math.max(0, r.coinCount - r.unbreakableCoins),
    unbreakableCoins: r.unbreakableCoins,
    headsChance: r.headsChance,
    offenseLevel: r.offenseLevel,
    clashPowerBonus: r.clashPowerBonus,
  }
}

function oneHot(coins: number): number[] {
  const out = new Array<number>(coins + 1).fill(0)
  out[coins] = 1
  return out
}

function sampleIndex(weights: number[], u: number): number {
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (u < acc) return i
  }
  return weights.length - 1
}

function sampleWeighted(pairs: [number, number][], u: number): number {
  let acc = 0
  for (const [value, weight] of pairs) {
    acc += weight
    if (u < acc) return value
  }
  return pairs.length > 0 ? pairs[pairs.length - 1][0] : 0
}

interface GuardRound {
  attackerWins: number
  guardWins: number
  tie: number
  /** Guard final power and its probability, conditional on the attacker winning the round. */
  reductionIfAttackerWins: [number, number][]
}

/**
 * Spec 6.2: one round, every coin of both skills flipped. The guard's level bonus comes from its
 * Defense Level against the attacker's Offense Level; the attacker's from the reverse difference.
 */
function guardRound(attacker: ResolvedCombatant, guard: ResolvedCombatant): GuardRound {
  const aHeads = binomialPmf(attacker.coinCount, attacker.headsChance)
  const gHeads = binomialPmf(guard.coinCount, guard.headsChance)
  const aBonus = attacker.clashPowerBonus + Math.floor(Math.max(attacker.offenseLevel - guard.defenseLevel, 0) / 3)
  const gBonus = guard.clashPowerBonus + Math.floor(Math.max(guard.defenseLevel - attacker.offenseLevel, 0) / 3)
  let attackerWins = 0
  let guardWins = 0
  let tie = 0
  const reduction = new Map<number, number>()
  aHeads.forEach((pa, h) => {
    gHeads.forEach((pg, g) => {
      const p = pa * pg
      if (p === 0) return
      const attackPower = attacker.basePower + attacker.coinPower * h + aBonus
      const guardPower = guard.basePower + guard.coinPower * g + gBonus
      if (attackPower > guardPower) {
        attackerWins += p
        reduction.set(guardPower, (reduction.get(guardPower) ?? 0) + p)
      } else if (guardPower > attackPower) {
        guardWins += p
      } else {
        tie += p
      }
    })
  })
  const reductionIfAttackerWins = [...reduction.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([power, p]) => [power, p / attackerWins] as [number, number])
  return { attackerWins, guardWins, tie, reductionIfAttackerWins }
}

interface GuardClash {
  attackerWins: number
  guardWins: number
  draw: number
  parryRoundsExpected: number
  attackerCoins: number
  guardCoins: number
  /** Attack damage conditional on the attacker winning, reduced by the guard's final power. */
  attackDamage: DamageSummary
  /** The guard's (empty) attack, shaped like a real summary so consumers need no special case. */
  noDamage: DamageSummary
  breakdown: BreakdownLine[]
}

function guardClash(attacker: Combatant, guard: Combatant, options: ReportOptions): GuardClash {
  const ra = resolveCombatant(attacker, guard)
  const rg = resolveCombatant(guard, attacker)
  const round = guardRound(ra, rg)
  const decided = 1 - round.tie
  const parryRoundsExpected = decided > 0 ? round.tie / decided : 0
  const ctx = attackContext(ra, rg, guard, parryRoundBonus(parryRoundsExpected), options)
  const parts = round.reductionIfAttackerWins.map(([power, weight]) => ({
    weight,
    summary: attackDamageDistribution({ ...ctx.params, coins: ra.coinCount, powerReduction: power }),
  }))
  const attackDamage = parts.length > 0 ? mixDistributions(parts) : attackDamageDistribution({ ...ctx.params, coins: 0 })
  const expectedReduction = round.reductionIfAttackerWins.reduce((s, [power, weight]) => s + power * weight, 0)
  const breakdown = [...ctx.breakdown, { label: 'Guard reduction', value: expectedReduction, source: 'guard final power given the guard lost; absorbed by the earliest coins' }]
  const noDamage = attackDamageDistribution({ ...attackContext(rg, ra, attacker, 0, options).params, coins: 0 })
  return {
    attackerWins: decided > 0 ? round.attackerWins / decided : 0,
    guardWins: decided > 0 ? round.guardWins / decided : 0,
    draw: decided > 0 ? 0 : 1,
    parryRoundsExpected,
    attackerCoins: ra.coinCount,
    guardCoins: rg.coinCount,
    attackDamage,
    noDamage,
    breakdown,
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
  const { params, breakdown } = attackContext(attacker, target, targetCombatant, parryBonus, options)
  // Guard, Evade and other non-damaging skills still clash, but they land no attack: report a
  // zero summary rather than running the attack math on a damage type the target cannot resist.
  const dt = attacker.damageType
  if (dt !== 'slash' && dt !== 'pierce' && dt !== 'blunt') {
    return { summary: attackDamageDistribution({ ...params, coins: 0 }), breakdown }
  }
  const parts = coinWeights
    .map((w, coins) => ({ weight: totalWeight > 0 ? w / totalWeight : 0, coins }))
    .filter(p => p.weight > 0)
    .map(p => ({ weight: p.weight, summary: attackDamageDistribution({ ...params, coins: p.coins }) }))
  const summary = parts.length > 0 ? mixDistributions(parts) : attackDamageDistribution({ ...params, coins: 0 })
  return { summary, breakdown }
}
```

If `report.ts` had other private helpers not shown here (check the current file before replacing), keep them verbatim.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @limbus/engine -- report`
Expected: all pass, including the pre-existing report tests.

- [ ] **Step 5: Document in `packages/engine/README.md`**

Add to the entry-point list: ``- `sampleClash(a, b, options?, rng?, report?)`: one random clash outcome plus one exact damage path, for coin-by-coin reveals.`` Add under Known simplifications (v1):

```markdown
- Guard clash (spec 6.2) is one round: the guard's level bonus uses its Defense Level, ties re-roll,
  and when the guard loses its final power is taken off the attack's coin rolls earliest coin first
  (a fully absorbed coin deals 0). The guard itself deals no damage. Evade skills still use the
  ordinary multi-round chain.
- Type- and sin-scoped statuses (Fragile (Slash), Damage Up (Pride), ...) count only for a matching
  attacking skill; with no opponent known every variant counts.
```

- [ ] **Step 6: Full engine check and commit**

Run: `npm run typecheck -w @limbus/engine && npm test -w @limbus/engine`

```bash
git add packages/engine
git commit -m "Model guard clashes as a one-round chain with power reduction; add sampleClash

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 5: `apps/web` scaffold: Vite, Tailwind, router, data loading, CI lint and build

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/scripts/sync-data.mjs`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`, `apps/web/src/lib/router.ts`, `apps/web/src/lib/data.ts`, `apps/web/src/lib/images.ts`, `apps/web/src/lib/format.ts`, `apps/web/src/components/DataStatus.tsx`, `apps/web/test/fixtures.ts`, `apps/web/test/router.test.ts`, `apps/web/test/data.test.ts`, `apps/web/test/images.test.ts`
- Modify: `package.json` (root scripts), `.gitignore`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `Route`, `parseRoute(pathname, search, base?)`, `href(path, search?)`, `navigate(to, replace?)`, `useRoute()`; `GameData`, `RawData`, `indexData(raw)`, `loadGameData(base?, fetchImpl?)`, `useGameData()`; `imageUrl(images, filename, base?)`, `portraitUrl(images, unit, base?)`, `skillIconUrl(images, skill, base?)`; `pct(x, digits?)`, `num(x)`, `signed(x)`. Test helpers `makeSkill`, `makeUnit`, `makeRaw`.
- Consumed by: every later web task.

- [ ] **Step 1: Package files**

`apps/web/package.json`:

```json
{
  "name": "@limbus/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "predev": "node scripts/sync-data.mjs",
    "dev": "vite",
    "prebuild": "node scripts/sync-data.mjs",
    "build": "tsc -p tsconfig.json && vite build && cp dist/index.html dist/404.html",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json",
    "lint": "oxlint src test",
    "test": "vitest run"
  },
  "dependencies": {
    "@limbus/engine": "*",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "zustand": "^5.0.15"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "oxlint": "^1.83.0",
    "tailwindcss": "^4.3.3",
    "vite": "^8.3.0"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "allowImportingTsExtensions": true
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VITE_BASE is set by the Pages deploy to "/<repo>/"; local dev and preview serve from "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['../..'] } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
})
```

`apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
      rel="stylesheet"
    />
    <title>Limbus Calculator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/scripts/sync-data.mjs`:

```js
// Copies the committed data set and the (git-ignored) downloaded images into public/ so Vite
// serves them as static assets. Runs before dev and build. `--force` re-copies the images.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const out = path.join(root, 'packages/data/out')
const images = path.join(root, 'packages/data/images')
const publicDir = path.resolve(here, '../public')
const force = process.argv.includes('--force')

rmSync(path.join(publicDir, 'data'), { recursive: true, force: true })
mkdirSync(path.join(publicDir, 'data'), { recursive: true })
cpSync(out, path.join(publicDir, 'data'), { recursive: true })
console.log(`sync-data: copied ${out} -> public/data`)

const imagesDest = path.join(publicDir, 'images')
if (!existsSync(images)) {
  console.warn('sync-data: packages/data/images is missing; portraits and icons will not load. Run: npm run scrape:images -w @limbus/data')
} else if (force || !existsSync(imagesDest)) {
  rmSync(imagesDest, { recursive: true, force: true })
  cpSync(images, imagesDest, { recursive: true })
  console.log(`sync-data: copied ${images} -> public/images`)
} else {
  console.log('sync-data: public/images already present (pass --force to refresh)')
}
```

Append to `.gitignore`:

```
# Copied from packages/data by apps/web/scripts/sync-data.mjs
apps/web/public/data/
apps/web/public/images/
```

Root `package.json` scripts become:

```json
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "build": "npm run build --workspaces --if-present"
  },
```

Run: `npm install`
Expected: `apps/web` appears in the workspace tree, `node_modules/react` resolves, no peer warnings about `vite`.

- [ ] **Step 2: Write the failing tests**

`apps/web/test/fixtures.ts`:

```ts
import type { Skill, Unit } from '@limbus/engine'
import type { RawData } from '../src/lib/data.ts'

const flatSin = { wrath: 1, lust: 1, sloth: 1, gluttony: 1, gloom: 1, pride: 1, envy: 1 }

export function makeSkill(over: Partial<Skill> = {}): Skill {
  return {
    id: 'u::skill1', name: 'Test Skill', slot: 'skill1', sin: 'wrath', damageType: 'slash', icon: 'Test Skill Icon',
    offenseLevelMod: 0, basePower: 4, coinPower: 3, coinCount: 2, unbreakableCoins: [],
    attackWeight: 1, uptie: {}, effects: [], rawText: { skill: '', coins: ['', ''] }, ...over,
  }
}

export function makeUnit(over: Partial<Unit> = {}): Unit {
  return {
    id: 'u', kind: 'identity', name: 'Test Unit', group: 'Yi Sang', portrait: 'Test Unit Full.png', level: 60, hp: 200, hpGrowth: 2,
    speed: { min: 3, max: 6 }, defenseMod: 0,
    resistances: { damageType: { slash: 1, pierce: 1, blunt: 1 }, sin: { ...flatSin } },
    staggerThresholds: [0.7, 0.4], skills: [makeSkill()], passives: [], ...over,
  }
}

export function makeRaw(over: Partial<RawData> = {}): RawData {
  const identity = makeUnit()
  const partA = makeUnit({ id: '9568:0', kind: 'enemy', name: 'Inverted Scale', group: 'Refracted Yinglong', portrait: 'Yinglong-9568_portrait.png', skills: [makeSkill({ id: '9568:0::skill1', slot: 'enemy' })] })
  const partB = makeUnit({ id: '9568:1', kind: 'enemy', name: 'Head', group: 'Refracted Yinglong', portrait: 'Yinglong-9568_portrait.png', skills: [] })
  return {
    identities: [identity],
    enemies: [partA, partB],
    railway: {
      title: 'Line 6', start: 'May 28th, 2026',
      stations: [{ number: 1, name: 'Weighing of Robes' }, { number: 2, name: 'Tarnishing' }],
      sections: [{ number: 1, name: 'Weighing of Robes', stationNumbers: [1], waves: [{ number: 1, enemyIds: ['9568'], reinforcementIds: [] }] }],
      enemyIds: ['9568'],
    },
    meta: { scrapedAt: '2026-09-20T00:00:00Z', levelCap: 60, railwayLine: 'Line 6', identityCount: 1, enemyUnitCount: 2, effectParseCoverage: { total: 10, parsed: 4, ratio: 0.4 } },
    images: { 'Test Unit Full.png': 'Test Unit Full.png', 'Test Skill Icon.png': 'Test Skill Icon.png', 'Yinglong-9568_portrait.png': 'Yinglong-9568_portrait.png', 'Missing.png': null },
    ...over,
  }
}
```

`apps/web/test/router.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { href, parseRoute } from '../src/lib/router.ts'

describe('parseRoute', () => {
  it('maps the root and /railway under a base path', () => {
    expect(parseRoute('/LimbusCalculator/', '', '/LimbusCalculator/').name).toBe('clash')
    expect(parseRoute('/LimbusCalculator/railway', '?station=2', '/LimbusCalculator/')).toMatchObject({ name: 'railway' })
    expect(parseRoute('/LimbusCalculator/railway', '?station=2', '/LimbusCalculator/').search.get('station')).toBe('2')
  })
  it('works with the default base and trailing slashes', () => {
    expect(parseRoute('/', '', '/').name).toBe('clash')
    expect(parseRoute('/railway/', '', '/').name).toBe('railway')
  })
  it('reports unknown paths', () => {
    expect(parseRoute('/nope', '', '/')).toEqual({ name: 'not-found', path: '/nope' })
  })
})

describe('href', () => {
  it('joins base, path and query', () => {
    expect(href('/railway', new URLSearchParams({ station: '3' }), '/LimbusCalculator/')).toBe('/LimbusCalculator/railway?station=3')
    expect(href('/', undefined, '/')).toBe('/')
    expect(href('/', new URLSearchParams(), '/')).toBe('/')
  })
})
```

`apps/web/test/data.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { indexData, loadGameData } from '../src/lib/data.ts'
import { makeRaw } from './fixtures.ts'

describe('indexData', () => {
  const data = indexData(makeRaw())
  it('indexes units and skills by id', () => {
    expect(data.unitsById.get('u')?.name).toBe('Test Unit')
    expect(data.unitsById.get('9568:1')?.name).toBe('Head')
    expect(data.skillsById.get('9568:0::skill1')?.slot).toBe('enemy')
  })
  it('groups enemy parts by their numeric enemy id in part order', () => {
    expect(data.unitsByEnemyId.get('9568')?.map(u => u.id)).toEqual(['9568:0', '9568:1'])
    expect(data.unitsByEnemyId.get('9553')).toBeUndefined()
  })
  it('keeps the raw collections', () => {
    expect(data.identities).toHaveLength(1)
    expect(data.railway.sections[0].stationNumbers).toEqual([1])
  })
})

describe('loadGameData', () => {
  it('fetches the five files under base/data and indexes them', async () => {
    const raw = makeRaw()
    const requested: string[] = []
    const fetchImpl = (async (url: string) => {
      requested.push(url)
      const name = url.split('/').pop()!.replace('.json', '') as keyof typeof raw
      return new Response(JSON.stringify(raw[name]), { status: 200 })
    }) as unknown as typeof fetch
    const data = await loadGameData('/LimbusCalculator/', fetchImpl)
    expect(requested.sort()).toEqual([
      '/LimbusCalculator/data/enemies.json', '/LimbusCalculator/data/identities.json', '/LimbusCalculator/data/images.json',
      '/LimbusCalculator/data/meta.json', '/LimbusCalculator/data/railway.json',
    ])
    expect(data.meta.levelCap).toBe(60)
  })
  it('names the file that failed', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch
    await expect(loadGameData('/', fetchImpl)).rejects.toThrow(/\.json \(HTTP 404\)/)
  })
})
```

`apps/web/test/images.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { imageUrl, portraitUrl, skillIconUrl } from '../src/lib/images.ts'
import { makeRaw, makeSkill, makeUnit } from './fixtures.ts'

const images = makeRaw().images

describe('image urls', () => {
  it('resolves a manifest entry under base/images with the path segment encoded', () => {
    expect(imageUrl(images, 'Test Unit Full.png', '/LimbusCalculator/')).toBe('/LimbusCalculator/images/Test%20Unit%20Full.png')
  })
  it('returns undefined for missing filenames and null manifest entries', () => {
    expect(imageUrl(images, undefined, '/')).toBeUndefined()
    expect(imageUrl(images, 'Missing.png', '/')).toBeUndefined()
    expect(imageUrl(images, 'Not in manifest.png', '/')).toBeUndefined()
  })
  it('derives portrait and icon filenames from units and skills', () => {
    expect(portraitUrl(images, makeUnit(), '/')).toBe('/images/Test%20Unit%20Full.png')
    expect(skillIconUrl(images, makeSkill(), '/')).toBe('/images/Test%20Skill%20Icon.png')
    expect(skillIconUrl(images, makeSkill({ icon: undefined }), '/')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -w @limbus/web`
Expected: FAIL, cannot find `../src/lib/router.ts`, `data.ts`, `images.ts`.

- [ ] **Step 4: Implement the libraries**

`apps/web/src/lib/router.ts`:

```ts
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'clash'; search: URLSearchParams }
  | { name: 'railway'; search: URLSearchParams }
  | { name: 'not-found'; path: string }

export type Path = '/' | '/railway'

function trimBase(base: string): string {
  return base.replace(/\/$/, '')
}

export function parseRoute(pathname: string, search: string, base: string = import.meta.env.BASE_URL): Route {
  const prefix = trimBase(base)
  const rel = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const path = rel.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search)
  if (path === '/') return { name: 'clash', search: params }
  if (path === '/railway') return { name: 'railway', search: params }
  return { name: 'not-found', path }
}

export function href(path: Path, search?: URLSearchParams, base: string = import.meta.env.BASE_URL): string {
  const query = search && [...search.keys()].length > 0 ? `?${search.toString()}` : ''
  const prefix = trimBase(base)
  return `${prefix}${path === '/' && prefix ? '/' : path}${query}`
}

/** Push (or replace) a URL and notify every `useRoute` subscriber. */
export function navigate(to: string, replace = false): void {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const read = () => parseRoute(location.pathname, location.search)
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    addEventListener('popstate', onChange)
    return () => removeEventListener('popstate', onChange)
  }, [])
  return route
}

/** Left-click handler for internal links: same-tab navigation without a reload. */
export function onLinkClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void; currentTarget: { href: string } }): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(new URL(event.currentTarget.href).pathname + new URL(event.currentTarget.href).search)
}
```

`apps/web/src/lib/data.ts`:

```ts
import { useEffect, useState } from 'react'
import type { Skill, Unit } from '@limbus/engine'

// Mirrors packages/data/src/railway/parse.ts. Kept here so the web app has no build-time
// dependency on the scraper package.
export interface RailwayWave { number: number; enemyIds: string[]; reinforcementIds: string[] }
export interface RailwaySection { number: number; name: string; stationNumbers: number[]; waves: RailwayWave[] }
export interface RailwayStation { number: number; name: string }
export interface RailwayLine { title: string; start: string; stations: RailwayStation[]; sections: RailwaySection[]; enemyIds: string[] }
export interface Meta {
  scrapedAt: string
  levelCap: number
  railwayLine: string
  identityCount: number
  enemyUnitCount: number
  effectParseCoverage: { total: number; parsed: number; ratio: number }
}
export type ImageManifest = Record<string, string | null>

export interface RawData {
  identities: Unit[]
  enemies: Unit[]
  railway: RailwayLine
  meta: Meta
  images: ImageManifest
}

export interface GameData extends RawData {
  unitsById: Map<string, Unit>
  skillsById: Map<string, Skill>
  /** Enemy parts grouped by the numeric enemy id (the part before ":"), in part order. */
  unitsByEnemyId: Map<string, Unit[]>
}

const FILES = ['identities', 'enemies', 'railway', 'meta', 'images'] as const

export function indexData(raw: RawData): GameData {
  const unitsById = new Map<string, Unit>()
  const skillsById = new Map<string, Skill>()
  const unitsByEnemyId = new Map<string, Unit[]>()
  for (const unit of [...raw.identities, ...raw.enemies]) {
    unitsById.set(unit.id, unit)
    for (const skill of unit.skills) skillsById.set(skill.id, skill)
    if (unit.kind === 'enemy') {
      const enemyId = unit.id.split(':')[0]
      const parts = unitsByEnemyId.get(enemyId) ?? []
      parts.push(unit)
      unitsByEnemyId.set(enemyId, parts)
    }
  }
  return { ...raw, unitsById, skillsById, unitsByEnemyId }
}

export async function loadGameData(base: string = import.meta.env.BASE_URL, fetchImpl: typeof fetch = fetch): Promise<GameData> {
  const entries = await Promise.all(FILES.map(async name => {
    const url = `${base}data/${name}.json`
    const res = await fetchImpl(url)
    if (!res.ok) throw new Error(`Could not load ${name}.json (HTTP ${res.status})`)
    return [name, await res.json()] as const
  }))
  return indexData(Object.fromEntries(entries) as unknown as RawData)
}

let shared: Promise<GameData> | undefined

/** Loads the data set once per page and shares it across components. */
export function useGameData(): { data?: GameData; error?: string } {
  const [state, setState] = useState<{ data?: GameData; error?: string }>({})
  useEffect(() => {
    shared ??= loadGameData()
    let live = true
    shared.then(data => { if (live) setState({ data }) }, (e: unknown) => { if (live) setState({ error: e instanceof Error ? e.message : String(e) }) })
    return () => { live = false }
  }, [])
  return state
}
```

`apps/web/src/lib/images.ts`:

```ts
import type { Skill, Unit } from '@limbus/engine'
import type { ImageManifest } from './data.ts'

export function imageUrl(images: ImageManifest, filename: string | undefined, base: string = import.meta.env.BASE_URL): string | undefined {
  if (!filename) return undefined
  const local = images[filename]
  if (!local) return undefined
  return `${base}images/${encodeURIComponent(local)}`
}

export function portraitUrl(images: ImageManifest, unit: Unit, base: string = import.meta.env.BASE_URL): string | undefined {
  return imageUrl(images, unit.portrait, base)
}

export function skillIconUrl(images: ImageManifest, skill: Skill, base: string = import.meta.env.BASE_URL): string | undefined {
  return imageUrl(images, skill.icon ? `${skill.icon}.png` : undefined, base)
}
```

`apps/web/src/lib/format.ts`:

```ts
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** 0.7345 -> "73.5%" */
export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`
}

/** 12345.6 -> "12,346" */
export function num(x: number): string {
  return Number.isFinite(x) ? integer.format(x) : '∞'
}

/** 3 -> "+3", -2 -> "-2", 0 -> "0" */
export function signed(x: number): string {
  return x > 0 ? `+${x}` : String(x)
}

/** Multiplier badge text: 2 -> "x2", 0.5 -> "x0.5" */
export function mult(x: number): string {
  return `x${Number.isInteger(x) ? x : x.toFixed(2).replace(/0+$/, '')}`
}
```

- [ ] **Step 5: Styles, app shell, data status**

`apps/web/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-ink: #0b0b0d;
  --color-paper: #1c1a17;
  --color-paper-light: #262320;
  --color-gold: #c9a227;
  --color-gold-bright: #e8c766;
  --color-blood: #8c1c1c;
  --color-blood-bright: #b8332f;
  --color-bone: #e4dfd3;
  --color-bone-dim: #a8a196;

  --color-sin-wrath: #c8452b;
  --color-sin-lust: #e07a2c;
  --color-sin-sloth: #d9b53a;
  --color-sin-gluttony: #5aa64a;
  --color-sin-gloom: #3fa1a6;
  --color-sin-pride: #3b6fc4;
  --color-sin-envy: #8e4bb5;

  --font-display: 'Big Shoulders Display', sans-serif;
  --font-body: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}

:root { color-scheme: dark; }

body {
  margin: 0;
  background: var(--color-ink);
  color: var(--color-bone);
  font-family: var(--font-body);
  background-image: repeating-linear-gradient(180deg, rgba(201, 162, 39, 0.02) 0px, rgba(201, 162, 39, 0.02) 1px, transparent 1px, transparent 32px);
}

::selection { background: var(--color-gold); color: var(--color-ink); }
*:focus-visible { outline: 2px solid var(--color-gold-bright); outline-offset: 2px; }

/* Ledger-style tabular numerals for every stat and damage readout. */
.ledger-number { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

/* Rubber-stamp verdict mark. */
.stamp {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  border: 3px solid currentColor;
  border-radius: 6px;
  padding: 0.25em 0.6em;
  display: inline-block;
  transform: rotate(-4deg);
  animation: stamp-in 0.35s ease-out both;
}
@keyframes stamp-in {
  0% { opacity: 0; transform: rotate(-4deg) scale(1.6); }
  60% { opacity: 1; transform: rotate(-4deg) scale(0.94); }
  100% { opacity: 1; transform: rotate(-4deg) scale(1); }
}

/* Coin reveal. */
.coin-flip { animation: coin-spin 0.5s ease-out both; }
@keyframes coin-spin {
  0% { transform: rotateX(0deg); opacity: 0; }
  100% { transform: rotateX(720deg); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .stamp, .coin-flip { animation: none; opacity: 1; transform: none; }
}
```

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`apps/web/src/components/DataStatus.tsx`:

```tsx
import type { GameData } from '../lib/data.ts'
import { num, pct } from '../lib/format.ts'

/** Footer strip: where the numbers come from and how much of the effect text the parser understood. */
export function DataStatus({ data }: { data: GameData }) {
  const { meta } = data
  const scraped = new Date(meta.scrapedAt)
  return (
    <footer className="mt-12 border-t border-paper-light pt-4 text-xs text-bone-dim">
      <p>
        Data scraped from limbuscompany.wiki.gg on <time dateTime={meta.scrapedAt}>{scraped.toISOString().slice(0, 10)}</time>:{' '}
        <span className="ledger-number">{num(meta.identityCount)}</span> identities,{' '}
        <span className="ledger-number">{num(meta.enemyUnitCount)}</span> enemy parts from {meta.railwayLine}.
      </p>
      <p>
        Effect text parsed into engine rules: <span className="ledger-number">{pct(meta.effectParseCoverage.ratio, 1)}</span>{' '}
        ({num(meta.effectParseCoverage.parsed)} of {num(meta.effectParseCoverage.total)} lines). Unparsed lines are shown but not applied.
      </p>
    </footer>
  )
}
```

`apps/web/src/App.tsx`:

```tsx
import { DataStatus } from './components/DataStatus.tsx'
import { useGameData, type GameData } from './lib/data.ts'
import { href, onLinkClick, useRoute, type Route } from './lib/router.ts'

function NavLink({ to, active, children }: { to: '/' | '/railway'; active: boolean; children: string }) {
  return (
    <a
      href={href(to)}
      onClick={onLinkClick}
      aria-current={active ? 'page' : undefined}
      className={`px-3 py-1 text-sm uppercase tracking-widest ${active ? 'text-gold-bright border-b-2 border-gold' : 'text-bone-dim hover:text-bone'}`}
    >
      {children}
    </a>
  )
}

function RouteBody({ route, data }: { route: Route; data: GameData }) {
  // Task 8 replaces the clash branch with <ClashScreen>, Task 10 the railway branch with <RailwayScreen>.
  if (route.name === 'not-found') return <p className="text-bone-dim">No page at <code>{route.path}</code>.</p>
  return (
    <section>
      <h1 className="font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide text-gold">
        {route.name === 'clash' ? 'Clash Calculator' : 'Railway Planner'}
      </h1>
      <p className="mt-2 text-bone-dim">{data.identities.length} identities and {data.enemies.length} enemy parts loaded.</p>
    </section>
  )
}

export function App() {
  const route = useRoute()
  const { data, error } = useGameData()
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-paper-light pb-3">
        <a href={href('/')} onClick={onLinkClick} className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase tracking-wider text-bone">
          Limbus Calculator
        </a>
        <nav className="flex gap-2">
          <NavLink to="/" active={route.name === 'clash'}>Clash</NavLink>
          <NavLink to="/railway" active={route.name === 'railway'}>Railway</NavLink>
        </nav>
      </header>
      {error && <p role="alert" className="text-blood-bright">Could not load game data: {error}</p>}
      {!data && !error && <p className="text-bone-dim">Loading data…</p>}
      {data && <RouteBody route={route} data={data} />}
      {data && <DataStatus data={data} />}
    </div>
  )
}
```

- [ ] **Step 6: Run tests, typecheck, lint, and a real build**

Run: `npm test -w @limbus/web && npm run typecheck -w @limbus/web && npm run lint -w @limbus/web && npm run build -w @limbus/web`
Expected: 10 tests pass; typecheck clean; lint clean; the build writes `apps/web/dist/` with `404.html`; `sync-data` logs the copies (and warns if images are absent). Then `npm run dev -w @limbus/web` for a manual check: header, nav switching without reload, the data footer with 187 identities and 39 enemy parts, no console errors. Stop the dev server.

- [ ] **Step 7: CI**

Replace `.github/workflows/ci.yml`:

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
      - run: npm run lint
      - run: npm test
      - run: npm run build -w @limbus/web
```

- [ ] **Step 8: Commit**

```bash
git add apps/web package.json package-lock.json .gitignore .github/workflows/ci.yml
git commit -m "Scaffold apps/web with router, data loading, and CI lint and build

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 6: Engine Web Worker and typed client

**Files:**
- Create: `apps/web/src/lib/engineMessages.ts`, `apps/web/src/lib/engine.worker.ts`, `apps/web/src/lib/engineClient.ts`, `apps/web/src/lib/useEngine.ts`
- Test: `apps/web/test/engineMessages.test.ts`, `apps/web/test/engineClient.test.ts`

**Interfaces:**
- Consumes: engine `clashReport`, `unopposedReport`, `matchupGrid`, `ReportOptions`, `Combatant`, `Unit`.
- Produces: `EngineRequest`, `EngineResponse`, `handleRequest(req)`; `WorkerLike`, `EngineClient { clash(a, b, options?), unopposed(attacker, target, options?), grid(team, wave, options?), terminate() }`, `engine()` shared instance; hooks `useClashReport(a, b, options)` and `useMatchupGrid(team, wave, options)` returning `{ result?, error?, pending }`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/engineMessages.test.ts`:

```ts
import { EMPTY_MANUAL, type Combatant } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { handleRequest } from '../src/lib/engineMessages.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

function combatant(id: string, over: Partial<Combatant> = {}): Combatant {
  const unit = makeUnit({ id, skills: [makeSkill({ id: `${id}::skill1` })] })
  return { unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL }, ...over }
}

describe('handleRequest', () => {
  it('answers a clash request with the report under the same id', () => {
    const res = handleRequest({ id: 7, kind: 'clash', a: combatant('a'), b: combatant('b'), options: {} })
    expect(res.id).toBe(7)
    expect(res.ok && res.kind === 'clash' && res.result.win + res.result.lose + res.result.draw).toBeCloseTo(1)
  })
  it('answers unopposed and grid requests', () => {
    const a = combatant('a')
    const part = makeUnit({ id: '1:0', kind: 'enemy', skills: [] })
    const hit = handleRequest({ id: 1, kind: 'unopposed', attacker: a, target: { ...combatant('1:0'), unit: part, skill: undefined }, options: {} })
    expect(hit.ok && hit.kind === 'unopposed' && hit.result.damage.mean).toBeGreaterThan(0)
    const grid = handleRequest({ id: 2, kind: 'grid', team: [a], wave: [part], options: {} })
    expect(grid.ok && grid.kind === 'grid' && grid.result.cells[0][0].win).toBeNull()
  })
  it('turns an engine error into an error response instead of throwing', () => {
    const res = handleRequest({ id: 3, kind: 'clash', a: combatant('a'), b: { ...combatant('b'), skill: undefined }, options: {} })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.error).toMatch(/both combatants need a skill/)
  })
})
```

`apps/web/test/engineClient.test.ts`:

```ts
import { EMPTY_MANUAL, type Combatant } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { EngineClient, type WorkerLike } from '../src/lib/engineClient.ts'
import { handleRequest, type EngineRequest, type EngineResponse } from '../src/lib/engineMessages.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

/** Runs the worker body inline, asynchronously, like a real worker would. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<EngineResponse>) => void) | null = null
  sent: EngineRequest[] = []
  postMessage(req: EngineRequest): void {
    this.sent.push(req)
    queueMicrotask(() => this.onmessage?.({ data: handleRequest(req) } as MessageEvent<EngineResponse>))
  }
  terminate(): void {}
}

function combatant(id: string): Combatant {
  const unit = makeUnit({ id, skills: [makeSkill({ id: `${id}::skill1` })] })
  return { unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } }
}

describe('EngineClient', () => {
  it('resolves each request with its own result even when several are in flight', async () => {
    const worker = new FakeWorker()
    const client = new EngineClient(worker)
    const [clash, hit] = await Promise.all([client.clash(combatant('a'), combatant('b')), client.unopposed(combatant('a'), combatant('b'))])
    expect(clash.win + clash.lose + clash.draw).toBeCloseTo(1)
    expect(hit.damage.mean).toBeGreaterThan(0)
    expect(worker.sent.map(r => r.id)).toEqual([1, 2])
  })
  it('rejects with the engine error message', async () => {
    const client = new EngineClient(new FakeWorker())
    await expect(client.clash(combatant('a'), { ...combatant('b'), skill: undefined })).rejects.toThrow(/both combatants need a skill/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/web -- engine`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/engineMessages.ts`:

```ts
import { clashReport, matchupGrid, unopposedReport, type ClashReport, type Combatant, type MatchupGrid, type ReportOptions, type Unit, type UnopposedReport } from '@limbus/engine'

export type EngineRequest =
  | { id: number; kind: 'clash'; a: Combatant; b: Combatant; options: ReportOptions }
  | { id: number; kind: 'unopposed'; attacker: Combatant; target: Combatant; options: ReportOptions }
  | { id: number; kind: 'grid'; team: Combatant[]; wave: Unit[]; options: ReportOptions }

export type EngineResponse =
  | { id: number; ok: true; kind: 'clash'; result: ClashReport }
  | { id: number; ok: true; kind: 'unopposed'; result: UnopposedReport }
  | { id: number; ok: true; kind: 'grid'; result: MatchupGrid }
  | { id: number; ok: false; error: string }

/** The worker body, kept pure so tests can call it without a Worker. */
export function handleRequest(req: EngineRequest): EngineResponse {
  try {
    switch (req.kind) {
      case 'clash': return { id: req.id, ok: true, kind: 'clash', result: clashReport(req.a, req.b, req.options) }
      case 'unopposed': return { id: req.id, ok: true, kind: 'unopposed', result: unopposedReport(req.attacker, req.target, req.options) }
      case 'grid': return { id: req.id, ok: true, kind: 'grid', result: matchupGrid(req.team, req.wave, req.options) }
    }
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
```

`apps/web/src/lib/engine.worker.ts`:

```ts
import { handleRequest, type EngineRequest } from './engineMessages.ts'

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  self.postMessage(handleRequest(event.data))
}
```

`apps/web/src/lib/engineClient.ts`:

```ts
import type { ClashReport, Combatant, MatchupGrid, ReportOptions, Unit, UnopposedReport } from '@limbus/engine'
import type { EngineRequest, EngineResponse } from './engineMessages.ts'

export interface WorkerLike {
  postMessage(message: EngineRequest): void
  onmessage: ((event: MessageEvent<EngineResponse>) => void) | null
  terminate(): void
}

type Pending = { resolve: (value: never) => void; reject: (reason: Error) => void }

/** Request/response bridge to the engine worker. One instance per page is enough. */
export class EngineClient {
  private readonly worker: WorkerLike
  private nextId = 1
  private readonly pending = new Map<number, Pending>()

  constructor(worker: WorkerLike = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })) {
    this.worker = worker
    this.worker.onmessage = event => {
      const res = event.data
      const entry = this.pending.get(res.id)
      if (!entry) return
      this.pending.delete(res.id)
      if (res.ok) entry.resolve(res.result as never)
      else entry.reject(new Error(res.error))
    }
  }

  clash(a: Combatant, b: Combatant, options: ReportOptions = {}): Promise<ClashReport> {
    return this.send({ kind: 'clash', a, b, options })
  }

  unopposed(attacker: Combatant, target: Combatant, options: ReportOptions = {}): Promise<UnopposedReport> {
    return this.send({ kind: 'unopposed', attacker, target, options })
  }

  grid(team: Combatant[], wave: Unit[], options: ReportOptions = {}): Promise<MatchupGrid> {
    return this.send({ kind: 'grid', team, wave, options })
  }

  terminate(): void {
    this.worker.terminate()
    for (const entry of this.pending.values()) entry.reject(new Error('engine worker terminated'))
    this.pending.clear()
  }

  private send<T>(body: Omit<EngineRequest, 'id'>): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: never) => void, reject })
      this.worker.postMessage({ ...body, id } as EngineRequest)
    })
  }
}

let shared: EngineClient | undefined

export function engine(): EngineClient {
  shared ??= new EngineClient()
  return shared
}
```

`apps/web/src/lib/useEngine.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import type { ClashReport, Combatant, MatchupGrid, ReportOptions, Unit } from '@limbus/engine'
import { engine } from './engineClient.ts'

export interface EngineResult<T> { result?: T; error?: string; pending: boolean }

function useEngineCall<T>(run: (() => Promise<T>) | undefined, deps: unknown[]): EngineResult<T> {
  const [state, setState] = useState<EngineResult<T>>({ pending: run !== undefined })
  const token = useRef(0)
  useEffect(() => {
    const mine = ++token.current
    if (!run) { setState({ pending: false }); return }
    setState(s => ({ ...s, pending: true }))
    run().then(
      result => { if (token.current === mine) setState({ result, pending: false }) },
      (e: unknown) => { if (token.current === mine) setState({ error: e instanceof Error ? e.message : String(e), pending: false }) },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

/** Clash report for two combatants; `undefined` on either side means "nothing to compute yet". */
export function useClashReport(a: Combatant | undefined, b: Combatant | undefined, options: ReportOptions): EngineResult<ClashReport> {
  const ready = a?.skill && b?.skill ? { a, b } : undefined
  return useEngineCall(ready ? () => engine().clash(ready.a, ready.b, options) : undefined, [a, b, options.staggerMidAttack])
}

export function useMatchupGrid(team: Combatant[], wave: Unit[], options: ReportOptions): EngineResult<MatchupGrid> {
  const ready = team.length > 0 && wave.length > 0
  return useEngineCall(ready ? () => engine().grid(team, wave, options) : undefined, [team, wave, options.staggerMidAttack])
}
```

The hooks take the combatant objects themselves as dependencies; callers must memoize them (`useMemo`) so a re-render without a change does not refetch. Tasks 8 and 10 do that.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `npm test -w @limbus/web && npm run typecheck -w @limbus/web && npm run lint -w @limbus/web`
Expected: 15 tests pass; clean. If oxlint flags the `eslint-disable` comment as unknown, delete that comment line.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Run engine reports and grids in a Web Worker behind a typed client

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 7: Clash setup model, URL codec, persisted stores

**Files:**
- Create: `apps/web/src/lib/setup.ts`, `apps/web/src/lib/setupCodec.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/stores/clashStore.ts`, `apps/web/src/stores/teamStore.ts`
- Test: `apps/web/test/setup.test.ts`, `apps/web/test/setupCodec.test.ts`, `apps/web/test/clashStore.test.ts`, `apps/web/test/teamStore.test.ts`

**Interfaces:**
- Produces: `SideKey = 'a' | 'b'`, `SideSetup`, `ClashSetup`, `EMPTY_SIDE`, `emptySetup()`, `sideForUnit(unit, skillId?)`, `skillAtUptie(skill, tier)`, `toCombatant(side, data)`; `encodeSetup(setup)`, `decodeSetup(text)`; `memoryStorage()`, `defaultStorage()`; `createClashStore(storage?)`, `useClashStore`, `ClashState`; `createTeamStore(storage?)`, `useTeamStore`, `TeamSlot`, `TEAM_SIZE = 12`.
- Consumed by: Tasks 8, 9, 10.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/setup.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { indexData } from '../src/lib/data.ts'
import { emptySetup, sideForUnit, skillAtUptie, toCombatant } from '../src/lib/setup.ts'
import { makeRaw, makeSkill, makeUnit } from './fixtures.ts'

const data = indexData(makeRaw())

describe('sideForUnit', () => {
  it('starts at the scraped level, uptie 4, primary attack skill, clean state', () => {
    const unit = makeUnit({ skills: [makeSkill({ id: 'g', damageType: 'guard', attackWeight: 9 }), makeSkill({ id: 's2', attackWeight: 2 })] })
    const side = sideForUnit(unit)
    expect(side).toMatchObject({ unitId: 'u', skillId: 's2', level: 60, uptie: 4, sanity: 0, currentHp: null, status: {} })
  })
  it('keeps an explicitly requested skill and copes with a skill-less part', () => {
    const unit = makeUnit({ skills: [makeSkill({ id: 'g', damageType: 'guard' }), makeSkill({ id: 's2' })] })
    expect(sideForUnit(unit, 'g').skillId).toBe('g')
    expect(sideForUnit(makeUnit({ skills: [] })).skillId).toBeNull()
  })
})

describe('skillAtUptie', () => {
  it('applies overrides from their tier upward until a higher tier overrides', () => {
    const skill = makeSkill({ basePower: 3, coinPower: 3, uptie: { 2: { basePower: 2 }, 3: { coinPower: 5 } } })
    expect(skillAtUptie(skill, 1)).toMatchObject({ basePower: 3, coinPower: 3 })
    expect(skillAtUptie(skill, 2)).toMatchObject({ basePower: 2, coinPower: 3 })
    expect(skillAtUptie(skill, 4)).toMatchObject({ basePower: 2, coinPower: 5 })
  })
})

describe('toCombatant', () => {
  it('returns undefined without a unit and a skill-less combatant for a skill-less part', () => {
    expect(toCombatant(emptySetup().a, data)).toBeUndefined()
    const c = toCombatant(sideForUnit(data.unitsById.get('9568:1')!), data)
    expect(c?.unit.id).toBe('9568:1')
    expect(c?.skill).toBeUndefined()
  })
  it('rescales max HP when the level differs from the scraped one', () => {
    const side = { ...sideForUnit(data.unitsById.get('u')!), level: 50 }
    expect(toCombatant(side, data)?.unit.hp).toBe(180) // 200 + 2 * (50 - 60)
    expect(toCombatant(side, data)?.level).toBe(50)
  })
  it('forces enemy sanity to zero and passes current HP through', () => {
    const side = { ...sideForUnit(data.unitsById.get('9568:0')!), sanity: 30, currentHp: 77 }
    const c = toCombatant(side, data)!
    expect(c.sanity).toBe(0)
    expect(c.currentHp).toBe(77)
    expect(toCombatant({ ...sideForUnit(data.unitsById.get('u')!), sanity: 30 }, data)?.sanity).toBe(30)
  })
})
```

`apps/web/test/setupCodec.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { emptySetup } from '../src/lib/setup.ts'
import { decodeSetup, encodeSetup } from '../src/lib/setupCodec.ts'

describe('setup codec', () => {
  it('round-trips a full setup through a URL-safe string', () => {
    const setup = emptySetup()
    setup.a = { ...setup.a, unitId: 'Blade Lineage Salsu Don Quixote', skillId: 'Blade Lineage Salsu Don Quixote::skill1', uptie: 3, level: 45, sanity: -12, status: { poise: { potency: 5, count: 2 } }, manual: { coinPower: 1, basePower: 0, clashPower: 2, damagePercent: 10 }, currentHp: 150 }
    setup.b = { ...setup.b, unitId: '9568:0', skillId: '9568:0::skill1', level: 60 }
    setup.staggerMidAttack = false
    const text = encodeSetup(setup)
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeSetup(text)).toEqual(setup)
  })
  it('rejects garbage and structurally wrong payloads', () => {
    expect(decodeSetup('not base64!')).toBeNull()
    expect(decodeSetup(btoa('{"nope":1}'))).toBeNull()
    const bad = { ...emptySetup(), a: { ...emptySetup().a, uptie: 9 } }
    expect(decodeSetup(encodeSetup(bad as never))).toBeNull()
  })
  it('handles non-ASCII unit names', () => {
    const setup = emptySetup()
    setup.a = { ...setup.a, unitId: 'Ryōshū 【Test】' }
    expect(decodeSetup(encodeSetup(setup))?.a.unitId).toBe('Ryōshū 【Test】')
  })
})
```

`apps/web/test/clashStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../src/lib/storage.ts'
import { createClashStore } from '../src/stores/clashStore.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

describe('clash store', () => {
  it('picking a unit resets skill, level, and state for that side only', () => {
    const store = createClashStore(memoryStorage())
    store.getState().patchSide('a', { level: 30, sanity: 20 })
    store.getState().pickUnit('a', makeUnit({ id: 'x', level: 50, skills: [makeSkill({ id: 'x::skill1' })] }))
    expect(store.getState().setup.a).toMatchObject({ unitId: 'x', skillId: 'x::skill1', level: 50, sanity: 0 })
    expect(store.getState().setup.b.unitId).toBeNull()
  })
  it('edits status, manual, and options', () => {
    const store = createClashStore(memoryStorage())
    store.getState().setStatus('b', 'poise', { potency: 3, count: 1 })
    store.getState().setStatus('b', 'fragile', { potency: 2, count: 0 })
    store.getState().setStatus('b', 'fragile', null)
    store.getState().setManual('b', 'clashPower', 2)
    store.getState().setStaggerMidAttack(false)
    expect(store.getState().setup.b.status).toEqual({ poise: { potency: 3, count: 1 } })
    expect(store.getState().setup.b.manual.clashPower).toBe(2)
    expect(store.getState().setup.staggerMidAttack).toBe(false)
  })
  it('swaps sides', () => {
    const store = createClashStore(memoryStorage())
    store.getState().pickUnit('a', makeUnit({ id: 'x' }))
    store.getState().swap()
    expect(store.getState().setup.a.unitId).toBeNull()
    expect(store.getState().setup.b.unitId).toBe('x')
  })
  it('persists the setup and rehydrates a new store from the same storage', async () => {
    const storage = memoryStorage()
    const store = createClashStore(storage)
    store.getState().pickUnit('a', makeUnit({ id: 'x' }))
    const again = createClashStore(storage)
    await again.persist.rehydrate()
    expect(again.getState().setup.a.unitId).toBe('x')
  })
})
```

`apps/web/test/teamStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../src/lib/storage.ts'
import { createTeamStore, TEAM_SIZE } from '../src/stores/teamStore.ts'

describe('team store', () => {
  it('starts with twelve empty slots', () => {
    const store = createTeamStore(memoryStorage())
    expect(store.getState().slots).toHaveLength(TEAM_SIZE)
    expect(store.getState().slots.every(s => s === null)).toBe(true)
  })
  it('sets, patches, and clears slots', () => {
    const store = createTeamStore(memoryStorage())
    store.getState().setSlot(3, { unitId: 'x', uptie: 4, level: 60 })
    store.getState().patchSlot(3, { uptie: 2 })
    expect(store.getState().slots[3]).toEqual({ unitId: 'x', uptie: 2, level: 60 })
    store.getState().setSlot(3, null)
    expect(store.getState().slots[3]).toBeNull()
  })
  it('persists and rehydrates', async () => {
    const storage = memoryStorage()
    createTeamStore(storage).getState().setSlot(0, { unitId: 'x', uptie: 4, level: 60 })
    const again = createTeamStore(storage)
    await again.persist.rehydrate()
    expect(again.getState().slots[0]?.unitId).toBe('x')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/web -- setup clashStore teamStore`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `setup.ts`, `setupCodec.ts`, `storage.ts`**

`apps/web/src/lib/setup.ts`:

```ts
import { EMPTY_MANUAL, primaryAttackSkill, type Combatant, type ManualOverrides, type Skill, type StatusValue, type Unit, type UptieTier } from '@limbus/engine'
import type { GameData } from './data.ts'

export type SideKey = 'a' | 'b'

export interface SideSetup {
  unitId: string | null
  skillId: string | null
  uptie: UptieTier
  level: number
  /** -45..45; ignored (forced to 0) for enemies. */
  sanity: number
  status: Record<string, StatusValue>
  manual: ManualOverrides
  /** null means full HP. */
  currentHp: number | null
}

export interface ClashSetup {
  a: SideSetup
  b: SideSetup
  /** Spec 10: whether a stagger threshold crossed mid-attack applies Fatal to the remaining coins. */
  staggerMidAttack: boolean
}

export const EMPTY_SIDE: Readonly<SideSetup> = Object.freeze({
  unitId: null, skillId: null, uptie: 4, level: 1, sanity: 0, status: {}, manual: EMPTY_MANUAL, currentHp: null,
})

export function emptySide(): SideSetup {
  return { ...EMPTY_SIDE, status: {}, manual: { ...EMPTY_MANUAL } }
}

export function emptySetup(): ClashSetup {
  return { a: emptySide(), b: emptySide(), staggerMidAttack: true }
}

/** Side setup for a freshly picked unit: scraped level, uptie 4, its primary attack skill, no state. */
export function sideForUnit(unit: Unit, skillId?: string): SideSetup {
  const requested = skillId ? unit.skills.find(s => s.id === skillId) : undefined
  const skill = requested ?? primaryAttackSkill(unit) ?? unit.skills[0]
  return { ...emptySide(), unitId: unit.id, skillId: skill?.id ?? null, level: unit.level }
}

/** The skill as displayed at a tier: an override applies from its tier upward until a higher tier overrides it. */
export function skillAtUptie(skill: Skill, tier: UptieTier): Skill {
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

/** Max HP at another level, per the data package's contract note: hp + hpGrowth * (L - level). */
export function hpAtLevel(unit: Unit, level: number): number {
  return Math.round(unit.hp + unit.hpGrowth * (level - unit.level))
}

export function toCombatant(side: SideSetup, data: GameData): Combatant | undefined {
  const unit = side.unitId ? data.unitsById.get(side.unitId) : undefined
  if (!unit) return undefined
  const skill = side.skillId ? unit.skills.find(s => s.id === side.skillId) : undefined
  const scaled = side.level === unit.level ? unit : { ...unit, hp: hpAtLevel(unit, side.level) }
  return {
    unit: scaled,
    skill,
    uptie: side.uptie,
    level: side.level,
    sanity: unit.kind === 'enemy' ? 0 : side.sanity,
    status: side.status,
    manual: side.manual,
    ...(side.currentHp !== null ? { currentHp: side.currentHp } : {}),
  }
}
```

`apps/web/src/lib/setupCodec.ts`:

```ts
import type { ManualOverrides, StatusValue, UptieTier } from '@limbus/engine'
import type { ClashSetup, SideSetup } from './setup.ts'

// Compact positional encoding so shared URLs stay short. Bump VERSION when the shape changes.
const VERSION = 1
type PackedSide = [string | null, string | null, number, number, number, Record<string, [number, number]>, [number, number, number, number], number | null]
type Packed = [typeof VERSION, PackedSide, PackedSide, 0 | 1]

function packSide(s: SideSetup): PackedSide {
  const status: Record<string, [number, number]> = {}
  for (const [id, v] of Object.entries(s.status)) status[id] = [v.potency, v.count]
  return [s.unitId, s.skillId, s.uptie, s.level, s.sanity, status, [s.manual.coinPower, s.manual.basePower, s.manual.clashPower, s.manual.damagePercent], s.currentHp]
}

const isFinite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isTier = (x: unknown): x is UptieTier => x === 1 || x === 2 || x === 3 || x === 4
const isIdOrNull = (x: unknown): x is string | null => x === null || typeof x === 'string'

function unpackSide(p: unknown): SideSetup | null {
  if (!Array.isArray(p) || p.length !== 8) return null
  const [unitId, skillId, uptie, level, sanity, status, manual, currentHp] = p as unknown[]
  if (!isIdOrNull(unitId) || !isIdOrNull(skillId) || !isTier(uptie) || !isFinite(level) || !isFinite(sanity)) return null
  if (typeof status !== 'object' || status === null || Array.isArray(status)) return null
  if (!Array.isArray(manual) || manual.length !== 4 || !manual.every(isFinite)) return null
  if (currentHp !== null && !isFinite(currentHp)) return null
  const statusOut: Record<string, StatusValue> = {}
  for (const [id, v] of Object.entries(status as Record<string, unknown>)) {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(isFinite)) return null
    statusOut[id] = { potency: v[0], count: v[1] }
  }
  const [coinPower, basePower, clashPower, damagePercent] = manual as [number, number, number, number]
  const manualOut: ManualOverrides = { coinPower, basePower, clashPower, damagePercent }
  return { unitId, skillId, uptie, level, sanity, status: statusOut, manual: manualOut, currentHp }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4)
  try {
    const binary = atob(padded)
    return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)))
  } catch {
    return null
  }
}

export function encodeSetup(setup: ClashSetup): string {
  const packed: Packed = [VERSION, packSide(setup.a), packSide(setup.b), setup.staggerMidAttack ? 1 : 0]
  return toBase64Url(JSON.stringify(packed))
}

/** Null for anything that is not a well-formed encoded setup of the current version. */
export function decodeSetup(text: string): ClashSetup | null {
  const json = fromBase64Url(text)
  if (json === null) return null
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return null }
  if (!Array.isArray(parsed) || parsed.length !== 4 || parsed[0] !== VERSION) return null
  const a = unpackSide(parsed[1])
  const b = unpackSide(parsed[2])
  if (!a || !b || (parsed[3] !== 0 && parsed[3] !== 1)) return null
  return { a, b, staggerMidAttack: parsed[3] === 1 }
}
```

`apps/web/src/lib/storage.ts`:

```ts
import type { StateStorage } from 'zustand/middleware'

/** In-memory StateStorage for tests and for environments without localStorage. */
export function memoryStorage(): StateStorage {
  const map = new Map<string, string>()
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
    removeItem: key => { map.delete(key) },
  }
}

/** localStorage when the browser allows it (private windows can throw), otherwise memory. */
export function defaultStorage(): StateStorage {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem('limbus.probe')
      return localStorage
    }
  } catch {
    // fall through
  }
  return memoryStorage()
}
```

- [ ] **Step 4: Implement the stores**

`apps/web/src/stores/clashStore.ts`:

```ts
import type { ManualOverrides, StatusValue, Unit } from '@limbus/engine'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { emptySetup, sideForUnit, type ClashSetup, type SideKey, type SideSetup } from '../lib/setup.ts'
import { defaultStorage } from '../lib/storage.ts'

export interface ClashState {
  setup: ClashSetup
  pickUnit(side: SideKey, unit: Unit): void
  pickSkill(side: SideKey, skillId: string | null): void
  patchSide(side: SideKey, patch: Partial<Pick<SideSetup, 'uptie' | 'level' | 'sanity' | 'currentHp'>>): void
  setStatus(side: SideKey, id: string, value: StatusValue | null): void
  setManual(side: SideKey, key: keyof ManualOverrides, value: number): void
  setStaggerMidAttack(value: boolean): void
  swap(): void
  replace(setup: ClashSetup): void
  reset(): void
}

export function createClashStore(storage: StateStorage = defaultStorage()) {
  return create<ClashState>()(
    persist(
      (set, get) => {
        const update = (side: SideKey, fn: (s: SideSetup) => SideSetup) => set({ setup: { ...get().setup, [side]: fn(get().setup[side]) } })
        return {
          setup: emptySetup(),
          pickUnit: (side, unit) => update(side, () => sideForUnit(unit)),
          pickSkill: (side, skillId) => update(side, s => ({ ...s, skillId })),
          patchSide: (side, patch) => update(side, s => ({ ...s, ...patch })),
          setStatus: (side, id, value) => update(side, s => {
            const status = { ...s.status }
            if (value === null) delete status[id]
            else status[id] = value
            return { ...s, status }
          }),
          setManual: (side, key, value) => update(side, s => ({ ...s, manual: { ...s.manual, [key]: value } })),
          setStaggerMidAttack: value => set({ setup: { ...get().setup, staggerMidAttack: value } }),
          swap: () => set({ setup: { ...get().setup, a: get().setup.b, b: get().setup.a } }),
          replace: setup => set({ setup }),
          reset: () => set({ setup: emptySetup() }),
        }
      },
      { name: 'limbus.clash.v1', storage: createJSONStorage(() => storage), partialize: state => ({ setup: state.setup }) },
    ),
  )
}

export const useClashStore = createClashStore()
```

`apps/web/src/stores/teamStore.ts`:

```ts
import type { UptieTier } from '@limbus/engine'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { defaultStorage } from '../lib/storage.ts'

export const TEAM_SIZE = 12

export interface TeamSlot { unitId: string; uptie: UptieTier; level: number }

export interface TeamState {
  slots: (TeamSlot | null)[]
  setSlot(index: number, slot: TeamSlot | null): void
  patchSlot(index: number, patch: Partial<Omit<TeamSlot, 'unitId'>>): void
  clear(): void
}

const emptySlots = (): (TeamSlot | null)[] => new Array<TeamSlot | null>(TEAM_SIZE).fill(null)

export function createTeamStore(storage: StateStorage = defaultStorage()) {
  return create<TeamState>()(
    persist(
      (set, get) => ({
        slots: emptySlots(),
        setSlot: (index, slot) => set({ slots: get().slots.map((s, i) => (i === index ? slot : s)) }),
        patchSlot: (index, patch) => set({ slots: get().slots.map((s, i) => (i === index && s ? { ...s, ...patch } : s)) }),
        clear: () => set({ slots: emptySlots() }),
      }),
      { name: 'limbus.team.v1', storage: createJSONStorage(() => storage), partialize: state => ({ slots: state.slots }) },
    ),
  )
}

export const useTeamStore = createTeamStore()
```

- [ ] **Step 5: Run tests, typecheck, lint**

Run: `npm test -w @limbus/web && npm run typecheck -w @limbus/web && npm run lint -w @limbus/web`
Expected: 28 tests pass, no zustand storage warnings in the output (the default store falls back to memory storage under Node); typecheck and lint clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "Add clash setup model, shareable URL codec, and persisted clash and team stores

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 8: Clash Calculator screen: pickers, combatant cards, effect list, URL sync

**Files:**
- Create: `apps/web/src/lib/unitSearch.ts`, `apps/web/src/lib/effectStatus.ts`, `apps/web/src/components/Badges.tsx`, `apps/web/src/components/UnitPicker.tsx`, `apps/web/src/components/SkillPicker.tsx`, `apps/web/src/components/StatusEditor.tsx`, `apps/web/src/components/ManualEditor.tsx`, `apps/web/src/components/EffectList.tsx`, `apps/web/src/components/CombatantCard.tsx`, `apps/web/src/screens/ClashScreen.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/test/unitSearch.test.ts`, `apps/web/test/effectStatus.test.ts`

**Interfaces:**
- Consumes: Task 5 (`GameData`, images, router), Task 6 (`useClashReport`), Task 7 (stores, setup, codec), engine `resolveCombatant`, `statusEffects`, `ALL_SINS`.
- Produces: `searchUnits(units, query, kinds?) -> UnitGroup[]`, `slotLabel(skill)`, `effectStatus(effect, resolved) -> 'applied' | 'unparsed' | 'inactive'`; components `SinBadge`, `DamageTypeBadge`, `Stamp`, `UnitPicker`, `SkillPicker`, `StatusEditor`, `ManualEditor`, `EffectList`, `CombatantCard`; `ClashScreen({ data, search })` which Task 9 extends with the verdict panel and Task 10 targets from grid cells (via `?s=` URLs).

- [ ] **Step 1: Write the failing tests**

`apps/web/test/unitSearch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { searchUnits, slotLabel } from '../src/lib/unitSearch.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

const units = [
  makeUnit({ id: 'i1', name: 'Blade Lineage Salsu Don Quixote', group: 'Don Quixote' }),
  makeUnit({ id: 'i2', name: 'W Corp. L3 Cleanup Agent Don Quixote', group: 'Don Quixote' }),
  makeUnit({ id: 'i3', name: 'LCB Sinner Yi Sang', group: 'Yi Sang' }),
  makeUnit({ id: '9568:0', kind: 'enemy', name: 'Inverted Scale', group: 'Refracted Yinglong' }),
  makeUnit({ id: '9568:1', kind: 'enemy', name: 'Head', group: 'Refracted Yinglong' }),
]

describe('searchUnits', () => {
  it('groups identities by sinner (alphabetical) before enemies by enemy name (part order)', () => {
    const groups = searchUnits(units, '')
    expect(groups.map(g => `${g.kind}:${g.label}`)).toEqual(['identity:Don Quixote', 'identity:Yi Sang', 'enemy:Refracted Yinglong'])
    expect(groups[2].units.map(u => u.id)).toEqual(['9568:0', '9568:1'])
  })
  it('matches every whitespace-separated token against name and group, case-insensitively', () => {
    expect(searchUnits(units, 'salsu don').flatMap(g => g.units.map(u => u.id))).toEqual(['i1'])
    expect(searchUnits(units, 'yinglong head').flatMap(g => g.units.map(u => u.id))).toEqual(['9568:1'])
    expect(searchUnits(units, 'zzz')).toEqual([])
  })
  it('restricts by kind', () => {
    expect(searchUnits(units, '', ['identity']).every(g => g.kind === 'identity')).toBe(true)
  })
})

describe('slotLabel', () => {
  it('names slots and variants', () => {
    expect(slotLabel(makeSkill({ slot: 'skill1' }))).toBe('S1')
    expect(slotLabel(makeSkill({ slot: 'skill3', variant: '2' }))).toBe('S3 v2')
    expect(slotLabel(makeSkill({ slot: 'defense' }))).toBe('DEF')
    expect(slotLabel(makeSkill({ slot: 'enemy' }))).toBe('ATK')
  })
})
```

`apps/web/test/effectStatus.test.ts`:

```ts
import { resolveCombatant, EMPTY_MANUAL, type Effect } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { effectStatus } from '../src/lib/effectStatus.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

const applied: Effect = { trigger: 'on-use', scope: 'skill', op: { kind: 'coinPower', delta: 1 }, source: 'Coin Power +1' }
const gated: Effect = { trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 }, op: { kind: 'basePower', delta: 1 }, source: 'At 5+ Poise, Base Power +1' }
const unparsed: Effect = { trigger: 'on-hit', scope: 'skill', op: { kind: 'unparsed' }, source: 'Something the parser does not know' }
const perCoin: Effect = { trigger: 'on-hit', scope: { coin: 0 }, op: { kind: 'applyStatus', target: 'target', status: 'rupture', potency: 1 }, source: '[On Hit] Inflict 1 Rupture' }

describe('effectStatus', () => {
  const unit = makeUnit({ skills: [makeSkill({ effects: [applied, gated, unparsed, perCoin] })] })
  const resolved = resolveCombatant({ unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } })
  it('marks applied, unparsed, and inactive effects', () => {
    expect(effectStatus(applied, resolved)).toBe('applied')
    expect(effectStatus(unparsed, resolved)).toBe('unparsed')
    expect(effectStatus(gated, resolved)).toBe('inactive')
  })
  it('reports per-coin effects the way the engine does: unparsed for now', () => {
    expect(effectStatus(perCoin, resolved)).toBe('unparsed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/web -- unitSearch effectStatus`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the two helpers**

`apps/web/src/lib/unitSearch.ts`:

```ts
import type { Skill, Unit } from '@limbus/engine'

export interface UnitGroup { kind: Unit['kind']; label: string; units: Unit[] }

/** Identities grouped by sinner (alphabetical), then enemies grouped by enemy name (part order), filtered by every query token. */
export function searchUnits(units: Unit[], query: string, kinds: ReadonlyArray<Unit['kind']> = ['identity', 'enemy']): UnitGroup[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (u: Unit) => {
    const hay = `${u.name} ${u.group ?? ''}`.toLowerCase()
    return tokens.every(t => hay.includes(t))
  }
  const out: UnitGroup[] = []
  for (const kind of ['identity', 'enemy'] as const) {
    if (!kinds.includes(kind)) continue
    const byGroup = new Map<string, Unit[]>()
    for (const u of units) {
      if (u.kind !== kind || !matches(u)) continue
      const label = u.group ?? u.name
      byGroup.set(label, [...(byGroup.get(label) ?? []), u])
    }
    const labels = [...byGroup.keys()]
    if (kind === 'identity') labels.sort((x, y) => x.localeCompare(y))
    for (const label of labels) out.push({ kind, label, units: byGroup.get(label)! })
  }
  return out
}

const SLOT: Record<Skill['slot'], string> = { skill1: 'S1', skill2: 'S2', skill3: 'S3', skill4: 'S4', defense: 'DEF', enemy: 'ATK' }

export function slotLabel(skill: Skill): string {
  return skill.variant ? `${SLOT[skill.slot]} v${skill.variant}` : SLOT[skill.slot]
}
```

`apps/web/src/lib/effectStatus.ts`:

```ts
import type { Effect, ResolvedCombatant } from '@limbus/engine'

export type EffectStatus = 'applied' | 'unparsed' | 'inactive'

/** How the engine treated one effect line: applied to the numbers, not understood, or understood but not active (trigger or condition). */
export function effectStatus(effect: Effect, resolved: ResolvedCombatant): EffectStatus {
  if (resolved.effectsUnparsed.includes(effect.source)) return 'unparsed'
  if (resolved.effectsApplied.includes(effect.source)) return 'applied'
  return 'inactive'
}
```

Run: `npm test -w @limbus/web -- unitSearch effectStatus`
Expected: PASS.

- [ ] **Step 4: Badges and pickers**

`apps/web/src/components/Badges.tsx`:

```tsx
import type { Sin, SkillDamageType } from '@limbus/engine'
import type { ReactNode } from 'react'

const SIN_CLASS: Record<Sin, string> = {
  wrath: 'bg-sin-wrath', lust: 'bg-sin-lust', sloth: 'bg-sin-sloth text-ink', gluttony: 'bg-sin-gluttony',
  gloom: 'bg-sin-gloom', pride: 'bg-sin-pride', envy: 'bg-sin-envy',
}

export function SinBadge({ sin }: { sin: Sin }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone ${SIN_CLASS[sin]}`}>{sin}</span>
}

export function DamageTypeBadge({ type }: { type: SkillDamageType }) {
  return <span className="rounded border border-bone-dim px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-bone-dim">{type}</span>
}

/** Rubber-stamp verdict. `tone` picks the ink. */
export function Stamp({ tone, children }: { tone: 'gold' | 'blood' | 'bone'; children: ReactNode }) {
  const color = tone === 'gold' ? 'text-gold-bright' : tone === 'blood' ? 'text-blood-bright' : 'text-bone-dim'
  return <span className={`stamp text-2xl ${color}`}>{children}</span>
}
```

`apps/web/src/components/UnitPicker.tsx`:

```tsx
import type { Unit } from '@limbus/engine'
import { useMemo, useState } from 'react'
import type { GameData, ImageManifest } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'
import { searchUnits } from '../lib/unitSearch.ts'

interface Props {
  data: GameData
  value: string | null
  onPick: (unit: Unit) => void
  kinds?: ReadonlyArray<Unit['kind']>
  label: string
}

// Hoisted so the default does not change identity on every render (it is a memo dependency).
const ALL_KINDS: ReadonlyArray<Unit['kind']> = ['identity', 'enemy']

function UnitRow({ unit, images }: { unit: Unit; images: ImageManifest }) {
  const url = portraitUrl(images, unit)
  return (
    <>
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">
        {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{unit.name}</span>
        <span className="block truncate text-xs text-bone-dim">{unit.group}</span>
      </span>
    </>
  )
}

/** Searchable combobox over identities and enemy parts, grouped by sinner or enemy. */
export function UnitPicker({ data, value, onPick, kinds = ALL_KINDS, label }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = value ? data.unitsById.get(value) : undefined
  const units = useMemo(() => [...data.identities, ...data.enemies], [data])
  const groups = useMemo(() => searchUnits(units, query, kinds), [units, query, kinds])
  const pick = (u: Unit) => { onPick(u); setOpen(false); setQuery('') }
  return (
    <div className="relative">
      <span className="block text-xs uppercase tracking-widest text-bone-dim">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-1 flex w-full items-center gap-3 rounded border border-paper-light bg-paper px-3 py-2 text-left hover:border-gold"
      >
        {selected ? <UnitRow unit={selected} images={data.images} /> : <span className="text-bone-dim">Choose a unit…</span>}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded border border-paper-light bg-paper shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter') { const first = groups[0]?.units[0]; if (first) pick(first) }
            }}
            placeholder="Search by name or group"
            aria-label={`Search ${label}`}
            className="w-full border-b border-paper-light bg-ink px-3 py-2 text-sm outline-none"
          />
          <ul role="listbox" className="max-h-72 overflow-y-auto">
            {groups.map(g => (
              <li key={`${g.kind}:${g.label}`}>
                <div className="sticky top-0 bg-paper-light px-3 py-1 text-[10px] uppercase tracking-widest text-bone-dim">
                  {g.kind === 'identity' ? 'Identity' : 'Enemy'} · {g.label}
                </div>
                {g.units.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    role="option"
                    aria-selected={u.id === value}
                    onClick={() => pick(u)}
                    className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-paper-light ${u.id === value ? 'text-gold-bright' : ''}`}
                  >
                    <UnitRow unit={u} images={data.images} />
                  </button>
                ))}
              </li>
            ))}
            {groups.length === 0 && <li className="px-3 py-2 text-sm text-bone-dim">No match.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
```

`apps/web/src/components/SkillPicker.tsx`:

```tsx
import type { Unit, UptieTier } from '@limbus/engine'
import type { ImageManifest } from '../lib/data.ts'
import { skillIconUrl } from '../lib/images.ts'
import { skillAtUptie } from '../lib/setup.ts'
import { slotLabel } from '../lib/unitSearch.ts'
import { DamageTypeBadge, SinBadge } from './Badges.tsx'

interface Props { unit: Unit; value: string | null; uptie: UptieTier; images: ImageManifest; onPick: (skillId: string) => void }

/** One button per skill, showing the numbers at the chosen uptie. */
export function SkillPicker({ unit, value, uptie, images, onPick }: Props) {
  if (unit.skills.length === 0) return <p className="mt-3 text-sm text-bone-dim">This part has no skills; it can only be attacked.</p>
  return (
    <div className="mt-3 grid gap-1">
      {unit.skills.map(raw => {
        const s = skillAtUptie(raw, uptie)
        const icon = skillIconUrl(images, s)
        const active = s.id === value
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(s.id)}
            className={`flex items-center gap-3 rounded border px-2 py-1.5 text-left text-sm ${active ? 'border-gold bg-paper-light' : 'border-paper-light hover:border-bone-dim'}`}
          >
            <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">{icon && <img src={icon} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
            <span className="w-12 shrink-0 text-[10px] uppercase tracking-widest text-bone-dim">{slotLabel(s)}</span>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="ledger-number shrink-0 text-xs text-bone-dim">{s.basePower}<span className="text-gold">+{s.coinPower}</span>×{s.coinCount}</span>
            <SinBadge sin={s.sin} />
            <DamageTypeBadge type={s.damageType} />
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Status, manual overrides, effect list**

`apps/web/src/components/StatusEditor.tsx`:

```tsx
import { statusEffects, type StatusValue } from '@limbus/engine'

interface Props { status: Record<string, StatusValue>; onChange: (id: string, value: StatusValue | null) => void }

const OPTIONS: { id: string; name: string }[] = [{ id: 'poise', name: 'Poise' }, ...statusEffects.map(e => ({ id: e.id, name: e.name }))]
const nameOf = (id: string) => OPTIONS.find(o => o.id === id)?.name ?? id

/** Potency / count per status stack. Poise drives crit chance; the rest come from the engine registry. */
export function StatusEditor({ status, onChange }: Props) {
  const present = Object.keys(status)
  return (
    <div className="mt-3">
      <span className="block text-xs uppercase tracking-widest text-bone-dim">Status</span>
      {present.length > 0 && (
        <table className="mt-1 w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-bone-dim"><tr><th className="text-left">Effect</th><th className="w-20">Potency</th><th className="w-20">Count</th><th className="w-8" /></tr></thead>
          <tbody>
            {present.map(id => (
              <tr key={id}>
                <td className="py-0.5">{nameOf(id)}</td>
                <td><input type="number" min={0} aria-label={`${nameOf(id)} potency`} value={status[id].potency} onChange={e => onChange(id, { ...status[id], potency: Number(e.target.value) })} className="ledger-number w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right" /></td>
                <td><input type="number" min={0} aria-label={`${nameOf(id)} count`} value={status[id].count} onChange={e => onChange(id, { ...status[id], count: Number(e.target.value) })} className="ledger-number w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right" /></td>
                <td><button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => onChange(id, null)} className="px-1 text-bone-dim hover:text-blood-bright">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <select
        value=""
        aria-label="Add status"
        onChange={e => { if (e.target.value) onChange(e.target.value, { potency: 1, count: 1 }) }}
        className="mt-1 w-full rounded border border-paper-light bg-paper px-2 py-1 text-sm text-bone-dim"
      >
        <option value="">Add status…</option>
        {OPTIONS.filter(o => !present.includes(o.id)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}
```

`apps/web/src/components/ManualEditor.tsx`:

```tsx
import type { ManualOverrides } from '@limbus/engine'

interface Props { manual: ManualOverrides; onChange: (key: keyof ManualOverrides, value: number) => void }

const FIELDS: { key: keyof ManualOverrides; label: string }[] = [
  { key: 'basePower', label: 'Base power' }, { key: 'coinPower', label: 'Coin power' },
  { key: 'clashPower', label: 'Clash power' }, { key: 'damagePercent', label: 'Damage %' },
]

/** Flat adjustments for anything the parser or the data does not carry (spec 10: Railway-specific buffs). */
export function ManualEditor({ manual, onChange }: Props) {
  return (
    <div className="mt-3">
      <span className="block text-xs uppercase tracking-widest text-bone-dim">Manual overrides</span>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FIELDS.map(f => (
          <label key={f.key} className="text-xs text-bone-dim">
            {f.label}
            <input type="number" value={manual[f.key]} onChange={e => onChange(f.key, Number(e.target.value))} className="ledger-number mt-0.5 w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right text-sm text-bone" />
          </label>
        ))}
      </div>
    </div>
  )
}
```

`apps/web/src/components/EffectList.tsx`:

```tsx
import type { Effect, Passive, ResolvedCombatant, Skill } from '@limbus/engine'
import { effectStatus, type EffectStatus } from '../lib/effectStatus.ts'

interface Props { skill: Skill; passives: Passive[]; resolved: ResolvedCombatant }

const MARK: Record<EffectStatus, { text: string; className: string }> = {
  applied: { text: 'applied', className: 'text-gold-bright' },
  unparsed: { text: 'unparsed', className: 'text-blood-bright' },
  inactive: { text: 'not active', className: 'text-bone-dim' },
}

function Line({ effect, resolved }: { effect: Effect; resolved: ResolvedCombatant }) {
  const mark = MARK[effectStatus(effect, resolved)]
  const scope = effect.scope === 'skill' ? '' : `coin ${effect.scope.coin + 1}: `
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className={`w-16 shrink-0 text-[10px] uppercase tracking-widest ${mark.className}`}>{mark.text}</span>
      <span className={effectStatus(effect, resolved) === 'unparsed' ? 'text-bone' : 'text-bone-dim'}>{scope}{effect.source}</span>
    </li>
  )
}

/** Every effect line the engine saw, marked applied / unparsed / not active, with the raw wiki text underneath. */
export function EffectList({ skill, passives, resolved }: Props) {
  return (
    <details className="mt-3 rounded border border-paper-light bg-ink/40 p-2" open>
      <summary className="cursor-pointer text-xs uppercase tracking-widest text-bone-dim">
        Effects · {resolved.effectsApplied.length} applied · <span className={resolved.effectsUnparsed.length ? 'text-blood-bright' : ''}>{resolved.effectsUnparsed.length} unparsed</span>
      </summary>
      <ul className="mt-2 grid gap-1">
        {skill.effects.map((e, i) => <Line key={`s${i}`} effect={e} resolved={resolved} />)}
        {passives.map(p => p.effects.map((e, i) => <Line key={`${p.name}${i}`} effect={e} resolved={resolved} />))}
        {skill.effects.length === 0 && passives.every(p => p.effects.length === 0) && <li className="text-sm text-bone-dim">No effect text.</li>}
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-bone-dim">Raw wiki text</summary>
        <pre className="mt-1 whitespace-pre-wrap text-xs text-bone-dim">{skill.rawText.skill}</pre>
        {skill.rawText.coins.map((c, i) => <pre key={i} className="whitespace-pre-wrap text-xs text-bone-dim">Coin {i + 1}: {c || '—'}</pre>)}
        {passives.map(p => <pre key={p.name} className="mt-1 whitespace-pre-wrap text-xs text-bone-dim">{p.name}: {p.text}</pre>)}
      </details>
    </details>
  )
}
```

- [ ] **Step 6: Combatant card and the screen**

`apps/web/src/components/CombatantCard.tsx`:

```tsx
import type { Combatant, ResolvedCombatant, UptieTier } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { skillAtUptie, type SideKey } from '../lib/setup.ts'
import { useClashStore } from '../stores/clashStore.ts'
import { EffectList } from './EffectList.tsx'
import { ManualEditor } from './ManualEditor.tsx'
import { SkillPicker } from './SkillPicker.tsx'
import { StatusEditor } from './StatusEditor.tsx'
import { UnitPicker } from './UnitPicker.tsx'

interface Props { side: SideKey; data: GameData; combatant?: Combatant; resolved?: ResolvedCombatant }

const field = 'ledger-number mt-0.5 w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right text-sm text-bone'

export function CombatantCard({ side, data, combatant, resolved }: Props) {
  const setup = useClashStore(s => s.setup[side])
  const { pickUnit, pickSkill, patchSide, setStatus, setManual } = useClashStore.getState()
  const unit = combatant?.unit
  const isEnemy = unit?.kind === 'enemy'
  return (
    <section className="rounded border border-paper-light bg-paper p-4" aria-label={`Combatant ${side.toUpperCase()}`}>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-xl uppercase tracking-widest text-gold">Side {side.toUpperCase()}</h2>
        {unit && <span className="ledger-number text-xs text-bone-dim">HP {unit.hp} · SPD {unit.speed.min}–{unit.speed.max} · DEF {unit.defenseMod >= 0 ? '+' : ''}{unit.defenseMod}</span>}
      </div>
      <UnitPicker data={data} value={setup.unitId} onPick={u => pickUnit(side, u)} label="Unit" />
      {unit && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-xs text-bone-dim">Level
              <input type="number" min={1} max={isEnemy ? 200 : data.meta.levelCap} value={setup.level} onChange={e => patchSide(side, { level: Number(e.target.value) })} className={field} />
            </label>
            {!isEnemy && (
              <label className="text-xs text-bone-dim">Uptie
                <select value={setup.uptie} onChange={e => patchSide(side, { uptie: Number(e.target.value) as UptieTier })} className={field}>
                  {[1, 2, 3, 4].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            )}
            {!isEnemy && (
              <label className="text-xs text-bone-dim">SP
                <input type="number" min={-45} max={45} value={setup.sanity} onChange={e => patchSide(side, { sanity: Number(e.target.value) })} className={field} />
              </label>
            )}
            <label className="text-xs text-bone-dim">Current HP
              <input type="number" min={1} max={unit.hp} placeholder={String(unit.hp)} value={setup.currentHp ?? ''} onChange={e => patchSide(side, { currentHp: e.target.value === '' ? null : Number(e.target.value) })} className={field} />
            </label>
          </div>
          <SkillPicker unit={unit} value={setup.skillId} uptie={setup.uptie} images={data.images} onPick={id => pickSkill(side, id)} />
          <StatusEditor status={setup.status} onChange={(id, v) => setStatus(side, id, v)} />
          <ManualEditor manual={setup.manual} onChange={(k, v) => setManual(side, k, v)} />
          {combatant?.skill && resolved && <EffectList skill={skillAtUptie(combatant.skill, setup.uptie)} passives={unit.passives} resolved={resolved} />}
        </>
      )}
    </section>
  )
}
```

`apps/web/src/screens/ClashScreen.tsx`:

```tsx
import { resolveCombatant } from '@limbus/engine'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CombatantCard } from '../components/CombatantCard.tsx'
import type { GameData } from '../lib/data.ts'
import { pct } from '../lib/format.ts'
import { href, navigate } from '../lib/router.ts'
import { toCombatant } from '../lib/setup.ts'
import { decodeSetup, encodeSetup } from '../lib/setupCodec.ts'
import { useClashReport } from '../lib/useEngine.ts'
import { useClashStore } from '../stores/clashStore.ts'

interface Props { data: GameData; search: URLSearchParams }

export function ClashScreen({ data, search }: Props) {
  const setup = useClashStore(s => s.setup)
  const { replace, swap, setStaggerMidAttack } = useClashStore.getState()
  const [copied, setCopied] = useState(false)

  // URL -> store when the page opens (or is navigated to) with ?s=; store -> URL on every change.
  const lastEncoded = useRef<string | null>(null)
  useEffect(() => {
    const s = search.get('s')
    if (!s || s === lastEncoded.current) return
    const decoded = decodeSetup(s)
    if (decoded) { lastEncoded.current = s; replace(decoded) }
  }, [search, replace])
  useEffect(() => {
    const encoded = encodeSetup(setup)
    if (encoded === lastEncoded.current) return
    lastEncoded.current = encoded
    navigate(href('/', new URLSearchParams({ s: encoded })), true)
  }, [setup])

  const a = useMemo(() => toCombatant(setup.a, data), [setup.a, data])
  const b = useMemo(() => toCombatant(setup.b, data), [setup.b, data])
  const resolvedA = useMemo(() => (a ? resolveCombatant(a, b) : undefined), [a, b])
  const resolvedB = useMemo(() => (b ? resolveCombatant(b, a) : undefined), [a, b])
  const options = useMemo(() => ({ staggerMidAttack: setup.staggerMidAttack }), [setup.staggerMidAttack])
  const report = useClashReport(a, b, options)

  const copyLink = async () => {
    await navigator.clipboard.writeText(location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" onClick={swap} className="rounded border border-paper-light px-3 py-1 hover:border-gold">Swap sides</button>
        <button type="button" onClick={copyLink} className="rounded border border-paper-light px-3 py-1 hover:border-gold">{copied ? 'Link copied' : 'Copy share link'}</button>
        <label className="ml-auto flex items-center gap-2 text-bone-dim">
          <input type="checkbox" checked={setup.staggerMidAttack} onChange={e => setStaggerMidAttack(e.target.checked)} />
          Stagger applies to the remaining coins of the same attack
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CombatantCard side="a" data={data} combatant={a} resolved={resolvedA} />
        <CombatantCard side="b" data={data} combatant={b} resolved={resolvedB} />
      </div>
      {/* Task 9 replaces this summary with <VerdictPanel> and <RollOnce>. */}
      <section className="mt-6 rounded border border-paper-light bg-paper p-4" aria-live="polite">
        {!a?.skill || !b?.skill ? <p className="text-bone-dim">Pick a unit and a skill on both sides to compute the clash.</p>
          : report.error ? <p className="text-blood-bright">{report.error}</p>
          : !report.result ? <p className="text-bone-dim">Computing…</p>
          : <p className="ledger-number text-lg">Win {pct(report.result.win)} · Draw {pct(report.result.draw)} · Lose {pct(report.result.lose)}</p>}
      </section>
    </div>
  )
}
```

In `apps/web/src/App.tsx`, import `ClashScreen` and change `RouteBody` so the clash branch renders it:

```tsx
import { ClashScreen } from './screens/ClashScreen.tsx'
// ...
function RouteBody({ route, data }: { route: Route; data: GameData }) {
  // Task 10 replaces the railway branch with <RailwayScreen>.
  if (route.name === 'not-found') return <p className="text-bone-dim">No page at <code>{route.path}</code>.</p>
  if (route.name === 'clash') return <ClashScreen data={data} search={route.search} />
  return (
    <section>
      <h1 className="font-[family-name:var(--font-display)] text-4xl uppercase tracking-wide text-gold">Railway Planner</h1>
      <p className="mt-2 text-bone-dim">{data.enemies.length} enemy parts loaded for {data.railway.title}.</p>
    </section>
  )
}
```

- [ ] **Step 7: Verify in the browser**

Run: `npm test -w @limbus/web && npm run typecheck -w @limbus/web && npm run lint -w @limbus/web`, then `npm run dev -w @limbus/web` and check by hand:
- Pick "Blade Lineage Salsu Don Quixote" on A and any enemy part on B: portraits and skill icons render, the win/draw/lose line appears and updates when uptie, level, SP, status, or manual overrides change.
- The URL gains `?s=…` and reloading the page restores the same setup; opening the URL in a private window restores it too (URL wins over the persisted setup).
- The effect list marks lines applied / unparsed / not active; adding Poise 5 flips a "5+ Poise" condition to applied.
- Pick a skill-less part ("Head" of Refracted Illusory Butterfly) on B: the card says it can only be attacked and the summary asks for a skill.
- At 390 px width nothing overflows horizontally.
Stop the dev server and record what you checked in the report.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "Build the Clash Calculator screen with pickers, effect marks, and shareable URLs

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 9: Verdict panel and "Roll once"

**Files:**
- Create: `apps/web/src/lib/verdict.ts`, `apps/web/src/components/DamageBand.tsx`, `apps/web/src/components/VerdictPanel.tsx`, `apps/web/src/components/RollOnce.tsx`
- Modify: `apps/web/src/screens/ClashScreen.tsx`
- Test: `apps/web/test/verdict.test.ts`

**Interfaces:**
- Consumes: engine `ClashReport`, `DamageSummary`, `sampleClash`, `ClashSample`; Task 8's `Stamp`, `pct`, `num`.
- Produces: `verdictFor(report) -> { text: 'FAVORED' | 'EVEN' | 'UNFAVORED' | 'STALEMATE'; tone: 'gold' | 'bone' | 'blood' }`, `bandGeometry(summary) -> { left, width, median } as fractions of max`; components `DamageBand({ summary, label })`, `VerdictPanel({ report, a, b })`, `RollOnce({ a, b, report, options })`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/verdict.test.ts`:

```ts
import type { ClashReport, DamageSummary } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { bandGeometry, verdictFor } from '../src/lib/verdict.ts'

const summary = (over: Partial<DamageSummary>): DamageSummary => ({ mean: 0, p10: 0, p50: 0, p90: 0, max: 0, perCoinMean: [], histogram: [[0, 1]], staggerChance: [], ...over })
const report = (win: number, lose: number, draw: number): ClashReport => ({
  win, lose, draw, coinsLeftIfWin: [], coinsLeftIfLose: [], parryRoundsExpected: 0,
  damageDealt: summary({}), damageTaken: summary({}), breakdown: [],
})

describe('verdictFor', () => {
  it('stamps favored above 55%, unfavored below 45%, even between, stalemate on a sure draw', () => {
    expect(verdictFor(report(0.7, 0.3, 0))).toEqual({ text: 'FAVORED', tone: 'gold' })
    expect(verdictFor(report(0.3, 0.7, 0))).toEqual({ text: 'UNFAVORED', tone: 'blood' })
    expect(verdictFor(report(0.5, 0.5, 0))).toEqual({ text: 'EVEN', tone: 'bone' })
    expect(verdictFor(report(0, 0, 1))).toEqual({ text: 'STALEMATE', tone: 'bone' })
  })
})

describe('bandGeometry', () => {
  it('places p10, p90, and the median as fractions of the maximum', () => {
    expect(bandGeometry(summary({ p10: 10, p50: 25, p90: 40, max: 50 }))).toEqual({ left: 0.2, width: 0.6, median: 0.5 })
  })
  it('collapses to zero width when there is no damage', () => {
    expect(bandGeometry(summary({}))).toEqual({ left: 0, width: 0, median: 0 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/web -- verdict`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`apps/web/src/lib/verdict.ts`:

```ts
import type { ClashReport, DamageSummary } from '@limbus/engine'

export interface Verdict { text: 'FAVORED' | 'EVEN' | 'UNFAVORED' | 'STALEMATE'; tone: 'gold' | 'bone' | 'blood' }

export function verdictFor(report: ClashReport): Verdict {
  if (report.draw >= 1) return { text: 'STALEMATE', tone: 'bone' }
  if (report.win >= 0.55) return { text: 'FAVORED', tone: 'gold' }
  if (report.win <= 0.45) return { text: 'UNFAVORED', tone: 'blood' }
  return { text: 'EVEN', tone: 'bone' }
}

/** Where the p10–p90 band and the median sit on a 0..max axis, as fractions. */
export function bandGeometry(s: DamageSummary): { left: number; width: number; median: number } {
  if (s.max <= 0) return { left: 0, width: 0, median: 0 }
  return { left: s.p10 / s.max, width: (s.p90 - s.p10) / s.max, median: s.p50 / s.max }
}
```

`apps/web/src/components/DamageBand.tsx`:

```tsx
import type { DamageSummary } from '@limbus/engine'
import { num } from '../lib/format.ts'
import { bandGeometry } from '../lib/verdict.ts'

/** p10–p90 range on a 0..max axis with the median marked; numbers alongside. */
export function DamageBand({ summary, label }: { summary: DamageSummary; label: string }) {
  const g = bandGeometry(summary)
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs uppercase tracking-widest text-bone-dim">
        <span>{label}</span>
        <span className="ledger-number">median <span className="text-bone">{num(summary.p50)}</span> · mean {num(summary.mean)} · max {num(summary.max)}</span>
      </div>
      <div className="relative mt-1 h-3 rounded bg-ink" role="img" aria-label={`${label}: 10th percentile ${num(summary.p10)}, median ${num(summary.p50)}, 90th percentile ${num(summary.p90)}, maximum ${num(summary.max)}`}>
        <div className="absolute top-0 h-full rounded bg-gold/40" style={{ left: `${g.left * 100}%`, width: `${g.width * 100}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-gold-bright" style={{ left: `${g.median * 100}%` }} />
      </div>
      <div className="ledger-number mt-0.5 flex justify-between text-[10px] text-bone-dim"><span>0</span><span>p10 {num(summary.p10)} – p90 {num(summary.p90)}</span><span>{num(summary.max)}</span></div>
    </div>
  )
}
```

`apps/web/src/components/VerdictPanel.tsx`:

```tsx
import type { ClashReport, Combatant } from '@limbus/engine'
import { num, pct } from '../lib/format.ts'
import { verdictFor } from '../lib/verdict.ts'
import { Stamp } from './Badges.tsx'
import { DamageBand } from './DamageBand.tsx'

interface Props { report: ClashReport; a: Combatant; b: Combatant }

const fmtValue = (label: string, value: number) =>
  label === 'Heads chance' || label === 'Crit chance' ? pct(value) : Number.isInteger(value) ? String(value) : value.toFixed(3)

/** Everything the report says, in ledger order: verdict, odds, damage dealt, coins, stagger, damage taken, breakdown. */
export function VerdictPanel({ report, a, b }: Props) {
  const verdict = verdictFor(report)
  const thresholds = b.unit.staggerThresholds
  const coinsLeft = report.coinsLeftIfWin.map((p, coins) => ({ coins, p })).filter(x => x.p > 0.0005)
  return (
    <section className="mt-6 rounded border border-paper-light bg-paper p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-bone-dim">Side A wins</div>
          <div className="ledger-number text-5xl text-gold-bright">{pct(report.win)}</div>
        </div>
        <div className="ledger-number grid text-sm text-bone-dim">
          <span>Draw {pct(report.draw)}</span>
          <span>Lose {pct(report.lose)}</span>
          <span>Expected parry rounds {report.parryRoundsExpected.toFixed(2)}</span>
        </div>
        <div className="ml-auto"><Stamp tone={verdict.tone}>{verdict.text}</Stamp></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <DamageBand summary={report.damageDealt} label={`Damage to ${b.unit.name} if A wins`} />
          {report.damageDealt.perCoinMean.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-bone-dim"><tr><th className="text-left">Coin</th><th className="text-right">Mean damage</th></tr></thead>
              <tbody className="ledger-number">
                {report.damageDealt.perCoinMean.map((m, i) => <tr key={i}><td>Coin {i + 1}</td><td className="text-right">{m.toFixed(1)}</td></tr>)}
              </tbody>
            </table>
          )}
          {thresholds.length > 0 && (
            <ul className="mt-3 grid gap-0.5 text-sm">
              {thresholds.map((t, i) => (
                <li key={i} className="flex justify-between"><span className="text-bone-dim">Crosses the {pct(t, 0)} HP stagger line</span><span className="ledger-number">{pct(report.damageDealt.staggerChance[i] ?? 0)}</span></li>
              ))}
            </ul>
          )}
          {coinsLeft.length > 0 && (
            <p className="ledger-number mt-3 text-xs text-bone-dim">Coins left if A wins: {coinsLeft.map(x => `${x.coins} (${pct(x.p, 0)})`).join(', ')}</p>
          )}
        </div>
        <div>
          <DamageBand summary={report.damageTaken} label={`Damage to ${a.unit.name} if B wins`} />
          <table className="mt-3 w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-bone-dim"><tr><th className="text-left">Modifier</th><th className="text-right">Value</th><th className="text-left pl-3">Source</th></tr></thead>
            <tbody>
              {report.breakdown.map(line => (
                <tr key={line.label} className="border-t border-paper-light/60">
                  <td className="py-0.5">{line.label}</td>
                  <td className="ledger-number text-right">{fmtValue(line.label, line.value)}</td>
                  <td className="pl-3 text-xs text-bone-dim">{line.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-bone-dim">Damage figures are conditional on that side winning; unopposed hits use every coin. Max HP {num(b.unit.hp)} for {b.unit.name}.</p>
        </div>
      </div>
    </section>
  )
}
```

`apps/web/src/components/RollOnce.tsx`:

```tsx
import { sampleClash, type ClashReport, type ClashSample, type Combatant, type ReportOptions } from '@limbus/engine'
import { useState } from 'react'
import { num } from '../lib/format.ts'
import { Stamp } from './Badges.tsx'

interface Props { a: Combatant; b: Combatant; report: ClashReport; options: ReportOptions }

/** One sampled outcome from the exact distribution, revealed coin by coin. Secondary to the verdict, never the default view. */
export function RollOnce({ a, b, report, options }: Props) {
  const [sample, setSample] = useState<ClashSample | null>(null)
  const [rollId, setRollId] = useState(0)
  const roll = () => { setSample(sampleClash(a, b, options, Math.random, report)); setRollId(n => n + 1) }
  const winner = sample?.outcome === 'win' ? a : sample?.outcome === 'lose' ? b : undefined
  const loser = sample?.outcome === 'win' ? b : sample?.outcome === 'lose' ? a : undefined
  return (
    <section className="mt-4 rounded border border-paper-light bg-paper p-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={roll} className="rounded border border-gold px-3 py-1 text-sm uppercase tracking-widest text-gold hover:bg-gold hover:text-ink">Roll once</button>
        <span className="text-xs text-bone-dim">Samples one outcome from the distribution above. The odds do not change.</span>
      </div>
      {sample && (
        <div key={rollId} className="mt-4">
          <Stamp tone={sample.outcome === 'win' ? 'gold' : sample.outcome === 'lose' ? 'blood' : 'bone'}>
            {sample.outcome === 'draw' ? 'DRAW' : `${winner!.unit.name} WINS`}
          </Stamp>
          {sample.outcome !== 'draw' && (
            <p className="mt-2 text-sm text-bone-dim">
              {winner!.unit.name} attacks {loser!.unit.name} with {sample.coinsLeft} coin{sample.coinsLeft === 1 ? '' : 's'}
              {sample.guardReduction > 0 && <> after a guard worth <span className="ledger-number text-bone">{sample.guardReduction}</span> power</>}.
            </p>
          )}
          {sample.attack && (
            <ol className="mt-3 flex flex-wrap gap-2">
              {sample.attack.coins.map((c, i) => (
                <li key={i} className="coin-flip w-24 rounded border border-paper-light bg-ink p-2 text-center" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className={`text-[10px] uppercase tracking-widest ${c.heads ? 'text-gold-bright' : 'text-bone-dim'}`}>{c.heads ? 'Heads' : 'Tails'}{c.crit ? ' · crit' : ''}</div>
                  <div className="ledger-number text-xl">{num(c.damage)}</div>
                  <div className="ledger-number text-[10px] text-bone-dim">roll {c.roll}{c.staggered ? ' · staggered' : ''}</div>
                </li>
              ))}
              <li className="w-24 rounded border border-gold/50 p-2 text-center">
                <div className="text-[10px] uppercase tracking-widest text-bone-dim">Total</div>
                <div className="ledger-number text-xl text-gold-bright">{num(sample.attack.total)}</div>
              </li>
            </ol>
          )}
          {sample.outcome !== 'draw' && !sample.attack && <p className="mt-2 text-sm text-bone-dim">The winner's skill deals no damage.</p>}
        </div>
      )}
    </section>
  )
}
```

In `apps/web/src/screens/ClashScreen.tsx` import `VerdictPanel` and `RollOnce` and replace the summary `<section>` (and its Task 9 comment) with:

```tsx
      {!a?.skill || !b?.skill ? (
        <section className="mt-6 rounded border border-paper-light bg-paper p-4"><p className="text-bone-dim">Pick a unit and a skill on both sides to compute the clash.</p></section>
      ) : report.error ? (
        <section className="mt-6 rounded border border-paper-light bg-paper p-4"><p className="text-blood-bright">{report.error}</p></section>
      ) : !report.result ? (
        <section className="mt-6 rounded border border-paper-light bg-paper p-4"><p className="text-bone-dim">Computing…</p></section>
      ) : (
        <>
          <VerdictPanel report={report.result} a={a} b={b} />
          <RollOnce a={a} b={b} report={report.result} options={options} />
        </>
      )}
```

and drop the now-unused `pct` import.

- [ ] **Step 4: Verify**

Run: `npm test -w @limbus/web && npm run typecheck -w @limbus/web && npm run lint -w @limbus/web`, then `npm run dev -w @limbus/web`:
- Identity vs identity: stamp, win %, both damage bands, per-coin table, stagger lines with chances, breakdown rows with sources.
- Identity attack vs an Invidiae `DEF` guard skill: the breakdown gains a "Guard reduction" row, damage to A is zero, Roll once shows the guard power sentence.
- Roll once: coins reveal left to right; with the OS reduced-motion setting on, they appear at once.
- 390 px width: bands and tables wrap without horizontal page scroll.
Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "Add the verdict panel with damage bands, breakdown, and a coin-by-coin roll

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 10: Railway Planner: station picker, team builder, matchup grid

**Files:**
- Create: `apps/web/src/lib/railway.ts`, `apps/web/src/lib/gridColor.ts`, `apps/web/src/components/StationPicker.tsx`, `apps/web/src/components/TeamBuilder.tsx`, `apps/web/src/components/MatchupGridView.tsx`, `apps/web/src/screens/RailwayScreen.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/test/railway.test.ts`, `apps/web/test/gridColor.test.ts`

**Interfaces:**
- Consumes: Task 5 data and router, Task 6 `useMatchupGrid`, Task 7 `useTeamStore`, `toCombatant`, `emptySide`, `sideForUnit`, codec; engine `MatchupGrid`.
- Produces: `waveUnits(data, wave) -> { units: Unit[]; missingIds: string[] }`, `slotCombatant(slot, data) -> Combatant | undefined`, `pairingSetup(slot, rowSkillId, part, colSkillId, staggerMidAttack) -> ClashSetup`, `selectedEncounter(railway, search) -> { section, wave }`; `cellColor(win: number | null) -> string`; components `StationPicker`, `TeamBuilder`, `MatchupGridView`; `RailwayScreen({ data, search })`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/railway.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { indexData } from '../src/lib/data.ts'
import { pairingSetup, selectedEncounter, slotCombatant, waveUnits } from '../src/lib/railway.ts'
import { makeRaw } from './fixtures.ts'

const data = indexData(makeRaw())

describe('waveUnits', () => {
  it('expands enemy ids into their parts, main wave before reinforcements, and lists ids with no data', () => {
    const r = waveUnits(data, { number: 1, enemyIds: ['9568'], reinforcementIds: ['9553'] })
    expect(r.units.map(u => u.id)).toEqual(['9568:0', '9568:1'])
    expect(r.missingIds).toEqual(['9553'])
  })
})

describe('slotCombatant', () => {
  it('builds a team combatant at the slot uptie and level with no skill selected', () => {
    const c = slotCombatant({ unitId: 'u', uptie: 3, level: 50 }, data)!
    expect(c.unit.hp).toBe(180)
    expect(c.uptie).toBe(3)
    expect(c.skill).toBeUndefined()
    expect(slotCombatant({ unitId: 'missing', uptie: 4, level: 60 }, data)).toBeUndefined()
  })
})

describe('pairingSetup', () => {
  it('preloads the clash calculator with my skill against the part and its skill', () => {
    const setup = pairingSetup({ unitId: 'u', uptie: 3, level: 50 }, 'u::skill1', data.unitsById.get('9568:0')!, '9568:0::skill1', false)
    expect(setup.a).toMatchObject({ unitId: 'u', skillId: 'u::skill1', uptie: 3, level: 50 })
    expect(setup.b).toMatchObject({ unitId: '9568:0', skillId: '9568:0::skill1', level: 60 })
    expect(setup.staggerMidAttack).toBe(false)
  })
  it('leaves the enemy skill empty for a skill-less part', () => {
    expect(pairingSetup({ unitId: 'u', uptie: 4, level: 60 }, 'u::skill1', data.unitsById.get('9568:1')!, null, true).b.skillId).toBeNull()
  })
})

describe('selectedEncounter', () => {
  it('defaults to the first section and wave and clamps unknown numbers', () => {
    expect(selectedEncounter(data.railway, new URLSearchParams())).toMatchObject({ section: { number: 1 }, wave: { number: 1 } })
    expect(selectedEncounter(data.railway, new URLSearchParams({ section: '9', wave: '9' }))).toMatchObject({ section: { number: 1 }, wave: { number: 1 } })
  })
})
```

`apps/web/test/gridColor.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cellColor } from '../src/lib/gridColor.ts'

describe('cellColor', () => {
  it('runs from blood at 0% through gold at 100%, and is neutral without a clash', () => {
    expect(cellColor(0)).toBe('rgba(140, 28, 28, 0.45)')
    expect(cellColor(1)).toBe('rgba(201, 162, 39, 0.45)')
    expect(cellColor(0.5)).toBe('rgba(171, 95, 34, 0.45)')
    expect(cellColor(null)).toBe('transparent')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @limbus/web -- railway gridColor`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the helpers**

`apps/web/src/lib/railway.ts`:

```ts
import type { Combatant, Unit } from '@limbus/engine'
import type { GameData, RailwayLine, RailwaySection, RailwayWave } from './data.ts'
import { emptySide, sideForUnit, toCombatant, type ClashSetup } from './setup.ts'
import type { TeamSlot } from '../stores/teamStore.ts'

/** Every part of every enemy in the wave (main list first, then reinforcements), plus ids the scrape has no unit for. */
export function waveUnits(data: GameData, wave: RailwayWave): { units: Unit[]; missingIds: string[] } {
  const units: Unit[] = []
  const missingIds: string[] = []
  for (const id of [...wave.enemyIds, ...wave.reinforcementIds]) {
    const parts = data.unitsByEnemyId.get(id)
    if (parts) units.push(...parts)
    else missingIds.push(id)
  }
  return { units, missingIds }
}

/** A team member as the grid wants it: unit scaled to the slot level, no particular skill (the grid enumerates them). */
export function slotCombatant(slot: TeamSlot, data: GameData): Combatant | undefined {
  return toCombatant({ ...emptySide(), unitId: slot.unitId, uptie: slot.uptie, level: slot.level }, data)
}

/** Clash Calculator setup for one grid cell: my skill on side A, the part and its clashing skill on side B. */
export function pairingSetup(slot: TeamSlot, rowSkillId: string, part: Unit, colSkillId: string | null, staggerMidAttack: boolean): ClashSetup {
  const a = { ...emptySide(), unitId: slot.unitId, skillId: rowSkillId, uptie: slot.uptie, level: slot.level }
  const b = { ...sideForUnit(part), skillId: colSkillId }
  return { a, b, staggerMidAttack }
}

export function selectedEncounter(railway: RailwayLine, search: URLSearchParams): { section: RailwaySection; wave: RailwayWave } {
  const section = railway.sections.find(s => s.number === Number(search.get('section'))) ?? railway.sections[0]
  const wave = section.waves.find(w => w.number === Number(search.get('wave'))) ?? section.waves[0]
  return { section, wave }
}
```

`apps/web/src/lib/gridColor.ts`:

```ts
const BLOOD = [140, 28, 28] as const
const GOLD = [201, 162, 39] as const

/** Cell tint from blood (0% win) to gold (100% win); transparent when there is no clash to color. */
export function cellColor(win: number | null): string {
  if (win === null) return 'transparent'
  const t = Math.min(1, Math.max(0, win))
  const mix = (i: 0 | 1 | 2) => Math.round(BLOOD[i] + (GOLD[i] - BLOOD[i]) * t)
  return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, 0.45)`
}
```

Run: `npm test -w @limbus/web -- railway gridColor`
Expected: PASS.

- [ ] **Step 4: Components**

`apps/web/src/components/StationPicker.tsx`:

```tsx
import type { GameData, RailwaySection, RailwayWave } from '../lib/data.ts'
import { portraitUrl } from '../lib/images.ts'

interface Props { data: GameData; section: RailwaySection; wave: RailwayWave; onSelect: (section: number, wave: number) => void }

function EnemyChips({ data, ids }: { data: GameData; ids: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ids.map(id => {
        const parts = data.unitsByEnemyId.get(id)
        const first = parts?.[0]
        const url = first && portraitUrl(data.images, first)
        return (
          <li key={id} className="flex items-center gap-2 rounded border border-paper-light bg-ink px-2 py-1 text-xs" title={first?.group ?? `Enemy ${id}`}>
            <span className="h-6 w-6 overflow-hidden rounded bg-paper">{url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}</span>
            <span>{first ? first.group : <span className="text-blood-bright">#{id} no data</span>}</span>
            {parts && parts.length > 1 && <span className="ledger-number text-bone-dim">×{parts.length}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** Sections of the live Line with their stations; the chosen section lists its waves with enemy portraits. */
export function StationPicker({ data, section, wave, onSelect }: Props) {
  const { railway } = data
  const stationName = (n: number) => railway.stations.find(s => s.number === n)?.name ?? `Station ${n}`
  return (
    <section className="rounded border border-paper-light bg-paper p-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl uppercase tracking-widest text-gold">{railway.title}</h2>
      <p className="text-xs text-bone-dim">Started {railway.start}</p>
      <ol className="mt-3 grid gap-1">
        {railway.sections.map(s => (
          <li key={s.number}>
            <button
              type="button"
              aria-pressed={s.number === section.number}
              onClick={() => onSelect(s.number, s.waves[0]?.number ?? 1)}
              className={`flex w-full flex-wrap items-baseline gap-x-3 rounded border px-3 py-1.5 text-left text-sm ${s.number === section.number ? 'border-gold bg-paper-light' : 'border-paper-light hover:border-bone-dim'}`}
            >
              <span className="ledger-number text-bone-dim">§{s.number}</span>
              <span className="flex flex-wrap gap-x-2">{s.stationNumbers.map(n => <span key={n}><span className="ledger-number text-bone-dim">#{n}</span> {stationName(n)}</span>)}</span>
            </button>
            {s.number === section.number && (
              <ol className="mt-1 ml-6 grid gap-2">
                {s.waves.map(w => (
                  <li key={w.number}>
                    <button type="button" aria-pressed={w.number === wave.number} onClick={() => onSelect(s.number, w.number)} className={`mb-1 text-xs uppercase tracking-widest ${w.number === wave.number ? 'text-gold-bright' : 'text-bone-dim hover:text-bone'}`}>
                      Wave {w.number}
                    </button>
                    <EnemyChips data={data} ids={w.enemyIds} />
                    {w.reinforcementIds.length > 0 && (
                      <div className="mt-1">
                        <span className="text-[10px] uppercase tracking-widest text-bone-dim">Reinforcements</span>
                        <EnemyChips data={data} ids={w.reinforcementIds} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
```

`apps/web/src/components/TeamBuilder.tsx`:

```tsx
import type { UptieTier } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { TEAM_SIZE, useTeamStore } from '../stores/teamStore.ts'
import { UnitPicker } from './UnitPicker.tsx'

const field = 'ledger-number mt-0.5 w-full rounded border border-paper-light bg-ink px-1 py-0.5 text-right text-sm text-bone'
const IDENTITY_ONLY = ['identity'] as const

/** Twelve identity slots with uptie and level, persisted across visits. */
export function TeamBuilder({ data }: { data: GameData }) {
  const slots = useTeamStore(s => s.slots)
  const { setSlot, patchSlot, clear } = useTeamStore.getState()
  const filled = slots.filter(Boolean).length
  return (
    <details className="rounded border border-paper-light bg-paper p-4" open={filled === 0}>
      <summary className="cursor-pointer font-[family-name:var(--font-display)] text-xl uppercase tracking-widest text-gold">
        Team · <span className="ledger-number">{filled}/{TEAM_SIZE}</span>
      </summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot, i) => (
          <div key={i} className="rounded border border-paper-light p-2">
            <UnitPicker data={data} value={slot?.unitId ?? null} kinds={IDENTITY_ONLY} label={`Slot ${i + 1}`} onPick={u => setSlot(i, { unitId: u.id, uptie: 4, level: u.level })} />
            {slot && (
              <div className="mt-2 flex items-end gap-2">
                <label className="flex-1 text-xs text-bone-dim">Uptie
                  <select value={slot.uptie} onChange={e => patchSlot(i, { uptie: Number(e.target.value) as UptieTier })} className={field}>{[1, 2, 3, 4].map(t => <option key={t} value={t}>{t}</option>)}</select>
                </label>
                <label className="flex-1 text-xs text-bone-dim">Level
                  <input type="number" min={1} max={data.meta.levelCap} value={slot.level} onChange={e => patchSlot(i, { level: Number(e.target.value) })} className={field} />
                </label>
                <button type="button" onClick={() => setSlot(i, null)} aria-label={`Clear slot ${i + 1}`} className="px-2 py-1 text-bone-dim hover:text-blood-bright">×</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {filled > 0 && <button type="button" onClick={clear} className="mt-3 text-xs uppercase tracking-widest text-bone-dim hover:text-blood-bright">Clear team</button>}
    </details>
  )
}
```

`apps/web/src/components/MatchupGridView.tsx`:

```tsx
import { ALL_SINS, type Combatant, type MatchupGrid, type Unit } from '@limbus/engine'
import type { GameData } from '../lib/data.ts'
import { mult, num, pct } from '../lib/format.ts'
import { cellColor } from '../lib/gridColor.ts'
import { portraitUrl } from '../lib/images.ts'
import { slotLabel } from '../lib/unitSearch.ts'

interface Props { data: GameData; grid: MatchupGrid; team: Combatant[]; wave: Unit[]; onCell: (rowIndex: number, colIndex: number) => void }

const DT = ['slash', 'pierce', 'blunt'] as const

/** Rows: my attack skills grouped by identity. Columns: enemy parts. Cells: win % and median damage, tinted by win %. */
export function MatchupGridView({ data, grid, team, wave, onCell }: Props) {
  const unitOf = (id: string) => data.unitsById.get(id)
  const skillOf = (id: string) => data.skillsById.get(id)
  return (
    <div className="overflow-x-auto rounded border border-paper-light bg-paper">
      <table className="min-w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-paper p-2 text-left text-[10px] uppercase tracking-widest text-bone-dim">My skill</th>
            {grid.columns.map((col, j) => {
              const part = wave[j]
              const url = portraitUrl(data.images, part)
              return (
                <th key={col.unitId} className="p-2 text-left align-top">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">{url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}</span>
                    <span className="min-w-0"><span className="block truncate">{part.name}</span><span className="block truncate text-bone-dim">{part.group}</span></span>
                  </div>
                  <div className="ledger-number mt-1 text-bone-dim">HP {num(part.hp)} · {col.skillId ? skillOf(col.skillId)?.name : <span className="text-bone-dim">no attack</span>}</div>
                </th>
              )
            })}
          </tr>
          {/* Coverage strip: the part's resistance multipliers, so a row's sin and type can be read against them. */}
          <tr className="border-y border-paper-light bg-ink/40">
            <th className="sticky left-0 z-10 bg-paper p-2 text-left text-[10px] uppercase tracking-widest text-bone-dim">Resistances</th>
            {wave.map(part => (
              <td key={part.id} className="ledger-number p-2 text-[10px] text-bone-dim">
                <div className="flex flex-wrap gap-x-2">{DT.map(d => <span key={d} className={part.resistances.damageType[d] !== 1 ? 'text-bone' : ''}>{d.slice(0, 2)} {mult(part.resistances.damageType[d])}</span>)}</div>
                <div className="flex flex-wrap gap-x-2">{ALL_SINS.map(s => <span key={s} className={part.resistances.sin[s] !== 1 ? 'text-bone' : ''}>{s.slice(0, 3)} {mult(part.resistances.sin[s])}</span>)}</div>
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row, i) => {
            const skill = skillOf(row.skillId)
            const unit = unitOf(row.unitId)
            const firstOfUnit = i === 0 || grid.rows[i - 1].unitId !== row.unitId
            return (
              <tr key={row.skillId} className={firstOfUnit ? 'border-t border-paper-light' : ''}>
                <th className="sticky left-0 z-10 bg-paper p-2 text-left font-normal">
                  {firstOfUnit && <div className="truncate text-[10px] uppercase tracking-widest text-gold">{unit?.name}</div>}
                  <div className="flex items-center gap-2"><span className="ledger-number text-bone-dim">{skill ? slotLabel(skill) : ''}</span><span className="truncate">{skill?.name}</span></div>
                </th>
                {grid.cells[i].map((cell, j) => (
                  <td key={cell.targetUnitId} className="p-0">
                    <button
                      type="button"
                      onClick={() => onCell(i, j)}
                      style={{ backgroundColor: cellColor(cell.win) }}
                      className="ledger-number flex h-full w-full flex-col items-start px-2 py-1.5 text-left hover:outline hover:outline-1 hover:outline-gold"
                      title={`${team.find(t => t.unit.id === row.unitId)?.unit.name} ${skill?.name} vs ${wave[j].name}: open in the Clash Calculator`}
                    >
                      <span className="text-sm">{cell.win === null ? '—' : pct(cell.win, 0)}</span>
                      <span className="text-bone-dim">{num(cell.medianDamage)} dmg</span>
                      {(cell.sinMultiplier !== 1 || cell.damageTypeMultiplier !== 1) && (
                        <span className="text-[10px] text-bone-dim">{cell.sinMultiplier !== 1 ? `sin ${mult(cell.sinMultiplier)} ` : ''}{cell.damageTypeMultiplier !== 1 ? `type ${mult(cell.damageTypeMultiplier)}` : ''}</span>
                      )}
                    </button>
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-paper-light">
            <th className="sticky left-0 z-10 bg-paper p-2 text-left text-[10px] uppercase tracking-widest text-bone-dim">Turns to kill (best skill)</th>
            {grid.columns.map(col => <td key={col.unitId} className="ledger-number p-2">{num(col.turnsToKill)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: The screen and the route**

`apps/web/src/screens/RailwayScreen.tsx`:

```tsx
import { useMemo } from 'react'
import { MatchupGridView } from '../components/MatchupGridView.tsx'
import { StationPicker } from '../components/StationPicker.tsx'
import { TeamBuilder } from '../components/TeamBuilder.tsx'
import type { GameData } from '../lib/data.ts'
import { pairingSetup, selectedEncounter, slotCombatant, waveUnits } from '../lib/railway.ts'
import { href, navigate } from '../lib/router.ts'
import { encodeSetup } from '../lib/setupCodec.ts'
import { useMatchupGrid } from '../lib/useEngine.ts'
import { useClashStore } from '../stores/clashStore.ts'
import { useTeamStore, type TeamSlot } from '../stores/teamStore.ts'

interface Props { data: GameData; search: URLSearchParams }

export function RailwayScreen({ data, search }: Props) {
  const { section, wave } = selectedEncounter(data.railway, search)
  const slots = useTeamStore(s => s.slots)
  const staggerMidAttack = useClashStore(s => s.setup.staggerMidAttack)

  const filledSlots = useMemo(() => slots.filter((s): s is TeamSlot => s !== null), [slots])
  const team = useMemo(() => filledSlots.flatMap(s => { const c = slotCombatant(s, data); return c ? [c] : [] }), [filledSlots, data])
  const { units, missingIds } = useMemo(() => waveUnits(data, wave), [data, wave])
  const options = useMemo(() => ({ staggerMidAttack }), [staggerMidAttack])
  const grid = useMatchupGrid(team, units, options)

  const select = (sectionNumber: number, waveNumber: number) =>
    navigate(href('/railway', new URLSearchParams({ section: String(sectionNumber), wave: String(waveNumber) })))

  const openCell = (rowIndex: number, colIndex: number) => {
    if (!grid.result) return
    const row = grid.result.rows[rowIndex]
    const col = grid.result.columns[colIndex]
    const slot = filledSlots.find(s => s.unitId === row.unitId)
    const part = data.unitsById.get(col.unitId)
    if (!slot || !part) return
    navigate(href('/', new URLSearchParams({ s: encodeSetup(pairingSetup(slot, row.skillId, part, col.skillId, staggerMidAttack)) })))
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <StationPicker data={data} section={section} wave={wave} onSelect={select} />
        <TeamBuilder data={data} />
      </div>
      {missingIds.length > 0 && <p className="text-xs text-blood-bright">No stat block on the wiki for enemy id{missingIds.length > 1 ? 's' : ''} {missingIds.join(', ')}; not shown in the grid.</p>}
      {team.length === 0 ? <p className="text-bone-dim">Add identities to the team to see the matchup grid for §{section.number} wave {wave.number}.</p>
        : units.length === 0 ? <p className="text-bone-dim">This wave has no enemy data.</p>
        : grid.error ? <p className="text-blood-bright">{grid.error}</p>
        : !grid.result ? <p className="text-bone-dim" aria-live="polite">Computing {team.length} identities against {units.length} parts…</p>
        : <MatchupGridView data={data} grid={grid.result} team={team} wave={units} onCell={openCell} />}
    </div>
  )
}
```

In `apps/web/src/App.tsx`, import `RailwayScreen` and reduce `RouteBody` to:

```tsx
function RouteBody({ route, data }: { route: Route; data: GameData }) {
  if (route.name === 'not-found') return <p className="text-bone-dim">No page at <code>{route.path}</code>.</p>
  if (route.name === 'clash') return <ClashScreen data={data} search={route.search} />
  return <RailwayScreen data={data} search={route.search} />
}
```

- [ ] **Step 6: Verify**

Run: `npm test -w @limbus/web && npm run typecheck -w @limbus/web && npm run lint -w @limbus/web`, then `npm run dev -w @limbus/web` and open `/railway`:
- Sections list with station names; selecting a section and wave updates the URL (`?section=&wave=`) and the enemy chips (portraits, `×N` part counts, the `#9553 no data` chip in the wave that contains it).
- Add three identities: the grid computes (visibly under a second), rows grouped by identity with slot labels, columns per part with HP and clashing skill, coverage strip, tinted cells, turns-to-kill footer; skill-less parts show `—` with damage only.
- Clicking a cell opens the Clash Calculator preloaded with that identity, that skill, that part and its skill; the browser back button returns to the grid with the team intact.
- Reload: team persists.
- 390 px: the grid scrolls horizontally inside its own container (sticky first column), the page itself does not.
Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "Build the Railway Planner with station picker, persisted team, and matchup grid

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

### Task 11: GitHub Pages deploy, root README, delete the old prototype

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`, `.gitignore`
- Delete: `ui/` (31 tracked files), `data/` (12 tracked files under `data/scraper/`; `data/generated` and `data/raw` were never tracked)

**Interfaces:**
- Produces: a Pages deploy on push to `main` or `master` that restores downloaded images from an Actions cache keyed on `images.json` (or downloads them on a miss), builds `apps/web` with `VITE_BASE=/<repo>/`, and publishes `apps/web/dist`. Requires the repository's Pages source to be set to "GitHub Actions" once, by hand.

- [ ] **Step 1: Delete the prototype and its scraper**

```bash
git rm -r -q ui data
```

Remove these lines (and their comment lines) from `.gitignore`:

```
# Generated/scraped data - regenerate via data/scraper/*.mjs, don't commit as source
data/generated/
data/raw/

# Vite public dir junction into data/generated
ui/public/gamedata
```

Run: `ls ui data 2>&1` — both must report "No such file or directory". If untracked leftovers remain (`ui/node_modules`, `ui/package-lock.json`, `data/generated`), remove those directories too. Then `npm run typecheck && npm test` at the root: unchanged (the prototype was outside the workspaces).

- [ ] **Step 2: Deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: deploy
on:
  push:
    branches: [main, master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      # packages/data/images is git-ignored (292 MB). Cache it by the manifest hash; a miss downloads
      # every portrait and icon from the wiki at one request per second (about 45 minutes).
      - name: Restore wiki images
        id: images
        uses: actions/cache@v4
        with:
          path: packages/data/images
          key: wiki-images-${{ hashFiles('packages/data/out/images.json') }}
      - name: Download wiki images (cache miss)
        if: steps.images.outputs.cache-hit != 'true'
        run: npm run scrape:images -w @limbus/data
      - name: Build site
        run: npm run build -w @limbus/web
        env:
          VITE_BASE: /${{ github.event.repository.name }}/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/web/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`VITE_BASE` assumes a project page at `https://<owner>.github.io/<repo>/`. For a user or organization page (repository named `<owner>.github.io`) set `VITE_BASE: /` instead; the README says so.

- [ ] **Step 3: Root README**

Replace `README.md` with:

```markdown
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
```

- [ ] **Step 4: Full workspace check**

Run: `npm run typecheck && npm run lint && npm test && npm run build -w @limbus/web`
Expected: all clean and green; `apps/web/dist/` contains `index.html`, `404.html`, `data/*.json`, and (if images were downloaded locally) `images/`. Then `npm run preview -w @limbus/web` and load `/railway` directly in a fresh tab: the SPA fallback serves the app. Stop the preview server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Deploy apps/web to GitHub Pages; delete the ui/ prototype and its scraper

Claude-Session: https://claude.ai/code/session_014d4xY96ebquY2ytUYQu18t"
```

---

## Self-review notes

- Spec coverage: §4 layout (`apps/web`, `deploy.yml`, README, `ui/` deleted) → Tasks 5, 11. §6.2 guard clash → Task 4. §6.4 Web Worker → Task 6. §7 stack, stores, persistence, worker, phone width → Tasks 5–10. §7.1 unit picker over identities and enemy parts, skill picker, level, uptie, SP, status stacks, manual overrides, effect list with parsed/unparsed marks → Task 8; verdict panel, damage band, per-coin table, stagger chance, breakdown, Roll once, shareable URL → Tasks 8–9. §7.2 station picker with waves and portraits, 12-slot persisted team, grid with win % and median damage, coverage strip, turns-to-kill, cell click preload → Task 10. §7.3 deploy with images in the build → Task 11 (via `sync-data` + Actions cache). §8 web `tsc` and lint in CI → Task 5. §9 steps 4 and 5 → Tasks 8–11. §10 stagger-mid-attack flag exposed → Task 8 checkbox; Railway-only buffs → manual overrides (Task 8). Plan 1 deferrals: `Combatant.skill` optional → Task 2; `isEffectApplicable` out of `legacy/` → Task 1.
- Deliberate deviations from the spec text: no router library (a 40-line path router plus a `404.html` copy gives the same `/` and `/railway` URLs on Pages); the coverage strip shows each part's resistance multipliers in a header row and the per-cell sin/type multipliers in the cell, since "against each of my skills" is a property of the pair; the railway types are mirrored into the web app rather than imported from `@limbus/data` to keep the app free of a scraper dependency; images reach the build through `sync-data` + an Actions cache rather than a copy step in the workflow.
- Type consistency checked across tasks: `ClashSample`, `SampledAttack`, `attackContext` (Task 4) consumed by `RollOnce` (Task 9); `MatchupCell.win: number | null` and `columns[].skillId: string | null` (Task 2) consumed by `MatchupGridView`, `pairingSetup`, `handleRequest` tests (Tasks 6, 10); `SideSetup`/`ClashSetup`/`emptySide`/`sideForUnit`/`toCombatant` (Task 7) consumed by Tasks 8–10; `TeamSlot` (Task 7) by Task 10; `slotLabel` (Task 8) by Task 10; `Stamp` (Task 8) by Task 9; `href`/`navigate`/`parseRoute` signatures with the optional `base` (Task 5) by Tasks 8, 10.
- Known follow-ups left outside this plan (from Plan 2's final review): three skills carry `coinCount: 1` because the wiki omits `coin=`; `rawText.coins` may be shorter than `coinCount`; both display as-is.
