import { describe, expect, it } from 'vitest'
import { resolveCombatant } from '../src/resolveCombatant'
import { effect, makeCombatant, makeSkill, makeUnit } from './fixtures'
import type { Effect } from '../src/types'

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
  it('collects coin-scoped effects into coinEffects/effectsPerCoin instead of the flat totals', () => {
    const skill = makeSkill({ effects: [
      effect({ kind: 'coinPower', delta: 3 }, { scope: { coin: 1 }, source: 'On Coin 2: +3 Coin Power' }),
    ] })
    const r = resolveCombatant(makeCombatant({ skill }))
    expect(r.coinPower).toBe(3)
    expect(r.effectsUnparsed).toEqual([])
    expect(r.effectsPerCoin).toEqual(['On Coin 2: +3 Coin Power'])
    expect(r.effectsApplied).toEqual([])
  })
  it('applies an unconditional on-use applyStatus op as a pre-clash grant', () => {
    const skill = makeSkill({ effects: [
      effect({ kind: 'applyStatus', target: 'target', status: 'bleed', potency: 2, count: 3 }, { source: 'Inflict 2 Bleed' }),
    ] })
    const r = resolveCombatant(makeCombatant({ skill }))
    expect(r.effectsApplied).toEqual(['Inflict 2 Bleed'])
    expect(r.effectsUnparsed).toEqual([])
    expect(r.statusAfterPrepare.target.bleed).toEqual({ potency: 2, count: 3 })
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
  it('counts only distinct in-range unbreakable coin indices', () => {
    const count = (unbreakableCoins: number[]) =>
      resolveCombatant(makeCombatant({ skill: makeSkill({ coinCount: 2, unbreakableCoins }) })).unbreakableCoins
    expect(count([0, 1, 2])).toBe(2)
    expect(count([1, 1])).toBe(1)
    expect(count([-1, 5])).toBe(0)
  })

  it('adds coin-power-additive status (Coin Boost) to coin power', () => {
    const r = resolveCombatant(makeCombatant({ status: { 'coin-boost': { potency: 2, count: 0 } } }))
    expect(r.coinPower).toBe(5)
  })
  it('buckets every dynamic-additive-fragile-protection id on the target side', () => {
    const r = resolveCombatant(makeCombatant({ status: { 'fragile-slash': { potency: 3, count: 0 } } }))
    expect(r.dynamicAsTarget).toBeCloseTo(0.3)
    expect(r.dynamicAsAttacker).toBeCloseTo(0)
  })
  it('reports crit-only modifiers separately from the always-on attacker modifier', () => {
    const r = resolveCombatant(makeCombatant({ status: { 'crit-damage-up': { potency: 2, count: 0 } } }))
    expect(r.critOnlyModifier).toBeCloseTo(0.2)
    expect(r.dynamicAsAttacker).toBeCloseTo(0)
  })
})

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
