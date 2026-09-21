import { describe, expect, it } from 'vitest'
import { indexData } from '../src/lib/data.ts'
import { emptySetup, sideForUnit, skillAtUptie, toCombatant } from '../src/lib/setup.ts'
import { makeRaw, makeSkill, makeUnit } from './fixtures.ts'

const data = indexData(makeRaw())

describe('sideForUnit', () => {
  it('starts at the scraped level, uptie 4, primary attack skill, clean state', () => {
    const unit = makeUnit({ skills: [makeSkill({ id: 'g', damageType: 'guard', attackWeight: 9 }), makeSkill({ id: 's2', attackWeight: 2 })] })
    const side = sideForUnit(unit)
    expect(side).toMatchObject({ unitId: 'u', skillId: 's2', level: 60, uptie: 4, sanity: 0, currentHp: null, status: {} })
  })
  it('keeps an explicitly requested skill and copes with a skill-less part', () => {
    const unit = makeUnit({ skills: [makeSkill({ id: 'g', damageType: 'guard' }), makeSkill({ id: 's2' })] })
    expect(sideForUnit(unit, 'g').skillId).toBe('g')
    expect(sideForUnit(makeUnit({ skills: [] })).skillId).toBeNull()
  })
})

describe('skillAtUptie', () => {
  it('applies overrides from their tier upward until a higher tier overrides', () => {
    const skill = makeSkill({ basePower: 3, coinPower: 3, uptie: { 2: { basePower: 2 }, 3: { coinPower: 5 } } })
    expect(skillAtUptie(skill, 1)).toMatchObject({ basePower: 3, coinPower: 3 })
    expect(skillAtUptie(skill, 2)).toMatchObject({ basePower: 2, coinPower: 3 })
    expect(skillAtUptie(skill, 4)).toMatchObject({ basePower: 2, coinPower: 5 })
  })
})

describe('toCombatant', () => {
  it('returns undefined without a unit and a skill-less combatant for a skill-less part', () => {
    expect(toCombatant(emptySetup().a, data)).toBeUndefined()
    const c = toCombatant(sideForUnit(data.unitsById.get('9568:1')!), data)
    expect(c?.unit.id).toBe('9568:1')
    expect(c?.skill).toBeUndefined()
  })
  it('rescales max HP when the level differs from the scraped one', () => {
    const side = { ...sideForUnit(data.unitsById.get('u')!), level: 50 }
    expect(toCombatant(side, data)?.unit.hp).toBe(180) // 200 + 2 * (50 - 60)
    expect(toCombatant(side, data)?.level).toBe(50)
  })
  it('forces enemy sanity to zero and passes current HP through', () => {
    const side = { ...sideForUnit(data.unitsById.get('9568:0')!), sanity: 30, currentHp: 77 }
    const c = toCombatant(side, data)!
    expect(c.sanity).toBe(0)
    expect(c.currentHp).toBe(77)
    expect(toCombatant({ ...sideForUnit(data.unitsById.get('u')!), sanity: 30 }, data)?.sanity).toBe(30)
  })
})
