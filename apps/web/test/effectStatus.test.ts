import { resolveCombatant, EMPTY_MANUAL, type Effect } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { effectStatus } from '../src/lib/effectStatus.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

const applied: Effect = { trigger: 'on-use', scope: 'skill', op: { kind: 'coinPower', delta: 1 }, source: 'Coin Power +1' }
const gated: Effect = { trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 }, op: { kind: 'basePower', delta: 1 }, source: 'At 5+ Poise, Base Power +1' }
const unparsed: Effect = { trigger: 'on-hit', scope: 'skill', op: { kind: 'unparsed' }, source: 'Something the parser does not know' }
const perCoin: Effect = { trigger: 'on-hit', scope: { coin: 1 }, op: { kind: 'applyStatus', target: 'target', status: 'rupture', potency: 1 }, source: '[On Hit] Inflict 1 Rupture' }
const grantNow: Effect = { trigger: 'on-use', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'charge', count: 3 }, source: '[On Use] Gain 3 Charge' }
const later: Effect = { trigger: 'clash-win', scope: 'skill', op: { kind: 'applyStatus', target: 'self', status: 'poise', potency: 2 }, source: '[Clash Win] Gain 2 Poise' }
const critDamage: Effect = { trigger: 'on-crit', scope: 'skill', op: { kind: 'damagePercent', delta: 0.2 }, source: '+20% damage on crit' }

describe('effectStatus', () => {
  const unit = makeUnit({ skills: [makeSkill({ effects: [applied, gated, unparsed, perCoin, grantNow, later, critDamage] })] })
  const resolved = resolveCombatant({ unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } })
  it('marks applied, unparsed and inactive lines', () => {
    expect(effectStatus(applied, resolved)).toEqual({ status: 'applied' })
    expect(effectStatus(unparsed, resolved)).toEqual({ status: 'unparsed' })
    expect(effectStatus(gated, resolved)).toEqual({ status: 'inactive' })
  })
  it('marks per-coin lines with their coin, and per-coin skill lines without one', () => {
    expect(effectStatus(perCoin, resolved)).toEqual({ status: 'per-coin', coin: 1 })
    expect(effectStatus(critDamage, resolved)).toEqual({ status: 'per-coin' })
  })
  it('marks pre-clash grants applied and clash-result grants pending', () => {
    expect(effectStatus(grantNow, resolved)).toEqual({ status: 'applied' })
    expect(effectStatus(later, resolved)).toEqual({ status: 'pending' })
  })
})
