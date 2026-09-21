import { resolveCombatant, EMPTY_MANUAL, type Effect } from '@limbus/engine'
import { describe, expect, it } from 'vitest'
import { effectStatus } from '../src/lib/effectStatus.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

const applied: Effect = { trigger: 'on-use', scope: 'skill', op: { kind: 'coinPower', delta: 1 }, source: 'Coin Power +1' }
const gated: Effect = { trigger: 'on-use', scope: 'skill', condition: { stat: 'poise', side: 'self', field: 'potency', op: '>=', value: 5 }, op: { kind: 'basePower', delta: 1 }, source: 'At 5+ Poise, Base Power +1' }
const unparsed: Effect = { trigger: 'on-hit', scope: 'skill', op: { kind: 'unparsed' }, source: 'Something the parser does not know' }
const perCoin: Effect = { trigger: 'on-hit', scope: { coin: 0 }, op: { kind: 'applyStatus', target: 'target', status: 'rupture', potency: 1 }, source: '[On Hit] Inflict 1 Rupture' }

describe('effectStatus', () => {
  const unit = makeUnit({ skills: [makeSkill({ effects: [applied, gated, unparsed, perCoin] })] })
  const resolved = resolveCombatant({ unit, skill: unit.skills[0], uptie: 4, level: 60, sanity: 0, status: {}, manual: { ...EMPTY_MANUAL } })
  it('marks applied, unparsed, and inactive effects', () => {
    expect(effectStatus(applied, resolved)).toBe('applied')
    expect(effectStatus(unparsed, resolved)).toBe('unparsed')
    expect(effectStatus(gated, resolved)).toBe('inactive')
  })
  it('reports per-coin effects the way the engine does: unparsed for now', () => {
    expect(effectStatus(perCoin, resolved)).toBe('unparsed')
  })
})
