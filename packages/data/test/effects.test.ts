import { describe, expect, it } from 'vitest'
import { effectCoverage, parseEffectText } from '../src/effects/parse.ts'

const one = (text: string, scope: 'skill' | { coin: number } = 'skill', trigger: 'on-use' | 'on-hit' | 'passive' = 'on-use') =>
  parseEffectText(text, scope, trigger)

describe('parseEffectText', () => {
  it('parses a conditional coin power line', () => {
    const [e] = one('At 5+ Poise on self, Coin Power +1')
    expect(e.trigger).toBe('on-use')
    expect(e.scope).toBe('skill')
    expect(e.condition).toEqual({ stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 })
    expect(e.op).toEqual({ kind: 'coinPower', delta: 1 })
    expect(e.source).toBe('At 5+ Poise on self, Coin Power +1')
  })
  it('parses tagged status grants with potency and count', () => {
    const [e] = one('[On Use] Gain +2 Poise Count')
    expect(e.trigger).toBe('on-use')
    expect(e.op).toEqual({ kind: 'applyStatus', target: 'self', status: 'poise', count: 2 })
    const [h] = one('[On Hit] Inflict 2 Rupture', { coin: 0 }, 'on-hit')
    expect(h.trigger).toBe('on-hit')
    expect(h.scope).toEqual({ coin: 0 })
    expect(h.op).toEqual({ kind: 'applyStatus', target: 'target', status: 'rupture', potency: 2 })
  })
  it('splits "and" clauses that reuse the verb', () => {
    const es = one('[On Hit] Inflict 3 Rupture and +2 Rupture Count', { coin: 0 }, 'on-hit')
    expect(es).toHaveLength(2)
    expect(es[0].op).toEqual({ kind: 'applyStatus', target: 'target', status: 'rupture', potency: 3 })
    expect(es[1].op).toEqual({ kind: 'applyStatus', target: 'target', status: 'rupture', count: 2 })
  })
  it('parses target and count conditions', () => {
    expect(one('If target has 3+ Rupture, Coin Power +1')[0].condition).toEqual({ stat: 'rupture', side: 'target', field: 'potency', op: '>=', value: 3 })
    expect(one('If at 3+ Poise Count, Coin Power +1')[0].condition).toEqual({ stat: 'poise', side: 'self', field: 'count', op: '>=', value: 3 })
    expect(one('[On Use] At 6+ Poise, Coin Power +1')[0].condition?.side).toBe('self')
  })
  it('parses power and damage operations', () => {
    expect(one('Base Power +2')[0].op).toEqual({ kind: 'basePower', delta: 2 })
    expect(one('Final Power +1')[0].op).toEqual({ kind: 'basePower', delta: 1 })
    expect(one('[Clash Win] Clash Power +2')[0].op).toEqual({ kind: 'clashPower', delta: 2 })
    expect(one('Coin Power -1')[0].op).toEqual({ kind: 'coinPower', delta: -1 })
    expect(one('Deal +20% damage')[0].op).toEqual({ kind: 'damagePercent', delta: 0.2 })
    const crit = one('+30% Damage on Critical Hit')[0]
    expect(crit.op).toEqual({ kind: 'damagePercent', delta: 0.3 })
    expect(crit.trigger).toBe('on-crit')
  })
  it('parses next-turn grants and passive text', () => {
    expect(one('[On Hit] Inflict 2 Bind next turn', { coin: 1 }, 'on-hit')[0].op).toEqual({ kind: 'applyStatus', target: 'target', status: 'bind', potency: 2 })
    expect(one('Gain 1 Protection', 'skill', 'passive')[0].trigger).toBe('passive')
  })
  it('leaves scaling, reuse, unknown tags, and ally targeting unparsed', () => {
    for (const line of [
      'Coin Power +1 for every 7 Poise on self (max 3)',
      '[Clash Lose] Deal -80% damage and damage dealt by this Skill cannot Stagger the target',
      '[Unclashable] [Target Fixed]',
      '[On Crit] To 1 ally that either has no Poise or has the least Poise Potency, apply 2 Poise',
      '[On Use] Consume all Flower-burying Pin on self and Reuse the final Coin',
      'Unbreakable Coin',
    ]) {
      const [e] = one(line)
      expect(e.op).toEqual({ kind: 'unparsed' })
      expect(e.source).toBe(line)
    }
    expect(one('[Clash Lose] Deal -80% damage and damage dealt by this Skill cannot Stagger the target')[0].trigger).toBe('clash-lose')
  })
  it('handles multi-line text and empty input', () => {
    const es = one('At 5+ Poise on self, Coin Power +1\n[On Use] Gain +2 Poise Count')
    expect(es).toHaveLength(2)
    expect(one('')).toEqual([])
    expect(one('  \n ')).toEqual([])
  })
})

describe('effectCoverage', () => {
  it('counts parsed versus total', () => {
    const es = one('At 5+ Poise on self, Coin Power +1\nCoin Power +1 for every 7 Poise on self (max 3)')
    expect(effectCoverage(es)).toEqual({ total: 2, parsed: 1 })
  })
})
