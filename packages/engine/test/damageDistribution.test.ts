import { describe, expect, it } from 'vitest'
import { attackDamageDistribution, mixDistributions, type AttackParams } from '../src/damageDistribution'

function params(over: Partial<AttackParams> = {}): AttackParams {
  return {
    coins: 3, basePower: 4, coinPower: 3, coinRollBonus: 0, headsChance: 0.5,
    critChance: 0, poiseCount: 0, critModifier: 0.2,
    sinResistance: 0, damageTypeResistance: 0, offenseDefenseAdvantage: 0, parryBonus: 0,
    dynamicModifier: 0, critOnlyModifier: 0, defenderMaxHp: 1000, defenderCurrentHp: 1000,
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
  it('crossing two stagger lines advances the multiplier twice', () => {
    // 3 coins always heads: 7, 10, 13. Thresholds [0.7, 0.4] of 20 HP => lines at 6 and 12.
    // Coin 1 (7) crosses line 6 (crossed=1). Coin 2 uses staggerDamageTypeResistanceModifier(1)=1:
    // floor(10*2)=20, total 27, which crosses line 12 (crossed=2). Coin 3 uses
    // staggerDamageTypeResistanceModifier(2)=1.5: floor(13*2.5)=32. Total 7+20+32=59.
    const d = attackDamageDistribution(params({ headsChance: 1, defenderMaxHp: 20, defenderCurrentHp: 20, staggerThresholds: [0.7, 0.4] }))
    expect(d.mean).toBe(59)
    expect(d.staggerChance).toEqual([1, 1])
  })
  it('applies crit-only dynamic modifiers on the crit branch only', () => {
    // one coin always heads, always crit: 7 * (1 + 0.2) * (1 + 0.5) = 12.6 -> 12
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 1, critOnlyModifier: 0.5 }))
    expect(d.mean).toBe(12)
    // no poise count left means no crit, so the crit-only modifier never applies
    const none = attackDamageDistribution(params({ coins: 1, headsChance: 1, critChance: 1, poiseCount: 0, critOnlyModifier: 0.5 }))
    expect(none.mean).toBe(7)
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
