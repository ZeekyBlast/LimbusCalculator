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
  it('surfaces coin-scoped effects as unparsed instead of dropping them', () => {
    const skill = makeSkill({ effects: [
      effect({ kind: 'coinPower', delta: 3 }, { scope: { coin: 1 }, source: 'On Coin 2: +3 Coin Power' }),
    ] })
    const r = resolveCombatant(makeCombatant({ skill }))
    expect(r.coinPower).toBe(3)
    expect(r.effectsUnparsed).toEqual(['On Coin 2: +3 Coin Power'])
    expect(r.effectsApplied).toEqual([])
  })
  it('skips applyStatus ops without recording them as applied or unparsed', () => {
    const skill = makeSkill({ effects: [
      effect({ kind: 'applyStatus', target: 'target', status: 'bleed', potency: 2, count: 3 }, { source: 'Inflict 2 Bleed' }),
    ] })
    const r = resolveCombatant(makeCombatant({ skill }))
    expect(r.effectsApplied).toEqual([])
    expect(r.effectsUnparsed).toEqual([])
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
