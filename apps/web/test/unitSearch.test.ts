import { describe, expect, it } from 'vitest'
import { searchUnits, slotLabel } from '../src/lib/unitSearch.ts'
import { makeSkill, makeUnit } from './fixtures.ts'

const units = [
  makeUnit({ id: 'i1', name: 'Blade Lineage Salsu Don Quixote', group: 'Don Quixote' }),
  makeUnit({ id: 'i2', name: 'W Corp. L3 Cleanup Agent Don Quixote', group: 'Don Quixote' }),
  makeUnit({ id: 'i3', name: 'LCB Sinner Yi Sang', group: 'Yi Sang' }),
  makeUnit({ id: '9568:0', kind: 'enemy', name: 'Inverted Scale', group: 'Refracted Yinglong' }),
  makeUnit({ id: '9568:1', kind: 'enemy', name: 'Head', group: 'Refracted Yinglong' }),
]

describe('searchUnits', () => {
  it('groups identities by sinner (alphabetical) before enemies by enemy name (part order)', () => {
    const groups = searchUnits(units, '')
    expect(groups.map(g => `${g.kind}:${g.label}`)).toEqual(['identity:Don Quixote', 'identity:Yi Sang', 'enemy:Refracted Yinglong'])
    expect(groups[2].units.map(u => u.id)).toEqual(['9568:0', '9568:1'])
  })
  it('matches every whitespace-separated token against name and group, case-insensitively', () => {
    expect(searchUnits(units, 'salsu don').flatMap(g => g.units.map(u => u.id))).toEqual(['i1'])
    expect(searchUnits(units, 'yinglong head').flatMap(g => g.units.map(u => u.id))).toEqual(['9568:1'])
    expect(searchUnits(units, 'zzz')).toEqual([])
  })
  it('restricts by kind', () => {
    expect(searchUnits(units, '', ['identity']).every(g => g.kind === 'identity')).toBe(true)
  })
})

describe('slotLabel', () => {
  it('names slots and variants', () => {
    expect(slotLabel(makeSkill({ slot: 'skill1' }))).toBe('S1')
    expect(slotLabel(makeSkill({ slot: 'skill3', variant: '2' }))).toBe('S3 v2')
    expect(slotLabel(makeSkill({ slot: 'defense' }))).toBe('DEF')
    expect(slotLabel(makeSkill({ slot: 'enemy' }))).toBe('ATK')
  })
})
