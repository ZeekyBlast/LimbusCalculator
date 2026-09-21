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
