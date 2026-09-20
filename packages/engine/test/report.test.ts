import { describe, expect, it } from 'vitest'
import { clashReport, sampleClash, unopposedReport } from '../src/report'
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
  it('reports zero damage for a non-attack skill', () => {
    const attacker = makeCombatant({ skill: makeSkill({ damageType: 'guard' }) })
    const r = unopposedReport(attacker, makeCombatant({ unit: makeUnit({ id: 'b' }) }))
    expect(r.damage.mean).toBe(0)
    expect(r.damage.histogram).toEqual([[0, 1]])
    expect(r.breakdown.length).toBeGreaterThan(0)
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
  it('never invents coins from out-of-range unbreakable indices', () => {
    const a = makeCombatant({ skill: makeSkill({ coinCount: 2, unbreakableCoins: [0, 1, 2] }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ basePower: 0, coinPower: 0, coinCount: 1 })] }) })
    const r = clashReport(a, b)
    expect(r.coinsLeftIfWin).toHaveLength(3)
    expect(r.coinsLeftIfWin[2]).toBeCloseTo(1, 12)
  })
  it('folds expected parry rounds into the parry bonus line', () => {
    const a = makeCombatant({ skill: makeSkill({ basePower: 0, coinPower: 1, coinCount: 1 }) })
    const b = makeCombatant({ unit: makeUnit({ id: 'b', skills: [makeSkill({ basePower: 0, coinPower: 1, coinCount: 1 })] }) })
    const r = clashReport(a, b)
    expect(r.parryRoundsExpected).toBeCloseTo(1)
    expect(r.breakdown.find(l => l.label === 'Parry bonus')?.value).toBeCloseTo(0.03)
  })
})

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
    expect(r.coinsLeftIfWin[0]).toBe(0)
    expect(r.coinsLeftIfWin[1]).toBeCloseTo(0.75)
    expect(r.coinsLeftIfLose[1]).toBeCloseTo(0.25)
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
    expect(r.coinsLeftIfWin.reduce((sum, p) => sum + p, 0)).toBeCloseTo(r.win)
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
