import { describe, expect, it } from 'vitest'
import { enemyCombatant, matchupGrid, primaryAttackSkill } from '../src/matchup'
import { makeCombatant, makeSkill, makeUnit } from './fixtures'

describe('primaryAttackSkill', () => {
  it('picks the highest attack weight attack skill, first on ties', () => {
    const u = makeUnit({ skills: [
      makeSkill({ id: 'guard', damageType: 'guard', attackWeight: 9 }),
      makeSkill({ id: 's1', attackWeight: 1 }),
      makeSkill({ id: 's2', attackWeight: 3 }),
      makeSkill({ id: 's3', attackWeight: 3 }),
    ] })
    expect(primaryAttackSkill(u)?.id).toBe('s2')
  })
  it('returns undefined without attack skills', () => {
    expect(primaryAttackSkill(makeUnit({ skills: [makeSkill({ damageType: 'evade' })] }))).toBeUndefined()
  })
})

describe('enemyCombatant', () => {
  it('uses unit level, uptie 4, zero sanity', () => {
    const u = makeUnit({ kind: 'enemy', level: 60 })
    const c = enemyCombatant(u, u.skills[0])
    expect(c.level).toBe(60)
    expect(c.uptie).toBe(4)
    expect(c.sanity).toBe(0)
  })
})

describe('matchupGrid', () => {
  it('builds rows per attack skill and columns per enemy with turns to kill', () => {
    const me = makeCombatant({ unit: makeUnit({ id: 'me', skills: [
      makeSkill({ id: 'a1', slot: 'skill1' }),
      makeSkill({ id: 'a2', slot: 'skill2', basePower: 30, coinPower: 0, coinCount: 1 }),
      makeSkill({ id: 'def', slot: 'defense', damageType: 'guard' }),
    ] }) })
    const foe = makeUnit({ id: 'foe', kind: 'enemy', hp: 90, skills: [makeSkill({ id: 'f1' })] })
    const grid = matchupGrid([me], [foe])
    expect(grid.rows.map(r => r.skillId)).toEqual(['a1', 'a2'])
    expect(grid.columns).toHaveLength(1)
    expect(grid.columns[0].unitId).toBe('foe')
    expect(grid.columns[0].turnsToKill).toBe(3) // 90 / 30
    expect(grid.cells).toHaveLength(2)
    expect(grid.cells[1][0].win).toBe(1)
    expect(grid.cells[1][0].meanDamage).toBe(30)
    expect(grid.cells[0][0].sinMultiplier).toBe(1)
  })
  it('skips enemies without attack skills', () => {
    const me = makeCombatant()
    const grid = matchupGrid([me], [makeUnit({ id: 'x', skills: [makeSkill({ damageType: 'guard' })] })])
    expect(grid.columns).toHaveLength(0)
    expect(grid.cells[0]).toHaveLength(0)
  })
})
