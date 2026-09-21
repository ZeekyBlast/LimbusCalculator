import { describe, expect, it } from 'vitest'
import { indexData, type RailwayLine } from '../src/lib/data.ts'
import { pairingSetup, selectedEncounter, slotCombatant, waveUnits } from '../src/lib/railway.ts'
import { makeRaw } from './fixtures.ts'

const data = indexData(makeRaw())

describe('waveUnits', () => {
  it('expands enemy ids into their parts, main wave before reinforcements, and lists ids with no data', () => {
    const r = waveUnits(data, { number: 1, enemyIds: ['9568'], reinforcementIds: ['9553'] })
    expect(r.units.map(u => u.id)).toEqual(['9568:0', '9568:1'])
    expect(r.missingIds).toEqual(['9553'])
  })
})

describe('slotCombatant', () => {
  it('builds a team combatant at the slot uptie and level with no skill selected', () => {
    const c = slotCombatant({ unitId: 'u', uptie: 3, level: 50 }, data)!
    expect(c.unit.hp).toBe(180)
    expect(c.uptie).toBe(3)
    expect(c.skill).toBeUndefined()
    expect(slotCombatant({ unitId: 'missing', uptie: 4, level: 60 }, data)).toBeUndefined()
  })
})

describe('pairingSetup', () => {
  it('preloads the clash calculator with my skill against the part and its skill', () => {
    const setup = pairingSetup({ unitId: 'u', uptie: 3, level: 50 }, 'u::skill1', data.unitsById.get('9568:0')!, '9568:0::skill1', false)
    expect(setup.a).toMatchObject({ unitId: 'u', skillId: 'u::skill1', uptie: 3, level: 50 })
    expect(setup.b).toMatchObject({ unitId: '9568:0', skillId: '9568:0::skill1', level: 60 })
    expect(setup.staggerMidAttack).toBe(false)
  })
  it('leaves the enemy skill empty for a skill-less part', () => {
    expect(pairingSetup({ unitId: 'u', uptie: 4, level: 60 }, 'u::skill1', data.unitsById.get('9568:1')!, null, true).b.skillId).toBeNull()
  })
})

const line = (sections: RailwayLine['sections']): RailwayLine =>
  ({ title: 'Line 6', start: 'May 28th, 2026', stations: [{ number: 1, name: 'Weighing of Robes' }], sections, enemyIds: [] })

describe('selectedEncounter', () => {
  it('defaults to the first section and wave and clamps unknown numbers', () => {
    expect(selectedEncounter(data.railway, new URLSearchParams())).toMatchObject({ section: { number: 1 }, wave: { number: 1 } })
    expect(selectedEncounter(data.railway, new URLSearchParams({ section: '9', wave: '9' }))).toMatchObject({ section: { number: 1 }, wave: { number: 1 } })
  })

  it('falls back to the first section that has waves when the chosen one has none', () => {
    const railway = line([
      { number: 1, name: 'Not yet datamined', stationNumbers: [1], waves: [] },
      { number: 2, name: 'Tarnishing', stationNumbers: [2], waves: [{ number: 3, enemyIds: ['9568'], reinforcementIds: [] }] },
    ])
    expect(selectedEncounter(railway, new URLSearchParams())).toMatchObject({ section: { number: 2 }, wave: { number: 3 } })
    expect(selectedEncounter(railway, new URLSearchParams({ section: '1', wave: '3' }))).toMatchObject({ section: { number: 2 }, wave: { number: 3 } })
  })

  it('keeps the requested section and reports no wave when no section on the line has waves', () => {
    const railway = line([
      { number: 1, name: 'Not yet datamined', stationNumbers: [1], waves: [] },
      { number: 2, name: 'Also empty', stationNumbers: [2], waves: [] },
    ])
    const chosen = selectedEncounter(railway, new URLSearchParams({ section: '2' }))
    expect(chosen.section.number).toBe(2)
    expect(chosen.wave).toBeUndefined()
    expect(selectedEncounter(railway, new URLSearchParams()).wave).toBeUndefined()
  })
})
