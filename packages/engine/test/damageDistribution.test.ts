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
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, status: poise(20, 1) }))
    expect(d.mean).toBe(8)
    const none = attackDamageDistribution(params({ coins: 1, headsChance: 1, status: poise(20, 0) }))
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
    const d = attackDamageDistribution(params({ coins: 1, headsChance: 1, status: poise(20, 1, { 'crit-damage-up': { potency: 5, count: 0 } }) }))
    expect(d.mean).toBe(12)
    // no poise count left means no crit, so the crit-only modifier never applies
    const none = attackDamageDistribution(params({ coins: 1, headsChance: 1, status: poise(20, 0, { 'crit-damage-up': { potency: 5, count: 0 } }) }))
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
  it('a zero roll is absorbed rather than falling back to the 1-damage floor', () => {
    // Rolls are 0, so every coin is fully absorbed while any reduction is left: 0 damage, not 1.
    const d = attackDamageDistribution(params({ coins: 2, basePower: 0, coinPower: 0, headsChance: 1, powerReduction: 3 }))
    expect(d.histogram).toEqual([[0, 1]])
    expect(d.perCoinMean).toEqual([0, 0])
  })
  it('a negative roll absorbs nothing, leaving the reduction for the coins behind it', () => {
    // Rolls are -2. Neither coin may credit its negative roll back into the pool, so the 5 points
    // of reduction survive both coins and both deal 0.
    const d = attackDamageDistribution(params({ coins: 2, basePower: -2, coinPower: 0, headsChance: 1, powerReduction: 5 }))
    expect(d.histogram).toEqual([[0, 1]])
    expect(d.perCoinMean).toEqual([0, 0])
    const s = sampleAttack(params({ coins: 2, basePower: -2, coinPower: 0, headsChance: 1, powerReduction: 5 }), () => 0)
    expect(s.coins.map(c => c.damage)).toEqual([0, 0])
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
    const p = params({ coins: 3, status: poise(10, 2), critModifier: 0.2 })
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
