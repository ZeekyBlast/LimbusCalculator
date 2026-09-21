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
