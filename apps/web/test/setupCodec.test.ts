import { describe, expect, it } from 'vitest'
import { emptySetup } from '../src/lib/setup.ts'
import { decodeSetup, encodeSetup } from '../src/lib/setupCodec.ts'

describe('setup codec', () => {
  it('round-trips a full setup through a URL-safe string', () => {
    const setup = emptySetup()
    setup.a = { ...setup.a, unitId: 'Blade Lineage Salsu Don Quixote', skillId: 'Blade Lineage Salsu Don Quixote::skill1', uptie: 3, level: 45, sanity: -12, status: { poise: { potency: 5, count: 2 } }, manual: { coinPower: 1, basePower: 0, clashPower: 2, damagePercent: 10 }, currentHp: 150 }
    setup.b = { ...setup.b, unitId: '9568:0', skillId: '9568:0::skill1', level: 60 }
    setup.staggerMidAttack = false
    const text = encodeSetup(setup)
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeSetup(text)).toEqual(setup)
  })
  it('rejects garbage and structurally wrong payloads', () => {
    expect(decodeSetup('not base64!')).toBeNull()
    expect(decodeSetup(btoa('{"nope":1}'))).toBeNull()
    const bad = { ...emptySetup(), a: { ...emptySetup().a, uptie: 9 } }
    expect(decodeSetup(encodeSetup(bad as never))).toBeNull()
  })
  it('handles non-ASCII unit names', () => {
    const setup = emptySetup()
    setup.a = { ...setup.a, unitId: 'Ryōshū 【Test】' }
    expect(decodeSetup(encodeSetup(setup))?.a.unitId).toBe('Ryōshū 【Test】')
  })
})
