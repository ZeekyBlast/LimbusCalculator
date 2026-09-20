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
