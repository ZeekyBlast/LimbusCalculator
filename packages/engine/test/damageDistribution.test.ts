import { describe, expect, it } from 'vitest'
import { attackDamageDistribution, mixDistributions, sampleAttack, type AttackParams } from '../src/damageDistribution'

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
  it('treats stagger lines already behind current HP as crossed before the attack', () => {
    // 5 HP of 20 with a threshold at 70% puts the line at 5 - 14 = -9: already crossed.
    // The single coin therefore uses staggerDamageTypeResistanceModifier(1) = 1: floor(7 * 2) = 14.
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, defenderMaxHp: 20, defenderCurrentHp: 5, staggerThresholds: [0.7] }))
    expect(d.mean).toBe(14)
    expect(d.staggerChance).toEqual([0])
  })
  it('counts every already-crossed line toward the stagger multiplier', () => {
    // Lines at 5 - 14 = -9 and 5 - 8 = -3, both already crossed, so the coin uses
    // staggerDamageTypeResistanceModifier(2) = 1.5: floor(7 * 2.5) = 17.
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, defenderMaxHp: 20, defenderCurrentHp: 5, staggerThresholds: [0.7, 0.4] }))
    expect(d.mean).toBe(17)
    expect(d.staggerChance).toEqual([0, 0])
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
  it('zero-pads shorter parts and keeps perCoinMean summing to the mixed mean', () => {
    const one = attackDamageDistribution(params({ coins: 1 }))
    const two = attackDamageDistribution(params({ coins: 2 }))
    const m = mixDistributions([{ weight: 0.3, summary: one }, { weight: 0.7, summary: two }])
    expect(m.perCoinMean).toHaveLength(2)
    expect(m.perCoinMean.reduce((x, y) => x + y, 0)).toBeCloseTo(m.mean, 12)
  })
})

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
